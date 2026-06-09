import argparse
import os
import random
import yaml
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

UNIFIED_CLASSES = [
    "rectangle", "circle", "diamond", "arrow", "text_region",
    "database", "cloud", "container", "group_boundary", "sticky_note", "connector"
]

def generate_sample(output_img_path, output_lbl_path, difficulty_level):
    # Determine sizing based on difficulty
    img_size = (640, 640)
    img = Image.new("RGB", img_size, "white")
    draw = ImageDraw.Draw(img)
    
    boxes = []
    
    # Simple curriculum difficulty rules
    # Higher difficulty -> more shapes and lines
    num_shapes = random.randint(2, 4) if difficulty_level == "easy" else (random.randint(4, 8) if difficulty_level == "medium" else random.randint(8, 15))
    
    for _ in range(num_shapes):
        shape_type = random.choice([0, 1, 2, 9]) # rectangle, circle, diamond, sticky_note
        w = random.randint(60, 120)
        h = random.randint(60, 120)
        x = random.randint(50, 500)
        y = random.randint(50, 500)
        
        # Draw the shapes
        if shape_type == 0: # Rectangle
            draw.rectangle([x, y, x + w, y + h], outline="black", width=3)
        elif shape_type == 1: # Circle
            draw.ellipse([x, y, x + w, y + h], outline="black", width=3)
        elif shape_type == 2: # Diamond
            draw.polygon([x + w//2, y, x + w, y + h//2, x + w//2, y + h, x, y + h//2], outline="black", width=3)
        elif shape_type == 9: # Sticky Note
            draw.rectangle([x, y, x + w, y + h], fill="#FEF08A", outline="#EAB308", width=2)
            
        # Normalize for YOLO format
        cx = (x + w/2) / img_size[0]
        cy = (y + h/2) / img_size[1]
        norm_w = w / img_size[0]
        norm_h = h / img_size[1]
        boxes.append(f"{shape_type} {cx} {cy} {norm_w} {norm_h}")
        
        # Add a text label inside the shape occasionally (class 4)
        if random.random() > 0.4:
            tx = x + 10
            ty = y + h//2 - 10
            draw.text((tx, ty), "TEXT", fill="black")
            tcx = (tx + 20) / img_size[0]
            tcy = (ty + 10) / img_size[1]
            tw = 40 / img_size[0]
            th = 20 / img_size[1]
            boxes.append(f"4 {tcx} {tcy} {tw} {th}")

    # Draw arrows/connectors (class 3/10) connecting some shapes
    num_connectors = random.randint(1, num_shapes // 2 + 1)
    for _ in range(num_connectors):
        x1, y1 = random.randint(100, 500), random.randint(100, 500)
        x2, y2 = random.randint(100, 500), random.randint(100, 500)
        draw.line([x1, y1, x2, y2], fill="black", width=2)
        # Bounding box for line
        cx = ((x1 + x2) / 2) / img_size[0]
        cy = ((y1 + y2) / 2) / img_size[1]
        lw = abs(x1 - x2) / img_size[0]
        lh = abs(y1 - y2) / img_size[1]
        boxes.append(f"3 {cx} {cy} {max(lw, 0.02)} {max(lh, 0.02)}")

    img.save(output_img_path)
    with open(output_lbl_path, "w") as f:
        f.write("\n".join(boxes) + "\n")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output_dir", required=True, type=str)
    parser.add_argument("--curriculum_cfg", type=str)
    parser.add_argument("--total_samples", type=int, default=1000)
    args = parser.parse_args()

    out_path = Path(args.output_dir)
    images_dir = out_path / "images"
    labels_dir = out_path / "labels"
    images_dir.mkdir(parents=True, exist_ok=True)
    labels_dir.mkdir(parents=True, exist_ok=True)

    difficulty_mix = {"easy": 0.5, "medium": 0.3, "hard": 0.2}
    if args.curriculum_cfg and os.path.exists(args.curriculum_cfg):
        with open(args.curriculum_cfg, "r") as f:
            try:
                cfg = yaml.safe_load(f)
                if "difficulty_mix" in cfg:
                    difficulty_mix = cfg["difficulty_mix"]
            except Exception:
                pass

    print(f"Generating {args.total_samples} synthetic samples...")
    for i in range(args.total_samples):
        # Choose difficulty based on probabilities
        lvl = random.choices(list(difficulty_mix.keys()), weights=list(difficulty_mix.values()))[0]
        img_name = f"synth_{lvl}_{i:06d}.jpg"
        lbl_name = f"synth_{lvl}_{i:06d}.txt"
        generate_sample(images_dir / img_name, labels_dir / lbl_name, lvl)

    # Generate dataset.yaml
    yaml_content = f"""path: {out_path.resolve().as_posix()}
train: images
val: images

names:
"""
    for idx, name in enumerate(UNIFIED_CLASSES):
        yaml_content += f"  {idx}: {name}\n"

    with open(out_path / "dataset.yaml", "w") as f:
        f.write(yaml_content)

    print(f"Generation complete. dataset.yaml created at {out_path / 'dataset.yaml'}")

if __name__ == "__main__":
    main()
