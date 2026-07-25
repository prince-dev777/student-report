import os
import cv2
import pytest

from omr_scanner.main import run_scanner
from omr_scanner.config.omr_template import T5_TEMPLATE

def test_t5_synthetic_pipeline(tmp_path):
    blank_path = "OMR_PROJECT/templates/T5_MHCET_200/mhcet_200_template.png"
    if not os.path.exists(blank_path):
        pytest.skip(f"Blank template not found: {blank_path}")
        
    img = cv2.imread(blank_path)
    
    for sec_idx, section in enumerate(T5_TEMPLATE.sections):
        start_q = section["start_q"]
        num_q = section["num_q"]
        opt_to_fill = sec_idx
        
        for q_idx in range(num_q):
            unscaled_x = section["x_coords"][opt_to_fill]
            unscaled_y = section["y_coords"][q_idx]
            
            real_x = int((unscaled_x + 30) * 2)
            real_y = int((unscaled_y + 30) * 2)
            cv2.circle(img, (real_x, real_y), 14, (0, 0, 0), -1)
            
    synthetic_path = str(tmp_path / "synthetic_t5.png")
    cv2.imwrite(synthetic_path, img)
    
    output_dir = str(tmp_path / "output")
    os.makedirs(output_dir, exist_ok=True)
    
    result = run_scanner(synthetic_path, output_dir, template_name="T5", debug=False)
    
    assert result["success"] is True, "Pipeline failed"
    answers = result.get("answers", {})
    assert len(answers) == 200
    
    for i in range(1, 51):
        assert answers[str(i)]["answer"] == "A"
    for i in range(51, 101):
        assert answers[str(i)]["answer"] == "B"
    for i in range(101, 151):
        assert answers[str(i)]["answer"] == "C"
    for i in range(151, 201):
        assert answers[str(i)]["answer"] == "D"
