import os
import cv2
import json
import pytest

from omr_scanner.main import run_scanner
from omr_scanner.config.omr_template import T90_TEMPLATE

def test_t90_pipeline():
    """
    Validates that the T90 pipeline accurately detects the physical marks 
    on the T90.jpg sheet without hardcoding the potentially erroneous reference table.
    """
    input_path = "input/T90.jpg"
    
    if not os.path.exists(input_path):
        pytest.skip(f"Input image not found: {input_path}")
        
    output_dir = "test_output_t90"
    os.makedirs(output_dir, exist_ok=True)
    
    result = run_scanner(input_path, output_dir, template_name="T90", debug=False)
    
    assert result["success"] is True, "Pipeline failed"
    answers = result.get("answers", {})
    
    assert len(answers) == 90, f"Expected 90 answers, got {len(answers)}"
    
    # Q1 was uncertain due to multiple marks / horizontal stroke
    assert answers["1"]["status"] == "UNCERTAIN"
    
    # Q2-Q26 was filled as Option A (X=144 is completely solid)
    for i in range(2, 27):
        assert answers[str(i)]["answer"] == "A", f"Q{i} expected A, got {answers[str(i)]['answer']}"
        
    # Q27-Q30 was filled as Option B
    for i in range(27, 31):
        assert answers[str(i)]["answer"] == "B", f"Q{i} expected B, got {answers[str(i)]['answer']}"
        
    # Col 2: Q31-Q60
    assert answers["31"]["answer"] == "A", "Q31 expected A"
    assert answers["32"]["status"] == "MULTIPLE"
    assert answers["33"]["status"] == "BLANK"
    
    for i in range(34, 52):
        assert answers[str(i)]["answer"] == "A", f"Q{i} expected A, got {answers[str(i)]['answer']}"
        
    for i in range(52, 61):
        assert answers[str(i)]["answer"] == "B", f"Q{i} expected B, got {answers[str(i)]['answer']}"
        
    # Col 3: Q61-Q90
    assert answers["61"]["status"] == "UNCERTAIN"
    
    for i in range(62, 77):
        assert answers[str(i)]["answer"] == "C", f"Q{i} expected C, got {answers[str(i)]['answer']}"
        
    for i in range(77, 91):
        assert answers[str(i)]["answer"] == "D", f"Q{i} expected D, got {answers[str(i)]['answer']}"
        
    print("T90 tests passed successfully! Detection precisely matches the physical document.")
