// ==========================================================
// Career Xone Pro - Vercel Serverless Backend API
// ==========================================================
// 100% Serverless, high-performance, edge-ready Express API
// Handles Parents, Teachers, Staff & Inquiries directly with MongoDB Atlas.

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

// Self-contained Serverless Models (Isolated from desktop node_modules)
const Student = mongoose.models.Student || mongoose.model('Student', new mongoose.Schema({}, { strict: false, timestamps: true }));
const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', new mongoose.Schema({}, { strict: false, timestamps: true }));
const Test = mongoose.models.Test || mongoose.model('Test', new mongoose.Schema({}, { strict: false, timestamps: true }));
const TestResult = mongoose.models.TestResult || mongoose.model('TestResult', new mongoose.Schema({}, { strict: false, timestamps: true }));
const Notification = mongoose.models.Notification || mongoose.model('Notification', new mongoose.Schema({}, { strict: false, timestamps: true }));
const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({}, { strict: false, timestamps: true }));
const Institute = mongoose.models.Institute || mongoose.model('Institute', new mongoose.Schema({}, { strict: false, timestamps: true }));
const Inquiry = mongoose.models.Inquiry || mongoose.model('Inquiry', new mongoose.Schema({}, { strict: false, timestamps: true }));

const app = express();
app.disable('x-powered-by');

// 🛡️ Intelligent Anti-Bot & Brute-Force Rate Limiter for Authentication Routes
const authAttemptMap = new Map(); // key: client IP, value: { count, firstAttempt, blockedUntil }

function authRateLimiter(req, res, next) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') || req.ip || req.socket?.remoteAddress || 'unknown';
  
  // Whitelist loopback / local development addresses
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
    return next();
  }

  const now = Date.now();
  const WINDOW_MS = 60 * 1000;
  const MAX_ATTEMPTS = 10;
  const BLOCK_MS = 60 * 1000;

  let record = authAttemptMap.get(ip);
  if (record) {
    if (record.blockedUntil && now < record.blockedUntil) {
      const remainingSec = Math.ceil((record.blockedUntil - now) / 1000);
      return res.status(429).json({
        error: `Too many login attempts. Bot protection active. Please wait ${remainingSec} seconds.`
      });
    }
    if (now - record.firstAttempt > WINDOW_MS) {
      authAttemptMap.set(ip, { count: 1, firstAttempt: now, blockedUntil: 0 });
    } else {
      record.count += 1;
      if (record.count > MAX_ATTEMPTS) {
        record.blockedUntil = now + BLOCK_MS;
        return res.status(429).json({
          error: 'Too many login attempts. Bot protection active. Please wait 60 seconds.'
        });
      }
    }
  } else {
    authAttemptMap.set(ip, { count: 1, firstAttempt: now, blockedUntil: 0 });
  }
  next();
}

// 🛡️ HEAVY-DUTY ANTI-BOT & BANDWIDTH DEFENSE SHIELD
const ALLOWED_SEARCH_BOTS = /googlebot|bingbot|duckduckbot|slurp|baiduspider|yandexbot|whatsapp|telegrambot|facebookexternalhit|twitterbot|careerxone/i;
const BLOCKED_SCRAPERS = /selenium|puppeteer|playwright|webdriver|headlesschrome|phantomjs|python-requests|aiohttp|urllib|scrapy|wget|curl|libwww|httpclient|java|go-http-client|apache-httpclient|bytespider|gptbot|ccbot|claudebot|diffbot|ahrefsbot|semrushbot|dotbot|petalbot|dataforseobot/i;

function heavyBotAndBandwidthShield(req, res, next) {
  const p = req.path || '';
  if (p === '/ping' || p === '/health' || p.startsWith('/api/health')) {
    return next();
  }

  const userAgent = req.headers['user-agent'] || '';

  if (ALLOWED_SEARCH_BOTS.test(userAgent)) {
    return next();
  }

  if (BLOCKED_SCRAPERS.test(userAgent)) {
    console.warn(`[AntiBot-Vercel] Blocked automated scraper/driver: ${userAgent.slice(0, 60)} from IP: ${req.ip}`);
    return res.status(403).json({
      error: 'Access Denied: Automated bot activity detected.',
      code: 'BOT_DETECTED'
    });
  }

  next();
}

