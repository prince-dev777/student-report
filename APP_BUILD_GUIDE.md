# App Build & Independent App Identity Verification Guide

## 1. Overview
This repository provides:
1. **Career Xone Pro (Desktop):** Electron.js desktop application for Windows.
2. **CX Teacher (Mobile Web / PWA):** 360° student records, test dossier, and attendance analysis app for faculty.
3. **CX Parents (Mobile Web / PWA):** Live biometric punch notifications, test performance, and OMR report card app for parents.
4. **CX Inquiry (Mobile Web / PWA):** Front-desk student admission and inquiry management app.
5. **CX Staff (Mobile Web / PWA):** Daily faculty and staff attendance punching app.

---

## 2. Independent Multi-App Architecture & PWA / WebAPK Minting

### 2.1 Identity & Scope Breakdown
To ensure Android Chrome, iOS Safari, and WebAPK minting servers treat each portal as a completely independent app on the device, the following configurations are enforced:

| App Identity | App ID | Scoped URL Path | Start URL | Protocol Scheme | Theme Color |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CX Teacher** | `com.cx.teacher` | `/teacher` | `/teacher?app=teacher#/teacher` | `web+cxteacher://` | `#2563eb` (Blue) |
| **CX Parents** | `com.cx.parents` | `/parent` | `/parent?app=parent#/parent` | `web+cxparents://` | `#0284c7` (Sky) |
| **CX Inquiry** | `com.cx.inquiry` | `/inquiry` | `/inquiry?app=inquiry#/inquiry` | `web+cxinquiry://` | `#059669` (Emerald) |
| **CX Staff** | `com.cx.staff` | `/staff` | `/staff?app=staff#/staff` | `web+cxstaff://` | `#7c3aed` (Purple) |

---

## 3. How to Verify Independent App Installations on Devices

### Step 1: Install CX Teacher First
1. On an Android or iOS device, open:
   `https://studentreport.cxjeeneet.com/teacher?app=teacher#/teacher`
2. Tap the browser menu (or the in-app install banner) and select **"Install App"** / **"Add to Home screen"**.
3. Confirm that the installed app icon is named **"CX Teacher"** with the Teacher theme.

### Step 2: Open and Install CX Parents Second
1. On the same device, open the Parents URL:
   `https://studentreport.cxjeeneet.com/parent?app=parent#/parent`
2. **Expected Behavior:**
   - The link opens in the browser under the `/parent` scope.
   - It does **NOT** hijack or redirect into the "CX Teacher" app window.
3. Tap **"Install App"** / **"Add to Home screen"**.
4. **Expected Behavior:**
   - Android installs a second, separate app icon on the home screen named **"CX Parents"**.
   - Both apps now exist side-by-side on the device home screen as independent apps.

---

## 4. How to Build the Desktop Application (Electron)

> [!IMPORTANT]
> **Git & Build Publishing Rule:** Do NOT run `npm run build` or `electron-builder` unless explicitly instructed right at execution. Version is locked to **`1.0.41`**.

### 4.1 Frontend Build & Asset Audit
```powershell
npm run build
```
- Executes `scripts/audit-codebase.js` to ensure zero missing imports or white-screen errors.
- Compiles Vite bundle into `dist/`.
- Synchronizes `dist/` into `server/public/` for cloud hosting.

### 4.2 Electron Installer Package (When Explicitly Instructed)
```powershell
npm run electron:build
```
- Packages the application into `dist-electron-v2/Career-Xone-Pro-Setup-1.0.41.exe`.
- Bundles `dist/`, `main.cjs`, `preload.cjs`, and `server/` into the ASAR archive.
- Unpacks standalone binaries (`omr_engine_v2.exe` and Python scripts) via `asarUnpack`.

---

## 5. Release Checklist

- [x] OMR scanner coordinates and Weimar scanning engine are untouched.
- [x] Teacher app password gate is removed; data loads immediately on launch.
- [x] All Web App manifests have distinct `id`, `scope`, and `start_url` parameters.
- [x] `preload.cjs` is included in `package.json` `build.files`.
- [x] Native folder picker, `shell:openPath`, and `Green Bubbles` silent OMR download are verified with zero popup browser tabs.
- [x] Biometric integration audit completed (`BIOMETRIC_AUDIT.md`).
