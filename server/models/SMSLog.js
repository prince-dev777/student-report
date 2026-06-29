import mongoose from 'mongoose';

const smsLogSchema = new mongoose.Schema({
  instituteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institute', required: true },
  id: { type: String, required: true },
  type: { type: String, required: true },
  studentId: { type: String, required: true },
  parentPhone: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: String, required: true },
  status: { type: String, default: 'sent', enum: ['sent', 'delivered', 'failed'] }
}, { timestamps: true });

export default mongoose.model('SMSLog', smsLogSchema);
