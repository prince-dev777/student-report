import sys
import json
import os
import subprocess

image_path = r"C:\Users\sawar\.gemini\antigravity-ide\brain\7041d054-3264-44c3-b0ed-ce8c96976141\media__1783540169041.png"

# Setup the args json exactly like server.js does for 50-questions
template_config = {
    "roll_number_cols": 0,
    "sections": [
        {"name": "General", "questions": 50, "columns": 2, "options": 4}
    ]
}

# The user created an answer key using our template so it's under 'General'
answer_keys = {
    "General": ["A"] * 50
}

payload = {
    "image_paths": [image_path],
    "original_names": ["omr.jpg"],
    "answer_keys": answer_keys,
    "template_config": template_config
}

args_path = "omr_args_test.json"
with open(args_path, "w") as f:
    json.dump(payload, f)

# Call omr_engine_v2.py
try:
    result = subprocess.run([sys.executable, "omr_engine_v2.py", args_path], capture_output=True, text=True)
    print("STDOUT:", result.stdout)
    print("STDERR:", result.stderr)
finally:
    if os.path.exists(args_path):
        os.remove(args_path)
