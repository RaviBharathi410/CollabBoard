# CollabBoard AI — Setup & Run

## Hybrid Pipeline (Recommended Flow)

### 1. Vision Diagram Flow (Sketch -> Diagram)
- **Status:** **Cloud-First (GPT-4o & Gemini Flash)**.
- **Architectural Background:** The legacy in-browser and FastAPI INT8 ONNX vision models were formally retired after a dedicated audit discovered a pre-existing quantization underflow defect in `collabboard_int8.onnx` (dating back to commit `a73eae3` on June 9, 2026), where all classification logits were frozen at $\approx -6.78$.
- **Step 1:** The frontend sends an image base64 canvas snapshot to the Express backend (`/api/enhance`).
- **Step 2:** The request is routed directly to the production LLM vision fallback chain (primary: OpenAI GPT-4o, secondary: Gemini 2.0 Flash) using strict Zod schema validation.
- **Step 3:** The returned structured diagram is verified, optionally checked for ambiguities (`ClarificationPopup`), and applied to the collaborative canvas.

### 2. Diagram Import Flow (Structured Files & Images)
- **Track A (Structured Files - Deterministic):** `.drawio`, Mermaid `.mmd`, and `.svg` files are parsed deterministically in Node.js with 100% precision and zero ML overhead.
- **Track B (Whiteboard & Architecture Images - Local Probabilistic):** Images sent to `POST http://localhost:8000/import-image` run through a two-tier local pipeline:
  - *Preprocessing:* Auto-crop, Hough deskewing, CLAHE lighting normalization, and bilateral filtering.
  - *Detection:* Adaptive Gaussian thresholding, contour hierarchy, and Hough lines (Classical CV achieving 80.5% node precision).
  - *OCR:* Local PyTorch `EasyOCR` extracting labels with a 90.0% match rate.
  - *Reconstruction & Healing:* 2D spatial containment matching and graph auto-healing.

### 2. NLP Diagram Flow (Text -> Diagram)
- **Step 1:** The user enters a natural language diagram prompt in the Context Drawer or chat interface.
- **Step 2:** The frontend sends the prompt to Express (`POST /api/chat-to-diagram`).
- **Step 3:** The Express backend queries the local fine-tuned Flan-T5 model (`POST http://localhost:8000/nlp-to-diagram`).
- **Step 4:** The FastAPI inference server uses HuggingFace Transformers, computes true sequence confidence via $\exp(\frac{1}{N} \sum \log P(t_i \mid t_{<i}))$, and runs runtime graph auto-healing (`sanitize_and_heal_graph`) to prune hallucinated phantom edges and stitch orphan nodes, emitting `healingInfo` telemetry.
- **Step 5 (Dual-Signal Routing):** Express evaluates two independent signals before serving the diagram:
  - **Signal 1: Structural Risk Assessment (Correctness)** — Checks `healingInfo`. If phantom prune ratio $\ge 0.50$ (`MAX_PRUNE_RATIO`) or a multi-node diagram has 0 valid edges, it triggers fallback `{ status: 'fallback', reason: 'structural_risk' }`. Minor safe repairs (e.g. 1 prune on a 4-node graph) pass through cleanly.
  - **Signal 2: Domain Familiarity Assessment (Fluency)** — Checks token sequence confidence. If $\exp(\text{mean}(\log p)) < 0.88$ (`NLP_CONFIDENCE_THRESHOLD`), it catches unfamiliar colloquial prompts and triggers fallback `{ status: 'fallback', reason: 'low_confidence' }`.
- **Step 6:** Requests passing both signals are served instantly on-premise at $0 API cost (`status: 'ok'`). Any failed or low-confidence request is automatically logged to `server/logs/ai_requests.ndjson` and transparently escalated to the cloud LLM (`/api/ask`).
- **Step 7 (Live Observability):** An admin telemetry dashboard is available at `/admin/ai-stats`, visualizing local vs fallback rates, latency splits, real-time fallback reasons, and auditable cost savings.

### Terminal 1 — FastAPI Inference Service (Port 8000)

