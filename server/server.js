import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import https from 'https';
import multer from 'multer';
import { spawn, spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

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
import { protect } from './middleware/authMiddleware.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { sendWhatsAppAlert } from './services/whatsappService.js';

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://student_report:helloai.com@ac-hqw4l9b-shard-00-00.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-01.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-02.thx91mx.mongodb.net:27017/test?ssl=true&replicaSet=atlas-srcmx3-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0';
const JWT_SECRET = process.env.JWT_SECRET || '8f5b8a6d4e2c9a1f3c7e6b5d4a9f8e2d1c3b5a4f7e6d8c9b0a1f2e3d4c5b6a7f';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use('/iclock', express.text({ type: '*/*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

function generateServerId(prefix = 'ID') {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

function buildTestLookup(testId, instituteId) {
  const lookup = [{ id: String(testId) }];
  if (mongoose.Types.ObjectId.isValid(testId)) {
    lookup.push({ _id: testId });
  }
  return { instituteId, $or: lookup };
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
    ? await Test.find({ instituteId, id: { $in: testIds } })
    : [];
  const testsById = new Map(testDocs.map((test) => [test.id, test.toObject()]));

  return results.map((result) => ({
    ...result.toObject(),
    test: testsById.get(result.testId) || null,
  }));
}

// Multer setup for OMR image uploads
const uploadDir = path.join(__dirname, 'uploads', 'omr');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('🔌 Connected to MongoDB database.');

    // Migration: reconstruct parentPasswordPlain for existing students
    try {
      const students = await Student.find({
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
    } catch (err) {
      console.error('Error during password reconstruction migration:', err);
    }
  })
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ---- 🔐 Auth API ----
app.post('/api/auth/register', async (req, res) => {
  try {
    const { instituteName, adminName, username, password } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ username });
    if (userExists) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Create Institute
    const institute = new Institute({ name: instituteName });
    await institute.save();

    // Create Admin User
    const user = new User({
      instituteId: institute._id,
      name: adminName,
      username,
      password,
      role: 'owner'
    });
    await user.save();

    // Generate Token
    const token = jwt.sign(
      { id: user._id, username: user.username, instituteId: institute._id, instituteName: institute.name, logo: institute.logo },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({ token, username: user.username, instituteName: institute.name, logo: institute.logo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username }).populate('instituteId');
    if (user && (await user.comparePassword(password))) {
      const token = jwt.sign(
        { id: user._id, username: user.username, instituteId: user.instituteId._id, instituteName: user.instituteId.name, logo: user.instituteId.logo },
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
      institute.logo = logoBase64;
      await institute.save();
    }

    res.json({ message: 'Settings updated successfully', logo: institute.logo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/parent/login', async (req, res) => {
  try {
    const { user_id, password } = req.body;
    const student = await Student.findOne({ parentUserId: String(user_id) });
    if (!student || !student.parentPasswordHash) {
      return res.status(401).json({ error: 'Invalid User ID or Password' });
    }

    const isMatch = await bcrypt.compare(String(password), student.parentPasswordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid User ID or Password' });
    }

    const token = jwt.sign(
      { studentId: student._id, instituteId: student.instituteId, role: 'parent' },
      JWT_SECRET,
      { expiresIn: '7d' } // 7 days token expiration
    );

    res.json({ token, student_data: student });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// NOTE: Biometric webhook endpoint moved to line ~853 (before protect middleware)
// to avoid duplicate route registration.

// ---- 📡 Biometric ADMS API (Direct Machine Connection) ----

// 1. Initialization Request
app.get('/iclock/cdata', (req, res) => {
  res.send('OK');
});

// 2. Command Request
app.get('/iclock/getrequest', (req, res) => {
  res.send('OK');
});

// 3. Data Push Request (Raw Text)
app.post('/iclock/cdata', async (req, res) => {
  try {
    const rawData = req.body; // text/plain
    if (!rawData || typeof rawData !== 'string') return res.send('OK');

    const lines = rawData.split('\\n');
    let successCount = 0;

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      // Format: "user_id	YYYY-MM-DD HH:MM:SS	status	verify_type	work_code"
      const parts = line.split(/\\s+/);
      if (parts.length < 3) continue;

      const rollNumber = parts[0];
      const dateStr = parts[1]; // YYYY-MM-DD
      const timeStr = parts[2]; // HH:MM:SS

      let type = 'IN';
      // Usually status is at index 3. 0=IN, 1=OUT
      if (parts.length > 3 && parts[3] === '1') {
        type = 'OUT';
      }

      // Convert HH:MM:SS to HH:MM AM/PM
      let formattedTime = timeStr;
      if (timeStr.includes(':')) {
        const tParts = timeStr.split(':');
        let hours = parseInt(tParts[0], 10);
        const minutes = tParts[1];
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        formattedTime = hours.toString().padStart(2, '0') + ':' + minutes + ' ' + ampm;
      }

      // Find Student to get Institute ID
      const student = await Student.findOne({ rollNo: String(rollNumber) });
      if (!student) {
        console.warn(`[ADMS] Unrecognized Roll Number: ${rollNumber}`);
        continue;
      }

      const instituteId = student.instituteId;
      const today = dateStr;

      // Find or create attendance record
      let record = await Attendance.findOne({ studentId: student.id, date: today, instituteId });

      let isNewPunch = false;
      if (!record) {
        record = new Attendance({
          instituteId,
          studentId: student.id,
          date: today,
          status: 'present',
          entryTime: type === 'IN' ? formattedTime : '',
          exitTime: type === 'OUT' ? formattedTime : ''
        });
        isNewPunch = true;
      } else {
        if (type === 'IN' && (!record.entryTime || record.entryTime === '--')) {
          record.entryTime = formattedTime;
          isNewPunch = true;
        }
        if (type === 'OUT' && (!record.exitTime || record.exitTime === '--')) {
          record.exitTime = formattedTime;
          isNewPunch = true;
        }
      }

      if (isNewPunch) {
        await record.save();

        // Create Notification
        const title = type === 'IN' ? 'Check-In Alert' : 'Check-Out Alert';
        const message = `${student.name} has checked ${type} at ${formattedTime}.`;

        const notification = new Notification({
          instituteId,
          studentId: student._id,
          title,
          message,
          type: 'ATTENDANCE'
        });
        await notification.save();

        // Trigger WhatsApp
        if (student.parentPhone) {
          sendWhatsAppAlert({
            instituteId,
            studentId: student.id,
            parentPhone: student.parentPhone,
            studentName: student.name,
            type: type,
            detail: formattedTime
          }).catch(err => console.error('Failed to send ADMS WhatsApp alert:', err.message));
        }
        successCount++;
      }
    }
    
    console.log(`[ADMS] Successfully processed ${successCount} new attendance logs.`);
    res.send('OK');
  } catch (err) {
    console.error('[ADMS] Processing Error:', err);
    res.send('OK');
  }
});

// ---- 📞 Cloud WhatsApp Queue Endpoints (Token Authenticated) ----
app.get('/api/whatsapp/pending', async (req, res) => {
  const token = req.query.token || req.headers['x-whatsapp-token'];
  if (!token || token !== process.env.WHATSAPP_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized: Invalid WhatsApp token' });
  }

  try {
    const pendingLogs = await SMSLog.find({ status: 'pending' }).sort({ createdAt: 1 });
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

// ---- 🔐 Biometric Hardware Webhook (unprotected for hardware compatibility) ----
app.post('/api/attendance/biometric', async (req, res) => {
  try {
    const { instituteId, rollNumber, type, time } = req.body;
    if (!instituteId || !rollNumber) {
      return res.status(400).json({ error: 'Missing instituteId or rollNumber' });
    }

    const student = await Student.findOne({ rollNo: String(rollNumber), instituteId });
    if (!student) {
      return res.status(404).json({ error: `Student with Roll Number ${rollNumber} not found` });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const punchTime = time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    let record = await Attendance.findOne({ studentId: student.id, date: todayStr, instituteId });
    
    if (record) {
      if (type === 'IN') {
        record.entryTime = punchTime;
      } else {
        record.exitTime = punchTime;
      }
      record.status = 'present';
      await record.save();
    } else {
      record = new Attendance({
        studentId: student.id,
        date: todayStr,
        status: 'present',
        entryTime: type === 'IN' ? punchTime : '--',
        exitTime: type === 'OUT' ? punchTime : '--',
        instituteId,
        smsSent: false
      });
      await record.save();
    }

    if (student.parentPhone) {
      sendWhatsAppAlert({
        instituteId,
        studentId: student.id,
        parentPhone: student.parentPhone,
        studentName: student.name,
        type: type || 'IN',
        detail: punchTime
      }).then(() => {
        record.smsSent = true;
        record.save();
      }).catch(err => console.error('Failed to send biometric WhatsApp alert:', err.message));
    }

    res.json({ message: 'Biometric attendance successfully recorded', record });
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

    const student = await Student.findOne({ _id: studentId, instituteId });
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const studentKeys = [student.id, String(student._id)];
    const attendance = await Attendance.find({ studentId: { $in: studentKeys }, instituteId }).sort({ date: -1 });
    const resultDocs = await TestResult.find({
      studentId: student.id,
      instituteId,
      status: 'Published'
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

    const studentKeys = [student.id, String(student._id)];
    const attendance = await Attendance.find({ studentId: { $in: studentKeys }, instituteId: req.user.instituteId }).sort({ date: -1 });
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

    const resultDocs = await TestResult.find({
      studentId: student.id,
      instituteId: req.user.instituteId,
      status: 'Published'
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
    const students = await Student.find({ instituteId: req.user.instituteId }).sort({ createdAt: -1 });
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/students', async (req, res) => {
  try {
    const rollNo = req.body.rollNo;

    // Support custom parentUserId, fallback to rollNo (simple) or rollNo-random
    let parentUserId = req.body.parentUserId;
    if (!parentUserId || !parentUserId.trim()) {
      parentUserId = rollNo;
      const exists = await Student.findOne({ parentUserId: String(parentUserId) });
      if (exists) {
        const random4 = Math.floor(1000 + Math.random() * 9000); // 4 digits
        parentUserId = `${rollNo}-${random4}`;
      }
    } else {
      parentUserId = parentUserId.trim();
      const exists = await Student.findOne({ parentUserId: String(parentUserId) });
      if (exists) {
        return res.status(400).json({ error: 'This Parent User ID is already in use by another student!' });
      }
    }

    // Support custom parentPassword, fallback to rollNo (simple)
    let plainPassword = req.body.parentPassword;
    if (!plainPassword || !plainPassword.trim()) {
      plainPassword = rollNo;
    } else {
      plainPassword = plainPassword.trim();
    }

    const salt = await bcrypt.genSalt(10);
    const parentPasswordHash = await bcrypt.hash(plainPassword, salt);

    const student = new Student({
      ...req.body,
      instituteId: req.user.instituteId,
      id: generateServerId('STU'),
      parentUserId,
      parentPasswordHash,
      parentPasswordPlain: plainPassword
    });
    await student.save();

    const responseData = student.toObject();
    responseData.parentPlainPassword = plainPassword;

    res.status(201).json(responseData);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/students/:id/regenerate-parent', async (req, res) => {
  try {
    const student = await Student.findOne({ id: req.params.id, instituteId: req.user.instituteId });
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

    const responseData = student.toObject();
    responseData.parentPlainPassword = plainPassword;

    res.json(responseData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.put('/api/students/:id', async (req, res) => {
  try {
    const studentToUpdate = await Student.findOne({ id: req.params.id, instituteId: req.user.instituteId });
    if (!studentToUpdate) return res.status(404).json({ error: 'Student not found' });

    const updateData = { ...req.body };

    // Check parentUserId uniqueness if updated
    if (req.body.parentUserId && req.body.parentUserId.trim()) {
      const parentUserIdClean = req.body.parentUserId.trim();
      if (parentUserIdClean !== studentToUpdate.parentUserId) {
        const exists = await Student.findOne({ parentUserId: parentUserIdClean });
        if (exists) {
          return res.status(400).json({ error: 'This Parent User ID is already in use by another student!' });
        }
        updateData.parentUserId = parentUserIdClean;
      }
    }

    if (req.body.parentPassword && req.body.parentPassword.trim()) {
      const plainPassword = req.body.parentPassword.trim();
      const salt = await bcrypt.genSalt(10);
      updateData.parentPasswordHash = await bcrypt.hash(plainPassword, salt);
      updateData.parentPasswordPlain = plainPassword;
    }

    const student = await Student.findOneAndUpdate(
      { id: req.params.id, instituteId: req.user.instituteId },
      updateData,
      { new: true }
    );
    res.json(student);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/students/:id', async (req, res) => {
  try {
    const student = await Student.findOneAndDelete({ id: req.params.id, instituteId: req.user.instituteId });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    
    // Cascade delete associated records
    await Attendance.deleteMany({ studentId: req.params.id, instituteId: req.user.instituteId });
    await TestResult.deleteMany({ studentId: req.params.id, instituteId: req.user.instituteId });
    await SMSLog.deleteMany({ studentId: req.params.id, instituteId: req.user.instituteId });
    
    res.json({ message: 'Student and all associated records deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- 🔗 Biometric ADMS Relay / Proxy for Edofox ----
async function processBiometricPunch(rollNo, type, time) {
  try {
    const student = await Student.findOne({ rollNo: String(rollNo) });
    if (!student) {
      console.warn(`[ADMS Relay] Student with Roll Number ${rollNo} not found in DB.`);
      return;
    }

    const instituteId = student.instituteId;
    const todayStr = new Date().toISOString().split('T')[0];
    const punchTime = time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    let record = await Attendance.findOne({ studentId: student.id, date: todayStr, instituteId });
    
    if (record) {
      if (type === 'IN') {
        record.entryTime = punchTime;
      } else {
        record.exitTime = punchTime;
      }
      record.status = 'present';
      await record.save();
    } else {
      record = new Attendance({
        studentId: student.id,
        date: todayStr,
        status: 'present',
        entryTime: type === 'IN' ? punchTime : '--',
        exitTime: type === 'OUT' ? punchTime : '--',
        instituteId,
        smsSent: false
      });
      await record.save();
    }

    if (student.parentPhone) {
      await sendWhatsAppAlert({
        instituteId,
        studentId: student.id,
        parentPhone: student.parentPhone,
        studentName: student.name,
        type: type || 'IN',
        detail: punchTime
      });
      record.smsSent = true;
      await record.save();
    }
  } catch (err) {
    console.error('[ADMS Relay] Error saving log or sending WhatsApp:', err.message);
  }
}

app.all('/iclock/*', async (req, res) => {
  const targetUrl = `http://13.126.240.100:71${req.originalUrl}`;
  console.log(`[ADMS Relay] Relaying request to Edofox: ${req.method} ${targetUrl}`);
  
  try {
    // 1. If it's a cdata upload (POST) containing attendance logs, parse it!
    if (req.method === 'POST' && req.path.includes('/cdata')) {
      const tableName = req.query.table;
      
      if (tableName === 'ATTLOG' && req.body) {
        const bodyText = typeof req.body === 'string' ? req.body : req.body.toString();
        const lines = bodyText.split('\n');
        
        for (let line of lines) {
          line = line.trim();
          if (!line) continue;
          
          const parts = line.split('\t');
          if (parts.length >= 2) {
            const rollNo = parts[0].trim();
            const datetimeStr = parts[1].trim(); // "YYYY-MM-DD HH:MM:SS"
            const statusVal = parts[2] ? parts[2].trim() : '0';
            
            // Format time
            const timePart = datetimeStr.split(' ')[1] || '';
            let formattedTime = '';
            if (timePart) {
              const timeParts = timePart.split(':');
              if (timeParts.length >= 2) {
                let hours = parseInt(timeParts[0], 10);
                const minutes = timeParts[1];
                const ampm = hours >= 12 ? 'PM' : 'AM';
                hours = hours % 12;
                hours = hours ? hours : 12;
                formattedTime = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
              }
            }
            
            // Process punch
            processBiometricPunch(rollNo, statusVal === '1' ? 'OUT' : 'IN', formattedTime);
          }
        }
      }
    }

    // 2. Relay raw request to Edofox
    const headers = { ...req.headers };
    delete headers.host;

    const options = {
      method: req.method,
      headers
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      options.body = req.body;
    }

    const response = await fetch(targetUrl, options);
    const responseBody = await response.text();

    res.status(response.status);
    
    // Copy headers safely
    response.headers.forEach((value, key) => {
      res.set(key, value);
    });
    
    res.send(responseBody);

  } catch (err) {
    console.error(`[ADMS Relay] Error relaying request to Edofox:`, err.message);
    res.status(200).set('Content-Type', 'text/plain').send('OK');
  }
});

// ---- 🔐 Attendance API ----

app.get('/api/attendance', async (req, res) => {
  try {
    const records = await Attendance.find({ instituteId: req.user.instituteId });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/attendance', async (req, res) => {
  try {
    const { studentId, date, status, entryTime, exitTime, smsSent } = req.body;

    // Find if already exists for this institute
    let record = await Attendance.findOne({ studentId, date, instituteId: req.user.instituteId });
    if (record) {
      if (entryTime) record.entryTime = entryTime;
      if (exitTime) record.exitTime = exitTime;
      if (status) record.status = status;
      if (smsSent !== undefined) record.smsSent = smsSent;
      await record.save();
    } else {
      record = new Attendance({ ...req.body, instituteId: req.user.instituteId });
      await record.save();
    }

    // Trigger WhatsApp Absent Alert if status is absent and message has not been sent yet
    if ((status === 'absent' || status === 'Absent') && !record.smsSent) {
      const student = await Student.findOne({ id: studentId, instituteId: req.user.instituteId });
      if (student && student.parentPhone) {
        sendWhatsAppAlert({
          instituteId: req.user.instituteId,
          studentId: student.id,
          parentPhone: student.parentPhone,
          studentName: student.name,
          type: 'ABSENT',
          detail: date
        }).catch(err => console.error('Failed to send absent WhatsApp alert:', err.message));
        
        record.smsSent = true;
        await record.save();
      }
    }

    res.status(200).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---- 📝 Tests API ----
app.get('/api/tests', async (req, res) => {
  try {
    const tests = await Test.find({ instituteId: req.user.instituteId }).sort({ date: -1 });
    res.json(tests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tests', async (req, res) => {
  try {
    const test = new Test({ ...req.body, instituteId: req.user.instituteId });
    await test.save();
    res.status(201).json(test);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/tests/:id', async (req, res) => {
  try {
    const test = await Test.findOneAndUpdate(
      buildTestLookup(req.params.id, req.user.instituteId),
      { $set: req.body },
      { new: true }
    );
    if (!test) return res.status(404).json({ error: 'Test not found' });
    res.json(test);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/tests/:id', async (req, res) => {
  try {
    const test = await Test.findOneAndDelete(buildTestLookup(req.params.id, req.user.instituteId));
    if (!test) return res.status(404).json({ error: 'Test not found' });
    // Also delete all related test results
    await TestResult.deleteMany({ testId: test.id, instituteId: req.user.instituteId });
    res.json({ message: 'Test and associated results deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Re-grade all results for a test using its current answer key + marking scheme
app.post('/api/tests/:id/regrade', async (req, res) => {
  try {
    const test = await Test.findOne(buildTestLookup(req.params.id, req.user.instituteId));
    if (!test) return res.status(404).json({ error: 'Test not found' });

    // Build flat answer key from test
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

    if (flatAnswerKey.length === 0) {
      return res.status(400).json({ error: 'No answer key found for this test' });
    }

    const marksPerQ = test.marksPerQuestion || 1;
    const negMarks = test.negativeMarking || 0;

    // Fetch all results for this test that have studentAnswers
    const results = await TestResult.find({ testId: test.id, instituteId: req.user.instituteId });
    let regradedCount = 0;

    for (const result of results) {
      if (!result.studentAnswers || result.studentAnswers.length === 0) continue;

      let correct = 0;
      let wrong = 0;
      result.studentAnswers.forEach((ans, idx) => {
        const ansStr = String(ans).trim().toUpperCase();
        if (idx < flatAnswerKey.length && ansStr && ansStr !== 'NULL' && flatAnswerKey[idx]) {
          const corStr = String(flatAnswerKey[idx]).trim().toUpperCase();
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
      });

      const newMarks = Math.max(0, (correct * marksPerQ) - (wrong * negMarks));
      const newPercentage = Math.round((newMarks / test.totalMarks) * 1000) / 10;

      result.marks = newMarks;
      result.percentage = newPercentage;
      await result.save();
      regradedCount++;
    }

    // Recalculate ranks
    const allResults = await TestResult.find({ testId: test.id, instituteId: req.user.instituteId }).sort({ marks: -1 });
    for (let i = 0; i < allResults.length; i++) {
      allResults[i].rank = i + 1;
      allResults[i].totalStudents = allResults.length;
      await allResults[i].save();
    }

    res.json({ message: `Re-graded ${regradedCount} results successfully`, regradedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- 🏆 Test Results API ----
app.get('/api/test-results', async (req, res) => {
  try {
    const results = await TestResult.find({ instituteId: req.user.instituteId });
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/test-results/bulk', async (req, res) => {
  try {
    const results = req.body;
    const saved = [];

    for (const r of results) {
      const test = await Test.findOne(buildTestLookup(r.testId, req.user.instituteId));
      if (!test) {
        return res.status(404).json({ error: `Test not found for id ${r.testId}` });
      }

      // Check if updating existing result
      const filter = { testId: test.id, studentId: r.studentId, instituteId: req.user.instituteId };
      const updateData = {
        ...r,
        id: r.id || generateServerId('RES'),
        testId: test.id,
        totalMarks: r.totalMarks ?? test.totalMarks,
        percentage: r.percentage ?? Math.round((Number(r.marks) / test.totalMarks) * 1000) / 10,
        instituteId: req.user.instituteId
      };

      const record = await TestResult.findOneAndUpdate(filter, updateData, { upsert: true, new: true });
      saved.push(record);

      if (r.status === 'Published') {
        const student = await Student.findOne({ id: r.studentId, instituteId: req.user.instituteId });
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
                totalMarks: test.totalMarks,
                subject: test.subject,
                rank: r.rank,
                totalStudents: r.totalStudents
              }
            }).catch(err => console.error('Failed to send test result WhatsApp alert:', err.message));
          }
        }
      }
    }

    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/test-results/omr-process', upload.array('images', 500), async (req, res) => {
  try {
    const testId = req.body.testId;

    // Fetch test details for notification
    const test = await Test.findOne(buildTestLookup(testId, req.user.instituteId));
    if (!test) return res.status(404).json({ error: 'Test not found' });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    const imagePaths = req.files.map(file => file.path);
    const pythonScriptPath = path.join(__dirname, 'omr_engine_v2.py');

    // Use template ID and questions count from request (if changing on the fly) or from test document
    const templateId = req.body.templateId || test.templateId;
    const questionsToDetect = Number(req.body.questionsToDetect) || test.questionsToDetect || 0;

    // Save to temp JSON file to avoid OS argument length limits
    let answer_keys = {};
    if (Array.isArray(test.answerKey)) {
      let finalKey = test.answerKey;
      if (questionsToDetect > 0 && finalKey.length > questionsToDetect) {
        finalKey = finalKey.slice(0, questionsToDetect);
      }
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
    const jsonPayload = {
      image_paths: imagePaths,
      original_names: req.files.map(file => file.originalname),
      answer_keys: answer_keys,
      marks_per_question: test.marksPerQuestion || 1,
      negative_marking: test.negativeMarking !== undefined ? test.negativeMarking : 0
    };
    if (templateId) jsonPayload.template_id = templateId;
    if (template_config) jsonPayload.template_config = template_config;

    fs.writeFileSync(tempArgsPath, JSON.stringify(jsonPayload));

    let pythonProcess;
    const exePath = path.join(__dirname, 'omr_engine_v2.exe');
    
    if (fs.existsSync(exePath)) {
      // Spawn compiled executable directly
      pythonProcess = spawn(exePath, [tempArgsPath]);
    } else {
      let pythonCmd = process.env.PYTHON_CMD;
      if (!pythonCmd) {
        const python3Check = spawnSync('python3', ['--version']);
        pythonCmd = python3Check.error ? 'python' : 'python3';
      }
      // Spawn Python Process
      pythonProcess = spawn(pythonCmd, [pythonScriptPath, tempArgsPath]);
    }

    let pythonOutput = '';
    let pythonError = '';

    pythonProcess.stdout.on('data', (data) => {
      pythonOutput += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      pythonError += data.toString();
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

        const parsedData = [];
        const errors = [];

        for (let idx = 0; idx < results.length; idx++) {
          const r = results[idx];
          const imgPath = imagePaths[idx];

          if (r.error) {
            errors.push({ error: r.error, details: r.details || '', rollNumber: r.rollNumber || 'Unknown' });
            // safeUnlink(imgPath); // Delete failed image file
            continue;
          }

          // Find student by rollNumber, handling potential leading zeros from OMR scan
          const rollRaw = String(r.rollNumber);
          const rollIntStr = String(parseInt(rollRaw, 10));
          const student = await Student.findOne({ 
            $or: [ { rollNo: rollRaw }, { rollNo: rollIntStr } ],
            instituteId: req.user.instituteId 
          });
          if (student) {
            let studentAnswers = [];
            if (r.subjects) {
              const subjectNames = Object.keys(r.subjects).sort();
              for (const subj of subjectNames) {
                studentAnswers = studentAnswers.concat(r.subjects[subj]);
              }
            } else {
              studentAnswers = r.studentAnswers || [];
            }

            // Keep this image and construct relative static URL
            const webPath = '/uploads/omr/' + path.basename(imgPath);

            parsedData.push({
              studentId: student.id,
              mongoStudentId: student._id,
              studentName: student.name,
              rollNo: r.rollNumber,
              marks: r.totalMarks !== undefined ? r.totalMarks : (r.marks || 0),
              correctCount: r.correctCount,
              wrongCount: r.wrongCount,
              studentAnswers: studentAnswers,
              omrSheetImage: webPath
            });
          } else {
            errors.push({ error: 'Student not found in database', rollNumber: r.rollNumber });
            // safeUnlink(imgPath); // Delete image since no student matches
          }
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
    res.json(notification);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- 📱 SMS Logs API ----
app.get('/api/sms-logs', async (req, res) => {
  try {
    const logs = await SMSLog.find({ instituteId: req.user.instituteId }).sort({ createdAt: -1 });
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
    res.status(201).json(log);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/sms-logs/:id', async (req, res) => {
  try {
    const log = await SMSLog.findOneAndDelete({ _id: req.params.id, instituteId: req.user.instituteId });
    if (!log) return res.status(404).json({ error: 'SMS log not found' });
    res.json({ message: 'SMS log deleted successfully' });
  } catch (err) {
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
    res.json({ message: 'All database tables successfully cleared for your institute.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Root route - SaaS Landing Page
app.get('/', (req, res) => {
  const landingPageHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Career Xone Pro - Smart OMR & Biometric System</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      font-family: 'Outfit', sans-serif;
    }
    
    body {
      background: #0f172a;
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background-image: radial-gradient(circle at top right, rgba(59, 130, 246, 0.15), transparent 40%),
                        radial-gradient(circle at bottom left, rgba(16, 185, 129, 0.15), transparent 40%);
      position: relative;
      overflow: hidden;
    }
    
    .blob {
      position: absolute;
      width: 600px;
      height: 600px;
      background: linear-gradient(180deg, rgba(56, 189, 248, 0.1) 0%, rgba(59, 130, 246, 0.05) 100%);
      filter: blur(80px);
      border-radius: 50%;
      z-index: -1;
      top: -200px;
      right: -200px;
    }

    .container {
      max-width: 900px;
      padding: 40px;
      text-align: center;
      z-index: 10;
    }
    
    .badge {
      display: inline-block;
      padding: 8px 16px;
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.2);
      color: #38bdf8;
      border-radius: 50px;
      font-size: 0.9rem;
      font-weight: 600;
      margin-bottom: 24px;
      letter-spacing: 1px;
    }
    
    h1 {
      font-size: 4rem;
      font-weight: 800;
      line-height: 1.1;
      margin-bottom: 24px;
      background: linear-gradient(to right, #f8fafc, #94a3b8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    
    p.subtitle {
      font-size: 1.2rem;
      color: #94a3b8;
      margin-bottom: 48px;
      line-height: 1.6;
      max-width: 600px;
      margin-inline: auto;
    }
    
    .glass-panel {
      background: rgba(30, 41, 59, 0.5);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 24px;
      padding: 40px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 30px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    
    .download-btn {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 18px 40px;
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: white;
      text-decoration: none;
      font-size: 1.2rem;
      font-weight: 600;
      border-radius: 50px;
      transition: all 0.3s ease;
      box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .download-btn:hover {
      transform: translateY(-3px);
      box-shadow: 0 15px 35px -5px rgba(59, 130, 246, 0.6);
      background: linear-gradient(135deg, #60a5fa, #3b82f6);
    }
    
    .features {
      display: flex;
      justify-content: center;
      gap: 40px;
      margin-top: 20px;
      color: #cbd5e1;
      font-weight: 300;
    }
    
    .features div {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .icon-check {
      color: #10b981;
    }
    
    footer {
      margin-top: 60px;
      color: #64748b;
      font-size: 0.9rem;
    }
    
    @media (max-width: 768px) {
      h1 { font-size: 2.5rem; }
      .features { flex-direction: column; gap: 15px; }
    }
  </style>
</head>
<body>
  <div class="blob"></div>
  <div class="container">
    <div class="badge">DESKTOP APP NOW AVAILABLE</div>
    <h1>Career Xone Pro</h1>
    <p class="subtitle">Experience lightning-fast OMR scanning on your PC, seamlessly integrated with Biometric ADMS and automated WhatsApp alerts.</p>
    
    <div class="glass-panel">
      <!-- Link updated to point to Google Drive .exe -->
      <a href="https://drive.google.com/file/d/1zUJUDCCSyfvduGfNRmSN7Qi4iWRv6yve/view?usp=sharing" target="_blank" class="download-btn">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        Download for Windows (.exe)
      </a>
      
      <div class="features">
        <div><span class="icon-check">✔</span> Offline OMR Processing</div>
        <div><span class="icon-check">✔</span> Biometric Integration</div>
        <div><span class="icon-check">✔</span> Auto WhatsApp Alerts</div>
      </div>
    </div>
    
    <footer>
      &copy; ${new Date().getFullYear()} Career Xone. All rights reserved. <br>
      Cloud Server is Active & Synchronizing.
    </footer>
  </div>
</body>
</html>
  `;
  res.send(landingPageHtml);
});

// Start listening
app.listen(PORT, () => {
  console.log(`🚀 Server listening at http://localhost:${PORT}`);

  // Self-ping service to prevent Render free-tier spin down (every 10 minutes)
  const SELF_PING_URL = process.env.SELF_PING_URL || 'https://student-report-ezgw.onrender.com';
  if (SELF_PING_URL) {
    setInterval(() => {
      https.get(SELF_PING_URL, (res) => {
        console.log(`[Self-Ping] Pinged ${SELF_PING_URL} - Status: ${res.statusCode}`);
      }).on('error', (err) => {
        console.error('[Self-Ping] Error pinging:', err.message);
      });
    }, 10 * 60 * 1000);
  }
});
