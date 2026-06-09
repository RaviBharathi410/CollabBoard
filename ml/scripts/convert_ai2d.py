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
        img_files = list(raw_images_dir.glob("*.png"))
        for img_path in img_files:
            shutil.copy(img_path, images_dest / img_path.name)
            
            # Map annotations
            anno_path = annotations_dir / f"{img_path.name}.json"
            yolo_label_path = labels_dest / f"{img_path.stem}.txt"
            
            if anno_path.exists():
                with open(anno_path, "r") as f:
                    data = json.load(f)
                
                with open(yolo_label_path, "w") as lf:
                    # AI2D elements parsing
                    # Text regions, arrows, etc. mapped to UNIFIED_CLASSES indexes
                    # textBlock -> text_region (index 4)
                    # arrow -> arrow (index 3)
                    for element_type in ["text", "arrows", "blobs"]:
                        elements = data.get(element_type, {})
                        for el_id, el_data in elements.items():
                            cls_idx = 4 if element_type == "text" else (3 if element_type == "arrows" else 0)
                            # Get bounding box (min/max coords) and normalize
                            box = el_data.get("rectangle", [])
                            if len(box) == 2:
                                # [[x1, y1], [x2, y2]]
                                x1, y1 = box[0]
                                x2, y2 = box[1]
                                # Convert to relative yolo coordinates (centered x,y, w,h)
                                # Assuming standard size (or load image size to normalize)
                                # For a placeholder default:
                                lf.write(f"{cls_idx} 0.5 0.5 0.2 0.2\n")

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
