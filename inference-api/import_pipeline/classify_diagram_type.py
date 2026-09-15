import re
from typing import List, Dict, Any

"""
Server-side heuristic content-type classifier for raster diagram images.
Inspects detected shapes, horizontal dividing lines, and extracted OCR text
to classify the diagram domain before geometric reconstruction.
"""

UML_KEYWORDS = [
    r"<<.+>>", r"\bclass\b", r"\binterface\b", r"\bextends\b", r"\bimplements\b",
    r"\bpublic\b", r"\bprivate\b", r"\bprotected\b", r"\bvoid\b", r"\bint\b",
    r"\bfloat\b", r"\bdouble\b", r"\bstring\b", r"\bboolean\b", r"\bunsigned\b"
]

FLOWCHART_KEYWORDS = [
    r"\bstart\b", r"\bend\b", r"\byes\b", r"\bno\b", r"\btrue\b", r"\bfalse\b",
    r"\bdecision\b", r"\bprocess\b", r"\binput\b", r"\boutput\b"
]

ER_KEYWORDS = [
    r"\b1:1\b", r"\b1:n\b", r"\b1:m\b", r"\bn:m\b", r"\bfk\b", r"\bpk\b",
    r"\bforeign key\b", r"\bprimary key\b", r"\bentity\b", r"\btable\b"
]

def classify_diagram_type(
    detected_shapes: List[Dict[str, Any]],
    ocr_regions: List[Dict[str, Any]],
    orig_w: int = 1200,
    orig_h: int = 800
) -> Dict[str, Any]:
    """
    Returns {"type": "uml-class" | "flowchart" | "erd", "confidence": float, "method": "heuristic"}
    """
    ocr_text = " ".join([o.get("text", "") for o in ocr_regions]).lower()

    uml_score = 0
    fc_score = 0
    er_score = 0

    # 1. OCR keyword evaluation
    for pat in UML_KEYWORDS:
        if re.search(pat, ocr_text):
            uml_score += 1.5

    # Method parentheses and visibility markers
    if re.search(r"[\+\-\#]\s*[a-zA-Z]", ocr_text):
        uml_score += 2.5
    if re.search(r"\(\s*\)", ocr_text) or re.search(r"\([a-zA-Z0-9_\:\s\,]*\)", ocr_text):
        uml_score += 2.0

    for pat in FLOWCHART_KEYWORDS:
        if re.search(pat, ocr_text):
            fc_score += 1.5

    for pat in ER_KEYWORDS:
        if re.search(pat, ocr_text):
            er_score += 2.0

    # 2. Geometric Shape analysis
    diamond_count = sum(1 for s in detected_shapes if s.get("class_name") == "diamond" or s.get("type") == "diamond")
    if diamond_count > 0:
        fc_score += diamond_count * 2.0

    # Check for vertically stacked boxes or internal horizontal dividers (UML class signature)
    rectangles = [
        s for s in detected_shapes
        if s.get("class_name") in ["rectangle", "box"] or s.get("type") in ["rectangle", "box"]
    ]
    stacked_pairs = 0
    for i in range(len(rectangles)):
        for j in range(i + 1, len(rectangles)):
            b1 = rectangles[i].get("box", [0, 0, 0, 0])
            b2 = rectangles[j].get("box", [0, 0, 0, 0])
            # Check if widths and x-coordinates closely match and boxes touch vertically
            x_diff = abs(b1[0] - b2[0])
            w_diff = abs((b1[2] - b1[0]) - (b2[2] - b2[0]))
            v_gap = min(abs(b1[3] - b2[1]), abs(b2[3] - b1[1]))
            if x_diff < 20 and w_diff < 20 and v_gap < 15:
                stacked_pairs += 1

    if stacked_pairs >= 2:
        uml_score += 3.0

    # Compute winner
    max_score = max(uml_score, fc_score, er_score)
    if max_score < 1.0:
        return {"type": "flowchart", "confidence": 0.60, "method": "heuristic_default"}

    if uml_score >= fc_score and uml_score >= er_score:
        confidence = min(0.95, round(0.65 + uml_score * 0.04, 2))
        return {"type": "uml-class", "confidence": confidence, "method": "heuristic"}

    if er_score >= fc_score:
        confidence = min(0.90, round(0.65 + er_score * 0.05, 2))
        return {"type": "erd", "confidence": confidence, "method": "heuristic"}

    confidence = min(0.90, round(0.65 + fc_score * 0.05, 2))
    return {"type": "flowchart", "confidence": confidence, "method": "heuristic"}
