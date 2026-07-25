import os
import json
import pytest
from omr_scanner.main import run_scanner

def test_t1_end_to_end():
    input_path = "input/T1.jpg"
    output_dir = "test_output_t1"
    
    # 1. Run scanner
    results = run_scanner(input_path, output_dir, debug=False)
    
    assert results["success"] is True
    assert results["summary"]["total_questions"] == 50
    
    # 2. Load Ground Truth
    gt_path = "phase0_validation/T1_GROUND_TRUTH.json"
    with open(gt_path, "r") as f:
        ground_truth = json.load(f)
        
    # 3. Verify Roll Number
    # "451?"
    detected_roll = results["student"]["roll_number"]
    expected_roll = ground_truth["roll_number"]["value"]
    
    assert detected_roll == expected_roll, f"Roll number mismatch: got {detected_roll}, expected {expected_roll}"
    
    # 4. Verify All Answers
    for q_num, gt_ans in ground_truth["answers"].items():
        detected = results["answers"][q_num]
        
        expected_status = gt_ans["expected_status"]
        expected_answer = gt_ans["expected_answer"]
        
        assert detected["status"] == expected_status, f"Q{q_num} status mismatch: got {detected['status']}, expected {expected_status}"
        assert detected["answer"] == expected_answer, f"Q{q_num} answer mismatch: got {detected['answer']}, expected {expected_answer}"

    # Verify Q2 specifically as per acceptance criteria
    assert results["answers"]["2"]["status"] == "BLANK"
    assert results["answers"]["2"]["answer"] is None
