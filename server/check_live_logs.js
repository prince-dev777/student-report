import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

// Import Models
const StudentSchema = new mongoose.Schema({
  rollNo: String,
  name: String,
  parentPhone: String,
}, { strict: false });

const AttendanceSchema = new mongoose.Schema({
  studentId: String,
  date: String,
  status: String,
  entryTime: String,
  exitTime: String,
  smsSent: Boolean
}, { strict: false });

const SMSLogSchema = new mongoose.Schema({
  studentId: String,
  parentPhone: String,
  message: String,
  timestamp: String,
  status: String
}, { strict: false });

const Student = mongoose.model('Student', StudentSchema);
const Attendance = mongoose.model('Attendance', AttendanceSchema);
const SMSLog = mongoose.model('SMSLog', SMSLogSchema);

async function monitor() {
  console.log("Connecting to live MongoDB database...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected! Listening for live biometric punches...\n");

  let lastCountAttendance = await Attendance.countDocuments();
  let lastCountLogs = await SMSLog.countDocuments();

  console.log(`Current Total Attendance Records: ${lastCountAttendance}`);
  console.log(`Current Total WhatsApp Logs: ${lastCountLogs}`);
  console.log("\nWaiting for new events... (Press Ctrl+C to exit)\n");

  setInterval(async () => {
    try {
      const currentCountAttendance = await Attendance.countDocuments();
      if (currentCountAttendance > lastCountAttendance) {
        const newRecords = await Attendance.find().sort({ _id: -1 }).limit(currentCountAttendance - lastCountAttendance);
        for (const record of newRecords) {
          const student = await Student.findOne({ id: record.studentId });
          const studentName = student ? student.name : 'Unknown';
          const rollNo = student ? student.rollNo : 'N/A';
          console.log(`\x1b[32m[NEW ATTENDANCE]\x1b[0m Student: ${studentName} (Roll: ${rollNo}) | Date: ${record.date} | Entry: ${record.entryTime} | Exit: ${record.exitTime}`);
        }
        lastCountAttendance = currentCountAttendance;
      }

      const currentCountLogs = await SMSLog.countDocuments();
      if (currentCountLogs > lastCountLogs) {
        const newLogs = await SMSLog.find().sort({ _id: -1 }).limit(currentCountLogs - lastCountLogs);
        for (const log of newLogs) {
          const student = await Student.findOne({ id: log.studentId });
          const studentName = student ? student.name : 'Unknown';
          console.log(`\x1b[36m[WHATSAPP ALERT]\x1b[0m Sent to ${studentName}'s Parent (${log.parentPhone}) | Status: ${log.status.toUpperCase()} | Message: "${log.message.replace(/\n/g, ' ')}"`);
        }
        lastCountLogs = currentCountLogs;
      }
    } catch (err) {
      console.error("Error fetching logs:", err.message);
    }
  }, 3000);
}

monitor().catch(console.error);
