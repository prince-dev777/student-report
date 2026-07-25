import cv2
import numpy as np

class PerspectiveCorrectionError(Exception):
    pass

def apply_perspective_correction(image: np.ndarray, rect: np.ndarray, target_width: int, target_height: int) -> np.ndarray:
    """
    Warps the image to a standardized flat grid of size target_width x target_height.
    """
    try:
        dst = np.array([
            [0, 0],
            [target_width - 1, 0],
            [target_width - 1, target_height - 1],
            [0, target_height - 1]
        ], dtype="float32")
        
        M = cv2.getPerspectiveTransform(rect, dst)
        warped = cv2.warpPerspective(image, M, (target_width, target_height))
        return warped
    except Exception as e:
        raise PerspectiveCorrectionError(f"Failed to apply perspective correction: {str(e)}")
