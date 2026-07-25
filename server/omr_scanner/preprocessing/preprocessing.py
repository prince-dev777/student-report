import cv2
import numpy as np

def preprocess_image(image: np.ndarray) -> np.ndarray:
    """
    Converts a color image to a binary thresholded image suitable for bubble extraction.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # We apply Otsu's thresholding which handles variations in lighting 
    # to automatically find the optimal threshold separating paper from ink.
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)
    
    return thresh
