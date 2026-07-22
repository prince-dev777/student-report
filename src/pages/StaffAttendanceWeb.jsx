import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, CheckCircle2, XCircle, Clock, Search, Filter, 
  Calendar, RefreshCw, LogOut, LogIn, CheckCheck, UserCheck, ShieldAlert 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../utils/api';

export default function StaffAttendanceWeb() {
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [batchFilter, setBatchFilter] = useState('ALL');
  const [savingId, setSavingId] = useState(null);

  // PWA Home Screen Install State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(true);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    setIsStandalone(!!checkStandalone);

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          toast.success('🎉 Staff App installed successfully!');
          setShowInstallBanner(false);
        }
      } catch(e) {}
      setDeferredPrompt(null);
    } else {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        toast('📱 Mobile Install: Browser Menu (⋮ or Share) ➔ "Add to Home Screen"', {
          icon: '📱',
          duration: 8000
        });
      } else {
        toast('💻 Laptop Install: Look at Address Bar ➔ Click (⊕) Install App icon OR Chrome Menu (⋮) ➔ Save & Share ➔ Install App', {
          icon: '💻',
          duration: 9000
        });
      }
    }
  };

  // Passcode Auth with Backend Token
  const [passcode, setPasscode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(
    sessionStorage.getItem('staff_authed') === 'true'
  );

  const handleLogin = async (e) => {
    e.preventDefault();
    const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isLocalHost ? 'http://localhost:5001/api' : 'https://student-report-ezgw.onrender.com/api';

    try {
      const res = await fetch(`${baseUrl}/auth/staff-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.token) localStorage.setItem('staff_token', data.token);
        if (data.logo) localStorage.setItem('institute_logo', data.logo);
        if (data.instituteName) localStorage.setItem('institute_name', data.instituteName);
        setIsAuthenticated(true);
        sessionStorage.setItem('staff_authed', 'true');
        toast.success(`Welcome to Staff Portal! (${data.instituteName || 'Career Xone'})`);
        return;
      }
    } catch(err) {}

    // Fallback to local passcode check
    const storedCode = localStorage.getItem('staff_passcode') || '1234';
    if (passcode.trim() === storedCode.trim()) {
      setIsAuthenticated(true);
      sessionStorage.setItem('staff_authed', 'true');
      toast.success('Welcome to Staff Attendance Portal!');
    } else {
      toast.error('Invalid Staff Access Passcode!');
    }
  };

  // Fetch students and attendance on date change with robust fallbacks
  const fetchData = async () => {
    setLoading(true);
    try {
      let stdData = [];
      let attData = [];
      
      const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const baseUrl = isLocalHost ? 'http://localhost:5001/api' : 'https://student-report-ezgw.onrender.com/api';
      
      const token = localStorage.getItem('staff_token') || localStorage.getItem('token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      try {
        const resStd = await fetch(`${baseUrl}/staff/students`, { headers });
        if (resStd.ok) stdData = await resStd.json();

        const resAtt = await fetch(`${baseUrl}/staff/attendance`, { headers });
        if (resAtt.ok) attData = await resAtt.json();
      } catch(e) {
        console.warn('Backend API fetch failed, switching to localStorage fallback...');
      }

      // Fallback to localStorage if API returned empty/failed
      if (!stdData || stdData.length === 0) {
        const savedStudents = localStorage.getItem('students');
        if (savedStudents) {
          try { stdData = JSON.parse(savedStudents); } catch(e) {}
        }
      }

      if (!attData || attData.length === 0) {
        const savedAtt = localStorage.getItem('attendance');
        if (savedAtt) {
          try { attData = JSON.parse(savedAtt); } catch(e) {}
        }
      }

      // Deduplicate student records by ID/RollNo
      if (stdData && stdData.length > 0) {
        const seen = new Set();
        stdData = stdData.filter(s => {
          const key = s.id || `${s.rollNo}_${s.name}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }

      setStudents(stdData || []);
      setAttendance(attData || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load student data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0f172a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Inter', sans-serif", padding: '20px'
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            background: 'rgba(30, 41, 59, 0.7)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '24px',
            padding: '36px',
            maxWidth: '400px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            color: '#f8fafc'
          }}
        >
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <UserCheck size={28} />
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '6px' }}>Staff Portal</h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '24px' }}>
            Enter your Staff Access Passcode to unlock Attendance Management
          </p>

          <form onSubmit={handleLogin}>
            <input
              type="password"
              placeholder="Enter Passcode (e.g. 1234)"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              autoFocus
              style={{
                width: '100%', padding: '12px 16px',
                borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(15, 23, 42, 0.6)', color: '#ffffff',
                fontSize: '1rem', textAlign: 'center', letterSpacing: '4px',
                outline: 'none', marginBottom: '16px'
              }}
            />

            <button
              type="submit"
              style={{
                width: '100%', padding: '12px 20px',
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                color: '#ffffff', border: 'none', borderRadius: '12px',
                fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)'
              }}
            >
              Unlock Staff Portal
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // Filter attendance for the selected date
  const dayRecords = attendance.filter(record => {
    if (!record.date && !record.timestamp) return false;
    const recDate = (record.date || record.timestamp).substring(0, 10);
    return recDate === selectedDate;
  });

  // Get student's status for the selected date
  const getStudentStatus = (studentId) => {
    const studentRecords = dayRecords.filter(r => r.studentId === studentId);
    if (studentRecords.length === 0) return { status: 'UNMARKED', time: '' };

    const lastRec = studentRecords[studentRecords.length - 1];
    let st = (lastRec.status || 'UNMARKED').toUpperCase();

    if (st === 'PRESENT' || st === 'CHECKED_IN') st = 'IN';
    if (st === 'CHECKED_OUT') st = 'OUT';

    const formatTime = (ts) => ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    return { 
      status: st,
      time: formatTime(lastRec.timestamp)
    };
  };

  // Mark student attendance (IN = Check In, OUT = Check Out, ABSENT = Absent)
  const handleMarkStatus = async (student, status) => {
    setSavingId(student.id);
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
    const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const record = {
      studentId: student.id,
      date: selectedDate,
      timestamp: `${selectedDate}T${timeStr}:00`,
      status: status,
      method: 'MANUAL_STAFF',
    };

    try {
      const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const baseUrl = isLocalHost ? 'http://localhost:5001/api' : 'https://student-report-ezgw.onrender.com/api';
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      try {
        await fetch(`${baseUrl}/staff/attendance`, {
          method: 'POST',
          headers,
          body: JSON.stringify(record)
        });
      } catch(e) {
        console.warn('Backend markAttendance API failed, saving to localStorage...');
      }

      // Update local state & localStorage
      setAttendance(prev => {
        const filtered = prev.filter(r => !(r.studentId === student.id && (r.date || r.timestamp).substring(0, 10) === selectedDate));
        const updated = [...filtered, record];
        try { localStorage.setItem('attendance', JSON.stringify(updated)); } catch(e) {}
        return updated;
      });

      const label = status === 'IN' ? 'Checked In' : status === 'OUT' ? 'Checked Out' : 'Marked Absent';
      toast.success(`${student.name}: ${label} at ${formattedTime}`);
    } catch (err) {
      toast.error('Failed to save attendance');
    } finally {
      setSavingId(null);
    }
  };

  // Mark all unmarked students as Checked-In
  const handleMarkAllPresent = async () => {
    const confirmMark = window.confirm(`Are you sure you want to Check In all unmarked students for ${selectedDate}?`);
    if (!confirmMark) return;

    const unmarked = students.filter(s => getStudentStatus(s.id).status === 'UNMARKED');
    if (unmarked.length === 0) {
      toast.error('All students are already marked for today!');
      return;
    }

    toast.loading(`Checking in ${unmarked.length} students...`, { id: 'bulk' });
    let count = 0;
    for (const student of unmarked) {
      try {
        await handleMarkStatus(student, 'IN');
        count++;
      } catch (e) {}
    }
    toast.success(`Successfully Checked In ${count} students!`, { id: 'bulk' });
  };

  // Stats calculation
  const totalStudents = students.length;
  let checkedInCount = 0;
  let checkedOutCount = 0;
  let absentCount = 0;

  students.forEach(s => {
    const st = getStudentStatus(s.id).status;
    if (st === 'IN' || st === 'PRESENT') checkedInCount++;
    else if (st === 'OUT') checkedOutCount++;
    else if (st === 'ABSENT') absentCount++;
  });

  const unmarkedCount = totalStudents - (checkedInCount + checkedOutCount + absentCount);
  const attendancePercentage = totalStudents > 0 ? Math.round((checkedInCount / totalStudents) * 100) : 0;

