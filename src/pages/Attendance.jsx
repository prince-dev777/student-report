import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Camera,
  Plus,
  Trash2,
  Lock
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import idLogo from '../assets/id-logo.png';
import StudentIdCard from '../components/StudentIdCard';
import StaffIdCard from '../components/StaffIdCard';
import StaffProfileModal from '../components/StaffProfileModal';
import StaffBulkUploadModal from '../components/StaffBulkUploadModal';
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
  calcDuration,
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
  const { students, batches, attendance, markAttendance, refreshAttendance, refreshSMSLogs, user, sessions = [] } = useApp();
  const [activeTab, setActiveTab] = useState('kiosk');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [todaySearch, setTodaySearch] = useState('');
  const [scannerState, setScannerState] = useState('default'); // 'default' | 'scanning' | 'success'
  const [currentTime, setCurrentTime] = useState(new Date());

  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calStudent, setCalStudent] = useState('all');
  const [attendanceFilter, setAttendanceFilter] = useState('all'); // 'all' | 'present' | 'late' | 'absent'
  const [todayPage, setTodayPage] = useState(1);
  const [todayPageSize, setTodayPageSize] = useState(25);
  
  // History Date Range States
  const [historyRangeType, setHistoryRangeType] = useState('custom'); // 'today' | '7days' | '30days' | 'custom' | 'heatmap'
  const [historyStartDate, setHistoryStartDate] = useState(getTodayStr());
  const [historyEndDate, setHistoryEndDate] = useState(getTodayStr());
  const [historyStatusFilter, setHistoryStatusFilter] = useState('all'); // 'all' | 'present' | 'late' | 'absent'
  
  // ⚡ Live QR Scanner Kiosk Mode States
  const [kioskCode, setKioskCode] = useState('');
  const [kioskMode, setKioskMode] = useState('auto'); // 'auto' | 'entry' | 'exit'
  const [selectedSessionId, setSelectedSessionId] = useState('auto'); // 'auto' | session.id
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showIdCardsModal, setShowIdCardsModal] = useState(false);
  const [idCardsModalMode, setIdCardsModalMode] = useState('student'); // 'student' | 'staff'
  const [selectedStaffDept, setSelectedStaffDept] = useState('all');
  const [showHardwareModal, setShowHardwareModal] = useState(false);
  const [selectedIdCardBatch, setSelectedIdCardBatch] = useState('all');
  const [idCardSearch, setIdCardSearch] = useState('');
  const [idCardSide, setIdCardSide] = useState('duplex'); // 'duplex' | 'both' | 'front' | 'back'
  const [idCardCardsPerPage, setIdCardCardsPerPage] = useState(4); // 4 (Large 2x2) or 6 (Compact 2x3)
  const [idCardPreviewPage, setIdCardPreviewPage] = useState(1);
  const [idCardShowAll, setIdCardShowAll] = useState(false);
  const [idCardRepeatFill, setIdCardRepeatFill] = useState(false);

  // 📏 ID Card Custom Sizing & Dimension Controls (Length & Width Customization)
  const [idCardWidth, setIdCardWidth] = useState(260); // in px (e.g., 160 to 320)
  const [idCardHeight, setIdCardHeight] = useState(390); // in px (e.g., 240 to 480)
  const [idCardScale, setIdCardScale] = useState(100); // 60% to 125%
  const [idCardLockRatio, setIdCardLockRatio] = useState(true);
  const [idCardSizePreset, setIdCardSizePreset] = useState('standard'); // 'standard' | 'compact' | 'small' | 'mini' | 'custom'

  const handleSizePresetChange = (preset) => {
    setIdCardSizePreset(preset);
    if (preset === 'standard') {
      setIdCardWidth(260);
      setIdCardHeight(390);
      setIdCardScale(100);
    } else if (preset === 'compact') {
      setIdCardWidth(230);
      setIdCardHeight(355);
      setIdCardScale(88);
    } else if (preset === 'small') {
      setIdCardWidth(205);
      setIdCardHeight(315);
      setIdCardScale(79);
    } else if (preset === 'mini') {
      setIdCardWidth(185);
      setIdCardHeight(280);
      setIdCardScale(71);
    }
  };

  const handleWidthChange = (newW) => {
    const w = Math.max(160, Math.min(340, Number(newW) || 160));
    setIdCardWidth(w);
    if (idCardLockRatio) {
      const h = Math.round(w * 1.5);
      setIdCardHeight(h);
      setIdCardScale(Math.round((w / 260) * 100));
    }
    setIdCardSizePreset('custom');
  };

  const handleHeightChange = (newH) => {
    const h = Math.max(240, Math.min(500, Number(newH) || 240));
    setIdCardHeight(h);
    if (idCardLockRatio) {
      const w = Math.round(h / 1.5);
      setIdCardWidth(w);
      setIdCardScale(Math.round((w / 260) * 100));
    }
    setIdCardSizePreset('custom');
  };

  const handleScaleChange = (newScale) => {
    const s = Math.max(60, Math.min(125, Number(newScale) || 100));
    setIdCardScale(s);
    const w = Math.round(260 * (s / 100));
    const h = Math.round(390 * (s / 100));
    setIdCardWidth(w);
    setIdCardHeight(h);
    if (s === 100) setIdCardSizePreset('standard');
    else if (s === 88 && w === 230) setIdCardSizePreset('compact');
    else setIdCardSizePreset('custom');
  };

  const handleResetCardSize = () => {
    setIdCardSizePreset('standard');
    setIdCardWidth(260);
    setIdCardHeight(390);
    setIdCardScale(100);
    setIdCardLockRatio(true);
    toast.success('Card dimensions reset to Standard PVC (260 × 390 px)!');
  };
  const [lastPunch, setLastPunch] = useState(null);
  const [lastScannedMap, setLastScannedMap] = useState({});
  const [showKioskSuggestions, setShowKioskSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const lastSeenBiometricEventIdRef = useRef(null);
  const kioskInputRef = useRef(null);
  const lastKioskKeyTimeRef = useRef(0);
  const firstBurstCharRef = useRef('');
  const isScannerBurstRef = useRef(false);

  // 📡 Biometric Machine Integration States
  const [biometricStatus, setBiometricStatus] = useState({
    connected: true,
    targetIp: '192.168.0.12',
    targetPort: 8000,
    autoSyncEnabled: true,
    lastSyncTime: null,
    recentPunches: [],
    admsStatus: { active: true, listenerPort: 8000 }
  });
  const [isBiometricSyncing, setIsBiometricSyncing] = useState(false);
  const [isBiometricScanning, setIsBiometricScanning] = useState(false);
  const [showBiometricGuideModal, setShowBiometricGuideModal] = useState(false);
  const [detectedDevices, setDetectedDevices] = useState([
    { ip: '192.168.0.12', port: 8000, name: 'Biomax FK Hardware', protocol: 'HTTP Push 8000', status: 'Online' }
  ]);

  // 🌐 Network & 1-Click Static IP (192.168.0.162) State
  const [networkInfo, setNetworkInfo] = useState({
    currentIp: '192.168.0.162',
    targetIp: '192.168.0.162',
    isStaticLocked: true,
    status: 'Locked & Active',
    wifiSsid: 'CXJEE2',
    adapterName: 'Wi-Fi',
    gateway: '192.168.0.1',
    supportedDevices: []
  });
  const [isLockingIp, setIsLockingIp] = useState(false);

  const fetchNetworkInfo = async () => {
    try {
      const res = await api.getBiometricNetworkStatus();
      if (res?.success) {
        setNetworkInfo(res);
      }
    } catch (e) {
      console.warn('Network info error:', e);
    }
  };

  const handleLockStaticIp = async () => {
    setIsLockingIp(true);
    const toastId = toast.loading('🔒 Locking Permanent Static IP (192.168.0.162)...');
    try {
      const res = await api.lockBiometricStaticIp({
        targetIp: '192.168.0.162',
        gateway: networkInfo.gateway || '192.168.0.1',
        adapterName: networkInfo.adapterName || 'Wi-Fi'
      });
      if (res?.success) {
        toast.success(`✅ ${res.message || 'Permanent Static IP locked!'}`, { id: toastId });
        await fetchNetworkInfo();
      } else {
        toast.error(res?.error || 'Failed to lock static IP', { id: toastId });
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`, { id: toastId });
    } finally {
      setIsLockingIp(false);
    }
  };

  const handleResetDhcp = async () => {
    setIsLockingIp(true);
    const toastId = toast.loading('Resetting adapter to automatic dynamic IP (DHCP)...');
    try {
      const res = await api.resetBiometricDhcp({ adapterName: networkInfo.adapterName || 'Wi-Fi' });
      if (res?.success) {
        toast.success(`Adapter reset to automatic DHCP!`, { id: toastId });
        await fetchNetworkInfo();
      } else {
        toast.error(res?.error || 'Failed to reset DHCP', { id: toastId });
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`, { id: toastId });
    } finally {
      setIsLockingIp(false);
    }
  };

  const handleTestDevicePing = async (ip = '192.168.0.12', port = 71) => {
    const toastId = toast.loading(`📡 Testing connection with ${ip}...`);
    try {
      const res = await api.testBiometricConnection({ ip, port });
      if (res?.success) {
        toast.success(`✅ Terminal ${ip} is ONLINE & responsive!`, { id: toastId });
      } else {
        toast.error(`❌ Terminal ${ip} unreachable: ${res?.message || 'Check power/Wi-Fi'}`, { id: toastId });
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`, { id: toastId });
    }
  };

  // 👥 Employee / Staff Attendance States
  const [staffRoster, setStaffRoster] = useState([]);
  const [staffDate, setStaffDate] = useState(getTodayStr());
  const [staffSearch, setStaffSearch] = useState('');
  const [isStaffLoading, setIsStaffLoading] = useState(false);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [showStaffBulkUploadModal, setShowStaffBulkUploadModal] = useState(false);
  const [selectedStaffProfile, setSelectedStaffProfile] = useState(null);
  const [staffPunchingId, setStaffPunchingId] = useState(null);

  // ⚡ Dedicated 2D Barcode & QR Scanner Gun States for Staff
  const [staffViewMode, setStaffViewMode] = useState('roster'); // 'roster' | 'scanner'
  const [staffScannerCode, setStaffScannerCode] = useState('');
  const [staffScanMode, setStaffScanMode] = useState('AUTO'); // 'AUTO' | 'IN' | 'OUT'
  const [staffSoundEnabled, setStaffSoundEnabled] = useState(true);
  const [staffLastPunch, setStaffLastPunch] = useState(null);
  const [staffRecentPunches, setStaffRecentPunches] = useState([]);
  const staffHardwareInputRef = useRef(null);
  const staffScanCooldownMap = useRef({});

  // 🔘 Clickable Badge Filters for Employee Attendance Roster
  const [staffFilter, setStaffFilter] = useState('all'); // 'all' | 'present' | 'absent' | 'departments'
  const [staffDeptFilter, setStaffDeptFilter] = useState('all');

  // 🔘 Today's Record Type (Student vs Staff)
  const [todayRecordType, setTodayRecordType] = useState('student'); // 'student' | 'staff'
  const [todayStaffSearch, setTodayStaffSearch] = useState('');
  const [todayStaffFilter, setTodayStaffFilter] = useState('all'); // 'all' | 'present' | 'absent'
  const [todayStaffDept, setTodayStaffDept] = useState('all');

  // 🔘 History Record Type (Student vs Staff)
  const [historyRecordType, setHistoryRecordType] = useState('student'); // 'student' | 'staff'
  const [staffHistoryStaffId, setStaffHistoryStaffId] = useState('all');
  const [staffHistoryDept, setStaffHistoryDept] = useState('all');
  const [staffHistoryRangeType, setStaffHistoryRangeType] = useState('7days'); // 'today' | '7days' | '30days' | 'custom'
  const [staffHistoryStartDate, setStaffHistoryStartDate] = useState('');
  const [staffHistoryEndDate, setStaffHistoryEndDate] = useState('');
  const [staffHistoryStatusFilter, setStaffHistoryStatusFilter] = useState('all');
  const [staffHistorySearch, setStaffHistorySearch] = useState('');
  const [staffHistoryRecords, setStaffHistoryRecords] = useState([]);
  const [isStaffHistoryLoading, setIsStaffHistoryLoading] = useState(false);

  const [newStaffForm, setNewStaffForm] = useState({
    staffId: '',
    name: '',
    designation: 'Faculty / Staff',
    department: 'Engineering',
    phone: '',
    email: '',
    role: 'staff',
    photo: null
  });

  // 🔍 Real-time Live Matching Suggestions for Staff Scanner Bar
  const staffScannerSuggestions = useMemo(() => {
    const raw = (staffScannerCode || '').replace(/^#+/, '').trim().toLowerCase();
    if (!raw) return [];
    return staffRoster.filter(st => {
      const sname = (st.name || '').toLowerCase();
      const sid = String(st.staffId || '').replace(/^#+/, '').toLowerCase();
      const sdept = (st.department || '').toLowerCase();
      const sdesig = (st.designation || '').toLowerCase();
      const sphone = String(st.phone || '').toLowerCase();
      return sid.includes(raw) || sname.includes(raw) || sdept.includes(raw) || sdesig.includes(raw) || sphone.includes(raw);
    });
  }, [staffScannerCode, staffRoster]);

  // Fetch Staff Attendance Roster
  const fetchStaffAttendance = async (date = staffDate, showToast = false) => {
    setIsStaffLoading(true);
    try {
      const [attRes, staffRes] = await Promise.allSettled([
        api.getStaffAttendance(date),
        api.getStaffMembers()
      ]);
      const data = attRes.status === 'fulfilled' ? (attRes.value?.data || attRes.value) : null;
      const staffList = staffRes.status === 'fulfilled' ? (staffRes.value?.staff || staffRes.value?.data?.staff || []) : [];

      if (data?.success) {
        const rawRoster = data.roster || [];
        // Merge latest contact info (phone, email, role, department) from staff collection
        const enrichedRoster = rawRoster.map(st => {
          const matched = staffList.find(s => String(s.staffId) === String(st.staffId));
          return {
            ...st,
            phone: matched?.phone || st.phone || '',
            email: matched?.email || st.email || '',
            department: matched?.department || st.department || 'General',
            designation: matched?.designation || st.designation || 'Staff',
            role: matched?.role || st.role || 'staff',
            photo: matched?.photo || st.photo || null
          };
        });
        setStaffRoster(enrichedRoster);
        if (showToast) {
          toast.success(`✅ Employee roster refreshed (${enrichedRoster.length} employees found)!`);
        }
      } else if (showToast) {
        toast.error(data?.error || 'Failed to refresh staff roster');
      }
    } catch (e) {
      console.warn('Failed to load staff attendance:', e);
      if (showToast) toast.error(`Refresh error: ${e.message}`);
    } finally {
      setIsStaffLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffAttendance(staffDate);
  }, [staffDate, activeTab]);

  // Manual Punch for Staff (Table buttons & Quick Punch)
  const handleManualStaffPunch = async (staffId, type = 'IN') => {
    if (!staffId) return toast.error('Staff ID is required');
    const punchKey = `${staffId}_${type}`;
    setStaffPunchingId(punchKey);
    const toastId = toast.loading(`Recording ${type} for staff ${staffId}...`);
    try {
      const res = await api.manualStaffPunch({
        staffId,
        type,
        date: staffDate
      });
      const data = res?.data || res;
      if (data?.success) {
        const determinedType = (data.type || type).toUpperCase();
        if (staffSoundEnabled) {
          playKioskSound(determinedType === 'IN' ? 'entry' : 'exit');
        }
        const matched = staffRoster.find(s => String(s.staffId) === String(staffId));
        const punchResult = {
          staff: matched || {
            staffId: data.staffId || staffId,
            name: data.name || `Staff ${staffId}`,
            department: data.department || 'General',
            designation: data.designation || 'Staff'
          },
          type: determinedType,
          time: data.time || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
          entryTime: data.entryTime,
          exitTime: data.exitTime,
          duration: data.workHoursFormatted || (data.durationMinutes ? `${Math.floor(data.durationMinutes / 60)}h ${data.durationMinutes % 60}m` : null),
          timestamp: Date.now()
        };
        setStaffLastPunch(punchResult);
        setStaffRecentPunches(prev => [punchResult, ...prev.slice(0, 14)]);

        toast.success(`✅ Recorded ${determinedType} for ${data.name || staffId} at ${punchResult.time}!`, { id: toastId });
        await fetchStaffAttendance(staffDate);
      } else {
        if (staffSoundEnabled) playKioskSound('error');
        toast.error(data?.error || data?.reason || 'Failed to record punch', { id: toastId });
      }
    } catch (err) {
      if (staffSoundEnabled) playKioskSound('error');
      toast.error(`Error: ${err.message}`, { id: toastId });
    } finally {
      setStaffPunchingId(null);
    }
  };

  // ⚡ Live Scanner Handler (Camera QR Code or 2D Gun Input)
  const handleStaffScanSubmit = async (rawInput, forcedMode = null) => {
    let code = String(rawInput !== undefined ? rawInput : staffScannerCode || '').trim();
    if (!code) return;
    setStaffScannerCode('');

    // Parse JSON or URL format if scanned from QR card
    let cleanCode = code;
    try {
      if (code.startsWith('{') && code.endsWith('}')) {
        const parsed = JSON.parse(code);
        cleanCode = String(parsed.staffId || parsed.id || parsed.rollNo || parsed.roll || code);
      }
    } catch (e) {}
    if (cleanCode.startsWith('http://') || cleanCode.startsWith('https://')) {
      try {
        const u = new URL(cleanCode);
        const parts = u.pathname.split('/').filter(Boolean);
        cleanCode = u.searchParams.get('staffId') || u.searchParams.get('id') || parts[parts.length - 1] || cleanCode;
      } catch (e) {}
    }
    // Clean leading 'STAFF_', '#', and trim
    cleanCode = cleanCode.replace(/^staff[_-]?/i, '').replace(/^#+/, '').trim();

    // Match in staff roster with intelligent multi-tier matching
    const target = cleanCode.toLowerCase();
    
    // Tier 1: Exact staffId or exact name or exact phone
    let matched = staffRoster.find(s => {
      const sid = String(s.staffId || '').replace(/^#+/, '').trim().toLowerCase();
      const sname = String(s.name || '').trim().toLowerCase();
      const sphone = String(s.phone || '').trim();
      return sid === target || sname === target || sphone === target;
    });

    // Tier 2: Numeric staffId match (e.g. 340 or 0340)
    if (!matched) {
      const tNum = parseInt(cleanCode, 10);
      if (!isNaN(tNum)) {
        matched = staffRoster.find(s => parseInt(String(s.staffId).replace(/^#+/, ''), 10) === tNum);
      }
    }

    // Tier 3: Substring name match (e.g. "Prince" or "Kumar" matches "Prince Kumar")
    if (!matched) {
      matched = staffRoster.find(s => {
        const sname = String(s.name || '').trim().toLowerCase();
        return sname.includes(target) || target.includes(sname);
      });
    }

    // Tier 4: Substring staffId or phone match
    if (!matched) {
      matched = staffRoster.find(s => {
        const sid = String(s.staffId || '').replace(/^#+/, '').trim().toLowerCase();
        const sphone = String(s.phone || '').trim();
        return sid.includes(target) || (target.length >= 4 && sphone.includes(target));
      });
    }

    const punchStaffId = matched?.staffId || cleanCode;
    const staffName = matched?.name || `Staff ${punchStaffId}`;
    const modeToUse = forcedMode || staffScanMode;

    // Anti-bounce cooldown protection (15 seconds)
    const now = Date.now();
    const lastScanTime = staffScanCooldownMap.current[punchStaffId] || 0;
    if (now - lastScanTime < 15000) {
      const elapsed = Math.round((now - lastScanTime) / 1000);
      const remaining = 15 - elapsed;
      if (staffSoundEnabled) playKioskSound('error');
      toast(`⏳ ${staffName} was already punched ${elapsed}s ago! Please wait ${remaining}s.`, { icon: '⚠️' });
      return;
    }

    setStaffPunchingId(punchStaffId);
    try {
      const res = await api.manualStaffPunch({
        staffId: punchStaffId,
        type: modeToUse,
        date: staffDate
      });
      const data = res?.data || res;
      if (data?.success) {
        staffScanCooldownMap.current[punchStaffId] = now;
        const punchType = (data.type || 'IN').toUpperCase();
        if (staffSoundEnabled) {
          playKioskSound(punchType === 'IN' ? 'entry' : 'exit');
        }

        const punchResult = {
          staff: matched || {
            staffId: data.staffId || punchStaffId,
            name: data.name || staffName,
            department: data.department || 'General',
            designation: data.designation || 'Staff'
          },
          type: punchType,
          time: data.time || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
          entryTime: data.entryTime,
          exitTime: data.exitTime,
          duration: data.workHoursFormatted || (data.durationMinutes ? `${Math.floor(data.durationMinutes / 60)}h ${data.durationMinutes % 60}m` : null),
          timestamp: Date.now()
        };

        setStaffLastPunch(punchResult);
        setStaffRecentPunches(prev => [punchResult, ...prev.slice(0, 14)]);
        toast.success(`⚡ Staff ${punchType}: ${punchResult.staff.name} at ${punchResult.time}!`);
        await fetchStaffAttendance(staffDate);
      } else {
        if (staffSoundEnabled) playKioskSound('error');
        toast.error(data?.error || data?.reason || `No staff member found for "${cleanCode}"`);
      }
    } catch (err) {
      if (staffSoundEnabled) playKioskSound('error');
      toast.error(`Punch error: ${err.message}`);
    } finally {
      setStaffPunchingId(null);
      if (staffHardwareInputRef.current) {
        staffHardwareInputRef.current.focus();
      }
    }
  };

  // Auto-focus 2D Barcode Gun hardware input when scanner desk is open
  useEffect(() => {
    if (activeTab === 'staff' && staffViewMode === 'scanner') {
      const timer = setTimeout(() => {
        staffHardwareInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeTab, staffViewMode]);

  const handleCleanBiometricHistory = async () => {
    if (!confirm('Are you sure you want to clean old historical backlog data? (Only today from 16:00 and Prince Kumar #340 will remain)')) return;
    const toastId = toast.loading('Cleaning old historical logs from database...');
    try {
      const res = await api.cleanBiometricHistory();
      const data = res?.data || res;
      if (data?.success) {
        toast.success(`🧹 Cleaned ${data.deletedStudentAttendance || 0} student logs and ${data.deletedStaffAttendance || 0} staff logs!`, { id: toastId });
        fetchStaffAttendance(staffDate);
        if (refreshAttendance) refreshAttendance();
      }
    } catch (err) {
      toast.error(`Clean failed: ${err.message}`, { id: toastId });
    }
  };

  
  const compressStaffImage = (file, maxWidth = 500, maxHeight = 500, quality = 0.85) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => reject(new Error('Failed to load image for compression'));
        img.src = readerEvent.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  };

  const handleNewStaffPhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressStaffImage(file, 500, 500, 0.85);
        setNewStaffForm(prev => ({ ...prev, photo: compressed }));
      } catch (err) {
        console.warn('Fallback to FileReader:', err);
        const reader = new FileReader();
        reader.onloadend = () => {
          setNewStaffForm(prev => ({ ...prev, photo: reader.result }));
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSaveStaffMember = async (e) => {
    e.preventDefault();
    if (!newStaffForm.staffId || !newStaffForm.name) {
      return toast.error('Please enter Staff ID and Full Name');
    }
    const toastId = toast.loading('Saving staff member...');
    try {
      const res = await api.createStaffMember(newStaffForm);
      const data = res?.data || res;
      if (data?.success) {
        toast.success(`✅ Added ${newStaffForm.name} (${newStaffForm.staffId})!`, { id: toastId });
        setShowAddStaffModal(false);
        setNewStaffForm({ staffId: '', name: '', designation: 'Faculty / Staff', department: 'Engineering', phone: '', email: '', role: 'staff', photo: null });
        fetchStaffAttendance(staffDate);
      } else {
        toast.error(data?.error || 'Failed to add staff', { id: toastId });
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`, { id: toastId });
    }
  };

  const exportStaffAttendanceCsv = (filterType = 'all') => {
    if (staffRoster.length === 0) return toast.error('No staff records to export');
    
    let targetList = staffRoster;
    let fileSuffix = 'all';
    let filterLabel = 'All Staff';

    if (filterType === 'present') {
      targetList = staffRoster.filter(s => s.status === 'present' || (s.entryTime && s.entryTime !== '--'));
      fileSuffix = 'present';
      filterLabel = 'Present Staff';
    } else if (filterType === 'absent') {
      targetList = staffRoster.filter(s => s.status !== 'present' && (!s.entryTime || s.entryTime === '--'));
      fileSuffix = 'absent';
      filterLabel = 'Absent Staff';
    }

    if (targetList.length === 0) {
      return toast.error(`No ${filterLabel.toLowerCase()} records to export`);
    }

    const headers = ['Employee ID,Name,Department,Designation,Status,Check-In,Check-Out,Duration,Device SN'];
    const rows = targetList.map(r => {
      const cleanSN = (r.deviceSN || 'Biomax Device')
        .replace(/telegram\s*remote/gi, 'Biomax Device')
        .replace(/telegram/gi, 'Biomax Device');
      return `"${r.staffId}","${r.name}","${r.department || 'General'}","${r.designation || 'Staff'}","${r.status}","${r.entryTime || '--'}","${r.exitTime || '--'}","${r.workHoursFormatted || '0h 0m'}","${cleanSN}"`;
    });
    const csvContent = "data:text/csv;charset=utf-8," + headers.concat(rows).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `staff_attendance_${fileSuffix}_${staffDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`📥 Exported ${targetList.length} ${filterLabel} records to Excel!`);
  };

  // Fetch Staff Attendance History with Date Range & Filters
  const fetchStaffHistory = async () => {
    setIsStaffHistoryLoading(true);
    try {
      let start = '';
      let end = '';
      const todayDate = new Date();
      const formatDate = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      if (staffHistoryRangeType === 'today') {
        start = formatDate(todayDate);
        end = formatDate(todayDate);
      } else if (staffHistoryRangeType === '7days') {
        const d = new Date(todayDate);
        d.setDate(d.getDate() - 7);
        start = formatDate(d);
        end = formatDate(todayDate);
      } else if (staffHistoryRangeType === '30days') {
        const d = new Date(todayDate);
        d.setDate(d.getDate() - 30);
        start = formatDate(d);
        end = formatDate(todayDate);
      } else if (staffHistoryRangeType === 'custom') {
        start = staffHistoryStartDate || formatDate(todayDate);
        end = staffHistoryEndDate || formatDate(todayDate);
      }

      const res = await api.getStaffAttendance({
        history: 'true',
        startDate: start,
        endDate: end,
        staffId: staffHistoryStaffId,
        department: staffHistoryDept
      });
      const data = res?.data || res;
      if (data?.success && Array.isArray(data.records)) {
        setStaffHistoryRecords(data.records);
      } else {
        setStaffHistoryRecords([]);
      }
    } catch (err) {
      console.warn('Failed to load staff history:', err);
    } finally {
      setIsStaffHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history' && historyRecordType === 'staff') {
      fetchStaffHistory();
    }
  }, [activeTab, historyRecordType, staffHistoryRangeType, staffHistoryStartDate, staffHistoryEndDate, staffHistoryStaffId, staffHistoryDept]);

  const exportStaffHistoryAttendance = () => {
    if (staffHistoryRecords.length === 0) return toast.error('No staff history records to export');
    const headers = ['Date,Staff ID,Name,Department,Designation,Status,Check-In,Check-Out,Duration,Device SN'];
    const rows = staffHistoryRecords.map(r => {
      const cleanSN = (r.deviceSN || 'Biomax Device')
        .replace(/telegram\s*remote/gi, 'Biomax Device')
        .replace(/telegram/gi, 'Biomax Device');
      return `"${r.date}","${r.staffId}","${r.staffName || ''}","${r.department || ''}","${r.designation || ''}","${r.status || ''}","${r.entryTime || '--'}","${r.exitTime || '--'}","${r.workHoursFormatted || '0h 0m'}","${cleanSN}"`;
    });
    const csvContent = "data:text/csv;charset=utf-8," + headers.concat(rows).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `staff_history_${staffHistoryRangeType}_${getTodayStr()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`📥 Exported ${staffHistoryRecords.length} staff history records!`);
  };

  // Fetch Biometric Status & Listen for Live Physical Hardware Punches
  const fetchBiometricStatus = async () => {
    try {
      const res = await api.get('/biometric/status');
      const data = res?.data || res;
      if (data && typeof data === 'object') {
        const safePort = parseInt(data.targetPort, 10) || 8000;
        setBiometricStatus(prev => ({
          ...prev,
          ...data,
          targetIp: data.targetIp || '192.168.0.12',
          targetPort: safePort
        }));
      }

      // Check for real-time live biometric event to trigger visual/sound chime
      const evtRes = await api.get('/biometric/latest-event');
      const evt = evtRes?.latestEvent || evtRes?.data?.latestEvent;
      if (evt && evt.id && evt.id !== lastSeenBiometricEventIdRef.current) {
        const isRecent = (Date.now() - (evt.timestamp || 0)) < 25000;
        lastSeenBiometricEventIdRef.current = evt.id;

        if (isRecent) {
          setLastPunch({
            student: evt.student,
            punchType: evt.punchType,
            time: evt.time,
            timestamp: evt.timestamp,
            duration: evt.duration || '',
            sessionName: evt.sessionName || '',
            parentPhone: evt.parentPhone || '',
            isStaff: evt.isStaff || false
          });
          setScannerState('success');
          setTimeout(() => setScannerState('default'), 3500);

          if (soundEnabled) {
            playKioskSound(evt.punchType === 'entry' ? 'entry' : 'exit');
          }
          toast.success(`⚡ Biometric Punch: ${evt.student.name} marked ${evt.punchType.toUpperCase()}!`, { icon: '👆' });
        }
      }
    } catch (e) {}
  };

  // Poll Biometric Status & Latest Attendance every 2.5 seconds
  useEffect(() => {
    fetchBiometricStatus();
    if (typeof refreshAttendance === 'function') refreshAttendance();
    const interval = setInterval(() => {
      fetchBiometricStatus();
      if (typeof refreshAttendance === 'function') refreshAttendance();
    }, 2500);
    return () => clearInterval(interval);
  }, [activeTab, refreshAttendance, soundEnabled]);

  // Clean Historical Attendance Backlog
  const handleClearAttendanceBacklog = async () => {
    if (!confirm(`🧹 Clear previous historical attendance backlog from database? Today's records will be kept.`)) return;
    const toastId = toast.loading('Clearing past backlog records...');
    try {
      const res = await api.post('/biometric/clear-attendance', { mode: 'before-date', beforeDate: getTodayStr() });
      const data = res?.data || res;
      toast.success(data.message || '✅ Past attendance backlog cleared successfully!', { id: toastId });
      if (typeof refreshAttendance === 'function') await refreshAttendance();
      fetchStaffAttendance(staffDate);
      fetchBiometricStatus();
    } catch (err) {
      toast.error(`Failed to clear backlog: ${err.message}`, { id: toastId });
    }
  };

  // Sync Biometric Logs Now
  const handleSyncBiometric = async (ip = '192.168.0.12', port = 71) => {
    setIsBiometricSyncing(true);
    const toastId = toast.loading(`📡 Connecting & Syncing from Biometric Machine (${ip}:${port})...`);
    try {
      const res = await api.post('/biometric/sync', { ip, port });
      const data = res?.data || res;
      if (data?.success) {
        toast.success(data.message || `✅ Successfully synchronized logs from Biometric Machine!`, { id: toastId });
        if (refreshAttendance) await refreshAttendance();
        fetchBiometricStatus();
      } else {
        toast.error(data?.error || `Failed to sync from Biometric Machine`, { id: toastId });
      }
    } catch (err) {
      toast.error(`Sync error: ${err.response?.data?.error || err.message}`, { id: toastId });
    } finally {
      setIsBiometricSyncing(false);
    }
  };

  // Scan Subnet for Devices
  const handleScanSubnet = async () => {
    setIsBiometricScanning(true);
    const toastId = toast.loading('🔍 Scanning Wi-Fi network for Biometric Machines...');
    try {
      const res = await api.post('/biometric/scan');
      const data = res?.data || res;
      if (data?.success) {
        const devices = data.devices || [];
        setDetectedDevices(devices.length > 0 ? devices : detectedDevices);
        if (devices.length > 0) {
          // Auto-update status with primary device
          const primary = devices[0];
          setBiometricStatus(prev => ({
            ...prev,
            connected: true,
            targetIp: primary.ip,
            targetPort: primary.port,
            error: null
          }));
          toast.success(`✅ Found ${data.count} Biometric Machine(s) — Primary: ${primary.ip}:${primary.port}`, { id: toastId });
        } else {
          toast.success('🔍 Scan complete — No new devices found (existing device retained)', { id: toastId });
        }
        fetchBiometricStatus();
      } else {
        toast.error(data?.error || 'Scan finished with no devices found', { id: toastId });
      }
    } catch (err) {
      toast.error(`Scan error: ${err.message}`, { id: toastId });
    } finally {
      setIsBiometricScanning(false);
    }
  };

  // Toggle Auto-Sync
  const handleToggleAutoSync = async () => {
    const nextState = !biometricStatus.autoSyncEnabled;
    try {
      // Always use port 71 for FK/Realtime/BioMax hardware (our confirmed device type)
      const syncIp = biometricStatus.targetIp || '192.168.0.12';
      const syncPort = 71; // ← HARDCODED: FK machines always use port 71
      const res = await api.post('/biometric/auto-sync', {
        enabled: nextState,
        intervalMs: 15000,
        devices: [{ ip: syncIp, port: syncPort }]
      });
      const data = res?.data || res;
      if (data?.success) {
        setBiometricStatus(prev => ({ ...prev, autoSyncEnabled: nextState }));
        toast.success(nextState ? `⚡ Auto-Sync enabled — ${syncIp}:${syncPort} (Every 15s)!` : '🛑 Auto-Sync paused.');
      }
    } catch (err) {
      toast.error(`Failed to toggle auto-sync: ${err.message}`);
    }
  };

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

  // 🔍 Live Kiosk Autocomplete Suggestions
  const kioskSuggestions = useMemo(() => {
    const q = kioskCode.trim().toLowerCase();
    if (!q || q.length < 1) return [];
    return activeStudents
      .filter((s) => {
        const name = (s.name || '').toLowerCase();
        const roll = String(s.rollNo || '').toLowerCase();
        const phone = String(s.phone || s.parentPhone || '').toLowerCase();
        const batch = String(s.batch || s.targetClass || '').toLowerCase();
        return name.includes(q) || roll.includes(q) || phone.includes(q) || batch.includes(q);
      })
      .slice(0, 8);
  }, [kioskCode, activeStudents]);

  useEffect(() => {
    setActiveSuggestionIndex(0);
  }, [kioskCode]);

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

  // Reset page when filter or search changes
  useEffect(() => {
    setTodayPage(1);
  }, [todaySearch, attendanceFilter, todayPageSize]);

  // Calculate paginated today records
  const totalTodayPages = useMemo(() => {
    if (todayPageSize === 'all') return 1;
    const size = typeof todayPageSize === 'number' ? todayPageSize : parseInt(todayPageSize, 10) || 25;
    return Math.ceil(filteredTodayStudents.length / size) || 1;
  }, [filteredTodayStudents.length, todayPageSize]);

  const paginatedTodayStudents = useMemo(() => {
    if (todayPageSize === 'all') return filteredTodayStudents;
    const size = typeof todayPageSize === 'number' ? todayPageSize : parseInt(todayPageSize, 10) || 25;
    const start = (todayPage - 1) * size;
    return filteredTodayStudents.slice(start, start + size);
  }, [filteredTodayStudents, todayPage, todayPageSize]);

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
      const candidates = [s.class, s.batch, s.targetClass, s.course].filter(Boolean);
      candidates.forEach((raw) => {
        if (raw && !map.has(raw)) {
          const formatted = formatBatchName(raw, batches);
          map.set(raw, { id: raw, name: formatted || raw });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [students, batches]);

  // Available departments for staff ID cards
  const availableStaffDepts = useMemo(() => {
    const set = new Set();
    staffRoster.forEach((s) => {
      if (s.department) set.add(s.department);
    });
    return Array.from(set).sort();
  }, [staffRoster]);

  // Filtered students / staff for ID card printing modal (Exact Roll/Staff ID Priority & 0ms Zero-Lag Indexing)
  const filteredIdCardStudents = useMemo(() => {
    const rawQ = idCardSearch.trim();

    if (idCardsModalMode === 'staff') {
      let pool = staffRoster;
      if (selectedStaffDept !== 'all') {
        const deptLower = selectedStaffDept.toLowerCase();
        pool = pool.filter(s => (s.department || '').toLowerCase() === deptLower);
      }
      if (!rawQ) return pool;
      const qLower = rawQ.toLowerCase();
      const isNumeric = /^\d+$/.test(rawQ);

      if (isNumeric) {
        const exactMatches = pool.filter((s) => {
          const sid = String(s.staffId || '').trim();
          const id = String(s.id || s._id || '').trim();
          return sid === rawQ || id === rawQ;
        });
        if (exactMatches.length > 0) return exactMatches;

        return pool.filter((s) => {
          const sid = String(s.staffId || '').trim();
          const p = String(s.phone || '').trim();
          return sid.startsWith(rawQ) || p.includes(rawQ);
        });
      }

      return pool.filter(s => {
        const name = (s.name || '').toLowerCase();
        const sid = String(s.staffId || '').toLowerCase();
        const phone = String(s.phone || '').toLowerCase();
        const desig = (s.designation || '').toLowerCase();
        const dept = (s.department || '').toLowerCase();
        return name.includes(qLower) || sid.includes(qLower) || phone.includes(qLower) || desig.includes(qLower) || dept.includes(qLower);
      });
    }

    let pool = activeStudents;
    if (selectedIdCardBatch !== 'all') {
      const bSel = selectedIdCardBatch.toLowerCase();
      pool = pool.filter((s) => {
        const rawBatch = (s.batch || '').toLowerCase();
        const rawClass = (s.class || '').toLowerCase();
        const rawTarget = (s.targetClass || '').toLowerCase();
        const rawCourse = (s.course || '').toLowerCase();
        const formatted = formatBatchName(s.batch || s.targetClass || s.course, batches).toLowerCase();
        return rawBatch === bSel || rawClass === bSel || rawTarget === bSel || rawCourse === bSel ||
               rawClass.includes(bSel) || rawBatch.includes(bSel) || formatted === bSel || formatted.includes(bSel);
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

    // Text / Name Search (Substring in name, class, or exact ID)
    return pool.filter((s) => {
      const name = (s.name || '').toLowerCase();
      const cls = (s.class || '').toLowerCase();
      const id = String(s.id || '').toLowerCase();
      const roll = String(s.rollNo || '').toLowerCase();
      return name.includes(qLower) || cls.includes(qLower) || id.includes(qLower) || roll === qLower;
    });
  }, [activeStudents, staffRoster, idCardsModalMode, selectedStaffDept, selectedIdCardBatch, idCardSearch]);

  // Reset page when batch or search changes
  useEffect(() => {
    setIdCardPreviewPage(1);
  }, [selectedIdCardBatch, selectedStaffDept, idCardsModalMode, idCardSearch]);

  // Preview Pagination Constants
  const PREVIEW_PAGE_SIZE = 24; // 6 sheets in 4-card mode, 4 sheets in 6-card mode
  const totalIdCardPages = Math.ceil(filteredIdCardStudents.length / PREVIEW_PAGE_SIZE) || 1;

  // Displayed students for butter-smooth 60fps screen rendering
  const displayedIdCardStudents = useMemo(() => {
    let list = filteredIdCardStudents;
    const shouldRepeat = idCardRepeatFill || (idCardCardsPerPage === 6 && list.length < 6);
    if (shouldRepeat && list.length > 0 && list.length < idCardCardsPerPage) {
      const repeated = [];
      let idx = 0;
      while (repeated.length < idCardCardsPerPage) {
        const item = list[idx % list.length];
        repeated.push({
          ...item,
          _repeatKey: `${item.staffId || item.id || idx}_rep_${repeated.length}`
        });
        idx++;
      }
      list = repeated;
    }
    if (idCardSearch.trim() || idCardShowAll || list.length <= PREVIEW_PAGE_SIZE) {
      return list;
    }
    const start = (idCardPreviewPage - 1) * PREVIEW_PAGE_SIZE;
    return list.slice(start, start + PREVIEW_PAGE_SIZE);
  }, [filteredIdCardStudents, idCardSearch, idCardShowAll, idCardPreviewPage, idCardRepeatFill, idCardCardsPerPage]);

  // 📥 High-Res Vector PDF via Master Template (Clean JSON Payload + Base64 Embedded Fonts)
  const handleSaveAsPdf = async () => {
    const toastId = toast.loading('Preparing vector PDF...');

    try {
      // 1. Logo ko base64 data URL mein convert karo (Self-contained embedding)
      let logoB64 = '';
      try {
        const resp = await fetch(idLogo);
        const blob = await resp.blob();
        logoB64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.warn('Logo conversion failed:', e);
      }

      // 2. Student / Staff data prepare karo (Pure JSON, Zero DOM dependency)
      const isStaffMode = idCardsModalMode === 'staff';
      let sourceList = filteredIdCardStudents;
      if (idCardCardsPerPage === 6 || idCardRepeatFill) {
        if (sourceList.length > 0 && sourceList.length < idCardCardsPerPage) {
          const repeated = [];
          let repIdx = 0;
          while (repeated.length < idCardCardsPerPage) {
            repeated.push(sourceList[repIdx % sourceList.length]);
            repIdx++;
          }
          sourceList = repeated;
        }
      }

      const studentData = sourceList.map(s => {
        if (isStaffMode) {
          return {
            id: s.staffId || s.id || s._id || '',
            studentId: s.staffId || '',
            name: s.name || '',
            rollNo: s.staffId || '',
            photo: s.photo || '',
            parentName: s.designation || 'Faculty / Staff',
            parentPhone: s.phone || 'N/A',
            phone: s.phone || '',
            className: s.designation || 'Staff / Faculty',
            batch: s.department || 'General',
            course: s.designation || 'Staff',
            department: s.department || 'General',
            designation: s.designation || 'Staff / Faculty',
            role: s.role || 'staff',
            isStaff: true
          };
        }
        return {
          id: s.id || '',
          studentId: s.studentId || s.id || '',
          name: s.name || '',
          rollNo: s.rollNo || s.id || '',
          photo: s.photo || '',
          parentName: s.parentName || s.guardianName || 'N/A',
          parentPhone: s.parentPhone || s.phone || 'N/A',
          phone: s.phone || '',
          className: s.class || formatBatchName(s.batch || s.targetClass || s.course, batches) || 'General',
          batch: s.batch || '',
          course: s.course || '',
          targetClass: s.targetClass || '',
          isStaff: false
        };
      });

      if (studentData.length === 0) {
        toast.error(`No ${isStaffMode ? 'staff members' : 'students'} found to export`, { id: toastId });
        return;
      }

      // 3. Batch / Department filename label
      const batchLabel = isStaffMode
        ? (selectedStaffDept === 'all' ? 'All_Departments' : selectedStaffDept.replace(/\s+/g, '_'))
        : (selectedIdCardBatch === 'all' ? 'All_Students' : selectedIdCardBatch.replace(/\s+/g, '_'));

      const defaultFilename = isStaffMode
        ? `CareerXone_Staff_ID_Cards_${batchLabel}_${idCardCardsPerPage}perSheet.pdf`
        : `CareerXone_ID_Cards_${batchLabel}_${idCardCardsPerPage}perSheet.pdf`;

      toast.loading(`Generating ${studentData.length} vector ${isStaffMode ? 'staff' : 'student'} cards...`, { id: toastId });

      // 4. Electron Native IPC call — Data bhejo, HTML aur Vector PDF wahan banega
      if (window.electronAPI && typeof window.electronAPI.printToPDF === 'function') {
        const effectiveW = idCardCardsPerPage === 6 ? Math.min(225, idCardWidth) : idCardWidth;
        const effectiveH = idCardCardsPerPage === 6 ? Math.min(330, idCardHeight) : idCardHeight;

        const result = await window.electronAPI.printToPDF({
          students: studentData,
          logoBase64: logoB64,
          side: idCardSide,
          cardsPerPage: idCardCardsPerPage,
          defaultName: defaultFilename,
          cardWidth: effectiveW,
          cardHeight: effectiveH
        });

        if (result.success) {
          toast.success(`✅ Vector PDF Saved! (${studentData.length} ${isStaffMode ? 'Staff' : 'Student'} Cards)`, { id: toastId });
        } else if (result.cancelled) {
          toast.info('PDF export cancelled', { id: toastId });
        } else {
          throw new Error(result.error || 'Failed to generate PDF');
        }
      } else {
        // Fallback for browser mode
        toast.dismiss(toastId);
        handlePrintSystem();
      }

    } catch (err) {
      console.error('PDF Generation Error:', err);
      toast.error(`❌ ${err.message}`, { id: toastId });
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
  const handleKioskScan = (e, studentOverride = null) => {
    if (e) e.preventDefault();
    let matchedStudent = studentOverride;

    const raw = String(kioskCode || '').trim();
    // Immediately clear input and suggestions so next scan never appends to previous text
    setKioskCode('');
    setShowKioskSuggestions(false);

    if (!matchedStudent) {
      if (!raw) return;

      // Auto-detect Staff QR Code (e.g. STAFF_2) on Kiosk and route immediately
      if (/^staff[_-]?/i.test(raw)) {
        handleStaffScanSubmit(raw);
        return;
      }

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
      matchedStudent = activeStudents.find((s) => {
        const r = String(s.rollNo || '').trim().toLowerCase();
        const id = String(s.id || '').trim().toLowerCase();
        const phone = String(s.phone || s.parentPhone || '').trim();
        return r === target || id === target || phone === target;
      }) || activeStudents.find((s) => {
        const rNum = parseInt(s.rollNo, 10);
        const targetNum = parseInt(extractedRoll, 10);
        return !isNaN(rNum) && !isNaN(targetNum) && rNum === targetNum;
      }) || activeStudents.find((s) => {
        return (s.name || '').toLowerCase().includes(target);
      });

      if (!matchedStudent) {
        // Fallback: Check if scanned input matches a staff member
        const cleanStaffTarget = extractedRoll.replace(/^staff[_-]?/i, '').replace(/^#+/, '').trim().toLowerCase();
        const matchedStaff = staffRoster.find(s => {
          const sid = String(s.staffId || '').replace(/^#+/, '').trim().toLowerCase();
          return sid === cleanStaffTarget;
        });
        if (matchedStaff) {
          handleStaffScanSubmit(raw);
          return;
        }

        if (soundEnabled) playKioskSound('error');
        toast.error(`❌ Student not found for Roll/QR: "${extractedRoll}"`);
        return;
      }
    }

    // 4. Anti-spam 60-second (1 min) debounce check
    const now = Date.now();
    const lastScanTime = lastScannedMap[matchedStudent.id];
    if (lastScanTime && (now - lastScanTime) < 60000) {
      const elapsedSecs = Math.round((now - lastScanTime) / 1000);
      const remainingSecs = 60 - elapsedSecs;
      toast(`⏳ ${matchedStudent.name} already scanned ${elapsedSecs}s ago! Please wait ${remainingSecs}s.`, { icon: '⚠️' });
      return;
    }

    // 5. Determine Entry vs Exit
    const todayStr = getTodayStr();
    const todayRecord = attendance.find((a) => a.studentId === matchedStudent.id && a.date === todayStr);

    let determinedType = kioskMode;
    if (kioskMode === 'auto') {
      const punches = Array.isArray(todayRecord?.punches) ? todayRecord.punches : [];
      const hasRound1Entry = todayRecord?.entryTime && todayRecord.entryTime !== '--';
      const hasRound1Exit = todayRecord?.exitTime && todayRecord.exitTime !== '--';
      const hasRound2Entry = todayRecord?.entryTime2 && todayRecord.entryTime2 !== '--';
      const hasRound2Exit = todayRecord?.exitTime2 && todayRecord.exitTime2 !== '--';

      // Robust 12-hour/24-hour time to minutes parser
      const parseEntryTimeToMins = (tStr) => {
        if (!tStr || tStr === '--') return null;
        const match12 = String(tStr).trim().match(/^(\d{1,2}):(\d{1,2})(?::\d{2})?\s*(AM|PM)?$/i);
        if (match12) {
          let h = parseInt(match12[1], 10);
          const m = parseInt(match12[2], 10) || 0;
          const mod = match12[3] ? match12[3].toUpperCase() : null;
          if (mod === 'PM' && h < 12) h += 12;
          if (mod === 'AM' && h === 12) h = 0;
          return h * 60 + m;
        }
        const parts = String(tStr).split(':');
        if (parts.length >= 2) {
          const h = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) || 0;
          if (!isNaN(h)) return h * 60 + m;
        }
        return null;
      };

      const cur = new Date();
      const currentMin = cur.getHours() * 60 + cur.getMinutes();

      if (!todayRecord || !hasRound1Entry) {
        determinedType = 'entry';
      } else if (hasRound1Entry && !hasRound1Exit) {
        // Checking out from Round 1
        const entryMin = parseEntryTimeToMins(todayRecord.entryTime);
        if (entryMin !== null && (currentMin - entryMin) < 15 && currentMin >= entryMin) {
          if (soundEnabled) playKioskSound('error');
          toast(`⚠️ ${matchedStudent.name} already checked in at ${formatTime(todayRecord.entryTime)}! Exit allowed after 15 mins.`, { icon: 'ℹ️' });
          return;
        }
        determinedType = 'exit';
      } else if (hasRound1Entry && hasRound1Exit && !hasRound2Entry) {
        // Re-entry: Second Check-in!
        determinedType = 'entry';
      } else if (hasRound2Entry && !hasRound2Exit) {
        // Second Check-out!
        const entryMin2 = parseEntryTimeToMins(todayRecord.entryTime2);
        if (entryMin2 !== null && (currentMin - entryMin2) < 15 && currentMin >= entryMin2) {
          if (soundEnabled) playKioskSound('error');
          toast(`⚠️ ${matchedStudent.name} checked in at ${formatTime(todayRecord.entryTime2)}! Exit allowed after 15 mins.`, { icon: 'ℹ️' });
          return;
        }
        determinedType = 'exit';
      } else {
        // Round 3+
        const lastP = punches[punches.length - 1];
        determinedType = (lastP && lastP.type === 'IN') ? 'exit' : 'entry';
      }
    } else if (kioskMode === 'entry') {
      determinedType = 'entry';
    } else if (kioskMode === 'exit') {
      determinedType = 'exit';
    }

    // Update debounce map
    setLastScannedMap((prev) => ({ ...prev, [matchedStudent.id]: now }));

    // Determine active session name
    let activeSession = selectedSessionId !== 'auto'
      ? sessions.find(s => s.id === selectedSessionId || s._id === selectedSessionId)
      : null;

    if (!activeSession && sessions && sessions.length > 0) {
      const curHours = new Date().getHours();
      const curMins = new Date().getMinutes();
      const punchMin = curHours * 60 + curMins;

      for (const sess of sessions) {
        if (!sess.startTime || !sess.endTime) continue;
        const [sH, sM] = sess.startTime.split(':').map(Number);
        const [eH, eM] = sess.endTime.split(':').map(Number);
        const startMin = sH * 60 + sM;
        const endMin = eH * 60 + eM;

        if (punchMin >= startMin - 45 && punchMin <= endMin + 30) {
          let matchesBatch = true;
          if (Array.isArray(sess.batchIds) && sess.batchIds.length > 0) {
            matchesBatch = matchedStudent && sess.batchIds.some(b => String(b).trim().toLowerCase() === String(matchedStudent.batch).trim().toLowerCase());
          } else if (sess.batchId && sess.batchId !== 'all') {
            const bList = sess.batchId.split(',').map(b => b.trim().toLowerCase());
            matchesBatch = matchedStudent && bList.includes(String(matchedStudent.batch).trim().toLowerCase());
          }

          let matchesClass = true;
          if (Array.isArray(sess.targetClasses) && sess.targetClasses.length > 0) {
            matchesClass = matchedStudent && sess.targetClasses.some(c => String(c).trim().toLowerCase() === String(matchedStudent.class).trim().toLowerCase());
          } else if (sess.className && sess.className !== 'all') {
            const cList = sess.className.split(',').map(c => c.trim().toLowerCase());
            matchesClass = matchedStudent && cList.includes(String(matchedStudent.class).trim().toLowerCase());
          }

          if (matchesBatch && matchesClass) {
            activeSession = sess;
            break;
          }
        }
      }

      if (!activeSession) {
        for (const sess of sessions) {
          const hasBatchRestrictions = (Array.isArray(sess.batchIds) && sess.batchIds.length > 0) || (sess.batchId && sess.batchId !== 'all');
          const hasClassRestrictions = (Array.isArray(sess.targetClasses) && sess.targetClasses.length > 0) || (sess.className && sess.className !== 'all');
          // Only unrestricted universal sessions can act as fallback
          if (hasBatchRestrictions || hasClassRestrictions) continue;

          const [sH, sM] = (sess.startTime || '00:00').split(':').map(Number);
          const [eH, eM] = (sess.endTime || '23:59').split(':').map(Number);
          const startMin = sH * 60 + sM;
          const endMin = eH * 60 + eM;
          if (punchMin >= startMin - 45 && punchMin <= endMin + 30) {
            activeSession = sess;
            break;
          }
        }
      }
    }

    // Mark attendance - On exit, preserve existing session if present
    const sessionToMark = determinedType === 'exit'
      ? (todayRecord?.sessionName || activeSession?.name)
      : activeSession?.name;
    markAttendance(matchedStudent.id, determinedType, sessionToMark);

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
    { key: 'kiosk', label: '📡 Biometric Machine & Kiosk' },
    { key: 'staff', label: '👥 Employee / Staff Attendance' },
    { key: 'today', label: "Today's Record" },
    { key: 'history', label: 'History' },
  ];

  const tabVariants = {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -16 },
  };

  const exportTodayAttendance = (filterType = 'all') => {
    if (todayTableData.length === 0) return toast.error('No student attendance records to export');
    
    let targetList = todayTableData;
    let fileSuffix = 'all';
    let filterLabel = 'All Students';

    if (filterType === 'present') {
      targetList = todayTableData.filter(r => r.status === 'present');
      fileSuffix = 'present';
      filterLabel = 'Present Students';
    } else if (filterType === 'absent') {
      targetList = todayTableData.filter(r => r.status === 'absent');
      fileSuffix = 'absent';
      filterLabel = 'Absent Students';
    }

    if (targetList.length === 0) {
      return toast.error(`No ${filterLabel.toLowerCase()} records to export`);
    }

    const headers = ['Roll No,Student,Status,Entry Time,Exit Time,Duration'];
    const rows = targetList.map(r => {
      const entry = r.entryTime ? formatTime(r.entryTime) : 'N/A';
      const exit = r.exitTime ? formatTime(r.exitTime) : 'N/A';
      const duration = calcDuration(r.entryTime, r.exitTime);
      return `${r.student?.rollNo || ''},"${r.student?.name || ''}",${r.status},"${entry}","${exit}","${duration}"`;
    });
    const csvContent = "data:text/csv;charset=utf-8," + headers.concat(rows).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `student_${fileSuffix}_attendance_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`📥 Exported ${targetList.length} ${filterLabel} records to Excel!`);
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
        {/* ========== TAB: 👥 Employee / Staff Attendance ========== */}
        {activeTab === 'staff' && (
          <motion.div
            key="staff"
            variants={tabVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-24"
          >
            {/* Top Toolbar & Controls */}
            <div className="card" style={{ padding: '20px 24px', background: 'var(--surface-color)', border: '1.5px solid var(--border-color)', borderRadius: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    👥 Employee &amp; Faculty Attendance Portal
                  </h2>
                  <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    Real-time biometric &amp; QR attendance tracking for teachers, admins, and staff members (Separate from students).
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {/* Date Picker */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-color)', padding: '6px 12px', borderRadius: 10, border: '1px solid var(--border-color)' }}>
                    <Calendar size={15} color="var(--accent-blue)" />
                    <input
                      type="date"
                      value={staffDate}
                      onChange={(e) => setStaffDate(e.target.value)}
                      style={{ border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '0.84rem', fontWeight: 700, outline: 'none', cursor: 'pointer' }}
                    />
                  </div>

                  {/* Refresh Button */}
                  <button
                    type="button"
                    onClick={() => fetchStaffAttendance(staffDate, true)}
                    disabled={isStaffLoading}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.80rem', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <RefreshCw size={14} className={isStaffLoading ? 'spin' : ''} />
                    <span>Refresh</span>
                  </button>

                  {/* Clear Old Backlog Button */}
                  <button
                    type="button"
                    onClick={handleCleanBiometricHistory}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.80rem', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444' }}
                    title="Clean old historical backlog from machine memory"
                  >
                    <X size={14} />
                    <span>Clear Old Backlog</span>
                  </button>

                  {/* Export CSV Buttons */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => exportStaffAttendanceCsv('present')}
                      className="btn btn-sm"
                      style={{ fontSize: '0.78rem', padding: '7px 11px', display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}
                      title="Download Present Staff Excel"
                    >
                      <Download size={13} />
                      <span>Present ({staffRoster.filter(s => s.status === 'present' || s.entryTime !== '--').length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => exportStaffAttendanceCsv('absent')}
                      className="btn btn-sm"
                      style={{ fontSize: '0.78rem', padding: '7px 11px', display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.3)' }}
                      title="Download Absent Staff Excel"
                    >
                      <Download size={13} />
                      <span>Absent ({staffRoster.filter(s => s.status !== 'present' && s.entryTime === '--').length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => exportStaffAttendanceCsv('all')}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.78rem', padding: '7px 11px', display: 'flex', alignItems: 'center', gap: 5 }}
                      title="Download All Staff CSV"
                    >
                      <Download size={13} />
                      <span>All CSV</span>
                    </button>
                  </div>

                  {/* Print Staff ID Cards Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIdCardsModalMode('staff');
                      setIdCardSearch('');
                      setSelectedStaffDept('all');
                      setShowIdCardsModal(true);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{
                      fontSize: '0.80rem',
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'linear-gradient(135deg, #cc0000 0%, #ff0000 100%)',
                      color: '#ffffff',
                      border: 'none',
                      boxShadow: '0 2px 8px rgba(220, 38, 38, 0.35)',
                      fontWeight: 800
                    }}
                  >
                    <Printer size={14} />
                    <span>🪪 Print Staff ID Cards</span>
                  </button>

                  {/* Bulk Import Staff Button */}
                  <button
                    type="button"
                    onClick={() => setShowStaffBulkUploadModal(true)}
                    className="btn btn-secondary btn-sm"
                    style={{
                      fontSize: '0.80rem',
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'rgba(2, 132, 199, 0.12)',
                      borderColor: '#0284c7',
                      color: '#0284c7',
                      fontWeight: 800
                    }}
                    title="Bulk import staff members via Excel (.xlsx / .xls)"
                  >
                    <FileSpreadsheet size={14} />
                    <span>📥 Bulk Import Staff</span>
                  </button>

                  {/* Add Staff Button */}
                  <button
                    type="button"
                    onClick={() => setShowAddStaffModal(true)}
                    className="btn btn-primary btn-sm"
                    style={{ fontSize: '0.80rem', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Plus size={14} />
                    <span>+ Add Employee</span>
                  </button>
                </div>
              </div>

              {/* View Switcher Bar & Sound Toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', gap: 8, background: 'var(--bg-color)', padding: 4, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                  <button
                    type="button"
                    onClick={() => setStaffViewMode('roster')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 16px',
                      borderRadius: 9,
                      border: 'none',
                      background: staffViewMode === 'roster' ? 'var(--surface-color)' : 'transparent',
                      color: staffViewMode === 'roster' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                      fontWeight: 800,
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                      boxShadow: staffViewMode === 'roster' ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Users size={15} />
                    <span>Employee Roster ({staffRoster.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStaffViewMode('scanner')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 18px',
                      borderRadius: 9,
                      border: 'none',
                      background: staffViewMode === 'scanner' ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : 'transparent',
                      color: staffViewMode === 'scanner' ? '#ffffff' : 'var(--text-secondary)',
                      fontWeight: 800,
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                      boxShadow: staffViewMode === 'scanner' ? '0 3px 12px rgba(124, 58, 237, 0.35)' : 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Scan size={15} />
                    <span>⚡ 2D Scanner Gun Desk</span>
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setStaffSoundEnabled(!staffSoundEnabled)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.80rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, color: staffSoundEnabled ? '#10b981' : 'var(--text-secondary)' }}
                    title="Toggle Audio Beep on Scan"
                  >
                    {staffSoundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                    <span>{staffSoundEnabled ? 'Sound ON' : 'Muted'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ========== VIEW 1: ⚡ DEDICATED 2D BARCODE & QR GUN SCANNER DESK ========== */}
            {staffViewMode === 'scanner' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
                {/* Left Column: Dedicated 2D Gun Scanner Desk */}
                <div className="card" style={{ padding: '22px', borderRadius: 18, border: '1.5px solid var(--border-color)', background: 'var(--surface-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(124, 58, 237, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed' }}>
                        <Scan size={24} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                          Staff 2D Barcode & QR Scanner Desk
                        </h3>
                        <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0 }}>
                          Dedicated Handheld & USB 2D Barcode Gun Scanner Receiver
                        </p>
                      </div>
                    </div>

                    {/* Active 2D Gun Status Pill */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      background: 'rgba(124, 58, 237, 0.10)',
                      padding: '6px 14px',
                      borderRadius: 10,
                      border: '1.5px solid rgba(124, 58, 237, 0.25)',
                      color: '#7c3aed',
                      fontWeight: 800,
                      fontSize: '0.80rem'
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} />
                      <Scan size={14} />
                      <span>2D Gun Scanner Active</span>
                    </div>
                  </div>

                  {/* Punch Direction Selector */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: 'var(--bg-color)', padding: 4, borderRadius: 10, border: '1px solid var(--border-color)' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setStaffScanMode('AUTO');
                        staffHardwareInputRef.current?.focus();
                      }}
                      style={{
                        flex: 1,
                        padding: '7px 8px',
                        borderRadius: 7,
                        border: 'none',
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        background: staffScanMode === 'AUTO' ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : 'transparent',
                        color: staffScanMode === 'AUTO' ? '#ffffff' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4
                      }}
                    >
                      <Zap size={12} />
                      <span>🔄 Auto (IN / OUT)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStaffScanMode('IN');
                        staffHardwareInputRef.current?.focus();
                      }}
                      style={{
                        flex: 1,
                        padding: '7px 8px',
                        borderRadius: 7,
                        border: 'none',
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        background: staffScanMode === 'IN' ? '#10b981' : 'transparent',
                        color: staffScanMode === 'IN' ? '#ffffff' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4
                      }}
                    >
                      <LogIn size={12} />
                      <span>🟢 Check-In Only</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStaffScanMode('OUT');
                        staffHardwareInputRef.current?.focus();
                      }}
                      style={{
                        flex: 1,
                        padding: '7px 8px',
                        borderRadius: 7,
                        border: 'none',
                        fontSize: '0.76rem',
                        fontWeight: 800,
                        background: staffScanMode === 'OUT' ? '#3b82f6' : 'transparent',
                        color: staffScanMode === 'OUT' ? '#ffffff' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4
                      }}
                    >
                      <LogOut size={12} />
                      <span>🔵 Check-Out Only</span>
                    </button>
                  </div>

                  {/* 2D Gun Hardware Input Bar (Always Auto-Focused) */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleStaffScanSubmit(staffScannerCode);
                    }}
                    style={{ marginBottom: 16 }}
                  >
                    <div style={{ position: 'relative' }}>
                      <input
                        ref={staffHardwareInputRef}
                        type="text"
                        placeholder="🔫 Ready for Gun: Scan QR Code or Type Staff ID / Name (e.g. 340, Prince)..."
                        value={staffScannerCode}
                        onChange={(e) => setStaffScannerCode(e.target.value)}
                        autoFocus
                        style={{
                          width: '100%',
                          padding: '13px 95px 13px 40px',
                          borderRadius: 12,
                          border: '2px solid #7c3aed',
                          background: 'rgba(124, 58, 237, 0.04)',
                          color: 'var(--text-primary)',
                          fontSize: '0.94rem',
                          fontWeight: 800,
                          outline: 'none',
                          boxShadow: '0 0 0 3px rgba(124, 58, 237, 0.12)'
                        }}
                      />
                      <Scan size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#7c3aed', pointerEvents: 'none' }} />
                      <button
                        type="submit"
                        disabled={!staffScannerCode.trim() || !!staffPunchingId}
                        style={{
                          position: 'absolute',
                          right: 6,
                          top: 6,
                          bottom: 6,
                          padding: '0 18px',
                          borderRadius: 8,
                          border: 'none',
                          background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '0.82rem',
                          cursor: staffScannerCode.trim() ? 'pointer' : 'not-allowed',
                          opacity: staffScannerCode.trim() ? 1 : 0.6
                        }}
                      >
                        {staffPunchingId ? '...' : '⚡ Punch'}
                      </button>
                    </div>

                    {/* ⚡ Instant Live Matched Staff Suggestions Card */}
                    {staffScannerCode.trim() && (
                      <div
                        style={{
                          marginTop: 10,
                          borderRadius: 14,
                          border: '1.5px solid #a78bfa',
                          background: 'var(--surface-color, #ffffff)',
                          boxShadow: '0 10px 30px rgba(124, 58, 237, 0.18)',
                          overflow: 'hidden',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{ padding: '8px 14px', background: 'rgba(124, 58, 237, 0.08)', fontSize: '0.74rem', fontWeight: 800, color: '#6d28d9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>🔍 Matching Staff Members ({staffScannerSuggestions.length})</span>
                          <span style={{ fontSize: '0.70rem', color: '#7c3aed' }}>Press Enter or Click to Punch</span>
                        </div>

                        {staffScannerSuggestions.length > 0 ? (
                          staffScannerSuggestions.map(st => {
                            const isPrince = String(st.staffId) === '340';
                            const isPresent = st.status === 'present' || (st.entryTime && st.entryTime !== '--');
                            return (
                              <div
                                key={st.staffId}
                                style={{
                                  padding: '12px 14px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 12,
                                  borderBottom: '1px solid var(--border-color, #e2e8f0)',
                                  background: isPrince ? 'rgba(59, 130, 246, 0.04)' : 'transparent',
                                  transition: 'background 0.15s ease'
                                }}
                              >
                                <div
                                  onClick={() => handleStaffScanSubmit(st.staffId)}
                                  style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1 }}
                                >
                                  <div
                                    style={{
                                      width: 36,
                                      height: 36,
                                      borderRadius: '50%',
                                      background: isPrince ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : '#7c3aed',
                                      color: '#fff',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 800,
                                      fontSize: '0.82rem'
                                    }}
                                  >
                                    {getInitials(st.name)}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 800, fontSize: '0.90rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                      {st.name}
                                      <span style={{ fontSize: '0.74rem', background: 'rgba(124, 58, 237, 0.1)', color: '#6d28d9', padding: '1px 7px', borderRadius: 6, fontWeight: 800, fontFamily: 'monospace' }}>
                                        ID: {st.staffId}
                                      </span>
                                      {isPrince && <span style={{ background: '#3b82f6', color: '#fff', fontSize: '0.65rem', padding: '1px 6px', borderRadius: 6, fontWeight: 800 }}>⭐ You</span>}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                      {st.department} • {st.designation} • <span style={{ color: isPresent ? '#10b981' : '#ef4444', fontWeight: 700 }}>{isPresent ? `✓ Present (${st.entryTime})` : '✗ Absent'}</span>
                                    </div>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button
                                    type="button"
                                    onClick={() => handleStaffScanSubmit(st.staffId, 'IN')}
                                    className="btn btn-sm"
                                    style={{ background: '#10b981', color: '#fff', fontSize: '0.74rem', padding: '5px 11px', borderRadius: 7, fontWeight: 800 }}
                                    title="Record Check-In"
                                  >
                                    ✓ IN
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStaffScanSubmit(st.staffId, 'OUT')}
                                    className="btn btn-sm"
                                    style={{ background: '#3b82f6', color: '#fff', fontSize: '0.74rem', padding: '5px 11px', borderRadius: 7, fontWeight: 800 }}
                                    title="Record Check-Out"
                                  >
                                    ✓ OUT
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleStaffScanSubmit(st.staffId, 'AUTO')}
                                    className="btn btn-sm"
                                    style={{ background: '#7c3aed', color: '#fff', fontSize: '0.74rem', padding: '5px 12px', borderRadius: 7, fontWeight: 800 }}
                                    title="Smart Auto Check-In / Check-Out"
                                  >
                                    ⚡ Punch
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ padding: '14px 18px', fontSize: '0.82rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                            No staff found matching "<strong>{staffScannerCode}</strong>". Type staff ID (e.g. 340) or press ⚡ Punch to submit.
                          </div>
                        )}
                      </div>
                    )}
                  </form>

                  {/* Dedicated 2D Gun Station Card */}
                  <div
                    onClick={() => staffHardwareInputRef.current?.focus()}
                    style={{
                      padding: '28px 20px',
                      borderRadius: 16,
                      background: 'rgba(124, 58, 237, 0.03)',
                      border: '2px dashed #7c3aed',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{
                      width: 58,
                      height: 58,
                      borderRadius: '50%',
                      background: 'rgba(124, 58, 237, 0.12)',
                      color: '#7c3aed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px',
                      boxShadow: '0 0 20px rgba(124, 58, 237, 0.2)'
                    }}>
                      <Scan size={28} />
                    </div>
                    <h4 style={{ fontSize: '1.02rem', fontWeight: 800, margin: '0 0 6px', color: 'var(--text-primary)' }}>
                      2D Barcode & QR Gun Scanner Mode
                    </h4>
                    <p style={{ fontSize: '0.80rem', color: 'var(--text-secondary)', margin: '0 0 16px', maxWidth: 420, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
                      Point handheld 2D gun or desktop barcode/QR scanner at the staff member's ID card. The software will instantly record Check-In or Check-Out and send the WhatsApp notification.
                    </p>

                    {/* Quick Select Employee Dropdown */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 380, margin: '0 auto' }}>
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            handleStaffScanSubmit(e.target.value);
                            e.target.value = '';
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '9px 12px',
                          borderRadius: 9,
                          border: '1.5px solid var(--border-color)',
                          background: 'var(--surface-color)',
                          color: 'var(--text-primary)',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          outline: 'none'
                        }}
                      >
                        <option value="">-- Or Quick Select Employee ({staffRoster.length}) --</option>
                        {staffRoster.map(s => (
                          <option key={s.staffId} value={s.staffId}>
                            {s.staffId} - {s.name} ({s.department}) - {s.status.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Right Column: Live Punch Showcase & Recent Activity */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Live Scanned Punch Celebration Card */}
                  {staffLastPunch ? (
                    <motion.div
                      key={staffLastPunch.timestamp}
                      initial={{ scale: 0.92, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      style={{
                        background: 'linear-gradient(135deg, #065f46 0%, #047857 100%)',
                        borderRadius: 18,
                        padding: '22px',
                        color: '#ffffff',
                        boxShadow: '0 12px 30px rgba(4, 120, 87, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16
                      }}
                    >
                      <div style={{
                        width: 64,
                        height: 64,
                        borderRadius: 16,
                        background: 'rgba(255,255,255,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.4rem',
                        fontWeight: 900,
                        border: '2px solid rgba(255,255,255,0.4)',
                        overflow: 'hidden',
                        flexShrink: 0
                      }}>
                        {getInitials(staffLastPunch.staff.name)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          background: 'rgba(255,255,255,0.25)',
                          padding: '3px 10px',
                          borderRadius: 12,
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          marginBottom: 4
                        }}>
                          {staffLastPunch.type === 'IN' ? <LogIn size={13} /> : <LogOut size={13} />}
                          <span>{staffLastPunch.type === 'IN' ? 'CHECKED IN' : 'CHECKED OUT'}</span>
                        </div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 900, margin: '2px 0' }}>
                          {staffLastPunch.staff.name}
                        </h3>
                        <div style={{ fontSize: '0.80rem', opacity: 0.9 }}>
                          Staff ID: <strong>{staffLastPunch.staff.staffId}</strong> • {staffLastPunch.staff.designation || 'Staff'} ({staffLastPunch.staff.department || 'General'})
                        </div>
                        <div style={{ fontSize: '0.76rem', opacity: 0.85, marginTop: 4 }}>
                          Time: <strong>{staffLastPunch.time}</strong> {staffLastPunch.duration ? `• Work: ${staffLastPunch.duration}` : ''} • Instant WhatsApp Alert 📱
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="card" style={{ padding: '28px 20px', borderRadius: 18, border: '1.5px dashed var(--border-color)', textAlign: 'center', background: 'var(--surface-color)' }}>
                      <QrCode size={34} color="#a855f7" style={{ margin: '0 auto 8px', opacity: 0.8 }} />
                      <h4 style={{ fontSize: '0.98rem', fontWeight: 800, margin: '0 0 4px', color: 'var(--text-primary)' }}>
                        Ready to Scan Staff QR Cards
                      </h4>
                      <p style={{ fontSize: '0.80rem', color: 'var(--text-secondary)', margin: 0 }}>
                        Point staff QR ID card at the camera or trigger 2D barcode gun to mark check-in/out instantly.
                      </p>
                    </div>
                  )}

                  {/* Summary Metric Counter */}
                  <div className="card" style={{ padding: '16px 20px', borderRadius: 16, border: '1.5px solid var(--border-color)', background: 'var(--surface-color)', display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Total Employees</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: 2 }}>{staffRoster.length}</div>
                    </div>
                    <div style={{ width: 1, background: 'var(--border-color)' }} />
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>Checked In Today</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#10b981', marginTop: 2 }}>
                        {staffRoster.filter(s => s.status === 'present' || s.entryTime !== '--').length}
                      </div>
                    </div>
                    <div style={{ width: 1, background: 'var(--border-color)' }} />
                    <div>
                      <div style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 700 }}>Unmarked</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#f59e0b', marginTop: 2 }}>
                        {staffRoster.filter(s => s.status !== 'present' && s.entryTime === '--').length}
                      </div>
                    </div>
                  </div>

                  {/* Recent Staff Punches Activity Feed */}
                  <div className="card" style={{ padding: '16px 20px', borderRadius: 16, border: '1.5px solid var(--border-color)', background: 'var(--surface-color)', maxHeight: 260, overflowY: 'auto' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={14} color="#7c3aed" />
                      <span>Recent Staff Punches (Today)</span>
                    </div>

                    {staffRecentPunches.length === 0 ? (
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '12px 0' }}>
                        No scans recorded in this session yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {staffRecentPunches.map((p, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: 8, background: 'var(--bg-color)', fontSize: '0.78rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: 6,
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                background: p.type === 'IN' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                color: p.type === 'IN' ? '#10b981' : '#3b82f6'
                              }}>
                                {p.type}
                              </span>
                              <strong style={{ color: 'var(--text-primary)' }}>{p.staff.name}</strong>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>{p.staff.staffId}</span>
                            </div>
                            <span style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '0.74rem' }}>{p.time}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ========== VIEW 2: 📋 EMPLOYEE ROSTER TABLE & QUICK PUNCH ========== */}
            {staffViewMode === 'roster' && (
              <>
                {/* Quick Punch Bar & Stats */}
                <div className="card" style={{ padding: '18px 22px', background: 'var(--surface-color)', border: '1.5px solid var(--border-color)', borderRadius: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 280 }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <Scan size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input
                          type="text"
                          value={staffScannerCode}
                          onChange={(e) => setStaffScannerCode(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleStaffScanSubmit(staffScannerCode);
                            }
                          }}
                          placeholder="⚡ Quick Punch: Enter Staff ID / Barcode..."
                          style={{
                            width: '100%',
                            padding: '8px 12px 8px 32px',
                            borderRadius: 8,
                            border: '1.5px solid var(--border-color)',
                            background: 'var(--bg-color)',
                            color: 'var(--text-primary)',
                            fontSize: '0.84rem',
                            fontWeight: 700,
                            outline: 'none'
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => handleStaffScanSubmit(staffScannerCode, 'IN')}
                          disabled={!staffScannerCode.trim() || !!staffPunchingId}
                          className="btn btn-sm"
                          style={{
                            padding: '7px 14px',
                            borderRadius: 8,
                            border: 'none',
                            background: '#10b981',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: '0.78rem',
                            cursor: staffScannerCode.trim() ? 'pointer' : 'not-allowed',
                            opacity: staffScannerCode.trim() ? 1 : 0.6
                          }}
                        >
                          Punch IN
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStaffScanSubmit(staffScannerCode, 'OUT')}
                          disabled={!staffScannerCode.trim() || !!staffPunchingId}
                          className="btn btn-sm"
                          style={{
                            padding: '7px 14px',
                            borderRadius: 8,
                            border: 'none',
                            background: '#3b82f6',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: '0.78rem',
                            cursor: staffScannerCode.trim() ? 'pointer' : 'not-allowed',
                            opacity: staffScannerCode.trim() ? 1 : 0.6
                          }}
                        >
                          Punch OUT
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStaffScanSubmit(staffScannerCode, 'AUTO')}
                          disabled={!staffScannerCode.trim() || !!staffPunchingId}
                          className="btn btn-sm"
                          style={{
                            padding: '7px 14px',
                            borderRadius: 8,
                            border: 'none',
                            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: '0.78rem',
                            cursor: staffScannerCode.trim() ? 'pointer' : 'not-allowed',
                            opacity: staffScannerCode.trim() ? 1 : 0.6
                          }}
                        >
                          ⚡ Auto
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setStaffViewMode('scanner')}
                      className="btn btn-secondary btn-sm"
                      style={{
                        padding: '7px 14px',
                        fontSize: '0.80rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        borderColor: '#7c3aed',
                        color: '#7c3aed',
                        fontWeight: 800
                      }}
                    >
                      <Scan size={14} />
                      <span>Open 2D Scanner Gun Desk</span>
                    </button>
                  </div>

                  {/* Staff Stats Cards (Clickable Filter Badges) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginTop: 18 }}>
                    {/* 1. Total Employees */}
                    <div 
                      role="button"
                      tabIndex={0}
                      onClick={() => { setStaffFilter('all'); setStaffDeptFilter('all'); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setStaffFilter('all'); setStaffDeptFilter('all'); } }}
                      title="Click to view all employees"
                      style={{ 
                        background: staffFilter === 'all' && staffDeptFilter === 'all' ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-color)', 
                        padding: '14px 18px', 
                        borderRadius: 14, 
                        border: staffFilter === 'all' && staffDeptFilter === 'all' ? '2px solid #3b82f6' : '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: staffFilter === 'all' && staffDeptFilter === 'all' ? '0 4px 14px rgba(59, 130, 246, 0.2)' : 'none',
                        position: 'relative'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>TOTAL EMPLOYEES</div>
                        {staffFilter === 'all' && staffDeptFilter === 'all' && (
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#3b82f6', background: 'rgba(59, 130, 246, 0.15)', padding: '2px 6px', borderRadius: 6 }}>ACTIVE</span>
                        )}
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: 2 }}>{staffRoster.length}</div>
                      <div style={{ fontSize: '0.70rem', color: '#3b82f6', marginTop: 4, fontWeight: 700 }}>🔍 Click to view all</div>
                    </div>

                    {/* 2. Present Today */}
                    <div 
                      role="button"
                      tabIndex={0}
                      onClick={() => { setStaffFilter(staffFilter === 'present' ? 'all' : 'present'); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setStaffFilter(staffFilter === 'present' ? 'all' : 'present'); } }}
                      title="Click to filter present staff members"
                      style={{ 
                        background: staffFilter === 'present' ? 'rgba(16, 185, 129, 0.14)' : 'var(--bg-color)', 
                        padding: '14px 18px', 
                        borderRadius: 14, 
                        border: staffFilter === 'present' ? '2px solid #10b981' : '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: staffFilter === 'present' ? '0 4px 14px rgba(16, 185, 129, 0.2)' : 'none',
                        position: 'relative'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>PRESENT TODAY</div>
                        {staffFilter === 'present' && (
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 6px', borderRadius: 6 }}>FILTERED</span>
                        )}
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10b981', marginTop: 2 }}>
                        {staffRoster.filter(s => s.status === 'present' || s.entryTime !== '--').length}
                      </div>
                      <div style={{ fontSize: '0.70rem', color: '#10b981', marginTop: 4, fontWeight: 700 }}>
                        {staffFilter === 'present' ? '✓ Showing present only' : '👉 Click to show present'}
                      </div>
                    </div>

                    {/* 3. On Leave / Absent */}
                    <div 
                      role="button"
                      tabIndex={0}
                      onClick={() => { setStaffFilter(staffFilter === 'absent' ? 'all' : 'absent'); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setStaffFilter(staffFilter === 'absent' ? 'all' : 'absent'); } }}
                      title="Click to filter absent/on-leave staff members"
                      style={{ 
                        background: staffFilter === 'absent' ? 'rgba(245, 158, 11, 0.14)' : 'var(--bg-color)', 
                        padding: '14px 18px', 
                        borderRadius: 14, 
                        border: staffFilter === 'absent' ? '2px solid #f59e0b' : '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: staffFilter === 'absent' ? '0 4px 14px rgba(245, 158, 11, 0.2)' : 'none',
                        position: 'relative'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>ON LEAVE / ABSENT</div>
                        {staffFilter === 'absent' && (
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)', padding: '2px 6px', borderRadius: 6 }}>FILTERED</span>
                        )}
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f59e0b', marginTop: 2 }}>
                        {staffRoster.filter(s => s.status !== 'present' && s.entryTime === '--').length}
                      </div>
                      <div style={{ fontSize: '0.70rem', color: '#f59e0b', marginTop: 4, fontWeight: 700 }}>
                        {staffFilter === 'absent' ? '✓ Showing absent only' : '👉 Click to show absent'}
                      </div>
                    </div>

                    {/* 4. Departments */}
                    <div 
                      role="button"
                      tabIndex={0}
                      onClick={() => { setStaffFilter(staffFilter === 'departments' ? 'all' : 'departments'); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setStaffFilter(staffFilter === 'departments' ? 'all' : 'departments'); } }}
                      title="Click to view and filter by departments"
                      style={{ 
                        background: staffFilter === 'departments' || staffDeptFilter !== 'all' ? 'rgba(139, 92, 246, 0.14)' : 'var(--bg-color)', 
                        padding: '14px 18px', 
                        borderRadius: 14, 
                        border: staffFilter === 'departments' || staffDeptFilter !== 'all' ? '2px solid #8b5cf6' : '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: staffFilter === 'departments' || staffDeptFilter !== 'all' ? '0 4px 14px rgba(139, 92, 246, 0.2)' : 'none',
                        position: 'relative'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>DEPARTMENTS</div>
                        {(staffFilter === 'departments' || staffDeptFilter !== 'all') && (
                          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.15)', padding: '2px 6px', borderRadius: 6 }}>
                            {staffDeptFilter !== 'all' ? staffDeptFilter : 'FILTER'}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--accent-blue)', marginTop: 2 }}>
                        {new Set(staffRoster.map(s => s.department || 'General')).size}
                      </div>
                      <div style={{ fontSize: '0.70rem', color: '#8b5cf6', marginTop: 4, fontWeight: 700 }}>
                        {staffDeptFilter !== 'all' ? `Dept: ${staffDeptFilter}` : '👉 Click for department list'}
                      </div>
                    </div>
                  </div>

                  {/* Department Chips Filter Bar (Active when Departments clicked or Dept filter applied) */}
                  {(staffFilter === 'departments' || staffDeptFilter !== 'all') && (
                    <div style={{ marginTop: 14, padding: '12px 16px', background: 'var(--bg-color)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          🏢 Filter by Department:
                        </span>
                        {staffDeptFilter !== 'all' && (
                          <button
                            type="button"
                            onClick={() => setStaffDeptFilter('all')}
                            style={{ border: 'none', background: 'transparent', color: '#ef4444', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer' }}
                          >
                            ✖ Clear Department Filter
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => setStaffDeptFilter('all')}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 20,
                            border: 'none',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            background: staffDeptFilter === 'all' ? 'var(--accent-blue)' : 'var(--surface-color)',
                            color: staffDeptFilter === 'all' ? '#fff' : 'var(--text-secondary)'
                          }}
                        >
                          All ({staffRoster.length})
                        </button>
                        {Array.from(new Set(staffRoster.map(s => s.department || 'General').filter(Boolean))).sort().map(dept => {
                          const count = staffRoster.filter(s => (s.department || 'General') === dept).length;
                          const isSel = staffDeptFilter.toLowerCase() === dept.toLowerCase();
                          return (
                            <button
                              key={dept}
                              type="button"
                              onClick={() => setStaffDeptFilter(isSel ? 'all' : dept)}
                              style={{
                                padding: '4px 10px',
                                borderRadius: 20,
                                border: 'none',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                background: isSel ? '#8b5cf6' : 'var(--surface-color)',
                                color: isSel ? '#fff' : 'var(--text-secondary)',
                                boxShadow: isSel ? '0 2px 6px rgba(139, 92, 246, 0.3)' : 'none'
                              }}
                            >
                              {dept} ({count})
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Staff Attendance Table Card */}
                <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 18, border: '1.5px solid var(--border-color)' }}>
                  <div style={{ padding: '16px 20px', background: 'var(--surface-color)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                        Employee Attendance Roster ({staffDate})
                      </h3>
                      {(staffFilter !== 'all' || staffDeptFilter !== 'all') && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
                            Showing: {staffFilter === 'present' ? 'Present Staff' : staffFilter === 'absent' ? 'Absent Staff' : ''} {staffDeptFilter !== 'all' ? `(${staffDeptFilter})` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => { setStaffFilter('all'); setStaffDeptFilter('all'); }}
                            style={{ border: 'none', background: 'transparent', color: '#ef4444', fontWeight: 800, fontSize: '0.72rem', cursor: 'pointer' }}
                          >
                            ✖ Clear Filter
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => exportStaffAttendanceCsv('present')}
                          className="btn btn-sm"
                          style={{ fontSize: '0.78rem', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}
                          title="Download Present Staff Excel"
                        >
                          <Download size={13} />
                          <span>Present Excel</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => exportStaffAttendanceCsv('absent')}
                          className="btn btn-sm"
                          style={{ fontSize: '0.78rem', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.3)' }}
                          title="Download Absent Staff Excel"
                        >
                          <Download size={13} />
                          <span>Absent Excel</span>
                        </button>
                      </div>

                      <div style={{ position: 'relative', width: 240 }}>
                        <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input
                          type="text"
                          value={staffSearch}
                          onChange={(e) => setStaffSearch(e.target.value)}
                          placeholder="Search employee name or ID..."
                          style={{ width: '100%', padding: '7px 12px 7px 32px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: '0.82rem', outline: 'none' }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="table-container" style={{ margin: 0 }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Staff ID</th>
                          <th>Department</th>
                          <th>Check-In</th>
                          <th>Check-Out</th>
                          <th>Work Duration</th>
                          <th>Status</th>
                          <th>Manual Punch</th>
                        </tr>
                      </thead>
                      <tbody>
                        {staffRoster
                          .filter(st => {
                            // 1. Text Search Filter
                            if (staffSearch) {
                              const q = staffSearch.replace(/^#+/, '').trim().toLowerCase();
                              if (q) {
                                const sname = (st.name || '').toLowerCase();
                                const sid = String(st.staffId || '').replace(/^#+/, '').toLowerCase();
                                const sdept = (st.department || '').toLowerCase();
                                const sdesig = (st.designation || '').toLowerCase();
                                const sphone = String(st.phone || '').toLowerCase();
                                if (!sname.includes(q) && !sid.includes(q) && !sdept.includes(q) && !sdesig.includes(q) && !sphone.includes(q)) return false;
                              }
                            }
                            // 2. Status Badge Filter (Present / Absent)
                            const isPresent = st.status === 'present' || st.entryTime !== '--';
                            if (staffFilter === 'present' && !isPresent) return false;
                            if (staffFilter === 'absent' && isPresent) return false;
                            // 3. Department Filter
                            if (staffDeptFilter !== 'all') {
                              const sdept = st.department || 'General';
                              if (sdept.toLowerCase() !== staffDeptFilter.toLowerCase()) return false;
                            }
                            return true;
                          })
                          .map((st, idx) => {
                            const isPrince = st.staffId === '340';
                            const isPresent = st.status === 'present' || st.entryTime !== '--';
                            const isPunchingIn = staffPunchingId === `${st.staffId}_IN`;
                            const isPunchingOut = staffPunchingId === `${st.staffId}_OUT`;

                            return (
                              <tr
                                key={idx}
                                onClick={() => setSelectedStaffProfile(st)}
                                style={{ background: isPrince ? 'rgba(59, 130, 246, 0.05)' : 'transparent', cursor: 'pointer' }}
                                title="Click to view full staff profile and records"
                              >
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{
                                      width: 36,
                                      height: 36,
                                      borderRadius: '50%',
                                      background: isPrince ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : '#334155',
                                      color: '#ffffff',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontWeight: 800,
                                      fontSize: '0.82rem',
                                      overflow: 'hidden'
                                    }}>
                                      {st.photo ? (
                                        <img src={st.photo} alt={st.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      ) : (
                                        getInitials(st.name)
                                      )}
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: 800, fontSize: '0.90rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {st.name}
                                        {isPrince && (
                                          <span style={{ background: '#3b82f6', color: '#ffffff', fontSize: '0.65rem', padding: '1px 6px', borderRadius: 10, fontWeight: 800 }}>
                                            ⭐ You
                                          </span>
                                        )}
                                      </div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                        {st.designation || 'Faculty'}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.86rem' }}>
                                    {st.staffId}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                    {st.department || 'General'}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ color: st.entryTime !== '--' ? '#10b981' : 'var(--text-secondary)', fontWeight: 700, fontSize: '0.86rem' }}>
                                    {st.entryTime}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ color: st.exitTime !== '--' ? '#3b82f6' : (st.entryTime !== '--' ? '#10b981' : 'var(--text-secondary)'), fontWeight: 700, fontSize: '0.86rem' }}>
                                    {st.exitTime !== '--' ? st.exitTime : (st.entryTime !== '--' ? '🟢 Active IN' : '--')}
                                  </span>
                                </td>
                                <td>
                                  <div>
                                    <span style={{ fontWeight: 700, fontSize: '0.84rem' }}>
                                      {st.workHoursFormatted || '0h 0m'}
                                    </span>
                                    {st.punches && st.punches.filter(p => p.type === 'IN').length > 1 && (
                                      <div style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 700 }}>
                                        {st.punches.filter(p => p.type === 'IN').length} Shifts
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <span style={{
                                    padding: '4px 10px',
                                    borderRadius: 14,
                                    fontSize: '0.74rem',
                                    fontWeight: 800,
                                    background: isPresent ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                    color: isPresent ? '#10b981' : '#ef4444',
                                    border: `1px solid ${isPresent ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                                  }}>
                                    {isPresent ? 'PRESENT' : 'ABSENT'}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <button
                                      type="button"
                                      disabled={isPunchingIn || isPunchingOut}
                                      onClick={() => handleManualStaffPunch(st.staffId, 'IN')}
                                      style={{
                                        padding: '4px 10px',
                                        borderRadius: 6,
                                        border: '1px solid #10b981',
                                        background: isPunchingIn ? '#10b981' : 'rgba(16, 185, 129, 0.12)',
                                        color: isPunchingIn ? '#ffffff' : '#10b981',
                                        fontSize: '0.74rem',
                                        fontWeight: 800,
                                        cursor: isPunchingIn || isPunchingOut ? 'not-allowed' : 'pointer',
                                        opacity: isPunchingIn ? 0.7 : 1,
                                        transition: 'all 0.15s ease'
                                      }}
                                      title="Record Check-In"
                                    >
                                      {isPunchingIn ? '...' : (st.entryTime && st.entryTime !== '--' ? '✓ IN' : 'IN')}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isPunchingIn || isPunchingOut}
                                      onClick={() => handleManualStaffPunch(st.staffId, 'OUT')}
                                      style={{
                                        padding: '4px 10px',
                                        borderRadius: 6,
                                        border: '1px solid #3b82f6',
                                        background: isPunchingOut ? '#3b82f6' : 'rgba(59, 130, 246, 0.12)',
                                        color: isPunchingOut ? '#ffffff' : '#3b82f6',
                                        fontSize: '0.74rem',
                                        fontWeight: 800,
                                        cursor: isPunchingIn || isPunchingOut ? 'not-allowed' : 'pointer',
                                        opacity: isPunchingOut ? 0.7 : 1,
                                        transition: 'all 0.15s ease'
                                      }}
                                      title="Record Check-Out"
                                    >
                                      {isPunchingOut ? '...' : (st.exitTime && st.exitTime !== '--' ? '✓ OUT' : 'OUT')}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* Add Staff Modal */}
            {showAddStaffModal && (
              <div style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(8px)',
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16
              }}>
                <div style={{
                  width: '100%',
                  maxWidth: 500,
                  padding: 28,
                  borderRadius: 22,
                  background: 'var(--surface-color, #ffffff)',
                  border: '1.5px solid var(--border-color, #e2e8f0)',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                  color: 'var(--text-primary, #0f172a)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid var(--border-color, #e2e8f0)', paddingBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Users size={20} color="var(--accent-blue, #3b82f6)" />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>Add New Employee</h3>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Faculty, teacher, or administration staff</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setShowAddStaffModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}>
                      <X size={22} />
                    </button>
                  </div>

                  <form onSubmit={handleSaveStaffMember} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* 📸 Profile Photo Upload Box */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      padding: '12px 16px',
                      borderRadius: 14,
                      background: 'var(--bg-color, #f8fafc)',
                      border: '1.5px dashed var(--border-color, #cbd5e1)'
                    }}>
                      <div style={{ position: 'relative', width: 62, height: 62, flexShrink: 0 }}>
                        {newStaffForm.photo ? (
                          <img
                            src={newStaffForm.photo}
                            alt="Staff Preview"
                            style={{
                              width: 62,
                              height: 62,
                              borderRadius: 14,
                              objectFit: 'cover',
                              border: '2px solid #2563eb',
                              display: 'block'
                            }}
                          />
                        ) : (
                          <div style={{
                            width: 62,
                            height: 62,
                            borderRadius: 14,
                            background: 'rgba(37, 99, 235, 0.1)',
                            color: '#2563eb',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1.5px dashed #3b82f6'
                          }}>
                            <Camera size={20} />
                            <span style={{ fontSize: '0.60rem', fontWeight: 700, marginTop: 2 }}>Photo</span>
                          </div>
                        )}
                        <label
                          htmlFor="new-staff-photo-input"
                          style={{
                            position: 'absolute',
                            bottom: -4,
                            right: -4,
                            background: '#2563eb',
                            color: '#ffffff',
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                            border: '2px solid #ffffff'
                          }}
                          title="Upload Profile Photo"
                        >
                          <Camera size={12} />
                          <input
                            id="new-staff-photo-input"
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handleNewStaffPhotoUpload}
                          />
                        </label>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          Staff Profile Photo (Optional)
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                          Printed directly on Official PVC ID card and kiosk profile.
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                          <label
                            htmlFor="new-staff-photo-input"
                            style={{
                              padding: '4px 10px',
                              borderRadius: 6,
                              background: '#2563eb',
                              color: '#ffffff',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <Camera size={11} />
                            {newStaffForm.photo ? 'Change Photo' : 'Upload Photo'}
                          </label>
                          {newStaffForm.photo && (
                            <button
                              type="button"
                              onClick={() => setNewStaffForm(prev => ({ ...prev, photo: null }))}
                              style={{
                                padding: '4px 10px',
                                borderRadius: 6,
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: '#ef4444',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: 6, color: 'var(--text-primary)' }}>
                        Staff / Biometric User ID *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 340, 101, EMP05"
                        value={newStaffForm.staffId}
                        onChange={(e) => setNewStaffForm({ ...newStaffForm, staffId: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: 10,
                          border: '1.5px solid var(--border-color, #cbd5e1)',
                          background: 'var(--bg-color, #f8fafc)',
                          color: 'var(--text-primary, #0f172a)',
                          fontSize: '0.90rem',
                          fontWeight: 600,
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: 6, color: 'var(--text-primary)' }}>
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Faculty / Staff Name"
                        value={newStaffForm.name}
                        onChange={(e) => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: 10,
                          border: '1.5px solid var(--border-color, #cbd5e1)',
                          background: 'var(--bg-color, #f8fafc)',
                          color: 'var(--text-primary, #0f172a)',
                          fontSize: '0.90rem',
                          fontWeight: 600,
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div>
                        <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: 6, color: 'var(--text-primary)' }}>
                          Department
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Engineering"
                          value={newStaffForm.department}
                          onChange={(e) => setNewStaffForm({ ...newStaffForm, department: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: 10,
                            border: '1.5px solid var(--border-color, #cbd5e1)',
                            background: 'var(--bg-color, #f8fafc)',
                            color: 'var(--text-primary, #0f172a)',
                            fontSize: '0.88rem',
                            fontWeight: 600,
                            outline: 'none'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: 6, color: 'var(--text-primary)' }}>
                          Designation
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Senior Faculty"
                          value={newStaffForm.designation}
                          onChange={(e) => setNewStaffForm({ ...newStaffForm, designation: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: 10,
                            border: '1.5px solid var(--border-color, #cbd5e1)',
                            background: 'var(--bg-color, #f8fafc)',
                            color: 'var(--text-primary, #0f172a)',
                            fontSize: '0.88rem',
                            fontWeight: 600,
                            outline: 'none'
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: 6, color: 'var(--text-primary)' }}>
                        Mobile Phone Number (For WhatsApp / SMS Alerts)
                      </label>
                      <input
                        type="tel"
                        placeholder="e.g. 9876543210 (For Check-In / Out WhatsApp SMS)"
                        value={newStaffForm.phone}
                        onChange={(e) => setNewStaffForm({ ...newStaffForm, phone: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: 10,
                          border: '1.5px solid var(--border-color, #cbd5e1)',
                          background: 'var(--bg-color, #f8fafc)',
                          color: 'var(--text-primary, #0f172a)',
                          fontSize: '0.88rem',
                          fontWeight: 600,
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: 6, color: 'var(--text-primary)' }}>
                        Official Email Address (Optional - For Internal Communications)
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. staff@careerxone.com"
                        value={newStaffForm.email || ''}
                        onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: 10,
                          border: '1.5px solid var(--border-color, #cbd5e1)',
                          background: 'var(--bg-color, #f8fafc)',
                          color: 'var(--text-primary, #0f172a)',
                          fontSize: '0.88rem',
                          fontWeight: 600,
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12, borderTop: '1px solid var(--border-color, #e2e8f0)', paddingTop: 16 }}>
                      <button type="button" onClick={() => setShowAddStaffModal(false)} className="btn btn-secondary" style={{ padding: '8px 18px', fontWeight: 600 }}>
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary" style={{ padding: '8px 22px', fontWeight: 700 }}>
                        Save Employee
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Staff Profile Modal */}
            {selectedStaffProfile && (
              <StaffProfileModal
                staff={selectedStaffProfile}
                onClose={() => setSelectedStaffProfile(null)}
                onStaffUpdated={(updatedMember) => {
                  if (updatedMember) {
                    setSelectedStaffProfile(prev => ({ ...prev, ...updatedMember }));
                  }
                  fetchStaffAttendance(staffDate);
                }}
                onStaffDeleted={() => {
                  setSelectedStaffProfile(null);
                  fetchStaffAttendance(staffDate);
                }}
                onManualPunch={(sid, type) => {
                  handleManualStaffPunch(sid, type);
                  fetchStaffAttendance(staffDate);
                }}
              />
            )}

            {/* Staff Bulk Upload Modal */}
            <StaffBulkUploadModal
              isOpen={showStaffBulkUploadModal}
              onClose={() => setShowStaffBulkUploadModal(false)}
              onSuccess={() => {
                fetchStaffAttendance(staffDate);
              }}
            />
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
                    {todayRecordType === 'student'
                      ? `${dateStr} • ${stats.present + stats.late} of ${activeStudents.length} students present (${stats.percentage}% rate)`
                      : `${dateStr} • ${staffRoster.filter(s => s.status === 'present' || s.entryTime !== '--').length} of ${staffRoster.length} staff present (${staffRoster.length > 0 ? Math.round((staffRoster.filter(s => s.status === 'present' || s.entryTime !== '--').length / staffRoster.length) * 100) : 0}% rate)`}
                  </div>
                </div>

                {/* Student vs Staff Toggle Buttons */}
                <div style={{ display: 'inline-flex', background: 'var(--bg-color)', padding: 4, borderRadius: 12, border: '1px solid var(--border-color)', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => setTodayRecordType('student')}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 8,
                      border: 'none',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: todayRecordType === 'student' ? 'var(--surface-color)' : 'transparent',
                      color: todayRecordType === 'student' ? '#3b82f6' : 'var(--text-secondary)',
                      boxShadow: todayRecordType === 'student' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>🎓 Student Today</span>
                    <span style={{ fontSize: '0.72rem', background: todayRecordType === 'student' ? '#3b82f6' : 'var(--border-color)', color: todayRecordType === 'student' ? '#fff' : 'var(--text-secondary)', padding: '1px 7px', borderRadius: 10 }}>
                      {activeStudents.length}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTodayRecordType('staff')}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 8,
                      border: 'none',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: todayRecordType === 'staff' ? 'var(--surface-color)' : 'transparent',
                      color: todayRecordType === 'staff' ? '#8b5cf6' : 'var(--text-secondary)',
                      boxShadow: todayRecordType === 'staff' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>👥 Staff Today</span>
                    <span style={{ fontSize: '0.72rem', background: todayRecordType === 'staff' ? '#8b5cf6' : 'var(--border-color)', color: todayRecordType === 'staff' ? '#fff' : 'var(--text-secondary)', padding: '1px 7px', borderRadius: 10 }}>
                      {staffRoster.length}
                    </span>
                  </button>
                </div>

                <div className="flex gap-8 items-center flex-wrap">
                  {todayRecordType === 'student' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => exportTodayAttendance('present')}
                        className="btn btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, height: '34px', padding: '0 12px', fontSize: '0.80rem', fontWeight: 700, background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1.5px solid rgba(16, 185, 129, 0.35)' }}
                        title="Download Present Students Excel"
                      >
                        <Download size={14} />
                        <span>Present Excel ({todayTableData.filter(r => r.status === 'present').length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => exportTodayAttendance('absent')}
                        className="btn btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, height: '34px', padding: '0 12px', fontSize: '0.80rem', fontWeight: 700, background: 'rgba(239, 68, 68, 0.10)', color: '#ef4444', border: '1.5px solid rgba(239, 68, 68, 0.35)' }}
                        title="Download Absent Students Excel"
                      >
                        <Download size={14} />
                        <span>Absent Excel ({todayTableData.filter(r => r.status === 'absent').length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => exportTodayAttendance('all')}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, height: '34px', padding: '0 12px', fontSize: '0.80rem', fontWeight: 600 }}
                        title="Download All Students Today Excel"
                      >
                        <Download size={14} />
                        <span>All Students ({todayTableData.length})</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => exportStaffAttendanceCsv('present')}
                        className="btn btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, height: '34px', padding: '0 12px', fontSize: '0.80rem', fontWeight: 700, background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1.5px solid rgba(16, 185, 129, 0.35)' }}
                        title="Download Present Staff Excel"
                      >
                        <Download size={14} />
                        <span>Present Excel ({staffRoster.filter(s => s.status === 'present' || s.entryTime !== '--').length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => exportStaffAttendanceCsv('absent')}
                        className="btn btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, height: '34px', padding: '0 12px', fontSize: '0.80rem', fontWeight: 700, background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', border: '1.5px solid rgba(245, 158, 11, 0.35)' }}
                        title="Download Absent Staff Excel"
                      >
                        <Download size={14} />
                        <span>Absent Excel ({staffRoster.filter(s => s.status !== 'present' && s.entryTime === '--').length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => exportStaffAttendanceCsv('all')}
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, height: '34px', padding: '0 12px', fontSize: '0.80rem', fontWeight: 600 }}
                        title="Download All Staff Excel"
                      >
                        <Download size={14} color="#8b5cf6" />
                        <span>All Staff ({staffRoster.length})</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {todayRecordType === 'student' && (
                <>
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
                      paginatedTodayStudents.map((row, idx) => (
                        <motion.tr
                          key={row.student.id || idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: (idx % (todayPageSize === 'all' ? 25 : todayPageSize)) * 0.02 }}
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
                                <div className={`student-avatar ${getAvatarClass(row.idx || idx)}`}>
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

              {/* Smooth Pagination Footer */}
              {filteredTodayStudents.length > 0 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 20px',
                  borderTop: '1px solid var(--border-color)',
                  background: 'var(--surface-color)',
                  flexWrap: 'wrap',
                  gap: 12
                }}>
                  {/* Left: Summary & Per-Page Selector */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      Showing {todayPageSize === 'all' ? 1 : Math.min((todayPage - 1) * (typeof todayPageSize === 'number' ? todayPageSize : 25) + 1, filteredTodayStudents.length)} to {todayPageSize === 'all' ? filteredTodayStudents.length : Math.min(todayPage * (typeof todayPageSize === 'number' ? todayPageSize : 25), filteredTodayStudents.length)} of <strong style={{ color: 'var(--text-primary)' }}>{filteredTodayStudents.length}</strong> students
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <label style={{ fontSize: '0.80rem', color: 'var(--text-secondary)', fontWeight: 700 }}>Per page:</label>
                      <select
                        value={todayPageSize}
                        onChange={(e) => {
                          const val = e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10);
                          setTodayPageSize(val);
                          setTodayPage(1);
                        }}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 8,
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-color)',
                          color: 'var(--text-primary)',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={250}>250</option>
                        <option value="all">All ({filteredTodayStudents.length})</option>
                      </select>
                    </div>
                  </div>

                  {/* Right: Page Switcher */}
                  {todayPageSize !== 'all' && totalTodayPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setTodayPage(1)}
                        disabled={todayPage === 1}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', fontSize: '0.78rem', cursor: todayPage === 1 ? 'not-allowed' : 'pointer', opacity: todayPage === 1 ? 0.5 : 1 }}
                        title="First Page"
                      >
                        First
                      </button>
                      <button
                        type="button"
                        onClick={() => setTodayPage(prev => Math.max(prev - 1, 1))}
                        disabled={todayPage === 1}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 10px', fontSize: '0.78rem', cursor: todayPage === 1 ? 'not-allowed' : 'pointer', opacity: todayPage === 1 ? 0.5 : 1 }}
                      >
                        <ChevronLeft size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Prev
                      </button>

                      {/* Current Page Info & Jump */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '0 6px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        <span>Page</span>
                        <input
                          type="number"
                          min={1}
                          max={totalTodayPages}
                          value={todayPage}
                          onChange={(e) => {
                            const p = parseInt(e.target.value, 10);
                            if (p >= 1 && p <= totalTodayPages) setTodayPage(p);
                          }}
                          style={{
                            width: 48,
                            padding: '3px 6px',
                            textAlign: 'center',
                            borderRadius: 6,
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-color)',
                            color: 'var(--text-primary)',
                            fontWeight: 800,
                            fontSize: '0.82rem'
                          }}
                        />
                        <span>of {totalTodayPages}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setTodayPage(prev => Math.min(prev + 1, totalTodayPages))}
                        disabled={todayPage === totalTodayPages}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 10px', fontSize: '0.78rem', cursor: todayPage === totalTodayPages ? 'not-allowed' : 'pointer', opacity: todayPage === totalTodayPages ? 0.5 : 1 }}
                      >
                        Next <ChevronRight size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setTodayPage(totalTodayPages)}
                        disabled={todayPage === totalTodayPages}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', fontSize: '0.78rem', cursor: todayPage === totalTodayPages ? 'not-allowed' : 'pointer', opacity: todayPage === totalTodayPages ? 0.5 : 1 }}
                        title="Last Page"
                      >
                        Last
                      </button>
                    </div>
                  )}
                </div>
              )}
                </>
              )}

                {/* Staff Today Record View */}
                {todayRecordType === 'staff' && (
                  <div>
                    {/* Staff Today Filter & Search Bar */}
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
                          onClick={() => setTodayStaffFilter('all')}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '20px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer',
                            background: todayStaffFilter === 'all' ? '#8b5cf6' : 'var(--bg-color)',
                            color: todayStaffFilter === 'all' ? '#ffffff' : 'var(--text-secondary)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          All ({staffRoster.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setTodayStaffFilter('present')}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '20px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer',
                            background: todayStaffFilter === 'present' ? '#10b981' : 'rgba(16, 185, 129, 0.12)',
                            color: todayStaffFilter === 'present' ? '#ffffff' : '#10b981',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          Present ({staffRoster.filter(s => s.status === 'present' || s.entryTime !== '--').length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setTodayStaffFilter('absent')}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '20px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            border: 'none',
                            cursor: 'pointer',
                            background: todayStaffFilter === 'absent' ? '#f59e0b' : 'rgba(245, 158, 11, 0.12)',
                            color: todayStaffFilter === 'absent' ? '#ffffff' : '#f59e0b',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          Absent / On Leave ({staffRoster.filter(s => s.status !== 'present' && s.entryTime === '--').length})
                        </button>
                      </div>

                      {/* Department Filter & Search Bar */}
                      <div className="flex gap-12 items-center flex-wrap">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Department:</span>
                          <select
                            value={todayStaffDept}
                            onChange={(e) => setTodayStaffDept(e.target.value)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 8,
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-color)',
                              color: 'var(--text-primary)',
                              fontSize: '0.80rem',
                              fontWeight: 600,
                              outline: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="all">All Departments ({new Set(staffRoster.map(s => s.department || 'General')).size})</option>
                            {Array.from(new Set(staffRoster.map(s => s.department || 'General').filter(Boolean))).sort().map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </div>

                        <div style={{ position: 'relative', width: 220 }}>
                          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                          <input
                            type="text"
                            value={todayStaffSearch}
                            onChange={(e) => setTodayStaffSearch(e.target.value)}
                            placeholder="Search staff name or ID..."
                            style={{
                              width: '100%',
                              padding: '6px 12px 6px 32px',
                              borderRadius: 8,
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-color)',
                              color: 'var(--text-primary)',
                              fontSize: '0.80rem',
                              outline: 'none'
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Staff Table */}
                    <div className="table-container" style={{ margin: 0 }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Staff Member</th>
                            <th>Staff ID</th>
                            <th>Department</th>
                            <th>Designation</th>
                            <th>Status</th>
                            <th>Entry Time</th>
                            <th>Exit Time</th>
                            <th>Duration</th>
                            <th>Device / Terminal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {staffRoster
                            .filter(st => {
                              // Search
                              if (todayStaffSearch) {
                                const q = todayStaffSearch.replace(/^#+/, '').trim().toLowerCase();
                                const sname = (st.name || '').toLowerCase();
                                const sid = String(st.staffId || '').replace(/^#+/, '').toLowerCase();
                                const sdept = (st.department || '').toLowerCase();
                                const sphone = String(st.phone || '').toLowerCase();
                                if (!sname.includes(q) && !sid.includes(q) && !sdept.includes(q) && !sphone.includes(q)) return false;
                              }
                              // Status
                              const isPresent = st.status === 'present' || st.entryTime !== '--';
                              if (todayStaffFilter === 'present' && !isPresent) return false;
                              if (todayStaffFilter === 'absent' && isPresent) return false;
                              // Department
                              if (todayStaffDept !== 'all') {
                                const sdept = st.department || 'General';
                                if (sdept.toLowerCase() !== todayStaffDept.toLowerCase()) return false;
                              }
                              return true;
                            })
                            .map((st, idx) => {
                              const isPresent = st.status === 'present' || st.entryTime !== '--';
                              const isPrince = String(st.staffId) === '340';
                              const hasPhoto = typeof st.photo === 'string' && st.photo.trim().length > 10;
                              const cleanSN = (st.deviceSN || 'Biomax Device')
                                .replace(/telegram\s*remote/gi, 'Biomax Device')
                                .replace(/telegram/gi, 'Biomax Device');
                              return (
                                <tr 
                                  key={st.staffId || idx}
                                  onClick={() => setSelectedStaffProfile(st)}
                                  style={{ cursor: 'pointer' }}
                                  title="Click to view full staff profile and records"
                                >
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                      <div style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: '50%',
                                        background: isPrince ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : '#334155',
                                        color: '#ffffff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 800,
                                        fontSize: '0.80rem',
                                        overflow: 'hidden',
                                        flexShrink: 0,
                                        border: '1.5px solid var(--border-color)'
                                      }}>
                                        {hasPhoto ? (
                                          <img src={st.photo} alt={st.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                          getInitials(st.name)
                                        )}
                                      </div>
                                      <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                          {st.name}
                                          {isPrince && (
                                            <span style={{ background: '#3b82f6', color: '#ffffff', fontSize: '0.65rem', padding: '1px 6px', borderRadius: 10, fontWeight: 800 }}>
                                              ⭐ You
                                            </span>
                                          )}
                                        </div>
                                        <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{st.phone || 'No phone'}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    <span style={{ fontWeight: 700, color: 'var(--accent-blue)', background: 'rgba(59, 130, 246, 0.08)', padding: '2px 8px', borderRadius: 6, fontSize: '0.78rem' }}>
                                      #{st.staffId}
                                    </span>
                                  </td>
                                  <td style={{ fontSize: '0.82rem', fontWeight: 600 }}>{st.department || 'General'}</td>
                                  <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{st.designation || 'Staff'}</td>
                                  <td>
                                    <span style={{
                                      padding: '3px 10px',
                                      borderRadius: 12,
                                      fontSize: '0.74rem',
                                      fontWeight: 800,
                                      background: isPresent ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                      color: isPresent ? '#10b981' : '#ef4444'
                                    }}>
                                      {isPresent ? 'PRESENT' : 'ABSENT'}
                                    </span>
                                  </td>
                                  <td style={{ fontSize: '0.84rem', fontWeight: 600, color: st.entryTime !== '--' ? '#10b981' : 'var(--text-secondary)' }}>
                                    {st.entryTime || '--'}
                                  </td>
                                  <td style={{ fontSize: '0.84rem', fontWeight: 600, color: st.exitTime !== '--' ? 'var(--accent-blue)' : (st.entryTime !== '--' ? '#10b981' : 'var(--text-secondary)') }}>
                                    {st.exitTime !== '--' ? st.exitTime : (st.entryTime !== '--' ? '🟢 Active IN' : '--')}
                                  </td>
                                  <td style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    <div>
                                      <span>{st.workHoursFormatted || '0h 0m'}</span>
                                      {st.punches && st.punches.filter(p => p.type === 'IN').length > 1 && (
                                        <div style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 700 }}>
                                          {st.punches.filter(p => p.type === 'IN').length} Shifts
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                    {cleanSN}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
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
                    {historyRecordType === 'student' 
                      ? 'Select custom date range (From Date to To Date) or calendar view to analyze and export student records.'
                      : 'Comprehensive attendance logs and historical records for all staff, teachers, and employees.'}
                  </div>
                </div>

                {/* Student vs Staff Toggle Buttons */}
                <div style={{ display: 'inline-flex', background: 'var(--bg-color)', padding: 4, borderRadius: 12, border: '1px solid var(--border-color)', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => setHistoryRecordType('student')}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 8,
                      border: 'none',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: historyRecordType === 'student' ? 'var(--surface-color)' : 'transparent',
                      color: historyRecordType === 'student' ? '#3b82f6' : 'var(--text-secondary)',
                      boxShadow: historyRecordType === 'student' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>🎓 Student History</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryRecordType('staff');
                      fetchStaffHistory();
                    }}
                    style={{
                      padding: '6px 16px',
                      borderRadius: 8,
                      border: 'none',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: historyRecordType === 'staff' ? 'var(--surface-color)' : 'transparent',
                      color: historyRecordType === 'staff' ? '#8b5cf6' : 'var(--text-secondary)',
                      boxShadow: historyRecordType === 'staff' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>👥 Staff History</span>
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {historyRecordType === 'student' ? (
                    <>
                      <button 
                        type="button"
                        onClick={() => { if (typeof refreshAttendance === 'function') refreshAttendance(); toast.success('🔄 Attendance records refreshed!'); }}
                        className="btn btn-secondary" 
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontWeight: 600 }}
                      >
                        <RefreshCw size={15} /> Refresh Records
                      </button>
                      <button 
                        onClick={exportHistoryAttendance} 
                        className="btn btn-secondary" 
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontWeight: 600 }}
                        title="Download Attendance Report in Excel format"
                      >
                        <Download size={16} color="#10b981" /> Download Excel
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        type="button"
                        onClick={() => { fetchStaffHistory(); toast.success('🔄 Staff history refreshed!'); }}
                        className="btn btn-secondary" 
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontWeight: 600 }}
                      >
                        <RefreshCw size={15} className={isStaffHistoryLoading ? 'spin' : ''} /> Refresh Staff History
                      </button>
                      <button 
                        onClick={exportStaffHistoryAttendance} 
                        className="btn btn-secondary" 
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontWeight: 600 }}
                        title="Download Staff Attendance History in Excel/CSV format"
                      >
                        <Download size={16} color="#8b5cf6" /> Download Staff Excel
                      </button>
                    </>
                  )}
                </div>
              </div>

              {historyRecordType === 'student' && (
                <>
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
                </>
              )}

                {/* Staff Attendance History View */}
                {historyRecordType === 'staff' && (
                  <div>
                    {/* Filter Controls Bar */}
                    <div className="card mb-20" style={{ background: 'var(--surface-color, #f8fafc)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color-light)', position: 'relative', zIndex: 100 }}>
                      <div className="flex items-center justify-between flex-wrap gap-12">
                        {/* Select Staff Dropdown */}
                        <div style={{ minWidth: '240px', flex: '1 1 240px' }}>
                          <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                            Select Staff Member:
                          </label>
                          <select
                            value={staffHistoryStaffId}
                            onChange={(e) => setStaffHistoryStaffId(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: 8,
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-color)',
                              color: 'var(--text-primary)',
                              fontSize: '0.84rem',
                              fontWeight: 600,
                              outline: 'none'
                            }}
                          >
                            <option value="all">🌟 All Staff Members ({staffRoster.length})</option>
                            {staffRoster.map(s => (
                              <option key={s.staffId} value={s.staffId}>
                                #{s.staffId} - {s.name} ({s.department || 'General'})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Department Dropdown */}
                        <div style={{ minWidth: '180px', flex: '1 1 180px' }}>
                          <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                            Department:
                          </label>
                          <select
                            value={staffHistoryDept}
                            onChange={(e) => setStaffHistoryDept(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: 8,
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-color)',
                              color: 'var(--text-primary)',
                              fontSize: '0.84rem',
                              fontWeight: 600,
                              outline: 'none'
                            }}
                          >
                            <option value="all">🏢 All Departments</option>
                            {Array.from(new Set(staffRoster.map(s => s.department || 'General').filter(Boolean))).sort().map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </div>

                        {/* Date Range Selection Pills */}
                        <div style={{ flex: '2 1 300px' }}>
                          <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                            Date Selection Mode:
                          </label>
                          <div className="flex items-center gap-2 flex-wrap">
                            {[
                              { id: 'today', label: 'Today' },
                              { id: '7days', label: '7 Days' },
                              { id: '30days', label: '1 Month' },
                              { id: 'custom', label: 'Custom Range' },
                            ].map((pill) => (
                              <button
                                key={pill.id}
                                type="button"
                                className={`btn btn-sm ${staffHistoryRangeType === pill.id ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setStaffHistoryRangeType(pill.id)}
                                style={{ borderRadius: '20px', padding: '5px 12px', fontSize: '0.8rem', fontWeight: staffHistoryRangeType === pill.id ? 700 : 500 }}
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
                          <div className="flex items-center gap-1">
                            {['all', 'present', 'absent'].map(st => (
                              <button
                                key={st}
                                type="button"
                                onClick={() => setStaffHistoryStatusFilter(st)}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: 14,
                                  border: 'none',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  background: staffHistoryStatusFilter === st ? '#8b5cf6' : 'var(--bg-color)',
                                  color: staffHistoryStatusFilter === st ? '#fff' : 'var(--text-secondary)'
                                }}
                              >
                                {st.toUpperCase()}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Custom Date Pickers */}
                      {staffHistoryRangeType === 'custom' && (
                        <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '0.80rem', fontWeight: 600 }}>From:</span>
                            <input
                              type="date"
                              value={staffHistoryStartDate}
                              onChange={(e) => setStaffHistoryStartDate(e.target.value)}
                              style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: '0.82rem' }}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '0.80rem', fontWeight: 600 }}>To:</span>
                            <input
                              type="date"
                              value={staffHistoryEndDate}
                              onChange={(e) => setStaffHistoryEndDate(e.target.value)}
                              style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontSize: '0.82rem' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Stats Overview */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 18 }}>
                      <div style={{ background: 'var(--bg-color)', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>TOTAL LOGGED RECORDS</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: 2 }}>{staffHistoryRecords.length}</div>
                      </div>
                      <div style={{ background: 'var(--bg-color)', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>PRESENT RECORDS</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#10b981', marginTop: 2 }}>
                          {staffHistoryRecords.filter(r => r.status === 'present' || (r.entryTime && r.entryTime !== '--')).length}
                        </div>
                      </div>
                      <div style={{ background: 'var(--bg-color)', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>ABSENT RECORDS</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f59e0b', marginTop: 2 }}>
                          {staffHistoryRecords.filter(r => r.status !== 'present' && (!r.entryTime || r.entryTime === '--')).length}
                        </div>
                      </div>
                      <div style={{ background: 'var(--bg-color)', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)' }}>ATTENDANCE RATE</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--accent-blue)', marginTop: 2 }}>
                          {staffHistoryRecords.length > 0 
                            ? Math.round((staffHistoryRecords.filter(r => r.status === 'present' || (r.entryTime && r.entryTime !== '--')).length / staffHistoryRecords.length) * 100)
                            : 0}%
                        </div>
                      </div>
                    </div>

                    {/* History Table */}
                    <div className="table-container" style={{ margin: 0 }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Staff Member</th>
                            <th>Staff ID</th>
                            <th>Department</th>
                            <th>Designation</th>
                            <th>Status</th>
                            <th>Check-In</th>
                            <th>Check-Out</th>
                            <th>Duration</th>
                            <th>Device</th>
                          </tr>
                        </thead>
                        <tbody>
                          {isStaffHistoryLoading ? (
                            <tr>
                              <td colSpan={10} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                                <RefreshCw className="spin" size={20} style={{ display: 'inline-block', marginRight: 8 }} />
                                Loading staff history records...
                              </td>
                            </tr>
                          ) : staffHistoryRecords.length === 0 ? (
                            <tr>
                              <td colSpan={10} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                                No staff attendance records found for the selected filter and range.
                              </td>
                            </tr>
                          ) : (
                            staffHistoryRecords
                              .filter(r => {
                                if (staffHistoryStatusFilter === 'present') return r.status === 'present' || (r.entryTime && r.entryTime !== '--');
                                if (staffHistoryStatusFilter === 'absent') return r.status !== 'present' && (!r.entryTime || r.entryTime === '--');
                                return true;
                              })
                              .map((r, idx) => {
                                const isPresent = r.status === 'present' || (r.entryTime && r.entryTime !== '--');
                                const cleanStaffId = String(r.staffId || '').replace(/^#+/, '');
                                const matchedStaff = staffRoster.find(s => String(s.staffId).replace(/^#+/, '') === cleanStaffId);
                                const photo = r.photo || matchedStaff?.photo;
                                const isPrince = cleanStaffId === '340';
                                const cleanSN = (r.deviceSN || 'Biomax Device')
                                  .replace(/telegram\s*remote/gi, 'Biomax Device')
                                  .replace(/telegram/gi, 'Biomax Device');
                                return (
                                  <tr 
                                    key={r.id || idx}
                                    onClick={() => matchedStaff && setSelectedStaffProfile(matchedStaff)}
                                    style={{ cursor: matchedStaff ? 'pointer' : 'default' }}
                                    title={matchedStaff ? "Click to view staff profile" : ""}
                                  >
                                    <td style={{ fontWeight: 700, fontSize: '0.84rem' }}>{r.date}</td>
                                    <td>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{
                                          width: 32,
                                          height: 32,
                                          borderRadius: '50%',
                                          background: isPrince ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : '#334155',
                                          color: '#ffffff',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontWeight: 800,
                                          fontSize: '0.76rem',
                                          overflow: 'hidden',
                                          flexShrink: 0,
                                          border: '1px solid var(--border-color)'
                                        }}>
                                          {photo ? (
                                            <img src={photo} alt={r.staffName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                          ) : (
                                            getInitials(r.staffName || 'Staff')
                                          )}
                                        </div>
                                        <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                                          {r.staffName || 'Staff Member'}
                                        </div>
                                      </div>
                                    </td>
                                    <td>
                                      <span style={{ fontWeight: 700, color: 'var(--accent-blue)', background: 'rgba(59, 130, 246, 0.08)', padding: '2px 8px', borderRadius: 6, fontSize: '0.78rem' }}>
                                        #{r.staffId}
                                      </span>
                                    </td>
                                    <td style={{ fontSize: '0.82rem', fontWeight: 600 }}>{r.department || 'General'}</td>
                                    <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{r.designation || 'Staff'}</td>
                                    <td>
                                      <span style={{
                                        padding: '3px 10px',
                                        borderRadius: 12,
                                        fontSize: '0.74rem',
                                        fontWeight: 800,
                                        background: isPresent ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                        color: isPresent ? '#10b981' : '#ef4444'
                                      }}>
                                        {isPresent ? 'PRESENT' : 'ABSENT'}
                                      </span>
                                    </td>
                                    <td style={{ fontSize: '0.84rem', fontWeight: 600, color: r.entryTime !== '--' ? '#10b981' : 'var(--text-secondary)' }}>
                                      {r.entryTime || '--'}
                                    </td>
                                    <td style={{ fontSize: '0.84rem', fontWeight: 600, color: r.exitTime !== '--' ? 'var(--accent-blue)' : 'var(--text-secondary)' }}>
                                      {r.exitTime || '--'}
                                    </td>
                                    <td style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                      {r.workHoursFormatted || '0h 0m'}
                                    </td>
                                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                      {cleanSN}
                                    </td>
                                  </tr>
                                );
                              })
                          )}
                        </tbody>
                      </table>
                    </div>
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
            {/* Top Biometric Machine & Kiosk Control Bar */}
            <div className="card" style={{ padding: '20px 24px', background: 'var(--surface-color)', border: '1.5px solid var(--border-color)', borderRadius: 18, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                {/* Left: Status & Hardware Indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    boxShadow: '0 4px 16px rgba(59, 130, 246, 0.35)'
                  }}>
                    <Fingerprint size={26} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        Biometric Machine & Smart Kiosk
                      </h2>
                      <span style={{
                        background: 'rgba(16, 185, 129, 0.12)',
                        color: '#10b981',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '3px 10px',
                        borderRadius: 20,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5
                      }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} />
                        BIOMAX PUSH ONLINE (Port 8000 & 5000)
                      </span>
                    </div>
                    <p style={{ margin: '3px 0 0', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                      Biomax FK Hardware Connected • Real-Time HTTP Push Active • Instant Live Attendance
                    </p>
                  </div>
                </div>

                {/* Right: Quick Biometric Actions & Mode Switcher */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {/* One-Click Sync Biometric Button */}
                  <button
                    type="button"
                    onClick={() => handleSyncBiometric(biometricStatus.targetIp || '192.168.0.12', 8000)}
                    disabled={isBiometricSyncing}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 10,
                      border: '1.5px solid rgba(59, 130, 246, 0.4)',
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.15) 100%)',
                      color: 'var(--accent-blue)',
                      fontSize: '0.80rem',
                      fontWeight: 800,
                      cursor: isBiometricSyncing ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 2px 8px rgba(59, 130, 246, 0.12)'
                    }}
                  >
                    <RefreshCw size={15} className={isBiometricSyncing ? 'spin' : ''} />
                    <span>{isBiometricSyncing ? 'Syncing Logs...' : '🔄 Sync Machine Logs'}</span>
                  </button>

                  {/* Auto-Sync Toggle Button */}
                  <button
                    type="button"
                    onClick={handleToggleAutoSync}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: `1.5px solid ${biometricStatus.autoSyncEnabled ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-color)'}`,
                      background: biometricStatus.autoSyncEnabled ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-color)',
                      color: biometricStatus.autoSyncEnabled ? '#10b981' : 'var(--text-secondary)',
                      fontSize: '0.80rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                    title="Auto-fetch punches from Biometric Machine every 15 seconds"
                  >
                    <Radio size={15} />
                    <span>{biometricStatus.autoSyncEnabled ? '⚡ Auto-Sync: ON' : '⚡ Auto-Sync: OFF'}</span>
                  </button>

                  {/* Scan Subnet Button */}
                  <button
                    type="button"
                    onClick={handleScanSubnet}
                    disabled={isBiometricScanning}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: '1.5px solid var(--border-color)',
                      background: 'var(--bg-color)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.80rem',
                      fontWeight: 800,
                      cursor: isBiometricScanning ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                    title="Scan local network for any other Biometric Devices"
                  >
                    <Radar size={15} className={isBiometricScanning ? 'spin' : ''} />
                    <span>{isBiometricScanning ? 'Scanning...' : '🔍 Scan Wi-Fi'}</span>
                  </button>

                  {/* Machine Setup Guide Modal Button */}
                  <button
                    type="button"
                    onClick={() => setShowBiometricGuideModal(true)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: '1.5px solid rgba(245, 158, 11, 0.4)',
                      background: 'rgba(245, 158, 11, 0.1)',
                      color: '#f59e0b',
                      fontSize: '0.80rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                    title="View Machine IP & Port Configuration Guide"
                  >
                    <HelpCircle size={15} />
                    <span>Machine Guide</span>
                  </button>

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
                      <span>Smart Auto</span>
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
                      <span>Entry</span>
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
                      <span>Exit</span>
                    </button>
                  </div>

                  {/* Inline Session Selector */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'var(--bg-color)',
                    padding: '4px 10px',
                    borderRadius: 12,
                    border: '1.5px solid var(--border-color)',
                    gap: 6
                  }}>
                    <Clock size={14} color="var(--accent-blue)" />
                    <select
                      value={selectedSessionId}
                      onChange={(e) => setSelectedSessionId(e.target.value)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-primary)',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="auto">✨ Auto Session (By Time)</option>
                      {sessions.map(s => (
                        <option key={s.id || s._id} value={s.id || s._id}>
                          🕒 {s.name} ({s.startTime} - {s.endTime})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Clear Backlog Button */}
                  <button
                    type="button"
                    onClick={handleClearAttendanceBacklog}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: '1.5px solid rgba(239, 68, 68, 0.4)',
                      background: 'rgba(239, 68, 68, 0.08)',
                      color: '#ef4444',
                      fontSize: '0.80rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                    title="Clear old machine backlog attendance from database before today"
                  >
                    <Trash2 size={14} />
                    <span>Clear Backlog</span>
                  </button>

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
                  </button>

                  {/* 4x Biometric & 1-Click Static IP (192.168.0.162) Setup */}
                  <button
                    type="button"
                    onClick={() => {
                      fetchNetworkInfo();
                      setShowBiometricGuideModal(true);
                    }}
                    title="4x Biometric Hardware & Static IP Configurator"
                    style={{
                      padding: '8px 14px',
                      borderRadius: 10,
                      border: networkInfo.isStaticLocked ? '1.5px solid rgba(16, 185, 129, 0.5)' : '1.5px solid rgba(245, 158, 11, 0.5)',
                      background: networkInfo.isStaticLocked
                        ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.15) 100%)'
                        : 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.15) 100%)',
                      color: networkInfo.isStaticLocked ? '#10b981' : '#f59e0b',
                      fontSize: '0.80rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
                    }}
                  >
                    <Fingerprint size={15} />
                    <span>📶 4x Biometric ({networkInfo.wifiSsid || 'CXJEE2'})</span>
                  </button>

                  {/* Print QR ID Cards Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIdCardsModalMode('student');
                      setShowIdCardsModal(true);
                    }}
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
                    <span>🪪 ID Cards</span>
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
                  background: 'var(--surface-color)',
                  border: '1.5px solid var(--border-color)',
                  borderRadius: 20,
                  color: 'var(--text-primary)',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
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
                    background: 'radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, transparent 70%)',
                    pointerEvents: 'none'
                  }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: '0.74rem', fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        LIVE RECEPTION KIOSK TIME
                      </div>
                      <div style={{
                        fontSize: '2.4rem',
                        fontWeight: 900,
                        fontFamily: "'Outfit', monospace, sans-serif",
                        letterSpacing: '-0.02em',
                        color: '#0f172a',
                        textShadow: 'none',
                        marginTop: 2
                      }}>
                        {clockStr}
                      </div>
                      <div style={{ fontSize: '0.88rem', color: '#475569', fontWeight: 600 }}>
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
                <form onSubmit={handleKioskScan} style={{ position: 'relative', zIndex: 120 }}>
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
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setShowKioskSuggestions(false);
                          return;
                        }

                        if (e.key === 'ArrowDown') {
                          if (showKioskSuggestions && kioskSuggestions.length > 0) {
                            e.preventDefault();
                            setActiveSuggestionIndex((prev) => (prev + 1) % kioskSuggestions.length);
                          }
                          return;
                        }

                        if (e.key === 'ArrowUp') {
                          if (showKioskSuggestions && kioskSuggestions.length > 0) {
                            e.preventDefault();
                            setActiveSuggestionIndex((prev) => (prev - 1 + kioskSuggestions.length) % kioskSuggestions.length);
                          }
                          return;
                        }

                        if (e.key === 'Enter') {
                          // If suggestions are visible and user specifically navigated to one with arrow keys
                          if (!isScannerBurstRef.current && showKioskSuggestions && kioskSuggestions.length > 0 && activeSuggestionIndex > 0) {
                            const selected = kioskSuggestions[activeSuggestionIndex];
                            if (selected) {
                              e.preventDefault();
                              handleKioskScan(e, selected);
                              return;
                            }
                          }
                          return;
                        }

                        // Fast hardware QR/barcode scanner burst detection (< 45ms per keystroke)
                        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                          const now = Date.now();
                          const timeDiff = now - lastKioskKeyTimeRef.current;
                          lastKioskKeyTimeRef.current = now;

                          if (timeDiff <= 45) {
                            // Hardware scanner burst: suppress autocomplete dropdown flicker
                            isScannerBurstRef.current = true;
                            setShowKioskSuggestions(false);

                            // If new burst arrives while field had leftover manual text, discard old text
                            if (firstBurstCharRef.current && kioskCode.length > 0 && !kioskCode.startsWith(firstBurstCharRef.current)) {
                              setKioskCode(firstBurstCharRef.current);
                              firstBurstCharRef.current = '';
                            }
                          } else {
                            // Human manual typing: NEVER clear! Let user type full roll numbers & names!
                            firstBurstCharRef.current = e.key;
                            isScannerBurstRef.current = false;
                          }
                        }
                      }}
                      onChange={(e) => {
                        const val = e.target.value;
                        setKioskCode(val);
                        if (!isScannerBurstRef.current && val.trim().length >= 1) {
                          setShowKioskSuggestions(true);
                        } else if (val.trim().length === 0) {
                          setShowKioskSuggestions(false);
                        }
                      }}
                      onFocus={() => {
                        if (!isScannerBurstRef.current && kioskCode.trim().length >= 1) {
                          setShowKioskSuggestions(true);
                        }
                      }}
                      placeholder="Type student name, Roll No (e.g. 101), or flash QR..."
                      autoFocus
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        fontFamily: 'inherit'
                      }}
                    />
                    {kioskCode && (
                      <button
                        type="button"
                        onClick={() => {
                          setKioskCode('');
                          setShowKioskSuggestions(false);
                        }}
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

                  {/* 🔍 LIVE AUTOCOMPLETE SUGGESTION DROPDOWN */}
                  {showKioskSuggestions && kioskCode.trim().length >= 1 && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      right: 0,
                      background: 'var(--surface-color, #ffffff)',
                      border: '1.5px solid var(--border-color, #cbd5e1)',
                      borderRadius: 16,
                      boxShadow: '0 15px 35px rgba(0,0,0,0.18)',
                      zIndex: 1000,
                      overflow: 'hidden',
                      maxHeight: '340px',
                      overflowY: 'auto'
                    }}>
                      <div style={{
                        padding: '8px 14px',
                        background: 'var(--bg-color, #f8fafc)',
                        borderBottom: '1px solid var(--border-color, #e2e8f0)',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        color: 'var(--text-secondary, #64748b)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span>STUDENT MATCHES ({kioskSuggestions.length})</span>
                        <span>Click student or press Enter to Punch</span>
                      </div>

                      {kioskSuggestions.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary, #64748b)', fontSize: '0.86rem' }}>
                          No active students found matching "{kioskCode}"
                        </div>
                      ) : (
                        kioskSuggestions.map((s, idx) => {
                          const todayRec = todayRecords.find(r => r.studentId === s.id);
                          const isCheckedIn = todayRec && todayRec.entryTime && !todayRec.exitTime;
                          const isCompleted = todayRec && todayRec.entryTime && todayRec.exitTime;

                          return (
                            <div
                              key={s.id}
                              onClick={() => handleKioskScan(null, s)}
                              style={{
                                padding: '10px 14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 12,
                                borderBottom: '1px solid var(--border-color-light, #f1f5f9)',
                                cursor: 'pointer',
                                transition: 'background 0.15s ease',
                                background: idx === activeSuggestionIndex ? 'rgba(59, 130, 246, 0.12)' : 'transparent'
                              }}
                              onMouseEnter={() => setActiveSuggestionIndex(idx)}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                                {s.photo ? (
                                  <img src={s.photo} alt={s.name} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
                                ) : (
                                  <div style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                                    color: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 800,
                                    fontSize: '0.78rem'
                                  }}>
                                    {getInitials(s.name)}
                                  </div>
                                )}
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 800, fontSize: '0.90rem', color: 'var(--text-primary, #0f172a)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                                    <span style={{ fontSize: '0.72rem', padding: '1px 7px', borderRadius: 10, background: '#eff6ff', color: '#2563eb', fontWeight: 800, border: '1px solid #bfdbfe', flexShrink: 0 }}>
                                      Roll: {s.rollNo}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary, #64748b)', marginTop: 2 }}>
                                    {s.class || s.batch || s.targetClass || 'General'} {s.phone || s.parentPhone ? `• 📞 ${s.phone || s.parentPhone}` : ''}
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                <span style={{
                                  fontSize: '0.70rem',
                                  padding: '3px 8px',
                                  borderRadius: 12,
                                  fontWeight: 800,
                                  background: isCheckedIn ? 'rgba(16, 185, 129, 0.12)' : isCompleted ? 'rgba(59, 130, 246, 0.12)' : 'rgba(148, 163, 184, 0.15)',
                                  color: isCheckedIn ? '#10b981' : isCompleted ? '#2563eb' : '#64748b'
                                }}>
                                  {isCheckedIn ? '🟢 In Institute' : isCompleted ? '🔵 Exited' : '⚪ Not Checked In'}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleKioskScan(null, s);
                                  }}
                                  style={{
                                    padding: '5px 12px',
                                    borderRadius: 8,
                                    background: '#3b82f6',
                                    color: '#ffffff',
                                    border: 'none',
                                    fontWeight: 800,
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4
                                  }}
                                >
                                  <Zap size={12} />
                                  Punch
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

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
                    onClick={async () => { await fetchBiometricStatus(); if (typeof refreshAttendance === 'function') await refreshAttendance(); toast.success('⚡ Live punch stream refreshed!'); }}
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

            {/* ---------------------------------------------------------------- */}
            {/* 🌐 MODAL: 4x BIOMETRIC & 1-CLICK STATIC IP (192.168.0.162) LOCK  */}
            {/* ---------------------------------------------------------------- */}
            {showBiometricGuideModal && (
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
                  maxWidth: 720,
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  padding: 28,
                  border: '1.5px solid rgba(59, 130, 246, 0.3)',
                  boxShadow: '0 25px 70px rgba(0,0,0,0.6)',
                  position: 'relative'
                }}>
                  <button
                    type="button"
                    onClick={() => setShowBiometricGuideModal(false)}
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
                    <div style={{ padding: 12, borderRadius: 14, background: 'rgba(59, 130, 246, 0.25)', color: '#60a5fa' }}>
                      <Fingerprint size={28} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, color: '#ffffff' }}>
                        🌐 4x Biometric &amp; Wi-Fi IP Configurator
                      </h3>
                      <p style={{ margin: '3px 0 0', fontSize: '0.84rem', color: '#cbd5e1' }}>
                        Auto-bind Static IP <strong style={{ color: '#38bdf8' }}>192.168.0.162</strong> for Career Xone Institute Terminals
                      </p>
                    </div>
                  </div>

                  {/* 🔒 1-Click Wi-Fi & Static IP Lock Banner */}
                  <div style={{
                    background: networkInfo.isStaticLocked
                      ? 'linear-gradient(135deg, rgba(6, 78, 59, 0.5) 0%, rgba(15, 23, 42, 0.9) 100%)'
                      : 'linear-gradient(135deg, rgba(120, 53, 15, 0.5) 0%, rgba(15, 23, 42, 0.9) 100%)',
                    border: networkInfo.isStaticLocked
                      ? '1.5px solid rgba(16, 185, 129, 0.5)'
                      : '1.5px solid rgba(245, 158, 11, 0.5)',
                    borderRadius: 16,
                    padding: '18px 20px',
                    marginBottom: 18
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          display: 'inline-block',
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: networkInfo.isStaticLocked ? '#10b981' : '#f59e0b',
                          boxShadow: networkInfo.isStaticLocked ? '0 0 10px #10b981' : '0 0 10px #f59e0b'
                        }} />
                        <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#ffffff' }}>
                          Wi-Fi: <span style={{ color: '#38bdf8' }}>{networkInfo.wifiSsid || 'CXJEE2'}</span> ({networkInfo.adapterName || 'Wi-Fi'})
                        </span>
                      </div>

                      <span style={{
                        background: networkInfo.isStaticLocked ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        color: networkInfo.isStaticLocked ? '#34d399' : '#fbbf24',
                        padding: '4px 10px',
                        borderRadius: 12,
                        fontSize: '0.76rem',
                        fontWeight: 800
                      }}>
                        {networkInfo.isStaticLocked ? '✅ STATIC IP 192.168.0.162 LOCKED' : '⚠️ DYNAMIC IP DETECTED'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 14, fontSize: '0.84rem' }}>
                      <div style={{ background: 'rgba(0,0,0,0.35)', padding: '8px 12px', borderRadius: 8 }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block' }}>Current PC IP</span>
                        <strong style={{ color: networkInfo.isStaticLocked ? '#34d399' : '#fbbf24', fontFamily: 'monospace' }}>
                          {networkInfo.currentIp || '192.168.0.162'}
                        </strong>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.35)', padding: '8px 12px', borderRadius: 8 }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block' }}>Target Static IP</span>
                        <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>192.168.0.162</strong>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.35)', padding: '8px 12px', borderRadius: 8 }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block' }}>Gateway</span>
                        <strong style={{ color: '#cbd5e1', fontFamily: 'monospace' }}>{networkInfo.gateway || '192.168.0.1'}</strong>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.35)', padding: '8px 12px', borderRadius: 8 }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block' }}>Server Push Port</span>
                        <strong style={{ color: '#34d399', fontFamily: 'monospace' }}>8000 / 5000</strong>
                      </div>
                    </div>

                    {/* 1-Click Action Buttons */}
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={handleLockStaticIp}
                        disabled={isLockingIp}
                        style={{
                          flex: 1,
                          minWidth: 200,
                          padding: '10px 16px',
                          borderRadius: 10,
                          border: 'none',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '0.86rem',
                          cursor: isLockingIp ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                        }}
                      >
                        {isLockingIp ? <RefreshCw size={14} className="spin" /> : <Lock size={14} />}
                        <span>🔒 1-Click Lock Static IP (192.168.0.162)</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleResetDhcp}
                        disabled={isLockingIp}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 10,
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: '#cbd5e1',
                          fontWeight: 700,
                          fontSize: '0.80rem',
                          cursor: isLockingIp ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Reset to DHCP
                      </button>

                      <button
                        type="button"
                        onClick={fetchNetworkInfo}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: '1px solid rgba(59, 130, 246, 0.4)',
                          background: 'rgba(59, 130, 246, 0.1)',
                          color: '#60a5fa',
                          cursor: 'pointer'
                        }}
                        title="Re-check Network"
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  </div>

                  {/* 📟 4x Biometric Machines Live Matrix */}
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 14,
                    padding: '16px 18px',
                    marginBottom: 16
                  }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                      🏢 4x Career Xone Biometric Terminals Status
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
                      {[
                        { name: 'Machine 1 (Main Gate)', ip: '192.168.0.12', port: 71 },
                        { name: 'Machine 2 (Classroom A)', ip: '192.168.0.13', port: 71 },
                        { name: 'Machine 3 (Classroom B)', ip: '192.168.0.14', port: 71 },
                        { name: 'Machine 4 (Staff Room)', ip: '192.168.0.15', port: 71 }
                      ].map((m, idx) => (
                        <div key={idx} style={{
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: 10,
                          padding: '10px 14px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div>
                            <strong style={{ color: '#ffffff', fontSize: '0.84rem', display: 'block' }}>{m.name}</strong>
                            <span style={{ color: '#94a3b8', fontSize: '0.74rem', fontFamily: 'monospace' }}>
                              IP: <span style={{ color: '#38bdf8' }}>{m.ip}</span> • Target: <span style={{ color: '#34d399' }}>192.168.0.162:8000</span>
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleTestDevicePing(m.ip, m.port)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 8,
                              border: '1px solid rgba(59, 130, 246, 0.4)',
                              background: 'rgba(59, 130, 246, 0.15)',
                              color: '#60a5fa',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Test Ping
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ⚙️ Setup Instructions on Machine Screen */}
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 12,
                    padding: '12px 16px',
                    fontSize: '0.80rem',
                    color: '#cbd5e1',
                    lineHeight: 1.6,
                    marginBottom: 16
                  }}>
                    <strong style={{ color: '#ffffff' }}>💡 How it works on another PC / Wi-Fi:</strong>
                    <ol style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                      <li>Connect the PC to Institute Wi-Fi (<strong style={{ color: '#38bdf8' }}>CXJEE2</strong>).</li>
                      <li>Click the green <strong style={{ color: '#34d399' }}>"Lock Static IP (192.168.0.162)"</strong> button above.</li>
                      <li>All 4 Biometric Terminals will immediately start pushing student &amp; staff punches automatically!</li>
                    </ol>
                  </div>

                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setShowBiometricGuideModal(false)}
                      style={{
                        padding: '10px 18px',
                        borderRadius: 10,
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.86rem',
                        cursor: 'pointer'
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Print CSS Injection */}
          </motion.div>
        )}
      </AnimatePresence>

