import numpy as np
from typing import Dict, Any, Tuple
from omr_scanner.detection.bubble_detector import calculate_fill_ratio
from omr_scanner.config.omr_template import TemplateConfig

def calculate_dynamic_alignment(thresh_image: np.ndarray, x_coords: list, y_coords: list, row_offsets: list = None) -> Tuple[float, int, int]:
    """
    Dynamically finds the vertical stretch factor (scale), vertical offset (dy),
    and horizontal column shift (dx) of printed bubbles relative to theoretical coordinates.
    """
    if row_offsets is None or len(row_offsets) == 0:
        row_offsets = [0.0]
        
    all_expected_ys = []
    for y in y_coords:
        for offset in row_offsets:
            all_expected_ys.append(y + offset)
            
    if len(all_expected_ys) < 2:
        return 1.0, 0, 0
        
    height, width = thresh_image.shape[:2]
    
    # 1. Vertical alignment (scale & dy)
    x_min = max(0, int(min(x_coords) - 10))
    x_max = min(width, int(max(x_coords) + 10))
    col_slice = thresh_image[:, x_min:x_max]
    signal = np.sum(col_slice, axis=1) # 1D array of length 'height'
    
    signal_max = np.max(signal)
    if signal_max > 0:
        signal = signal / signal_max
        
    pattern_base = np.zeros(height)
    for y in all_expected_ys:
        y_int = int(round(y))
        if 0 <= y_int < height:
            pattern_base[max(0, y_int - 5):min(height, y_int + 6)] = 1.0
    base_corr = np.sum(signal * pattern_base)
    
    best_scale = 1.0
    best_dy = 0
    max_corr = base_corr
    
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
            if corr > max_corr * 1.03:
                max_corr = corr
                best_scale = scale
                best_dy = dy

    # 2. Horizontal alignment (dx)
    y_min_sec = max(0, int(min(all_expected_ys) - 10))
    y_max_sec = min(height, int(max(all_expected_ys) + 10))
    row_slice = thresh_image[y_min_sec:y_max_sec, :]
    h_signal = np.sum(row_slice, axis=0) # 1D array of length 'width'
    h_max = np.max(h_signal)
    if h_max > 0:
        h_signal = h_signal / h_max
        
    pattern_h_base = np.zeros(width)
    for x in x_coords:
        px = int(round(x))
        if 0 <= px < width:
            pattern_h_base[max(0, px - 4):min(width, px + 5)] = 1.0
    base_h_corr = np.sum(h_signal * pattern_h_base)
    
    best_dx = 0
    max_h_corr = base_h_corr
    for dx in range(-8, 9):
        pattern = np.zeros(width)
        for x in x_coords:
            px = int(round(x + dx))
            if 0 <= px < width:
                pattern[max(0, px - 4):min(width, px + 5)] = 1.0
        corr = np.sum(h_signal * pattern)
        if corr > max_h_corr * 1.03:
            max_h_corr = corr
            best_dx = dx
        
    return best_scale, best_dy, best_dx

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
        
        # Calculate dynamic 2D alignment (scale, dy, dx) for this column/section
        if sec_type == "numerical":
            # Numerical matrices have fixed 4-row capsule blocks where cross-correlation can lock onto box borders.
            # Fixed calibrated coordinates + micro-centering (search_radius=1) ensures 100% stable sampling.
            scale, dy, dx = 1.0, 0, 0
        else:
            # Long MCQ columns (20-45 rows) benefit from dynamic 2D alignment across full page height
            scale, dy, dx = calculate_dynamic_alignment(thresh_image, x_coords, y_coords, row_offsets)
            
        y0 = y_coords[0] if len(y_coords) > 0 else 0
        aligned_x_coords = [int(round(x + dx)) for x in x_coords]
        
        for q_idx in range(num_q):
            expected_y_base = y_coords[q_idx]
            scaled_y_base = int(round(y0 + dy + (expected_y_base - y0) * scale))
            q_num = str(start_q + q_idx)
            
            if sec_type == "mcq":
                fills = []
                for opt_idx, x in enumerate(aligned_x_coords):
                    fill = calculate_fill_ratio(thresh_image, int(x), int(scaled_y_base), config.roi_size, search_radius=1)
                    fills.append(fill)
                
                sorted_indices = sorted(range(len(fills)), key=lambda k: fills[k], reverse=True)
                top1_idx = sorted_indices[0]
                top2_idx = sorted_indices[1] if len(sorted_indices) > 1 else None
                
                top1_fill = fills[top1_idx]
                top2_fill = fills[top2_idx] if top2_idx is not None else 0.0
                
                threshold = config.fill_threshold
                
                if top1_fill < threshold:
                    status = "BLANK"
                    answer = None
                else:
                    dynamic_mult_thresh = max(threshold, top1_fill - 15.0)
                    if top2_fill >= dynamic_mult_thresh:
                        mult_opts = [options[i] for i in range(len(options)) if fills[i] >= dynamic_mult_thresh]
                        status = "MULTIPLE"
                        answer = "".join(mult_opts)
                    else:
                        status = "ANSWERED"
                        answer = options[top1_idx]
                    
                results[q_num] = {
                    "answer": answer,
                    "status": status,
                    "fills": fills,
                    "options": options,
                    "coordinates": [(aligned_x_coords[i], scaled_y_base) for i in range(len(options))],
                    "threshold": threshold
                }
                
            elif sec_type == "numerical":
                threshold = getattr(config, 'numerical_fill_threshold', None)
                if threshold is None:
                    threshold = config.fill_threshold
                
                # Numerical rows are spaced 18px apart. Using roi_size=14 (±7px) instead of 18 (±9px)
                # creates a 4px gap between adjacent rows, preventing row bleed where a single
                # marked digit "3" gets detected as "33" in two overlapping rows.
                # search_radius=0 prevents micro-shift toward capsule borders that inflates digit-0 fills.
                num_roi = 14
                
                all_fills = []
                all_coords = []
                digits = []
                has_multiple_row = False
                
                for r_offset in row_offsets:
                    y = int(round(scaled_y_base + r_offset * scale))
                    row_fills = []
                    
                    for opt_idx, x in enumerate(aligned_x_coords):
                        fill = calculate_fill_ratio(thresh_image, int(x), int(y), num_roi, search_radius=0)
                        row_fills.append(fill)
                        all_coords.append((x, y))
                            
                    all_fills.extend(row_fills)
                    
                    max_fill = max(row_fills) if row_fills else 0
                    if max_fill < threshold:
                        digits.append("")
                    else:
                        sorted_fills = sorted(row_fills, reverse=True)
                        top1 = sorted_fills[0]
                        top2 = sorted_fills[1] if len(sorted_fills) > 1 else 0
                        
                        # MULTIPLE detection: require 2nd mark to be solidly above threshold
                        # (at least 10% margin) AND close to the strongest mark (gap < 15%)
                        # This prevents capsule border noise and bleed artifacts from triggering false MULTIPLE
                        margin2 = top2 - threshold
                        if top2 >= threshold and margin2 >= 10.0 and (top1 - top2) < 15:
                            has_multiple_row = True
                        else:
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
                        answer = str(int(answer_str))
                    
                results[q_num] = {
                    "answer": answer,
                    "status": status,
                    "fills": all_fills,
                    "options": options * len(row_offsets),
                    "coordinates": all_coords,
                    "row_digits": digits,
                    "threshold": threshold
                }
            
    return results
