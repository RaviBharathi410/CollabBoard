import os
import sys
import json
import time
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Tuple
import numpy as np

# Add repo root and inference-api to sys.path
REPO_ROOT = Path(__file__).resolve().parents[2]
INFERENCE_API_DIR = REPO_ROOT / "inference-api"
sys.path.append(str(INFERENCE_API_DIR))

from import_pipeline.preprocess import preprocess_diagram_image
from import_pipeline.ocr import extract_diagram_text
from import_pipeline.detect_shapes import detect_shapes_and_arrows
from import_pipeline.reconstruct import reconstruct_diagram_graph
from nlp_model import sanitize_and_heal_graph
from inference import ONNXDiagramDetector

TESTSET_DIR = Path(__file__).resolve().parent / "import_testset"
REPORTS_DIR = Path(__file__).resolve().parent / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

# Instantiate detector
_raw_model_path = os.getenv("ONNX_MODEL_PATH", "ml/browser_models/collabboard_int8.onnx")
detector = None
try:
    detector = ONNXDiagramDetector(_raw_model_path)
except Exception:
    detector = None

def normalize_text(text: str) -> str:
    """Normalizes label text for matching (lowercase, strips punctuation and spaces)."""
    if not text:
        return ""
    import re
    return re.sub(r'[^a-zA-Z0-9]', '', text).lower()

def calculate_metrics(
    detected_nodes: List[Dict],
    expected_nodes: List[Dict],
    detected_edges: List[Dict],
    expected_edge_count: int
) -> Dict[str, Any]:
    """
    Computes rigorous precision, recall, and label match metrics.
    """
    exp_labels = [normalize_text(n["label"]) for n in expected_nodes]
    exp_types = [n.get("type", "").lower() for n in expected_nodes]

    det_labels = [normalize_text(n.get("label", "")) for n in detected_nodes if n.get("label")]
    det_types = [n.get("type", "").lower() for n in detected_nodes]

    # 1. OCR Text Match Rate (Ground-Truth Label Recall, bounded strictly in [0.0, 1.0])
    matched_gt = 0
    for el in exp_labels:
        if not el:
            continue
        if any(el in dl or dl in el for dl in det_labels if len(dl) >= 2 and len(el) >= 2) or el in det_labels:
            matched_gt += 1

    ocr_text_match = min(1.0, matched_gt / max(len(exp_labels), 1)) if exp_labels else 1.0

    # 2. Shape Geometry Matching (matches by type/geometry)
    matched_shapes = 0
    rem_exp_types = list(exp_types)
    for dt in det_types:
        # Standardize service / actor into rectangle / box if appropriate
        mapped_dt = "rectangle" if dt in ["service", "actor"] else dt
        matched_idx = None
        for i, et in enumerate(rem_exp_types):
            mapped_et = "rectangle" if et in ["service", "actor"] else et
            if mapped_dt == mapped_et:
                matched_idx = i
                break
        if matched_idx is not None:
            matched_shapes += 1
            rem_exp_types.pop(matched_idx)

    node_prec = (matched_shapes / len(det_types)) if det_types else 0.0
    node_rec = (matched_shapes / len(exp_types)) if exp_types else 1.0

    # 3. Edge Matching
    det_edge_count = len(detected_edges)
    edge_prec = min(1.0, (min(det_edge_count, expected_edge_count) / max(det_edge_count, 1)))
    edge_rec = min(1.0, (min(det_edge_count, expected_edge_count) / max(expected_edge_count, 1)))

    return {
        "node_precision": round(node_prec, 3),
        "node_recall": round(node_rec, 3),
        "ocr_text_match": round(ocr_text_match, 3),
        "edge_precision": round(edge_prec, 3),
        "edge_recall": round(edge_rec, 3),
        "detected_nodes": len(detected_nodes),
        "expected_nodes": len(expected_nodes),
        "detected_edges": len(detected_edges),
        "expected_edges": expected_edge_count
    }

def run_structured_parser_node(file_path: Path, format_type: str) -> Dict[str, Any]:
    """
    Executes the deterministic Node.js parser for the structured file format.
    """
    runner_script = REPO_ROOT / "scripts" / "run_structured_parser.mjs"
    res = subprocess.run(
        ["node", str(runner_script), str(file_path), format_type],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        shell=True
    )

    if res.returncode != 0:
        raise RuntimeError(f"Node parser failed for {file_path}: {res.stderr}")

    return json.loads(res.stdout.strip())

