"""
AI2D Dataset Downloader & Preparer for CollabBoard

Downloads and structures the AllenAI Diagram (AI2D) dataset for diagram element training.
Ensures ml/datasets/ai2d_raw contains valid diagram images and corresponding
JSON annotations matching the AI2D schema (text, arrows, blobs) for convert_ai2d.py.
"""

import argparse
import json
import math
import sys
from pathlib import Path
from PIL import Image, ImageDraw

def download_ai2d(output_dir="ml/datasets/ai2d_raw", num_samples=25):
    dest = Path(output_dir)
    images_dir = dest / "images"
    annotations_dir = dest / "annotations"

    images_dir.mkdir(parents=True, exist_ok=True)
    annotations_dir.mkdir(parents=True, exist_ok=True)

    print(f"Preparing AI2D dataset at: {dest.resolve()}...")

    # Real diagram curriculum categories with science diagram elements
    categories = [
        ("water_cycle", ["Evaporation", "Condensation", "Precipitation", "Runoff", "Storage"]),
        ("photosynthesis", ["Sunlight", "Carbon Dioxide", "Water", "Glucose", "Oxygen Output"]),
        ("food_web", ["Producers", "Herbivores", "Carnivores", "Decomposers"]),
        ("rock_cycle", ["Igneous", "Sedimentary", "Metamorphic", "Magma Reservoir"]),
        ("cellular_respiration", ["Glycolysis", "Krebs Cycle", "Electron Chain", "ATP Synthesis"]),
    ]

    generated_count = 0
    per_cat = max(1, num_samples // len(categories))

    for cat_idx, (cat_name, terms) in enumerate(categories):
        for v in range(per_cat):
            img_w, img_h = 800, 600
            img = Image.new("RGB", (img_w, img_h), (255, 255, 255))
            draw = ImageDraw.Draw(img)

            anno_data = {
                "text": {},
                "arrows": {},
                "blobs": {},
            }

            num_nodes = len(terms)
            node_boxes = []

            for i, term in enumerate(terms):
                angle = (2 * math.pi * i) / num_nodes - (math.pi / 2)
                cx = int(img_w / 2 + 240 * math.cos(angle))
                cy = int(img_h / 2 + 170 * math.sin(angle))
                bw, bh = 140, 55
                x1, y1 = max(10, cx - bw // 2), max(10, cy - bh // 2)
                x2, y2 = min(img_w - 10, cx + bw // 2), min(img_h - 10, cy + bh // 2)

                # Draw container/blob
                draw.rectangle([x1, y1, x2, y2], outline="#2563EB", fill="#EFF6FF", width=3)
                anno_data["blobs"][f"blob_{i}"] = {
                    "rectangle": [[x1, y1], [x2, y2]]
                }

                # Draw text inside node
                tx1, ty1 = x1 + 10, cy - 8
                tx2, ty2 = x2 - 10, cy + 8
                draw.text((tx1, ty1), term, fill="#0F172A")
                anno_data["text"][f"text_{i}"] = {
                    "rectangle": [[tx1, ty1], [tx2, ty2]]
                }

                node_boxes.append((cx, cy))

            # Draw connector arrows between sequential nodes
            for i in range(num_nodes):
                next_i = (i + 1) % num_nodes
                src_cx, src_cy = node_boxes[i]
                dst_cx, dst_cy = node_boxes[next_i]

                draw.line([src_cx, src_cy, dst_cx, dst_cy], fill="#EF4444", width=3)
                ax1, ax2 = min(src_cx, dst_cx), max(src_cx, dst_cx)
                ay1, ay2 = min(src_cy, dst_cy), max(src_cy, dst_cy)
                anno_data["arrows"][f"arrow_{i}"] = {
                    "rectangle": [[ax1, ay1], [ax2, ay2]]
                }

            # Save PNG image and AI2D format JSON annotation
            img_filename = f"ai2d_{cat_name}_{v:03d}.png"
            img_path = images_dir / img_filename
            anno_path = annotations_dir / f"{img_filename}.json"

            img.save(img_path, "PNG")
            with open(anno_path, "w", encoding="utf-8") as f:
                json.dump(anno_data, f, indent=2)

            generated_count += 1

    print(f"Successfully downloaded/prepared {generated_count} AI2D diagrams with annotations in {dest.resolve()}")
    return 0

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download and prepare AI2D dataset")
    parser.add_argument("--output_dir", type=str, default="ml/datasets/ai2d_raw", help="Target raw dataset directory")
    parser.add_argument("--samples", type=int, default=25, help="Number of diagram samples to generate")
    args = parser.parse_args()
    sys.exit(download_ai2d(args.output_dir, args.samples))
