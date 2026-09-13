import math
from typing import Tuple, Dict, Any, Union
import numpy as np
import cv2
from PIL import Image

"""
Image Preprocessing for Diagram Import

Prepares raw whiteboard photos, paper sketches, and screenshots for optimal OCR
and shape detection:
1. Auto-crop: isolates the whiteboard / diagram document boundary from room backgrounds
2. Deskew: detects orientation via Hough lines and straightens tilted angles
3. Contrast Normalization: CLAHE equalization on luminance to fix uneven lighting/glare
4. Denoising: bilateral filtering to clean whiteboard smudges while preserving drawn lines
"""

def _to_cv2(image_input: Union[Image.Image, np.ndarray]) -> np.ndarray:
    if isinstance(image_input, Image.Image):
        rgb = np.array(image_input.convert("RGB"))
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    elif isinstance(image_input, np.ndarray):
        if len(image_input.shape) == 2:
            return cv2.cvtColor(image_input, cv2.COLOR_GRAY2BGR)
        return image_input.copy()
    else:
        raise ValueError(f"Unsupported image input type: {type(image_input)}")

def _to_pil(cv_img: np.ndarray) -> Image.Image:
    rgb = cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB)
    return Image.fromarray(rgb)

def detect_skew_angle(gray: np.ndarray) -> float:
    """Detect dominant skew angle in degrees using Hough Line Transform."""
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=80, minLineLength=50, maxLineGap=10)

    if lines is None or len(lines) == 0:
        return 0.0

    angles = []
    for line in lines:
        coords = line.flatten()
        if len(coords) < 4:
            continue
        x1, y1, x2, y2 = int(coords[0]), int(coords[1]), int(coords[2]), int(coords[3])
        dx = x2 - x1
        dy = y2 - y1
        if dx == 0:
            continue
        angle_rad = math.atan2(dy, dx)
        angle_deg = math.degrees(angle_rad)
        # We only care about approximately horizontal lines (within +-45 degrees)
        if -45.0 <= angle_deg <= 45.0:
            angles.append(angle_deg)

    if not angles:
        return 0.0

    # Return median angle to resist outliers
    median_angle = float(np.median(angles))
    return median_angle

def deskew_image(cv_img: np.ndarray, max_skew_deg: float = 30.0) -> Tuple[np.ndarray, float]:
    """Rotates image around center to eliminate detected skew."""
    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
    angle = detect_skew_angle(gray)

    if abs(angle) < 0.5 or abs(angle) > max_skew_deg:
        return cv_img, 0.0

    h, w = cv_img.shape[:2]
    center = (w // 2, h // 2)
    rot_mat = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(
        cv_img, rot_mat, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE
    )
    return rotated, angle

def auto_crop_boundary(cv_img: np.ndarray, min_area_ratio: float = 0.25) -> Tuple[np.ndarray, bool]:
    """Detects and crops to dominant whiteboard or document boundary if present."""
    h, w = cv_img.shape[:2]
    total_area = h * w
    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)

    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
    )

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
    closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return cv_img, False

    # Find largest contour
    largest = max(contours, key=cv2.contourArea)
    area = cv2.contourArea(largest)

    # Only crop if contour represents a meaningful document bounded within the image
    if min_area_ratio * total_area < area < 0.96 * total_area:
        x, y, cw, ch = cv2.boundingRect(largest)
        # Add 15px safe margin padding
        pad = 15
        x1 = max(0, x - pad)
        y1 = max(0, y - pad)
        x2 = min(w, x + cw + pad)
        y2 = min(h, y + ch + pad)
        cropped = cv_img[y1:y2, x1:x2]
        return cropped, True

    return cv_img, False

def normalize_contrast_clahe(cv_img: np.ndarray, clip_limit: float = 2.0) -> np.ndarray:
    """Applies CLAHE on luminance channel to equalize uneven lighting and whiteboard glare."""
    lab = cv2.cvtColor(cv_img, cv2.COLOR_BGR2LAB)
    l_chan, a_chan, b_chan = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(8, 8))
    l_equalized = clahe.apply(l_chan)

    merged = cv2.merge([l_equalized, a_chan, b_chan])
    return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)

def denoise_bilateral(cv_img: np.ndarray) -> np.ndarray:
    """Removes speckles and sensor noise while preserving sharp diagram stroke edges."""
    return cv2.bilateralFilter(cv_img, d=5, sigmaColor=50, sigmaSpace=50)

def preprocess_diagram_image(
    image_input: Union[Image.Image, np.ndarray],
    enable_crop: bool = True,
    enable_deskew: bool = True,
    enable_clahe: bool = True,
    enable_denoise: bool = True,
) -> Tuple[Image.Image, Dict[str, Any]]:
    """
    Main preprocessing pipeline for diagram images.
    Returns:
        (preprocessed_pil_image, metrics_dict)
    """
    cv_img = _to_cv2(image_input)
    orig_h, orig_w = cv_img.shape[:2]

    metrics = {
        "original_width": orig_w,
        "original_height": orig_h,
        "cropped": False,
        "deskew_angle_deg": 0.0,
        "clahe_applied": False,
        "denoised": False,
    }

    # 1. Auto-crop to document boundary
    if enable_crop:
        cv_img, cropped = auto_crop_boundary(cv_img)
        metrics["cropped"] = cropped

    # 2. Deskew orientation
    if enable_deskew:
        cv_img, angle = deskew_image(cv_img)
        metrics["deskew_angle_deg"] = round(angle, 2)

    # 3. Contrast & lighting normalization
    if enable_clahe:
        cv_img = normalize_contrast_clahe(cv_img)
        metrics["clahe_applied"] = True

    # 4. Edge-preserving denoising
    if enable_denoise:
        cv_img = denoise_bilateral(cv_img)
        metrics["denoised"] = True

    final_h, final_w = cv_img.shape[:2]
    metrics["final_width"] = final_w
    metrics["final_height"] = final_h

    pil_img = _to_pil(cv_img)
    return pil_img, metrics