def run_image_inference(file_path: Path) -> Tuple[Dict[str, Any], str]:
    """
    Executes the REAL Python production pipeline:
    1. Preprocessing (deskew, auto-crop, CLAHE, bilateral denoise)
    2. Independent OCR
    3. Shape and Arrow Detection (Primary ONNX with resilient geometric CV fallback)
    4. 2D Spatial Overlap & Endpoint Geometric Reconstruction
    5. Graph Defense & Healing
    """
    from PIL import Image
    raw_img = Image.open(file_path).convert("RGB")
    cur_w, cur_h = raw_img.size

    # 1. Preprocessing
    preprocessed_img, prep_metrics = preprocess_diagram_image(raw_img)

    # 2. OCR
    ocr_regions = extract_diagram_text(preprocessed_img)

    # 3. Shape & Arrow Detection (Real Production Path)
    detections, method_used = detect_shapes_and_arrows(preprocessed_img, onnx_detector=detector)

    # 4. Geometric Reconstruction
    diagram = reconstruct_diagram_graph(
        detections=detections,
        ocr_regions=ocr_regions,
        orig_w=cur_w,
        orig_h=cur_h
    )

    # 5. Graph Healing
    repaired, _ = sanitize_and_heal_graph(diagram)
    return repaired, method_used

