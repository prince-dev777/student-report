import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Plus, Trash2, Edit } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';
import { generateId } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function Sessions() {
  const { sessions, setSessions, backendOnline, batches, students } = useApp();
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(null);
  
  const uniqueClasses = [...new Set(students.map((s) => s.class).filter(Boolean))].sort();

  const [formData, setFormData] = useState({
    name: '',
    startTime: '',
    endTime: '',
    batchId: 'all',
    className: 'all'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!backendOnline) {
      toast.error('Offline mode: Cannot save sessions');
      return;
    }

    try {
      if (isEditing) {
        const updated = await api.updateSession(isEditing.id, formData);
        setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
        toast.success('Session updated!');
      } else {
        const newSession = { ...formData, id: generateId('SESS') };
        const saved = await api.createSession(newSession);
        setSessions(prev => [...prev, saved]);
        toast.success('Session created!');
      }
      setIsAdding(false);
      setIsEditing(null);
      setFormData({ name: '', startTime: '', endTime: '', batchId: 'all', className: 'all' });
    } catch (err) {
      toast.error('Failed to save session');
    }
  };

  const handleDelete = async (id) => {
    if (!backendOnline) return toast.error('Offline mode');
    if (!window.confirm('Delete this session?')) return;
    
    try {
      await api.deleteSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      toast.success('Session deleted');
    } catch (err) {
      toast.error('Failed to delete session');
    }
  };

  const handleEdit = (session) => {
    setIsEditing(session);
    setFormData({
      name: session.name,
      startTime: session.startTime,
      endTime: session.endTime,
      batchId: session.batchId || 'all',
      className: session.className || 'all'
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
          <p className="page-subtitle">Configure automated message rules based on punch-in time.</p>
        </div>
        {!isAdding && (
          <button className="btn btn-primary" onClick={() => setIsAdding(true)}>
            <Plus size={20} />
            Add Session
          </button>
        )}
      </div>

      {isAdding && (
        <div className="card mb-4">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="form-label">Session Name (e.g., Class, Self-Study)</label>
              <input 
                type="text" 
                className="form-input"
                required
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div>
              <label className="form-label">Start Time</label>
              <input 
                type="time" 
                className="form-input"
                required
                value={formData.startTime}
                onChange={e => setFormData({...formData, startTime: e.target.value})}
              />
            </div>
            <div>
              <label className="form-label">End Time</label>
              <input 
                type="time" 
                className="form-input"
                required
                value={formData.endTime}
                onChange={e => setFormData({...formData, endTime: e.target.value})}
              />
            </div>
            <div>
              <label className="form-label">Course (Optional)</label>
              <select 
                className="form-select"
                value={formData.batchId}
                onChange={e => setFormData({...formData, batchId: e.target.value})}
              >
                <option value="all">All Courses</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Class (Optional)</label>
              <select 
                className="form-select"
                value={formData.className}
                onChange={e => setFormData({...formData, className: e.target.value})}
              >
                <option value="all">All Classes</option>
                {uniqueClasses.map((c, i) => (
                  <option key={i} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary flex-1">Save</button>
              <button type="button" className="btn btn-outline flex-1" onClick={() => {
                setIsAdding(false);
                setIsEditing(null);
                setFormData({ name: '', startTime: '', endTime: '', batchId: 'all', className: 'all' });
              }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="table-container card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Session Name</th>
              <th>Applies To</th>
              <th>Start Time</th>
              <th>End Time</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center py-4 text-muted">No sessions configured.</td>
              </tr>
            ) : (
              sessions.map(s => (
                <tr key={s.id}>
                  <td className="font-medium">
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-primary" />
                      {s.name}
                    </div>
                  </td>
                  <td>
                    {s.batchId !== 'all' || s.className !== 'all' ? (
                      <div className="flex items-center gap-2 flex-wrap">
                         {s.batchId !== 'all' && <span className="badge" style={{background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6'}}>{batches.find(b => b.id === s.batchId)?.name || s.batchId}</span>}
                         {s.className !== 'all' && <span className="badge" style={{background: 'rgba(16, 185, 129, 0.1)', color: '#10b981'}}>{s.className}</span>}
                      </div>
                    ) : (
                      <span className="text-muted" style={{fontSize: '0.85rem'}}>All Students</span>
                    )}
                  </td>
                  <td>{s.startTime}</td>
                  <td>{s.endTime}</td>
                  <td className="text-right">
                    <button className="btn btn-icon mr-2" onClick={() => handleEdit(s)}>
                      <Edit size={18} className="text-primary" />
                    </button>
                    <button className="btn btn-icon text-danger" onClick={() => handleDelete(s.id)}>
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
