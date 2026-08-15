"""
Coordinate calibration tool for T2 numerical sections.
Draws the current template coordinates on the warped image to visually verify alignment.
Also scans for actual bubble positions using contour detection.
"""
import sys
import os
import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from omr_scanner.config.omr_template import T2_TEMPLATE
from omr_scanner.preprocessing.image_loader import load_image
from omr_scanner.preprocessing.perspective import apply_perspective_correction
from omr_scanner.preprocessing.preprocessing import preprocess_image
from omr_scanner.detection.page_detector import detect_page_anchors

def calibrate(image_path):
    config = T2_TEMPLATE
    
    image = load_image(image_path)
    anchors = detect_page_anchors(image)
    warped = apply_perspective_correction(image, anchors, config.target_width, config.target_height)
    thresh = preprocess_image(warped)
    
    roi_half = config.roi_size // 2
    
    # === 1. Draw ALL current template coordinates (MCQ + Numerical) on warped image ===
    calib_img = warped.copy()
    
    for section in config.sections:
        sec_type = section.get("type", "mcq")
        name = section["name"]
        x_coords = section["x_coords"]
        y_coords = section["y_coords"]
        
        if sec_type == "numerical":
            row_offsets = section.get("row_offsets", [])
            for q_idx, y_base in enumerate(y_coords):
                for r_offset in row_offsets:
                    y = int(y_base + r_offset)
                    for x in x_coords:
                        # Draw red dot for current template position
                        cv2.circle(calib_img, (int(x), y), 3, (0, 0, 255), -1)
                        cv2.rectangle(calib_img, (int(x)-roi_half, y-roi_half), (int(x)+roi_half, y+roi_half), (0, 0, 255), 1)
        else:
            for y_base in y_coords:
                for x in x_coords:
                    cv2.circle(calib_img, (int(x), int(y_base)), 3, (0, 0, 255), -1)
                    cv2.rectangle(calib_img, (int(x)-roi_half, int(y_base)-roi_half), (int(x)+roi_half, int(y_base)+roi_half), (0, 0, 255), 1)
    
    cv2.imwrite("calib_template_overlay.png", calib_img)
    
    # === 2. Use contour detection to find actual bubble positions in the numerical area ===
    # Focus on the bottom half of the image (y > 750) where numerical sections are
    h, w = thresh.shape
    
    # Find contours of bubbles in the numerical area
    numerical_region = thresh[750:, :]
    contours, _ = cv2.findContours(numerical_region, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    bubble_centers = []
    bubble_img = warped.copy()
    
    for c in contours:
        (x, y, bw, bh) = cv2.boundingRect(c)
        ar = bw / float(bh) if bh > 0 else 0
        area = cv2.contourArea(c)
        
        # Filter for bubble-sized contours (filled bubbles)
        if 5 <= bw <= 25 and 5 <= bh <= 25 and 0.5 <= ar <= 2.0 and area > 30:
            cX = x + bw // 2
            cY = y + bh // 2 + 750  # Adjust back to full image coords
            bubble_centers.append((cX, cY, area))
            cv2.circle(bubble_img, (cX, cY), 2, (255, 0, 0), -1)
    
    # Sort by y then x
    bubble_centers.sort(key=lambda p: (p[1], p[0]))
    
    print(f"Found {len(bubble_centers)} bubble-like objects in numerical area (y>750)")
    print(f"\nFirst 50 detected bubble centers:")
    for i, (x, y, area) in enumerate(bubble_centers[:50]):
        print(f"  [{i}] x={x}, y={y}, area={area:.0f}")
    
    cv2.imwrite("calib_detected_bubbles.png", bubble_img)
    
    # === 3. Draw horizontal grid lines to help identify y-positions ===
    grid_img = warped.copy()
    for y in range(750, h, 10):
        color = (200, 200, 200) if y % 50 != 0 else (0, 255, 0)
        thickness = 1 if y % 50 != 0 else 2
        cv2.line(grid_img, (0, y), (w, y), color, thickness)
        if y % 50 == 0:
            cv2.putText(grid_img, str(y), (5, y - 3), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (0, 255, 0), 1)
    
    for x in range(0, w, 10):
        color = (200, 200, 200) if x % 50 != 0 else (0, 255, 0)
        thickness = 1 if x % 50 != 0 else 2
        cv2.line(grid_img, (x, 750), (x, h), color, thickness)
        if x % 50 == 0:
            cv2.putText(grid_img, str(x), (x + 2, 765), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (0, 255, 0), 1)
    
    cv2.imwrite("calib_grid.png", grid_img)
    
    # === 4. Specifically analyze the PHYSICS NUMERICAL (first column) to find grid pattern ===
    # Sample a vertical strip at x=70..290 (physics numerical area)
    print(f"\n=== Pixel intensity analysis for Physics Numerical area ===")
    
    # For each numerical section, check if we're on the right x-range
    # Physics: x=70..290
    # Chemistry: x=340..561
    # Math: x=611..831
    
    # Scan horizontal strips to find row centers
    gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
    
    for section_name, x_start, x_end in [("PHYSICS", 50, 310), ("CHEMISTRY", 320, 580), ("MATH", 590, 850)]:
        print(f"\n--- {section_name} section (x={x_start}..{x_end}) ---")
        print("Y-row intensity profile (sum of dark pixels in threshold image):")
        
        for y in range(800, min(h, 1280)):
            strip = thresh[y, x_start:x_end]
            dark_count = np.sum(strip > 0)  # In BINARY_INV, filled pixels are 255
            if dark_count > 20:  # Only show rows with significant dark content
                print(f"  y={y}: dark_px={dark_count}")
    
    print("\nCalibration images saved:")
    print("  calib_template_overlay.png - Current template ROI positions (red)")
    print("  calib_detected_bubbles.png - Detected bubble centers (blue)")
    print("  calib_grid.png - Grid overlay for manual coordinate reading")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        uploads = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads", "omr")
        if os.path.exists(uploads):
            files = [f for f in os.listdir(uploads) if not f.endswith('.json') and not f.endswith('.txt') and os.path.getsize(os.path.join(uploads, f)) > 1000]
            if files:
                files.sort(key=lambda x: os.path.getmtime(os.path.join(uploads, x)), reverse=True)
                image_path = os.path.join(uploads, files[0])
                print(f"Using: {image_path}")
                calibrate(image_path)
            else:
                print("No images found")
        else:
            print("Usage: python calibrate_numerical.py <image_path>")
    else:
        calibrate(sys.argv[1])
