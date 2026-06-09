from ultralytics import YOLO
import sys, shutil
from pathlib import Path

def main():
    try:
        model = YOLO('runs/detect/ml/checkpoints/user_sketch_stage/weights/best.pt')
        onnx_path = model.export(format='onnx', device='0')
        
        dest_path = Path('ml/exports/collabboard_final.onnx')
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(onnx_path, dest_path)
        print(f"Exported successfully to {dest_path}")
    except Exception as e:
        print(f"Export failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
