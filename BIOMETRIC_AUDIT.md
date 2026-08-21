# Biometric Integration & System Audit Report

## 1. Executive Summary
The Student Report application includes a built-in **Biometric Control Center & Real-Time Sync Engine** designed to interface with physical fingerprint, facial recognition, and RFID biometric attendance devices (primarily ZKTeco, eSSL, Realtime, and FK series).

---

## 2. Current Architecture & SDK Analysis

### 2.1 Libraries & Protocols Used
1. **ZKTeco / eSSL Device Protocol (Pull Mode):**
   - **Library:** `node-zklib`
   - **Mechanism:** Pure JavaScript implementation of the ZKTeco binary UDP/TCP socket protocol over port **4370**.
   - **Native Addon Status:** `node-zklib` does **NOT** rely on C++ native `.node` addons. It uses Node.js standard library modules (`net`, `dgram`, `crypto`, and `Buffer`).
   - **Functions Used:** `createSocket()`, `getInfo()`, `getAttendances()`, `disconnect()`.

2. **FK / Realtime Push Protocol (Push / ADMS Mode):**
   - **Mechanism:** Real-time HTTP push receiver and socket listener.
   - **Endpoints (in `server/server.js`):**
     - Primary listener: Express server on port **5000** (`/iclock/cdata`, `/cdata`, `/getrequest`, `/fdata`, `/rtlog`, `/registry`, `/push`, `/ping`).
     - Secondary hardware listener: Dedicated TCP listener on port **71** for legacy FK biometric devices.

3. **Subnet Auto-Discovery Engine:**
   - **Mechanism:** Asynchronous parallel TCP port probing using Node.js `net.Socket`.
   - **Ports Probed:** Port 71 (FK/Realtime), Port 4370 (ZKTeco/eSSL), Port 5005 (Realtime Series).
   - **Scan Method:** Identifies local network interfaces via `os.networkInterfaces()`, constructs the `/24` subnet IP range (`192.168.X.1` - `192.168.X.254`), and evaluates port connectivity in parallel batches of 100 with a 750ms timeout.

---

## 3. Development vs. Production Status

| Feature / Capability | Development (`electron:dev`) | Production Build (`electron:build`) | Audit Finding & Notes |
| :--- | :--- | :--- | :--- |
| **Wi-Fi Subnet Scanner** | ✅ Working | ✅ Working | Pure JS TCP probes; requires Windows Firewall permission on initial network scan. |
| **ZKTeco Port 4370 Pull** | ✅ Working | ✅ Working | No native `.node` dependencies; runs safely within the bundled Node runtime. |
| **ADMS Port 5000 Push** | ✅ Working | ✅ Working | Handles standard ADMS push queries (`/iclock/cdata`). |
| **Secondary Port 71 Listener**| ✅ Working | ⚠️ Conditional | In non-elevated user mode, Windows may block secondary port 71 binding if port is restricted or in use. |
| **Auto-Sync Background Timer**| ✅ Working | ✅ Working | Managed via in-memory intervals in `biometricService.js`. |
| **WhatsApp Notification Trigger**| ✅ Working | ✅ Working | Dispatches automated parent alerts upon new punch ingestion. |

---

## 4. Why Native Rebuilds (`electron-rebuild`) Are Not Required
- Some hardware integrations require pre-compiled C++ binaries (e.g., `node-hid`, `serialport`, `digitalpersona`).
- In this repository, the integration utilizes standard network socket and HTTP protocols over TCP/IP (`node-zklib` and Express HTTP endpoints).
- Because no compiled `.node` C++ binary files exist in the dependency tree for biometric services, **`electron-rebuild` is not needed** and there is no risk of ABI mismatch crashes across Electron Node versions.

---

## 5. Production-Readiness Recommendations & Step-by-Step Fix Plan

### Step 1: Windows Firewall Rule Guidance in Setup
- **Observation:** When the app is packaged and installed via NSIS, Windows Defender Firewall may prompt the user to allow network access for `Career Xone Pro.exe` or `node.exe`.
- **Recommendation:** In the user documentation or NSIS installer script, ensure inbound connections on ports **5000** and **71** are allowed for the Private Network profile.

### Step 2: ADMS Machine Configuration Standard
For institutions using ADMS push mode, configure the machine menu as follows:
- **Server IP / Domain:** Local Wi-Fi IPv4 address of the computer running Career Xone Pro (displayed in the Attendance settings screen).
- **Server Port:** `5000` (or `71` for FK models).
- **Push Interval:** 1 to 5 seconds.
- **Enable Cloud Server / ADMS:** ON.

### Step 3: Resilient Duplicate Punch Filtering
- **Current implementation:** `processPunchRecord` in `biometricService.js` prevents duplicate attendance records for the same student on the same date by updating existing records (`entryTime` and `exitTime`) and calculating total classroom duration in minutes.
- **Recommendation:** Maintain the existing duplicate suppression logic to prevent multiple rapid punches within a 60-second window from sending duplicate WhatsApp alerts.
