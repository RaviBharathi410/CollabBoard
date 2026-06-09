"""Fine-tune PaddleOCR on diagram text regions."""

from __future__ import annotations

import argparse
import os
import random
from pathlib import Path

import cv2
import yaml

DIAGRAM_VOCABULARY = [
    "API", "DB", "Auth", "Cache", "Queue", "CDN", "LB", "S3", "EC2", "RDS",
    "Redis", "Kafka", "Nginx", "Docker", "K8s", "gRPC", "REST", "GraphQL",
    "Start", "End", "Yes", "No", "Input", "Output", "Process", "Decision",
    "PK", "FK", "id", "int", "varchar", "timestamp", "boolean", "1:N", "M:N",
    "User", "Service", "Server", "Client", "Request", "Response", "Token",
]

TEXT_REGION_CLASS = 8


def prepare_ocr_training_data(diagram_images_dir: Path, output_dir: Path):
    """Extract text_region crops from YOLO-labeled diagram images."""
    output_dir.mkdir(parents=True, exist_ok=True)
    crops_dir = output_dir / "crops"
    crops_dir.mkdir(exist_ok=True)

    train_list = []
    val_list = []

    for split, out_list in [("train", train_list), ("val", val_list)]:
        img_dir = diagram_images_dir / split / "images"
        lbl_dir = diagram_images_dir / split / "labels"
        if not img_dir.exists():
            continue

        for label_file in lbl_dir.glob("*.txt"):
            for ext in [".jpg", ".png", ".jpeg"]:
                image_file = img_dir / f"{label_file.stem}{ext}"
                if image_file.exists():
                    break
            else:
                continue

            img = cv2.imread(str(image_file))
            if img is None:
                continue
            h, w = img.shape[:2]

            with open(label_file, encoding="utf-8") as f:
                annotations = f.readlines()

            for ann_idx, ann in enumerate(annotations):
                parts = ann.strip().split()
                if len(parts) < 5:
                    continue
                class_idx = int(parts[0])
                if class_idx != TEXT_REGION_CLASS:
                    continue
                cx, cy, nw, nh = map(float, parts[1:5])
                x1 = int((cx - nw / 2) * w)
                y1 = int((cy - nh / 2) * h)
                x2 = int((cx + nw / 2) * w)
                y2 = int((cy + nh / 2) * h)
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(w, x2), min(h, y2)
                crop = img[y1:y2, x1:x2]
                if crop.size == 0:
                    continue

                crop_name = f"{label_file.stem}_{ann_idx}.jpg"
                crop_path = crops_dir / crop_name
                cv2.imwrite(str(crop_path), crop)

                label_text = f"text_{ann_idx}"
                rel_path = f"crops/{crop_name}"
                out_list.append(f"{rel_path}\t{label_text}")

    with open(output_dir / "train_list.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(train_list))
    with open(output_dir / "val_list.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(val_list))

    print(f"OCR training data: {len(train_list)} train, {len(val_list)} val crops")
    return output_dir


def fine_tune_paddleocr(data_dir: Path, output_dir: Path, epochs: int = 50):
    """Build PaddleOCR config and launch training when PaddleOCR tools are available."""
    output_dir.mkdir(parents=True, exist_ok=True)

    vocab = sorted(
        set(
            list("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 :/.-_()[]{}")
            + DIAGRAM_VOCABULARY
        )
    )
    dict_path = output_dir / "diagram_dict.txt"
    dict_path.write_text("\n".join(vocab), encoding="utf-8")

    config = {
        "Global": {
            "use_gpu": False,
            "epoch_num": epochs,
            "log_smooth_window": 20,
            "print_batch_step": 10,
            "save_model_dir": str(output_dir / "ocr_checkpoints"),
            "save_epoch_step": 5,
            "eval_batch_step": [0, 100],
            "cal_metric_during_train": True,
            "character_dict_path": str(dict_path),
            "max_text_length": 50,
            "infer_mode": False,
        },
        "Architecture": {
            "model_type": "rec",
            "algorithm": "SVTR_LCNet",
            "Transform": None,
            "Backbone": {"name": "MobileNetV1Enhance", "scale": 0.5},
            "Neck": {"name": "SequenceEncoder", "encoder_type": "svtr"},
            "Head": {"name": "CTCHead"},
        },
        "Loss": {"name": "CTCLoss"},
        "Optimizer": {
            "name": "Adam",
            "lr": {"name": "Cosine", "learning_rate": 0.001, "warmup_epoch": 5},
            "regularizer": {"name": "L2", "factor": 0.00003},
        },
        "Train": {
            "dataset": {
                "name": "SimpleDataSet",
                "data_dir": str(data_dir),
                "label_file_list": [str(data_dir / "train_list.txt")],
            }
        },
        "Eval": {
            "dataset": {
                "name": "SimpleDataSet",
                "data_dir": str(data_dir),
                "label_file_list": [str(data_dir / "val_list.txt")],
            }
        },
    }

    config_path = output_dir / "ocr_config.yml"
    with open(config_path, "w", encoding="utf-8") as f:
        yaml.dump(config, f)

    train_list = data_dir / "train_list.txt"
    if not train_list.exists() or train_list.stat().st_size == 0:
        print("No OCR training crops found. Run after diagram dataset has text_region labels.")
        return

    paddleocr_repo = os.environ.get("PADDLEOCR_REPO", "")
    train_script = Path(paddleocr_repo) / "tools" / "train.py" if paddleocr_repo else None
    if train_script and train_script.exists():
        os.system(
            f"python -m paddle.distributed.launch --gpus '0' "
            f"tools/train.py -c {config_path}"
        )
    else:
        print(f"OCR config written to {config_path}")
        print("Set PADDLEOCR_REPO to PaddleOCR clone and run tools/train.py manually.")
    print(f"OCR fine-tuning config at: {output_dir / 'ocr_checkpoints'}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", default="ml/datasets/processed")
    parser.add_argument("--output-dir", default="ml/datasets/ocr_training")
    parser.add_argument("--epochs", type=int, default=50)
    args = parser.parse_args()

    data = prepare_ocr_training_data(Path(args.data_dir), Path(args.output_dir))
    fine_tune_paddleocr(data, Path("ml/models/checkpoints/ocr"), epochs=args.epochs)
