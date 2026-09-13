# CollabBoard: Portfolio & Technical Interview Guide

This guide provides high-impact resume bullets, a comprehensive architectural narrative, and technical interview defense questions covering the design, implementation, and empirical validation of CollabBoard.

---

## 1. Resume Bullets (Tailored for Senior / Staff / AI Systems Roles)

### Option A: AI Systems & Full-Stack Focus
* **Architected a real-time collaborative canvas (React 19, Yjs CRDTs, Hocuspocus WebSockets)** supporting 500 concurrent connections across multi-room workspaces with sub-40ms local propagation and conflict-free transactional state synchronization.
* **Engineered a hybrid AI diagram engine** combining a fine-tuned `google/flan-t5` sequence model for natural language generation, a dual-track diagram import engine (deterministic AST parsers at 100% precision + local classical CV and EasyOCR at 80.5% precision / 90.0% OCR match), and a cloud-first vision sketch pipeline; uncovered and documented the silent failure of a legacy INT8 ONNX vision export masked by cloud fallback.
* **Designed a dual-signal fallback routing mechanism** that decouples linguistic fluency from structural correctness; empirically proved that token log-probability confidence has near-zero correlation with graph topology ($r \approx -0.002$), routing to cloud LLMs (GPT-4o / Gemini Flash) based on structural edge prune ratios.
* **Implemented MLOps production hardening with an automated hard regression gate** ($candidate \ge baseline$) blocking model promotion on any composite score degradation; built PII-sanitized drift logging, a 5-minute sliding-window anomaly alert monitor, and grew test coverage to 54.6% across 191 Vitest, 16 Pytest, and 7 Playwright E2E browser tests.

### Option B: Machine Learning & MLOps Focus
* **Fine-tuned and deployed `google/flan-t5-small` for natural language text-to-diagram generation** in a FastAPI microservice; implemented mathematical sequence confidence scoring derived directly from normalized transition log-probabilities ($\exp(\frac{1}{N}\sum \log P)$).
* **Built an active learning retraining pipeline with automated quality regression gating** ($0.4 \cdot \text{JSON} + 0.4 \cdot \text{Conn} + 0.2 \cdot (1 - \text{Healing})$); enforced strict candidate promotion safety, blocking regressed candidates (-13.7%) while promoting verified improvements (+3.3%).
* **Developed a production observability and rolling drift detector** with automated PII masking (emails, credit cards, phones, IPs); built an auditable cost-savings engine dynamically derived from token profiles and published pricing.
* **Established full-lifecycle testing infrastructure** including multi-process Playwright browser orchestration, automated Firebase RBAC invite workflows, and 3-tier graceful degradation integration testing with structured 502 circuit-breaking.

---

## 2. "How I Built and Validated This" — The Narrative

### The Problem
Most AI-powered canvas and whiteboard demos are "happy-path prototypes." They query an unconstrained cloud LLM with unstructured prompts, hardcode arbitrary confidence scores (e.g., `0.92`), and fail completely when network connectivity drops or the model generates hallucinated, malformed JSON. Furthermore, typical collaborative tools either lack real-time CRDT guarantees or leak unauthenticated access and sensitive user data into unmonitored logs.

### The Architectural Breakthrough: The Dual-Signal Router
When integrating local fine-tuned language models (`google/flan-t5-small`) for diagram synthesis, I originally computed model confidence via normalized sequence token log-probabilities. However, rigorous empirical testing across multi-domain prompt benchmarks revealed a counter-intuitive finding: **mathematical token confidence has virtually zero correlation with topological graph validity ($r \approx -0.0026$)**. The model generates phantom edges (e.g., connecting nodes that do not exist) with high token confidence because the individual tokens (`"source"`, `"target"`, `"e1"`) are linguistically natural in sequence.

To solve this, I designed the **Dual-Signal Fallback Router**:
1. **Topological Structural Signal**: A runtime graph auto-healing pass inspects node degrees and phantom connectors. If the edge prune ratio exceeds 50% or a multi-node diagram contains zero valid edges, the request is immediately escalated to cloud LLMs.
2. **Linguistic Confidence Signal**: If topological validity passes, the mathematical sequence log-probability is checked against an empirical threshold ($\ge 0.88$).

### Production Hardening & MLOps
Rather than stopping at a working demo, I subjected the platform to rigorous production hardening:
- **Zero-Bypass Security**: Added a hard boot-refusal assertion that aborts the server if `ALLOW_UNAUTHENTICATED=true` is set in production.
- **Role-Based Access Control**: Built full collaborator invitation flows (`ShareModal.jsx`) supporting Editor and Viewer roles enforced via Firestore and UI state.
- **Hard MLOps Regression Gate**: Enforced that candidate fine-tuned models must score $\ge$ baseline across JSON validity, connectivity, and graph healing before promotion to production.
- **Autonomous E2E Lifecycle**: Configured Playwright with a multi-process `webServer` harness that spins up both the backend API/WebSocket server and Vite frontend with health checks, allowing unattended execution in CI.

---

## 3. Interview Defense & Technical Q&A

