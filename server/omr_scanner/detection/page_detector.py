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
        # Filters for the specific anchor squares
        if 20 <= w <= 80 and 20 <= h <= 80 and 0.6 <= ar <= 1.4:
            if 300 < area < 5000:
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
    return rect
