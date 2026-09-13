from fastapi.testclient import TestClient
import sys
from pathlib import Path
from unittest.mock import patch

# Add parent directory to sys.path
sys.path.append(str(Path(__file__).resolve().parents[1]))

from main import app

client = TestClient(app)

def test_nlp_validation_empty_text():
    response = client.post("/nlp-to-diagram", json={"text": ""})
    assert response.status_code == 422

def test_nlp_validation_missing_text():
    response = client.post("/nlp-to-diagram", json={})
    assert response.status_code == 422

def test_nlp_model_not_loaded_503():
    with patch("routes.nlp.is_loaded", return_value=False):
        response = client.post("/nlp-to-diagram", json={"text": "simple client and server"})
        assert response.status_code == 503
        assert "not loaded" in response.json()["detail"].lower()

def test_nlp_success():
    sample_diagram = {
        "type": "architecture",
        "confidence": 0.95,
        "nodes": [
            {"id": "node_1", "label": "Client", "type": "rectangle", "x": 100, "y": 100, "width": 120, "height": 60},
            {"id": "node_2", "label": "Server", "type": "rectangle", "x": 300, "y": 100, "width": 120, "height": 60}
        ],
        "edges": [
            {"id": "edge_1", "from": "node_1", "to": "node_2", "label": "HTTP"}
        ],
        "layoutHint": "hierarchical"
    }

    with patch("routes.nlp.is_loaded", return_value=True), \
         patch("routes.nlp.generate_diagram", return_value=sample_diagram):
        response = client.post(
            "/nlp-to-diagram",
            json={"text": "microservices with client and server"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert len(data["diagram"]["nodes"]) == 2
        assert data["modelUsed"] == "flan-t5-fine-tuned"

def test_nlp_parse_failed_fallback():
    with patch("routes.nlp.is_loaded", return_value=True), \
         patch("routes.nlp.generate_diagram", side_effect=ValueError("JSON malformed")):
        response = client.post(
            "/nlp-to-diagram",
            json={"text": "what is an api gateway?"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "parse_failed"


def test_confidence_derived_from_scores_not_model_text():
    import torch
    from unittest.mock import MagicMock
    import nlp_model

    # Create synthetic raw output string that contains a fake self-reported confidence
    fake_raw_output = '{"type":"flowchart","confidence":0.99,"nodes":[{"id":"n1","label":"Start"}],"edges":[]}'

    mock_tokenizer = MagicMock()
    mock_tokenizer.return_value = {"input_ids": torch.tensor([[1, 2, 3]])}
    mock_tokenizer.decode.return_value = fake_raw_output

    mock_gen_output = MagicMock()
    mock_gen_output.sequences = torch.tensor([[10, 20, 30]])
    mock_gen_output.scores = (torch.tensor([[0.5]]),)

    mock_model = MagicMock()
    mock_model.device = "cpu"
    mock_model.generate.return_value = mock_gen_output
    # Synthetic log-prob of log(0.72) = -0.3285
    mock_model.compute_transition_scores.return_value = torch.tensor([[-0.3285, -0.3285]])

    with patch.object(nlp_model, "_tokenizer", mock_tokenizer), \
         patch.object(nlp_model, "_model", mock_model), \
         patch.object(nlp_model, "is_loaded", return_value=True):
        diagram = nlp_model.generate_diagram("user login flow")

        # Must be overwritten by exp(mean(log_prob)) = ~0.72, NEVER the model text's 0.99
        assert diagram["confidence"] != 0.99
        assert abs(diagram["confidence"] - 0.72) < 0.01
        assert diagram["confidenceComputed"] is True


def test_confidence_varies_across_prompts():
    import nlp_model
    if not nlp_model.is_loaded():
        nlp_model.load_nlp_model("ml/exports/nlp_model")

    if nlp_model.is_loaded():
        d1 = nlp_model.generate_diagram("flowchart for user login: user enters password, checks db, succeeds")
        d2 = nlp_model.generate_diagram("draw a completely weird quantum entangled potato router connecting space aliens")
        
        # Confidences must vary and reflect uncertainty
        assert d1["confidence"] != d2["confidence"]
        assert 0.0 < d1["confidence"] < 1.0
        assert 0.0 < d2["confidence"] < 1.0
        # Not stuck at memorized training set constant 0.92
        assert d1["confidence"] != 0.92
        assert d1.get("confidenceComputed") is True

