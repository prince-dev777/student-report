import sys
import cv2
import numpy as np

image_path = r"C:\Users\sawar\MyProjects\student-report\server\omr_50_template.png"
image = cv2.imread(image_path)

if image is None:
    print("Could not read template image")
    sys.exit(1)

# detect corners logic
h_orig, w_orig = image.shape[:2]
gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
blurred = cv2.GaussianBlur(gray, (5, 5), 0)
thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 51, 15)

cnts, _ = cv2.findContours(thresh.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
min_size = max(5, int(w_orig * 0.008))
max_size = int(w_orig * 0.05)
margin_x = int(w_orig * 0.35)
margin_y = int(h_orig * 0.35)

markers = []
for c in cnts:
    (x, y, w, h) = cv2.boundingRect(c)
    area = cv2.contourArea(c)
    perimeter = cv2.arcLength(c, True)
    if perimeter == 0: continue
    circularity = 4 * np.pi * area / (perimeter * perimeter)
    ar = w / float(h)
    
    if min_size <= w <= max_size and min_size <= h <= max_size and 0.6 <= ar <= 1.5 and circularity > 0.5:
        mask = np.zeros(thresh.shape, dtype="uint8")
        cv2.drawContours(mask, [c], -1, 255, -1)
        mean_val = cv2.mean(thresh, mask=mask)[0]
        if mean_val > 40:
            cx = x + w / 2.0
            cy = y + h / 2.0
            markers.append((cx, cy, area))

tl, tr, bl, br = None, None, None, None
for cx, cy, area in markers:
    dist_tl = cx**2 + cy**2
    dist_tr = (w_orig - cx)**2 + cy**2
    dist_bl = cx**2 + (h_orig - cy)**2
    dist_br = (w_orig - cx)**2 + (h_orig - cy)**2
    
    if cx < margin_x and cy < margin_y:
        if tl is None or dist_tl < tl[3]: tl = (cx, cy, area, dist_tl)
    elif cx > w_orig - margin_x and cy < margin_y:
        if tr is None or dist_tr < tr[3]: tr = (cx, cy, area, dist_tr)
    elif cx < margin_x and cy > h_orig - margin_y:
        if bl is None or dist_bl < bl[3]: bl = (cx, cy, area, dist_bl)
    elif cx > w_orig - margin_x and cy > h_orig - margin_y:
        if br is None or dist_br < br[3]: br = (cx, cy, area, dist_br)

tl = tl[:3] if tl else None
tr = tr[:3] if tr else None
bl = bl[:3] if bl else None
br = br[:3] if br else None

if tl and tr and bl and br is None:
    br_x = tr[0] + bl[0] - tl[0]
    br_y = tr[1] + bl[1] - tl[1]
    br = (br_x, br_y, 330.0)

print("Corners:", tl, tr, bl, br)

if not (tl and tr and bl and br):
    print("Could not find corners!")
    sys.exit(1)

src_pts = np.array([tl[:2], tr[:2], br[:2], bl[:2]], dtype="float32")
width, height = 963, 1472
dst_pts = np.array([
    [0, 0],
    [width - 1, 0],
    [width - 1, height - 1],
    [0, height - 1]], dtype="float32")
    
M = cv2.getPerspectiveTransform(src_pts, dst_pts)
warped = cv2.warpPerspective(image, M, (width, height))
cv2.imwrite("warped_template.png", warped)
print("Saved warped_template.png")
