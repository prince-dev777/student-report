import os
import argparse
import json
import csv
import traceback
from glob import glob
from pathlib import Path
from tqdm import tqdm
from omr_scanner.main import run_scanner

def run_batch(input_dir: str, output_dir: str, template_name: str = "T1", debug: bool = False):
    """
    Executes the OMR scanner across an entire directory of images.
    Continues on failure, aggregates results, and generates a review queue.
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # Support jpg, png, jpeg
    image_paths = []
    for ext in ('*.jpg', '*.jpeg', '*.png'):
        image_paths.extend(glob(os.path.join(input_dir, ext)))
        
    if not image_paths:
        print(f"No images found in {input_dir}")
        return
        
    print(f"Starting batch processing of {len(image_paths)} images...")
    
    summary_results = []
    review_queue = []
    
    for img_path in tqdm(image_paths, desc="Processing OMR Sheets"):
        filename = os.path.basename(img_path)
        
        try:
            # Run scanner (creates individual JSON in output_dir)
            result = run_scanner(img_path, output_dir, template_name=template_name, debug=debug)
            
            # Extract basic metrics for summary
            total_answered = 0
            total_blank = 0
            total_multiple = 0
            total_uncertain = 0
            
            for q, ans_data in result.get("answers", {}).items():
                status = ans_data.get("status")
                conf = ans_data.get("confidence", 0.0)
                
                if status == "ANSWERED":
                    total_answered += 1
                elif status == "BLANK":
                    total_blank += 1
                elif status == "MULTIPLE":
                    total_multiple += 1
                elif status == "UNCERTAIN":
                    total_uncertain += 1
                    
                # Add to review queue if ambiguous
                if status in ("UNCERTAIN", "MULTIPLE") or conf < 0.7:
                    review_queue.append({
                        "document": filename,
                        "reason": f"{status}_ANSWER" if status in ("UNCERTAIN", "MULTIPLE") else "LOW_CONFIDENCE",
                        "question": q,
                        "confidence": round(conf, 2)
                    })
            
            roll_no = result.get("student", {}).get("roll_number", "")
            roll_status = result.get("student", {}).get("status", "SUCCESS")
            
            if roll_status == "UNCERTAIN" or "?" in roll_no:
                review_queue.append({
                    "document": filename,
                    "reason": "ROLL_NUMBER_UNCERTAIN",
                    "question": None,
                    "confidence": 0.0
                })
            
            score_data = result.get("score", {})
            
            summary_results.append({
                "filename": filename,
                "status": "SUCCESS",
                "roll_number": roll_no,
                "answered": total_answered,
                "blank": total_blank,
                "multiple": total_multiple,
                "uncertain": total_uncertain,
                "score": score_data.get("total_score", 0),
                "max_possible": score_data.get("max_possible", 0),
                "overall_confidence": round(result.get("overall_confidence", 0.0), 2),
                "error": ""
            })
            
        except Exception as e:
            # Gracefully catch ANY error and continue the batch
            error_msg = str(e)
            
            summary_results.append({
                "filename": filename,
                "status": "FAILED",
                "roll_number": "",
                "answered": 0,
                "blank": 0,
                "multiple": 0,
                "uncertain": 0,
                "score": 0,
                "max_possible": 0,
                "overall_confidence": 0.0,
                "error": error_msg
            })
            
            review_queue.append({
                "document": filename,
                "reason": "PIPELINE_FAILURE",
                "question": None,
                "confidence": 0.0,
                "error_details": error_msg
            })
            
    # Write aggregated summary (CSV)
    csv_path = os.path.join(output_dir, "batch_summary.csv")
    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "filename", "status", "roll_number", "answered", "blank", "multiple", 
            "uncertain", "score", "max_possible", "overall_confidence", "error"
        ])
        writer.writeheader()
        writer.writerows(summary_results)
        
    # Write aggregated summary (JSON)
    json_path = os.path.join(output_dir, "batch_summary.json")
    with open(json_path, "w") as f:
        json.dump(summary_results, f, indent=4)
        
    # Write Review Queue
    queue_path = os.path.join(output_dir, "review_queue.json")
    with open(queue_path, "w") as f:
        json.dump(review_queue, f, indent=4)
        
    print(f"\nBatch processing complete.")
    print(f"Successfully processed: {sum(1 for r in summary_results if r['status'] == 'SUCCESS')}")
    print(f"Failed: {sum(1 for r in summary_results if r['status'] == 'FAILED')}")
    print(f"Items requiring manual review: {len(review_queue)}")
    print(f"Results saved to: {output_dir}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="OMR Scanner Batch Processor")
    parser.add_argument("--input", type=str, required=True, help="Directory containing input OMR images")
    parser.add_argument("--output", type=str, required=True, help="Directory to save JSON results and summaries")
    parser.add_argument("--template", type=str, default="T1", choices=["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T75", "T90"], help="OMR template to use")
    parser.add_argument("--debug", action="store_true", help="Generate visual debug overlays")
    args = parser.parse_args()
    
    run_batch(args.input, args.output, args.template, args.debug)
