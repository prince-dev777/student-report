import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.production') });

const cloudUri = process.env.CLOUD_MONGODB_URI || 'mongodb://student_report:helloai.com@ac-hqw4l9b-shard-00-00.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-01.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-02.thx91mx.mongodb.net:27017/test?ssl=true&replicaSet=atlas-srcmx3-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0';

async function fix() {
  const conn = await mongoose.createConnection(cloudUri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000
  }).asPromise();

  const students = await conn.collection('students').find({ isDeleted: { $ne: true } }).toArray();
  const invalid = students.filter(s => String(s.rollNo || '').trim().length < 5);
  console.log('Found non-5-digit students:', invalid.map(s => ({ _id: s._id, name: s.name, rollNo: s.rollNo, parentUserId: s.parentUserId })));

  for (const s of invalid) {
    const raw = String(s.rollNo || '').trim();
    // Pad or prepend to make 5 digits (e.g. "101" -> "10101" or "1" + pad)
    let newRoll = raw;
    if (/^\d+$/.test(raw)) {
      newRoll = raw.padStart(4, '0');
      newRoll = '1' + newRoll; // 5 digits e.g. "10001" or "10101"
    } else {
      newRoll = '17999';
    }
    const newParentUserId = s.parentUserId ? s.parentUserId.replace(raw, newRoll) : `CAREER${newRoll}`;
    
    await conn.collection('students').updateOne(
      { _id: s._id },
      { 
        $set: { 
          rollNo: newRoll, 
          parentUserId: newParentUserId,
          parentPasswordPlain: newRoll
        } 
      }
    );
    console.log(`Updated student ${s.name} from roll "${raw}" -> "${newRoll}"`);
  }

  await conn.close();
  process.exit(0);
}

fix();
