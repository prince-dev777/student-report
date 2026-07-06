import cv2
import numpy as np
import os

def create_omr_50():
    # Warped dimensions
    width, height = 963, 1472
    img = np.ones((height, width, 3), dtype=np.uint8) * 255
    
    # Draw registration markers (circles) in 4 corners
    # TL, TR, BL, BR
    markers = [(30, 30), (width - 30, 30), (30, height - 30), (width - 30, height - 30)]
    for x, y in markers:
        cv2.circle(img, (x, y), 15, (0, 0, 0), -1)
        
    # Draw Title
    cv2.putText(img, "UNIVERSAL 50-QUESTION OMR SHEET", (260, 45), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 0), 2, cv2.LINE_AA)
    
    # Roll Number Grid
    roll_cols_x = [int(44.5 + c * 28.5) for c in range(5)]
    roll_rows_y = [int(111.5 + r * 31.2) for r in range(10)]
    
    cv2.putText(img, "ROLL NO", (roll_cols_x[0], roll_rows_y[0] - 25), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2, cv2.LINE_AA)
                
    for c_idx, cx in enumerate(roll_cols_x):
        # Header box for entering roll no digits manually
        cv2.rectangle(img, (cx - 10, roll_rows_y[0] - 20), (cx + 10, roll_rows_y[0] - 4), (0, 0, 0), 1)
        for r_idx, ry in enumerate(roll_rows_y):
            cv2.circle(img, (cx, ry), 8, (0, 0, 0), 1)
            cv2.putText(img, str(r_idx), (cx - 4, ry + 4), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 0, 0), 1, cv2.LINE_AA)
            
    # Questions
    # Column 1 (Q1-Q25), Column 2 (Q26-Q50)
    col1_x = [103.5, 128.5, 153.5, 178.5]
    col2_x = [453.5, 478.5, 503.5, 528.5]
    rows_y = [int(512.0 + b * 190.0 + r * 28.5) for b in range(5) for r in range(5)]
    
    options = ['A', 'B', 'C', 'D']
    
    # Column Headers
    cv2.putText(img, "SECTION A (Q1-25)", (int(col1_x[0]), rows_y[0] - 25), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2, cv2.LINE_AA)
    cv2.putText(img, "SECTION B (Q26-50)", (int(col2_x[0]), rows_y[0] - 25), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2, cv2.LINE_AA)
    
    # Draw Q1-Q25
    for idx, ry in enumerate(rows_y):
        q_num = idx + 1
        cv2.putText(img, f"{q_num:02d}", (int(col1_x[0]) - 40, ry + 5), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1, cv2.LINE_AA)
        for c_idx, cx in enumerate(col1_x):
            cv2.circle(img, (int(cx), ry), 8, (0, 0, 0), 1)
            cv2.putText(img, options[c_idx], (int(cx) - 4, ry + 4), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 0, 0), 1, cv2.LINE_AA)
            
    # Draw Q26-Q50
    for idx, ry in enumerate(rows_y):
        q_num = idx + 26
        cv2.putText(img, f"{q_num:02d}", (int(col2_x[0]) - 40, ry + 5), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1, cv2.LINE_AA)
        for c_idx, cx in enumerate(col2_x):
            cv2.circle(img, (int(cx), ry), 8, (0, 0, 0), 1)
            cv2.putText(img, options[c_idx], (int(cx) - 4, ry + 4), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 0, 0), 1, cv2.LINE_AA)
            
    cv2.imwrite('omr_50_template.png', img)
    print("Generated omr_50_template.png")

