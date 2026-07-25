import os
import cv2
import json
import pytest

from omr_scanner.main import run_scanner
from omr_scanner.config.omr_template import T2_TEMPLATE

def test_t2_synthetic_pipeline(tmp_path):
    """
    Validates T2 (JEE 75 Numerical) detection.
    Creates a synthetic filled image from the blank generator output.
    """
    blank_path = "OMR_PROJECT/templates/T2_JEE_75_NUM/jee_75_num_template.png"
    
    if not os.path.exists(blank_path):
        pytest.skip(f"Blank template not found: {blank_path}")
        
    img = cv2.imread(blank_path)
    
    # Fill MCQ Sections (0, 1, 2)
    for sec_idx in range(3):
        section = T2_TEMPLATE.sections[sec_idx]
        for q_idx in range(section["num_q"]):
            opt_to_fill = 0  # Fill A for all
            unscaled_x = section["x_coords"][opt_to_fill]
            unscaled_y = section["y_coords"][q_idx]
            
            real_x = int((unscaled_x + 30) * 2)
            real_y = int((unscaled_y + 30) * 2)
            cv2.circle(img, (real_x, real_y), 12, (0, 0, 0), -1)

    # Fill Numerical Sections (3, 4, 5)
    num_answers = ["1024", "0059", "7310", "4444", "0000"]
    for sec_idx in range(3, 6):
        section = T2_TEMPLATE.sections[sec_idx]
        for q_idx in range(section["num_q"]):
            ans_str = num_answers[q_idx]
            y_base = section["y_coords"][q_idx]
            
            for row_idx, char in enumerate(ans_str):
                digit = int(char)
                unscaled_x = section["x_coords"][digit]
                unscaled_y = y_base + section["row_offsets"][row_idx]
                
                real_x = int((unscaled_x + 30) * 2)
                real_y = int((unscaled_y + 30) * 2)
                cv2.circle(img, (real_x, real_y), 12, (0, 0, 0), -1)
                
    # Save synthetic image
    synthetic_path = str(tmp_path / "synthetic_t2.png")
    cv2.imwrite(synthetic_path, img)
    
    output_dir = str(tmp_path / "output")
    os.makedirs(output_dir, exist_ok=True)
    
    result = run_scanner(synthetic_path, output_dir, template_name="T2", debug=False)
    
    assert result["success"] is True, "Pipeline failed"
    answers = result.get("answers", {})
    
    assert len(answers) == 75, f"Expected 75 answers, got {len(answers)}"
    
    # Verify MCQ
    mcq_questions = list(range(1, 21)) + list(range(26, 46)) + list(range(51, 71))
    for q in mcq_questions:
        assert answers[str(q)]["answer"] == "A", f"Q{q} expected A, got {answers[str(q)]['answer']}"
        assert answers[str(q)]["status"] == "ANSWERED"
        
    # Verify Numerical
    num_questions = list(range(21, 26)) + list(range(46, 51)) + list(range(71, 76))
    for i, q in enumerate(num_questions):
        expected_ans = num_answers[i % 5]
        assert answers[str(q)]["answer"] == expected_ans, f"Q{q} expected {expected_ans}, got {answers[str(q)]['answer']}"
        assert answers[str(q)]["status"] == "ANSWERED"
