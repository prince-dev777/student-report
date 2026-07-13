import sys
sys.path.append('.')
from omr_engine_v2 import evaluate_bubble_row

counts = [160, 82, 64, 70]
print(evaluate_bubble_row(counts, ['A', 'B', 'C', 'D']))

counts2 = [134, 34, 48, 47, 51, 56, 63, 50, 61, 46]
print(evaluate_bubble_row(counts2, [str(d) for d in range(10)]))
