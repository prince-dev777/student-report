from typing import Dict, Any
from omr_scanner.config.omr_template import TemplateConfig

class OMRTemplateValidationError(Exception):
    pass

def validate_results(results: Dict[str, Any], config: TemplateConfig, mapped_questions=None):
    """
    Validates the generated results against the template configuration.
    Raises OMRTemplateValidationError if mismatches occur.
    """
    if "answers" not in results:
        raise OMRTemplateValidationError("No answers found in results.")
        
    if mapped_questions and len(mapped_questions) > 0:
        expected_q_count = len(mapped_questions)
    else:
        expected_q_count = sum(sec["num_q"] for sec in config.sections)
    actual_q_count = len(results["answers"])
    
    if expected_q_count != actual_q_count:
        raise OMRTemplateValidationError(f"Expected {expected_q_count} questions, but found {actual_q_count}.")
        
    if "roll_number" in results:
        expected_roll_len = config.roll_no_config["cols"]
        actual_roll_len = len(results["roll_number"]["digits"])
        if expected_roll_len != actual_roll_len:
            raise OMRTemplateValidationError(f"Expected roll number length {expected_roll_len}, found {actual_roll_len}.")
