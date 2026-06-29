import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import https from 'https';

// Import Models
import Student from './models/Student.js';
import Attendance from './models/Attendance.js';
import Test from './models/Test.js';
import TestResult from './models/TestResult.js';
import SMSLog from './models/SMSLog.js';
import User from './models/User.js';
import Institute from './models/Institute.js';
import { protect } from './middleware/authMiddleware.js';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/edutrack')
  .then(() => console.log('🔌 Connected to MongoDB database.'))
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
      { id: user._id, username: user.username, instituteId: institute._id, instituteName: institute.name },
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '30d' }
    );

    res.status(201).json({ token, username: user.username, instituteName: institute.name });
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
        { id: user._id, username: user.username, instituteId: user.instituteId._id, instituteName: user.instituteId.name },
        process.env.JWT_SECRET || 'fallback_secret_key',
        { expiresIn: '30d' }
      );
      res.json({ token, username: user.username, instituteName: user.instituteId.name });
    } else {
      res.status(401).json({ error: 'Invalid username or password' });
    }
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
    const student = new Student({ ...req.body, instituteId: req.user.instituteId });
    await student.save();
    res.status(201).json(student);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/students/:id', async (req, res) => {
  try {
    const student = await Student.findOneAndUpdate(
      { id: req.params.id, instituteId: req.user.instituteId }, 
      req.body, 
      { new: true }
    );
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/students/:id', async (req, res) => {
  try {
    const student = await Student.findOneAndDelete({ id: req.params.id, instituteId: req.user.instituteId });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json({ message: 'Student deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
      const record = new TestResult({ ...r, instituteId: req.user.instituteId });
      await record.save();
      saved.push(record);
    }
    
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
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
    const log = new SMSLog({ ...req.body, instituteId: req.user.instituteId });
    await log.save();
    res.status(201).json(log);
  } catch (err) {
    res.status(400).json({ error: err.message });
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
      await Student.insertMany(students.map(s => ({...s, instituteId: instId})));
    }
    if (attendance && attendance.length > 0) {
      await Attendance.insertMany(attendance.map(a => ({...a, instituteId: instId})));
    }
    if (tests && tests.length > 0) {
      await Test.insertMany(tests.map(t => ({...t, instituteId: instId})));
    }
    if (testResults && testResults.length > 0) {
      await TestResult.insertMany(testResults.map(r => ({...r, instituteId: instId})));
    }
    if (smsHistory && smsHistory.length > 0) {
      await SMSLog.insertMany(smsHistory.map(h => ({...h, instituteId: instId})));
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

// Root route
app.get('/', (req, res) => {
  res.send('EduTrack Pro Backend API is running...');
});

// Start listening
app.listen(PORT, () => {
  console.log(`🚀 Server listening at http://localhost:${PORT}`);

  // Self-ping service to prevent Render free-tier spin down (every 10 minutes)
  const SELF_PING_URL = 'https://student-report-ezgw.onrender.com';
  setInterval(() => {
    https.get(SELF_PING_URL, (res) => {
      console.log(`[Self-Ping] Pinged ${SELF_PING_URL} - Status: ${res.statusCode}`);
    }).on('error', (err) => {
      console.error('[Self-Ping] Error pinging:', err.message);
    });
  }, 10 * 60 * 1000);
});
