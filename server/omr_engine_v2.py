import sys
import os
import json
import tempfile
import shutil

try:
    from omr_scanner.main import run_scanner
except ImportError as e:
    print(json.dumps([{"filename": "unknown", "success": False, "error": f"Failed to import run_scanner: {str(e)}"}]))
    sys.exit(1)

# Template Mapping
TEMPLATE_MAP = {
    "jee_75_with_numerical": "T2",
    "jee_75_mcq": "T1",
    "neet_180": "T3",
    "neet_90": "T4",
    "mhcet_200": "T5",
    "mhcet_200_bio": "T6",
    "omr_50": "T7",
    "T1": "T1",
    "T2": "T2",
    "T3": "T3",
    "T4": "T4",
    "T5": "T5",
    "T6": "T6",
    "T7": "T7"
}

def main():
    if len(sys.argv) < 2:
        print(json.dumps([{"filename": "unknown", "success": False, "error": "No arguments provided. Expected JSON file path."}]))
        sys.exit(1)

    args_file_path = sys.argv[1]
    
    try:
        with open(args_file_path, 'r', encoding='utf-8') as f:
            args = json.load(f)
    except Exception as e:
        print(json.dumps([{"filename": "unknown", "success": False, "error": f"Failed to read arguments: {str(e)}"}]))
        sys.exit(1)

    image_paths = args.get('image_paths', [])
    original_names = args.get('original_names', [])
    answer_keys = args.get('answer_keys', {}).get("General", {})
    mapped_questions = args.get('mapped_questions', [])
    marks_per_question = float(args.get('marks_per_question', 4.0))
    negative_marking = float(args.get('negative_marking', -1.0))
    template_id_raw = args.get('template_id', '')

    template_id = TEMPLATE_MAP.get(template_id_raw, "T1")
    
    final_results = []

    for idx, img_path in enumerate(image_paths):
        original_name = original_names[idx] if idx < len(original_names) else os.path.basename(img_path)
        
        try:
            # Check if image actually exists
            if not os.path.exists(img_path):
                raise FileNotFoundError(f"Image not found at {img_path}")

            # Create temp directory for output
            temp_output_dir = tempfile.mkdtemp()
            
            # Run scanner
            run_scanner(
                input_path=img_path,
                output_dir=temp_output_dir,
                template_name=template_id,
                mapped_questions=mapped_questions,
                debug=True
            )
            
            annotated_img_path = os.path.join(temp_output_dir, "10_final_answers.jpg")
            if os.path.exists(annotated_img_path):
                shutil.copy2(annotated_img_path, img_path)
            
            # Read results.json
            results_json_path = os.path.join(temp_output_dir, "results.json")
            if not os.path.exists(results_json_path):
                raise RuntimeError("Scanner failed to produce results.json")
                
            with open(results_json_path, 'r', encoding='utf-8') as f:
                scan_data = json.load(f)
                
            questions = scan_data.get('answers', {})
            raw_roll = scan_data.get('student', {}).get('roll_number', '')
            roll_number = ''
            if isinstance(raw_roll, str):
                cleaned_roll = raw_roll.strip('? ')
                roll_number = cleaned_roll if cleaned_roll else raw_roll
            else:
                roll_number = str(raw_roll or '')
            
            # Format answers and calculate score
            correct_count = 0
            wrong_count = 0
            blank_count = 0
            total_marks = 0
            
            subj_results = []
            
            q_keys = sorted(questions.keys(), key=lambda x: int(x) if x.isdigit() else x)
            if mapped_questions and len(mapped_questions) > 0:
                mapped_set = set(int(x) for x in mapped_questions if str(x).isdigit())
                q_keys = [q for q in q_keys if int(q) in mapped_set]
            
            for q_num_str in q_keys:
                q_data = questions[q_num_str]
                ans = q_data.get('answer')
                status = q_data.get('status')
                
                selected = ans
                if status == "BLANK" or ans is None:
                    selected = ""
                    status_mapped = "blank"
                elif status == "MULTIPLE":
                    # User Rule: MCQ MULTIPLE = Blank
                    selected = ""
                    status_mapped = "blank"
                else:
                    status_mapped = "valid"
                    
                correct_ans = None
                if answer_keys:
                    if isinstance(answer_keys, list):
                        try:
                            # Usually q_num_str is 1-based, e.g., "1", "2"
                            idx = int(q_num_str) - 1
                            if 0 <= idx < len(answer_keys):
                                correct_ans = answer_keys[idx]
                        except ValueError:
                            pass
                    elif isinstance(answer_keys, dict):
                        if q_num_str in answer_keys:
                            correct_ans = answer_keys[q_num_str]
                    
                is_correct = False
                marks = 0
                
                if status_mapped == "valid" and selected:
                    if correct_ans:
                        sel_str = str(selected).strip().upper()
                        cor_str = str(correct_ans).strip().upper()
                        
                        matched = False
                        if sel_str == cor_str:
                            matched = True
                        else:
                            try:
                                if float(sel_str) == float(cor_str):
                                    matched = True
                            except ValueError:
                                pass
                                
                        if matched:
                            is_correct = True
                            marks = marks_per_question
                            correct_count += 1
                        else:
                            marks = -abs(negative_marking)
                            wrong_count += 1
                    else:
                        # Attempted but no answer key
                        pass
                elif status_mapped == "blank":
                    blank_count += 1
                
                total_marks += marks
                
                subj_results.append({
                    "questionNo": int(q_num_str) if q_num_str.isdigit() else q_num_str,
                    "selectedOption": selected,
                    "correctOption": correct_ans,
                    "isCorrect": is_correct,
                    "status": status_mapped,
                    "marks": marks
                })
                
            if total_marks < 0:
                total_marks = 0
                
            final_results.append({
                "filename": original_name,
                "rollNumber": roll_number,
                "subjects": {"General": subj_results},
                "totalMarks": total_marks,
                "correctCount": correct_count,
                "wrongCount": wrong_count,
                "blank": blank_count,
                "success": True,
                "error": None
            })
            
        except Exception as e:
            final_results.append({
                "filename": original_name,
                "success": False,
                "error": str(e)
            })
            
        finally:
            # Cleanup temp directory
            if 'temp_output_dir' in locals() and os.path.exists(temp_output_dir):
                shutil.rmtree(temp_output_dir, ignore_errors=True)

    print(json.dumps(final_results))

if __name__ == '__main__':
    main()
