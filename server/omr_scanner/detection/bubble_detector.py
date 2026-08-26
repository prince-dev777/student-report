import numpy as np

def calculate_fill_ratio(thresh_image: np.ndarray, center_x: int, center_y: int, roi_size: int, search_radius: int = 0) -> float:
    """
    Extracts the fill ratio of a bubble given its center and the ROI bounding box size.
    If search_radius > 0, samples a local neighborhood of offsets [-search_radius, +search_radius]
    and returns the maximum fill ratio found (for micro-centering edge-marked or slightly offset bubbles).
    Returns the percentage of dark pixels (from 0.0 to 100.0).
    """
    half = roi_size // 2
    h, w = thresh_image.shape[:2]
    total_pixels = float(roi_size * roi_size)
    
    if search_radius <= 0:
        y1 = max(0, center_y - half)
        y2 = min(h, center_y + half)
        x1 = max(0, center_x - half)
        x2 = min(w, center_x + half)
        
        roi = thresh_image[y1:y2, x1:x2]
        num_filled = np.sum(roi) / 255.0
        return (num_filled / total_pixels) * 100.0
        
    best_fill = 0.0
    for dy in range(-search_radius, search_radius + 1):
        cy = center_y + dy
        y1 = max(0, cy - half)
        y2 = min(h, cy + half)
        for dx in range(-search_radius, search_radius + 1):
            cx = center_x + dx
            x1 = max(0, cx - half)
            x2 = min(w, cx + half)
            
            roi = thresh_image[y1:y2, x1:x2]
            num_filled = np.sum(roi) / 255.0
            fill = (num_filled / total_pixels) * 100.0
            if fill > best_fill:
                best_fill = fill
                
    return best_fill
