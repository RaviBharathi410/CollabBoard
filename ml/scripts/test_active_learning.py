"""
test_active_learning.py
Unit tests verifying active learning sample extraction, specifically testing
the 'correction' action dispatched by useAIEngine.js.
"""

import json
import tempfile
from pathlib import Path
import pytest
from active_learning import collect_uncertain_samples

def test_collect_correction_action():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        feedback_dir = tmp_path / "feedback"
        model_log_dir = tmp_path / "logs"
        output_dir = tmp_path / "output"

        feedback_dir.mkdir()
        model_log_dir.mkdir()

        # Create dummy feedback file with 'correction', 'relabel', and an ignored action
        fb_file = feedback_dir / "session1_feedback.ndjson"
        records = [
            {
                "action": "correction",
                "sessionId": "sess_1",
                "nodeId": "node_a",
                "correctedLabel": "API Gateway",
                "correctedType": "rectangle",
                "hasImage": True,
            },
            {
                "action": "relabel",
                "sessionId": "sess_1",
                "nodeId": "node_b",
                "correctedLabel": "Redis Cache",
                "hasImage": True,
            },
            {
                "action": "view",
                "sessionId": "sess_1",
                "nodeId": "node_c",
                "hasImage": True,
            },
            {
                "action": "correction",
                "sessionId": "sess_2",
                "nodeId": "node_d",
                "hasImage": False,  # Should be ignored because hasImage is False
            }
        ]
        with open(fb_file, "w", encoding="utf-8") as f:
            for r in records:
                f.write(json.dumps(r) + "\n")

        collect_uncertain_samples(feedback_dir, model_log_dir, output_dir)

        out_file = output_dir / "selected_samples.json"
        assert out_file.exists(), "Output JSON file was not generated"

        with open(out_file, "r", encoding="utf-8") as f:
            selected = json.load(f)

        assert len(selected) == 2, f"Expected 2 selected samples, got {len(selected)}"
        session_ids = {s["sessionId"] for s in selected}
        assert "sess_1" in session_ids
        
        # Verify correction sample details
        corr_sample = next(s for s in selected if s["corrected_label"] == "API Gateway")
        assert corr_sample["source"] == "user_correction"
        assert corr_sample["priority"] == 1.0
