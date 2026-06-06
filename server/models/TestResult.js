import mongoose from 'mongoose';

const testResultSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  testId: { type: String, required: true },
  studentId: { type: String, required: true },
  marks: { type: Number, required: true },
  totalMarks: { type: Number, required: true },
  percentage: { type: Number, required: true },
  rank: { type: Number, required: true },
  totalStudents: { type: Number, required: true },
  smsSent: { type: Boolean, default: false }
}, { timestamps: true });

// Ensure unique result per student per test
testResultSchema.index({ testId: 1, studentId: 1 }, { unique: true });

export default mongoose.model('TestResult', testResultSchema);
