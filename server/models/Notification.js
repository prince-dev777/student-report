import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  instituteId: { type: mongoose.Schema.Types.Mixed, required: true },
  studentId: { type: mongoose.Schema.Types.Mixed, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, default: 'ATTENDANCE' },
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
