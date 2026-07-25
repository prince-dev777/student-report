import os
import json
from copy import deepcopy
from typing import Dict, Any

from omr_scanner.main import run_scanner
from omr_scanner.config.omr_template import T1_TEMPLATE

TEST_DATA_DIR = "omr_scanner/tests/test_data"
GROUND_TRUTH_PATH = "phase0_validation/T1_GROUND_TRUTH.json"

def evaluate_result(detected: Dict[str, Any], ground_truth: Dict[str, Any]):
    """
    Classifies a single run into Correct, Safe Failure, or Unsafe Failure.
    """
    correct = 0
    safe_fail = 0
    unsafe_fail = 0
    
    # 1. Roll Number
    det_roll = detected["student"]["roll_number"]
    gt_roll = ground_truth["roll_number"]["value"]
    
    if det_roll == gt_roll:
        correct += 1
    elif "?" in det_roll or det_roll == "BLANK" or det_roll == "UNCERTAIN" or detected["student"].get("status") == "UNCERTAIN":
        safe_fail += 1
    else:
        unsafe_fail += 1
        
    # 2. Answers
    for q_num, gt_ans in ground_truth["answers"].items():
        if q_num not in detected["answers"]:
            safe_fail += 1
            continue
            
        det = detected["answers"][q_num]
        det_status = det["status"]
        det_ans = det["answer"]
        
        gt_status = gt_ans["expected_status"]
        gt_ans_val = gt_ans["expected_answer"]
        
        if det_status == gt_status and det_ans == gt_ans_val:
            correct += 1
        elif det_status in ("UNCERTAIN", "BLANK", "MULTIPLE"):
            if gt_status == det_status:
                correct += 1 # Genuinely blank/multiple
            else:
                safe_fail += 1
        else:
            # It's ANSWERED, but confidently wrong
            unsafe_fail += 1
            
    return correct, safe_fail, unsafe_fail

def run_sweep(roi_sizes, thresholds):
    # Load GT
    with open(GROUND_TRUTH_PATH, "r") as f:
        gt = json.load(f)
        
    images = [f for f in os.listdir(TEST_DATA_DIR) if f.endswith(".jpg")]
    
    results_summary = []
    
    for roi in roi_sizes:
        for thresh in thresholds:
            total_correct = 0
            total_safe = 0
            total_unsafe = 0
            
            # Temporarily modify config
            T1_TEMPLATE.roi_size = roi
            T1_TEMPLATE.fill_threshold = thresh
            
            for img_name in images:
                img_path = os.path.join(TEST_DATA_DIR, img_name)
                try:
                    res = run_scanner(img_path, "omr_scanner/tests/test_output", debug=False)
                    c, s, u = evaluate_result(res, gt)
                    total_correct += c
                    total_safe += s
                    total_unsafe += u
                except Exception as e:
                    # Page detection failure = safe failure (50 questions + 1 roll number)
                    total_safe += 51
                    
            total_cases = total_correct + total_safe + total_unsafe
            accuracy = (total_correct / total_cases) * 100
            unsafe_rate = (total_unsafe / total_cases) * 100
            
            summary = {
                "ROI": f"{roi}x{roi}",
                "Threshold": f"{thresh}%",
                "Correct": total_correct,
                "SafeFail": total_safe,
                "UnsafeFail": total_unsafe,
                "Accuracy": round(accuracy, 2),
                "UnsafeRate": round(unsafe_rate, 2)
            }
            results_summary.append(summary)
            print(f"ROI: {roi:2d} | Thr: {thresh}% | Corr: {total_correct:4d} | Safe: {total_safe:4d} | Unsafe: {total_unsafe:4d} | Acc: {accuracy:5.2f}% | UnsafeErr: {unsafe_rate:5.2f}%")
            
    # Restore defaults
    T1_TEMPLATE.roi_size = 12
    T1_TEMPLATE.fill_threshold = 60.0
    
    return results_summary

if __name__ == "__main__":
    print("--- ROI SWEEP ---")
    run_sweep([8, 10, 12, 14, 16], [60.0])
    print("\n--- THRESHOLD SWEEP ---")
    run_sweep([12], [50.0, 55.0, 60.0, 65.0, 70.0, 75.0])
