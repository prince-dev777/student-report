import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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
  Radar,
  QrCode,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Printer,
  Sparkles,
  Smartphone,
  Radio,
  CheckCircle,
  HelpCircle,
  CreditCard,
  ExternalLink,
  Flame,
  CheckCheck,
  Eye,
  Camera
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import idLogo from '../assets/id-logo.png';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { useApp } from '../context/AppContext';
import SearchableStudentSelect from '../components/SearchableStudentSelect';
import {
  formatTime,
  formatDate,
  formatBatchName,
  getTodayStr,
  getTodayAttendanceStats,
  getDaysInMonth,
  getFirstDayOfMonth,
  monthNames,
  dayNames,
} from '../utils/helpers';
import { getInitials, getAvatarClass } from '../data/sampleData';

import { api, API_BASE } from '../utils/api';

// Safe Web Audio API synthesizer for crisp kiosk chimes
const playKioskSound = (type = 'entry') => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    if (type === 'entry') {
      // Pleasant high ascending chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'exit') {
      // Pleasant descending double chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(587.33, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else {
      // Warning buzz
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {
    console.error('Audio chime error:', e);
  }
};

export default function Attendance() {
  const { students, batches, attendance, markAttendance, refreshAttendance, refreshSMSLogs, user } = useApp();
  const [activeTab, setActiveTab] = useState('kiosk');
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
  
  // ⚡ Live QR Scanner Kiosk Mode States
  const [kioskCode, setKioskCode] = useState('');
  const [kioskMode, setKioskMode] = useState('auto'); // 'auto' | 'entry' | 'exit'
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showIdCardsModal, setShowIdCardsModal] = useState(false);
  const [showHardwareModal, setShowHardwareModal] = useState(false);
  const [selectedIdCardBatch, setSelectedIdCardBatch] = useState('all');
  const [idCardSearch, setIdCardSearch] = useState('');
  const [idCardSide, setIdCardSide] = useState('duplex'); // 'duplex' | 'both' | 'front' | 'back'
  const [idCardCardsPerPage, setIdCardCardsPerPage] = useState(4); // 4 (Large 2x2) or 6 (Compact 2x3)
  const [idCardPreviewPage, setIdCardPreviewPage] = useState(1);
  const [idCardShowAll, setIdCardShowAll] = useState(false);
  const [lastPunch, setLastPunch] = useState(null);
  const [lastScannedMap, setLastScannedMap] = useState({});
  const kioskInputRef = useRef(null);

  // Auto-dismiss last punch celebration after 6 seconds
  useEffect(() => {
    if (!lastPunch) return;
    const timer = setTimeout(() => {
      setLastPunch(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [lastPunch]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Hardware wedge auto-focus engine
  useEffect(() => {
    if (activeTab !== 'kiosk') return;
    const focusKioskInput = () => {
      if (kioskInputRef.current && document.activeElement !== kioskInputRef.current) {
        const tag = document.activeElement?.tagName?.toLowerCase();
        if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
          kioskInputRef.current.focus();
        }
      }
    };
    focusKioskInput();
    const interval = setInterval(focusKioskInput, 1500);

    const handleGlobalKeyDown = (e) => {
      if (activeTab !== 'kiosk') return;
      if (showIdCardsModal || showHardwareModal) return;
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (kioskInputRef.current) {
        kioskInputRef.current.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [activeTab, showIdCardsModal, showHardwareModal]);

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

  // Available batches for ID card printing (Mapped to user-friendly Course names like JEE Mains / NEET)
  const availableBatches = useMemo(() => {
    const map = new Map();
    students.forEach((s) => {
      const raw = s.batch || s.targetClass || s.course;
      if (raw && !map.has(raw)) {
        const formatted = formatBatchName(raw, batches);
        map.set(raw, { id: raw, name: formatted || raw });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [students, batches]);

  // Filtered students for ID card printing modal (Exact Roll Priority & 0ms Zero-Lag Indexing)
  const filteredIdCardStudents = useMemo(() => {
    const rawQ = idCardSearch.trim();

    let pool = activeStudents;
    if (selectedIdCardBatch !== 'all') {
      const bSel = selectedIdCardBatch.toLowerCase();
      pool = pool.filter((s) => {
        const raw = (s.batch || s.targetClass || s.course || '').toLowerCase();
        const formatted = formatBatchName(s.batch || s.targetClass || s.course, batches).toLowerCase();
        return raw === bSel || raw.includes(bSel) || formatted === bSel || formatted.includes(bSel);
      });
    }

    if (!rawQ) return pool;

    const qLower = rawQ.toLowerCase();
    const isNumeric = /^\d+$/.test(rawQ);

    if (isNumeric) {
      // 1. Exact Roll Number Match (e.g. searching '17988' matches ONLY student 17988)
      const exactMatches = pool.filter((s) => {
        const r = String(s.rollNo || '').trim();
        const id = String(s.id || '').trim();
        return r === rawQ || id === rawQ;
      });
      if (exactMatches.length > 0) {
        return exactMatches;
      }

      // 2. Prefix match for incomplete roll numbers (e.g. '17')
      return pool.filter((s) => {
        const r = String(s.rollNo || '').trim();
        const p = String(s.parentPhone || s.phone || '').trim();
        return r.startsWith(rawQ) || p.includes(rawQ);
      });
    }

    // Text / Name Search (Substring in name or exact ID)
    return pool.filter((s) => {
      const name = (s.name || '').toLowerCase();
      const id = String(s.id || '').toLowerCase();
      const roll = String(s.rollNo || '').toLowerCase();
      return name.includes(qLower) || id.includes(qLower) || roll === qLower;
    });
  }, [activeStudents, selectedIdCardBatch, idCardSearch]);

  // Reset page when batch or search changes
  useEffect(() => {
    setIdCardPreviewPage(1);
  }, [selectedIdCardBatch, idCardSearch]);

  // Preview Pagination Constants
  const PREVIEW_PAGE_SIZE = 24; // 6 sheets in 4-card mode, 4 sheets in 6-card mode
  const totalIdCardPages = Math.ceil(filteredIdCardStudents.length / PREVIEW_PAGE_SIZE) || 1;

  // Displayed students for butter-smooth 60fps screen rendering
  const displayedIdCardStudents = useMemo(() => {
    if (idCardSearch.trim() || idCardShowAll || filteredIdCardStudents.length <= PREVIEW_PAGE_SIZE) {
      return filteredIdCardStudents;
    }
    const start = (idCardPreviewPage - 1) * PREVIEW_PAGE_SIZE;
    return filteredIdCardStudents.slice(start, start + PREVIEW_PAGE_SIZE);
  }, [filteredIdCardStudents, idCardSearch, idCardShowAll, idCardPreviewPage]);

  // 📥 Dedicated High-Resolution Native A4 PDF Generator (Direct download via jsPDF)
  const handleSaveAsPdf = async () => {
    const prevShowAll = idCardShowAll;
    const toastId = toast.loading('Preparing all ID card sheets for PDF export...');

    try {
      // 1. Temporarily expand DOM to render ALL students
      if (!prevShowAll) {
        setIdCardShowAll(true);
        await new Promise((r) => setTimeout(r, 350));
      }

      let sheetElements = Array.from(document.querySelectorAll('#printable-id-cards .a4-print-sheet'));
      
      // If not in duplex/sheet mode, capture the card pair container
      if (!sheetElements || sheetElements.length === 0) {
        const container = document.getElementById('printable-id-cards');
        if (!container) {
          toast.error('No ID cards found to export', { id: toastId });
          if (!prevShowAll) setIdCardShowAll(false);
          return;
        }
        sheetElements = [container];
      }

      const totalPages = sheetElements.length;
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      for (let i = 0; i < totalPages; i++) {
        toast.loading(`Rendering Sheet ${i + 1} of ${totalPages} (300 DPI)...`, { id: toastId });
        const sheet = sheetElements[i];

        const canvas = await html2canvas(sheet, {
          scale: 3, // Ultra-sharp 300-400 DPI lossless vector-like rendering
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          letterRendering: true,
          windowWidth: 1200
        });

        const imgData = canvas.toDataURL('image/png');

        if (i > 0) {
          pdf.addPage('a4', 'portrait');
        }

        pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
      }

      const batchName = selectedIdCardBatch === 'all' ? 'All_Students' : selectedIdCardBatch.replace(/\s+/g, '_');
      const filename = `CareerXone_ID_Cards_${batchName}.pdf`;
      pdf.save(filename);

      toast.success(`✅ Saved ${totalPages} Page(s) PDF (${filteredIdCardStudents.length} Students) to Downloads!`, { id: toastId });
    } catch (err) {
      console.error('PDF Generation Error:', err);
      toast.error(`❌ PDF Generation Failed: ${err.message}`, { id: toastId });
    } finally {
      if (!prevShowAll) {
        setIdCardShowAll(false);
      }
    }
  };

  // 🖨️ Direct System Printer Dialog (All Students)
  const handlePrintSystem = async () => {
    const prevShowAll = idCardShowAll;
    if (!prevShowAll) {
      setIdCardShowAll(true);
      await new Promise((r) => setTimeout(r, 300));
    }

    document.body.classList.add('printing-id-cards');
    requestAnimationFrame(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove('printing-id-cards');
        if (!prevShowAll) setIdCardShowAll(false);
      }, 1500);
    });
  };

  // ⚡ Kiosk Scan Submission Handler (USB Tabletop Scanner + Manual)
  const handleKioskScan = (e) => {
    if (e) e.preventDefault();
    const raw = String(kioskCode || '').trim();
    if (!raw) return;

    setKioskCode('');

    // 1. Check if raw is JSON (from formatted QR cards)
    let extractedRoll = raw;
    try {
      if (raw.startsWith('{') && raw.endsWith('}')) {
        const parsed = JSON.parse(raw);
        extractedRoll = String(parsed.rollNo || parsed.roll || parsed.id || parsed.studentId || raw);
      }
    } catch (err) {}

    // 2. Check if raw is URL
    if (extractedRoll.startsWith('http://') || extractedRoll.startsWith('https://')) {
      try {
        const u = new URL(extractedRoll);
        const parts = u.pathname.split('/').filter(Boolean);
        extractedRoll = u.searchParams.get('roll') || u.searchParams.get('id') || parts[parts.length - 1] || extractedRoll;
      } catch (err) {}
    }

    extractedRoll = extractedRoll.trim();

    // 3. Find matching student (by rollNo, id, name, or phone)
    const target = extractedRoll.toLowerCase();
    const matchedStudent = activeStudents.find((s) => {
      const r = String(s.rollNo || '').trim().toLowerCase();
      const id = String(s.id || '').trim().toLowerCase();
      const phone = String(s.phone || s.parentPhone || '').trim();
      return r === target || id === target || phone === target;
    }) || activeStudents.find((s) => {
      const rNum = parseInt(s.rollNo, 10);
      const targetNum = parseInt(extractedRoll, 10);
      return !isNaN(rNum) && !isNaN(targetNum) && rNum === targetNum;
    });

    if (!matchedStudent) {
      if (soundEnabled) playKioskSound('error');
      toast.error(`❌ Student not found for Roll/QR: "${extractedRoll}"`);
      return;
    }

    // 4. Anti-spam 15-second debounce check
    const now = Date.now();
    const lastScanTime = lastScannedMap[matchedStudent.id];
    if (lastScanTime && (now - lastScanTime) < 15000) {
      const elapsedSecs = Math.round((now - lastScanTime) / 1000);
      toast(`⏳ ${matchedStudent.name} already scanned ${elapsedSecs}s ago!`, { icon: '⚠️' });
      return;
    }

    // 5. Determine Entry vs Exit
    const todayStr = getTodayStr();
    const todayRecord = attendance.find((a) => a.studentId === matchedStudent.id && a.date === todayStr);

    let determinedType = kioskMode;
    if (kioskMode === 'auto') {
      if (!todayRecord || !todayRecord.entryTime) {
        determinedType = 'entry';
      } else if (todayRecord.entryTime && !todayRecord.exitTime) {
        const [eh, em] = todayRecord.entryTime.split(':').map(Number);
        const cur = new Date();
        const currentMin = cur.getHours() * 60 + cur.getMinutes();
        const entryMin = eh * 60 + em;
        if (currentMin - entryMin < 2) {
          if (soundEnabled) playKioskSound('error');
          toast(`⚠️ ${matchedStudent.name} already checked in at ${formatTime(todayRecord.entryTime)}!`, { icon: 'ℹ️' });
          return;
        }
        determinedType = 'exit';
      } else {
        if (soundEnabled) playKioskSound('error');
        toast.error(`⚠️ ${matchedStudent.name} has already completed both Entry & Exit today!`);
        return;
      }
    } else if (kioskMode === 'entry') {
      if (todayRecord && todayRecord.entryTime) {
        if (soundEnabled) playKioskSound('error');
        toast.error(`⚠️ ${matchedStudent.name} already marked Entry today at ${formatTime(todayRecord.entryTime)}!`);
        return;
      }
      determinedType = 'entry';
    } else if (kioskMode === 'exit') {
      if (!todayRecord || !todayRecord.entryTime) {
        if (soundEnabled) playKioskSound('error');
        toast.error(`⚠️ Cannot mark Exit. ${matchedStudent.name} has not checked in today!`);
        return;
      }
      if (todayRecord.exitTime) {
        if (soundEnabled) playKioskSound('error');
        toast.error(`⚠️ ${matchedStudent.name} already marked Exit today at ${formatTime(todayRecord.exitTime)}!`);
        return;
      }
      determinedType = 'exit';
    }

    // Update debounce map
    setLastScannedMap((prev) => ({ ...prev, [matchedStudent.id]: now }));

    // Mark attendance
    markAttendance(matchedStudent.id, determinedType);

    // Audio confirmation
    if (soundEnabled) playKioskSound(determinedType);

    const timeFormatted = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    let dur = '';
    if (determinedType === 'exit' && todayRecord?.entryTime) {
      dur = calcDuration(todayRecord.entryTime, new Date().toTimeString().slice(0, 5));
    }

    setLastPunch({
      student: matchedStudent,
      punchType: determinedType,
      time: timeFormatted,
      timestamp: now,
      duration: dur,
      parentPhone: matchedStudent.parentPhone,
      parentName: matchedStudent.parentName,
    });

    toast.success(`🎉 ${matchedStudent.name} (${determinedType === 'entry' ? 'ENTRY' : 'EXIT'}) Recorded!`);
  };

  const tabs = [
    { key: 'kiosk', label: '⚡ Live QR Kiosk Mode' },
    { key: 'mark', label: 'Manual Mark' },
    { key: 'today', label: "Today's Record" },
    { key: 'history', label: 'History' },
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
        <p>Live QR Scanner Kiosk & Smart Attendance with Instant Parent WhatsApp Alerts</p>
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
        {/* ========== TAB 4: ⚡ Live QR Scanner Kiosk Mode ========== */}
        {activeTab === 'kiosk' && (
          <motion.div
            key="kiosk"
            variants={tabVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex flex-col gap-24"
          >
            {/* Top Kiosk Control Bar */}
            <div className="card" style={{ padding: '18px 24px', background: 'var(--surface-color)', border: '1.5px solid var(--border-color)', borderRadius: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                {/* Left: Status & Hardware Indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
                  }}>
                    <QrCode size={24} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h2 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)' }}>
                        Live QR Scanner Kiosk Mode
                      </h2>
                      <span style={{
                        background: 'rgba(16, 185, 129, 0.12)',
                        color: '#10b981',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 20,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }} />
                        USB SCANNER READY
                      </span>
                    </div>
                    <p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                      Plug & Play Tabletop Scanner Ready • Instant Auto Punch • WhatsApp Dispatched Instantly
                    </p>
                  </div>
                </div>

                {/* Right: Mode Selector & Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {/* Punch Mode Switcher */}
                  <div style={{
                    display: 'flex',
                    background: 'var(--bg-color)',
                    padding: 4,
                    borderRadius: 12,
                    border: '1.5px solid var(--border-color)'
                  }}>
                    <button
                      type="button"
                      onClick={() => setKioskMode('auto')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        border: 'none',
                        cursor: 'pointer',
                        background: kioskMode === 'auto' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'transparent',
                        color: kioskMode === 'auto' ? '#ffffff' : 'var(--text-secondary)',
                        boxShadow: kioskMode === 'auto' ? '0 2px 8px rgba(59, 130, 246, 0.3)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5
                      }}
                    >
                      <Zap size={13} />
                      <span>Smart Auto (In/Out)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setKioskMode('entry')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        border: 'none',
                        cursor: 'pointer',
                        background: kioskMode === 'entry' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent',
                        color: kioskMode === 'entry' ? '#ffffff' : 'var(--text-secondary)',
                        boxShadow: kioskMode === 'entry' ? '0 2px 8px rgba(16, 185, 129, 0.3)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5
                      }}
                    >
                      <LogIn size={13} />
                      <span>Entry Only (Morning)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setKioskMode('exit')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        border: 'none',
                        cursor: 'pointer',
                        background: kioskMode === 'exit' ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'transparent',
                        color: kioskMode === 'exit' ? '#ffffff' : 'var(--text-secondary)',
                        boxShadow: kioskMode === 'exit' ? '0 2px 8px rgba(239, 68, 68, 0.3)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5
                      }}
                    >
                      <LogOut size={13} />
                      <span>Exit Only (Departure)</span>
                    </button>
                  </div>

                  {/* Sound Toggle */}
                  <button
                    type="button"
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    title={soundEnabled ? 'Mute Confirmation Chime' : 'Unmute Confirmation Chime'}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: '1.5px solid var(--border-color)',
                      background: soundEnabled ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-color)',
                      color: soundEnabled ? 'var(--accent-blue)' : 'var(--text-secondary)',
                      fontSize: '0.80rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                    <span>{soundEnabled ? 'Sound ON' : 'Muted'}</span>
                  </button>

                  {/* Print QR ID Cards Button */}
                  <button
                    type="button"
                    onClick={() => setShowIdCardsModal(true)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 10,
                      border: '1.5px solid rgba(139, 92, 246, 0.4)',
                      background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)',
                      color: '#8b5cf6',
                      fontSize: '0.80rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 2px 8px rgba(139, 92, 246, 0.12)'
                    }}
                  >
                    <Printer size={15} />
                    <span>🪪 Print Student QR Cards</span>
                  </button>

                  {/* Fullscreen Toggle */}
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    title="Toggle Fullscreen Kiosk"
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: '1.5px solid var(--border-color)',
                      background: isFullscreen ? 'var(--accent-blue)' : 'var(--bg-color)',
                      color: isFullscreen ? '#ffffff' : 'var(--text-primary)',
                      fontSize: '0.80rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                    <span>{isFullscreen ? 'Exit Fullscreen' : '⛶ Fullscreen'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------------------- */}
            {/* HERO KIOSK ARENA: SCANNER ZONE (LEFT) & LIVE PUNCH STREAM (RIGHT) */}
            {/* ---------------------------------------------------------------- */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1.15fr) minmax(320px, 0.85fr)', gap: 24, alignItems: 'stretch' }}>
              
              {/* LEFT COLUMN: Digital Clock, Holographic Target & Celebration Card */}
              <div className="flex flex-col gap-20">
                {/* Digital LED Clock & Status Bar */}
                <div className="card" style={{
                  padding: '24px 28px',
                  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)',
                  border: '1.5px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: 20,
                  color: '#ffffff',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {/* Subtle Background Glow */}
                  <div style={{
                    position: 'absolute',
                    top: -40,
                    right: -40,
                    width: 140,
                    height: 140,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, transparent 70%)',
                    pointerEvents: 'none'
                  }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: '0.74rem', fontWeight: 800, letterSpacing: '0.08em', color: '#94a3b8', textTransform: 'uppercase' }}>
                        LIVE RECEPTION KIOSK TIME
                      </div>
                      <div style={{
                        fontSize: '2.4rem',
                        fontWeight: 900,
                        fontFamily: "'Outfit', monospace, sans-serif",
                        letterSpacing: '-0.02em',
                        color: '#ffffff',
                        textShadow: '0 0 20px rgba(59, 130, 246, 0.5)',
                        marginTop: 2
                      }}>
                        {clockStr}
                      </div>
                      <div style={{ fontSize: '0.88rem', color: '#cbd5e1', fontWeight: 600 }}>
                        {dateStr}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        borderRadius: 10,
                        background: kioskMode === 'auto' ? 'rgba(59, 130, 246, 0.2)' : kioskMode === 'entry' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        border: `1px solid ${kioskMode === 'auto' ? 'rgba(59, 130, 246, 0.4)' : kioskMode === 'entry' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                        color: kioskMode === 'auto' ? '#60a5fa' : kioskMode === 'entry' ? '#34d399' : '#f87171',
                        fontSize: '0.82rem',
                        fontWeight: 800
                      }}>
                        {kioskMode === 'auto' && <Zap size={14} />}
                        {kioskMode === 'entry' && <LogIn size={14} />}
                        {kioskMode === 'exit' && <LogOut size={14} />}
                        <span>MODE: {kioskMode.toUpperCase()}</span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: 4 }}>
                        {kioskMode === 'auto' ? 'Auto-detects In / Out' : kioskMode === 'entry' ? 'Check-In Rush' : 'Dispersal Exit'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Always-Focused Hardware Scanner Input Bar */}
                <form onSubmit={handleKioskScan} style={{ position: 'relative' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: 'var(--surface-color)',
                    padding: '8px 12px 8px 18px',
                    borderRadius: 16,
                    border: '2px solid var(--accent-blue)',
                    boxShadow: '0 4px 20px rgba(59, 130, 246, 0.18)'
                  }}>
                    <QrCode size={22} color="var(--accent-blue)" />
                    <input
                      ref={kioskInputRef}
                      type="text"
                      value={kioskCode}
                      onChange={(e) => setKioskCode(e.target.value)}
                      placeholder="Flash QR code or type Roll Number (e.g. 101)..."
                      autoFocus
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        fontFamily: 'monospace'
                      }}
                    />
                    {kioskCode && (
                      <button
                        type="button"
                        onClick={() => setKioskCode('')}
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}
                      >
                        <X size={16} />
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={!kioskCode.trim()}
                      style={{
                        padding: '10px 20px',
                        borderRadius: 10,
                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        cursor: kioskCode.trim() ? 'pointer' : 'not-allowed',
                        opacity: kioskCode.trim() ? 1 : 0.6,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: '0 2px 10px rgba(59, 130, 246, 0.3)'
                      }}
                    >
                      <Zap size={15} />
                      <span>Punch</span>
                    </button>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 6,
                    padding: '0 8px',
                    fontSize: '0.74rem',
                    color: 'var(--text-secondary)'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                      Scanner Input Focused & Ready
                    </span>
                    <span>Hold ID card ~15cm from scanner</span>
                  </div>
                </form>

                {/* Main Interactive Stage: Celebration Showcase or Idle Scanner Target */}
                <div className="card" style={{
                  padding: 30,
                  minHeight: 340,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--surface-color)',
                  borderRadius: 20,
                  border: lastPunch ? (lastPunch.punchType === 'entry' ? '2px solid #10b981' : '2px solid #3b82f6') : '1.5px dashed var(--border-color)',
                  boxShadow: lastPunch ? (lastPunch.punchType === 'entry' ? '0 10px 30px rgba(16, 185, 129, 0.15)' : '0 10px 30px rgba(59, 130, 246, 0.15)') : 'none',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <AnimatePresence mode="wait">
                    {lastPunch ? (
                      <motion.div
                        key={lastPunch.timestamp}
                        initial={{ opacity: 0, scale: 0.9, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -15 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                        style={{ width: '100%', textAlign: 'center' }}
                      >
                        {/* Status Ribbon Badge */}
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                          <span style={{
                            background: lastPunch.punchType === 'entry' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            color: lastPunch.punchType === 'entry' ? '#10b981' : '#3b82f6',
                            border: `1.5px solid ${lastPunch.punchType === 'entry' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(59, 130, 246, 0.4)'}`,
                            padding: '6px 18px',
                            borderRadius: 30,
                            fontSize: '0.88rem',
                            fontWeight: 900,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            boxShadow: lastPunch.punchType === 'entry' ? '0 4px 12px rgba(16, 185, 129, 0.2)' : '0 4px 12px rgba(59, 130, 246, 0.2)'
                          }}>
                            {lastPunch.punchType === 'entry' ? <LogIn size={16} /> : <LogOut size={16} />}
                            <span>{lastPunch.punchType === 'entry' ? '✅ CHECK-IN ENTRY RECORDED' : '🔵 CHECK-OUT EXIT RECORDED'}</span>
                          </span>
                        </div>

                        {/* Student Avatar & Photo */}
                        <div style={{ position: 'relative', display: 'inline-block', marginBottom: 14 }}>
                          {lastPunch.student?.photo ? (
                            <img
                              src={lastPunch.student.photo}
                              alt={lastPunch.student.name}
                              style={{
                                width: 96,
                                height: 96,
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: `4px solid ${lastPunch.punchType === 'entry' ? '#10b981' : '#3b82f6'}`,
                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)'
                              }}
                            />
                          ) : (
                            <div style={{
                              width: 96,
                              height: 96,
                              borderRadius: '50%',
                              background: lastPunch.punchType === 'entry' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '2.2rem',
                              fontWeight: 900,
                              margin: '0 auto',
                              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
                              border: '4px solid rgba(255, 255, 255, 0.4)'
                            }}>
                              {getInitials(lastPunch.student.name)}
                            </div>
                          )}

                          <div style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: lastPunch.punchType === 'entry' ? '#10b981' : '#3b82f6',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '2px solid var(--surface-color)',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                          }}>
                            {lastPunch.punchType === 'entry' ? <Check size={16} /> : <LogOut size={14} />}
                          </div>
                        </div>

                        {/* Student Name & Roll Number */}
                        <h3 style={{ fontSize: '1.65rem', fontWeight: 900, margin: '0 0 6px', color: 'var(--text-primary)' }}>
                          {lastPunch.student.name}
                        </h3>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                          <span style={{
                            background: 'var(--bg-color)',
                            padding: '4px 12px',
                            borderRadius: 8,
                            fontFamily: 'monospace',
                            fontWeight: 800,
                            fontSize: '0.90rem',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)'
                          }}>
                            Roll: #{lastPunch.student.rollNo || '—'}
                          </span>

                          <span style={{
                            background: 'rgba(59, 130, 246, 0.1)',
                            color: 'var(--accent-blue)',
                            padding: '4px 12px',
                            borderRadius: 8,
                            fontWeight: 800,
                            fontSize: '0.84rem'
                          }}>
                            {lastPunch.student.batch || lastPunch.student.targetClass || 'General Batch'}
                          </span>

                          <span style={{
                            background: 'rgba(234, 179, 8, 0.12)',
                            color: '#ca8a04',
                            padding: '4px 12px',
                            borderRadius: 8,
                            fontWeight: 800,
                            fontSize: '0.84rem'
                          }}>
                            ⏰ {lastPunch.time}
                          </span>
                        </div>

                        {/* Duration if exit */}
                        {lastPunch.duration && (
                          <div style={{ fontSize: '0.86rem', color: 'var(--accent-blue)', fontWeight: 800, marginBottom: 12 }}>
                            ⏱️ Total Time in Institute: {lastPunch.duration}
                          </div>
                        )}

                        {/* WhatsApp Parent Notification Banner */}
                        <div style={{
                          background: 'rgba(16, 185, 129, 0.08)',
                          border: '1.5px solid rgba(16, 185, 129, 0.3)',
                          borderRadius: 12,
                          padding: '10px 16px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 10,
                          maxWidth: '90%'
                        }}>
                          <Smartphone size={18} color="#10b981" />
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <CheckCheck size={14} /> Instant WhatsApp Dispatched to Parent
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                              Sent to {lastPunch.parentPhone || 'Parent Mobile'} • {lastPunch.student.parentName || 'Guardian'}
                            </div>
                          </div>
                        </div>

                        {/* Auto-Dismiss Countdown Bar */}
                        <div style={{ width: '60%', height: 4, background: 'var(--bg-color)', borderRadius: 4, margin: '18px auto 0', overflow: 'hidden' }}>
                          <motion.div
                            initial={{ width: '100%' }}
                            animate={{ width: '0%' }}
                            transition={{ duration: 6, ease: 'linear' }}
                            style={{ height: '100%', background: lastPunch.punchType === 'entry' ? '#10b981' : '#3b82f6' }}
                          />
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="idle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ textAlign: 'center', padding: '20px 10px' }}
                      >
                        {/* Glowing Laser Scan Box */}
                        <div style={{
                          width: 140,
                          height: 140,
                          margin: '0 auto 20px',
                          borderRadius: 20,
                          border: '2px solid rgba(59, 130, 246, 0.4)',
                          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 80%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative',
                          overflow: 'hidden',
                          boxShadow: '0 0 25px rgba(59, 130, 246, 0.12)'
                        }}>
                          <QrCode size={72} color="var(--accent-blue)" style={{ opacity: 0.8 }} />

                          {/* Animated Laser Scanning Line */}
                          <motion.div
                            animate={{ y: [-50, 50, -50] }}
                            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                            style={{
                              position: 'absolute',
                              left: 10,
                              right: 10,
                              height: 3,
                              background: 'linear-gradient(90deg, transparent 0%, #10b981 50%, transparent 100%)',
                              boxShadow: '0 0 10px #10b981',
                              borderRadius: 2
                            }}
                          />
                        </div>

                        <h4 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 6px', color: 'var(--text-primary)' }}>
                          Hold Student ID Card in front of Tabletop Scanner
                        </h4>
                        <p style={{ margin: '0 auto', maxWidth: 380, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          Automatic hands-free scan in &lt; 0.1s. The system will record the punch, calculate timing, and send an instant WhatsApp parent alert.
                        </p>

                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 12,
                          marginTop: 20,
                          background: 'var(--bg-color)',
                          padding: '6px 16px',
                          borderRadius: 20,
                          border: '1px solid var(--border-color)',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: 'var(--text-secondary)'
                        }}>
                          <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle size={13} /> Plug &amp; Play USB
                          </span>
                          <span>•</span>
                          <span style={{ color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Zap size={13} /> Zero Clicks
                          </span>
                          <span>•</span>
                          <span style={{ color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Smartphone size={13} /> Auto WhatsApp
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Today Attendance Mini-Counters */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <div className="card" style={{ padding: '14px 16px', textAlign: 'center', borderRadius: 14, background: 'var(--surface-color)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>PRESENT TODAY</div>
                    <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#10b981', marginTop: 2 }}>{stats.present}</div>
                  </div>

                  <div className="card" style={{ padding: '14px 16px', textAlign: 'center', borderRadius: 14, background: 'var(--surface-color)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>LATE ENTRIES</div>
                    <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#f59e0b', marginTop: 2 }}>{stats.late}</div>
                  </div>

                  <div className="card" style={{ padding: '14px 16px', textAlign: 'center', borderRadius: 14, background: 'var(--surface-color)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>CHECKED OUT</div>
                    <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#3b82f6', marginTop: 2 }}>
                      {todayRecords.filter(r => r.exitTime).length}
                    </div>
                  </div>

                  <div className="card" style={{ padding: '14px 16px', textAlign: 'center', borderRadius: 14, background: 'var(--surface-color)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>TOTAL ACTIVE</div>
                    <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: 2 }}>{activeStudents.length}</div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Live Punch Activity Stream */}
              <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', borderRadius: 20, background: 'var(--surface-color)', border: '1.5px solid var(--border-color)' }}>
                {/* Header & Filter */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Flame size={20} color="#f59e0b" />
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      Today's Live Punch Stream
                    </h3>
                    <span style={{
                      background: 'rgba(59, 130, 246, 0.1)',
                      color: 'var(--accent-blue)',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 12
                    }}>
                      {todayRecords.length} Punches
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => { if (typeof refreshAttendance === 'function') refreshAttendance(); }}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <RefreshCw size={12} /> Refresh
                  </button>
                </div>

                {/* Search Bar for Live Stream */}
                <div style={{ position: 'relative', marginBottom: 14 }}>
                  <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input
                    type="text"
                    value={todaySearch}
                    onChange={(e) => setTodaySearch(e.target.value)}
                    placeholder="Search today's punches by name / roll..."
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 36px',
                      borderRadius: 10,
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-color)',
                      color: 'var(--text-primary)',
                      fontSize: '0.84rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Scrollable Punches List */}
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: 480, display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
                  {filteredTodayStudents.filter(s => s.entryTime || s.exitTime).length > 0 ? (
                    filteredTodayStudents
                      .filter(s => s.entryTime || s.exitTime)
                      .map((item, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: 'var(--bg-color)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 12,
                            padding: '12px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 38,
                              height: 38,
                              borderRadius: '50%',
                              background: item.status === 'present' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: item.status === 'present' ? '#10b981' : '#f59e0b',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '0.85rem'
                            }}>
                              {getInitials(item.student.name)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                                {item.student.name}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>Roll #{item.student.rollNo || '—'}</span>
                                <span>•</span>
                                <span>{item.student.batch || item.student.targetClass || 'General'}</span>
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                              {item.entryTime && (
                                <span style={{
                                  background: 'rgba(16, 185, 129, 0.12)',
                                  color: '#10b981',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  padding: '2px 6px',
                                  borderRadius: 6
                                }}>
                                  IN: {formatTime(item.entryTime)}
                                </span>
                              )}
                              {item.exitTime && (
                                <span style={{
                                  background: 'rgba(59, 130, 246, 0.12)',
                                  color: 'var(--accent-blue)',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  padding: '2px 6px',
                                  borderRadius: 6
                                }}>
                                  OUT: {formatTime(item.exitTime)}
                                </span>
                              )}
                            </div>

                            <div style={{ fontSize: '0.70rem', color: 'var(--text-tertiary)', marginTop: 3 }}>
                              {item.exitTime ? `Duration: ${calcDuration(item.entryTime, item.exitTime)}` : 'In Institute'}
                            </div>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div style={{
                      textAlign: 'center',
                      padding: '40px 16px',
                      background: 'var(--bg-color)',
                      borderRadius: 14,
                      border: '1px dashed var(--border-color)',
                      color: 'var(--text-secondary)'
                    }}>
                      <QrCode size={36} style={{ opacity: 0.35, margin: '0 auto 8px' }} />
                      <div style={{ fontWeight: 800, fontSize: '0.90rem' }}>No attendance punches recorded yet today</div>
                      <div style={{ fontSize: '0.78rem', marginTop: 4 }}>
                        Flash student QR cards in front of the scanner to populate the live stream.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------------------- */}
            {/* 🪪 MODAL: PRINTABLE OFFICIAL STUDENT ID CARDS (FRONT & BACK)   */}
            {/* ---------------------------------------------------------------- */}
            {showIdCardsModal && (
              <div
                className="id-cards-modal-overlay"
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0, 0, 0, 0.75)',
                  backdropFilter: 'blur(8px)',
                  zIndex: 9999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 20
                }}
              >
                <div
                  className="id-cards-modal-card"
                  style={{
                    background: '#0f172a',
                    borderRadius: 20,
                    width: '100%',
                    maxWidth: 1080,
                    maxHeight: '92vh',
                    display: 'flex',
                    flexDirection: 'column',
                    border: '1.5px solid rgba(255, 255, 255, 0.18)',
                    boxShadow: '0 25px 70px rgba(0,0,0,0.6)',
                    overflow: 'hidden'
                  }}
                >
                  {/* Modal Header */}
                  <div
                    className="id-cards-modal-header"
                    style={{
                      padding: '18px 24px',
                      background: '#1e293b',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 12
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ padding: 10, borderRadius: 12, background: 'rgba(139, 92, 246, 0.25)', color: '#a78bfa' }}>
                        <Printer size={24} />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#ffffff' }}>
                          Print Official Student ID Cards (Front &amp; Back)
                        </h3>
                        <p style={{ margin: '3px 0 0', fontSize: '0.80rem', color: '#cbd5e1', fontWeight: 500 }}>
                          Official ID cards with photo, scannable Roll Number QR code, institute branding, and terms (A4 sheet ready)
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        type="button"
                        onClick={handleSaveAsPdf}
                        style={{
                          padding: '9px 18px',
                          borderRadius: 10,
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: '#ffffff',
                          border: 'none',
                          fontWeight: 800,
                          fontSize: '0.86rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                        }}
                      >
                        <Download size={16} />
                        <span>📥 Save as PDF (A4)</span>
                      </button>

                      <button
                        type="button"
                        onClick={handlePrintSystem}
                        style={{
                          padding: '9px 16px',
                          borderRadius: 10,
                          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                          color: '#ffffff',
                          border: 'none',
                          fontWeight: 800,
                          fontSize: '0.86rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)'
                        }}
                      >
                        <Printer size={16} />
                        <span>🖨️ Print Dialog</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowIdCardsModal(false)}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 10,
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: '#ffffff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Filter & Side Selector Toolbar */}
                  <div
                    className="id-cards-modal-toolbar"
                    style={{
                      padding: '12px 24px',
                      background: '#0f172a',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 14,
                      flexWrap: 'wrap'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: 1 }}>
                      {/* Batch Selector */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label style={{ fontSize: '0.80rem', fontWeight: 800, color: '#e2e8f0', letterSpacing: '0.04em' }}>COURSE / BATCH:</label>
                        <select
                          value={selectedIdCardBatch}
                          onChange={(e) => setSelectedIdCardBatch(e.target.value)}
                          style={{
                            padding: '7px 12px',
                            borderRadius: 8,
                            border: '1px solid rgba(255, 255, 255, 0.25)',
                            background: '#1e293b',
                            color: '#ffffff',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            outline: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="all">🎓 All Courses / Batches ({activeStudents.length} Students)</option>
                          {availableBatches.map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Search Bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 170, flex: 1, maxWidth: 220, position: 'relative' }}>
                        <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 10, pointerEvents: 'none' }} />
                        <input
                          type="text"
                          value={idCardSearch}
                          onChange={(e) => setIdCardSearch(e.target.value)}
                          placeholder="Search name / roll..."
                          style={{
                            width: '100%',
                            padding: '7px 12px 7px 32px',
                            borderRadius: 8,
                            border: '1px solid rgba(255, 255, 255, 0.25)',
                            background: '#1e293b',
                            color: '#ffffff',
                            fontSize: '0.82rem',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      {/* Side Switcher Buttons */}
                      <div style={{ display: 'flex', background: '#1e293b', padding: 3, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)' }}>
                        <button
                          type="button"
                          onClick={() => setIdCardSide('duplex')}
                          style={{
                            padding: '5px 11px',
                            borderRadius: 6,
                            border: 'none',
                            fontSize: '0.76rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            background: idCardSide === 'duplex' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent',
                            color: idCardSide === 'duplex' ? '#ffffff' : '#94a3b8',
                            boxShadow: idCardSide === 'duplex' ? '0 2px 8px rgba(16, 185, 129, 0.3)' : 'none'
                          }}
                        >
                          📄 Duplex A4 (Front ➔ Back Sheets)
                        </button>

                        <button
                          type="button"
                          onClick={() => setIdCardSide('both')}
                          style={{
                            padding: '5px 10px',
                            borderRadius: 6,
                            border: 'none',
                            fontSize: '0.76rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            background: idCardSide === 'both' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'transparent',
                            color: idCardSide === 'both' ? '#ffffff' : '#94a3b8'
                          }}
                        >
                          🎴 Side-by-Side (Pairs)
                        </button>

                        <button
                          type="button"
                          onClick={() => setIdCardSide('front')}
                          style={{
                            padding: '5px 10px',
                            borderRadius: 6,
                            border: 'none',
                            fontSize: '0.76rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            background: idCardSide === 'front' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'transparent',
                            color: idCardSide === 'front' ? '#ffffff' : '#94a3b8'
                          }}
                        >
                          🪪 Front Only
                        </button>

                        <button
                          type="button"
                          onClick={() => setIdCardSide('back')}
                          style={{
                            padding: '5px 10px',
                            borderRadius: 6,
                            border: 'none',
                            fontSize: '0.76rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            background: idCardSide === 'back' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'transparent',
                            color: idCardSide === 'back' ? '#ffffff' : '#94a3b8'
                          }}
                        >
                          📜 Back Only
                        </button>
                      </div>

                      {/* Cards Per Sheet Density Toggle (Only for Duplex Mode) */}
                      {idCardSide === 'duplex' && (
                        <div style={{ display: 'flex', background: '#1e293b', padding: 3, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)' }}>
                          <button
                            type="button"
                            onClick={() => setIdCardCardsPerPage(4)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 6,
                              border: 'none',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              background: idCardCardsPerPage === 4 ? '#3b82f6' : 'transparent',
                              color: idCardCardsPerPage === 4 ? '#ffffff' : '#94a3b8'
                            }}
                          >
                            📑 4 Cards / Sheet (Large 2×2)
                          </button>
                          <button
                            type="button"
                            onClick={() => setIdCardCardsPerPage(6)}
                            style={{
                              padding: '5px 10px',
                          borderRadius: 6,
                              border: 'none',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              background: idCardCardsPerPage === 6 ? '#3b82f6' : 'transparent',
                              color: idCardCardsPerPage === 6 ? '#ffffff' : '#94a3b8'
                            }}
                          >
                            📑 6 Cards / Sheet (Compact 2×3)
                          </button>
                        </div>
                      )}

                      {/* Pagination Controls for Ultra-Fast Zero-Lag Screen Rendering */}
                      {totalIdCardPages > 1 && !idCardSearch.trim() && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e293b', padding: '3px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)' }}>
                          <button
                            type="button"
                            disabled={idCardPreviewPage <= 1 || idCardShowAll}
                            onClick={() => setIdCardPreviewPage(p => Math.max(1, p - 1))}
                            style={{
                              padding: '3px 8px',
                              borderRadius: 4,
                              border: 'none',
                              background: idCardPreviewPage > 1 && !idCardShowAll ? '#3b82f6' : '#334155',
                              color: '#ffffff',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              cursor: idCardPreviewPage > 1 && !idCardShowAll ? 'pointer' : 'not-allowed'
                            }}
                          >
                            ◀ Prev
                          </button>
                          
                          <span style={{ fontSize: '0.74rem', color: '#e2e8f0', fontWeight: 700 }}>
                            {idCardShowAll ? 'All Cards Rendered' : `Page ${idCardPreviewPage} / ${totalIdCardPages} (${displayedIdCardStudents.length} Cards)`}
                          </span>

                          <button
                            type="button"
                            disabled={idCardPreviewPage >= totalIdCardPages || idCardShowAll}
                            onClick={() => setIdCardPreviewPage(p => Math.min(totalIdCardPages, p + 1))}
                            style={{
                              padding: '3px 8px',
                              borderRadius: 4,
                              border: 'none',
                              background: idCardPreviewPage < totalIdCardPages && !idCardShowAll ? '#3b82f6' : '#334155',
                              color: '#ffffff',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              cursor: idCardPreviewPage < totalIdCardPages && !idCardShowAll ? 'pointer' : 'not-allowed'
                            }}
                          >
                            Next ▶
                          </button>

                          <button
                            type="button"
                            onClick={() => setIdCardShowAll(!idCardShowAll)}
                            style={{
                              padding: '3px 8px',
                              borderRadius: 4,
                              border: 'none',
                              background: idCardShowAll ? '#10b981' : '#475569',
                              color: '#ffffff',
                              fontSize: '0.70rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              marginLeft: 4
                            }}
                          >
                            {idCardShowAll ? '⚡ Fast View' : '👁️ View All'}
                          </button>
                        </div>
                      )}

                      <div style={{
                        fontSize: '0.80rem',
                        fontWeight: 800,
                        color: '#60a5fa',
                        background: 'rgba(59, 130, 246, 0.18)',
                        border: '1px solid rgba(59, 130, 246, 0.35)',
                        padding: '5px 12px',
                        borderRadius: 20,
                        whiteSpace: 'nowrap'
                      }}>
                        {idCardSide === 'duplex'
                          ? `${filteredIdCardStudents.length} Students (${Math.ceil(filteredIdCardStudents.length / idCardCardsPerPage)} A4 Sheets / ${Math.ceil(filteredIdCardStudents.length / idCardCardsPerPage) * 2} Pages)`
                          : `Showing ${filteredIdCardStudents.length} Students (${idCardSide === 'both' ? filteredIdCardStudents.length * 2 : filteredIdCardStudents.length} Cards)`}
                      </div>
                    </div>
                  </div>

                  {/* ID Cards Printable Sheet Grid */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#090d16' }}>
                    <div id="printable-id-cards">
                      {/* ================= MODE 1: DUPLEX A4 SHEETS ================= */}
                      {idCardSide === 'duplex' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 36, alignItems: 'center' }}>
                          {Array.from({ length: Math.ceil(displayedIdCardStudents.length / idCardCardsPerPage) }).map((_, sheetIdx) => {
                            const chunk = displayedIdCardStudents.slice(sheetIdx * idCardCardsPerPage, sheetIdx * idCardCardsPerPage + idCardCardsPerPage);
                            
                            // Mirrored chunk for horizontal flip on 2-column grid
                            const rows = idCardCardsPerPage / 2;
                            const mirroredChunk = [];
                            for (let r = 0; r < rows; r++) {
                              const s1 = chunk[r * 2] || null;
                              const s2 = chunk[r * 2 + 1] || null;
                              mirroredChunk.push(s2);
                              mirroredChunk.push(s1);
                            }

                            const isCompact = idCardCardsPerPage === 6;
                            const cardWidth = isCompact ? '230px' : '260px';
                            const cardHeight = isCompact ? '355px' : '390px';
                            const gridCols = isCompact ? 'repeat(2, 230px)' : 'repeat(2, 260px)';
                            const gridGap = isCompact ? '14px 36px' : '18px 40px';

                            return (
                              <div key={sheetIdx} style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', width: '100%' }}>
                                {/* Front Sheet Container */}
                                <div style={{ width: '100%', maxWidth: '794px' }}>
                                  {/* Screen Header Banner (OUTSIDE .a4-print-sheet) */}
                                  <div
                                    style={{
                                      background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                                      color: '#ffffff',
                                      padding: '8px 16px',
                                      borderRadius: '10px 10px 0 0',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      fontSize: '0.82rem',
                                      fontWeight: 800
                                    }}
                                  >
                                    <span>📄 SHEET {sheetIdx + 1} • PAGE {sheetIdx * 2 + 1} — FRONT FACES (STUDENTS {sheetIdx * idCardCardsPerPage + 1} TO {sheetIdx * idCardCardsPerPage + chunk.length})</span>
                                    <span style={{ fontSize: '0.72rem', opacity: 0.9 }}>A4 Duplex Front Side</span>
                                  </div>

                                  {/* Page A: FRONT SHEET (PURE A4 PRINT CONTENT) */}
                                  <div
                                    className="a4-print-sheet"
                                    style={{
                                      background: '#ffffff',
                                      borderRadius: '0 0 12px 12px',
                                      padding: '24px 30px',
                                      boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                                      width: '100%',
                                      minHeight: '1123px',
                                      boxSizing: 'border-box',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      justifyContent: 'center',
                                      alignItems: 'center'
                                    }}
                                  >
                                    <div
                                      className="a4-print-grid"
                                      style={{
                                        display: 'grid',
                                        gridTemplateColumns: gridCols,
                                        gap: gridGap,
                                        justifyContent: 'center'
                                      }}
                                    >
                                      {Array.from({ length: idCardCardsPerPage }).map((_, slotIdx) => {
                                        const st = chunk[slotIdx] || null;
                                        return (
                                          <div key={slotIdx} className="a4-card-slot" style={{ display: 'flex', justifyContent: 'center' }}>
                                            {st ? (
                                              <div
                                                className="print-id-card"
                                                style={{
                                                  width: cardWidth,
                                                  height: cardHeight,
                                                  boxSizing: 'border-box',
                                                  background: 'linear-gradient(135deg, #f0f7ff 0%, #dbeafe 100%)',
                                                  borderRadius: '12px',
                                                  boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                                                  overflow: 'hidden',
                                                  display: 'flex',
                                                  flexDirection: 'column',
                                                  justifyContent: 'space-between',
                                                  border: '1.5px solid #bfdbfe',
                                                  position: 'relative',
                                                  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
                                                }}
                                              >
                                                {/* Top Cover Banner (Facebook-style Full Header) */}
                                                 <div style={{
                                                   boxSizing: 'border-box',
                                                   height: isCompact ? '85px' : '98px',
                                                   width: '100%',
                                                   margin: 0,
                                                   background: '#ffffff',
                                                   borderBottom: '2.5px solid #2563eb',
                                                   display: 'flex',
                                                   alignItems: 'center',
                                                   justifyContent: 'center',
                                                   padding: '4px 8px',
                                                   position: 'relative'
                                                 }}>
                                                   <img src={idLogo} alt="Career Xone" style={{ maxWidth: '98%', maxHeight: '96%', width: 'auto', height: isCompact ? '72px' : '84px', objectFit: 'contain' }} />
                                                 </div>

                                                 {/* Student Avatar / Photo (Overlapping Cover Banner Facebook Style) */}
                                                 <div style={{
                                                   display: 'flex',
                                                   justifyContent: 'center',
                                                   marginTop: isCompact ? '-42px' : '-48px',
                                                   marginBottom: '1px',
                                                   zIndex: 5,
                                                   position: 'relative'
                                                 }}>
                                                   {st.photo ? (
                                                     <img
                                                       src={st.photo}
                                                       alt={st.name}
                                                       style={{
                                                         width: isCompact ? '84px' : '96px',
                                                         height: isCompact ? '92px' : '104px',
                                                         borderRadius: '12px',
                                                         objectFit: 'cover',
                                                         border: '3px solid #ffffff',
                                                         boxShadow: '0 5px 14px rgba(0, 0, 0, 0.20)',
                                                         background: '#ffffff'
                                                       }}
                                                     />
                                                   ) : (
                                                     <div style={{
                                                       width: isCompact ? '84px' : '96px',
                                                       height: isCompact ? '92px' : '104px',
                                                       borderRadius: '12px',
                                                       background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                                                       display: 'flex',
                                                       alignItems: 'center',
                                                       justifyContent: 'center',
                                                       border: '3px solid #ffffff',
                                                       boxShadow: '0 5px 14px rgba(0, 0, 0, 0.20)',
                                                       fontSize: isCompact ? '1.7rem' : '2.0rem',
                                                       color: '#ffffff',
                                                       fontWeight: 800
                                                     }}>
                                                       {getInitials(st.name)}
                                                     </div>
                                                   )}
                                                 </div>

                                                <div style={{ padding: `0 ${isCompact ? '8px' : '12px'}`, textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: '3px' }}>
                                                  <div>
                                                    <h3 style={{ margin: '1px 0 1px 0', fontSize: isCompact ? '0.88rem' : '1.02rem', color: '#0f172a', fontWeight: 800, lineHeight: 1.25 }}>
                                                      {st.name}
                                                    </h3>
                                                    <p style={{ margin: '0 0 2px 0', fontSize: isCompact ? '0.62rem' : '0.70rem', color: '#2563eb', fontWeight: 700 }}>
                                                      Course: {formatBatchName(st.batch || st.targetClass || st.course, batches) || 'General'}
                                                    </p>

                                                    {/* Info Table Box */}
                                                    <div style={{
                                                      background: 'rgba(255, 255, 255, 0.94)',
                                                      borderRadius: '6px',
                                                      border: '1px solid #bfdbfe',
                                                      padding: isCompact ? '4px 6px' : '5px 8px',
                                                      textAlign: 'left',
                                                      fontSize: isCompact ? '0.60rem' : '0.68rem',
                                                      color: '#0f172a',
                                                      lineHeight: 1.40
                                                    }}>
                                                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', marginBottom: '1px' }}>
                                                        <strong style={{ minWidth: isCompact ? '46px' : '54px', color: '#475569', flexShrink: 0 }}>Roll No:</strong>
                                                        <span style={{ fontWeight: 800, color: '#1e3a8a' }}>{st.rollNo || '—'}</span>
                                                      </div>
                                                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', marginBottom: '1px' }}>
                                                        <strong style={{ minWidth: isCompact ? '46px' : '54px', color: '#475569', flexShrink: 0 }}>Parent:</strong>
                                                        <span style={{ fontWeight: 600, textAlign: 'right', flex: 1, wordBreak: 'break-word' }}>{st.parentName || 'N/A'}</span>
                                                      </div>
                                                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', marginBottom: '1px' }}>
                                                        <strong style={{ minWidth: isCompact ? '46px' : '54px', color: '#475569', flexShrink: 0 }}>Contact:</strong>
                                                        <span style={{ fontWeight: 600, textAlign: 'right', flex: 1 }}>{st.parentPhone || st.phone || 'N/A'}</span>
                                                      </div>
                                                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
                                                        <strong style={{ minWidth: isCompact ? '46px' : '54px', color: '#475569', flexShrink: 0 }}>Address:</strong>
                                                        <span style={{ fontWeight: 500, textAlign: 'right', flex: 1, wordBreak: 'break-word' }}>{st.address || 'N/A'}</span>
                                                      </div>
                                                    </div>
                                                  </div>

                                                  {/* Bottom Bar: Centered Large Scannable QR (High Visibility, snugly below table) */}
                                                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '2px 0 1px' }}>
                                                    <div style={{
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      justifyContent: 'center',
                                                      background: '#ffffff',
                                                      padding: isCompact ? '3px' : '4px',
                                                      borderRadius: '8px',
                                                      border: '2px solid #93c5fd',
                                                      boxShadow: '0 2px 8px rgba(37, 99, 235, 0.12)'
                                                    }}>
                                                      <QRCodeSVG value={String(st.rollNo || st.id)} size={isCompact ? 64 : 74} level="M" />
                                                    </div>
                                                  </div>
                                                </div>

                                                {/* Footer Ribbon (No text clipping) */}
                                                <div style={{
                                                  boxSizing: 'border-box',
                                                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                                  height: isCompact ? '24px' : '26px',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  padding: '0 8px',
                                                  fontSize: isCompact ? '0.60rem' : '0.68rem',
                                                  lineHeight: 1,
                                                  color: '#ffffff',
                                                  fontWeight: 800,
                                                  letterSpacing: '0.5px',
                                                  flexShrink: 0
                                                }}>
                                                  STUDENT ID: {st.id}
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="print-id-card-empty" style={{ width: cardWidth, height: cardHeight, visibility: 'hidden' }} />
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>

                                {/* Back Sheet Container */}
                                <div style={{ width: '100%', maxWidth: '794px' }}>
                                  {/* Screen Header Banner (OUTSIDE .a4-print-sheet) */}
                                  <div
                                    style={{
                                      background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                                      color: '#ffffff',
                                      padding: '8px 16px',
                                      borderRadius: '10px 10px 0 0',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      fontSize: '0.82rem',
                                      fontWeight: 800
                                    }}
                                  >
                                    <span>📜 SHEET {sheetIdx + 1} • PAGE {sheetIdx * 2 + 2} — BACK FACES (TERMS &amp; CONDITIONS — MIRRORED DUPLEX ALIGNED)</span>
                                    <span style={{ fontSize: '0.72rem', opacity: 0.9 }}>A4 Duplex Back (Reverse Side)</span>
                                  </div>

                                  {/* Page B: BACK SHEET (PURE A4 PRINT CONTENT) */}
                                  <div
                                    className="a4-print-sheet"
                                    style={{
                                      background: '#ffffff',
                                      borderRadius: '0 0 12px 12px',
                                      padding: '24px 30px',
                                      boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                                      width: '100%',
                                      minHeight: '1123px',
                                      boxSizing: 'border-box',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      justifyContent: 'center',
                                      alignItems: 'center'
                                    }}
                                  >
                                    <div
                                      className="a4-print-grid"
                                      style={{
                                        display: 'grid',
                                        gridTemplateColumns: gridCols,
                                        gap: gridGap,
                                        justifyContent: 'center'
                                      }}
                                    >
                                      {Array.from({ length: idCardCardsPerPage }).map((_, slotIdx) => {
                                        const st = mirroredChunk[slotIdx] || null;
                                        return (
                                          <div key={slotIdx} className="a4-card-slot" style={{ display: 'flex', justifyContent: 'center' }}>
                                            {st ? (
                                              <div
                                                className="print-id-card"
                                                style={{
                                                  width: cardWidth,
                                                  height: cardHeight,
                                                  boxSizing: 'border-box',
                                                  background: '#ffffff',
                                                  borderRadius: '12px',
                                                  boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                                                  overflow: 'hidden',
                                                  display: 'flex',
                                                  flexDirection: 'column',
                                                  justifyContent: 'space-between',
                                                  border: '1.5px solid #bfdbfe',
                                                  position: 'relative',
                                                  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
                                                }}
                                              >
                                                {/* Header Ribbon */}
                                                <div style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)', padding: isCompact ? '5px 8px' : '7px 10px', textAlign: 'center', color: '#ffffff' }}>
                                                  <h4 style={{ margin: 0, fontSize: isCompact ? '0.74rem' : '0.84rem', fontWeight: 800, letterSpacing: '0.4px', color: '#ffffff' }}>Terms &amp; Conditions</h4>
                                                  <span style={{ fontSize: isCompact ? '0.48rem' : '0.56rem', opacity: 0.9 }}>Career Xone Rules &amp; Regulations</span>
                                                </div>

                                                {/* Rules Body */}
                                                <div style={{ padding: isCompact ? '5px 8px' : '7px 10px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                                  <ul style={{
                                                    margin: 0,
                                                    paddingLeft: 0,
                                                    listStyle: 'none',
                                                    fontSize: isCompact ? '0.46rem' : '0.54rem',
                                                    color: '#1e293b',
                                                    lineHeight: isCompact ? '1.24' : '1.34',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: isCompact ? '2px' : '3px',
                                                    textAlign: 'left'
                                                  }}>
                                                    <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                                      <span style={{ color: '#2563eb', fontSize: '0.42rem', marginTop: '1px' }}>◆</span>
                                                      <span>Student should carry the ID card and produce it on demand.</span>
                                                    </li>
                                                    <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                                      <span style={{ color: '#2563eb', fontSize: '0.42rem', marginTop: '1px' }}>◆</span>
                                                      <span>Be ensured to update the Entry card before the Expiry date.</span>
                                                    </li>
                                                    <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                                      <span style={{ color: '#2563eb', fontSize: '0.42rem', marginTop: '1px' }}>◆</span>
                                                      <span>Reach class before time; parent's permission needed to leave early.</span>
                                                    </li>
                                                    <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                                      <span style={{ color: '#2563eb', fontSize: '0.42rem', marginTop: '1px' }}>◆</span>
                                                      <span>All students should wear proper uniform with shoes.</span>
                                                    </li>
                                                    <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                                      <span style={{ color: '#2563eb', fontSize: '0.42rem', marginTop: '1px' }}>◆</span>
                                                      <span>Student should maintain decency and decorum of institute.</span>
                                                    </li>
                                                    <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                                      <span style={{ color: '#2563eb', fontSize: '0.42rem', marginTop: '1px' }}>◆</span>
                                                      <span>Student found guilty of any misbehaviour will be rusticated.</span>
                                                    </li>
                                                    <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                                      <span style={{ color: '#2563eb', fontSize: '0.42rem', marginTop: '1px' }}>◆</span>
                                                      <span>Use or carry of Mobile Phone is strictly prohibited inside campus.</span>
                                                    </li>
                                                    <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                                      <span style={{ color: '#2563eb', fontSize: '0.42rem', marginTop: '1px' }}>◆</span>
                                                      <span>To issue a New ID Card in case of Lost/Damage ₹200/- will be charged.</span>
                                                    </li>
                                                    <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                                      <span style={{ color: '#2563eb', fontSize: '0.42rem', marginTop: '1px' }}>◆</span>
                                                      <span>If found outside premises, please deposit at Reception Counter.</span>
                                                    </li>
                                                    <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                                      <span style={{ color: '#2563eb', fontSize: '0.42rem', marginTop: '1px' }}>◆</span>
                                                      <span>Unhealthy culture affecting academic reputation will be strictly dealt with.</span>
                                                    </li>
                                                  </ul>

                                                  {/* Emergency Helpline Box */}
                                                  <div style={{
                                                    background: '#f0f9ff',
                                                    border: '1px solid #bae6fd',
                                                    borderRadius: '6px',
                                                    padding: '3px 6px',
                                                    fontSize: isCompact ? '0.48rem' : '0.58rem',
                                                    color: '#0369a1',
                                                    textAlign: 'center',
                                                    lineHeight: '1.2',
                                                    marginTop: '2px'
                                                  }}>
                                                    <strong>Reception:</strong> 9673383561 / 9145481323 | Gondia (MH)
                                                  </div>
                                                </div>

                                                {/* Bottom Ribbon */}
                                                <div style={{ background: '#1e3a8a', padding: isCompact ? '4px' : '5px', textAlign: 'center', fontSize: isCompact ? '0.52rem' : '0.62rem', color: '#ffffff', fontWeight: 800, letterSpacing: '0.5px' }}>
                                                  CAREER XONE • ACADEMIC EXCELLENCE
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="print-id-card-empty" style={{ width: cardWidth, height: cardHeight, visibility: 'hidden' }} />
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* ================= MODES 2, 3, 4: PAIRS / FRONT ONLY / BACK ONLY ================= */}
                      {idCardSide !== 'duplex' && (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 24,
                            justifyContent: 'center'
                          }}
                        >
                          {displayedIdCardStudents.map((st) => (
                            <div
                              key={st.id}
                              className="print-id-card-pair"
                              style={{
                                display: 'flex',
                                gap: 20,
                                flexWrap: 'wrap',
                                justifyContent: 'center',
                                alignItems: 'flex-start'
                              }}
                            >
                              {/* FRONT SIDE */}
                              {(idCardSide === 'both' || idCardSide === 'front') && (
                                <div
                                  className="print-id-card"
                                  style={{
                                    width: '260px',
                                    height: '390px',
                                    boxSizing: 'border-box',
                                    background: 'linear-gradient(135deg, #f0f7ff 0%, #dbeafe 100%)',
                                    borderRadius: '12px',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    border: '1.5px solid #bfdbfe',
                                    position: 'relative',
                                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
                                  }}
                                >
                                  {/* Top Cover Banner (Facebook-style Full Header) */}
                                  <div style={{
                                    boxSizing: 'border-box',
                                    height: '98px',
                                    width: '100%',
                                     height: '98px',
                                     width: '100%',
                                     margin: 0,
                                     background: '#ffffff',
                                     borderBottom: '2.5px solid #2563eb',
                                     display: 'flex',
                                     alignItems: 'center',
                                     justifyContent: 'center',
                                     padding: '4px 8px',
                                     position: 'relative'
                                   }}>
                                     <img src={idLogo} alt="Career Xone" style={{ maxWidth: '98%', maxHeight: '96%', width: 'auto', height: '84px', objectFit: 'contain' }} />
                                   </div>

                                   {/* Student Avatar / Photo (Overlapping Cover Banner Facebook Style) */}
                                   <div style={{
                                     display: 'flex',
                                     justifyContent: 'center',
                                     marginTop: '-48px',
                                     marginBottom: '1px',
                                     zIndex: 5,
                                     position: 'relative'
                                   }}>
                                     {st.photo ? (
                                       <img
                                         src={st.photo}
                                         alt={st.name}
                                         style={{
                                           width: '96px',
                                           height: '104px',
                                           borderRadius: '12px',
                                           objectFit: 'cover',
                                           border: '3px solid #ffffff',
                                           boxShadow: '0 5px 14px rgba(0, 0, 0, 0.20)',
                                           background: '#ffffff'
                                         }}
                                       />
                                     ) : (
                                       <div style={{
                                         width: '96px',
                                         height: '104px',
                                         borderRadius: '12px',
                                         background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                                         display: 'flex',
                                         alignItems: 'center',
                                         justifyContent: 'center',
                                         border: '3px solid #ffffff',
                                         boxShadow: '0 5px 14px rgba(0, 0, 0, 0.20)',
                                         fontSize: '2.0rem',
                                         color: '#ffffff',
                                         fontWeight: 800
                                       }}>
                                         {getInitials(st.name)}
                                       </div>
                                     )}
                                   </div>

                                   {/* Student Details */}
                                   <div style={{ padding: '0 12px', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: '3px' }}>
                                     <div>
                                       <h3 style={{ margin: '1px 0 1px 0', fontSize: '1.02rem', color: '#0f172a', fontWeight: 800, lineHeight: 1.25 }}>
                                         {st.name}
                                       </h3>
                                       <p style={{ margin: '0 0 2px 0', fontSize: '0.70rem', color: '#2563eb', fontWeight: 700 }}>
                                         Course: {formatBatchName(st.batch || st.targetClass || st.course, batches) || 'General'}
                                       </p>

                                       {/* Info Table Box */}
                                       <div style={{
                                         background: 'rgba(255, 255, 255, 0.94)',
                                         borderRadius: '6px',
                                         border: '1px solid #bfdbfe',
                                         padding: '5px 8px',
                                         textAlign: 'left',
                                         fontSize: '0.68rem',
                                         color: '#0f172a',
                                         lineHeight: 1.40
                                       }}>
                                         <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', marginBottom: '1px' }}>
                                           <strong style={{ minWidth: '54px', color: '#475569', flexShrink: 0 }}>Roll No:</strong>
                                           <span style={{ fontWeight: 800, color: '#1e3a8a' }}>{st.rollNo || '—'}</span>
                                         </div>
                                         <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', marginBottom: '1px' }}>
                                           <strong style={{ minWidth: '54px', color: '#475569', flexShrink: 0 }}>Parent:</strong>
                                           <span style={{ fontWeight: 600, textAlign: 'right', flex: 1, wordBreak: 'break-word' }}>{st.parentName || 'N/A'}</span>
                                         </div>
                                         <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', marginBottom: '1px' }}>
                                           <strong style={{ minWidth: '54px', color: '#475569', flexShrink: 0 }}>Contact:</strong>
                                           <span style={{ fontWeight: 600, textAlign: 'right', flex: 1 }}>{st.parentPhone || st.phone || 'N/A'}</span>
                                         </div>
                                         <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
                                           <strong style={{ minWidth: '54px', color: '#475569', flexShrink: 0 }}>Address:</strong>
                                           <span style={{ fontWeight: 500, textAlign: 'right', flex: 1, wordBreak: 'break-word' }}>{st.address || 'N/A'}</span>
                                         </div>
                                       </div>
                                     </div>

                                     {/* Bottom Bar: Centered Large Scannable QR (High Visibility, snugly below table) */}
                                     <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '2px 0 1px' }}>
                                       <div style={{
                                         display: 'flex',
                                         alignItems: 'center',
                                         justifyContent: 'center',
                                         background: '#ffffff',
                                         padding: '4px',
                                         borderRadius: '8px',
                                         border: '2px solid #93c5fd',
                                         boxShadow: '0 2px 8px rgba(37, 99, 235, 0.12)'
                                       }}>
                                         <QRCodeSVG value={String(st.rollNo || st.id)} size={74} level="M" />
                                       </div>
                                     </div>
                                   </div>

                                   {/* Footer Ribbon (No text clipping) */}
                                   <div style={{
                                     boxSizing: 'border-box',
                                     background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                     height: '26px',
                                     display: 'flex',
                                     alignItems: 'center',
                                     justifyContent: 'center',
                                     padding: '0 8px',
                                     fontSize: '0.68rem',
                                     lineHeight: 1,
                                     color: '#ffffff',
                                     fontWeight: 800,
                                     letterSpacing: '0.5px',
                                     flexShrink: 0
                                   }}>
                                     STUDENT ID: {st.id}
                                   </div>
                                 </div>
                              )}

                              {/* BACK SIDE (Terms & Conditions) */}
                              {(idCardSide === 'both' || idCardSide === 'back') && (
                                <div
                                  className="print-id-card"
                                  style={{
                                    width: '270px',
                                    height: '430px',
                                    boxSizing: 'border-box',
                                    background: '#ffffff',
                                    borderRadius: '12px',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    border: '1.5px solid #bfdbfe',
                                    position: 'relative',
                                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
                                  }}
                                >
                                  {/* Header Ribbon */}
                                  <div style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)', padding: '7px 10px', textAlign: 'center', color: '#ffffff' }}>
                                    <h4 style={{ margin: 0, fontSize: '0.84rem', fontWeight: 800, letterSpacing: '0.4px' }}>Terms &amp; Conditions</h4>
                                    <span style={{ fontSize: '0.56rem', opacity: 0.9 }}>Career Xone Rules &amp; Regulations</span>
                                  </div>

                                  {/* Rules Body */}
                                  <div style={{ padding: '7px 10px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <ul style={{
                                      margin: 0,
                                      paddingLeft: 0,
                                      listStyle: 'none',
                                      fontSize: '0.54rem',
                                      color: '#1e293b',
                                      lineHeight: '1.34',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '3px',
                                      textAlign: 'left'
                                    }}>
                                      <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                        <span style={{ color: '#2563eb', fontSize: '0.42rem', marginTop: '1px' }}>◆</span>
                                        <span>Student should carry the ID card and produce it on demand.</span>
                                      </li>
                                      <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                        <span style={{ color: '#2563eb', fontSize: '0.42rem', marginTop: '1px' }}>◆</span>
                                        <span>Be ensured to update the Entry card before the Expiry date.</span>
                                      </li>
                                      <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                        <span style={{ color: '#2563eb', fontSize: '0.42rem', marginTop: '1px' }}>◆</span>
                                        <span>Reach class before time; parent's permission needed to leave early.</span>
                                      </li>
                                      <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                        <span style={{ color: '#2563eb', fontSize: '0.42rem', marginTop: '1px' }}>◆</span>
                                        <span>All students should wear proper uniform with shoes.</span>
                                      </li>
                                      <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                        <span style={{ color: '#2563eb', fontSize: '0.42rem', marginTop: '1px' }}>◆</span>
                                        <span>Student should maintain decency and decorum of institute.</span>
                                      </li>
                                      <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                        <span style={{ color: '#2563eb', fontSize: '0.42rem', marginTop: '1px' }}>◆</span>
                                        <span>Student found guilty of any misbehaviour will be rusticated.</span>
                                      </li>
                                      <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                        <span style={{ color: '#2563eb', fontSize: '0.42rem', marginTop: '1px' }}>◆</span>
                                        <span>Use or carry of Mobile Phone is strictly prohibited inside campus.</span>
                                      </li>
                                      <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                        <span style={{ color: '#2563eb', fontSize: '0.42rem', marginTop: '1px' }}>◆</span>
                                        <span>To issue a New ID Card in case of Lost/Damage ₹200/- will be charged.</span>
                                      </li>
                                      <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                        <span style={{ color: '#2563eb', fontSize: '0.42rem', marginTop: '1px' }}>◆</span>
                                        <span>If found outside premises, please deposit at Reception Counter.</span>
                                      </li>
                                      <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                        <span style={{ color: '#2563eb', fontSize: '0.42rem', marginTop: '1px' }}>◆</span>
                                        <span>Unhealthy culture affecting academic reputation will be strictly dealt with.</span>
                                      </li>
                                    </ul>

                                    {/* Emergency Helpline Box */}
                                    <div style={{
                                      background: '#f0f9ff',
                                      border: '1px solid #bae6fd',
                                      borderRadius: '6px',
                                      padding: '3px 6px',
                                      fontSize: '0.58rem',
                                      color: '#0369a1',
                                      textAlign: 'center',
                                      lineHeight: '1.2',
                                      marginTop: '2px'
                                    }}>
                                      <strong>Reception:</strong> 9673383561 / 9145481323 | Gondia (MH)
                                    </div>
                                  </div>

                                  {/* Bottom Ribbon */}
                                  <div style={{ background: '#1e3a8a', padding: '5px', textAlign: 'center', fontSize: '0.62rem', color: '#ffffff', fontWeight: 800, letterSpacing: '0.5px' }}>
                                    CAREER XONE • ACADEMIC EXCELLENCE
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------------------- */}
            {/* 🛒 MODAL: RECOMMENDED SCANNER HARDWARE GUIDE                    */}
            {/* ---------------------------------------------------------------- */}
            {showHardwareModal && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(8px)',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20
              }}>
                <div style={{
                  background: '#0f172a',
                  borderRadius: 20,
                  width: '100%',
                  maxWidth: 620,
                  padding: 28,
                  border: '1.5px solid rgba(255, 255, 255, 0.18)',
                  boxShadow: '0 25px 70px rgba(0,0,0,0.6)',
                  position: 'relative'
                }}>
                  <button
                    type="button"
                    onClick={() => setShowHardwareModal(false)}
                    style={{
                      position: 'absolute',
                      top: 20,
                      right: 20,
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#ffffff',
                      cursor: 'pointer',
                      padding: '6px 8px',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <X size={18} />
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                    <div style={{ padding: 12, borderRadius: 14, background: 'rgba(16, 185, 129, 0.25)', color: '#34d399' }}>
                      <Zap size={28} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, color: '#ffffff' }}>
                        Recommended Tabletop QR Scanner
                      </h3>
                      <p style={{ margin: '3px 0 0', fontSize: '0.84rem', color: '#cbd5e1' }}>
                        100% Plug &amp; Play USB Hardware (Zero Drivers, Zero Setup)
                      </p>
                    </div>
                  </div>

                  {/* Main Recommended Product Card */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.5) 0%, rgba(15, 23, 42, 0.85) 100%)',
                    border: '1.5px solid #3b82f6',
                    borderRadius: 16,
                    padding: '20px',
                    marginBottom: 16
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div>
                        <span style={{
                          background: '#3b82f6',
                          color: '#ffffff',
                          fontSize: '0.72rem',
                          fontWeight: 900,
                          padding: '4px 10px',
                          borderRadius: 6,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em'
                        }}>
                          ⭐ TOP RECOMMENDED
                        </span>
                        <h4 style={{ margin: '10px 0 6px', fontSize: '1.15rem', fontWeight: 900, color: '#ffffff' }}>
                          Shreyans 1D 2D QR Hands-Free Desktop Barcode Scanner (Table Top Plug &amp; Play)
                        </h4>
                        <div style={{ fontSize: '0.88rem', color: '#cbd5e1', fontWeight: 600 }}>
                          Approx Price: <strong style={{ color: '#34d399', fontSize: '1.05rem', fontWeight: 900 }}>₹3,199</strong> on Amazon India
                        </div>
                      </div>
                    </div>

                    <ul style={{ margin: '14px 0 18px', paddingLeft: 20, fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.7 }}>
                      <li><strong style={{ color: '#ffffff' }}>Hands-Free 360° Omnidirectional Beam:</strong> Students just flash their card in front of the scanner.</li>
                      <li><strong style={{ color: '#ffffff' }}>Loud Confirmation Beep:</strong> Instant audible confirmation on every scan.</li>
                      <li><strong style={{ color: '#ffffff' }}>Zero Drivers Required:</strong> Standard USB HID keyboard wedge. Just plug into any USB port and it starts typing automatically!</li>
                      <li><strong style={{ color: '#ffffff' }}>Scans from Paper &amp; Phone:</strong> Reads printed ID cards and phone screen QR codes in 0.1s.</li>
                    </ul>

                    <a
                      href="https://www.amazon.in/dp/B09DT15V4B"
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#ffffff',
                        padding: '11px 20px',
                        borderRadius: 10,
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        textDecoration: 'none',
                        boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                      }}
                    >
                      <ExternalLink size={16} />
                      <span>Search &amp; Buy on Amazon India</span>
                    </a>
                  </div>

                  {/* Alternative Recommendation */}
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 14,
                    padding: '14px 18px',
                    fontSize: '0.84rem',
                    color: '#cbd5e1'
                  }}>
                    <strong style={{ color: '#ffffff' }}>Alternative Models:</strong>
                    <div style={{ marginTop: 6, lineHeight: 1.6 }}>
                      • <strong style={{ color: '#ffffff' }}>Retsol PD3000 / PD3500 2D Tabletop Barcode Scanner</strong> (~₹3,499)
                      <br />
                      • <strong style={{ color: '#ffffff' }}>Honeywell HF680 2D Hands-Free Scanner</strong> (~₹5,999)
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Print CSS Injection */}
            <style>{`
              @media print {
                @page {
                  size: A4 portrait;
                  margin: 6mm 6mm;
                }
                body, html {
                  margin: 0 !important;
                  padding: 0 !important;
                  background: #ffffff !important;
                  overflow: visible !important;
                  height: auto !important;
                  min-height: 100% !important;
                  width: 100% !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                body.printing-id-cards #root > *:not(.id-cards-modal-overlay),
                body.printing-id-cards .sidebar,
                body.printing-id-cards .topbar,
                body.printing-id-cards header,
                body.printing-id-cards nav,
                body.printing-id-cards .no-print,
                body.printing-id-cards .id-cards-modal-header,
                body.printing-id-cards .id-cards-modal-toolbar {
                  display: none !important;
                }
                body.printing-id-cards #root,
                body.printing-id-cards .app-layout,
                body.printing-id-cards .main-content,
                body.printing-id-cards div {
                  overflow: visible !important;
                  height: auto !important;
                  max-height: none !important;
                  filter: none !important;
                  backdrop-filter: none !important;
                  transform: none !important;
                }
                body.printing-id-cards .id-cards-modal-overlay {
                  position: static !important;
                  background: #ffffff !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  width: 100% !important;
                  height: auto !important;
                  max-height: none !important;
                  overflow: visible !important;
                  display: block !important;
                  filter: none !important;
                  backdrop-filter: none !important;
                  z-index: auto !important;
                }
                body.printing-id-cards .id-cards-modal-card {
                  position: static !important;
                  background: #ffffff !important;
                  border: none !important;
                  box-shadow: none !important;
                  border-radius: 0 !important;
                  width: 100% !important;
                  max-width: none !important;
                  height: auto !important;
                  max-height: none !important;
                  overflow: visible !important;
                  display: block !important;
                }
                body.printing-id-cards #printable-id-cards {
                  position: static !important;
                  width: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  background: #ffffff !important;
                  display: block !important;
                  overflow: visible !important;
                }
                .a4-print-sheet {
                  page-break-after: always !important;
                  break-after: page !important;
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                  width: 100% !important;
                  max-width: 198mm !important;
                  min-height: 280mm !important;
                  box-sizing: border-box !important;
                  margin: 0 auto !important;
                  padding: 2mm 0 !important;
                  background: #ffffff !important;
                  display: flex !important;
                  flex-direction: column !important;
                  justify-content: flex-start !important;
                }
                .a4-print-header-banner {
                  display: none !important;
                }
                .a4-print-grid {
                  display: grid !important;
                  grid-template-columns: repeat(2, 94mm) !important;
                  gap: 4mm 6mm !important;
                  justify-content: center !important;
                  align-content: start !important;
                }
                .a4-card-slot {
                  display: flex !important;
                  justify-content: center !important;
                  align-items: center !important;
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                .print-id-card-pair {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                  display: flex !important;
                  gap: 16px !important;
                  margin-bottom: 20px !important;
                  justify-content: center !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .print-id-card {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                  box-shadow: none !important;
                  border: 1.5px solid #94a3b8 !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .print-id-card-empty {
                  width: 240px !important;
                  height: 380px !important;
                  visibility: hidden !important;
                }
              }
            `}</style>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
