import numpy as np
from typing import Dict, Any
from omr_scanner.detection.bubble_detector import calculate_fill_ratio
from omr_scanner.config.omr_template import TemplateConfig

def detect_roll_number(thresh_image: np.ndarray, config: TemplateConfig) -> Dict[str, Any]:
    """
    Scans the roll number grid defined in the configuration and classifies digits.
    Returns a dictionary describing the roll number and individual digit detections.
    """
    roll_config = config.roll_no_config
    x_coords = roll_config["x_coords"]
    y_coords = roll_config["y_coords"]
    fill_threshold = getattr(config, 'roll_fill_threshold', None)
    if fill_threshold is None:
        fill_threshold = config.fill_threshold
    
    digits_result = []
    final_str = ""
    overall_status = "DETECTED"
    
    for col_idx, x in enumerate(x_coords):
        fills = []
        selected_digits = []
        
        for digit, y in enumerate(y_coords):
            fill = calculate_fill_ratio(thresh_image, x, y, config.roi_size)
            fills.append(fill)
            if fill > fill_threshold:
                selected_digits.append(str(digit))
                
        # Basic Classification for this column
        if len(selected_digits) == 0:
            status = "BLANK"
            char = "?"
        elif len(selected_digits) == 1:
            status = "DETECTED"
            char = selected_digits[0]
        else:
            # MULTIPLE fill resolution
            sorted_fills = sorted(enumerate(fills), key=lambda item: item[1], reverse=True)
            best_digit, best_fill = sorted_fills[0]
            second_best_digit, second_best_fill = sorted_fills[1]
            
            if best_fill - second_best_fill >= 15.0:
                status = "DETECTED"
                char = str(best_digit)
            else:
                status = "MULTIPLE"
                char = "?"
            
        digits_result.append({
            "digit": char if char != "?" else None,
            "status": status,
            "fills": fills,
            "coordinates": [(x, y_coords[i]) for i in range(len(y_coords))]
        })
        
        final_str += char

    # Strip unbubbled '?' from both left and right sides (e.g. ?102 -> 102, 102? -> 102)
    cleaned_str = final_str.strip("?")
    if cleaned_str:
        final_str = cleaned_str
    else:
        final_str = "?" * len(x_coords)
        
    return {
        "value": final_str,
        "status": "DETECTED" if "?" not in final_str else "UNCERTAIN",
        "digits": digits_result
    }
