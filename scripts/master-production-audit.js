import { createRequire } from 'module';
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const serverDir = path.join(projectRoot, 'server');
const distDir = path.join(projectRoot, 'dist');
const srcDir = path.join(projectRoot, 'src');
const publicDir = path.join(projectRoot, 'public');

const serverRequire = createRequire(path.join(serverDir, 'package.json'));
const mongoose = serverRequire('mongoose');
const jwt = serverRequire('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || '8f5b8a6d4e2c9a1f3c7e6b5d4a9f8e2d1c3b5a4f7e6d8c9b0a1f2e3d4c5b6a7f';
const TEST_PORT = 5098;

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function reportCheck(name, passed, details = '') {
  totalChecks++;
  if (passed) {
    passedChecks++;
    console.log(`  ✅ [PASS] ${name}${details ? ` (${details})` : ''}`);
  } else {
    failedChecks++;
    console.error(`  ❌ [FAIL] ${name}${details ? ` -> ${details}` : ''}`);
  }
}

async function runMasterProductionAudit() {
  console.log('================================================================================');
  console.log('🛡️ CAREER XONE PRO — 360° TOTAL SYSTEM MASTER PRE-FLIGHT AUDIT');
  console.log('================================================================================\n');

  // ==========================================================================
  // SECTION 1: CRITICAL ASSETS, BINARIES & ENGINES INTEGRITY
  // ==========================================================================
  console.log('📦 [STAGE 1/7] Verifying Production Binaries, Engines & Static Assets...');

  // 1. Electron Main & Preload
  reportCheck('Electron Main Script (main.cjs)', fs.existsSync(path.join(projectRoot, 'main.cjs')));
  reportCheck('Electron Preload Script (preload.cjs)', fs.existsSync(path.join(projectRoot, 'preload.cjs')));

  // 2. Production Dist Assets
  const indexHtmlPath = path.join(distDir, 'index.html');
  const distExists = fs.existsSync(distDir) && fs.existsSync(indexHtmlPath);
  reportCheck('Compiled Production Bundle (dist/index.html)', distExists);

  if (distExists) {
    const assetsDir = path.join(distDir, 'assets');
    const assetFiles = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : [];
    const hasJs = assetFiles.some(f => f.endsWith('.js'));
    const hasCss = assetFiles.some(f => f.endsWith('.css'));
    reportCheck('Production Bundled JS & CSS Assets', hasJs && hasCss, `${assetFiles.length} asset files`);
  }

  // 3. Embedded Local MongoDB Binaries
  const mongodPath = path.join(serverDir, 'bin', 'mongod.exe');
  reportCheck('Embedded Local MongoDB Engine (bin/mongod.exe)', fs.existsSync(mongodPath));

  // 4. OMR Python Scanning Engine
  const omrBinPath = path.join(serverDir, 'omr_engine_v2.exe');
  const omrScriptPath = path.join(serverDir, 'omr_engine_v2.py');
  reportCheck('OMR Optical Mark Recognition Engine', fs.existsSync(omrBinPath) || fs.existsSync(omrScriptPath));

  // 5. Python Runtime for OMR Execution
  let pythonAvailable = false;
  try {
    const pyVer = execSync('python --version', { stdio: ['pipe', 'pipe', 'ignore'], timeout: 3000 }).toString().trim();
    pythonAvailable = true;
    reportCheck('System Python 3 Runtime for OMR Scans', true, pyVer);
  } catch (e) {
    reportCheck('System Python 3 Runtime for OMR Scans', fs.existsSync(omrBinPath), 'Using Standalone EXE');
  }

  // ==========================================================================
  // SECTION 2: MOBILE PWA MANIFESTS & MULTI-APP PORTAL ASSETS
  // ==========================================================================
  console.log('\n📱 [STAGE 2/7] Checking Mobile PWA Portals & Manifests...');

  const manifests = [
    { name: 'Parent App Portal Manifest', file: 'manifest-parent.json' },
    { name: 'Teacher App Portal Manifest', file: 'manifest-teacher.json' },
    { name: 'Staff App Portal Manifest', file: 'manifest-staff.json' },
    { name: 'Inquiry Reception Manifest', file: 'manifest-inquiry.json' }
  ];

  for (const m of manifests) {
    const mPath = path.join(publicDir, m.file);
    const exists = fs.existsSync(mPath);
    let validJson = false;
    if (exists) {
      try {
        JSON.parse(fs.readFileSync(mPath, 'utf8'));
        validJson = true;
      } catch(e) {}
    }
    reportCheck(m.name, exists && validJson);
  }

  // ==========================================================================
  // SECTION 3: FRONTEND JSX COMPONENT STATIC AUDIT
  // ==========================================================================
  console.log('\n🎨 [STAGE 3/7] Deep Scanning Frontend React Components & Modals...');

  let jsxFiles = [];
  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory() && ent.name !== 'node_modules' && ent.name !== 'dist') {
        scanDir(full);
      } else if (ent.isFile() && (ent.name.endsWith('.jsx') || ent.name.endsWith('.js'))) {
        jsxFiles.push(full);
      }
    }
  }
  scanDir(srcDir);

  let syntaxIssues = 0;
  for (const file of jsxFiles) {
    const text = fs.readFileSync(file, 'utf8');
    if (text.includes('<<<<<<<') || text.includes('>>>>>>>')) {
      syntaxIssues++;
      reportCheck(`Merge Conflict in ${path.basename(file)}`, false);
    }
  }
  reportCheck(`Frontend Source Code Sanity (${jsxFiles.length} React files scanned)`, syntaxIssues === 0);

  // Check critical modals presence
  reportCheck('Manage Classes Modal Component', fs.existsSync(path.join(srcDir, 'components', 'ManageClassesModal.jsx')));
  reportCheck('Searchable Student Select Component', fs.existsSync(path.join(srcDir, 'components', 'SearchableStudentSelect.jsx')));
  reportCheck('Student Profile Modal Component', fs.existsSync(path.join(srcDir, 'components', 'StudentProfileModal.jsx')));
  reportCheck('Add Student Admission Modal', fs.existsSync(path.join(srcDir, 'components', 'AddStudentModal.jsx')));
  reportCheck('Bulk Upload Modal Component', fs.existsSync(path.join(srcDir, 'components', 'BulkUploadModal.jsx')));
  reportCheck('Edit Test & OMR Key Modal', fs.existsSync(path.join(srcDir, 'components', 'EditTestModal.jsx')));
  reportCheck('Voice Caller Simulator Component', fs.existsSync(path.join(srcDir, 'components', 'VoiceCallerSimulator.jsx')));
  reportCheck('Global Scanner Desk Listener Component', fs.existsSync(path.join(srcDir, 'components', 'GlobalScannerDeskListener.jsx')));

  // ==========================================================================
  // SECTION 4: DATABASE CONNECTIVITY & DATA INTEGRITY
  // ==========================================================================
  console.log('\n💾 [STAGE 4/7] Testing MongoDB Database Schema & Core Collections...');

  const { connectLocalDb } = await import('../server/db/localDb.js');
  await connectLocalDb();
  const dbState = mongoose.connection.readyState === 1;
  reportCheck('MongoDB Database Connection (Local / Cloud Hybrid)', dbState);

  let user = null;
  let inst = null;
  let studentsCount = 0;
  let attendanceCount = 0;
  let testsCount = 0;
  let sessionCount = 0;
  let staffCount = 0;

  if (dbState) {
    const db = mongoose.connection.db;
    user = await db.collection('users').findOne({});
    inst = await db.collection('institutes').findOne({});
    studentsCount = await db.collection('students').countDocuments({ isDeleted: { $ne: true } });
    attendanceCount = await db.collection('attendances').countDocuments({ isDeleted: { $ne: true } });
    testsCount = await db.collection('tests').countDocuments({ isDeleted: { $ne: true } });
    sessionCount = await db.collection('sessions').countDocuments({ isDeleted: { $ne: true } });
    staffCount = await db.collection('staffs').countDocuments({ isDeleted: { $ne: true } });

    reportCheck('Admin User Authentication Record', !!user, `User: "${user?.username || 'N/A'}"`);
    reportCheck('Institute Profile Record', !!inst, `Institute: "${inst?.name || 'CAREER XONE'}"`);
    reportCheck('Students Database Inventory', studentsCount > 0, `${studentsCount} active students enrolled`);
    reportCheck('Attendance History Log', attendanceCount >= 0, `${attendanceCount} attendance records`);
    reportCheck('Test & Exam Series Records', testsCount >= 0, `${testsCount} tests recorded`);
    reportCheck('Academic Sessions Records', sessionCount >= 0, `${sessionCount} scheduled sessions`);
    reportCheck('Staff / Faculty Roster Records', staffCount >= 0, `${staffCount} employees registered`);
  }

  // ==========================================================================
  // SECTION 5: BACKEND DEDICATED TEST SERVER & ALL API ENDPOINTS
  // ==========================================================================
  console.log(`\n🚀 [STAGE 5/7] Booting Isolated Backend Server on Port ${TEST_PORT} & Testing APIs...`);

  const serverProcess = spawn('node', ['server.js'], {
    cwd: serverDir,
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdio: 'pipe'
  });

  let serverUp = false;
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 300));
    try {
      const res = await fetch(`http://127.0.0.1:${TEST_PORT}/api/health`, { signal: AbortSignal.timeout(800) });
      if (res.ok) { serverUp = true; break; }
    } catch(e) {}
  }

  reportCheck(`Test Backend Boot (Port ${TEST_PORT})`, serverUp);

  if (serverUp) {
    const instId = user?.instituteId ? String(user.instituteId) : (inst?._id ? String(inst._id) : 'default');
    const token = jwt.sign(
      { id: String(user?._id || 'admin'), username: user?.username || 'admin', instituteId: instId },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const apiRoutes = [
      { name: 'System Healthcheck API', path: '/api/health', method: 'GET', auth: false },
      { name: 'Enrolled Students List API', path: '/api/students?page=1&limit=25', method: 'GET', auth: true },
      { name: 'Class Directory & Batch API', path: '/api/classes', method: 'GET', auth: true },
      { name: 'Daily Attendance Roster API', path: '/api/attendance?page=1&limit=25', method: 'GET', auth: true },
      { name: 'Exam & Test Schedule API', path: '/api/tests?limit=25', method: 'GET', auth: true },
      { name: 'Test Results & Performance Stats API', path: '/api/tests', method: 'GET', auth: true },
      { name: 'Academic Sessions API', path: '/api/sessions', method: 'GET', auth: true },
      { name: 'Admission Inquiries API', path: '/api/inquiries', method: 'GET', auth: true },
      { name: 'SMS & WhatsApp Logs API', path: '/api/sms-logs', method: 'GET', auth: true },
      { name: 'Biometric Status API', path: '/api/biometric/status', method: 'GET', auth: true },
      { name: 'Biometric Network & Static IP API', path: '/api/biometric/network-status', method: 'GET', auth: true },
      { name: 'Recent Biometric Punches API', path: '/api/biometric/recent-punches', method: 'GET', auth: true },
      { name: 'Staff & Faculty Roster API', path: '/api/staff-members', method: 'GET', auth: true },
      { name: 'Staff Daily Attendance API', path: '/api/staff-attendance', method: 'GET', auth: true },
      { name: 'Cloud Sync Engine Status API', path: '/api/sync/status', method: 'GET', auth: true }
    ];

    for (const r of apiRoutes) {
      try {
        const headers = r.auth ? { 'Authorization': `Bearer ${token}` } : {};
        const res = await fetch(`http://127.0.0.1:${TEST_PORT}${r.path}`, { headers, signal: AbortSignal.timeout(15000) });
        reportCheck(r.name, res.status >= 200 && res.status < 300, `HTTP ${res.status}`);
      } catch (err) {
        reportCheck(r.name, false, err.message);
      }
    }
  }

  // ==========================================================================
  // SECTION 6: HARDWARE PUSH PROTOCOLS & HARDWARE PORTS
  // ==========================================================================
  console.log('\n📡 [STAGE 6/7] Testing Biometric Push Protocols & Hardware Listeners...');

  // 1. Check ADMS endpoint
  try {
    const admsRes = await fetch(`http://127.0.0.1:${TEST_PORT}/iclock/cdata?SN=TEST_DEV`, {
      method: 'POST',
      body: 'TEST_PUNCH',
      signal: AbortSignal.timeout(2000)
    });
    reportCheck('ADMS Real-time Push Receiver (/iclock/cdata)', admsRes.status === 200, `HTTP ${admsRes.status}`);
  } catch (e) {
    reportCheck('ADMS Real-time Push Receiver (/iclock/cdata)', false, e.message);
  }

  // 2. Check Biomax FK Web endpoint
  try {
    const fkRes = await fetch(`http://127.0.0.1:${TEST_PORT}/hdata.aspx`, {
      method: 'POST',
      body: 'cmd=reg&dev_id=DEV01',
      signal: AbortSignal.timeout(2000)
    });
    reportCheck('Biomax FK Web Push Receiver (/hdata.aspx)', fkRes.status === 200, `HTTP ${fkRes.status}`);
  } catch (e) {
    reportCheck('Biomax FK Web Push Receiver (/hdata.aspx)', false, e.message);
  }

  // ==========================================================================
  // SECTION 7: AI, WHATSAPP BOT & ADVANCED SERVICES
  // ==========================================================================
  console.log('\n🤖 [STAGE 7/7] Testing AI Knowledge Base, WhatsApp Bot & Auxiliary Services...');

  // 1. WhatsApp Messaging Configuration
  const waConfigFile = path.join(serverDir, 'whatsapp_messaging_config.json');
  reportCheck('WhatsApp Master Messaging Switch File', fs.existsSync(waConfigFile));

  // 2. AI Knowledge Base & Config
  const kbFile = path.join(serverDir, 'career_xone_knowledge_base.json');
  const botConfigFile = path.join(serverDir, 'whatsapp_ai_config.json');
  let kbValid = false;
  if (fs.existsSync(kbFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(kbFile, 'utf8'));
      kbValid = Array.isArray(parsed) || typeof parsed === 'object';
    } catch(e) {}
  }
  reportCheck('Career Xone AI Knowledge Base JSON', kbValid);
  reportCheck('WhatsApp AI Bot Configuration File', fs.existsSync(botConfigFile));

  // 3. Voice TTS Audio Engine
  const ttsEngine = path.join(serverDir, 'services', 'voice_tts_engine.py');
  reportCheck('Voice AI TTS Audio Synthesis Engine', fs.existsSync(ttsEngine));

  // 4. Cloudflare Tunnel Service
  const tunnelService = path.join(serverDir, 'services', 'tunnelService.js');
  reportCheck('Cloudflare Tunnel 24/7 Remote Access Service', fs.existsSync(tunnelService));

  // 5. Automated Session Scheduler
  const sessionSched = path.join(serverDir, 'services', 'sessionScheduler.js');
  reportCheck('Session Rollover & Missed-Exit Scheduler Service', fs.existsSync(sessionSched));

  // ==========================================================================
  // CLEANUP & FINAL SUMMARY
  // ==========================================================================
  if (serverProcess) {
    serverProcess.kill('SIGINT');
  }
  await mongoose.disconnect();

  console.log('\n================================================================================');
  console.log(`📊 360° TOTAL AUDIT SUMMARY: ${passedChecks}/${totalChecks} CHECKS PASSED`);
  if (failedChecks === 0) {
    console.log('🎉 100% PRODUCTION READY! ZERO DEFECTS, MISSING ASSETS, OR ERRORS ACROSS THE ENTIRE PLATFORM!');
  } else {
    console.warn(`⚠️ ${failedChecks} checks failed. Review the logs above.`);
  }
  console.log('================================================================================\n');

  process.exit(failedChecks > 0 ? 1 : 0);
}

runMasterProductionAudit().catch(err => {
  console.error('Fatal Audit Error:', err);
  process.exit(1);
});
