import mongoose from 'mongoose';

const testSchema = new mongoose.Schema({
  instituteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institute', required: true },
  id: { type: String, required: true },
  name: { type: String, required: true },
  subject: { type: String, required: true },
  date: { type: String, required: true },
  totalMarks: { type: Number, required: true },
  batch: { type: String, required: true },
  targetClass: { type: String },
  // Answer key: can be flat array ["A","B",...] or subject-wise { "Physics": ["A","B",...], "Chemistry": [...] }
  answerKey: { type: mongoose.Schema.Types.Mixed, default: [] },
  subjectMapping: { type: mongoose.Schema.Types.Mixed, default: [] },
  // Negative marking support (e.g., NEET: marksPerQuestion=4, negativeMarking=1)
  marksPerQuestion: { type: Number, default: 1 },
  negativeMarking: { type: Number, default: 0 },
  // OMR template configuration
  optionsPerQuestion: { type: Number, default: 4 },
  columns: { type: Number },
  rollNumberCols: { type: Number, default: 0 },
  templateConfig: { type: mongoose.Schema.Types.Mixed },
  templateId: { type: String },
  questionsToDetect: { type: Number },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });
// TTL Index for Soft Deletes (7 days = 604800 seconds)
testSchema.index({ deletedAt: 1 }, { expireAfterSeconds: 604800 });

export default mongoose.model('Test', testSchema);