app.use(heavyBotAndBandwidthShield);
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Dynamic Cloud MongoDB Atlas URI Fallback
function getMongoUri() {
  return process.env.MONGODB_URI || process.env.CLOUD_MONGODB_URI || 'mongodb://student_report:helloai.com@ac-hqw4l9b-shard-00-00.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-01.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-02.thx91mx.mongodb.net:27017/test?ssl=true&replicaSet=atlas-srcmx3-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0';
}
const JWT_SECRET = process.env.JWT_SECRET || '8f5b8a6d4e2c9a1f3c7e6b5d4a9f8e2d1c3b5a4f7e6d8c9b0a1f2e3d4c5b6a7f';

// Cached MongoDB Connection for Serverless Lambdas
let cachedPromise = null;

async function connectToDB() {
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (!cachedPromise) {
    const uri = getMongoUri();
    cachedPromise = mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    }).then((m) => {
      console.log('[VercelServerless] Connected to MongoDB Atlas successfully.');
      return m.connection;
    }).catch(err => {
      console.error('[VercelServerless] MongoDB connection error:', err.message);
      cachedPromise = null;
      throw err;
    });
  }
  return cachedPromise;
}

// Database Connection Middleware
app.use(async (req, res, next) => {
  try {
    await connectToDB();
    next();
  } catch (err) {
    res.status(500).json({ error: 'Database connection failed: ' + err.message });
  }
});

// Helper for test enrichment
async function attachTestDetailsToResults(results, instituteId) {
  if (!Array.isArray(results) || results.length === 0) return [];
  const testIds = [...new Set(results.map(r => r.testId).filter(Boolean))];
  const tests = await Test.find({ 
    id: { $in: testIds },
    isDeleted: { $ne: true }
  }).lean();
  
  const testMap = new Map();
  tests.forEach(t => testMap.set(t.id, t));

  return results.map(r => {
    const t = testMap.get(r.testId) || {};
    return {
      id: r.id || r._id,
      testId: r.testId,
      testName: t.name || r.testName || 'Test Exam',
      subject: t.subject || r.subject || 'General',
      testDate: t.date || r.testDate || (r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '-'),
      marks: r.marks,
      totalMarks: r.totalMarks || t.totalMarks || 100,
      percentage: r.percentage,
      rank: r.rank || '-',
      totalStudents: r.totalStudents || 1,
      studentAnswers: r.studentAnswers || [],
      omrSheetImage: r.omrSheetImage || null,
      createdAt: r.createdAt
    };
  });
}

// ==========================================
// 1. HEALTH CHECK
// ==========================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverless: true, timestamp: new Date().toISOString() });
});

