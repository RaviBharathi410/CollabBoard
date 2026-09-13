# CollabBoard Hybrid AI Pipeline

This document outlines the machine learning pipeline, training stages, ONNX model exports, active learning cycles, and containerized deployment.

## Pipeline Quick Start

### 1. Generate Training Data

Setup the Python virtual environment and run synthesis/augmentation scripts:
```bash
pip install -r ml/requirements.txt
python ml/scripts/generate_synthetic.py --n-images 5000
python ml/scripts/augment.py --input-dir ml/datasets/synthetic --output-dir ml/datasets/processed_augmented --multiplier 3
```

### 2. Run the Full Multi-Stage Training Pipeline

Orchestrate the 6-stage YOLOv8 curriculum training pipeline:
```powershell
# In PowerShell:
./ml/run_pipeline.ps1
```
This script trains the model progressively on general visual shapes, specialized diagram schemas, hand-drawn datasets, RICO UI components, and custom user sketch annotations. It then exports the final model to ONNX format and quantizes it to INT8 at:
- Pipeline export target: `ml/browser_models/collabboard_int8.onnx` ← this is what `detect.py` and the Docker image use
- Browser bundle: `public/models/collabboard_int8.onnx` ← copy this manually for the Vite dev server to serve it
- Class labels: `public/models/classes.json` (11 classes, order must match `inference.py:CLASSES`)

> **Note on PaddleOCR:** `ml/scripts/train_ocr.py` and `ml/scripts/export_onnx.py` contain a PaddleOCR fine-tuning and export path. This is **not connected** to the current FastAPI inference server — `ONNXDiagramDetector` in `inference.py` uses only the YOLOv8 ONNX model and infers text labels from proximity heuristics. PaddleOCR integration is a known follow-up item, not a current dependency.

### 3. Start the Inference Server locally

```bash
cd inference-api
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

---

## Deploying the Full Stack via Docker

You can spin up the entire production-ready containerized environment with a single command. 

Ensure you have a populated local `.env` file at the root, then execute:
```bash
docker-compose up --build
```

This brings up:
1. **`backend`**: Node.js/Express API server and Hocuspocus multiplayer WebSocket server (ports `3001` and `1234`).
2. **`inference`**: Lightweight FastAPI ONNX inference service (port `8000`).
3. **`frontend`**: Built React frontend served statically via Vite preview server (port `5173`).

### Volume Persistence
User active-learning correction logs and images are automatically saved to a named docker volume `collabboard_feedback_data` (mapped inside the backend container to `/app/ml/datasets/feedback`) to prevent data loss.

---

## Active Learning Loop

The active learning retrainer extracts corrections submitted from the frontend interface:
```bash
python ml/scripts/active_learning.py
```
- Corrections are saved via `POST /api/feedback` into `ml/datasets/feedback/`.
- Valid user action categories: `["correction", "relabel", "retype", "delete"]`.
- Local model run telemetry is logged to `inference-api/logs/inference.jsonl`.
- If the count of corrected or low-confidence samples exceeds `RETRAIN_THRESHOLD` (500), `active_learning.py` writes a `.retrain_trigger` flag to kick off automated pipeline retraining.

---

## Natural Language to Diagram Pipeline (Flan-T5)

In addition to vision sketch detection, CollabBoard features a local text-to-diagram sequence-to-sequence model powered by a fine-tuned `google/flan-t5-small`.

### 1. Dataset Generation
Generates synthetic prompt-to-JSON pairs across Flowcharts, Cloud Architectures, Sequence Diagrams, Mindmaps, Class Diagrams, and ERDs:
```bash
python ml/scripts/generate_nlp_diagrams.py --output ml/datasets/nlp_diagrams
```
This merges domain-curated examples from `ml/datasets/nlp_diagrams/seed/seed.jsonl` with structured templates.

### 2. Fine-Tuning
```bash
python ml/scripts/train_nlp_model.py \
  --data ml/datasets/nlp_diagrams \
  --output ml/exports/nlp_model \
  --model google/flan-t5-small \
  --epochs 1 \
  --batch 4
```
- **Precision note:** Training is executed in FP32 on NVIDIA Turing GPUs (e.g. GTX 1650 4GB) to prevent attention-layer gradient underflow (`grad_norm: nan`).
- **Tokenizer handling:** Rust-backed tokenizers map invalid generation IDs (`< 0`) to `pad_token_id` before calling `batch_decode`.

### 3. Evaluation & Benchmarking
```bash
# Evaluate on the original 15-prompt baseline set
python ml/scripts/eval_nlp_model.py --model_dir ml/exports/nlp_model --eval_set original15

