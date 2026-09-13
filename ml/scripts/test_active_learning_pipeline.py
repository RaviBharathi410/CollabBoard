"""
test_active_learning_pipeline.py
Unit tests verifying the active learning correction collection,
score formulation, and hard regression gate decisions.
"""

import json
import tempfile
from pathlib import Path
import pytest

from active_learning_retrain import (
    collect_correction_records,
    compute_composite_eval_score,
    evaluate_gate,
)


def test_collect_nlp_and_vision_corrections():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        nlp_dir = tmp_path / "nlp_corrections"
        feedback_dir = tmp_path / "feedback"
        nlp_dir.mkdir()
        feedback_dir.mkdir()

        # 1. Create NLP correction record
        nlp_file = nlp_dir / "2026-09-13_corrections.ndjson"
        nlp_sample = {
            "timestamp": "2026-09-13T00:00:00Z",
            "sessionId": "sess_nlp_1",
            "action": "correction",
            "original_prompt": "microservices with api gateway and redis",
            "generated_diagram": {"nodes": [{"id": "n1", "label": "API"}]},
            "corrected_diagram": {
                "nodes": [{"id": "n1", "label": "API Gateway"}, {"id": "n2", "label": "Redis"}],
                "edges": [{"id": "e1", "source": "n1", "target": "n2"}],
            },
        }
        nlp_file.write_text(json.dumps(nlp_sample) + "\n", encoding="utf-8")

        # 2. Create Vision feedback record
        vis_file = feedback_dir / "2026-09-13_feedback.ndjson"
        vis_sample = {
            "timestamp": "2026-09-13T00:00:00Z",
            "action": "relabel",
            "sessionId": "sess_vis_1",
            "nodeId": "node_10",
            "correctedLabel": "PostgreSQL",
        }
        vis_file.write_text(json.dumps(vis_sample) + "\n", encoding="utf-8")

        records = collect_correction_records(nlp_dir, feedback_dir)
        assert len(records) == 2, f"Expected 2 records, got {len(records)}"

        nlp_rec = next(r for r in records if r["type"] == "nlp_correction")
        assert nlp_rec["prompt"] == "microservices with api gateway and redis"
        assert len(nlp_rec["corrected"]["nodes"]) == 2

        vis_rec = next(r for r in records if r["type"] == "vision_correction")
        assert vis_rec["correctedLabel"] == "PostgreSQL"


def test_composite_score_calculation():
    # 40% JSON + 40% Conn + 20% (1 - healing)
    perfect = {
        "json_valid_rate": 1.0,
        "connectivity_rate": 1.0,
        "healing_rate": 0.0,
    }
    assert compute_composite_eval_score(perfect) == 1.0

    typical = {
        "json_valid_rate": 0.95,      # 0.38
        "connectivity_rate": 0.90,    # 0.36
        "healing_rate": 0.20,         # 0.80 * 0.20 = 0.16
    }
    # 0.38 + 0.36 + 0.16 = 0.90
    assert compute_composite_eval_score(typical) == 0.90


def test_hard_regression_gate_blocks_regression():
    baseline_score = 0.9200
    regressed_candidate = 0.8850

    status, approved = evaluate_gate(regressed_candidate, baseline_score)
    assert approved is False
    assert status == "REJECTED_REGRESSION"


def test_hard_regression_gate_approves_parity_or_improvement():
    baseline_score = 0.9200

    # Parity check
    status, approved = evaluate_gate(0.9200, baseline_score)
    assert approved is True
    assert status == "APPROVED_FOR_PROMOTION"

    # Improvement check
    status, approved = evaluate_gate(0.9550, baseline_score)
    assert approved is True
    assert status == "APPROVED_FOR_PROMOTION"
