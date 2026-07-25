import cv2
import numpy as np
import os
import json
import random

INPUT_IMAGE = "input/T1.jpg"
OUTPUT_DIR = "omr_scanner/tests/test_data"

def save_variant(image, name, transformations):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    img_path = os.path.join(OUTPUT_DIR, f"{name}.jpg")
    meta_path = os.path.join(OUTPUT_DIR, f"{name}.json")
    
    cv2.imwrite(img_path, image)
    
    metadata = {
        "filename": f"{name}.jpg",
        "transformations": transformations,
        "source": "T1.jpg"
    }
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=4)
        
def rotate_image(image, angle):
    (h, w) = image.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    # White background for fill
    return cv2.warpAffine(image, M, (w, h), borderValue=(255, 255, 255))

def apply_perspective(image, intensity=0.02):
    (h, w) = image.shape[:2]
    pts1 = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    # Shrink the top edge
    dx = w * intensity
    dy = h * intensity
    pts2 = np.float32([[dx, dy], [w - dx, dy], [w, h], [0, h]])
    M = cv2.getPerspectiveTransform(pts1, pts2)
    return cv2.warpPerspective(image, M, (w, h), borderValue=(255, 255, 255))

def adjust_brightness(image, factor):
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    hsv = np.array(hsv, dtype=np.float64)
    hsv[:,:,2] = hsv[:,:,2] * factor
    hsv[:,:,2][hsv[:,:,2] > 255] = 255
    hsv = np.array(hsv, dtype=np.uint8)
    return cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)

def add_noise(image, sigma=15):
    noise = np.random.normal(0, sigma, image.shape)
    noisy = np.clip(image + noise, 0, 255).astype(np.uint8)
    return noisy

def add_shadow(image):
    h, w = image.shape[:2]
    X, Y = np.meshgrid(np.arange(w), np.arange(h))
    # Gradient darker on the right
    gradient = 1 - (X / w) * 0.5
    gradient = np.stack([gradient]*3, axis=2)
    return np.clip(image * gradient, 0, 255).astype(np.uint8)

def scale_image(image, scale):
    h, w = image.shape[:2]
    resized = cv2.resize(image, (int(w * scale), int(h * scale)))
    # Pad or crop back to original
    canvas = np.full((h, w, 3), 255, dtype=np.uint8)
    nh, nw = resized.shape[:2]
    
    if scale < 1.0:
        y_offset = (h - nh) // 2
        x_offset = (w - nw) // 2
        canvas[y_offset:y_offset+nh, x_offset:x_offset+nw] = resized
        return canvas
    else:
        y_offset = (nh - h) // 2
        x_offset = (nw - w) // 2
        return resized[y_offset:y_offset+h, x_offset:x_offset+w]

def shift_image(image, dx, dy):
    h, w = image.shape[:2]
    M = np.float32([[1, 0, dx], [0, 1, dy]])
    return cv2.warpAffine(image, M, (w, h), borderValue=(255, 255, 255))

def apply_jpeg_compression(image, quality=15):
    encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), quality]
    result, encimg = cv2.imencode('.jpg', image, encode_param)
    return cv2.imdecode(encimg, 1)


def generate_all():
    base_img = cv2.imread(INPUT_IMAGE)
    if base_img is None:
        print(f"Error loading {INPUT_IMAGE}")
        return
        
    save_variant(base_img, "A_original", ["none"])
    
    # Rotations
    save_variant(rotate_image(base_img, 1), "B_rot_plus_1", ["rotation_1deg"])
    save_variant(rotate_image(base_img, -1), "B_rot_minus_1", ["rotation_-1deg"])
    save_variant(rotate_image(base_img, 3), "C_rot_plus_3", ["rotation_3deg"])
    save_variant(rotate_image(base_img, -3), "C_rot_minus_3", ["rotation_-3deg"])
    
    # Perspective
    save_variant(apply_perspective(base_img, 0.03), "D_perspective", ["perspective_distortion"])
    
    # Brightness
    save_variant(adjust_brightness(base_img, 1.3), "E_brightness_high", ["high_brightness"])
    save_variant(adjust_brightness(base_img, 0.6), "F_brightness_low", ["low_brightness"])
    save_variant(add_shadow(base_img), "H_uneven_lighting", ["uneven_lighting"])
    
    # Noise and Blur
    save_variant(add_noise(base_img, 25), "I_noise", ["gaussian_noise"])
    save_variant(cv2.GaussianBlur(base_img, (5, 5), 0), "J_blur_slight", ["slight_blur"])
    save_variant(cv2.GaussianBlur(base_img, (11, 11), 0), "K_blur_moderate", ["moderate_blur"])
    
    # Artifacts
    save_variant(apply_jpeg_compression(base_img, 15), "L_jpeg", ["jpeg_compression"])
    
    # Scaling
    save_variant(scale_image(base_img, 0.95), "M_downscaled", ["downscaled"])
    save_variant(scale_image(base_img, 1.05), "N_upscaled", ["upscaled"])
    
    # Shifts
    save_variant(shift_image(base_img, 20, 0), "O_shift_horiz", ["horizontal_shift"])
    save_variant(shift_image(base_img, 0, 20), "P_shift_vert", ["vertical_shift"])
    
    # Combinations
    cmb_1 = adjust_brightness(rotate_image(base_img, 2), 0.7)
    save_variant(cmb_1, "Q_rot_brightness", ["rotation_2deg", "low_brightness"])
    
    cmb_2 = add_noise(apply_perspective(base_img, 0.04), 20)
    save_variant(cmb_2, "R_persp_noise", ["perspective", "noise"])
    
    cmb_3 = cv2.GaussianBlur(adjust_brightness(base_img, 0.5), (7, 7), 0)
    save_variant(cmb_3, "S_blur_brightness", ["moderate_blur", "low_brightness"])
    
    cmb_4 = add_noise(cv2.GaussianBlur(apply_perspective(base_img, 0.05), (5, 5), 0), 15)
    save_variant(cmb_4, "T_distorted_camera", ["perspective", "blur", "noise"])

    print(f"Generated {len(os.listdir(OUTPUT_DIR)) // 2} test variants.")

if __name__ == "__main__":
    generate_all()
