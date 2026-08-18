import numpy as np
from typing import Dict, Any, Tuple
from omr_scanner.detection.bubble_detector import calculate_fill_ratio
from omr_scanner.config.omr_template import TemplateConfig

def calculate_dynamic_alignment(thresh_image: np.ndarray, x_coords: list, y_coords: list, row_offsets: list = None) -> Tuple[float, int]:
    """
    Dynamically finds the vertical stretch factor (scale) and offset (shift) 
    of the printed bubbles relative to the theoretical y_coords using 1D correlation.
    """
    if row_offsets is None or len(row_offsets) == 0:
        row_offsets = [0.0]
        
    all_expected_ys = []
    for y in y_coords:
        for offset in row_offsets:
            all_expected_ys.append(y + offset)
            
    if len(all_expected_ys) < 2:
        return 1.0, 0
        
    height = thresh_image.shape[0]
    
    # 1. Extract the column signal by summing across the width of the bubbles
    x_min, x_max = min(x_coords) - 10, max(x_coords) + 10
    x_min = max(0, x_min)
    x_max = min(thresh_image.shape[1], x_max)
    
    col_slice = thresh_image[:, x_min:x_max]
    signal = np.sum(col_slice, axis=1) # 1D array of length 'height'
    
    # Normalize signal to reduce noise impact
    signal_max = np.max(signal)
    if signal_max > 0:
        signal = signal / signal_max
        
    best_scale = 1.0
    best_dy = 0
    max_corr = -1
    
    scales = np.linspace(0.96, 1.04, 17) # 0.005 steps
    shifts = range(-12, 13, 2) # -12 to +12 pixels
    
    y0 = all_expected_ys[0]
    
    for scale in scales:
        for dy in shifts:
            pattern = np.zeros(height)
            for y in all_expected_ys:
                scaled_y = int(round(y0 + dy + (y - y0) * scale))
                if 0 <= scaled_y < height:
                    y_min = max(0, scaled_y - 5)
                    y_max = min(height, scaled_y + 6)
                    pattern[y_min:y_max] = 1.0
                    
            corr = np.sum(signal * pattern)
            if corr > max_corr:
                max_corr = corr
                best_scale = scale
                best_dy = dy
                
    if max_corr < len(all_expected_ys) * 0.1:
        return 1.0, 0
        
    return best_scale, best_dy

def detect_answers(thresh_image: np.ndarray, config: TemplateConfig) -> Dict[str, Any]:
    """
    Scans the answer sections defined in the configuration and classifies them.
    Returns a dictionary of raw measurements and classifications for each question.
    """
    results = {}
    
    for section in config.sections:
        start_q = section["start_q"]
        num_q = section["num_q"]
        options = section["options"]
        x_coords = section["x_coords"]
        y_coords = section["y_coords"]
        sec_type = section.get("type", "mcq")
        row_offsets = section.get("row_offsets", [])
        
        # Calculate dynamic alignment for this section
        scale, dy = calculate_dynamic_alignment(thresh_image, x_coords, y_coords, row_offsets)
        
        if row_offsets:
            y0 = y_coords[0] + row_offsets[0]
        else:
            y0 = y_coords[0]
        
        for q_idx in range(num_q):
            expected_y_base = y_coords[q_idx]
            q_num = str(start_q + q_idx)
            
            if sec_type == "mcq":
                y_base = int(round(y0 + dy + (expected_y_base - y0) * scale))
                
                fills = []
                selected_options = []
                
                for opt_idx, x in enumerate(x_coords):
                    fill = calculate_fill_ratio(thresh_image, int(x), int(y_base), config.roi_size)
                    fills.append(fill)
                    if fill > config.fill_threshold:
                        selected_options.append(options[opt_idx])
                        
                # Basic Classification
                if len(selected_options) == 0:
                    status = "BLANK"
                    answer = None
                elif len(selected_options) == 1:
                    status = "ANSWERED"
                    answer = selected_options[0]
                else:
                    status = "MULTIPLE"
                    answer = "".join(selected_options)
                    
                results[q_num] = {
                    "answer": answer,
                    "status": status,
                    "fills": fills,
                    "options": options,
                    "coordinates": [(x_coords[i], y_base) for i in range(len(options))]
                }
                
            elif sec_type == "numerical":
                threshold = getattr(config, 'numerical_fill_threshold', None)
                if threshold is None:
                    threshold = config.fill_threshold
                
                all_fills = []
                all_coords = []
                digits = []
                has_multiple_row = False
                
                for r_offset in row_offsets:
                    expected_y = expected_y_base + r_offset
                    y = int(round(y0 + dy + (expected_y - y0) * scale))
                    row_fills = []
                    
                    for opt_idx, x in enumerate(x_coords):
                        fill = calculate_fill_ratio(thresh_image, int(x), int(y), config.roi_size)
                        row_fills.append(fill)
                        all_coords.append((x, y))
                            
                    all_fills.extend(row_fills)
                    
                    max_fill = max(row_fills) if row_fills else 0
                    if max_fill < threshold:
                        # Append empty string for blank row (e.g. TH=blank -> left padded blank)
                        digits.append("")
                    else:
                        # Top 2 fills nikalo
                        sorted_fills = sorted(row_fills, reverse=True)
                        top1 = sorted_fills[0]
                        top2 = sorted_fills[1] if len(sorted_fills) > 1 else 0
                        
                        # Use a dynamic threshold to avoid text in empty bubbles triggering MULTIPLE
                        # The text in numerical bubbles can cause fill ratios up to 55-60%.
                        # If top1 is high (e.g. 85), we set threshold to 65. 
                        # If top1 is lower (e.g. 60), we set threshold to 50.
                        dynamic_threshold = max(threshold, min(top1 - 20, 65.0))
                        
                        # MULTIPLE tabhi jab dono fills close hon
                        if top2 > dynamic_threshold and (top1 - top2) < 20:
                            has_multiple_row = True
                        else:
                            # Highest fill wala bubble select karo
                            best_idx = row_fills.index(max_fill)
                            digits.append(options[best_idx])
                            
                if has_multiple_row:
                    status = "MULTIPLE"
                    answer = None
                else:
                    answer_str = "".join(digits)
                    if not answer_str:
                        status = "BLANK"
                        answer = None
                    else:
                        status = "ANSWERED"
                        # Return string representation of the integer
                        answer = str(int(answer_str))
                    
                results[q_num] = {
                    "answer": answer,
                    "status": status,
                    "fills": all_fills,
                    "options": options * len(row_offsets),
                    "coordinates": all_coords,
                    "row_digits": digits,
                }
            
    return results
