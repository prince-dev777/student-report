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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  formatTime,
  getTodayStr,
  getTodayAttendanceStats,
  getDaysInMonth,
  getFirstDayOfMonth,
  monthNames,
  dayNames,
} from '../utils/helpers';
import { getInitials, getAvatarClass } from '../data/sampleData';

export default function Attendance() {
  const { students, attendance, markAttendance } = useApp();
  const [activeTab, setActiveTab] = useState('mark');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [scannerState, setScannerState] = useState('default'); // 'default' | 'scanning' | 'success'
  const [currentTime, setCurrentTime] = useState(new Date());

  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calStudent, setCalStudent] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState('present'); // 'present', 'late', 'absent', 'all'
  
  // ADMS setup state
  const [localIp, setLocalIp] = useState('127.0.0.1');
  
  useEffect(() => {
    fetch('http://localhost:5001/api/system/local-ip')
      .then(res => res.json())
      .then(data => setLocalIp(data.ip))
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
                <div className="flex gap-8">
                  <span className="badge badge-present">Present: {stats.present}</span>
                  <span className="badge badge-late">Late: {stats.late}</span>
                  <span className="badge badge-absent">Absent: {stats.absent}</span>
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
            >
              <div className="card-header">
                <div>
                  <div className="card-title flex items-center gap-8">
                    <Calendar size={18} />
                    Attendance History
                  </div>
                  <div className="card-subtitle">Calendar heat-map view</div>
                </div>
              </div>

              {/* Student + Month Controls */}
              <div className="flex items-center gap-16 mb-24 flex-wrap">
                <div style={{ minWidth: 220 }}>
                  <label className="form-label">Select Student</label>
                  <select
                    className="form-select"
                    value={calStudent}
                    onChange={(e) => setCalStudent(e.target.value)}
                  >
                    {activeStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.rollNo})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-8" style={{ marginTop: 20 }}>
                  <button className="btn btn-ghost btn-icon" onClick={() => navMonth('prev')}>
                    <ChevronLeft size={18} />
                  </button>
                  <span style={{ fontWeight: 700, fontSize: '1rem', minWidth: 160, textAlign: 'center' }}>
                    {monthNames[calMonth]} {calYear}
                  </span>
                  <button className="btn btn-ghost btn-icon" onClick={() => navMonth('next')}>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="attendance-calendar" style={{ maxWidth: 480 }}>
                {/* Day headers */}
                {dayNames.map((d) => (
                  <div key={d} className="calendar-day-header">{d}</div>
                ))}

                {/* Days */}
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
              <div className="flex items-center gap-20 mt-24" style={{ fontSize: '0.8rem' }}>
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

              {/* Month Stats */}
              <div className="stat-cards-grid mt-24" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                <motion.div
                  className="stat-card blue"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="stat-card-value">{monthStats.total}</div>
                  <div className="stat-card-label">Total Days</div>
                </motion.div>
                <motion.div
                  className="stat-card green"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <div className="stat-card-value">{monthStats.present}</div>
                  <div className="stat-card-label">Present</div>
                </motion.div>
                <motion.div
                  className="stat-card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="stat-card-value">{monthStats.absent}</div>
                  <div className="stat-card-label">Absent</div>
                </motion.div>
                <motion.div
                  className="stat-card purple"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                >
                  <div className="stat-card-value">{monthStats.percentage}%</div>
                  <div className="stat-card-label">Percentage</div>
                </motion.div>
              </div>
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
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent-indigo)' }}>5001</div>
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
