# ------------------------------------------------------------
# CollabBoard – Full Multi‑Stage Training Pipeline (Fixed)
# ------------------------------------------------------------
$ErrorActionPreference = "Stop"

# Activate & path configurations
$VENV_PYTHON = Join-Path $PSScriptRoot "..\.venv\Scripts\python.exe"
if (-not (Test-Path $VENV_PYTHON)) {
    $cmd = Get-Command python -ErrorAction SilentlyContinue
    if ($cmd) {
        $VENV_PYTHON = $cmd.Source
    } else {
        $VENV_PYTHON = "python"
    }
}

# ------------------------------------------------------------
# 0️⃣ Install dependencies
# ------------------------------------------------------------
Write-Host "Installing missing dependencies from requirements.txt..."
& $VENV_PYTHON -m pip install -r requirements.txt

# ------------------------------------------------------------
# 1️⃣  OpenImages – General visual backbone
# ------------------------------------------------------------
$STAGE1_WEIGHTS = "runs/detect/ml/checkpoints/openimages_stage-4/weights/best.pt"
if (Test-Path $STAGE1_WEIGHTS) {
    Write-Host "`n=== Stage 1 weights found. Skipping Stage 1 training step. ===`n"
} else {
    Write-Host "`n=== Stage 1 - OpenImages (40-60 epochs) ===`n"

    & $VENV_PYTHON ml/scripts/prepare_openimages.py `
        --output_dir ml/datasets/openimages `
        --classes Diagram Chart Plot Flowchart Arrow Rectangle Circle Text `
        --sample_count 6000

    & $VENV_PYTHON ml/scripts/dataset_quality.py ml/datasets/openimages

    & $VENV_PYTHON ml/scripts/train_detection.py `
        --data ml/datasets/openimages/dataset.yaml `
        --epochs 45 `
        --batch 4 `
        --img-sz 512,512,512 `
        --device 0 `
        --project ml/checkpoints `
        --name openimages_stage `
        --log_dir ml/logs/openimages_stage.log `
        --save_last
}

# ------------------------------------------------------------
# Stage 2 - Synthetic Diagram Generator (SKIPPED)
# ------------------------------------------------------------
# The synthetic stage is optional and has already been completed.
# To re-run it, set $SKIP_STAGE2 = $false
$SKIP_STAGE2 = $true
if (-not $SKIP_STAGE2) {
    Write-Host "`n=== Stage 2 - Synthetic Diagram Generator (15 epochs) ===`n"
    & $VENV_PYTHON ml/scripts/generate_synthetic.py `
        --output_dir ml/datasets/synthetic `
        --curriculum_cfg ml/synthetic/curriculum.yaml `
        --total_samples 8000
    & $VENV_PYTHON ml/scripts/dataset_quality.py ml/datasets/synthetic
    & $VENV_PYTHON ml/scripts/train_detection.py `
        --data ml/datasets/synthetic/dataset.yaml `
        --epochs 15 `
        --batch 4 `
        --img-sz 512,512,512 `
        --device 0 `
        --replay_datasets ml/datasets/openimages `
        --replay_ratio 0.30 `
        --project ml/checkpoints `
        --name synthetic_stage `
        --log_dir ml/logs/synthetic_stage.log `
        --save_last
}

# ------------------------------------------------------------
# Stage 3 - DiagramNet - Core specialization
# ------------------------------------------------------------
Write-Host "`n=== Stage 3 - DiagramNet (12 epochs) ===`n"

if (-not (Test-Path ml/datasets/diagramnet_src)) {
    git clone https://github.com/DeepLearningHust/DiagramNet.git ml/datasets/diagramnet_src
}
& $VENV_PYTHON ml/scripts/convert_diagramnet.py ml/datasets/diagramnet_src ml/datasets/diagramnet

& $VENV_PYTHON ml/scripts/train_detection.py `
    --data ml/datasets/diagramnet/dataset.yaml `
    --epochs 12 `
    --batch 4 `
    --img-sz 512,512,512 `
    --device 0 `
    --replay_datasets ml/datasets/openimages,ml/datasets/synthetic `
    --replay_ratio 0.30 `
    --project ml/checkpoints `
    --name diagramnet_stage `
    --log_dir ml/logs/diagramnet_stage.log `
    --save_last

& $VENV_PYTHON ml/scripts/hard_negative_mining.py `
    --model_checkpoint ml/checkpoints/diagramnet_stage/weights/best.pt `
    --data_dir ml/datasets/diagramnet `
    --output_dir ml/replay_buffers/hard_negatives

