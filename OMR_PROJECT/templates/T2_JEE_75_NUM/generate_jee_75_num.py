"""
JEE 75 MCQ + Numerical — OMR Template Generator
Generates: jee_75_num_template.png

Layout (top to bottom):
  1. Registration corner markers (TL, TR, BL, BR)
  2. Page border (single clean border around entire content)
  3. "CAREER XONE" title — centered at top
  4. Row: Roll No (left) + Student details box (right) — side by side
  5. MCQ Questions: 3 columns × 20 rows (PHY 1-20, CHEM 26-45, MATH 51-70)
  6. Numerical Questions: 3 columns × 5 rows (PHY 21-25, CHEM 46-50, MATH 71-75)
"""

import cv2
import numpy as np

# === CANVAS CONFIG ===
S = 2  # Scale factor for crisp print
W, H = 963 * S, 1472 * S

# === PAGE MARGINS (unscaled) ===
PAGE_LEFT = 55
PAGE_RIGHT = 908
PAGE_TOP = 55
PAGE_BOTTOM = 1417

def create_canvas():
    return np.ones((H, W, 3), dtype=np.uint8) * 255

# ─────────────────────────────────────────
# Drawing helpers
# ─────────────────────────────────────────
def draw_registration_markers(img):
    """4 corner filled circles for scanner alignment"""
    positions = [
        (30, 30), (W // S - 30, 30),
        (30, H // S - 30), (W // S - 30, H // S - 30)
    ]
    for x, y in positions:
        cv2.circle(img, (int(x * S), int(y * S)), int(15 * S), (0, 0, 0), -1)

def draw_text_centered(img, text, cx, cy, scale=0.35, thickness=1, color=(0, 0, 0)):
    fs = scale * S
    th = max(1, int(thickness * S))
    (tw, th_px), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, fs, th)
    cv2.putText(img, text, (int(cx - tw / 2), int(cy + th_px / 2)),
                cv2.FONT_HERSHEY_SIMPLEX, fs, color, th, cv2.LINE_AA)

def draw_text_left(img, text, x, y, scale=0.35, thickness=1, color=(0, 0, 0)):
    fs = scale * S
    th = max(1, int(thickness * S))
    cv2.putText(img, text, (int(x), int(y)), cv2.FONT_HERSHEY_SIMPLEX, fs, color, th, cv2.LINE_AA)

def draw_text_right(img, text, right_x, y, scale=0.35, thickness=1, color=(0, 0, 0)):
    fs = scale * S
    th = max(1, int(thickness * S))
    (tw, th_px), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, fs, th)
    cv2.putText(img, text, (int(right_x - tw), int(y + th_px / 2)),
                cv2.FONT_HERSHEY_SIMPLEX, fs, color, th, cv2.LINE_AA)

def draw_q_num_right(img, num, right_x, cy, scale=0.35, thickness=1):
    text = str(num)
    fs = scale * S
    th = max(1, int(thickness * S))
    (tw, th_px), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, fs, th)
    cv2.putText(img, text, (int(right_x - tw), int(cy + th_px / 2)),
                cv2.FONT_HERSHEY_SIMPLEX, fs, (0, 0, 0), th, cv2.LINE_AA)

def s(v):
    return int(v * S)

# ─────────────────────────────────────────
# 1. Page border
# ─────────────────────────────────────────
def draw_page_border(img):
    cv2.rectangle(img, (s(PAGE_LEFT), s(PAGE_TOP)), (s(PAGE_RIGHT), s(PAGE_BOTTOM)),
                  (0, 0, 0), s(1.5))

# ─────────────────────────────────────────
# 2. Title — CAREER XONE centered
# ─────────────────────────────────────────
def draw_title(img):
    title = "CAREER XONE"
    cx = (PAGE_LEFT + PAGE_RIGHT) / 2.0
    cy = 90.0
    fs = 1.2 * S
    th = int(2.5 * S)
    (tw, th_px), _ = cv2.getTextSize(title, cv2.FONT_HERSHEY_TRIPLEX, fs, th)
    tx = int(cx * S - tw / 2)
    ty = int(cy * S + th_px / 2)
    cv2.putText(img, title, (tx, ty), cv2.FONT_HERSHEY_TRIPLEX, fs, (0, 0, 0), th, cv2.LINE_AA)

# ─────────────────────────────────────────
# 3. Roll No + Student Details Box
# ─────────────────────────────────────────
def draw_roll_no(img):
    col_gap = 26.0
    cols_x = [90.0 + c * col_gap for c in range(5)]
    first_row_y = 175.0
    row_gap = 20.0
    rows_y = [first_row_y + r * row_gap for r in range(10)]
    
    grid_cx = (cols_x[0] + cols_x[-1]) / 2.0
    draw_text_centered(img, "ROLL NO", s(grid_cx), s(first_row_y - 36), scale=0.4, thickness=2)
    
    for cx in cols_x:
        cv2.rectangle(img, (s(cx - 7), s(first_row_y - 28)), (s(cx + 7), s(first_row_y - 14)),
                      (0, 0, 0), s(1))
    
    for cx in cols_x:
        for r_idx, ry in enumerate(rows_y):
            cv2.circle(img, (s(cx), s(ry)), s(7), (0, 0, 0), s(1))
            draw_text_centered(img, str(r_idx), s(cx), s(ry), scale=0.28, thickness=1)
    
    return cols_x, rows_y

