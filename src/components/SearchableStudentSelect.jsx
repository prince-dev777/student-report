import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Users, User } from 'lucide-react';

export default function SearchableStudentSelect({
  value,
  onChange,
  students = [],
  includeAllOption = false,
  allLabel = '🌟 All Students (Combined)',
  placeholder = 'Select a student...',
  className = '',
  style = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Selected student object
  const selectedStudent = useMemo(() => {
    if (!value || value === 'all') return null;
    return students.find((s) => s.id === value || String(s._id) === value || String(s.rollNo) === value);
  }, [value, students]);

  // Filtered students by search term
  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students;
    const query = search.toLowerCase().trim();
    return students.filter((s) => {
      const name = (s.name || '').toLowerCase();
      const roll = String(s.rollNo || '').toLowerCase();
      const phone = String(s.phone || s.parentPhone || '').toLowerCase();
      const batch = String(s.batch || s.targetClass || '').toLowerCase();
      return name.includes(query) || roll.includes(query) || phone.includes(query) || batch.includes(query);
    });
  }, [students, search]);

  const handleSelect = (val) => {
    onChange(val);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div
      ref={containerRef}
      className={`searchable-student-select ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        userSelect: 'none',
        zIndex: isOpen ? 9999 : 'auto',
        ...style
      }}
    >
      {/* Trigger Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'var(--surface-color, #ffffff)',
          border: isOpen ? '1.5px solid var(--accent-blue, #3b82f6)' : '1px solid var(--border-color, #cbd5e1)',
          borderRadius: '10px',
          cursor: 'pointer',
          minHeight: '40px',
          boxShadow: isOpen ? '0 0 0 3px rgba(59, 130, 246, 0.15)' : 'none',
          transition: 'all 0.2s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
          {value === 'all' ? (
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
              {allLabel}
            </span>
          ) : selectedStudent ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              {selectedStudent.photo ? (
                <img
                  src={selectedStudent.photo}
                  alt={selectedStudent.name}
                  style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%', background: '#3b82f615',
                  color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 800, flexShrink: 0
                }}>
                  {selectedStudent.name?.charAt(0) || 'S'}
                </div>
              )}
              <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary, #0f172a)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedStudent.name}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #64748b)', padding: '1px 6px', background: '#f1f5f9', borderRadius: '4px', flexShrink: 0 }}>
                Roll: {selectedStudent.rollNo}
              </span>
            </div>
          ) : (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)' }}>
              {placeholder}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {value && value !== 'all' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(includeAllOption ? 'all' : '');
              }}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
              title="Clear selection"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown
            size={16}
            style={{
              color: 'var(--text-muted, #64748b)',
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease'
            }}
          />
        </div>
      </div>

      {/* Floating Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            background: 'var(--card-bg, #ffffff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: '12px',
            boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.15)',
            zIndex: 9999,
            overflow: 'hidden',
            maxHeight: '320px',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Sticky Search Header */}
          <div style={{ padding: '8px', borderBottom: '1px solid var(--border-color, #e2e8f0)', background: 'var(--surface-color, #f8fafc)' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, roll no, phone..."
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 32px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Options List */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '4px' }}>
            {/* All Students Option */}
            {includeAllOption && !search.trim() && (
              <div
                onClick={() => handleSelect('all')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: value === 'all' ? '#3b82f615' : 'transparent',
                  color: value === 'all' ? '#3b82f6' : 'var(--text-primary, #0f172a)',
                  fontWeight: value === 'all' ? 700 : 500,
                  fontSize: '0.84rem'
                }}
              >
                <span>{allLabel}</span>
                {value === 'all' && <Check size={15} color="#3b82f6" />}
              </div>
            )}

            {filteredStudents.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                No students found matching "{search}"
              </div>
            ) : (
              filteredStudents.map((s) => {
                const isSelected = value === s.id || String(s._id) === value || String(s.rollNo) === value;
                return (
                  <div
                    key={s.id || s._id}
                    onClick={() => handleSelect(s.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: isSelected ? '#3b82f615' : 'transparent',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#f1f5f9'; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      {s.photo ? (
                        <img
                          src={s.photo}
                          alt={s.name}
                          style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                        />
                      ) : (
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '50%', background: '#3b82f615',
                          color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.8rem', fontWeight: 800, flexShrink: 0
                        }}>
                          {s.name?.charAt(0) || 'S'}
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary, #0f172a)', lineHeight: 1.2 }}>
                          {s.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>
                          Roll: <strong>{s.rollNo}</strong> {s.batch ? `• ${s.batch}` : s.targetClass ? `• Class ${s.targetClass}` : ''}
                        </div>
                      </div>
                    </div>

                    {isSelected && <Check size={16} color="#3b82f6" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
