import math
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
import cv2
from PIL import Image

"""
Shape and Arrow Detector for Diagram Import

Two-tiered detection architecture:
1. Primary tier: Local ONNX diagram detector (when valid model with non-underflowing head is loaded).
2. Resilient Computer Vision tier: Geometric contour analysis, polygon approximation, and
   Hough arrow vector extraction. Activates automatically if ONNX detector is unavailable
   or returns 0 candidates due to confidence thresholds or weight underflow.
"""

def detect_shapes_and_arrows(
    image_input: Any,
    onnx_detector: Optional[Any] = None,
    conf_threshold: float = 0.25
) -> Tuple[List[Dict[str, Any]], str]:
    """
    Detects shape candidates (rectangles, circles, diamonds, databases) and arrows.
    Returns (detections, method_used).
    """
    if isinstance(image_input, Image.Image):
        pil_img = image_input
        rgb = np.array(pil_img.convert("RGB"))
        cv_img = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
        w, h = pil_img.size
    else:
        cv_img = image_input.copy()
        rgb = cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(rgb)
        h, w = cv_img.shape[:2]

    # Tier 1: Try ONNX detector if available
    if onnx_detector is not None:
        try:
            onnx_dets = onnx_detector.predict(pil_img, conf_threshold=conf_threshold)
            if onnx_dets and len(onnx_dets) > 0:
                return onnx_dets, "onnx_model"
        except Exception as e:
            print(f"[Shape Detector] ONNX prediction failed: {e}. Falling back to geometric CV.")

    # Tier 2: Resilient Geometric Computer Vision
    cv_dets = detect_shapes_cv(cv_img)
    return cv_dets, "geometric_cv_fallback"

