"""
Diagnostic script to debug numerical bubble detection in T2 template.
Uses the UPDATED search-based detection to compare with fixed coordinates.
"""
import sys
import os
import json
import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from omr_scanner.config.omr_template import T2_TEMPLATE
from omr_scanner.preprocessing.image_loader import load_image
from omr_scanner.preprocessing.perspective import apply_perspective_correction
from omr_scanner.preprocessing.preprocessing import preprocess_image
from omr_scanner.detection.page_detector import detect_page_anchors
from omr_scanner.detection.bubble_detector import calculate_fill_ratio, calculate_fill_ratio_with_search
from omr_scanner.detection.answer_detector import detect_answers

def debug_numerical(image_path):
    config = T2_TEMPLATE
    
    image = load_image(image_path)
    anchors = detect_page_anchors(image)
    warped = apply_perspective_correction(image, anchors, config.target_width, config.target_height)
    thresh = preprocess_image(warped)
    
    cv2.imwrite("debug_warped_t2.png", warped)
    cv2.imwrite("debug_thresh_t2.png", thresh)
    
    print(f"\n=== T2 Template Debug (SEARCH-BASED) ===")
    print(f"Target size: {config.target_width}x{config.target_height}")
    print(f"ROI size (MCQ): {config.roi_size}")
    print(f"ROI size (Numerical): {config.roi_size}")
    print(f"Fill threshold: {config.fill_threshold}")
    print(f"Numerical fill threshold: {config.numerical_fill_threshold}")
    
    # Run full detection using the updated answer_detector
    results = detect_answers(thresh, config)
    
    debug_img = warped.copy()
    roi_half = config.roi_size // 2
    
    for section in config.sections:
        sec_type = section.get("type", "mcq")
        if sec_type != "numerical":
            continue
            
        print(f"\n--- {section['name']} (Q{section['start_q']} - Q{section['start_q'] + section['num_q'] - 1}) ---")
        
        for q_idx in range(section["num_q"]):
            q_num = str(section["start_q"] + q_idx)
            data = results.get(q_num, {})
            
            ans = data.get("answer", "N/A")
            status = data.get("status", "N/A")
            fills = data.get("fills", [])
            coords = data.get("coordinates", [])
            conf = data.get("confidence", 0.0)
            
            print(f"\n  Q{q_num}: Answer={ans} Status={status}")
            
            # Draw coordinates on debug image
            for cx, cy in coords:
                cv2.rectangle(debug_img, 
                              (int(cx) - roi_half, int(cy) - roi_half),
                              (int(cx) + roi_half, int(cy) + roi_half), 
                              (255, 0, 0), 1)
            
            # Draw selected answer green circles
            if status == "ANSWERED" and ans:
                options = section["options"]
                options_per_row = len(options)
                for i, char in enumerate(str(ans)):
                    base_idx = i * options_per_row
                    try:
                        idx = base_idx + options[base_idx:base_idx+options_per_row].index(char)
                        sel_x, sel_y = coords[idx]
                        cv2.circle(debug_img, (int(sel_x), int(sel_y)), roi_half + 2, (0, 255, 0), 2)
                    except (ValueError, IndexError):
                        pass
    
    cv2.imwrite("debug_numerical_search.png", debug_img)
    print(f"\nDebug image saved: debug_numerical_search.png")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        uploads = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads", "omr")
        if os.path.exists(uploads):
            files = [f for f in os.listdir(uploads) if not f.endswith('.json') and not f.endswith('.txt') and os.path.getsize(os.path.join(uploads, f)) > 1000]
            if files:
                files.sort(key=lambda x: os.path.getmtime(os.path.join(uploads, x)), reverse=True)
                image_path = os.path.join(uploads, files[0])
                print(f"Using: {image_path}")
                debug_numerical(image_path)
            else:
                print("No images found")
        else:
            print("Usage: python debug_numerical.py <image_path>")
    else:
        debug_numerical(sys.argv[1])
