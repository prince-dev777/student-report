import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  studentId: { type: String, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  status: { type: String, required: true, enum: ['present', 'absent', 'late'] },
  entryTime: { type: String }, // HH:MM
  exitTime: { type: String },  // HH:MM
  smsSent: { type: Boolean, default: false }
}, { timestamps: true });

// Ensure compound index for unique student per date
attendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

export default mongoose.model('Attendance', attendanceSchema);
