from typing import Dict, Any

def extract_student_name(image) -> Dict[str, Any]:
    """
    Attempts to extract the student name using OCR.
    Given that handwritten OCR is highly unreliable without custom models (e.g. TrOCR),
    this gracefully falls back to unavailable.
    """
    # Placeholder for actual OCR logic (e.g., pytesseract.image_to_string)
    # Since handwriting is unreliable:
    return {
        "value": None,
        "status": "OCR_UNAVAILABLE_OR_UNCERTAIN",
        "confidence": 0.0
    }
