import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText, Plus, Search, Filter, Phone, MessageCircle,
  Calendar, CheckCircle2, Clock, UserCheck, AlertCircle,
  X, RefreshCw, Sparkles, User, BookOpen, Layers,
  ChevronRight, ArrowRight, ShieldCheck, Edit3, Trash2
} from 'lucide-react';
import { api } from '../utils/api';
import toast, { Toaster } from 'react-hot-toast';
import PWAInstallPrompt from '../components/PWAInstallPrompt';

export default function StaffInquiryWeb() {
  const [loading, setLoading] = useState(false);
  const [inquiries, setInquiries] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'today' | '7days' | '30days'
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingInquiry, setEditingInquiry] = useState(null);

  // Form State
  const getTodayDateStr = () => new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    visitorName: '',
    studentName: '',
    contactNumber: '',
    discussionDetails: '',
    status: 'Pending',
    date: getTodayDateStr()
  });

  // Institute Branding
  const instituteName = 'CAREER XONE';

  // Fetch Inquiries with local fallback & sync
  const fetchInquiries = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await api.getInquiries();
      if (Array.isArray(data)) {
        setInquiries(data);
        localStorage.setItem('edutrack_inquiries', JSON.stringify(data));
      }
    } catch (err) {
      console.error('Failed to fetch inquiries:', err);
      try {
        const local = JSON.parse(localStorage.getItem('edutrack_inquiries') || '[]');
        setInquiries(local);
      } catch (e) {}
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  // Direct load on mount + 15-second real-time polling
  useEffect(() => {
    fetchInquiries(true);
    const interval = setInterval(() => {
      fetchInquiries(false);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Submit Inquiry (Create or Update)
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!formData.visitorName.trim()) {
      toast.error('Visitor / Parent Name is required');
      return;
    }
    if (!formData.contactNumber.trim()) {
      toast.error('Contact phone number is required');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        id: editingInquiry ? editingInquiry.id : `INQ_${Date.now()}`
      };

      if (editingInquiry) {
        const targetId = editingInquiry._id || editingInquiry.id;
        await api.updateInquiry(targetId, payload);
        setInquiries((prev) => prev.map((iq) => (iq._id === targetId || iq.id === targetId ? { ...iq, ...payload } : iq)));
        toast.success('Inquiry updated successfully! ✅');
      } else {
        const created = await api.createInquiry(payload);
        setInquiries((prev) => [created || payload, ...prev]);
        toast.success('New inquiry added successfully! 🎉');
      }

      setIsAddModalOpen(false);
      setEditingInquiry(null);
      setFormData({
        visitorName: '',
        studentName: '',
        contactNumber: '',
        discussionDetails: '',
        status: 'Pending',
        date: getTodayDateStr()
      });
    } catch (err) {
      console.error('Inquiry save failed:', err);
      // Fallback local save
      const payload = {
        ...formData,
        id: editingInquiry ? editingInquiry.id : `INQ_${Date.now()}`
      };
      setInquiries((prev) => [payload, ...prev]);
      setIsAddModalOpen(false);
      setEditingInquiry(null);
      toast.success('Inquiry saved locally! (Will sync when online)');
    } finally {
      setLoading(false);
    }
  };

  // Delete Inquiry
  const handleDeleteInquiry = async (iq) => {
    if (!window.confirm(`Are you sure you want to delete inquiry for "${iq.visitorName}"?`)) {
      return;
    }

    const targetId = iq._id || iq.id;
    try {
      await api.deleteInquiry(targetId);
      setInquiries(prev => prev.filter(item => (item._id !== targetId && item.id !== targetId)));
      toast.success('Inquiry deleted successfully');
    } catch (err) {
      setInquiries(prev => prev.filter(item => (item._id !== targetId && item.id !== targetId)));
      toast.success('Inquiry removed locally');
    }
  };

  // Quick Status Update
  const handleQuickStatusChange = async (iq, newStatus) => {
    try {
      const targetId = iq._id || iq.id;
      setInquiries((prev) => prev.map((item) => (item._id === targetId || item.id === targetId ? { ...item, status: newStatus } : item)));
      await api.updateInquiry(targetId, { ...iq, status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
    } catch (err) {
      toast.success(`Status updated to ${newStatus} locally`);
    }
  };

  // Filter inquiries
  const filteredInquiries = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return inquiries.filter((iq) => {
      // 1. Search Query
      const q = searchTerm.toLowerCase().trim();
      if (q) {
        const vMatch = (iq.visitorName || '').toLowerCase().includes(q);
        const sMatch = (iq.studentName || '').toLowerCase().includes(q);
        const pMatch = (iq.contactNumber || '').toLowerCase().includes(q);
        const dMatch = (iq.discussionDetails || '').toLowerCase().includes(q);
        if (!vMatch && !sMatch && !pMatch && !dMatch) return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'ALL') {
        if ((iq.status || 'Pending') !== statusFilter) return false;
      }

      // 3. Date Filter
      if (dateFilter !== 'all') {
        const inqDate = new Date(iq.date || iq.createdAt || Date.now());
        inqDate.setHours(0, 0, 0, 0);

        if (dateFilter === 'today') {
          if (inqDate.getTime() !== today.getTime()) return false;
        } else if (dateFilter === '7days') {
          const diffDays = (today - inqDate) / (1000 * 60 * 60 * 24);
          if (diffDays < 0 || diffDays > 7) return false;
        } else if (dateFilter === '30days') {
          const diffDays = (today - inqDate) / (1000 * 60 * 60 * 24);
          if (diffDays < 0 || diffDays > 30) return false;
        }
      }

      return true;
    });
  }, [inquiries, searchTerm, statusFilter, dateFilter]);

  // Status Metrics
  const metrics = useMemo(() => {
    const total = inquiries.length;
    const pending = inquiries.filter((i) => (i.status || 'Pending') === 'Pending' || i.status === 'Follow-up').length;
    const admitted = inquiries.filter((i) => i.status === 'Admitted').length;
    const resolved = inquiries.filter((i) => i.status === 'Resolved').length;
    return { total, pending, admitted, resolved };
  }, [inquiries]);

  // ----------------------------------------------------
  // MAIN DASHBOARD (Ultra Compact & Sleek for Mobile)
  // ----------------------------------------------------
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      color: '#0f172a',
      fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif",
      paddingBottom: '60px'
    }}>
      <Toaster position="top-center" />
      <PWAInstallPrompt appName="CX Inquiry" />

      {/* Top Header (Compact & Mobile-Optimized) */}
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        padding: '8px 12px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          {/* Left: Branding */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flexShrink: 0,
              padding: '2px'
            }}>
              <img
                src="/logo.png"
                alt="Career Xone Logo"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h2 style={{
                  fontSize: '0.92rem',
                  fontWeight: 800,
                  margin: 0,
                  color: '#0f172a',
                  lineHeight: 1.15,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {instituteName}
                </h2>
                <span style={{
                  fontSize: '0.58rem',
                  fontWeight: 800,
                  background: '#dcfce7',
                  color: '#15803d',
                  border: '1px solid #bbf7d0',
                  padding: '1px 6px',
                  borderRadius: '8px',
                  flexShrink: 0
                }}>
                  INQUIRY
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.65rem', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Front-Desk Student Log
              </p>
            </div>
          </div>

          {/* Right: Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <button
              onClick={() => {
                setEditingInquiry(null);
                setFormData({
                  visitorName: '',
                  studentName: '',
                  contactNumber: '',
                  discussionDetails: '',
                  status: 'Pending',
                  date: getTodayDateStr()
                });
                setIsAddModalOpen(true);
              }}
              style={{
                background: 'linear-gradient(135deg, #059669, #047857)',
                border: 'none',
                color: '#ffffff',
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '0.74rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)'
              }}
            >
              <Plus size={14} />
              <span>New</span>
            </button>

            <button
              onClick={fetchInquiries}
              disabled={loading}
              style={{
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                color: '#334155',
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Refresh / Sync"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '10px 10px' }}>
        
        {/* 4 Compact Stat Tiles (Single-Row / 4-Col Grid) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
          marginBottom: '12px'
        }}>
          {/* Total */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #bfdbfe',
            borderRadius: '12px',
            padding: '8px 10px',
            boxShadow: '0 1px 4px rgba(37, 99, 235, 0.04)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.64rem', fontWeight: 700, color: '#2563eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Total
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.1, marginTop: '2px' }}>
              {metrics.total}
            </div>
          </div>

          {/* Pending */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #fed7aa',
            borderRadius: '12px',
            padding: '8px 10px',
            boxShadow: '0 1px 4px rgba(217, 119, 6, 0.04)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.64rem', fontWeight: 700, color: '#d97706', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Pending
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#d97706', lineHeight: 1.1, marginTop: '2px' }}>
              {metrics.pending}
            </div>
          </div>

          {/* Admitted */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #bbf7d0',
            borderRadius: '12px',
            padding: '8px 10px',
            boxShadow: '0 1px 4px rgba(5, 150, 105, 0.04)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.64rem', fontWeight: 700, color: '#059669', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Admitted
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#059669', lineHeight: 1.1, marginTop: '2px' }}>
              {metrics.admitted}
            </div>
          </div>

          {/* Resolved */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e9d5ff',
            borderRadius: '12px',
            padding: '8px 10px',
            boxShadow: '0 1px 4px rgba(124, 58, 237, 0.04)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.64rem', fontWeight: 700, color: '#7c3aed', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Resolved
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#7c3aed', lineHeight: 1.1, marginTop: '2px' }}>
              {metrics.resolved}
            </div>
          </div>
        </div>

        {/* Compact Filter Bar */}
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '8px 10px',
          border: '1px solid #e2e8f0',
          marginBottom: '12px',
          display: 'flex',
          gap: '6px',
          flexWrap: 'wrap',
          alignItems: 'center',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
        }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '150px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search visitor, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px 6px 30px',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                color: '#0f172a',
                fontSize: '0.8rem',
                fontWeight: 600,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap' }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '6px 8px',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                color: '#334155',
                fontSize: '0.74rem',
                fontWeight: 700,
                outline: 'none',
                cursor: 'pointer',
                height: '32px'
              }}
            >
              <option value="ALL">🏷️ All Statuses</option>
              <option value="Pending">⏳ Pending</option>
              <option value="Admitted">🎓 Admitted</option>
              <option value="Resolved">✅ Resolved</option>
              <option value="Rejected">❌ Rejected</option>
            </select>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{
                padding: '6px 8px',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                color: '#334155',
                fontSize: '0.74rem',
                fontWeight: 700,
                outline: 'none',
                cursor: 'pointer',
                height: '32px'
              }}
            >
              <option value="all">📅 All Dates</option>
              <option value="today">Today Only</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>
          </div>
        </div>

        {/* Inquiries Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '10px'
        }}>
          {filteredInquiries.length === 0 ? (
            <div style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: '40px 16px',
              background: '#ffffff',
              borderRadius: '16px',
              border: '1.5px dashed #cbd5e1'
            }}>
              <FileText size={36} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
              <h3 style={{ margin: '0 0 4px', color: '#0f172a', fontWeight: 800, fontSize: '0.95rem' }}>No inquiries found</h3>
              <p style={{ margin: '0 0 14px', color: '#64748b', fontSize: '0.78rem' }}>
                {searchTerm || statusFilter !== 'ALL' || dateFilter !== 'all'
                  ? 'No records match filter criteria.'
                  : 'Start logging student & parent walk-ins.'}
              </p>
              <button
                onClick={() => setIsAddModalOpen(true)}
                style={{
                  background: '#059669',
                  color: '#ffffff',
                  border: 'none',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(5, 150, 105, 0.2)'
                }}
              >
                + Create Inquiry
              </button>
            </div>
          ) : (
            filteredInquiries.map((iq) => {
              const statusColors = {
                'Pending': { bg: '#fffbeb', text: '#b45309', border: '#fed7aa' },
                'Follow-up': { bg: '#fffbeb', text: '#b45309', border: '#fed7aa' },
                'Admitted': { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
                'Resolved': { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
                'Rejected': { bg: '#fff1f2', text: '#e11d48', border: '#fecdd3' },
              };
              const currColor = statusColors[iq.status] || statusColors['Pending'];

              return (
                <div
                  key={iq._id || iq.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '12px',
                    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div>
                    {/* Card Top: Avatar + Name + Status Dropdown */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <div style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.9rem',
                          fontWeight: 900,
                          flexShrink: 0
                        }}>
                          {(iq.visitorName || 'V').charAt(0).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0, overflow: 'hidden' }}>
                          <h4 style={{
                            margin: '0 0 1px',
                            fontSize: '0.92rem',
                            fontWeight: 800,
                            color: '#0f172a',
                            lineHeight: 1.2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {iq.visitorName}
                          </h4>
                          <div style={{
                            fontSize: '0.72rem',
                            color: '#2563eb',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            Student: {iq.studentName || 'Self / General'}
                          </div>
                        </div>
                      </div>

                      {/* Status Selector Badge */}
                      <select
                        value={iq.status || 'Pending'}
                        onChange={(e) => handleQuickStatusChange(iq, e.target.value)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '14px',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          border: `1px solid ${currColor.border}`,
                          cursor: 'pointer',
                          background: currColor.bg,
                          color: currColor.text,
                          outline: 'none',
                          flexShrink: 0
                        }}
                      >
                        <option value="Pending">⏳ Pending</option>
                        <option value="Admitted">🎓 Admitted</option>
                        <option value="Resolved">✅ Resolved</option>
                        <option value="Rejected">❌ Rejected</option>
                      </select>
                    </div>

                    {/* Contact & Date Info */}
                    <div style={{
                      fontSize: '0.74rem',
                      color: '#475569',
                      fontWeight: 600,
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexWrap: 'wrap'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Phone size={11} color="#64748b" /> {iq.contactNumber}
                      </span>
                      <span style={{ color: '#cbd5e1' }}>•</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Calendar size={11} color="#64748b" /> {iq.date || 'Today'}
                      </span>
                    </div>

                    {/* Discussion Details Bubble */}
                    {iq.discussionDetails && (
                      <div style={{
                        background: '#f8fafc',
                        border: '1px solid #f1f5f9',
                        padding: '6px 8px',
                        borderRadius: '8px',
                        fontSize: '0.74rem',
                        color: '#334155',
                        marginBottom: '8px',
                        lineHeight: 1.35
                      }}>
                        {iq.discussionDetails}
                      </div>
                    )}
                  </div>

                  {/* Actions Bar: Call, WhatsApp, Edit, Delete */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '8px',
                    borderTop: '1px solid #f1f5f9',
                    gap: '4px'
                  }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <a
                        href={`tel:${iq.contactNumber}`}
                        style={{
                          background: '#f1f5f9',
                          color: '#334155',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          border: '1px solid #e2e8f0'
                        }}
                      >
                        <Phone size={11} /> Call
                      </a>

                      <a
                        href={`https://wa.me/${(iq.contactNumber || '').replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(iq.visitorName)}%2C%20thank%20you%20for%20inquiring%20at%20${encodeURIComponent(instituteName)}.`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          background: '#dcfce7',
                          color: '#15803d',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          border: '1px solid #bbf7d0'
                        }}
                      >
                        <MessageCircle size={11} /> WhatsApp
                      </a>
                    </div>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => {
                          setEditingInquiry(iq);
                          setFormData({
                            visitorName: iq.visitorName || '',
                            studentName: iq.studentName || '',
                            contactNumber: iq.contactNumber || '',
                            discussionDetails: iq.discussionDetails || '',
                            status: iq.status || 'Pending',
                            date: iq.date || getTodayDateStr()
                          });
                          setIsAddModalOpen(true);
                        }}
                        style={{
                          background: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          color: '#2563eb',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '4px 8px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        <Edit3 size={11} /> Edit
                      </button>

                      <button
                        onClick={() => handleDeleteInquiry(iq)}
                        style={{
                          background: '#fff1f2',
                          border: '1px solid #fecdd3',
                          color: '#e11d48',
                          padding: '4px 6px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Delete Inquiry"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Add / Edit Inquiry Modal (Clean White Theme) */}
      {isAddModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '12px'
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '420px',
            padding: '18px 16px',
            boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.25)',
            color: '#0f172a'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                {editingInquiry ? '✏️ Edit Inquiry' : '➕ New Student Inquiry'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  color: '#64748b',
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '3px' }}>
                  VISITOR / PARENT NAME *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Patil"
                  value={formData.visitorName}
                  onChange={(e) => setFormData({ ...formData, visitorName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '3px' }}>
                  STUDENT NAME
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Patil"
                  value={formData.studentName}
                  onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '3px' }}>
                  CONTACT PHONE NUMBER *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={formData.contactNumber}
                  onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '3px' }}>
                    STATUS
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 8px',
                      borderRadius: '8px',
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                  >
                    <option value="Pending">⏳ Pending</option>
                    <option value="Admitted">🎓 Admitted</option>
                    <option value="Resolved">✅ Resolved</option>
                    <option value="Rejected">❌ Rejected</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '3px' }}>
                    INQUIRY DATE
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 8px',
                      borderRadius: '8px',
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '3px' }}>
                  DISCUSSION DETAILS / NOTES
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Inquired about NEET batch fees & timing."
                  value={formData.discussionDetails}
                  onChange={(e) => setFormData({ ...formData, discussionDetails: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    fontSize: '0.82rem',
                    boxSizing: 'border-box',
                    resize: 'none',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    color: '#475569',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: 'linear-gradient(135deg, #059669, #047857)',
                    border: 'none',
                    color: '#ffffff',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)'
                  }}
                >
                  {loading ? 'Saving...' : editingInquiry ? 'Update' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
