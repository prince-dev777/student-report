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

const Student = mongoose.model('Student', StudentSchema);

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const students = await Student.find();
  console.log(`Registered students count in DB: ${students.length}`);
  students.forEach(s => {
    console.log(`- Name: "${s.name}" | Roll No: "${s.rollNo}" | ID: "${s.id}"`);
  });
  mongoose.disconnect();
}

check().catch(console.error);
