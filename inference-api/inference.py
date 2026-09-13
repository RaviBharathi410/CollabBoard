import os
import json
from pathlib import Path
import numpy as np
from PIL import Image
import onnxruntime as ort

CLASSES = [
    "rectangle", "circle", "database", "diamond", "actor",
    "cloud", "cylinder", "arrow", "text_region", "sticky_note", "group_boundary"
]

class ONNXDiagramDetector:
    def __init__(self, model_path: str):
        # Fallback to local files if path doesn't exist
        path = Path(model_path)
        if not path.exists():
            # Try workspace root public path fallback
            fallback = Path("public/models/collabboard_int8.onnx")
            if fallback.exists():
                path = fallback
            else:
                fallback_ml = Path("ml/browser_models/collabboard_int8.onnx")
                if fallback_ml.exists():
                    path = fallback_ml
        
        self.model_path = str(path.resolve())
        print(f"[ONNXDiagramDetector] Loading ONNX model from: {self.model_path}")
        self.sess = ort.InferenceSession(self.model_path, providers=['CPUExecutionProvider'])
        self.input_name = self.sess.get_inputs()[0].name
        self.input_shape = self.sess.get_inputs()[0].shape  # Expect [1, 3, 512, 512]
        self.img_size = self.input_shape[2]

    def letterbox(self, img: Image.Image, color=(114, 114, 114)):
        w, h = img.size
        scale = min(self.img_size / w, self.img_size / h)
        new_w = int(round(w * scale))
        new_h = int(round(h * scale))
        
        dw = (self.img_size - new_w) / 2
        dh = (self.img_size - new_h) / 2
        
        if img.size != (new_w, new_h):
            resized = img.resize((new_w, new_h), Image.Resampling.BILINEAR)
        else:
            resized = img
            
        padded = Image.new("RGB", (self.img_size, self.img_size), color)
        padded.paste(resized, (int(round(dw)), int(round(dh))))
        
        return padded, scale, dw, dh

    def nms(self, boxes, scores, iou_threshold=0.45):
        if len(boxes) == 0:
            return []
        x1 = boxes[:, 0]
        y1 = boxes[:, 1]
        x2 = boxes[:, 2]
        y2 = boxes[:, 3]
        areas = (x2 - x1) * (y2 - y1)
        order = scores.argsort()[::-1]
        
        keep = []
        while order.size > 0:
            i = order[0]
            keep.append(i)
            if order.size == 1:
                break
            xx1 = np.maximum(x1[i], x1[order[1:]])
            yy1 = np.maximum(y1[i], y1[order[1:]])
            xx2 = np.minimum(x2[i], x2[order[1:]])
            yy2 = np.minimum(y2[i], y2[order[1:]])
            w = np.maximum(0.0, xx2 - xx1)
            h = np.maximum(0.0, yy2 - yy1)
            inter = w * h
            ovr = inter / (areas[i] + areas[order[1:]] - inter)
            inds = np.where(ovr <= iou_threshold)[0]
            order = order[inds + 1]
        return keep

    def predict(self, img: Image.Image, conf_threshold=0.25, iou_threshold=0.45):
        orig_w, orig_h = img.size
        
        # 1. Image preprocessing
        padded_img, scale, dw, dh = self.letterbox(img)
        img_np = np.array(padded_img, dtype=np.float32) / 255.0
        img_np = np.transpose(img_np, (2, 0, 1))  # HWC -> CHW
        img_np = np.expand_dims(img_np, axis=0)    # CHW -> 1CHW
        
        # 2. Run inference
        outputs = self.sess.run(None, {self.input_name: img_np})
        pred = outputs[0][0]  # Shape: [15, 5376]
        
        boxes = pred[0:4, :]  # Shape: [4, 5376]
        scores = pred[4:, :]  # Shape: [11, 5376]
        
        class_ids = np.argmax(scores, axis=0)
        confidences = np.max(scores, axis=0)
        
        # 3. Filter by conf_threshold
        keep = confidences >= conf_threshold
        boxes = boxes[:, keep]
        class_ids = class_ids[keep]
        confidences = confidences[keep]
        
        if boxes.shape[1] == 0:
            return []
            
        # 4. Decode boxes to corner format [x1, y1, x2, y2]
        cx, cy, w, h = boxes[0], boxes[1], boxes[2], boxes[3]
        x1 = cx - w / 2
        y1 = cy - h / 2
        x2 = cx + w / 2
        y2 = cy + h / 2
        
        # 5. Map back to original coordinate space
        x1 = (x1 * self.img_size - dw) / scale
        y1 = (y1 * self.img_size - dh) / scale
        x2 = (x2 * self.img_size - dw) / scale
        y2 = (y2 * self.img_size - dh) / scale
        
        # Clip to image boundaries
        x1 = np.clip(x1, 0, orig_w)
        y1 = np.clip(y1, 0, orig_h)
        x2 = np.clip(x2, 0, orig_w)
        y2 = np.clip(y2, 0, orig_h)
        
        decoded_boxes = np.stack([x1, y1, x2, y2], axis=1)
        
        # 6. Apply NMS
        keep_idx = self.nms(decoded_boxes, confidences, iou_threshold)
        
        detections = []
        for idx in keep_idx:
            bx = decoded_boxes[idx]
            bx_normalized = [
                float((bx[0] + bx[2]) / 2 / orig_w),
                float((bx[1] + bx[3]) / 2 / orig_h),
                float((bx[2] - bx[0]) / orig_w),
                float((bx[3] - bx[1]) / orig_h)
            ]
            detections.append({
                "bbox_normalized": bx_normalized,
                "confidence": float(confidences[idx]),
                "class_id": int(class_ids[idx]),
                "class_name": CLASSES[class_ids[idx]],
                "box": [float(bx[0]), float(bx[1]), float(bx[2]), float(bx[3])]
            })
            
        return detections

