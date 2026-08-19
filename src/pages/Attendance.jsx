import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Fingerprint,
  LogIn,
  LogOut,
  Clock,
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  CheckCircle2,
  XCircle,
  Timer,
  MessageSquare,
  Scan,
  Download,
  FileSpreadsheet,
  Filter
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { useApp } from '../context/AppContext';
import {
  formatTime,
  formatDate,
  getTodayStr,
  getTodayAttendanceStats,
  getDaysInMonth,
  getFirstDayOfMonth,
  monthNames,
  dayNames,
} from '../utils/helpers';
import { getInitials, getAvatarClass } from '../data/sampleData';

import { api, API_BASE } from '../utils/api';

export default function Attendance() {
  const { students, attendance, markAttendance } = useApp();
  const [activeTab, setActiveTab] = useState('mark');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [scannerState, setScannerState] = useState('default'); // 'default' | 'scanning' | 'success'
  const [currentTime, setCurrentTime] = useState(new Date());

  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calStudent, setCalStudent] = useState('all');
  const [attendanceFilter, setAttendanceFilter] = useState('present'); // 'present', 'late', 'absent', 'all'
  
  // History Date Range States
  const [historyRangeType, setHistoryRangeType] = useState('custom'); // 'today' | '7days' | '30days' | 'custom' | 'heatmap'
  const [historyStartDate, setHistoryStartDate] = useState(getTodayStr());
  const [historyEndDate, setHistoryEndDate] = useState(getTodayStr());
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all'); // 'all' | 'present' | 'late' | 'absent'
  
  // ADMS setup state
  const [localIp, setLocalIp] = useState('127.0.0.1');
  
  useEffect(() => {
    fetch(`${API_BASE}/system/local-ip`)
      .then(res => res.json())
      .then(data => setLocalIp(data.ip || '127.0.0.1'))
      .catch(err => console.error('Failed to get local IP:', err));
  }, []);

  const activeStudents = useMemo(
    () => students.filter((s) => s.status === 'active'),
    [students]
  );

  // Live clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Set default student selections
  useEffect(() => {
    if (activeStudents.length > 0 && !selectedStudent) {
      setSelectedStudent(activeStudents[0].id);
    }
    if (activeStudents.length > 0 && !calStudent) {
      setCalStudent(activeStudents[0].id);
    }
  }, [activeStudents, selectedStudent, calStudent]);

  const today = getTodayStr();
  const stats = getTodayAttendanceStats(attendance, students);
  const todayRecords = attendance.filter((a) => a.date === today);

  // Handle scan action
  const handleScan = (type) => {
    if (!selectedStudent) return;
    if (scannerState !== 'default') return;

    setScannerState('scanning');
    setTimeout(() => {
      setScannerState('success');
      markAttendance(selectedStudent, type);
      setTimeout(() => setScannerState('default'), 1000);
    }, 2000);
  };

  // Format live clock
  const clockStr = currentTime.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const dateStr = currentTime.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // Students who entered today
  const todayPresentStudents = useMemo(() => {
    return todayRecords
      .filter((r) => r.entryTime)
      .map((r) => {
        const student = students.find((s) => s.id === r.studentId);
        return student ? { ...r, student } : null;
      })
      .filter(Boolean);
  }, [todayRecords, students]);

  // Today's table data – merge all students with their attendance
  const todayTableData = useMemo(() => {
    return activeStudents.map((student, idx) => {
      const record = todayRecords.find((r) => r.studentId === student.id);
      return {
        student,
        idx,
        status: record ? record.status : 'absent',
        entryTime: record?.entryTime || null,
        exitTime: record?.exitTime || null,
        smsSent: record?.smsSent || false,
      };
    });
  }, [activeStudents, todayRecords]);

  // Filter today's list based on selected badge
  const filteredTodayStudents = useMemo(() => {
    return todayTableData.filter(item => {
      if (attendanceFilter === 'all') return true;
      if (attendanceFilter === 'present') return item.status === 'present' || item.status === 'late';
      if (attendanceFilter === 'late') return item.status === 'late';
      if (attendanceFilter === 'absent') return item.status === 'absent';
      return true;
    });
  }, [todayTableData, attendanceFilter]);

  // Calculate duration between entry and exit
  const calcDuration = (entry, exit) => {
    if (!entry) return '-';
    if (!exit) return 'In progress';
    const [eh, em] = entry.split(':').map(Number);
    const [xh, xm] = exit.split(':').map(Number);
    const diffMins = (xh * 60 + xm) - (eh * 60 + em);
    if (diffMins < 0) return '-';
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  // Calendar helpers
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);

  const calendarAttendance = useMemo(() => {
    if (!calStudent) return {};
    const map = {};
    attendance
      .filter((a) => a.studentId === calStudent)
      .forEach((a) => {
        map[a.date] = a.status;
      });
    return map;
  }, [attendance, calStudent]);

  const calendarDays = useMemo(() => {
    const days = [];
    // Empty cells for padding
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: null, status: 'empty' });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === today;
      const dayOfWeek = new Date(calYear, calMonth, d).getDay();
      const isSunday = dayOfWeek === 0;
      const status = calendarAttendance[dateStr] || (isSunday ? 'empty' : (new Date(calYear, calMonth, d) <= new Date() ? 'absent' : 'empty'));
      days.push({ day: d, status, isToday, dateStr });
    }
    return days;
  }, [calYear, calMonth, firstDay, daysInMonth, calendarAttendance, today]);

  // Month stats for calendar
  const monthStats = useMemo(() => {
    if (!calStudent) return { total: 0, present: 0, late: 0, absent: 0, percentage: 0 };
    const monthRecords = attendance.filter((a) => {
      if (a.studentId !== calStudent) return false;
      const d = new Date(a.date);
      return d.getMonth() === calMonth && d.getFullYear() === calYear;
    });
    const present = monthRecords.filter((a) => a.status === 'present').length;
    const late = monthRecords.filter((a) => a.status === 'late').length;
    const absent = monthRecords.filter((a) => a.status === 'absent').length;
    const total = present + late + absent;
    const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    return { total, present, late, absent, percentage };
  }, [attendance, calStudent, calMonth, calYear]);

  const navMonth = (dir) => {
    if (dir === 'prev') {
      if (calMonth === 0) {
        setCalMonth(11);
        setCalYear((y) => y - 1);
      } else {
        setCalMonth((m) => m - 1);
      }
    } else {
      if (calMonth === 11) {
        setCalMonth(0);
        setCalYear((y) => y + 1);
      } else {
        setCalMonth((m) => m + 1);
      }
    }
  };

  const tabs = [
    { key: 'mark', label: 'Mark Attendance' },
    { key: 'today', label: "Today's Record" },
    { key: 'history', label: 'History' },
    { key: 'adms', label: 'Biometric Setup' },
  ];

  const tabVariants = {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -16 },
  };

  const exportTodayAttendance = () => {
    if (todayTableData.length === 0) return;
    const headers = ['Roll No,Student,Status,Entry Time,Exit Time,Duration'];
    const rows = todayTableData.map(r => {
      const entry = r.entryTime ? formatTime(r.entryTime) : 'N/A';
      const exit = r.exitTime ? formatTime(r.exitTime) : 'N/A';
      const duration = calcDuration(r.entryTime, r.exitTime);
      return `${r.student.rollNo},"${r.student.name}",${r.status},"${entry}","${exit}","${duration}"`;
    });
    const csvContent = "data:text/csv;charset=utf-8," + headers.concat(rows).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendance_today_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // History Date Range Records
  const historyRangeRecords = useMemo(() => {
    let start = null;
    let end = null;
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    if (historyRangeType === 'today') {
      start = new Date(todayDate);
      end = new Date(todayDate);
      end.setHours(23, 59, 59, 999);
    } else if (historyRangeType === '7days') {
      start = new Date(todayDate);
      start.setDate(start.getDate() - 7);
      end = new Date(todayDate);
      end.setHours(23, 59, 59, 999);
    } else if (historyRangeType === '30days') {
      start = new Date(todayDate);
      start.setDate(start.getDate() - 30);
      end = new Date(todayDate);
      end.setHours(23, 59, 59, 999);
    } else if (historyRangeType === 'custom') {
      if (historyStartDate) {
        start = new Date(historyStartDate);
        start.setHours(0, 0, 0, 0);
      }
      if (historyEndDate) {
        end = new Date(historyEndDate);
        end.setHours(23, 59, 59, 999);
      }
    } else if (historyRangeType === 'heatmap') {
      start = new Date(calYear, calMonth, 1);
      end = new Date(calYear, calMonth + 1, 0, 23, 59, 59, 999);
    }

    const studentMap = {};
    students.forEach((s) => {
      studentMap[s.id] = s;
    });

    return attendance
      .filter((a) => {
        if (calStudent && calStudent !== 'all' && a.studentId !== calStudent) return false;
        if (historyStatusFilter !== 'all' && a.status !== historyStatusFilter) return false;
        if (!a.date) return false;

        const d = new Date(a.date);
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      })
      .map((a) => ({
        ...a,
        student: studentMap[a.studentId] || { name: 'Unknown', rollNo: '—' },
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [attendance, calStudent, historyRangeType, historyStartDate, historyEndDate, historyStatusFilter, calYear, calMonth, students]);

  // History Range Stats
  const historyRangeStats = useMemo(() => {
    const present = historyRangeRecords.filter((r) => r.status === 'present').length;
    const late = historyRangeRecords.filter((r) => r.status === 'late').length;
    const absent = historyRangeRecords.filter((r) => r.status === 'absent').length;
    const total = present + late + absent;
    const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    return { total, present, late, absent, percentage };
  }, [historyRangeRecords]);

  const exportHistoryAttendance = () => {
    if (historyRangeRecords.length === 0) {
      toast.error('No attendance records found for selected date range to export!');
      return;
    }

    const rows = historyRangeRecords.map((r, idx) => ({
      'Sr No.': idx + 1,
      'Date': r.date ? formatDate(r.date) : 'N/A',
      'Roll No': r.student?.rollNo || '—',
      'Student Name': r.student?.name || 'Unknown',
      'Course / Batch': r.student?.batch || r.student?.targetClass || '—',
      'Status': (r.status || 'absent').toUpperCase(),
      'Entry Time': r.entryTime ? formatTime(r.entryTime) : '—',
      'Exit Time': r.exitTime ? formatTime(r.exitTime) : '—',
      'Duration': calcDuration(r.entryTime, r.exitTime),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 8 },
      { wch: 15 },
      { wch: 12 },
      { wch: 25 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');

    let rangeLabel = historyRangeType;
    if (historyRangeType === 'custom' && historyStartDate && historyEndDate) {
      rangeLabel = `${historyStartDate}_to_${historyEndDate}`;
    } else if (historyRangeType === 'heatmap') {
      rangeLabel = `${monthNames[calMonth]}_${calYear}`;
    }

    const studentName = calStudent && calStudent !== 'all' ? (activeStudents.find((s) => s.id === calStudent)?.name || 'Student') : 'All_Students';
    const filename = `Attendance_${studentName.replace(/\s+/g, '_')}_${rangeLabel}.xlsx`;
    XLSX.writeFile(workbook, filename);
    toast.success(`✅ Exported ${historyRangeRecords.length} records to Excel!`);
  };

  return (
    <div className="page-container">
      <motion.div
        className="page-header"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1>
          <Scan size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 10 }} />
          Attendance Management
        </h1>
        <p>Biometric attendance tracking with automated SMS notifications</p>
      </motion.div>

      {/* Tab Navigation */}
      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {/* ========== TAB 1: Mark Attendance ========== */}
        {activeTab === 'mark' && (
          <motion.div
            key="mark"
            variants={tabVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <div className="grid-2">
              {/* Left: Biometric Scanner */}
              <motion.div
                className="card"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="card-header">
                  <div>
                    <div className="card-title flex items-center gap-8">
                      <Fingerprint size={18} />
                      Biometric Scanner
                    </div>
                    <div className="card-subtitle">Simulate fingerprint attendance</div>
                  </div>
                  <div className="badge badge-info">
                    <Clock size={12} /> LIVE
                  </div>
                </div>

                <div className="scanner-container">
                  {/* Live Clock */}
                  <div className="text-center mb-16">
                    <div style={{ fontSize: '1.8rem', fontFamily: "'Outfit', sans-serif", fontWeight: 800, color: 'var(--text-primary)' }}>
                      {clockStr}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>{dateStr}</div>
                  </div>

                  {/* Scanner Ring */}
                  <div className={`scanner-ring ${scannerState}`}>
                    <Fingerprint size={64} className="scanner-fingerprint" />
                    <div className="scan-line" />
                  </div>

                  {/* Scanner Status */}
                  <div className="text-center mt-16" style={{ minHeight: 24 }}>
                    {scannerState === 'scanning' && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={{ color: 'var(--accent-blue)', fontSize: '0.85rem', fontWeight: 600 }}
                      >
                        Scanning fingerprint...
                      </motion.span>
                    )}
                    {scannerState === 'success' && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{ color: 'var(--accent-green)', fontSize: '0.85rem', fontWeight: 600 }}
                      >
                        ✅ Attendance Marked Successfully!
                      </motion.span>
                    )}
                  </div>

                  {/* Student Selector */}
                  <div className="w-full mt-24">
                    <label className="form-label">Select Student</label>
                    <select
                      className="form-select"
                      value={selectedStudent}
                      onChange={(e) => setSelectedStudent(e.target.value)}
                    >
                      <option value="">-- Choose Student --</option>
                      {activeStudents.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.rollNo})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-12 mt-16 w-full">
                    <button
                      className="btn btn-success flex-1"
                      onClick={() => handleScan('entry')}
                      disabled={!selectedStudent || scannerState !== 'default'}
                    >
                      <LogIn size={18} />
                      Mark Entry
                    </button>
                    <button
                      className="btn btn-danger flex-1"
                      onClick={() => handleScan('exit')}
                      disabled={!selectedStudent || scannerState !== 'default'}
                      style={scannerState !== 'default' ? {} : { background: 'rgba(239, 68, 68, 0.12)' }}
                    >
                      <LogOut size={18} />
                      Mark Exit
                    </button>
                  </div>
                </div>
              </motion.div>

              {/* Right: Quick Status */}
              <motion.div
                className="card"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="card-header">
                  <div>
                    <div className="card-title flex items-center gap-8">
                      <Users size={18} />
                      Today's Summary
                    </div>
                    <div className="card-subtitle">{dateStr}</div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="stat-cards-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <motion.div
                    className="stat-card green"
                    style={{ cursor: 'pointer', border: attendanceFilter === 'present' ? '2px solid var(--accent-green)' : undefined }}
                    onClick={() => setAttendanceFilter('present')}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.25 }}
                  >
                    <div className="stat-card-top">
                      <div className="stat-card-icon green">
                        <UserCheck size={20} />
                      </div>
                    </div>
                    <div className="stat-card-value">{stats.present}</div>
                    <div className="stat-card-label">Present</div>
                  </motion.div>

                  <motion.div
                    className="stat-card orange"
                    style={{ cursor: 'pointer', border: attendanceFilter === 'late' ? '2px solid var(--accent-orange)' : undefined }}
                    onClick={() => setAttendanceFilter('late')}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <div className="stat-card-top">
                      <div className="stat-card-icon orange">
                        <AlertTriangle size={20} />
                      </div>
                    </div>
                    <div className="stat-card-value">{stats.late}</div>
                    <div className="stat-card-label">Late</div>
                  </motion.div>

                  <motion.div
                    className="stat-card"
                    style={{ cursor: 'pointer', border: attendanceFilter === 'absent' ? '2px solid var(--accent-red)' : undefined, borderTopColor: 'var(--accent-red)' }}
                    onClick={() => setAttendanceFilter('absent')}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.35 }}
                  >
                    <div className="stat-card-top">
                      <div className="stat-card-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: 'var(--accent-red-light)' }}>
                        <UserX size={20} />
                      </div>
                    </div>
                    <div className="stat-card-value">{stats.absent}</div>
                    <div className="stat-card-label">Absent</div>
                  </motion.div>

                  <motion.div
                    className="stat-card blue"
                    style={{ cursor: 'pointer', border: attendanceFilter === 'all' ? '2px solid var(--accent-blue)' : undefined }}
                    onClick={() => setAttendanceFilter('all')}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    <div className="stat-card-top">
                      <div className="stat-card-icon blue">
                        <CheckCircle2 size={20} />
                      </div>
                    </div>
                    <div className="stat-card-value" style={{ fontSize: '2rem' }}>{stats.percentage}%</div>
                    <div className="stat-card-label">Attendance</div>
                  </motion.div>
                </div>

                {/* Today's Present Students List */}
                <div className="mt-16">
                  <h4 style={{ fontSize: '0.88rem', marginBottom: 12, color: 'var(--text-secondary)' }}>
                    Students: {attendanceFilter.toUpperCase()} ({filteredTodayStudents.length})
                  </h4>
                  <div style={{ maxHeight: 280, overflowY: 'auto', paddingRight: '5px' }}>
                    {filteredTodayStudents.length === 0 ? (
                      <div className="empty-state" style={{ padding: '24px 12px' }}>
                        <p>No students match this filter.</p>
                      </div>
                    ) : (
                      <div className="activity-feed">
                        {filteredTodayStudents.map((rec, idx) => (
                          <motion.div
                            key={rec.student.id}
                            className="activity-item"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                          >
                            {rec.student.photo ? (
                              <img 
                                src={rec.student.photo} 
                                alt={rec.student.name} 
                                className="student-avatar" 
                                style={{ objectFit: 'cover', border: '1px solid var(--border-color)' }} 
                              />
                            ) : (
                              <div className={`student-avatar ${getAvatarClass(idx)}`}>
                                {getInitials(rec.student.name)}
                              </div>
                            )}
                            <div className="flex-1">
                              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {rec.student.name}
                              </div>
                              <div className="flex items-center gap-8" style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                                {rec.entryTime ? (
                                  <>
                                    <span>
                                      <LogIn size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                                      {formatTime(rec.entryTime)}
                                    </span>
                                    <span>
                                      <LogOut size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
                                      {rec.exitTime ? formatTime(rec.exitTime) : 'Still in'}
                                    </span>
                                  </>
                                ) : (
                                  <span>No Entry Record</span>
                                )}
                              </div>
                            </div>
                            <span className={`badge ${rec.status === 'late' ? 'badge-late' : rec.status === 'absent' ? 'badge-info' : 'badge-present'}`} style={{background: rec.status === 'absent' ? 'rgba(239, 68, 68, 0.12)' : '', color: rec.status === 'absent' ? 'var(--accent-red)' : ''}}>
                              {rec.status}
                            </span>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ========== TAB 2: Today's Record ========== */}
        {activeTab === 'today' && (
          <motion.div
            key="today"
            variants={tabVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="card-header">
                <div>
                  <div className="card-title flex items-center gap-8">
                    <Calendar size={18} />
                    Today's Attendance Record
                  </div>
                  <div className="card-subtitle">
                    {dateStr} • {stats.present + stats.late} of {activeStudents.length} present
                  </div>
                </div>
                <div className="flex gap-12 items-center">
                  <button onClick={exportTodayAttendance} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '32px', padding: '0 12px', fontSize: '0.85rem' }}>
                    <Download size={14} /> Download Excel
                  </button>
                  <div className="flex gap-8">
                    <span className="badge badge-present">Present: {stats.present}</span>
                    <span className="badge badge-late">Late: {stats.late}</span>
                    <span className="badge badge-absent">Absent: {stats.absent}</span>
                  </div>
                </div>
              </div>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Status</th>
                      <th>Entry Time</th>
                      <th>Exit Time</th>
                      <th>Duration</th>
                      <th>SMS Sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayTableData.map((row, idx) => (
                      <motion.tr
                        key={row.student.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                      >
                        <td>
                          <div className="flex items-center gap-12">
                            {row.student.photo ? (
                              <img 
                                src={row.student.photo} 
                                alt={row.student.name} 
                                className="student-avatar" 
                                style={{ objectFit: 'cover', border: '1px solid var(--border-color)' }} 
                              />
                            ) : (
                              <div className={`student-avatar ${getAvatarClass(row.idx)}`}>
                                {getInitials(row.student.name)}
                              </div>
                            )}
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.87rem' }}>
                                {row.student.name}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Roll: {row.student.rollNo}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${
                            row.status === 'present'
                              ? 'badge-present'
                              : row.status === 'late'
                              ? 'badge-late'
                              : 'badge-absent'
                          }`}>
                            {row.status === 'present' && <CheckCircle2 size={11} />}
                            {row.status === 'late' && <AlertTriangle size={11} />}
                            {row.status === 'absent' && <XCircle size={11} />}
                            {row.status}
                          </span>
                        </td>
                        <td style={{ color: row.entryTime ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {formatTime(row.entryTime)}
                        </td>
                        <td style={{ color: row.exitTime ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {row.exitTime ? formatTime(row.exitTime) : row.entryTime ? 'Still in' : '-'}
                        </td>
                        <td>
                          <span className="flex items-center gap-4" style={{ color: 'var(--text-secondary)' }}>
                            <Timer size={13} />
                            {calcDuration(row.entryTime, row.exitTime)}
                          </span>
                          {row.sessionName && (
                            <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--accent-blue)', marginTop: '2px' }}>
                              Session: {row.sessionName}
                            </span>
                          )}
                        </td>
                        <td>
                          {row.smsSent ? (
                            <span className="sms-status delivered">
                              <MessageSquare size={12} /> Sent
                            </span>
                          ) : (
                            <span className="sms-status" style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* ========== TAB 3: History ========== */}
        {activeTab === 'history' && (
          <motion.div
            key="history"
            variants={tabVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              style={{ borderRadius: '16px', padding: '24px', border: '1px solid var(--border-color-light)' }}
            >
              {/* Header */}
              <div className="card-header flex justify-between items-center flex-wrap gap-4 mb-20" style={{ borderBottom: '1px solid var(--border-color-light)', paddingBottom: '16px' }}>
                <div>
                  <div className="card-title flex items-center gap-8" style={{ fontSize: '1.3rem', fontWeight: 700 }}>
                    <Calendar size={20} color="#3b82f6" />
                    Attendance History & Reports
                  </div>
                  <div className="card-subtitle" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Select custom date range (From Date to To Date) or calendar view to analyze and export records.
                  </div>
                </div>
                <button 
                  onClick={exportHistoryAttendance} 
                  className="btn btn-secondary" 
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontWeight: 600 }}
                  title="Download Attendance Report in Excel format"
                >
                  <Download size={16} color="#10b981" /> Download Excel
                </button>
              </div>

              {/* Filter Controls Bar */}
              <div className="card mb-20" style={{ background: 'var(--surface-color, #f8fafc)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color-light)' }}>
                <div className="flex items-center justify-between flex-wrap gap-12">
                  {/* Select Student Dropdown */}
                  <div style={{ minWidth: '220px', flex: '1 1 220px' }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      Select Student:
                    </label>
                    <select
                      className="form-select w-full"
                      value={calStudent}
                      onChange={(e) => setCalStudent(e.target.value)}
                      style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
                    >
                      <option value="all">🌟 All Students (Combined)</option>
                      {activeStudents.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.rollNo})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date Range Selection Pills */}
                  <div style={{ flex: '2 1 320px' }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      Date Selection Mode:
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {[
                        { id: 'custom', label: 'Custom Range' },
                        { id: 'today', label: 'Today' },
                        { id: '7days', label: '7 Days' },
                        { id: '30days', label: '1 Month' },
                        { id: 'heatmap', label: 'Monthly Heatmap' },
                      ].map((pill) => (
                        <button
                          key={pill.id}
                          type="button"
                          className={`btn btn-sm ${historyRangeType === pill.id ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setHistoryRangeType(pill.id)}
                          style={{ borderRadius: '20px', padding: '5px 12px', fontSize: '0.8rem', fontWeight: historyRangeType === pill.id ? 700 : 500 }}
                        >
                          {pill.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Status Filter */}
                  <div style={{ minWidth: '140px' }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      Status:
                    </label>
                    <select
                      className="form-select w-full"
                      value={historyStatusFilter}
                      onChange={(e) => setHistoryStatusFilter(e.target.value)}
                      style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
                    >
                      <option value="all">All Statuses</option>
                      <option value="present">Present</option>
                      <option value="late">Late</option>
                      <option value="absent">Absent</option>
                    </select>
                  </div>
                </div>

                {/* Custom Date Range Row */}
                {historyRangeType === 'custom' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: 'auto' }} 
                    className="flex items-center gap-12 mt-12 pt-12 flex-wrap"
                    style={{ borderTop: '1px dashed var(--border-color-light)' }}
                  >
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>From Date:</span>
                      <input
                        type="date"
                        className="form-input"
                        value={historyStartDate}
                        onChange={(e) => setHistoryStartDate(e.target.value)}
                        style={{ height: '36px', borderRadius: '8px', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>To Date:</span>
                      <input
                        type="date"
                        className="form-input"
                        value={historyEndDate}
                        onChange={(e) => setHistoryEndDate(e.target.value)}
                        style={{ height: '36px', borderRadius: '8px', fontSize: '0.85rem' }}
                      />
                    </div>
                    <span style={{ fontSize: '0.82rem', color: '#10b981', fontWeight: 600, marginLeft: 'auto' }}>
                      Found {historyRangeRecords.length} record(s)
                    </span>
                  </motion.div>
                )}

                {/* Heatmap Month Picker Controls */}
                {historyRangeType === 'heatmap' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: 'auto' }} 
                    className="flex items-center gap-8 mt-12 pt-12"
                    style={{ borderTop: '1px dashed var(--border-color-light)' }}
                  >
                    <button className="btn btn-ghost btn-icon" onClick={() => navMonth('prev')}>
                      <ChevronLeft size={18} />
                    </button>
                    <div className="flex items-center gap-4">
                      <select
                        className="form-select"
                        value={calMonth}
                        onChange={(e) => setCalMonth(Number(e.target.value))}
                        style={{ padding: '6px 12px', fontSize: '0.9rem', minWidth: '110px' }}
                      >
                        {monthNames.map((m, idx) => (
                          <option key={idx} value={idx}>{m}</option>
                        ))}
                      </select>
                      <select
                        className="form-select"
                        value={calYear}
                        onChange={(e) => setCalYear(Number(e.target.value))}
                        style={{ padding: '6px 12px', fontSize: '0.9rem', minWidth: '90px' }}
                      >
                        {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <button className="btn btn-ghost btn-icon" onClick={() => navMonth('next')}>
                      <ChevronRight size={18} />
                    </button>
                  </motion.div>
                )}
              </div>

              {/* Summary Stats Cards for active range */}
              <div className="stat-cards-grid mb-24" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
                <motion.div
                  className="card"
                  style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color-light)' }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Records</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '6px', color: 'var(--text-primary)' }}>
                    {historyRangeType === 'heatmap' ? monthStats.total : historyRangeStats.total}
                  </div>
                </motion.div>
                <motion.div
                  className="card"
                  style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color-light)' }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Present</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '6px', color: '#10b981' }}>
                    {historyRangeType === 'heatmap' ? monthStats.present : historyRangeStats.present}
                  </div>
                </motion.div>
                <motion.div
                  className="card"
                  style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color-light)' }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Late / Partial</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '6px', color: '#f59e0b' }}>
                    {historyRangeType === 'heatmap' ? monthStats.late : historyRangeStats.late}
                  </div>
                </motion.div>
                <motion.div
                  className="card"
                  style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color-light)' }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Absent</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '6px', color: '#ef4444' }}>
                    {historyRangeType === 'heatmap' ? monthStats.absent : historyRangeStats.absent}
                  </div>
                </motion.div>
                <motion.div
                  className="card"
                  style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color-light)' }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Attendance %</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: '6px', color: '#8b5cf6' }}>
                    {historyRangeType === 'heatmap' ? monthStats.percentage : historyRangeStats.percentage}%
                  </div>
                </motion.div>
              </div>

              {/* View Rendering: Heatmap Grid vs Detailed Records Table */}
              {historyRangeType === 'heatmap' ? (
                <div>
                  {calStudent === 'all' ? (
                    <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)', background: 'var(--surface-color)', borderRadius: '12px' }}>
                      <Calendar size={32} style={{ opacity: 0.4, margin: '0 auto 8px' }} />
                      <p style={{ margin: 0, fontWeight: 600 }}>Please select an individual student from dropdown to view their monthly calendar heat-map.</p>
                    </div>
                  ) : (
                    <div>
                      {/* Calendar Grid */}
                      <div className="attendance-calendar" style={{ maxWidth: 480, margin: '0 auto' }}>
                        {dayNames.map((d) => (
                          <div key={d} className="calendar-day-header">{d}</div>
                        ))}
                        {calendarDays.map((cell, idx) => (
                          <motion.div
                            key={idx}
                            className={`calendar-day ${cell.status}${cell.isToday ? ' today' : ''}`}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: cell.status === 'empty' ? 0 : 1, scale: 1 }}
                            transition={{ delay: idx * 0.01 }}
                            title={cell.dateStr ? `${cell.dateStr}: ${cell.status}` : ''}
                          >
                            {cell.day}
                          </motion.div>
                        ))}
                      </div>

                      {/* Legend */}
                      <div className="flex items-center justify-center gap-20 mt-24" style={{ fontSize: '0.8rem' }}>
                        <div className="flex items-center gap-4">
                          <div style={{ width: 12, height: 12, borderRadius: 4, background: 'rgba(16, 185, 129, 0.5)' }} />
                          <span style={{ color: 'var(--text-secondary)' }}>Present</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div style={{ width: 12, height: 12, borderRadius: 4, background: 'rgba(239, 68, 68, 0.5)' }} />
                          <span style={{ color: 'var(--text-secondary)' }}>Absent</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div style={{ width: 12, height: 12, borderRadius: 4, background: 'rgba(245, 158, 11, 0.5)' }} />
                          <span style={{ color: 'var(--text-secondary)' }}>Late</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div style={{ width: 12, height: 12, borderRadius: 4, border: '2px solid var(--accent-blue)', background: 'transparent' }} />
                          <span style={{ color: 'var(--text-secondary)' }}>Today</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Detailed Table of Range Records */
                <div className="table-container" style={{ borderRadius: '12px', border: '1px solid var(--border-color-light)', overflow: 'hidden' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '130px', minWidth: '120px', whiteSpace: 'nowrap' }}>Date</th>
                        <th style={{ width: '90px', whiteSpace: 'nowrap' }}>Roll No</th>
                        <th style={{ whiteSpace: 'nowrap' }}>Student Name</th>
                        <th style={{ whiteSpace: 'nowrap' }}>Status</th>
                        <th style={{ whiteSpace: 'nowrap' }}>Entry Time</th>
                        <th style={{ whiteSpace: 'nowrap' }}>Exit Time</th>
                        <th style={{ whiteSpace: 'nowrap' }}>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyRangeRecords.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                            <div className="flex flex-col items-center justify-center gap-2">
                              <Calendar size={28} style={{ opacity: 0.5 }} />
                              <p style={{ margin: 0, fontWeight: 500 }}>No attendance records found for selected date range.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        historyRangeRecords.map((r, idx) => (
                          <tr key={idx}>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <div className="flex items-center gap-2" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                <Calendar size={14} className="text-muted" style={{ flexShrink: 0 }} />
                                <span>{r.date ? formatDate(r.date) : '—'}</span>
                              </div>
                            </td>
                            <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{r.student?.rollNo || '—'}</td>
                            <td className="font-medium" style={{ fontWeight: 600 }}>{r.student?.name || 'Unknown'}</td>
                            <td>
                              {r.status === 'present' && (
                                <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 600, padding: '2px 8px', borderRadius: '12px' }}>
                                  Present
                                </span>
                              )}
                              {r.status === 'late' && (
                                <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.3)', fontWeight: 600, padding: '2px 8px', borderRadius: '12px' }}>
                                  Late
                                </span>
                              )}
                              {r.status === 'absent' && (
                                <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#dc2626', border: '1px solid rgba(239, 68, 68, 0.3)', fontWeight: 600, padding: '2px 8px', borderRadius: '12px' }}>
                                  Absent
                                </span>
                              )}
                            </td>
                            <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                              {r.entryTime ? formatTime(r.entryTime) : '—'}
                            </td>
                            <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                              {r.exitTime ? formatTime(r.exitTime) : '—'}
                            </td>
                            <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem', color: 'var(--accent-blue)', fontWeight: 500 }}>
                              {calcDuration(r.entryTime, r.exitTime)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
        {/* ========== TAB 4: ADMS Biometric Setup ========== */}
        {activeTab === 'adms' && (
          <motion.div
            key="adms"
            variants={tabVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-col gap-24"
          >
            <div className="card" style={{ padding: 30 }}>
              <div className="flex items-center gap-12 mb-20">
                <div style={{ padding: 12, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-blue)' }}>
                  <Fingerprint size={28} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Biometric Machine (ADMS) Setup</h2>
                  <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Connect your ZKTeco or compatible biometric machine to this local server.</p>
                </div>
              </div>

              <div style={{ background: 'var(--surface-color)', padding: 24, borderRadius: 16, border: '1px solid var(--border-color)', marginBottom: 24 }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: 16 }}>Connection Details</h3>
                <p style={{ marginBottom: 20 }}>Your local Edge server is currently running. Enter these details in your Biometric Machine's <strong>ADMS / Cloud Server Settings</strong>:</p>
                
                <div className="flex gap-20">
                  <div style={{ flex: 1, background: 'rgba(16, 185, 129, 0.05)', padding: 20, borderRadius: 12, border: '1px dashed rgba(16, 185, 129, 0.3)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Server IP Address</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent-green)' }}>{localIp}</div>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(99, 102, 241, 0.05)', padding: 20, borderRadius: 12, border: '1px dashed rgba(99, 102, 241, 0.3)' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Server Port</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent-indigo)' }}>5000</div>
                  </div>
                </div>
              </div>

              <div style={{ padding: 20, background: 'rgba(245, 158, 11, 0.05)', borderRadius: 12, border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <h4 className="flex items-center gap-8" style={{ color: 'var(--accent-orange)', margin: '0 0 10px 0' }}>
                  <AlertTriangle size={18} /> Important Note
                </h4>
                <ul style={{ margin: 0, paddingLeft: 24, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <li>Both your PC and the Biometric machine must be connected to the <strong>same WiFi network</strong>.</li>
                  <li>If your PC restarts or disconnects from WiFi, your IP address might change, causing the machine to disconnect.</li>
                </ul>
                
                <details style={{ marginTop: 16, background: 'rgba(255,255,255,0.5)', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', border: '1px solid rgba(0,0,0,0.05)' }}>
                  <summary style={{ fontWeight: 600, color: 'var(--accent-blue)', outline: 'none' }}>🛠️ How to permanently fix (Static) your IP Address in Windows</summary>
                  <div style={{ padding: '12px 0 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, cursor: 'text' }}>
                    <p style={{ margin: '0 0 8px 0' }}>To prevent your WiFi IP from changing, set a Static IP on your PC:</p>
                    <ol style={{ paddingLeft: 20, margin: 0 }}>
                      <li>Right-click the <strong>WiFi/Network icon</strong> on your taskbar and select <strong>Network and Internet settings</strong>.</li>
                      <li>Click on your active <strong>WiFi</strong> or <strong>Ethernet</strong> connection.</li>
                      <li>Find <strong>IP assignment</strong> (usually set to Automatic/DHCP) and click <strong>Edit</strong>.</li>
                      <li>Change it to <strong>Manual</strong> and toggle <strong>IPv4</strong> to On.</li>
                      <li>Enter the <strong>IP Address</strong> shown above (<code style={{background:'rgba(0,0,0,0.05)', padding:'2px 6px', borderRadius:4}}>{localIp}</code>).</li>
                      <li>Set Subnet mask to <code style={{background:'rgba(0,0,0,0.05)', padding:'2px 6px', borderRadius:4}}>255.255.255.0</code> and Gateway to your router's IP (usually <code style={{background:'rgba(0,0,0,0.05)', padding:'2px 6px', borderRadius:4}}>192.168.1.1</code> or <code style={{background:'rgba(0,0,0,0.05)', padding:'2px 6px', borderRadius:4}}>192.168.0.1</code>).</li>
                      <li>Set Preferred DNS to <code style={{background:'rgba(0,0,0,0.05)', padding:'2px 6px', borderRadius:4}}>8.8.8.8</code> and click <strong>Save</strong>.</li>
                    </ol>
                  </div>
                </details>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
