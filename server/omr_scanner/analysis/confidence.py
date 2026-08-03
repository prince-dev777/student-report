from typing import Dict, Any
from omr_scanner.analysis.fill_analysis import calculate_confidence

def add_confidence_scores(results: Dict[str, Any], threshold: float) -> None:
    """
    Iterates through answer results and roll number results in-place 
    to append a 'confidence' score based on the fills array.
    """
    if "answers" in results:
        for q_num, data in results["answers"].items():
            conf = calculate_confidence(data["fills"], threshold)
            data["confidence"] = conf
                
    if "roll_number" in results:
        roll_data = results["roll_number"]
        for digit_data in roll_data["digits"]:
            conf = calculate_confidence(digit_data["fills"], threshold)
            digit_data["confidence"] = conf
            
            if conf < 0.3:
                digit_data["status"] = "UNCERTAIN"
                roll_data["status"] = "UNCERTAIN"
