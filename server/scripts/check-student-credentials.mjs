import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.production') });

const localUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/student-report';
const cloudUri = process.env.CLOUD_MONGODB_URI || 'mongodb://student_report:helloai.com@ac-hqw4l9b-shard-00-00.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-01.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-02.thx91mx.mongodb.net:27017/test?ssl=true&replicaSet=atlas-srcmx3-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0';

async function checkCredentials() {
  console.log('Connecting to Cloud MongoDB Atlas...');
  const cloudConn = await mongoose.createConnection(cloudUri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000
  }).asPromise();

  const students = await cloudConn.collection('students').find({ isDeleted: { $ne: true } }).limit(25).toArray();

  console.log(`\n======================================================`);
  console.log(`📋 CLOUD MONGO STUDENT CREDENTIALS AUDIT (Sample 25):`);
  console.log(`======================================================`);
  
  students.forEach((s, idx) => {
    console.log(`${idx + 1}. Student: "${s.name}"`);
    console.log(`   - Roll Number:   ${s.rollNo}`);
    console.log(`   - Parent UserID: ${s.parentUserId}`);
    console.log(`   - Password:      ${s.parentPasswordPlain || '(Hash: ' + (s.parentPasswordHash ? s.parentPasswordHash.substring(0, 15) + '...' : 'none') + ')'}`);
    console.log(`   - Phone:         ${s.parentPhone}`);
    console.log('------------------------------------------------------');
  });

  await cloudConn.close();
  process.exit(0);
}

checkCredentials().catch(e => { console.error(e); process.exit(1); });
