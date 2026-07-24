import json
import subprocess
import sys
import os

omr_dir = r"C:\Users\sawar\MyProjects\student-report\server\uploads\omr"
python_exe = r"C:\Users\sawar\AppData\Local\Python\bin\python.exe"
engine = r"C:\Users\sawar\MyProjects\student-report\server\omr_engine_v2.py"

img_path = os.path.join(omr_dir, "b00ba29ba9e5818c00a0933af0deee7d")

args = {
    "image_paths": [img_path],
    "original_names": ["test.png"],
    "answer_keys": {},
    "marks_per_question": 4,
    "negative_marking": -1,
    "template_id": "jee_75_with_numerical"  # FORCING THE BUGGY TEMPLATE
}

args_path = os.path.join(omr_dir, "test_bug_args.json")
with open(args_path, 'w') as f:
    json.dump(args, f)

proc = subprocess.run([python_exe, engine, args_path], capture_output=True, text=True)
results = json.loads(proc.stdout)
r = results[0]

roll = r.get('rollNumber', 'unknown')
subjects = r.get('subjects', {})
all_answers = []
for subj_name, subj_answers in subjects.items():
    for a in subj_answers:
        all_answers.append(a['selectedOption'] or '-')

phy_summary = {}
for a in all_answers[0:25]:
    phy_summary[a] = phy_summary.get(a, 0) + 1

print(f"Roll: {roll} | Phy summary: {phy_summary}")
os.remove(args_path)
