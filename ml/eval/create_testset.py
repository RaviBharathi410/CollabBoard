import os
import json
import math
from pathlib import Path
import numpy as np
import cv2
from PIL import Image

"""
Curated Test Set Generator for Import Precision Evaluation

Precision Principle:
1. Structured diagram files (.drawio, .mmd, .svg) are exact and parsed deterministically.
2. Image inputs represent realistic, varied diagram visual inputs spanning:
   - Clean digital line art
   - Perspective and angular skew
   - Uneven illumination & whiteboard glare
   - Sensor noise, shadow gradients, and eraser smudges
   - Handwritten/marker-style variation
   - Dense branching flowcharts and state machines

Every test item defines explicit ground truth for node types, expected labels, and edge count.
"""

TESTSET_DIR = Path(__file__).resolve().parent / "import_testset"
TESTSET_DIR.mkdir(parents=True, exist_ok=True)

# ==============================================================================
# 1. STRUCTURED DIAGRAM FIXTURES
# ==============================================================================

DRAWIO_CONTENT = """<mxfile host="app.diagrams.net">
  <diagram id="d1" name="Architecture">
    <mxGraphModel>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="n1" value="Web Frontend" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1">
          <mxGeometry x="60" y="80" width="140" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="n2" value="API Gateway" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1">
          <mxGeometry x="260" y="80" width="140" height="60" as="geometry"/>
        </mxCell>
        <mxCell id="n3" value="Postgres DB" style="shape=cylinder;whiteSpace=wrap;html=1;" vertex="1" parent="1">
          <mxGeometry x="460" y="70" width="100" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="n4" value="Redis Cache" style="ellipse;whiteSpace=wrap;html=1;" vertex="1" parent="1">
          <mxGeometry x="290" y="200" width="80" height="80" as="geometry"/>
        </mxCell>
        <mxCell id="e1" value="HTTPS" style="edgeStyle=orthogonalEdgeStyle;" edge="1" parent="1" source="n1" target="n2">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="e2" value="SQL" style="edgeStyle=orthogonalEdgeStyle;" edge="1" parent="1" source="n2" target="n3">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
        <mxCell id="e3" value="Cache" style="edgeStyle=orthogonalEdgeStyle;dashed=1;" edge="1" parent="1" source="n2" target="n4">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>"""

MERMAID_CONTENT = """graph TD
  client[Client App] -->|Request| gateway(API Gateway)
  gateway --> auth{Authorized?}
  auth -->|Yes| service([Order Service])
  service --> db[(Order Database)]
"""

SVG_CONTENT = """<svg width="600" height="300" xmlns="http://www.w3.org/2000/svg">
  <rect id="svg-n1" x="50" y="60" width="120" height="60" fill="#E8F0FE" stroke="#1A73E8" />
  <text x="70" y="95">Client App</text>
  <rect id="svg-n2" x="250" y="60" width="140" height="60" fill="#E8F0FE" stroke="#1A73E8" />
  <text x="270" y="95">Processing API</text>
  <circle id="svg-n3" cx="480" cy="90" r="40" fill="#CEEAD6" stroke="#1E8E3E" />
  <text x="460" y="95">Worker</text>
  <line id="svg-e1" x1="170" y1="90" x2="250" y2="90" stroke="#5F6368" />
  <line id="svg-e2" x1="390" y1="90" x2="440" y2="90" stroke="#5F6368" />
</svg>"""

# ==============================================================================
# 2. IMAGE FIXTURES GENERATOR (10 Varied Test Images)
# ==============================================================================

