from ultralytics import YOLO
import sys, shutil
from pathlib import Path

# Standalone re-export utility: re-exports a trained checkpoint to the path
# that detect.py and the Docker image expect, without running the full pipeline.
# Output: ml/browser_models/collabboard_int8.onnx
# Note: for INT8 quantisation, run ml/run_pipeline.ps1 instead — this produces FP32 ONNX.

def main():
    try:
        model = YOLO('runs/detect/ml/checkpoints/user_sketch_stage/weights/best.pt')
        onnx_path = model.export(format='onnx', device='0')

        dest_path = Path('ml/browser_models/collabboard_int8.onnx')
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(onnx_path, dest_path)
        print(f"Exported successfully to {dest_path}")
        print("Reminder: also copy to public/models/ if you want the browser bundle updated.")
    except Exception as e:
        print(f"Export failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
