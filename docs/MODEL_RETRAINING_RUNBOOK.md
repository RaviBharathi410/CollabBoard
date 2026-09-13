# Model Retraining & Weights Promotion Runbook

This runbook establishes the production operational protocol for retraining, evaluating, and safely promoting fine-tuned NLP diagram generation models (`flan-t5-small`) and vision sketch detection models (`yolov8n`).

---

## 1. Trigger Conditions

Model retraining is initiated when either of the following conditions is met:

1. **Active Learning Sample Threshold**:
   - At least **200 verified human correction records** have accumulated in:
     - `ml/datasets/nlp_diagrams/corrections/*.ndjson` (NLP user diagram edits).
     - `ml/datasets/feedback/*_feedback.ndjson` (Vision sketch relabeling/corrections).
2. **Rolling Traffic Drift Alert**:
   - The weekly or on-demand drift detector (`ml/scripts/eval_rolling_drift.py`) flags quality degradation on recent production prompts exceeding the 5% tolerance threshold.

---

## 2. Privacy & Data Governance Policy

- **Zero Unmasked PII**: All prompt text logged for rolling evaluation and retraining must pass through `sanitizePromptText` in `server/ai/requestLogger.js`.
- **Masked Patterns**:
  - Email addresses: replaced with `[EMAIL]`
  - Credit card numbers: replaced with `[CARD]`
  - Phone numbers: replaced with `[PHONE]`
  - IPv4 addresses: replaced with `[IP]`
- **Opt-Out Mechanism**: Users or environments with `LOG_PROMPT_TEXT=false` record prompt length only (`prompt_length: N`), omitting raw text entirely.

---

## 3. Retraining Execution Protocol

### Step 3a: Verify Gate Mechanics (CI Verification Mode)
To verify gating logic without expending GPU training cycles:

```bash
# Verify the gate rejects an underperforming candidate
python ml/scripts/active_learning_retrain.py --verify-gate-reject

# Verify the gate approves an improving candidate
python ml/scripts/active_learning_retrain.py --verify-gate-promote
```

> [!NOTE]
> CI verification modes use synthetic candidate distributions to confirm that regression blocking and promotion approval execute deterministically in automated pipelines.

### Step 3b: Full Retraining Run (Production Mode)
When running on training hardware (budget ~30–60 minutes on an NVIDIA GTX 1650 / T4 GPU):

```bash
# 1. Ingest accumulated corrections into training splits
python ml/scripts/active_learning_retrain.py --full --threshold 200

# 2. Execute fine-tuning curriculum
python ml/scripts/train_nlp_model.py \
  --train_path ml/datasets/nlp_diagrams/train.jsonl \
  --val_path ml/datasets/nlp_diagrams/val.jsonl \
  --output_dir ml/exports/nlp_model_candidate \
  --epochs 3 \
  --batch_size 4
```

---

## 4. The Hard Regression Gate

Promotion of candidate weights is strictly gated by `evaluate_gate` in `active_learning_retrain.py`.

### Composite Score Formula
$$\text{Score} = 0.40 \times \text{JSON Validity} + 0.40 \times \text{Connectivity} + 0.20 \times (1 - \text{Healing Rate})$$

### Gate Policy
$$\text{Candidate Score} \ge \text{Baseline Score}$$

- **Candidate Score < Baseline Score**: **Status: `REJECTED_REGRESSION`**.
  - Deployment is halted immediately.
  - `.retrain_gate_report.json` logs rejection reason and score delta.
  - Existing production weights in `ml/exports/nlp_model` remain untouched.
- **Candidate Score $\ge$ Baseline Score**: **Status: `APPROVED_FOR_PROMOTION`**.
  - Gate approves promotion.
  - Proceed to manual review step.

---

## 5. Human-in-the-Loop Promotion Protocol

Candidate model weights are **never automatically deployed** to production without human review.

### Promotion Checklist:
1. [ ] Inspect `.retrain_gate_report.json`: verify positive score delta ($\Delta \ge 0.0000$).
2. [ ] Review rolling drift report: `ml/exports/eval_reports/rolling_drift_report.json`.
3. [ ] Backup current production weights:
   ```bash
   cp -r ml/exports/nlp_model ml/exports/nlp_model_backup_$(date +%Y%m%d_%H%M%S)
   ```
4. [ ] Promote candidate weights:
   ```bash
   cp -r ml/exports/nlp_model_candidate/* ml/exports/nlp_model/
   ```
5. [ ] Restart the inference service:
   ```bash
   # Standalone
   npm run dev:inference
   # Or containerized
   docker-compose restart inference
   ```
6. [ ] Validate operational health check:
   ```bash
   curl -f http://localhost:8000/health
   ```

---

## 6. Emergency Rollback Protocol

If post-deployment monitoring indicates a spike in AI fallback rate ($> 30\%$) or 503 errors:

1. Restore backup weights:
   ```bash
   cp -r ml/exports/nlp_model_backup_<TIMESTAMP>/* ml/exports/nlp_model/
   ```
2. Restart inference service:
   ```bash
   docker-compose restart inference
   ```
3. Verify baseline restoration:
   ```bash
   python ml/scripts/eval_rolling_drift.py --sample_size 5
   ```
4. Record incident in operational postmortem log.