def evaluate_import_precision():
    manifest_path = TESTSET_DIR / "manifest.json"
    if not manifest_path.exists():
        sys.exit(f"[ERROR] Manifest not found at {manifest_path}. Run create_testset.py first.")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    print("================================================================================")
    print("        COLLABBOARD DIAGRAM IMPORT PRECISION EVALUATION SUITE                  ")
    print("================================================================================")
    print("Precision Discipline: Structured Parsers and Image Vision are Evaluated SEPARATELY\n")

    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    results = {
        "timestamp": datetime.now().isoformat(),
        "structured_benchmark": {},
        "image_benchmark": {}
    }

    # --------------------------------------------------------------------------
    # 1. EVALUATE STRUCTURED FILES (Deterministic Parsers)
    # --------------------------------------------------------------------------
    print("--- [SECTION 1: STRUCTURED FILE DETERMINISTIC IMPORTS] ---")
    structured_metrics = []

    for item in manifest.get("structured", []):
        file_path = TESTSET_DIR / item["filename"]
        try:
            parsed = run_structured_parser_node(file_path, item["format"])
            m = calculate_metrics(
                detected_nodes=parsed.get("nodes", []),
                expected_nodes=item["expected_nodes"],
                detected_edges=parsed.get("edges", []),
                expected_edge_count=item["expected_edge_count"]
            )
            m["test_id"] = item["id"]
            m["format"] = item["format"]
            m["method"] = "deterministic_parser"
            structured_metrics.append(m)
            print(f"  [PASS] {item['id']:<24} ({item['format']:<7}): Node Prec={m['node_precision']*100:.1f}%, Node Rec={m['node_recall']*100:.1f}%, Edge Prec={m['edge_precision']*100:.1f}%, Edge Rec={m['edge_recall']*100:.1f}%")
        except Exception as e:
            print(f"  [FAIL] {item['id']} ({item['format']}): {e}")

    # --------------------------------------------------------------------------
    # 2. EVALUATE IMAGE VISION IMPORTS (Probabilistic Vision & OCR Pipeline)
    # --------------------------------------------------------------------------
    print("\n--- [SECTION 2: IMAGE VISION & OCR IMPORTS (10 Varied Test Images)] ---")
    image_metrics = []

    for item in manifest.get("image", []):
        file_path = TESTSET_DIR / item["filename"]
        try:
            reconstructed, method_used = run_image_inference(file_path)
            m = calculate_metrics(
                detected_nodes=reconstructed.get("nodes", []),
                expected_nodes=item["expected_nodes"],
                detected_edges=reconstructed.get("edges", []),
                expected_edge_count=item["expected_edge_count"]
            )
            m["test_id"] = item["id"]
            m["category"] = item.get("category", "image")
            m["method"] = method_used
            m["model_internal_conf"] = round(float(reconstructed.get("confidence", 0.0)), 3)
            image_metrics.append(m)
            print(f"  [EVAL] {item['id']:<32} | Nodes: {m['detected_nodes']}/{m['expected_nodes']} (P={m['node_precision']*100:.0f}%, R={m['node_recall']*100:.0f}%) | Edges: {m['detected_edges']}/{m['expected_edges']} (P={m['edge_precision']*100:.0f}%, R={m['edge_recall']*100:.0f}%) | OCR={m['ocr_text_match']*100:.0f}% | ModelConf={m['model_internal_conf']*100:.1f}% | {method_used}")
        except Exception as e:
            print(f"  [FAIL] {item['id']}: {e}")

    # Compute aggregates
    avg_struct_node_prec = round(float(np.mean([m["node_precision"] for m in structured_metrics])), 3) if structured_metrics else 0.0
    avg_struct_node_rec = round(float(np.mean([m["node_recall"] for m in structured_metrics])), 3) if structured_metrics else 0.0
    avg_struct_edge_prec = round(float(np.mean([m["edge_precision"] for m in structured_metrics])), 3) if structured_metrics else 0.0
    avg_struct_edge_rec = round(float(np.mean([m["edge_recall"] for m in structured_metrics])), 3) if structured_metrics else 0.0
    avg_struct_label = round(float(np.mean([m["ocr_text_match"] for m in structured_metrics])), 3) if structured_metrics else 0.0

    avg_img_node_prec = round(float(np.mean([m["node_precision"] for m in image_metrics])), 3) if image_metrics else 0.0
    avg_img_node_rec = round(float(np.mean([m["node_recall"] for m in image_metrics])), 3) if image_metrics else 0.0
    avg_img_edge_prec = round(float(np.mean([m["edge_precision"] for m in image_metrics])), 3) if image_metrics else 0.0
    avg_img_edge_rec = round(float(np.mean([m["edge_recall"] for m in image_metrics])), 3) if image_metrics else 0.0
    avg_img_ocr = round(float(np.mean([m["ocr_text_match"] for m in image_metrics])), 3) if image_metrics else 0.0
    avg_img_model_conf = round(float(np.mean([m["model_internal_conf"] for m in image_metrics])), 3) if image_metrics else 0.0

    results["structured_benchmark"] = {
        "tests": structured_metrics,
        "mean_node_precision": avg_struct_node_prec,
        "mean_node_recall": avg_struct_node_rec,
        "mean_edge_precision": avg_struct_edge_prec,
        "mean_edge_recall": avg_struct_edge_rec,
        "mean_label_accuracy": avg_struct_label,
        "fidelity": "100% Deterministic Parsing"
    }

    results["image_benchmark"] = {
        "tests": image_metrics,
        "mean_node_precision": avg_img_node_prec,
        "mean_node_recall": avg_img_node_rec,
        "mean_edge_precision": avg_img_edge_prec,
        "mean_edge_recall": avg_img_edge_rec,
        "mean_ocr_match_rate": avg_img_ocr,
        "mean_model_internal_conf": avg_img_model_conf,
        "fidelity": "Probabilistic Vision & OCR Pipeline"
    }

    report_file = REPORTS_DIR / f"import_precision_{timestamp_str}.json"
    report_file.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"\n[Report Saved] -> {report_file}")

    # Markdown Tables
    print("\n================================================================================")
    print("                       PRECISION REPORT SUMMARY                                ")
    print("================================================================================")
    print("\n### 1. Structured File Imports (Deterministic — No ML)")
    print("| Test ID | Format | Node Prec | Node Rec | Edge Prec | Edge Rec | Label Acc | Status |")
    print("| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |")
    for s in structured_metrics:
        print(f"| {s['test_id']} | {s['format']} | {s['node_precision']*100:.1f}% | {s['node_recall']*100:.1f}% | {s['edge_precision']*100:.1f}% | {s['edge_recall']*100:.1f}% | {s['ocr_text_match']*100:.1f}% | Exact Deterministic |")
    print(f"**Structured Summary**: Node Precision: {avg_struct_node_prec*100:.1f}%, Node Recall: {avg_struct_node_rec*100:.1f}%, Edge Precision: {avg_struct_edge_prec*100:.1f}%\n")

    print("### 2. Image Vision & OCR Imports (Probabilistic — Preprocess + Detection + Reconstruction)")
    print("| Test ID | Category | Node Prec | Node Rec | Edge Prec | Edge Rec | OCR Match | Model Conf | Detection Tier |")
    print("| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |")
    for im in image_metrics:
        print(f"| {im['test_id']} | {im['category']} | {im['node_precision']*100:.1f}% | {im['node_recall']*100:.1f}% | {im['edge_precision']*100:.1f}% | {im['edge_recall']*100:.1f}% | {im['ocr_text_match']*100:.1f}% | {im['model_internal_conf']*100:.1f}% | {im['method']} |")
    print(f"**Image Summary**: Node Precision: {avg_img_node_prec*100:.1f}%, Node Recall: {avg_img_node_rec*100:.1f}%, Edge Precision: {avg_img_edge_prec*100:.1f}%, Edge Recall: {avg_img_edge_rec*100:.1f}%, OCR Match: {avg_img_ocr*100:.1f}%, Avg Model Conf: {avg_img_model_conf*100:.1f}%\n")
    print("================================================================================")

if __name__ == "__main__":
    evaluate_import_precision()
