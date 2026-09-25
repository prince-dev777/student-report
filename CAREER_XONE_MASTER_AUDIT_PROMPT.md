# 🛡️ CAREER XONE PRO — 360° TOTAL SYSTEM & UI BUTTONS MASTER AUDIT PROMPT

You are the Lead Systems & Quality Assurance Architect for Career Xone Pro (Electron + React + Node.js + MongoDB Local/Atlas). 
Your objective is to conduct a complete, uncompromising 360° End-to-End Audit across every section, form, modal, button, and background service in the platform. Zero assumptions. Everything must be verified with code inspection, syntax bundles, and programmatic execution.

Execute the following 10-Stage Comprehensive Audit Checklist sequentially:

---

### 🟢 STAGE 1: WHATSAPP ENGINE & SESSION IMMUNITY AUDIT
1. **Session Absolute Immunity:**
   - Verify `AppData/Roaming/Career Xone Pro/data/.wwebjs_auth` exists and is NEVER touched, cleared, or deleted by any sync, update, or migration.
   - Verify `LocalAuth.prototype.logout` is blocked in `server/services/whatsappClient.js`.
   - Verify late QR event suppression: If `clientStatus === 'ready'` or `client.info.wid` exists, late QR events MUST be ignored to prevent false logouts.
2. **Anti-Ban Message Queue (`server/services/messageQueue.js`):**
   - Verify FIFO queue is in-memory only (never pulls past logs from DB to blast out duplicate messages).
   - Verify safe human rate-limiting: 8–15s randomized delays, burst limit (max 35 / 5 min), and hourly cap (350/hr).
   - Verify `isMessagingPaused` toggle in `whatsapp_messaging_config.json` properly pauses/resumes outbound delivery.
3. **Whitelist & Template Format:**
   - Verify only whitelisted types trigger WhatsApp delivery; non-whitelisted types (e.g. `PUNCH_MISSED`) route to `app-only` without error.

---

### 🟢 STAGE 2: ATTENDANCE KIOSK, MANUAL TYPING & TABLETOP SCANNER
1. **Manual Kiosk Typing Integrity:**
   - Inspect `src/pages/Attendance.jsx` Kiosk manual input field.
   - Verify NO timer-based character wiping exists: full student names and roll numbers (e.g. `101`, `4608`) can be typed without characters erasing.
2. **Tabletop QR/Barcode Burst Detection:**
   - Verify fast scanner keystroke burst detection (interval <= 45ms) suppresses autocomplete suggestion dropdown flicker during card scanning.
   - Verify keyboard navigation for suggestions: `ArrowDown`, `ArrowUp`, `Enter` (selects & punches), and `Escape` (closes dropdown).
3. **Punch Logic & Round Calculations:**
   - Verify automatic `IN` vs `OUT` detection, multiple daily rounds, and `exitTime2` handling.
   - Verify session assignment preserves existing session on exit and respects class/batch restrictions (e.g., excluded batches never get assigned restricted sessions).
4. **Biometric Push Hardware Receivers:**
   - Verify ADMS listener on port 5000 (`/iclock/cdata`), Biomax FK listener on port 8000 (`/hdata.aspx`), and eTimeTrack listener on port 71.

---

### 🟢 STAGE 3: STUDENTS DIRECTORY & ADMISSION WORKFLOW
1. **"Add Student" Button & Modal:**
   - Validate form fields: Name, Roll Number, Parent Phone, Class, Batch, Photo upload.
   - Verify duplicate Roll Number validation prevents collision before submission.
2. **"Bulk Upload" Excel Import:**
   - Verify template parser handles missing columns gracefully, cleans phone numbers (`+91`), and displays row-by-row success/error preview.
3. **Student Profile, Search & Filters:**
   - Test search box (instant filter by name, roll no, or phone).
   - Test Class/Batch filter dropdowns.
   - Verify "Edit Student", "View Profile", and "Print ID Card" buttons open correct modals without React state errors.
4. **Delete / Tombstone Preservation:**
   - Verify student deletion sets `isDeleted: true` and creates a tombstone so deleted students do not resurrect upon Cloud Atlas sync.

---

### 🟢 STAGE 4: TESTS, EXAMS & OMR SCANNER CHECK
1. **"Create Test" & "Edit Test" Modals:**
   - Validate test creation with Subject, Date, Total Marks, Negative Marking, and Question count.
   - Verify Answer Key editor modal saves keys accurately.
