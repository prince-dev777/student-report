import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const { students, smsHistory, sendManualSMS, sendBulkManualSMS } = useApp();

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
                  <select
                    className="form-select"
                    value={selectedStudent}
                    onChange={(e) => setSelectedStudent(e.target.value)}
                  >
                    <option value="all">📢 All Students (Bulk SMS)</option>
                    {students
                      .filter((s) => s.status === 'active')
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} - {s.parentPhone}
                        </option>
                      ))}
                  </select>
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
    </div>
  );
}