def draw_student_details(img):
    x1, y1 = 230, 130
    x2, y2 = PAGE_RIGHT - 10, 275
    
    cv2.rectangle(img, (s(x1), s(y1)), (s(x2), s(y2)), (0, 0, 0), s(1.2))
    row_h = (y2 - y1) / 4.0
    labels = ["STUDENT NAME:", "BATCH:", "TOPIC:"]
    
    for i in range(4):
        ry = y1 + i * row_h
        if i > 0:
            cv2.line(img, (s(x1), s(ry)), (s(x2), s(ry)), (0, 0, 0), s(0.8))
        
        label_y = ry + row_h * 0.6
        if i < 3:
            draw_text_left(img, labels[i], s(x1 + 10), s(label_y), scale=0.33, thickness=1)
        else:
            draw_text_left(img, "TEST DATE:", s(x1 + 10), s(label_y), scale=0.33, thickness=1)
            inv_text = "INVIGILATOR SIGN:"
            fs = 0.33 * S
            th = max(1, int(1 * S))
            (tw, _), _ = cv2.getTextSize(inv_text, cv2.FONT_HERSHEY_SIMPLEX, fs, th)
            inv_x = int(s(x2) - tw - s(250))  # 250px padding
            cv2.putText(img, inv_text, (inv_x, int(s(label_y))),
                        cv2.FONT_HERSHEY_SIMPLEX, fs, (0, 0, 0), th, cv2.LINE_AA)

# ─────────────────────────────────────────
# 4. MCQ Section (3 columns × 20 rows)
# ─────────────────────────────────────────
def draw_mcq_section(img):
    options = ['A', 'B', 'C', 'D']
    bubble_r = 8
    opt_gap = 26.0
    q_gap = 22.0
    
    # 3 MCQ Columns aligned with Numerical blocks below
    columns = [
        {"label": "PHY MCQ (1-20)",   "start": 1,  "cx": 210.25},
        {"label": "CHEM MCQ (26-45)", "start": 26, "cx": 480.75},
        {"label": "MATH MCQ (51-70)", "start": 51, "cx": 751.25},
    ]
    
    y_start = 410.0
    rows_y = [y_start + r * q_gap for r in range(20)]
    
    for col in columns:
        cx_center = col["cx"]
        opt_x = [cx_center + (i - 1.5) * opt_gap for i in range(4)]
        
        draw_text_centered(img, col["label"], s(cx_center), s(y_start - 24), scale=0.42, thickness=2)
        
        for idx, ry in enumerate(rows_y):
            q_num = col["start"] + idx
            draw_q_num_right(img, q_num, s(opt_x[0] - 12), s(ry), scale=0.33, thickness=1)
            for c_idx, ox in enumerate(opt_x):
                cv2.circle(img, (s(ox), s(ry)), s(bubble_r), (0, 0, 0), s(1))
                draw_text_centered(img, options[c_idx], s(ox), s(ry), scale=0.28, thickness=1)
                
    return columns, rows_y

# ─────────────────────────────────────────
# 5. Numerical Section (3 columns × 5 rows)
# ─────────────────────────────────────────
def draw_numerical_section(img):
    y_rows_b = [940.0, 1038.0, 1136.0, 1234.0, 1332.0]
    num_sections = [
        {"x_start": 100.0, "label": "PHY NUM (21-25)",  "start_q": 21},
        {"x_start": 370.5, "label": "CHEM NUM (46-50)", "start_q": 46},
        {"x_start": 641.0, "label": "MATH NUM (71-75)", "start_q": 71}
    ]
    
    for sec in num_sections:
        x_base = sec["x_start"]
        block_center = x_base + 4.5 * 24.5
        draw_text_centered(img, sec["label"], s(block_center), s(912.0), scale=0.42, thickness=2)
        
        for idx, ry_base in enumerate(y_rows_b):
            q_num = sec["start_q"] + idx
            draw_text_centered(img, f"Q{q_num}", s(x_base - 26), s(ry_base + 26.0), scale=0.4, thickness=1)
            
            row_labels = ["TH", "H", "T", "U"]
            row_offsets = [0.0, 17.5, 35.0, 52.5]
            for r_idx, label in enumerate(row_labels):
                ry_row = ry_base + row_offsets[r_idx]
                draw_text_centered(img, label, s(x_base - 10), s(ry_row), scale=0.25, thickness=1)
                for d in range(10):
                    cx = x_base + d * 24.5
                    cv2.circle(img, (s(cx), s(ry_row)), s(8), (0, 0, 0), s(1))
                    draw_text_centered(img, str(d), s(cx), s(ry_row), scale=0.25, thickness=1)

# ─────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────
def generate():
    img = create_canvas()
    
    draw_registration_markers(img)
    draw_page_border(img)
    draw_title(img)
    draw_roll_no(img)
    draw_student_details(img)
    draw_mcq_section(img)
    draw_numerical_section(img)
    
    out_path = 'jee_75_num_template.png'
    cv2.imwrite(out_path, img)
    print(f"Generated {out_path}")
    return img

if __name__ == "__main__":
    generate()
