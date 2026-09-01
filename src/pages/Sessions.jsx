import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Plus, Trash2, Edit } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';
import { generateId } from '../utils/helpers';
import toast from 'react-hot-toast';
import MultiCourseSelect from '../components/MultiCourseSelect';
import MultiClassSelect from '../components/MultiClassSelect';

export default function Sessions() {
  const { sessions, setSessions, backendOnline, batches, students } = useApp();
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(null);
  
  const uniqueClasses = [...new Set((students || []).map((s) => s.class).filter(Boolean))].sort();

  // Auto-fetch latest sessions from database on mount
  React.useEffect(() => {
    let isMounted = true;
    api.getSessions().then((data) => {
      if (isMounted && Array.isArray(data) && data.length > 0) {
        setSessions(data);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [setSessions]);

  const [formData, setFormData] = useState({
    name: '',
    startTime: '',
    endTime: '',
    batchIds: [],
    targetClasses: []
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      ...formData,
      // Maintain backward compatibility for single-field consumers
      batchId: formData.batchIds.length === 1 ? formData.batchIds[0] : (formData.batchIds.length === 0 ? 'all' : formData.batchIds.join(',')),
      className: formData.targetClasses.length === 1 ? formData.targetClasses[0] : (formData.targetClasses.length === 0 ? 'all' : formData.targetClasses.join(','))
    };

    try {
      if (isEditing) {
        const sessionId = isEditing.id || isEditing._id;
        let updated = { ...isEditing, ...payload };
        if (backendOnline) {
          try {
            const res = await api.updateSession(sessionId, payload);
            if (res) updated = res;
          } catch (apiErr) {
            console.warn('API update failed, updating locally:', apiErr.message);
          }
        }
        setSessions(prev => prev.map(s => (s.id === updated.id || s._id === updated._id || (s.id && isEditing.id && s.id === isEditing.id) || (s._id && isEditing._id && s._id === isEditing._id)) ? updated : s));
        toast.success('Session updated successfully!');
      } else {
        const newSession = { ...payload, id: generateId('SESS') };
        let saved = newSession;
        if (backendOnline) {
          try {
            const res = await api.createSession(newSession);
            if (res) saved = res;
          } catch (apiErr) {
            console.warn('API create failed, saving locally:', apiErr.message);
          }
        }
        setSessions(prev => [...prev, saved]);
        toast.success('Session created successfully!');
      }
      setIsAdding(false);
      setIsEditing(null);
      setFormData({ name: '', startTime: '', endTime: '', batchIds: [], targetClasses: [] });
    } catch (err) {
      toast.error('Failed to save session: ' + (err.message || 'Error'));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this session?')) return;
    
    try {
      if (backendOnline) {
        try {
          await api.deleteSession(id);
        } catch (apiErr) {
          console.warn('API delete failed, removing locally:', apiErr.message);
        }
      }
      setSessions(prev => prev.filter(s => s.id !== id && s._id !== id));
      toast.success('Session deleted successfully!');
    } catch (err) {
      toast.error('Failed to delete session');
    }
  };

  const handleEdit = (session) => {
    setIsEditing(session);
    let bIds = [];
    if (Array.isArray(session.batchIds) && session.batchIds.length > 0) {
      bIds = session.batchIds;
    } else if (session.batchId && session.batchId !== 'all') {
      bIds = session.batchId.split(',').map(s => s.trim()).filter(Boolean);
    }

    let tClasses = [];
    if (Array.isArray(session.targetClasses) && session.targetClasses.length > 0) {
      tClasses = session.targetClasses;
    } else if (session.className && session.className !== 'all') {
      tClasses = session.className.split(',').map(s => s.trim()).filter(Boolean);
    }

    setFormData({
      name: session.name || '',
      startTime: session.startTime || '',
      endTime: session.endTime || '',
      batchIds: bIds,
      targetClasses: tClasses
    });
    setIsAdding(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="page-container"
    >
      <div className="page-header">
        <div>
          <h1 className="page-title">Session Management</h1>
          <p className="page-subtitle">Configure automated biometric punch-in sessions with multi-course & multi-class selection.</p>
        </div>
        {!isAdding && (
          <button className="btn btn-primary" onClick={() => {
            setIsEditing(null);
            setFormData({ name: '', startTime: '', endTime: '', batchIds: [], targetClasses: [] });
            setIsAdding(true);
          }}>
            <Plus size={20} />
            Add Session
          </button>
        )}
      </div>

      {isAdding && (
        <div className="card mb-4" style={{ border: '1.5px solid #93c5fd', boxShadow: '0 4px 16px rgba(59, 130, 246, 0.08)' }}>
          <div style={{ marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', margin: 0 }}>
              {isEditing ? '✏️ Edit Session Rule' : '➕ Create New Session Rule'}
            </h3>
            <p style={{ fontSize: '0.80rem', color: 'var(--text-secondary, #64748b)', margin: '2px 0 0' }}>
              Select target courses and classes. If none selected, the session applies to all students.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Row 1: Basic Timing Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Session Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input 
                  type="text" 
                  className="form-input"
                  required
                  placeholder="e.g., Morning Class, Self Study, Doubt Session"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Start Time (24-Hour) <span style={{ color: '#ef4444' }}>*</span></label>
                <input 
                  type="time" 
                  className="form-input"
                  required
                  value={formData.startTime}
                  onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>End Time (24-Hour) <span style={{ color: '#ef4444' }}>*</span></label>
                <input 
                  type="time" 
                  className="form-input"
                  required
                  value={formData.endTime}
                  onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                />
              </div>
            </div>

            {/* Row 2: Multi-Course & Multi-Class Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <MultiCourseSelect
                  availableBatches={batches}
                  selectedBatchIds={formData.batchIds}
                  onChange={(ids) => setFormData({ ...formData, batchIds: ids })}
                  label="Target Courses / Batches (Multi-Select)"
                  placeholder="All Courses"
                />
              </div>

              <div>
                <MultiClassSelect
                  availableClasses={uniqueClasses}
                  selectedClasses={formData.targetClasses}
                  onChange={(classes) => setFormData({ ...formData, targetClasses: classes })}
                  label="Target Classes (Multi-Select)"
                  placeholder="All Classes"
                />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
              <button 
                type="button" 
                className="btn btn-outline" 
                onClick={() => {
                  setIsAdding(false);
                  setIsEditing(null);
                  setFormData({ name: '', startTime: '', endTime: '', batchIds: [], targetClasses: [] });
                }}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" style={{ minWidth: '120px' }}>
                {isEditing ? 'Update Session' : 'Save Session'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="table-container card">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '22%' }}>Session Name</th>
              <th style={{ width: '45%' }}>Applies To</th>
              <th style={{ width: '13%' }}>Start Time</th>
              <th style={{ width: '13%' }}>End Time</th>
              <th style={{ width: '7%', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center py-4 text-muted">No sessions configured yet. Click "Add Session" to create one.</td>
              </tr>
            ) : (
              sessions.map(s => {
                const bIds = Array.isArray(s.batchIds) && s.batchIds.length > 0
                  ? s.batchIds
                  : (s.batchId && s.batchId !== 'all' ? s.batchId.split(',').map(x => x.trim()).filter(Boolean) : []);
                const cNames = Array.isArray(s.targetClasses) && s.targetClasses.length > 0
                  ? s.targetClasses
                  : (s.className && s.className !== 'all' ? s.className.split(',').map(x => x.trim()).filter(Boolean) : []);

                return (
                  <tr key={s.id}>
                    <td className="font-medium">
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="text-primary" />
                        <strong>{s.name}</strong>
                      </div>
                    </td>
                    <td>
                      {bIds.length === 0 && cNames.length === 0 ? (
                        <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
                          🌟 All Students (All Courses & Classes)
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center' }}>
                          {bIds.map(id => {
                            const b = batches.find(item => item.id === id);
                            const name = b ? b.name : id;
                            return (
                              <span 
                                key={id} 
                                style={{ 
                                  background: 'rgba(59, 130, 246, 0.12)', 
                                  color: '#1d4ed8', 
                                  border: '1px solid rgba(59, 130, 246, 0.28)', 
                                  fontWeight: 700, 
                                  fontSize: '0.76rem',
                                  padding: '2px 8px', 
                                  borderRadius: '6px' 
                                }}
                              >
                                📚 {name}
                              </span>
                            );
                          })}
                          {cNames.map(cls => (
                            <span 
                              key={cls} 
                              style={{ 
                                background: 'rgba(16, 185, 129, 0.12)', 
                                color: '#047857', 
                                border: '1px solid rgba(16, 185, 129, 0.28)', 
                                fontWeight: 700, 
                                fontSize: '0.76rem',
                                padding: '2px 8px', 
                                borderRadius: '6px' 
                              }}
                            >
                              🎓 Class {cls}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td><strong style={{ color: '#0f172a' }}>{s.startTime}</strong></td>
                    <td><strong style={{ color: '#0f172a' }}>{s.endTime}</strong></td>
                    <td className="text-right">
                      <button className="btn btn-icon mr-2" onClick={() => handleEdit(s)} title="Edit session">
                        <Edit size={17} className="text-primary" />
                      </button>
                      <button className="btn btn-icon text-danger" onClick={() => handleDelete(s.id)} title="Delete session">
                        <Trash2 size={17} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
