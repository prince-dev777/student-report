import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, CheckCircle2, XCircle, Clock, Search, Filter, 
  Calendar, RefreshCw, LogOut, LogIn, CheckCheck, UserCheck, ShieldAlert,
  QrCode, Camera, ScanLine, Sparkles, Volume2, VolumeX, Smartphone, Radio
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api, API_BASE } from '../utils/api';
import PWAInstallPrompt from '../components/PWAInstallPrompt';
import AppInstallGate from '../components/AppInstallGate';

export default function StaffAttendanceWeb() {
  const [proceedToWeb, setProceedToWeb] = useState(() => !!sessionStorage.getItem('skip_staff_install_gate'));
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [courseFilter, setCourseFilter] = useState('ALL');
  const [classFilter, setClassFilter] = useState('ALL');
  const [savingId, setSavingId] = useState(null);

  // ⚡ Live Scanner & View Mode States
  const [viewTab, setViewTab] = useState('roster'); // 'roster' | 'scanner'
  const [scannerType, setScannerType] = useState('camera'); // 'camera' | 'hardware'
  const [kioskCode, setKioskCode] = useState('');
  const [lastScannedItem, setLastScannedItem] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const scanIntervalRef = React.useRef(null);

  // Passcode Auth with Backend Token
  const [passcode, setPasscode] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(
    sessionStorage.getItem('staff_authed') === 'true'
  );

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!passcode) return toast.error("Please enter a passcode");
    setIsLoggingIn(true);
    
    const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = API_BASE;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // Wait max 4 seconds before fallback

      const res = await fetch(`${baseUrl}/auth/staff-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.token) localStorage.setItem('staff_token', data.token);
        if (data.logo) localStorage.setItem('institute_logo', data.logo);
        if (data.instituteName) localStorage.setItem('institute_name', data.instituteName);
        setIsAuthenticated(true);
        sessionStorage.setItem('staff_authed', 'true');
        toast.success(`Welcome to Staff Portal! (${data.instituteName || 'Career Xone'})`);
        setIsLoggingIn(false);
        return;
      }
    } catch(err) {
      console.warn('Backend login timeout/fail, falling back to local auth...');
    }

    // Fallback to local passcode check
    const storedCode = localStorage.getItem('staff_passcode') || '1234';
    if (passcode.trim() === storedCode.trim()) {
      setIsAuthenticated(true);
      sessionStorage.setItem('staff_authed', 'true');
      toast.success('Welcome to Staff Attendance Portal!');
    } else {
      toast.error('Invalid Staff Access Passcode!');
    }
    setIsLoggingIn(false);
  };

  // Fetch students and attendance on date change with robust fallbacks
  const fetchData = async () => {
    setLoading(true);
    try {
      let stdData = [];
      let attData = [];
      
      const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const baseUrl = API_BASE;
      
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
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Outfit', 'Inter', sans-serif",
        padding: '16px'
      }}>
        {/* PWA Install Banner on Login Screen */}
        <div style={{ width: '100%', maxWidth: '380px', marginBottom: '14px' }}>
          <PWAInstallPrompt appName="CX Staff" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(16px)',
            borderRadius: '24px',
            padding: '32px 24px',
            maxWidth: '380px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            color: '#0f172a'
          }}
        >
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '18px',
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
            boxShadow: '0 8px 20px rgba(124, 58, 237, 0.35)'
          }}>
            <UserCheck size={30} />
          </div>

          <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: '0 0 4px' }}>Staff Attendance</h2>
          <p style={{ fontSize: '0.80rem', color: '#64748b', margin: '0 0 20px', fontWeight: 600 }}>
            Enter your Staff Access Passcode to unlock daily attendance punch desk
          </p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="password"
              placeholder="Enter Access Passcode"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1.5px solid #cbd5e1',
                background: '#f8fafc',
                color: '#0f172a',
                fontSize: '1.1rem',
                textAlign: 'center',
                letterSpacing: '4px',
                fontWeight: 800,
                outline: 'none'
              }}
            />

            <button
              type="submit"
              disabled={isLoggingIn}
              style={{
                width: '100%',
                padding: '12px 20px',
                background: isLoggingIn ? '#94a3b8' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '0.92rem',
                fontWeight: 800,
                cursor: isLoggingIn ? 'not-allowed' : 'pointer',
                boxShadow: isLoggingIn ? 'none' : '0 4px 14px rgba(124, 58, 237, 0.4)',
                opacity: isLoggingIn ? 0.7 : 1
              }}
            >
              {isLoggingIn ? 'Authenticating...' : 'Unlock Staff Desk'}
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
      const baseUrl = API_BASE;
      const token = localStorage.getItem('staff_token') || localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let apiSuccess = false;
      try {
        const res = await fetch(`${baseUrl}/staff/attendance`, {
          method: 'POST',
          headers,
          body: JSON.stringify(record)
        });
        
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP error! status: ${res.status}`);
        }
        apiSuccess = true;
      } catch(e) {
        console.error('Backend markAttendance API failed:', e);
        throw e; // Throw so we don't mistakenly show success if API fails
      }

      // Update local state & localStorage ONLY if API call succeeded
      if (apiSuccess) {
        setAttendance(prev => {
          const filtered = prev.filter(r => !(r.studentId === student.id && (r.date || r.timestamp).substring(0, 10) === selectedDate));
          const updated = [...filtered, record];
          try { localStorage.setItem('attendance', JSON.stringify(updated)); } catch(e) {}
          return updated;
        });

        const label = status === 'IN' ? 'Checked In' : status === 'OUT' ? 'Checked Out' : 'Marked Absent';
        toast.success(`${student.name}: ${label} at ${formattedTime}`);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save attendance');
    } finally {
      setSavingId(null);
    }
  };

  // 🔊 Sound chime for punch feedback
  const playPunchSound = (type = 'success') => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === 'success') {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.setValueAtTime(160, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {}
  };

  // ⚡ Process Code from Camera Scanner or Hardware 2D Gun
  const handleProcessScanCode = async (rawInput) => {
    const raw = String(rawInput || '').trim();
    if (!raw) return;

    setKioskCode('');

    // 1. JSON extraction from QR cards
    let extractedRoll = raw;
    try {
      if (raw.startsWith('{') && raw.endsWith('}')) {
        const parsed = JSON.parse(raw);
        extractedRoll = String(parsed.rollNo || parsed.roll || parsed.id || parsed.studentId || raw);
      }
    } catch (e) {}

    // 2. URL extraction
    if (extractedRoll.startsWith('http://') || extractedRoll.startsWith('https://')) {
      try {
        const u = new URL(extractedRoll);
        const parts = u.pathname.split('/').filter(Boolean);
        extractedRoll = u.searchParams.get('roll') || u.searchParams.get('id') || parts[parts.length - 1] || extractedRoll;
      } catch (e) {}
    }
    extractedRoll = extractedRoll.trim().toLowerCase();

    // 3. Match student
    const matched = students.find(s => {
      const r = String(s.rollNo || '').trim().toLowerCase();
      const id = String(s.id || '').trim().toLowerCase();
      const phone = String(s.parentPhone || s.parentPhone2 || '').trim();
      return r === extractedRoll || id === extractedRoll || phone === extractedRoll;
    }) || students.find(s => {
      const numA = parseInt(s.rollNo, 10);
      const numB = parseInt(extractedRoll, 10);
      return !isNaN(numA) && !isNaN(numB) && numA === numB;
    });

    if (!matched) {
      playPunchSound('error');
      toast.error(`❌ Student Not Found for Code: "${rawInput}"`);
      return;
    }

    // 4. Anti-spam debounce (60s / 1 min cooldown)
    const now = Date.now();
    if (lastScannedItem?.student?.id === matched.id && (now - (lastScannedItem?.timestampMs || 0)) < 60000) {
      const elapsed = Math.round((now - (lastScannedItem?.timestampMs || 0)) / 1000);
      const remaining = 60 - elapsed;
      toast(`⏳ ${matched.name} was already punched ${elapsed}s ago! Please wait ${remaining}s.`, { icon: '⚠️' });
      return;
    }

    // 5. Determine Check-In vs Check-Out
    const currentStatus = getStudentStatus(matched.id).status;
    const nextStatus = (currentStatus === 'IN' || currentStatus === 'PRESENT') ? 'OUT' : 'IN';

    playPunchSound('success');
    setLastScannedItem({
      student: matched,
      status: nextStatus,
      timeStr: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      timestampMs: now
    });

    await handleMarkStatus(matched, nextStatus);
  };

  // Camera Scanner Lifecycle
  useEffect(() => {
    if (viewTab !== 'scanner' || scannerType !== 'camera' || !isAuthenticated) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      setIsCameraActive(false);
      return;
    }

    let isSubscribed = true;

    async function startCamera() {
      setCameraError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (!isSubscribed) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();
          setIsCameraActive(true);
        }

        // Initialize BarcodeDetector if supported
        if ('BarcodeDetector' in window) {
          const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'code_39'] });
          scanIntervalRef.current = setInterval(async () => {
            if (videoRef.current && videoRef.current.readyState === 4) {
              try {
                const barcodes = await barcodeDetector.detect(videoRef.current);
                if (barcodes && barcodes.length > 0) {
                  const detectedVal = barcodes[0].rawValue;
                  if (detectedVal) {
                    handleProcessScanCode(detectedVal);
                  }
                }
              } catch (detectErr) {}
            }
          }, 350);
        }
      } catch (camErr) {
        console.warn('Camera stream error:', camErr);
        setCameraError('Camera access unavailable. Using Hardware 2D Gun / Manual input mode.');
        setScannerType('hardware');
      }
    }

    startCamera();

    return () => {
      isSubscribed = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [viewTab, scannerType, isAuthenticated]);

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