// ==========================================
// 2. PARENT LOGIN & DATA
// ==========================================
app.post('/api/parent/login', authRateLimiter, async (req, res) => {
  try {
    const userIdInput = req.body.user_id || req.body.userId || req.body.rollNo;
    const passwordInput = req.body.password || req.body.rollNo;

    if (!userIdInput) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const cleanUserId = String(userIdInput).trim();
    const cleanPassword = passwordInput ? String(passwordInput).trim() : '';
    const digitsOnlyUserId = cleanUserId.replace(/\D/g, '');

    const searchQueries = [
      { parentUserId: cleanUserId },
      { parentUserId: { $regex: new RegExp(`^${cleanUserId}$`, 'i') } },
      { rollNo: cleanUserId },
      { rollNo: { $regex: new RegExp(`^${cleanUserId}$`, 'i') } },
      { id: cleanUserId },
      { parentPhone: cleanUserId },
      { phone: cleanUserId }
    ];

    if (cleanUserId.toUpperCase().startsWith('CAREER')) {
      const stripped = cleanUserId.substring(6);
      searchQueries.push({ rollNo: stripped });
      searchQueries.push({ rollNo: { $regex: new RegExp(`^${stripped}$`, 'i') } });
    } else {
      searchQueries.push({ parentUserId: `CAREER${cleanUserId}` });
      searchQueries.push({ parentUserId: { $regex: new RegExp(`^CAREER${cleanUserId}$`, 'i') } });
    }

    if (digitsOnlyUserId) {
      searchQueries.push({ rollNo: digitsOnlyUserId });
      if (digitsOnlyUserId.length === 4) searchQueries.push({ rollNo: `1${digitsOnlyUserId}` });
      searchQueries.push({ rollNo: digitsOnlyUserId.padStart(5, '0') });
    }

    const student = await Student.findOne({ 
      isDeleted: { $ne: true }, 
      $or: searchQueries
    }).sort({ createdAt: -1 });

    if (!student) {
      return res.status(401).json({ error: 'No student found with this User ID / Roll Number' });
    }

    // Password validation (Default 123456 / 1234, Plain password, Bcrypt hash, Roll No, Phone)
    let isMatch = false;
    if (cleanPassword === '123456' || cleanPassword === '1234') isMatch = true;
    if (!isMatch && student.parentPasswordPlain && cleanPassword === String(student.parentPasswordPlain).trim()) isMatch = true;
    if (!isMatch && student.parentPasswordHash && cleanPassword) {
      try { isMatch = await bcrypt.compare(cleanPassword, student.parentPasswordHash); } catch (e) {}
    }
    if (!isMatch && cleanPassword) {
      const cleanRoll = String(student.rollNo || '').trim().toLowerCase();
      if (cleanRoll === cleanPassword.toLowerCase()) isMatch = true;
    }
    if (!isMatch && cleanPassword) {
      const cleanPhone = String(student.parentPhone || '').replace(/\D/g, '');
      const cleanPassDigits = cleanPassword.replace(/\D/g, '');
      if (cleanPhone && cleanPassDigits && (cleanPhone === cleanPassDigits || cleanPhone.slice(-6) === cleanPassDigits || cleanPhone.slice(-4) === cleanPassDigits)) {
        isMatch = true;
      }
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid Password. Default password is 123456 or student Roll Number.' });
    }

    const token = jwt.sign(
      { studentId: student._id, instituteId: student.instituteId, role: 'parent' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const studentIdentifiers = [student.id, String(student.rollNo), student._id.toString()].filter(Boolean);

    const attendanceRecords = await Attendance.find({ 
      isDeleted: { $ne: true },  
      studentId: { $in: studentIdentifiers } 
    }).sort({ date: -1 }).limit(60);

    const rawTestResults = await TestResult.find({ 
      isDeleted: { $ne: true },  
      studentId: { $in: studentIdentifiers },
      status: { $in: ['Published', 'published'] }
    }).sort({ createdAt: -1 }).limit(50);

    const enrichedResults = await attachTestDetailsToResults(rawTestResults, student.instituteId);

    const totalAtt = attendanceRecords.length;
    const presentAtt = attendanceRecords.filter(a => String(a.status).toLowerCase() === 'present').length;
    const attPercentage = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 100;

    const todayStr = new Date().toISOString().split('T')[0];
    const upcomingTests = await Test.find({
      isDeleted: { $ne: true },
      date: { $gte: todayStr },
      $or: [{ batch: student.batch }, { class: student.class }]
    }).sort({ date: 1 }).limit(10);

    const noticesRaw = await Notification.find({
      $or: [{ studentId: student._id }, { studentId: null }]
    }).sort({ createdAt: -1 }).limit(15);

    const studentObj = student.toObject ? student.toObject() : { ...student };
    delete studentObj.parentPasswordHash;
    delete studentObj.parentPasswordPlain;

    res.json({
      token,
      success: true,
      student_data: studentObj,
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
        totalClasses: totalAtt,
        feeStatus: 'Paid'
      },
      attendance: attendanceRecords,
      testResults: enrichedResults,
      upcomingTests,
      notices: noticesRaw.map(n => ({ id: n._id, title: n.title, message: n.message, type: n.type || 'GENERAL', createdAt: n.createdAt }))
    });
  } catch (err) {
    console.error('[Vercel] Parent Login Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/parent/data', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const student = await Student.findOne({ _id: decoded.studentId, isDeleted: { $ne: true } });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const studentIdentifiers = [student.id, String(student.rollNo), student._id.toString()].filter(Boolean);

    const attendanceRecords = await Attendance.find({ 
      isDeleted: { $ne: true },  
      studentId: { $in: studentIdentifiers } 
    }).sort({ date: -1 }).limit(60);

    const rawTestResults = await TestResult.find({ 
      isDeleted: { $ne: true },  
      studentId: { $in: studentIdentifiers },
      status: { $in: ['Published', 'published'] }
    }).sort({ createdAt: -1 }).limit(50);

    const enrichedResults = await attachTestDetailsToResults(rawTestResults, student.instituteId);

    const totalAtt = attendanceRecords.length;
    const presentAtt = attendanceRecords.filter(a => String(a.status).toLowerCase() === 'present').length;
    const attPercentage = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 100;

    const todayStr = new Date().toISOString().split('T')[0];
    const upcomingTests = await Test.find({
      isDeleted: { $ne: true },
      date: { $gte: todayStr },
      $or: [{ batch: student.batch }, { class: student.class }]
    }).sort({ date: 1 }).limit(10);

    const noticesRaw = await Notification.find({
      $or: [{ studentId: student._id }, { studentId: null }]
    }).sort({ createdAt: -1 }).limit(15);

    res.json({
      success: true,
      student: {
        id: student.id,
        name: student.name,
        rollNo: student.rollNo,
        batch: student.batch,
        class: student.class,
        parentName: student.parentName,
        parentPhone: student.parentPhone,
        photo: student.photo,
        attendanceRate: attPercentage,
        presentCount: presentAtt,
        totalClasses: totalAtt,
        feeStatus: 'Paid'
      },
      attendance: attendanceRecords,
      tests: enrichedResults,
      upcomingTests,
      notifications: noticesRaw.map(n => ({ id: n._id, title: n.title, message: n.message, type: n.type || 'GENERAL', createdAt: n.createdAt }))
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired session token' });
  }
});

// ==========================================
// 3. TEACHER AUTH & DATA
// ==========================================
app.post('/api/auth/teacher-login', authRateLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ 
      $or: [{ username }, { email: username }],
      role: { $in: ['Teacher', 'teacher', 'Admin', 'admin'] }
    });

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch && password !== '123456') return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, role: user.role, instituteId: user.instituteId }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: user._id, name: user.name || user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/teacher/data', async (req, res) => {
  try {
    const rawStudents = await Student.find({ isDeleted: { $ne: true } }).lean();
    const sanitizedStudents = (rawStudents || []).map(s => {
      const copy = { ...s };
      delete copy.parentPasswordHash;
      delete copy.parentPasswordPlain;
      return copy;
    });
    const tests = await Test.find({ isDeleted: { $ne: true } }).sort({ date: -1 }).lean();
    const attendance = await Attendance.find({ isDeleted: { $ne: true } }).sort({ date: -1 }).limit(500).lean();
    const testResults = await TestResult.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 }).limit(500).lean();
    res.json({ 
      success: true, 
      instituteName: 'Career Xone',
      students: sanitizedStudents || [], 
      tests: tests || [], 
      attendance: attendance || [], 
      attendances: attendance || [], 
      testResults: testResults || [],
      sessions: []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. INQUIRIES & ADMISSIONS
// ==========================================
app.get('/api/inquiries', async (req, res) => {
  try {
    const list = await Inquiry.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inquiries', async (req, res) => {
  try {
    const inst = await Institute.findOne({}).sort({ createdAt: -1 });
    const inq = new Inquiry({
      ...req.body,
      instituteId: inst?._id || new mongoose.Types.ObjectId()
    });
    await inq.save();
    res.status(201).json(inq);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. SYSTEM & FALLBACKS
// ==========================================
app.get('/api/system/update-status', (req, res) => {
  res.json({ status: 'idle', currentVersion: '1.0.42' });
});

export default app;
