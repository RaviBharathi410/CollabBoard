import os
import sys
import json
import time
from pathlib import Path
from typing import Dict, Any, List
from collections import defaultdict
from PIL import Image

# Setup paths
REPO_ROOT = Path(__file__).resolve().parents[2]
INFERENCE_API_DIR = REPO_ROOT / "inference-api"
sys.path.append(str(INFERENCE_API_DIR))

from import_pipeline.preprocess import preprocess_diagram_image
from import_pipeline.ocr import extract_diagram_text
from import_pipeline.detect_shapes import detect_shapes_and_arrows
from import_pipeline.classify_diagram_type import classify_diagram_type

REPORTS_DIR = Path(__file__).resolve().parent / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

# 15 Curated Classification Benchmark Test Cases
BENCHMARK_CASES = [
    # ── Real UML Class Diagrams ──
    {
        "id": "uml_class_textbook_primary",
        "type": "raster",
        "path": r"C:\Users\Ravi\.gemini\antigravity-ide\brain\e363c7e5-cddc-4915-8795-a309e7d0277e\.user_uploaded\media_1789324517523.png",
        "expected": "uml-class",
        "description": "Textbook UML class diagram with 13 classes, stereotypes <<entity>>, and operations"
    },
    {
        "id": "uml_class_fullpage_scan",
        "type": "raster",
        "path": r"C:\Users\Ravi\.gemini\antigravity-ide\brain\e363c7e5-cddc-4915-8795-a309e7d0277e\.user_uploaded\media_1789324509774.png",
        "expected": "uml-class",
        "description": "Full-page scanned class diagram with multiple relationship arrows"
    },
    {
        "id": "uml_class_complex_hierarchy",
        "type": "raster",
        "path": r"C:\Users\Ravi\.gemini\antigravity-ide\brain\e363c7e5-cddc-4915-8795-a309e7d0277e\.user_uploaded\media_1789367985200.png",
        "expected": "uml-class",
        "description": "UML class hierarchy with inheritance and dependency associations"
    },
    {
        "id": "uml_class_editor_ground_truth",
        "type": "raster",
        "path": r"C:\Users\Ravi\.gemini\antigravity-ide\brain\e363c7e5-cddc-4915-8795-a309e7d0277e\.user_uploaded\media_1789401175211.png",
        "expected": "uml-class",
        "description": "UML diagram with Window, Frame, DataController, and Shape classes"
    },

    # ── Flowchart & Process Diagrams ──
    {
        "id": "flowchart_decision_branching",
        "type": "raster",
        "path": str(REPO_ROOT / "ml/eval/import_testset/decision_flowchart.png"),
        "expected": "flowchart",
        "description": "Process flowchart with decision diamond and conditional branching"
    },
    {
        "id": "flowchart_clean_line_art_3node",
        "type": "raster",
        "path": str(REPO_ROOT / "ml/eval/import_testset/clean_line_art_3node.png"),
        "expected": "flowchart",
        "description": "Digital line-art sequential process flow"
    },
    {
        "id": "flowchart_clean_branching",
        "type": "raster",
        "path": str(REPO_ROOT / "ml/eval/import_testset/clean_line_art_branching.png"),
        "expected": "flowchart",
        "description": "Branching process flow with multiple worker pipelines"
    },
    {
        "id": "flowchart_whiteboard_markers",
        "type": "raster",
        "path": str(REPO_ROOT / "ml/eval/import_testset/whiteboard_handwritten_markers.png"),
        "expected": "flowchart",
        "description": "Hand-drawn whiteboard marker flow diagram"
    },
    {
        "id": "flowchart_whiteboard_clean",
        "type": "raster",
        "path": str(REPO_ROOT / "ml/eval/import_testset/whiteboard_clean.png"),
        "expected": "flowchart",
        "description": "Clean whiteboard system workflow"
    },
    {
        "id": "flowchart_whiteboard_skewed",
        "type": "raster",
        "path": str(REPO_ROOT / "ml/eval/import_testset/whiteboard_perspective_skew.png"),
        "expected": "flowchart",
        "description": "Tilted perspective whiteboard diagram"
    },

    # ── ER Diagrams ──
    {
        "id": "erd_entity_schema",
        "type": "raster",
        "path": str(REPO_ROOT / "ml/eval/import_testset/erd_entity_schema.png"),
        "expected": "erd",
        "description": "Entity relationship diagram with entity tables and cardinality"
    },

    # ── State Machine / Circular ──
    {
        "id": "state_machine_circular",
        "type": "raster",
        "path": str(REPO_ROOT / "ml/eval/import_testset/state_machine_circular.png"),
        "expected": "flowchart", # In heuristic classifier, non-UML/non-ER defaults to flow/state
        "description": "Circular state transition nodes"
    },

    # ── Structured Formats ──
    {
        "id": "structured_mermaid_class",
        "type": "structured",
        "format": "mermaid",
        "text": "classDiagram\n  class BankAccount {\n    +String owner\n    +BigDecimal balance\n    +deposit(amount)\n    +withdraw(amount)\n  }",
        "expected": "uml-class",
        "description": "Mermaid classDiagram syntax"
    },
    {
        "id": "structured_mermaid_flowchart",
        "type": "structured",
        "format": "mermaid",
        "text": "graph TD\n  Start[Start] --> IsValid{Is Valid?}\n  IsValid -->|Yes| Process[Process Order]\n  IsValid -->|No| Stop[Stop]",
        "expected": "flowchart",
        "description": "Mermaid flowchart with decision diamonds"
    },
    {
        "id": "structured_drawio_uml",
        "type": "structured",
        "format": "drawio",
        "text": "<mxfile><diagram><mxGraphModel><root><mxCell id=\"1\" value=\"OrderService\" style=\"swimlane;fontStyle=1;align=center;verticalAlign=top;childLayout=stackLayout;\" /></root></mxGraphModel></diagram></mxfile>",
        "expected": "uml-class",
        "description": "Draw.io mxGraph XML with swimlane UML class style"
    },
]

