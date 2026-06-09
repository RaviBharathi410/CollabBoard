"""Convert COCO/VOC-style annotations to YOLO format."""

from __future__ import annotations

import argparse
import json
import xml.etree.ElementTree as ET
from pathlib import Path


def coco_to_yolo(coco_json: Path, images_dir: Path, labels_dir: Path):
    with open(coco_json, encoding="utf-8") as f:
        data = json.load(f)

    cat_map = {c["id"]: c["name"] for c in data.get("categories", [])}
    class_names = sorted(set(cat_map.values()))
    class_idx = {n: i for i, n in enumerate(class_names)}

    img_map = {im["id"]: im for im in data.get("images", [])}
    anns_by_img: dict[int, list] = {}
    for ann in data.get("annotations", []):
        anns_by_img.setdefault(ann["image_id"], []).append(ann)

    labels_dir.mkdir(parents=True, exist_ok=True)
    for img_id, anns in anns_by_img.items():
        im = img_map[img_id]
        iw, ih = im["width"], im["height"]
        lines = []
        for ann in anns:
            x, y, w, h = ann["bbox"]
            cx = (x + w / 2) / iw
            cy = (y + h / 2) / ih
            nw = w / iw
            nh = h / ih
            cls = class_idx[cat_map[ann["category_id"]]]
            lines.append(f"{cls} {cx:.6f} {cy:.6f} {nw:.6f} {nh:.6f}")
        lbl_path = labels_dir / f"{Path(im['file_name']).stem}.txt"
        lbl_path.write_text("\n".join(lines), encoding="utf-8")

    print(f"Converted {len(anns_by_img)} images to YOLO labels in {labels_dir}")
    return class_names


def voc_to_yolo(xml_dir: Path, labels_dir: Path, class_names: list[str]):
    class_idx = {n: i for i, n in enumerate(class_names)}
    labels_dir.mkdir(parents=True, exist_ok=True)
    for xml_path in xml_dir.glob("*.xml"):
        tree = ET.parse(xml_path)
        root = tree.getroot()
        size = root.find("size")
        iw = int(size.find("width").text)
        ih = int(size.find("height").text)
        lines = []
        for obj in root.findall("object"):
            name = obj.find("name").text
            if name not in class_idx:
                continue
            bb = obj.find("bndbox")
            xmin = float(bb.find("xmin").text)
            ymin = float(bb.find("ymin").text)
            xmax = float(bb.find("xmax").text)
            ymax = float(bb.find("ymax").text)
            w, h = xmax - xmin, ymax - ymin
            cx = (xmin + w / 2) / iw
            cy = (ymin + h / 2) / ih
            lines.append(
                f"{class_idx[name]} {cx:.6f} {cy:.6f} {w/iw:.6f} {h/ih:.6f}"
            )
        (labels_dir / f"{xml_path.stem}.txt").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--format", choices=["coco", "voc"], required=True)
    parser.add_argument("--input", required=True)
    parser.add_argument("--images-dir", default="ml/datasets/raw/images")
    parser.add_argument("--labels-dir", default="ml/datasets/raw/labels")
    args = parser.parse_args()

    if args.format == "coco":
        coco_to_yolo(Path(args.input), Path(args.images_dir), Path(args.labels_dir))