const BATCH_MAP = {
  'batch-4': 'JEE Mains',
  'batch-1': 'JEE Advanced',
  'batch-2': 'NEET',
  'batch-3': 'MHCET',
};

const getBatchName = (batch) => {
  if (!batch) return 'Default';
  return BATCH_MAP[batch] || batch;
};

  // Filtered student list & Batch Resolution
  const defaultBatchNames = ['JEE Mains', 'JEE Advanced', 'NEET', 'MHCET'];
  const studentBatchNames = students.map(s => getBatchName(s.batch));
  const availableBatches = Array.from(new Set([...defaultBatchNames, ...studentBatchNames])).filter(Boolean);

  const filteredStudents = students.filter(student => {
    const nameMatch = (student.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const rollMatch = (student.rollNo || '').toLowerCase().includes(searchQuery.toLowerCase());
    const phoneMatch = (student.parentPhone || '').includes(searchQuery);
    const matchesSearch = nameMatch || rollMatch || phoneMatch;

    const studentBatchName = getBatchName(student.batch);
    const matchesBatch = 
      batchFilter === 'ALL' || 
      studentBatchName === batchFilter || 
      student.batch === batchFilter;

    const currentStatus = getStudentStatus(student.id).status;
    const matchesStatus = 
      statusFilter === 'ALL' ||
      (statusFilter === 'PRESENT' && (currentStatus === 'PRESENT' || currentStatus === 'IN')) ||
      (statusFilter === 'ABSENT' && currentStatus === 'ABSENT') ||
      (statusFilter === 'LATE' && currentStatus === 'LATE') ||
      (statusFilter === 'UNMARKED' && currentStatus === 'UNMARKED');

    return matchesSearch && matchesBatch && matchesStatus;
  });

  const instituteLogo = localStorage.getItem('institute_logo') || localStorage.getItem('logo');
  const instituteName = localStorage.getItem('institute_name') || 'Career Xone';

  return (
    <div style={styles.container}>
      {/* PWA Home Screen Install Banner */}
      {!isStandalone && showInstallBanner && (
        <div style={{
          background: 'linear-gradient(135deg, #1e293b, #0f172a)',
          color: '#f8fafc', padding: '10px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '12px', fontSize: '0.82rem', borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>💻📱</span>
            <div>
              <strong style={{ display: 'block', lineHeight: '1.2' }}>Install Staff App (Laptop & Mobile)</strong>
              <span style={{ color: '#94a3b8', fontSize: '0.73rem' }}>
                Create Desktop / Home Screen Shortcut App Icon for 1-tap launch!
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              onClick={handleInstallApp}
              style={{
                background: '#2563eb', color: '#fff', border: 'none',
                padding: '6px 12px', borderRadius: '8px', fontWeight: 600,
                fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap'
              }}
            >
              Add to Home Screen
            </button>
            <button
              onClick={() => setShowInstallBanner(false)}
              style={{ background: 'transparent', color: '#94a3b8', border: 'none', cursor: 'pointer', fontSize: '0.9rem', padding: '4px' }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Top Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          {instituteLogo ? (
            <img 
              src={instituteLogo} 
              alt="Institute Logo" 
              style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover', border: '1px solid #cbd5e1' }}
            />
          ) : (
            <div style={styles.logoBadge}>
              <UserCheck size={20} color="#2563eb" />
            </div>
          )}
          <div>
            <h1 style={styles.headerTitle}>{instituteName} — Staff Portal</h1>
            <p style={styles.headerSubtitle}>Manual Attendance Management</p>
          </div>
        </div>

        <div style={styles.headerRight}>
          <div style={styles.datePickerWrapper}>
            <Calendar size={16} color="#64748b" />
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              style={styles.dateInput}
            />
          </div>

          <button onClick={fetchData} style={styles.refreshBtn} title="Refresh Data">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={styles.main}>
      {/* Responsive CSS for Laptop (4-Col Full) vs Mobile (2x2 Compact) */}
      <style>{`
        .staff-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .staff-stat-card {
          background: #ffffff;
          padding: 16px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          gap: 14px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.03);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .staff-stat-icon {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .staff-stat-label {
          font-size: 0.78rem;
          color: #64748b;
          font-weight: 500;
          display: block;
        }
        .staff-stat-value {
          font-size: 1.4rem;
          font-weight: 800;
          margin: 0;
          color: #0f172a;
          line-height: 1.2;
        }

        @media (max-width: 768px) {
          .staff-stats-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            margin-bottom: 14px;
          }
          .staff-stat-card {
            padding: 8px 10px;
            gap: 8px;
            border-radius: 10px;
          }
          .staff-stat-icon {
            width: 32px;
            height: 32px;
            border-radius: 8px;
          }
          .staff-stat-label {
            font-size: 0.72rem !important;
          }
          .staff-stat-value {
            font-size: 1.1rem !important;
          }
        }
      `}</style>

      {/* Interactive Responsive Stats Grid */}
      <div className="staff-stats-grid">
        {/* Total Card */}
        <div 
          onClick={() => setStatusFilter('ALL')}
          title="Click to view All Students"
          className="staff-stat-card"
          style={{ 
            borderLeft: '4px solid #2563eb',
            boxShadow: statusFilter === 'ALL' ? '0 0 0 2px #2563eb' : '0 2px 8px rgba(0,0,0,0.03)',
            background: statusFilter === 'ALL' ? 'rgba(37,99,235,0.06)' : '#ffffff'
          }}
        >
          <div className="staff-stat-icon" style={{ background: 'rgba(37,99,235,0.08)' }}>
            <Users size={20} color="#2563eb" />
          </div>
          <div>
            <span className="staff-stat-label">Total Students</span>
            <h3 className="staff-stat-value">{totalStudents}</h3>
          </div>
        </div>

        {/* Present Card */}
        <div 
          onClick={() => setStatusFilter('PRESENT')}
          title="Click to view Present Students"
          className="staff-stat-card"
          style={{ 
            borderLeft: '4px solid #059669',
            boxShadow: statusFilter === 'PRESENT' ? '0 0 0 2px #059669' : '0 2px 8px rgba(0,0,0,0.03)',
            background: statusFilter === 'PRESENT' ? 'rgba(5,150,105,0.06)' : '#ffffff'
          }}
        >
          <div className="staff-stat-icon" style={{ background: 'rgba(5,150,105,0.08)' }}>
            <CheckCircle2 size={20} color="#059669" />
          </div>
          <div>
            <span className="staff-stat-label">Present Today</span>
            <h3 className="staff-stat-value">{presentCount} <small style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 600 }}>({attendancePercentage}%)</small></h3>
          </div>
        </div>

        {/* Absent Card */}
        <div 
          onClick={() => setStatusFilter('ABSENT')}
          title="Click to view Absent Students"
          className="staff-stat-card"
          style={{ 
            borderLeft: '4px solid #dc2626',
            boxShadow: statusFilter === 'ABSENT' ? '0 0 0 2px #dc2626' : '0 2px 8px rgba(0,0,0,0.03)',
            background: statusFilter === 'ABSENT' ? 'rgba(220,38,38,0.06)' : '#ffffff'
          }}
        >
          <div className="staff-stat-icon" style={{ background: 'rgba(220,38,38,0.08)' }}>
            <XCircle size={20} color="#dc2626" />
          </div>
          <div>
            <span className="staff-stat-label">Absent</span>
            <h3 className="staff-stat-value">{absentCount}</h3>
          </div>
        </div>

        {/* Unmarked Card */}
        <div 
          onClick={() => setStatusFilter('UNMARKED')}
          title="Click to view Unmarked Students"
          className="staff-stat-card"
          style={{ 
            borderLeft: '4px solid #d97706',
            boxShadow: statusFilter === 'UNMARKED' ? '0 0 0 2px #d97706' : '0 2px 8px rgba(0,0,0,0.03)',
            background: statusFilter === 'UNMARKED' ? 'rgba(217,119,6,0.06)' : '#ffffff'
          }}
        >
          <div className="staff-stat-icon" style={{ background: 'rgba(217,119,6,0.08)' }}>
            <Clock size={20} color="#d97706" />
          </div>
          <div>
            <span className="staff-stat-label">Unmarked</span>
            <h3 className="staff-stat-value">{unmarkedCount}</h3>
          </div>
        </div>
      </div>

        {/* Controls & Search Bar */}
        <div style={styles.controlsBar}>
          <div style={styles.searchWrapper}>
            <Search size={18} color="#94a3b8" style={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search by student name, roll no, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
          </div>

          <div style={styles.filtersWrapper}>
            {/* Batch Filter */}
            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              style={styles.selectInput}
            >
              <option value="ALL">All Batches</option>
              {availableBatches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={styles.selectInput}
            >
              <option value="ALL">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="LATE">Late</option>
              <option value="UNMARKED">Unmarked</option>
            </select>

            {/* Bulk Action Button */}
            <button
              onClick={handleMarkAllPresent}
              disabled={unmarkedCount === 0}
              style={{
                ...styles.bulkBtn,
                opacity: unmarkedCount === 0 ? 0.5 : 1,
                cursor: unmarkedCount === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              <CheckCheck size={16} />
              <span>Mark All Present</span>
            </button>
          </div>
        </div>

        {/* Student Attendance Cards */}
        {loading ? (
          <div style={styles.centerLoading}>
            <RefreshCw size={32} color="#2563eb" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: 12, color: '#64748b' }}>Loading student list...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div style={styles.centerEmpty}>
            <ShieldAlert size={40} color="#94a3b8" />
            <h4 style={{ margin: '12px 0 4px', color: '#334155' }}>No students found</h4>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Try clearing filters or search term</p>
          </div>
        ) : (
          <div style={styles.studentListGrid}>
            {filteredStudents.map(student => {
              const { status, time } = getStudentStatus(student.id);
              const isSaving = savingId === student.id;

              return (
                <motion.div
                  key={student.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={styles.studentCard}
                >
                  <div style={styles.cardHeader}>
                    <div style={styles.studentAvatar}>
                      {student.name?.substring(0, 2).toUpperCase() || 'ST'}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={styles.studentName} title={student.name}>
                        {student.name}
                      </h4>
                      <div style={styles.studentMeta}>
                        <span>Roll: {student.rollNo || 'N/A'}</span>
                        <span>•</span>
                        <span style={{ fontWeight: 600, color: '#2563eb' }}>{getBatchName(student.batch)}</span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div style={styles.statusBadge(status)}>
                      {status === 'IN' || status === 'PRESENT' ? '🟢 CHECKED IN' :
                       status === 'OUT' ? '🔵 CHECKED OUT' :
                       status === 'ABSENT' ? '🔴 ABSENT' : '⏳ UNMARKED'}
                      {time && <span style={{ fontSize: '0.7rem', opacity: 0.85, display: 'block' }}>{time}</span>}
                    </div>
                  </div>

                  {/* Actions: Check In, Check Out, Absent */}
                  <div style={styles.cardActions}>
                    <button
                      onClick={() => handleMarkStatus(student, 'IN')}
                      disabled={isSaving}
                      style={{
                        ...styles.actionBtn,
                        background: status === 'IN' || status === 'PRESENT' ? 'linear-gradient(135deg, #059669, #047857)' : '#f0fdf4',
                        color: status === 'IN' || status === 'PRESENT' ? '#ffffff' : '#059669',
                        border: '1px solid #bbf7d0',
                        fontWeight: 700
                      }}
                    >
                      <LogIn size={15} />
                      Check In
                    </button>

                    <button
                      onClick={() => handleMarkStatus(student, 'OUT')}
                      disabled={isSaving}
                      style={{
                        ...styles.actionBtn,
                        background: status === 'OUT' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : '#f0f9ff',
                        color: status === 'OUT' ? '#ffffff' : '#0284c7',
                        border: '1px solid #bae6fd',
                        fontWeight: 700
                      }}
                    >
                      <LogOut size={15} />
                      Check Out
                    </button>

                    <button
                      onClick={() => handleMarkStatus(student, 'ABSENT')}
                      disabled={isSaving}
                      style={{
                        ...styles.actionBtn,
                        background: status === 'ABSENT' ? '#dc2626' : '#fef2f2',
                        color: status === 'ABSENT' ? '#ffffff' : '#dc2626',
                        border: '1px solid #fecaca',
                        fontWeight: 700
                      }}
                    >
                      <XCircle size={15} />
                      Absent
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

// Custom inline CSS styles for clean responsive layout
const styles = {
  container: {
    minHeight: '100vh',
    background: '#f8fafc',
    color: '#0f172a',
    fontFamily: "'Inter', sans-serif",
    paddingBottom: '40px'
  },
  header: {
    background: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  logoBadge: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    background: 'rgba(37,99,235,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: {
    fontSize: '1.2rem',
    fontWeight: 700,
    margin: 0,
    color: '#0f172a'
  },
  headerSubtitle: {
    fontSize: '0.8rem',
    color: '#64748b',
    margin: 0
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  datePickerWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: '#f1f5f9',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    padding: '6px 12px'
  },
  dateInput: {
    border: 'none',
    background: 'transparent',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#0f172a',
    outline: 'none',
    cursor: 'pointer'
  },
  refreshBtn: {
    background: '#f1f5f9',
    border: '1px solid #cbd5e1',
    borderRadius: '10px',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#475569'
  },
  main: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '12px 12px 32px'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '6px',
    marginBottom: '10px'
  },
  statCard: {
    background: '#ffffff',
    padding: '7px 10px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '4px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
  },
  statLabel: {
    fontSize: '0.72rem',
    color: '#64748b',
    fontWeight: 600
  },
  statValue: {
    fontSize: '1rem',
    fontWeight: 800,
    margin: 0,
    color: '#0f172a',
    lineHeight: 1
  },
  statSub: {
    fontSize: '0.7rem',
    color: '#059669',
    fontWeight: 600
  },
  controlsBar: {
    background: '#ffffff',
    padding: '14px 18px',
    borderRadius: '14px',
    border: '1px solid #e2e8f0',
    marginBottom: '24px',
    display: 'flex',
    gap: '14px',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
  },
  searchWrapper: {
    position: 'relative',
    flex: 1,
    minWidth: '260px'
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)'
  },
  searchInput: {
    width: '100%',
    padding: '10px 14px 10px 38px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
    fontSize: '0.85rem',
    outline: 'none'
  },
  filtersWrapper: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  selectInput: {
    padding: '9px 12px',
    borderRadius: '10px',
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
    fontSize: '0.85rem',
    fontWeight: 500,
    color: '#334155',
    outline: 'none',
    cursor: 'pointer'
  },
  bulkBtn: {
    padding: '9px 16px',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
    color: '#ffffff',
    border: 'none',
    fontSize: '0.85rem',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: '0 2px 10px rgba(37,99,235,0.25)'
  },
  studentListGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '16px'
  },
  studentCard: {
    background: '#ffffff',
    borderRadius: '14px',
    border: '1px solid #e2e8f0',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '14px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
  },
  cardHeader: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center'
  },
  studentAvatar: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
    color: '#ffffff',
    fontWeight: 700,
    fontSize: '0.9rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  studentName: {
    fontSize: '0.95rem',
    fontWeight: 700,
    margin: '0 0 2px 0',
    color: '#0f172a',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  studentMeta: {
    fontSize: '0.75rem',
    color: '#64748b',
    display: 'flex',
    gap: '6px',
    alignItems: 'center'
  },
  statusBadge: (status) => {
    let bg = '#f1f5f9';
    let color = '#475569';
    if (status === 'PRESENT' || status === 'IN') { bg = '#dcfce7'; color = '#15803d'; }
    else if (status === 'OUT') { bg = '#e0f2fe'; color = '#0369a1'; }
    else if (status === 'ABSENT') { bg = '#fee2e2'; color = '#b91c1c'; }
    else if (status === 'LATE') { bg = '#fef3c7'; color = '#b45309'; }

    return {
      background: bg,
      color: color,
      fontSize: '0.72rem',
      fontWeight: 800,
      padding: '4px 10px',
      borderRadius: '8px',
      textAlign: 'center',
      flexShrink: 0
    };
  },
  cardActions: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '8px'
  },
  actionBtn: {
    padding: '8px 4px',
    borderRadius: '8px',
    fontSize: '0.78rem',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  centerLoading: {
    padding: '60px 0',
    textAlign: 'center'
  },
  centerEmpty: {
    padding: '60px 0',
    textAlign: 'center'
  }
};