### Q1: "How do you know your NLP diagram model actually works?"
> **Answer**:  
> "I validate it on two distinct layers: linguistic familiarity and topological graph correctness.  
> First, for linguistic familiarity, we extract the actual sequence transition scores from HuggingFace/PyTorch using `compute_transition_scores` and compute the geometric mean of token probabilities: $\exp(\frac{1}{N}\sum \log P(t_i \mid t_{<i}))$. This guarantees the confidence reflects true token uncertainty rather than a hallucinated JSON property.  
> Second, because empirical testing proved that Flan-T5 can generate phantom edges with high token probability, we run our deterministic `sanitize_and_heal_graph` algorithm. It verifies that every edge maps to an existing node ID, eliminates self-loops, and stitches orphan nodes. If more than 50% of the edges must be pruned, the router flags topological defect and escalates to our cloud fallback chain."

### Q2: "What happens if the local inference service goes down or crashes?"
> **Answer**:  
> "We implemented a 3-tier graceful degradation protocol verified with integration tests:  
> 1. **Primary**: The Express backend sends the prompt to the local Python inference microservice (`http://127.0.0.1:8000/nlp-to-diagram`) with a strict 3-second timeout.  
> 2. **Secondary Fallback**: If the local service times out or throws `ECONNREFUSED`, the request immediately cascades to OpenAI GPT-4o (or Gemini 2.0 Flash) with the identical structural schema.  
> 3. **Circuit Breaking / 502 Total Outage**: If cloud APIs also fail or credentials are unavailable, the backend catches the error and returns a clean, structured JSON 502 error (`{ status: 'error', code: 'BOTH_MODELS_FAILED' }`). The frontend receives this and renders a non-blocking toast warning allowing user retry, preventing unhandled promise rejections or white-screen crashes."

### Q3: "What is your test coverage, and what is still not covered?"
> **Answer**:  
> "Our test suite currently has **194 passing Vitest unit/integration tests (across 32 suites)**, **15 passing Firestore Emulator security rules tests** (via `@firebase/rules-unit-testing`), **17 passing Pytest tests** (12 inference + 5 active learning), and **7 passing Playwright E2E browser tests**, yielding **54.61% overall line coverage** measured with v8.  
> - **Fully covered (85%–100%)**: Core Zustand store, Yjs CRDT synchronization, undo/redo stacks, security boot validators, dual-tier rate limiting, error monitoring, server-side RBAC derivation, and the Share/RBAC modal.  
> - **What is intentionally not covered / left for unit isolation**: Raw WebAssembly binary internal loops in `onnxruntime-web` (mocked in unit tests, verified via E2E), third-party Firebase SDK network transport internals, and non-interactive marketing pages (`LandingPage.jsx`)."

### Q4: "How do you prevent model quality regressions when retraining on active learning data?"
> **Answer**:  
> "We built an MLOps hard regression gate into `active_learning_retrain.py`. We harvest user corrections via `POST /api/feedback` and sanitize real user prompts for PII (masking emails, credit cards, phones, and IPs).  
> Before any new model checkpoint can be promoted to production, the candidate model is evaluated on a standardized golden validation set against the running baseline using our composite score:  
> $$\text{Composite Score} = 0.4 \times \text{JSON} + 0.4 \times \text{Conn} + 0.2 \times (1 - \text{Healing})$$  
> If $\text{candidate\_score} < \text{baseline\_score}$, the gate immediately blocks promotion with an exit code 1 and writes an audit rejection report (`.retrain_gate_report.json`). We proved this gate in CI by verifying that an intentionally degraded candidate (-13.68%) was rejected while a superior candidate (+3.32%) was approved."

### Q5: "What are the limitations of your load testing benchmark?"
> **Answer**:  
> "I maintain strict transparency regarding our load testing provenance:  
> Our 500-client concurrent WebSocket benchmark was run using a custom Node.js test harness (`run_ws_load.mjs`) on localhost loopback. While it confirmed 100% connection completion and sub-40ms CRDT document mutation propagation, it reflects local IPC throughput rather than real-world WAN network latency. We also created standard k6 scripts (`k6_http.js` and `k6_websocket.js`), but I explicitly document in the project runbook that k6 was not executed in this environment, avoiding unverified performance claims."

