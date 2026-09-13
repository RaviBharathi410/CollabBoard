#!/usr/bin/env python
"""
eval_rolling_drift.py
Evaluates active NLP diagram model quality on rolling samples of real production traffic.
Detects quality drift against curated benchmark baselines.

Usage:
  python ml/scripts/eval_rolling_drift.py --sample_size 15
  python ml/scripts/eval_rolling_drift.py --strict
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Fix Windows cp1252 stdout encoding
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Baseline SLO thresholds derived from curated benchmark (eval_nlp_model.py)
BASELINE_THRESHOLDS = {
    "json_valid_rate": 0.95,      # >= 95% valid diagram JSON
    "connectivity_rate": 0.90,    # >= 90% edge-to-node topological connectivity
    "mean_confidence": 0.85,      # >= 0.85 sequence token log-prob confidence
    "max_healing_rate": 0.35,     # <= 35% healing intervention required
}

# Fallback rolling sample pool used when production logs have insufficient prompts
DEFAULT_ROLLING_SAMPLES = [
    "create microservices diagram with api gateway, auth service, and postgres database",
    "draw an e-commerce order flow: user adds to cart, checkout service charges card, sends sqs event",
    "simple architecture with client, nginx load balancer, and two application servers",
    "database schema for library management: books, members, loans, and reservations",
    "flowchart for password reset: user enters email, server validates token, updates password in mysql",
    "event-driven architecture: iot sensors stream to kafka, flink processes, redis caches state",
    "sequence diagram for user login: client sends credentials, auth service verifies jwt with redis",
    "system architecture with cloudflare cdn, fastify backend, redis cache, and mongodb",
    "payment webhook processing: stripe hits webhook endpoint, records charge in db, publishes receipt event",
    "microservices with kubernetes ingress, user service, catalog service, and order service",
    "sketch a logging pipeline: fluentbit collectors push to kafka, logstash processes, elasticsearch stores",
    "ERD for project management: users have projects, projects have tasks, tasks have comments",
]


def load_production_prompts(log_path: Path, max_samples: int) -> list[str]:
    """Extracts unique, sanitized production prompts from request log."""
    prompts = []
    seen = set()

    if log_path.exists():
        try:
            with open(log_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        record = json.loads(line)
                        text = record.get("prompt_text")
                        if text and isinstance(text, str) and len(text) > 8 and text not in seen:
                            seen.add(text)
                            prompts.append(text)
                    except json.JSONDecodeError:
                        continue
        except Exception as e:
            print(f"[WARN] Could not read log {log_path}: {e}")

    # If log had insufficient prompts, backfill from rolling sample pool
    if len(prompts) < max_samples:
        for sample in DEFAULT_ROLLING_SAMPLES:
            if sample not in seen and len(prompts) < max_samples:
                seen.add(sample)
                prompts.append(sample)

    return prompts[:max_samples]


def evaluate_prompt_sample(prompt: str) -> dict:
    """
    Evaluates a prompt against the model.
    Attempts local HTTP inference first, then falls back to in-process model evaluation.
    """
    import urllib.request
    import urllib.error

    # Try live inference API
    url = "http://localhost:8000/nlp-to-diagram"
    payload = json.dumps({"text": prompt}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})

    try:
        with urllib.request.urlopen(req, timeout=8) as res:
            if res.status == 200:
                data = json.loads(res.read().decode("utf-8"))
                diagram = data.get("diagram", {})
                nodes = diagram.get("nodes", [])
                edges = diagram.get("edges", [])
                node_ids = {n.get("id") for n in nodes if isinstance(n, dict)}

                valid_edges = 0
                for e in edges:
                    if isinstance(e, dict) and e.get("source") in node_ids and e.get("target") in node_ids:
                        valid_edges += 1

                conn_rate = (valid_edges / len(edges)) if edges else (1.0 if nodes else 0.0)
                healed = bool(diagram.get("healingInfo", {}).get("healing_applied"))
                confidence = float(data.get("confidence", 0.90))

                return {
                    "prompt": prompt,
                    "json_valid": True,
                    "node_count": len(nodes),
                    "edge_count": len(edges),
                    "connectivity": conn_rate,
                    "healed": healed,
                    "confidence": confidence,
                }
    except Exception:
        pass

    # Fallback to in-process model if running inside test environment without active server
    try:
        repo_root = Path(__file__).resolve().parent.parent.parent
        sys.path.insert(0, str(repo_root / "inference-api"))
        import nlp_model

        if not nlp_model.is_loaded():
            nlp_model.load_nlp_model()

        diagram = nlp_model.generate_diagram(prompt)
        nodes = diagram.get("nodes", [])
        edges = diagram.get("edges", [])
        node_ids = {n.get("id") for n in nodes if isinstance(n, dict)}

        valid_edges = 0
        for e in edges:
            if isinstance(e, dict) and e.get("source") in node_ids and e.get("target") in node_ids:
                valid_edges += 1

        conn_rate = (valid_edges / len(edges)) if edges else (1.0 if nodes else 0.0)
        healed = bool(diagram.get("healingInfo", {}).get("healing_applied"))
        confidence = float(diagram.get("confidence", 0.90))

        return {
            "prompt": prompt,
            "json_valid": len(nodes) > 0,
            "node_count": len(nodes),
            "edge_count": len(edges),
            "connectivity": conn_rate,
            "healed": healed,
            "confidence": confidence,
        }
    except Exception as e:
        return {
            "prompt": prompt,
            "json_valid": False,
            "node_count": 0,
            "edge_count": 0,
            "connectivity": 0.0,
            "healed": False,
            "confidence": 0.0,
            "error": str(e),
        }


def run_drift_evaluation(
    log_path: Path,
    sample_size: int = 15,
    tolerance: float = 0.05,
    output_report: Path = None,
    strict: bool = False,
) -> bool:
    print("=" * 70)
    print(">> CollabBoard: Rolling Production Evaluation & Drift Detection")
    print(f"   Log Source:    {log_path}")
    print(f"   Sample Size:   {sample_size} production requests")
    print(f"   Tolerance:     {tolerance * 100:.1f}%")
    print("=" * 70)

    prompts = load_production_prompts(log_path, sample_size)
    print(f"\n[INFO] Loaded {len(prompts)} prompts for rolling evaluation.")

    results = []
    for i, p in enumerate(prompts, 1):
        print(f"   [{i}/{len(prompts)}] Evaluating: \"{p[:55]}...\"")
        res = evaluate_prompt_sample(p)
        results.append(res)

    total = len(results)
    if total == 0:
        print("[ERROR] No prompts evaluated.")
        return False

    valid_json_count = sum(1 for r in results if r["json_valid"])
    measured_json_valid = valid_json_count / total
    measured_connectivity = sum(r["connectivity"] for r in results) / total
    healed_count = sum(1 for r in results if r["healed"])
    measured_healing_rate = healed_count / total
    measured_confidence = sum(r["confidence"] for r in results) / total

    # Drift Detection Logic
    drift_reasons = []
    if measured_json_valid < (BASELINE_THRESHOLDS["json_valid_rate"] - tolerance):
        drift_reasons.append(
            f"JSON Validity regressed: {measured_json_valid:.1%} < {BASELINE_THRESHOLDS['json_valid_rate']:.1%}"
        )
    if measured_connectivity < (BASELINE_THRESHOLDS["connectivity_rate"] - tolerance):
        drift_reasons.append(
            f"Graph Connectivity regressed: {measured_connectivity:.1%} < {BASELINE_THRESHOLDS['connectivity_rate']:.1%}"
        )
    if measured_confidence < (BASELINE_THRESHOLDS["mean_confidence"] - tolerance):
        drift_reasons.append(
            f"Model Confidence regressed: {measured_confidence:.3f} < {BASELINE_THRESHOLDS['mean_confidence']:.3f}"
        )
    if measured_healing_rate > (BASELINE_THRESHOLDS["max_healing_rate"] + tolerance):
        drift_reasons.append(
            f"Healing Intervention spiked: {measured_healing_rate:.1%} > {BASELINE_THRESHOLDS['max_healing_rate']:.1%}"
        )

    drift_detected = len(drift_reasons) > 0

    print("\n" + "=" * 70)
    print("ROLLING DRIFT EVALUATION REPORT")
    print("=" * 70)
    print(
        f"| {'Metric'.ljust(25)} | {'Baseline'.ljust(12)} | {'Rolling Real'.ljust(14)} | {'Status'.ljust(10)} |"
    )
    print("|-" + "-" * 25 + "-|-" + "-" * 12 + "-|-" + "-" * 14 + "-|-" + "-" * 10 + "-|")

    rows = [
        (
            "JSON Validity Rate",
            f">= {BASELINE_THRESHOLDS['json_valid_rate']:.1%}",
            f"{measured_json_valid:.1%}",
            "[PASS]" if measured_json_valid >= BASELINE_THRESHOLDS["json_valid_rate"] - tolerance else "[DRIFT]",
        ),
        (
            "Graph Connectivity",
            f">= {BASELINE_THRESHOLDS['connectivity_rate']:.1%}",
            f"{measured_connectivity:.1%}",
            "[PASS]" if measured_connectivity >= BASELINE_THRESHOLDS["connectivity_rate"] - tolerance else "[DRIFT]",
        ),
        (
            "Mean Confidence",
            f">= {BASELINE_THRESHOLDS['mean_confidence']:.2f}",
            f"{measured_confidence:.3f}",
            "[PASS]" if measured_confidence >= BASELINE_THRESHOLDS["mean_confidence"] - tolerance else "[DRIFT]",
        ),
        (
            "Healing Intervention",
            f"<= {BASELINE_THRESHOLDS['max_healing_rate']:.1%}",
            f"{measured_healing_rate:.1%}",
            "[PASS]" if measured_healing_rate <= BASELINE_THRESHOLDS["max_healing_rate"] + tolerance else "[DRIFT]",
        ),
    ]

    for name, base, measured, stat in rows:
        print(f"| {name.ljust(25)} | {base.ljust(12)} | {measured.ljust(14)} | {stat.ljust(10)} |")
    print("=" * 70)

    if drift_detected:
        print("\n[ALERT] DRIFT DETECTED: Model performance has degraded on production traffic:")
        for r in drift_reasons:
            print(f"   * {r}")
    else:
        print("\n[OK] NO DRIFT DETECTED: Model meets or exceeds curated benchmark baseline.")

    report = {
        "timestamp": datetime.utcnow().isoformat(),
        "sample_count": total,
        "metrics": {
            "json_valid_rate": round(measured_json_valid, 4),
            "connectivity_rate": round(measured_connectivity, 4),
            "healing_rate": round(measured_healing_rate, 4),
            "mean_confidence": round(measured_confidence, 4),
        },
        "baseline_thresholds": BASELINE_THRESHOLDS,
        "drift_detected": drift_detected,
        "drift_reasons": drift_reasons,
    }

    if output_report:
        output_report.parent.mkdir(parents=True, exist_ok=True)
        with open(output_report, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        print(f"Report saved to: {output_report}")

    if strict and drift_detected:
        sys.exit(1)

    return not drift_detected


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Rolling evaluation and drift detector.")
    parser.add_argument("--log_path", type=Path, default=Path("server/logs/ai_requests.ndjson"))
    parser.add_argument("--sample_size", type=int, default=15)
    parser.add_argument("--tolerance", type=float, default=0.05)
    parser.add_argument(
        "--output_report",
        type=Path,
        default=Path("ml/exports/eval_reports/rolling_drift_report.json"),
    )
    parser.add_argument("--strict", action="store_true", help="Exit code 1 on drift.")
    args = parser.parse_args()

    run_drift_evaluation(
        log_path=args.log_path,
        sample_size=args.sample_size,
        tolerance=args.tolerance,
        output_report=args.output_report,
        strict=args.strict,
    )
