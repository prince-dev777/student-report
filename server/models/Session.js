import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  instituteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institute', required: true },
  id: { type: String, required: true },
  name: { type: String, required: true },
  startTime: { type: String, required: true }, // Format HH:MM (24-hour)
  endTime: { type: String, required: true },   // Format HH:MM (24-hour)
  batchId: { type: String, default: 'all' }, // Specific Course/Batch ID or 'all'
  className: { type: String, default: 'all' }, // Specific Class name or 'all'
  batchIds: { type: [String], default: [] }, // Array of Course/Batch IDs
  targetClasses: { type: [String], default: [] }, // Array of Class names
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

// TTL Index for Soft Deletes (7 days = 604800 seconds)
sessionSchema.index({ deletedAt: 1 }, { expireAfterSeconds: 604800 });

export default mongoose.model('Session', sessionSchema);
