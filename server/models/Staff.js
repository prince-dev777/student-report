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

// Pre-seed Prince Kumar if not exists and not deleted
staffSchema.statics.ensureDefaultStaff = async function(instituteId = null) {
  try {
    const db = mongoose.connection.db;
    if (db) {
      const tomb = await db.collection('pending_tombstones').findOne({
        collectionName: 'staffs',
        $or: [{ staffId: '340' }, { customId: 'STAFF_340' }, { customId: '340' }]
      }).catch(() => null);
      if (tomb) {
        console.log('[Staff] Default employee #340 is permanently deleted (tombstone exists), skipping auto-seed.');
        return;
      }
    }

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
    }

    if (existing && !existing.isDeleted) {
      try {
        const { mirrorWrite } = await import('../db/syncEngine.js');
        if (typeof mirrorWrite === 'function') {
          mirrorWrite('staffs', existing.toObject ? existing.toObject() : existing).catch(() => {});
        }
      } catch (_) {}
    }
  } catch (err) {
    console.warn('[Staff] Default staff init check:', err.message);
  }
};

const Staff = mongoose.model('Staff', staffSchema);
export default Staff;
