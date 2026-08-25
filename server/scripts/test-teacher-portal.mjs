import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.production') });

const localUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/student-report';
const cloudUri = process.env.CLOUD_MONGODB_URI;

async function run() {
  console.log('Testing Teacher API response locally and from Cloud...');
  
  // 1. Fetch from running local server
  try {
    const res = await fetch('http://127.0.0.1:5000/api/teacher/data');
    const data = await res.json();
    console.log('Local Server /api/teacher/data returned:');
    console.log(' - Students:', data.students?.length);
    console.log(' - Tests:', data.tests?.length);
    console.log(' - Attendances:', data.attendances?.length);
  } catch (e) {
    console.error('Local server fetch error:', e.message);
  }

  // 2. Direct Cloud DB inspection
  try {
    const cloudConn = await mongoose.createConnection(cloudUri, { serverSelectionTimeoutMS: 10000 });
    const Student = cloudConn.model('Student', new mongoose.Schema({}, { strict: false }));
    const User = cloudConn.model('User', new mongoose.Schema({}, { strict: false }));
    
    const count = await Student.countDocuments({ isDeleted: { $ne: true } });
    console.log('Cloud Atlas active students count:', count);

    const user = await User.findOne({ isDeleted: { $ne: true } });
    console.log('Cloud Atlas User instId:', user?.instituteId);

    const distinctInstIds = await Student.distinct('instituteId', { isDeleted: { $ne: true } });
    console.log('Distinct instituteIds on students:', distinctInstIds);

    await cloudConn.close();
  } catch (e) {
    console.error('Cloud DB error:', e.message);
  }

  process.exit(0);
}

run();
