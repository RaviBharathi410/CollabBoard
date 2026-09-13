import sys
from pathlib import Path
import pytest

# Add parent directory to sys.path
sys.path.append(str(Path(__file__).resolve().parents[1]))

from inference import reconstruct_diagram

def test_reconstruct_basic_flow():
    # Mock shapes: Node 1 (left) and Node 2 (right), linked by a horizontal arrow
    detections = [
        {
            "class_name": "rectangle",
            "confidence": 0.90,
            "box": [10.0, 10.0, 100.0, 90.0],
            "bbox_normalized": [0.055, 0.05, 0.09, 0.08]
        },
        {
            "class_name": "circle",
            "confidence": 0.85,
            "box": [200.0, 10.0, 280.0, 90.0],
            "bbox_normalized": [0.24, 0.05, 0.08, 0.08]
        },
        {
            "class_name": "arrow",
            "confidence": 0.88,
            "box": [101.0, 45.0, 199.0, 55.0],
            "bbox_normalized": [0.15, 0.05, 0.098, 0.01]
        }
    ]
    
    diagram = reconstruct_diagram(detections, orig_w=1000, orig_h=1000)
    
    assert diagram["type"] == "architecture"
    assert len(diagram["nodes"]) == 2
    assert len(diagram["edges"]) == 1
    
    edge = diagram["edges"][0]
    assert edge["source"] == "n1"
    assert edge["target"] == "n2"
    assert edge["style"] == "solid"

def test_reconstruct_label_matching():
    detections = [
        {
            "class_name": "rectangle",
            "confidence": 0.95,
            "box": [50.0, 50.0, 150.0, 130.0],
            "bbox_normalized": [0.1, 0.09, 0.1, 0.08]
        }
    ]
    
    # Client text shape positioned near the rectangle center (100, 90)
    existing_shapes = [
        {
            "type": "text",
            "text": "Main API",
            "x": 95.0,
            "y": 85.0
        }
    ]
    
    diagram = reconstruct_diagram(
        detections, 
        orig_w=1000, 
        orig_h=1000, 
        existing_shapes=existing_shapes
    )
    
    assert len(diagram["nodes"]) == 1
    assert diagram["nodes"][0]["label"] == "Main API"

def test_reconstruct_sequence_actor_hint():
    detections = [
        {
            "class_name": "actor",
            "confidence": 0.92,
            "box": [50.0, 50.0, 150.0, 130.0],
            "bbox_normalized": [0.1, 0.09, 0.1, 0.08]
        }
    ]
    
    diagram = reconstruct_diagram(detections, orig_w=1000, orig_h=1000)
    assert diagram["type"] == "sequence"

def test_reconstruct_unmatched_arrow():
    # Arrow positioned floating alone, far from any shapes (no shapes present)
    detections = [
        {
            "class_name": "arrow",
            "confidence": 0.88,
            "box": [500.0, 500.0, 600.0, 510.0],
            "bbox_normalized": [0.55, 0.505, 0.1, 0.01]
        }
    ]
    
    diagram = reconstruct_diagram(detections, orig_w=1000, orig_h=1000)
    assert len(diagram["edges"]) == 0
