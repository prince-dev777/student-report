import json
import os
from typing import Dict, Any

def export_to_json(filename: str, results: Dict[str, Any], output_path: str):
    """
    Transforms internal results to the final strict JSON schema and saves to disk.
    """
    answers = results.get("answers", {})
    roll_number = results.get("roll_number", {})
    student_name = results.get("student_name", {"value": None, "status": "OCR_UNAVAILABLE"})
    
    total_q = len(answers)
    answered = sum(1 for a in answers.values() if a["status"] == "ANSWERED")
    blank = sum(1 for a in answers.values() if a["status"] == "BLANK")
    multiple = sum(1 for a in answers.values() if a["status"] == "MULTIPLE")
    uncertain = sum(1 for a in answers.values() if a["status"] == "UNCERTAIN")
    
    # Calculate overall confidence
    confidences = [a.get("confidence", 1.0) for a in answers.values()]
    if roll_number.get("digits"):
        confidences.extend([d.get("confidence", 1.0) for d in roll_number["digits"]])
    overall_conf = round(sum(confidences) / len(confidences), 2) if confidences else 1.0
    
    final_output = {
        "success": True,
        "document": {
            "filename": filename
        },
        "student": {
            "name": student_name.get("value"),
            "roll_number": roll_number.get("value")
        },
        "answers": {},
        "summary": {
            "total_questions": total_q,
            "answered": answered,
            "blank": blank,
            "multiple": multiple,
            "uncertain": uncertain
        },
        "quality": {
            "image_quality": 1.0, # Placeholder, can be expanded
            "page_detection_confidence": 1.0, # Placeholder
            "overall_confidence": overall_conf
        }
    }
    
    if "score" in results:
        final_output["score"] = results["score"]
    
    for q_num, data in answers.items():
        final_output["answers"][q_num] = {
            "answer": data["answer"],
            "status": data["status"],
            "confidence": data["confidence"]
        }
        
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(final_output, f, indent=4)
        
    return final_output
