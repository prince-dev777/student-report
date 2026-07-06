import mongoose from 'mongoose';

const testResultSchema = new mongoose.Schema({
  instituteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institute', required: true },
  id: { type: String, required: true },
  testId: { type: String, required: true },
  studentId: { type: String, required: true },
  marks: { type: Number, required: true },
  totalMarks: { type: Number, required: true },
  percentage: { type: Number, required: true },
  rank: { type: Number, default: null },
  totalStudents: { type: Number, default: null },
  smsSent: { type: Boolean, default: false },
  status: { type: String, enum: ['Draft', 'Published'], default: 'Draft' },
  studentAnswers: { type: [String], default: [] },
  omrSheetImage: { type: String, default: null }
}, { timestamps: true });

// Ensure unique result per student per test
testResultSchema.index({ testId: 1, studentId: 1 }, { unique: true });

export default mongoose.model('TestResult', testResultSchema);
