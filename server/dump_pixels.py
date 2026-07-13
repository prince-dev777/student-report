import cv2
import json

def get_pixel_counts():
    img_path = r"C:\Users\sawar\MyProjects\student-report\server\uploads\warped_debug.png"
    thresh = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
    if thresh is None:
        print("Could not load image")
        return

    # Coordinates from 50-Question OMR template
    col1_x = [229.25, 255.25, 281.25, 307.25]
    col2_x = [413.25, 439.25, 465.25, 491.25]
    
    rows_y = [435.0, 462.0, 489.0, 517.0, 545.0, 573.0, 601.0, 629.0, 657.0, 685.0,
              713.0, 742.0, 769.0, 797.0, 825.0, 853.0, 881.0, 908.0, 936.0, 965.0,
              993.0, 1021.0, 1049.0, 1076.0, 1104.0]
              
    all_counts = []
    
    # Column 1 (Q1-25)
    for q_idx in range(25):
        y_c = int(rows_y[q_idx])
        row_counts = []
        for x_c in col1_x:
            x_c = int(x_c)
            y1, y2 = max(0, y_c - 7), min(thresh.shape[0], y_c + 7)
            x1, x2 = max(0, x_c - 7), min(thresh.shape[1], x_c + 7)
            box = thresh[y1:y2, x1:x2]
            row_counts.append(cv2.countNonZero(box))
        all_counts.append(row_counts)

    # Column 2 (Q26-50)
    for q_idx in range(25):
        y_c = int(rows_y[q_idx])
        row_counts = []
        for x_c in col2_x:
            x_c = int(x_c)
            y1, y2 = max(0, y_c - 7), min(thresh.shape[0], y_c + 7)
            x1, x2 = max(0, x_c - 7), min(thresh.shape[1], x_c + 7)
            box = thresh[y1:y2, x1:x2]
            row_counts.append(cv2.countNonZero(box))
        all_counts.append(row_counts)
        
    for i, counts in enumerate(all_counts):
        print(f"Q{i+1}: {counts}")

get_pixel_counts()