```bash
npm run dev:inference
```
*(Runs: `cd inference-api && uvicorn main:app --reload --port 8000`)*

### Terminal 2 — Hocuspocus + Express API Backend (Ports 1234 + 3001)

```bash
npm run server
```

### Terminal 3 — Frontend React Client (Port 5173 / Port 4173 Preview)

```bash
npm run dev
```

---

## Required Environment Variables

Configure these settings inside your local `.env` file at the project root:

| Variable | Where | Purpose | Default |
|----------|--------|---------|---------|
| `OPENAI_API_KEY` | `.env` (server) | Enhance fallback (primary LLM: `gpt-4o`) + Ask | Required for cloud fallback |
| `GEMINI_API_KEY` | `.env` (server) | Enhance fallback (secondary LLM: `gemini-2.0-flash`) | Optional fallback |
| `CONFIDENCE_THRESHOLD` | `.env` (server) | Vision sketch detection confidence threshold | `0.85` |
| `NLP_CONFIDENCE_THRESHOLD` | `.env` (server) | Text-to-diagram prompt familiarity threshold ($\exp(\text{mean}(\log p))$) | `0.88` |
| `MAX_PRUNE_RATIO` | `.env` (server) | Max allowed phantom edge prune ratio before triggering structural risk fallback | `0.50` |
| `AI_REQUESTS_LOG_FILE` | `.env` (server) | Optional override for NDJSON AI request log location | `server/logs/ai_requests.ndjson` |
| `ALLOW_UNAUTHENTICATED` | `.env` (server) | Set to `true` in dev mode to bypass Firebase JWT verification | `true` in dev |
| `ALLOWED_ORIGINS` | `.env` (server) | Allowed CORS origins (e.g. `http://localhost:5173`) | `http://localhost:5173` |
| `VITE_FIREBASE_*` | `.env` (client) | Firebase Web Client configurations | Firebase app config |
| `FIREBASE_SERVICE_ACCOUNT` | `.env` (server) | Firebase Admin credentials for saving Yjs binary state | Service account JSON |
| `VITE_WS_URL` | `.env` (client) | WebSocket URL for collaborative canvas | `ws://localhost:1234` |
| `VITE_INFERENCE_API_URL` | `.env` (client) | FastAPI base URL for browser ONNX preview | `http://localhost:8000` |
| `INFERENCE_API_URL` | `.env` (server) | FastAPI base URL for Express backend → FastAPI calls | `http://localhost:8000` |
| `VITE_API_URL` | `.env` (client) | Express API url | `http://localhost:3001` |

---

## API Routes (Express Backend Port 3001)

All mutating/heavy endpoints require `Authorization: Bearer <Firebase_ID_Token>` headers, unless `ALLOW_UNAUTHENTICATED=true` is set in development.

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| GET | `/api/health` | No | API health, model availability, and fallback states |
| GET | `/api/admin/ai-stats/raw` | Yes | Observability: stream recent request records from NDJSON log (`?limit=N`) |
| GET | `/api/admin/ai-stats/summary` | Yes | Observability: aggregated metrics (local served %, latency split, auditable cost savings, fallback triggers) |
| POST | `/api/enhance` | Yes | Sketch base64 image → structured diagram (YOLOv8 ONNX + LLM fallback) |
| POST | `/api/chat-to-diagram` | Yes | Natural language prompt → structured diagram (Flan-T5 + Dual-Signal routing) |
| POST | `/api/clarify` | Yes | Submit clarification answers for ambiguous nodes |
| POST | `/api/ask` | Yes | Chat stream (SSE) query regarding the diagram |
| POST | `/api/suggest` | Yes | Layout variation suggestions |
| POST | `/api/feedback` | Yes | Active learning: submit user correction details (`correction`, `relabel`, `retype`, `delete`) |

---

## Deploy Firestore Rules

If using Firestore for board persistence:
```bash
firebase deploy --only firestore:rules
```
Rules file: `firestore.rules` (configures `/boards_meta` collection access for client owners).
