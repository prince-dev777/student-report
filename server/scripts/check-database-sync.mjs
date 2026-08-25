import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const localUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/student-report';
const cloudUri = process.env.CLOUD_MONGODB_URI || 'mongodb://student_report:helloai.com@ac-hqw4l9b-shard-00-00.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-01.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-02.thx91mx.mongodb.net:27017/test?ssl=true&replicaSet=atlas-srcmx3-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0';

async function check() {
  console.log('=== Checking Cloud MongoDB Atlas ===');
  try {
    const cloudConn = await mongoose.createConnection(cloudUri).asPromise();
    const totalCloud = await cloudConn.collection('students').countDocuments({ isDeleted: { $ne: true } });
    console.log('Cloud Atlas Total Active Students:', totalCloud);

    const jayInCloud = await cloudConn.collection('students').find({ name: /JAY N LILHARE/i }).toArray();
    console.log('Cloud JAY N LILHARE:', jayInCloud.map(s => ({ name: s.name, rollNo: s.rollNo, id: s.id, parentUserId: s.parentUserId })));

    const fourDigitCloud = await cloudConn.collection('students').find({ 
      isDeleted: { $ne: true },
      rollNo: { $regex: /^\d{4}$/ } 
    }).toArray();
    console.log('Cloud 4-digit count:', fourDigitCloud.length);
    if (fourDigitCloud.length > 0) {
      console.log('Cloud 4-digit sample:', fourDigitCloud.slice(0, 5).map(s => ({ name: s.name, rollNo: s.rollNo })));
    }

    const fiveDigitCloud = await cloudConn.collection('students').find({ 
      isDeleted: { $ne: true },
      rollNo: { $regex: /^\d{5}$/ } 
    }).toArray();
    console.log('Cloud 5-digit count:', fiveDigitCloud.length);

    await cloudConn.close();
  } catch (err) {
    console.error('Cloud error:', err.message);
  }

  console.log('\n=== Checking Local MongoDB (port 27018 / 27017) ===');
  try {
    const localConn = await mongoose.createConnection(localUri).asPromise();
    const totalLocal = await localConn.collection('students').countDocuments({ isDeleted: { $ne: true } });
    console.log('Local MongoDB Total Active Students:', totalLocal);

    const jayInLocal = await localConn.collection('students').find({ name: /JAY N LILHARE/i }).toArray();
    console.log('Local JAY N LILHARE:', jayInLocal.map(s => ({ name: s.name, rollNo: s.rollNo, id: s.id, parentUserId: s.parentUserId })));

    const fourDigitLocal = await localConn.collection('students').find({ 
      isDeleted: { $ne: true },
      rollNo: { $regex: /^\d{4}$/ } 
    }).toArray();
    console.log('Local 4-digit count:', fourDigitLocal.length);
    if (fourDigitLocal.length > 0) {
      console.log('Local 4-digit sample:', fourDigitLocal.slice(0, 5).map(s => ({ name: s.name, rollNo: s.rollNo })));
    }

    await localConn.close();
  } catch (err) {
    console.log('Local MongoDB connection note:', err.message);
  }
}

check().then(() => process.exit(0));
