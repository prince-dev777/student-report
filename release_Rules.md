# 🚀 Career Xone Pro — New Update Release Checklist

> Ye list follow karo jab bhi naya update nikalna ho. Koi step skip mat karna!

---

## Step 1: Version Badhao

`package.json` kholo aur `version` ko badhao:

```json
"version": "1.0.31"   ← naya version number daalo
```

---

## Step 2: Git Commit + Tag + Push

Terminal mein ye commands ek-ek karke chalao:

```powershell
git add .
git commit -m "Version 1.0.31"
git tag v1.0.31
git push origin master
git push origin v1.0.31
```

> [!IMPORTANT]
> `git tag` mein version ke aage **`v`** lagana mat bhoolna! (e.g., `v1.0.31`)

---

## Step 3: Local Build Karo

```powershell
npm run build
npx electron-builder
```

> Ye command sirf local build karegi, GitHub pe kuch upload NAHI karega.
> Build complete hone ke baad `dist-electron-v2` folder mein 3 files banegi.

---

## Step 4: Files Rename Karo (ZARURI HAI!)

`dist-electron-v2` folder mein jao aur ye 2 files rename karo:

| Purana Naam (Spaces wala) | Naya Naam (Hyphens wala) |
|---|---|
| `Career Xone Pro Setup 1.0.31.exe` | `Career-Xone-Pro-Setup-1.0.31.exe` |
| `Career Xone Pro Setup 1.0.31.exe.blockmap` | `Career-Xone-Pro-Setup-1.0.31.exe.blockmap` |

> [!WARNING]
> `latest.yml` ko rename MAT karna! Wo pehle se sahi hai.

Ya phir terminal mein ye command chala do (ek baar mein dono rename ho jayenge):

```powershell
cd dist-electron-v2
Rename-Item "Career Xone Pro Setup 1.0.31.exe" "Career-Xone-Pro-Setup-1.0.31.exe"
Rename-Item "Career Xone Pro Setup 1.0.31.exe.blockmap" "Career-Xone-Pro-Setup-1.0.31.exe.blockmap"
cd ..
```

---

## Step 5: GitHub Pe Upload Karo

1. Browser mein jao → `https://github.com/prince-dev777/student-report/releases`
2. **"Draft a new release"** click karo
3. **Tag** mein `v1.0.31` select karo (existing tag se)
4. Title mein `1.0.31` likho
5. `dist-electron-v2` folder se ye **3 files** drag & drop karo:
   - ✅ `Career-Xone-Pro-Setup-1.0.31.exe`
   - ✅ `Career-Xone-Pro-Setup-1.0.31.exe.blockmap`
   - ✅ `latest.yml`
6. **"Publish release"** button dabao

---

## ✅ Verification Checklist

Upload ke baad ye check karo:

- [ ] Release pe **"Latest"** badge hai?
- [ ] `.exe` ka naam mein **hyphens** hain? (dots ya spaces nahi)
- [ ] `.blockmap` ka naam mein **hyphens** hain?
- [ ] `latest.yml` uploaded hai?
- [ ] Total **3 files** + Source code dikhna chahiye

---

## 📋 Quick Reference (Saari Commands Ek Jagah)

```powershell
# 1. Version badhao package.json mein (manually)

# 2. Git
git add .
git commit -m "Version 1.0.XX"
git tag v1.0.XX
git push origin master
git push origin v1.0.XX

# 3. Build
npm run build
npx electron-builder

# 4. Rename (version number apna daalna)
cd dist-electron-v2
Rename-Item "Career Xone Pro Setup 1.0.XX.exe" "Career-Xone-Pro-Setup-1.0.XX.exe"
Rename-Item "Career Xone Pro Setup 1.0.XX.exe.blockmap" "Career-Xone-Pro-Setup-1.0.XX.exe.blockmap"
cd ..

# 5. GitHub pe manually 3 files upload karo (exe + blockmap + latest.yml)
```

> [!TIP]
> Har jagah `XX` ki jagah apna version number daalna! (e.g., `31`, `32`, `33`...)




git add .
git commit -m "Version 1.0.36"
git tag v1.0.36
git push origin master
git push origin v1.0.36
