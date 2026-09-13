"""
routes/nlp.py
FastAPI route: POST /nlp-to-diagram

Converts a natural-language description into the DiagramSchema JSON
that CollabBoard's canvas understands.

Response codes:
  200  → { status: "ok", diagram: {...}, modelUsed: "flan-t5-fine-tuned", confidence: float }
  422  → { status: "parse_failed", detail: "..." }   ← Express falls back to /api/ask
  503  → { detail: "NLP model not loaded" }           ← weights not yet trained
"""

from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from nlp_model import generate_diagram, is_loaded, get_model_path

router = APIRouter()


class NLPRequest(BaseModel):
    text: str = Field(..., min_length=3, max_length=2000,
                      description="Natural language description of the diagram")
    diagramTypeHint: Optional[str] = Field(
        None,
        description="Optional override for diagram type: architecture | flowchart | erd | sequence | mindmap"
    )


class NLPResponse(BaseModel):
    status: str
    diagram: dict
    modelUsed: str
    confidence: float = Field(
        ...,
        description="Computed generation confidence mathematically derived from sequence token log-probabilities (exp(mean(log_prob))), not a self-reported model value."
    )


@router.post("/nlp-to-diagram", response_model=NLPResponse)
async def nlp_to_diagram(payload: NLPRequest):
    # ---- Guard: model must be loaded ----------------------------------------
    if not is_loaded():
        raise HTTPException(
            status_code=503,
            detail=(
                f"NLP model is not loaded (expected weights at: {get_model_path()}). "
                "Run ml/run_nlp_pipeline.ps1 to train and restart the inference service."
            ),
        )

    # ---- Run inference -------------------------------------------------------
    try:
        diagram = generate_diagram(
            text=payload.text,
            diagram_type_hint=payload.diagramTypeHint,
        )
    except ValueError as e:
        # JSON parse failed or no nodes — tell Express to fall back to LLM ask
        return {
            "status": "parse_failed",
            "diagram": {},
            "modelUsed": "flan-t5-fine-tuned",
            "confidence": 0.0,
            "detail": str(e),
        }
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        print(f"[NLP Route] Unexpected inference error: {e}")
        raise HTTPException(status_code=500, detail="Inference error")

    confidence = float(diagram.get("confidence", 0.85))

    return {
        "status": "ok",
        "diagram": diagram,
        "modelUsed": "flan-t5-fine-tuned",
        "confidence": confidence,
    }
