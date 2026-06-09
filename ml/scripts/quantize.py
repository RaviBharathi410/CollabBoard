"""Quantize ONNX models to FP16 and INT8 variants."""

from __future__ import annotations

import argparse
import time
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
from onnxruntime.quantization import QuantType, quantize_dynamic


def quantize_to_fp16(input_onnx: str, output_path: str):
    from onnxconverter_common import float16

    model = onnx.load(input_onnx)
    model_fp16 = float16.convert_float_to_float16(model, keep_io_types=True)
    onnx.save(model_fp16, output_path)
    orig_size = Path(input_onnx).stat().st_size / 1024 / 1024
    new_size = Path(output_path).stat().st_size / 1024 / 1024
    pct = (1 - new_size / orig_size) * 100 if orig_size else 0
    print(f"FP16: {orig_size:.2f} MB -> {new_size:.2f} MB ({pct:.1f}% reduction)")


def quantize_to_int8_dynamic(input_onnx: str, output_path: str):
    preprocessed = input_onnx + ".preprocessed.onnx"
    try:
        from onnxruntime.quantization.shape_inference import quant_pre_process

        quant_pre_process(input_onnx, preprocessed)
        src = preprocessed
    except Exception:
        src = input_onnx

    quantize_dynamic(
        model_input=src,
        model_output=output_path,
        weight_type=QuantType.QInt8,
        per_channel=True,
        reduce_range=False,
    )
    if Path(preprocessed).exists() and preprocessed != input_onnx:
        Path(preprocessed).unlink(missing_ok=True)

    orig_size = Path(input_onnx).stat().st_size / 1024 / 1024
    new_size = Path(output_path).stat().st_size / 1024 / 1024
    pct = (1 - new_size / orig_size) * 100 if orig_size else 0
    print(f"INT8: {orig_size:.2f} MB -> {new_size:.2f} MB ({pct:.1f}% reduction)")


def benchmark_onnx_models(model_paths: dict, test_input_shape=(1, 3, 640, 640)):
    results = {}
    dummy_input = np.random.randn(*test_input_shape).astype(np.float32)

    for name, path in model_paths.items():
        if not Path(path).exists():
            print(f"  {name}: file not found, skipping")
            continue
        sess = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
        input_name = sess.get_inputs()[0].name

        for _ in range(50):
            sess.run(None, {input_name: dummy_input})

        times = []
        for _ in range(200):
            t0 = time.perf_counter()
            sess.run(None, {input_name: dummy_input})
            times.append((time.perf_counter() - t0) * 1000)

        results[name] = {
            "mean_ms": float(np.mean(times)),
            "p50_ms": float(np.percentile(times, 50)),
            "p95_ms": float(np.percentile(times, 95)),
            "p99_ms": float(np.percentile(times, 99)),
            "size_mb": Path(path).stat().st_size / 1024 / 1024,
        }

    print(
        f"\n{'Model':<25} {'Mean (ms)':<12} {'P50':<10} {'P95':<10} {'P99':<10} {'Size (MB)':<10}"
    )
    for name, r in results.items():
        print(
            f"{name:<25} {r['mean_ms']:<12.2f} {r['p50_ms']:<10.2f} {r['p95_ms']:<10.2f} "
            f"{r['p99_ms']:<10.2f} {r['size_mb']:<10.2f}"
        )
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="ml/models/exported/diagram_detector.onnx")
    parser.add_argument("--output-dir", default="ml/models/exported")
    args = parser.parse_args()

    base = Path(args.output_dir)
    inp = Path(args.input)
    if not inp.exists():
        print(f"Model not found: {inp}. Run export_onnx.py first.")
        raise SystemExit(1)

    quantize_to_fp16(str(inp), str(base / "diagram_detector_fp16.onnx"))
    quantize_to_int8_dynamic(str(inp), str(base / "diagram_detector_int8.onnx"))
    benchmark_onnx_models(
        {
            "FP32": str(inp),
            "FP16": str(base / "diagram_detector_fp16.onnx"),
            "INT8": str(base / "diagram_detector_int8.onnx"),
        }
    )
