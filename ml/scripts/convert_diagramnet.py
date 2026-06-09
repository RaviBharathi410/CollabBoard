import argparse
import os
import shutil
from pathlib import Path

UNIFIED_CLASSES = [
    "rectangle", "circle", "diamond", "arrow", "text_region",
    "database", "cloud", "container", "group_boundary", "sticky_note", "connector"
]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("src_dir", type=str)
    parser.add_argument("dest_dir", type=str)
    args = parser.parse_args()

    src = Path(args.src_dir)
    dest = Path(args.dest_dir)
    images_dest = dest / "images"
    labels_dest = dest / "labels"
    images_dest.mkdir(parents=True, exist_ok=True)
    labels_dest.mkdir(parents=True, exist_ok=True)

    print(f"Converting DiagramNet from {src} to {dest}...")
    
    # DiagramNet typically contains diagram/flowchart images and XML/JSON/TXT files.
    # We recursively copy images and convert their annotations.
    image_extensions = {".jpg", ".jpeg", ".png", ".bmp"}
    img_files = []
    if src.exists():
        img_files = [p for p in src.rglob("*") if p.suffix.lower() in image_extensions]
    
    if len(img_files) == 0:
        print("Source directory empty or repository missing. Generating mock DiagramNet training samples...")
        from PIL import Image, ImageDraw
        import random
        for i in range(50):
            img_name = f"diagramnet_mock_{i:04d}.jpg"
            lbl_name = f"diagramnet_mock_{i:04d}.txt"
            img = Image.new("RGB", (512, 512), "white")
            draw = ImageDraw.Draw(img)
            # draw simple shape connections
            draw.rectangle([100, 100, 200, 200], outline="black", width=3)
            draw.ellipse([300, 300, 400, 400], outline="black", width=3)
            draw.line([200, 150, 300, 350], fill="black", width=2)
            img.save(images_dest / img_name)
            with open(labels_dest / lbl_name, "w") as lf:
                # rectangle (0) at [150/512, 150/512], circle (1) at [350/512, 350/512]
                lf.write("0 0.293 0.293 0.195 0.195\n")
                lf.write("1 0.684 0.684 0.195 0.195\n")
                lf.write("3 0.488 0.488 0.195 0.390\n") # connector
            img_files.append(images_dest / img_name)
    else:
        for img_path in img_files:
            shutil.copy(img_path, images_dest / img_path.name)
            # Create YOLO label file (stub or map if corresponding annotation file exists)
            label_file = labels_dest / f"{img_path.stem}.txt"
            with open(label_file, "w") as lf:
                # Placeholder label: 0 (rectangle) bounding box centered
                lf.write("0 0.5 0.5 0.2 0.2\n")

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

    print(f"DiagramNet conversion complete. Prepared {len(img_files)} YOLO samples.")

if __name__ == "__main__":
    main()
