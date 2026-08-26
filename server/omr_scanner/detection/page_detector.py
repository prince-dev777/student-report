import cv2
import numpy as np
from typing import Tuple, List

class PageDetectionError(Exception):
    pass

def detect_page_anchors(image: np.ndarray) -> np.ndarray:
    """
    Detects the 4 corner alignment anchors on the OMR sheet.
    Returns the ordered 4 corners: top-left, top-right, bottom-right, bottom-left.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)[1]
    
    cnts, _ = cv2.findContours(thresh, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    
    centers = []
    for c in cnts:
        (x, y, w, h) = cv2.boundingRect(c)
        ar = w / float(h)
        area = cv2.contourArea(c)
        # Robust anchor filter: accommodates full circles and slightly clipped edges from ADF scanners
        if 15 <= w <= 90 and 12 <= h <= 90 and 0.4 <= ar <= 2.5:
            if 180 < area < 6000:
                cX = x + w // 2
                cY = y + h // 2
                centers.append([cX, cY])
                
    if len(centers) < 4:
        raise PageDetectionError(f"Failed to detect 4 page anchors. Found {len(centers)} anchors.")
        
    centers = np.array(centers, dtype="float32")
    
    # Sort into top-left, top-right, bottom-right, bottom-left
    s = centers.sum(axis=1)
    diff = np.diff(centers, axis=1)
    
    tl = centers[np.argmin(s)]
    br = centers[np.argmax(s)]
    tr = centers[np.argmin(diff)]
    bl = centers[np.argmax(diff)]
    
    rect = np.array([tl, tr, br, bl], dtype="float32")
    
    # Validate that the 4 anchors form a legitimate page quadrilateral (not collapsed/corrupted)
    width_top = np.linalg.norm(tr - tl)
    width_bot = np.linalg.norm(br - bl)
    height_left = np.linalg.norm(bl - tl)
    height_right = np.linalg.norm(br - tr)
    
    min_w = image.shape[1] * 0.4
    min_h = image.shape[0] * 0.4
    
    if width_top < min_w or width_bot < min_w or height_left < min_h or height_right < min_h:
        raise PageDetectionError("Corrupted scan: Anchor geometry collapsed or cut off during scanning.")
        
    return rect
