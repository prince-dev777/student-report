import sys
import os
import json

# Add parent directory to sys.path so we can import omr_engine_v2
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import omr_engine_v2

def run_test():
    print("Testing determine_template...")
    
    # Test 1: omr_50 template detection
    t1 = omr_engine_v2.determine_template("some_file.jpg", {"General": ["A"]*50}, template_id="omr_50")
    print(f"Template for 'omr_50': {t1}")
    assert t1 == "50-Question OMR", f"Expected 50-Question OMR, got {t1}"
    
    # Test 2: mhcet_200 template detection
    t2 = omr_engine_v2.determine_template("some_file.jpg", {"General": ["A"]*200}, template_id="mhcet_200")
    print(f"Template for 'mhcet_200': {t2}")
    assert t2 == "MHCET 200", f"Expected MHCET 200, got {t2}"

    # Test 3: fallback by count
    t3 = omr_engine_v2.determine_template("some_file.jpg", {"General": ["A"]*50})
    print(f"Template for count 50 fallback: {t3}")
    assert t3 == "50-Question OMR", f"Expected 50-Question OMR, got {t3}"
    
    t4 = omr_engine_v2.determine_template("some_file.jpg", {"General": ["A"]*200})
    print(f"Template for count 200 fallback: {t4}")
    assert t4 == "MHCET 200", f"Expected MHCET 200, got {t4}"
    
    print("\nAll template determination tests passed successfully!")

if __name__ == "__main__":
    run_test()
