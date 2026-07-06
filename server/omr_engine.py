import sys
import json
import os

try:
    import cv2
    import numpy as np
except ImportError:
    print(json.dumps({"error": "OpenCV not installed"}))
    sys.exit(1)

def process_omr_image(image_path, answer_key, options_per_question=4, columns=1):
    try:
        img = cv2.imread(image_path)
        if img is None:
            return {"error": "Failed to process image", "details": "Could not read image file"}

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # 5. Apply a simple deskew
        blurred_deskew = cv2.GaussianBlur(gray, (5, 5), 0)
        edged = cv2.Canny(blurred_deskew, 50, 150)
        cnts_deskew_result = cv2.findContours(edged.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cnts_deskew = cnts_deskew_result[0] if len(cnts_deskew_result) == 2 else cnts_deskew_result[1]
        
        if cnts_deskew:
            c = max(cnts_deskew, key=cv2.contourArea)
            if cv2.contourArea(c) > 5000:
                rect = cv2.minAreaRect(c)
                angle = rect[-1]
                if angle < -45:
                    angle = -(90 + angle)
                else:
                    angle = -angle
                    
                if abs(angle) > 0.5 and abs(angle) < 45:
                    (h, w) = img.shape[:2]
                    center = (w // 2, h // 2)
                    M = cv2.getRotationMatrix2D(center, angle, 1.0)
                    img = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
                    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # 3. QR code / fallback roll number extraction
        roll_number = ""
        if hasattr(cv2, 'QRCodeDetector'):
            detector = cv2.QRCodeDetector()
            val, pts, qr_code = detector.detectAndDecode(img)
            roll_number = val.strip() if val else ""
            
        if not roll_number:
            filename = os.path.basename(image_path)
            roll_number = "".join(filter(str.isdigit, filename))
            
        if not roll_number:
            return {"error": "Could not extract roll number"}
            
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)[1]
        
        cnts_result = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cnts = cnts_result[0] if len(cnts_result) == 2 else cnts_result[1]
        
        bubbles = []
        for c in cnts:
            (x, y, w, h) = cv2.boundingRect(c)
            ar = w / float(h)
            if w >= 15 and h >= 15 and 0.8 <= ar <= 1.2:
                bubbles.append(c)

        if not bubbles:
            return {"error": "Failed to process image", "details": "No bubbles found"}

        # Sort bubbles top-to-bottom
        def get_y(c):
            return cv2.boundingRect(c)[1]
        def get_x(c):
            return cv2.boundingRect(c)[0]
            
        bubbles = sorted(bubbles, key=get_y)
        
        physical_rows = []
        current_row = [bubbles[0]]
        for b in bubbles[1:]:
            if abs(get_y(b) - get_y(current_row[-1])) < 15:
                current_row.append(b)
            else:
                physical_rows.append(current_row)
                current_row = [b]
        physical_rows.append(current_row)
        
        columns_data = [[] for _ in range(columns)]
        for r in physical_rows:
            r = sorted(r, key=get_x)
            chunk_size = options_per_question
            for col_idx in range(columns):
                start = col_idx * chunk_size
                end = start + chunk_size
                if start < len(r):
                    columns_data[col_idx].append(r[start:min(end, len(r))])
                    
        logical_rows = []
        for col in columns_data:
            logical_rows.extend(col)
            
        # 4. Validate rows match answerKey
        if len(logical_rows) != len(answer_key):
            return {"error": "Row count mismatch", "details": f"Expected {len(answer_key)} rows, got {len(logical_rows)}"}
        
        # Options logic
        options = [chr(ord('A') + i) for i in range(options_per_question)]
        student_answers = []
        marks = 0
        
        for idx, correct_ans in enumerate(answer_key):
            row_bubbles = logical_rows[idx]
            bubbled = None
            max_pixels = 0
            
            for i, c in enumerate(row_bubbles):
                mask = np.zeros(thresh.shape, dtype="uint8")
                cv2.drawContours(mask, [c], -1, 255, -1)
                mask = cv2.bitwise_and(thresh, thresh, mask=mask)
                total = cv2.countNonZero(mask)
                
                if total > max_pixels and total > 50:
                    max_pixels = total
                    bubbled = options[i] if i < len(options) else None
            
            student_answers.append(bubbled)
            if bubbled == correct_ans:
                marks += 1

        return {
            "rollNumber": roll_number,
            "marks": marks,
            "studentAnswers": student_answers,
            "rank": None
        }

    except Exception as e:
        return {"error": "Failed to process image", "details": str(e)}

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: python omr_engine.py <path_to_json_file>"}))
        sys.exit(1)
        
    json_path = sys.argv[1]
    if not os.path.isfile(json_path):
        print(json.dumps({"error": f"File not found: {json_path}"}))
        sys.exit(1)
        
    try:
        with open(json_path, 'r') as f:
            data = json.load(f)
            answer_key = data.get('answerKey', [])
            image_paths = data.get('images', [])
            options_per_question = data.get('optionsPerQuestion', 4)
            columns = data.get('columns', 1)
    except Exception as e:
        print(json.dumps({"error": "Invalid or corrupt JSON file"}))
        sys.exit(1)
        
    if not image_paths:
        print(json.dumps([]))
        sys.exit(0)
        
    results = []
    
    for path in image_paths:
        result = process_omr_image(path, answer_key, options_per_question, columns)
        results.append(result)
            
    print(json.dumps(results))
    sys.exit(0)
