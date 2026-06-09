"""Validate trained diagram detection model against accuracy thresholds."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from ultralytics import YOLO

ACCURACY_THRESHOLDS = {
    "mAP50": 0.70,
    "mAP50-95": 0.50,
    "precision": 0.72,
    "recall": 0.68,
}


def validate_detection_model(model_path: str, dataset_yaml: str) -> dict:
    model = YOLO(model_path)
    results = model.val(
        data=dataset_yaml, imgsz=640, batch=16, conf=0.25, iou=0.6, plots=True
    )

    metrics = {
        "mAP50": float(results.box.map50),
        "mAP50-95": float(results.box.map),
        "precision": float(results.box.mp),
        "recall": float(results.box.mr),
        "per_class_mAP": {},
    }

    names = results.names
    maps = results.box.maps.tolist() if hasattr(results.box, "maps") else []
    if isinstance(names, dict):
        for idx, map_val in enumerate(maps):
            cls_name = names.get(idx, f"class_{idx}")
            metrics["per_class_mAP"][cls_name] = float(map_val)
    else:
        for cls_name, map_val in zip(names.values() if isinstance(names, dict) else names, maps):
            metrics["per_class_mAP"][str(cls_name)] = float(map_val)

    print("\n=== VALIDATION RESULTS ===")
    for key, value in metrics.items():
        if key != "per_class_mAP":
            threshold = ACCURACY_THRESHOLDS.get(key, 0)
            status = "PASS" if value >= threshold else "FAIL"
            print(f"  {key:<20} {value:.4f}  (threshold: {threshold})  [{status}]")

    print("\n  Per-class mAP50:")
    for cls_name, map_val in metrics["per_class_mAP"].items():
        print(f"    {cls_name:<25} {map_val:.4f}")

    all_pass = all(
        metrics[k] >= v for k, v in ACCURACY_THRESHOLDS.items() if k in metrics
    )
    print(f"\n  Overall: {'ALL PASS' if all_pass else 'SOME THRESHOLDS NOT MET'}")

    report_path = Path(model_path).parent / "validation_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    if not all_pass:
        sys.exit(1)
    return metrics


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--model",
        default="ml/models/checkpoints/yolov8n_diagrams/weights/best.pt",
    )
    parser.add_argument("--dataset", default="ml/datasets/processed/dataset.yaml")
    args = parser.parse_args()
    validate_detection_model(args.model, args.dataset)
