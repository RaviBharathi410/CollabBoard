# CollabBoard AI — Setup & Run

## Hybrid pipeline (recommended)

The primary AI path uses a **custom-trained YOLOv8 ONNX model** (browser preview + FastAPI server), with LLM refinement only when confidence is low.

See **[ML_PIPELINE.md](./ML_PIPELINE.md)** for training, export, and deployment.

**Terminal 1 — FastAPI inference (port 8000):**

```bash
npm run dev:inference
```

**Terminal 2 — Hocuspocus + legacy Express (ports 1234 + 3001):**

```bash
npm run server
```

**Terminal 3 — frontend:**

```bash
npm run dev
```

Vite proxies `/api` → `http://localhost:8000` by default (`VITE_PROXY_TARGET`).

## Legacy cloud-only path

**Terminal 1 — backend (AI + multiplayer + Firestore sync):**

```bash
npm run server
```

**Terminal 2 — frontend:**

```bash
npm run dev
```

**Or both in one terminal:**

```bash
npm run dev:all
```

Set `VITE_PROXY_TARGET=http://localhost:3001` to use Express vision routes only.

## Required environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `OPENAI_API_KEY` | `.env` (server) | Enhance (primary) + Ask |
| `GEMINI_API_KEY` | `.env` (server) | Enhance fallback |
| `VITE_FIREBASE_*` | `.env` (client) | Auth + dashboard |
| `FIREBASE_SERVICE_ACCOUNT` | `.env` (server) | Canvas persistence |
| `VITE_WS_URL` | `.env` (optional) | WebSocket URL, default `ws://localhost:1234` |
| `VITE_INFERENCE_API_URL` | `.env` (client) | FastAPI base (default `http://localhost:8000`) |
| `VITE_API_URL` | `.env` (client) | Legacy Express fallback |
| `VITE_PROXY_TARGET` | `.env` (Vite) | Dev proxy target for `/api` |
| `ONNX_MODEL_PATH` | inference-api | Trained diagram detector ONNX |
| `ROBOFLOW_API_KEY` | ML scripts | External dataset import |

In dev, the Vite proxy forwards `/api/*` → inference API (8000) unless `VITE_PROXY_TARGET` points to 3001.

## Verify

```bash
curl http://localhost:3001/api/health
```

Expect `"openai": true` and/or `"gemini": true`.

## API routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/enhance` | Sketch → structured diagram |
| POST | `/api/clarify` | Answer clarification question |
| POST | `/api/ask` | SSE streaming Q&A |
| POST | `/api/suggest` | Layout variation suggestions |
| POST | `/api/feedback` | Active learning corrections |
| GET | `/api/health` | Model availability |

## Deploy Firestore rules

```bash
firebase deploy --only firestore:rules
```

Rules file: `firestore.rules` (collection `boards_meta` for clients, `boards` for server only).
