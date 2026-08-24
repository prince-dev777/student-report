import mongoose from 'mongoose';

const voiceCallLogSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    index: true
  },
  contactName: {
    type: String,
    default: 'Parent / Visitor'
  },
  studentName: {
    type: String,
    default: ''
  },
  studentRollNo: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    enum: ['absentee', 'inquiry', 'test-result', 'custom', 'simulation'],
    default: 'custom'
  },
  status: {
    type: String,
    enum: ['completed', 'connected', 'busy', 'no-answer', 'failed'],
    default: 'completed'
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: {
    type: Date,
    default: Date.now
  },
  durationSeconds: {
    type: Number,
    default: 0
  },
  transcript: [{
    speaker: {
      type: String,
      enum: ['ai', 'parent', 'user', 'system'],
      required: true
    },
    text: {
      type: String,
      required: true
    },
    time: {
      type: Date,
      default: Date.now
    }
  }],
  summary: {
    type: String,
    default: ''
  },
  recordingUrl: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const VoiceCallLog = mongoose.models.VoiceCallLog || mongoose.model('VoiceCallLog', voiceCallLogSchema);

export default VoiceCallLog;
