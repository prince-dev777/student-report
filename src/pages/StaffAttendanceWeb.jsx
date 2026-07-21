import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, CheckCircle2, XCircle, Clock, Search, Filter, 
  Calendar, RefreshCw, LogOut, CheckCheck, UserCheck, ShieldAlert 
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
        if (data.token) {
          localStorage.setItem('staff_token', data.token);
        }
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
    const rec = dayRecords.find(r => r.studentId === studentId);
    if (!rec) return { status: 'UNMARKED', time: '' };
    return { 
      status: (rec.status || 'PRESENT').toUpperCase(),
      time: rec.timestamp ? new Date(rec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
    };
  };

  // Mark student attendance
  const handleMarkStatus = async (student, status) => {
    setSavingId(student.id);
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0].substring(0, 5); // HH:MM

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

      toast.success(`${student.name}: Marked ${status}`);
    } catch (err) {
      toast.error('Failed to save attendance');
    } finally {
      setSavingId(null);
    }
  };

  // Mark all unmarked students as PRESENT
  const handleMarkAllPresent = async () => {
    const confirmMark = window.confirm(`Are you sure you want to mark all unmarked students as PRESENT for ${selectedDate}?`);
    if (!confirmMark) return;

    const unmarked = students.filter(s => getStudentStatus(s.id).status === 'UNMARKED');
    if (unmarked.length === 0) {
      toast.error('All students are already marked for today!');
      return;
    }

    toast.loading(`Marking ${unmarked.length} students as Present...`, { id: 'bulk' });
    let count = 0;
    for (const student of unmarked) {
      try {
        await handleMarkStatus(student, 'PRESENT');
        count++;
      } catch (e) {}
    }
    toast.success(`Successfully marked ${count} students as Present!`, { id: 'bulk' });
  };

  // Stats calculation
  const totalStudents = students.length;
  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;

  students.forEach(s => {
    const st = getStudentStatus(s.id).status;
    if (st === 'PRESENT' || st === 'IN') presentCount++;
    else if (st === 'ABSENT') absentCount++;
    else if (st === 'LATE') lateCount++;
  });

  const unmarkedCount = totalStudents - (presentCount + absentCount + lateCount);
  const attendancePercentage = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

  // Filtered student list
  const batches = Array.from(new Set(students.map(s => s.batch || 'Default'))).filter(Boolean);

  const filteredStudents = students.filter(student => {
    const nameMatch = (student.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const rollMatch = (student.rollNo || '').toLowerCase().includes(searchQuery.toLowerCase());
    const phoneMatch = (student.parentPhone || '').includes(searchQuery);
    const matchesSearch = nameMatch || rollMatch || phoneMatch;

    const studentBatch = student.batch || 'Default';
    const matchesBatch = batchFilter === 'ALL' || studentBatch === batchFilter;

    const currentStatus = getStudentStatus(student.id).status;
    const matchesStatus = 
      statusFilter === 'ALL' ||
      (statusFilter === 'PRESENT' && (currentStatus === 'PRESENT' || currentStatus === 'IN')) ||
      (statusFilter === 'ABSENT' && currentStatus === 'ABSENT') ||
      (statusFilter === 'LATE' && currentStatus === 'LATE') ||
      (statusFilter === 'UNMARKED' && currentStatus === 'UNMARKED');

    return matchesSearch && matchesBatch && matchesStatus;
  });

  return (
    <div style={styles.container}>
      {/* Top Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logoBadge}>
            <UserCheck size={20} color="#2563eb" />
          </div>
          <div>
            <h1 style={styles.headerTitle}>Career Xone — Staff Portal</h1>
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
        {/* Stats Grid */}
        <div style={styles.statsGrid}>
          <div style={{ ...styles.statCard, borderLeft: '4px solid #2563eb' }}>
            <div style={styles.statIconWrapper('#2563eb')}>
              <Users size={20} color="#2563eb" />
            </div>
            <div>
              <span style={styles.statLabel}>Total Students</span>
              <h3 style={styles.statValue}>{totalStudents}</h3>
            </div>
          </div>

          <div style={{ ...styles.statCard, borderLeft: '4px solid #059669' }}>
            <div style={styles.statIconWrapper('#059669')}>
              <CheckCircle2 size={20} color="#059669" />
            </div>
            <div>
              <span style={styles.statLabel}>Present Today</span>
              <h3 style={styles.statValue}>{presentCount} <small style={styles.statSub}>({attendancePercentage}%)</small></h3>
            </div>
          </div>

          <div style={{ ...styles.statCard, borderLeft: '4px solid #dc2626' }}>
            <div style={styles.statIconWrapper('#dc2626')}>
              <XCircle size={20} color="#dc2626" />
            </div>
            <div>
              <span style={styles.statLabel}>Absent</span>
              <h3 style={styles.statValue}>{absentCount}</h3>
            </div>
          </div>

          <div style={{ ...styles.statCard, borderLeft: '4px solid #d97706' }}>
            <div style={styles.statIconWrapper('#d97706')}>
              <Clock size={20} color="#d97706" />
            </div>
            <div>
              <span style={styles.statLabel}>Unmarked</span>
              <h3 style={styles.statValue}>{unmarkedCount}</h3>
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
              {batches.map(b => (
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
                        <span>{student.batch || 'Default'}</span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div style={styles.statusBadge(status)}>
                      {status === 'PRESENT' || status === 'IN' ? '✅ PRESENT' :
                       status === 'ABSENT' ? '❌ ABSENT' :
                       status === 'LATE' ? '⏱️ LATE' : '⏳ UNMARKED'}
                      {time && <span style={{ fontSize: '0.7rem', opacity: 0.85, display: 'block' }}>{time}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={styles.cardActions}>
                    <button
                      onClick={() => handleMarkStatus(student, 'PRESENT')}
                      disabled={isSaving}
                      style={{
                        ...styles.actionBtn,
                        background: status === 'PRESENT' || status === 'IN' ? '#059669' : '#f0fdf4',
                        color: status === 'PRESENT' || status === 'IN' ? '#ffffff' : '#059669',
                        border: '1px solid #bbf7d0'
                      }}
                    >
                      <CheckCircle2 size={15} />
                      Present
                    </button>

                    <button
                      onClick={() => handleMarkStatus(student, 'ABSENT')}
                      disabled={isSaving}
                      style={{
                        ...styles.actionBtn,
                        background: status === 'ABSENT' ? '#dc2626' : '#fef2f2',
                        color: status === 'ABSENT' ? '#ffffff' : '#dc2626',
                        border: '1px solid #fecaca'
                      }}
                    >
                      <XCircle size={15} />
                      Absent
                    </button>

                    <button
                      onClick={() => handleMarkStatus(student, 'LATE')}
                      disabled={isSaving}
                      style={{
                        ...styles.actionBtn,
                        background: status === 'LATE' ? '#d97706' : '#fffbeb',
                        color: status === 'LATE' ? '#ffffff' : '#d97706',
                        border: '1px solid #fde68a'
                      }}
                    >
                      <Clock size={15} />
                      Late
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
    padding: '24px 16px'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px'
  },
  statCard: {
    background: '#ffffff',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
  },
  statIconWrapper: (color) => ({
    width: '42px',
    height: '42px',
    borderRadius: '10px',
    background: `${color}12`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }),
  statLabel: {
    fontSize: '0.78rem',
    color: '#64748b',
    fontWeight: 500,
    display: 'block'
  },
  statValue: {
    fontSize: '1.4rem',
    fontWeight: 800,
    margin: 0,
    color: '#0f172a',
    lineHeight: 1.2
  },
  statSub: {
    fontSize: '0.8rem',
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
    else if (status === 'ABSENT') { bg = '#fee2e2'; color = '#b91c1c'; }
    else if (status === 'LATE') { bg = '#fef3c7'; color = '#b45309'; }

    return {
      padding: '4px 10px',
      borderRadius: '20px',
      fontSize: '0.72rem',
      fontWeight: 700,
      background: bg,
      color: color,
      textAlign: 'center',
      lineHeight: 1.2
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
