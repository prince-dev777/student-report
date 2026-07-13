import sys
import cv2

def count_filled():
    img_path = r"C:\Users\sawar\MyProjects\student-report\server\uploads\warped_debug.png"
    thresh = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
    if thresh is None: return
    
    y_rows_a = [410.0 + r * 22.0 for r in range(20)]
    phy_mcq_x = [210.25 + (i - 1.5) * 26.0 for i in range(4)]
    chem_mcq_x = [480.75 + (i - 1.5) * 26.0 for i in range(4)]
    math_mcq_x = [751.25 + (i - 1.5) * 26.0 for i in range(4)]
    
    y_rows_b = [940.0, 1038.0, 1136.0, 1234.0, 1332.0]
    phy_num_x = [100.0 + d * 24.5 for d in range(10)]
    chem_num_x = [370.5 + d * 24.5 for d in range(10)]
    math_num_x = [641.0 + d * 24.5 for d in range(10)]
    
    h_w, w_w = thresh.shape[:2]
    
    filled_count = 0
    blank_count = 0
    
    def check_row(x_coords, y_c):
        counts = []
        for cx in x_coords:
            y1, y2 = max(0, int(y_c) - 7), min(h_w, int(y_c) + 7)
            x1, x2 = max(0, int(cx) - 7), min(w_w, int(cx) + 7)
            counts.append(cv2.countNonZero(thresh[y1:y2, x1:x2]))
        
        min_c = min(counts)
        adj_counts = [c - min_c for c in counts]
        if max(adj_counts) > 35:
            return True
        return False

    # Check MCQs
    for ry in y_rows_a:
        if check_row(phy_mcq_x, ry): filled_count += 1
        else: blank_count += 1
        
        if check_row(chem_mcq_x, ry): filled_count += 1
        else: blank_count += 1
        
        if check_row(math_mcq_x, ry): filled_count += 1
        else: blank_count += 1
        
    # Check Numericals (if any of the 4 rows is filled, the question is attempted)
    for ry_base in y_rows_b:
        # Phy
        attempted = False
        for offset in [0.0, 17.5, 35.0, 52.5]:
            if check_row(phy_num_x, ry_base + offset): attempted = True
        if attempted: filled_count += 1
        else: blank_count += 1
        
        # Chem
        attempted = False
        for offset in [0.0, 17.5, 35.0, 52.5]:
            if check_row(chem_num_x, ry_base + offset): attempted = True
        if attempted: filled_count += 1
        else: blank_count += 1
        
        # Math
        attempted = False
        for offset in [0.0, 17.5, 35.0, 52.5]:
            if check_row(math_num_x, ry_base + offset): attempted = True
        if attempted: filled_count += 1
        else: blank_count += 1
        
    print(f"Total attempted (filled): {filled_count}")
    print(f"Total unattempted (blank): {blank_count}")
    print(f"Total questions: {filled_count + blank_count}")

count_filled()