### Q6: "How do you enforce role-based access control (RBAC) server-side rather than relying on client-side UI hiding, and how do you know the rules actually hold?"
> **Answer**:  
> "Client-side `readOnly` flags and conditional button rendering are UX affordances, not security boundaries. Any malicious client can modify browser JS state or send direct write requests to Firestore.  
> We enforce and prove our security boundary at two levels:  
> 1. **Server-Side Enforcement Engine (`firestore.rules`)**:
>    - **Owner-Only Deletion & Permissions**: Document deletion and permission list modifications require `request.auth.uid == resource.data.ownerId`.
>    - **Editor Scoping**: Users with the `editor` role can update mutable document properties (like `title`), but the rules strictly pin `ownerId`, `sharedWith`, `editors`, and `viewers` to their existing values (`request.resource.data.editors == resource.data.editors`), preventing privilege escalation.
>    - **Viewer Rejection**: Direct write attempts from users with the `viewer` role are blocked unconditionally.
>    - **Admin-Only Yjs Binary State**: `/boards/{boardId}` is locked with `allow read, write: if false`, ensuring collaborative canvas binary states can only be accessed via our authenticated WebSocket server Admin SDK.  
> 2. **Single Source of Truth Mathematical Invariant**:
>    - Rather than managing separate lists, `deriveRoleLists(sharedWith)` normalizes and deduplicates collaborator emails, enforcing that $\text{editors} \cap \text{viewers} = \emptyset$ and $\text{editors} \cup \text{viewers} = \text{sharedEmails}$. Every write path (`createBoard`, `shareBoard`) derives and writes all fields atomically.
> 3. **Terminal-Verified Emulator Rules Testing (`npm run test:rules`)**:
>    - We do not rely on logical reasoning alone. We wrote a 15-test suite using `@firebase/rules-unit-testing` executed against the local Google Cloud Firestore Emulator (`cloud-firestore-emulator-v1.22.0.jar`).
>    - We directly verified that the Firestore engine issues gRPC Code 7 `PERMISSION_DENIED` errors when a viewer attempts an `updateDoc`, when an editor attempts to tamper with the `editors` array or rewrite `ownerId`, when an uninvited user attempts a read, and when any client attempts direct access to `/boards/{boardId}`."

### Q7: "Tell me about a time you audited an ML pipeline and discovered a silent failure mode in production."
> **Answer**:  
> "During an audit of our Diagram Import and sketch detection features, I investigated why our local browser ONNX detector (`collabboard_int8.onnx`) was repeatedly returning zero detections.  
> Digging into the raw model graph using ONNX inspector tools, I discovered that **the model had been silently non-functional across the entire project history** (dating back to its initial export commit on June 9, 2026). The dynamic quantization script had quantized the YOLOv8 classification head without excluding it (`nodes_to_exclude`). This preserved a large negative focal-loss initialization bias (-6.78125) while collapsing the quantized weight scale to $10^{-4}$, freezing pre-sigmoid logits at $\approx -6.78$. As a result, the maximum possible sigmoid class confidence was mathematically bounded at $\approx 0.00125$ across all inputs. Any confidence threshold ever used (0.05, 0.25, 0.30) filtered out 100% of detections.  
> **Why was this never noticed?** Because our system was architected with an automated cloud fallback tier (`/api/enhance` invoking GPT-4o / Gemini Flash), every empty local detection silently fell through to cloud vision. The cloud tier produced beautiful diagrams, masking the dead local tier completely.  
> **How I resolved it**:  
> 1. Rather than papering over the broken neural weights or making false claims, I named the issue transparently and redesigned the local architecture into a two-tier strategy.  
> 2. I established **Classical Computer Vision** (adaptive Gaussian thresholding, contour hierarchy analysis, `approxPolyDP`, and Hough lines) as our active, reliable primary local detection engine (`detect_shapes.py`).  
> 3. I integrated local neural OCR using `EasyOCR` (PyTorch CRAFT + CRNN), jumping our real-pixel OCR match rate from 0% to 93.3%.  
> 4. In our 10-image benchmark (spanning 11.5° perspective tilt, lighting glare, shadows, and sketches), I proved the classical CV engine achieves 80.5% node precision and 91.5% edge precision, while honestly publishing its specific failure modes on freehand handwritten strokes (33.3%) and dense ERD table rows (50.0%)."

---

## 4. Production Deployment Guide (Free-Tier & Cloud Recipes)

### Architecture Deployment Topology
```
[Vercel / Netlify]              [Render / Railway / Fly.io]           [Hugging Face Spaces / Fly.io]
Frontend Client (React Vite)    Node.js Express + Hocuspocus WS       FastAPI Inference Service
Port: 443 (HTTPS)               Port: 3001 (API) + Port: 1234 (WSS)   Port: 8000 (Python PyTorch / ONNX)
```

### 1. Backend & WebSocket Service (Render / Railway)
- **Environment Variables**:
  - `PORT=3001`
  - `HOCUSPOCUS_PORT=1234`
  - `NODE_ENV=production`
  - `ALLOW_UNAUTHENTICATED=false`
  - `FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}`
  - `INFERENCE_SERVICE_URL=https://your-inference-space.hf.space`
  - `OPENAI_API_KEY=sk-...`
  - `ALLOWED_ORIGINS=https://your-collabboard.vercel.app`
- **Build Command**: `npm install`
- **Start Command**: `npm run server`

### 2. Frontend Client (Vercel)
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**:
  - `VITE_API_BASE=https://your-backend.onrender.com`
  - `VITE_WS_URL=wss://your-backend.onrender.com:1234`
  - `VITE_FIREBASE_API_KEY=...`

### 3. FastAPI Inference Service (Hugging Face Spaces)
- **SDK**: Docker
- **Hardware**: Free 2 vCPU / 16GB RAM or T4 GPU
- **Docker Command**: `uvicorn main:app --host 0.0.0.0 --port 7860`
