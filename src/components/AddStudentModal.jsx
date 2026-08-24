import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { batches as fallbackBatches } from '../data/sampleData';
import { formatBatchName } from '../utils/helpers';

export default function AddStudentModal({ isEdit, studentData, onClose, onSave }) {
  const { students, batches = fallbackBatches } = useApp();

  // Dynamic list of batches from config + student records
  const dynamicBatches = React.useMemo(() => {
    const map = new Map();
    (batches || fallbackBatches || []).forEach(b => {
      if (b && (b.id || b.name)) {
        const id = b.id || b.name;
        map.set(id, { id, name: b.name || formatBatchName(id, batches) });
      }
    });
    (students || []).forEach(s => {
      const bVal = s.batch || s.targetClass;
      if (bVal && !map.has(bVal)) {
        map.set(bVal, { id: bVal, name: formatBatchName(bVal, batches) });
      }
    });
    return Array.from(map.values());
  }, [batches, students]);

  // Unique classes for suggestions
  const uniqueClasses = React.useMemo(() => {
    const classSet = new Set();
    ['8th', '9th', '10th', '11th', '12th', 'Dropper', 'Target', 'Foundation'].forEach(c => classSet.add(c));
    (students || []).forEach(s => {
      if (s.class && String(s.class).trim()) classSet.add(String(s.class).trim());
    });
    (batches || []).forEach(b => {
      if (b.class && String(b.class).trim()) classSet.add(String(b.class).trim());
    });
    return Array.from(classSet).filter(Boolean).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [students, batches]);

  const [form, setForm] = useState({
    name: '',
    rollNo: '',
    batch: dynamicBatches[0]?.id || 'batch-4',
    class: '',
    parentName: '',
    parentPhone: '',
    parentPhone2: '',
    address: '',
    photo: null,
    parentUserId: '',
    parentPassword: '',
    schoolName: '',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoGenerate, setIsAutoGenerate] = useState(false);

  useEffect(() => {
    if (isAutoGenerate && !isEdit) {
      // Find max roll number, starting from 1000
      let maxRoll = 999;
      if (students && students.length > 0) {
        students.forEach(s => {
          const rollInt = parseInt(s.rollNo, 10);
          if (!isNaN(rollInt) && rollInt > maxRoll) {
            maxRoll = rollInt;
          }
        });
      }
      setForm((prev) => ({ ...prev, rollNo: (maxRoll + 1).toString() }));
    } else if (!isAutoGenerate && !isEdit && !studentData) {
      setForm((prev) => ({ ...prev, rollNo: '' }));
    }
  }, [isAutoGenerate, students, isEdit, studentData]);

  useEffect(() => {
    if (isEdit && studentData) {
      setForm({
        name: studentData.name || '',
        rollNo: studentData.rollNo || '',
        batch: studentData.batch || batches[0]?.id || '',
        class: studentData.class || '',
        parentName: studentData.parentName || '',
        parentPhone: studentData.parentPhone || '',
        parentPhone2: studentData.parentPhone2 || '',
        address: studentData.address || '',
        photo: studentData.photo || null,
        parentUserId: studentData.parentUserId || '',
        parentPassword: '',
        schoolName: studentData.schoolName || '',
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      await onSave(form);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return createPortal(
    <AnimatePresence>
      <div className="modal-overlay" onClick={handleOverlayClick}>
        <motion.div
          className="modal-content"
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
                  <div style={{ position: 'relative', width: '110px', height: '110px' }}>
                    {form.photo ? (
                      <img 
                        src={form.photo} 
                        alt="Preview" 
                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--bg-card)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} 
                      />
                    ) : (
                      <label htmlFor="photo-upload" style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justify: 'center', color: 'var(--text-tertiary)', border: '2px dashed var(--border-color-light)', transition: 'all 0.3s ease', cursor: 'pointer' }}>
                        <Camera size={32} style={{ marginBottom: '4px', color: 'var(--accent-blue-light)' }} />
                        <span style={{ fontSize: '0.65rem', fontWeight: '500' }}>Upload Photo</span>
                      </label>
                    )}
                    <label 
                      htmlFor="photo-upload" 
                      style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'var(--accent-blue)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justify: 'center', color: 'white', cursor: 'pointer', boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)', transition: 'transform 0.2s ease', border: '2px solid var(--bg-card)' }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      title="Upload Photo"
                    >
                      <Camera size={16} />
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
                      style={{ background: 'rgba(220, 38, 38, 0.1)', color: 'var(--accent-red)', fontSize: '0.75rem', fontWeight: '600', padding: '4px 12px', borderRadius: '12px', marginTop: '12px', border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(220, 38, 38, 0.15)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(220, 38, 38, 0.1)'}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label className="form-label" style={{ marginBottom: 0 }}>Roll Number *</label>
                      {!isEdit && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input 
                            type="checkbox" 
                            id="auto-generate" 
                            checked={isAutoGenerate}
                            onChange={(e) => setIsAutoGenerate(e.target.checked)}
                            style={{ cursor: 'pointer' }}
                          />
                          <label htmlFor="auto-generate" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                            Auto Generate
                          </label>
                        </div>
                      )}
                    </div>
                    <input
                      type="text"
                      name="rollNo"
                      value={form.rollNo}
                      onChange={handleChange}
                      className="form-input"
                      placeholder="Enter roll number"
                      disabled={isAutoGenerate}
                      style={isAutoGenerate ? { background: 'var(--bg-tertiary)', cursor: 'not-allowed' } : {}}
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
                    <label className="form-label">Course / Batch</label>
                    <select
                      name="batch"
                      value={form.batch}
                      onChange={handleChange}
                      className="form-select"
                    >
                      {dynamicBatches.map((b) => (
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
                      list="available-classes-list"
                      value={form.class}
                      onChange={handleChange}
                      className="form-input"
                      placeholder="e.g. 12th"
                    />
                    <datalist id="available-classes-list">
                      {uniqueClasses.map((c, idx) => (
                        <option key={idx} value={c} />
                      ))}
                    </datalist>
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
                    <label className="form-label">Parent Phone 2 (Optional)</label>
                    <input
                      type="tel"
                      name="parentPhone2"
                      value={form.parentPhone2}
                      onChange={handleChange}
                      className="form-input"
                      placeholder="Enter second phone number"
                    />
                  </div>
                  <div className="form-group">
                    {/* Empty for spacing */}
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
                  <label className="form-label">School Name</label>
                  <input
                    type="text"
                    name="schoolName"
                    value={form.schoolName}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Enter school name"
                  />
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
              <button className="btn btn-primary" type="submit" form="student-form" disabled={isSubmitting} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                {isSubmitting ? 'Saving...' : (isEdit ? 'Update Student' : 'Add Student')}
              </button>
            </div>
          </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
