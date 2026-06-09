"""Benchmark ONNX model variants — wrapper around quantize.benchmark_onnx_models."""

from pathlib import Path

from quantize import benchmark_onnx_models

if __name__ == "__main__":
    base = Path("ml/models/exported")
    benchmark_onnx_models(
        {
            "FP32": str(base / "diagram_detector.onnx"),
            "FP16": str(base / "diagram_detector_fp16.onnx"),
            "INT8": str(base / "diagram_detector_int8.onnx"),
        }
    )
