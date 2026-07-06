import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera } from 'lucide-react';
import { batches } from '../data/sampleData';

export default function AddStudentModal({ isEdit, studentData, onClose, onSave }) {
  const [form, setForm] = useState({
    name: '',
    rollNo: '',
    batch: batches[0]?.id || '',
    class: '',
    parentName: '',
    parentPhone: '',
    address: '',
    photo: null,
    parentUserId: '',
    parentPassword: '',
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isEdit && studentData) {
      setForm({
        name: studentData.name || '',
        rollNo: studentData.rollNo || '',
        batch: studentData.batch || batches[0]?.id || '',
        class: studentData.class || '',
        parentName: studentData.parentName || '',
        parentPhone: studentData.parentPhone || '',
        address: studentData.address || '',
        photo: studentData.photo || null,
        parentUserId: studentData.parentUserId || '',
        parentPassword: '',
      });
    }
  }, [isEdit, studentData]);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm((prev) => ({ ...prev, photo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setForm((prev) => ({ ...prev, photo: null }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'Name is required';
    if (!form.rollNo.trim()) newErrors.rollNo = 'Roll number is required';
    if (!form.parentPhone.trim()) newErrors.parentPhone = 'Phone number is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSave(form);
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <AnimatePresence>
      <div className="modal-overlay" onClick={handleOverlayClick}>
        <div className="modal-content">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {/* Header */}
            <div className="modal-header">
              <h3>{isEdit ? 'Edit Student' : 'Add New Student'}</h3>
              <button className="modal-close" onClick={onClose}>
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="modal-body">
              <form onSubmit={handleSubmit} id="student-form">
                {/* Photo Upload Section */}
                <div className="flex flex-col items-center mb-16">
                  <div style={{ position: 'relative', width: '90px', height: '90px' }}>
                    {form.photo ? (
                      <img 
                        src={form.photo} 
                        alt="Preview" 
                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-blue-light)' }} 
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justify: 'center', color: '#64748b', border: '1px dashed var(--border-color)' }}>
                        <Camera size={28} />
                      </div>
                    )}
                    <label 
                      htmlFor="photo-upload" 
                      style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--accent-blue)', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justify: 'center', color: 'white', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}
                      title="Upload Photo"
                    >
                      <Camera size={14} />
                      <input 
                        type="file" 
                        id="photo-upload" 
                        accept="image/*" 
                        onChange={handlePhotoChange} 
                        style={{ display: 'none' }} 
                      />
                    </label>
                  </div>
                  {form.photo && (
                    <button 
                      type="button" 
                      onClick={handleRemovePhoto} 
                      className="mt-8"
                      style={{ background: 'transparent', color: 'var(--accent-red)', fontSize: '0.78rem', fontWeight: '500' }}
                    >
                      Remove Photo
                    </button>
                  )}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Full Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      className="form-input"
                      placeholder="Enter student name"
                    />
                    {errors.name && (
                      <span className="form-error" style={{ color: 'var(--accent-red)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                        {errors.name}
                      </span>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Roll Number *</label>
                    <input
                      type="text"
                      name="rollNo"
                      value={form.rollNo}
                      onChange={handleChange}
                      className="form-input"
                      placeholder="Enter roll number"
                    />
                    {errors.rollNo && (
                      <span className="form-error" style={{ color: 'var(--accent-red)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                        {errors.rollNo}
                      </span>
                    )}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Batch</label>
                    <select
                      name="batch"
                      value={form.batch}
                      onChange={handleChange}
                      className="form-select"
                    >
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Class</label>
                    <input
                      type="text"
                      name="class"
                      value={form.class}
                      onChange={handleChange}
                      className="form-input"
                      placeholder="e.g. 12th"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Parent Name</label>
                    <input
                      type="text"
                      name="parentName"
                      value={form.parentName}
                      onChange={handleChange}
                      className="form-input"
                      placeholder="Enter parent name"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Parent Phone *</label>
                    <input
                      type="tel"
                      name="parentPhone"
                      value={form.parentPhone}
                      onChange={handleChange}
                      className="form-input"
                      placeholder="Enter phone number"
                    />
                    {errors.parentPhone && (
                      <span className="form-error" style={{ color: 'var(--accent-red)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                        {errors.parentPhone}
                      </span>
                    )}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Parent User ID (Optional)</label>
                    <input
                      type="text"
                      name="parentUserId"
                      value={form.parentUserId}
                      onChange={handleChange}
                      className="form-input"
                      placeholder="Leave blank to auto-generate"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Parent Password (Optional)</label>
                    <input
                      type="text"
                      name="parentPassword"
                      value={form.parentPassword}
                      onChange={handleChange}
                      className="form-input"
                      placeholder={isEdit ? "Leave blank to keep unchanged" : "Leave blank to auto-generate"}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Address</label>
                  <textarea
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    className="form-textarea"
                    placeholder="Enter address"
                    rows={3}
                  />
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="modal-footer">
              <button className="btn btn-ghost" type="button" onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" form="student-form">
                {isEdit ? 'Update Student' : 'Add Student'}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}
