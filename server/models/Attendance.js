import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  instituteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institute', required: true },
  id: { type: String, required: true },
  studentId: { type: String, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  status: { type: String, required: true, enum: ['present', 'absent', 'late', 'Present', 'Absent', 'Late', 'IN', 'OUT', 'ABSENT', 'UNMARKED'] },
  entryTime: { type: String }, // HH:MM
  exitTime: { type: String },  // HH:MM
  smsSent: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

// Ensure compound index for unique student per date
attendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });

// TTL Index for Soft Deletes (7 days = 604800 seconds)
attendanceSchema.index({ deletedAt: 1 }, { expireAfterSeconds: 604800 });

export default mongoose.model('Attendance', attendanceSchema);
