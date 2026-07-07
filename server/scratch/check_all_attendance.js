import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const AttendanceSchema = new mongoose.Schema({
  studentId: String,
  date: String,
  status: String,
  entryTime: String,
  exitTime: String,
}, { strict: false });

const StudentSchema = new mongoose.Schema({
  rollNo: String,
  name: String,
}, { strict: false });

async function check() {
  const uri = process.env.MONGODB_URI.replace('/edutrack', '/test');
  await mongoose.connect(uri);
  
  const Attendance = mongoose.model('Attendance', AttendanceSchema);
  const Student = mongoose.model('Student', StudentSchema);

  const attendanceRecords = await Attendance.find();
  console.log(`Found ${attendanceRecords.length} attendance records in database:`);
  
  for (const record of attendanceRecords) {
    const student = await Student.findOne({ id: record.studentId });
    const studentName = student ? student.name : 'Unknown';
    console.log(`- Student: ${studentName} | Date: ${record.date} | Status: ${record.status} | Entry: ${record.entryTime} | Exit: ${record.exitTime}`);
  }

  mongoose.disconnect();
}

check().catch(console.error);
