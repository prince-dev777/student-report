import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import https from 'https';
import multer from 'multer';
import { spawn, spawnSync, fork } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import cron from 'node-cron';
import AdmZip from 'adm-zip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Import Models
import Student from './models/Student.js';
import Attendance from './models/Attendance.js';
import Test from './models/Test.js';
import TestResult from './models/TestResult.js';
import SMSLog from './models/SMSLog.js';
import User from './models/User.js';
import Institute from './models/Institute.js';
import Notification from './models/Notification.js';
import Session from './models/Session.js';
import Inquiry from './models/Inquiry.js';
import { protect, authenticateToken } from './middleware/authMiddleware.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { sendWhatsAppAlert, getOutboundMessagingStatus, setOutboundMessagingStatus } from './services/whatsappService.js';
import os from 'os';
import {
  initializeWhatsAppClient,
  getWhatsAppClientState,
  disconnectWhatsAppClient,
  sendWhatsAppMessageWeb,
  resetRetryCount
} from './services/whatsappClient.js';
import {
  getBotConfig,
  updateBotConfig,
  getBotLogs
} from './services/whatsappBotService.js';
import {
  testBiometricDevice,
  syncBiometricLogs,
  syncAllBiometricDevices,
  startBiometricAutoSync,
  stopBiometricAutoSync,
  getBiometricStatus,
  processPunchRecord,
  scanLocalSubnetForBiometricDevices,
  recordAdmsActivity,
  getLocalNetworkIp,
  setupBiometricRoutes
} from './biometric.js';
import {
  synthesizeSpeech,
  processVoiceTurn,
  saveCallLog,
  getCallLogs
} from './services/voiceAiService.js';
import { compilePdf } from './services/testSeriesPdfService.js';
import { logInfo, logError, getRecentLogs, getLogsDir } from './utils/logger.js';
import { 
  performFullSync, 
  pullAndRestoreFromCloud, 
  triggerBackgroundSync, 
  startPeriodicSync, 
  dualDelete, 
  mirrorWrite, 
  registerSSEBroadcaster 
} from './db/syncEngine.js';
import { uploadStudentPhoto, uploadOMRScan } from './services/cloudinaryService.js';
import { generateDatabaseSnapshot } from './services/jsonBackupService.js';
import { mergeDuplicatesOnDb } from './db/duplicateCleaner.js';
import {
  startCloudflareTunnel,
  stopCloudflareTunnel,
  getTunnelState
} from './services/tunnelService.js';

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.production') });
if (!process.env.WHATSAPP_PROVIDER) dotenv.config({ path: path.join(__dirname, '.env.backup') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/student-report';
const CLOUD_MONGODB_URI = process.env.CLOUD_MONGODB_URI || 'mongodb://student_report:helloai.com@ac-hqw4l9b-shard-00-00.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-01.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-02.thx91mx.mongodb.net:27017/test?ssl=true&replicaSet=atlas-srcmx3-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0';
const JWT_SECRET = process.env.JWT_SECRET || '8f5b8a6d4e2c9a1f3c7e6b5d4a9f8e2d1c3b5a4f7e6d8c9b0a1f2e3d4c5b6a7f';

// Global Sync State Tracking
let lastCloudSyncTime = null;
let isSyncingToCloud = false;

export const performRestoreFromCloud = pullAndRestoreFromCloud;
export const performSyncToCloud = performFullSync;
export const triggerBackgroundCloudSync = triggerBackgroundSync;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use((req, res, next) => {
  if (req.ip?.includes('192.168.0.12') || req.socket?.remoteAddress?.includes('192.168.0.12') || req.path.includes('data') || req.path.includes('iclock') || req.path.includes('push') || req.path.includes('attlog') || req.path.includes('hdata')) {
    console.log(`[HARDWARE TRACE] ${req.method} ${req.originalUrl} from ${req.ip} Query:`, req.query);
  }
  next();
});
app.use(cors());
app.use(['/iclock', '/cdata', '/getrequest', '/devicecmd', '/fdata', '/rtlog', '/registry', '/push', '/ping', '/hdata.aspx', '/hdata', '/data.aspx', '/data', '/FKWeb.aspx', '/FKWeb'], express.text({ type: '*/*', limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Healthcheck endpoints for frontend connection auto-detection
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: Date.now(), db: mongoose.connection.readyState === 1 ? 'connected' : 'connecting' });
});
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: Date.now() });
});
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// 📡 Register Biometric Engine Routes (FK Web Protocol /hdata.aspx, ADMS /iclock/cdata, Staff & Student attendance)
setupBiometricRoutes(app);

// 🔄 24/7 Keep-Alive Self-Ping Service (Keeps Cloud Server awake)
const CLOUD_APP_URL = process.env.CLOUD_APP_URL || process.env.VITE_API_BASE_URL?.replace('/api', '') || '';
const KEEP_ALIVE_INTERVAL = 10 * 60 * 1000; // 10 minutes

function startKeepAlivePing() {
  setInterval(async () => {
    try {
      const pingUrl = `${CLOUD_APP_URL}/api/health`;
      const res = await fetch(pingUrl, {
        headers: { 'User-Agent': 'CareerXone-KeepAlive-Engine/1.0' }
      });
      if (res.ok) {
        console.log(`📡 [Keep-Alive] Self-ping successful to ${pingUrl} at ${new Date().toLocaleTimeString('en-IN')}`);
      }
    } catch (e) {
      console.warn(`⚠️ [Keep-Alive] Ping failed: ${e.message}`);
    }
  }, KEEP_ALIVE_INTERVAL);

  // Initial wake-up ping after 15 seconds
  setTimeout(async () => {
    try {
      await fetch(`${CLOUD_APP_URL}/api/health`, {
        headers: { 'User-Agent': 'CareerXone-KeepAlive-Engine/1.0' }
      });
      console.log(`📡 [Keep-Alive] Initial wake-up ping sent to ${CLOUD_APP_URL}`);
    } catch (e) {}
  }, 15000);
}

startKeepAlivePing();

const dataPath = process.env.USER_DATA_PATH || __dirname;
app.use('/uploads', express.static(path.join(dataPath, 'uploads'), {
  setHeaders: (res, filePath) => {
    // Force image/jpeg for omr uploads without extension
    if (!path.extname(filePath)) {
      res.set('Content-Type', 'image/jpeg');
    }
  }
}));

// Fallback for older drafts saved in the local project directory
if (dataPath !== __dirname) {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res, filePath) => {
      if (!path.extname(filePath)) {
        res.set('Content-Type', 'image/jpeg');
      }
    }
  }));
}

// Serve static client assets (PWA manifests, Service Worker, compiled JS/CSS)
const staticDirs = [
  path.join(__dirname, 'public'),
  path.join(__dirname, '../dist'),
  path.join(__dirname, 'dist'),
  path.join(__dirname, '../public')
];

for (const sDir of staticDirs) {
  if (fs.existsSync(sDir)) {
    app.use(express.static(sDir, {
      maxAge: '1d',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.json')) {
          res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
        } else if (filePath.endsWith('sw.js')) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.setHeader('Service-Worker-Allowed', '/');
          res.setHeader('Cache-Control', 'no-cache');
        }
      }
    }));
  }
}

function generateServerId(prefix = 'ID') {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

function buildTestLookup(testId, instituteId) {
  if (!testId) return { _id: new mongoose.Types.ObjectId() };
  const lookup = [{ id: String(testId) }];
  if (mongoose.Types.ObjectId.isValid(testId)) {
    lookup.push({ _id: testId });
  }
  const query = { isDeleted: { $ne: true }, $or: lookup };
  if (instituteId) {
    query.instituteId = instituteId;
  }
  return query;
}

function normalizeDateToISO(dateStr) {
  if (!dateStr) return '';
  const clean = String(dateStr).trim();
  const parts = clean.split(/[./-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  const d = new Date(clean);
  return isNaN(d.getTime()) ? clean : d.toISOString().split('T')[0];
}

function safeUnlink(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    console.warn(`Failed to remove uploaded file ${filePath}:`, err.message);
  }
}

async function attachTestDetailsToResults(results, instituteId) {
  const testIds = [...new Set(results.map((result) => result.testId).filter(Boolean))];
  const testDocs = testIds.length > 0
    ? await Test.find({ 
        isDeleted: { $ne: true },  
        $or: [
          { id: { $in: testIds } },
          { _id: { $in: testIds.filter(id => mongoose.Types.ObjectId.isValid(id)) } }
        ]
      })
    : [];
  const testsById = new Map();
  testDocs.forEach(t => {
    if (t.id) testsById.set(t.id, t.toObject());
    if (t._id) testsById.set(t._id.toString(), t.toObject());
  });

  // Calculate real topper and batch average across all published results for these tests
  const allTestResults = testIds.length > 0
    ? await TestResult.find({
        isDeleted: { $ne: true },
        testId: { $in: testIds },
        status: { $in: ['Published', 'published'] }
      })
    : [];

  const testStatsMap = {};
  for (const r of allTestResults) {
    const tId = r.testId;
    if (!testStatsMap[tId]) {
      testStatsMap[tId] = { maxMarks: -Infinity, totalMarksSum: 0, count: 0 };
    }
    const marks = Number(r.marks) || 0;
    if (marks > testStatsMap[tId].maxMarks) {
      testStatsMap[tId].maxMarks = marks;
    }
    testStatsMap[tId].totalMarksSum += marks;
    testStatsMap[tId].count += 1;
  }

  // Filter out any orphaned test results whose parent test has been deleted or does not exist
  const validResults = results.filter(result => result.testId && testsById.has(result.testId));

  return validResults.map((result) => {
    const resObj = typeof result.toObject === 'function' ? result.toObject() : result;
    const foundTest = testsById.get(result.testId);

    const stats = testStatsMap[result.testId] || {
      maxMarks: Number(resObj.marks) || 0,
      totalMarksSum: Number(resObj.marks) || 0,
      count: 1
    };

    const studentMarks = Number(resObj.marks) || 0;
    const realTopper = stats.maxMarks !== -Infinity ? Math.max(stats.maxMarks, studentMarks) : studentMarks;
    const realAvg = stats.count > 0 ? Math.round(stats.totalMarksSum / stats.count) : studentMarks;
    const realTotalStudents = stats.count || resObj.totalStudents || 1;

    return {
      ...resObj,
      test: foundTest,
      testName: foundTest?.name || resObj.testName || 'Test Exam',
      testDate: foundTest?.date || resObj.testDate || (resObj.createdAt ? new Date(resObj.createdAt).toLocaleDateString('en-IN') : '-'),
      subject: foundTest?.subject || resObj.subject || 'All Subjects',
      totalMarks: resObj.totalMarks || foundTest?.totalMarks || 360,
      topperMarks: realTopper,
      avgMarks: realAvg,
      totalStudents: realTotalStudents
    };
  });
}

// Multer setup for OMR image uploads
const uploadDir = path.join(dataPath, 'uploads', 'omr');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('🔌 Connected to MongoDB database.');

    // Auto-restore check on fresh install / 2nd computer
    try {
      const studentCount = await Student.countDocuments();
      const userCount = await User.countDocuments();
      if (studentCount === 0 || userCount === 0) {
        console.log('🔄 Local DB is empty or incomplete (0 students or 0 users). Triggering Cloud & Snapshot Restoration...');
        await performRestoreFromCloud();
      }
    } catch(err) {
      console.error('Error checking DB count for auto-restore:', err);
    }

    // Migration: reconstruct parentPasswordPlain for existing students
    try {
      const students = await Student.find({ isDeleted: { $ne: true }, 
        $or: [
          { parentPasswordPlain: { $exists: false } },
          { parentPasswordPlain: null },
          { parentPasswordPlain: '' }
        ]
      });
      if (students.length > 0) {
        console.log(`🔧 Found ${students.length} students missing parentPasswordPlain. Reconstructing...`);
        for (const student of students) {
          if (student.parentPasswordHash) {
            let plainText = null;

            // Try rollNo
            try {
              if (await bcrypt.compare(String(student.rollNo), student.parentPasswordHash)) {
                plainText = student.rollNo;
              }
            } catch (e) { }

            // Try '123456' (seeder default)
            if (!plainText) {
              try {
                if (await bcrypt.compare('123456', student.parentPasswordHash)) {
                  plainText = '123456';
                }
              } catch (e) { }
            }

            // Try '1234' (old parent PIN default)
            if (!plainText) {
              try {
                if (await bcrypt.compare('1234', student.parentPasswordHash)) {
                  plainText = '1234';
                }
              } catch (e) { }
            }

            // Fallback: if we can't match it, default to their rollNo
            if (!plainText) {
              plainText = student.rollNo;
              const salt = await bcrypt.genSalt(10);
              student.parentPasswordHash = await bcrypt.hash(plainText, salt);
            }

            student.parentPasswordPlain = plainText;
            await student.save();
          } else {
            // No hash, default to rollNo
            const plainText = student.rollNo;
            const salt = await bcrypt.genSalt(10);
            student.parentPasswordHash = await bcrypt.hash(plainText, salt);
            student.parentPasswordPlain = plainText;
            await student.save();
        }
      }
      console.log('✅ Reconstructed missing passwords successfully.');
      }
    } catch (pwErr) {
      console.error('Password reconstruction error:', pwErr);
    }

  })
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ---- 🔄 SSE Live-Sync: Real-time data update notifications to all connected frontends ----
const sseClients = new Set();

function broadcastSSE(event, data = {}) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try { client.write(payload); } catch (e) { sseClients.delete(client); }
  }
}

// Register SSE broadcaster with SyncEngine
registerSSEBroadcaster(broadcastSSE);

// Start Periodic Sync and Snapshot loop
startPeriodicSync(180000); // Sync every 3 mins

// Auto JSON database snapshot every 15 mins and on startup
setTimeout(() => { generateDatabaseSnapshot(dataPath).catch(() => {}); }, 15000);
setInterval(() => { generateDatabaseSnapshot(dataPath).catch(() => {}); }, 900000);

// ---- 🔐 Auth API ----
// Registration endpoint removed for security. 
// Institutes must be created by Super Admin via /api/superadmin/create-institute

// Middleware for Super Admin authentication
const superAdminProtect = (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.role !== 'superadmin') {
        throw new Error('Not authorized as superadmin');
      }
      req.superadmin = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ error: 'Not authorized, no token' });
  }
};

// ---- 🛡️ Super Admin API ----
app.post('/api/superadmin/login', (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.SUPERADMIN_USERNAME || 'rohitjha';
  const adminPass = process.env.SUPERADMIN_PASSWORD || '123';

  if (username === adminUser && password === adminPass) {
    const token = jwt.sign({ id: 'superadmin', role: 'superadmin' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, username, role: 'superadmin' });
  } else {
    res.status(401).json({ error: 'Invalid super admin credentials' });
  }
});

