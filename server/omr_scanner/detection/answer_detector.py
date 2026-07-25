import numpy as np
from typing import Dict, Any
from omr_scanner.detection.bubble_detector import calculate_fill_ratio
from omr_scanner.config.omr_template import TemplateConfig

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
        
        for q_idx in range(num_q):
            y_base = y_coords[q_idx]
            q_num = str(start_q + q_idx)
            
            if sec_type == "mcq":
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
                row_offsets = section.get("row_offsets", [])
                
                # Set threshold to 50.0 as requested
                threshold = 50.0
                
                all_fills = []
                all_coords = []
                digits = []
                has_multiple_row = False
                
                for r_offset in row_offsets:
                    y = y_base + r_offset
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
                        
                        # MULTIPLE tabhi jab dono fills close hon (difference < 15)
                        if top2 > threshold and (top1 - top2) < 15:
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
                    "coordinates": all_coords
                }
            
    return results
