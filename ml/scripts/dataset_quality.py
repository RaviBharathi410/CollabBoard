import cv2
import hashlib
import os
import sys
from pathlib import Path
from tqdm import tqdm

def get_image_hash(image_path):
    try:
        with open(image_path, "rb") as f:
            return hashlib.md5(f.read()).hexdigest()
    except Exception:
        return None

def compute_blur(image_path):
    try:
        # Synthetic images do not need blur filtering as they are clean vectors
        if "synth_" in str(image_path):
            return 100.0
        img = cv2.imread(str(image_path), cv2.IMREAD_GRAYSCALE)
        if img is None:
            return 0.0
        return cv2.Laplacian(img, cv2.CV_64F).var()
    except Exception:
        return 0.0

def filter_dataset(dataset_dir, blur_threshold=10.0, min_size=(64, 64)):
    print(f"Cleaning dataset: {dataset_dir}")
    dataset_path = Path(dataset_dir)
    images_dir = dataset_path / "images"
    labels_dir = dataset_path / "labels"
    
    if not images_dir.exists():
        # Search recursively for image folders if not in standard YOLO format
        images_dir = dataset_path
        labels_dir = None

    image_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    image_files = [p for p in images_dir.rglob("*") if p.suffix.lower() in image_extensions]
    
    hashes = set()
    removed_blur = 0
    removed_dup = 0
    removed_tiny = 0
    
    for img_path in tqdm(image_files, desc="Filtering Images"):
        # Check duplicate
        img_hash = get_image_hash(img_path)
        if img_hash in hashes:
            img_path.unlink(missing_ok=True)
            if labels_dir:
                label_path = labels_dir / f"{img_path.stem}.txt"
                label_path.unlink(missing_ok=True)
            removed_dup += 1
            continue
        hashes.add(img_hash)
        
        # Check tiny size
        try:
            img = cv2.imread(str(img_path))
            if img is None:
                img_path.unlink(missing_ok=True)
                if labels_dir:
                    label_path = labels_dir / f"{img_path.stem}.txt"
                    label_path.unlink(missing_ok=True)
                removed_tiny += 1
                continue
            h, w = img.shape[:2]
            if w < min_size[0] or h < min_size[1]:
                img_path.unlink(missing_ok=True)
                if labels_dir:
                    label_path = labels_dir / f"{img_path.stem}.txt"
                    label_path.unlink(missing_ok=True)
                removed_tiny += 1
                continue
        except Exception:
            img_path.unlink(missing_ok=True)
            if labels_dir:
                label_path = labels_dir / f"{img_path.stem}.txt"
                label_path.unlink(missing_ok=True)
            removed_tiny += 1
            continue
            
        # Check blur
        blur_val = compute_blur(img_path)
        if blur_val < blur_threshold:
            img_path.unlink(missing_ok=True)
            if labels_dir:
                label_path = labels_dir / f"{img_path.stem}.txt"
                label_path.unlink(missing_ok=True)
            removed_blur += 1
            
    print(f"Cleanup done! Duplicates removed: {removed_dup}, Blurry removed: {removed_blur}, Tiny/corrupt removed: {removed_tiny}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python dataset_quality.py <dataset_directory>")
        sys.exit(1)
    filter_dataset(sys.argv[1])
