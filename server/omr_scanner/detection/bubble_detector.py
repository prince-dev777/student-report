import numpy as np

def calculate_fill_ratio(thresh_image: np.ndarray, center_x: int, center_y: int, roi_size: int) -> float:
    """
    Extracts the fill ratio of a bubble given its center and the ROI bounding box size.
    Returns the percentage of dark pixels (from 0.0 to 100.0).
    """
    half = roi_size // 2
    roi = thresh_image[center_y - half : center_y + half, center_x - half : center_x + half]
    
    # In thresh_image, dark marks are 255 (due to THRESH_BINARY_INV).
    # np.sum(roi) / 255 gives the number of filled pixels.
    num_filled = np.sum(roi) / 255.0
    total_pixels = roi_size * roi_size
    
    fill_ratio = (num_filled / total_pixels) * 100.0
    return fill_ratio
