import cv2
import os

class ImageLoadError(Exception):
    pass

class ImageResolutionError(Exception):
    pass

def load_image(image_path: str):
    if not os.path.exists(image_path):
        raise ImageLoadError(f"Image not found at path: {image_path}")
        
    image = cv2.imread(image_path)
    if image is None:
        raise ImageLoadError(f"Failed to load image (possibly corrupted or unsupported format): {image_path}")
        
    h, w = image.shape[:2]
    # Check for reasonably high resolution
    if w < 500 or h < 500:
        raise ImageResolutionError(f"Image resolution {w}x{h} is too low for reliable OMR scanning. Minimum 500x500 required.")
        
    return image
