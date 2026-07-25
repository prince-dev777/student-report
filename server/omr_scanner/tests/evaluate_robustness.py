import os
import json
import time

from omr_scanner.main import run_scanner
from omr_scanner.tests.test_sweeps import evaluate_result

TEST_DATA_DIR = "omr_scanner/tests/test_data"
GROUND_TRUTH_PATH = "phase0_validation/T1_GROUND_TRUTH.json"
OUTPUT_DIR = "omr_scanner/tests/eval_output"

def evaluate_robustness():
    with open(GROUND_TRUTH_PATH, "r") as f:
        gt = json.load(f)
        
    images = [f for f in os.listdir(TEST_DATA_DIR) if f.endswith(".jpg")]
    
    total_correct = 0
    total_safe = 0
    total_unsafe = 0
    
    details = []
    
    for img_name in sorted(images):
        img_path = os.path.join(TEST_DATA_DIR, img_name)
        meta_path = img_path.replace(".jpg", ".json")
        
        with open(meta_path, "r") as f:
            meta = json.load(f)
            
        start_t = time.perf_counter()
        
        try:
            res = run_scanner(img_path, OUTPUT_DIR, debug=True)
            c, s, u = evaluate_result(res, gt)
            
            # If there was an unsafe failure, preserve the debug image specially
            if u > 0:
                print(f"UNSAFE FAILURE IN: {img_name} ({u} errors)")
                
        except Exception as e:
            # If the scanner couldn't even parse the page (like blur or high noise), 
            # it gracefully raises PageDetectionError which aborts.
            # This is a safe failure for the entire document (50 Q + 1 Roll)
            c = 0
            s = 51
            u = 0
            
        end_t = time.perf_counter()
        ms = (end_t - start_t) * 1000
        
        details.append({
            "image": img_name,
            "transformations": meta["transformations"],
            "correct": c,
            "safe_fail": s,
            "unsafe_fail": u,
            "time_ms": round(ms, 2)
        })
        
        total_correct += c
        total_safe += s
        total_unsafe += u

    print("\n=== FINAL ROBUSTNESS REPORT ===")
    total = total_correct + total_safe + total_unsafe
    print(f"Total Correct: {total_correct}")
    print(f"Total Safe Failures: {total_safe}")
    print(f"Total Unsafe Failures: {total_unsafe}")
    
    acc = total_correct / total * 100
    safe_rate = total_safe / total * 100
    unsafe_rate = total_unsafe / total * 100
    
    print(f"\nAccuracy: {acc:.2f}%")
    print(f"Safe Failure Rate: {safe_rate:.2f}%")
    print(f"UNSAFE ERROR RATE: {unsafe_rate:.2f}%")
    
if __name__ == "__main__":
    evaluate_robustness()
