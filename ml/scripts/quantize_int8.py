import argparse
import os
from pathlib import Path
import onnx
from onnxruntime.quantization import quantize_dynamic, QuantType

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--onnx_model", required=True, type=str)
    parser.add_argument("--output", required=True, type=str)
    args = parser.parse_args()

    model_path = Path(args.onnx_model)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Loading ONNX model: {model_path}")
    onnx_model = onnx.load(str(model_path))

    print("Running INT8 dynamic quantization...")
    # Quantize weights to int8 dynamically, which is friendly for browser WebGL/WebGPU runners
    quantize_dynamic(
        model_input=str(model_path),
        model_output=str(output_path),
        weight_type=QuantType.QUInt8
    )

    print(f"Quantized model successfully saved to: {output_path}")

if __name__ == "__main__":
    main()
