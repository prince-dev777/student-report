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

// ---- 👨‍🎓 Students API ----
app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/students', async (req, res) => {
  try {
    const student = new Student(req.body);
    await student.save();
    res.status(201).json(student);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/students/:id', async (req, res) => {
  try {
    const student = await Student.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/students/:id', async (req, res) => {
  try {
    const student = await Student.findOneAndDelete({ id: req.params.id });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json({ message: 'Student deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- 🔐 Attendance API ----
app.get('/api/attendance', async (req, res) => {
  try {
    const records = await Attendance.find();
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/attendance', async (req, res) => {
  try {
    const { studentId, date, status, entryTime, exitTime, smsSent } = req.body;
    
    // Find if already exists
    let record = await Attendance.findOne({ studentId, date });
    if (record) {
      if (entryTime) record.entryTime = entryTime;
      if (exitTime) record.exitTime = exitTime;
      if (status) record.status = status;
      if (smsSent !== undefined) record.smsSent = smsSent;
      await record.save();
    } else {
      record = new Attendance(req.body);
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
    const tests = await Test.find().sort({ date: -1 });
    res.json(tests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tests', async (req, res) => {
  try {
    const test = new Test(req.body);
    await test.save();
    res.status(201).json(test);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---- 🏆 Test Results API ----
app.get('/api/test-results', async (req, res) => {
  try {
    const results = await TestResult.find();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/test-results/bulk', async (req, res) => {
  try {
    const results = req.body; // Array of results
    const saved = [];
    
    for (const r of results) {
      const record = new TestResult(r);
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
    const logs = await SMSLog.find().sort({ createdAt: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sms-logs', async (req, res) => {
  try {
    const log = new SMSLog(req.body);
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

    // Clear existing data
    await Student.deleteMany({});
    await Attendance.deleteMany({});
    await Test.deleteMany({});
    await TestResult.deleteMany({});
    await SMSLog.deleteMany({});

    // Bulk insert
    if (students && students.length > 0) await Student.insertMany(students);
    if (attendance && attendance.length > 0) await Attendance.insertMany(attendance);
    if (tests && tests.length > 0) await Test.insertMany(tests);
    if (testResults && testResults.length > 0) await TestResult.insertMany(testResults);
    if (smsHistory && smsHistory.length > 0) await SMSLog.insertMany(smsHistory);

    res.json({ message: 'Database successfully seeded with sample data!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- 🧹 Database Reset API ----
app.post('/api/reset', async (req, res) => {
  try {
    await Student.deleteMany({});
    await Attendance.deleteMany({});
    await Test.deleteMany({});
    await TestResult.deleteMany({});
    await SMSLog.deleteMany({});
    res.json({ message: 'All database tables successfully cleared.' });
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
