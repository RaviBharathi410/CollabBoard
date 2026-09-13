"""
Generate synthetic diagram images with YOLO ground-truth labels.
"""

from __future__ import annotations

import argparse
import random
import shutil
from pathlib import Path

import cv2
import numpy as np
import yaml

DIAGRAM_TYPES = ["architecture", "flowchart", "erd", "sequence", "mindmap", "network"]
CANVAS_SIZES = [(800, 600), (1024, 768), (1280, 960), (640, 480)]
BACKGROUNDS = ["white", "grid_dots", "grid_lines", "slight_noise"]

CLASS_NAMES = [
    "rectangle",
    "circle",
    "database",
    "diamond",
    "actor",
    "cloud",
    "cylinder",
    "arrow",
    "text_region",
    "sticky_note",
    "group_boundary",
]
CLASS_IDX = {name: i for i, name in enumerate(CLASS_NAMES)}

SHAPE_STYLES = {
    "rectangle": {"min_w": 80, "max_w": 200, "min_h": 40, "max_h": 80},
    "circle": {"min_r": 30, "max_r": 70},
    "database": {"min_w": 100, "max_w": 160, "min_h": 40, "max_h": 60},
    "diamond": {"min_w": 80, "max_w": 140, "min_h": 60, "max_h": 100},
    "actor": {"min_w": 40, "max_w": 60, "min_h": 80, "max_h": 120},
}

DIAGRAM_LABELS = {
    "architecture": [
        "User", "Web App", "API Gateway", "Auth Service", "Database",
        "Cache", "Queue", "Worker", "CDN", "Load Balancer", "Microservice",
        "S3", "Email Service", "Payment Gateway", "Notification Service",
    ],
    "flowchart": [
        "Start", "End", "Decision", "Process", "Input", "Output",
        "Validate", "Parse", "Check", "Return", "Error", "Success", "Loop",
    ],
    "erd": [
        "User", "Order", "Product", "Category", "Address", "Payment",
        "id: int", "name: varchar", "email: varchar", "created_at: timestamp",
    ],
    "sequence": ["Client", "Server", "Database", "Cache", "Auth", "Queue"],
    "mindmap": ["Central Idea", "Topic 1", "Topic 2", "Subtopic", "Detail", "Note"],
    "network": ["Router", "Switch", "Firewall", "Server", "Workstation", "Cloud"],
}


def draw_background(canvas: np.ndarray, style: str) -> np.ndarray:
    h, w = canvas.shape[:2]
    if style == "white":
        return canvas
    if style == "grid_dots":
        for y in range(0, h, 20):
            for x in range(0, w, 20):
                cv2.circle(canvas, (x, y), 1, (220, 220, 220), -1)
        return canvas
    if style == "grid_lines":
        for y in range(0, h, 40):
            cv2.line(canvas, (0, y), (w, y), (235, 235, 235), 1)
        for x in range(0, w, 40):
            cv2.line(canvas, (x, 0), (x, h), (235, 235, 235), 1)
        return canvas
    if style == "slight_noise":
        noise = np.random.normal(0, 3, canvas.shape).astype(np.int16)
        noisy = np.clip(canvas.astype(np.int16) + noise, 0, 255).astype(np.uint8)
        return noisy
    return canvas


