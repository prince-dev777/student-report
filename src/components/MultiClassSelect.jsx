import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

export default function MultiClassSelect({
  availableClasses = [],
  selectedClasses = [],
  onChange,
  label = 'Target Classes (Optional)',
  placeholder = 'All Classes'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleClass = (className) => {
    if (selectedClasses.includes(className)) {
      onChange(selectedClasses.filter((c) => c !== className));
    } else {
      onChange([...selectedClasses, className]);
    }
  };

  const handleSelectAll = (e) => {
    e?.stopPropagation?.();
    onChange([...availableClasses]);
  };

  const handleDeselectAll = (e) => {
    e?.stopPropagation?.();
    onChange([]);
  };

  const handleRemoveChip = (e, className) => {
    e.stopPropagation();
    onChange(selectedClasses.filter((c) => c !== className));
  };

  const isAllSelected = availableClasses.length > 0 && selectedClasses.length === availableClasses.length;

  return (
    <div className="form-group" ref={dropdownRef} style={{ position: 'relative', zIndex: isOpen ? 1000 : 1 }}>
      {label && (
        <label className="form-label" style={{ fontWeight: '600', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{label}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary, #94a3b8)', fontWeight: 'normal' }}>
            {selectedClasses.length === 0 ? 'All students in course' : `${selectedClasses.length} selected`}
          </span>
        </label>
      )}

      {/* Trigger Box */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="form-input"
        style={{
          minHeight: '42px',
          height: 'auto',
          padding: '4px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          background: 'var(--input-bg, var(--surface-color, #ffffff))',
          border: isOpen ? '1.5px solid var(--primary, #3b82f6)' : '1px solid var(--border-color, #cbd5e1)',
          borderRadius: '8px',
          gap: '6px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', flex: 1 }}>
          {selectedClasses.length === 0 ? (
            <span style={{ color: 'var(--text-secondary, #64748b)', fontSize: '0.88rem', paddingLeft: '4px' }}>
              🌟 {placeholder} <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>(No class filter)</span>
            </span>
          ) : (
            selectedClasses.map((cls) => (
              <span
                key={cls}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(59, 130, 246, 0.12)',
                  color: 'var(--primary, #2563eb)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '0.80rem',
                  fontWeight: '700',
                  lineHeight: '1.2'
                }}
              >
                {cls}
                <button
                  type="button"
                  onClick={(e) => handleRemoveChip(e, cls)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0.75
                  }}
                  title={`Remove ${cls}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {selectedClasses.length > 0 && (
            <button
              type="button"
              onClick={handleDeselectAll}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#dc2626',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '4px',
                padding: '2px 6px',
                fontSize: '0.70rem',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '2px'
              }}
              title="Deselect all classes"
            >
              <X size={11} /> Clear All
            </button>
          )}
          <ChevronDown
            size={16}
            style={{
              color: 'var(--text-tertiary, #94a3b8)',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              flexShrink: 0
            }}
          />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: '#ffffff',
            border: '1.5px solid #93c5fd',
            borderRadius: '10px',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.22), 0 4px 12px rgba(37, 99, 235, 0.15)',
            zIndex: 99999,
            padding: '8px',
            maxHeight: '230px',
            overflowY: 'auto'
          }}
        >
          {/* Quick Action Header: Select All & Deselect All */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 8px',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              marginBottom: '8px',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={handleSelectAll}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.76rem',
                  fontWeight: '700',
                  borderRadius: '6px',
                  border: isAllSelected ? '1px solid #2563eb' : '1px solid #bfdbfe',
                  background: isAllSelected ? '#2563eb' : '#eff6ff',
                  color: isAllSelected ? '#ffffff' : '#1d4ed8',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                ✓ Select All
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                disabled={selectedClasses.length === 0}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.76rem',
                  fontWeight: '700',
                  borderRadius: '6px',
                  border: '1px solid #fecaca',
                  background: selectedClasses.length > 0 ? '#fef2f2' : '#f1f5f9',
                  color: selectedClasses.length > 0 ? '#dc2626' : '#94a3b8',
                  cursor: selectedClasses.length > 0 ? 'pointer' : 'not-allowed',
                  opacity: selectedClasses.length > 0 ? 1 : 0.6,
                  transition: 'all 0.15s ease'
                }}
              >
                ✕ Deselect All
              </button>
            </div>
            <span style={{ fontSize: '0.74rem', fontWeight: '600', color: '#64748b' }}>
              {selectedClasses.length} / {availableClasses.length} Selected
            </span>
          </div>

          {availableClasses.length === 0 ? (
            <div style={{ padding: '8px 10px', fontSize: '0.80rem', color: 'var(--text-tertiary, #94a3b8)', textAlign: 'center' }}>
              No classes found in student directory
            </div>
          ) : (
            availableClasses.map((cls) => {
              const isSelected = selectedClasses.includes(cls);
              return (
                <div
                  key={cls}
                  onClick={() => handleToggleClass(cls)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.84rem',
                    color: isSelected ? 'var(--primary, #2563eb)' : 'var(--text-primary, #1e293b)',
                    background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                    transition: 'background 0.15s ease',
                    marginBottom: '2px'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'var(--surface-color, #f8fafc)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span style={{ fontWeight: isSelected ? '700' : '500' }}>Class {cls}</span>
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '4px',
                      border: isSelected ? '1.5px solid var(--primary, #3b82f6)' : '1.5px solid var(--border-color, #cbd5e1)',
                      background: isSelected ? 'var(--primary, #3b82f6)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {isSelected && <Check size={12} color="#ffffff" strokeWidth={3} />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
