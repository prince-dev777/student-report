from typing import Dict, Any
from omr_scanner.analysis.fill_analysis import calculate_confidence

def add_confidence_scores(results: Dict[str, Any], threshold: float) -> None:
    """
    Iterates through answer results and roll number results in-place 
    to append a 'confidence' score based on the fills array.
    """
    if "answers" in results:
        for q_num, data in results["answers"].items():
            q_threshold = data.get("threshold", threshold)
            status = data.get("status", "BLANK")
            fills = data.get("fills", [])
            
            if not fills:
                data["confidence"] = 1.0
                continue
                
            is_numerical = len(fills) > 10
            
            if status == "BLANK":
                # BLANK questions must ALWAYS remain BLANK and never be flagged as UNCERTAIN
                highest = max(fills) if fills else 0.0
                margin = max(0.0, q_threshold - highest)
                conf = min(1.0, max(0.50, margin / 15.0 + 0.40))
                data["confidence"] = round(conf, 2)
                data["status"] = "BLANK"
                
            elif status == "ANSWERED":
                if is_numerical:
                    # Numerical questions: row_digits already validated single mark per row
                    data["confidence"] = 0.90
                    data["status"] = "ANSWERED"
                else:
                    sorted_fills = sorted(fills, reverse=True)
                    top1 = sorted_fills[0]
                    top2 = sorted_fills[1] if len(sorted_fills) > 1 else 0.0
                    sep = top1 - top2
                    
                    if sep >= 6.0:
                        # Clear single mark with distinct separation from other options
                        conf = min(1.0, max(0.65, 0.50 + (sep / 30.0)))
                        data["confidence"] = round(conf, 2)
                        data["status"] = "ANSWERED"
                    elif top1 >= threshold + 10.0:
                        # Very dark primary mark
                        data["confidence"] = 0.80
                        data["status"] = "ANSWERED"
                    else:
                        # Genuinely ambiguous / smudge mark
                        conf = calculate_confidence(fills, threshold)
                        data["confidence"] = conf
                        if conf < 0.20:
                            data["status"] = "UNCERTAIN"
                            
            elif status == "MULTIPLE":
                conf = calculate_confidence(fills, threshold)
                data["confidence"] = conf
                
    if "roll_number" in results:
        roll_data = results["roll_number"]
        has_uncertain = False
        for digit_data in roll_data.get("digits", []):
            d_status = digit_data.get("status")
            d_fills = digit_data.get("fills", [])
            
            if d_status == "DETECTED" and digit_data.get("digit") is not None:
                sorted_fills = sorted(d_fills, reverse=True)
                top1 = sorted_fills[0] if sorted_fills else 0.0
                top2 = sorted_fills[1] if len(sorted_fills) > 1 else 0.0
                sep = top1 - top2
                
                if sep >= 6.0 or top1 >= threshold + 10.0:
                    digit_data["confidence"] = round(min(1.0, max(0.75, 0.50 + (sep / 25.0))), 2)
                    digit_data["status"] = "DETECTED"
                else:
                    conf = calculate_confidence(d_fills, threshold)
                    digit_data["confidence"] = conf
                    if conf < 0.20:
                        digit_data["status"] = "UNCERTAIN"
                        has_uncertain = True
            else:
                has_uncertain = True
                
        if has_uncertain:
            roll_data["status"] = "UNCERTAIN"
        else:
            roll_data["status"] = "SUCCESS"
