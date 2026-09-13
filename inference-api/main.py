import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import detect
from routes import nlp
from routes import import_diagram
import nlp_model

app = FastAPI(title="CollabBoard Inference API", version="1.0.0")

# Configure CORS dynamically from ALLOWED_ORIGINS env variable
allowed_origins_str = os.getenv(
    "ALLOWED_ORIGINS", 
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3001,http://127.0.0.1:3001"
)
origins = [origin.strip() for origin in allowed_origins_str.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register the detection routes
app.include_router(detect.router)

# Register the NLP text-to-diagram route
app.include_router(nlp.router)

# Register diagram import pipeline route
app.include_router(import_diagram.router)

@app.on_event("startup")
async def startup_event():
    """Load both models once when the FastAPI process starts."""
    # NLP model (fine-tuned flan-T5)
    nlp_model_path = os.getenv("NLP_MODEL_PATH", "ml/exports/nlp_model")
    nlp_model.load_nlp_model(nlp_model_path)


@app.get("/health")
async def health():
    # Return loading status of both models
    detector_loaded = detect.detector is not None
    nlp_loaded = nlp_model.is_loaded()
    overall = "ok" if detector_loaded else ("nlp_only" if nlp_loaded else "degraded")
    return {
        "status": overall,
        "model_loaded": detector_loaded,
        "onnx_model_path": detect.MODEL_PATH,
        "nlp_model_loaded": nlp_loaded,
        "nlp_model_path": nlp_model.get_model_path(),
    }

if __name__ == "__main__":
    import uvicorn
    # Bind to port 8000
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
