import base64
import io
import os
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from PIL import Image

from inference import ONNXDiagramDetector, reconstruct_diagram
from telemetry import log_inference_run

router = APIRouter()

# Instantiate the ONNX model detector
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
    print(f"[ONNX ERROR] Failed to load detector in route setup: {e}")
    detector = None

class DetectRequest(BaseModel):
    imageBase64: str
    sessionId: Optional[str] = None
    existingShapes: Optional[List[Dict[str, Any]]] = None
    diagramTypeHint: Optional[str] = None
    instruction: Optional[str] = None

def decode_base64_image(b64_str: str) -> Image.Image:
    try:
        if "," in b64_str:
            b64_str = b64_str.split(",")[1]
        img_bytes = base64.b64decode(b64_str)
        return Image.open(io.BytesIO(img_bytes)).convert("RGB")
    except Exception as e:
        raise ValueError(f"Failed to decode base64 image: {e}")

@router.post("/detect")
async def detect(payload: DetectRequest):
    try:
        # 1. Decode image
        image = decode_base64_image(payload.imageBase64)
        orig_w, orig_h = image.size
        
        # 2. Run object detection (Tier 1: ONNX -> Tier 2: Classical Computer Vision Fallback)
        detections = []
        model_used = "local-onnx-int8"
        if detector is not None:
            try:
                detections = detector.predict(image)
            except Exception as e:
                print(f"[Detect] ONNX predict error: {e}")
                detections = []

        # If ONNX yields 0 detections (due to known quantization underflow defect), use classical CV
        if not detections:
            try:
                from import_pipeline.detect_shapes import detect_shapes_and_arrows
                cv_dets, _ = detect_shapes_and_arrows(image, onnx_detector=None)
                model_used = "geometric_cv_fallback"
                for d in cv_dets:
                    b = d["box"]
                    detections.append({
                        "class_name": d["type"],
                        "confidence": float(d.get("confidence", 0.85)),
                        "bbox": [float(c) for c in b],
                        "bbox_normalized": [float(b[0] / orig_w), float(b[1] / orig_h), float(b[2] / orig_w), float(b[3] / orig_h)]
                    })
            except Exception as cv_err:
                print(f"[Detect] Classical CV fallback error: {cv_err}")

        # 3. Reconstruct diagram graph
        diagram = reconstruct_diagram(
            detections=detections,
            orig_w=orig_w,
            orig_h=orig_h,
            existing_shapes=payload.existingShapes,
            diagram_type_hint=payload.diagramTypeHint
        )
        
        # 4. Log runs for active learning
        session_id = payload.sessionId or "unknown_session"
        log_inference_run(session_id, diagram.get("confidence", 0.0))
        
        # 5. Format nodes (returning bounding box nodes matching BrowserDetector format)
        formatted_nodes = []
        for d in detections:
            formatted_nodes.append({
                "id": f"det-{session_id[:6]}-{d['class_name']}-{len(formatted_nodes)}",
                "type": d["class_name"],
                "confidence": d["confidence"],
                "bbox_normalized": d["bbox_normalized"],
                "label": ""
            })
            
        return {
            "status": "complete",
            "modelUsed": model_used,
            "diagram": diagram,
            "nodes": formatted_nodes
        }
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as err:
        print(f"[Detect Error] Inference failed: {err}")
        raise HTTPException(status_code=500, detail="Inference processing failed.")
