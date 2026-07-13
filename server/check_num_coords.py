import cv2
import numpy as np

def debug():
    img_path = r"C:\Users\sawar\MyProjects\student-report\server\uploads\warped_debug.png"
    thresh = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
    if thresh is None:
        print("No image")
        return
        
    y_rows_b = [919.0 + r * 98.0 for r in range(5)]
    phy_num_x = [100.0 + d * 24.5 for d in range(10)]
    
    h_w, w_w = thresh.shape[:2]
    
    print("\n--- PHY Numericals ---")
    for ry_base in y_rows_b[:1]:
        print(f"Base Y: {ry_base}")
        # Search for horizontal lines or bubbles near this base Y
        for offset in [0.0, 17.5, 35.0, 52.5]:
            counts = []
            for cx in phy_num_x:
                y1, y2 = max(0, int(ry_base + offset) - 7), min(h_w, int(ry_base + offset) + 7)
                x1, x2 = max(0, int(cx) - 7), min(w_w, int(cx) + 7)
                counts.append(cv2.countNonZero(thresh[y1:y2, x1:x2]))
            min_c = min(counts)
            max_adj = max(counts) - min_c
            print(f"Offset={offset} Y={ry_base+offset} MaxAdj={max_adj} Counts={counts}")

debug()
