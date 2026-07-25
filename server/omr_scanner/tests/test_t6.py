import os
import cv2
import json
import pytest

from omr_scanner.main import run_scanner
from omr_scanner.config.omr_template import T6_TEMPLATE

def test_t6_synthetic_pipeline(tmp_path):
    """
    Validates T6 (MHCET 200 BIO) detection.
    Creates a synthetic filled image from the blank generator output.
    """
    blank_path = "OMR_PROJECT/templates/T6_MHCET_200_BIO/mhcet_200_bio_template.png"
    
    if not os.path.exists(blank_path):
        pytest.skip(f"Blank template not found: {blank_path}")
        
    img = cv2.imread(blank_path)
    
    # We will simulate marking Option A for Q1-50
    # Option B for Q51-100
    # Option C for Q101-150
    # Option D for Q151-200
    
    # For T6, the unscaled template coordinates just need (x+30)*2 to map to the 1926x2944 image.
    for sec_idx, section in enumerate(T6_TEMPLATE.sections):
        start_q = section["start_q"]
        num_q = section["num_q"]
        
        # We fill option A (idx 0) for sec 0, option B (idx 1) for sec 1, etc.
        opt_to_fill = sec_idx
        
        for q_idx in range(num_q):
            unscaled_x = section["x_coords"][opt_to_fill]
            unscaled_y = section["y_coords"][q_idx]
            
            # Map back to 2x scaled original canvas
            real_x = int((unscaled_x + 30) * 2)
            real_y = int((unscaled_y + 30) * 2)
            
            # Draw a filled bubble
            cv2.circle(img, (real_x, real_y), 14, (0, 0, 0), -1)
            
    # Save synthetic image
    synthetic_path = str(tmp_path / "synthetic_t6.png")
    cv2.imwrite(synthetic_path, img)
    
    output_dir = str(tmp_path / "output")
    os.makedirs(output_dir, exist_ok=True)
    
    result = run_scanner(synthetic_path, output_dir, template_name="T6", debug=False)
    
    assert result["success"] is True, "Pipeline failed"
    answers = result.get("answers", {})
    
    assert len(answers) == 200, f"Expected 200 answers, got {len(answers)}"
    
    for i in range(1, 51):
        assert answers[str(i)]["answer"] == "A"
        assert answers[str(i)]["status"] == "ANSWERED"
        
    for i in range(51, 101):
        assert answers[str(i)]["answer"] == "B"
        assert answers[str(i)]["status"] == "ANSWERED"
        
    for i in range(101, 151):
        assert answers[str(i)]["answer"] == "C"
        assert answers[str(i)]["status"] == "ANSWERED"
        
    for i in range(151, 201):
        assert answers[str(i)]["answer"] == "D"
        assert answers[str(i)]["status"] == "ANSWERED"
