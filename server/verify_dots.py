import cv2
import numpy as np

img = cv2.imread(r"C:\Users\sawar\MyProjects\student-report\server\warped_template.png")

roll_cols_x = [64.0 + c * 26.0 for c in range(5)]
roll_rows_y = [155.0 + r * 20.0 for r in range(10)]

for cx in roll_cols_x:
    for cy in roll_rows_y:
        cv2.circle(img, (int(cx), int(cy)), 3, (0, 0, 255), -1)

crop = img[100:400, 50:250]
cv2.imwrite(r"C:\Users\sawar\.gemini\antigravity-ide\brain\7041d054-3264-44c3-b0ed-ce8c96976141\crop_roll_dots.png", crop)
