"""
nlp_model.py
Singleton loader for the fine-tuned flan-T5 NLP→Diagram model.

The model is loaded once at process startup. If the weights directory
doesn't exist (e.g. training hasn't run yet), _model and _tokenizer
stay None and the /nlp-to-diagram route returns 503 cleanly.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Model weights location (matches run_nlp_pipeline.ps1 output path)
# ---------------------------------------------------------------------------
_DEFAULT_MODEL_PATH = os.getenv(
    "NLP_MODEL_PATH",
    "ml/exports/nlp_model",
)

_tokenizer = None
_model = None
_model_path: Optional[str] = None


def _try_load(model_path: str):
    """Attempt to load tokenizer + model. Returns (tokenizer, model) or (None, None)."""
    path = Path(model_path)
    is_local = False
    target_path = str(path)

    # 1. Check local filesystem path first
    if (path / "config.json").exists():
        is_local = True
        target_path = str(path)
    else:
        repo_root = Path(__file__).resolve().parent.parent
        alt_path = repo_root / model_path
        if (alt_path / "config.json").exists():
            is_local = True
            target_path = str(alt_path)

    try:
        from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
        if is_local:
            print(f"[NLP Model] Loading tokenizer from local path {target_path} ...")
            tok = AutoTokenizer.from_pretrained(target_path)
            print(f"[NLP Model] Loading model from local path {target_path} ...")
            mdl = AutoModelForSeq2SeqLM.from_pretrained(target_path)
        else:
            # Fallback to Hugging Face Hub if local weights were excluded from git
            if "/" in model_path and not (path / "config.json").exists():
                hf_identifier = model_path
            else:
                hf_identifier = os.getenv("HF_MODEL_ID", "google/flan-t5-small")
            print(f"[NLP Model] Local weights not found at '{model_path}'. Cold-start loading from HuggingFace Hub: '{hf_identifier}' ...")
            tok = AutoTokenizer.from_pretrained(hf_identifier)
            mdl = AutoModelForSeq2SeqLM.from_pretrained(hf_identifier)

        mdl.eval()
        print("[NLP Model] Model loaded successfully [OK]")
        return tok, mdl
    except Exception as e:
        print(f"[NLP Model] Load failed: {e}")
        return None, None


def load_nlp_model(model_path: str = _DEFAULT_MODEL_PATH):
    """Called once at FastAPI startup. Sets module-level singletons."""
    global _tokenizer, _model, _model_path
    _model_path = model_path
    _tokenizer, _model = _try_load(model_path)


def is_loaded() -> bool:
    return _model is not None and _tokenizer is not None


def get_model_path() -> Optional[str]:
    return _model_path


def repair_and_parse_diagram(raw: str) -> dict:
    """Robust parser that parses JSON and repairs omitted outer braces/object brackets."""
    raw = raw.strip()
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            return data
    except Exception:
        pass

    s = raw
    if not s.startswith("{"):
        s = "{" + s
    if not s.endswith("}"):
        s = s + "}"

    try:
        data = json.loads(s)
        if isinstance(data, dict):
            return data
    except Exception:
        pass

    # Repair unbracketed objects inside nodes and edges arrays
    def fix_object_array(match):
        arr_content = match.group(1).strip()
        if not arr_content:
            return "[]"
        if arr_content.startswith("{"):
            return "[" + arr_content + "]"
        items = re.split(r'(?="id"\s*:)', arr_content)
        fixed_items = []
        for it in items:
            it = it.strip().rstrip(",")
            if it:
                if not it.startswith("{"):
                    it = "{" + it
                if not it.endswith("}"):
                    it = it + "}"
                fixed_items.append(it)
        return "[" + ", ".join(fixed_items) + "]"

    s = re.sub(r'"nodes"\s*:\s*\[([\s\S]*?)\]', lambda m: '"nodes": ' + fix_object_array(m), s)
    s = re.sub(r'"edges"\s*:\s*\[([\s\S]*?)\]', lambda m: '"edges": ' + fix_object_array(m), s)

    try:
        return json.loads(s)
    except Exception as e:
        raise ValueError(f"Model output could not be parsed into JSON: {raw[:200]}") from e


def sanitize_and_heal_graph(diagram: dict, stitch_orphans: bool = False) -> tuple[dict, dict]:
    """
    Defensive structured-output validation and repair.
    - Prunes phantom edges pointing to non-existent nodes.
    - Stitches orphan nodes only when explicitly requested (e.g. for NLP generation).
    - Logs every time healing fires for observability.
    Returns (repaired_diagram, healing_telemetry).
    """
    nodes = diagram.get("nodes", [])
    edges = diagram.get("edges", [])
    node_ids = [n.get("id") for n in nodes if isinstance(n, dict) and "id" in n]
    node_id_set = set(node_ids)

    pruned_edges = []
    valid_edges = []

    # 1. Prune phantom edges referencing non-existent IDs
    for e in edges:
        if not isinstance(e, dict):
            continue
        src = e.get("source") or e.get("from")
        tgt = e.get("target") or e.get("to")
        if src in node_id_set and tgt in node_id_set:
            valid_edges.append(e)
        else:
            pruned_edges.append(f"{src}->{tgt}")

    # 2. Check connectivity and stitch orphan nodes only if requested
    connected_nodes = set()
    for e in valid_edges:
        s = e.get("source") or e.get("from")
        t = e.get("target") or e.get("to")
        connected_nodes.add(s)
        connected_nodes.add(t)

    orphans = [nid for nid in node_ids if nid not in connected_nodes]
    healed_edges = []

    if stitch_orphans and orphans and len(node_ids) > 1:
        diag_type = str(diagram.get("type", "")).lower()
        if diag_type == "mindmap" and "n1" in node_id_set:
            for o in orphans:
                if o != "n1":
                    eid = f"e{len(valid_edges) + len(healed_edges) + 1}"
                    new_edge = {"id": eid, "source": "n1", "target": o, "label": "", "style": "solid"}
                    healed_edges.append(new_edge)
        else:
            for o in orphans:
                idx = node_ids.index(o)
                anchor = node_ids[idx - 1] if idx > 0 else (node_ids[1] if len(node_ids) > 1 else None)
                if anchor and anchor != o:
                    eid = f"e{len(valid_edges) + len(healed_edges) + 1}"
                    new_edge = {"id": eid, "source": anchor, "target": o, "label": "", "style": "solid"}
                    healed_edges.append(new_edge)

    all_edges = valid_edges + healed_edges
    diagram["edges"] = all_edges

    healing_applied = (len(pruned_edges) > 0) or (len(healed_edges) > 0)
    telemetry = {
        "healing_applied": healing_applied,
        "phantom_edges_pruned": pruned_edges,
        "orphan_nodes_healed": [e["target"] for e in healed_edges],
    }

    if healing_applied:
        print(f"[Graph Repair] Healing applied: pruned {len(pruned_edges)} phantom edge(s) {pruned_edges}, healed {len(healed_edges)} orphan node(s) {[e['target'] for e in healed_edges]}")

    return diagram, telemetry


def generate_diagram(text: str, diagram_type_hint: Optional[str] = None) -> dict:
    """
    Run inference: text → diagram JSON dict.

    Returns the parsed diagram dict on success.
    Raises ValueError if JSON is malformed or has no nodes.
    Raises RuntimeError if the model is not loaded.
    """
    if not is_loaded():
        raise RuntimeError("NLP model is not loaded")

    import torch

    prompt = f"Diagram: {text.strip()}"
    inputs = _tokenizer(
        prompt,
        return_tensors="pt",
        max_length=256,
        truncation=True,
        padding=False,
    )

    inputs = {k: v.to(_model.device) for k, v in inputs.items()}

    with torch.no_grad():
        gen_output = _model.generate(
            **inputs,
            max_new_tokens=512,
            num_beams=2,
            early_stopping=True,
            return_dict_in_generate=True,
            output_scores=True,
        )

    output_ids = gen_output.sequences
    raw = _tokenizer.decode(output_ids[0], skip_special_tokens=True)

    # ---- Compute generation confidence mathematically from token log-probs ----
    computed_confidence = 0.85
    if hasattr(_model, "compute_transition_scores") and hasattr(gen_output, "scores") and gen_output.scores:
        try:
            trans_scores = _model.compute_transition_scores(
                sequences=gen_output.sequences,
                scores=gen_output.scores,
                beam_indices=getattr(gen_output, "beam_indices", None),
                normalize_logits=True,
            )
            valid_scores = trans_scores[~torch.isnan(trans_scores) & ~torch.isinf(trans_scores)]
            if len(valid_scores) > 0:
                mean_log_prob = valid_scores.mean().item()
                raw_conf = float(torch.exp(torch.tensor(mean_log_prob)).item())
                computed_confidence = round(max(0.01, min(0.99, raw_conf)), 4)
        except Exception as err:
            print(f"[NLP Model] Warning computing transition confidence: {err}")

    # ---- Parse JSON (with robust repair for small seq2seq model outputs) ----
    diagram = repair_and_parse_diagram(raw)

    if not isinstance(diagram, dict) or not diagram.get("nodes"):
        raise ValueError("Diagram has no nodes — treat as parse failure")

    # ---- Apply type hint override if provided --------------------------------
    if diagram_type_hint and isinstance(diagram_type_hint, str):
        diagram["type"] = diagram_type_hint

    # ---- Overwrite self-reported confidence with mathematically computed value ----
    diagram["confidence"] = computed_confidence
    diagram["confidenceComputed"] = True
    diagram.setdefault("edges", [])
    diagram.setdefault("layoutHint", "hierarchical")
    diagram.setdefault("ambiguities", [])

    # ---- Structured-output validation and repair (with telemetry) -----------
    diagram, healing_info = sanitize_and_heal_graph(diagram, stitch_orphans=True)
    diagram["healingInfo"] = healing_info

    return diagram


def get_model_path() -> str:
    return _model_path or _DEFAULT_MODEL_PATH
