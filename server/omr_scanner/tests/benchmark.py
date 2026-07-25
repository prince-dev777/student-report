import time
import os
import psutil
from omr_scanner.main import run_scanner

def run_benchmark(iterations=100):
    input_path = "input/T1.jpg"
    output_dir = "omr_scanner/tests/benchmark_output"
    
    times = []
    
    print(f"Running benchmark ({iterations} iterations)...")
    process = psutil.Process(os.getpid())
    start_mem = process.memory_info().rss
    
    for i in range(iterations):
        start_t = time.perf_counter()
        run_scanner(input_path, output_dir, debug=False)
        end_t = time.perf_counter()
        times.append((end_t - start_t) * 1000)
        
    end_mem = process.memory_info().rss
    
    avg_ms = sum(times) / len(times)
    min_ms = min(times)
    max_ms = max(times)
    
    mem_diff_mb = (end_mem - start_mem) / (1024 * 1024)
    
    print(f"Average: {avg_ms:.2f} ms")
    print(f"Minimum: {min_ms:.2f} ms")
    print(f"Maximum: {max_ms:.2f} ms")
    print(f"Memory Diff (Leaks check): {mem_diff_mb:.2f} MB")

if __name__ == "__main__":
    run_benchmark(100)
