import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema({
  instituteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institute', required: true },
  id: { type: String, required: true },
  name: { type: String, required: true },
  rollNo: { type: String, required: true },
  batch: { type: String, required: true },
  class: { type: String },
  parentName: { type: String },
  parentPhone: { type: String, required: true },
  address: { type: String },
  joinDate: { type: String },
  status: { type: String, default: 'active', enum: ['active', 'inactive'] },
  photo: { type: String, default: null }
}, { timestamps: true });

export default mongoose.model('Student', studentSchema);
