# CollabBoard Hybrid AI Pipeline

## Quick start

### 1. Generate training data (no API keys required)

```bash
pip install -r ml/requirements.txt
python ml/scripts/generate_synthetic.py --n-images 5000
python ml/scripts/augment.py --input-dir ml/datasets/synthetic --output-dir ml/datasets/processed_augmented --multiplier 3
```

### 2. Train custom YOLOv8 diagram detector

```bash
python ml/scripts/train_detection.py --size n --epochs 150 --dataset ml/datasets/processed_augmented/dataset.yaml
python ml/scripts/validate.py
python ml/scripts/export_onnx.py
python ml/scripts/quantize.py
cp ml/models/exported/diagram_detector_int8.onnx public/models/
cp ml/models/exported/classes.json public/models/
```

### 3. Import external datasets (Roboflow)

```bash
python ml/scripts/import_datasets.py --roboflow-api-key YOUR_KEY
```

### 4. Run inference API

```bash
cd inference-api
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 5. Run full stack

```bash
npm run dev:inference   # terminal 1
npm run server          # terminal 2 (Hocuspocus + legacy Express)
npm run dev             # terminal 3
```

Or: `docker-compose up`

## Pipeline stages

1. **Browser ONNX** (`src/ai/BrowserDetector.js`) — INT8 preview on canvas
2. **Server ONNX** (`inference-api/services/onnx_runner.py`) — primary detection
3. **OCR** — PaddleOCR on text regions (optional)
4. **LLM refine** — OpenAI → Gemini when confidence < 0.85
5. **ELK layout** — client-side via `useAIEngine.js`

## Active learning

```bash
python ml/scripts/active_learning.py
```

Feedback stored via `POST /api/feedback` → `ml/datasets/feedback/`.
