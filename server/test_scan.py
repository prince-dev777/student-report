import sys
sys.path.append('.')
from omr_engine_v2 import process_omr_image

res = process_omr_image('uploads/warped_debug.png', {}, template_id="jee_75_with_numerical")
print(res)
