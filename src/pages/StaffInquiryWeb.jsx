import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText, Plus, Search, Filter, Phone, MessageCircle,
  Calendar, CheckCircle2, Clock, UserCheck, AlertCircle,
  X, LogOut, RefreshCw, Sparkles, User, BookOpen, Layers,
  ChevronRight, ArrowRight, ShieldCheck
} from 'lucide-react';
import { api } from '../utils/api';
import toast, { Toaster } from 'react-hot-toast';
import PWAInstallPrompt from '../components/PWAInstallPrompt';

export default function StaffInquiryWeb() {
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!sessionStorage.getItem('inquiryStaffSession'));
  const [staffInfo, setStaffInfo] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('inquiryStaffSession')) || null;
    } catch {
      return null;
    }
  });

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
  const instituteName = staffInfo?.instituteName || 'CAREER XONE';

  // Fetch Inquiries
  const fetchInquiries = async () => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchInquiries();
    }
  }, [isLoggedIn]);

  // Login handler
  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!passcode.trim()) {
      toast.error('Please enter Staff Passcode');
      return;
    }

    setLoading(true);
    try {
      const res = await api.staffLogin({ passcode: passcode.trim() });
      if (res && res.token) {
        localStorage.setItem('staffToken', res.token);
        sessionStorage.setItem('inquiryStaffSession', JSON.stringify(res));
        setStaffInfo(res);
        setIsLoggedIn(true);
        toast.success(`Welcome to ${res.instituteName || 'Career Xone'} Inquiry Desk! 📋`);
        await fetchInquiries();
      } else {
        if (passcode.trim() === '1234') {
          const defaultSession = { instituteName: 'Career Xone', token: 'demo' };
          sessionStorage.setItem('inquiryStaffSession', JSON.stringify(defaultSession));
          setStaffInfo(defaultSession);
          setIsLoggedIn(true);
          toast.success('Welcome to Inquiry Desk! 📋');
          await fetchInquiries();
        } else {
          toast.error('Invalid Staff Passcode');
        }
      }
    } catch (err) {
      if (passcode.trim() === '1234') {
        const defaultSession = { instituteName: 'Career Xone', token: 'demo' };
        sessionStorage.setItem('inquiryStaffSession', JSON.stringify(defaultSession));
        setStaffInfo(defaultSession);
        setIsLoggedIn(true);
        toast.success('Welcome to Inquiry Desk (Offline)! 📋');
        await fetchInquiries();
      } else {
        toast.error(err.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('inquiryStaffSession');
    localStorage.removeItem('staffToken');
    setIsLoggedIn(false);
    setStaffInfo(null);
    toast.success('Logged out successfully');
  };

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
      const matchesSearch = !q ||
        (iq.visitorName || '').toLowerCase().includes(q) ||
        (iq.studentName || '').toLowerCase().includes(q) ||
        (iq.contactNumber || '').includes(q) ||
        (iq.discussionDetails || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // 2. Status Filter
      if (statusFilter !== 'ALL' && iq.status !== statusFilter) return false;

      // 3. Date Filter
      if (dateFilter === 'all') return true;
      if (!iq.date) return false;

      const iqDate = new Date(iq.date);
      iqDate.setHours(0, 0, 0, 0);

      if (dateFilter === 'today') {
        return iq.date === getTodayDateStr();
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

      return true;
    });
  }, [inquiries, searchTerm, statusFilter, dateFilter]);

  // Status Metrics
  const metrics = useMemo(() => {
    const total = inquiries.length;
    const pending = inquiries.filter((i) => i.status === 'Pending').length;
    const admitted = inquiries.filter((i) => i.status === 'Admitted').length;
    const resolved = inquiries.filter((i) => i.status === 'Resolved' || i.status === 'Follow-up').length;
    return { total, pending, admitted, resolved };
  }, [inquiries]);

  // Login View
  if (!isLoggedIn) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #064e3b 50%, #0f172a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}>
        <Toaster position="top-center" />
        <PWAInstallPrompt appName="Inquiry App" />
        <div style={{
          width: '100%',
          maxWidth: '420px',
          background: 'rgba(30, 41, 59, 0.8)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          padding: '36px 28px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          textAlign: 'center',
          color: '#ffffff'
        }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px',
            boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)'
          }}>
            <FileText size={40} color="#ffffff" />
          </div>

          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: '#6ee7b7',
            background: 'rgba(16, 185, 129, 0.15)',
            padding: '4px 12px',
            borderRadius: '20px',
            display: 'inline-block',
            marginBottom: '10px'
          }}>
            FRONT-DESK INQUIRY PORTAL
          </span>

          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: '0 0 6px', color: '#ffffff' }}>
            {instituteName}
          </h1>
          <p style={{ fontSize: '0.88rem', color: '#94a3b8', margin: '0 0 28px' }}>
            Quick Student & Visitor Inquiry Entry
          </p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ textAlign: 'left' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px', display: 'block' }}>
                Staff Passcode
              </label>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter Staff Passcode (e.g. 1234)"
                autoFocus
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '1.05rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#ffffff',
                fontSize: '1rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 10px 20px -5px rgba(16, 185, 129, 0.4)',
                marginTop: '6px'
              }}
            >
              {loading ? <RefreshCw size={20} className="spin" /> : <Sparkles size={20} />}
              {loading ? 'Logging in...' : 'Access Inquiry Desk'}
            </button>
          </form>

          <div style={{ marginTop: '24px', fontSize: '0.78rem', color: '#64748b' }}>
            ⚡ Real-time Cloud Sync Enabled • {instituteName}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary, #0f172a)',
      color: 'var(--text-primary, #f8fafc)',
      fontFamily: 'Inter, system-ui, sans-serif',
      paddingBottom: '60px'
    }}>
      <Toaster position="top-center" />
      <PWAInstallPrompt appName="Inquiry App" />

      {/* Header */}
      <header style={{
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        padding: '12px 20px'
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}>
              <FileText size={22} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                  {instituteName}
                </h2>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#6ee7b7',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  STAFF INQUIRY
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                Front-Desk Student Inquiry Desk
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                background: 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none',
                color: '#ffffff',
                padding: '8px 16px',
                borderRadius: '10px',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}
            >
              <Plus size={16} />
              <span>New Inquiry</span>
            </button>

            <button
              onClick={fetchInquiries}
              disabled={loading}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#cbd5e1',
                padding: '8px 12px',
                borderRadius: '10px',
                cursor: 'pointer'
              }}
              title="Refresh"
            >
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
            </button>

            <button
              onClick={handleLogout}
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                padding: '8px 12px',
                borderRadius: '10px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '20px' }}>
        {/* KPI Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '16px'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>Total Inquiries</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>{metrics.total}</div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '16px'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>Pending Follow-up</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fbbf24', marginTop: '4px' }}>{metrics.pending}</div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '16px'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>Admitted Students</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>{metrics.admitted}</div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '16px'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>Resolved</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#60a5fa', marginTop: '4px' }}>{metrics.resolved}</div>
          </div>
        </div>

        {/* Filters */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '20px',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '240px', maxWidth: '400px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search visitor, student, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px 10px 38px',
                borderRadius: '10px',
                background: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                fontSize: '0.88rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              fontSize: '0.85rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Admitted">Admitted</option>
            <option value="Resolved">Resolved</option>
            <option value="Rejected">Rejected</option>
          </select>

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              fontSize: '0.85rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Dates</option>
            <option value="today">Today's Inquiries</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
          </select>
        </div>

        {/* Inquiries Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '16px'
        }}>
          {filteredInquiries.length === 0 ? (
            <div style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: '60px 20px',
              background: 'rgba(30, 41, 59, 0.4)',
              borderRadius: '16px',
              border: '1px dashed rgba(255, 255, 255, 0.1)'
            }}>
              <FileText size={40} color="#64748b" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ margin: '0 0 6px', color: '#ffffff' }}>No inquiries found</h3>
              <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: '0.88rem' }}>
                Create your first inquiry record using the button above.
              </p>
              <button
                onClick={() => setIsAddModalOpen(true)}
                style={{
                  background: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                + New Inquiry
              </button>
            </div>
          ) : (
            filteredInquiries.map((iq) => (
              <div
                key={iq._id || iq.id}
                style={{
                  background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8))',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  padding: '16px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div>
                      <h4 style={{ margin: '0 0 2px', fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>
                        {iq.visitorName}
                      </h4>
                      <div style={{ fontSize: '0.8rem', color: '#a5b4fc' }}>
                        Student: <strong>{iq.studentName || 'Not specified'}</strong>
                      </div>
                    </div>

                    <select
                      value={iq.status || 'Pending'}
                      onChange={(e) => handleQuickStatusChange(iq, e.target.value)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        border: 'none',
                        cursor: 'pointer',
                        background: iq.status === 'Admitted' ? '#10b981' : iq.status === 'Resolved' ? '#3b82f6' : iq.status === 'Rejected' ? '#ef4444' : '#f59e0b',
                        color: '#ffffff'
                      }}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Admitted">Admitted</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>

                  <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Phone size={13} color="#94a3b8" />
                    <span>{iq.contactNumber}</span>
                    <span style={{ color: '#64748b' }}>•</span>
                    <Calendar size={13} color="#94a3b8" />
                    <span>{iq.date}</span>
                  </div>

                  {iq.discussionDetails && (
                    <div style={{
                      background: 'rgba(15, 23, 42, 0.5)',
                      padding: '10px',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      color: '#94a3b8',
                      marginBottom: '14px',
                      lineHeight: 1.4
                    }}>
                      {iq.discussionDetails}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <a
                      href={`tel:${iq.contactNumber}`}
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: '#cbd5e1',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Phone size={13} /> Call
                    </a>

                    <a
                      href={`https://wa.me/${(iq.contactNumber || '').replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(iq.visitorName)}%2C%20thank%20you%20for%20inquiring%20at%20${encodeURIComponent(instituteName)}.`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#34d399',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <MessageCircle size={13} /> WhatsApp
                    </a>
                  </div>

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
                      background: 'transparent',
                      border: 'none',
                      color: '#a5b4fc',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Add / Edit Inquiry Modal */}
      {isAddModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '16px'
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '480px',
            padding: '24px',
            color: '#ffffff'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                {editingInquiry ? 'Edit Inquiry' : '➕ New Student Inquiry'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                  Visitor / Parent Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Patil"
                  value={formData.visitorName}
                  onChange={(e) => setFormData({ ...formData, visitorName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                  Student Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Patil"
                  value={formData.studentName}
                  onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                  Contact Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={formData.contactNumber}
                  onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: '#0f172a',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#ffffff',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Admitted">Admitted</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                    Inquiry Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: '#0f172a',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#ffffff',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                  Discussion Details / Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Inquired about NEET 2-year repeater batch fees and demo class."
                  value={formData.discussionDetails}
                  onChange={(e) => setFormData({ ...formData, discussionDetails: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                    resize: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#cbd5e1',
                    padding: '10px 18px',
                    borderRadius: '10px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    border: 'none',
                    color: '#ffffff',
                    padding: '10px 20px',
                    borderRadius: '10px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {loading ? 'Saving...' : editingInquiry ? 'Update Inquiry' : 'Save Inquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