def create_img_clean_3node():
    """1. Clean Digital Line Art: 3 nodes (2 rect, 1 circle), 2 arrows."""
    img = np.ones((500, 700, 3), dtype=np.uint8) * 255
    cv2.rectangle(img, (60, 180), (200, 280), (30, 30, 30), 2)
    cv2.putText(img, "Ingestion", (80, 235), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (20, 20, 20), 2)

    cv2.arrowedLine(img, (205, 230), (315, 230), (30, 30, 30), 2, tipLength=0.15)

    cv2.rectangle(img, (320, 180), (470, 280), (30, 30, 30), 2)
    cv2.putText(img, "Transformer", (330, 235), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (20, 20, 20), 2)

    cv2.arrowedLine(img, (475, 230), (555, 230), (30, 30, 30), 2, tipLength=0.15)

    cv2.circle(img, (610, 230), 45, (30, 30, 30), 2)
    cv2.putText(img, "DB", (595, 235), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (20, 20, 20), 2)
    return img

def create_img_clean_branching():
    """2. Clean Branching Architecture: 4 nodes, 3 arrows."""
    img = np.ones((550, 750, 3), dtype=np.uint8) * 255
    # Gateway
    cv2.rectangle(img, (60, 220), (190, 310), (30, 30, 30), 2)
    cv2.putText(img, "Gateway", (85, 270), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (20, 20, 20), 2)

    # Branch to Worker 1
    cv2.arrowedLine(img, (195, 250), (305, 160), (30, 30, 30), 2, tipLength=0.15)
    cv2.rectangle(img, (310, 110), (450, 200), (30, 30, 30), 2)
    cv2.putText(img, "Worker 1", (335, 160), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (20, 20, 20), 2)

    # Branch to Worker 2
    cv2.arrowedLine(img, (195, 280), (305, 370), (30, 30, 30), 2, tipLength=0.15)
    cv2.rectangle(img, (310, 330), (450, 420), (30, 30, 30), 2)
    cv2.putText(img, "Worker 2", (335, 380), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (20, 20, 20), 2)

    # Both converge to Database
    cv2.arrowedLine(img, (455, 160), (565, 240), (30, 30, 30), 2, tipLength=0.15)
    cv2.circle(img, (620, 265), 50, (30, 30, 30), 2)
    cv2.putText(img, "Storage", (590, 270), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (20, 20, 20), 2)
    return img

