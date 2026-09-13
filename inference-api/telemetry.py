import json
from datetime import datetime, timezone
from pathlib import Path

LOG_DIR = Path("inference-api/logs")

def log_inference_run(session_id: str, overall_confidence: float):
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        log_file = LOG_DIR / "inference.jsonl"

        record = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "sessionId": session_id,
            "overall_confidence": overall_confidence
        }

        with open(log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")

        print(f"[Telemetry] Logged run for session {session_id} (confidence: {overall_confidence:.4f})")
    except Exception as e:
        print(f"[Telemetry ERROR] Failed to log inference run: {e}")
