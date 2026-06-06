import mongoose from 'mongoose';

const testSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  subject: { type: String, required: true },
  date: { type: String, required: true },
  totalMarks: { type: Number, required: true },
  batch: { type: String, required: true }
}, { timestamps: true });

export default mongoose.model('Test', testSchema);
