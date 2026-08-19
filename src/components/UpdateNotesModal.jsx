import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import fallbackNotes from '../data/updateNotes.json';
import toast from 'react-hot-toast';
import { API_BASE } from '../utils/api';

export default function UpdateNotesModal({ isOpen, onClose, currentVersion = '1.0.41' }) {
  const [activeTab, setActiveTab] = useState('formatted'); // 'formatted' | 'raw'
  const [rawText, setRawText] = useState('');
  const [parsedNotes, setParsedNotes] = useState(fallbackNotes);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Fetch dynamic notes from backend if available
    fetch(`${API_BASE}/system/update-notes`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.notes) {
          setRawText(data.notes);
          parseRawNotes(data.notes);
        }
      })
      .catch(() => {
        // Use fallback static notes
      });
  }, [isOpen]);

  const parseRawNotes = (text) => {
    if (!text || !text.includes('[')) return;
    try {
      const sections = text.split(/\n(?=\[v|\n\[v)/g);
      const parsed = [];

      sections.forEach((sec) => {
        const headerMatch = sec.match(/\[v?([0-9.]+)\]\s*-\s*([^\n]+)/);
        if (headerMatch) {
          const version = headerMatch[1];
          const date = headerMatch[2].trim();
          const lines = sec
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.startsWith('-'));

          const highlights = lines.map((l) => l.replace(/^-\s*/, '').trim());

          parsed.push({
            version,
            date,
            isLatest: parsed.length === 0,
            tag: parsed.length === 0 ? 'Current Version' : 'Update',
            highlights,
          });
        }
      });

      if (parsed.length > 0) {
        setParsedNotes(parsed);
      }
    } catch (e) {
      console.warn('Failed to parse dynamic update notes', e);
    }
  };

  const handleCopyRaw = () => {
    if (!rawText && parsedNotes.length > 0) {
      const fallbackStr = parsedNotes
        .map(
          (n) =>
            `[v${n.version}] - ${n.date}\n----------------------------------------\n${n.highlights.map((h) => `- ${h}`).join('\n')}`
        )
        .join('\n\n');
      navigator.clipboard.writeText(fallbackStr);
    } else {
      navigator.clipboard.writeText(rawText);
    }
    setCopied(true);
    toast.success('Update notes copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

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
            maxWidth: '680px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
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
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                }}
              >
                <Sparkles size={22} />
              </div>
              <div>
                <div className="flex items-center gap-8">
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>Release & Update Notes</h3>
                  <span
                    style={{
                      background: 'rgba(59, 130, 246, 0.1)',
                      color: '#3b82f6',
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontWeight: 600,
                    }}
                  >
                    v{currentVersion || '1.0.41'}
                  </span>
                </div>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)' }}>
                  Detailed changelog of all new features, fixes, and calibrations.
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

          {/* Navigation Sub-Tabs */}
          <div className="flex justify-between items-center mb-16">
            <div className="flex gap-8">
              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'formatted' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('formatted')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Sparkles size={14} /> Changelog View
              </button>
              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'raw' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('raw')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <FileText size={14} /> update note.txt
              </button>
            </div>

            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={handleCopyRaw}
              title="Copy notes"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {/* Body Content */}
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
            {activeTab === 'formatted' ? (
              <div className="flex flex-col gap-16">
                {parsedNotes.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: item.isLatest ? '1.5px solid rgba(59, 130, 246, 0.35)' : '1px solid var(--border-color-light, #e2e8f0)',
                      background: item.isLatest ? 'rgba(59, 130, 246, 0.03)' : 'var(--surface-color, #f8fafc)',
                      borderRadius: '12px',
                      padding: '16px',
                    }}
                  >
                    <div className="flex justify-between items-center mb-12">
                      <div className="flex items-center gap-8">
                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700' }}>v{item.version}</h4>
                        {item.isLatest ? (
                          <span
                            style={{
                              background: 'linear-gradient(135deg, #10b981, #059669)',
                              color: '#ffffff',
                              fontSize: '0.7rem',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontWeight: '600',
                            }}
                          >
                            Latest Release
                          </span>
                        ) : (
                          <span
                            style={{
                              background: 'rgba(100, 116, 139, 0.12)',
                              color: 'var(--text-secondary, #64748b)',
                              fontSize: '0.7rem',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontWeight: '500',
                            }}
                          >
                            Archive
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)' }}>{item.date}</span>
                    </div>

                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.88rem', lineHeight: '1.6' }}>
                      {item.highlights.map((point, pIdx) => (
                        <li key={pIdx} style={{ marginBottom: '6px', color: 'var(--text-primary, #1e293b)' }}>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  background: '#0f172a',
                  color: '#f8fafc',
                  padding: '16px',
                  borderRadius: '12px',
                  fontFamily: 'Consolas, Monaco, monospace',
                  fontSize: '0.82rem',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '400px',
                  overflowY: 'auto',
                }}
              >
                {rawText ||
                  parsedNotes
                    .map(
                      (n) =>
                        `[v${n.version}] - ${n.date}\n----------------------------------------\n${n.highlights.map((h) => `- ${h}`).join('\n')}`
                    )
                    .join('\n\n')}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex justify-between items-center pt-16 mt-16"
            style={{ borderTop: '1px solid var(--border-color-light, #e2e8f0)' }}
          >
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)' }}>
              Source: <code>update note.txt</code>
            </span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
