# Comprehensive Bug Fix Report

## Overview
This document outlines the root causes, file modifications, testing procedures, and verification details for the issues resolved in the Student Report application (Version `1.0.41`).

---

## PROBLEM 1: Teacher App — Password Gate Removal & Multi-App Identity / Deep Link Isolation

### Sub-Problem 1a: Remove Password Screen from Teacher App
#### 1. Root Cause Found
- `src/pages/TeacherPortalWeb.jsx` previously contained an explicit authentication gate state (`isLoggedIn`), passcode state (`passcode`), and a modal login form (`<form onSubmit={handleLogin}>`).
- When opened, the app required a faculty passcode (e.g., `'1234'`) before rendering the student dossier and test analytics views.

#### 2. Files Changed
- [`src/pages/TeacherPortalWeb.jsx`](file:///c:/Users/sawar/MyProjects/student-report/src/pages/TeacherPortalWeb.jsx)
- [`src/pages/ShareApp.jsx`](file:///c:/Users/sawar/MyProjects/student-report/src/pages/ShareApp.jsx)

#### 3. Changes Made & Rationale
- **Removed Authentication Barrier:** Removed the passcode state, login handler, and passcode prompt form entirely from `TeacherPortalWeb.jsx`.
- **Immediate Data Loading:** Added `fetchTeacherData()` directly to the mount `useEffect` hook so that when the Teacher App opens, 360° student records, test results, and attendance logs load immediately without prompting for credentials.
- **Removed Logout Button:** Removed the logout button from the top navigation header and replaced it with a dedicated **Sync / Refresh** button to fetch latest data on demand.
- **Updated Share App Texts:** Removed the passcode reference in teacher invite templates in `ShareApp.jsx`.

---

### Sub-Problem 1b: Deep Link / PWA Scope Collision — Apps Not Installing Separately
#### 1. Root Cause Found
- In W3C Web App Manifest and Chromium/Android WebAPK standards, when multiple PWAs on the same origin (domain) share the default `"scope": "/"`, the Android operating system registers the first installed WebAPK as the intent handler for the **entire domain**.
- When the Teacher App was installed first with `scope: "/"`, Android associated `https://studentreport.cxjeeneet.com/*` with the "CX Teacher" WebAPK.
- Consequently, clicking the Parents app URL (`https://studentreport.cxjeeneet.com/?app=parent#/parent`) opened inside the existing "CX Teacher" app window rather than installing or launching a distinct "CX Parents" app.

#### 2. Files Changed
- [`public/manifest-teacher.json`](file:///c:/Users/sawar/MyProjects/student-report/public/manifest-teacher.json)
- [`public/manifest-parent.json`](file:///c:/Users/sawar/MyProjects/student-report/public/manifest-parent.json)
- [`public/manifest-inquiry.json`](file:///c:/Users/sawar/MyProjects/student-report/public/manifest-inquiry.json)
- [`public/manifest-staff.json`](file:///c:/Users/sawar/MyProjects/student-report/public/manifest-staff.json)
- [`public/manifest.json`](file:///c:/Users/sawar/MyProjects/student-report/public/manifest.json)
- [`src/pages/ShareApp.jsx`](file:///c:/Users/sawar/MyProjects/student-report/src/pages/ShareApp.jsx)
- [`index.html`](file:///c:/Users/sawar/MyProjects/student-report/index.html)

#### 3. Changes Made & Rationale
- **Isolated App IDs and Scopes:** Configured explicit and unique `id`, `scope`, `start_url`, and custom protocol handlers for every app identity:
  - **CX Teacher:**
    - App ID: `com.cx.teacher`
    - Scope: `/teacher`
    - Start URL: `/teacher?app=teacher#/teacher`
    - App Name / Short Name: `CX Teacher`
    - Protocol Handler: `web+cxteacher`
  - **CX Parents:**
    - App ID: `com.cx.parents`
    - Scope: `/parent`
    - Start URL: `/parent?app=parent#/parent`
    - App Name / Short Name: `CX Parents`
    - Protocol Handler: `web+cxparents`
  - **CX Inquiry:**
    - App ID: `com.cx.inquiry`
    - Scope: `/inquiry`
    - Start URL: `/inquiry?app=inquiry#/inquiry`
    - App Name / Short Name: `CX Inquiry`
    - Protocol Handler: `web+cxinquiry`
  - **CX Staff:**
    - App ID: `com.cx.staff`
    - Scope: `/staff`
    - Start URL: `/staff?app=staff#/staff`
    - App Name / Short Name: `CX Staff`
    - Protocol Handler: `web+cxstaff`
- **Dynamic Manifest Linking:** Updated `index.html` inline script to dynamically inspect `window.location.pathname`, `hash`, and `search` on initial load and navigation, ensuring the browser links to the exact matching manifest file.
- **Updated Shared Links:** Modified `ShareApp.jsx` so generated QR codes and share buttons point to the scoped URLs (`/parent`, `/teacher`, `/inquiry`, `/staff`).

---

## PROBLEM 2: Download OMR Button — Eliminating Multiple Tabs & Per-Student Save Dialogs

### 1. Root Cause Found
- **Missing Preload Script in ASAR:** In `package.json`, the `"files"` array under `"build"` included `"main.cjs"` and `"server/**/*"` but omitted `"preload.cjs"`.
- In packaged production builds, `preload.cjs` was not bundled into the root of `app.asar`, causing `window.electronAPI` to be `undefined`.
- When `window.electronAPI` was undefined or when source folder detection failed, the renderer fell back to a browser blob download loop (`link.click()` with `target="_blank"`), opening $N$ new browser tabs and prompting $N$ save dialogs for $N$ students.

### 2. Files Changed
- [`package.json`](file:///c:/Users/sawar/MyProjects/student-report/package.json)
- [`main.cjs`](file:///c:/Users/sawar/MyProjects/student-report/main.cjs)
- [`preload.cjs`](file:///c:/Users/sawar/MyProjects/student-report/preload.cjs)
- [`src/pages/Tests.jsx`](file:///c:/Users/sawar/MyProjects/student-report/src/pages/Tests.jsx)
- [`server/server.js`](file:///c:/Users/sawar/MyProjects/student-report/server/server.js)

### 3. Changes Made & Rationale
- **ASAR Packaging Fix:** Added `"preload.cjs"` into `build.files` in `package.json`.
- **Native IPC Handlers Registered:**
  - `dialog:showOpenDialog`: Single native folder picker dialog for destination selection.
  - `shell:openPath`: Opens the exported folder directly in Windows File Explorer.
  - `shell:showItemInFolder`: Reveals individual files in File Explorer.
- **Silent Bulk File Export:**
  - `handleDownloadOMRs` in `Tests.jsx` sends the image collection to `/api/test-results/download-omr-images`.
  - Backend writes all files directly into a dedicated **`Green Bubbles`** subfolder inside the source directory or user-selected folder.
  - No temporary tabs or per-student save dialogs are opened.
  - A single toast notification is displayed: `"🎉 Saved X evaluated OMR images to: [folder]"`.
  - The destination folder is automatically opened on screen in Windows File Explorer.
- **Protected Image Extraction:** Enhanced server candidate paths in `server.js` (`uploadDir`, `dataPath/uploads/omr`, clean URL fallbacks) ensuring images are found in both dev and packaged production modes.

---

## Verification & Parity Summary

| Component / Flow | Dev Environment | Production Build Parity | Status |
| :--- | :--- | :--- | :--- |
| **Teacher App Password** | Bypassed — opens directly | Bypassed — opens directly | ✅ PASS |
| **PWA Scope & App Identity** | Scopes isolated per app route | Scopes isolated per app route | ✅ PASS |
| **Bulk OMR Download** | 1 Dialog / Auto-Save to `Green Bubbles` | 1 Dialog / Auto-Save to `Green Bubbles` | ✅ PASS |
| **Browser Tabs on OMR Export** | 0 Tabs Opened | 0 Tabs Opened | ✅ PASS |
| **Codebase Static Audit** | 0 Missing imports / 0 Errors | Vite & Rollup build clean | ✅ PASS |
