import cv2
import os
import numpy as np
from typing import Dict, Any
from omr_scanner.config.omr_template import TemplateConfig

class Visualizer:
    def __init__(self, output_dir: str):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        
    def save_step(self, filename: str, image: np.ndarray):
        cv2.imwrite(os.path.join(self.output_dir, filename), image)
        
    def draw_results(self, original_warped: np.ndarray, results: Dict[str, Any], config: TemplateConfig):
        debug_img = original_warped.copy()
        roi_half = config.roi_size // 2
        
        # 1. Draw Roll Number
        if "roll_number" in results:
            roll_data = results["roll_number"]
            for digit_res in roll_data.get("digits", []):
                for x, y in digit_res["coordinates"]:
                    cv2.rectangle(debug_img, (int(x) - roi_half, int(y) - roi_half), (int(x) + roi_half, int(y) + roi_half), (200, 200, 200), 1)
                
                # Highlight the selected digit(s)
                status = digit_res["status"]
                char = digit_res["digit"]
                conf = digit_res.get("confidence", 0.0)
                if status == "DETECTED" and char is not None:
                    try:
                        idx = int(char)
                        sel_x, sel_y = digit_res["coordinates"][idx]
                        cv2.circle(debug_img, (int(sel_x), int(sel_y)), roi_half + 2, (0, 0, 255), 2)
                    except ValueError:
                        pass
                        
        # 2. Draw Answers
        if "answers" in results:
            for q_num, data in results["answers"].items():
                coords = data["coordinates"]
                status = data["status"]
                ans = data["answer"]
                conf = data.get("confidence", 0.0)
                opts = data["options"]
                is_num = len(opts) > len(set(opts))
                
                if not is_num:
                    # Standard MCQ: draw blue bounding boxes around 4 options
                    for x, y in coords:
                        cv2.rectangle(debug_img, (int(x) - roi_half, int(y) - roi_half), (int(x) + roi_half, int(y) + roi_half), (255, 0, 0), 1)
                    
                    # Label MCQ question in left margin
                    start_x, y = coords[0]
                    text_x = max(5, int(start_x) - 95)
                    text_y = int(y) + 4
                    cv2.putText(debug_img, f"Q{q_num}: {ans if ans else status} | {conf}", 
                                (text_x, text_y), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 0, 0), 1)
                                
                    # Highlight selected MCQ option
                    if status in ("ANSWERED", "MULTIPLE") and ans is not None:
                        for char in ans:
                            if char in opts:
                                idx = opts.index(char)
                                sel_x, sel_y = coords[idx]
                                cv2.circle(debug_img, (int(sel_x), int(sel_y)), roi_half + 2, (0, 255, 0), 2)
                    elif status == "UNCERTAIN":
                        for x, y in coords:
                            cv2.rectangle(debug_img, (int(x) - roi_half, int(y) - roi_half), (int(x) + roi_half, int(y) + roi_half), (0, 0, 255), 1)
                else:
                    # Numerical Question: Clean, uncluttered layout
                    start_x, start_y = coords[0]
                    end_x = coords[len(set(opts)) - 1][0]
                    
                    # Draw a single clean outer frame around the 4-row numerical matrix
                    min_bx = int(start_x) - 10
                    max_bx = int(end_x) + 10
                    min_by = int(start_y) - 10
                    max_by = int(coords[-1][1]) + 10
                    cv2.rectangle(debug_img, (min_bx, min_by), (max_bx, max_by), (220, 180, 140), 1)
                    
                    # Clean answer badge in top right header of block
                    badge_text = f"Ans: {ans}" if (status == "ANSWERED" and ans) else status
                    badge_color = (0, 130, 0) if status == "ANSWERED" else (0, 0, 200)
                    
                    # Top badge placed cleanly with crisp white background tag
                    b_str = f"[{badge_text}]"
                    (tw, th), _ = cv2.getTextSize(b_str, cv2.FONT_HERSHEY_SIMPLEX, 0.35, 1)
                    bx_pos = max_bx - tw - 4
                    by_pos = min_by - 4
                    cv2.rectangle(debug_img, (bx_pos - 2, by_pos - th - 2), (bx_pos + tw + 2, by_pos + 2), (255, 255, 255), -1)
                    cv2.putText(debug_img, b_str, (bx_pos, by_pos), cv2.FONT_HERSHEY_SIMPLEX, 0.35, badge_color, 1)
                    
                    # Highlight detected numerical digits with bright green circles
                    row_digits = data.get("row_digits")
                    if row_digits and status in ("ANSWERED", "MULTIPLE"):
                        for row_idx, char in enumerate(row_digits):
                            if not char:
                                continue
                            try:
                                digit_val = int(char)
                                # Each numerical question has 4 rows (TH, H, T, U), with 10 options [0..9] per row
                                coord_idx = row_idx * 10 + digit_val
                                if coord_idx < len(coords):
                                    sel_x, sel_y = coords[coord_idx]
                                    cv2.circle(debug_img, (int(sel_x), int(sel_y)), 10, (0, 255, 0), 2)
                            except (ValueError, IndexError):
                                pass
                        
        self.save_step("10_final_answers.jpg", debug_img)
