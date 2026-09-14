import sys
from pathlib import Path
import pytest
import numpy as np
import cv2
from PIL import Image
from fastapi.testclient import TestClient
import base64
import io

# Add inference-api directory to sys.path
sys.path.append(str(Path(__file__).resolve().parents[1]))

from import_pipeline.preprocess import preprocess_diagram_image, deskew_image, auto_crop_boundary
from import_pipeline.ocr import extract_diagram_text
from import_pipeline.reconstruct import reconstruct_diagram_graph, box_iou, box_containment
from main import app

client = TestClient(app)

def create_synthetic_diagram_image():
    """Create a 400x300 whiteboard-style image with a drawn box and text area."""
    img = np.ones((300, 400, 3), dtype=np.uint8) * 250  # Light background
    # Draw a rectangle
    cv2.rectangle(img, (50, 50), (180, 120), (30, 30, 30), 2)
    # Draw some text-like lines inside
    cv2.putText(img, "API Gateway", (60, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
    # Draw an arrow
    cv2.arrowedLine(img, (180, 85), (280, 85), (30, 30, 30), 2, tipLength=0.2)
    # Draw target circle
    cv2.circle(img, (320, 85), 30, (30, 30, 30), 2)
    return Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))

def test_preprocess_pipeline():
    pil_img = create_synthetic_diagram_image()
    processed_img, metrics = preprocess_diagram_image(pil_img)

    assert isinstance(processed_img, Image.Image)
    assert "original_width" in metrics
    assert "original_height" in metrics
    assert "deskew_angle_deg" in metrics
    assert "clahe_applied" in metrics
    assert metrics["clahe_applied"] is True

def test_box_overlap_math():
    boxA = [10.0, 10.0, 50.0, 50.0]
    boxB = [20.0, 20.0, 40.0, 40.0]  # inside boxA

    assert box_containment(boxB, boxA) == 1.0
    iou = box_iou(boxA, boxB)
    assert 0.0 < iou < 1.0

def test_reconstruct_diagram_graph_with_ocr():
    # Synthetic detections: Node 1 (rect), Node 2 (circle), Arrow
    detections = [
        {
            "class_name": "rectangle",
            "confidence": 0.92,
            "box": [50.0, 50.0, 180.0, 120.0],
            "bbox_normalized": [0.28, 0.28, 0.32, 0.23]
        },
        {
            "class_name": "circle",
            "confidence": 0.88,
            "box": [290.0, 55.0, 350.0, 115.0],
            "bbox_normalized": [0.8, 0.28, 0.15, 0.2]
        },
        {
            "class_name": "arrow",
            "confidence": 0.85,
            "box": [181.0, 80.0, 289.0, 90.0],
            "bbox_normalized": [0.58, 0.28, 0.27, 0.03]
        }
    ]

    # Independent OCR text bounding box inside the rectangle
    ocr_regions = [
        {
            "text": "Auth Service",
            "confidence": 0.96,
            "bbox": [60.0, 70.0, 160.0, 100.0],
            "source": "ocr"
        }
    ]

    diagram = reconstruct_diagram_graph(
        detections=detections,
        ocr_regions=ocr_regions,
        orig_w=400,
        orig_h=300
    )

    assert diagram["sourceType"] == "image"
    assert len(diagram["nodes"]) == 2
    assert len(diagram["edges"]) == 1

    rect_node = diagram["nodes"][0]
    assert rect_node["type"] == "rectangle"
    assert rect_node["label"] == "Auth Service"
    assert rect_node["source"] == "detected"

    edge = diagram["edges"][0]
    assert edge["source"] == "n1"
    assert edge["target"] == "n2"
    assert edge["sourceTag"] == "detected"
    assert "points" in edge
    assert len(edge["points"]) == 2

def test_reconstruct_callout_suppression():
    # Verify tutorial callout labels ("Boundary Class", "Control class") are suppressed from becoming standalone shapes
    detections = [
        {
            "class_name": "rectangle",
            "confidence": 0.90,
            "box": [50.0, 50.0, 200.0, 150.0],
            "bbox_normalized": [0.25, 0.25, 0.3, 0.25]
        }
    ]
    ocr_regions = [
        {
            "text": "ConsoleWindow",
            "confidence": 0.95,
            "bbox": [60.0, 60.0, 180.0, 90.0]
        },
        {
            "text": "Boundary Class",
            "confidence": 0.90,
            "bbox": [10.0, 10.0, 80.0, 30.0]
        },
        {
            "text": "Control class",
            "confidence": 0.90,
            "bbox": [250.0, 10.0, 320.0, 30.0]
        },
        {
            "text": "The main window of the application",
            "confidence": 0.88,
            "bbox": [100.0, 220.0, 300.0, 250.0]
        }
    ]

    diagram = reconstruct_diagram_graph(
        detections=detections,
        ocr_regions=ocr_regions,
        orig_w=400,
        orig_h=300
    )

    node_labels = [n["label"] for n in diagram["nodes"]]
    # Callout annotations must NOT be in node labels
    assert not any("boundary class" in lbl.lower() for lbl in node_labels)
    assert not any("control class" in lbl.lower() for lbl in node_labels)
    # Explanatory note is preserved as a note
    assert any("main window of the application" in lbl.lower() for lbl in node_labels)

def test_import_image_api_endpoint():
    pil_img = create_synthetic_diagram_image()
    buffered = io.BytesIO()
    pil_img.save(buffered, format="PNG")
    img_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

    response = client.post("/import-image", json={
        "imageBase64": f"data:image/png;base64,{img_b64}",
        "enablePreprocessing": True,
        "enableHighPrecision": False
    })

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "complete"
    assert "diagram" in data
    assert "nodes" in data["diagram"]
    assert "edges" in data["diagram"]
    assert "preprocessing" in data
    assert "healing" in data
