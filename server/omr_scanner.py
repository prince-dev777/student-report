import cv2
import numpy as np
import pytesseract
import re
import json

# Tesseract का path सेट करें (Windows पर जरूरी है, Mac/Linux पर नहीं)
# pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

def order_points(pts):
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect

def four_point_transform(image, pts):
    rect = order_points(pts)
    (tl, tr, br, bl) = rect
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))
    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))
    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]], dtype="float32")
    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))
    return warped

def scan_omr_sheet(image_path):
    image = cv2.imread(image_path)
    ratio = image.shape[0] / 500.0
    orig = image.copy()
    image = cv2.resize(image, (int(image.shape[1] / ratio), 500))

    # Grayscale, Blur, and Edge Detection for Grid
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(blurred, 75, 200)

    # Find the largest contour (The OMR Grid)
    cnts = cv2.findContours(edged.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cnts = cnts[0] if len(cnts) == 2 else cnts[1]
    docCnt = None

    if len(cnts) > 0:
        cnts = sorted(cnts, key=cv2.contourArea, reverse=True)
        for c in cnts:
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.02 * peri, True)
            if len(approx) == 4:
                docCnt = approx
                break

    # Perspective Transform to Straighten the Sheet
    warped_image = four_point_transform(orig, docCnt.reshape(4, 2) * ratio)
    warped_gray = cv2.cvtColor(warped_image, cv2.COLOR_BGR2GRAY)
    
    # OCR for Header Information (Name, Roll No, Batch, Date)
    # Crop the top portion (roughly top 30%)
    h, w = warped_gray.shape
    header_crop = warped_gray[0:int(h*0.3), 0:w]
    text_data = pytesseract.image_to_string(header_crop)
    
    # Regex extraction for specific fields
    roll_no_match = re.search(r'Roll No\s*.*?(\d+)', text_data, re.DOTALL)
    name_match = re.search(r'Name\s*:\s*([A-Za-z. ]+)', text_data)
    batch_match = re.search(r'Batch\s*:\s*([A-Za-z0-9\[\] ]+)', text_data)
    date_match = re.search(r'Test Date\s*:\s*([\d/]+)', text_data)

    # OMR Bubble Detection (Questions 1-25 & 26-50)
    # Threshold the image to detect black marks (Inverse Binary so filled bubbles are white)
    thresh = cv2.threshold(warped_gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)[1]
    
    # Find Contours for Bubbles
    cnts = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cnts = cnts[0] if len(cnts) == 2 else cnts[1]
    question_cnts = []

    for c in cnts:
        (x, y, w_b, h_b) = cv2.boundingRect(c)
        ar = w_b / float(h_b)
        # Filter to find circular bubbles (aspect ratio ~ 1, and size between 20-35px)
        if w_b >= 20 and w_b <= 35 and h_b >= 20 and h_b <= 35 and 0.8 <= ar <= 1.2:
            question_cnts.append(c)

    # Sort contours top to bottom
    boundingBoxes = [cv2.boundingRect(c) for c in question_cnts]
    (question_cnts, boundingBoxes) = zip(*sorted(zip(question_cnts, boundingBoxes), key=lambda b: b[1][1], reverse=False))

    answers = {}
    # Process Questions 1 to 50 (Assuming left side 1-25, right side 26-50)
    # For this logic we treat each group of 4 as a question row
    grouped_rows = [question_cnts[i:i + 4] for i in range(0, len(question_cnts), 4)]
    
    options = ['A', 'B', 'C', 'D']
    current_q = 1

    for row in grouped_rows:
        bubbled = None
        max_pixels = 0
        
        # Sort inside a row from Left to Right (A to D)
        row = sorted(row, key=lambda c: cv2.boundingRect(c)[0])
        
        # Check each bubble in the row
        for (i, c) in enumerate(row):
            mask = np.zeros(thresh.shape, dtype="uint8")
            cv2.drawContours(mask, [c], -1, 255, -1)
            mask = cv2.bitwise_and(thresh, thresh, mask=mask)
            total = cv2.countNonZero(mask)
            
            if total > max_pixels:
                max_pixels = total
                bubbled = options[i]
        
        # If no bubble is marked, it stays empty
        if bubbled is not None and max_pixels > 1000: # Threshold to avoid noise
            answers[current_q] = bubbled
        else:
            answers[current_q] = "UNMARKED"
        
        current_q += 1
        # Stop at question 50
        if current_q > 50:
            break

    # Final Output JSON
    result = {
        "Roll_No": roll_no_match.group(1) if roll_no_match else "Not Found",
        "Name": name_match.group(1).strip() if name_match else "Not Found",
        "Batch": batch_match.group(1).strip() if batch_match else "Not Found",
        "Test_Date": date_match.group(1).strip() if date_match else "Not Found",
        "Answers": answers
    }

    print(json.dumps(result, indent=4))
    return result

# --- Run the Code ---
# अपनी इमेज का सही पाथ डालें:
scan_omr_sheet("test_omr.png")