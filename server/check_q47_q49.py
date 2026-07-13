import cv2

def debug():
    img_path = r"C:\Users\sawar\MyProjects\student-report\server\uploads\warped_debug.png"
    thresh = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
    if thresh is None:
        print("No image")
        return
        
    y_rows_b = [940.0, 1038.0, 1136.0, 1234.0, 1332.0]
    chem_num_x = [370.5 + d * 24.5 for d in range(10)]
    
    h_w, w_w = thresh.shape[:2]
    
    # Q47 is the 2nd row in CHEM NUM (index 1)
    # Q49 is the 4th row in CHEM NUM (index 3)
    
    for q_idx, q_num in [(1, 47), (3, 49)]:
        print(f"\n--- Q{q_num} ---")
        ry_base = y_rows_b[q_idx]
        for offset in [0.0, 17.5, 35.0, 52.5]:
            counts = []
            for cx in chem_num_x:
                y1, y2 = max(0, int(ry_base + offset) - 7), min(h_w, int(ry_base + offset) + 7)
                x1, x2 = max(0, int(cx) - 7), min(w_w, int(cx) + 7)
                counts.append(cv2.countNonZero(thresh[y1:y2, x1:x2]))
            min_c = min(counts)
            max_adj = max(counts) - min_c
            print(f"Offset={offset} Y={ry_base+offset} MaxAdj={max_adj} Counts={counts}")

debug()
