import mongoose from 'mongoose';

const staffAttendanceSchema = new mongoose.Schema({
  instituteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institute' },
  id: { type: String, required: true, default: () => `STAFF_ATT_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` },
  staffId: { type: String, required: true }, // e.g. "340"
  staffName: { type: String, default: 'Staff Member' },
  department: { type: String, default: 'General' },
  designation: { type: String, default: 'Staff' },
  date: { type: String, required: true }, // YYYY-MM-DD
  entryTime: { type: String, default: '--' }, // HH:MM AM/PM
  exitTime: { type: String, default: '--' },  // HH:MM AM/PM
  status: { type: String, default: 'present', enum: ['present', 'late', 'absent', 'half-day'] },
  durationMinutes: { type: Number, default: 0 },
  workHoursFormatted: { type: String, default: '0h 0m' },
  deviceSN: { type: String, default: 'Biomax Device' },
  deviceIp: { type: String, default: '' },
  verifyType: { type: String, default: 'Fingerprint' },
  source: { type: String, default: 'BIOMETRIC_PUSH' },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

staffAttendanceSchema.index({ staffId: 1, date: 1 }, { unique: true });

const StaffAttendance = mongoose.model('StaffAttendance', staffAttendanceSchema);
export default StaffAttendance;
