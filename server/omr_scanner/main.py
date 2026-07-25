import argparse
import sys
import os
import json
from typing import Optional
from pathlib import Path

from omr_scanner.config.omr_template import (
    T1_TEMPLATE, T2_TEMPLATE, T3_TEMPLATE, T4_TEMPLATE,
    T5_TEMPLATE, T6_TEMPLATE, T7_TEMPLATE, T75_TEMPLATE, T90_TEMPLATE
)
from omr_scanner.preprocessing.image_loader import load_image
from omr_scanner.preprocessing.perspective import apply_perspective_correction
from omr_scanner.preprocessing.preprocessing import preprocess_image
from omr_scanner.detection.page_detector import detect_page_anchors
from omr_scanner.detection.answer_detector import detect_answers
from omr_scanner.detection.roll_number_detector import detect_roll_number
from omr_scanner.ocr.student_name import extract_student_name
from omr_scanner.analysis.confidence import add_confidence_scores
from omr_scanner.analysis.validation import validate_results
from omr_scanner.analysis.scoring import calculate_score
from omr_scanner.output.json_exporter import export_to_json
from omr_scanner.debug.visualizer import Visualizer

def run_scanner(input_path: str, output_dir: str, template_name: str = "T1", debug: bool = False):
    name = template_name.upper()
    if name == "T90":
        config = T90_TEMPLATE
    elif name == "T75":
        config = T75_TEMPLATE
    elif name == "T7":
        config = T7_TEMPLATE
    elif name == "T6":
        config = T6_TEMPLATE
    elif name == "T5":
        config = T5_TEMPLATE
    elif name == "T4":
        config = T4_TEMPLATE
    elif name == "T3":
        config = T3_TEMPLATE
    elif name == "T2":
        config = T2_TEMPLATE
    else:
        config = T1_TEMPLATE
        
    visualizer = Visualizer(output_dir) if debug else None
    
    # 1. LOAD IMAGE
    try:
        image = load_image(input_path)
    except Exception as e:
        print(f"Error loading image: {e}")
        sys.exit(1)
        
    if visualizer:
        visualizer.save_step("01_original.jpg", image)
        
    # 2 & 3. PAGE DETECTION & PERSPECTIVE CORRECTION
    try:
        anchors = detect_page_anchors(image)
        warped = apply_perspective_correction(image, anchors, config.target_width, config.target_height)
        if visualizer:
            visualizer.save_step("05_perspective_corrected.jpg", warped)
    except Exception as e:
        print(f"Error during perspective correction: {e}")
        sys.exit(1)
        
    # 4. PREPROCESSING
    thresh = preprocess_image(warped)
    if visualizer:
        visualizer.save_step("03_threshold.jpg", thresh)
        
    # 5 & 6 & 7. DETECTION (Answers, Roll Number, OCR)
    results = {}
    
    ans_res = detect_answers(thresh, config)
    results["answers"] = ans_res
    
    roll_res = detect_roll_number(thresh, config)
    results["roll_number"] = roll_res
    
    ocr_res = extract_student_name(warped)
    results["student_name"] = ocr_res
    
    # 8. CONFIDENCE SCORING
    add_confidence_scores(results, config.fill_threshold)
    
    # 9. VALIDATION
    try:
        validate_results(results, config)
    except Exception as e:
        print(f"Validation Error: {e}")
        sys.exit(1)
        
    # 10. SCORING
    calculate_score(results, config)
        
    # 11. JSON OUTPUT
    json_path = os.path.join(output_dir, "results.json")
    final_json = export_to_json(os.path.basename(input_path), results, json_path)
    
    # 11. DEBUG VISUALIZATION
    if visualizer:
        visualizer.draw_results(warped, results, config)
        
    return final_json

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Modular OMR Scanner")
    parser.add_argument("--input", required=True, help="Path to input image")
    parser.add_argument("--output", default="debug_output", help="Directory for output JSON and debug images")
    parser.add_argument('--template', choices=['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T75', 'T90'], default='T1',
                        help='Template format (default: T1)')
    parser.add_argument("--debug", action="store_true", help="Enable debug visualizations")
    args = parser.parse_args()
    
    result = run_scanner(args.input, args.output, args.template, args.debug)
    print(json.dumps(result, indent=4))