def create_img_perspective_skew():
    """3. Whiteboard with perspective skew & camera tilt (12 degrees)."""
    base = create_img_clean_3node()
    h, w = base.shape[:2]
    # Subtle background tone
    base = np.clip(base.astype(np.int32) - 15, 0, 255).astype(np.uint8)
    rot_mat = cv2.getRotationMatrix2D((w // 2, h // 2), 11.5, 0.96)
    skewed = cv2.warpAffine(base, rot_mat, (w, h), borderValue=(235, 235, 235))
    return skewed

def create_img_uneven_lighting():
    """4. Whiteboard with severe non-uniform lighting / glare gradient across surface."""
    base = create_img_clean_3node()
    h, w = base.shape[:2]
    # Create diagonal gradient representing sunlight / spotlight glare
    glare = np.zeros((h, w), dtype=np.float32)
    for y in range(h):
        for x in range(w):
            glare[y, x] = max(0.0, 1.0 - math.hypot(x - 100, y - 50) / 700.0)

    # Blend glare: washes out top-left, darkens bottom-right
    base_f = base.astype(np.float32)
    for c in range(3):
        base_f[:, :, c] = np.clip(base_f[:, :, c] * (0.65 + 0.45 * glare) + 40 * glare, 0, 255)
    return base_f.astype(np.uint8)

def create_img_shadow_smudge():
    """5. Whiteboard with diagonal shadow cast and dry-erase marker residue."""
    base = create_img_clean_branching()
    h, w = base.shape[:2]
    # Diagonal shadow across lower half
    shadow = np.ones((h, w), dtype=np.float32)
    for y in range(h):
        for x in range(w):
            if y + x * 0.4 > 350:
                shadow[y, x] = 0.68

    # Eraser smudge streaks
    base_f = base.astype(np.float32)
    for c in range(3):
        base_f[:, :, c] = base_f[:, :, c] * shadow

    # Add Gaussian camera noise
    noise = np.random.normal(0, 8, (h, w, 3))
    noisy = np.clip(base_f + noise, 0, 255).astype(np.uint8)
    # Draw gray smudge patches
    cv2.circle(noisy, (230, 240), 60, (210, 210, 210), -1)
    # Blend back slightly so diagram lines show through smudge
    noisy = cv2.addWeighted(noisy, 0.88, cv2.GaussianBlur(noisy, (5, 5), 0), 0.12, 0)
    return noisy

def create_img_handwritten_markers():
    """6. Hand-drawn whiteboard style with irregular stroke widths and marker wobble."""
    img = np.ones((500, 700, 3), dtype=np.uint8) * 242
    # Marker wobble polyline for box 1
    pts1 = np.array([[70, 160], [210, 155], [215, 270], [68, 275]], np.int32)
    cv2.polylines(img, [pts1], isClosed=True, color=(25, 25, 30), thickness=3)
    cv2.putText(img, "Client", (100, 225), cv2.FONT_HERSHEY_SCRIPT_SIMPLEX, 0.8, (20, 20, 20), 2)

    # Wobbly arrow
    cv2.arrowedLine(img, (220, 215), (325, 218), (25, 25, 30), 3, tipLength=0.18)

    # Box 2: Server
    pts2 = np.array([[330, 150], [480, 153], [485, 280], [328, 278]], np.int32)
    cv2.polylines(img, [pts2], isClosed=True, color=(25, 25, 30), thickness=3)
    cv2.putText(img, "Server", (360, 225), cv2.FONT_HERSHEY_SCRIPT_SIMPLEX, 0.8, (20, 20, 20), 2)

    # Wobbly arrow
    cv2.arrowedLine(img, (490, 215), (575, 215), (25, 25, 30), 3, tipLength=0.18)

    # Circle: DB
    cv2.circle(img, (625, 215), 42, (25, 25, 30), 3)
    cv2.putText(img, "DB", (612, 222), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (20, 20, 20), 2)
    return img

def create_img_architecture_doc():
    """7. Digital architecture document screenshot with subtle grid background."""
    img = np.ones((500, 700, 3), dtype=np.uint8) * 250
    # Subtle 20px grid
    for x in range(0, 700, 20):
        cv2.line(img, (x, 0), (x, 500), (238, 240, 242), 1)
    for y in range(0, 500, 20):
        cv2.line(img, (0, y), (700, y), (238, 240, 242), 1)

    # Clean UI boxes with colored header strips
    # Box 1
    cv2.rectangle(img, (60, 170), (200, 270), (45, 115, 220), 2)
    cv2.putText(img, "Auth Service", (75, 225), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (30, 30, 30), 2)

    cv2.arrowedLine(img, (205, 220), (315, 220), (100, 100, 100), 2, tipLength=0.15)

    # Box 2
    cv2.rectangle(img, (320, 170), (470, 270), (45, 115, 220), 2)
    cv2.putText(img, "User Service", (335, 225), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (30, 30, 30), 2)

    cv2.arrowedLine(img, (475, 220), (555, 220), (100, 100, 100), 2, tipLength=0.15)

    # Box 3
    cv2.rectangle(img, (560, 170), (670, 270), (35, 160, 90), 2)
    cv2.putText(img, "Cache", (585, 225), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (30, 30, 30), 2)
    return img

def create_img_state_machine():
    """8. State Machine Diagram: 3 circular states with transition arrows."""
    img = np.ones((500, 700, 3), dtype=np.uint8) * 255
    # State 1: Idle
    cv2.circle(img, (140, 250), 55, (30, 30, 30), 2)
    cv2.putText(img, "Idle", (120, 255), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (20, 20, 20), 2)

    # Transition 1 -> 2
    cv2.arrowedLine(img, (200, 250), (300, 250), (30, 30, 30), 2, tipLength=0.15)

    # State 2: Running
    cv2.circle(img, (360, 250), 55, (30, 30, 30), 2)
    cv2.putText(img, "Running", (330, 255), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (20, 20, 20), 2)

    # Transition 2 -> 3
    cv2.arrowedLine(img, (420, 250), (520, 250), (30, 30, 30), 2, tipLength=0.15)

    # State 3: Finished
    cv2.circle(img, (580, 250), 55, (30, 30, 30), 2)
    cv2.putText(img, "Finished", (548, 255), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (20, 20, 20), 2)
    return img

def create_img_erd_schema():
    """9. ERD Schema Diagram: 3 rectangular entity tables."""
    img = np.ones((500, 720, 3), dtype=np.uint8) * 255
    # Entity 1: User
    cv2.rectangle(img, (50, 150), (200, 290), (30, 30, 30), 2)
    cv2.putText(img, "User", (95, 185), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (20, 20, 20), 2)
    cv2.line(img, (50, 200), (200, 200), (80, 80, 80), 1)
    cv2.putText(img, "id", (65, 230), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (40, 40, 40), 1)
    cv2.putText(img, "email", (65, 260), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (40, 40, 40), 1)

    # Relation 1 -> 2
    cv2.line(img, (205, 220), (315, 220), (30, 30, 30), 2)

    # Entity 2: Order
    cv2.rectangle(img, (320, 150), (470, 290), (30, 30, 30), 2)
    cv2.putText(img, "Order", (365, 185), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (20, 20, 20), 2)
    cv2.line(img, (320, 200), (470, 200), (80, 80, 80), 1)
    cv2.putText(img, "id", (335, 230), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (40, 40, 40), 1)
    cv2.putText(img, "user_id", (335, 260), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (40, 40, 40), 1)

    # Relation 2 -> 3
    cv2.line(img, (475, 220), (555, 220), (30, 30, 30), 2)

    # Entity 3: Item
    cv2.rectangle(img, (560, 150), (690, 290), (30, 30, 30), 2)
    cv2.putText(img, "Item", (605, 185), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (20, 20, 20), 2)
    cv2.line(img, (560, 200), (690, 200), (80, 80, 80), 1)
    cv2.putText(img, "id", (575, 230), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (40, 40, 40), 1)
    cv2.putText(img, "price", (575, 260), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (40, 40, 40), 1)
    return img

def create_img_decision_flowchart():
    """10. Complex Flowchart: 4 nodes with diamond decision branching."""
    img = np.ones((600, 750, 3), dtype=np.uint8) * 255
    # Start
    cv2.rectangle(img, (50, 240), (160, 320), (30, 30, 30), 2)
    cv2.putText(img, "Start", (80, 285), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (20, 20, 20), 2)

    # Arrow to Diamond
    cv2.arrowedLine(img, (165, 280), (285, 280), (30, 30, 30), 2, tipLength=0.15)

    # Diamond Decision
    diamond_pts = np.array([[360, 210], [430, 280], [360, 350], [290, 280]], np.int32)
    cv2.polylines(img, [diamond_pts], isClosed=True, color=(30, 30, 30), thickness=2)
    cv2.putText(img, "Valid?", (335, 285), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (20, 20, 20), 1)

    # Branch Up (Yes) -> Success
    cv2.arrowedLine(img, (360, 205), (360, 140), (30, 30, 30), 2, tipLength=0.15)
    cv2.rectangle(img, (290, 60), (430, 135), (30, 30, 30), 2)
    cv2.putText(img, "Commit", (325, 105), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (20, 20, 20), 2)

    # Branch Right (No) -> Reject
    cv2.arrowedLine(img, (435, 280), (555, 280), (30, 30, 30), 2, tipLength=0.15)
    cv2.rectangle(img, (560, 240), (690, 320), (30, 30, 30), 2)
    cv2.putText(img, "Reject", (595, 285), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (20, 20, 20), 2)
    return img

def build_testset():
    # 1. Structured files
    (TESTSET_DIR / "architecture.drawio").write_text(DRAWIO_CONTENT, encoding="utf-8")
    (TESTSET_DIR / "auth_pipeline.mmd").write_text(MERMAID_CONTENT, encoding="utf-8")
    (TESTSET_DIR / "vector_pipeline.svg").write_text(SVG_CONTENT, encoding="utf-8")

    # 2. Generate and save 10 varied test images
    generators = [
        ("clean_line_art_3node.png", create_img_clean_3node()),
        ("clean_line_art_branching.png", create_img_clean_branching()),
        ("whiteboard_perspective_skew.png", create_img_perspective_skew()),
        ("whiteboard_uneven_lighting.png", create_img_uneven_lighting()),
        ("whiteboard_shadow_smudge.png", create_img_shadow_smudge()),
        ("whiteboard_handwritten_markers.png", create_img_handwritten_markers()),
        ("architecture_doc_screenshot.png", create_img_architecture_doc()),
        ("state_machine_circular.png", create_img_state_machine()),
        ("erd_entity_schema.png", create_img_erd_schema()),
        ("decision_flowchart.png", create_img_decision_flowchart())
    ]

    for filename, img in generators:
        cv2.imwrite(str(TESTSET_DIR / filename), img)

    # 3. Ground truth manifest
    manifest = {
        "structured": [
            {
                "id": "drawio_architecture",
                "filename": "architecture.drawio",
                "format": "drawio",
                "description": "Multi-shape mxGraph XML architecture diagram",
                "expected_nodes": [
                    {"label": "Web Frontend", "type": "rectangle"},
                    {"label": "API Gateway", "type": "rectangle"},
                    {"label": "Postgres DB", "type": "database"},
                    {"label": "Redis Cache", "type": "circle"},
                ],
                "expected_edge_count": 3
            },
            {
                "id": "mermaid_auth",
                "filename": "auth_pipeline.mmd",
                "format": "mermaid",
                "description": "Branching Mermaid flowchart with typed node shapes and edge labels",
                "expected_nodes": [
                    {"label": "Client App", "type": "rectangle"},
                    {"label": "API Gateway", "type": "service"},
                    {"label": "Authorized?", "type": "diamond"},
                    {"label": "Order Service", "type": "service"},
                    {"label": "Order Database", "type": "database"},
                ],
                "expected_edge_count": 4
            },
            {
                "id": "svg_pipeline",
                "filename": "vector_pipeline.svg",
                "format": "svg",
                "description": "Vector SVG containing explicit <rect>, <circle>, and <line> tags",
                "expected_nodes": [
                    {"label": "Client App", "type": "rectangle"},
                    {"label": "Processing API", "type": "rectangle"},
                    {"label": "Worker", "type": "circle"},
                ],
                "expected_edge_count": 2
            }
        ],
        "image": [
            {
                "id": "clean_line_art_3node",
                "filename": "clean_line_art_3node.png",
                "category": "line_art",
                "description": "Standard 3-node digital line-art pipeline",
                "expected_nodes": [
                    {"label": "Ingestion", "type": "rectangle"},
                    {"label": "Transformer", "type": "rectangle"},
                    {"label": "DB", "type": "circle"},
                ],
                "expected_edge_count": 2
            },
            {
                "id": "clean_line_art_branching",
                "filename": "clean_line_art_branching.png",
                "category": "line_art",
                "description": "Branching 4-node architecture pipeline",
                "expected_nodes": [
                    {"label": "Gateway", "type": "rectangle"},
                    {"label": "Worker 1", "type": "rectangle"},
                    {"label": "Worker 2", "type": "rectangle"},
                    {"label": "Storage", "type": "circle"},
                ],
                "expected_edge_count": 3
            },
            {
                "id": "whiteboard_perspective_skew",
                "filename": "whiteboard_perspective_skew.png",
                "category": "perspective_skew",
                "description": "Whiteboard diagram photographed at 11.5 degree angle tilt",
                "expected_nodes": [
                    {"label": "Ingestion", "type": "rectangle"},
                    {"label": "Transformer", "type": "rectangle"},
                    {"label": "DB", "type": "circle"},
                ],
                "expected_edge_count": 2
            },
            {
                "id": "whiteboard_uneven_lighting",
                "filename": "whiteboard_uneven_lighting.png",
                "category": "lighting_glare",
                "description": "Whiteboard photo with strong illumination/glare gradient",
                "expected_nodes": [
                    {"label": "Ingestion", "type": "rectangle"},
                    {"label": "Transformer", "type": "rectangle"},
                    {"label": "DB", "type": "circle"},
                ],
                "expected_edge_count": 2
            },
            {
                "id": "whiteboard_shadow_smudge",
                "filename": "whiteboard_shadow_smudge.png",
                "category": "shadow_and_noise",
                "description": "Whiteboard photo with cast shadow, sensor noise, and eraser residue",
                "expected_nodes": [
                    {"label": "Gateway", "type": "rectangle"},
                    {"label": "Worker 1", "type": "rectangle"},
                    {"label": "Worker 2", "type": "rectangle"},
                    {"label": "Storage", "type": "circle"},
                ],
                "expected_edge_count": 3
            },
            {
                "id": "whiteboard_handwritten_markers",
                "filename": "whiteboard_handwritten_markers.png",
                "category": "handwritten_style",
                "description": "Hand-drawn marker strokes with irregular boundary shapes",
                "expected_nodes": [
                    {"label": "Client", "type": "rectangle"},
                    {"label": "Server", "type": "rectangle"},
                    {"label": "DB", "type": "circle"},
                ],
                "expected_edge_count": 2
            },
            {
                "id": "architecture_doc_screenshot",
                "filename": "architecture_doc_screenshot.png",
                "category": "doc_screenshot",
                "description": "System architecture screenshot with background grid",
                "expected_nodes": [
                    {"label": "Auth Service", "type": "rectangle"},
                    {"label": "User Service", "type": "rectangle"},
                    {"label": "Cache", "type": "rectangle"},
                ],
                "expected_edge_count": 2
            },
            {
                "id": "state_machine_circular",
                "filename": "state_machine_circular.png",
                "category": "state_machine",
                "description": "3 circular states with directional transition arrows",
                "expected_nodes": [
                    {"label": "Idle", "type": "circle"},
                    {"label": "Running", "type": "circle"},
                    {"label": "Finished", "type": "circle"},
                ],
                "expected_edge_count": 2
            },
            {
                "id": "erd_entity_schema",
                "filename": "erd_entity_schema.png",
                "category": "erd",
                "description": "3 rectangular entity schema boxes with relationship connectors",
                "expected_nodes": [
                    {"label": "User", "type": "rectangle"},
                    {"label": "Order", "type": "rectangle"},
                    {"label": "Item", "type": "rectangle"},
                ],
                "expected_edge_count": 2
            },
            {
                "id": "decision_flowchart",
                "filename": "decision_flowchart.png",
                "category": "flowchart",
                "description": "Branching decision tree with diamond decision node and outcomes",
                "expected_nodes": [
                    {"label": "Start", "type": "rectangle"},
                    {"label": "Valid?", "type": "diamond"},
                    {"label": "Commit", "type": "rectangle"},
                    {"label": "Reject", "type": "rectangle"},
                ],
                "expected_edge_count": 3
            }
        ]
    }

    manifest_path = TESTSET_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"[TestSet] Created curated testset at {TESTSET_DIR} with 3 structured fixtures and 10 diverse diagram images.")

if __name__ == "__main__":
    build_testset()