def detect_shapes_cv(cv_img: np.ndarray) -> List[Dict[str, Any]]:
    """
    Detects diagram shapes and arrows using adaptive thresholding, contour polygon
    approximation, and directional line/arrow vector matching.
    """
    h, w = cv_img.shape[:2]
    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY) if len(cv_img.shape) == 3 else cv_img.copy()

    # Bilateral smoothing to preserve edges while removing background noise
    blurred = cv2.bilateralFilter(gray, 7, 50, 50)

    # Adaptive threshold to isolate ink/lines from variable whiteboard lighting
    thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 6
    )

    # Clean small noise
    kernel_fill = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    binary = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel_fill)

    # Find contours with full hierarchy (parent/child)
    contours, hierarchy = cv2.findContours(binary, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)

    detections = []
    shape_boxes = []

    # 1. SHAPE DETECTION PASS
    if contours is not None and len(contours) > 0:
        candidates = []
        for i, cnt in enumerate(contours):
            area = cv2.contourArea(cnt)
            min_shape_area = max(800.0, (w * h) * 0.002)
            max_shape_area = (w * h) * 0.65

            if area < min_shape_area or area > max_shape_area:
                continue

            bx, by, bw, bh = cv2.boundingRect(cnt)

            # Outer canvas frame filter: reject giant bounding boxes that frame the entire diagram
            if (bw > 0.82 * w and bh > 0.82 * h) or area > (w * h) * 0.45:
                continue

            aspect = bw / float(bh + 1e-5)

            # Avoid extreme line-like aspect ratios
            if aspect < 0.25 or aspect > 4.5:
                continue

            perimeter = cv2.arcLength(cnt, True)
            circularity = (4.0 * math.pi * area) / (perimeter * perimeter + 1e-5)
            approx = cv2.approxPolyDP(cnt, 0.035 * perimeter, True)

            candidates.append({
                "box": (bx, by, bw, bh),
                "area": area,
                "circularity": circularity,
                "approx": approx,
                "aspect": aspect
            })

        # Sort candidates: prefer cleaner inner/outer boxes without arrow attachments
        # Filter out larger boxes that simply enclose an inner box with >80% overlap
        filtered_candidates = []
        for c in sorted(candidates, key=lambda x: x["area"]):
            bx, by, bw, bh = c["box"]
            is_enclosed_or_dup = False
            for fc in filtered_candidates:
                fx, fy, fw, fh = fc["box"]
                # Check intersection over min area
                ix1 = max(bx, fx)
                iy1 = max(by, fy)
                ix2 = min(bx + bw, fx + fw)
                iy2 = min(by + bh, fy + fh)
                if ix2 > ix1 and iy2 > iy1:
                    inter_area = (ix2 - ix1) * (iy2 - iy1)
                    min_area = min(bw * bh, fw * fh)
                    if inter_area / float(min_area) > 0.70:
                        is_enclosed_or_dup = True
                        break
            if not is_enclosed_or_dup:
                filtered_candidates.append(c)

        # Multi-compartment table/class merger:
        # Detects vertically stacked compartments sharing left X and width (e.g. UML class name + attributes + methods)
        c_boxes = [dict(c) for c in filtered_candidates]
        has_merged = True
        while has_merged:
            has_merged = False
            next_boxes = []
            used_indices = set()
            for i in range(len(c_boxes)):
                if i in used_indices:
                    continue
                b1 = c_boxes[i]["box"]
                merged_any = False
                for j in range(i + 1, len(c_boxes)):
                    if j in used_indices:
                        continue
                    b2 = c_boxes[j]["box"]
                    x_diff = abs(b1[0] - b2[0])
                    w1 = b1[2]
                    w2 = b2[2]
                    w_diff = abs(w1 - w2)

                    top_box = b1 if b1[1] <= b2[1] else b2
                    bot_box = b2 if b1[1] <= b2[1] else b1
                    v_gap = bot_box[1] - (top_box[1] + top_box[3])

                    if x_diff <= 16 and w_diff <= 16 and -8 <= v_gap <= 14:
                        mx1 = min(b1[0], b2[0])
                        my1 = min(b1[1], b2[1])
                        mx2 = max(b1[0] + b1[2], b2[0] + b2[2])
                        my2 = max(b1[1] + b1[3], b2[1] + b2[3])
                        mw = mx2 - mx1
                        mh = my2 - my1
                        new_item = {
                            "box": (mx1, my1, mw, mh),
                            "area": float(mw * mh),
                            "circularity": 0.0,
                            "approx": np.array([[mx1, my1], [mx2, my1], [mx2, my2], [mx1, my2]]),
                            "aspect": mw / float(mh + 1e-5),
                        }
                        next_boxes.append(new_item)
                        used_indices.add(i)
                        used_indices.add(j)
                        has_merged = True
                        merged_any = True
                        break
                if not merged_any and i not in used_indices:
                    next_boxes.append(c_boxes[i])
                    used_indices.add(i)
            c_boxes = next_boxes

        filtered_candidates = c_boxes

        for c in filtered_candidates:
            bx, by, bw, bh = c["box"]
            aspect = c["aspect"]
            circularity = c["circularity"]
            approx = c["approx"]
            num_vertices = len(approx)

            class_name = "rectangle"
            confidence = 0.85

            if circularity > 0.68 and 0.75 <= aspect <= 1.35:
                class_name = "circle"
                confidence = float(min(0.95, round(circularity, 2)))
            elif num_vertices == 4:
                pts = approx.reshape(-1, 2)
                center_x, center_y = bx + bw / 2.0, by + bh / 2.0
                top_pt = min(pts, key=lambda p: p[1])
                bottom_pt = max(pts, key=lambda p: p[1])
                if abs(top_pt[0] - center_x) < (bw * 0.25) and abs(bottom_pt[0] - center_x) < (bw * 0.25) and 0.7 <= aspect <= 1.4:
                    class_name = "diamond"
                    confidence = 0.86
                else:
                    class_name = "rectangle"
                    confidence = 0.88
            elif 0.5 <= aspect <= 0.8 and num_vertices in [4, 5, 6]:
                class_name = "database"
                confidence = 0.80
            else:
                class_name = "rectangle"
                confidence = 0.82

            shape_boxes.append((bx, by, bw, bh))
            detections.append({
                "class_name": class_name,
                "confidence": float(confidence),
                "box": [float(bx), float(by), float(bx + bw), float(by + bh)],
                "bbox_normalized": [
                    float((bx + bw / 2.0) / w),
                    float((by + bh / 2.0) / h),
                    float(bw / w),
                    float(bh / h)
                ]
            })

    # 2. ARROW & CONNECTOR DETECTION PASS
    edges_img = cv2.Canny(gray, 50, 150)
    lines = cv2.HoughLinesP(
        edges_img,
        rho=1,
        theta=np.pi / 180,
        threshold=25,
        minLineLength=30,
        maxLineGap=10
    )

    if lines is not None:
        merged_connectors = []
        for line in lines:
            coords = line.flatten()
            if len(coords) < 4:
                continue
            x1, y1, x2, y2 = int(coords[0]), int(coords[1]), int(coords[2]), int(coords[3])
            length = math.hypot(x2 - x1, y2 - y1)
            if length < 30:
                continue

            # Check if this line is fully contained inside any shape interior
            inside_any_shape = False
            for (sx, sy, sw, sh) in shape_boxes:
                # Add inner margin
                if (sx + 8 <= x1 <= sx + sw - 8 and sy + 8 <= y1 <= sy + sh - 8 and
                    sx + 8 <= x2 <= sx + sw - 8 and sy + 8 <= y2 <= sy + sh - 8):
                    inside_any_shape = True
                    break
                # Shape perimeter line
                on_border = (
                    (abs(x1 - sx) < 6 or abs(x1 - (sx + sw)) < 6 or abs(y1 - sy) < 6 or abs(y1 - (sy + sh)) < 6) and
                    (abs(x2 - sx) < 6 or abs(x2 - (sx + sw)) < 6 or abs(y2 - sy) < 6 or abs(y2 - (sy + sh)) < 6)
                )
                if on_border:
                    inside_any_shape = True
                    break

            if inside_any_shape:
                continue

            # Orient left-to-right or top-to-bottom
            if x1 > x2 or (x1 == x2 and y1 > y2):
                x1, x2 = x2, x1
                y1, y2 = y2, y1

            # Check deduplication with existing connectors
            is_dup = False
            for mc in merged_connectors:
                mx1, my1, mx2, my2 = mc
                if (abs(x1 - mx1) < 25 and abs(y1 - my1) < 25 and
                    abs(x2 - mx2) < 25 and abs(y2 - my2) < 25):
                    is_dup = True
                    break

            if not is_dup:
                merged_connectors.append((x1, y1, x2, y2))
                detections.append({
                    "class_name": "arrow",
                    "confidence": 0.80,
                    "box": [float(x1), float(min(y1, y2)), float(x2), float(max(y1, y2))],
                    "bbox_normalized": [
                        float((x1 + x2) / 2.0 / w),
                        float((y1 + y2) / 2.0 / h),
                        float(abs(x2 - x1) / w),
                        float(max(10, abs(y2 - y1)) / h)
                    ]
                })

    return detections
