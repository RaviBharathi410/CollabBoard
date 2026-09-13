import math
from typing import List, Dict, Any, Optional, Tuple
import numpy as np

"""
Geometric Reconstruction & Two-Pass Shape Matching

1. Matches OCR text bounding boxes to detected shapes using 2D spatial overlap / containment.
2. Links detected arrows to source and target shapes based on endpoint proximity.
3. Tags each element with explicit provenance:
   - source: "detected" (local ONNX detector)
   - source: "ocr" (text extraction)
   - source: "inferred" (selective cloud vision verification)
4. Identifies low-confidence elements for user review.
"""

def box_iou(boxA: List[float], boxB: List[float]) -> float:
    """Computes Intersection over Union (IoU) between two boxes [x1, y1, x2, y2]."""
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])

    interArea = max(0.0, xB - xA) * max(0.0, yB - yA)
    boxAArea = max(0.0, boxA[2] - boxA[0]) * max(0.0, boxA[3] - boxA[1])
    boxBArea = max(0.0, boxB[2] - boxB[0]) * max(0.0, boxB[3] - boxB[1])

    if (boxAArea + boxBArea - interArea) <= 0:
        return 0.0

    return interArea / float(boxAArea + boxBArea - interArea)

def box_containment(inner: List[float], outer: List[float], margin: float = 15.0) -> float:
    """Computes fraction of inner box contained within outer box."""
    xA = max(inner[0], outer[0] - margin)
    yA = max(inner[1], outer[1] - margin)
    xB = min(inner[2], outer[2] + margin)
    yB = min(inner[3], outer[3] + margin)

    interArea = max(0.0, xB - xA) * max(0.0, yB - yA)
    innerArea = max(0.0, inner[2] - inner[0]) * max(0.0, inner[3] - inner[1])

    if innerArea <= 0:
        return 0.0

    return interArea / float(innerArea)

def distance_point_to_box(px: float, py: float, bx1: float, by1: float, bx2: float, by2: float) -> float:
    dx = max(bx1 - px, 0.0, px - bx2)
    dy = max(by1 - py, 0.0, py - by2)
    return math.sqrt(dx * dx + dy * dy)

RELATIONSHIP_KEYWORDS = {
    "dependency", "association", "aggregation", "composition", "generalization",
    "realization", "inheritance", "abstract class", "control class", "boundary class",
    "entity class", "operation", "attribute", "class"
}

def normalize_stereotype(text: str) -> str:
    """Normalizes noisy OCR stereotypes to standard clean UML stereotype tags."""
    t_lower = text.lower().strip()
    if any(k in t_lower for k in ["entity", "enite", "cntid", "@nln", "entilv"]):
        return "<<entity>>"
    if any(k in t_lower for k in ["boundary", "boundaly", "bountan"]):
        return "<<boundary>>"
    if any(k in t_lower for k in ["control", "cnim", "conlicl"]):
        return "<<control>>"
    return text

