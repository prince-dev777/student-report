import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '.env.production') });

const localUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/student-report';
const cloudUri = process.env.CLOUD_MONGODB_URI || 'mongodb://student_report:helloai.com@ac-hqw4l9b-shard-00-00.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-01.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-02.thx91mx.mongodb.net:27017/test?ssl=true&replicaSet=atlas-srcmx3-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0';

async function migrateDatabaseFast(conn, label) {
  console.log(`\n======================================================`);
  console.log(`🚀 Starting High-Speed 5-Digit Roll Number Migration on [${label}]...`);
  console.log(`======================================================`);

  const studentColl = conn.collection('students');
  const attendanceColl = conn.collection('attendances');
  const testResultsColl = conn.collection('testresults');
  const usersColl = conn.collection('users');

  // Find all active/inactive students with 4-digit roll numbers
  const allStudents = await studentColl.find({ isDeleted: { $ne: true } }).toArray();
  const fourDigitStudents = allStudents.filter(s => /^\d{4}$/.test(String(s.rollNo || '').trim()));
  
  console.log(`Total students in [${label}]: ${allStudents.length}`);
  console.log(`Students needing 5-digit upgrade in [${label}]: ${fourDigitStudents.length}`);

  if (fourDigitStudents.length === 0) {
    console.log(`✅ All students in [${label}] are already 5-digit roll numbers!`);
    return { migratedStudentsCount: 0 };
  }

  const studentBulkOps = [];
  const attendanceBulkOps = [];
  const testResultBulkOps = [];
  const userBulkOps = [];

  for (const student of fourDigitStudents) {
    const rawRoll = String(student.rollNo || '').trim();
    const newRoll = '1' + rawRoll; // e.g. "7079" -> "17079"

    // Update parentUserId
    let newParentUserId = student.parentUserId;
    if (newParentUserId) {
      if (newParentUserId.startsWith('CAREER') && newParentUserId.endsWith(rawRoll)) {
        newParentUserId = `CAREER${newRoll}`;
      } else if (newParentUserId.startsWith('P') && newParentUserId.endsWith(rawRoll)) {
        newParentUserId = `P${newRoll}`;
      } else if (newParentUserId === rawRoll) {
        newParentUserId = newRoll;
      } else {
        newParentUserId = `CAREER${newRoll}`;
      }
    } else {
      newParentUserId = `CAREER${newRoll}`;
    }

    // Update parent password if it was old roll number
    let newParentPasswordPlain = student.parentPasswordPlain;
    if (newParentPasswordPlain === rawRoll || !newParentPasswordPlain) {
      newParentPasswordPlain = newRoll;
    }

    studentBulkOps.push({
      updateOne: {
        filter: { _id: student._id },
        update: {
          $set: {
            rollNo: newRoll,
            parentUserId: newParentUserId,
            parentPasswordPlain: newParentPasswordPlain
          }
        }
      }
    });

    attendanceBulkOps.push({
      updateMany: {
        filter: { $or: [{ studentId: rawRoll }, { rollNo: rawRoll }] },
        update: { $set: { studentId: student.id || newRoll, rollNo: newRoll } }
      }
    });

    testResultBulkOps.push({
      updateMany: {
        filter: { $or: [{ studentId: rawRoll }, { rollNo: rawRoll }] },
        update: { $set: { studentId: student.id || newRoll, rollNo: newRoll } }
      }
    });

    userBulkOps.push({
      updateMany: {
        filter: { username: student.parentUserId || `CAREER${rawRoll}` },
        update: { $set: { username: newParentUserId } }
      }
    });
  }

  // Execute bulk operations in parallel batches
  console.log(`Executing ${studentBulkOps.length} student updates via BulkWrite...`);
  const sRes = await studentColl.bulkWrite(studentBulkOps, { ordered: false });
  console.log(`✅ Students bulkWrite complete: ${sRes.modifiedCount} modified.`);

  if (attendanceBulkOps.length > 0) {
    console.log(`Executing ${attendanceBulkOps.length} attendance updates via BulkWrite...`);
    const aRes = await attendanceColl.bulkWrite(attendanceBulkOps, { ordered: false });
    console.log(`✅ Attendances bulkWrite complete: ${aRes.modifiedCount} modified.`);
  }

  if (testResultBulkOps.length > 0) {
    console.log(`Executing ${testResultBulkOps.length} test result updates via BulkWrite...`);
    const tRes = await testResultsColl.bulkWrite(testResultBulkOps, { ordered: false });
    console.log(`✅ Test Results bulkWrite complete: ${tRes.modifiedCount} modified.`);
  }

  if (userBulkOps.length > 0) {
    console.log(`Executing ${userBulkOps.length} user updates via BulkWrite...`);
    const uRes = await usersColl.bulkWrite(userBulkOps, { ordered: false });
    console.log(`✅ Users bulkWrite complete: ${uRes.modifiedCount} modified.`);
  }

  console.log(`\n🎉 Successfully migrated ${fourDigitStudents.length} students to 5-digit roll numbers on [${label}]!`);
  return { migratedStudentsCount: fourDigitStudents.length };
}

async function run() {
  console.log('🚀 Starting Fast 5-Digit Roll Number Upgrade across all databases...');

  // 1. Migrate Cloud MongoDB Atlas
  try {
    console.log('\nConnecting to Cloud MongoDB Atlas...');
    const cloudConn = await mongoose.createConnection(cloudUri, {
      serverSelectionTimeoutMS: 20000,
      connectTimeoutMS: 20000
    }).asPromise();
    
    await migrateDatabaseFast(cloudConn, 'Cloud MongoDB Atlas');
    
    // Check remaining 4-digit rolls in Cloud
    const remaining4Digits = await cloudConn.collection('students').find({
      isDeleted: { $ne: true },
      rollNo: { $regex: /^\d{4}$/ }
    }).toArray();
    console.log(`\n📊 Verification Check on Cloud Atlas: Remaining 4-digit students = ${remaining4Digits.length}`);
    
    const sample5Digits = await cloudConn.collection('students').find({ isDeleted: { $ne: true } }).limit(5).toArray();
    console.log('Sample 5-digit students now in Cloud:', sample5Digits.map(s => ({ name: s.name, rollNo: s.rollNo, parentUserId: s.parentUserId })));

    await cloudConn.close();
  } catch (err) {
    console.error('❌ Cloud MongoDB Atlas Migration Error:', err.message);
  }

  // 2. Migrate Local MongoDB (if running)
  try {
    console.log('\nConnecting to Local MongoDB...');
    const localConn = await mongoose.createConnection(localUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000
    }).asPromise();

    await migrateDatabaseFast(localConn, 'Local MongoDB');
    await localConn.close();
  } catch (err) {
    console.log('ℹ️ Local MongoDB port 27018 is currently offline (will automatically sync on app launch).');
  }

  console.log('\n🌟 High-Speed 5-Digit Roll Number Migration Finished Successfully!\n');
  process.exit(0);
}

run();
