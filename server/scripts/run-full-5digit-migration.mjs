import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const localUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/student-report';
const cloudUri = process.env.CLOUD_MONGODB_URI || 'mongodb://student_report:helloai.com@ac-hqw4l9b-shard-00-00.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-01.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-02.thx91mx.mongodb.net:27017/test?ssl=true&replicaSet=atlas-srcmx3-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0';

async function migrateConnection(conn, label) {
  console.log(`\n======================================================`);
  console.log(`🚀 Executing 5-Digit Migration on [${label}]...`);
  console.log(`======================================================`);

  const studentColl = conn.collection('students');
  const attendanceColl = conn.collection('attendances');
  const testResultsColl = conn.collection('testresults');
  const usersColl = conn.collection('users');

  const allStudents = await studentColl.find({ isDeleted: { $ne: true } }).toArray();
  const fourDigitStudents = allStudents.filter(s => /^\d{4}$/.test(String(s.rollNo || '').trim()));
  
  console.log(`[${label}] Total Students: ${allStudents.length}`);
  console.log(`[${label}] 4-Digit Students to migrate: ${fourDigitStudents.length}`);

  if (fourDigitStudents.length === 0) {
    console.log(`✅ [${label}] All students are already 5-digit roll numbers!`);
    return;
  }

  const studentBulkOps = [];
  const attendanceBulkOps = [];
  const testResultBulkOps = [];
  const userBulkOps = [];

  for (const student of fourDigitStudents) {
    const rawRoll = String(student.rollNo || '').trim();
    const newRoll = '1' + rawRoll; // e.g. "4571" -> "14571", "8041" -> "18041"
    const newParentUserId = `CAREER${newRoll}`;
    const newParentPasswordPlain = newRoll;

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
        update: { $set: { rollNo: newRoll } }
      }
    });

    testResultBulkOps.push({
      updateMany: {
        filter: { $or: [{ studentId: rawRoll }, { rollNo: rawRoll }] },
        update: { $set: { rollNo: newRoll } }
      }
    });

    userBulkOps.push({
      updateMany: {
        filter: { username: student.parentUserId || `CAREER${rawRoll}` },
        update: { $set: { username: newParentUserId } }
      }
    });
  }

  console.log(`[${label}] Writing ${studentBulkOps.length} student updates...`);
  const sRes = await studentColl.bulkWrite(studentBulkOps, { ordered: false });
  console.log(`✅ [${label}] Students modified: ${sRes.modifiedCount}`);

  if (attendanceBulkOps.length > 0) {
    const aRes = await attendanceColl.bulkWrite(attendanceBulkOps, { ordered: false });
    console.log(`✅ [${label}] Attendances modified: ${aRes.modifiedCount}`);
  }

  if (testResultBulkOps.length > 0) {
    const tRes = await testResultsColl.bulkWrite(testResultBulkOps, { ordered: false });
    console.log(`✅ [${label}] Test Results modified: ${tRes.modifiedCount}`);
  }

  if (userBulkOps.length > 0) {
    const uRes = await usersColl.bulkWrite(userBulkOps, { ordered: false });
    console.log(`✅ [${label}] Users modified: ${uRes.modifiedCount}`);
  }

  // Verification
  const remaining4 = await studentColl.countDocuments({ isDeleted: { $ne: true }, rollNo: { $regex: /^\d{4}$/ } });
  const fiveDigitCount = await studentColl.countDocuments({ isDeleted: { $ne: true }, rollNo: { $regex: /^\d{5}$/ } });
  console.log(`📊 [${label}] Final Check -> 4-digit remaining: ${remaining4} | 5-digit total: ${fiveDigitCount}`);
}

async function run() {
  // 1. Migrate Local Database
  try {
    const localConn = await mongoose.createConnection(localUri).asPromise();
    await migrateConnection(localConn, 'Local MongoDB');
    await localConn.close();
  } catch (err) {
    console.error('❌ Local MongoDB Error:', err.message);
  }

  // 2. Migrate Cloud Database
  try {
    const cloudConn = await mongoose.createConnection(cloudUri).asPromise();
    await migrateConnection(cloudConn, 'Cloud MongoDB Atlas');
    await cloudConn.close();
  } catch (err) {
    console.error('❌ Cloud MongoDB Atlas Error:', err.message);
  }

  console.log('\n🎉 Complete 5-Digit Migration Done across all databases!\n');
}

run().then(() => process.exit(0));
