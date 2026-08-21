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
  Filter,
  Search,
  X,
  RefreshCw,
  Play,
  Pause,
  Wifi,
  WifiOff,
  Server,
  Activity,
  Check,
  Zap,
  ShieldCheck,
  Radar
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { useApp } from '../context/AppContext';
import SearchableStudentSelect from '../components/SearchableStudentSelect';
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
  const { students, attendance, markAttendance, refreshAttendance, refreshSMSLogs } = useApp();
  const [activeTab, setActiveTab] = useState('mark');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [todaySearch, setTodaySearch] = useState('');
  const [scannerState, setScannerState] = useState('default'); // 'default' | 'scanning' | 'success'
  const [currentTime, setCurrentTime] = useState(new Date());

  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calStudent, setCalStudent] = useState('all');
  const [attendanceFilter, setAttendanceFilter] = useState('all'); // 'all' | 'present' | 'late' | 'absent'
  
  // History Date Range States
  const [historyRangeType, setHistoryRangeType] = useState('custom'); // 'today' | '7days' | '30days' | 'custom' | 'heatmap'
  const [historyStartDate, setHistoryStartDate] = useState(getTodayStr());
  const [historyEndDate, setHistoryEndDate] = useState(getTodayStr());
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all'); // 'all' | 'present' | 'late' | 'absent'
  
  // Biometric Direct & ADMS Setup States
  const [localIp, setLocalIp] = useState('127.0.0.1');
  const [biometricMode, setBiometricMode] = useState('direct'); // 'direct' | 'adms'
  const [biometricIp, setBiometricIp] = useState(() => {
    const saved = localStorage.getItem('biometric_ip');
    if (!saved || saved === '192.168.1.201') return '192.168.0.12';
    return saved;
  });
  const [biometricPort, setBiometricPort] = useState(() => localStorage.getItem('biometric_port') || '71');
  const [biometricTesting, setBiometricTesting] = useState(false);
  const [biometricSyncing, setBiometricSyncing] = useState(false);
  const [biometricAutoSync, setBiometricAutoSync] = useState(false);
  const [biometricDeviceInfo, setBiometricDeviceInfo] = useState(null);
  const [biometricStatus, setBiometricStatus] = useState(null);
  const [isScanningNetwork, setIsScanningNetwork] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState([]);

  const handleAutoScanNetwork = async () => {
    setIsScanningNetwork(true);
    setDiscoveredDevices([]);
    try {
      toast.loading('🔍 Scanning local Wi-Fi for Biometric Machines...', { id: 'wifi-scan' });
      const res = await api.scanBiometricDevices();
      toast.dismiss('wifi-scan');
      if (res && res.success) {
        setDiscoveredDevices(res.devices || []);
        if (res.devices && res.devices.length > 0) {
          toast.success(`🎉 Found ${res.devices.length} Biometric Machine(s) on Wi-Fi!`);
        } else {
          toast.error('No Biometric Machines found. Ensure machine is powered ON and on same Wi-Fi.');
        }
      }
    } catch (err) {
      toast.dismiss('wifi-scan');
      toast.error(err.message || 'Subnet scan failed');
    } finally {
      setIsScanningNetwork(false);
    }
  };

  const handleSelectDiscoveredDevice = async (device) => {
    setBiometricIp(device.ip);
    setBiometricPort(String(device.port));
    localStorage.setItem('biometric_ip', device.ip);
    localStorage.setItem('biometric_port', String(device.port));
    toast.success(`⚡ Selected ${device.name} (${device.ip}:${device.port})`);
    
    // Auto-test connection
    setBiometricTesting(true);
    try {
      const res = await api.testBiometricConnection({ ip: device.ip, port: device.port });
      if (res && res.success) {
        setBiometricDeviceInfo(res.deviceInfo);
        toast.success(`🎉 Connected successfully to ${device.ip}:${device.port}!`);
        fetchBiometricStatus();
      }
    } catch (e) {}
    setBiometricTesting(false);
  };

  const fetchBiometricStatus = async () => {
    try {
      const status = await api.getBiometricStatus();
      if (status) {
        setBiometricStatus(status);
        if (status.localIp) setLocalIp(status.localIp);
        if (status.targetIp && status.targetIp !== '192.168.1.201') setBiometricIp(status.targetIp);
        if (status.autoSyncEnabled !== undefined) setBiometricAutoSync(status.autoSyncEnabled);
        if (status.deviceInfo) setBiometricDeviceInfo(status.deviceInfo);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchBiometricStatus();
    const interval = setInterval(() => {
      fetchBiometricStatus();
      if (typeof refreshAttendance === 'function') refreshAttendance();
      if (typeof refreshSMSLogs === 'function') refreshSMSLogs();
    }, 8000);
    return () => clearInterval(interval);
  }, [activeTab, refreshAttendance, refreshSMSLogs]);

  const handleTestBiometric = async () => {
    if (!biometricIp.trim()) {
      toast.error('Please enter Biometric Machine IP');
      return;
    }
    setBiometricTesting(true);
    try {
      localStorage.setItem('biometric_ip', biometricIp.trim());
      localStorage.setItem('biometric_port', biometricPort.trim());
      const res = await api.testBiometricConnection({ ip: biometricIp.trim(), port: parseInt(biometricPort, 10) || 71 });
      if (res && res.success) {
        setBiometricDeviceInfo(res.deviceInfo);
        toast.success(`🎉 Connected successfully to Biometric Machine at ${biometricIp}:${biometricPort || 71}!`);
        fetchBiometricStatus();
      } else {
        toast.error(res?.error || 'Connection failed');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to connect to Biometric Machine');
    } finally {
      setBiometricTesting(false);
    }
  };

  const handleSyncBiometricNow = async () => {
    if (!biometricIp.trim()) {
      toast.error('Please enter Biometric Machine IP');
      return;
    }
    setBiometricSyncing(true);
    try {
      localStorage.setItem('biometric_ip', biometricIp.trim());
      localStorage.setItem('biometric_port', biometricPort.trim());
      const res = await api.syncBiometricNow({ ip: biometricIp.trim(), port: parseInt(biometricPort, 10) || 71 });
      if (res && res.success) {
        toast.success(`🎉 ${res.message || `Synced ${res.newlyAdded} new attendance punches!`}`);
        if (typeof refreshAttendance === 'function') await refreshAttendance();
        if (typeof refreshSMSLogs === 'function') await refreshSMSLogs();
        fetchBiometricStatus();
      } else {
        toast.error(res?.error || 'Sync failed');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to sync from Biometric Machine');
    } finally {
      setBiometricSyncing(false);
    }
  };

  const handleSyncAllDevicesNow = async () => {
    const targetDevices = discoveredDevices.length > 0 ? discoveredDevices : [{ ip: biometricIp.trim(), port: parseInt(biometricPort, 10) || 71, name: 'Main Machine' }];
    setBiometricSyncing(true);
    try {
      toast.loading(`⚡ Syncing ${targetDevices.length} Biometric Machines simultaneously...`, { id: 'sync-all' });
      const res = await api.syncAllBiometricDevices({ devices: targetDevices });
      toast.dismiss('sync-all');
      if (res && res.success) {
        toast.success(`🎉 ${res.message || `Synced ${res.newlyAdded} new attendance logs from ${res.successfulDevices} machines!`}`);
        if (typeof refreshAttendance === 'function') await refreshAttendance();
        if (typeof refreshSMSLogs === 'function') await refreshSMSLogs();
        fetchBiometricStatus();
      } else {
        toast.error(res?.error || 'Batch sync failed');
      }
    } catch (err) {
      toast.dismiss('sync-all');
      toast.error(err.message || 'Failed to sync machines');
    } finally {
      setBiometricSyncing(false);
    }
  };

  const handleToggleAutoSync = async () => {
    const nextState = !biometricAutoSync;
    const targetDevices = discoveredDevices.length > 0 ? discoveredDevices : [{ ip: biometricIp.trim(), port: parseInt(biometricPort, 10) || 71 }];
    try {
      const res = await api.toggleBiometricAutoSync({
        enabled: nextState,
        ip: biometricIp.trim(),
        port: parseInt(biometricPort, 10) || 71,
        devices: targetDevices,
        intervalSeconds: 15
      });
      setBiometricAutoSync(res.autoSyncEnabled);
      if (res.autoSyncEnabled) {
        toast.success(`🚀 Auto-Sync enabled! Polling ${targetDevices.length} machine(s) every 15 seconds.`);
      } else {
        toast.success('🛑 Auto-Sync paused.');
      }
      fetchBiometricStatus();
    } catch (err) {
      toast.error(err.message || 'Failed to toggle Auto-Sync');
    }
  };
  
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
      setCalStudent('all');
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
        sessionName: record?.sessionName || null,
        smsSent: record?.smsSent || false,
      };
    });
  }, [activeStudents, todayRecords]);

  // Filter today's list based on selected badge and search input
  const filteredTodayStudents = useMemo(() => {
    const query = todaySearch.toLowerCase().trim();
    return todayTableData.filter(item => {
      // 1. Status badge filter
      if (attendanceFilter === 'present' && !(item.status === 'present' || item.status === 'late')) return false;
      if (attendanceFilter === 'late' && item.status !== 'late') return false;
      if (attendanceFilter === 'absent' && item.status !== 'absent') return false;

      // 2. Search query filter
      if (query) {
        const name = (item.student?.name || '').toLowerCase();
        const roll = String(item.student?.rollNo || '').toLowerCase();
        const phone = String(item.student?.phone || item.student?.parentPhone || '').toLowerCase();
        const batch = String(item.student?.batch || item.student?.targetClass || '').toLowerCase();
        const session = String(item.sessionName || '').toLowerCase();
        const match = name.includes(query) || roll.includes(query) || phone.includes(query) || batch.includes(query) || session.includes(query);
        if (!match) return false;
      }

      return true;
    });
  }, [todayTableData, attendanceFilter, todaySearch]);

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
                  <div className="w-full mt-24" style={{ position: 'relative', zIndex: 50 }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '6px', display: 'block' }}>
                      Select Student
                    </label>
                    <SearchableStudentSelect
                      value={selectedStudent}
                      onChange={setSelectedStudent}
                      students={activeStudents}
                      includeAllOption={false}
                      placeholder="🔍 Search student by name / roll number..."
                    />
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
              <div className="card-header flex justify-between items-center flex-wrap gap-12">
                <div>
                  <div className="card-title flex items-center gap-8">
                    <Calendar size={18} />
                    Today's Attendance Record
                  </div>
                  <div className="card-subtitle">
                    {dateStr} • {stats.present + stats.late} of {activeStudents.length} present ({stats.percentage}% rate)
                  </div>
                </div>
                <div className="flex gap-12 items-center flex-wrap">
                  <button onClick={exportTodayAttendance} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 14px', fontSize: '0.85rem', fontWeight: 600 }}>
                    <Download size={15} /> Download Excel
                  </button>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div style={{
                padding: '12px 16px',
                background: 'var(--surface-color, #f8fafc)',
                borderBottom: '1px solid var(--border-color, #e2e8f0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                {/* Status Badges Filter */}
                <div className="flex gap-8 items-center flex-wrap">
                  <button
                    type="button"
                    onClick={() => setAttendanceFilter('all')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      background: attendanceFilter === 'all' ? '#3b82f6' : '#e2e8f0',
                      color: attendanceFilter === 'all' ? '#ffffff' : '#475569',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    All ({todayTableData.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttendanceFilter('present')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      background: attendanceFilter === 'present' ? '#10b981' : '#dcfce7',
                      color: attendanceFilter === 'present' ? '#ffffff' : '#15803d',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Present ({stats.present})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttendanceFilter('late')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      background: attendanceFilter === 'late' ? '#f59e0b' : '#fef3c7',
                      color: attendanceFilter === 'late' ? '#ffffff' : '#b45309',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Late ({stats.late})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttendanceFilter('absent')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      background: attendanceFilter === 'absent' ? '#ef4444' : '#fee2e2',
                      color: attendanceFilter === 'absent' ? '#ffffff' : '#b91c1c',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Absent ({stats.absent})
                  </button>
                </div>

                {/* Search Input */}
                <div style={{ position: 'relative', width: '300px', minWidth: '240px' }}>
                  <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Search by student name, roll no..."
                    value={todaySearch}
                    onChange={(e) => setTodaySearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 32px 7px 32px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #cbd5e1)',
                      fontSize: '0.82rem',
                      outline: 'none',
                      background: '#ffffff'
                    }}
                  />
                  {todaySearch && (
                    <button
                      type="button"
                      onClick={() => setTodaySearch('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: '2px'
                      }}
                      title="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
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
                    {filteredTodayStudents.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                          <Search size={32} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            No students found matching your filters
                          </div>
                          {todaySearch && (
                            <button
                              type="button"
                              onClick={() => { setTodaySearch(''); setAttendanceFilter('all'); }}
                              className="btn btn-secondary btn-sm"
                              style={{ marginTop: '10px', fontSize: '0.78rem' }}
                            >
                              Clear Search & Filters
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredTodayStudents.map((row, idx) => (
                        <motion.tr
                          key={row.student.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.02 }}
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
                                  Roll: {row.student.rollNo} {row.student.batch ? `• ${row.student.batch}` : ''}
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
                      ))
                    )}
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
              <div className="card mb-20" style={{ background: 'var(--surface-color, #f8fafc)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color-light)', position: 'relative', zIndex: 100 }}>
                <div className="flex items-center justify-between flex-wrap gap-12">
                  {/* Select Student Dropdown */}
                  <div style={{ minWidth: '260px', flex: '1 1 260px', position: 'relative', zIndex: 100 }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      Select Student:
                    </label>
                    <SearchableStudentSelect
                      value={calStudent}
                      onChange={setCalStudent}
                      students={activeStudents}
                      includeAllOption={true}
                      allLabel="🌟 All Students (Combined)"
                      placeholder="🔍 Search student by name / roll no..."
                    />
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
        {/* ========== TAB 4: Biometric Control Center & ADMS Setup ========== */}
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
              {/* Header */}
              <div className="flex items-center justify-between gap-12 mb-20 flex-wrap">
                <div className="flex items-center gap-12">
                  <div style={{ padding: 12, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-blue)' }}>
                    <Fingerprint size={28} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>Biometric Machine Control Center</h2>
                    <p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                      Direct Wi-Fi Socket Connection, 1-Click Punch Pulling & Real-Time ADMS Integration
                    </p>
                  </div>
                </div>
              </div>

              {/* ---------------------------------------------------------------- */}
              {/* UNIFIED BIOMETRIC CONTROL CENTER (AUTO-SCAN + 1-CLICK SYNC)       */}
              {/* ---------------------------------------------------------------- */}
              <div className="flex flex-col gap-20">
                {/* IP Input & Action Toolbar */}
                <div style={{
                  background: 'var(--surface-color)',
                  padding: '20px 24px',
                  borderRadius: 16,
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Wifi size={18} color="var(--accent-blue)" /> Machine Wi-Fi Connection
                      </h3>

                      <button
                        type="button"
                        onClick={handleAutoScanNetwork}
                        disabled={isScanningNetwork}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: '1.5px solid rgba(139, 92, 246, 0.4)',
                          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)',
                          color: '#8b5cf6',
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          cursor: isScanningNetwork ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 8px rgba(139, 92, 246, 0.15)'
                        }}
                      >
                        <Radar size={15} className={isScanningNetwork ? 'animate-spin' : ''} />
                        <span>{isScanningNetwork ? 'Scanning Wi-Fi (2s)...' : '🔍 Auto-Scan Wi-Fi (Find All Machines)'}</span>
                      </button>
                    </div>

                    {/* Live PC IP Badge */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(59, 130, 246, 0.08)',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: 'var(--accent-blue)'
                    }}>
                      <span>🖥️ This PC IP:</span>
                      <code style={{ fontFamily: 'monospace', fontWeight: 800 }}>{localIp}</code>
                    </div>
                  </div>

                  {/* Discovered Machines Card Grid */}
                  {discoveredDevices.length > 0 && (
                    <div style={{
                      background: 'rgba(59, 130, 246, 0.04)',
                      border: '1.5px solid rgba(59, 130, 246, 0.25)',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      marginBottom: '16px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Radar size={16} className={isScanningNetwork ? 'animate-spin' : ''} />
                          <span>Connected Biometric Machines on Wi-Fi ({discoveredDevices.length} Online)</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={handleSyncAllDevicesNow}
                            disabled={biometricSyncing}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '8px',
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              color: '#fff',
                              border: 'none',
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              cursor: biometricSyncing ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                            }}
                          >
                            <RefreshCw size={13} className={biometricSyncing ? 'animate-spin' : ''} />
                            <span>{biometricSyncing ? 'Syncing All Machines...' : `⚡ Sync All ${discoveredDevices.length} Machines`}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setDiscoveredDevices([])}
                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                        {discoveredDevices.map((dev, idx) => {
                          const isSelected = biometricIp === dev.ip && String(biometricPort) === String(dev.port);
                          return (
                            <div
                              key={idx}
                              style={{
                                background: isSelected ? 'rgba(16, 185, 129, 0.08)' : 'var(--surface-color)',
                                border: isSelected ? '1.5px solid var(--accent-green)' : '1px solid var(--border-color)',
                                borderRadius: '10px',
                                padding: '10px 14px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '10px'
                              }}
                            >
                              <div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>📟</span> {dev.name}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: '2px' }}>
                                  <code>{dev.ip}:{dev.port}</code> <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>• {dev.status}</span>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleSelectDiscoveredDevice(dev)}
                                  style={{
                                    padding: '6px 10px',
                                    borderRadius: '8px',
                                    background: isSelected ? 'var(--accent-green)' : 'var(--accent-blue)',
                                    color: '#fff',
                                    border: 'none',
                                    fontSize: '0.74rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {isSelected ? <Check size={12} /> : <Zap size={12} />}
                                  <span>{isSelected ? 'Selected' : 'Select'}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', alignItems: 'flex-end' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        SELECTED MACHINE IP ADDRESS:
                      </label>
                      <input
                        type="text"
                        value={biometricIp}
                        onChange={(e) => {
                          setBiometricIp(e.target.value);
                          localStorage.setItem('biometric_ip', e.target.value);
                        }}
                        placeholder="e.g. 192.168.0.12"
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          border: '1.5px solid var(--border-color)',
                          background: 'var(--bg-color)',
                          color: 'var(--text-primary)',
                          fontSize: '0.95rem',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        MACHINE PORT:
                      </label>
                      <input
                        type="number"
                        value={biometricPort}
                        onChange={(e) => {
                          setBiometricPort(e.target.value);
                          localStorage.setItem('biometric_port', e.target.value);
                        }}
                        placeholder="71 or 4370"
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          border: '1.5px solid var(--border-color)',
                          background: 'var(--bg-color)',
                          color: 'var(--text-primary)',
                          fontSize: '0.95rem',
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        onClick={handleTestBiometric}
                        disabled={biometricTesting || biometricSyncing}
                        className="btn"
                        style={{
                          padding: '10px 16px',
                          borderRadius: '10px',
                          background: 'rgba(59, 130, 246, 0.12)',
                          color: 'var(--accent-blue)',
                          border: '1.5px solid rgba(59, 130, 246, 0.3)',
                          fontWeight: 800,
                          fontSize: '0.88rem',
                          cursor: biometricTesting ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Activity size={16} className={biometricTesting ? 'animate-spin' : ''} />
                        <span>{biometricTesting ? 'Connecting...' : 'Test Connection'}</span>
                      </button>

                      {discoveredDevices.length > 1 ? (
                        <button
                          onClick={handleSyncAllDevicesNow}
                          disabled={biometricSyncing || biometricTesting}
                          className="btn"
                          style={{
                            padding: '10px 18px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: '#ffffff',
                            border: 'none',
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            cursor: biometricSyncing ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                          }}
                        >
                          <RefreshCw size={16} className={biometricSyncing ? 'animate-spin' : ''} />
                          <span>{biometricSyncing ? 'Syncing All Machines...' : `⚡ Sync All (${discoveredDevices.length}) Machines`}</span>
                        </button>
                      ) : (
                        <button
                          onClick={handleSyncBiometricNow}
                          disabled={biometricSyncing || biometricTesting}
                          className="btn"
                          style={{
                            padding: '10px 18px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: '#ffffff',
                            border: 'none',
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            cursor: biometricSyncing ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                          }}
                        >
                          <RefreshCw size={16} className={biometricSyncing ? 'animate-spin' : ''} />
                          <span>{biometricSyncing ? 'Pulling Logs...' : '1-Click Sync Attendance'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Auto-Sync Switch & Status Banner */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '16px'
                }}>
                  {/* Auto-Sync Card */}
                  <div style={{
                    background: biometricAutoSync ? 'rgba(16, 185, 129, 0.08)' : 'var(--surface-color)',
                    border: biometricAutoSync ? '1.5px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '18px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: biometricAutoSync ? '#10b981' : 'var(--text-secondary)',
                          display: 'inline-block'
                        }} />
                        <span style={{ fontWeight: 800, fontSize: '0.92rem' }}>Continuous Background Auto-Sync</span>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        {biometricAutoSync 
                          ? 'Actively polling machine every 15s for instant punch arrival.' 
                          : 'Turn ON to continuously sync attendance every 15 seconds.'}
                      </p>
                    </div>

                    <button
                      onClick={handleToggleAutoSync}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '10px',
                        fontWeight: 800,
                        fontSize: '0.82rem',
                        border: 'none',
                        background: biometricAutoSync ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'var(--accent-blue)',
                        color: '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {biometricAutoSync ? <Pause size={14} /> : <Play size={14} />}
                      <span>{biometricAutoSync ? 'Stop Auto-Sync' : 'Start Auto-Sync'}</span>
                    </button>
                  </div>

                  {/* Machine Details Card */}
                  <div style={{
                    background: 'var(--surface-color)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    padding: '18px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                        DEVICE STATUS
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 900, color: biometricDeviceInfo ? '#10b981' : 'var(--text-primary)', marginTop: '2px' }}>
                        {biometricDeviceInfo ? '✅ Connected & Ready' : '⚪ Not Connected'}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {biometricDeviceInfo 
                          ? `Protocol: ${biometricDeviceInfo.version || 'Realtime/FK'} | Status: ${biometricDeviceInfo.status || 'Ready'}`
                          : 'Click "Test Connection" to verify machine communication.'}
                      </div>
                    </div>

                    {biometricStatus?.lastSyncTime && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.70rem', color: 'var(--text-secondary)' }}>LAST SYNC</div>
                        <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--accent-blue)' }}>
                          {new Date(biometricStatus.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Step-by-Step Machine Configuration Guide */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
                  border: '1.5px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '16px',
                  padding: '20px 24px',
                  marginTop: '6px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.1rem' }}>⚙️</span>
                      <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        Real-Time Push Setup (Biometric Machine Screen Configuration)
                      </h4>
                    </div>

                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: biometricStatus?.admsStatus?.totalPushesReceived > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      color: biometricStatus?.admsStatus?.totalPushesReceived > 0 ? '#10b981' : 'var(--accent-blue)'
                    }}>
                      <Activity size={13} className={biometricStatus?.admsStatus?.totalPushesReceived > 0 ? 'animate-pulse' : ''} />
                      <span>
                        ADMS Receiver: {biometricStatus?.admsStatus?.totalPushesReceived > 0 ? `Active (${biometricStatus.admsStatus.totalPushesReceived} pushes)` : 'Listening on Port 5000'}
                      </span>
                    </div>
                  </div>
                  <p style={{ margin: '0 0 16px', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                    Biometric machine real-time me student ke punch directly is computer par push karegi. Kripya machine ke physical screen me ye settings verify karein:
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                    <div style={{ background: 'var(--surface-color)', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 700 }}>1️⃣ MACHINE IP (Device IP)</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent-blue)', marginTop: '4px', fontFamily: 'monospace' }}>
                        {biometricIp || '192.168.0.12'} (Port: {biometricPort || 71})
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Menu ➔ Comm ➔ Network ➔ IP</div>
                    </div>

                    <div style={{ background: 'var(--surface-color)', padding: '12px 14px', borderRadius: '10px', border: '1.5px solid rgba(16, 185, 129, 0.4)' }}>
                      <div style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 800 }}>2️⃣ SERVER IP (Computer IP)</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#10b981', marginTop: '4px', fontFamily: 'monospace' }}>
                        {localIp} (Port: 5000)
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Menu ➔ Comm ➔ Cloud Server / ADMS</div>
                    </div>

                    <div style={{ background: 'var(--surface-color)', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 700 }}>3️⃣ PUSH / CLOUD SERVER</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#8b5cf6', marginTop: '4px' }}>
                        Enable / ON
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>Auto-sends punch on thumb scan</div>
                    </div>
                  </div>
                </div>

                {/* Real-time Recent Biometric Punches Stream */}
                <div style={{
                  background: 'var(--surface-color)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '16px',
                  padding: '20px 24px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Zap size={18} color="#eab308" />
                      <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        Live Biometric Punch Activity Stream
                      </h4>
                      <span style={{
                        background: 'rgba(234, 179, 8, 0.12)',
                        color: '#ca8a04',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 800
                      }}>
                        Real-Time
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => { fetchBiometricStatus(); if (typeof refreshAttendance === 'function') refreshAttendance(); }}
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.76rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <RefreshCw size={12} /> Refresh Stream
                      </button>
                    </div>
                  </div>

                  {biometricStatus?.recentPunches && biometricStatus.recentPunches.length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table" style={{ fontSize: '0.82rem', margin: 0 }}>
                        <thead>
                          <tr>
                            <th>Student</th>
                            <th>Roll / ID</th>
                            <th>Punch Time</th>
                            <th>Type</th>
                            <th>WhatsApp Alert</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {biometricStatus.recentPunches.map((punch, pIdx) => (
                            <tr key={pIdx}>
                              <td>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                  {punch.studentName || 'Unregistered Card / Roll'}
                                </div>
                                {punch.sessionName && (
                                  <div style={{ fontSize: '0.70rem', color: 'var(--accent-blue)' }}>
                                    Session: {punch.sessionName}
                                  </div>
                                )}
                              </td>
                              <td>
                                <code style={{ fontFamily: 'monospace', fontWeight: 700, background: 'var(--bg-color)', padding: '2px 6px', borderRadius: '4px' }}>
                                  {punch.rollNumber}
                                </code>
                              </td>
                              <td style={{ fontWeight: 600 }}>
                                {punch.punchTime} <span style={{ fontSize: '0.70rem', color: 'var(--text-secondary)' }}>({punch.punchDate})</span>
                              </td>
                              <td>
                                <span className={`badge ${punch.type === 'IN' ? 'badge-present' : 'badge-late'}`} style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                                  {punch.type === 'IN' ? 'CHECK-IN' : 'CHECK-OUT'}
                                </span>
                              </td>
                              <td>
                                {punch.parentPhone ? (
                                  <span style={{ color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.76rem' }}>
                                    <CheckCircle2 size={13} /> {punch.parentPhone}
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>No Parent Phone</span>
                                )}
                              </td>
                              <td>
                                <span style={{ color: '#10b981', fontWeight: 800, fontSize: '0.74rem' }}>
                                  ✅ Synced to Attendance
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{
                      textAlign: 'center',
                      padding: '24px 16px',
                      background: 'var(--bg-color)',
                      borderRadius: '12px',
                      border: '1px dashed var(--border-color)',
                      color: 'var(--text-secondary)'
                    }}>
                      <Radar size={28} style={{ opacity: 0.4, margin: '0 auto 6px' }} />
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Listening for live biometric thumb scans...</div>
                      <div style={{ fontSize: '0.76rem', marginTop: '4px' }}>
                        Jaise hi koi student machine par thumb scan karega, unki attendance aur WhatsApp alert yahan instantly display hogi.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
