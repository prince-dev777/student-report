# 📸 Career Xone Pro — AI Passport Photo Studio

Deep learning human portrait background segmentation and studio lighting replacement engine. Completely offline, zero subscription costs, lightning-fast.

---

## 🚀 Quick Start Commands

You can run everything directly from your project terminal with simple `npm` commands:

### 1. Batch Process All Student Photos
Put any new student photos inside `./student_photos/` and run:
```bash
npm run photos:passport
```
- Automatically backs up raw originals to `student_photos/raw_originals/`
- Removes room, walls, glass reflections, and background clutter
- Applies professional **Studio Passport Blue** radial vignette lighting (3D studio glow)
- Preserves hair details and shoulder contours

### 2. Upload and Sync with Cloudinary & MongoDB
After converting backgrounds, sync everything to Cloudinary and database in 1 command:
```bash
npm run photos:upload -- --force
```

---

## 🎨 Background Styles & Options

| Command | Background Style | Best Used For |
| :--- | :--- | :--- |
| `npm run photos:passport` | **Studio Portrait Blue** (Radial glow) | Official Student ID Cards & Profile Portals |
| `npm run photos:passport -- --solid` | **Solid Classic Blue** (`#2B547E`) | Flat classic passport photos |
| `npm run photos:passport -- --white` | **Clean White** (`#FFFFFF`) | Official NTA JEE / NEET Exam Registration Forms |
| `npm run photos:passport -- --color "#1E3A8A"` | **Custom Hex Color** | Custom institute color requirements |

---

## 🖼️ Single Photo Processing
To process a single specific image without touching other files:
```bash
npm run photos:passport -- --input "path/to/student.jpg" --output "path/to/result.jpg"
```

---

## ⚙️ Architecture & Safety
- **AI Model:** `silueta.onnx` (42 MB, specialized human portrait segmentation).
- **Offline & Free:** Runs 100% locally via ONNX Runtime & Python without Cloudinary add-on fees or API rate limits.
- **Auto EXIF Transpose:** Automatically detects and corrects phone camera rotation metadata.
- **Safety First:** Original raw camera files are never deleted; they are automatically backed up to `raw_originals/`.
