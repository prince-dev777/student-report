import sys
import json
import os

try:
    import cv2
    import numpy as np
except ImportError:
    print(json.dumps({"error": "OpenCV or Numpy not found. Please install opencv-python and numpy."}))
    sys.exit(1)

def detect_registration_corners(image):
    """Detect the 3 black registration dots and estimate the 4th corner"""
    h_orig, w_orig = image.shape[:2]
    
    # Preprocess to find black solid dots
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                  cv2.THRESH_BINARY_INV, 51, 15)
    
    cnts, _ = cv2.findContours(thresh.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    
    # Dynamic sizing based on image dimensions
    min_size = max(5, int(w_orig * 0.008))
    max_size = int(w_orig * 0.05)
    
    markers = []
    for c in cnts:
        (x, y, w, h) = cv2.boundingRect(c)
        area = cv2.contourArea(c)
        perimeter = cv2.arcLength(c, True)
        if perimeter == 0:
            continue
        circularity = 4 * np.pi * area / (perimeter * perimeter)
        ar = w / float(h)
        
        # Registration markers are solid circles
        if min_size <= w <= max_size and min_size <= h <= max_size and 0.6 <= ar <= 1.5 and circularity > 0.5:
            # Check solidity by verifying pixel density inside contour
            mask = np.zeros(thresh.shape, dtype="uint8")
            cv2.drawContours(mask, [c], -1, 255, -1)
            mean_val = cv2.mean(thresh, mask=mask)[0]
            if mean_val > 40:
                cx = x + w / 2.0
                cy = y + h / 2.0
                markers.append((cx, cy, area))
                
    # Assign candidate markers to the 4 corners using dynamic boundary boxes
    margin_x = int(w_orig * 0.35)
    margin_y = int(h_orig * 0.35)
    
    tl, tr, bl, br = None, None, None, None
    for cx, cy, area in markers:
        # Distance metrics to select closest candidate to paper corners
        dist_tl = cx**2 + cy**2
        dist_tr = (w_orig - cx)**2 + cy**2
        dist_bl = cx**2 + (h_orig - cy)**2
        dist_br = (w_orig - cx)**2 + (h_orig - cy)**2
        
        if cx < margin_x and cy < margin_y:
            if tl is None or dist_tl < tl[3]:
                tl = (cx, cy, area, dist_tl)
        elif cx > w_orig - margin_x and cy < margin_y:
            if tr is None or dist_tr < tr[3]:
                tr = (cx, cy, area, dist_tr)
        elif cx < margin_x and cy > h_orig - margin_y:
            if bl is None or dist_bl < bl[3]:
                bl = (cx, cy, area, dist_bl)
        elif cx > w_orig - margin_x and cy > h_orig - margin_y:
            if br is None or dist_br < br[3]:
                br = (cx, cy, area, dist_br)
                
    # Extract coordinates (remove dist metric)
    tl = tl[:3] if tl else None
    tr = tr[:3] if tr else None
    bl = bl[:3] if bl else None
    br = br[:3] if br else None
                
    # Validate vertical alignment relative to image width
    if tr and br:
        max_align_diff = max(20, int(w_orig * 0.02))
        if abs(tr[0] - br[0]) > max_align_diff:
            br = None
            
    # Mathematically estimate Bottom-Right if it was cut off or rejected
    if tl and tr and bl and br is None:
        br_x = tr[0] + bl[0] - tl[0]
        br_y = tr[1] + bl[1] - tl[1]
        br = (br_x, br_y, 330.0)
        
    return tl, tr, bl, br

def evaluate_bubble_row(pixel_counts, options=['A', 'B', 'C', 'D'], threshold=90):
    if not pixel_counts:
        return None, "blank"
        
    min_val = min(pixel_counts)
    adjusted_counts = [val - min_val for val in pixel_counts]
    max_adj = max(adjusted_counts)
    
    # If the darkest bubble doesn't stand out by at least 55 pixels from the lightest, it's blank
    if max_adj < 55:
        return None, "blank"
        
    # We consider a bubble marked if its adjusted count is > 0.6 * max_adj
    # but the threshold must be at least 55 to avoid picking up noise
    marked_indices = [i for i, val in enumerate(adjusted_counts) if val > max(55, max_adj * 0.6)]
    
    if len(marked_indices) == 1:
        return options[marked_indices[0]], "valid"
    elif len(marked_indices) > 1:
        return None, "invalid"
    else:
        return None, "blank"

def determine_template(filename, answer_keys, template_config=None, template_id=None):
    # 1. Check template_id if provided directly (highest priority)
    if template_id:
        tid = str(template_id).lower()
        if "jee_75_with_numerical" in tid:
            return "JEE 75 (MCQ + Numerical)"
        elif "jee_75" in tid:
            return "JEE 75 (MCQ Only)"
        elif "neet_90" in tid:
            return "NEET 90 (Biology)"
        elif "omr_50" in tid or "50_omr" in tid or "omr50" in tid or tid == "50":
            return "50-Question OMR"
        elif "mhcet_200_bio" in tid:
            return "MHCET 200 (Biology)"
        elif "mhcet_200" in tid or "mhcet" in tid:
            return "MHCET 200"
        elif "neet_180" in tid or "neet" in tid:
            return "NEET 180 (Physics, Chemistry, Biology)"

    fn_lower = filename.lower()
    
    # 2. Check filename keywords
    if "jee_75_with_numerical" in fn_lower:
        return "JEE 75 (MCQ + Numerical)"
    elif "jee_75" in fn_lower:
        return "JEE 75 (MCQ Only)"
    elif "neet_90" in fn_lower:
        return "NEET 90 (Biology)"
    elif "omr_50" in fn_lower or "50_omr" in fn_lower:
        return "50-Question OMR"
    elif "mhcet_200_bio" in fn_lower:
        return "MHCET 200 (Biology)"
    elif "mhcet_200" in fn_lower or "mhcet" in fn_lower:
        return "MHCET 200"
    elif "neet_180" in fn_lower or "neet" in fn_lower:
        return "NEET 180 (Physics, Chemistry, Biology)"
        
    # 3. Check template ID in config
    if template_config and "template_id" in template_config:
        tid = str(template_config["template_id"]).lower()
        if "jee_75_with_numerical" in tid:
            return "JEE 75 (MCQ + Numerical)"
        elif "jee_75" in tid:
            return "JEE 75 (MCQ Only)"
        elif "neet_90" in tid:
            return "NEET 90 (Biology)"
        elif "omr_50" in tid:
            return "50-Question OMR"
        elif "mhcet_200_bio" in tid:
            return "MHCET 200 (Biology)"
        elif "mhcet_200" in tid:
            return "MHCET 200"
        elif "neet_180" in tid:
            return "NEET 180 (Physics, Chemistry, Biology)"
            
    # 3. Fallback based on question count
    total_q = 0
    if "General" in answer_keys:
        total_q = len(answer_keys["General"])
    else:
        total_q = sum(len(v) for v in answer_keys.values())
        
    if total_q == 75:
        # Check if numerical values are in answer key
        is_num = False
        for k_list in answer_keys.values():
            for val in k_list:
                if val and any(char.isdigit() for char in str(val)):
                    is_num = True
                    break
        return "JEE 75 (MCQ + Numerical)" if is_num else "JEE 75 (MCQ Only)"
    elif total_q == 90:
        return "NEET 90 (Biology)"
    elif total_q == 50:
        return "50-Question OMR"
    elif total_q == 200:
        return "MHCET 200"
        
    return "NEET 180 (Physics, Chemistry, Biology)" # Default fallback

def process_omr_image(image_path, answer_keys, template_config=None, original_name=None, template_id=None, marks_per_question=1, negative_marking=0):
    if not os.path.exists(image_path):
        return {"error": f"Image not found: {image_path}"}
        
    image = cv2.imread(image_path)
    if image is None:
        return {"error": f"Could not load image: {image_path}"}
        
    filename = original_name if original_name else os.path.basename(image_path)
    template_type = determine_template(filename, answer_keys, template_config, template_id)
    
    # Corner registration and perspective transformation
    tl, tr, bl, br = detect_registration_corners(image)
    if not (tl and tr and bl and br):
        return {
            "error": "Registration markers not detected",
            "details": f"Could not find required corner circles in {filename}. Ensure OMR page is fully visible.",
            "rollNumber": "Unknown"
        }
        
    src_pts = np.array([tl[:2], tr[:2], br[:2], bl[:2]], dtype="float32")
    width, height = 963, 1472
    dst_pts = np.array([
        [30, 30],
        [width - 30, 30],
        [width - 30, height - 30],
        [30, height - 30]], dtype="float32")
        
    M = cv2.getPerspectiveTransform(src_pts, dst_pts)
    warped = cv2.warpPerspective(image, M, (width, height))
    warped_gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
    thresh = cv2.threshold(warped_gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)[1]
    
    h_w, w_w = thresh.shape[:2]
    options = ['A', 'B', 'C', 'D']
    
    # Set Roll Number scanning coordinates (standardized across all templates)
    roll_cols_x = [90.0 + c * 26.0 for c in range(5)]
    roll_rows_y = [175.0 + r * 20.0 for r in range(10)]
        
    # Scan Roll Number
    roll_digits = []
    digit_options = [str(d) for d in range(10)]
    for cx in roll_cols_x:
        pixel_counts = []
        for ry in roll_rows_y:
            x_c, y_c = int(cx), int(ry)
            y1, y2 = max(0, y_c - 7), min(h_w, y_c + 7)
            x1, x2 = max(0, x_c - 7), min(w_w, x_c + 7)
            box = thresh[y1:y2, x1:x2]
            pixel_counts.append(cv2.countNonZero(box))
            
        # Use relative threshold: the filled bubble must stand out significantly
        min_val = min(pixel_counts)
        adjusted = [v - min_val for v in pixel_counts]
        max_adj = max(adjusted)
        max_idx = np.argmax(adjusted)
        
        # A filled roll digit must stand out by at least 40 pixels from the lightest
        if max_adj >= 40:
            roll_digits.append(str(max_idx))
            
    roll_number = "".join(roll_digits)
    if not roll_number:
        roll_number = "Unknown"
        
    # Scan bubble responses sequentially
    scanned_answers = []
    
    if template_type == "JEE 75 (MCQ + Numerical)":
        # MCQ part (20 rows)
        y_rows_a = [410.0 + r * 22.0 for r in range(20)]
        phy_mcq_x = [210.25 + (i - 1.5) * 26.0 for i in range(4)]
        chem_mcq_x = [480.75 + (i - 1.5) * 26.0 for i in range(4)]
        math_mcq_x = [751.25 + (i - 1.5) * 26.0 for i in range(4)]
        
        def scan_mcqs(x_coords):
            answers = []
            for ry in y_rows_a:
                pixel_counts = []
                for cx in x_coords:
                    x_c, y_c = int(cx), int(ry)
                    y1, y2 = max(0, y_c - 7), min(h_w, y_c + 7)
                    x1, x2 = max(0, x_c - 7), min(w_w, x_c + 7)
                    box = thresh[y1:y2, x1:x2]
                    pixel_counts.append(cv2.countNonZero(box))
                ans, status = evaluate_bubble_row(pixel_counts, options)
                answers.append((ans, status))
            return answers
            
        # Numerical part (5 rows, columns 0-9 for thousands, hundreds, tens, units)
        y_rows_b = [940.0, 1038.0, 1136.0, 1234.0, 1332.0]
        phy_num_x = [100.0 + d * 24.5 for d in range(10)]
        chem_num_x = [370.5 + d * 24.5 for d in range(10)]
        math_num_x = [641.0 + d * 24.5 for d in range(10)]
        
        def scan_numericals(x_coords):
            answers = []
            digits = [str(d) for d in range(10)]
            for ry_base in y_rows_b:
                row_vals = []
                row_statuses = []
                for r_offset in [0.0, 17.5, 35.0, 52.5]:
                    counts = []
                    for cx in x_coords:
                        x_c, y_c = int(cx), int(ry_base + r_offset)
                        y1, y2 = max(0, y_c - 7), min(h_w, y_c + 7)
                        x1, x2 = max(0, x_c - 7), min(w_w, x_c + 7)
                        box = thresh[y1:y2, x1:x2]
                        counts.append(cv2.countNonZero(box))
                    val, status = evaluate_bubble_row(counts, digits)
                    row_vals.append(val)
                    row_statuses.append(status)
                
                if "invalid" in row_statuses:
                    answers.append((None, "invalid"))
                elif all(s == "blank" for s in row_statuses):
                    answers.append((None, "blank"))
                else:
                    ans_str = ""
                    for val, status in zip(row_vals, row_statuses):
                        if status == "valid":
                            ans_str += str(val)
                    answers.append((ans_str, "valid"))
            return answers
            
        phy_mcq_ans = scan_mcqs(phy_mcq_x)
        phy_num_ans = scan_numericals(phy_num_x)
        chem_mcq_ans = scan_mcqs(chem_mcq_x)
        chem_num_ans = scan_numericals(chem_num_x)
        math_mcq_ans = scan_mcqs(math_mcq_x)
        math_num_ans = scan_numericals(math_num_x)
        
        scanned_answers = phy_mcq_ans + phy_num_ans + chem_mcq_ans + chem_num_ans + math_mcq_ans + math_num_ans
        
    elif template_type == "JEE 75 (MCQ Only)":
        # Compute rows_y matching new generator
        rows_y = []
        y = 435.0
        for block in range(5):
            for row in range(5):
                rows_y.append(y)
                y += 28.0
            y += 46.0 - 28.0
            
        phy_x = [158.167, 184.167, 210.167, 236.167]
        chem_x = [442.5, 468.5, 494.5, 520.5]
        math_x = [726.833, 752.833, 778.833, 804.833]
        
        def scan_mcq_section(x_coords):
            answers = []
            for ry in rows_y:
                pixel_counts = []
                for cx in x_coords:
                    x_c, y_c = int(cx), int(ry)
                    y1, y2 = max(0, y_c - 7), min(h_w, y_c + 7)
                    x1, x2 = max(0, x_c - 7), min(w_w, x_c + 7)
                    box = thresh[y1:y2, x1:x2]
                    pixel_counts.append(cv2.countNonZero(box))
                ans, status = evaluate_bubble_row(pixel_counts, options)
                answers.append((ans, status))
            return answers
            
        scanned_answers = scan_mcq_section(phy_x) + scan_mcq_section(chem_x) + scan_mcq_section(math_x)
        
    elif template_type == "50-Question OMR":
        # Compute rows_y matching new generator
        rows_y = []
        y = 435.0
        for block in range(5):
            for row in range(5):
                rows_y.append(y)
                y += 27.0
            y += 44.0 - 27.0
        col1_x = [229.25, 255.25, 281.25, 307.25]
        col2_x = [655.75, 681.75, 707.75, 733.75]
        
        def scan_50_col(x_coords):
            answers = []
            for ry in rows_y:
                pixel_counts = []
                for cx in x_coords:
                    x_c, y_c = int(cx), int(ry)
                    y1, y2 = max(0, y_c - 7), min(h_w, y_c + 7)
                    x1, x2 = max(0, x_c - 7), min(w_w, x_c + 7)
                    box = thresh[y1:y2, x1:x2]
                    pixel_counts.append(cv2.countNonZero(box))
                ans, status = evaluate_bubble_row(pixel_counts, options)
                answers.append((ans, status))
            return answers
            
        scanned_answers = scan_50_col(col1_x) + scan_50_col(col2_x)

    elif template_type == "NEET 90 (Biology)":
        rows_y = []
        y = 410.0
        for block in range(6):
            for row in range(5):
                rows_y.append(y)
                y += 25.0
            y += 38.0 - 25.0
        col1_x = [159.667, 184.667, 209.667, 234.667]
        col2_x = [444.0, 469.0, 494.0, 519.0]
        col3_x = [728.333, 753.333, 778.333, 803.333]
        
        def scan_neet_90_col(x_coords):
            answers = []
            for ry in rows_y:
                pixel_counts = []
                for cx in x_coords:
                    x_c, y_c = int(cx), int(ry)
                    y1, y2 = max(0, y_c - 7), min(h_w, y_c + 7)
                    x1, x2 = max(0, x_c - 7), min(w_w, x_c + 7)
                    box = thresh[y1:y2, x1:x2]
                    pixel_counts.append(cv2.countNonZero(box))
                ans, status = evaluate_bubble_row(pixel_counts, options)
                answers.append((ans, status))
            return answers
            
        scanned_answers = scan_neet_90_col(col1_x) + scan_neet_90_col(col2_x) + scan_neet_90_col(col3_x)
        
    elif template_type == "MHCET 200" or template_type == "MHCET 200 (Biology)":
        rows_y = [410.0 + r * 19.5 for r in range(50)]
        col1_x = [131.625, 151.625, 171.625, 191.625]
        col2_x = [344.875, 364.875, 384.875, 404.875]
        col3_x = [558.125, 578.125, 598.125, 618.125]
        col4_x = [771.375, 791.375, 811.375, 831.375]
        
        def scan_mhcet_col(x_coords):
            answers = []
            for ry in rows_y:
                pixel_counts = []
                for cx in x_coords:
                    x_c, y_c = int(cx), int(ry)
                    y1, y2 = max(0, y_c - 7), min(h_w, y_c + 7)
                    x1, x2 = max(0, x_c - 7), min(w_w, x_c + 7)
                    box = thresh[y1:y2, x1:x2]
                    pixel_counts.append(cv2.countNonZero(box))
                ans, status = evaluate_bubble_row(pixel_counts, options)
                answers.append((ans, status))
            return answers
            
        scanned_answers = (scan_mhcet_col(col1_x) + 
                           scan_mhcet_col(col2_x) + 
                           scan_mhcet_col(col3_x) + 
                           scan_mhcet_col(col4_x))

    else:
        # NEET 180 layout
        rows_y = [405.0 + r * 21.8 for r in range(45)]
        phy_x = [161.625 + (i - 1.5) * 20.0 for i in range(4)]
        chem_x = [374.875 + (i - 1.5) * 20.0 for i in range(4)]
        bio1_x = [588.125 + (i - 1.5) * 20.0 for i in range(4)]
        bio2_x = [801.375 + (i - 1.5) * 20.0 for i in range(4)]
        
        def scan_neet_180_section(x_coords):
            answers = []
            for ry in rows_y:
                pixel_counts = []
                for cx in x_coords:
                    x_c, y_c = int(cx), int(ry)
                    y1, y2 = max(0, y_c - 7), min(h_w, y_c + 7)
                    x1, x2 = max(0, x_c - 7), min(w_w, x_c + 7)
                    box = thresh[y1:y2, x1:x2]
                    pixel_counts.append(cv2.countNonZero(box))
                ans, status = evaluate_bubble_row(pixel_counts, options)
                answers.append((ans, status))
            return answers
            
        scanned_answers = (scan_neet_180_section(phy_x) + 
                           scan_neet_180_section(chem_x) + 
                           scan_neet_180_section(bio1_x) + 
                           scan_neet_180_section(bio2_x))
        
    # Evaluate answers dynamically against sections config
    current_q_idx = 0
    total_marks = 0
    total_correct = 0
    total_wrong = 0
    subjects_results = {}
    
    sections = template_config.get("sections", []) if template_config else []
    if not sections:
        sections = [{"name": "General", "questions": len(scanned_answers)}]
        
    for sec in sections:
        sec_name = sec["name"]
        num_questions = sec["questions"]
        subj_results = []
        
        # Determine correct answers list
        if isinstance(answer_keys, list):
            # If frontend sends a simple list of answers, treat it as the general section
            correct_answers = answer_keys if sec_name == "General" else []
        else:
            correct_answers = answer_keys.get(sec_name, [])
            if not correct_answers and "General" in answer_keys:
                correct_answers = answer_keys["General"][current_q_idx : current_q_idx + num_questions]
            
        for q_idx in range(num_questions):
            global_q_idx = current_q_idx + q_idx
            
            # Retrieve scanned answer (with bounds protection)
            if global_q_idx < len(scanned_answers):
                selected, status = scanned_answers[global_q_idx]
            else:
                selected, status = None, "blank"
                
            # Retrieve correct answer
            correct = None
            if q_idx < len(correct_answers):
                correct = correct_answers[q_idx]
            elif isinstance(answer_keys, dict) and "General" in answer_keys and global_q_idx < len(answer_keys["General"]):
                correct = answer_keys["General"][global_q_idx]
                
            # Grade answer
            is_correct = False
            is_wrong = False
            marks = 0
            
            if status == "valid" and selected and correct:
                sel_str = str(selected).strip().upper()
                cor_str = str(correct).strip().upper()
                
                matched = False
                if sel_str == cor_str:
                    matched = True
                else:
                    try:
                        if float(sel_str) == float(cor_str):
                            matched = True
                    except ValueError:
                        pass
                        
                if matched:
                    is_correct = True
                    marks = marks_per_question
                    total_correct += 1
                else:
                    is_wrong = True
                    marks = -negative_marking
                    total_wrong += 1
            elif status == "invalid":
                is_wrong = True
                marks = -negative_marking
                total_wrong += 1
                
            total_marks += marks
                
            subj_results.append({
                "questionNo": q_idx + 1,
                "selectedOption": selected,
                "correctOption": correct,
                "isCorrect": is_correct,
                "status": status,
                "marks": marks
            })
            
        subjects_results[sec_name] = subj_results
        current_q_idx += num_questions
        
    if total_marks < 0:
        total_marks = 0
        
    return {
        "rollNumber": roll_number,
        "totalMarks": total_marks,
        "correctCount": total_correct,
        "wrongCount": total_wrong,
        "subjects": subjects_results
    }

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing JSON configuration path"}))
        sys.exit(1)
        
    json_path = sys.argv[1]
    if not os.path.exists(json_path):
        print(json.dumps({"error": f"File not found: {json_path}"}))
        sys.exit(1)
        
    try:
        with open(json_path, 'r') as f:
            data = json.load(f)
            image_paths = data.get('image_paths', [])
            original_names = data.get('original_names', [])
            answer_keys = data.get('answer_keys', {})
            template_config = data.get('template_config', None)
            template_id = data.get('template_id', None)
            marks_per_question = data.get('marks_per_question', 1)
            negative_marking = data.get('negative_marking', 0)
    except Exception as e:
        print(json.dumps({"error": "Invalid or corrupt JSON file"}))
        sys.exit(1)
        
    if not image_paths:
        print(json.dumps([]))
        sys.exit(0)
        
    results = []
    for idx, path in enumerate(image_paths):
        orig_name = original_names[idx] if idx < len(original_names) else os.path.basename(path)
        result = process_omr_image(path, answer_keys, template_config, orig_name, template_id, marks_per_question, negative_marking)
        results.append(result)
        
    print(json.dumps(results))
    sys.exit(0)

if __name__ == '__main__':
    main()
