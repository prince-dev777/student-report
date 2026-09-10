#!/usr/bin/env python3
"""
==============================================================================
Career Xone Pro — AI Passport Photo Studio & Background Replacement Engine
==============================================================================
Uses deep learning human portrait segmentation (silueta / u2net) to cleanly
isolate students and composite them onto professional studio backgrounds:
  1. Studio Passport Blue (Radial vignette lighting - default)
  2. Solid Passport Blue (#2B547E)
  3. Clean White (#FFFFFF - for official NTA JEE / NEET examination forms)
  4. Custom Hex Color

Usage:
  # Process all photos in student_photos/ folder:
  python scripts/ai_passport_photo_studio.py

  # Process specific folder:
  python scripts/ai_passport_photo_studio.py --folder "C:/path/to/photos"

  # Process single photo:
  python scripts/ai_passport_photo_studio.py --input "photo.jpg" --output "out.jpg"

  # Background options:
  python scripts/ai_passport_photo_studio.py --white
  python scripts/ai_passport_photo_studio.py --solid
  python scripts/ai_passport_photo_studio.py --color "#1a365d"
==============================================================================
"""

import os
import sys
import argparse
import shutil
import time

# Ensure proper utf-8 console output on Windows
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

import numpy as np
from PIL import Image, ImageOps

SUPPORTED_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp', '.jfif'}

def hex_to_rgb(hex_str):
    hex_str = hex_str.lstrip('#')
    return tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))

def create_background(width, height, style="studio", custom_color=None):
    if custom_color:
        return Image.new("RGB", (width, height), hex_to_rgb(custom_color))

    if style == "white":
        return Image.new("RGB", (width, height), (255, 255, 255))

    if style == "solid":
        # Classic Passport Blue
        return Image.new("RGB", (width, height), (43, 84, 126))

    # Default: Professional Studio Portrait Radial Vignette
    # Center glow behind head: (62, 128, 192) -> Edges: (28, 62, 98)
    y, x = np.ogrid[:height, :width]
    cx, cy = width / 2.0, height * 0.42
    max_dist = np.sqrt(cx**2 + cy**2)
    dist = np.sqrt((x - cx)**2 + (y - cy)**2) / max_dist
    dist = np.clip(dist, 0.0, 1.0)

    center_color = np.array([62, 128, 192], dtype=np.float32)
    edge_color = np.array([28, 62, 98], dtype=np.float32)

    bg_arr = (center_color * (1.0 - dist[..., None]) + edge_color * dist[..., None]).astype(np.uint8)
    return Image.fromarray(bg_arr)

def process_single_image(input_path, output_path, session, style="studio", custom_color=None, backup_dir=None):
    try:
        import rembg
    except ImportError:
        print("❌ Error: 'rembg' library is not installed in the python environment.")
        sys.exit(1)

    if backup_dir:
        os.makedirs(backup_dir, exist_ok=True)
        filename = os.path.basename(input_path)
        backup_path = os.path.join(backup_dir, filename)
        if not os.path.exists(backup_path):
            shutil.copy2(input_path, backup_path)

    img = Image.open(input_path)
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass

    # Extract portrait cutout using AI
    rgba = rembg.remove(img, session=session)

    # Render background
    bg = create_background(rgba.width, rgba.height, style=style, custom_color=custom_color)

    # Composite
    bg.paste(rgba, (0, 0), rgba)

    # Save
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    bg.save(output_path, "JPEG", quality=95)
    return True

def main():
    parser = argparse.ArgumentParser(description="Career Xone Pro — AI Passport Photo Studio")
    parser.add_argument("--folder", type=str, default=None, help="Directory containing student photos to batch process")
    parser.add_argument("--input", type=str, default=None, help="Single input image path")
    parser.add_argument("--output", type=str, default=None, help="Single output image path")
    parser.add_argument("--style", type=str, choices=["studio", "solid", "white"], default="studio", help="Background style (default: studio)")
    parser.add_argument("--solid", action="store_true", help="Shortcut for --style solid")
    parser.add_argument("--white", action="store_true", help="Shortcut for --style white (for NTA exam forms)")
    parser.add_argument("--color", type=str, default=None, help="Custom hex color (e.g. #1E3A8A)")
    parser.add_argument("--model", type=str, default="silueta", help="rembg model name (default: silueta)")

    args = parser.parse_args()

    style = args.style
    if args.white:
        style = "white"
    elif args.solid:
        style = "solid"

    try:
        import rembg
    except ImportError:
        print("❌ 'rembg' is required. Run: uv pip install rembg onnxruntime")
        sys.exit(1)

    print("=" * 75)
    print("📸 CAREER XONE PRO — AI PASSPORT PHOTO STUDIO")
    print("=" * 75)
    print(f"⚙️ Background Style : {args.color if args.color else style.upper()}")
    print(f"🤖 AI Vision Model   : {args.model}")
    print("⏳ Initializing neural network session...")
    t0 = time.time()
    session = rembg.new_session(args.model)
    print(f"✅ Neural session ready ({round(time.time() - t0, 2)}s)\n")

    # Single Image Mode
    if args.input:
        in_file = os.path.abspath(args.input)
        out_file = os.path.abspath(args.output if args.output else in_file)
        if not os.path.exists(in_file):
            print(f"❌ Input file not found: {in_file}")
            sys.exit(1)

        print(f"🖼️ Processing: {os.path.basename(in_file)} -> {os.path.basename(out_file)}...")
        process_single_image(in_file, out_file, session, style=style, custom_color=args.color)
        print(f"🎉 Completed! Saved to: {out_file}")
        return

    # Batch Folder Mode
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    folder = os.path.abspath(args.folder if args.folder else os.path.join(project_root, "student_photos"))

    if not os.path.exists(folder):
        print(f"❌ Directory not found: {folder}")
        sys.exit(1)

    files = [f for f in os.listdir(folder) if os.path.splitext(f)[1].lower() in SUPPORTED_EXTS]
    if not files:
        print(f"⚠️ No image files found in: {folder}")
        return

    backup_dir = os.path.join(folder, "raw_originals")
    print(f"📂 Scanning folder: {folder}")
    print(f"🎯 Total images to process: {len(files)}")
    print(f"💾 Originals backed up to: {backup_dir}\n")

    success_count = 0
    fail_count = 0

    for i, fname in enumerate(files, 1):
        fpath = os.path.join(folder, fname)
        prefix = f"[{i}/{len(files)}] ({round((i/len(files))*100)}%)"
        print(f"{prefix} Processing {fname}...", end="", flush=True)
        img_t0 = time.time()
        try:
            process_single_image(fpath, fpath, session, style=style, custom_color=args.color, backup_dir=backup_dir)
            print(f" ✅ Done ({round(time.time() - img_t0, 1)}s)")
            success_count += 1
        except Exception as e:
            print(f" ❌ Failed: {e}")
            fail_count += 1

    print("\n" + "=" * 75)
    print("📊 BATCH PROCESSING COMPLETE SUMMARY")
    print("=" * 75)
    print(f"✅ Successfully converted : {success_count}")
    print(f"❌ Failed                : {fail_count}")
    print(f"📁 Output folder         : {folder}")
    print(f"💾 Original backups      : {backup_dir}")
    print("=" * 75)

if __name__ == "__main__":
    main()
