import subprocess
import sys
import os

def main():
    scripts = [
        "generate_jee_75_mcq.py",
        "generate_jee_75_num.py",
        "generate_neet_180.py",
        "generate_neet_90.py",
        "generate_mhcet_200.py",
        "generate_mhcet_200_bio.py",
        "generate_omr_50.py"
    ]
    
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    for script in scripts:
        script_path = os.path.join(current_dir, script)
        if not os.path.exists(script_path):
            print(f"Warning: {script} not found at {script_path}")
            continue
            
        print(f"Running {script}...")
        res = subprocess.run([sys.executable, script_path], capture_output=True, text=True)
        if res.returncode != 0:
            print(f"Error running {script}:")
            print(res.stderr)
        else:
            print(res.stdout.strip())

if __name__ == "__main__":
    main()
