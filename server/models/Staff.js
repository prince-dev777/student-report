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
  role: { type: String, default: 'staff', enum: ['staff', 'teacher', 'faculty', 'admin', 'operator', 'other'] },
  status: { type: String, default: 'active', enum: ['active', 'inactive'] },
  photo: { type: String, default: null },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

// Pre-seed Prince Kumar if not exists
staffSchema.statics.ensureDefaultStaff = async function(instituteId = null) {
  try {
    let existing = await this.findOne({
      $or: [{ staffId: '340' }, { id: 'STAFF_340' }]
    });
    if (!existing) {
      existing = await this.create({
        instituteId: instituteId || null,
        id: 'STAFF_340',
        staffId: '340',
        name: 'Prince Kumar',
        designation: 'Software Engineer / Admin',
        department: 'Engineering',
        phone: '9876543210',
        role: 'admin',
        status: 'active',
        isDeleted: false
      });
      console.log('[Staff] Pre-seeded default employee: Prince Kumar (ID: 340)');
    } else if (existing.isDeleted || existing.status !== 'active') {
      existing.isDeleted = false;
      existing.status = 'active';
      await existing.save();
    }

    try {
      const { mirrorWrite } = await import('../db/syncEngine.js');
      if (typeof mirrorWrite === 'function') {
        mirrorWrite('staffs', existing.toObject ? existing.toObject() : existing).catch(() => {});
      }
    } catch (_) {}
  } catch (err) {
    console.warn('[Staff] Default staff init check:', err.message);
  }
};

const Staff = mongoose.model('Staff', staffSchema);
export default Staff;
