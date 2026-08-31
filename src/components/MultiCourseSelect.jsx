import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X, Search } from 'lucide-react';

export default function MultiCourseSelect({
  availableBatches = [],
  selectedBatchIds = [],
  onChange,
  label = 'Target Courses / Batches (Optional)',
  placeholder = 'All Courses'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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

  const handleToggleBatch = (batchId) => {
    if (selectedBatchIds.includes(batchId)) {
      onChange(selectedBatchIds.filter((id) => id !== batchId));
    } else {
      onChange([...selectedBatchIds, batchId]);
    }
  };

  const handleSelectAll = (e) => {
    e?.stopPropagation?.();
    onChange(availableBatches.map(b => b.id));
  };

  const handleDeselectAll = (e) => {
    e?.stopPropagation?.();
    onChange([]);
  };

  const handleRemoveChip = (e, batchId) => {
    e.stopPropagation();
    onChange(selectedBatchIds.filter((id) => id !== batchId));
  };

  const isAllSelected = availableBatches.length > 0 && selectedBatchIds.length === availableBatches.length;

  const filteredBatches = availableBatches.filter(b => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (b.name || '').toLowerCase().includes(q) || (b.id || '').toLowerCase().includes(q);
  });

  return (
    <div className="form-group" ref={dropdownRef} style={{ position: 'relative', zIndex: isOpen ? 1000 : 1 }}>
      {label && (
        <label className="form-label" style={{ fontWeight: '600', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{label}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary, #94a3b8)', fontWeight: 'normal' }}>
            {selectedBatchIds.length === 0 ? 'All courses included' : `${selectedBatchIds.length} selected`}
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
          {selectedBatchIds.length === 0 ? (
            <span style={{ color: 'var(--text-secondary, #64748b)', fontSize: '0.88rem', paddingLeft: '4px' }}>
              🌟 {placeholder} <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>(Applies to all courses)</span>
            </span>
          ) : (
            selectedBatchIds.map((batchId) => {
              const b = availableBatches.find(item => item.id === batchId);
              const name = b ? b.name : batchId;
              return (
                <span
                  key={batchId}
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
                  {name}
                  <button
                    type="button"
                    onClick={(e) => handleRemoveChip(e, batchId)}
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
                    title={`Remove ${name}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              );
            })
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {selectedBatchIds.length > 0 && (
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
              title="Clear all courses"
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

      {/* Dropdown Menu - Explicitly opens DOWNWARDS with fixed high zIndex and scroll */}
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
            maxHeight: '260px',
            overflowY: 'auto'
          }}
        >
          {/* Search Box if more than 4 batches */}
          {availableBatches.length > 4 && (
            <div style={{ position: 'relative', marginBottom: '8px' }}>
              <Search size={14} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search courses/batches..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  padding: '6px 8px 6px 28px',
                  fontSize: '0.80rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  outline: 'none',
                  background: '#f8fafc'
                }}
              />
            </div>
          )}

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
                disabled={selectedBatchIds.length === 0}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.76rem',
                  fontWeight: '700',
                  borderRadius: '6px',
                  border: '1px solid #fecaca',
                  background: selectedBatchIds.length > 0 ? '#fef2f2' : '#f1f5f9',
                  color: selectedBatchIds.length > 0 ? '#dc2626' : '#94a3b8',
                  cursor: selectedBatchIds.length > 0 ? 'pointer' : 'not-allowed',
                  opacity: selectedBatchIds.length > 0 ? 1 : 0.6,
                  transition: 'all 0.15s ease'
                }}
              >
                ✕ Deselect All
              </button>
            </div>
            <span style={{ fontSize: '0.74rem', fontWeight: '600', color: '#64748b' }}>
              {selectedBatchIds.length} / {availableBatches.length} Selected
            </span>
          </div>

          {filteredBatches.length === 0 ? (
            <div style={{ padding: '8px 10px', fontSize: '0.80rem', color: 'var(--text-tertiary, #94a3b8)', textAlign: 'center' }}>
              No matching courses found
            </div>
          ) : (
            filteredBatches.map((b) => {
              const isSelected = selectedBatchIds.includes(b.id);
              return (
                <div
                  key={b.id}
                  onClick={() => handleToggleBatch(b.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 10px',
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
                  <span style={{ fontWeight: isSelected ? '700' : '500' }}>{b.name}</span>
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '4px',
                      border: isSelected ? '1.5px solid var(--primary, #3b82f6)' : '1.5px solid var(--border-color, #cbd5e1)',
                      background: isSelected ? 'var(--primary, #3b82f6)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
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
