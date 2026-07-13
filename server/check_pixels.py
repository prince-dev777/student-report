import cv2

thresh = cv2.imread(r"C:\Users\sawar\MyProjects\student-report\server\uploads\warped_debug.png", cv2.IMREAD_GRAYSCALE)

# col1_x = [229.25, 255.25, 281.25, 307.25]
# rows_y = [435.0, 462.0, 489.0, ...]
x_c, y_c = int(229.25), int(435.0)

for x_c in [229, 255, 281, 307]:
    y1, y2 = max(0, y_c - 7), min(thresh.shape[0], y_c + 7)
    x1, x2 = max(0, x_c - 7), min(thresh.shape[1], x_c + 7)
    box = thresh[y1:y2, x1:x2]
    print(f"X: {x_c}, Pixels: {cv2.countNonZero(box)}")
