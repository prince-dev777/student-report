import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Select from 'react-select';
import {
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  FileText,
  Search,
  X,
  Filter,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Phone,
  AlertCircle,
  RefreshCw,
  QrCode,
  Wifi,
  WifiOff,
  Trash2
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getRelativeTime } from '../utils/helpers';
import toast from 'react-hot-toast';

const PAGE_SIZE = 50;

const typeBadgeMap = {
  'attendance-entry': { className: 'badge badge-success', label: 'ENTRY' },
  'attendance-exit': { className: 'badge badge-warning', label: 'EXIT' },
  'test-result': { className: 'badge badge-info', label: 'RESULT' },
  custom: { className: 'badge badge-purple', label: 'CUSTOM' },
};

const typeFilterOptions = [
  { value: 'all', label: 'All Types' },
  { value: 'attendance-entry', label: 'Entry' },
  { value: 'attendance-exit', label: 'Exit' },
  { value: 'test-result', label: 'Test Result' },
  { value: 'custom', label: 'Custom' },
];

export default function SMSCenter() {
  const { students, smsHistory, sendManualSMS, sendBulkManualSMS, deleteSMS } = useApp();

  // WhatsApp Local Client State
  const [whatsappStatus, setWhatsappStatus] = useState('offline');
  const [qrCode, setQrCode] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);

  useEffect(() => {
    const fetchWhatsAppStatus = async () => {
      try {
        const res = await fetch('http://localhost:5001/api/whatsapp/local-status');
        if (!res.ok) throw new Error();
        const data = await res.json();
        setWhatsappStatus(data.status);
        setQrCode(data.qrCode);
      } catch (err) {
        setWhatsappStatus('offline');
        setQrCode(null);
      }
    };

    fetchWhatsAppStatus();
    const interval = setInterval(fetchWhatsAppStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const initializeWhatsApp = async () => {
    setLoadingAction(true);
    try {
      await fetch('http://localhost:5001/api/whatsapp/local-initialize', { method: 'POST' });
      toast.success('Initializing WhatsApp Client...');
      setTimeout(async () => {
        try {
          const res = await fetch('http://localhost:5001/api/whatsapp/local-status');
          const data = await res.json();
          setWhatsappStatus(data.status);
          setQrCode(data.qrCode);
        } catch (e) {}
      }, 1000);
    } catch (err) {
      toast.error('Failed to connect to local OMR server');
    } finally {
      setLoadingAction(false);
    }
  };

  const disconnectWhatsApp = async () => {
    if (!window.confirm('Are you sure you want to disconnect and log out from WhatsApp?')) return;
    setLoadingAction(true);
    try {
      await fetch('http://localhost:5001/api/whatsapp/local-disconnect', { method: 'POST' });
      toast.success('WhatsApp disconnected.');
      setWhatsappStatus('disconnected');
      setQrCode(null);
    } catch (err) {
      toast.error('Failed to disconnect');
    } finally {
      setLoadingAction(false);
    }
  };

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState('all');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Filter / search state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Stats
  const stats = useMemo(() => {
    const total = smsHistory.length;
    const delivered = smsHistory.filter((s) => s.status === 'delivered').length;
    const attendanceSMS = smsHistory.filter(
      (s) => s.type && s.type.includes('attendance')
    ).length;
    const testResultSMS = smsHistory.filter(
      (s) => s.type === 'test-result'
    ).length;
    return { total, delivered, attendanceSMS, testResultSMS };
  }, [smsHistory]);

  // Filtered SMS history
  const filteredHistory = useMemo(() => {
    let list = [...smsHistory];

    if (typeFilter !== 'all') {
      list = list.filter((s) => s.type === typeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((sms) => {
        const student = students.find((st) => st.id === sms.studentId);
        const studentName = student ? student.name.toLowerCase() : '';
        return (
          studentName.includes(q) ||
          (sms.message && sms.message.toLowerCase().includes(q)) ||
          (sms.parentPhone && sms.parentPhone.includes(q))
        );
      });
    }

    return list;
  }, [smsHistory, typeFilter, searchQuery, students]);

  const studentOptions = useMemo(() => {
    const opts = students.filter(s => s.status === 'active').map(s => ({
      value: s.id,
      label: `${s.name} - ${s.parentPhone} (Roll: ${s.rollNo})`
    }));
    return [{ value: 'all', label: '📢 All Students (Bulk SMS)' }, ...opts];
  }, [students]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE));
  const paginatedHistory = filteredHistory.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Reset to page 1 on filter change
  const handleTypeFilter = (val) => {
    setTypeFilter(val);
    setCurrentPage(1);
  };
  const handleSearch = (val) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  // Get student name by id
  const getStudentName = (studentId) => {
    const student = students.find((s) => s.id === studentId);
    return student ? student.name : 'Unknown';
  };

  // Send handler
  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message!');
      return;
    }

    setSending(true);
    try {
      if (selectedStudent === 'all') {
        const activeIds = students
          .filter((s) => s.status === 'active')
          .map((s) => s.id);
        await sendBulkManualSMS(activeIds, message);
      } else {
        await sendManualSMS(selectedStudent, message);
      }
      setMessage('');
      setSelectedStudent('all');
      setShowModal(false);
    } catch (err) {
      toast.error('Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  return (
    <div className="page-container">
      {/* Header */}
      <motion.div
        className="page-header flex items-center justify-between"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div>
          <h1>📱 SMS Center</h1>
          <p>Track all parent notifications</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowModal(true)}
        >
          <Send size={16} />
          Send Custom SMS
        </button>
      </motion.div>

      {/* WhatsApp Local Status Banner */}
      <div className="card" style={{ marginBottom: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="flex items-center gap-12">
          {whatsappStatus === 'connected' ? (
            <div className="flex items-center justify-center" style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--accent-green)' }}>
              <MessageCircle size={24} />
            </div>
          ) : (
            <div className="flex items-center justify-center" style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)' }}>
              <WifiOff size={24} />
            </div>
          )}
          
          <div>
            <h3 style={{ margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              WhatsApp Integration Status
              {whatsappStatus === 'connected' && (
                <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Online</span>
              )}
              {whatsappStatus === 'disconnected' && (
                <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>Offline</span>
              )}
              {whatsappStatus === 'qr_ready' && (
                <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>QR Code Scan Required</span>
              )}
              {whatsappStatus === 'initializing' && (
                <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>Starting up...</span>
              )}
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {whatsappStatus === 'connected' ? 'Ready to send automated messages via local WhatsApp.' : 'Link your WhatsApp account to enable automated messaging.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-12">
          {whatsappStatus === 'connected' && (
            <button className="btn btn-outline" onClick={disconnectWhatsApp} disabled={loadingAction} style={{ color: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}>
              <WifiOff size={16} /> Disconnect
            </button>
          )}
          
          {(whatsappStatus === 'disconnected' || whatsappStatus === 'offline') && (
            <button className="btn btn-primary" onClick={initializeWhatsApp} disabled={loadingAction}>
              {loadingAction ? <RefreshCw size={16} className="spin" /> : <QrCode size={16} />}
              Link WhatsApp
            </button>
          )}

          {whatsappStatus === 'qr_ready' && qrCode && (
            <button className="btn btn-primary" onClick={() => window.open('http://localhost:5001', '_blank')} disabled={loadingAction}>
              <QrCode size={16} /> Show QR Code
            </button>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <motion.div
        className="stat-cards-grid"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div className="stat-card blue" variants={itemVariants}>
          <div className="stat-card-top">
            <div className="stat-card-icon blue">
              <MessageSquare size={20} />
            </div>
          </div>
          <div className="stat-card-value">{stats.total}</div>
          <div className="stat-card-label">Total SMS Sent</div>
        </motion.div>

        <motion.div className="stat-card green" variants={itemVariants}>
          <div className="stat-card-top">
            <div className="stat-card-icon green">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="stat-card-value">{stats.delivered}</div>
          <div className="stat-card-label">Delivered</div>
        </motion.div>

        <motion.div className="stat-card orange" variants={itemVariants}>
          <div className="stat-card-top">
            <div className="stat-card-icon orange">
              <Clock size={20} />
            </div>
          </div>
          <div className="stat-card-value">{stats.attendanceSMS}</div>
          <div className="stat-card-label">Attendance SMS</div>
        </motion.div>

        <motion.div className="stat-card purple" variants={itemVariants}>
          <div className="stat-card-top">
            <div className="stat-card-icon purple">
              <FileText size={20} />
            </div>
          </div>
          <div className="stat-card-value">{stats.testResultSMS}</div>
          <div className="stat-card-label">Test Result SMS</div>
        </motion.div>
      </motion.div>

      {/* Filters */}
      <motion.div
        className="flex items-center gap-12 mb-16"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-8" style={{ position: 'relative' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            className="form-input"
            placeholder="Search by student, phone, or message..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ paddingLeft: '36px', maxWidth: '360px' }}
          />
        </div>

        <div className="flex items-center gap-8">
          <Filter size={16} style={{ color: 'var(--text-muted)' }} />
          <select
            className="form-select"
            value={typeFilter}
            onChange={(e) => handleTypeFilter(e.target.value)}
            style={{ minWidth: '160px' }}
          >
            {typeFilterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', marginLeft: 'auto' }}>
          Showing {paginatedHistory.length} of {filteredHistory.length} messages
        </span>
      </motion.div>

      {/* SMS History Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Student</th>
                <th>Parent Phone</th>
                <th>Message</th>
                <th>Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedHistory.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <MessageCircle size={28} />
                      </div>
                      <h3>No SMS found</h3>
                      <p>Try adjusting your search or filter.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedHistory.map((sms, idx) => {
                  const badge = typeBadgeMap[sms.type] || {
                    className: 'badge badge-info',
                    label: sms.type ? sms.type.toUpperCase() : 'SMS',
                  };

                  return (
                    <motion.tr
                      key={sms.id || idx}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.02 }}
                      onClick={() => setSelectedMessage(sms)}
                      style={{ cursor: 'pointer' }}
                      title="Click to view full message"
                      className="hover-row"
                    >
                      <td>
                        <span className={badge.className}>{badge.label}</span>
                      </td>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {getStudentName(sms.studentId)}
                      </td>
                      <td>
                        <span className="flex items-center gap-4">
                          <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                          {sms.parentPhone}
                        </span>
                      </td>
                      <td style={{ maxWidth: '320px' }}>
                        <span className="truncate" style={{ display: 'block', maxWidth: '320px' }}>
                          {sms.message && sms.message.length > 60
                            ? sms.message.substring(0, 60) + '...'
                            : sms.message}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {sms.timestamp ? getRelativeTime(sms.timestamp) : '-'}
                      </td>
                      <td>
                        <span className={`sms-status ${sms.status || 'sent'}`}>
                          {sms.status === 'delivered' && <CheckCircle2 size={12} />}
                          {sms.status === 'sent' && <Clock size={12} />}
                          {sms.status === 'failed' && <AlertCircle size={12} />}
                          {sms.status || 'sent'}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            className="flex items-center justify-center gap-12 mt-16"
          >
            <button
              className="btn btn-ghost btn-sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <ChevronLeft size={16} />
              Prev
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </motion.div>

      {/* Send Custom SMS Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowModal(false)}
          >
            <motion.div
              className="modal-content"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>📱 Send Custom SMS</h3>
                <button
                  className="modal-close"
                  onClick={() => setShowModal(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Select Student</label>
                  <Select
                    options={studentOptions}
                    value={studentOptions.find(o => o.value === selectedStudent) || studentOptions[0]}
                    onChange={(selected) => setSelectedStudent(selected.value)}
                    isSearchable={true}
                    placeholder="Search by Name, Mobile, or Roll No..."
                    className="react-select-container"
                    classNamePrefix="react-select"
                    styles={{
                      control: (base) => ({
                        ...base,
                        borderRadius: '0.5rem',
                        borderColor: 'var(--border-color)',
                        padding: '2px',
                        boxShadow: 'none',
                        '&:hover': {
                          borderColor: 'var(--accent-blue)'
                        }
                      }),
                      menu: (base) => ({
                        ...base,
                        borderRadius: '0.5rem',
                        overflow: 'hidden',
                        zIndex: 9999
                      })
                    }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Message</label>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    placeholder="Type your message here..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    {message.length} characters
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSend}
                  disabled={sending || !message.trim()}
                >
                  <Send size={16} />
                  {sending ? 'Sending...' : selectedStudent === 'all' ? 'Send to All' : 'Send SMS'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message Preview Modal */}
      <AnimatePresence>
        {selectedMessage && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedMessage(null)}
          >
            <motion.div
              className="modal-content"
              style={{ maxWidth: '500px' }}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Message Details</h3>
                <button className="modal-close" onClick={() => setSelectedMessage(null)}>
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body" style={{ lineHeight: '1.6' }}>
                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>Student:</strong> <span style={{ color: 'var(--text-secondary)' }}>{getStudentName(selectedMessage.studentId)}</span>
                  </div>
                  <div>
                    <strong>Phone:</strong> <span style={{ color: 'var(--text-secondary)' }}>{selectedMessage.parentPhone}</span>
                  </div>
                </div>
                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>Type:</strong> <span className={typeBadgeMap[selectedMessage.type]?.className || 'badge badge-info'}>{typeBadgeMap[selectedMessage.type]?.label || 'SMS'}</span>
                  </div>
                  <div>
                    <strong>Status:</strong> <span className={`sms-status ${selectedMessage.status || 'sent'}`}>{selectedMessage.status || 'sent'}</span>
                  </div>
                </div>
                <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-md)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-primary)' }}>
                  {selectedMessage.message}
                </div>
                <div style={{ marginTop: '16px', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                  {selectedMessage.timestamp ? new Date(selectedMessage.timestamp).toLocaleString() : '-'}
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button 
                  className="btn btn-outline" 
                  style={{ color: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this SMS log?')) {
                      deleteSMS(selectedMessage._id || selectedMessage.id);
                      setSelectedMessage(null);
                    }
                  }}
                >
                  <Trash2 size={16} />
                  Delete SMS
                </button>
                <button className="btn btn-primary" onClick={() => setSelectedMessage(null)}>
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
