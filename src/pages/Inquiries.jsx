import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, Edit2, Trash2, Phone, Calendar, 
  Download, Filter, FileSpreadsheet, CheckCircle2, 
  Clock, UserCheck, AlertCircle, X, ArrowUpDown 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';
import { generateId, getTodayStr, formatDate } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function Inquiries() {
  const { inquiries, setInquiries, backendOnline } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(null);
  const [inquiryToDelete, setInquiryToDelete] = useState(null);

  // Date Filter State
  const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'today' | '7days' | '30days' | 'custom'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'Pending' | 'Resolved' | 'Admitted' | 'Rejected'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const [formData, setFormData] = useState({
    visitorName: '',
    studentName: '',
    contactNumber: '',
    discussionDetails: '',
    status: 'Pending',
    date: getTodayStr()
  });

  // Filter inquiries based on Search, Status, and Date Range
  const filteredInquiries = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return inquiries.filter((iq) => {
      // 1. Search Query
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = !q || 
        (iq.visitorName || '').toLowerCase().includes(q) ||
        (iq.studentName || '').toLowerCase().includes(q) ||
        (iq.contactNumber || '').includes(q) ||
        (iq.discussionDetails || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // 2. Status Filter
      if (statusFilter !== 'all' && iq.status !== statusFilter) return false;

      // 3. Date Filter
      if (dateFilter === 'all') return true;
      if (!iq.date) return false;

      const iqDate = new Date(iq.date);
      iqDate.setHours(0, 0, 0, 0);

      if (dateFilter === 'today') {
        const todayStr = getTodayStr();
        return iq.date === todayStr;
      }

      if (dateFilter === '7days') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        return iqDate >= sevenDaysAgo && iqDate <= today;
      }

      if (dateFilter === '30days') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);
        return iqDate >= thirtyDaysAgo && iqDate <= today;
      }

      if (dateFilter === 'custom') {
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          return iqDate >= start && iqDate <= end;
        } else if (customStartDate) {
          const start = new Date(customStartDate);
          start.setHours(0, 0, 0, 0);
          return iqDate >= start;
        } else if (customEndDate) {
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          return iqDate <= end;
        }
        return true;
      }

      return true;
    });
  }, [inquiries, searchTerm, statusFilter, dateFilter, customStartDate, customEndDate]);

  // Statistics
  const stats = useMemo(() => {
    const todayStr = getTodayStr();
    const todayCount = inquiries.filter(iq => iq.date === todayStr).length;
    const admittedCount = inquiries.filter(iq => iq.status === 'Admitted').length;
    const pendingCount = inquiries.filter(iq => iq.status === 'Pending').length;
    return {
      total: inquiries.length,
      today: todayCount,
      admitted: admittedCount,
      pending: pendingCount
    };
  }, [inquiries]);

  // Excel Export Handler
  const handleExportExcel = () => {
    if (filteredInquiries.length === 0) {
      toast.error('No inquiries found for selected filter to export!');
      return;
    }

    const rows = filteredInquiries.map((iq, index) => ({
      'Sr No.': index + 1,
      'Date': iq.date || 'N/A',
      'Visitor / Parent Name': iq.visitorName || '',
      'Prospective Student Name': iq.studentName || '',
      'Contact Number': iq.contactNumber || '',
      'Status': iq.status || 'Pending',
      'Discussion Details / Notes': iq.discussionDetails || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet['!cols'] = [
      { wch: 8 },  // Sr No
      { wch: 14 }, // Date
      { wch: 25 }, // Visitor Name
      { wch: 25 }, // Student Name
      { wch: 18 }, // Contact
      { wch: 15 }, // Status
      { wch: 45 }, // Discussion Details
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inquiries');

    let filterLabel = dateFilter;
    if (dateFilter === 'custom' && customStartDate && customEndDate) {
      filterLabel = `${customStartDate}_to_${customEndDate}`;
    }
    const filename = `Inquiries_Report_${filterLabel}_${getTodayStr()}.xlsx`;
    XLSX.writeFile(workbook, filename);
    toast.success(`✅ Exported ${filteredInquiries.length} inquiries to Excel!`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!backendOnline) return toast.error('Offline mode: Cannot save inquiries');

    try {
      if (isEditing) {
        const updated = await api.updateInquiry(isEditing.id, formData);
        setInquiries(prev => prev.map(iq => iq.id === updated.id ? updated : iq));
        toast.success('Inquiry updated successfully!');
      } else {
        const newInquiry = { ...formData, id: generateId('INQ') };
        const saved = await api.createInquiry(newInquiry);
        setInquiries(prev => [saved, ...prev]);
        toast.success('New inquiry added!');
      }
      closeModal();
    } catch (err) {
      toast.error('Failed to save inquiry');
    }
  };

  const handleDelete = async (id) => {
    if (!backendOnline) return toast.error('Offline mode');

    try {
      await api.deleteInquiry(id);
      setInquiries(prev => prev.filter(iq => iq.id !== id));
      toast.success('Inquiry deleted');
      setInquiryToDelete(null);
    } catch (err) {
      toast.error('Failed to delete inquiry');
    }
  };

  const openEditModal = (iq) => {
    setIsEditing(iq);
    setFormData({
      visitorName: iq.visitorName,
      studentName: iq.studentName,
      contactNumber: iq.contactNumber,
      discussionDetails: iq.discussionDetails || '',
      status: iq.status,
      date: iq.date
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditing(null);
    setFormData({
      visitorName: '',
      studentName: '',
      contactNumber: '',
      discussionDetails: '',
      status: 'Pending',
      date: getTodayStr()
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Pending': 
        return <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.3)', fontWeight: 600, padding: '3px 10px', borderRadius: '12px' }}>Pending</span>;
      case 'Resolved': 
        return <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb', border: '1px solid rgba(59, 130, 246, 0.3)', fontWeight: 600, padding: '3px 10px', borderRadius: '12px' }}>Resolved</span>;
      case 'Admitted': 
        return <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 600, padding: '3px 10px', borderRadius: '12px' }}>Admitted</span>;
      case 'Rejected': 
        return <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#dc2626', border: '1px solid rgba(239, 68, 68, 0.3)', fontWeight: 600, padding: '3px 10px', borderRadius: '12px' }}>Rejected</span>;
      default: 
        return <span className="badge">{status}</span>;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="page-container">
      {/* Header */}
      <div className="page-header flex justify-between items-center flex-wrap gap-4 mb-16">
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>Inquiry Management</h1>
          <p className="page-subtitle" style={{ color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            Track prospective admissions, visitor discussions, and export custom reports.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            className="btn btn-secondary" 
            onClick={handleExportExcel}
            title="Download Inquiries in Excel format based on active date range"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontWeight: 600 }}
          >
            <Download size={17} color="#10b981" />
            Export Excel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => setIsModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 18px', fontWeight: 600 }}
          >
            <Plus size={18} /> Add Inquiry
          </button>
        </div>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-16" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--border-color-light)' }}>
          <div className="flex items-center justify-between">
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Inquiries</span>
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '6px', borderRadius: '8px', color: '#3b82f6' }}>
              <FileSpreadsheet size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '8px', color: 'var(--text-primary)' }}>
            {stats.total}
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--border-color-light)' }}>
          <div className="flex items-center justify-between">
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Today&apos;s Inquiries</span>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '6px', borderRadius: '8px', color: '#10b981' }}>
              <Calendar size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '8px', color: '#10b981' }}>
            {stats.today}
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--border-color-light)' }}>
          <div className="flex items-center justify-between">
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Admitted Students</span>
            <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '6px', borderRadius: '8px', color: '#6366f1' }}>
              <UserCheck size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '8px', color: '#6366f1' }}>
            {stats.admitted}
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--border-color-light)' }}>
          <div className="flex items-center justify-between">
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Pending Follow-ups</span>
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '6px', borderRadius: '8px', color: '#f59e0b' }}>
              <Clock size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '8px', color: '#f59e0b' }}>
            {stats.pending}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="card mb-16" style={{ padding: '16px', borderRadius: '14px', border: '1px solid var(--border-color-light)' }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Search Box */}
          <div className="search-bar flex-1" style={{ minWidth: '240px', position: 'relative' }}>
            <Search size={18} className="search-icon" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="search-input w-full"
              placeholder="Search by visitor, student, phone, or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '38px', borderRadius: '10px', height: '40px' }}
            />
          </div>

          {/* Date Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: '4px' }}>Date:</span>
            {[
              { id: 'all', label: 'All' },
              { id: 'today', label: 'Today' },
              { id: '7days', label: '7 Days' },
              { id: '30days', label: '1 Month' },
              { id: 'custom', label: 'Custom' },
            ].map((pill) => (
              <button
                key={pill.id}
                type="button"
                className={`btn btn-sm ${dateFilter === pill.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setDateFilter(pill.id)}
                style={{ borderRadius: '20px', padding: '4px 12px', fontSize: '0.8rem', fontWeight: dateFilter === pill.id ? 700 : 500 }}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Status Filter Dropdown */}
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Status:</span>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ height: '38px', borderRadius: '10px', fontSize: '0.85rem', minWidth: '130px' }}
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Resolved">Resolved</option>
              <option value="Admitted">Admitted</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range Pickers (Shows when dateFilter === 'custom') */}
        {dateFilter === 'custom' && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }} 
            className="flex items-center gap-4 mt-12 pt-12"
            style={{ borderTop: '1px dashed var(--border-color-light)' }}
          >
            <div className="flex items-center gap-2">
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>From Date:</span>
              <input
                type="date"
                className="form-input"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={{ height: '36px', borderRadius: '8px', fontSize: '0.85rem' }}
              />
            </div>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>To Date:</span>
              <input
                type="date"
                className="form-input"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{ height: '36px', borderRadius: '8px', fontSize: '0.85rem' }}
              />
            </div>
            {(customStartDate || customEndDate) && (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                style={{ height: '36px' }}
              >
                Clear Dates
              </button>
            )}
            <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600, marginLeft: 'auto' }}>
              Showing {filteredInquiries.length} result(s)
            </span>
          </motion.div>
        )}
      </div>

      {/* Inquiries Table */}
      <div className="table-container card" style={{ borderRadius: '14px', border: '1px solid var(--border-color-light)', overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '140px', minWidth: '130px', whiteSpace: 'nowrap' }}>Date</th>
              <th style={{ whiteSpace: 'nowrap' }}>Visitor Name</th>
              <th style={{ whiteSpace: 'nowrap' }}>Student Name</th>
              <th style={{ whiteSpace: 'nowrap' }}>Contact Number</th>
              <th>Discussion Notes</th>
              <th style={{ whiteSpace: 'nowrap' }}>Status</th>
              <th className="text-right" style={{ width: '90px', whiteSpace: 'nowrap' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInquiries.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle size={28} style={{ opacity: 0.5 }} />
                    <p style={{ margin: 0, fontWeight: 500 }}>No inquiries found for selected filters.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredInquiries.map((iq) => (
                <tr key={iq.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div className="flex items-center gap-2" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      <Calendar size={14} className="text-muted" style={{ flexShrink: 0 }} />
                      <span>{iq.date ? formatDate(iq.date) : '—'}</span>
                    </div>
                  </td>
                  <td className="font-medium" style={{ fontWeight: 600 }}>{iq.visitorName}</td>
                  <td>{iq.studentName}</td>
                  <td>
                    <div className="flex items-center gap-2" style={{ color: 'var(--primary, #3b82f6)', fontWeight: 500 }}>
                      <Phone size={14} />
                      <a href={`tel:${iq.contactNumber}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {iq.contactNumber}
                      </a>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '280px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {iq.discussionDetails || '—'}
                  </td>
                  <td>{getStatusBadge(iq.status)}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        type="button" 
                        className="btn btn-sm" 
                        onClick={() => openEditModal(iq)}
                        style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '5px 8px', borderRadius: '6px' }}
                        title="Edit Inquiry"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-sm" 
                        onClick={() => setInquiryToDelete(iq)}
                        style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '5px 8px', borderRadius: '6px' }}
                        title="Delete Inquiry"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Inquiry Modal */}
      {isModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card" style={{ maxWidth: '520px', width: '100%', borderRadius: '16px', padding: '24px', background: 'var(--card-bg, #ffffff)' }}>
            <div className="flex justify-between items-center mb-16 pb-12" style={{ borderBottom: '1px solid var(--border-color-light)' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{isEditing ? 'Edit Inquiry' : 'New Visitor Inquiry'}</h2>
              <button type="button" onClick={closeModal} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, marginBottom: '4px', display: 'block' }}>Visitor / Parent Name *</label>
                <input type="text" className="form-input w-full" required value={formData.visitorName} onChange={e => setFormData({...formData, visitorName: e.target.value})} placeholder="e.g. Mukesh Sharma" />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, marginBottom: '4px', display: 'block' }}>Prospective Student Name *</label>
                <input type="text" className="form-input w-full" required value={formData.studentName} onChange={e => setFormData({...formData, studentName: e.target.value})} placeholder="e.g. Prince Kumar" />
              </div>
              <div className="grid grid-cols-2 gap-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, marginBottom: '4px', display: 'block' }}>Contact Number *</label>
                  <input type="text" className="form-input w-full" required value={formData.contactNumber} onChange={e => setFormData({...formData, contactNumber: e.target.value})} placeholder="e.g. 9876543210" />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, marginBottom: '4px', display: 'block' }}>Date *</label>
                  <input type="date" className="form-input w-full" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, marginBottom: '4px', display: 'block' }}>Discussion Details / Notes</label>
                <textarea className="form-input w-full" rows="3" value={formData.discussionDetails} onChange={e => setFormData({...formData, discussionDetails: e.target.value})} placeholder="Discussed course fee, batch timings, demo class schedule..."></textarea>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600, marginBottom: '4px', display: 'block' }}>Status</label>
                <select className="form-select w-full" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                  <option value="Pending">Pending (Follow-up required)</option>
                  <option value="Resolved">Resolved (Interested)</option>
                  <option value="Admitted">Admitted (Fee Paid / Enrolled)</option>
                  <option value="Rejected">Rejected (Not Interested)</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-12 mt-8" style={{ borderTop: '1px solid var(--border-color-light)' }}>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">{isEditing ? 'Update Inquiry' : 'Save Inquiry'}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal Portal (Prevents Electron focus freeze) */}
      {inquiryToDelete && createPortal(
        <div className="modal-overlay" onClick={() => setInquiryToDelete(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="card" style={{ maxWidth: '420px', width: '100%', padding: '24px', borderRadius: '16px', background: 'var(--card-bg, #ffffff)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '10px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Delete Inquiry</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Are you sure you want to delete inquiry for <strong>{inquiryToDelete.visitorName || inquiryToDelete.studentName}</strong>?
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm" 
                onClick={() => setInquiryToDelete(null)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-sm" 
                style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '8px' }}
                onClick={() => handleDelete(inquiryToDelete.id)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </motion.div>
  );
}