{/* 🪪 ROOT-LEVEL ID CARDS PRINT MODAL (ACCESSIBLE FROM ALL TABS) */}
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
                  background: 'rgba(0, 0, 0, 0.85)',
                  backdropFilter: 'blur(10px)',
                  zIndex: 9999,
                  display: 'flex',
                  alignItems: 'stretch',
                  justifyContent: 'stretch',
                  padding: 0
                }}
              >
                <div
                  className="id-cards-modal-card"
                  style={{
                    background: '#0f172a',
                    borderRadius: 0,
                    width: '100vw',
                    height: '100vh',
                    maxWidth: '100vw',
                    maxHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    border: 'none',
                    boxShadow: 'none',
                    overflow: 'hidden'
                  }}
                >
                  {/* Modal Header */}
                  <div
                    className="id-cards-modal-header"
                    style={{
                      padding: '18px 70px 18px 24px',
                      background: '#1e293b',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 12,
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        padding: 10,
                        borderRadius: 12,
                        background: idCardsModalMode === 'staff' ? 'rgba(220, 38, 38, 0.22)' : 'rgba(139, 92, 246, 0.25)',
                        color: idCardsModalMode === 'staff' ? '#ef4444' : '#a78bfa'
                      }}>
                        <Printer size={24} />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#ffffff' }}>
                          {idCardsModalMode === 'staff' ? 'Print Official Staff & Faculty ID Cards (Front & Back)' : 'Print Official Student ID Cards (Front & Back)'}
                        </h3>
                        <p style={{ margin: '3px 0 0', fontSize: '0.80rem', color: '#cbd5e1', fontWeight: 500 }}>
                          {idCardsModalMode === 'staff'
                            ? 'Official Staff PVC ID cards with photo, scannable Staff ID QR code, designation badge, and terms (A4 sheet ready)'
                            : 'Official ID cards with photo, scannable Roll Number QR code, institute branding, and terms (A4 sheet ready)'}
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
                    </div>

                    {/* Dedicated Extreme Top-Right Close (X) Button */}
                    <button
                      type="button"
                      onClick={() => setShowIdCardsModal(false)}
                      style={{
                        position: 'absolute',
                        top: 14,
                        right: 18,
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        border: '1.5px solid rgba(239, 68, 68, 0.5)',
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#f87171',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        zIndex: 20
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#ef4444';
                        e.currentTarget.style.color = '#ffffff';
                        e.currentTarget.style.transform = 'scale(1.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                        e.currentTarget.style.color = '#f87171';
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                      title="Close (Esc)"
                    >
                      <X size={20} strokeWidth={2.5} />
                    </button>
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
                      {/* Mode Switcher (Students vs Staff) */}
                      <div style={{ display: 'flex', background: '#1e293b', padding: 3, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)' }}>
                        <button
                          type="button"
                          onClick={() => setIdCardsModalMode('student')}
                          style={{
                            padding: '5px 12px',
                            borderRadius: 6,
                            border: 'none',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            background: idCardsModalMode === 'student' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'transparent',
                            color: idCardsModalMode === 'student' ? '#ffffff' : '#94a3b8',
                            boxShadow: idCardsModalMode === 'student' ? '0 2px 8px rgba(99, 102, 241, 0.3)' : 'none'
                          }}
                        >
                          🎓 Students ({activeStudents.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setIdCardsModalMode('staff')}
                          style={{
                            padding: '5px 12px',
                            borderRadius: 6,
                            border: 'none',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            background: idCardsModalMode === 'staff' ? 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)' : 'transparent',
                            color: idCardsModalMode === 'staff' ? '#ffffff' : '#94a3b8',
                            boxShadow: idCardsModalMode === 'staff' ? '0 2px 8px rgba(13, 148, 136, 0.3)' : 'none'
                          }}
                        >
                          👔 Staff ({staffRoster.length})
                        </button>
                      </div>

                      {/* Course/Batch (for Students) OR Department (for Staff) Selector */}
                      {idCardsModalMode === 'staff' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <label style={{ fontSize: '0.80rem', fontWeight: 800, color: '#e2e8f0', letterSpacing: '0.04em' }}>DEPARTMENT:</label>
                          <select
                            value={selectedStaffDept}
                            onChange={(e) => setSelectedStaffDept(e.target.value)}
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
                            <option value="all">🏢 All Departments ({staffRoster.length} Staff)</option>
                            {availableStaffDepts.map((dept) => (
                              <option key={dept} value={dept}>{dept}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
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
                      )}

                      {/* Search Bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 170, flex: 1, maxWidth: 220, position: 'relative' }}>
                        <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 10, pointerEvents: 'none' }} />
                        <input
                          type="text"
                          value={idCardSearch}
                          onChange={(e) => setIdCardSearch(e.target.value)}
                          placeholder={idCardsModalMode === 'staff' ? "Search name, ID, role..." : "Search name / roll..."}
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

                      {/* Cards Per Sheet Density Toggle (Duplex, Front, or Back) */}
                      {['duplex', 'front', 'back'].includes(idCardSide) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', background: '#1e293b', padding: 3, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setIdCardCardsPerPage(4);
                                if (idCardWidth < 230 || idCardHeight < 340) {
                                  handleSizePresetChange('standard');
                                }
                              }}
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
                              onClick={() => {
                                setIdCardCardsPerPage(6);
                                setIdCardRepeatFill(true);
                                if (idCardWidth > 225 || idCardHeight > 330) {
                                  handleSizePresetChange('small');
                                }
                              }}
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

                          {/* 🔁 Repeat Fill Button to fill all 6 slots when staff count < 6 */}
                          {filteredIdCardStudents.length > 0 && filteredIdCardStudents.length < idCardCardsPerPage && (
                            <button
                              type="button"
                              onClick={() => setIdCardRepeatFill(!idCardRepeatFill)}
                              style={{
                                padding: '5px 12px',
                                borderRadius: 8,
                                border: idCardRepeatFill ? '1.5px solid #10b981' : '1px solid rgba(255, 255, 255, 0.22)',
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                background: idCardRepeatFill ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                                color: idCardRepeatFill ? '#34d399' : '#e2e8f0',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                transition: 'all 0.2s ease'
                              }}
                              title="Repeat staff to fill all 6 slots on the A4 sheet for testing/printing"
                            >
                              <span>{idCardRepeatFill ? '✅ All 6 Slots Filled (Repeat Mode)' : '🔁 Fill All 6 Slots (Repeat Staff)'}</span>
                            </button>
                          )}
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
                          ? `${displayedIdCardStudents.length} ${idCardsModalMode === 'staff' ? 'Staff' : 'Students'}${idCardRepeatFill ? ' (Repeat Fill)' : ''} (${Math.ceil(displayedIdCardStudents.length / idCardCardsPerPage)} A4 Sheets / ${Math.ceil(displayedIdCardStudents.length / idCardCardsPerPage) * 2} Pages)`
                          : `Showing ${displayedIdCardStudents.length} ${idCardsModalMode === 'staff' ? 'Staff' : 'Students'}${idCardRepeatFill ? ' (Repeat Fill)' : ''} (${idCardSide === 'both' ? displayedIdCardStudents.length * 2 : displayedIdCardStudents.length} Cards)`}
                      </div>
                    </div>
                  </div>

                  {/* 📏 Secondary Toolbar: ID Card Size & Dimensions Customization Bar */}
                  <div
                    className="id-cards-modal-size-toolbar"
                    style={{
                      padding: '8px 24px',
                      background: '#131d31',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.10)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 14,
                      flexWrap: 'wrap'
                    }}
                  >
                    {/* Left: Size Presets */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.04em' }}>
                        📏 CARD SIZE:
                      </span>
                      <div style={{ display: 'flex', background: '#0b1120', padding: 2, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)' }}>
                        {[
                          { id: 'standard', label: '🌟 Standard PVC', sub: '260×390' },
                          { id: 'compact', label: '📏 Compact A4', sub: '230×355' },
                          { id: 'small', label: '🪪 Pocket Size', sub: '205×315' },
                          { id: 'mini', label: '🤏 Mini Badge', sub: '185×280' },
                          { id: 'custom', label: '⚙️ Custom', sub: `${idCardWidth}×${idCardHeight}` }
                        ].map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSizePresetChange(p.id)}
                            style={{
                              padding: '4px 9px',
                              borderRadius: 6,
                              border: 'none',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              cursor: 'pointer',
                              background: idCardSizePreset === p.id ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
                              color: idCardSizePreset === p.id ? '#ffffff' : '#94a3b8',
                              boxShadow: idCardSizePreset === p.id ? '0 2px 6px rgba(2, 132, 199, 0.35)' : 'none'
                            }}
                            title={`${p.label} (${p.sub}px)`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Middle: Length (Height) and Width numeric controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                      {/* Width Control */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#cbd5e1' }}>
                          ↔️ Width:
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', background: '#0b1120', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', padding: '2px 6px' }}>
                          <input
                            type="number"
                            min="160"
                            max="340"
                            step="5"
                            value={idCardWidth}
                            onChange={(e) => handleWidthChange(e.target.value)}
                            style={{
                              width: 48,
                              background: 'transparent',
                              border: 'none',
                              color: '#38bdf8',
                              fontSize: '0.80rem',
                              fontWeight: 800,
                              textAlign: 'center',
                              outline: 'none'
                            }}
                          />
                          <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>px</span>
                        </div>
                        <span style={{ fontSize: '0.66rem', color: '#94a3b8', fontWeight: 600 }}>
                          (~{(idCardWidth / 3.78).toFixed(1)} mm)
                        </span>
                      </div>

                      {/* Height / Length Control */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#cbd5e1' }}>
                          ↕️ Length:
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', background: '#0b1120', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', padding: '2px 6px' }}>
                          <input
                            type="number"
                            min="240"
                            max="500"
                            step="5"
                            value={idCardHeight}
                            onChange={(e) => handleHeightChange(e.target.value)}
                            style={{
                              width: 48,
                              background: 'transparent',
                              border: 'none',
                              color: '#38bdf8',
                              fontSize: '0.80rem',
                              fontWeight: 800,
                              textAlign: 'center',
                              outline: 'none'
                            }}
                          />
                          <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>px</span>
                        </div>
                        <span style={{ fontSize: '0.66rem', color: '#94a3b8', fontWeight: 600 }}>
                          (~{(idCardHeight / 3.78).toFixed(1)} mm)
                        </span>
                      </div>

                      {/* Lock Ratio Button */}
                      <button
                        type="button"
                        onClick={() => setIdCardLockRatio(!idCardLockRatio)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          border: '1px solid rgba(255,255,255,0.15)',
                          background: idCardLockRatio ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                          color: idCardLockRatio ? '#34d399' : '#f87171',
                          fontSize: '0.70rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                        title={idCardLockRatio ? 'Aspect Ratio Locked (Width & Length scale together)' : 'Aspect Ratio Unlocked (Change Width & Length independently)'}
                      >
                        {idCardLockRatio ? '🔗 Locked' : '🔓 Free'}
                      </button>
                    </div>

                    {/* Right: Scale Slider & Reset */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#cbd5e1' }}>
                          🔍 {idCardScale}%
                        </label>
                        <input
                          type="range"
                          min="60"
                          max="125"
                          step="1"
                          value={idCardScale}
                          onChange={(e) => handleScaleChange(e.target.value)}
                          style={{ width: 75, cursor: 'pointer', accentColor: '#0284c7' }}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleResetCardSize}
                        style={{
                          padding: '3px 7px',
                          borderRadius: 6,
                          border: '1px solid rgba(255,255,255,0.15)',
                          background: '#334155',
                          color: '#ffffff',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                        title="Reset to standard 260px × 390px"
                      >
                        ↺ Reset
                      </button>
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
                            // When 6 cards per sheet is chosen, auto-scale dimensions so 3 rows × 2 columns easily fit standard A4 sheet
                            const effectiveWidth = idCardCardsPerPage === 6 ? Math.min(225, idCardWidth) : idCardWidth;
                            const effectiveHeight = idCardCardsPerPage === 6 ? Math.min(330, idCardHeight) : idCardHeight;
                            const cardWidth = `${effectiveWidth}px`;
                            const cardHeight = `${effectiveHeight}px`;
                            const gridCols = `repeat(2, ${effectiveWidth}px)`;
                            const gridGap = `${Math.max(6, Math.min(20, Math.round(effectiveHeight * 0.035)))}px ${Math.max(12, Math.min(60, Math.round((734 - effectiveWidth * 2) / 2)))}px`;

                            return (
                              <div key={sheetIdx} style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', width: '100%' }}>
                                {/* Front Sheet Container */}
                                <div style={{ width: '100%', maxWidth: '794px' }}>
                                  {/* Screen Header Banner (OUTSIDE .a4-print-sheet) */}
                                  <div
                                    className="a4-print-header-banner"
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
                                    <span>📄 SHEET {sheetIdx + 1} • PAGE {sheetIdx * 2 + 1} — FRONT FACES ({idCardsModalMode === 'staff' ? 'STAFF' : 'STUDENTS'} {sheetIdx * idCardCardsPerPage + 1} TO {sheetIdx * idCardCardsPerPage + chunk.length})</span>
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
                                          <div key={st?._repeatKey || slotIdx} className="a4-card-slot" style={{ display: 'flex', justifyContent: 'center' }}>
                                            {st ? (
                                              idCardsModalMode === 'staff' ? (
                                                <StaffIdCard staff={st} side="front" isCompact={isCompact} customWidth={effectiveWidth} customHeight={effectiveHeight} />
                                              ) : (
                                                <StudentIdCard student={st} side="front" isCompact={isCompact} batches={batches} customWidth={effectiveWidth} customHeight={effectiveHeight} />
                                              )
                                            ) : (
                                              <div
                                                className="print-id-card-empty"
                                                style={{
                                                  width: cardWidth,
                                                  height: cardHeight,
                                                  border: '2px dashed #94a3b8',
                                                  borderRadius: 12,
                                                  background: '#f8fafc',
                                                  display: 'flex',
                                                  flexDirection: 'column',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  gap: 6,
                                                  color: '#64748b',
                                                  padding: 12,
                                                  textAlign: 'center',
                                                  boxSizing: 'border-box'
                                                }}
                                              >
                                                <span style={{ fontSize: '1.6rem' }}>🪪</span>
                                                <span style={{ fontWeight: 800, fontSize: '0.80rem', color: '#1e293b' }}>
                                                  Slot {slotIdx + 1} of {idCardCardsPerPage} (Empty)
                                                </span>
                                                <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                                                  {idCardsModalMode === 'staff'
                                                    ? `Database has ${filteredIdCardStudents.length} staff member${filteredIdCardStudents.length === 1 ? '' : 's'}`
                                                    : 'Slot ready'}
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={() => setIdCardRepeatFill(true)}
                                                  style={{
                                                    marginTop: 4,
                                                    padding: '3px 8px',
                                                    borderRadius: 5,
                                                    border: '1px solid #3b82f6',
                                                    background: 'rgba(59, 130, 246, 0.1)',
                                                    color: '#2563eb',
                                                    fontSize: '0.70rem',
                                                    fontWeight: 800,
                                                    cursor: 'pointer'
                                                  }}
                                                >
                                                  🔁 Fill 6 Cards
                                                </button>
                                              </div>
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
                                    className="a4-print-header-banner"
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
                                          <div key={st?._repeatKey || slotIdx} className="a4-card-slot" style={{ display: 'flex', justifyContent: 'center' }}>
                                            {st ? (
                                              idCardsModalMode === 'staff' ? (
                                                <StaffIdCard staff={st} side="back" isCompact={isCompact} customWidth={effectiveWidth} customHeight={effectiveHeight} />
                                              ) : (
                                                <StudentIdCard student={st} side="back" isCompact={isCompact} batches={batches} customWidth={effectiveWidth} customHeight={effectiveHeight} />
                                              )
                                            ) : (
                                              <div
                                                className="print-id-card-empty"
                                                style={{
                                                  width: cardWidth,
                                                  height: cardHeight,
                                                  border: '2px dashed #94a3b8',
                                                  borderRadius: 12,
                                                  background: '#f8fafc',
                                                  display: 'flex',
                                                  flexDirection: 'column',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  gap: 6,
                                                  color: '#64748b',
                                                  padding: 12,
                                                  textAlign: 'center',
                                                  boxSizing: 'border-box'
                                                }}
                                              >
                                                <span style={{ fontSize: '1.6rem' }}>📜</span>
                                                <span style={{ fontWeight: 800, fontSize: '0.80rem', color: '#1e293b' }}>
                                                  Slot {slotIdx + 1} of {idCardCardsPerPage} (Empty Back)
                                                </span>
                                              </div>
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

                      {/* ================= MODES 2 & 3: FRONT ONLY OR BACK ONLY A4 SHEETS ================= */}
                      {(idCardSide === 'front' || idCardSide === 'back') && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 36, alignItems: 'center' }}>
                          {Array.from({ length: Math.ceil(displayedIdCardStudents.length / idCardCardsPerPage) }).map((_, sheetIdx) => {
                            const chunk = displayedIdCardStudents.slice(sheetIdx * idCardCardsPerPage, sheetIdx * idCardCardsPerPage + idCardCardsPerPage);
                            const isCompact = idCardCardsPerPage === 6;
                            // When 6 cards per sheet is chosen, auto-scale dimensions so 3 rows × 2 columns easily fit standard A4 sheet
                            const effectiveWidth = idCardCardsPerPage === 6 ? Math.min(225, idCardWidth) : idCardWidth;
                            const effectiveHeight = idCardCardsPerPage === 6 ? Math.min(330, idCardHeight) : idCardHeight;
                            const cardWidth = `${effectiveWidth}px`;
                            const cardHeight = `${effectiveHeight}px`;
                            const gridCols = `repeat(2, ${effectiveWidth}px)`;
                            const gridGap = `${Math.max(6, Math.min(20, Math.round(effectiveHeight * 0.035)))}px ${Math.max(12, Math.min(60, Math.round((734 - effectiveWidth * 2) / 2)))}px`;

                            return (
                              <div key={sheetIdx} style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', width: '100%' }}>
                                <div style={{ width: '100%', maxWidth: '794px' }}>
                                  <div
                                    className="a4-print-header-banner"
                                    style={{
                                      background: idCardSide === 'front' ? 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)' : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
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
                                    <span>{idCardSide === 'front' ? '📄' : '📜'} SHEET {sheetIdx + 1} — {idCardSide === 'front' ? 'FRONT FACES' : 'BACK FACES'} ({idCardsModalMode === 'staff' ? 'STAFF' : 'STUDENTS'} {sheetIdx * idCardCardsPerPage + 1} TO {Math.min(filteredIdCardStudents.length, sheetIdx * idCardCardsPerPage + idCardCardsPerPage)})</span>
                                    <span style={{ fontSize: '0.72rem', opacity: 0.9 }}>{idCardCardsPerPage} Cards / Sheet ({idCardSide === 'front' ? 'Front Side' : 'Back Side'})</span>
                                  </div>

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
                                          <div key={st?._repeatKey || slotIdx} className="a4-card-slot" style={{ display: 'flex', justifyContent: 'center' }}>
                                            {st ? (
                                              idCardsModalMode === 'staff' ? (
                                                <StaffIdCard staff={st} side={idCardSide} isCompact={isCompact} customWidth={effectiveWidth} customHeight={effectiveHeight} />
                                              ) : (
                                                <StudentIdCard student={st} side={idCardSide} isCompact={isCompact} batches={batches} customWidth={effectiveWidth} customHeight={effectiveHeight} />
                                              )
                                            ) : (
                                              <div
                                                className="print-id-card-empty"
                                                style={{
                                                  width: cardWidth,
                                                  height: cardHeight,
                                                  border: '2px dashed #94a3b8',
                                                  borderRadius: 12,
                                                  background: '#f8fafc',
                                                  display: 'flex',
                                                  flexDirection: 'column',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  gap: 6,
                                                  color: '#64748b',
                                                  padding: 12,
                                                  textAlign: 'center',
                                                  boxSizing: 'border-box'
                                                }}
                                              >
                                                <span style={{ fontSize: '1.6rem' }}>🪪</span>
                                                <span style={{ fontWeight: 800, fontSize: '0.80rem', color: '#1e293b' }}>
                                                  Slot {slotIdx + 1} of {idCardCardsPerPage} (Empty)
                                                </span>
                                                <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                                                  {idCardsModalMode === 'staff'
                                                    ? `Database has ${filteredIdCardStudents.length} staff member${filteredIdCardStudents.length === 1 ? '' : 's'}`
                                                    : 'Slot ready'}
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={() => setIdCardRepeatFill(true)}
                                                  style={{
                                                    marginTop: 4,
                                                    padding: '3px 8px',
                                                    borderRadius: 5,
                                                    border: '1px solid #3b82f6',
                                                    background: 'rgba(59, 130, 246, 0.1)',
                                                    color: '#2563eb',
                                                    fontSize: '0.70rem',
                                                    fontWeight: 800,
                                                    cursor: 'pointer'
                                                  }}
                                                >
                                                  🔁 Fill 6 Cards
                                                </button>
                                              </div>
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

                      {/* ================= MODE 4: BOTH (PAIRS PREVIEW) ================= */}
                      {idCardSide === 'both' && (
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
                              key={st.id || st.staffId}
                              className="print-id-card-pair"
                              style={{
                                display: 'flex',
                                gap: 20,
                                flexWrap: 'wrap',
                                justifyContent: 'center',
                                alignItems: 'flex-start'
                              }}
                            >
                              {idCardsModalMode === 'staff' ? (
                                <>
                                  <StaffIdCard staff={st} side="front" isCompact={false} customWidth={idCardWidth} customHeight={idCardHeight} />
                                  <StaffIdCard staff={st} side="back" isCompact={false} customWidth={idCardWidth} customHeight={idCardHeight} />
                                </>
                              ) : (
                                <>
                                  <StudentIdCard student={st} side="front" isCompact={false} batches={batches} customWidth={idCardWidth} customHeight={idCardHeight} />
                                  <StudentIdCard student={st} side="back" isCompact={false} batches={batches} customWidth={idCardWidth} customHeight={idCardHeight} />
                                </>
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
                  grid-template-columns: repeat(2, auto) !important;
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
                .print-id-card-wrapper {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                  display: inline-block !important;
                }
                .print-id-card {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                  box-shadow: none !important;
                  border: 2px solid #2563eb !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .print-id-card.print-staff-id-card,
                .print-id-card.print-staff-id-card-back {
                  border: 2px solid #cc0000 !important;
                }
                .print-id-card-empty {
                  visibility: hidden !important;
                  border: none !important;
                  background: transparent !important;
                }
              }
            `}</style>
    </div>
  );
}
