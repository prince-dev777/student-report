import mongoose from 'mongoose';

const inquirySchema = new mongoose.Schema({
  instituteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institute', required: true },
  id: { type: String, required: true },
  visitorName: { type: String, required: true },
  studentName: { type: String, required: true },
  contactNumber: { type: String, required: true },
  discussionDetails: { type: String },
  status: { type: String, default: 'Pending', enum: ['Pending', 'Resolved', 'Admitted', 'Rejected'] },
  date: { type: String, required: true }, // YYYY-MM-DD
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

// TTL Index for Soft Deletes (7 days = 604800 seconds)
inquirySchema.index({ deletedAt: 1 }, { expireAfterSeconds: 604800 });

export default mongoose.model('Inquiry', inquirySchema);
