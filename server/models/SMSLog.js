import mongoose from 'mongoose';

const smsLogSchema = new mongoose.Schema({
  instituteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institute', required: true },
  id: { type: String, required: true },
  type: { type: String, required: true },
  studentId: { type: String, required: true },
  parentPhone: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: String, required: true },
  status: { type: String, default: 'sent', enum: ['pending', 'sent', 'delivered', 'failed'] },
  attachment: {
    data: String,
    mimetype: String,
    filename: String
  },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

// TTL Index for Soft Deletes (7 days = 604800 seconds)
smsLogSchema.index({ deletedAt: 1 }, { expireAfterSeconds: 604800 });

export default mongoose.model('SMSLog', smsLogSchema);
