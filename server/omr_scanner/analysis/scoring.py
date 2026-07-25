from typing import Dict, Any

def calculate_score(results: Dict[str, Any], config: Any) -> None:
    """
    Calculates the final score based on the detected answers and the template's answer key.
    Appends a 'score' dictionary to the results.
    """
    if not hasattr(config, "answer_key") or not config.answer_key:
        # If no answer key is defined (e.g. for T1 initially), we cannot grade it.
        return
        
    answer_key = config.answer_key
    detected_answers = results.get("answers", {})
    
    correct = 0
    incorrect = 0
    unanswered = 0
    
    # Iterate through all questions defined in the answer key
    for q_num, correct_ans in answer_key.items():
        if q_num not in detected_answers:
            unanswered += 1
            continue
            
        student_data = detected_answers[q_num]
        student_ans = student_data.get("answer", "")
        status = student_data.get("status", "")
        
        if student_ans == correct_ans:
            correct += 1
        elif status == "BLANK":
            unanswered += 1
        else:
            # MULTIPLE, UNCERTAIN, or just the wrong option
            incorrect += 1
            
    total_questions = len(answer_key)
    
    # Existing project scoring rule default: +1 for correct
    total_score = correct
    
    results["score"] = {
        "correct": correct,
        "incorrect": incorrect,
        "unanswered": unanswered,
        "total_score": total_score,
        "max_possible": total_questions
    }
