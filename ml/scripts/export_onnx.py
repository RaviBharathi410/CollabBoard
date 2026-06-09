"""Export trained models to ONNX format."""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

import onnx
import yaml
from ultralytics import YOLO


def export_detection_model_onnx(model_path: str, output_dir: Path, opset: int = 17):
    output_dir.mkdir(parents=True, exist_ok=True)
    model = YOLO(model_path)

    export_path = model.export(
        format="onnx",
        imgsz=640,
        opset=opset,
        simplify=True,
        dynamic=False,
        half=False,
        int8=False,
    )

    onnx_path = output_dir / "diagram_detector.onnx"
    shutil.copy2(export_path, onnx_path)

    model_onnx = onnx.load(str(onnx_path))
    onnx.checker.check_model(model_onnx)
    print(f"ONNX model verified: {onnx_path}")
    print(f"  Input: {[i.name for i in model_onnx.graph.input]}")
    print(f"  Output: {[o.name for o in model_onnx.graph.output]}")

    dataset_yaml = Path("ml/datasets/processed/dataset.yaml")
    if not dataset_yaml.exists():
        dataset_yaml = Path("ml/datasets/synthetic/dataset.yaml")

    if dataset_yaml.exists():
        with open(dataset_yaml, encoding="utf-8") as f:
            data = yaml.safe_load(f)
        classes = data.get("names", [])
    else:
        classes = [
            "rectangle", "circle", "database", "diamond", "actor",
            "cloud", "cylinder", "arrow", "text_region", "sticky_note", "group_boundary",
        ]

    with open(output_dir / "classes.json", "w", encoding="utf-8") as f:
        json.dump({"classes": classes, "nc": len(classes)}, f, indent=2)

    print(f"Classes written: {output_dir / 'classes.json'}")
    return str(onnx_path)


def export_ocr_model_onnx(paddle_model_dir: str, output_dir: Path):
    try:
        import paddle2onnx
    except ImportError as exc:
        print(f"paddle2onnx not available: {exc}")
        return None

    output_dir.mkdir(parents=True, exist_ok=True)
    ocr_onnx_path = str(output_dir / "ocr_detector.onnx")
    model_dir = Path(paddle_model_dir)

    paddle2onnx.export(
        model_dir=str(model_dir),
        model_filename="inference.pdmodel",
        params_filename="inference.pdiparams",
        save_file=ocr_onnx_path,
        opset_version=17,
        enable_onnx_checker=True,
    )
    print(f"OCR ONNX exported: {ocr_onnx_path}")
    return ocr_onnx_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--model",
        default="ml/models/checkpoints/yolov8n_diagrams/weights/best.pt",
    )
    parser.add_argument("--output-dir", default="ml/models/exported")
    parser.add_argument("--ocr-model-dir", default="ml/models/checkpoints/ocr")
    args = parser.parse_args()

    out = Path(args.output_dir)
    export_detection_model_onnx(args.model, out)
    ocr_dir = Path(args.ocr_model_dir)
    if (ocr_dir / "inference.pdmodel").exists():
        export_ocr_model_onnx(str(ocr_dir), out)
