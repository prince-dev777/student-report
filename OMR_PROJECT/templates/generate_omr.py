import cv2
import numpy as np

width, height = 1240, 1754
img = np.ones((height, width), dtype=np.uint8) * 255

radius = 18            # थोड़ा बड़ा बबल
dx = 40                # कॉलम के बीच दूरी
dy = 38                # पंक्ति के बीच दूरी
thickness = 2          # खाली बबल की मोटाई

start_x = 60
start_y = 120

# रोल नंबर ग्रिड (6 अंक, 0-9)
for row in range(10):
    for col in range(6):
        x = start_x + col * dx
        y = start_y + row * dy
        cv2.circle(img, (x, y), radius, (0, 0, 0), thickness)

# उत्तर ग्रिड (4 प्रश्न, 4 विकल्प)
ans_start_x = 380
ans_start_y = start_y
for row in range(4):
    for col in range(4):
        x = ans_start_x + col * dx
        y = ans_start_y + row * dy
        cv2.circle(img, (x, y), radius, (0, 0, 0), thickness)

# रोल नंबर भरें (123456)
roll_digits = [1, 2, 3, 4, 5, 6]
for col, digit in enumerate(roll_digits):
    x = start_x + col * dx
    y = start_y + digit * dy
    cv2.circle(img, (x, y), radius, (0, 0, 0), -1)

# उत्तर भरें (A, B, C, D)
answers = [0, 1, 2, 3]
for row, ans in enumerate(answers):
    x = ans_start_x + ans * dx
    y = ans_start_y + row * dy
    cv2.circle(img, (x, y), radius, (0, 0, 0), -1)

cv2.imwrite('test_omr.png', img)
print("Mock OMR image saved as test_omr.png")