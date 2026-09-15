import pytest
from import_pipeline.classify_diagram_type import classify_diagram_type

def test_classify_uml_class_diagram():
    ocr_regions = [
        {"text": "<<entity>>"},
        {"text": "Window"},
        {"text": "- radius : float"},
        {"text": "- center : unsigned int"},
        {"text": "+ draw()"},
        {"text": "+ resize()"},
    ]
    detected_shapes = [
        {"class_name": "rectangle", "box": [100, 100, 250, 130]},
        {"class_name": "rectangle", "box": [100, 130, 250, 180]},
        {"class_name": "rectangle", "box": [100, 180, 250, 230]},
    ]

    result = classify_diagram_type(detected_shapes, ocr_regions)
    assert result["type"] == "uml-class"
    assert result["confidence"] >= 0.75
    assert result["method"] == "heuristic"

def test_classify_flowchart_diagram():
    ocr_regions = [
        {"text": "Start"},
        {"text": "Is User Valid?"},
        {"text": "Yes"},
        {"text": "No"},
        {"text": "End Process"},
    ]
    detected_shapes = [
        {"class_name": "rectangle", "box": [100, 50, 200, 90]},
        {"class_name": "diamond", "box": [100, 120, 200, 180]},
        {"class_name": "rectangle", "box": [100, 220, 200, 260]},
    ]

    result = classify_diagram_type(detected_shapes, ocr_regions)
    assert result["type"] == "flowchart"
    assert result["confidence"] >= 0.70

def test_classify_erd_diagram():
    ocr_regions = [
        {"text": "User Table"},
        {"text": "PK id"},
        {"text": "FK account_id"},
        {"text": "1:N relationship"},
    ]
    detected_shapes = [
        {"class_name": "rectangle", "box": [100, 50, 220, 150]},
        {"class_name": "rectangle", "box": [300, 50, 420, 150]},
    ]

    result = classify_diagram_type(detected_shapes, ocr_regions)
    assert result["type"] == "erd"
    assert result["confidence"] >= 0.70
