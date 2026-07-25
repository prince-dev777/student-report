# Career Xone Pro - Project Documentation

This document describes the complete architecture, features, and folder structure of the **Career Xone Pro (student-report)** Desktop Application.

## 🏗️ Project Architecture
The application is a hybrid **Edge + Cloud** Desktop Application built using **Electron**. 
- **Frontend**: Built with React & Vite.
- **Local Edge Server**: A local Node.js Express server runs in the background. It handles heavy tasks (like OMR image processing via Python and WhatsApp messaging) locally to save bandwidth and improve speed.
- **Cloud Backend**: Standard CRUD operations (Students, Tests, Attendance data) are synced with the Cloud API (hosted on Render).

---

## 📁 Directory Structure & Files

### 1. Root Directory (`/`)
* **`package.json`**: Contains all dependencies, build configurations for `electron-builder`, and scripts (e.g., `npm run electron:publish`).
* **`main.cjs`**: The Electron main process. 
  * Starts the Local Node.js server.
  * Creates the application window.
  * Manages the Tray Icon.
  * Contains the **Auto-Updater** logic which checks for updates every 15 minutes from GitHub Releases.
* **`.env`**: Environment variables, specifically pointing the frontend to the local Edge server (`VITE_API_BASE_URL=http://localhost:5001/api`).

### 2. Frontend Source (`/src`)
This folder contains the React application.
* **`main.jsx` & `App.jsx`**: The entry points of the React application with routing setup.
* **`pages/`**: Contains the main UI views:
  * `Dashboard.jsx`: Shows key metrics, attendance trends, average scores, and recent activity.
  * `Students.jsx`: View, search, and manage students. Supports bulk Excel/CSV imports.
  * `Attendance.jsx`: Manages student attendance records.
  * `Tests.jsx`: Test creation and management. Links to the OMR Scanner interface.
  * `SMSCenter.jsx`: Interface for tracking and sending SMS/WhatsApp messages.
  * `Login.jsx` / `Register.jsx`: User authentication screens.
* **`components/`**: Reusable UI components:
  * `OMRScanner.jsx`: The core UI for the OMR scanning feature. Allows users to upload multiple scanned images, sends them to the local backend, and displays the processed results and errors.
  * `Sidebar.jsx` & `Topbar.jsx`: Navigation components. Topbar contains the real-time "Update Available" indicator.
  * `SettingsModal.jsx`: App configuration settings.
* **`context/`**: 
  * `AppContext.jsx`: Global state management for data like Students and SMS history.
  * `AuthContext.jsx`: Handles user sessions and tokens.
* **`utils/api.js`**: A centralized API client. It intelligently routes standard requests to the Cloud, and heavy requests (like `uploadOMRImages`) to the local Edge server (`http://localhost:5001`).

### 3. Local Edge Server (`/server`)
This folder contains the background Node.js server and Python engine that run alongside the Electron app.
* **`local-omr-server.js`**: The Express server running on port `5001`. 
  * **OMR Endpoint (`/api/local-omr-process`)**: Receives uploaded images, saves them to `/uploads/omr/`, and triggers the Python OMR engine.
  * **WhatsApp Endpoint**: Queues and sends WhatsApp messages locally using `whatsapp-web.js`.
  * **Biometric ADMS Proxy (`/iclock`)**: Intercepts requests from local biometric attendance machines and securely forwards them to the Cloud.
  * **Update Endpoints (`/api/system/update-status`)**: Bridges communication between the Electron `autoUpdater` and the React frontend.
* **`omr_engine_v2.py`**: The core Python script utilizing **OpenCV**.
  * Performs perspective transformation to align scanned pages.
  * Detects answer bubbles and calculates scores based on a provided answer key.
  * Supports complex templates including MCQ and Numerical formats (e.g., JEE Main 75 questions).
* **`services/whatsappClient.js` & `whatsappService.js`**: Handles the headless browser automation for sending WhatsApp messages directly from the user's computer.
* **`uploads/`**: Temporarily stores scanned OMR images and generated debug overlays before they are processed and returned to the UI.

---

## ✨ Key Features Detailed

### 1. Advanced OMR Scanning (Edge Computing)
Instead of sending 100s of heavy images to the cloud, the React frontend sends them to the Local Node.js Server. The Node.js server executes a highly optimized Python OpenCV script (`omr_engine_v2.py`) which processes the images locally in seconds and returns the extracted roll numbers, answers, and scores.

### 2. Auto-Updating System
Powered by `electron-updater`, the `main.cjs` file constantly monitors the GitHub Releases page. When a new version (e.g., `v1.0.18`) is published, it downloads the update silently in the background and notifies the React frontend. A blue "Update" button appears in the Topbar, allowing a seamless 1-click upgrade.

### 3. Biometric ADMS Integration
The local server acts as a bridge. A physical biometric machine on the local network can push attendance data to `http://<local-ip>:5001/iclock`. The local server captures this and proxies it to the Cloud API, bypassing any strict firewall or CORS limitations.

### 4. Zero-Cost WhatsApp Messaging
By leveraging `whatsapp-web.js` on the local machine, the application can send bulk messages (like test results or attendance alerts) directly from the user's linked WhatsApp account without needing expensive third-party APIs.
