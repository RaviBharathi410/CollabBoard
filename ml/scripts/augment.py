"""
Albumentations augmentation pipeline for YOLO training images.
"""

from __future__ import annotations

import argparse
import random
from pathlib import Path

import albumentations as A
import cv2
import numpy as np
import yaml

AUGMENTATION_PIPELINE = A.Compose(
    [
        A.RandomRotate90(p=0.3),
        A.HorizontalFlip(p=0.3),
        A.RandomBrightnessContrast(brightness_limit=0.3, contrast_limit=0.3, p=0.5),
        A.GaussNoise(var_limit=(5.0, 30.0), p=0.4),
        A.MotionBlur(blur_limit=5, p=0.2),
        A.Affine(scale=(0.8, 1.2), p=0.4),
        A.Perspective(scale=(0.02, 0.08), p=0.3),
        A.ElasticTransform(alpha=30, sigma=5, p=0.2),
        A.HueSaturationValue(hue_shift_limit=5, sat_shift_limit=10, p=0.3),
        A.ToGray(p=0.1),
    ],
    bbox_params=A.BboxParams(
        format="yolo",
        label_fields=["class_labels"],
        min_visibility=0.4,
    ),
)

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}


def _read_yolo_labels(label_path: Path) -> tuple[list, list]:
    bboxes = []
    class_labels = []
    if not label_path.exists():
        return bboxes, class_labels
    for line in label_path.read_text(encoding="utf-8").strip().splitlines():
        parts = line.split()
        if len(parts) < 5:
            continue
        cls = int(parts[0])
        cx, cy, w, h = map(float, parts[1:5])
        bboxes.append([cx, cy, w, h])
        class_labels.append(cls)
    return bboxes, class_labels


def _write_yolo_labels(label_path: Path, bboxes, class_labels):
    lines = []
    for bbox, cls in zip(bboxes, class_labels):
        cx, cy, w, h = bbox
        lines.append(f"{cls} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}")
    label_path.write_text("\n".join(lines), encoding="utf-8")


def augment_dataset(input_dir: Path, output_dir: Path, multiplier: int = 3):
    """Produce `multiplier` augmented variants per training image."""
    train_img_in = input_dir / "train" / "images"
    train_lbl_in = input_dir / "train" / "labels"
    train_img_out = output_dir / "train" / "images"
    train_lbl_out = output_dir / "train" / "labels"
    val_img_out = output_dir / "val" / "images"
    val_lbl_out = output_dir / "val" / "labels"

    for d in [train_img_out, train_lbl_out, val_img_out, val_lbl_out]:
        d.mkdir(parents=True, exist_ok=True)

    val_img_in = input_dir / "val" / "images"
    val_lbl_in = input_dir / "val" / "labels"
    if val_img_in.exists():
        for img_path in val_img_in.iterdir():
            if img_path.suffix.lower() not in IMAGE_EXTENSIONS:
                continue
            lbl = val_lbl_in / f"{img_path.stem}.txt"
            shutil_copy = lambda s, d: __import__("shutil").copy2(s, d)
            shutil_copy(img_path, val_img_out / img_path.name)
            if lbl.exists():
                shutil_copy(lbl, val_lbl_out / lbl.name)

    count = 0
    for img_path in sorted(train_img_in.iterdir()):
        if img_path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        lbl_path = train_lbl_in / f"{img_path.stem}.txt"
        image = cv2.imread(str(img_path))
        if image is None:
            continue
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        bboxes, class_labels = _read_yolo_labels(lbl_path)

        import shutil

        shutil.copy2(img_path, train_img_out / img_path.name)
        if lbl_path.exists():
            shutil.copy2(lbl_path, train_lbl_out / lbl_path.name)
        count += 1

        for aug_i in range(multiplier):
            if bboxes:
                transformed = AUGMENTATION_PIPELINE(
                    image=image, bboxes=bboxes, class_labels=class_labels
                )
                aug_img = transformed["image"]
                aug_boxes = transformed["bboxes"]
                aug_labels = transformed["class_labels"]
            else:
                transformed = AUGMENTATION_PIPELINE(image=image, bboxes=[], class_labels=[])
                aug_img = transformed["image"]
                aug_boxes, aug_labels = [], []

            stem = f"{img_path.stem}_aug{aug_i}"
            out_img = train_img_out / f"{stem}{img_path.suffix.lower()}"
            out_lbl = train_lbl_out / f"{stem}.txt"
            cv2.imwrite(str(out_img), cv2.cvtColor(aug_img, cv2.COLOR_RGB2BGR))
            _write_yolo_labels(out_lbl, aug_boxes, aug_labels)
            count += 1

    yaml_in = input_dir / "dataset.yaml"
    if yaml_in.exists():
        with open(yaml_in, encoding="utf-8") as f:
            data = yaml.safe_load(f)
        data["path"] = str(output_dir.resolve())
        with open(output_dir / "dataset.yaml", "w", encoding="utf-8") as f:
            yaml.dump(data, f, default_flow_style=False)

    print(f"Augmentation complete: {count} training images in {output_dir}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", default="ml/datasets/processed")
    parser.add_argument("--output-dir", default="ml/datasets/processed_augmented")
    parser.add_argument("--multiplier", type=int, default=3)
    parser.add_argument("--in-place", action="store_true", help="Overwrite input dir")
    args = parser.parse_args()
    inp = Path(args.input_dir)
    out = inp if args.in_place else Path(args.output_dir)
    augment_dataset(inp, out, multiplier=args.multiplier)
