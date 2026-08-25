import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const localUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/student-report';

async function analyzeRolls() {
  const conn = await mongoose.createConnection(localUri).asPromise();
  const students = await conn.collection('students').find({ isDeleted: { $ne: true } }).toArray();
  
  const sample3 = students.filter(s => String(s.rollNo || '').trim().length === 3);
  console.log('3-digit students:', sample3.map(s => ({ name: s.name, roll: s.rollNo, id: s.id })));

  await conn.close();
}

analyzeRolls().then(() => process.exit(0));
