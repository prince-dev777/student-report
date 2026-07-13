import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema({
  instituteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institute',
    required: true,
  },
  serialNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  name: {
    type: String,
    trim: true,
    default: 'Biometric Machine'
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  lastSeen: {
    type: Date,
    default: null
  }
}, { timestamps: true });

export default mongoose.model('Device', deviceSchema);
