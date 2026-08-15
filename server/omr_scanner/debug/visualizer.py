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
        
    def draw_results(self, original_warped: np.ndarray, results: Dict[str, Any], config: TemplateConfig, mapped_questions: list = None):
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
                if status in ("DETECTED", "UNCERTAIN") and char is not None:
                    try:
                        idx = int(char)
                        sel_x, sel_y = digit_res["coordinates"][idx]
                        cv2.circle(debug_img, (int(sel_x), int(sel_y)), roi_half + 2, (0, 0, 255), 2)
                    except ValueError:
                        pass
                        
        # 2. Draw Answers
        if "answers" in results:
            for q_num, data in results["answers"].items():
                try:
                    q_num_int = int(q_num)
                except ValueError:
                    q_num_int = -1
                
                # If mapped_questions is provided and this question is not in it, skip drawing completely
                if mapped_questions and q_num_int not in mapped_questions:
                    continue
                    
                coords = data["coordinates"]
                status = data["status"]
                ans = data["answer"]
                conf = data.get("confidence", 0.0)
                opts = data["options"]
                
                for x, y in coords:
                    cv2.rectangle(debug_img, (int(x) - roi_half, int(y) - roi_half), (int(x) + roi_half, int(y) + roi_half), (255, 0, 0), 1)
                    
                # Label question
                start_x, y = coords[0]
                text_x = int(start_x) - 120
                text_y = int(y) + 5
                if len(opts) > len(set(opts)):  # numerical question
                    text_x = int(start_x) + 30
                    text_y = int(y) - 10
                
                cv2.putText(debug_img, f"Q{q_num}: {ans if ans else status} | {conf}", 
                            (text_x, text_y), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1)
                            
                if status in ("ANSWERED", "MULTIPLE") and ans is not None:
                    # Highlight selected options
                    if len(opts) > len(set(opts)):
                        # Multi-row question (e.g. numerical) where options repeat
                        options_per_row = len(set(opts))
                        row_digits = data.get("row_digits")
                        if row_digits:
                            for row_idx, char in enumerate(row_digits):
                                if not char:
                                    continue
                                base_idx = row_idx * options_per_row
                                try:
                                    block_opts = opts[base_idx : base_idx + options_per_row]
                                    idx = base_idx + block_opts.index(char)
                                    sel_x, sel_y = coords[idx]
                                    cv2.circle(debug_img, (int(sel_x), int(sel_y)), roi_half + 2, (0, 255, 0), 2)
                                except ValueError:
                                    pass
                        else:
                            for i, char in enumerate(ans):
                                base_idx = i * options_per_row
                                try:
                                    block_opts = opts[base_idx : base_idx + options_per_row]
                                    idx = base_idx + block_opts.index(char)
                                    sel_x, sel_y = coords[idx]
                                    cv2.circle(debug_img, (int(sel_x), int(sel_y)), roi_half + 2, (0, 255, 0), 2)
                                except ValueError:
                                    pass
                    else:
                        # Standard MCQ
                        for char in ans:
                            if char in opts:
                                idx = opts.index(char)
                                sel_x, sel_y = coords[idx]
                                cv2.circle(debug_img, (int(sel_x), int(sel_y)), roi_half + 2, (0, 255, 0), 2)
                elif status == "UNCERTAIN":
                    # Mark uncertain question entirely in red
                    for x, y in coords:
                        cv2.rectangle(debug_img, (int(x) - roi_half, int(y) - roi_half), (int(x) + roi_half, int(y) + roi_half), (0, 0, 255), 1)
                        
        self.save_step("10_final_answers.jpg", debug_img)
