import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, Plus, Trash2, Loader2, Save, RotateCcw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';
import MultiClassSelect from './MultiClassSelect';

export default function EditTestModal({ test, onClose, onSave }) {
  const { batches, students } = useApp();

  const getInitialTargetClasses = () => {
    if (Array.isArray(test?.targetClasses) && test.targetClasses.length > 0) {
      return test.targetClasses;
    }
    if (test?.targetClass && typeof test.targetClass === 'string' && test.targetClass.trim() !== '') {
      return test.targetClass.split(',').map((c) => c.trim()).filter(Boolean);
    }
    return [];
  };

  const [form, setForm] = useState({
    name: test?.name || '',
    batch: test?.batch || '',
    targetClasses: getInitialTargetClasses(),
    targetClass: test?.targetClass || '',
    date: test?.date ? test.date.split('T')[0] : new Date().toISOString().split('T')[0],
    totalMarks: test?.totalMarks || 300,
    marksPerQuestion: test?.marksPerQuestion || 4,
    negativeMarking: test?.negativeMarking !== undefined ? test.negativeMarking : 1,
    templateId: test?.templateId || 'T1',
    questionsToDetect: test?.questionsToDetect || 75,
  });

  const [subjectMapping, setSubjectMapping] = useState(
    test?.subjectMapping && test.subjectMapping.length > 0
      ? JSON.parse(JSON.stringify(test.subjectMapping))
      : [
          { subject: 'Physics', fromQ: 1, toQ: 25 },
          { subject: 'Chemistry', fromQ: 26, toQ: 50 },
          { subject: 'Mathematics', fromQ: 51, toQ: 75 }
        ]
  );

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-calculate Total Marks and Questions to Detect when subject mapping or marks-per-question change
  useEffect(() => {
    let selectedQuestionsCount = 0;
    if (subjectMapping && subjectMapping.length > 0) {
      subjectMapping.forEach((m) => {
        if (m.fromQ && m.toQ) {
          const count = Number(m.toQ) - Number(m.fromQ) + 1;
          if (count > 0) selectedQuestionsCount += count;
        }
      });
    } else {
      selectedQuestionsCount = Number(form.questionsToDetect) || 0;
    }

    const mPerQ = Number(form.marksPerQuestion) || 0;
    const expectedTotal = selectedQuestionsCount * mPerQ;
    const nextQuestionsToDetect = selectedQuestionsCount;

    setForm((prev) => {
      if (prev.totalMarks !== expectedTotal || prev.questionsToDetect !== nextQuestionsToDetect) {
        return {
          ...prev,
          totalMarks: expectedTotal,
          questionsToDetect: nextQuestionsToDetect,
        };
      }
      return prev;
    });
  }, [subjectMapping, form.marksPerQuestion]);

  const handleTemplateChange = (tempId) => {
    let defaultDetect = 75;
    let defaultMarksPerQ = 4;
    let defaultNegMarks = 1;
    let defaultMapping = [];

    if (tempId === 'T1' || tempId === 'T2') {
      defaultDetect = 75; defaultMarksPerQ = 4; defaultNegMarks = 1;
      defaultMapping = [
        { subject: 'Physics', fromQ: 1, toQ: 25 },
        { subject: 'Chemistry', fromQ: 26, toQ: 50 },
        { subject: 'Mathematics', fromQ: 51, toQ: 75 }
      ];
    } else if (tempId === 'T3') {
      defaultDetect = 180; defaultMarksPerQ = 4; defaultNegMarks = 1;
      defaultMapping = [
        { subject: 'Physics', fromQ: 1, toQ: 45 },
        { subject: 'Chemistry', fromQ: 46, toQ: 90 },
        { subject: 'Biology', fromQ: 91, toQ: 180 }
      ];
    } else if (tempId === 'T4') {
      defaultDetect = 90; defaultMarksPerQ = 4; defaultNegMarks = 1;
      defaultMapping = [
        { subject: 'Biology', fromQ: 1, toQ: 90 }
      ];
    } else if (tempId === 'T5') {
      defaultDetect = 200; defaultMarksPerQ = 1; defaultNegMarks = 0;
      defaultMapping = [
        { subject: 'Physics', fromQ: 1, toQ: 50 },
        { subject: 'Chemistry', fromQ: 51, toQ: 100 },
        { subject: 'Mathematics', fromQ: 101, toQ: 150 },
        { subject: 'Biology', fromQ: 151, toQ: 200 }
      ];
    } else if (tempId === 'T6') {
      defaultDetect = 200; defaultMarksPerQ = 1; defaultNegMarks = 0;
      defaultMapping = [
        { subject: 'Physics', fromQ: 1, toQ: 50 },
        { subject: 'Chemistry', fromQ: 51, toQ: 100 },
        { subject: 'Biology', fromQ: 101, toQ: 200 }
      ];
    } else if (tempId === 'T7') {
      defaultDetect = 50; defaultMarksPerQ = 4; defaultNegMarks = 1;
      defaultMapping = [
        { subject: 'General', fromQ: 1, toQ: 50 }
      ];
    }

    setForm((prev) => ({
      ...prev,
      templateId: tempId,
      questionsToDetect: defaultDetect,
      marksPerQuestion: defaultMarksPerQ,
      negativeMarking: defaultNegMarks,
    }));

    if (defaultMapping.length > 0) {
      setSubjectMapping(defaultMapping);
    }
  };

  const uniqueClasses = Array.from(new Set(students.map((s) => s.class))).filter(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Test Name is required');
    if (!form.batch) return toast.error('Please select a course');
    if (!form.totalMarks || form.totalMarks <= 0) return toast.error('Total Marks must be greater than 0');

    if (subjectMapping.length === 0) return toast.error('Please add at least one subject mapping');
    const hasInvalid = subjectMapping.some(
      (m) => !m.subject || !m.fromQ || !m.toQ || Number(m.fromQ) > Number(m.toQ)
    );
    if (hasInvalid) return toast.error('Please check all subject mapping questions (From Q <= To Q)');

    setIsSubmitting(true);
    try {
      await onSave({
        name: form.name.trim(),
        subject: subjectMapping.map((s) => s.subject).join(', '),
        subjectMapping,
        batch: form.batch,
        targetClasses: form.targetClasses || [],
        targetClass: Array.isArray(form.targetClasses) && form.targetClasses.length > 0 ? form.targetClasses.join(', ') : form.targetClass || '',
        date: form.date,
        totalMarks: Number(form.totalMarks),
        marksPerQuestion: Number(form.marksPerQuestion) || 1,
        negativeMarking: Number(form.negativeMarking) || 0,
        templateId: form.templateId || 'T1',
        questionsToDetect: Number(form.questionsToDetect) || 75,
      });
      onClose();
    } catch (err) {
      console.error('Failed to update test:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      <div
        className="modal-overlay"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '16px',
        }}
        onClick={onClose}
      >
        <motion.div
          className="card"
          style={{
            maxWidth: '650px',
            width: '100%',
            maxHeight: '92vh',
            overflowY: 'auto',
            background: 'var(--card-bg, #ffffff)',
            borderRadius: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            padding: '24px',
            border: '1px solid var(--border-color, #e2e8f0)',
          }}
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between pb-16 mb-16"
            style={{ borderBottom: '1px solid var(--border-color-light, #e2e8f0)' }}
          >
            <div className="flex items-center gap-10">
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                }}
              >
                <BookOpen size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>Edit Test Details</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)' }}>
                  Update test parameters, subject mapping, and marking rules.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary, #64748b)',
                cursor: 'pointer',
                padding: '6px',
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="form-group mb-16">
              <label className="form-label" style={{ fontWeight: '600', marginBottom: '6px', display: 'block' }}>
                Test Name *
              </label>
              <input
                type="text"
                className="form-input w-full"
                placeholder="e.g. Monthly Mock Test, Unit Test 1"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <div className="form-row mb-16" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '6px', display: 'block' }}>
                  Target Course *
                </label>
                <select
                  className="form-select w-full"
                  value={form.batch}
                  onChange={(e) => setForm((prev) => ({ ...prev, batch: e.target.value }))}
                  required
                >
                  <option value="">Select Course</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <MultiClassSelect
                availableClasses={uniqueClasses}
                selectedClasses={form.targetClasses || []}
                onChange={(selected) =>
                  setForm((prev) => ({
                    ...prev,
                    targetClasses: selected,
                    targetClass: selected.length > 0 ? selected.join(', ') : ''
                  }))
                }
                label="Target Classes (Optional)"
                placeholder="All Classes"
              />
            </div>

            <div className="form-row mb-16" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '6px', display: 'block' }}>
                  Date
                </label>
                <input
                  type="date"
                  className="form-input w-full"
                  value={form.date}
                  onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '6px', display: 'block' }}>
                  Default OMR Layout
                </label>
                <select
                  className="form-select w-full"
                  value={form.templateId}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                >
                  <option value="T1">T1 — JEE Main 75 (MCQ)</option>
                  <option value="T2">T2 — JEE Main 75 Mixed (MCQ + Numerical)</option>
                  <option value="T3">T3 — NEET 180 Questions (Physics/Chem/Bio)</option>
                  <option value="T4">T4 — NEET 90 Questions (Biology only)</option>
                  <option value="T5">T5 — MHCET 200 Maths</option>
                  <option value="T6">T6 — MHCET 200 Biology</option>
                  <option value="T7">T7 — OMR 50 Questions</option>
                </select>
              </div>
            </div>

            {/* Subject Mapping */}
            <div className="form-group mb-16">
              <div className="flex justify-between items-center mb-8">
                <label className="form-label" style={{ fontWeight: '600', margin: 0 }}>
                  Subject-Question Mapping *
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {subjectMapping.length > 0 && Number(subjectMapping[0].fromQ) > 1 && (
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => {
                        let curQ = 1;
                        const renumbered = subjectMapping.map((m) => {
                          const count = Number(m.toQ) >= Number(m.fromQ) ? (Number(m.toQ) - Number(m.fromQ) + 1) : 45;
                          const newFrom = curQ;
                          const newTo = curQ + count - 1;
                          curQ = newTo + 1;
                          return { ...m, fromQ: newFrom, toQ: newTo };
                        });
                        setSubjectMapping(renumbered);
                        setForm(prev => ({ ...prev, questionsToDetect: curQ - 1 }));
                        toast.success('Renumbered questions starting from Q1');
                      }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderColor: 'var(--primary-color)' }}
                    >
                      <RotateCcw size={14} /> Renumber from Q1
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      setSubjectMapping((prev) => [
                        ...prev,
                        {
                          subject: 'Physics',
                          fromQ: prev.length ? Number(prev[prev.length - 1].toQ) + 1 : 1,
                          toQ: '',
                        },
                      ]);
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
                  >
                    <Plus size={14} /> Add Subject
                  </button>
                </div>
              </div>

              <div
                style={{
                  maxHeight: '180px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: '8px',
                }}
              >
                <table className="data-table" style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-color, #f8fafc)' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>Subject</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left', width: '100px' }}>From Q</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left', width: '100px' }}>To Q</th>
                      <th style={{ padding: '6px 10px', width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjectMapping.map((mapping, idx) => (
                      <tr key={idx} style={{ borderTop: '1px solid var(--border-color-light, #f1f5f9)' }}>
                        <td style={{ padding: '4px 8px' }}>
                          <select
                            className="form-select w-full"
                            style={{ padding: '4px 8px', fontSize: '0.85rem', height: '30px' }}
                            value={mapping.subject}
                            onChange={(e) => {
                              const newMap = [...subjectMapping];
                              newMap[idx].subject = e.target.value;
                              setSubjectMapping(newMap);
                            }}
                          >
                            <option value="Physics">Physics</option>
                            <option value="Chemistry">Chemistry</option>
                            <option value="Mathematics">Mathematics</option>
                            <option value="Biology">Biology</option>
                            <option value="General">General</option>
                          </select>
                        </td>
                        <td style={{ padding: '4px 8px' }}>
                          <input
                            type="number"
                            className="form-input w-full"
                            style={{ padding: '4px 8px', fontSize: '0.85rem', height: '30px' }}
                            value={mapping.fromQ}
                            onChange={(e) => {
                              const newMap = [...subjectMapping];
                              newMap[idx].fromQ = Number(e.target.value);
                              setSubjectMapping(newMap);
                            }}
                            min="1"
                            required
                          />
                        </td>
                        <td style={{ padding: '4px 8px' }}>
                          <input
                            type="number"
                            className="form-input w-full"
                            style={{ padding: '4px 8px', fontSize: '0.85rem', height: '30px' }}
                            value={mapping.toQ}
                            onChange={(e) => {
                              const newMap = [...subjectMapping];
                              newMap[idx].toQ = Number(e.target.value);
                              setSubjectMapping(newMap);
                            }}
                            min="1"
                            required
                          />
                        </td>
                        <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ color: '#ef4444', background: 'transparent', padding: '4px', border: 'none', cursor: 'pointer' }}
                            onClick={() => {
                              setSubjectMapping((prev) => prev.filter((_, i) => i !== idx));
                            }}
                            title="Remove Subject"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {subjectMapping.length === 0 && (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-secondary, #64748b)' }}>
                          No subjects mapped. Please click &quot;Add Subject&quot;.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Marking Scheme */}
            <div className="form-row mb-16" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '6px', display: 'block' }}>
                  Marks per Correct Answer
                </label>
                <input
                  type="number"
                  className="form-input w-full"
                  placeholder="e.g. 4 for NEET/JEE"
                  min="1"
                  value={form.marksPerQuestion}
                  onChange={(e) => setForm((prev) => ({ ...prev, marksPerQuestion: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '6px', display: 'block' }}>
                  Negative Marking (per wrong)
                </label>
                <input
                  type="number"
                  className="form-input w-full"
                  placeholder="e.g. 1 for NEET/JEE"
                  min="0"
                  step="0.25"
                  value={form.negativeMarking}
                  onChange={(e) => setForm((prev) => ({ ...prev, negativeMarking: e.target.value }))}
                />
              </div>
            </div>

            {/* Total Marks & Questions Overview */}
            <div className="form-row mb-20" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '6px', display: 'block', color: 'var(--primary, #3b82f6)' }}>
                  Total Questions (Auto)
                </label>
                <input
                  type="number"
                  className="form-input w-full"
                  value={form.questionsToDetect}
                  readOnly
                  style={{ background: 'var(--surface-color, #f8fafc)', cursor: 'not-allowed', fontWeight: 'bold' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '6px', display: 'block', color: 'var(--primary, #3b82f6)' }}>
                  Total Marks (Auto)
                </label>
                <input
                  type="number"
                  className="form-input w-full"
                  value={form.totalMarks}
                  readOnly
                  style={{ background: 'var(--surface-color, #f8fafc)', cursor: 'not-allowed', fontWeight: 'bold' }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div
              className="flex justify-end gap-10 pt-16"
              style={{ borderTop: '1px solid var(--border-color-light, #e2e8f0)' }}
            >
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
