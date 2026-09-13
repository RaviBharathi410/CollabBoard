# ------------------------------------------------------------
# CollabBoard – NLP-to-Diagram Training Pipeline
# Mirrors run_pipeline.ps1 style.
# ------------------------------------------------------------
$ErrorActionPreference = "Stop"

$VENV_PYTHON = "D:\Projects\CollabBoard\.venv\Scripts\python.exe"
$ROOT = "D:\Projects\CollabBoard"

Write-Host "`n=== Installing NLP training dependencies ===`n"
& $VENV_PYTHON -m pip install -r "$ROOT\ml\requirements-nlp.txt" --quiet

# ------------------------------------------------------------
# Step 1 — Generate synthetic + seed data
# ------------------------------------------------------------
Write-Host "`n=== Step 1/3 — Generating NLP training data (20,000 samples) ===`n"

& $VENV_PYTHON "$ROOT\ml\scripts\generate_nlp_diagrams.py" `
    --output_dir "$ROOT\ml\datasets\nlp_diagrams" `
    --seed_dir   "$ROOT\ml\datasets\nlp_diagrams\seed" `
    --total_samples 20000

# ------------------------------------------------------------
# Step 2 — Dry-run integrity check
# ------------------------------------------------------------
Write-Host "`n=== Step 2/3 — Data integrity check ===`n"

& $VENV_PYTHON "$ROOT\ml\scripts\train_nlp_model.py" `
    --data "$ROOT\ml\datasets\nlp_diagrams" `
    --dry_run `
    --test_parse

if ($LASTEXITCODE -ne 0) {
    Write-Error "Data integrity check failed. Review generate_nlp_diagrams.py output."
    exit 1
}

# ------------------------------------------------------------
# Step 3 — Fine-tune flan-T5
# Change --model to google/flan-t5-base or google/flan-t5-large for higher quality.
# Estimated time: flan-t5-small CPU ≈ 1-3h, GPU ≈ 15-30min.
# ------------------------------------------------------------
Write-Host "`n=== Step 3/3 — Fine-tuning flan-t5-small (5 epochs) ===`n"

& $VENV_PYTHON "$ROOT\ml\scripts\train_nlp_model.py" `
    --data    "$ROOT\ml\datasets\nlp_diagrams" `
    --output  "$ROOT\ml\exports\nlp_model" `
    --model   "google/flan-t5-small" `
    --epochs  5 `
    --batch   8 `
    --lr      5e-4

Write-Host "`n✅ NLP model ready at: ml\exports\nlp_model`n"
Write-Host "Next step: restart the inference service so it picks up the new weights."
Write-Host "  docker compose restart inference"
Write-Host "  GET http://localhost:8000/health  →  nlp_model_loaded: true`n"
