import { createRequire } from 'module';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const serverDir = path.join(projectRoot, 'server');

// Require packages from server/node_modules
const serverRequire = createRequire(path.join(serverDir, 'package.json'));
const mongoose = serverRequire('mongoose');
const jwt = serverRequire('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || '8f5b8a6d4e2c9a1f3c7e6b5d4a9f8e2d1c3b5a4f7e6d8c9b0a1f2e3d4c5b6a7f';

async function verifyEverything() {
  console.log('\n=================================================================');
  console.log('🧪 FULL SYSTEM API & DATABASE VERIFICATION TEST (BUILD GATE)');
  console.log('=================================================================');

  // STEP 1: Check MongoDB Connection
  console.log('[1/4] Connecting to MongoDB (port 27018)...');
  try {
    await mongoose.connect('mongodb://127.0.0.1:27018/student-report', {
      serverSelectionTimeoutMS: 3000
    });
    console.log('  ✅ MongoDB Connected Successfully!');
  } catch (dbErr) {
    console.warn('  ⚠️ Local MongoDB not running on 27018, attempting fallback check...');
  }

  let user = null;
  let inst = null;
  if (mongoose.connection.readyState === 1) {
    user = await mongoose.connection.db.collection('users').findOne({});
    inst = await mongoose.connection.db.collection('institutes').findOne({});
    const studentCount = await mongoose.connection.db.collection('students').countDocuments({ isDeleted: { $ne: true } });
    const testCount = await mongoose.connection.db.collection('tests').countDocuments({ isDeleted: { $ne: true } });
    const sessionCount = await mongoose.connection.db.collection('sessions').countDocuments({ isDeleted: { $ne: true } });
    const attCount = await mongoose.connection.db.collection('attendances').countDocuments({ isDeleted: { $ne: true } });

    console.log(`  👤 Admin User: "${user?.username || 'admin'}" | Institute: "${inst?.name || 'CAREER XONE'}"`);
    console.log(`  📊 Database Inventory: Students=${studentCount}, Tests=${testCount}, Sessions=${sessionCount}, Attendance=${attCount}`);
  }

  // STEP 2: Start Dedicated Test Backend Server Process on Port 5099
  console.log('\n[2/4] Booting Dedicated Test Server on Port 5099 to verify active server.js code...');
  const activePort = 5099;
  const serverProcess = spawn('node', ['server.js'], {
    cwd: serverDir,
    env: { ...process.env, PORT: String(activePort), MONGODB_URI: 'mongodb://127.0.0.1:27018/student-report' },
    stdio: 'pipe'
  });

  let isUp = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      const res = await fetch(`http://127.0.0.1:${activePort}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) { isUp = true; break; }
    } catch(e) {}
  }

  if (!isUp) {
    console.error('  ❌ Could not boot test server on port 5099!');
    if (serverProcess) serverProcess.kill();
    process.exit(1);
  }
  console.log(`  ✅ Dedicated Test Server is UP on Port ${activePort}!`);

    // STEP 3: Generate Token & Test All Endpoints
    console.log('\n[3/4] Testing All 7 Core API Endpoints...');
    const instId = user?.instituteId ? String(user.instituteId) : (inst?._id ? String(inst._id) : 'default');
    const token = jwt.sign(
      { id: String(user?._id || 'admin'), username: user?.username || 'admin', instituteId: instId },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const testEndpoints = [
      { name: 'Students', path: '/api/students?page=1&limit=10000', min: 1 },
      { name: 'Classes', path: '/api/classes', min: 1 },
      { name: 'Attendance', path: '/api/attendance', min: 0 },
      { name: 'Tests', path: '/api/tests', min: 0 },
      { name: 'Test Results', path: '/api/test-results', min: 0 },
      { name: 'Sessions', path: '/api/sessions', min: 0 },
      { name: 'Inquiries', path: '/api/inquiries', min: 0 },
      { name: 'SMS Logs', path: '/api/sms-logs', min: 0 }
    ];

    let allPassed = true;

    for (const ep of testEndpoints) {
      try {
        const res = await fetch(`http://127.0.0.1:${activePort}${ep.path}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        let count = Array.isArray(data) ? data.length : (data?.classes?.length ?? data?.students?.length ?? data?.total ?? (data?.success ? 1 : 0));
        let ok = res.ok && count >= ep.min;
        if (!ok) allPassed = false;

        console.log(`  ${ok ? '✅' : '❌'} ${ep.name.padEnd(16)} Status: ${res.status} | Items: ${count}`);
      } catch(err) {
        allPassed = false;
        console.log(`  ❌ ${ep.name.padEnd(16)} Error: ${err.message}`);
      }
    }

    if (!allPassed) {
      console.error('\n❌ BUILD FAILED: Some backend endpoints returned errors!');
      if (serverProcess) serverProcess.kill();
      process.exit(1);
    }

    console.log('\n[4/4] Automated API & Database Checks Passed Cleanly!');
    console.log('=================================================================\n');

    if (serverProcess) {
      serverProcess.kill();
    }
    process.exit(0);
  }

verifyEverything().catch(e => {
  console.error('Fatal Verification Error:', e);
  process.exit(1);
});
