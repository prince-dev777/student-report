import pytest
import numpy as np
from omr_scanner.detection.answer_detector import detect_answers
from omr_scanner.analysis.confidence import add_confidence_scores
from omr_scanner.config.omr_template import TemplateConfig

# Dummy template config for 1 question, 4 options
dummy_config = TemplateConfig(
    name="Test",
    roi_size=12,
    fill_threshold=60.0,
    target_width=100,
    target_height=100,
    roll_no_config={},
    sections=[
        {
            "name": "Sec1",
            "start_q": 1,
            "num_q": 1,
            "options": ["A", "B", "C", "D"],
            "x_coords": [10, 30, 50, 70],
            "y_coords": [10]
        }
    ]
)

def run_synthetic_mark(img):
    res = detect_answers(img, dummy_config)
    add_confidence_scores({"answers": res}, dummy_config.fill_threshold)
    return res["1"]

def test_completely_blank():
    img = np.zeros((100, 100), dtype=np.uint8)
    res = run_synthetic_mark(img)
    assert res["status"] == "BLANK"
    
def test_one_dark_mark():
    img = np.zeros((100, 100), dtype=np.uint8)
    # Fill option B (x=30, y=10) with 255
    img[4:16, 24:36] = 255
    res = run_synthetic_mark(img)
    assert res["status"] == "ANSWERED"
    assert res["answer"] == "B"
    assert res["confidence"] == 1.0
    
def test_very_faint_mark():
    img = np.zeros((100, 100), dtype=np.uint8)
    # Fill exactly 55% of option C
    # 12x12 = 144 pixels. 55% of 144 = 79 pixels.
    # Fill a 8x10 area = 80 pixels.
    img[5:15, 46:54] = 255
    res = run_synthetic_mark(img)
    # Below 60 threshold, should be BLANK or UNCERTAIN
    assert res["status"] in ("BLANK", "UNCERTAIN")
    
def test_erased_mark_and_dark_mark():
    img = np.zeros((100, 100), dtype=np.uint8)
    # Erased mark on A (45% filled) -> 64 pixels (8x8)
    img[6:14, 6:14] = 255
    # Dark mark on D (100% filled) -> 144 pixels (12x12)
    img[4:16, 64:76] = 255
    res = run_synthetic_mark(img)
    assert res["status"] == "ANSWERED"
    assert res["answer"] == "D"
    
def test_multiple_marks():
    img = np.zeros((100, 100), dtype=np.uint8)
    img[4:16, 24:36] = 255 # B
    img[4:16, 44:56] = 255 # C (Wait, C is at 50, so bounds are 44:56)
    res = run_synthetic_mark(img)
    assert res["status"] == "MULTIPLE"
    assert res["answer"] == "BC"
    
def test_mark_between_bubbles():
    img = np.zeros((100, 100), dtype=np.uint8)
    # Center mark between A(10) and B(30) -> at x=20
    # Overlaps A and B but maybe not enough to cross threshold
    img[4:16, 14:26] = 255
    res = run_synthetic_mark(img)
    # Should probably fail safely (BLANK/UNCERTAIN) rather than hallucinate
    assert res["status"] in ("BLANK", "UNCERTAIN")

def test_random_noise():
    # Base noise over the whole image
    img = np.random.randint(0, 100, (100, 100), dtype=np.uint8)
    res = run_synthetic_mark(img)
    assert res["status"] in ("BLANK", "UNCERTAIN")
