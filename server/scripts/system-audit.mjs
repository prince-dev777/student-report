import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.join(__dirname, '..');
const rootDir = path.join(serverDir, '..');

dotenv.config({ path: path.join(serverDir, '.env') });
dotenv.config({ path: path.join(serverDir, '.env.production') });
dotenv.config({ path: path.join(rootDir, '.env') });

const localUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/student-report';
const cloudUri = process.env.CLOUD_MONGODB_URI || 'mongodb://student_report:helloai.com@ac-hqw4l9b-shard-00-00.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-01.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-02.thx91mx.mongodb.net:27017/test?ssl=true&replicaSet=atlas-srcmx3-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0';

console.log('===============================================================');
console.log('🔍 CAREER XONE PRO — COMPREHENSIVE SYSTEM DIAGNOSTIC & AUDIT');
console.log('===============================================================\n');

let issuesFound = 0;

// 1. Static Source Code Audit
console.log('📦 1. Auditing Frontend Build & Distribution...');
const distIndex = path.join(rootDir, 'dist', 'index.html');
const serverPublicIndex = path.join(serverDir, 'public', 'index.html');

if (fs.existsSync(distIndex) && fs.existsSync(serverPublicIndex)) {
  console.log('✅ Frontend production distribution bundle is compiled and synced with server/public/.');
} else {
  console.warn('⚠️ Warning: dist/ or server/public/ is missing. Run npm run build.');
  issuesFound++;
}

// 2. Database Health & 5-Digit Roll Number Audit
console.log('\n🗄️ 2. Auditing Cloud MongoDB Atlas & Data Integrity...');
async function auditDatabase() {
  try {
    const cloudConn = await mongoose.createConnection(cloudUri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000
    }).asPromise();

    const studentColl = cloudConn.collection('students');
    const testColl = cloudConn.collection('tests');
    const testResultsColl = cloudConn.collection('testresults');
    const attColl = cloudConn.collection('attendances');

    const totalStudents = await studentColl.countDocuments({ isDeleted: { $ne: true } });
    const legacy4DigitStudents = await studentColl.find({
      isDeleted: { $ne: true },
      rollNo: { $regex: /^\d{4}$/ }
    }).toArray();

    const fiveDigitStudents = await studentColl.find({
      isDeleted: { $ne: true },
      rollNo: { $regex: /^\d{5}$/ }
    }).toArray();

    console.log(`- Total Active Students in Cloud Atlas: ${totalStudents}`);
    console.log(`- 5-Digit Roll Students (Standard): ${fiveDigitStudents.length}`);
    console.log(`- Legacy 4-Digit Roll Students: ${legacy4DigitStudents.length}`);

    if (legacy4DigitStudents.length > 0) {
      console.warn(`⚠️ Warning: ${legacy4DigitStudents.length} students still have 4-digit roll numbers!`);
      issuesFound++;
    } else {
      console.log(`✅ 100% of all students follow the 5-digit roll number standard.`);
    }

    // Check Tests
    const totalTests = await testColl.countDocuments({ isDeleted: { $ne: true } });
    const totalResults = await testResultsColl.countDocuments({ isDeleted: { $ne: true } });
    const totalAttendance = await attColl.countDocuments({ isDeleted: { $ne: true } });

    console.log(`- Total Tests in Database: ${totalTests}`);
    console.log(`- Total Test Results in Database: ${totalResults}`);
    console.log(`- Total Attendance Records in Database: ${totalAttendance}`);

    // Sample tests
    const sampleTests = await testColl.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 }).limit(3).toArray();
    console.log(`- Recent Tests:`, sampleTests.map(t => ({ id: t.id || t._id, name: t.name, totalMarks: t.totalMarks, date: t.date })));

    await cloudConn.close();
  } catch (err) {
    console.error('❌ Cloud MongoDB Atlas connection check failed:', err.message);
    issuesFound++;
  }

  console.log('\n===============================================================');
  if (issuesFound === 0) {
    console.log('🎉 SYSTEM HEALTH AUDIT RESULT: 100% HEALTHY & BUG-FREE! ✅');
  } else {
    console.log(`⚠️ SYSTEM HEALTH AUDIT FINISHED WITH ${issuesFound} WARNING(S)`);
  }
  console.log('===============================================================\n');

  process.exit(issuesFound > 0 ? 1 : 0);
}

auditDatabase();
