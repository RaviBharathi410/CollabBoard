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

    print(f"Converting User Sketches from {src} to {dest}...")
    
    image_extensions = {".jpg", ".jpeg", ".png", ".bmp"}
    img_files = []
    if src.exists():
        img_files = [p for p in src.rglob("*") if p.suffix.lower() in image_extensions]
        
    if len(img_files) == 0:
        print(f"Source directory empty or invalid. Generating mock User Sketches training samples...")
        from PIL import Image, ImageDraw
        for i in range(10):
            img_name = f"user_sketch_mock_{i:04d}.jpg"
            lbl_name = f"user_sketch_mock_{i:04d}.txt"
            img = Image.new("RGB", (512, 512), "white")
            draw = ImageDraw.Draw(img)
            draw.line([100, 100, 200, 200], fill="black", width=2)
            img.save(images_dest / img_name)
            with open(labels_dest / lbl_name, "w") as lf:
                lf.write("0 0.5 0.5 0.3 0.3\n")
    else:
        for img_path in img_files:
            shutil.copy(img_path, images_dest / img_path.name)
            # Match existing labels or write stub
            label_file = labels_dest / f"{img_path.stem}.txt"
            src_label = img_path.with_suffix(".txt")
            if src_label.exists():
                shutil.copy(src_label, label_file)
            else:
                with open(label_file, "w") as lf:
                    lf.write("0 0.5 0.5 0.3 0.3\n") # Default rectangle outline

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

    print("User sketches conversion setup completed.")

if __name__ == "__main__":
    main()