2. **OMR Scanner Protection Lock:**
   - Verify `server/omr_scanner/` and `server/omr_engine_v2.py` / `omr_engine_v2.exe` are locked with intact master template coordinates (T1–T7) and 55.0% threshold.
3. **Results Calculation & Ranking:**
   - Verify marks computation, rank sorting, and OMR image preview linking.
4. **"Publish to WhatsApp" Button:**
   - Verify marks alert dispatch formats portal link (`PUBLIC_PORTAL_URL`) and student percentage correctly, routing safely through the Anti-Ban Message Queue.

---

### 🟢 STAGE 5: ACADEMIC SESSIONS, SCHEDULER & TIMETABLE
1. **Session Configuration:**
   - Verify "Add Session" / "Edit Session" modals validate Start Time, End Time, Target Classes, and Batch Exclusions.
2. **Session Scheduler Worker (`server/services/sessionScheduler.js`):**
   - Verify automatic session rollover does NOT force-rollover excluded batches.
   - Verify Missed-Exit check runs only on the final session of the day without false triggers.

---

### 🟢 STAGE 6: SMS CENTER & HISTORICAL LOGS
1. **Log Preservation & Zero Destructive Purge:**
   - Inspect `server/db/syncEngine.js` and `server/restore-from-cloud.js`.
   - Verify `smslogs` is EXCLUDED from destructive purge routines (`logCollections` and orphaned check `['sessions', 'institutes', 'users']`).
   - Verify safe two-way upsert ensures SMS logs never disappear on abrupt PC reboot or power cut.
2. **SMS Center UI Table & Actions:**
   - Verify search by student/phone and filter by status (`delivered`, `sent`, `pending`, `failed`, `app-only`).
   - Verify "Resend" button and "Pause WhatsApp" toggle action buttons.

---

### 🟢 STAGE 7: INQUIRIES, STAFF & FACULTY WORKFLOWS
1. **Inquiry Reception Desk:**
   - Verify "New Inquiry" modal, follow-up date picker, and stage progression (New -> Follow-up -> Enrolled -> Closed).
   - Verify "Convert to Admission" pre-fills student registration form seamlessly.
2. **Staff Roster & Attendance:**
   - Verify "Add Staff" modal, staff roster table, and Staff Daily Attendance Punch buttons (IN/OUT).

---

### 🟢 STAGE 8: SETTINGS, DATABASE & CLOUD ATLAS SYNC
1. **Database Hybrid Architecture:**
   - Verify Local MongoDB (`bin/mongod.exe` on port 27018) auto-spawn and offline capability.
   - Verify Cloud MongoDB Atlas cluster connection and credentials.
2. **Bidirectional Sync Engine (`syncEngine.js`):**
   - Verify "Instant Sync" button triggers `performFullSync()`.
   - Verify two-way synchronization for all collections without duplicate key collisions (`E11000`).
   - Verify Deduplication Cleaner (`mergeDuplicatesOnDb`) merges duplicate clusters safely.

---

### 🟢 STAGE 9: UI MODALS, BUTTONS & INTERACTION INTEGRITY
1. **Modal Lifecycles:**
   - Verify EVERY modal across the app closes properly via `Escape` key, backdrop click, or Cancel button without freezing the interface.
2. **Button States & Feedback:**
   - Verify submit buttons enter a loading state (`disabled`) while waiting for API response to prevent accidental double-clicks.
   - Verify clear success/error toasts display on every operation.
3. **No Uncaught Exceptions:**
   - Verify React component tree has zero JSX syntax errors, undefined prop crashes, or missing hook dependencies.

---

### 🟢 STAGE 10: AUTOMATED SCRIPT VERIFICATION GATE
Execute the comprehensive test suite to confirm 100% operational readiness:
```bash
# 1. Syntax & Compilation Sanity Check
npx esbuild src/pages/Attendance.jsx --bundle --outfile=nul --loader:.jsx=jsx --loader:.js=jsx --loader:.png=dataurl

# 2. Master Pre-Flight 57+ Checks Audit
node scripts/master-production-audit.js

# 3. Core REST API Verification Suite
node scripts/verify_all_api.js
```