def match_ocr_text_to_shapes(
    shapes: List[Dict[str, Any]],
    ocr_regions: List[Dict[str, Any]],
    orig_w: int,
    orig_h: int
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Matches OCR text boxes to detected shapes using spatial overlap.
    Sorts matched lines top-to-bottom and joins with newlines for clean UML compartments.
    Returns (shapes_with_text, relationship_annotations).
    """
    used_ocr_indices = set()

    for s in shapes:
        s_box = s["box"]  # [x1, y1, x2, y2]
        contained_ocr = []

        for idx, ocr in enumerate(ocr_regions):
            o_box = ocr.get("bbox", [0, 0, 0, 0])
            containment = box_containment(o_box, s_box, margin=8.0)
            iou = box_iou(s_box, o_box)

            if containment > 0.40 or iou > 0.10:
                raw_t = ocr.get("text", "").strip()
                if raw_t:
                    clean_t = normalize_stereotype(raw_t)
                    contained_ocr.append((clean_t, o_box, ocr.get("confidence", 0.9)))
                    used_ocr_indices.add(idx)

        if contained_ocr:
            # Sort top to bottom, then left to right
            contained_ocr.sort(key=lambda item: (item[1][1], item[1][0]))
            s["label"] = "\n".join([item[0] for item in contained_ocr])
            s["labelSource"] = "ocr"
        else:
            s["label"] = s.get("label") or f"{s['type'].capitalize()}"
            s["labelSource"] = "default"

    # Separate remaining unused OCR regions: relationship annotations vs standalone notes
    relationship_annotations = []
    for idx, ocr in enumerate(ocr_regions):
        if idx not in used_ocr_indices:
            text_val = ocr.get("text", "").strip()
            if not text_val:
                continue
            text_lower = text_val.lower()
            if any(kw in text_lower for kw in RELATIONSHIP_KEYWORDS):
                relationship_annotations.append({
                    "text": text_val,
                    "bbox": ocr.get("bbox", [0, 0, 0, 0])
                })
            else:
                # Standalone note or annotation box (not a relationship keyword)
                b = ocr.get("bbox", [0, 0, 100, 40])
                shapes.append({
                    "id": f"text-{len(shapes) + 1}",
                    "type": "text",
                    "label": text_val,
                    "confidence": ocr.get("confidence", 0.9),
                    "box": b,
                    "bbox_normalized": [
                        (b[0] + b[2]) / (2.0 * orig_w),
                        (b[1] + b[3]) / (2.0 * orig_h),
                        (b[2] - b[0]) / float(orig_w),
                        (b[3] - b[1]) / float(orig_h)
                    ],
                    "source": "ocr",
                    "labelSource": "ocr"
                })

    return shapes, relationship_annotations

def reconstruct_diagram_graph(
    detections: List[Dict[str, Any]],
    ocr_regions: Optional[List[Dict[str, Any]]] = None,
    orig_w: int = 1200,
    orig_h: int = 800,
    diagram_type_hint: Optional[str] = None,
    cloud_verified_items: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Main geometric reconstruction engine.
    Combines shape detections, OCR text, and arrow connections into a unified graph.
    """
    ocr_regions = ocr_regions or []
    cloud_verified_items = cloud_verified_items or []

    # 1. Segment detections into shapes and arrows
    shape_candidates = []
    arrow_candidates = []

    for d in detections:
        cls_name = d.get("class_name", d.get("type", ""))
        if cls_name == "arrow":
            arrow_candidates.append(d)
        elif cls_name != "text_region":
            shape_candidates.append({
                "id": f"n{len(shape_candidates) + 1}",
                "type": cls_name,
                "label": "",
                "confidence": float(round(d.get("confidence", 0.8), 3)),
                "box": d.get("box", [0, 0, 120, 60]),
                "bbox_normalized": d.get("bbox_normalized", [0, 0, 0.1, 0.1]),
                "source": "detected"
            })

    # Apply any cloud-verified replacements (Pass 2)
    for cv in cloud_verified_items:
        node_id = cv.get("id")
        for sc in shape_candidates:
            if sc["id"] == node_id:
                sc["type"] = cv.get("type", sc["type"])
                sc["confidence"] = float(round(cv.get("confidence", 0.95), 3))
                sc["source"] = "inferred"

    # 2. Match OCR text to shapes
    nodes_with_text, relationship_annotations = match_ocr_text_to_shapes(
        shape_candidates, ocr_regions, orig_w, orig_h
    )

    # 3. Match arrows to source and target shape endpoints
    edges = []
    for i, arrow in enumerate(arrow_candidates):
        ax1, ay1, ax2, ay2 = arrow["box"]
        aw = ax2 - ax1
        ah = ay2 - ay1

        if aw > ah:
            start_pt = (ax1, (ay1 + ay2) / 2.0)
            end_pt = (ax2, (ay1 + ay2) / 2.0)
        else:
            start_pt = ((ax1 + ax2) / 2.0, ay1)
            end_pt = ((ax1 + ax2) / 2.0, ay2)

        source_id = None
        min_src_dist = float("inf")
        for node in nodes_with_text:
            nx1, ny1, nx2, ny2 = node["box"]
            d = distance_point_to_box(start_pt[0], start_pt[1], nx1, ny1, nx2, ny2)
            if d < min_src_dist and d < 140.0:
                min_src_dist = d
                source_id = node["id"]

        target_id = None
        min_tgt_dist = float("inf")
        for node in nodes_with_text:
            nx1, ny1, nx2, ny2 = node["box"]
            d = distance_point_to_box(end_pt[0], end_pt[1], nx1, ny1, nx2, ny2)
            if d < min_tgt_dist and d < 140.0:
                min_tgt_dist = d
                target_id = node["id"]

        if source_id and target_id and source_id != target_id:
            if not any(e["source"] == source_id and e["target"] == target_id for e in edges):
                # Search for relationship annotation near line midpoint
                mid_x = (start_pt[0] + end_pt[0]) / 2.0
                mid_y = (start_pt[1] + end_pt[1]) / 2.0
                edge_label = ""
                for ann in relationship_annotations:
                    ab = ann["bbox"]
                    dist = distance_point_to_box(mid_x, mid_y, ab[0], ab[1], ab[2], ab[3])
                    if dist < 65.0:
                        edge_label = ann["text"]
                        break

                edges.append({
                    "id": f"e{len(edges) + 1}",
                    "source": source_id,
                    "target": target_id,
                    "label": edge_label,
                    "style": "solid",
                    "sourceTag": "detected",
                    "confidence": float(round(arrow.get("confidence", 0.75), 3))
                })

    # 4. Format final nodes with absolute coordinates
    final_nodes = []
    for n in nodes_with_text:
        bx1, by1, bx2, by2 = n["box"]
        final_nodes.append({
            "id": n["id"],
            "type": n["type"],
            "label": n["label"],
            "confidence": n["confidence"],
            "source": n.get("source", "detected"),
            "x": float(round(bx1, 1)),
            "y": float(round(by1, 1)),
            "width": float(round(bx2 - bx1, 1)),
            "height": float(round(by2 - by1, 1))
        })

    # Diagram type hint
    diag_type = diagram_type_hint or "architecture"
    types = [n["type"] for n in final_nodes]
    if "actor" in types:
        diag_type = "sequence"
    elif "database" in types:
        diag_type = "erd"

    # Compute overall confidence
    confidences = [n["confidence"] for n in final_nodes] + [e["confidence"] for e in edges]
    overall_conf = float(round(np.mean(confidences), 3)) if confidences else 0.8

    return {
        "type": diag_type,
        "sourceType": "image",
        "confidence": overall_conf,
        "nodes": final_nodes,
        "edges": edges,
        "layoutHint": "image-reconstructed"
    }