def distance_point_to_box(px, py, bx1, by1, bx2, by2):
    dx = max(bx1 - px, 0, px - bx2)
    dy = max(by1 - py, 0, py - by2)
    return np.sqrt(dx*dx + dy*dy)

def reconstruct_diagram(detections, orig_w, orig_h, existing_shapes=None, diagram_type_hint=None):
    existing_shapes = existing_shapes or []
    
    # 1. Segment detections into types
    shape_detections = []
    arrow_detections = []
    text_detections = []
    
    for d in detections:
        cls_name = d["class_name"]
        if cls_name == "arrow":
            arrow_detections.append(d)
        elif cls_name == "text_region":
            text_detections.append(d)
        else:
            shape_detections.append(d)
            
    # 2. Build nodes
    nodes = []
    for i, d in enumerate(shape_detections):
        node_id = f"n{i+1}"
        nodes.append({
            "id": node_id,
            "type": d["class_name"],
            "label": "",  # To be filled by text matching
            "confidence": d["confidence"],
            "box": d["box"],
            "bbox_normalized": d["bbox_normalized"]
        })
        
    # 3. Label matching using client existing text shapes or distance heuristics
    # Filter existing shapes for text labels
    text_shapes = [s for s in existing_shapes if s.get("type") == "text"]
    
    for node in nodes:
        nx1, ny1, nx2, ny2 = node["box"]
        ncx = (nx1 + nx2) / 2
        ncy = (ny1 + ny2) / 2
        
        # Try matching with client text shape first (by proximity)
        matched_text = None
        min_shape_dist = float("inf")
        for ts in text_shapes:
            tx = ts.get("x", 0)
            ty = ts.get("y", 0)
            # Distance from text coordinates to node center
            dist = np.sqrt((tx - ncx)**2 + (ty - ncy)**2)
            if dist < min_shape_dist and dist < 150: # within 150 pixels
                min_shape_dist = dist
                matched_text = ts.get("text", "")
                
        if matched_text:
            node["label"] = matched_text
        else:
            # Fallback to text_region detections in the canvas image
            best_tr = None
            min_tr_dist = float("inf")
            for tr in text_detections:
                tx1, ty1, tx2, ty2 = tr["box"]
                tcx = (tx1 + tx2) / 2
                tcy = (ty1 + ty2) / 2
                dist = np.sqrt((tcx - ncx)**2 + (tcy - ncy)**2)
                if dist < min_tr_dist and dist < 120:
                    min_tr_dist = dist
                    best_tr = tr
            if best_tr:
                node["label"] = f"{node['type'].capitalize()}"
            else:
                node["label"] = f"{node['type'].capitalize()}"

    # 4. Build edges from arrow detections
    edges = []
    for i, arrow in enumerate(arrow_detections):
        ax1, ay1, ax2, ay2 = arrow["box"]
        aw = ax2 - ax1
        ah = ay2 - ay1
        
        # Estimate endpoints
        if aw > ah:
            # Horizontal arrow: start is left, end is right
            start_pt = (ax1, (ay1 + ay2) / 2)
            end_pt = (ax2, (ay1 + ay2) / 2)
        else:
            # Vertical arrow: start is top, end is bottom
            start_pt = (((ax1 + ax2) / 2), ay1)
            end_pt = (((ax1 + ax2) / 2), ay2)
            
        # Find closest source node to start point
        source_id = None
        min_src_dist = float("inf")
        for node in nodes:
            nx1, ny1, nx2, ny2 = node["box"]
            dist = distance_point_to_box(start_pt[0], start_pt[1], nx1, ny1, nx2, ny2)
            if dist < min_src_dist and dist < 180: # within 180 pixels
                min_src_dist = dist
                source_id = node["id"]
                
        # Find closest target node to end point
        target_id = None
        min_tgt_dist = float("inf")
        for node in nodes:
            nx1, ny1, nx2, ny2 = node["box"]
            dist = distance_point_to_box(end_pt[0], end_pt[1], nx1, ny1, nx2, ny2)
            if dist < min_tgt_dist and dist < 180:
                min_tgt_dist = dist
                target_id = node["id"]
                
        # Only add valid edges linking distinct nodes
        if source_id and target_id and source_id != target_id:
            # Try to find a label for the edge from text regions near the arrow center
            acx = (ax1 + ax2) / 2
            acy = (ay1 + ay2) / 2
            edge_label = ""
            for ts in text_shapes:
                tx = ts.get("x", 0)
                ty = ts.get("y", 0)
                dist = np.sqrt((tx - acx)**2 + (ty - acy)**2)
                if dist < 80:  # Closer to arrow center
                    edge_label = ts.get("text", "")
                    break
                    
            edges.append({
                "id": f"e{i+1}",
                "source": source_id,
                "target": target_id,
                "label": edge_label,
                "style": "solid"
            })
            
    # Clean up node coordinate keys from final JSON schema output
    for node in nodes:
        node.pop("box", None)
        
    # Calculate overall confidence
    overall_conf = float(np.mean([n["confidence"] for n in nodes])) if nodes else 0.0
    
    # Diagram type classification
    diag_type = diagram_type_hint or "architecture"
    if not diagram_type_hint:
        types_in_diagram = [n["type"] for n in nodes]
        if "actor" in types_in_diagram:
            diag_type = "sequence"
        elif "database" in types_in_diagram:
            diag_type = "erd"
            
    return {
        "type": diag_type,
        "confidence": overall_conf,
        "nodes": nodes,
        "edges": edges,
        "layoutHint": "hierarchical"
    }
