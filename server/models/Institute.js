import mongoose from 'mongoose';

const instituteSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  logo: { type: String }, // Base64 or URL
  subscriptionStatus: { type: String, default: 'active', enum: ['active', 'inactive', 'trial'] }
}, { timestamps: true });

export default mongoose.model('Institute', instituteSchema);
