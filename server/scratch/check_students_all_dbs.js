import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const StudentSchema = new mongoose.Schema({
  rollNo: String,
  name: String,
}, { strict: false });

async function checkDb(dbName) {
  const uri = process.env.MONGODB_URI.replace('/edutrack', `/${dbName}`);
  console.log(`Connecting to database "${dbName}"...`);
  const conn = await mongoose.createConnection(uri).asPromise();
  
  const StudentModel = conn.model('Student', StudentSchema);
  const students = await StudentModel.find();
  console.log(`Database "${dbName}" has ${students.length} students:`);
  students.forEach(s => {
    console.log(`- Name: "${s.name}" | Roll No: "${s.rollNo}" | ID: "${s.id}"`);
  });
  await conn.close();
  console.log("");
}

async function run() {
  await checkDb('edutrack');
  await checkDb('test');
}

run().catch(console.error);
