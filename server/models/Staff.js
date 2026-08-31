import mongoose from 'mongoose';

const staffSchema = new mongoose.Schema({
  instituteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Institute' },
  id: { type: String, required: true, unique: true },
  staffId: { type: String, required: true, unique: true }, // e.g. "340", "EMP101"
  name: { type: String, required: true },
  designation: { type: String, default: 'Staff / Faculty' },
  department: { type: String, default: 'General' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  role: { type: String, default: 'staff', enum: ['staff', 'teacher', 'admin', 'operator'] },
  status: { type: String, default: 'active', enum: ['active', 'inactive'] },
  photo: { type: String, default: null },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

// Pre-seed Prince Kumar if not exists
staffSchema.statics.ensureDefaultStaff = async function(instituteId = null) {
  try {
    const existing = await this.findOne({ staffId: '340' });
    if (!existing) {
      await this.create({
        instituteId: instituteId || null,
        id: 'STAFF_340',
        staffId: '340',
        name: 'Prince Kumar',
        designation: 'Software Engineer / Admin',
        department: 'Engineering',
        phone: '9876543210',
        role: 'admin',
        status: 'active'
      });
      console.log('[Staff] Pre-seeded default employee: Prince Kumar (ID: 340)');
    }
  } catch (err) {
    console.warn('[Staff] Default staff init check:', err.message);
  }
};

const Staff = mongoose.model('Staff', staffSchema);
export default Staff;
