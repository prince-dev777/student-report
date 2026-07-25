import pytest
import cv2
import numpy as np
import os
from omr_scanner.main import run_scanner
from omr_scanner.preprocessing.image_loader import ImageLoadError, ImageResolutionError
from omr_scanner.detection.page_detector import PageDetectionError

def test_missing_file():
    with pytest.raises(SystemExit) as exc:
        run_scanner("does_not_exist.jpg", "out")
    assert exc.value.code == 1

def test_corrupt_file(tmp_path):
    p = tmp_path / "corrupt.jpg"
    p.write_text("not an image")
    with pytest.raises(SystemExit) as exc:
        run_scanner(str(p), "out")
    assert exc.value.code == 1

def test_low_resolution(tmp_path):
    p = tmp_path / "low.jpg"
    # Create a 100x100 tiny image
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    cv2.imwrite(str(p), img)
    with pytest.raises(SystemExit) as exc:
        run_scanner(str(p), "out")
    assert exc.value.code == 1

def test_no_detectable_page(tmp_path):
    p = tmp_path / "blank.jpg"
    # Create a completely blank white image of good size (800x800)
    img = np.full((800, 800, 3), 255, dtype=np.uint8)
    cv2.imwrite(str(p), img)
    with pytest.raises(SystemExit) as exc:
        run_scanner(str(p), "out")
    assert exc.value.code == 1
