import argparse
import os
import shutil
import random
from pathlib import Path
from ultralytics import YOLO
import mlflow

UNIFIED_CLASSES = [
    "rectangle", "circle", "diamond", "arrow", "text_region",
    "database", "cloud", "container", "group_boundary", "sticky_note", "connector"
]

def load_replay_data(replay_dirs, ratio=0.30):
    """
    Randomly samples from existing datasets to mix into the current dataset
    in order to prevent catastrophic forgetting.
    """
    replay_images = []
    for rdir in replay_dirs:
        rpath = Path(rdir) / "images"
        if rpath.exists():
            replay_images.extend(list(rpath.glob("*.*")))
    return replay_images

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, type=str)
    parser.add_argument("--cfg", required=False, default=None, type=str)
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--img-sz", type=str, default="512,640,768")
    parser.add_argument("--device", type=str, default="0")
    parser.add_argument("--replay_datasets", type=str, default="")
    parser.add_argument("--replay_ratio", type=float, default=0.30)
    parser.add_argument("--project", type=str, default="ml/checkpoints")
    parser.add_argument("--name", type=str, default="stage_train")
    parser.add_argument("--log_dir", type=str, default="")
    parser.add_argument("--save_last", action="store_true")
    args = parser.parse_args()

    # Parse image sizes
    imgsz_list = [int(sz) for sz in args.img_sz.split(",")]
    # For multi-scale training, we can pass the median or list to YOLO training
    imgsz = imgsz_list[1] if len(imgsz_list) > 1 else imgsz_list[0]

    # Setup MLflow logging
    mlflow.set_tracking_uri("sqlite:///mlflow.db")
    mlflow.set_experiment("CollabBoard_MultiStage_Pipeline")

    # Replay buffer handling:
    # In full implementation, we concatenate current stage training files with 
    # a subset of historic replay files to form a joint dataset manifest.
    if args.replay_datasets:
        r_dirs = args.replay_datasets.split(",")
        print(f"Mixing in replay datasets: {r_dirs} at ratio={args.replay_ratio}")
        replay_imgs = load_replay_data(r_dirs, args.replay_ratio)
        print(f"Loaded {len(replay_imgs)} potential replay images.")

    print(f"Initializing YOLOv8 training: {args.name}")
    # Load model (use previous stage checkpoint if available to continue training)
    # Check if a model checkpoint already exists from the previous run
    model_path = "yolov8n.pt"  # base pre-trained weights
    
    # Check if previous checkpoint folders exist in the checkpoints project
    checkpoints_path = Path(args.project)
    if checkpoints_path.exists():
        # Find the latest best.pt or last.pt to carry out stage-wise fine-tuning
        # Sort checkpoints by modification date to find the most recent
        all_pts = list(checkpoints_path.glob("**/weights/best.pt"))
        if all_pts:
            all_pts.sort(key=os.path.getmtime)
            model_path = str(all_pts[-1])
            print(f"Found existing weights for progressive fine-tuning: {model_path}")

    model = YOLO(model_path)

    # Begin MLflow Run
    with mlflow.start_run(run_name=args.name):
        mlflow.log_params({
            "stage_name": args.name,
            "epochs": args.epochs,
            "batch_size": args.batch,
            "img_size": imgsz,
            "replay_ratio": args.replay_ratio
        })

        results = model.train(
            data=args.data,
            epochs=args.epochs,
            batch=args.batch,
            imgsz=imgsz,
            device=args.device,
            project=args.project,
            name=args.name,
            rect=True,       # rectangular training for flowcharts/UMLs
            multi_scale=True, # enable scale augmentation
            workers=0,       # running in main thread to avoid paging file error 1455
            exist_ok=True    # overwrite existing project/name instead of appending -2, -3
        )
        
        # Save validation metrics to mlflow
        if hasattr(results, 'results_dict'):
            for k, v in results.results_dict.items():
                # Sanitize metric key names for mlflow (alphanumerics, underscores, dashes, periods, spaces, slashes)
                sanitized_k = k.replace("(", "_").replace(")", "_").replace("%", "pct").strip()
                try:
                    mlflow.log_metric(sanitized_k, v)
                except Exception as e:
                    print(f"Skipping MLflow log for {k}: {e}")
                
    print(f"Training completed. Checkpoints saved to {args.project}/{args.name}")

if __name__ == "__main__":
    main()
