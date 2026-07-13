import sys
import cv2
import numpy as np

image_path = r"C:\Users\sawar\.gemini\antigravity-ide\brain\7041d054-3264-44c3-b0ed-ce8c96976141\media__1783540169041.png"
image = cv2.imread(image_path)
h_orig, w_orig = image.shape[:2]

gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
blurred = cv2.GaussianBlur(gray, (5, 5), 0)
thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                              cv2.THRESH_BINARY_INV, 51, 15)

# Fill holes in the thresholded image so solid circles remain solid
kernel = np.ones((9,9), np.uint8)
thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

cnts, _ = cv2.findContours(thresh.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

min_size = max(5, int(w_orig * 0.008))
max_size = int(w_orig * 0.05)
margin_x = int(w_orig * 0.25)
margin_y = int(h_orig * 0.25)

print(f"Image Size: {w_orig}x{h_orig}. Min Size: {min_size}, Max Size: {max_size}")

markers = []
for c in cnts:
    (x, y, w, h) = cv2.boundingRect(c)
    area = cv2.contourArea(c)
    perimeter = cv2.arcLength(c, True)
    if perimeter == 0: continue
    
    circularity = 4 * np.pi * area / (perimeter * perimeter)
    ar = w / float(h)
    
    cx = x + w / 2.0
    cy = y + h / 2.0
    is_corner = (cx < margin_x and cy < margin_y) or (cx > w_orig - margin_x and cy < margin_y) or (cx < margin_x and cy > h_orig - margin_y) or (cx > w_orig - margin_x and cy > h_orig - margin_y)
    
    if is_corner and w > 10:
        mask = np.zeros(thresh.shape, dtype="uint8")
        cv2.drawContours(mask, [c], -1, 255, -1)
        mean_val = cv2.mean(thresh, mask=mask)[0]

        if min_size <= w <= max_size and min_size <= h <= max_size and 0.6 <= ar <= 1.5 and circularity > 0.5:
            if mean_val > 180:
                print(f"Corner Candidate: w={w}, h={h}, ar={ar:.2f}, circ={circularity:.2f} => ACCEPTED! (Mean: {mean_val:.2f})")
            else:
                print(f"Corner Candidate: w={w}, h={h}, ar={ar:.2f}, circ={circularity:.2f} => REJECTED Not solid (Mean: {mean_val:.2f})")
