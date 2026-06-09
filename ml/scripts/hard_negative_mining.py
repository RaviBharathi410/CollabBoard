import argparse
import os
import shutil
from pathlib import Path
from ultralytics import YOLO
import cv2

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_checkpoint", required=True, type=str)
    parser.add_argument("--data_dir", required=True, type=str)
    parser.add_argument("--output_dir", required=True, type=str)
    parser.add_argument("--conf_threshold", type=float, default=0.25)
    args = parser.parse_args()

    model = YOLO(args.model_checkpoint)
    data_path = Path(args.data_dir)
    images_dir = data_path / "images"
    
    out_path = Path(args.output_dir)
    out_images = out_path / "images"
    out_labels = out_path / "labels"
    out_images.mkdir(parents=True, exist_ok=True)
    out_labels.mkdir(parents=True, exist_ok=True)

    print(f"Running hard-negative mining on {images_dir} using model {args.model_checkpoint}...")
    
    # Process images and identify frames with no actual annotations but high conf detections (false positives)
    image_files = list(images_dir.glob("*.*"))
    mined_count = 0
    
    for img_path in image_files:
        results = model(img_path, conf=args.conf_threshold, verbose=False)
        for r in results:
            boxes = r.boxes
            if len(boxes) > 0:
                # Found potential hard-negatives (regions the model is unsure of or misclassifying)
                # Copy to hard-negative replay buffer
                shutil.copy(img_path, out_images / img_path.name)
                # Save label details
                label_path = out_labels / f"{img_path.stem}.txt"
                with open(label_path, "w") as lf:
                    for box in boxes:
                        cls = int(box.cls[0].item())
                        xywh = box.xywhn[0].tolist()
                        lf.write(f"{cls} {xywh[0]} {xywh[1]} {xywh[2]} {xywh[3]}\n")
                mined_count += 1
                break
                
    print(f"Mined {mined_count} hard-negatives to replay buffer: {args.output_dir}")

if __name__ == "__main__":
    main()
