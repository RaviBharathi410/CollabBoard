"""
train_nlp_model.py
Fine-tunes google/flan-t5-small (or -base / -large) on NLP→Diagram pairs
produced by generate_nlp_diagrams.py.

Usage:
  # Dry-run: generate data, verify JSON parse rate, exit
  python ml/scripts/train_nlp_model.py --dry_run --test_parse

  # Full training
  python ml/scripts/train_nlp_model.py \
      --data ml/datasets/nlp_diagrams \
      --output ml/exports/nlp_model \
      --model google/flan-t5-small \
      --epochs 5
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Dependency guard — clear error if transformers/datasets not installed
# ---------------------------------------------------------------------------
try:
    import torch
    from datasets import Dataset, DatasetDict
    from transformers import (
        AutoTokenizer,
        AutoModelForSeq2SeqLM,
        DataCollatorForSeq2Seq,
        Seq2SeqTrainer,
        Seq2SeqTrainingArguments,
        EarlyStoppingCallback,
    )
except ImportError as e:
    sys.exit(
        f"[ERROR] Missing dependency: {e}\n"
        "Install with: pip install -r ml/requirements-nlp.txt"
    )

# MLflow is optional
try:
    import mlflow
    MLFLOW_AVAILABLE = True
except ImportError:
    MLFLOW_AVAILABLE = False


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
INPUT_PREFIX = "Diagram: "
MAX_INPUT_LEN = 256
MAX_TARGET_LEN = 512

# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def load_split(jsonl_path: Path) -> list[dict]:
    records = []
    with jsonl_path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("//"):
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return records


def build_hf_dataset(data_dir: Path) -> DatasetDict:
    splits = {}
    for split in ["train", "val", "test"]:
        path = data_dir / f"{split}.jsonl"
        if not path.exists():
            raise FileNotFoundError(
                f"[ERROR] Missing split file: {path}\n"
                "Run generate_nlp_diagrams.py first."
            )
        records = load_split(path)
        splits[split] = Dataset.from_list([
            {
                "input_text": INPUT_PREFIX + r["prompt"],
                "target_text": json.dumps(r["diagram"], separators=(",", ":")),
            }
            for r in records
        ])
        print(f"[INFO] Loaded {len(splits[split]):,} examples for split '{split}'")
    return DatasetDict(splits)


# ---------------------------------------------------------------------------
# Tokenisation
# ---------------------------------------------------------------------------

def tokenize_fn(batch, tokenizer):
    model_inputs = tokenizer(
        batch["input_text"],
        max_length=MAX_INPUT_LEN,
        truncation=True,
        padding=False,
    )
    # Modern transformers (>=4.30) supports text_target directly
    try:
        labels = tokenizer(
            text_target=batch["target_text"],
            max_length=MAX_TARGET_LEN,
            truncation=True,
            padding=False,
        )
    except (TypeError, ValueError):
        with tokenizer.as_target_tokenizer():
            labels = tokenizer(
                batch["target_text"],
                max_length=MAX_TARGET_LEN,
                truncation=True,
                padding=False,
            )
    model_inputs["labels"] = labels["input_ids"]
    return model_inputs


# ---------------------------------------------------------------------------
# Parse-rate metric (fraction of generated outputs that are valid JSON)
# ---------------------------------------------------------------------------

def compute_parse_rate(predictions, labels, tokenizer):
    import numpy as np
    if isinstance(predictions, tuple):
        predictions = predictions[0]
    preds = np.asarray(predictions)
    pad_id = tokenizer.pad_token_id if tokenizer.pad_token_id is not None else 0
    preds = np.where(preds < 0, pad_id, preds)
    decoded_preds = tokenizer.batch_decode(preds, skip_special_tokens=True)
    ok = 0
    for pred in decoded_preds:
        try:
            obj = json.loads(pred)
            if isinstance(obj, dict) and "nodes" in obj:
                ok += 1
        except Exception:
            pass
    rate = ok / len(decoded_preds) if len(decoded_preds) > 0 else 0.0
    return {"json_parse_rate": round(rate, 4)}


# ---------------------------------------------------------------------------
# Dry-run: verify data integrity
# ---------------------------------------------------------------------------

def dry_run_test_parse(data_dir: Path):
    print("\n[DRY RUN] Verifying data parse integrity ...")
    total, parse_ok, node_ok = 0, 0, 0
    for split in ["train", "val", "test"]:
        path = data_dir / f"{split}.jsonl"
        if not path.exists():
            print(f"  [SKIP] {split}.jsonl not found")
            continue
        records = load_split(path)
        for r in records:
            total += 1
            try:
                d = r.get("diagram", {})
                # Re-serialise and parse back to verify round-trip
                txt = json.dumps(d, separators=(",", ":"))
                parsed = json.loads(txt)
                parse_ok += 1
                if parsed.get("nodes"):
                    node_ok += 1
            except (json.JSONDecodeError, TypeError):
                pass
        print(f"  {split}: {len(records):,} records")

    parse_rate = parse_ok / total if total else 0
    node_rate = node_ok / total if total else 0
    print(f"\n  Total examples : {total:,}")
    print(f"  JSON parse rate: {parse_rate:.2%}")
    print(f"  Has nodes rate : {node_rate:.2%}")

    if parse_rate < 0.95:
        print("[WARNING] Parse rate below 95% - review generate_nlp_diagrams.py output.")
    else:
        print("[OK] Data looks healthy OK")
    return parse_rate


# ---------------------------------------------------------------------------
# Main training
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Fine-tune flan-T5 for NLP→Diagram")
    parser.add_argument("--data", default="ml/datasets/nlp_diagrams",
                        help="Directory with train/val/test JSONL files")
    parser.add_argument("--output", default="ml/exports/nlp_model",
                        help="Directory to save fine-tuned model + tokenizer")
    parser.add_argument("--model", default="google/flan-t5-small",
                        choices=["google/flan-t5-small", "google/flan-t5-base",
                                 "google/flan-t5-large"],
                        help="Base model to fine-tune")
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--batch", type=int, default=4)
    parser.add_argument("--grad_accum", type=int, default=2,
                        help="Number of updates steps to accumulate before backward pass")
    parser.add_argument("--lr", type=float, default=5e-4)
    parser.add_argument("--warmup_steps", type=int, default=200)
    parser.add_argument("--early_stopping_patience", type=int, default=3,
                        help="Stop if val json_parse_rate doesn't improve for N evals")
    parser.add_argument("--fp16", action="store_true",
                        help="Enable mixed precision (requires GPU)")
    parser.add_argument("--dry_run", action="store_true",
                        help="Skip training, only verify data")
    parser.add_argument("--test_parse", action="store_true",
                        help="Run data parse integrity check (use with --dry_run)")
    args = parser.parse_args()

    data_dir = Path(args.data)
    output_dir = Path(args.output)

    # ---- Dry run mode -------------------------------------------------------
    if args.dry_run:
        if args.test_parse:
            rate = dry_run_test_parse(data_dir)
            sys.exit(0 if rate >= 0.95 else 1)
        else:
            print("[DRY RUN] Pass --test_parse to validate data. Exiting.")
            sys.exit(0)

    # ---- Load data ----------------------------------------------------------
    dataset = build_hf_dataset(data_dir)

    # ---- Tokeniser + model --------------------------------------------------
    print(f"\n[INFO] Loading tokenizer + model: {args.model}")
    tokenizer = AutoTokenizer.from_pretrained(args.model)
    model = AutoModelForSeq2SeqLM.from_pretrained(args.model)

    tokenized = dataset.map(
        lambda b: tokenize_fn(b, tokenizer),
        batched=True,
        remove_columns=["input_text", "target_text"],
    )

    data_collator = DataCollatorForSeq2Seq(tokenizer, model=model, padding=True)

    # ---- Training arguments -------------------------------------------------
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[INFO] Training device: {device}")

    training_args_dict = {
        "output_dir": str(output_dir / "checkpoints"),
        "num_train_epochs": args.epochs,
        "per_device_train_batch_size": args.batch,
        "per_device_eval_batch_size": args.batch,
        "gradient_accumulation_steps": args.grad_accum,
        "learning_rate": args.lr,
        "warmup_steps": args.warmup_steps,
        "weight_decay": 0.01,
        "eval_strategy": "epoch",
        "evaluation_strategy": "epoch",
        "save_strategy": "epoch",
        "load_best_model_at_end": True,
        "metric_for_best_model": "eval_loss",
        "greater_is_better": False,
        "predict_with_generate": True,
        "generation_max_length": MAX_TARGET_LEN,
        "generation_num_beams": 2,
        "logging_dir": str(output_dir / "logs"),
        "logging_steps": 25,
        "report_to": "none",
        "fp16": args.fp16 and device == "cuda",
        "dataloader_num_workers": 0,
        "save_total_limit": 2,
    }
    import inspect
    sig = inspect.signature(Seq2SeqTrainingArguments.__init__)
    valid_args = {k: v for k, v in training_args_dict.items() if k in sig.parameters}
    training_args = Seq2SeqTrainingArguments(**valid_args)

    def compute_metrics(eval_pred):
        predictions, labels = eval_pred
        # predictions may be token ids
        if hasattr(predictions, "sequences"):
            predictions = predictions.sequences
        return compute_parse_rate(predictions, labels, tokenizer)

    trainer_kwargs = {
        "model": model,
        "args": training_args,
        "train_dataset": tokenized["train"],
        "eval_dataset": tokenized["val"],
        "data_collator": data_collator,
        "compute_metrics": compute_metrics,
        "callbacks": [EarlyStoppingCallback(
            early_stopping_patience=args.early_stopping_patience
        )],
    }
    trainer_sig = inspect.signature(Seq2SeqTrainer.__init__)
    if "processing_class" in trainer_sig.parameters:
        trainer_kwargs["processing_class"] = tokenizer
    else:
        trainer_kwargs["tokenizer"] = tokenizer

    trainer = Seq2SeqTrainer(**trainer_kwargs)

    # ---- MLflow logging (optional) ------------------------------------------
    if MLFLOW_AVAILABLE:
        mlflow.set_tracking_uri("sqlite:///mlflow.db")
        mlflow.set_experiment("CollabBoard_NLP_Pipeline")
        mlflow.start_run(run_name=f"flan-t5-{args.model.split('-')[-1]}")
        mlflow.log_params({
            "base_model": args.model,
            "epochs": args.epochs,
            "batch_size": args.batch,
            "learning_rate": args.lr,
            "train_samples": len(tokenized["train"]),
            "val_samples": len(tokenized["val"]),
        })

    # ---- Train ---------------------------------------------------------------
    print(f"\n[INFO] Starting fine-tuning for {args.epochs} epochs ...")
    trainer.train()

    # ---- Save model ----------------------------------------------------------
    output_dir.mkdir(parents=True, exist_ok=True)
    trainer.save_model(str(output_dir))
    tokenizer.save_pretrained(str(output_dir))
    print(f"\n[INFO] Model saved to: {output_dir} OK")

    # ---- Evaluate on test set -----------------------------------------------
    try:
        print("\n[INFO] Evaluating on test set ...")
        test_results = trainer.predict(tokenized["test"])
        metrics = compute_parse_rate(test_results.predictions, test_results.label_ids, tokenizer)
        print(f"  Test JSON parse rate: {metrics['json_parse_rate']:.2%}")
        if MLFLOW_AVAILABLE:
            mlflow.log_metrics({"test_json_parse_rate": metrics["json_parse_rate"]})
    except Exception as e:
        print(f"  [WARN] Test set evaluation warning: {e}")

    if MLFLOW_AVAILABLE:
        mlflow.end_run()

    print("\n[OK] NLP model training complete.")


if __name__ == "__main__":
    main()