# Comprehensive 30-prompt evaluation across 6 distinct diagram categories
python ml/scripts/eval_nlp_model.py --model_dir ml/exports/nlp_model --eval_set expanded30
```
- **Robust JSON Reconstruction:** Small generative models can omit outer braces `{}` or bracket terminators. `repair_and_parse_diagram()` applies multi-stage structural healing (adding `{`, closing dangling node lists, and parsing valid nodes & edges), boosting parse success dramatically.

### 4. Computed Sequence Confidence vs Memorized Tokens
Early iterations of the synthetic dataset included a hardcoded `confidence` field (e.g. `random.uniform(0.88, 0.98)`). In production, memorized confidence is discarded and replaced with **true sequence log-probability**:

$$\text{Confidence} = \exp\left( \frac{1}{N} \sum_{i=1}^{N} \log P(t_i \mid t_{<i}) \right)$$

- Evaluated during inference using `model.generate(..., output_scores=True, return_dict_in_generate=True)`.
- Softmax is applied to transition logits at each token step.
- The average transition log-probability is exponentiated to obtain a normalized $[0, 1]$ scalar.
- This computed value overwrites any raw string `confidence` in the decoded JSON payload.

### 5. Runtime Graph Auto-Healing (`sanitize_and_heal_graph`)
Seq2Seq outputs can generate semantically plausible labels while hallucinating invalid graph topologies (e.g. pointing edges to non-existent nodes, omitting node labels, or creating disconnected graphs). Rather than failing the request, `sanitize_and_heal_graph()` performs defensive post-processing:

1. **ID Sanitization & Node Label Fallback:** Ensures every node has a unique `id` and a fallback `label` (e.g. `Step 1`).
2. **Phantom Edge Pruning:** Any directed edge `(from -> to)` whose endpoint is not in the node table is pruned.
3. **Orphan Stitching:** Disconnected nodes are stitched to the topological root/head node when possible.
4. **Structured Telemetry (`healingInfo`):** Returns diagnostic metadata:
   ```json
   {
     "originalEdgesCount": 4,
     "prunedEdgesCount": 1,
     "pruneRatio": 0.25,
     "synthesizedNodesCount": 0,
     "stitchedOrphansCount": 0
   }
   ```

### 6. Architectural Decision: Why Dual-Signal Routing?
Empirical evaluation revealed that **token sequence log-probability has near-zero correlation with topological graph correctness**. Small seq2seq models will generate hallucinated edge IDs with high local token confidence if the token syntax matches training distribution.

Consequently, CollabBoard uses **Dual-Signal Routing** at the API gateway (`server/ai/chatToDiagram.js`):
- **Signal 1 (Structural Correctness):** Evaluates `healingInfo`. If the phantom edge prune ratio is $\ge 0.50$ (`MAX_PRUNE_RATIO`) or a multi-node diagram has 0 valid edges, it triggers cloud fallback (`status: 'fallback', reason: 'structural_risk'`). Safe repairs (e.g. 1 prune out of 4 edges) are served directly.
- **Signal 2 (Domain Familiarity):** Evaluates sequence confidence. If $\text{confidence} < 0.88$ (`NLP_CONFIDENCE_THRESHOLD`), unfamiliar colloquial prompts trigger cloud fallback (`reason: 'low_confidence'`).

Requests passing both gates are served on-premise at $0 API cost and logged to `server/logs/ai_requests.ndjson` for telemetry and active learning.

---

## 7. Vision Model Audit, Quantization Bug & Diagram Import Architecture

### The Quantization Underflow Discovery (`collabboard_int8.onnx`)
During a comprehensive audit of the Diagram Import pipeline, a critical root-cause defect was identified in `ml/browser_models/collabboard_int8.onnx` (dating back to its initial commit `a73eae3` on June 9, 2026):
- **Mechanism:** `ml/scripts/quantize_int8.py` executed dynamic quantization (`quantize_dynamic(..., weight_type=QuantType.QUInt8)`) directly across all YOLOv8 layers without excluding the final classification head (`nodes_to_exclude`).
- **Impact:** The classification head (`model.22.cv3.2.2.bias`) retained a large negative focal-loss initialization bias of **-6.78125**, while the quantized weight scales were collapsed to $\approx 10^{-4}$. As a result, all pre-sigmoid logits collapsed to $\approx -6.78$, causing the sigmoid class probabilities to clamp at $\le 0.00125$ across every input image tested (including synthetic sketches, real whiteboard photos, and the original AI2D dataset).
- **Silent Masking:** Because the client application (`useAIEngine.js`) and server (`server/ai/vision.js`) were engineered with an automated cloud fallback tier (`/api/enhance` invoking GPT-4o and Gemini Flash), every local detection failure silently fell through to cloud vision. End users saw high-quality diagrams, but the local ONNX vision tier was 100% inactive in practice.

### Two-Tier Local Vision & OCR Architecture
To establish a genuinely functional, zero-cloud local pipeline:
1. **Tier 1 (Neural Model):** `ONNXDiagramDetector` is probed first. Any model whose confidence falls below threshold is bypassed without blocking.
2. **Tier 2 (Active Primary Local Strategy — Classical Computer Vision):**
   - Implemented in `inference-api/import_pipeline/detect_shapes.py`.
   - Uses adaptive Gaussian thresholding (`cv2.adaptiveThreshold`), contour hierarchy topological analysis, Ramer-Douglas-Peucker polygon approximation (`approxPolyDP`), and Probabilistic Hough Line Transforms (`cv2.HoughLinesP`).
   - Achieves **80.5% Node Precision, 87.5% Node Recall, 91.5% Edge Precision, and 100.0% Edge Recall** across a challenging 10-image benchmark (incorporating 11.5° perspective skew, harsh lighting glare, and noise).
   - Honestly surfaced limitations: struggles on freehand handwritten strokes (33.3% precision) and densely nested ERD table rows (50.0% precision).
3. **Local Neural OCR:**
   - Powered by `EasyOCR` (PyTorch CRAFT detector + CRNN recognizer) running locally on CPU.
   - Extracts bounding boxes and text strings with **93.3% OCR label match rate** across the 10-image suite.
   - Falls back gracefully to morphological gradient text candidate extraction if dependencies are unavailable.

### Structured vs. Image Separation Discipline
- **Structured files (`.drawio`, Mermaid `.mmd`, `.svg`)** are parsed with 100% deterministic AST extraction in Node.js, yielding **100.0% Node/Edge precision**.
- **Image inputs (whiteboard photos, screenshots)** are handled by the probabilistic vision & OCR pipeline.
- Metrics between the two are **never blended into a single composite accuracy score**.