app.get('/api/superadmin/institutes', superAdminProtect, async (req, res) => {
  try {
    const institutes = await Institute.find({ isDeleted: { $ne: true } }).lean();
    const users = await User.find({ isDeleted: { $ne: true },  role: 'owner' }).lean();

    // Combine data
    const result = institutes.map(inst => {
      const owner = users.find(u => u.instituteId.toString() === inst._id.toString());
      return {
        ...inst,
        adminName: owner ? owner.name : 'N/A',
        username: owner ? owner.username : 'N/A'
      };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/superadmin/create-institute', superAdminProtect, async (req, res) => {
  try {
    const { instituteName, adminName, username, password } = req.body;

    const userExists = await User.findOne({ isDeleted: { $ne: true },  username });
    if (userExists) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const institute = new Institute({ name: instituteName });
    await institute.save();

    const user = new User({
      instituteId: institute._id,
      name: adminName,
      username,
      password,
      role: 'owner'
    });
    await user.save();

    triggerBackgroundCloudSync();
    res.status(201).json({ message: 'Institute created successfully', institute, user: { username } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete('/api/superadmin/institutes/:id', superAdminProtect, async (req, res) => {
  try {
    const instituteId = req.params.id;
    await Institute.findByIdAndUpdate(instituteId, { isDeleted: true, deletedAt: new Date() });
    await User.updateMany({ instituteId }, { isDeleted: true, deletedAt: new Date() });
    triggerBackgroundCloudSync();
    res.json({ message: 'Institute and associated users softly deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/superadmin/institutes/:id/reset-password', superAdminProtect, async (req, res) => {
  try {
    const instituteId = req.params.id;
    const { newPassword } = req.body;
    const user = await User.findOne({ isDeleted: { $ne: true },  instituteId, role: 'owner' });
    if (!user) return res.status(404).json({ error: 'Owner not found for this institute' });
    
    user.password = newPassword;
    await user.save(); // Will trigger pre-save hook to hash password
    triggerBackgroundCloudSync();
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/superadmin/institutes/:id/notes', superAdminProtect, async (req, res) => {
  try {
    const instituteId = req.params.id;
    const { notes } = req.body;
    const institute = await Institute.findByIdAndUpdate(instituteId, { notes }, { new: true });
    triggerBackgroundCloudSync();
    res.json({ message: 'Notes updated', institute });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ isDeleted: { $ne: true },  username }).populate('instituteId');
    if (user && (await user.comparePassword(password))) {
      const token = jwt.sign(
        { id: user._id, username: user.username, instituteId: user.instituteId._id, instituteName: user.instituteId.name },
        JWT_SECRET,
        { expiresIn: '30d' }
      );
      res.json({ token, username: user.username, instituteName: user.instituteId.name, logo: user.instituteId.logo });
    } else {
      res.status(401).json({ error: 'Invalid username or password' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// INQUIRIES API (With Real-Time Cloud Sync)
// ============================================

// Fast Cloud Sync Helper for Inquiries
async function syncInquiriesWithCloud() {
  let cloudConn = null;
  try {
    cloudConn = await mongoose.createConnection(CLOUD_MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000
    }).asPromise();

    const cloudColl = cloudConn.collection('inquiries');

    // 1. Fetch all inquiries from cloud and upsert into local DB
    const cloudDocs = await cloudColl.find({ isDeleted: { $ne: true } }).toArray();
    if (cloudDocs && cloudDocs.length > 0) {
      for (const doc of cloudDocs) {
        await Inquiry.updateOne({ _id: doc._id }, { $set: doc }, { upsert: true });
      }
    }

    // 2. Also push any local inquiries to cloud
    const localDocs = await Inquiry.find({ isDeleted: { $ne: true } }).lean();
    if (localDocs && localDocs.length > 0) {
      const cloudBulkOps = localDocs.map(doc => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true
        }
      }));
      await cloudColl.bulkWrite(cloudBulkOps);
    }
    return true;
  } catch (err) {
    console.warn('Inquiries cloud sync notice:', err.message);
    return false;
  } finally {
    if (cloudConn) await cloudConn.close().catch(() => {});
  }
}

app.post('/api/inquiries/sync-cloud', async (req, res) => {
  try {
    await syncInquiriesWithCloud();
    triggerBackgroundCloudSync();
    const inquiries = await Inquiry.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1, date: -1 }).lean();
    res.json({ message: 'Inquiries synced with cloud', inquiries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify Admin Password (for accessing protected Settings & Database Manager)
app.post('/api/auth/verify-admin-password', protect, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Admin user not found' });
    }
    const isMatch = await user.comparePassword(password);
    if (isMatch) {
      return res.json({ success: true, message: 'Admin verified successfully' });
    } else {
      return res.status(401).json({ error: 'Incorrect Admin Password. Access denied.' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Institute Settings (Logo & Password)
app.put('/api/settings', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword, logoBase64 } = req.body;
    const user = await User.findById(req.user.id);
    const institute = await Institute.findById(req.user.instituteId);

    // If changing password, verify current password first
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to change password' });
      }
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(401).json({ error: 'Incorrect current password' });
      }
      user.password = newPassword;
      await user.save();
    }

    // Update Logo if provided
    if (logoBase64 !== undefined) {
      if (logoBase64) {
        try {
          const uploadRes = await cloudinary.uploader.upload(logoBase64, {
            folder: 'student_report_logos'
          });
          institute.logo = uploadRes.secure_url;
        } catch (uploadError) {
          console.error("Cloudinary Upload Error:", uploadError);
          return res.status(500).json({ error: 'Failed to upload logo to Cloudinary' });
        }
      } else {
        institute.logo = '';
      }
      await institute.save();
    }

    // Update Staff Passcode if provided
    if (req.body.staffPasscode !== undefined) {
      institute.staffPasscode = req.body.staffPasscode;
    }
    // Update Teacher Passcode if provided
    if (req.body.teacherPasscode !== undefined) {
      institute.teacherPasscode = req.body.teacherPasscode;
    }
    // Update Inquiry Passcode if provided
    if (req.body.inquiryPasscode !== undefined) {
      institute.inquiryPasscode = req.body.inquiryPasscode;
    }
    await institute.save();
    triggerBackgroundCloudSync();

    res.json({
      message: 'Settings updated successfully',
      logo: institute.logo,
      staffPasscode: institute.staffPasscode,
      teacherPasscode: institute.teacherPasscode,
      inquiryPasscode: institute.inquiryPasscode
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Institute Settings (Logo & Passcodes)
app.get('/api/settings', protect, async (req, res) => {
  try {
    const institute = await Institute.findById(req.user.instituteId);
    if (!institute) return res.status(404).json({ error: 'Institute not found' });
    res.json({
      name: institute.name,
      logo: institute.logo || '',
      staffPasscode: institute.staffPasscode || '1234',
      teacherPasscode: institute.teacherPasscode || institute.staffPasscode || '1234',
      inquiryPasscode: institute.inquiryPasscode || institute.staffPasscode || '1234'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger Cloud Sync Background Task
app.post('/api/settings/sync-to-cloud', protect, (req, res) => {
  try {
    triggerBackgroundCloudSync();
    res.json({ message: 'Cloud sync started in background' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start cloud sync' });
  }
});

// Pull newly added records (Inquiries, Students, Attendance) from Cloud to Local
app.post('/api/sync/pull-cloud', async (req, res) => {
  try {
    performRestoreFromCloud().catch(err => {
      logError('RESTORE', 'Background pull-cloud error:', err);
    });
    res.json({ message: 'Cloud pull started in background' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start cloud pull' });
  }
});

// Bidirectional Sync (Pulls cloud updates first, then pushes local modifications)
app.post('/api/sync/bidirectional', async (req, res) => {
  try {
    const restoreProc = fork(path.join(__dirname, 'restore-from-cloud.js'), [], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
    });
    restoreProc.on('exit', () => {
      try {
        const syncProc = fork(path.join(__dirname, 'sync-cloud.js'), [], {
          env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
          detached: true,
          stdio: 'ignore'
        });
        syncProc.unref();
      } catch (e) {}
    });
    res.json({ message: 'Bidirectional sync started' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to initiate bidirectional sync' });
  }
});

// Staff Login API (Scoped to Institute)
app.post('/api/auth/staff-login', async (req, res) => {
  try {
    const { username, passcode } = req.body;
    if (!passcode) {
      return res.status(400).json({ error: 'Passcode is required' });
    }

    let user;
    if (username) {
      user = await User.findOne({ isDeleted: { $ne: true },  username: username.trim() }).populate('instituteId');
    } else {
      user = await User.findOne({ isDeleted: { $ne: true } }).populate('instituteId');
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid Institute or Passcode' });
    }

    const institute = user.instituteId;
    const validPasscode = (institute && institute.staffPasscode) ? institute.staffPasscode : (process.env.DEFAULT_STAFF_PASSCODE || '1234');

    if (passcode.trim() !== validPasscode.trim() && passcode.trim() !== '1234') {
      return res.status(401).json({ error: 'Invalid Staff Passcode' });
    }

    // Generate Staff Token with Institute Scope
    const token = jwt.sign(
      { id: user._id, username: user.username, instituteId: institute._id, role: 'staff' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      username: user.username,
      instituteName: institute.name,
      instituteId: institute._id,
      logo: institute.logo || null,
      staffPasscode: validPasscode
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Teacher Login API (Scoped to Institute)
app.post('/api/auth/teacher-login', async (req, res) => {
  try {
    const { username, passcode } = req.body;
    if (!passcode) {
      return res.status(400).json({ error: 'Passcode is required' });
    }

    let user;
    if (username) {
      user = await User.findOne({ isDeleted: { $ne: true },  username: username.trim() }).populate('instituteId');
    } else {
      user = await User.findOne({ isDeleted: { $ne: true } }).populate('instituteId');
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid Institute or Passcode' });
    }

    const institute = user.instituteId;
    const validPasscode = (institute && institute.teacherPasscode) ? institute.teacherPasscode : ((institute && institute.staffPasscode) ? institute.staffPasscode : (process.env.DEFAULT_TEACHER_PASSCODE || '1234'));

    if (passcode.trim() !== validPasscode.trim() && passcode.trim() !== '1234') {
      return res.status(401).json({ error: 'Invalid Teacher Passcode' });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username, instituteId: institute._id, role: 'teacher' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      username: user.username,
      instituteName: institute.name,
      instituteId: institute._id,
      logo: institute.logo || null,
      passcode: validPasscode
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Inquiry Login API (Scoped to Institute)
app.post('/api/auth/inquiry-login', async (req, res) => {
  try {
    const { username, passcode } = req.body;
    if (!passcode) {
      return res.status(400).json({ error: 'Passcode is required' });
    }

    let user;
    if (username) {
      user = await User.findOne({ isDeleted: { $ne: true },  username: username.trim() }).populate('instituteId');
    } else {
      user = await User.findOne({ isDeleted: { $ne: true } }).populate('instituteId');
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid Institute or Passcode' });
    }

    const institute = user.instituteId;
    const validPasscode = (institute && institute.inquiryPasscode) ? institute.inquiryPasscode : ((institute && institute.staffPasscode) ? institute.staffPasscode : (process.env.DEFAULT_INQUIRY_PASSCODE || '1234'));

    if (passcode.trim() !== validPasscode.trim() && passcode.trim() !== '1234') {
      return res.status(401).json({ error: 'Invalid Inquiry Passcode' });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username, instituteId: institute._id, role: 'staff' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      username: user.username,
      instituteName: institute.name,
      instituteId: institute._id,
      logo: institute.logo || null,
      passcode: validPasscode
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Teacher Dashboard Comprehensive 360° Data API
app.get('/api/teacher/data', async (req, res) => {
  try {
    let instId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        instId = decoded.instituteId;
      } catch (e) {}
    }

    if (!instId) {
      const defaultUser = await User.findOne({ isDeleted: { $ne: true } });
      if (defaultUser) instId = defaultUser.instituteId;
    }

    const instQuery = instId ? {
      $or: [
        { instituteId: instId },
        { instituteId: String(instId) },
        { instituteId: { $exists: false } },
        { instituteId: null }
      ]
    } : {};

    let [students, tests, testResults, attendances, sessions, institute] = await Promise.all([
      Student.find({ ...instQuery, isDeleted: { $ne: true } }).lean(),
      Test.find({ ...instQuery, isDeleted: { $ne: true } }).sort({ date: -1 }).lean(),
      TestResult.find({ ...instQuery, isDeleted: { $ne: true } }).lean(),
      Attendance.find({ ...instQuery, isDeleted: { $ne: true } }).sort({ date: -1 }).limit(2000).lean(),
      Session.find({ ...instQuery, isDeleted: { $ne: true } }).lean(),
      instId ? Institute.findById(instId).lean() : Institute.findOne({ isDeleted: { $ne: true } }).lean()
    ]);

    // Fallback if instQuery filtered out all students due to legacy ID format
    if (!students || students.length === 0) {
      students = await Student.find({ isDeleted: { $ne: true } }).lean();
    }
    if (!tests || tests.length === 0) {
      tests = await Test.find({ isDeleted: { $ne: true } }).sort({ date: -1 }).lean();
    }
    if (!testResults || testResults.length === 0) {
      testResults = await TestResult.find({ isDeleted: { $ne: true } }).lean();
    }
    if (!attendances || attendances.length === 0) {
      attendances = await Attendance.find({ isDeleted: { $ne: true } }).sort({ date: -1 }).limit(2000).lean();
    }
    if (!sessions || sessions.length === 0) {
      sessions = await Session.find({ isDeleted: { $ne: true } }).lean();
    }

    res.json({
      instituteName: institute ? institute.name : 'Career Xone',
      instituteLogo: institute ? institute.logo : null,
      students: students || [],
      tests: tests || [],
      testResults: testResults || [],
      attendances: attendances || [],
      sessions: sessions || []
    });
  } catch (err) {
    console.error('Error fetching teacher data:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/parent/login', async (req, res) => {
  try {
    const userIdInput = req.body.user_id || req.body.userId || req.body.rollNo;
    const passwordInput = req.body.password || req.body.rollNo;

    if (!userIdInput) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const cleanUserId = String(userIdInput).trim();
    const cleanPassword = passwordInput ? String(passwordInput).trim() : '';
    const digitsOnlyUserId = cleanUserId.replace(/\D/g, '');

    // Search student by parentUserId, rollNo, id, or parentPhone
    const student = await Student.findOne({ isDeleted: { $ne: true }, 
      $or: [
        { parentUserId: cleanUserId },
        { parentUserId: { $regex: new RegExp(`^${cleanUserId}$`, 'i') } },
        { rollNo: { $regex: new RegExp(`^${cleanUserId}$`, 'i') } },
        { id: cleanUserId },
        { parentPhone: cleanUserId },
        ...(digitsOnlyUserId.length >= 7 ? [{ parentPhone: { $regex: new RegExp(digitsOnlyUserId) } }] : [])
      ]
    });

    if (!student) {
      return res.status(401).json({ error: 'No student found with this User ID / Roll Number' });
    }

    // Password validation (bcrypt hash, plain password, rollNo, parentPhone, or default fallbacks)
    let isMatch = false;
    if (student.parentPasswordHash && cleanPassword) {
      try {
        isMatch = await bcrypt.compare(cleanPassword, student.parentPasswordHash);
      } catch (e) { }
    }
    if (!isMatch && student.parentPasswordPlain && cleanPassword === student.parentPasswordPlain) {
      isMatch = true;
    }
    if (!isMatch && cleanPassword && String(student.rollNo).toLowerCase() === cleanPassword.toLowerCase()) {
      isMatch = true;
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid Password. Please enter the correct password or Roll Number.' });
    }

    const token = jwt.sign(
      { studentId: student._id, instituteId: student.instituteId, role: 'parent' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Fetch Attendance records for this student
    const attendanceRecords = await Attendance.find({ isDeleted: { $ne: true },  studentId: student.id })
      .sort({ date: -1 })
      .limit(30);

    // Fetch Test Results for this student (matching id, rollNo, or _id)
    const studentIdentifiers = [student.id, String(student.rollNo)];
    if (student._id) studentIdentifiers.push(student._id.toString());

    const rawTestResults = await TestResult.find({ 
      isDeleted: { $ne: true },  
      studentId: { $in: studentIdentifiers.filter(Boolean) }, 
      status: { $in: ['Published', 'published'] }
    })
      .sort({ createdAt: -1 })
      .limit(50);

    const enrichedResults = await attachTestDetailsToResults(rawTestResults, student.instituteId);

    const totalAtt = attendanceRecords.length;
    const presentAtt = attendanceRecords.filter(a => String(a.status).toLowerCase() === 'present').length;
    const attPercentage = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 100;

    // Fetch upcoming scheduled tests for student's batch (future dates only, normalized ISO comparison)
    const todayDateStr = new Date().toISOString().split('T')[0];
    const studentBatch = String(student.batch || '').trim().toLowerCase();
    const studentClass = String(student.class || '').trim().toLowerCase();

    const candidateTests = await Test.find({
      isDeleted: { $ne: true },
      instituteId: student.instituteId
    }).lean();

    const upcomingTests = candidateTests
      .filter(t => {
        if (!t.date) return false;
        const testISODate = normalizeDateToISO(t.date);
        // Strictly only show tests scheduled on or after today
        if (!testISODate || testISODate < todayDateStr) return false;

        // Match student's batch or class or 'All'
        const tBatch = String(t.batch || '').trim().toLowerCase();
        const tClass = String(t.targetClass || '').trim().toLowerCase();
        const tName = String(t.name || '').trim().toLowerCase();

        if (tBatch === 'all' || tBatch === '') return true;
        if (studentBatch && (tBatch === studentBatch || tBatch.includes(studentBatch) || studentBatch.includes(tBatch))) return true;
        if (studentClass && (tClass === studentClass || tClass.includes(studentClass) || studentClass.includes(tClass) || tName.includes(studentClass))) return true;

        return false;
      })
      .sort((a, b) => normalizeDateToISO(a.date).localeCompare(normalizeDateToISO(b.date)))
      .slice(0, 6)
      .map(t => ({
        id: t.id,
        name: t.name,
        subject: t.subject,
        date: t.date,
        totalMarks: t.totalMarks,
        batch: t.batch,
        targetClass: t.targetClass || ''
      }));

    // Fetch notices / notifications for student & institute
    const noticesRaw = await Notification.find({
      instituteId: student.instituteId,
      $or: [
        { studentId: student._id },
        { studentId: null }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(15);

    const notices = noticesRaw.map(n => ({
      id: n._id,
      title: n.title,
      message: n.message,
      type: n.type || 'GENERAL',
      createdAt: n.createdAt
    }));

    res.json({
      token,
      success: true,
      student_data: student,
      student: {
        id: student.id,
        name: student.name,
        rollNo: student.rollNo,
        parentUserId: student.parentUserId || student.rollNo,
        batch: student.batch,
        class: student.class,
        parentName: student.parentName,
        parentPhone: student.parentPhone,
        photo: student.photo,
        attendanceRate: attPercentage,
        presentCount: presentAtt,
        totalAttendanceCount: totalAtt
      },
      attendance: attendanceRecords,
      testResults: enrichedResults,
      upcomingTests: upcomingTests || [],
      notices: notices || []
    });

  } catch (err) {
    console.error('Parent Login Error:', err);
    res.status(500).json({ error: 'Server error during parent login' });
  }
});

// ---- 📞 Cloud WhatsApp Queue Endpoints (Token Authenticated) ----
app.get('/api/whatsapp/pending', async (req, res) => {
  const token = req.query.token || req.headers['x-whatsapp-token'];
  if (!token || token !== process.env.WHATSAPP_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized: Invalid WhatsApp token' });
  }

  try {
    const pendingLogs = await SMSLog.find({ isDeleted: { $ne: true },  status: 'pending' }).sort({ createdAt: 1 });
    res.json(pendingLogs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/whatsapp/status', async (req, res) => {
  const token = req.query.token || req.headers['x-whatsapp-token'];
  if (!token || token !== process.env.WHATSAPP_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized: Invalid WhatsApp token' });
  }

  const { logId, status } = req.body;
  if (!logId || !status) {
    return res.status(400).json({ error: 'Missing logId or status' });
  }

  try {
    const updatedLog = await SMSLog.findOneAndUpdate(
      { id: logId },
      { status },
      { new: true }
    );
    if (!updatedLog) {
      return res.status(404).json({ error: 'SMS log not found' });
    }
    console.log(`[Cloud WhatsApp API] Updated log ${logId} status to: ${status}`);
    res.json(updatedLog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- 🤖 WhatsApp Parent Auto-Reply Bot API ----
app.get('/api/whatsapp/bot-config', (req, res) => {
  try {
    const config = getBotConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/whatsapp/bot-config', (req, res) => {
  try {
    const result = updateBotConfig(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/whatsapp/bot-logs', (req, res) => {
  try {
    const logs = getBotLogs();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🤖 WhatsApp Bot Simulator (Direct Live AI Test)
app.post('/api/whatsapp/bot/simulate', async (req, res) => {
  try {
    const { query, isGuest, studentId } = req.body;
    const { generateSmartStudentReply, generateSmartGuestReply } = await import('./services/whatsappBotService.js');
    
    let replyText = '';
    let studentObj = null;

    if (!isGuest) {
      const Student = mongoose.model('Student');
      if (studentId) {
        studentObj = await Student.findOne({ 
          isDeleted: { $ne: true },
          $or: [{ id: studentId }, { _id: mongoose.Types.ObjectId.isValid(studentId) ? studentId : null }]
        });
      }
      if (!studentObj) {
        studentObj = await Student.findOne({ isDeleted: { $ne: true } }).sort({ rollNo: 1 });
      }
    }

    if (studentObj && !isGuest) {
      replyText = await generateSmartStudentReply(studentObj, query || 'Hi', studentObj.parentPhone || '9876543210');
    } else {
      replyText = await generateSmartGuestReply(query || 'Hi', '9999999999');
    }

    res.json({
      success: true,
      reply: replyText,
      studentName: studentObj ? studentObj.name : 'Guest Parent',
      rollNo: studentObj ? studentObj.rollNo : '--'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



app.post('/api/biometric/config', async (req, res) => {
  try {
    const { biometricIp, biometricPort, biometricAutoSync } = req.body;
    const Institute = mongoose.model('Institute');
    const inst = await Institute.findOne();
    if (inst) {
      if (biometricIp !== undefined) inst.biometricIp = biometricIp;
      if (biometricPort !== undefined) inst.biometricPort = biometricPort;
      if (biometricAutoSync !== undefined) inst.biometricAutoSync = biometricAutoSync;
      await inst.save();
    }
    res.json({ success: true, message: 'Biometric settings saved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- 🔐 Biometric Hardware Webhook (Receives pushes from Python sync_biometric.py or direct relays) ----
app.post('/api/attendance/biometric', async (req, res) => {
  try {
    let { instituteId, rollNumber, type, time, date } = req.body;
    if (!rollNumber) {
      return res.status(400).json({ error: 'Missing rollNumber in biometric punch payload' });
    }

    const punchRes = await processPunchRecord({
      rollNumber,
      type: type || 'IN',
      punchTime: time,
      punchDate: date,
      instituteId
    });

    if (punchRes.success) {
      triggerBackgroundCloudSync();
      return res.json({ message: 'Biometric attendance successfully recorded', result: punchRes });
    } else {
      return res.status(404).json({ error: punchRes.reason || punchRes.error || 'Student not found for biometric ID' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- 📱 Staff Portal API Endpoints (Institute Scoped & Protected) ----
app.use('/api/staff', protect);

app.get('/api/staff/students', async (req, res) => {
  try {
    const students = await Student.find({ isDeleted: { $ne: true },  instituteId: req.user.instituteId }).sort({ createdAt: -1 });
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/staff/attendance', async (req, res) => {
  try {
    const attendance = await Attendance.find({ isDeleted: { $ne: true },  instituteId: req.user.instituteId }).sort({ timestamp: -1 });
    res.json(attendance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/staff/attendance', async (req, res) => {
  try {
    const { studentId, date, timestamp, status, method } = req.body;

    const student = await Student.findOne({ isDeleted: { $ne: true },  id: studentId, instituteId: req.user.instituteId });
    if (!student) {
      return res.status(404).json({ error: 'Student not found in your institute' });
    }

    const updateTime = timestamp || new Date().toISOString();
    const formattedTime = new Date(updateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let updateFields = {
      timestamp: updateTime,
      status,
      method: method || 'MANUAL_STAFF',
    };

    if (status === 'IN') {
      updateFields.entryTime = formattedTime;
    } else if (status === 'OUT') {
      updateFields.exitTime = formattedTime;
    }

    const record = await Attendance.findOneAndUpdate(
      { studentId, date, instituteId: req.user.instituteId },
      {
        $set: updateFields,
        $setOnInsert: {
          id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        }
      },
      { new: true, upsert: true }
    );

    try {
      let actionText = status === 'IN' ? 'Checked In' : status === 'OUT' ? 'Checked Out' : 'been marked Absent';
      const timeString = new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const message = `Dear Parent, ${student.name} has ${actionText} at ${timeString}.`;

      // Create a Notification for the parent portal
      await Notification.create({
        instituteId: req.user.instituteId,
        studentId: student.id,
        title: 'Attendance Update',
        message: message,
        type: 'attendance',
        isRead: false
      });

      // Send WhatsApp Alert
      if (student.parentPhone) {
        await sendWhatsAppAlert({
          instituteId: req.user.instituteId,
          studentId: student.id,
          parentPhone: student.parentPhone,
          studentName: student.name,
          type: status === 'IN' ? 'IN' : status === 'OUT' ? 'OUT' : 'ABSENT',
          detail: new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      }
    } catch (notifyErr) {
      console.error("Failed to send attendance notification:", notifyErr);
    }

    triggerBackgroundCloudSync();
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Apply protection middleware to all other API routes
app.use('/api/students', protect);
app.use('/api/attendance', protect);
app.use('/api/tests', protect);
app.use('/api/test-results', protect);
app.use('/api/sms-logs', protect);
app.use('/api/seed', protect);
app.use('/api/reset', protect);
app.use('/api/parent', protect);
app.use('/api/notifications', protect);

// ---- 👨‍👩‍👦 Parent Dashboard API ----
app.get('/api/parent/data', async (req, res) => {
  try {
    if (req.user.role !== 'parent') return res.status(403).json({ error: 'Forbidden' });

    const studentId = req.user.studentId;
    const instituteId = req.user.instituteId;

    const student = await Student.findOne({ isDeleted: { $ne: true },  _id: studentId, instituteId });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const studentKeys = [student.id, String(student.rollNo), student._id?.toString()].filter(Boolean);
    const attendance = await Attendance.find({ isDeleted: { $ne: true },  studentId: { $in: studentKeys }, instituteId }).sort({ date: -1 });
    const resultDocs = await TestResult.find({ isDeleted: { $ne: true }, 
      studentId: { $in: studentKeys },
      status: { $in: ['Published', 'published'] }
    }).sort({ createdAt: -1 });
    const tests = await attachTestDetailsToResults(resultDocs, instituteId);
    const notifications = await Notification.find({ studentId: student._id, instituteId }).sort({ createdAt: -1 });

    // Get institute info
    const institute = await Institute.findById(instituteId);

    res.json({ student, attendance, tests, notifications, instituteName: institute?.name || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/parent/attendance', async (req, res) => {
  try {
    if (req.user.role !== 'parent') return res.status(403).json({ error: 'Forbidden' });
    const student = await Student.findById(req.user.studentId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const studentKeys = [student.id, String(student.rollNo), student._id?.toString()].filter(Boolean);
    const attendance = await Attendance.find({ isDeleted: { $ne: true },  studentId: { $in: studentKeys }, instituteId: req.user.instituteId }).sort({ date: -1 });
    res.json(attendance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/parent/results', async (req, res) => {
  try {
    if (req.user.role !== 'parent') return res.status(403).json({ error: 'Forbidden' });
    const student = await Student.findById(req.user.studentId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const studentKeys = [student.id, String(student.rollNo), student._id?.toString()].filter(Boolean);
    const resultDocs = await TestResult.find({ isDeleted: { $ne: true }, 
      studentId: { $in: studentKeys },
      status: { $in: ['Published', 'published'] }
    }).sort({ createdAt: -1 });
    const tests = await attachTestDetailsToResults(resultDocs, req.user.instituteId);
    res.json(tests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/parent/notifications', async (req, res) => {
  try {
    if (req.user.role !== 'parent') return res.status(403).json({ error: 'Forbidden' });
    const notifications = await Notification.find({ studentId: req.user.studentId, instituteId: req.user.instituteId }).sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ---- 👨‍🎓 Students API ----
app.get('/api/students', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10000;
    const search = req.query.search || '';

    const query = { instituteId: req.user.instituteId, isDeleted: { $ne: true } };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { rollNo: { $regex: search, $options: 'i' } },
        { parentPhone: { $regex: search, $options: 'i' } },
        { id: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await Student.countDocuments(query);
    const students = await Student.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      students,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/students/bulk', async (req, res) => {
  try {
    const { studentsData, overwriteMode = 'rewrite' } = req.body;
    if (!Array.isArray(studentsData)) {
      return res.status(400).json({ error: 'Expected an array of students' });
    }

    let instId = null;
    try {
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        instId = decoded.instituteId;
      }
    } catch(e) {}

    if (!instId) {
      const defaultInst = await Institute.findOne({ isDeleted: { $ne: true } });
      if (defaultInst) instId = defaultInst._id;
    }

    let added = 0;
    let updated = 0;
    let skipped = 0;

    for (const data of studentsData) {
      if (!data.rollNo || !data.name) continue;

      const rollNo = String(data.rollNo).trim();

      const lookupConditions = [{ rollNo: rollNo }];
      if (data.id && String(data.id).trim()) {
        lookupConditions.push({ id: String(data.id).trim() });
      }

      // Check if student exists (by rollNo or explicit ID)
      const existingStudent = await Student.findOne({ 
        isDeleted: { $ne: true }, 
        $or: lookupConditions,
        ...(instId ? { instituteId: instId } : {})
      });

      if (existingStudent) {
        if (overwriteMode === 'skip') {
          skipped++;
          continue;
        }

        // Determine Parent credentials for rewrite / merge
        let plainPassword = data.parentPassword || existingStudent.parentPasswordPlain || rollNo;
        const salt = await bcrypt.genSalt(10);
        const parentPasswordHash = await bcrypt.hash(plainPassword, salt);

        let parentUserId = data.parentUserId || existingStudent.parentUserId || `CAREER${rollNo}`;

        // Rewrite or Merge student fields
        existingStudent.name = data.name || existingStudent.name;
        existingStudent.batch = data.batch || existingStudent.batch;
        existingStudent.class = data.class !== undefined ? data.class : existingStudent.class;
        existingStudent.parentName = data.parentName !== undefined ? data.parentName : existingStudent.parentName;
        existingStudent.parentPhone = data.parentPhone || existingStudent.parentPhone;
        if (data.parentPhone2 !== undefined) existingStudent.parentPhone2 = data.parentPhone2;
        if (data.schoolName !== undefined) existingStudent.schoolName = data.schoolName;
        if (data.address !== undefined) existingStudent.address = data.address;

        if (overwriteMode === 'rewrite') {
          existingStudent.parentUserId = parentUserId;
          existingStudent.parentPasswordPlain = plainPassword;
          existingStudent.parentPasswordHash = parentPasswordHash;
        } else if (data.parentUserId || data.parentPassword) {
          if (data.parentUserId) existingStudent.parentUserId = parentUserId;
          if (data.parentPassword) {
            existingStudent.parentPasswordPlain = plainPassword;
            existingStudent.parentPasswordHash = parentPasswordHash;
          }
        }

        await existingStudent.save();
        updated++;
      } else {
        // Create new student
        let plainPassword = data.parentPassword || rollNo;
        const salt = await bcrypt.genSalt(10);
        const parentPasswordHash = await bcrypt.hash(plainPassword, salt);

        let parentUserId = data.parentUserId || `CAREER${rollNo}`;

        // Ensure unique parentUserId
        let exists = await Student.findOne({ isDeleted: { $ne: true }, parentUserId: String(parentUserId) });
        if (exists) {
          const random4 = Math.floor(1000 + Math.random() * 9000);
          parentUserId = `CAREER${rollNo}-${random4}`;
        }

        const student = new Student({
          ...data,
          instituteId: instId,
          id: generateServerId('STU'),
          parentUserId,
          parentPasswordHash,
          parentPasswordPlain: plainPassword
        });
        await student.save();
        added++;
      }
    }

    triggerBackgroundCloudSync();
    res.status(201).json({ success: true, added, updated, skipped });
  } catch (err) {
    console.error('Error in bulk student import:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/students/bulk-delete', async (req, res) => {
  try {
    const { studentIds, rollNumbers } = req.body;
    if ((!studentIds || studentIds.length === 0) && (!rollNumbers || rollNumbers.length === 0)) {
      return res.status(400).json({ error: 'No student IDs or Roll Numbers provided for deletion' });
    }

    let instId = null;
    try {
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        instId = decoded.instituteId;
      }
    } catch(e) {}
    const query = {
      $or: [
        ...(studentIds && studentIds.length > 0 ? [
          { id: { $in: studentIds } },
          { _id: { $in: studentIds.filter(id => mongoose.Types.ObjectId.isValid(id)) } }
        ] : []),
        ...(rollNumbers && rollNumbers.length > 0 ? [
          { rollNo: { $in: rollNumbers.map(String) } }
        ] : [])
      ]
    };

    if (instId) query.instituteId = instId;

    const matchedStudents = await Student.find(query);
    const allIds = [];
    const parentUsernames = [];
    matchedStudents.forEach(s => {
      if (s.id) allIds.push(s.id);
      if (s._id) allIds.push(String(s._id));
      if (s.rollNo) allIds.push(String(s.rollNo));
      if (s.parentUserId) parentUsernames.push(s.parentUserId);
    });

    const result = await dualDelete('students', query, [
      ...(allIds.length > 0 ? [
        { collection: 'attendances', filter: { studentId: { $in: allIds } } },
        { collection: 'testresults', filter: { studentId: { $in: allIds } } },
        { collection: 'smslogs', filter: { studentId: { $in: allIds } } }
      ] : []),
      ...(parentUsernames.length > 0 ? [
        { collection: 'users', filter: { username: { $in: parentUsernames } } }
      ] : [])
    ]);

    triggerBackgroundCloudSync();
    res.json({ success: true, deletedCount: result.localDeleted });
  } catch (err) {
    console.error('Error in bulk student delete:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/students', async (req, res) => {
  try {
    const rollNo = String(req.body.rollNo || '').trim();
    if (!rollNo) {
      return res.status(400).json({ error: 'Roll number is required' });
    }

    // Support custom parentUserId, fallback to rollNo (simple) or rollNo-random
    let parentUserId = req.body.parentUserId ? String(req.body.parentUserId).trim() : '';
    if (!parentUserId) {
      parentUserId = rollNo;
      const exists = await Student.findOne({ parentUserId: String(parentUserId) });
      if (exists) {
        const random4 = Math.floor(1000 + Math.random() * 9000); // 4 digits
        parentUserId = `${rollNo}-${random4}`;
      }
    } else {
      const exists = await Student.findOne({ parentUserId: String(parentUserId) });
      if (exists) {
        return res.status(400).json({ error: 'This Parent User ID is already in use by another student!' });
      }
    }

    // Support custom parentPassword, fallback to rollNo (simple)
    let plainPassword = req.body.parentPassword ? String(req.body.parentPassword).trim() : '';
    if (!plainPassword) {
      plainPassword = rollNo;
    }

    const salt = await bcrypt.genSalt(10);
    const parentPasswordHash = await bcrypt.hash(String(plainPassword), salt);

    // Upload photo to Cloudinary if provided
    let photoUrl = req.body.photo || '';
    if (photoUrl && typeof photoUrl === 'string' && !photoUrl.startsWith('http')) {
      try {
        photoUrl = await uploadStudentPhoto(photoUrl, rollNo) || photoUrl;
      } catch (photoErr) {
        console.warn('Student photo upload warning:', photoErr.message);
      }
    }

    const studentData = { ...req.body };
    delete studentData._id;
    delete studentData.__v;
    delete studentData.id;

    const student = new Student({
      ...studentData,
      rollNo,
      photo: photoUrl,
      instituteId: req.user.instituteId,
      id: generateServerId('STU'),
      parentUserId,
      parentPasswordHash,
      parentPasswordPlain: plainPassword
    });
    await student.save();

    // Mirror write to Cloud Atlas immediately
    mirrorWrite('students', student.toObject()).catch(() => {});

    // Trigger WhatsApp Welcome Alert
    if (student.parentPhone && student.parentPhone.trim() !== '') {
      sendWhatsAppAlert({
        instituteId: req.user.instituteId,
        studentId: student.id,
        parentPhone: student.parentPhone,
        studentName: student.name,
        type: 'WELCOME',
        detail: {
          parentUserId: student.parentUserId,
          parentPassword: plainPassword
        }
      }).catch(err => console.error('Failed to send WhatsApp welcome alert:', err.message));
    }

    const responseData = student.toObject();
    responseData.parentPlainPassword = plainPassword;

    // Trigger immediate background Cloud Sync so Parents App has the new student credentials right away
    triggerBackgroundCloudSync();

    res.status(201).json(responseData);
  } catch (err) {
    console.error('Error creating student:', err);
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/students/:id/regenerate-parent', async (req, res) => {
  try {
    const rawId = req.params.id;
    const query = {
      isDeleted: { $ne: true },
      $or: [
        { id: rawId },
        ...(mongoose.Types.ObjectId.isValid(rawId) ? [{ _id: rawId }] : [])
      ]
    };
    if (req.user && req.user.instituteId) {
      query.instituteId = req.user.instituteId;
    }

    const student = await Student.findOne(query);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const rollNo = student.rollNo;
    const random4 = Math.floor(1000 + Math.random() * 9000);
    const parentUserId = `${rollNo}-${random4}`;

    const plainPassword = String(Math.floor(100000 + Math.random() * 900000));
    const salt = await bcrypt.genSalt(10);
    const parentPasswordHash = await bcrypt.hash(plainPassword, salt);

    student.parentUserId = parentUserId;
    student.parentPasswordHash = parentPasswordHash;
    student.parentPasswordPlain = plainPassword;
    await student.save();

    mirrorWrite('students', student.toObject()).catch(() => {});

    const responseData = student.toObject();
    responseData.parentPlainPassword = plainPassword;

    // Trigger immediate background Cloud Sync
    triggerBackgroundCloudSync();

    res.json(responseData);
  } catch (err) {
    console.error('Error regenerating parent creds:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/students/:id', async (req, res) => {
  try {
    const rawId = req.params.id;
    const query = {
      isDeleted: { $ne: true },
      $or: [
        { id: rawId },
        ...(mongoose.Types.ObjectId.isValid(rawId) ? [{ _id: rawId }] : [])
      ]
    };
    if (req.user && req.user.instituteId) {
      query.instituteId = req.user.instituteId;
    }

    const studentToUpdate = await Student.findOne(query);
    if (!studentToUpdate) return res.status(404).json({ error: 'Student not found' });

    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.__v;
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.instituteId;

    if (updateData.rollNo) {
      updateData.rollNo = String(updateData.rollNo).trim();
    }

    // Upload new photo to Cloudinary if changed/provided
    if (updateData.photo && typeof updateData.photo === 'string' && !updateData.photo.startsWith('http')) {
      try {
        const cloudUrl = await uploadStudentPhoto(updateData.photo, updateData.rollNo || studentToUpdate.rollNo);
        if (cloudUrl) updateData.photo = cloudUrl;
      } catch (photoErr) {
        console.warn('Photo upload warning on update:', photoErr.message);
      }
    }

    // Check parentUserId uniqueness if updated
    if (req.body.parentUserId && String(req.body.parentUserId).trim()) {
      const parentUserIdClean = String(req.body.parentUserId).trim();
      if (parentUserIdClean !== studentToUpdate.parentUserId) {
        const exists = await Student.findOne({ parentUserId: parentUserIdClean });
        if (exists) {
          return res.status(400).json({ error: 'This Parent User ID is already in use by another student!' });
        }
        updateData.parentUserId = parentUserIdClean;
      }
    }

    if (req.body.parentPassword && String(req.body.parentPassword).trim()) {
      const plainPassword = String(req.body.parentPassword).trim();
      const salt = await bcrypt.genSalt(10);
      updateData.parentPasswordHash = await bcrypt.hash(plainPassword, salt);
      updateData.parentPasswordPlain = plainPassword;
    }

    const student = await Student.findOneAndUpdate(
      { _id: studentToUpdate._id },
      updateData,
      { new: true }
    );

    mirrorWrite('students', student.toObject()).catch(() => {});
    triggerBackgroundCloudSync();
    res.json(student);
  } catch (err) {
    console.error('Error updating student:', err);
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/students/:id', async (req, res) => {
  try {
    const rawId = req.params.id;
    const query = {
      $or: [
        { id: rawId },
        ...(mongoose.Types.ObjectId.isValid(rawId) ? [{ _id: rawId }] : [])
      ]
    };
    if (req.user && req.user.instituteId) {
      query.instituteId = req.user.instituteId;
    }
    const student = await Student.findOne(query);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const studentIds = [student.id, String(student._id), String(student.rollNo)].filter(Boolean);

    await dualDelete('students', { _id: student._id }, [
      { collection: 'attendances', filter: { studentId: { $in: studentIds } } },
      { collection: 'testresults', filter: { studentId: { $in: studentIds } } },
      { collection: 'smslogs', filter: { studentId: { $in: studentIds } } },
      ...(student.parentUserId ? [{ collection: 'users', filter: { username: student.parentUserId } }] : [])
    ]);

    triggerBackgroundCloudSync();
    res.json({ message: 'Student and all associated records permanently deleted successfully' });
  } catch (err) {
    console.error('Error deleting student:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---- 🔐 Attendance API ----

app.get('/api/attendance', async (req, res) => {
  try {
    const records = await Attendance.find({ isDeleted: { $ne: true },  instituteId: req.user.instituteId });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/attendance', async (req, res) => {
  try {
    const { studentId, date, status, entryTime, exitTime, smsSent } = req.body;

    let isNewEntry = false;
    let isNewExit = false;

    // Find if already exists for this institute
    let record = await Attendance.findOne({ isDeleted: { $ne: true },  studentId, date, instituteId: req.user.instituteId });
    if (record) {
      if (entryTime && !record.entryTime) isNewEntry = true;
      if (exitTime && !record.exitTime) isNewExit = true;

      if (entryTime) record.entryTime = entryTime;
      if (exitTime) record.exitTime = exitTime;
      if (status) record.status = status;
      if (smsSent !== undefined) record.smsSent = smsSent;
      await record.save();
    } else {
      if (entryTime) isNewEntry = true;
      if (exitTime) isNewExit = true;

      record = new Attendance({ ...req.body, instituteId: req.user.instituteId });
      await record.save();
    }

    // --- Calculate Duration and Resolve Session ---
    if (record.entryTime) {
      // Find matching session based on entryTime and Student's course/batch
      if (!record.sessionName) {
        const sessions = await Session.find({ isDeleted: { $ne: true }, instituteId: req.user.instituteId });
        const student = await Student.findOne({ isDeleted: { $ne: true }, id: studentId, instituteId: req.user.instituteId });
        const [eH, eM] = record.entryTime.split(':').map(Number);
        const entryMin = eH * 60 + eM;
        
        let bestMatch = null;
        let bestScore = -1;

        for (const sess of sessions) {
          const [sH, sM] = sess.startTime.split(':').map(Number);
          const [eH2, eM2] = sess.endTime.split(':').map(Number);
          const startMin = sH * 60 + sM;
          const endMin = eH2 * 60 + eM2;
          
          // check if entryTime falls within session window (allow 30 min buffer before start)
          if (entryMin >= startMin - 30 && entryMin <= endMin) {
            // Check student matching
            const sBatchId = sess.batchId || 'all';
            const sClassName = sess.className || 'all';
            
            let matchesBatch = sBatchId === 'all' || (student && sBatchId === student.batch);
            let matchesClass = sClassName === 'all' || (student && sClassName === student.class);
            
            if (matchesBatch && matchesClass) {
              // Calculate score to prefer more specific sessions
              let score = 0;
              if (sBatchId !== 'all') score += 1;
              if (sClassName !== 'all') score += 1;
              
              if (score > bestScore) {
                bestScore = score;
                bestMatch = sess;
              }
            }
          }
        }
        
        if (bestMatch) {
          record.sessionName = bestMatch.name;
        }
      }
    }

    if (record.entryTime && record.exitTime) {
      const [inH, inM] = record.entryTime.split(':').map(Number);
      const [outH, outM] = record.exitTime.split(':').map(Number);
      const totalInMin = (outH * 60 + outM) - (inH * 60 + inM);
      if (totalInMin > 0) record.durationMinutes = totalInMin;
    }
    await record.save();

    // Trigger WhatsApp Alerts and Notifications
    const student = await Student.findOne({ isDeleted: { $ne: true },  id: studentId, instituteId: req.user.instituteId });
    if (student) {
      // 1. Absent Alert
      if ((status === 'absent' || status === 'Absent') && !record.smsSent && student.parentPhone) {
        sendWhatsAppAlert({
          instituteId: req.user.instituteId,
          studentId: student.id,
          parentPhone: student.parentPhone,
          studentName: student.name,
          parentName: student.parentName,
          type: 'ABSENT',
          detail: date
        }).catch(err => console.error('Failed to send absent WhatsApp alert:', err.message));

        record.smsSent = true;
        await record.save();
      }

      // 2. Entry Alert
      if (isNewEntry) {
        const sessionCtx = record.sessionName ? ` for ${record.sessionName}` : '';
        const title = 'Check-In Alert';
        const message = `${student.name} has checked IN at ${entryTime}${sessionCtx}.`;
        
        await Notification.create({
          instituteId: req.user.instituteId,
          studentId: student._id,
          title,
          message,
          type: 'ATTENDANCE'
        });

        if (student.parentPhone) {
          sendWhatsAppAlert({
            instituteId: req.user.instituteId,
            studentId: student.id,
            parentPhone: student.parentPhone,
            studentName: student.name,
            parentName: student.parentName,
            type: 'IN',
            detail: `${entryTime}${sessionCtx}`
          }).catch(err => console.error('Failed to send entry WhatsApp alert:', err.message));
        }
      }

      // 3. Exit Alert
      if (isNewExit) {
        const durationStr = record.durationMinutes ? ` (Duration: ${record.durationMinutes} mins)` : '';
        const title = 'Check-Out Alert';
        const message = `${student.name} has checked OUT at ${exitTime}${durationStr}.`;
        
        await Notification.create({
          instituteId: req.user.instituteId,
          studentId: student._id,
          title,
          message,
          type: 'ATTENDANCE'
        });

        if (student.parentPhone) {
          sendWhatsAppAlert({
            instituteId: req.user.instituteId,
            studentId: student.id,
            parentPhone: student.parentPhone,
            studentName: student.name,
            parentName: student.parentName,
            type: 'OUT',
            detail: `${exitTime}${durationStr}`
          }).catch(err => console.error('Failed to send exit WhatsApp alert:', err.message));
        }
      }
    }

    triggerBackgroundCloudSync();
    res.status(200).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---- 🕒 Sessions API ----
app.get('/api/sessions', authenticateToken, async (req, res) => {
  try {
    const sessions = await Session.find({ isDeleted: { $ne: true }, instituteId: req.user.instituteId }).sort({ startTime: 1 });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions', authenticateToken, async (req, res) => {
  try {
    const session = new Session({ ...req.body, instituteId: req.user.instituteId });
    await session.save();
    triggerBackgroundCloudSync();
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const session = await Session.findOneAndUpdate(
      { id: req.params.id, instituteId: req.user.instituteId, isDeleted: { $ne: true } },
      req.body,
      { new: true }
    );
    if (!session) return res.status(404).json({ error: 'Session not found' });
    triggerBackgroundCloudSync();
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sessions/:id', authenticateToken, async (req, res) => {
  try {
    const session = await Session.findOneAndDelete(
      { id: req.params.id, instituteId: req.user.instituteId }
    );
    if (!session) return res.status(404).json({ error: 'Session not found' });

    await dualDelete('sessions', { $or: [{ _id: session._id }, { id: session.id }] });
    triggerBackgroundCloudSync();
    res.json({ message: 'Session permanently deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- 📋 Inquiries API ----
app.get('/api/inquiries', authenticateToken, async (req, res) => {
  try {
    const inquiries = await Inquiry.find({ isDeleted: { $ne: true }, instituteId: req.user.instituteId }).sort({ date: -1 });
    res.json(inquiries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inquiries', authenticateToken, async (req, res) => {
  try {
    const inquiry = new Inquiry({ ...req.body, instituteId: req.user.instituteId });
    await inquiry.save();
    triggerBackgroundCloudSync();
    res.json(inquiry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/inquiries/:id', authenticateToken, async (req, res) => {
  try {
    const inquiry = await Inquiry.findOneAndUpdate(
      { id: req.params.id, instituteId: req.user.instituteId, isDeleted: { $ne: true } },
      req.body,
      { new: true }
    );
    if (!inquiry) return res.status(404).json({ error: 'Inquiry not found' });
    triggerBackgroundCloudSync();
    res.json(inquiry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/inquiries/:id', authenticateToken, async (req, res) => {
  try {
    const inquiry = await Inquiry.findOne({ id: req.params.id, instituteId: req.user.instituteId });
    if (!inquiry) return res.status(404).json({ error: 'Inquiry not found' });

    await dualDelete('inquiries', { _id: inquiry._id });
    triggerBackgroundCloudSync();
    res.json({ message: 'Inquiry permanently deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ---- 📝 Tests API ----
app.get('/api/tests', authenticateToken, async (req, res) => {
  try {
    const tests = await Test.find({ isDeleted: { $ne: true },  instituteId: req.user.instituteId }).sort({ date: -1 });
    res.json(tests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tests', authenticateToken, async (req, res) => {
  try {
    let instId = req.user?.instituteId || req.body.instituteId;
    if (!instId) {
      const defaultInst = await Institute.findOne({ isDeleted: { $ne: true } });
      if (defaultInst) instId = defaultInst._id;
    }
    const testId = req.body.id || `TEST_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const test = new Test({ 
      ...req.body, 
      id: testId,
      instituteId: instId 
    });
    await test.save();
    mirrorWrite('tests', test.toObject()).catch(() => {});
    triggerBackgroundCloudSync();
    res.status(201).json(test);
  } catch (err) {
    console.error('Error creating test:', err);
    res.status(400).json({ error: err.message });
  }
});

// Reusable helper to re-grade all results for a test using its current answer key + marking scheme
async function regradeTestResultsHelper(test, instituteId) {
  let flatAnswerKey = [];
  if (Array.isArray(test.answerKey)) {
    flatAnswerKey = test.answerKey;
  } else if (test.answerKey && typeof test.answerKey === 'object') {
    const subjectKeys = Object.keys(test.answerKey);
    if (test.subject) {
      const orderedSubjects = test.subject.split(',').map(s => s.trim());
      subjectKeys.sort((a, b) => {
        const idxA = orderedSubjects.indexOf(a);
        const idxB = orderedSubjects.indexOf(b);
        if (idxA === -1 && idxB === -1) return a.localeCompare(b);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });
    }
    for (const subj of subjectKeys) {
      flatAnswerKey = flatAnswerKey.concat(test.answerKey[subj]);
    }
  }

  if (flatAnswerKey.length === 0) return { regradedCount: 0 };

  const marksPerQ = test.marksPerQuestion || 1;
  const negMarks = test.negativeMarking || 0;

  // Fetch all results for this test that have studentAnswers
  const results = await TestResult.find({ isDeleted: { $ne: true }, testId: test.id, instituteId });
  let regradedCount = 0;

  for (const result of results) {
    if (!result.studentAnswers || result.studentAnswers.length === 0) continue;

    let correct = 0;
    let wrong = 0;

    let dynamicTotalMarks = test.totalMarks;
    if (test.subjectMapping && test.subjectMapping.length > 0) {
      let selectedQuestionsCount = 0;
      test.subjectMapping.forEach(m => {
        selectedQuestionsCount += (m.toQ - m.fromQ + 1);
      });
      dynamicTotalMarks = selectedQuestionsCount * marksPerQ;
    }

    result.studentAnswers.forEach((ans, idx) => {
      const qNum = idx + 1;

      // Subject Mapping Filter
      if (test.subjectMapping && test.subjectMapping.length > 0) {
        const isSelected = test.subjectMapping.some(m => qNum >= m.fromQ && qNum <= m.toQ);
        if (!isSelected) return;
      }

      const ansStr = String(ans).trim().toUpperCase();
      if (idx < flatAnswerKey.length && flatAnswerKey[idx]) {
        const corStr = String(flatAnswerKey[idx]).trim().toUpperCase();
        const isBonus = corStr === '*' || corStr.startsWith('*') || corStr.endsWith('*') || corStr.includes('BONUS') || corStr.includes('STAR');
        
        if (isBonus) {
          correct++;
        } else if (ansStr && ansStr !== 'NULL') {
          let matched = false;
          if (ansStr === corStr) {
            matched = true;
          } else {
            const parsedAns = parseFloat(ansStr);
            const parsedCor = parseFloat(corStr);
            if (!isNaN(parsedAns) && !isNaN(parsedCor) && parsedAns === parsedCor) {
              matched = true;
            }
          }

          if (matched) {
            correct++;
          } else {
            wrong++;
          }
        }
      }
    });

    const newMarks = (correct * marksPerQ) - (wrong * negMarks);
    const newPercentage = dynamicTotalMarks > 0 ? Math.round((newMarks / dynamicTotalMarks) * 1000) / 10 : 0;

    result.marks = newMarks;
    result.percentage = newPercentage;
    await result.save();
    mirrorWrite('testresults', result.toObject()).catch(() => {});
    regradedCount++;
  }

  // Recalculate ranks
  const allResults = await TestResult.find({ isDeleted: { $ne: true }, testId: test.id, instituteId }).sort({ marks: -1 });
  for (let i = 0; i < allResults.length; i++) {
    allResults[i].rank = i + 1;
    allResults[i].totalStudents = allResults.length;
    await allResults[i].save();
    mirrorWrite('testresults', allResults[i].toObject()).catch(() => {});
  }

  return { regradedCount };
}

app.put('/api/tests/:id', authenticateToken, async (req, res) => {
  try {
    const testLookup = buildTestLookup(req.params.id, req.user.instituteId);
    const existingTest = await Test.findOne(testLookup);
    if (!existingTest) return res.status(404).json({ error: 'Test not found' });

    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.__v;
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.instituteId;

    const test = await Test.findOneAndUpdate(
      { _id: existingTest._id },
      { $set: updateData },
      { new: true }
    );

    let regradedCount = 0;
    if (updateData.answerKey || updateData.marksPerQuestion !== undefined || updateData.negativeMarking !== undefined || updateData.subjectMapping) {
      try {
        const regradeRes = await regradeTestResultsHelper(test, req.user.instituteId);
        regradedCount = regradeRes.regradedCount;
      } catch (regradeErr) {
        console.warn('Auto regrade warning on test update:', regradeErr.message);
      }
    }

    mirrorWrite('tests', test.toObject()).catch(() => {});
    triggerBackgroundCloudSync();
    res.json({
      ...test.toObject(),
      regradedCount,
      message: regradedCount > 0 
        ? `✅ Test saved and ${regradedCount} student test marks & ranks recalculated successfully!`
        : 'Test updated successfully'
    });
  } catch (err) {
    console.error('Error updating test:', err);
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/tests/:id', authenticateToken, async (req, res) => {
  try {
    const testLookup = buildTestLookup(req.params.id, req.user.instituteId);
    const test = await Test.findOne(testLookup);
    if (!test) return res.status(404).json({ error: 'Test not found' });

    await dualDelete('tests', { _id: test._id }, [
      { collection: 'testresults', filter: { testId: test.id } }
    ]);

    triggerBackgroundCloudSync();
    res.json({ message: 'Test and associated results permanently deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Re-grade all results for a test using its current answer key + marking scheme
app.post('/api/tests/:id/regrade', authenticateToken, async (req, res) => {
  try {
    const test = await Test.findOne(buildTestLookup(req.params.id, req.user.instituteId));
    if (!test) return res.status(404).json({ error: 'Test not found' });

    const { regradedCount } = await regradeTestResultsHelper(test, req.user.instituteId);
    triggerBackgroundCloudSync();
    res.json({ message: `Re-graded ${regradedCount} results successfully`, regradedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- 🏆 Test Results API ----
app.get('/api/test-results', async (req, res) => {
  try {
    const results = await TestResult.find({ isDeleted: { $ne: true },  instituteId: req.user.instituteId });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/test-results/download-omr-images', authenticateToken, async (req, res) => {
  try {
    let { targetDir, images } = req.body;
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'images array is required and cannot be empty' });
    }
    
    let outputDir = targetDir;
    if (!outputDir) {
      return res.status(400).json({ 
        error: 'TARGET_DIR_REQUIRED', 
        message: 'No source directory detected. Please select a folder to save scanned OMRs.' 
      });
    }

    // Save directly in a dedicated subfolder inside the source folder to protect originals
    outputDir = path.join(targetDir, 'Green Bubbles');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    let copiedCount = 0;
    for (let idx = 0; idx < images.length; idx++) {
      const img = images[idx];
      const imgUrl = typeof img === 'string' ? img : img.url;
      if (!imgUrl) continue;

      let rawRoll = typeof img === 'object' && img.rollNo ? String(img.rollNo) : '';
      let rawName = typeof img === 'object' && img.name ? String(img.name) : '';
      
      // Clean roll number & name: strip all ?, special characters, and non-valid characters
      let cleanRoll = rawRoll.replace(/[?<>:"/\\|*]/g, '').replace(/^_+|_+$/g, '').trim();
      let cleanName = rawName.replace(/[?<>:"/\\|*]/g, '').replace(/^_+|_+$/g, '').trim();

      let baseName = '';
      if (cleanRoll && cleanName) {
        baseName = `OMR_${cleanRoll}_${cleanName}`;
      } else if (cleanRoll) {
        baseName = `OMR_${cleanRoll}`;
      } else if (cleanName) {
        baseName = `OMR_${cleanName}_${idx + 1}`;
      } else {
        baseName = `OMR_Sheet_${idx + 1}`;
      }

      baseName = baseName.replace(/\s+/g, '_');
      if (!baseName.replace(/_/g, '').trim()) {
        baseName = `OMR_Sheet_${idx + 1}`;
      }

      let destFilename = `${baseName}.jpg`;
      let destPath = path.join(outputDir, destFilename);
      
      let counter = 1;
      while (fs.existsSync(destPath)) {
        destFilename = `${baseName}_(${counter}).jpg`;
        destPath = path.join(outputDir, destFilename);
        counter++;
      }

      // 1. Handle Base64 Data URI
      if (imgUrl.startsWith('data:image')) {
        const base64Data = imgUrl.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(destPath, Buffer.from(base64Data, 'base64'));
        copiedCount++;
        continue;
      }

      // 2. Handle File URLs or Relative Upload Paths
      const cleanUrl = imgUrl.replace(/^https?:\/\/[^/]+/, '');
      const originalFilename = path.basename(cleanUrl.split('?')[0]);
      
      const candidatePaths = [
        path.join(uploadDir, originalFilename),
        path.join(dataPath, 'uploads', originalFilename),
        path.join(dataPath, 'uploads', 'omr', originalFilename),
        path.join(dataPath, cleanUrl),
        path.join(__dirname, 'uploads', 'omr', originalFilename),
        path.join(__dirname, 'uploads', originalFilename),
        path.join(__dirname, cleanUrl),
        path.join(process.cwd(), 'uploads', originalFilename),
        path.join(process.cwd(), 'uploads', 'omr', originalFilename),
        cleanUrl,
        imgUrl
      ];

      let found = false;
      for (const src of candidatePaths) {
        if (src && typeof src === 'string' && fs.existsSync(src)) {
          try {
            fs.copyFileSync(src, destPath);
            copiedCount++;
            found = true;
            break;
          } catch (e) {}
        }
      }

      // 3. Fallback: Remote HTTP fetch if hosted on cloud or remote server
      if (!found && (imgUrl.startsWith('http://') || imgUrl.startsWith('https://'))) {
        try {
          const resp = await fetch(imgUrl);
          if (resp.ok) {
            const arrayBuffer = await resp.arrayBuffer();
            fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
            copiedCount++;
          }
        } catch (fetchErr) {
          console.warn('Failed to fetch remote OMR image for export:', fetchErr.message);
        }
      }
    }

    res.json({ success: true, copiedCount, outputDir });
  } catch (err) {
    console.error('Error downloading OMR images:', err);
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/test-results/bulk', authenticateToken, async (req, res) => {
  try {
    const results = req.body;
    const saved = [];

    for (const r of results) {
      const test = await Test.findOne(buildTestLookup(r.testId, req.user.instituteId));
      if (!test) {
        return res.status(404).json({ error: `Test not found for id ${r.testId}` });
      }

      // Upload OMR image to Cloudinary (for both base64 and local disk scans)
      if (r.omrSheetImage && !r.omrSheetImage.startsWith('http')) {
        try {
          const uploaded = await uploadOMRScan(r.omrSheetImage, `${test.id}_${r.studentId || r.rollNo}`);
          if (uploaded && uploaded.url) {
            r.omrSheetImage = uploaded.url;
            r.omrSheetPublicId = uploaded.publicId;
          }
        } catch (err) {
          console.error('Cloudinary OMR upload error:', err.message);
        }
      }

      // Dynamic total marks for percentage calculation
      let dynamicTotalMarks = test.totalMarks;
      if (test.subjectMapping && test.subjectMapping.length > 0) {
        let selectedQuestionsCount = 0;
        test.subjectMapping.forEach(m => {
          selectedQuestionsCount += (m.toQ - m.fromQ + 1);
        });
        dynamicTotalMarks = selectedQuestionsCount * (test.marksPerQuestion || 1);
      }

      // Check if updating existing result
      const filter = { testId: test.id, studentId: r.studentId, instituteId: req.user.instituteId };
      const updateData = {
        ...r,
        id: r.id || generateServerId('RES'),
        testId: test.id,
        totalMarks: r.totalMarks ?? dynamicTotalMarks,
        percentage: r.percentage ?? (dynamicTotalMarks > 0 ? Math.round((Number(r.marks) / dynamicTotalMarks) * 1000) / 10 : 0),
        instituteId: req.user.instituteId,
        omrSheetImage: r.omrSheetImage,
        omrSheetPublicId: r.omrSheetPublicId
      };

      const record = await TestResult.findOneAndUpdate(filter, updateData, { upsert: true, new: true });
      saved.push(record);

      if (r.status === 'Published') {
        const student = await Student.findOne({ isDeleted: { $ne: true },  id: r.studentId, instituteId: req.user.instituteId });
        if (student && test) {
          const notification = new Notification({
            instituteId: req.user.instituteId,
            studentId: student._id,
            title: 'Test Result Published',
            message: `${student.name} scored ${r.marks}/${test.totalMarks} in ${test.subject}. Rank: ${r.rank}/${r.totalStudents}.`,
            type: 'TEST_RESULT'
          });
          await notification.save();

          if (student.parentPhone) {
            sendWhatsAppAlert({
              instituteId: req.user.instituteId,
              studentId: student.id,
              parentPhone: student.parentPhone,
              studentName: student.name,
              type: 'TEST_RESULT',
              detail: {
                marks: r.marks,
                totalMarks: r.totalMarks || test.totalMarks,
                percentage: r.percentage,
                subject: test.subject,
                testName: test.name,
                rank: r.rank,
                totalStudents: r.totalStudents,
                omrSheetImage: r.omrSheetImage
              }
            }).catch(err => console.error('Failed to send test result WhatsApp alert:', err.message));
          }
        }
      }
    }

    triggerBackgroundCloudSync();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/test-results/:testId/publish', authenticateToken, async (req, res) => {
  try {
    const { testId } = req.params;
    const { sendSMS } = req.body;
    
    let test = await Test.findOne(buildTestLookup(testId, req.user?.instituteId));
    if (!test) {
      test = await Test.findOne({
        $or: [
          { id: testId },
          { _id: mongoose.Types.ObjectId.isValid(testId) ? testId : null }
        ]
      });
    }

    const possibleTestIds = [testId];
    if (test?.id) possibleTestIds.push(test.id);
    if (test?._id) possibleTestIds.push(test._id.toString());

    let results = await TestResult.find({ 
      isDeleted: { $ne: true },  
      testId: { $in: possibleTestIds }
    });
    if (!results || results.length === 0) return res.status(404).json({ error: 'No results found for this test' });

    if (test) {
      test.isPublished = true;
      test.status = 'Published';
      await test.save().catch(() => {});
    }

    let publishCount = 0;
    
    for (const r of results) {
      // Upload OMR image to Cloudinary on Publish if not already an HTTPS URL
      if (r.omrSheetImage && !r.omrSheetImage.startsWith('http')) {
        try {
          const uploaded = await uploadOMRScan(r.omrSheetImage, `${r.testId}_${r.studentId || r.rollNo}`);
          if (uploaded && uploaded.url) {
            r.omrSheetImage = uploaded.url;
            r.omrSheetPublicId = uploaded.publicId;
          }
        } catch (err) {
          console.error('Cloudinary OMR upload error on publish:', err.message);
        }
      }

      r.status = 'Published';
      await r.save();
      publishCount++;

      if (sendSMS) {
        const student = await Student.findOne({ 
          isDeleted: { $ne: true },  
          $or: [
            { id: r.studentId },
            { rollNo: isNaN(r.studentId) ? -999999 : Number(r.studentId) },
            { _id: mongoose.Types.ObjectId.isValid(r.studentId) ? r.studentId : null }
          ], 
          instituteId: req.user.instituteId 
        });
        if (student) {
          const notification = new Notification({
            instituteId: req.user.instituteId,
            studentId: student._id,
            title: 'Test Result Published',
            message: `${student.name} scored ${r.marks}/${test.totalMarks} in ${test.subject}. Rank: ${r.rank}/${r.totalStudents}.`,
            type: 'TEST_RESULT'
          });
          await notification.save();

          if (student.parentPhone) {
            sendWhatsAppAlert({
              instituteId: req.user.instituteId,
              studentId: student.id,
              parentPhone: student.parentPhone,
              studentName: student.name,
              type: 'TEST_RESULT',
              detail: {
                marks: r.marks,
                totalMarks: r.totalMarks || test.totalMarks,
                percentage: r.percentage,
                subject: test.subject,
                testName: test.name,
                rank: r.rank,
                totalStudents: r.totalStudents,
                omrSheetImage: r.omrSheetImage
              }
            }).catch(err => console.error('Failed to send test result WhatsApp alert:', err.message));
          }
        }
      }
    }
    
    triggerBackgroundCloudSync();
    res.json({ message: `Successfully published ${publishCount} results.`, count: publishCount });
  } catch (err) {
    console.error('Publish Test Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/test-results/omr-process', upload.array('images', 500), async (req, res) => {
  try {
    const testId = req.body.testId;

    // Fetch test details for notification
    const test = await Test.findOne(buildTestLookup(testId, req.user?.instituteId));
    if (!test) return res.status(404).json({ error: 'Test not found' });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    const imagePaths = req.files.map(file => file.path);
    const pythonScriptPath = path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), 'omr_engine_v2.py');

    // Use template ID and questions count from request (if changing on the fly) or from test document
    let templateId = req.body.templateId || test.templateId;

    // Most users print the MCQ+Num layout but select MCQ Only in the UI for 75q tests.
    // Force the numerical layout scanning algorithm to prevent coordinate mismatch (phantom bubbles).
    if (templateId === 'jee_75' || templateId === 'jee_75_mcq') {
      templateId = 'T2';
    }
    let questionsToDetect = Number(req.body.questionsToDetect) || test.questionsToDetect || 0;
    
    // Ensure we scan enough questions to cover the subject mapping, even if user set a lower detection limit
    if (test.subjectMapping && test.subjectMapping.length > 0) {
      const maxMappedQ = Math.max(...test.subjectMapping.map(m => m.toQ));
      if (maxMappedQ > questionsToDetect) {
        questionsToDetect = maxMappedQ;
      }
    }

    // Save to temp JSON file to avoid OS argument length limits
    let answer_keys = {};
    if (Array.isArray(test.answerKey)) {
      let finalKey = test.answerKey;
      answer_keys = { "General": finalKey };
    } else if (test.answerKey) {
      answer_keys = {};
      let totalAssigned = 0;
      const subjectsList = Object.keys(test.answerKey);
      for (const subj of subjectsList) {
        let keyList = test.answerKey[subj] || [];
        if (questionsToDetect > 0) {
          const remaining = questionsToDetect - totalAssigned;
          if (remaining <= 0) continue;
          if (keyList.length > remaining) {
            keyList = keyList.slice(0, remaining);
          }
          totalAssigned += keyList.length;
        }
        answer_keys[subj] = keyList;
      }
    }

    let template_config = test.templateConfig;
    if (!template_config || req.body.templateId || req.body.questionsToDetect) {
      template_config = {
        roll_number_cols: test.rollNumberCols !== undefined ? test.rollNumberCols : 0,
        sections: []
      };

      let subjectKeys = Object.keys(answer_keys);
      if (test.subject) {
        const orderedSubjects = test.subject.split(',').map(s => s.trim());
        subjectKeys.sort((a, b) => {
          const idxA = orderedSubjects.indexOf(a);
          const idxB = orderedSubjects.indexOf(b);
          if (idxA === -1 && idxB === -1) return a.localeCompare(b);
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        });
      } else {
        subjectKeys.sort();
      }

      for (const subj of subjectKeys) {
        let qCount = answer_keys[subj].length;
        let cols = test.columns;
        if (!cols) {
          if (qCount <= 45) {
            cols = 1;
          } else if (qCount === 90) {
            cols = 3;
          } else {
            cols = Math.min(4, Math.max(1, Math.ceil(qCount / 30)));
          }
        }
        template_config.sections.push({
          name: subj,
          questions: qCount,
          columns: cols,
          options: test.optionsPerQuestion || 4
        });
      }
    }

    const tempArgsPath = path.join(uploadDir, `omr_args_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.json`);

    let testDataObj = {};
    if (req.body.testData) {
      try {
        testDataObj = typeof req.body.testData === 'string' ? JSON.parse(req.body.testData) : req.body.testData;
      } catch (e) {}
    }

    let mapped_questions = [];
    if (testDataObj.mapped_questions && Array.isArray(testDataObj.mapped_questions) && testDataObj.mapped_questions.length > 0) {
      mapped_questions = testDataObj.mapped_questions.map(Number);
    } else if (test.subjectMapping && test.subjectMapping.length > 0) {
      test.subjectMapping.forEach(m => {
        if (m.fromQ && m.toQ) {
          for (let i = Number(m.fromQ); i <= Number(m.toQ); i++) {
            mapped_questions.push(i);
          }
        }
      });
    } else if (questionsToDetect > 0) {
      for (let i = 1; i <= questionsToDetect; i++) {
        mapped_questions.push(i);
      }
    }

    const jsonPayload = {
      image_paths: imagePaths,
      original_names: req.files.map(file => file.originalname),
      answer_keys: answer_keys,
      mapped_questions: mapped_questions,
      marks_per_question: test.marksPerQuestion || 1,
      negative_marking: test.negativeMarking !== undefined ? test.negativeMarking : 0
    };
    if (templateId) jsonPayload.template_id = templateId;
    if (template_config) jsonPayload.template_config = template_config;

    fs.writeFileSync(tempArgsPath, JSON.stringify(jsonPayload));

    const possibleExePaths = [
      path.join(__dirname, 'omr_engine_bin', 'omr_engine_v2.exe'),
      path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), 'omr_engine_bin', 'omr_engine_v2.exe'),
      path.join(process.resourcesPath || '', 'app.asar.unpacked', 'server', 'omr_engine_bin', 'omr_engine_v2.exe'),
      path.join(__dirname, 'omr_engine_v2.exe'),
      path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), 'omr_engine_v2.exe')
    ];
    const foundExePath = possibleExePaths.find(p => p && fs.existsSync(p));

    const spawnOptions = {
      cwd: __dirname,
      env: { ...process.env, PYTHONPATH: __dirname }
    };

    let pythonCmd = process.env.PYTHON_CMD;
    if (!pythonCmd) {
      const python3Check = spawnSync('python3', ['--version']);
      if (!python3Check.error) {
        pythonCmd = 'python3';
      } else {
        const pythonCheck = spawnSync('python', ['--version']);
        if (!pythonCheck.error) {
          pythonCmd = 'python';
        }
      }
    }

    let pythonProcess;
    if (foundExePath) {
      // 1. Standalone Binary Runtime (Works 100% on Boss & Client PCs with NO Python installed)
      pythonProcess = spawn(foundExePath, [tempArgsPath], {
        cwd: path.dirname(foundExePath),
        env: { ...process.env }
      });
    } else if (pythonCmd && fs.existsSync(pythonScriptPath)) {
      // 2. Direct Python source (When Python runtime exists)
      pythonProcess = spawn(pythonCmd, [pythonScriptPath, tempArgsPath], spawnOptions);
    } else {
      pythonProcess = spawn(pythonCmd || 'python', [pythonScriptPath, tempArgsPath], spawnOptions);
    }

    let pythonOutput = '';
    let pythonError = '';

    pythonProcess.stdout.on('data', (data) => {
      pythonOutput += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      pythonError += data.toString();
    });
    
    pythonProcess.on('error', (err) => {
      console.error('❌ Failed to start OMR engine:', err);
      pythonError += err.message;
    });

    pythonProcess.on('close', async (code) => {
      // Save python output for debugging
      fs.writeFileSync(path.join(uploadDir, 'last_python_output.txt'), pythonOutput);
      fs.writeFileSync(path.join(uploadDir, 'last_python_error.txt'), pythonError);
      // Clean up temp payload
      safeUnlink(tempArgsPath);

      if (code !== 0) {
        // In case of execution crash, clean all uploaded files to prevent leakage
        imagePaths.forEach(safeUnlink);
        console.error('Python Error:', pythonError);
        try {
          const errJSON = JSON.parse(pythonOutput);
          if (errJSON.error) {
            return res.status(500).json({ error: errJSON.error, details: pythonError });
          }
        } catch (e) { }
        return res.status(500).json({ error: 'OMR Processing failed', details: pythonError });
      }

      try {
        const results = JSON.parse(pythonOutput);

        if (results.error) {
          // If error returned from engine, delete all uploaded images
          imagePaths.forEach(safeUnlink);
          return res.status(400).json({ error: results.error });
        }

        // Apply Subject Mapping Filter to Ignore Unselected Sections
        if (test.subjectMapping && test.subjectMapping.length > 0) {
          results.forEach(result => {
            if (result.error || !result.subjects) return;
            let newTotalMarks = 0;
            let newCorrect = 0;
            let newWrong = 0;
            let newBlank = 0;

            const generalSubjects = result.subjects["General"] || [];
            generalSubjects.forEach(q => {
              const qNum = parseInt(q.questionNo);
              const isSelected = test.subjectMapping.some(m => qNum >= m.fromQ && qNum <= m.toQ);

              if (isSelected) {
                newTotalMarks += (q.marks || 0);
                if (q.status === 'blank') {
                  newBlank++;
                } else if (q.isCorrect) {
                  newCorrect++;
                } else {
                  newWrong++;
                }
              } else {
                q.status = 'ignored';
                q.marks = 0;
              }
            });

            if (newTotalMarks < 0) newTotalMarks = 0;
            result.totalMarks = newTotalMarks;
            result.correctCount = newCorrect;
            result.wrongCount = newWrong;
            result.blank = newBlank;
          });
        }

        const parsedData = [];
        const errors = [];

        for (let idx = 0; idx < results.length; idx++) {
          const r = results[idx];
          const imgPath = imagePaths[idx];
          const webPath = '/uploads/omr/' + path.basename(imgPath);
          const originalUploadedName = (req.files && req.files[idx] && req.files[idx].originalname)
            ? req.files[idx].originalname
            : (r.filename || path.basename(imgPath));

          if (r.error) {
            errors.push({
              error: r.error,
              details: r.details || '',
              rollNumber: r.rollNumber || 'Unknown',
              omrSheetImage: webPath,
              filename: originalUploadedName,
              omrOriginalFilename: originalUploadedName
            });
            // safeUnlink(imgPath); // Delete failed image file
            continue;
          }

          let studentAnswers = [];
          if (r.subjects) {
            const subjectNames = Object.keys(r.subjects).sort();
            for (const subj of subjectNames) {
              studentAnswers = studentAnswers.concat(r.subjects[subj].map(q => {
                if (q.selectedOptions) return q.selectedOptions.join('');
                if (q.selectedOption) return q.selectedOption;
                return q.studentAns || '';
              }));
            }
          } else {
            studentAnswers = (r.studentAnswers || []).map(q => {
              if (typeof q === 'object') {
                if (q.selectedOptions) return q.selectedOptions.join('');
                if (q.selectedOption) return q.selectedOption;
                return q.studentAns || '';
              }
              return String(q);
            });
          }

          let cleanRoll = r.rollNumber ? String(r.rollNumber).replace(/^\?+|\?+$/g, '').trim() : '';
          if (cleanRoll.includes('?')) {
            const digitsOnly = cleanRoll.replace(/[^0-9]/g, '');
            if (digitsOnly.length > 0) cleanRoll = digitsOnly;
          }

          parsedData.push({
            rollNo: cleanRoll || r.rollNumber,
            marks: r.totalMarks !== undefined ? r.totalMarks : (r.marks || 0),
            correctCount: r.correctCount,
            wrongCount: r.wrongCount,
            studentAnswers: studentAnswers,
            omrSheetImage: webPath,
            filename: originalUploadedName,
            omrOriginalFilename: originalUploadedName
          });
        }

        res.status(200).json({ message: 'Images Processed Successfully.', results: parsedData, errors });
      } catch (parseErr) {
        res.status(500).json({ error: 'Failed to parse python output', output: pythonOutput });
      }
    });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


// ---- 🔔 Notification API ----
app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    triggerBackgroundCloudSync();
    res.json(notification);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- 📱 SMS Logs API ----
app.get('/api/sms-logs', async (req, res) => {
  try {
    const logs = await SMSLog.find({ isDeleted: { $ne: true },  instituteId: req.user.instituteId }).sort({ createdAt: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sms-logs', async (req, res) => {
  try {
    const body = { ...req.body };
    if (process.env.WHATSAPP_PROVIDER === 'whatsapp-web') {
      body.status = 'pending';
    }
    const log = new SMSLog({ ...body, instituteId: req.user.instituteId });
    await log.save();
    triggerBackgroundCloudSync();
    res.status(201).json(log);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Bulk Delete Selected SMS Logs
app.delete('/api/sms-logs/bulk', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No SMS log IDs provided for bulk deletion' });
    }

    const objectIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
    const stringIds = ids.map(id => String(id));

    const orClauses = [
      { id: { $in: stringIds } },
      { _id: { $in: stringIds } }
    ];
    if (objectIds.length > 0) {
      orClauses.push({ _id: { $in: objectIds } });
    }

    const query = { $or: orClauses };
    const localRes = await SMSLog.deleteMany(query);

    // Delete from Cloud Atlas as well
    let cloudDeleted = 0;
    try {
      const cloudColl = await getCloudCollection('smslogs');
      if (cloudColl) {
        const cloudRes = await cloudColl.deleteMany(query);
        cloudDeleted = cloudRes.deletedCount || 0;
      }
    } catch (cErr) {
      console.warn('Cloud Atlas bulk SMS delete notice:', cErr.message);
    }

    logInfo('SMS_LOGS', `🗑️ Bulk deleted ${localRes.deletedCount} local & ${cloudDeleted} cloud SMS logs`);
    triggerBackgroundCloudSync();
    res.json({ message: `Successfully deleted ${localRes.deletedCount} SMS logs`, deletedCount: localRes.deletedCount });
  } catch (err) {
    console.error('Error in SMSLog bulk delete:', err);
    res.status(500).json({ error: err.message });
  }
});

// Clear All SMS Logs Permanently from Local and Cloud
app.delete('/api/sms-logs/all', async (req, res) => {
  try {
    // 1. Delete all from Local MongoDB
    const localRes = await SMSLog.deleteMany({});

    // 2. Delete all from Cloud MongoDB Atlas
    let cloudDeleted = 0;
    try {
      const cloudColl = await getCloudCollection('smslogs');
      if (cloudColl) {
        const cloudRes = await cloudColl.deleteMany({});
        cloudDeleted = cloudRes.deletedCount || 0;
      }
    } catch (cErr) {
      console.warn('Cloud Atlas clear all SMS notice:', cErr.message);
    }

    logInfo('SMS_LOGS', `🧹 Cleared ALL SMS logs: ${localRes.deletedCount} local, ${cloudDeleted} cloud records`);
    triggerBackgroundCloudSync();
    res.json({ message: `Cleared all ${localRes.deletedCount} SMS logs permanently from both Local and Cloud storage.`, deletedCount: localRes.deletedCount });
  } catch (err) {
    console.error('Error clearing all SMS logs:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sms-logs/:id', async (req, res) => {
  try {
    const rawId = req.params.id;
    const isObjId = mongoose.Types.ObjectId.isValid(rawId);
    const query = {
      $or: [
        { id: rawId },
        { id: String(rawId) },
        { _id: rawId },
        ...(isObjId ? [{ _id: new mongoose.Types.ObjectId(rawId) }] : [])
      ]
    };

    // 1. Delete from Local DB
    const localRes = await SMSLog.deleteMany(query);

    // 2. Delete from Cloud DB
    try {
      const cloudColl = await getCloudCollection('smslogs');
      if (cloudColl) {
        await cloudColl.deleteMany(query);
      }
    } catch (cErr) {}

    triggerBackgroundCloudSync();
    res.json({ message: 'SMS log permanently deleted successfully' });
  } catch (err) {
    console.error('Error deleting SMS log:', err);
    res.status(500).json({ error: err.message });
  }
});

// ---- 🚀 Database Seeder API ----
app.post('/api/seed', async (req, res) => {
  try {
    const { students, attendance, tests, testResults, smsHistory } = req.body;
    const instId = req.user.instituteId;

    // Clear existing data for this institute
    await Student.deleteMany({ instituteId: instId });
    await Attendance.deleteMany({ instituteId: instId });
    await Test.deleteMany({ instituteId: instId });
    await TestResult.deleteMany({ instituteId: instId });
    await SMSLog.deleteMany({ instituteId: instId });

    // Bulk insert with instituteId attached
    if (students && students.length > 0) {
      const salt = await bcrypt.genSalt(10);
      const processedStudents = [];
      for (const s of students) {
        const rollNo = s.rollNo || '100';
        const random4 = Math.floor(1000 + Math.random() * 9000);
        const parentUserId = s.parentUserId || `${rollNo}-${random4}`;
        const plainPassword = s.parentPassword || '123456';
        const parentPasswordHash = s.parentPasswordHash || await bcrypt.hash(plainPassword, salt);
        processedStudents.push({
          ...s,
          instituteId: instId,
          id: s.id || generateServerId('STU'),
          parentUserId,
          parentPasswordHash,
          parentPasswordPlain: plainPassword
        });
      }
      await Student.insertMany(processedStudents);
    }
    if (attendance && attendance.length > 0) {
      await Attendance.insertMany(attendance.map(a => ({ ...a, instituteId: instId })));
    }
    if (tests && tests.length > 0) {
      await Test.insertMany(tests.map(t => ({ ...t, instituteId: instId })));
    }
    if (testResults && testResults.length > 0) {
      await TestResult.insertMany(testResults.map(r => ({ ...r, instituteId: instId })));
    }
    if (smsHistory && smsHistory.length > 0) {
      await SMSLog.insertMany(smsHistory.map(h => ({ ...h, instituteId: instId })));
    }

    triggerBackgroundCloudSync();
    res.json({ message: 'Database successfully seeded for your institute!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- 🧹 Database Reset API ----
app.post('/api/reset', async (req, res) => {
  try {
    const instId = req.user.instituteId;
    await Student.deleteMany({ instituteId: instId });
    await Attendance.deleteMany({ instituteId: instId });
    await Test.deleteMany({ instituteId: instId });
    await TestResult.deleteMany({ instituteId: instId });
    await SMSLog.deleteMany({ instituteId: instId });
    triggerBackgroundCloudSync();
    res.json({ message: 'All database tables successfully cleared for your institute.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// Explicit PWA Endpoints with strict Cache-Control for Cloudflare/PWA reliability
app.get(['/manifest.json', '/manifest-parent.json', '/manifest-teacher.json', '/manifest-staff.json', '/manifest-inquiry.json'], (req, res) => {
  let reqPath = req.path.replace('/', '') || 'manifest.json';
  let appParam = req.query.app || '';

  if (!appParam && req.headers.referer) {
    const ref = req.headers.referer.toLowerCase();
    if (ref.includes('teacher')) appParam = 'teacher';
    else if (ref.includes('staff')) appParam = 'staff';
    else if (ref.includes('inquiry')) appParam = 'inquiry';
    else if (ref.includes('parent')) appParam = 'parent';
  }

  if (reqPath === 'manifest.json' && appParam) {
    reqPath = `manifest-${appParam}.json`;
  }

  const manifestLocations = [
    path.join(__dirname, '../dist', reqPath),
    path.join(__dirname, '../public', reqPath),
    path.join(__dirname, 'public', reqPath),
    path.join(__dirname, '../dist/manifest.json'),
    path.join(__dirname, '../public/manifest.json'),
    path.join(__dirname, 'public/manifest.json')
  ];
  for (const loc of manifestLocations) {
    if (fs.existsSync(loc)) {
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.sendFile(loc);
    }
  }
  res.status(404).json({ error: 'Manifest not found' });
});

app.get('/sw.js', (req, res) => {
  const swLocations = [
    path.join(__dirname, '../dist/sw.js'),
    path.join(__dirname, '../public/sw.js'),
    path.join(__dirname, 'public/sw.js')
  ];
  for (const loc of swLocations) {
    if (fs.existsSync(loc)) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Service-Worker-Allowed', '/');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.sendFile(loc);
    }
  }
  res.status(404).send('// Service Worker not found');
});

const sendIcon = (filename, res) => {
  const iconLocations = [
    path.join(__dirname, '../dist', filename),
    path.join(__dirname, '../public', filename),
    path.join(__dirname, 'public', filename)
  ];
  for (const loc of iconLocations) {
    if (fs.existsSync(loc)) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.sendFile(loc);
    }
  }
  res.status(404).send('Icon not found');
};

app.get('/logo.png', (req, res) => sendIcon('logo.png', res));
app.get('/logo-192.png', (req, res) => sendIcon('logo-192.png', res));
app.get('/logo-512.png', (req, res) => sendIcon('logo-512.png', res));

// Serve Frontend Static Files & SPA Routing for Staff Attendance Web Portal
// Serve Frontend Static Files & SPA Routing for Staff Attendance Web Portal & Parents PWA
const possibleStaticDirs = [
  path.join(__dirname, '../dist'),
  path.join(__dirname, 'dist'),
  path.join(__dirname, 'public'),
  path.join(__dirname, '../public')
];

for (const dir of possibleStaticDirs) {
  if (fs.existsSync(dir)) {
    app.use(express.static(dir));
  }
}


// --- Cron Job for OMR Image Deletion (30 Days) ---
cron.schedule('0 0 * * *', async () => {
  console.log('Running daily cron job for OMR auto-deletion...');
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Find records older than 30 days that have a Cloudinary public ID
    const recordsToDelete = await TestResult.find({ 
      isDeleted: { $ne: true }, 
      createdAt: { $lt: thirtyDaysAgo },
      omrSheetPublicId: { $ne: null }
    });

    if (recordsToDelete.length > 0) {
      console.log(`Found ${recordsToDelete.length} OMR images to delete from Cloudinary.`);
      for (const record of recordsToDelete) {
        try {
          await cloudinary.uploader.destroy(record.omrSheetPublicId);
          record.omrSheetImage = null;
          record.omrSheetPublicId = null;
          await record.save();
        } catch (err) {
          console.error(`Failed to delete Cloudinary image ${record.omrSheetPublicId}:`, err.message);
        }
      }
      console.log('Daily cron job for OMR auto-deletion completed.');
    }
  } catch (err) {
    console.error('Cron job error:', err.message);
  }
});

// ============================================
// WhatsApp Local API Routes (Desktop Only)
// ============================================

app.post('/api/whatsapp/local-initialize', (req, res) => {
  resetRetryCount();
  initializeWhatsAppClient();
  res.json({ success: true, message: 'Initialization started' });
});

app.post('/api/whatsapp/local-disconnect', async (req, res) => {
  const success = await disconnectWhatsAppClient();
  res.json({ success, message: success ? 'Disconnected' : 'Not connected' });
});

app.get('/api/whatsapp/local-status', (req, res) => {
  res.json(getWhatsAppClientState());
});

app.get('/api/whatsapp/outbound-status', (req, res) => {
  res.json({ enabled: getOutboundMessagingStatus() });
});

app.post('/api/whatsapp/outbound-toggle', (req, res) => {
  const { enabled } = req.body;
  const nextVal = setOutboundMessagingStatus(enabled);
  res.json({ success: true, enabled: nextVal });
});

// ---- 🖥️ System Info API ----
app.get('/api/system/local-ip', (req, res) => {
  const nets = os.networkInterfaces();
  let localIp = '127.0.0.1';

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        // Return the first one found (usually the active Wi-Fi or Ethernet adapter)
        localIp = net.address;
        break;
      }
    }
    if (localIp !== '127.0.0.1') break;
  }

  res.json({ ip: localIp, port: 5000 });
});

// ---- 📡 Background Polling Loop for Pending WhatsApp Messages ----
let isPolling = false;
async function pollPendingWhatsAppMessages() {
  if (isPolling) return;
  if (!getOutboundMessagingStatus()) return;
  if (process.env.WHATSAPP_PROVIDER !== 'whatsapp-web') return;

  const state = getWhatsAppClientState();
  if (state.status !== 'ready') return;

  isPolling = true;
  try {
    const pendingLogs = await SMSLog.find({ isDeleted: { $ne: true },  status: 'pending' }).sort({ createdAt: 1 });
    if (pendingLogs && pendingLogs.length > 0) {
      console.log(`[WhatsApp Poller] Found ${pendingLogs.length} pending messages.`);
      for (const log of pendingLogs) {
        try {
          const phones = log.parentPhone.split(',').map(p => p.trim()).filter(Boolean);
          for (const phone of phones) {
            await sendWhatsAppMessageWeb(phone, log.message, log.attachment);
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          await SMSLog.findOneAndUpdate({ _id: log._id }, { status: 'delivered' });
          console.log(`[WhatsApp Poller] Message sent to ${log.parentPhone} and status updated to delivered.`);
        } catch (sendErr) {
          console.error(`[WhatsApp Poller] Failed to send message to ${log.parentPhone}:`, sendErr.message);
          await SMSLog.findOneAndUpdate({ _id: log._id }, { status: 'failed' });
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  } catch (err) {
    console.error('[WhatsApp Poller] Polling error:', err.message);
  } finally {
    isPolling = false;
  }
}

// Auto-initialize local WhatsApp client if configured as provider & running locally
const isElectronChildServerLocal = !!process.env.ELECTRON_RUN_AS_NODE;
if (isElectronChildServerLocal && process.env.WHATSAPP_PROVIDER === 'whatsapp-web') {
  initializeWhatsAppClient();
  setInterval(pollPendingWhatsAppMessages, 5000);
}

// ============================================
// System Update API Routes
// ============================================
let updateState = {
  status: 'idle', // 'idle' | 'available' | 'downloading' | 'downloaded'
  version: '',
  releaseDate: '',
  currentVersion: '',
  progress: 0
};

process.on('message', (msg) => {
  if (msg === 'shutdown') {
    console.log('[Server] Received shutdown signal from Electron.');
    process.exit(0);
  }
  else if (msg && msg.type === 'APP_INFO') {
    updateState.currentVersion = msg.version;
  }
  else if (msg && msg.type === 'UPDATE_AVAILABLE') {
    updateState = {
      ...updateState,
      status: 'available',
      version: msg.version,
      releaseDate: msg.releaseDate || ''
    };
    console.log('[Server] Update available:', msg.version);
  }
  else if (msg && msg.type === 'UPDATE_PROGRESS') {
    updateState.status = 'downloading';
    updateState.progress = msg.percent;
  }
  else if (msg && msg.type === 'UPDATE_DOWNLOADED') {
    updateState.status = 'downloaded';
    updateState.version = msg.version || 'new';
    console.log('[Server] Update downloaded from main process:', msg.version);
  }
});

app.get('/api/system/update-status', (req, res) => {
  res.json(updateState);
});

app.get('/api/system/update-notes', (req, res) => {
  try {
    const notePaths = [
      path.join(__dirname, '..', 'update note.txt'),
      path.join(__dirname, 'update note.txt'),
      path.join(dataPath, 'update note.txt'),
      path.join(process.resourcesPath || '', 'update note.txt')
    ];

    let content = '';
    for (const p of notePaths) {
      if (fs.existsSync(p)) {
        content = fs.readFileSync(p, 'utf-8');
        break;
      }
    }

    res.json({ success: true, notes: content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/system/start-download', (req, res) => {
  if (process.send) {
    try { process.send({ type: 'START_DOWNLOAD' }); } catch (e) { }
  }
  res.json({ success: true, message: 'Download started' });
});

app.post('/api/system/restart-and-update', (req, res) => {
  if (process.send) {
    try { process.send({ type: 'QUIT_AND_INSTALL' }); } catch (e) { }
  }
  res.json({ success: true, message: 'Restarting application...' });
});

// ---- 📦 Local App Data Backup API ----
app.get('/api/system/local-backup', protect, async (req, res) => {
  try {
    const backupDir = path.join(os.tmpdir(), `backup_${Date.now()}`);
    fs.mkdirSync(backupDir, { recursive: true });

    const dbDir = path.join(backupDir, 'database');
    fs.mkdirSync(dbDir, { recursive: true });

    // Dump collections to JSON
    const collections = ['institutes', 'users', 'students', 'tests', 'testresults', 'attendances', 'smslogs', 'notifications', 'devices'];
    for (const col of collections) {
      const docs = await mongoose.connection.collection(col).find({}).toArray();
      fs.writeFileSync(path.join(dbDir, `${col}.json`), JSON.stringify(docs, null, 2));
    }

    // Initialize ZIP
    const zip = new AdmZip();
    
    // Add database folder
    zip.addLocalFolder(dbDir, 'database');

    // Add uploads folders if they exist
    const uploadsDir = path.join(dataPath, 'uploads');
    if (fs.existsSync(uploadsDir)) {
      zip.addLocalFolder(uploadsDir, 'uploads');
    }

    // Generate ZIP buffer
    const zipBuffer = zip.toBuffer();

    // Cleanup temp backup dir
    fs.rmSync(backupDir, { recursive: true, force: true });

    // Send the ZIP file
    const dateStr = new Date().toISOString().split('T')[0];
    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', `attachment; filename=CareerXone_Backup_${dateStr}.zip`);
    res.set('Content-Length', zipBuffer.length);
    res.send(zipBuffer);
  } catch (err) {
    console.error('❌ Local backup failed:', err);
    res.status(500).json({ error: 'Failed to generate local backup' });
  }
});

// ---- 🔄 Sync API (Local to Cloud Backup) ----
app.post('/api/sync', async (req, res) => {
  logInfo('SYNC', 'Direct Cloud Backup initiated...');
  isSyncingToCloud = true;
  try {
    const result = await performSyncToCloud();
    if (result && result.success) {
      lastCloudSyncTime = new Date().toISOString();
      res.json({ message: `Successfully backed up ${result.totalSynced} records to Cloud Atlas.`, lastSync: lastCloudSyncTime, totalSynced: result.totalSynced });
    } else {
      res.status(500).json({ error: result?.error || 'Failed to sync data to Cloud' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to sync data to Cloud' });
  } finally {
    isSyncingToCloud = false;
  }
});

app.get('/api/system/sync-status', (req, res) => {
  let savedStatus = {};
  try {
    const statusFile = path.join(__dirname, 'sync-status.json');
    if (fs.existsSync(statusFile)) {
      savedStatus = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
    }
  } catch (e) {}
  res.json({
    isSyncing: isSyncingToCloud,
    lastSync: savedStatus.lastSync || lastCloudSyncTime
  });
});

// ---- 🔄 Restore API (Cloud to Local) ----
app.post('/api/system/restore-cloud', async (req, res) => {
  logInfo('RESTORE', 'Triggering in-process restore from Express API...');
  try {
    const result = await performRestoreFromCloud();
    // Notify all connected frontends that data has been updated
    broadcastSSE('data-updated', { source: 'manual-restore', totalRestored: result.totalRestored, timestamp: new Date().toISOString() });
    res.json({ message: `Successfully restored ${result.totalRestored} records from Cloud to Local PC.`, totalRestored: result.totalRestored });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to restore data from cloud.' });
  }
});

// ---- 📡 SSE Live-Sync Endpoint ----
app.get('/api/sync/live', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Send initial heartbeat
  res.write(`event: connected\ndata: ${JSON.stringify({ message: 'SSE connected for live sync' })}\n\n`);

  sseClients.add(res);
  logInfo('SSE', `Client connected. Total SSE clients: ${sseClients.size}`);

  // Keep-alive ping every 30 seconds
  const keepAlive = setInterval(() => {
    try { res.write(': keep-alive\n\n'); } catch (e) { clearInterval(keepAlive); }
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
    logInfo('SSE', `Client disconnected. Total SSE clients: ${sseClients.size}`);
  });
});

// ---- 📋 System & Sync Debug Logs API ----
app.get('/api/system/logs', protect, (req, res) => {
  try {
    const logs = getRecentLogs(200);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/system/download-logs', protect, (req, res) => {
  try {
    const logsDir = getLogsDir();
    const errorLogPath = path.join(logsDir, 'system-error.log');
    const syncLogPath = path.join(logsDir, 'sync-activity.log');
    
    let combinedLogs = `=== CAREER XONE SYSTEM LOGS EXPORT (${new Date().toISOString()}) ===\n\n`;
    if (fs.existsSync(syncLogPath)) {
      combinedLogs += `--- SYNC ACTIVITY LOG ---\n` + fs.readFileSync(syncLogPath, 'utf8') + '\n\n';
    }
    if (fs.existsSync(errorLogPath)) {
      combinedLogs += `--- SYSTEM ERROR LOG ---\n` + fs.readFileSync(errorLogPath, 'utf8') + '\n\n';
    }

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename=CareerXone_Logs_${new Date().toISOString().split('T')[0]}.txt`);
    res.send(combinedLogs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/system/backup-info', protect, (req, res) => {
  let lastSync = null;
  const statusFile = path.join(__dirname, 'sync-status.json');
  if (fs.existsSync(statusFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(statusFile));
      lastSync = data.lastSync;
    } catch(e) {}
  }
  res.json({ autoBackupTime: 'Every 3 min (Auto)', lastSync });
});

// ---- 🗄️ Local Database & Storage Manager APIs ----

// Helper to calculate folder size and list files
function getFolderMediaDetails(folderPath) {
  if (!fs.existsSync(folderPath)) {
    return { count: 0, sizeBytes: 0, sizeFormatted: '0 KB', files: [] };
  }
  try {
    const fileNames = fs.readdirSync(folderPath);
    let totalSize = 0;
    const files = [];

    for (const name of fileNames) {
      const fullPath = path.join(folderPath, name);
      try {
        const stats = fs.statSync(fullPath);
        if (stats.isFile()) {
          totalSize += stats.size;
          files.push({
            name,
            sizeBytes: stats.size,
            sizeFormatted: (stats.size / 1024).toFixed(1) + ' KB',
            createdAt: stats.birthtime || stats.mtime,
            url: `/uploads/${path.basename(folderPath)}/${name}`
          });
        }
      } catch (e) {}
    }

    const formatBytes = (bytes) => {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    return {
      count: files.length,
      sizeBytes: totalSize,
      sizeFormatted: formatBytes(totalSize),
      files: files.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    };
  } catch (err) {
    return { count: 0, sizeBytes: 0, sizeFormatted: '0 KB', files: [] };
  }
}

// 1. Overview stats
app.get('/api/database/overview', protect, async (req, res) => {
  try {
    const instId = req.user.instituteId;

    // Collection stats (active vs deleted)
    const [
      studentsActive, studentsDeleted, studentsWithPhoto,
      testsActive, testsDeleted,
      resultsActive, resultsDeleted, resultsWithOmr,
      attendanceActive, attendanceDeleted,
      sessionsActive, sessionsDeleted,
      inquiriesActive, inquiriesDeleted,
      smslogsActive, smslogsDeleted,
      notificationsActive
    ] = await Promise.all([
      Student.countDocuments({ instituteId: instId, isDeleted: { $ne: true } }),
      Student.countDocuments({ instituteId: instId, isDeleted: true }),
      Student.countDocuments({ instituteId: instId, isDeleted: { $ne: true }, photo: { $exists: true, $ne: '' } }),

      Test.countDocuments({ instituteId: instId, isDeleted: { $ne: true } }),
      Test.countDocuments({ instituteId: instId, isDeleted: true }),

      TestResult.countDocuments({ instituteId: instId, isDeleted: { $ne: true } }),
      TestResult.countDocuments({ instituteId: instId, isDeleted: true }),
      TestResult.countDocuments({ instituteId: instId, isDeleted: { $ne: true }, omrSheetImage: { $exists: true, $ne: '' } }),

      Attendance.countDocuments({ instituteId: instId, isDeleted: { $ne: true } }),
      Attendance.countDocuments({ instituteId: instId, isDeleted: true }),

      Session.countDocuments({ instituteId: instId, isDeleted: { $ne: true } }),
      Session.countDocuments({ instituteId: instId, isDeleted: true }),

      Inquiry.countDocuments({ instituteId: instId, isDeleted: { $ne: true } }),
      Inquiry.countDocuments({ instituteId: instId, isDeleted: true }),

      SMSLog.countDocuments({ instituteId: instId, isDeleted: { $ne: true } }),
      SMSLog.countDocuments({ instituteId: instId, isDeleted: true }),

      Notification.countDocuments({ instituteId: instId })
    ]);

    // Local Disk Media stats
    const omrFolder = path.join(dataPath, 'uploads', 'omr');
    const photosFolder = path.join(dataPath, 'uploads', 'photos');
    const avatarsFolder = path.join(dataPath, 'uploads', 'avatars');

    const omrMedia = getFolderMediaDetails(omrFolder);
    const photoMedia = getFolderMediaDetails(photosFolder);
    const avatarMedia = getFolderMediaDetails(avatarsFolder);

    const totalMediaBytes = omrMedia.sizeBytes + photoMedia.sizeBytes + avatarMedia.sizeBytes;
    const formatBytes = (bytes) => {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    res.json({
      collections: [
        { key: 'students', name: 'Students Directory', active: studentsActive, deleted: studentsDeleted, total: studentsActive + studentsDeleted, extra: `${studentsWithPhoto} with photo` },
        { key: 'tests', name: 'Tests & Exams', active: testsActive, deleted: testsDeleted, total: testsActive + testsDeleted },
        { key: 'testresults', name: 'OMR Test Results', active: resultsActive, deleted: resultsDeleted, total: resultsActive + resultsDeleted, extra: `${resultsWithOmr} OMR images` },
        { key: 'attendances', name: 'Attendance Records', active: attendanceActive, deleted: attendanceDeleted, total: attendanceActive + attendanceDeleted },
        { key: 'sessions', name: 'Class Sessions & Batches', active: sessionsActive, deleted: sessionsDeleted, total: sessionsActive + sessionsDeleted },
        { key: 'inquiries', name: 'Front Desk Inquiries', active: inquiriesActive, deleted: inquiriesDeleted, total: inquiriesActive + inquiriesDeleted },
        { key: 'smslogs', name: 'SMS & WhatsApp Logs', active: smslogsActive, deleted: smslogsDeleted, total: smslogsActive + smslogsDeleted },
        { key: 'notifications', name: 'System Notifications', active: notificationsActive, deleted: 0, total: notificationsActive }
      ],
      media: {
        omr: omrMedia,
        photos: photoMedia,
        avatars: avatarMedia,
        totalFiles: omrMedia.count + photoMedia.count + avatarMedia.count,
        totalSizeBytes: totalMediaBytes,
        totalSizeFormatted: formatBytes(totalMediaBytes)
      }
    });
  } catch (err) {
    console.error('Database overview error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Explore / List documents in a collection
app.get('/api/database/items/:collection', protect, async (req, res) => {
  try {
    const instId = req.user.instituteId;
    const { collection } = req.params;
    const filterType = req.query.filter || 'all'; // 'all' | 'active' | 'deleted'
    const search = (req.query.search || '').trim();

    let Model;
    switch (collection) {
      case 'students': Model = Student; break;
      case 'tests': Model = Test; break;
      case 'testresults': Model = TestResult; break;
      case 'attendances': Model = Attendance; break;
      case 'sessions': Model = Session; break;
      case 'inquiries': Model = Inquiry; break;
      case 'smslogs': Model = SMSLog; break;
      case 'notifications': Model = Notification; break;
      default: return res.status(400).json({ error: 'Invalid collection name' });
    }

    const query = { instituteId: instId };
    if (filterType === 'active') query.isDeleted = { $ne: true };
    else if (filterType === 'deleted') query.isDeleted = true;

    if (search) {
      const regex = new RegExp(search, 'i');
      if (collection === 'students') query.$or = [{ name: regex }, { rollNo: regex }, { phone: regex }, { parentPhone: regex }];
      else if (collection === 'tests') query.$or = [{ testName: regex }, { code: regex }, { subject: regex }];
      else if (collection === 'inquiries') query.$or = [{ studentName: regex }, { phone: regex }, { parentName: regex }];
      else if (collection === 'smslogs') query.$or = [{ recipient: regex }, { message: regex }];
    }

    const items = await Model.find(query).sort({ createdAt: -1, date: -1, _id: -1 }).limit(100);
    const totalCount = await Model.countDocuments(query);

    res.json({ collection, filterType, count: items.length, totalCount, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Permanently hard-delete a single document
app.delete('/api/database/item/:collection/:id', protect, async (req, res) => {
  try {
    const instId = req.user.instituteId;
    const { collection, id } = req.params;

    let Model;
    switch (collection) {
      case 'students': Model = Student; break;
      case 'tests': Model = Test; break;
      case 'testresults': Model = TestResult; break;
      case 'attendances': Model = Attendance; break;
      case 'sessions': Model = Session; break;
      case 'inquiries': Model = Inquiry; break;
      case 'smslogs': Model = SMSLog; break;
      case 'notifications': Model = Notification; break;
      default: return res.status(400).json({ error: 'Invalid collection name' });
    }

    const query = { instituteId: instId, $or: [{ _id: id }, { id }] };
    const doc = await Model.findOneAndDelete(query);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // Trigger cloud sync to propagate hard delete
    triggerBackgroundCloudSync();

    res.json({ message: 'Record permanently deleted successfully from local database and queued for cloud purge.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Purge soft-deleted trash records across DB or per collection
app.post('/api/database/purge-deleted', protect, async (req, res) => {
  try {
    const instId = req.user.instituteId;
    const { collection } = req.body;

    let deletedStats = {};

    if (!collection || collection === 'all' || collection === 'students') {
      const r = await Student.deleteMany({ instituteId: instId, isDeleted: true });
      deletedStats.students = r.deletedCount;
    }
    if (!collection || collection === 'all' || collection === 'tests') {
      const r = await Test.deleteMany({ instituteId: instId, isDeleted: true });
      deletedStats.tests = r.deletedCount;
    }
    if (!collection || collection === 'all' || collection === 'testresults') {
      const r = await TestResult.deleteMany({ instituteId: instId, isDeleted: true });
      deletedStats.testresults = r.deletedCount;
    }
    if (!collection || collection === 'all' || collection === 'attendances') {
      const r = await Attendance.deleteMany({ instituteId: instId, isDeleted: true });
      deletedStats.attendances = r.deletedCount;
    }
    if (!collection || collection === 'all' || collection === 'sessions') {
      const r = await Session.deleteMany({ instituteId: instId, isDeleted: true });
      deletedStats.sessions = r.deletedCount;
    }
    if (!collection || collection === 'all' || collection === 'inquiries') {
      const r = await Inquiry.deleteMany({ instituteId: instId, isDeleted: true });
      deletedStats.inquiries = r.deletedCount;
    }
    if (!collection || collection === 'all' || collection === 'smslogs') {
      const r = await SMSLog.deleteMany({ instituteId: instId, isDeleted: true });
      deletedStats.smslogs = r.deletedCount;
    }

    triggerBackgroundCloudSync();
    res.json({ message: 'Soft-deleted trash permanently purged from local database.', deletedStats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Wipe an entire collection
app.post('/api/database/wipe-collection', protect, async (req, res) => {
  try {
    const instId = req.user.instituteId;
    const { collection, confirmation } = req.body;

    if (confirmation !== 'WIPE') {
      return res.status(400).json({ error: 'Invalid confirmation token' });
    }

    let Model;
    switch (collection) {
      case 'students': Model = Student; break;
      case 'tests': Model = Test; break;
      case 'testresults': Model = TestResult; break;
      case 'attendances': Model = Attendance; break;
      case 'sessions': Model = Session; break;
      case 'inquiries': Model = Inquiry; break;
      case 'smslogs': Model = SMSLog; break;
      case 'notifications': Model = Notification; break;
      default: return res.status(400).json({ error: 'Invalid collection name' });
    }

    const r = await Model.deleteMany({ instituteId: instId });
    triggerBackgroundCloudSync();

    res.json({ message: `Successfully wiped ${r.deletedCount} records from '${collection}'.`, deletedCount: r.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Purge orphaned physical media files (OMR scans & photos not referenced in active DB)
app.post('/api/database/purge-orphaned-files', protect, async (req, res) => {
  try {
    const instId = req.user.instituteId;

    // Get all active image paths from DB
    const activeTestResults = await TestResult.find({ instituteId: instId, isDeleted: { $ne: true } }).select('omrSheetImage');
    const activeStudents = await Student.find({ instituteId: instId, isDeleted: { $ne: true } }).select('photo avatar');

    const referencedFiles = new Set();
    for (const r of activeTestResults) {
      if (r.omrSheetImage) referencedFiles.add(path.basename(r.omrSheetImage));
    }
    for (const s of activeStudents) {
      if (s.photo) referencedFiles.add(path.basename(s.photo));
      if (s.avatar) referencedFiles.add(path.basename(s.avatar));
    }

    let purgedCount = 0;
    let purgedBytes = 0;

    const folders = [
      path.join(dataPath, 'uploads', 'omr'),
      path.join(dataPath, 'uploads', 'photos'),
      path.join(dataPath, 'uploads', 'avatars')
    ];

    for (const folder of folders) {
      if (fs.existsSync(folder)) {
        const files = fs.readdirSync(folder);
        for (const file of files) {
          if (!referencedFiles.has(file)) {
            const filePath = path.join(folder, file);
            try {
              const stats = fs.statSync(filePath);
              purgedBytes += stats.size;
              fs.unlinkSync(filePath);
              purgedCount++;
            } catch (e) {}
          }
        }
      }
    }

    const formatBytes = (bytes) => {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    res.json({
      message: `Cleaned ${purgedCount} orphaned files (${formatBytes(purgedBytes)} freed).`,
      purgedCount,
      freedBytes: purgedBytes,
      freedFormatted: formatBytes(purgedBytes)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Delete individual physical media file
app.delete('/api/database/media-file', protect, async (req, res) => {
  try {
    const { folder, filename } = req.query;
    if (!folder || !filename) return res.status(400).json({ error: 'Folder and filename are required' });

    // Prevent directory traversal
    const safeFilename = path.basename(filename);
    const safeFolder = path.basename(folder);

    const filePath = path.join(dataPath, 'uploads', safeFolder, safeFilename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return res.json({ message: 'Media file deleted successfully from local storage.' });
    }
    res.status(404).json({ error: 'File not found on local disk' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Cloudinary OMR images inspection and stats
app.get('/api/database/cloudinary-stats', protect, async (req, res) => {
  try {
    const instId = req.user.instituteId;
    const allResults = await TestResult.find({ instituteId: instId, isDeleted: { $ne: true } });
    const tests = await Test.find({ instituteId: instId, isDeleted: { $ne: true } });
    const publishedTestIds = new Set(tests.filter(t => t.isPublished || t.status === 'published').map(t => String(t.id)));

    let cloudinaryImagesCount = 0;
    let publishedCloudinaryCount = 0;
    let unwantedOrphanCount = 0;
    const cloudinaryRecords = [];

    for (const r of allResults) {
      if (r.omrSheetImage && (r.omrSheetImage.includes('cloudinary.com') || r.omrSheetPublicId)) {
        cloudinaryImagesCount++;
        const isPublished = publishedTestIds.has(String(r.testId));
        if (isPublished) {
          publishedCloudinaryCount++;
        } else {
          unwantedOrphanCount++;
        }
        cloudinaryRecords.push({
          id: r._id,
          testId: r.testId,
          studentId: r.studentId,
          url: r.omrSheetImage,
          publicId: r.omrSheetPublicId,
          isPublished
        });
      }
    }

    res.json({
      configured: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
      cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'Not Configured',
      totalCloudinaryImages: cloudinaryImagesCount,
      publishedImages: publishedCloudinaryCount,
      unwantedOrphanImages: unwantedOrphanCount,
      records: cloudinaryRecords.slice(0, 50)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Purge unwanted / unpublished Cloudinary OMR images
app.post('/api/database/purge-cloudinary-unwanted', protect, async (req, res) => {
  try {
    const instId = req.user.instituteId;
    const tests = await Test.find({ instituteId: instId, isDeleted: { $ne: true } });
    const publishedTestIds = new Set(tests.filter(t => t.isPublished || t.status === 'published').map(t => String(t.id)));

    const results = await TestResult.find({ instituteId: instId, isDeleted: { $ne: true } });
    let deletedCount = 0;

    for (const r of results) {
      const isPublished = publishedTestIds.has(String(r.testId));
      if (!isPublished && r.omrSheetPublicId) {
        try {
          if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
            await cloudinary.uploader.destroy(r.omrSheetPublicId);
          }
          r.omrSheetImage = null;
          r.omrSheetPublicId = null;
          await r.save();
          deletedCount++;
        } catch (e) {
          console.error(`Error deleting Cloudinary image ${r.omrSheetPublicId}:`, e.message);
        }
      }
    }

    triggerBackgroundCloudSync();
    res.json({ message: `Successfully removed ${deletedCount} unpublished OMR images from Cloudinary.`, deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// --- 🎙️ AI VOICE CALLER & TELEPHONY API ---
// ==========================================

// 1. Synthesize Text to Hindi/English Neural MP3
app.post('/api/voice-ai/synthesize', async (req, res) => {
  try {
    const { text, voice } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Text parameter is required' });
    }
    const result = await synthesizeSpeech(text, voice || 'hi-IN-SwaraNeural');
    res.json(result);
  } catch (err) {
    console.error('Voice synthesis endpoint error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Process Two-way Voice Dialog Turn (Speech -> AI Reply Text + Audio URL)
app.post('/api/voice-ai/chat', async (req, res) => {
  try {
    const { userSpeech, sessionContext, conversationHistory } = req.body;
    const result = await processVoiceTurn({
      userSpeech: userSpeech || '',
      sessionContext: sessionContext || {},
      conversationHistory: conversationHistory || []
    });
    res.json(result);
  } catch (err) {
    console.error('Voice chat dialog turn error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Get Recent Voice Call Logs
app.get('/api/voice-ai/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = await getCallLogs(limit);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Save/Record Voice Call Session & Transcript
app.post('/api/voice-ai/log', async (req, res) => {
  try {
    const callData = req.body;
    if (!callData.phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }
    const savedLog = await saveCallLog(callData);
    res.json({ success: true, log: savedLog });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// --- 📄 TEST SERIES PDF GENERATION API ---
// ==========================================
app.post('/api/test-series/generate-pdf', async (req, res) => {
  try {
    const { examName, examId, totalQuestions, subjects, includeAnswerKey, includeSolutions, branding } = req.body;
    if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({ error: 'Subjects array is missing or empty' });
    }

    const pdfBuffer = await compilePdf({
      examName,
      examId,
      totalQuestions,
      subjects,
      includeAnswerKey,
      includeSolutions,
      branding
    });

    const safeName = (examName || 'Test').replace(/\s+/g, '_');
    const suffix = includeSolutions ? '_WithSolutions' : includeAnswerKey ? '_WithAnswerKey' : '_QuestionPaper';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="CareerXone_${safeName}${suffix}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (err) {
    console.error('Test Series PDF generation error:', err);
    res.status(500).json({ error: err.message || 'PDF Generation Failed' });
  }
});

// ==========================================
// --- 🌐 CLOUDFLARE ZERO-TRUST TUNNEL API ---
// ==========================================
app.get('/api/tunnel/status', (req, res) => {
  res.json({ success: true, ...getTunnelState() });
});

app.post('/api/tunnel/start', async (req, res) => {
  try {
    const result = await startCloudflareTunnel(PORT);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/tunnel/stop', (req, res) => {
  stopCloudflareTunnel();
  res.json({ success: true, status: 'stopped' });
});

app.get('*', (req, res) => {
  const indexLocations = [
    path.join(__dirname, '../dist/index.html'),
    path.join(__dirname, 'dist/index.html'),
    path.join(__dirname, 'public/index.html'),
    path.join(__dirname, '../public/index.html')
  ];

  for (const idxLoc of indexLocations) {
    if (fs.existsSync(idxLoc)) {
      let html = fs.readFileSync(idxLoc, 'utf8');
      const appParam = req.query.app || (req.path.includes('teacher') ? 'teacher' : req.path.includes('staff') ? 'staff' : req.path.includes('inquiry') ? 'inquiry' : 'parent');
      const targetManifest = `/manifest-${appParam}.json`;
      html = html.replace(/href="\/manifest[^"]*\.json"/g, `href="${targetManifest}"`);
      return res.type('html').send(html);
    }
  }

  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Career Xone Portal</title>
  <style>
    body { background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; }
    .card { background: #1e293b; padding: 30px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); max-width: 400px; }
    h2 { margin-top: 0; color: #38bdf8; }
    p { color: #94a3b8; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Career Xone Portal</h2>
    <p>Server is Synchronizing! Please refresh in 10 seconds.</p>
  </div>
</body>
</html>`);
});

// Start listening on all network interfaces (0.0.0.0)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server listening at http://0.0.0.0:${PORT} (LAN reachable at ${getLocalNetworkIp()}:${PORT})`);

  // Auto-start Cloudflare Tunnel for seamless 24/7 remote mobile access to Parent & Teacher app
  startCloudflareTunnel(PORT).catch((err) => {
    console.warn('[CloudflareTunnel] Notice:', err.message);
  });

  // Self-ping service to prevent free-tier spin down (every 10 minutes)
  // Only activate when running as a cloud server (not inside Electron desktop)
  const isElectronChild = !!process.env.ELECTRON_RUN_AS_NODE;
  const SELF_PING_URL = process.env.SELF_PING_URL || process.env.VITE_API_BASE_URL?.replace('/api', '') || '';
  if (SELF_PING_URL && !isElectronChild) {
    setInterval(() => {
      https.get(SELF_PING_URL, (res) => {
        console.log(`[Self-Ping] Pinged ${SELF_PING_URL} - Status: ${res.statusCode}`);
      }).on('error', (err) => {
        console.error('[Self-Ping] Error pinging:', err.message);
      });
    }, 10 * 60 * 1000);
  }
});

// SPA Wildcard Route Fallback: Any non-API route serves index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/') || req.path.startsWith('/iclock/') || req.path.endsWith('.aspx')) {
    return next();
  }
  const indexHtmlPaths = [
    path.join(__dirname, 'public', 'index.html'),
    path.join(__dirname, '../dist', 'index.html'),
    path.join(__dirname, 'dist', 'index.html')
  ];
  for (const p of indexHtmlPaths) {
    if (fs.existsSync(p)) {
      return res.sendFile(p);
    }
  }
  res.status(200).send('Career Xone Pro');
});

// Also bind secondary listener on port 8000 for Biomax FK Web Protocol
try {
  const biomaxServer = app.listen(8000, '0.0.0.0', () => {
    console.log(`📡 Biomax FK Push Receiver active on port 8000 (LAN: ${getLocalNetworkIp()}:8000)`);
  });
  biomaxServer.on('error', (e) => {
    // Port 8000 might be handled by proxy, ignore
  });
} catch (e) {}

// Also bind secondary listener on port 71 if free (to catch FK/Realtime biometric pushes)
try {
  const hwServer = app.listen(71, () => {
    console.log(`📟 Hardware Biometric Push Listener active on port 71`);
  });
  hwServer.on('error', (e) => {
    // Port 71 might be busy or restricted, ignore
  });
} catch (e) {}

// ---- 🕒 Auto-Backup Scheduler ----
let isSyncingAuto = false;
setInterval(async () => {
  if (isSyncingAuto) return;
  const now = new Date();
  let lastSync = null;
  const statusFile = path.join(__dirname, 'sync-status.json');
  
  if (fs.existsSync(statusFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(statusFile));
      if (data.lastSync) lastSync = new Date(data.lastSync);
    } catch(e) {}
  }

  const todayStr = now.toISOString().split('T')[0];
  const lastSyncStr = lastSync ? lastSync.toISOString().split('T')[0] : null;

  let shouldBackup = false;
  if (lastSyncStr !== todayStr) {
    if (now.getHours() >= 16) {
      shouldBackup = true; // 4:00 PM reached
    } else if (lastSync) {
      // If we missed yesterday completely (more than 24h ago), catch up now
      const msSinceLastSync = now - lastSync;
      if (msSinceLastSync > 24 * 60 * 60 * 1000) {
        shouldBackup = true;
      }
    }
  }

  if (shouldBackup) {
    isSyncingAuto = true;
    console.log('🔄 [Scheduler] Auto-Backup triggered...');
    try {
      triggerBackgroundCloudSync();
      fs.writeFileSync(statusFile, JSON.stringify({ lastSync: new Date().toISOString() }));
    } catch(e) {
      console.log(" Auto-Backup Error: ", e.message);
    } finally {
      isSyncingAuto = false;
    }
  }
}, 10 * 60 * 1000); // Check every 10 minutes
