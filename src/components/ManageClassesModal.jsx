import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Layers, Search, Edit2, Check, X, Users, AlertCircle, Merge, RefreshCw, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../utils/api';

export default function ManageClassesModal({ isOpen, onClose, onClassUpdated, allStudents = [] }) {
  const [classList, setClassList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingClassName, setEditingClassName] = useState(null);
  const [newClassNameInput, setNewClassNameInput] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  // Merge Mode state
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState(new Set());
  const [targetMergeClass, setTargetMergeClass] = useState('');
  const [isMerging, setIsMerging] = useState(false);

  const showStatus = (type, text) => {
    setStatusMsg({ type, text });
    setTimeout(() => {
      setStatusMsg((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const res = await api.getClasses();
      if (res && res.classes) {
        setClassList(res.classes);
      } else {
        const map = {};
        allStudents.forEach(s => {
          const cls = String(s.class || '').trim();
          if (cls) map[cls] = (map[cls] || 0) + 1;
        });
        setClassList(Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count));
      }
    } catch (err) {
      console.warn('Failed to fetch classes from API, fallback to local:', err.message);
      const map = {};
      allStudents.forEach(s => {
        const cls = String(s.class || '').trim();
        if (cls) map[cls] = (map[cls] || 0) + 1;
      });
      setClassList(Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchClasses();
      setEditingClassName(null);
      setNewClassNameInput('');
      setMergeMode(false);
      setSelectedForMerge(new Set());
      setStatusMsg(null);
    }
  }, [isOpen]);

  const filteredClasses = useMemo(() => {
    if (!searchQuery.trim()) return classList;
    const q = searchQuery.toLowerCase();
    return classList.filter(c => c.name.toLowerCase().includes(q));
  }, [classList, searchQuery]);

  const handleStartEdit = (className) => {
    setEditingClassName(className);
    setNewClassNameInput(className);
    setStatusMsg(null);
  };

  const handleCancelEdit = () => {
    setEditingClassName(null);
    setNewClassNameInput('');
  };

  const handleSaveRename = async (oldName) => {
    const trimmed = newClassNameInput.trim();
    if (!trimmed) {
      toast.error('Class name cannot be empty');
      showStatus('error', 'Class name cannot be empty');
      return;
    }
    if (trimmed === oldName) {
      setEditingClassName(null);
      return;
    }

    setIsRenaming(true);
    setStatusMsg(null);
    try {
      const res = await api.renameClass(oldName, trimmed);
      const successText = `Renamed to "${trimmed}" (${res.modifiedCount || 0} students updated)!`;
      toast.success(`✅ ${successText}`);
      showStatus('success', successText);
      setEditingClassName(null);
      setNewClassNameInput('');
      await fetchClasses();
      if (onClassUpdated) onClassUpdated();
    } catch (err) {
      console.error('Rename failed:', err);
      const errText = err.message || 'Failed to rename class. Please restart the app backend.';
      toast.error(errText);
      showStatus('error', errText);
    } finally {
      setIsRenaming(false);
    }
  };

  const toggleMergeSelect = (className) => {
    const next = new Set(selectedForMerge);
    if (next.has(className)) {
      next.delete(className);
    } else {
      next.add(className);
    }
    setSelectedForMerge(next);
  };

  const handleExecuteMerge = async () => {
    const selectedArray = Array.from(selectedForMerge);
    if (selectedArray.length < 2) {
      toast.error('Please select at least 2 classes to merge.');
      showStatus('error', 'Please select at least 2 classes to merge.');
      return;
    }
    const finalTarget = targetMergeClass.trim() || selectedArray[0];

    setIsMerging(true);
    setStatusMsg(null);
    try {
      const res = await api.mergeClasses(selectedArray, finalTarget);
      const successText = `Merged ${selectedArray.length} classes into "${finalTarget}" (${res.modifiedCount || 0} students updated)!`;
      toast.success(`✅ ${successText}`);
      showStatus('success', successText);
      setMergeMode(false);
      setSelectedForMerge(new Set());
      setTargetMergeClass('');
      await fetchClasses();
      if (onClassUpdated) onClassUpdated();
    } catch (err) {
      console.error('Merge failed:', err);
      const errText = err.message || 'Failed to merge classes';
      toast.error(errText);
      showStatus('error', errText);
    } finally {
      setIsMerging(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="modal-overlay" 
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 5000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <motion.div
        className="modal-content"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '85vh',
          background: 'var(--bg-card, #ffffff)',
          color: 'var(--text-primary, #0f172a)',
          border: '1.5px solid var(--border-color, #e2e8f0)',
          borderRadius: '20px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          padding: 0
        }}
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-light, #f8fafc)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: '#eff6ff',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Layers size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Manage & Rename Classes
                <span style={{
                  fontSize: '0.75rem',
                  padding: '2px 10px',
                  borderRadius: '12px',
                  background: '#eff6ff',
                  color: '#2563eb',
                  border: '1px solid #bfdbfe',
                  fontWeight: 800
                }}>
                  {classList.length} Classes
                </span>
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary, #64748b)' }}>
                Rename or merge class names across all enrolled students.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary, #64748b)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Action & Search Bar */}
        <div style={{
          padding: '14px 24px',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-card, #ffffff)'
        }}>
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search class name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{
                width: '100%',
                paddingLeft: '36px',
                height: '40px',
                fontSize: '0.85rem',
                background: 'var(--bg-light, #f8fafc)',
                color: 'var(--text-primary, #0f172a)',
                border: '1.5px solid var(--border-color, #cbd5e1)',
                borderRadius: '10px'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => {
                setMergeMode(!mergeMode);
                setSelectedForMerge(new Set());
                setStatusMsg(null);
              }}
              className={`btn btn-sm ${mergeMode ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.82rem',
                padding: '8px 16px',
                borderRadius: '10px',
                fontWeight: 700
              }}
            >
              <Merge size={15} />
              {mergeMode ? 'Cancel Merge' : 'Merge Classes'}
            </button>
            <button
              onClick={fetchClasses}
              disabled={loading}
              className="btn btn-sm btn-secondary"
              style={{ padding: '8px 12px', borderRadius: '10px' }}
              title="Refresh Classes"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Inline Status Feedback Banner */}
        {statusMsg && (
          <div style={{
            padding: '10px 24px',
            background: statusMsg.type === 'success' ? '#ecfdf5' : '#fef2f2',
            borderBottom: statusMsg.type === 'success' ? '1px solid #a7f3d0' : '1px solid #fecaca',
            color: statusMsg.type === 'success' ? '#065f46' : '#991b1b',
            fontSize: '0.85rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {statusMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{statusMsg.text}</span>
            </div>
            <button
              onClick={() => setStatusMsg(null)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit' }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Merge Banner when active */}
        {mergeMode && (
          <div style={{
            padding: '14px 24px',
            background: '#faf5ff',
            borderBottom: '1.5px solid #e9d5ff',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem', color: '#6b21a8' }}>
              <span style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Merge size={15} /> Select 2 or more classes to merge into one target name:
              </span>
              <span style={{ fontWeight: 900, background: '#f3e8ff', padding: '2px 10px', borderRadius: '12px' }}>
                {selectedForMerge.size} Selected
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Enter Target Class Name (e.g. 11TH J4 BATCH)"
                value={targetMergeClass}
                onChange={(e) => setTargetMergeClass(e.target.value)}
                className="form-input"
                style={{
                  flex: 1,
                  height: '38px',
                  fontSize: '0.85rem',
                  background: '#ffffff',
                  color: '#0f172a',
                  border: '1.5px solid #c084fc',
                  borderRadius: '8px'
                }}
              />
              <button
                onClick={handleExecuteMerge}
                disabled={isMerging || selectedForMerge.size < 2}
                className="btn btn-sm"
                style={{
                  background: '#9333ea',
                  color: '#ffffff',
                  height: '38px',
                  fontWeight: 800,
                  padding: '0 18px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: (isMerging || selectedForMerge.size < 2) ? 'not-allowed' : 'pointer',
                  opacity: (isMerging || selectedForMerge.size < 2) ? 0.5 : 1
                }}
              >
                {isMerging ? 'Merging...' : 'Confirm Merge'}
              </button>
            </div>
          </div>
        )}

        {/* Class List Body */}
        <div style={{
          padding: '14px 24px',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          minHeight: '280px',
          background: 'var(--bg-card, #ffffff)'
        }}>
          {loading ? (
            <div style={{ padding: '50px 0', textAlign: 'center', color: 'var(--text-secondary, #64748b)' }}>
              <RefreshCw size={26} className="animate-spin" style={{ margin: '0 auto 12px', display: 'block', color: '#2563eb' }} />
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Loading classes directory...</p>
            </div>
          ) : filteredClasses.length === 0 ? (
            <div style={{ padding: '50px 0', textAlign: 'center', color: 'var(--text-secondary, #64748b)' }}>
              <AlertCircle size={36} style={{ margin: '0 auto 10px', display: 'block', color: '#94a3b8' }} />
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>No classes found matching "{searchQuery}"</p>
            </div>
          ) : (
            filteredClasses.map((item) => {
              const isEditing = editingClassName === item.name;
              const isChecked = selectedForMerge.has(item.name);

              return (
                <div
                  key={item.name}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '14px',
                    background: isChecked 
                      ? '#faf5ff' 
                      : (isEditing ? '#eff6ff' : 'var(--bg-light, #f8fafc)'),
                    border: isChecked 
                      ? '1.5px solid #c084fc' 
                      : (isEditing ? '1.5px solid #93c5fd' : '1px solid var(--border-color, #e2e8f0)'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '14px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* Left */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    {mergeMode && (
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleMergeSelect(item.name)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#9333ea' }}
                      />
                    )}

                    {isEditing ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                        <input
                          type="text"
                          value={newClassNameInput}
                          onChange={(e) => setNewClassNameInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(item.name);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          autoFocus
                          placeholder="Type new class name..."
                          style={{
                            flex: 1,
                            height: '38px',
                            padding: '0 12px',
                            fontSize: '0.92rem',
                            fontWeight: 700,
                            color: '#0f172a',
                            background: '#ffffff',
                            border: '2px solid #2563eb',
                            borderRadius: '8px',
                            outline: 'none',
                            boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.15)'
                          }}
                        />
                        <button
                          onClick={() => handleSaveRename(item.name)}
                          disabled={isRenaming}
                          style={{
                            background: '#10b981',
                            color: '#ffffff',
                            border: 'none',
                            height: '38px',
                            padding: '0 14px',
                            borderRadius: '8px',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: isRenaming ? 'not-allowed' : 'pointer'
                          }}
                          title="Save Changes"
                        >
                          <Check size={16} />
                          <span>{isRenaming ? 'Saving...' : 'Save'}</span>
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          style={{
                            background: '#f1f5f9',
                            color: '#475569',
                            border: '1px solid #cbd5e1',
                            height: '38px',
                            padding: '0 10px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Cancel"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary, #0f172a)', wordBreak: 'break-word' }}>
                        {item.name}
                      </strong>
                    )}
                  </div>

                  {/* Right */}
                  {!isEditing && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '5px 12px',
                        borderRadius: '20px',
                        background: '#eff6ff',
                        color: '#2563eb',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        border: '1px solid #bfdbfe'
                      }}>
                        <Users size={13} />
                        {item.count} {item.count === 1 ? 'Student' : 'Students'}
                      </span>

                      {!mergeMode && (
                        <button
                          onClick={() => handleStartEdit(item.name)}
                          className="btn btn-sm btn-secondary"
                          style={{
                            padding: '6px 14px',
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            borderRadius: '8px',
                            fontWeight: 700
                          }}
                          title="Rename Class"
                        >
                          <Edit2 size={13} />
                          Edit
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-light, #f8fafc)',
          fontSize: '0.82rem',
          color: 'var(--text-secondary, #64748b)'
        }}>
          <span>
            💡 Renaming updates all matching students and dropdown filters instantly.
          </span>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '8px 24px', fontWeight: 800, borderRadius: '10px' }}
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
