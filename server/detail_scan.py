"""
Detailed scan of each OMR image - show roll number and first few answers
to identify which image belongs to which student.
Then verify answers against what's visually on the sheet.
"""
import json, subprocess, os, sys

omr_dir = r"C:\Users\sawar\MyProjects\student-report\server\uploads\omr"
python_exe = r"C:\Users\sawar\AppData\Local\Python\bin\python.exe"
engine = r"C:\Users\sawar\MyProjects\student-report\server\omr_engine_v2.py"

omr_files = sorted([
    os.path.join(omr_dir, f) for f in os.listdir(omr_dir)
    if os.path.isfile(os.path.join(omr_dir, f)) and not f.endswith('.txt') and os.path.getsize(os.path.join(omr_dir, f)) > 1000
])

print(f"Scanning {len(omr_files)} images with detailed output...\n")

for img_path in omr_files:
    args = {
        "image_paths": [img_path],
        "original_names": [os.path.basename(img_path)],
        "answer_keys": {},
        "marks_per_question": 4,
        "negative_marking": -1,
        "template_id": "jee_75"
    }
    
    args_path = os.path.join(omr_dir, "detail_args.json")
    with open(args_path, 'w') as f:
        json.dump(args, f)
    
    proc = subprocess.run([python_exe, engine, args_path], capture_output=True, text=True)
    
    if proc.returncode != 0:
        print(f"  {os.path.basename(img_path)}: ERROR - {proc.stderr[:100]}")
        continue
    
    results = json.loads(proc.stdout)
    r = results[0]
    
    if 'error' in r:
        print(f"  {os.path.basename(img_path)}: ERROR - {r['error']}")
        continue
    
    roll = r['rollNumber']
    subjects = r.get('subjects', {})
    
    # Get all answers in order
    all_answers = []
    for subj_name, subj_answers in subjects.items():
        for a in subj_answers:
            all_answers.append(a['selectedOption'] or '-')
    
    # Show Physics (Q1-5), Chemistry (Q26-30), Math (Q51-55) 
    phy = ''.join(all_answers[0:5])
    chem = ''.join(all_answers[25:30])
    math = ''.join(all_answers[50:55])
    
    # Count per subject
    phy_answers = all_answers[0:25]
    chem_answers = all_answers[25:50]
    math_answers = all_answers[50:75]
    
    phy_summary = {}
    for a in phy_answers:
        phy_summary[a] = phy_summary.get(a, 0) + 1
    chem_summary = {}
    for a in chem_answers:
        chem_summary[a] = chem_summary.get(a, 0) + 1
    math_summary = {}
    for a in math_answers:
        math_summary[a] = math_summary.get(a, 0) + 1
    
    print(f"Roll: {roll:>5s} | Phy: {dict(sorted(phy_summary.items()))} | Chem: {dict(sorted(chem_summary.items()))} | Math: {dict(sorted(math_summary.items()))}")

os.remove(args_path)
