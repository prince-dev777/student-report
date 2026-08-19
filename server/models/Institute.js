import mongoose from 'mongoose';

const instituteSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  logo: { type: String }, // Base64 or URL
  staffPasscode: { type: String, default: '1234' },
  teacherPasscode: { type: String, default: '1234' },
  inquiryPasscode: { type: String, default: '1234' },
  subscriptionStatus: { type: String, default: 'active', enum: ['active', 'inactive', 'trial'] },
  whatsappSessionData: { type: String, default: null }, // To store Base64 credentials for Baileys
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  notes: { type: String, default: '' }
}, { timestamps: true });
// TTL Index for Soft Deletes (7 days = 604800 seconds)
instituteSchema.index({ deletedAt: 1 }, { expireAfterSeconds: 604800 });

export default mongoose.model('Institute', instituteSchema);
