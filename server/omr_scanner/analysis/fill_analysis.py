from typing import List

def calculate_confidence(fills: List[float], threshold: float) -> float:
    """
    Calculates a confidence score between 0.0 and 1.0 based on the fill ratios.
    
    Factors considered:
    1. Distance of the maximum fill from the threshold.
    2. Difference between the highest and second-highest fill (if applicable).
    """
    if not fills:
        return 0.0
        
    sorted_fills = sorted(fills, reverse=True)
    highest = sorted_fills[0]
    
    if highest < threshold:
        # It's a BLANK detection. Confidence is higher the closer it is to 0 (farther below threshold).
        margin = threshold - highest
        # If margin is 0, conf is 0. If margin is >= 20, conf is 1.0
        conf = min(1.0, margin / 20.0)
        return round(conf, 2)
        
    else:
        # It's a detection. Confidence is based on distance above threshold
        # AND separation from the second highest.
        margin = highest - threshold
        base_conf = min(1.0, margin / 20.0)
        
        if len(sorted_fills) > 1:
            second_highest = sorted_fills[1]
            if second_highest >= threshold:
                # MULTIPLE mark case. 
                # Confidence that it is a genuine multiple mark is high if both are far above threshold.
                # However, if one is barely above threshold, it's uncertain.
                margin_second = second_highest - threshold
                second_conf = min(1.0, margin_second / 20.0)
                return round((base_conf + second_conf) / 2.0, 2)
            else:
                # SINGLE mark case.
                # Penalize if second highest is dangerously close to threshold.
                separation = threshold - second_highest
                sep_conf = min(1.0, separation / 20.0)
                
                # Combine base confidence and separation confidence
                final_conf = (base_conf * 0.7) + (sep_conf * 0.3)
                return round(final_conf, 2)
                
        return round(base_conf, 2)