def run_benchmark():
    print("=" * 75)
    print("      COLLABBOARD CONTENT-TYPE CLASSIFICATION ACCURACY EVAL")
    print("=" * 75)
    print(f"Total benchmark test cases: {len(BENCHMARK_CASES)}")
    print(f"Raster test images:        {sum(1 for c in BENCHMARK_CASES if c['type'] == 'raster')}")
    print(f"Structured test files:     {sum(1 for c in BENCHMARK_CASES if c['type'] == 'structured')}")
    print("-" * 75)

    results = []
    confusion = defaultdict(lambda: defaultdict(int))
    start_time = time.time()

    for idx, case in enumerate(BENCHMARK_CASES):
        cid = case["id"]
        expected = case["expected"]
        ctype = case["type"]

        if ctype == "raster":
            img_path = Path(case["path"])
            if not img_path.exists():
                print(f"[{idx+1:02d}/{len(BENCHMARK_CASES):02d}] ⚠️ Missing image file: {img_path}")
                continue

            raw_img = Image.open(img_path).convert("RGB")
            prep_img, _ = preprocess_diagram_image(raw_img)
            w, h = prep_img.size

            ocr_regions = extract_diagram_text(prep_img)
            detected_shapes, _ = detect_shapes_and_arrows(prep_img, onnx_detector=None)

            pred_res = classify_diagram_type(detected_shapes, ocr_regions, w, h)
            predicted = pred_res["type"]
            conf = pred_res["confidence"]
            method = pred_res["method"]

        else: # structured
            # Import JS structured classifier via node subprocess
            node_code = f"""
            import {{ classifyStructuredDiagram }} from './server/import/classification/contentTypeClassifier.js';
            const res = classifyStructuredDiagram({json.dumps(case['format'])}, {json.dumps(case['text'])});
            console.log(JSON.stringify(res));
            """
            import subprocess
            proc = subprocess.run(
                ["node", "--input-type=module", "-e", node_code],
                cwd=str(REPO_ROOT),
                capture_output=True,
                text=True
            )
            try:
                pred_res = json.loads(proc.stdout.strip())
                predicted = pred_res["type"]
                conf = pred_res["confidence"]
                method = pred_res["method"]
            except Exception as ex:
                predicted = "error"
                conf = 0.0
                method = f"error: {proc.stderr}"

        is_correct = (predicted == expected)
        confusion[expected][predicted] += 1

        results.append({
            "id": cid,
            "category": ctype,
            "description": case["description"],
            "expected": expected,
            "predicted": predicted,
            "confidence": conf,
            "method": method,
            "correct": is_correct
        })

        status_icon = "[PASS]" if is_correct else "[FAIL]"
        print(f"[{idx+1:02d}/{len(BENCHMARK_CASES):02d}] {status_icon} {cid[:32]:32} | Expected: {expected:10} | Pred: {predicted:10} ({conf:.2f}) | {method}")

    elapsed = time.time() - start_time

    # ── Summary Calculations ──
    total = len(results)
    correct_total = sum(1 for r in results if r["correct"])
    overall_acc = (correct_total / total * 100.0) if total else 0.0

    raster_results = [r for r in results if r["category"] == "raster"]
    raster_correct = sum(1 for r in raster_results if r["correct"])
    raster_acc = (raster_correct / len(raster_results) * 100.0) if raster_results else 0.0

    struct_results = [r for r in results if r["category"] == "structured"]
    struct_correct = sum(1 for r in struct_results if r["correct"])
    struct_acc = (struct_correct / len(struct_results) * 100.0) if struct_results else 0.0

    # Per-class metrics
    classes = sorted(list(set(c["expected"] for c in BENCHMARK_CASES)))
    per_class = {}
    for cls in classes:
        tp = confusion[cls][cls]
        fn = sum(confusion[cls][p] for p in confusion[cls] if p != cls)
        fp = sum(confusion[actual][cls] for actual in confusion if actual != cls)
        prec = (tp / (tp + fp)) if (tp + fp) > 0 else 0.0
        rec = (tp / (tp + fn)) if (tp + fn) > 0 else 0.0
        f1 = (2 * prec * rec / (prec + rec)) if (prec + rec) > 0 else 0.0
        per_class[cls] = {
            "support": tp + fn,
            "precision": round(prec, 3),
            "recall": round(rec, 3),
            "f1_score": round(f1, 3)
        }

    print("\n" + "=" * 75)
    print("                    BENCHMARK RESULTS SUMMARY")
    print("=" * 75)
    print(f"Overall Classification Accuracy:  {overall_acc:.1f}% ({correct_total}/{total})")
    print(f"Raster Image Hit Rate:            {raster_acc:.1f}% ({raster_correct}/{len(raster_results)})")
    print(f"Structured Format Hit Rate:       {struct_acc:.1f}% ({struct_correct}/{len(struct_results)})")
    print(f"Total Evaluation Time:            {elapsed:.2f}s")
    print("-" * 75)
    print("Per-Domain Classification Metrics:")
    for cls, m in per_class.items():
        print(f"  - {cls:12}: Precision={m['precision']:.3f} | Recall={m['recall']:.3f} | F1={m['f1_score']:.3f} (n={m['support']})")
    print("=" * 75)

    # Save JSON Report
    report = {
        "benchmark_date": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_cases": total,
        "overall_accuracy": round(overall_acc, 2),
        "raster_accuracy": round(raster_acc, 2),
        "structured_accuracy": round(struct_acc, 2),
        "per_class_metrics": per_class,
        "cases": results
    }

    report_path = REPORTS_DIR / "classification_eval_report.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\n[Artifact Saved] Full evaluation metrics written to: {report_path}")

    return report

if __name__ == "__main__":
    run_benchmark()
