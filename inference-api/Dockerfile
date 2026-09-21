FROM python:3.11-slim

WORKDIR /app

# Install system dependencies if needed (e.g. libglib2.0 for opencv/onnx runtime, libgomp1 for OpenMP)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*


# Copy requirements from the build context
COPY inference-api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy FastAPI source code
COPY inference-api/ /app/

# Copy the quantized ONNX model from the pipeline output location.
# run_pipeline.ps1 writes to ml/browser_models/. The public/models/ directory
# is a separate deploy step; do not conflate the two paths.
COPY ml/browser_models/collabboard_int8.onnx /app/ml/browser_models/collabboard_int8.onnx

# Copy fine-tuned NLP model weights (pre-baked into the image).
# The docker-compose nlp_model volume overrides this directory at runtime
# with fresher weights after a training run. If the directory doesn't exist
# yet (training hasn't run), the service starts in degraded mode and the
# /nlp-to-diagram route returns 503 until weights are available.
# Ensure export directory exists for runtime caching or HF downloads
RUN mkdir -p /app/ml/exports/nlp_model

# Let the NLP model loader know where to find weights (falls back to HF Hub if empty)
ENV NLP_MODEL_PATH=google/flan-t5-small
ENV HF_MODEL_ID=google/flan-t5-small

EXPOSE 8000

# Execute uvicorn server binding to Render's $PORT (or 8000 default)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]

