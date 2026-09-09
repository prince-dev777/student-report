import mongoose from 'mongoose';

const clientErrorLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  errorType: { 
    type: String, 
    default: 'UNCAUGHT_ERROR' 
  },
  message: { type: String, required: true },
  stack: { type: String, default: '' },
  componentStack: { type: String, default: '' },
  url: { type: String, default: '' },
  lastActions: { type: [mongoose.Schema.Types.Mixed], default: [] },
  userInfo: {
    userId: { type: String, default: null },
    username: { type: String, default: 'Anonymous' },
    role: { type: String, default: 'Admin' },
    instituteId: { type: String, default: null }
  },
  systemInfo: {
    userAgent: { type: String, default: '' },
    platform: { type: String, default: '' },
    isElectron: { type: Boolean, default: false },
    screenResolution: { type: String, default: '' },
    online: { type: Boolean, default: true }
  },
  isResolved: { type: Boolean, default: false }
}, { timestamps: true });

// Index for fast query of recent errors
clientErrorLogSchema.index({ createdAt: -1 });

// Auto-cleanup older logs after 30 days (2,592,000 seconds)
clientErrorLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

export default mongoose.model('ClientErrorLog', clientErrorLogSchema);
