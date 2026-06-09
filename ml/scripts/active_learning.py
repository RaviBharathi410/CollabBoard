"""
Active learning loop: selects uncertain/corrected samples for retraining.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

RETRAIN_THRESHOLD = 500
UNCERTAINTY_CONF_CUTOFF = 0.60


def collect_uncertain_samples(feedback_dir: Path, model_log_dir: Path, output_dir: Path):
    selected = []

    for fb_file in sorted(feedback_dir.glob("*_feedback.ndjson"))[-7:]:
        with open(fb_file, encoding="utf-8") as f:
            for line in f:
                record = json.loads(line)
                if record["action"] in ["relabel", "retype", "delete"] and record.get("hasImage"):
                    selected.append(
                        {
                            "source": "user_correction",
                            "sessionId": record["sessionId"],
                            "image_path": str(
                                feedback_dir
                                / "images"
                                / f"{record['sessionId']}_{record['nodeId']}.png"
                            ),
                            "corrected_label": record.get("correctedLabel"),
                            "corrected_type": record.get("correctedType"),
                            "priority": 1.0,
                        }
                    )

    model_log_dir.mkdir(parents=True, exist_ok=True)
    for log_file in sorted(model_log_dir.glob("*.jsonl"))[-3:]:
        with open(log_file, encoding="utf-8") as f:
            for line in f:
                record = json.loads(line)
                conf = record.get("overall_confidence", 1.0)
                if conf < UNCERTAINTY_CONF_CUTOFF:
                    selected.append(
                        {
                            "source": "uncertain_prediction",
                            "sessionId": record.get("sessionId"),
                            "confidence": conf,
                            "priority": 1.0 - conf,
                        }
                    )

    selected.sort(key=lambda x: x["priority"], reverse=True)
    print(f"Active learning: selected {len(selected)} samples for annotation")

    output_dir.mkdir(parents=True, exist_ok=True)
    with open(output_dir / "selected_samples.json", "w", encoding="utf-8") as f:
        json.dump(selected, f, indent=2)

    if len(selected) >= RETRAIN_THRESHOLD:
        print(f"Threshold reached ({len(selected)} >= {RETRAIN_THRESHOLD}). Triggering retrain.")
        trigger_retrain(selected)


def trigger_retrain(samples: list):
    with open(".retrain_trigger", "w", encoding="utf-8") as f:
        json.dump(
            {"timestamp": datetime.utcnow().isoformat(), "num_samples": len(samples)},
            f,
        )
    print("Retrain trigger written. CI/CD will pick this up on next scheduled run.")


if __name__ == "__main__":
    collect_uncertain_samples(
        Path("ml/datasets/feedback"),
        Path("inference-api/logs"),
        Path("ml/datasets/active_learning"),
    )
