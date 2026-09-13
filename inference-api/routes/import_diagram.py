import base64
import io
import os
from pathlib import Path
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from PIL import Image

from inference import ONNXDiagramDetector
from nlp_model import sanitize_and_heal_graph
from import_pipeline.preprocess import preprocess_diagram_image
from import_pipeline.ocr import extract_diagram_text
from import_pipeline.detect_shapes import detect_shapes_and_arrows
from import_pipeline.reconstruct import reconstruct_diagram_graph

router = APIRouter()

# Load detector instance
_raw_model_path = os.getenv("ONNX_MODEL_PATH", "ml/browser_models/collabboard_int8.onnx")
MODEL_PATH = _raw_model_path
if not Path(MODEL_PATH).exists():
    repo_root = Path(__file__).resolve().parent.parent.parent
    alt_model_path = repo_root / _raw_model_path
    if alt_model_path.exists():
        MODEL_PATH = str(alt_model_path)

try:
    detector = ONNXDiagramDetector(MODEL_PATH)
except Exception as e:
    print(f"[Import Pipeline] Warning: Could not initialize local ONNX detector: {e}")
    detector = None

class ImportImageRequest(BaseModel):
    imageBase64: str
    sessionId: Optional[str] = None
    enablePreprocessing: Optional[bool] = True
    enableHighPrecision: Optional[bool] = False
    diagramTypeHint: Optional[str] = None

def decode_base64(b64_str: str) -> Image.Image:
    try:
        if "," in b64_str:
            b64_str = b64_str.split(",")[1]
        img_bytes = base64.b64decode(b64_str)
        return Image.open(io.BytesIO(img_bytes)).convert("RGB")
    except Exception as e:
        raise ValueError(f"Invalid base64 image data: {e}")

@router.post("/import-image")
async def import_image(payload: ImportImageRequest):
    """
    Internal-only raster diagram import pipeline endpoint.
    Invoked by the authenticated Express server.
    """
    try:
        # 1. Decode image
        raw_image = decode_base64(payload.imageBase64)
        orig_w, orig_h = raw_image.size

        # 2. Preprocessing pipeline (deskew, auto-crop, CLAHE contrast equalization, denoise)
        if payload.enablePreprocessing:
            image, prep_metrics = preprocess_diagram_image(raw_image)
        else:
            image = raw_image
            prep_metrics = {"original_width": orig_w, "original_height": orig_h, "cropped": False}

        cur_w, cur_h = image.size

        # 3. Independent OCR pass (extracts text bounding boxes independently of shapes)
        ocr_regions = extract_diagram_text(image)

        # 4. Shape & Arrow Detection: Robust geometric CV pipeline (with contour analysis and compartment merging)
        detections, detector_method = detect_shapes_and_arrows(image, onnx_detector=None)

        # 5. Geometric Reconstruction (matches OCR text boxes to shapes & arrows to endpoints)
        diagram = reconstruct_diagram_graph(
            detections=detections,
            ocr_regions=ocr_regions,
            orig_w=cur_w,
            orig_h=cur_h,
            diagram_type_hint=payload.diagramTypeHint
        )

        # 6. Graph Sanitization: Prune phantom edges without inventing artificial orphan edges
        repaired_diagram, healing_telemetry = sanitize_and_heal_graph(diagram, stitch_orphans=False)

        return {
            "status": "complete",
            "diagram": repaired_diagram,
            "detectorMethod": detector_method,
            "preprocessing": prep_metrics,
            "ocrRegionsFound": len(ocr_regions),
            "healing": healing_telemetry,
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        print(f"[Import API Error] Image import pipeline failed: {e}")
        raise HTTPException(status_code=500, detail=f"Image import processing failed: {e}")