const getCourseName = (batch) => {
  if (!batch) return 'Default';
  return BATCH_MAP[batch] || batch;
};

  // Filtered student list & Course/Class Resolution
  const defaultCourseNames = ['JEE Mains', 'JEE Advanced', 'NEET', 'MHCET'];
  const studentCourseNames = students.map(s => getCourseName(s.batch));
  const availableCourses = Array.from(new Set([...defaultCourseNames, ...studentCourseNames])).filter(Boolean);
  const availableClasses = Array.from(new Set(students.map(s => s.class))).filter(Boolean);

  const filteredStudents = students.filter(student => {
    const nameMatch = String(student.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const rollMatch = String(student.rollNo || '').toLowerCase().includes(searchQuery.toLowerCase());
    const phoneMatch = String(student.parentPhone || '').includes(searchQuery);
    const matchesSearch = nameMatch || rollMatch || phoneMatch;

    const studentCourseName = getCourseName(student.batch);
    const matchesCourse = 
      courseFilter === 'ALL' || 
      studentCourseName === courseFilter || 
      student.batch === courseFilter;
      
    const matchesClass = classFilter === 'ALL' || student.class === classFilter;

    const currentStatus = getStudentStatus(student.id).status;
    const matchesStatus = 
      statusFilter === 'ALL' ||
      (statusFilter === 'PRESENT' && (currentStatus === 'PRESENT' || currentStatus === 'IN')) ||
      (statusFilter === 'OUT' && currentStatus === 'OUT') ||
      (statusFilter === 'ABSENT' && currentStatus === 'ABSENT') ||
      (statusFilter === 'LATE' && currentStatus === 'LATE') ||
      (statusFilter === 'UNMARKED' && currentStatus === 'UNMARKED');

    return matchesSearch && matchesCourse && matchesClass && matchesStatus;
  });

  const instituteLogo = localStorage.getItem('institute_logo') || localStorage.getItem('logo');
  const instituteName = localStorage.getItem('institute_name') || 'Career Xone';

  return (
    <div style={styles.container}>
      {/* PWA Home Screen Install Banner */}
      <PWAInstallPrompt appName="CX Staff" />

      {/* Top Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <img 
            src={instituteLogo || '/logo.png'} 
            alt="Career Xone Logo" 
            style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'contain', border: '1px solid #cbd5e1', background: '#ffffff', padding: '2px' }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div>
            <h1 style={styles.headerTitle}>{instituteName} — Staff Portal</h1>
            <p style={styles.headerSubtitle}>Manual Attendance Management</p>
          </div>
        </div>

        <div style={styles.headerRight}>
          <a
            href="#/inquiry"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#059669',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 700,
              textDecoration: 'none'
            }}
          >
            📋 Inquiries
          </a>

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
        {/* Navigation Tabs: Roster vs 2D/Camera Scanner */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', gap: '8px', background: '#e2e8f0', padding: '4px', borderRadius: '12px' }}>
            <button
              onClick={() => setViewTab('roster')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '9px',
                border: 'none',
                background: viewTab === 'roster' ? '#ffffff' : 'transparent',
                color: viewTab === 'roster' ? '#0f172a' : '#64748b',
                fontWeight: 800,
                fontSize: '0.86rem',
                cursor: 'pointer',
                boxShadow: viewTab === 'roster' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Users size={16} color={viewTab === 'roster' ? '#2563eb' : '#64748b'} />
              Student Roster
            </button>
            
            <button
              onClick={() => setViewTab('scanner')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '9px',
                border: 'none',
                background: viewTab === 'scanner' ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : 'transparent',
                color: viewTab === 'scanner' ? '#ffffff' : '#64748b',
                fontWeight: 800,
                fontSize: '0.86rem',
                cursor: 'pointer',
                boxShadow: viewTab === 'scanner' ? '0 2px 10px rgba(124, 58, 237, 0.3)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <QrCode size={16} color={viewTab === 'scanner' ? '#ffffff' : '#64748b'} />
              ⚡ 2D / QR Scanner Desk
            </button>
          </div>

          {viewTab === 'scanner' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                title="Toggle Beep Sound"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '7px 12px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: soundEnabled ? '#059669' : '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                {soundEnabled ? 'Sound ON' : 'Muted'}
              </button>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* ⚡ TAB 2: LIVE 2D QR / CAMERA ATTENDANCE SCANNER DESK      */}
        {/* ========================================================= */}
        {viewTab === 'scanner' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            {/* Left Box: Scanner Viewfinder & Hardware Input */}
            <div style={{ background: '#ffffff', borderRadius: '18px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(124, 58, 237, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>
                    <ScanLine size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Live Attendance Scanner</h3>
                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Flash QR card or scan barcode</p>
                  </div>
                </div>

                {/* Scanner Type Switch: Camera vs 2D Gun */}
                <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '2px' }}>
                  <button
                    onClick={() => setScannerType('camera')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      background: scannerType === 'camera' ? '#7c3aed' : 'transparent',
                      color: scannerType === 'camera' ? '#ffffff' : '#64748b',
                      cursor: 'pointer'
                    }}
                  >
                    <Camera size={13} /> Camera
                  </button>
                  <button
                    onClick={() => setScannerType('hardware')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      background: scannerType === 'hardware' ? '#7c3aed' : 'transparent',
                      color: scannerType === 'hardware' ? '#ffffff' : '#64748b',
                      cursor: 'pointer'
                    }}
                  >
                    <Radio size={13} /> 2D Gun
                  </button>
                </div>
              </div>

              {/* Hardware Barcode & Roll Input Bar */}
              <form onSubmit={(e) => { e.preventDefault(); handleProcessScanCode(kioskCode); }} style={{ marginBottom: '14px' }}>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Scan Barcode / 2D Gun / Type 5-Digit Roll..."
                    value={kioskCode}
                    onChange={(e) => setKioskCode(e.target.value)}
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '12px 42px 12px 14px',
                      borderRadius: '12px',
                      border: '2px solid #7c3aed',
                      background: 'rgba(124, 58, 237, 0.03)',
                      color: '#0f172a',
                      fontSize: '0.95rem',
                      fontWeight: 800,
                      outline: 'none',
                      boxShadow: '0 0 0 3px rgba(124, 58, 237, 0.1)'
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      position: 'absolute',
                      right: '6px',
                      top: '6px',
                      bottom: '6px',
                      padding: '0 12px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#7c3aed',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    Punch
                  </button>
                </div>
              </form>

              {/* Camera Scanner Viewfinder */}
              {scannerType === 'camera' && (
                <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', maxHeight: '280px', borderRadius: '14px', overflow: 'hidden', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <video
                    ref={videoRef}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    autoPlay
                    playsInline
                    muted
                  />
                  {/* Viewfinder Target Frame */}
                  <div style={{
                    position: 'absolute',
                    width: '65%',
                    height: '65%',
                    border: '2.5px solid #a855f7',
                    borderRadius: '16px',
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
                    pointerEvents: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ width: '16px', height: '16px', borderTop: '3px solid #38bdf8', borderLeft: '3px solid #38bdf8' }}></span>
                      <span style={{ width: '16px', height: '16px', borderTop: '3px solid #38bdf8', borderRight: '3px solid #38bdf8' }}></span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ width: '16px', height: '16px', borderBottom: '3px solid #38bdf8', borderLeft: '3px solid #38bdf8' }}></span>
                      <span style={{ width: '16px', height: '16px', borderBottom: '3px solid #38bdf8', borderRight: '3px solid #38bdf8' }}></span>
                    </div>
                  </div>

                  <div style={{ position: 'absolute', bottom: '10px', background: 'rgba(0,0,0,0.65)', color: '#ffffff', padding: '4px 12px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 600, backdropFilter: 'blur(4px)' }}>
                    {isCameraActive ? '📷 Align Student QR Card in Box' : 'Initializing Camera...'}
                  </div>
                </div>
              )}

              {cameraError && (
                <div style={{ marginTop: '10px', padding: '10px 14px', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '0.78rem' }}>
                  {cameraError}
                </div>
              )}
            </div>

            {/* Right Box: Celebration Punch Showcase & Live Punch Feed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Latest Punched Student Showcase Card */}
              {lastScannedItem ? (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  key={lastScannedItem.student.id + lastScannedItem.timestampMs}
                  style={{
                    background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
                    borderRadius: '18px',
                    padding: '20px',
                    color: '#ffffff',
                    boxShadow: '0 10px 25px rgba(4, 120, 87, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                  }}
                >
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '16px',
                    background: 'rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.4rem',
                    fontWeight: 900,
                    border: '2px solid rgba(255,255,255,0.4)',
                    overflow: 'hidden'
                  }}>
                    {lastScannedItem.student.photo ? (
                      <img src={lastScannedItem.student.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      lastScannedItem.student.name?.substring(0, 2).toUpperCase()
                    )}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.25)', padding: '3px 10px', borderRadius: '12px', fontSize: '0.74rem', fontWeight: 800, marginBottom: '4px' }}>
                      <CheckCircle2 size={13} /> {lastScannedItem.status === 'IN' ? 'CHECKED IN' : 'CHECKED OUT'}
                    </div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 900, margin: '2px 0' }}>{lastScannedItem.student.name}</h3>
                    <div style={{ fontSize: '0.80rem', opacity: 0.9 }}>
                      Roll No: <strong>{lastScannedItem.student.rollNo}</strong> • {lastScannedItem.student.batch || 'General'}
                    </div>
                    <div style={{ fontSize: '0.74rem', opacity: 0.8, marginTop: '2px' }}>
                      Time: {lastScannedItem.timeStr} • Instant WhatsApp Sent 📱
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div style={{ background: '#ffffff', borderRadius: '18px', padding: '24px', border: '1px dashed #cbd5e1', textAlign: 'center', color: '#64748b' }}>
                  <Sparkles size={32} color="#a855f7" style={{ margin: '0 auto 8px' }} />
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>Ready to Scan</h4>
                  <p style={{ fontSize: '0.80rem', margin: 0 }}>Flash student QR code or scan with 2D gun to mark attendance instantly.</p>
                </div>
              )}

              {/* Today's Live Attendance Stats Strip */}
              <div style={{ background: '#ffffff', borderRadius: '16px', padding: '16px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Total</span>
                  <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '2px 0 0' }}>{totalStudents}</h4>
                </div>
                <div style={{ width: '1px', background: '#e2e8f0' }}></div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>Checked In</span>
                  <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#059669', margin: '2px 0 0' }}>{checkedInCount}</h4>
                </div>
                <div style={{ width: '1px', background: '#e2e8f0' }}></div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: 600 }}>Unmarked</span>
                  <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#d97706', margin: '2px 0 0' }}>{unmarkedCount}</h4>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {viewTab === 'roster' && (
          <>
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

        {/* Checked In Card */}
        <div 
          onClick={() => setStatusFilter('IN')}
          title="Click to view Checked In Students"
          className="staff-stat-card"
          style={{ 
            borderLeft: '4px solid #059669',
            boxShadow: (statusFilter === 'IN' || statusFilter === 'PRESENT') ? '0 0 0 2px #059669' : '0 2px 8px rgba(0,0,0,0.03)',
            background: (statusFilter === 'IN' || statusFilter === 'PRESENT') ? 'rgba(5,150,105,0.06)' : '#ffffff'
          }}
        >
          <div className="staff-stat-icon" style={{ background: 'rgba(5,150,105,0.08)' }}>
            <LogIn size={20} color="#059669" />
          </div>
          <div>
            <span className="staff-stat-label">Checked In</span>
            <h3 className="staff-stat-value">{checkedInCount} <small style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 600 }}>({attendancePercentage}%)</small></h3>
          </div>
        </div>

        {/* Checked Out Card */}
        <div 
          onClick={() => setStatusFilter('OUT')}
          title="Click to view Checked Out Students"
          className="staff-stat-card"
          style={{ 
            borderLeft: '4px solid #0284c7',
            boxShadow: statusFilter === 'OUT' ? '0 0 0 2px #0284c7' : '0 2px 8px rgba(0,0,0,0.03)',
            background: statusFilter === 'OUT' ? 'rgba(2,132,199,0.06)' : '#ffffff'
          }}
        >
          <div className="staff-stat-icon" style={{ background: 'rgba(2,132,199,0.08)' }}>
            <LogOut size={20} color="#0284c7" />
          </div>
          <div>
            <span className="staff-stat-label">Checked Out</span>
            <h3 className="staff-stat-value">{checkedOutCount}</h3>
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
            {/* Course Filter */}
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                outline: 'none',
                minWidth: '150px'
              }}
            >
              <option value="ALL">All Courses</option>
              {availableCourses.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            {/* Class Filter */}
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                outline: 'none',
                minWidth: '150px'
              }}
            >
              <option value="ALL">All Classes</option>
              {availableClasses.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={styles.selectInput}
            >
              <option value="ALL">All Statuses</option>
              <option value="PRESENT">Checked In / Present</option>
              <option value="OUT">Checked Out</option>
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
                        <span style={{ fontWeight: 600, color: '#2563eb' }}>{getCourseName(student.batch)}</span>
                        {student.class && <span style={{ color: '#64748b', fontSize: '14px', marginLeft: '8px' }}>| Class: {student.class}</span>}
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
        </>
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