def _put_text(canvas, text: str, cx, cy, font_scale: float = 0.45):
    font = cv2.FONT_HERSHEY_SIMPLEX
    (tw, th), _ = cv2.getTextSize(text, font, font_scale, 1)
    px, py = int(cx - tw // 2), int(cy + th // 2)
    cv2.putText(
        canvas,
        text[:24],
        (px, py),
        font,
        font_scale,
        (26, 26, 46),
        1,
        cv2.LINE_AA,
    )


def _yolo_bbox(x: int, y: int, w: int, h: int, img_w: int, img_h: int, cls: str) -> str:
    cx = (x + w / 2) / img_w
    cy = (y + h / 2) / img_h
    nw = w / img_w
    nh = h / img_h
    return f"{CLASS_IDX[cls]} {cx:.6f} {cy:.6f} {nw:.6f} {nh:.6f}"


def draw_rectangle_node(
    canvas, x, y, w, h, label, hand_drawn=False
) -> tuple[str, dict]:
    color = (108, 99, 255)
    if hand_drawn:
        pts = np.array(
            [
                [x, y],
                [x + w, y + random.randint(-2, 2)],
                [x + w + random.randint(-2, 2), y + h],
                [x + random.randint(-2, 2), y + h],
            ],
            np.int32,
        )
        cv2.fillPoly(canvas, [pts], (238, 237, 254))
        cv2.polylines(canvas, [pts], True, color, 2)
    else:
        cv2.rectangle(canvas, (x, y), (x + w, y + h), (238, 237, 254), -1)
        cv2.rectangle(canvas, (x, y), (x + w, y + h), color, 2)
    _put_text(canvas, label, x + w // 2, y + h // 2)
    ih, iw = canvas.shape[:2]
    ann = _yolo_bbox(x, y, w, h, iw, ih, "rectangle")
    return ann, {"shape": "rectangle", "cx": x + w / 2, "cy": y + h / 2, "bbox": (x, y, w, h)}


def draw_circle_node(canvas, cx, cy, r, label, hand_drawn=False) -> tuple[str, dict]:
    color = (108, 99, 255)
    if hand_drawn:
        cv2.ellipse(canvas, (cx, cy), (r, r), 0, 0, 360, (238, 237, 254), -1)
        cv2.ellipse(canvas, (cx, cy), (r + 2, r - 1), 5, 0, 360, color, 2)
    else:
        cv2.circle(canvas, (cx, cy), r, (238, 237, 254), -1)
        cv2.circle(canvas, (cx, cy), r, color, 2)
    _put_text(canvas, label, cx, cy)
    ih, iw = canvas.shape[:2]
    ann = _yolo_bbox(cx - r, cy - r, 2 * r, 2 * r, iw, ih, "circle")
    return ann, {"shape": "circle", "cx": cx, "cy": cy, "bbox": (cx - r, cy - r, 2 * r, 2 * r)}


def draw_database_node(canvas, x, y, w, h, label) -> tuple[str, dict]:
    color = (108, 99, 255)
    cv2.rectangle(canvas, (x, y + 8), (x + w, y + h), (238, 237, 254), -1)
    cv2.rectangle(canvas, (x, y + 8), (x + w, y + h), color, 2)
    cv2.ellipse(canvas, (x + w // 2, y + 8), (w // 2, 10), 0, 0, 360, (238, 237, 254), -1)
    cv2.ellipse(canvas, (x + w // 2, y + 8), (w // 2, 10), 0, 0, 360, color, 2)
    _put_text(canvas, label, x + w // 2, y + h // 2 + 4)
    ih, iw = canvas.shape[:2]
    ann = _yolo_bbox(x, y, w, h + 8, iw, ih, "database")
    return ann, {"shape": "database", "cx": x + w // 2, "cy": y + h // 2, "bbox": (x, y, w, h)}


def draw_diamond_node(canvas, cx, cy, w, h, label) -> tuple[str, dict]:
    pts = np.array(
        [[cx, cy - h // 2], [cx + w // 2, cy], [cx, cy + h // 2], [cx - w // 2, cy]],
        np.int32,
    )
    cv2.fillPoly(canvas, [pts], (238, 237, 254))
    cv2.polylines(canvas, [pts], True, (108, 99, 255), 2)
    _put_text(canvas, label, cx, cy)
    ih, iw = canvas.shape[:2]
    ann = _yolo_bbox(cx - w // 2, cy - h // 2, w, h, iw, ih, "diamond")
    return ann, {"shape": "diamond", "cx": cx, "cy": cy, "bbox": (cx - w // 2, cy - h // 2, w, h)}


def draw_arrow(canvas, x1, y1, x2, y2, style="solid", label="") -> list[str]:
    color = (108, 99, 255)
    dash = None
    if style == "dashed":
        dash = 8
    elif style == "dotted":
        dash = 3
    if dash:
        dist = int(np.hypot(x2 - x1, y2 - y1))
        for i in range(0, dist, dash * 2):
            t1 = i / max(dist, 1)
            t2 = min((i + dash) / max(dist, 1), 1.0)
            px1 = int(x1 + (x2 - x1) * t1)
            py1 = int(y1 + (y2 - y1) * t1)
            px2 = int(x1 + (x2 - x1) * t2)
            py2 = int(y1 + (y2 - y1) * t2)
            cv2.line(canvas, (px1, py1), (px2, py2), color, 2)
    else:
        cv2.arrowedLine(canvas, (int(x1), int(y1)), (int(x2), int(y2)), color, 2, tipLength=0.15)

    ih, iw = canvas.shape[:2]
    bx = min(x1, x2)
    by = min(y1, y2)
    bw = max(abs(x2 - x1), 4)
    bh = max(abs(y2 - y1), 4)
    anns = [_yolo_bbox(int(bx), int(by), int(bw), int(bh), iw, ih, "arrow")]

    if label:
        mx, my = (x1 + x2) // 2, (y1 + y2) // 2
        _put_text(canvas, label, mx, my - 8, 0.35)
        tw, th = 60, 16
        anns.append(_yolo_bbox(mx - tw // 2, my - th // 2, tw, th, iw, ih, "text_region"))
    return anns


def apply_sketch_filter(canvas: np.ndarray) -> np.ndarray:
    blurred = cv2.GaussianBlur(canvas, (3, 3), 0)
    noise = np.random.normal(0, 4, blurred.shape).astype(np.int16)
    return np.clip(blurred.astype(np.int16) + noise, 0, 255).astype(np.uint8)


def _overlaps(x, y, w, h, placed, margin=12) -> bool:
    for p in placed:
        px, py, pw, ph = p["bbox"]
        if not (x + w + margin < px or px + pw + margin < x or y + h + margin < py or py + ph + margin < y):
            return True
    return False


def _place_node(img_w, img_h, w, h, placed, max_attempts=40):
    for _ in range(max_attempts):
        x = random.randint(40, max(41, img_w - w - 40))
        y = random.randint(40, max(41, img_h - h - 40))
        if not _overlaps(x, y, w, h, placed):
            return x, y
    return random.randint(40, img_w - w - 40), random.randint(40, img_h - h - 40)


def generate_diagram(
    diagram_type: str,
    output_image_path: str,
    output_label_path: str,
    hand_drawn_probability: float = 0.4,
    canvas_size=(800, 600),
) -> list[str]:
    img_w, img_h = canvas_size
    canvas = np.ones((img_h, img_w, 3), dtype=np.uint8) * 255
    bg_style = random.choice(BACKGROUNDS)
    canvas = draw_background(canvas, bg_style)

    labels_for_type = DIAGRAM_LABELS.get(diagram_type, DIAGRAM_LABELS["architecture"])
    hand_drawn = random.random() < hand_drawn_probability
    annotations: list[str] = []
    placed_nodes: list[dict] = []

    n_nodes = random.randint(3, 12)
    shape_weights = {
        "architecture": (["rectangle", "database", "circle"], [0.6, 0.3, 0.1]),
        "flowchart": (["rectangle", "diamond", "circle"], [0.5, 0.3, 0.2]),
        "erd": (["rectangle", "database"], [0.7, 0.3]),
        "sequence": (["rectangle"], [1.0]),
        "mindmap": (["circle"], [1.0]),
        "network": (["rectangle", "circle"], [0.5, 0.5]),
    }
    types, weights = shape_weights.get(diagram_type, (["rectangle"], [1.0]))

    for _ in range(n_nodes):
        label = random.choice(labels_for_type)
        shape_type = random.choices(types, weights=weights)[0]
        hand = hand_drawn and random.random() < 0.5

        if shape_type == "rectangle":
            w = random.randint(80, 180)
            h = random.randint(40, 70)
            x, y = _place_node(img_w, img_h, w, h, placed_nodes)
            ann, node = draw_rectangle_node(canvas, x, y, w, h, label, hand_drawn=hand)
        elif shape_type == "circle":
            r = random.randint(30, 60)
            x, y = _place_node(img_w, img_h, r * 2, r * 2, placed_nodes)
            cx, cy = x + r, y + r
            ann, node = draw_circle_node(canvas, cx, cy, r, label, hand_drawn=hand)
        elif shape_type == "database":
            w = random.randint(100, 150)
            h = random.randint(40, 55)
            x, y = _place_node(img_w, img_h, w, h + 8, placed_nodes)
            ann, node = draw_database_node(canvas, x, y, w, h, label)
        elif shape_type == "diamond":
            w = random.randint(80, 120)
            h = random.randint(60, 90)
            x, y = _place_node(img_w, img_h, w, h, placed_nodes)
            cx, cy = x + w // 2, y + h // 2
            ann, node = draw_diamond_node(canvas, cx, cy, w, h, label)
        else:
            w, h = 120, 50
            x, y = _place_node(img_w, img_h, w, h, placed_nodes)
            ann, node = draw_rectangle_node(canvas, x, y, w, h, label)

        annotations.append(ann)
        placed_nodes.append(node)

    for i in range(len(placed_nodes) - 1):
        src = placed_nodes[i]
        tgt = placed_nodes[i + 1]
        style = random.choice(["solid", "dashed", "dotted"])
        edge_label = random.choice(["", "calls", "returns", "1:N", "uses", "→"])
        arrow_anns = draw_arrow(
            canvas,
            int(src["cx"]),
            int(src["cy"]),
            int(tgt["cx"]),
            int(tgt["cy"]),
            style,
            edge_label,
        )
        annotations.extend(arrow_anns)

    if hand_drawn:
        canvas = apply_sketch_filter(canvas)

    cv2.imwrite(output_image_path, canvas)
    Path(output_label_path).write_text("\n".join(annotations), encoding="utf-8")
    return annotations


def generate_dataset(output_dir: Path, n_images: int = 5000, train_split: float = 0.85):
    train_img = output_dir / "train" / "images"
    train_lbl = output_dir / "train" / "labels"
    val_img = output_dir / "val" / "images"
    val_lbl = output_dir / "val" / "labels"
    for d in [train_img, train_lbl, val_img, val_lbl]:
        d.mkdir(parents=True, exist_ok=True)

    per_type = n_images // len(DIAGRAM_TYPES)
    idx = 0
    for diagram_type in DIAGRAM_TYPES:
        for _ in range(per_type):
            canvas_size = random.choice(CANVAS_SIZES)
            is_train = random.random() < train_split
            img_dir = train_img if is_train else val_img
            lbl_dir = train_lbl if is_train else val_lbl
            stem = f"syn_{diagram_type}_{idx:06d}"
            img_path = str(img_dir / f"{stem}.jpg")
            lbl_path = str(lbl_dir / f"{stem}.txt")
            generate_diagram(diagram_type, img_path, lbl_path, canvas_size=canvas_size)
            idx += 1

    dataset_yaml = {
        "path": str(output_dir.resolve()),
        "train": "train/images",
        "val": "val/images",
        "nc": len(CLASS_NAMES),
        "names": CLASS_NAMES,
    }
    with open(output_dir / "dataset.yaml", "w", encoding="utf-8") as f:
        yaml.dump(dataset_yaml, f, default_flow_style=False)

    print(f"Generated {idx} synthetic diagrams in {output_dir}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", "--output_dir", dest="output_dir", default="ml/datasets/synthetic")
    parser.add_argument("--n-images", "--total_samples", dest="n_images", type=int, default=5000)
    parser.add_argument("--curriculum_cfg", default=None, help="Optional curriculum config (ignored)")
    parser.add_argument("--train-split", "--train_split", dest="train_split", type=float, default=0.85)
    args = parser.parse_args()
    out = Path(args.output_dir)
    if out.exists() and any(out.rglob("*.jpg")):
        shutil.rmtree(out / "train", ignore_errors=True)
        shutil.rmtree(out / "val", ignore_errors=True)
    generate_dataset(out, n_images=args.n_images, train_split=args.train_split)
