import mongoose from 'mongoose';
import os from 'os';

const messageLockSchema = new mongoose.Schema({
  lockKey: { type: String, required: true, unique: true, index: true },
  instituteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institute', default: null },
  studentId: { type: String, required: true, index: true },
  type: { type: String, required: true },
  sessionName: { type: String, default: 'General' },
  date: { type: String, required: true },
  lockedBy: { type: String, default: () => os.hostname() },
  status: { type: String, default: 'locked', enum: ['locked', 'sent', 'failed'] },
  createdAt: { type: Date, default: Date.now, expires: 86400 } // Auto-cleanup after 24 hours
}, { timestamps: true });

export default mongoose.models.MessageLock || mongoose.model('MessageLock', messageLockSchema);
