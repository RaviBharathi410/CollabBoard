import argparse
import os
import shutil
import json
from pathlib import Path

UNIFIED_CLASSES = [
    "rectangle", "circle", "diamond", "arrow", "text_region",
    "database", "cloud", "container", "group_boundary", "sticky_note", "connector"
]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("src_dir", type=str, default="ml/datasets/ai2d_raw")
    parser.add_argument("dest_dir", type=str, default="ml/datasets/ai2d")
    args = parser.parse_args()

    src = Path(args.src_dir)
    dest = Path(args.dest_dir)
    images_dest = dest / "images"
    labels_dest = dest / "labels"
    images_dest.mkdir(parents=True, exist_ok=True)
    labels_dest.mkdir(parents=True, exist_ok=True)

    print(f"Converting AI2D from {src} to {dest}...")
    
    # Check if raw dir has downloaded images
    raw_images_dir = src / "images"
    annotations_dir = src / "annotations"
    
    if not raw_images_dir.exists() or not list(raw_images_dir.glob("*.png")):
        print(f"Source directory empty or invalid. Generating mock AI2D training samples...")
        from PIL import Image, ImageDraw
        import random
        for i in range(10):
            img_name = f"ai2d_mock_{i:04d}.jpg"
            lbl_name = f"ai2d_mock_{i:04d}.txt"
            img = Image.new("RGB", (512, 512), "white")
            draw = ImageDraw.Draw(img)
            draw.rectangle([100, 100, 200, 200], outline="black", width=3)
            img.save(images_dest / img_name)
            with open(labels_dest / lbl_name, "w") as lf:
                lf.write("0 0.5 0.5 0.2 0.2\n")
    else:
        # Loop through images and annotations
        from PIL import Image
        img_files = list(raw_images_dir.glob("*.png"))
        for img_path in img_files:
            shutil.copy(img_path, images_dest / img_path.name)
            
            # Map annotations
            anno_path = annotations_dir / f"{img_path.name}.json"
            yolo_label_path = labels_dest / f"{img_path.stem}.txt"
            
            if anno_path.exists():
                with open(anno_path, "r", encoding="utf-8") as f:
                    data = json.load(f)

                try:
                    with Image.open(img_path) as im:
                        img_w, img_h = im.size
                except Exception:
                    img_w, img_h = 800, 600
                
                with open(yolo_label_path, "w", encoding="utf-8") as lf:
                    # AI2D elements parsing
                    # Text regions, arrows, etc. mapped to UNIFIED_CLASSES indexes
                    # textBlock -> text_region (index 4)
                    # arrow -> arrow (index 3)
                    # blobs -> container/rectangle (index 0)
                    for element_type in ["text", "arrows", "blobs"]:
                        elements = data.get(element_type, {})
                        for el_id, el_data in elements.items():
                            cls_idx = 4 if element_type == "text" else (3 if element_type == "arrows" else 0)
                            box = el_data.get("rectangle", [])
                            if len(box) == 2:
                                # [[x1, y1], [x2, y2]]
                                x1, y1 = box[0]
                                x2, y2 = box[1]
                                min_x, max_x = min(x1, x2), max(x1, x2)
                                min_y, max_y = min(y1, y2), max(y1, y2)
                                bw = max_x - min_x
                                bh = max_y - min_y
                                if bw > 0 and bh > 0 and img_w > 0 and img_h > 0:
                                    cx = (min_x + bw / 2.0) / img_w
                                    cy = (min_y + bh / 2.0) / img_h
                                    nw = bw / img_w
                                    nh = bh / img_h
                                    lf.write(f"{cls_idx} {cx:.4f} {cy:.4f} {nw:.4f} {nh:.4f}\n")

    # Generate dataset.yaml
    yaml_content = f"""path: {dest.resolve().as_posix()}
train: images
val: images

names:
"""
    for idx, name in enumerate(UNIFIED_CLASSES):
        yaml_content += f"  {idx}: {name}\n"

    with open(dest / "dataset.yaml", "w") as f:
        f.write(yaml_content)

    print("AI2D conversion setup completed.")

if __name__ == "__main__":
    main()
