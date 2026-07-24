import cv2
import numpy as np

def detect_registration_corners(image):
    h_orig, w_orig = image.shape[:2]
    
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 51, 15)
    
    cnts, _ = cv2.findContours(thresh.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    
    min_size = max(5, int(w_orig * 0.008))
    max_size = int(w_orig * 0.05)
    
    markers = []
    for c in cnts:
        (x, y, w, h) = cv2.boundingRect(c)
        area = cv2.contourArea(c)
        perimeter = cv2.arcLength(c, True)
        if perimeter == 0:
            continue
        circularity = 4 * np.pi * area / (perimeter * perimeter)
        ar = w / float(h)
        
        if min_size <= w <= max_size and min_size <= h <= max_size and 0.6 <= ar <= 1.5 and circularity > 0.5:
            mask = np.zeros(thresh.shape, dtype="uint8")
            cv2.drawContours(mask, [c], -1, 255, -1)
            mean_val = cv2.mean(thresh, mask=mask)[0]
            if mean_val > 40:
                cx = x + w / 2.0
                cy = y + h / 2.0
                markers.append((cx, cy, area, circularity, ar, mean_val))
                
    print(f"Total markers found: {len(markers)}")
    for m in markers:
        print(f"Marker at ({m[0]:.1f}, {m[1]:.1f}), area: {m[2]}, circ: {m[3]:.2f}, ar: {m[4]:.2f}, mean: {m[5]:.2f}")

image = cv2.imread(r"C:\Users\sawar\MyProjects\student-report\server\test_omr\media__1784801530603.png")
if image is not None:
    detect_registration_corners(image)
else:
    print("Failed to load image")