# ------------------------------------------------------------
# Stage 4 - AI2D – Hand-drawn robustness
# ------------------------------------------------------------
Write-Host "`n=== Stage 4 - AI2D (10 epochs) ===`n"

& $VENV_PYTHON ml/scripts/download_ai2d.py
& $VENV_PYTHON ml/scripts/convert_ai2d.py ml/datasets/ai2d_raw ml/datasets/ai2d

& $VENV_PYTHON ml/scripts/train_detection.py `
    --data ml/datasets/ai2d/dataset.yaml `
    --epochs 10 `
    --batch 4 `
    --img-sz 512,512,512 `
    --device 0 `
    --replay_datasets ml/datasets/openimages,ml/datasets/synthetic,ml/datasets/diagramnet,ml/replay_buffers/hard_negatives `
    --replay_ratio 0.30 `
    --project ml/checkpoints `
    --name ai2d_stage `
    --log_dir ml/logs/ai2d_stage.log `
    --save_last

# ------------------------------------------------------------
# 5️⃣  RICO – UI understanding
# ------------------------------------------------------------
Write-Host "`n=== Stage 5 - RICO (8 epochs) ===`n"

if (-not (Test-Path ml/datasets/rico_src)) {
    # Public RICO dataset repository mirror
    git clone https://github.com/nupur1810/rico-dataset.git ml/datasets/rico_src
}
& $VENV_PYTHON ml/scripts/convert_rico.py ml/datasets/rico_src ml/datasets/rico

& $VENV_PYTHON ml/scripts/train_detection.py `
    --data ml/datasets/rico/dataset.yaml `
    --epochs 8 `
    --batch 4 `
    --img-sz 512,512,512 `
    --device 0 `
    --replay_datasets ml/datasets/openimages,ml/datasets/synthetic,ml/datasets/diagramnet,ml/datasets/ai2d,ml/replay_buffers/hard_negatives `
    --replay_ratio 0.30 `
    --project ml/checkpoints `
    --name rico_stage `
    --log_dir ml/logs/rico_stage.log `
    --save_last

# ------------------------------------------------------------
# 6️⃣  User Sketches – Final adaptation
# ------------------------------------------------------------
Write-Host "`n=== Stage 6 - User Sketches (5 epochs) ===`n"

if (-not (Test-Path ml/datasets/user_sketches_raw)) {
    Write-Warning "Creating empty placeholder for user sketches raw directory."
    New-Item -ItemType Directory -Force -Path ml/datasets/user_sketches_raw | Out-Null
}

& $VENV_PYTHON ml/scripts/convert_user_sketches.py ml/datasets/user_sketches_raw ml/datasets/user_sketches

& $VENV_PYTHON ml/scripts/train_detection.py `
    --data ml/datasets/user_sketches/dataset.yaml `
    --epochs 5 `
    --batch 4 `
    --img-sz 512,512,512 `
    --device 0 `
    --replay_datasets ml/datasets/openimages,ml/datasets/synthetic,ml/datasets/diagramnet,ml/datasets/ai2d,ml/datasets/rico,ml/replay_buffers/hard_negatives `
    --replay_ratio 0.30 `
    --project ml/checkpoints `
    --name user_sketch_stage `
    --log_dir ml/logs/user_sketch_stage.log `
    --save_last

# ------------------------------------------------------------
# FINAL EXPORT – ONNX + INT8 for WebGPU
# ------------------------------------------------------------
Write-Host "`n=== Exporting final model to ONNX & quantising to INT8 ===`n"

& $VENV_PYTHON ml/scripts/export_model.py

& $VENV_PYTHON ml/scripts/quantize_int8.py `
    --onnx_model ml/exports/collabboard_final.onnx `
    --output ml/browser_models/collabboard_int8.onnx

Write-Host "`n✅ Pipeline complete! Model ready at: ml/browser_models/collabboard_int8.onnx`n"