def create_mhcet_200():
    width, height = 963, 1472
    img = np.ones((height, width, 3), dtype=np.uint8) * 255
    
    # Registration markers
    markers = [(30, 30), (width - 30, 30), (30, height - 30), (width - 30, height - 30)]
    for x, y in markers:
        cv2.circle(img, (x, y), 15, (0, 0, 0), -1)
        
    cv2.putText(img, "MHCET 200-QUESTION OMR SHEET", (260, 45), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 0), 2, cv2.LINE_AA)
                
    # Roll Number Grid
    roll_cols_x = [37, 62, 86, 111, 135]
    roll_rows_y = [88, 113, 138, 163, 188, 213, 238, 263, 288, 313]
    
    cv2.putText(img, "ROLL NO", (roll_cols_x[0], roll_rows_y[0] - 25), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 2, cv2.LINE_AA)
                
    for cx in roll_cols_x:
        cv2.rectangle(img, (cx - 8, roll_rows_y[0] - 20), (cx + 8, roll_rows_y[0] - 4), (0, 0, 0), 1)
        for r_idx, ry in enumerate(roll_rows_y):
            cv2.circle(img, (cx, ry), 7, (0, 0, 0), 1)
            cv2.putText(img, str(r_idx), (cx - 3, ry + 3), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.3, (0, 0, 0), 1, cv2.LINE_AA)
            
    # Columns of bubbles
    col1_x = [87.9, 112.8, 138.3, 163.4]
    col2_x = [341.7, 367.1, 392.3, 417.6]
    col3_x = [594.9, 620.2, 645.6, 671.2]
    col4_x = [849.0, 874.4, 899.7, 924.5]
    rows_y = [int(340.0 + r * 22.0) for r in range(50)]
    
    options = ['A', 'B', 'C', 'D']
    
    # Col 1: Q1-Q50
    for idx, ry in enumerate(rows_y):
        q_num = idx + 1
        cv2.putText(img, f"{q_num:03d}", (int(col1_x[0]) - 32, ry + 4), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 0, 0), 1, cv2.LINE_AA)
        for c_idx, cx in enumerate(col1_x):
            cv2.circle(img, (int(cx), ry), 6, (0, 0, 0), 1)
            cv2.putText(img, options[c_idx], (int(cx) - 3, ry + 3), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.28, (0, 0, 0), 1, cv2.LINE_AA)
            
    # Col 2: Q51-Q100
    for idx, ry in enumerate(rows_y):
        q_num = idx + 51
        cv2.putText(img, f"{q_num:03d}", (int(col2_x[0]) - 32, ry + 4), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 0, 0), 1, cv2.LINE_AA)
        for c_idx, cx in enumerate(col2_x):
            cv2.circle(img, (int(cx), ry), 6, (0, 0, 0), 1)
            cv2.putText(img, options[c_idx], (int(cx) - 3, ry + 3), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.28, (0, 0, 0), 1, cv2.LINE_AA)
            
    # Col 3: Q101-Q150
    for idx, ry in enumerate(rows_y):
        q_num = idx + 101
        cv2.putText(img, f"{q_num:03d}", (int(col3_x[0]) - 32, ry + 4), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 0, 0), 1, cv2.LINE_AA)
        for c_idx, cx in enumerate(col3_x):
            cv2.circle(img, (int(cx), ry), 6, (0, 0, 0), 1)
            cv2.putText(img, options[c_idx], (int(cx) - 3, ry + 3), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.28, (0, 0, 0), 1, cv2.LINE_AA)
            
    # Col 4: Q151-Q200
    for idx, ry in enumerate(rows_y):
        q_num = idx + 151
        cv2.putText(img, f"{q_num:03d}", (int(col4_x[0]) - 32, ry + 4), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 0, 0), 1, cv2.LINE_AA)
        for c_idx, cx in enumerate(col4_x):
            cv2.circle(img, (int(cx), ry), 6, (0, 0, 0), 1)
            cv2.putText(img, options[c_idx], (int(cx) - 3, ry + 3), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.28, (0, 0, 0), 1, cv2.LINE_AA)
            
    cv2.imwrite('mhcet_200_template.png', img)
    print("Generated mhcet_200_template.png")

if __name__ == "__main__":
    create_omr_50()
    create_mhcet_200()
