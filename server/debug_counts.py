import cv2

def debug():
    img_path = r"C:\Users\sawar\MyProjects\student-report\server\uploads\warped_debug.png"
    thresh = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
    if thresh is None: return
    
    y_rows_a = [410.0 + r * 22.0 for r in range(20)]
    phy_mcq_x = [210.25 + (i - 1.5) * 26.0 for i in range(4)]
    
    y_rows_b = [940.0, 1038.0, 1136.0, 1234.0, 1332.0]
    phy_num_x = [100.0 + d * 24.5 for d in range(10)]
    
    h_w, w_w = thresh.shape[:2]
    
    print("--- PHY MCQs ---")
    for ry in y_rows_a[:5]:
        counts = []
        for cx in phy_mcq_x:
            y1, y2 = max(0, int(ry) - 7), min(h_w, int(ry) + 7)
            x1, x2 = max(0, int(cx) - 7), min(w_w, int(cx) + 7)
            counts.append(cv2.countNonZero(thresh[y1:y2, x1:x2]))
        min_c = min(counts)
        max_adj = max(counts) - min_c
        print(f"Y={ry} MaxAdj={max_adj} Counts={counts}")
        
    print("\n--- PHY Numericals ---")
    for ry_base in y_rows_b[:2]:
        for offset in [0.0, 17.5]:
            counts = []
            for cx in phy_num_x:
                y1, y2 = max(0, int(ry_base + offset) - 7), min(h_w, int(ry_base + offset) + 7)
                x1, x2 = max(0, int(cx) - 7), min(w_w, int(cx) + 7)
                counts.append(cv2.countNonZero(thresh[y1:y2, x1:x2]))
            min_c = min(counts)
            max_adj = max(counts) - min_c
            print(f"Y={ry_base+offset} MaxAdj={max_adj} Counts={counts}")

debug()
