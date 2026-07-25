import pytest
from omr_scanner.analysis.fill_analysis import calculate_confidence

def test_confidence_blank():
    # Max fill is 10%, threshold is 60%
    # Margin = 50. > 20, so conf should be 1.0
    conf = calculate_confidence([10.0, 5.0, 2.0, 1.0], 60.0)
    assert conf == 1.0

def test_confidence_blank_uncertain():
    # Max fill is 55%, threshold is 60%
    # Margin = 5. Conf = 5/20 = 0.25
    conf = calculate_confidence([55.0, 5.0, 2.0, 1.0], 60.0)
    assert conf == 0.25

def test_confidence_answered_high():
    # Max fill is 90%, threshold is 60%
    # Margin = 30. Base Conf = 1.0
    # Second highest is 10%. Threshold - second = 50. Sep conf = 1.0
    # Overall: 1.0
    conf = calculate_confidence([90.0, 10.0, 2.0, 1.0], 60.0)
    assert conf == 1.0

def test_confidence_answered_uncertain_separation():
    # Max fill is 80%, threshold is 60%. Base conf = 1.0
    # Second highest is 55%. Sep = 5. Sep conf = 5/20 = 0.25
    # Overall = (1.0 * 0.7) + (0.25 * 0.3) = 0.7 + 0.075 = 0.775 -> 0.78
        conf = calculate_confidence([80.0, 55.0, 2.0, 1.0], 60.0)
        assert conf == 0.77

def test_confidence_multiple_high():
    # Two fills at 90%. Threshold is 60%.
    # Base conf = 1.0. Second margin = 30. Second conf = 1.0
    # Overall = (1.0 + 1.0) / 2 = 1.0
    conf = calculate_confidence([90.0, 85.0, 2.0, 1.0], 60.0)
    assert conf == 1.0

def test_confidence_multiple_uncertain():
    # Max 80%, second 62%. Threshold 60%.
    # Base conf = 1.0. Second margin = 2. Second conf = 0.1
    # Overall = 0.55
    conf = calculate_confidence([80.0, 62.0, 2.0, 1.0], 60.0)
    assert conf == 0.55
