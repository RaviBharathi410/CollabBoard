from fastapi.testclient import TestClient
import sys
from pathlib import Path

# Add parent directory to sys.path so we can import main
sys.path.append(str(Path(__file__).resolve().parents[1]))

from main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "model_loaded" in data
