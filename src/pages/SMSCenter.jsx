import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Select from 'react-select';
import {
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  FileText,
  Search,
  X,
  Filter,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Phone,
  AlertCircle,
  RefreshCw,
  QrCode,
  Wifi,
  WifiOff,
  Trash2,
  Paperclip,
  Image as ImageIcon,
  Info,
  ArrowUpRight,
  Download,
  Bot,
  Sparkles,
  Smartphone,
  Check,
  Play,
  Pause,
  Zap,
  Sliders,
  SlidersHorizontal,
  History,
  Eye,
  User,
  Copy,
  PhoneCall
} from 'lucide-react';
import VoiceCallerSimulator from '../components/VoiceCallerSimulator';
import { useApp } from '../context/AppContext';
import { api, API_BASE } from '../utils/api';
import * as XLSX from 'xlsx';
import { getRelativeTime } from '../utils/helpers';
import toast from 'react-hot-toast';

const PAGE_SIZE = 50;

const typeBadgeMap = {
  'attendance-entry': { className: 'badge badge-success', label: 'ENTRY' },
  'attendance-exit': { className: 'badge badge-warning', label: 'EXIT' },
  attendance: { className: 'badge badge-success', label: 'ATTENDANCE' },
  absent: { className: 'badge badge-danger', label: 'ABSENT' },
  welcome: { className: 'badge badge-purple', label: 'WELCOME' },
  'test-result': { className: 'badge badge-info', label: 'RESULT' },
  custom: { className: 'badge badge-purple', label: 'CUSTOM' },
};

const typeFilterOptions = [
  { value: 'all', label: 'All Types' },
  { value: 'attendance-entry', label: 'Entry Alerts' },
  { value: 'attendance-exit', label: 'Exit Alerts' },
  { value: 'absent', label: 'Absent Alerts' },
  { value: 'test-result', label: 'Test Results' },
  { value: 'welcome', label: 'Welcome / Passwords' },
  { value: 'custom', label: 'Custom SMS' },
];

export default function SMSCenter() {
  const { students = [], smsHistory = [], setSMSHistory, sendManualSMS, sendBulkManualSMS, deleteSMS, deleteBulkSMS, deleteAllSMS } = useApp();

  // WhatsApp Local Client State
  const [whatsappStatus, setWhatsappStatus] = useState('offline');
  const [whatsappInfo, setWhatsappInfo] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);

  // Multi-select & Bulk Delete State
  const [selectedSmsIds, setSelectedSmsIds] = useState(new Set());
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(null); // { type: 'single'|'bulk'|'all', id?: string, count: number }

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState('all');
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [sending, setSending] = useState(false);

  // Filter / search state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Tab Management ('logs' | 'bot' | 'voice')
  const [activeTab, setActiveTab] = useState(() => {
    try {
      return localStorage.getItem('cx_smscenter_tab') || 'logs';
    } catch {
      return 'logs';
    }
  });

  const [outboundMessagingActive, setOutboundMessagingActive] = useState(true);

  // Fetch persistent outbound messaging status on mount
  useEffect(() => {
    fetch(`${API_BASE}/whatsapp/outbound-status`)
      .then(res => res.json())
      .then(data => {
        if (typeof data.enabled === 'boolean') {
          setOutboundMessagingActive(data.enabled);
        }
      })
      .catch(() => {});
  }, []);

  const handleToggleOutboundMessaging = async () => {
    const nextVal = !outboundMessagingActive;
    setOutboundMessagingActive(nextVal);
    try {
      await fetch(`${API_BASE}/whatsapp/outbound-toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextVal })
      });
      if (nextVal) {
        toast.success('🟢 Automated WhatsApp Messaging ACTIVATED!');
      } else {
        toast('⏸️ Automated WhatsApp Messaging PAUSED (No alerts will be sent)', { icon: '⏸️' });
      }
    } catch (e) {
      toast.error('Failed to update messaging toggle');
    }
  };

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    try {
      localStorage.setItem('cx_smscenter_tab', tab);
    } catch {}
  };

  // WhatsApp Parent Auto-Reply Bot State
  const [botConfig, setBotConfig] = useState({
    enabled: true,
    coachingName: 'Career Xone',
    welcomeHeader: 'Namaste! Welcome to Career Xone Automated Student Assistant.',
    enableAttendance: true,
    enableMarks: true,
    enableTimetable: true,
    enableReport: true,
    enableHelp: true,
    customFaqs: []
  });
  const [botLogs, setBotLogs] = useState([]);
  const [savingBot, setSavingBot] = useState(false);
  const [selectedBotChatContact, setSelectedBotChatContact] = useState(null);
  const [botSearchQuery, setBotSearchQuery] = useState('');
  const [simulatorMode, setSimulatorMode] = useState('student'); // 'student' | 'guest'
  const [simulatorStudentId, setSimulatorStudentId] = useState('');
  const [simulatorLoading, setSimulatorLoading] = useState(false);
  const [previewSimulatorInput, setPreviewSimulatorInput] = useState('');
  const [previewChatMessages, setPreviewChatMessages] = useState([
    { from: 'parent', text: 'Hi', time: '10:30 AM' },
    { from: 'bot', text: '👋 *Namaste & Welcome to Career Xone AI Assistant!*\n\nLive interactive test environment is connected directly to the Backend NLP AI Engine. Send any message or click quick buttons above to test live AI responses.', time: '10:30 AM' }
  ]);

  // Group botLogs by phone number into conversations
  const groupedBotChats = useMemo(() => {
    const map = new Map();
    for (const log of botLogs) {
      const key = log.phone || 'Unknown';
      if (!map.has(key)) {
        map.set(key, {
          phone: key,
          studentName: log.studentName || 'Unknown / Guest',
          rollNo: log.rollNo || '--',
          lastTimestamp: log.timestamp,
          lastQuery: log.incomingText,
          lastReply: log.botReply,
          totalInteractions: 0,
          logs: []
        });
      }
      const entry = map.get(key);
      entry.totalInteractions++;
      entry.logs.push(log);
    }
    const list = Array.from(map.values()).sort((a, b) => new Date(b.lastTimestamp) - new Date(a.lastTimestamp));
    if (!botSearchQuery.trim()) return list;
    const q = botSearchQuery.toLowerCase().trim();
    return list.filter(c => 
      c.phone.toLowerCase().includes(q) || 
      c.studentName.toLowerCase().includes(q) || 
      c.rollNo.toLowerCase().includes(q)
    );
  }, [botLogs, botSearchQuery]);

  // SMS Export State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDateRange, setExportDateRange] = useState({
    from: new Date().toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  // ⚡ Live Real-time Polling for SMS Logs & Status
  useEffect(() => {
    let isMounted = true;
    const fetchLatestSMSLogs = async () => {
      try {
        const freshLogs = await api.getSMSLogs();
        if (isMounted && Array.isArray(freshLogs) && setSMSHistory) {
          setSMSHistory(freshLogs);
        }
      } catch (err) {
        // Background poll silent
      }
    };

    fetchLatestSMSLogs(); // Initial immediate load
    const logsInterval = setInterval(fetchLatestSMSLogs, 3000); // Live poll every 3s
    return () => {
      isMounted = false;
      clearInterval(logsInterval);
    };
  }, [setSMSHistory]);

  useEffect(() => {
    const fetchWhatsAppStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/whatsapp/local-status`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setWhatsappStatus(data.status);
        setQrCode(data.qrCode);
        setWhatsappInfo(data.info || null);
      } catch (err) {
        setWhatsappStatus('offline');
        setQrCode(null);
        setWhatsappInfo(null);
      }
    };

    fetchWhatsAppStatus();
    const interval = setInterval(fetchWhatsAppStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  // 🤖 Poll Bot Config & Interaction Logs
  useEffect(() => {
    let isMounted = true;
    const fetchBotData = async () => {
      try {
        const config = await api.getWhatsAppBotConfig();
        if (isMounted && config) setBotConfig(config);
        const logs = await api.getWhatsAppBotLogs();
        if (isMounted && Array.isArray(logs)) setBotLogs(logs);
      } catch (err) {}
    };

    fetchBotData();
    const botInterval = setInterval(fetchBotData, 4000);
    return () => {
      isMounted = false;
      clearInterval(botInterval);
    };
  }, []);

  const handleToggleBot = async () => {
    const updated = { ...botConfig, enabled: !botConfig.enabled };
    setBotConfig(updated);
    try {
      await api.saveWhatsAppBotConfig(updated);
      toast.success(updated.enabled ? '🤖 WhatsApp Bot Enabled!' : '⏸️ WhatsApp Bot Paused');
    } catch (err) {
      toast.error('Failed to update bot status: ' + err.message);
    }
  };

  const handleUpdateBotSetting = async (key, val) => {
    const updated = { ...botConfig, [key]: val };
    setBotConfig(updated);
    try {
      await api.saveWhatsAppBotConfig(updated);
      toast.success('Settings Saved', { id: 'bot-setting-saved' });
    } catch (err) {
      toast.error('Failed to save: ' + err.message);
    }
  };

  const handleSimulatorSend = async (customText = null) => {
    const textToSend = typeof customText === 'string' ? customText : previewSimulatorInput;
    if (!textToSend || !textToSend.trim()) return;
    const q = textToSend.trim();
    const timeNow = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    setPreviewChatMessages(prev => [
      ...prev,
      { from: 'parent', text: q, time: timeNow }
    ]);
    setPreviewSimulatorInput('');
    setSimulatorLoading(true);

    try {
      const activeStudent = students.find(s => String(s.id) === String(simulatorStudentId) || String(s._id) === String(simulatorStudentId)) || students[0];
      const res = await api.simulateWhatsAppBotMessage({
        query: q,
        isGuest: simulatorMode === 'guest',
        studentId: activeStudent ? (activeStudent.id || activeStudent._id) : null
      });
      if (res && res.reply) {
        setPreviewChatMessages(prev => [
          ...prev,
          { 
            from: 'bot', 
            text: res.reply, 
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            studentName: res.studentName
          }
        ]);
      }
    } catch (err) {
      setPreviewChatMessages(prev => [
        ...prev,
        { from: 'bot', text: `⚠️ Simulation Error: ${err.message}`, time: timeNow }
      ]);
    } finally {
      setSimulatorLoading(false);
    }
  };

  useEffect(() => {
    if (whatsappStatus === 'ready') {
      setShowQrModal(false);
      toast.success('WhatsApp Connected Successfully!', { id: 'wa-connected' });
    } else if (whatsappStatus === 'qr' && qrCode) {
      setShowQrModal(true);
    }
  }, [whatsappStatus, qrCode]);

  const initializeWhatsApp = async () => {
    if (loadingAction || whatsappStatus === 'connecting') return;
    setLoadingAction(true);
    try {
      setWhatsappStatus('connecting');
      await fetch(`${API_BASE}/whatsapp/local-initialize`, { method: 'POST' });
      toast.success('Initializing WhatsApp Client...');
      setTimeout(async () => {
        try {
          const res = await fetch(`${API_BASE}/whatsapp/local-status`);
          const data = await res.json();
          setWhatsappStatus(data.status);
          setQrCode(data.qrCode);
          setWhatsappInfo(data.info || null);
        } catch (e) {}
      }, 1000);
    } catch (err) {
      toast.error('Failed to connect to local OMR server');
      setWhatsappStatus('offline');
    } finally {
      setLoadingAction(false);
    }
  };

  const disconnectWhatsApp = async () => {
    if (!window.confirm('Are you sure you want to disconnect and log out from WhatsApp?')) return;
    setLoadingAction(true);
    try {
      await fetch(`${API_BASE}/whatsapp/local-disconnect`, { method: 'POST' });
      toast.success('WhatsApp disconnected.');
      setWhatsappStatus('disconnected');
      setQrCode(null);
    } catch (err) {
      toast.error('Failed to disconnect');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size should be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result.split(',')[1];
      setAttachment({
        filename: file.name,
        mimetype: file.type,
        data: base64String,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleExportSMS = () => {
    try {
      const fromD = new Date(exportDateRange.from);
      fromD.setHours(0, 0, 0, 0);
      const toD = new Date(exportDateRange.to);
      toD.setHours(23, 59, 59, 999);

      const filteredData = (smsHistory || []).filter(sms => {
        let smsD = new Date(sms.timestamp);
        if (isNaN(smsD.getTime())) {
          smsD = sms.createdAt ? new Date(sms.createdAt) : new Date();
        }
        return smsD >= fromD && smsD <= toD;
      });

      if (filteredData.length === 0) {
        toast.error('No SMS found in this date range');
        return;
      }

      const excelData = filteredData.map(sms => ({
        'Student Name': getStudentName(sms.studentId),
        'Parent Phone': sms.parentPhone,
        'Type': sms.type ? sms.type.toUpperCase() : 'SMS',
        'Message': sms.message,
        'Status': sms.status,
        'Date & Time': (() => {
          let d = new Date(sms.timestamp);
          if (isNaN(d.getTime())) {
            d = sms.createdAt ? new Date(sms.createdAt) : new Date();
            return `${d.toLocaleDateString()} ${sms.timestamp}`;
          }
          return d.toLocaleString();
        })(),
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'SMS Logs');
      XLSX.writeFile(workbook, `SMS_Logs_${exportDateRange.from}_to_${exportDateRange.to}.xlsx`);
      
      toast.success(`Exported ${filteredData.length} logs successfully`);
      setShowExportModal(false);
    } catch (err) {
      toast.error('Failed to export SMS: ' + err.message);
    }
  };

  // Stats
  const stats = useMemo(() => {
    const total = smsHistory.length;
    const delivered = smsHistory.filter((s) => s.status === 'delivered').length;
    const attendanceSMS = smsHistory.filter(
      (s) => s.type && s.type.includes('attendance')
    ).length;
    const testResultSMS = smsHistory.filter(
      (s) => s.type === 'test-result'
    ).length;
    return { total, delivered, attendanceSMS, testResultSMS };
  }, [smsHistory]);

  // Filtered SMS history
  const filteredHistory = useMemo(() => {
    let list = [...smsHistory];

    if (typeFilter !== 'all') {
      list = list.filter((s) => s.type === typeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((sms) => {
        const student = students.find((st) => st.id === sms.studentId);
        const studentName = student ? student.name.toLowerCase() : '';
        return (
          studentName.includes(q) ||
          (sms.message && sms.message.toLowerCase().includes(q)) ||
          (sms.parentPhone && sms.parentPhone.includes(q))
        );
      });
    }

    return list;
  }, [smsHistory, typeFilter, searchQuery, students]);

  const studentOptions = useMemo(() => {
    const opts = students.filter(s => s.status === 'active').map(s => ({
      value: s.id,
      label: `${s.name} - ${s.parentPhone} (Roll: ${s.rollNo})`
    }));
    return [{ value: 'all', label: '📢 All Students (Bulk SMS)' }, ...opts];
  }, [students]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE));
  const paginatedHistory = filteredHistory.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Multi-select helpers
  const isAllPageSelected = useMemo(() => {
    if (paginatedHistory.length === 0) return false;
    return paginatedHistory.every((sms) => selectedSmsIds.has(sms._id || sms.id));
  }, [paginatedHistory, selectedSmsIds]);

  const toggleSelectAll = () => {
    const next = new Set(selectedSmsIds);
    if (isAllPageSelected) {
      paginatedHistory.forEach((sms) => next.delete(sms._id || sms.id));
    } else {
      paginatedHistory.forEach((sms) => next.add(sms._id || sms.id));
    }
    setSelectedSmsIds(next);
  };

  const toggleSelectRow = (smsId, e) => {
    e.stopPropagation();
    const next = new Set(selectedSmsIds);
    if (next.has(smsId)) {
      next.delete(smsId);
    } else {
      next.add(smsId);
    }
    setSelectedSmsIds(next);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmModal) return;
    const { type, id } = deleteConfirmModal;
    try {
      if (type === 'single' && id) {
        await deleteSMS(id);
      } else if (type === 'bulk' && selectedSmsIds.size > 0) {
        await deleteBulkSMS(Array.from(selectedSmsIds));
        setSelectedSmsIds(new Set());
      } else if (type === 'all') {
        await deleteAllSMS();
        setSelectedSmsIds(new Set());
      }
    } catch (err) {
      toast.error('Failed to delete SMS: ' + (err.message || 'Server error'));
    } finally {
      setDeleteConfirmModal(null);
    }
  };

  // Reset to page 1 on filter change
  const handleTypeFilter = (val) => {
    setTypeFilter(val);
    setCurrentPage(1);
  };
  const handleSearch = (val) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  // Get student name by id
  const getStudentName = (studentId) => {
    const student = (students || []).find((s) => s.id === studentId);
    return student ? student.name : 'Unknown';
  };

  // Send handler
  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message!');
      return;
    }

    setSending(true);
    try {
      if (selectedStudent === 'all') {
        const activeIds = (students || [])
          .filter((s) => s.status === 'active')
          .map((s) => s.id);
        await sendBulkManualSMS(activeIds, message, attachment);
      } else {
        await sendManualSMS(selectedStudent, message, attachment);
      }
      setMessage('');
      setAttachment(null);
      setSelectedStudent('all');
      setShowModal(false);
    } catch (err) {
      toast.error('Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  return (
    <div className="page-container">
      {/* Header */}
      <motion.div
        className="page-header flex items-center justify-between"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div>
          <h1>📱 SMS Center</h1>
          <p>Track all parent notifications & AI automated assistant</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowModal(true)}
        >
          <Send size={16} />
          Send Custom SMS
        </button>
      </motion.div>

      {/* Primary Top Navigation Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        background: 'var(--bg-secondary)',
        padding: '6px',
        borderRadius: '14px',
        border: '1px solid var(--border-color)',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* 1. Primary Tab: Outbound Logs */}
          <button
            onClick={() => handleTabSwitch('logs')}
            style={{
              padding: '10px 22px',
              borderRadius: '10px',
              border: 'none',
              fontWeight: 800,
              fontSize: '0.92rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: activeTab === 'logs' ? 'var(--accent-blue)' : 'transparent',
              color: activeTab === 'logs' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: activeTab === 'logs' ? '0 4px 14px rgba(59, 130, 246, 0.35)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <MessageSquare size={18} />
            <span>Outbound Notification Logs</span>
            <span style={{
              background: activeTab === 'logs' ? 'rgba(255,255,255,0.25)' : 'var(--bg-tertiary)',
              color: activeTab === 'logs' ? '#ffffff' : 'var(--text-primary)',
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '0.72rem',
              fontWeight: 800
            }}>
              {smsHistory.length}
            </span>
          </button>

          {/* 2. Secondary Tab: AI Assistant */}
          <button
            onClick={() => handleTabSwitch('bot')}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              border: 'none',
              fontWeight: 800,
              fontSize: '0.92rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: activeTab === 'bot' ? 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' : 'transparent',
              color: activeTab === 'bot' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: activeTab === 'bot' ? '0 4px 14px rgba(99, 102, 241, 0.35)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <Sparkles size={18} />
            <span>✨ AI Assistant & Bot</span>
          </button>
        </div>

        {/* Persistent Master Outbound Messaging Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={handleToggleOutboundMessaging}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: outboundMessagingActive ? '1.5px solid #86efac' : '1.5px solid #fca5a5',
              background: outboundMessagingActive ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              color: outboundMessagingActive ? '#15803d' : '#b91c1c',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
            title="Click to Toggle Automated WhatsApp Alerts"
          >
            <span style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: outboundMessagingActive ? '#22c55e' : '#ef4444',
              boxShadow: outboundMessagingActive ? '0 0 8px #22c55e' : 'none'
            }} />
            <span>{outboundMessagingActive ? '🟢 Live WhatsApp Alerts: ACTIVE' : '⏸️ Live WhatsApp Alerts: PAUSED'}</span>
          </button>
        </div>

        {activeTab === 'bot' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingRight: '6px' }}>
            <button
              onClick={handleToggleBot}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: botConfig.enabled ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                color: botConfig.enabled ? '#ef4444' : '#22c55e'
              }}
            >
              {botConfig.enabled ? <Pause size={14} /> : <Play size={14} />}
              <span>{botConfig.enabled ? 'Pause Auto-Replies' : 'Resume Auto-Replies'}</span>
            </button>
          </div>
        )}
      </div>

      {/* WhatsApp Local Status Banner */}
      <div className="card" style={{ marginBottom: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="flex items-center gap-12">
          {whatsappStatus === 'ready' ? (
            <div className="flex items-center justify-center" style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--accent-green)' }}>
              <MessageCircle size={24} />
            </div>
          ) : (
            <div className="flex items-center justify-center" style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)' }}>
              <WifiOff size={24} />
            </div>
          )}
          
          <div>
            <h3 style={{ margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              WhatsApp Integration Status
              {whatsappStatus === 'ready' && (
                <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Online</span>
              )}
              {whatsappStatus === 'disconnected' && (
                <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>Offline</span>
              )}
              {whatsappStatus === 'qr' && (
                <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>QR Code Scan Required</span>
              )}
              {whatsappStatus === 'connecting' && (
                <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>Starting up...</span>
              )}
              {whatsappStatus === 'auth_failure' && (
                <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>Auth Failed</span>
              )}
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {whatsappStatus === 'ready' ? (
                <>
                  Ready to send automated messages via local WhatsApp.
                  {whatsappInfo && (
                    <span style={{ display: 'block', marginTop: '4px', color: 'var(--text-primary)', fontWeight: '500' }}>
                      Connected as: {whatsappInfo.pushname || 'User'} ({whatsappInfo.wid?.user || 'Unknown Number'})
                    </span>
                  )}
                </>
              ) : 'Link your WhatsApp account to enable automated messaging.'}
            </p>
            {whatsappStatus !== 'ready' && (
              <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: 'var(--accent-orange)', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>If WhatsApp is stuck on 'Initializing...' or the QR code doesn't generate, please right-click the taskbar, open Task Manager, and end all 'Chrome' processes to fix the bug.</span>
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {whatsappStatus === 'ready' && (
            <button className="btn btn-outline" onClick={disconnectWhatsApp} disabled={loadingAction} style={{ color: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}>
              <WifiOff size={16} /> Disconnect
            </button>
          )}
          
          {(whatsappStatus === 'disconnected' || whatsappStatus === 'offline' || whatsappStatus === 'auth_failure') && (
            <button className="btn btn-primary" onClick={initializeWhatsApp} disabled={loadingAction}>
              {loadingAction ? <RefreshCw size={16} className="spin" /> : <QrCode size={16} />}
              Link WhatsApp
            </button>
          )}

          {whatsappStatus === 'connecting' && (
            <button className="btn btn-primary" disabled={true}>
              <RefreshCw size={16} className="spin" /> Initializing...
            </button>
          )}

          {whatsappStatus === 'qr' && qrCode && (
            <button className="btn btn-primary" onClick={() => setShowQrModal(true)} disabled={loadingAction}>
              <QrCode size={16} /> Show QR Code
            </button>
          )}
        </div>
      </div>

      {activeTab === 'logs' ? (
        <>
          {/* Stats Row */}
          <motion.div
            className="stat-cards-grid"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
        <motion.div 
          className="stat-card blue clickable" 
          variants={itemVariants}
          onClick={() => setTypeFilter('all')}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.98 }}
          role="button"
          tabIndex={0}
          title="Click to view all SMS"
        >
          <div className="stat-card-top">
            <div className="stat-card-icon blue">
              <MessageSquare size={20} />
            </div>
            <div className="stat-card-arrow">
              <ArrowUpRight size={15} />
            </div>
          </div>
          <div className="stat-card-value">{stats.total}</div>
          <div className="stat-card-label">
            <span>Total SMS Sent</span>
            <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>All</span>
          </div>
        </motion.div>

        <motion.div 
          className="stat-card green clickable" 
          variants={itemVariants}
          onClick={() => setTypeFilter('all')}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.98 }}
          role="button"
          tabIndex={0}
          title="Click to view delivered SMS"
        >
          <div className="stat-card-top">
            <div className="stat-card-icon green">
              <CheckCircle2 size={20} />
            </div>
            <div className="stat-card-arrow">
              <ArrowUpRight size={15} />
            </div>
          </div>
          <div className="stat-card-value">{stats.delivered}</div>
          <div className="stat-card-label">
            <span>Delivered</span>
            <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>Status</span>
          </div>
        </motion.div>

        <motion.div 
          className="stat-card orange clickable" 
          variants={itemVariants}
          onClick={() => setTypeFilter('attendance-entry')}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.98 }}
          role="button"
          tabIndex={0}
          title="Click to filter Attendance SMS"
        >
          <div className="stat-card-top">
            <div className="stat-card-icon orange">
              <Clock size={20} />
            </div>
            <div className="stat-card-arrow">
              <ArrowUpRight size={15} />
            </div>
          </div>
          <div className="stat-card-value">{stats.attendanceSMS}</div>
          <div className="stat-card-label">
            <span>Attendance SMS</span>
            <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>Filter</span>
          </div>
        </motion.div>

        <motion.div 
          className="stat-card purple clickable" 
          variants={itemVariants}
          onClick={() => setTypeFilter('test-result')}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.98 }}
          role="button"
          tabIndex={0}
          title="Click to filter Test Result SMS"
        >
          <div className="stat-card-top">
            <div className="stat-card-icon purple">
              <FileText size={20} />
            </div>
            <div className="stat-card-arrow">
              <ArrowUpRight size={15} />
            </div>
          </div>
          <div className="stat-card-value">{stats.testResultSMS}</div>
          <div className="stat-card-label">
            <span>Test Result SMS</span>
            <span style={{ fontSize: '0.72rem', opacity: 0.8 }}>Filter</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Filters & Bulk Action Bar */}
      <motion.div
        className="flex items-center gap-12 mb-16 flex-wrap"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-8" style={{ position: 'relative' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            className="form-input"
            placeholder="Search by student, phone, or message..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ paddingLeft: '36px', maxWidth: '320px' }}
          />
        </div>

        <div className="flex items-center gap-8">
          <Filter size={16} style={{ color: 'var(--text-muted)' }} />
          <select
            className="form-select"
            value={typeFilter}
            onChange={(e) => handleTypeFilter(e.target.value)}
            style={{ minWidth: '150px' }}
          >
            {typeFilterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-8">
          <button 
            className="btn btn-outline" 
            style={{ padding: '0.4rem 0.9rem', height: 'auto', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border-color)' }}
            onClick={() => setShowExportModal(true)}
          >
            <Download size={15} /> Download SMS
          </button>
        </div>

        {/* 🗑️ Bulk & All Delete Controls */}
        <div className="flex items-center gap-8">
          {selectedSmsIds.size > 0 && (
            <button
              className="btn btn-primary"
              style={{
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                borderColor: '#dc2626',
                padding: '0.4rem 1rem',
                height: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)'
              }}
              onClick={() => setDeleteConfirmModal({ type: 'bulk', count: selectedSmsIds.size })}
            >
              <Trash2 size={15} /> Delete Selected ({selectedSmsIds.size})
            </button>
          )}

          {smsHistory.length > 0 && (
            <button
              className="btn btn-outline"
              style={{
                color: '#ef4444',
                borderColor: 'rgba(239, 68, 68, 0.3)',
                background: 'rgba(239, 68, 68, 0.04)',
                padding: '0.4rem 0.9rem',
                height: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onClick={() => setDeleteConfirmModal({ type: 'all', count: smsHistory.length })}
              title="Delete all SMS logs for this institute"
            >
              <Trash2 size={15} /> Delete All SMS ({smsHistory.length})
            </button>
          )}
        </div>

        <div className="flex items-center gap-12" style={{ marginLeft: 'auto' }}>
          <span style={{ color: '#10b981', fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.08)', padding: '4px 10px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }}></span>
            Real-time Live Sync
          </span>
          <span style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
            Showing {paginatedHistory.length} of {filteredHistory.length} messages
          </span>
        </div>
      </motion.div>

      {/* SMS History Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={isAllPageSelected}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--accent-blue)' }}
                    title="Select all on this page"
                  />
                </th>
                <th>Type</th>
                <th>Student</th>
                <th>Parent Phone</th>
                <th>Message</th>
                <th>Time</th>
                <th>Status</th>
                <th style={{ textAlign: 'center', width: '60px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedHistory.length === 0 ? (
                <tr>
                  <td colSpan="8">
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <MessageCircle size={28} />
                      </div>
                      <h3>No SMS found</h3>
                      <p>Try adjusting your search or filter.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedHistory.map((sms, idx) => {
                  const smsId = sms._id || sms.id;
                  const isSelected = selectedSmsIds.has(smsId);
                  const badge = typeBadgeMap[sms.type] || {
                    className: 'badge badge-info',
                    label: sms.type ? sms.type.toUpperCase() : 'SMS',
                  };

                  return (
                    <motion.tr
                      key={smsId || idx}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.02 }}
                      onClick={() => setSelectedMessage(sms)}
                      style={{
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(59, 130, 246, 0.08)' : undefined
                      }}
                      title="Click to view full message"
                      className="hover-row"
                    >
                      <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => toggleSelectRow(smsId, e)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--accent-blue)' }}
                        />
                      </td>
                      <td>
                        <span className={badge.className}>{badge.label}</span>
                      </td>
                      <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {getStudentName(sms.studentId)}
                      </td>
                      <td>
                        <span className="flex items-center gap-4">
                          <Phone size={13} style={{ color: 'var(--text-muted)' }} />
                          {sms.parentPhone}
                        </span>
                      </td>
                      <td style={{ maxWidth: '320px' }}>
                        <span className="truncate" style={{ display: 'block', maxWidth: '320px' }}>
                          {sms.message && sms.message.length > 60
                            ? sms.message.substring(0, 60) + '...'
                            : sms.message}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {(() => {
                          if (!sms.timestamp) return '-';
                          const d = new Date(sms.timestamp);
                          if (isNaN(d.getTime())) {
                            const fallback = sms.createdAt ? new Date(sms.createdAt) : new Date();
                            return `${fallback.toLocaleDateString()} ${sms.timestamp}`;
                          }
                          return getRelativeTime(sms.timestamp);
                        })()}
                      </td>
                      <td>
                        <span className={`sms-status ${sms.status || 'sent'}`}>
                          {sms.status === 'delivered' && <CheckCircle2 size={12} />}
                          {sms.status === 'sent' && <Clock size={12} />}
                          {sms.status === 'failed' && <AlertCircle size={12} />}
                          {sms.status || 'sent'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn-icon"
                          style={{
                            color: '#ef4444',
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: '8px',
                            padding: '6px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Delete SMS Log"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmModal({ type: 'single', id: smsId, count: 1 });
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            className="flex items-center justify-center gap-12 mt-16"
          >
            <button
              className="btn btn-ghost btn-sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              <ChevronLeft size={16} />
              Prev
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </motion.div>
        </>
      ) : activeTab === 'voice' ? (
        <VoiceCallerSimulator />
      ) : (
        /* 🤖 WhatsApp AI & Parent Auto-Reply Bot Tab Content */
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
        >
          {/* Bot Overview & Hero Banner */}
          <div className="card" style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 16px rgba(99, 102, 241, 0.25)'
              }}>
                <Bot size={28} />
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  🤖 Automated WhatsApp Parent Assistant
                  <span style={{
                    background: botConfig.enabled ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: botConfig.enabled ? '#22c55e' : '#ef4444',
                    fontSize: '0.75rem',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontWeight: 800
                  }}>
                    {botConfig.enabled ? '● LIVE & ACTIVE' : '○ PAUSED'}
                  </span>
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Parents can send keywords (like <strong>1</strong> for Attendance, <strong>2</strong> for Marks, <strong>3</strong> for Timetable) to get instant student reports.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                className="btn"
                onClick={handleToggleBot}
                style={{
                  background: botConfig.enabled ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  color: '#ffffff',
                  fontWeight: 800,
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {botConfig.enabled ? <Pause size={16} /> : <Play size={16} />}
                <span>{botConfig.enabled ? 'Disable Auto-Reply' : 'Enable Auto-Reply'}</span>
              </button>
            </div>
          </div>

          {/* Main 2-Column Grid: Settings & Phone Simulator */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
            gap: '20px',
            alignItems: 'stretch'
          }}>
            {/* Left Column: Response Toggles & Customization */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
                  <Sliders size={18} color="var(--accent-blue)" />
                  Bot Response Triggers & Toggles
                </h4>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Auto-Saved</span>
              </div>

              {/* Coaching Name & Counseling Helplines */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                    Coaching Display Name
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={botConfig.coachingName || 'Career Xone'}
                    onChange={(e) => handleUpdateBotSetting('coachingName', e.target.value)}
                    placeholder="e.g. Career Xone"
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                    📧 Official Email
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={botConfig.email || 'cxjeeneet@gmail.com'}
                    onChange={(e) => handleUpdateBotSetting('email', e.target.value)}
                    placeholder="cxjeeneet@gmail.com"
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                    📞 Counseling Helpline 1
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={botConfig.counselingPhone1 || '9673383561'}
                    onChange={(e) => handleUpdateBotSetting('counselingPhone1', e.target.value)}
                    placeholder="9673383561"
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                    📞 Counseling Helpline 2
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={botConfig.counselingPhone2 || '9145481323'}
                    onChange={(e) => handleUpdateBotSetting('counselingPhone2', e.target.value)}
                    placeholder="9145481323"
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                    📍 Campus Address
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={botConfig.campusAddress || 'Hadditoli Road, Near Ananya Hospital, Gondia, Maharashtra 441601'}
                    onChange={(e) => handleUpdateBotSetting('campusAddress', e.target.value)}
                    placeholder="Hadditoli Road, Near Ananya Hospital, Gondia, Maharashtra 441601"
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>
                    🗺️ Google Maps Location URL
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={botConfig.googleMapsUrl || 'https://maps.app.goo.gl/ECzbg6DcixL7ZxpW7'}
                    onChange={(e) => handleUpdateBotSetting('googleMapsUrl', e.target.value)}
                    placeholder="https://maps.app.goo.gl/ECzbg6DcixL7ZxpW7"
                    style={{ width: '100%', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* Trigger 1: Attendance */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)'
              }}>
                <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>1️⃣ Attendance Auto-Reply</span>
                <button
                  onClick={() => handleUpdateBotSetting('enableAttendance', !botConfig.enableAttendance)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    background: botConfig.enableAttendance ? 'rgba(34, 197, 94, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                    color: botConfig.enableAttendance ? '#22c55e' : '#ef4444'
                  }}
                >
                  {botConfig.enableAttendance ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Trigger 2: Test Marks */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)'
              }}>
                <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>2️⃣ Test Marks & Ranks</span>
                <button
                  onClick={() => handleUpdateBotSetting('enableMarks', !botConfig.enableMarks)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    background: botConfig.enableMarks ? 'rgba(34, 197, 94, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                    color: botConfig.enableMarks ? '#22c55e' : '#ef4444'
                  }}
                >
                  {botConfig.enableMarks ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Trigger 3: Strict Fee Redirection Protection */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)'
              }}>
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>3️⃣ Fee Counseling Protection</span>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '4px 10px', borderRadius: '6px' }}>
                  PROTECTED
                </span>
              </div>

              {/* Trigger 4: Timetable */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)'
              }}>
                <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>4️⃣ Class Timetable & Schedule</span>
                <button
                  onClick={() => handleUpdateBotSetting('enableTimetable', !botConfig.enableTimetable)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    background: botConfig.enableTimetable ? 'rgba(34, 197, 94, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                    color: botConfig.enableTimetable ? '#22c55e' : '#ef4444'
                  }}
                >
                  {botConfig.enableTimetable ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Trigger 5: Performance Report */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)'
              }}>
                <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>5️⃣ Performance Report Card</span>
                <button
                  onClick={() => handleUpdateBotSetting('enableReport', !botConfig.enableReport)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    background: botConfig.enableReport ? 'rgba(34, 197, 94, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                    color: botConfig.enableReport ? '#22c55e' : '#ef4444'
                  }}
                >
                  {botConfig.enableReport ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Save Settings Button */}
              <div style={{ marginTop: '4px' }}>
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    try {
                      await api.saveWhatsAppBotConfig(botConfig);
                      toast.success('✅ AI Assistant settings & helpline numbers saved permanently!');
                    } catch (e) {
                      toast.error('Failed to save settings: ' + e.message);
                    }
                  }}
                  style={{ width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 700, borderRadius: '10px' }}
                >
                  <Check size={16} />
                  <span>💾 Save AI Settings & Helpline Numbers (सेटिंग्स सेव करें)</span>
                </button>
              </div>
            </div>

            {/* Right Column: WhatsApp Interactive Phone Simulator */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
              {/* Simulator Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Smartphone size={18} color="#22c55e" />
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800 }}>
                    Live AI WhatsApp Chat Simulator
                  </h4>
                </div>

                {/* Persona Mode Switch (Student vs Guest) */}
                <div style={{ display: 'flex', background: 'var(--surface-color)', padding: '3px', borderRadius: '10px', border: '1px solid var(--border-color)', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setSimulatorMode('student')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      background: simulatorMode === 'student' ? 'var(--accent-blue)' : 'transparent',
                      color: simulatorMode === 'student' ? '#ffffff' : 'var(--text-secondary)'
                    }}
                  >
                    👨‍🎓 Student Parent
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimulatorMode('guest')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      background: simulatorMode === 'guest' ? '#10b981' : 'transparent',
                      color: simulatorMode === 'guest' ? '#ffffff' : 'var(--text-secondary)'
                    }}
                  >
                    👤 Guest / Admission
                  </button>
                </div>
              </div>

              {/* Student Picker Bar (When in Student Mode) */}
              {simulatorMode === 'student' && students.length > 0 && (
                <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(59, 130, 246, 0.06)', padding: '6px 12px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--accent-blue)', whiteSpace: 'nowrap' }}>Testing Student:</span>
                  <select
                    value={simulatorStudentId}
                    onChange={(e) => setSimulatorStudentId(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      background: 'var(--surface-color)',
                      color: 'var(--text-primary)',
                      fontSize: '0.78rem',
                      fontWeight: 700
                    }}
                  >
                    {students.slice(0, 50).map(s => (
                      <option key={s.id || s._id} value={s.id || s._id}>
                        {s.name} (Roll: {s.rollNo || '--'}) {s.batch ? `• ${s.batch}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Dynamic Quick Test Buttons */}
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {(simulatorMode === 'guest'
                  ? ['Hi', 'Good morning', 'Ok sir', 'Fees', 'Toppers', 'Scholarship', 'Location', 'Contact', 'Courses']
                  : ['Hi', '1', '2', '3', '4', 'Attendance', 'Marks', 'Timetable', 'Fees', 'Toppers']
                ).map(k => (
                  <button
                    key={k}
                    disabled={simulatorLoading}
                    onClick={() => handleSimulatorSend(k)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--surface-color)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: simulatorLoading ? 'not-allowed' : 'pointer',
                      color: 'var(--text-primary)',
                      transition: 'all 0.15s'
                    }}
                  >
                    {k}
                  </button>
                ))}
              </div>

              {/* Simulated Chat Feed */}
              <div style={{
                flex: 1,
                minHeight: '260px',
                maxHeight: '340px',
                overflowY: 'auto',
                background: 'rgba(0, 0, 0, 0.25)',
                borderRadius: '12px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                {previewChatMessages.map((msg, i) => (
                  <div
                    key={i}
                    style={{
                      alignSelf: msg.from === 'parent' ? 'flex-end' : 'flex-start',
                      maxWidth: '85%',
                      background: msg.from === 'parent' ? '#005c4b' : '#202c33',
                      color: '#ffffff',
                      padding: '8px 12px',
                      borderRadius: msg.from === 'parent' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      fontSize: '0.82rem',
                      lineHeight: 1.45,
                      whiteSpace: 'pre-wrap',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                  >
                    <div style={{ fontSize: '0.68rem', opacity: 0.7, marginBottom: '2px', fontWeight: 600 }}>
                      {msg.from === 'parent' ? '📱 Parent (You)' : `🤖 ${botConfig.coachingName || 'Career Xone'} AI`}
                    </div>
                    {msg.text}
                    <div style={{ fontSize: '0.62rem', opacity: 0.6, textAlign: 'right', marginTop: '4px' }}>
                      {msg.time}
                    </div>
                  </div>
                ))}
                {simulatorLoading && (
                  <div style={{ alignSelf: 'flex-start', background: '#202c33', padding: '6px 12px', borderRadius: '12px', fontSize: '0.75rem', color: '#94a3b8' }}>
                    🤖 AI Assistant is typing...
                  </div>
                )}
              </div>

              {/* Simulator Input Box */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder={simulatorMode === 'guest' ? "Type guest question like 'fees', 'toppers', 'address'..." : "Type message like 'Hi', 'attendance', 'marks'..."}
                  value={previewSimulatorInput}
                  onChange={(e) => setPreviewSimulatorInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSimulatorSend(); }}
                  style={{ flex: 1, fontSize: '0.85rem' }}
                />
                <button
                  className="btn btn-primary"
                  onClick={() => handleSimulatorSend()}
                  disabled={simulatorLoading || !previewSimulatorInput.trim()}
                  style={{ padding: '8px 16px' }}
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Live Bot Chat Stream / Conversation Manager */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h4 style={{ margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.05rem' }}>
                  <MessageSquare size={20} color="#22c55e" />
                  Parent WhatsApp Conversations & Live Stream
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Click any contact or message row below to open the <strong>Full Conversation Thread</strong>.
                </p>
              </div>

              {/* Search Bar & Active Stats */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search phone, student, roll..."
                    value={botSearchQuery}
                    onChange={(e) => setBotSearchQuery(e.target.value)}
                    style={{ paddingLeft: '32px', fontSize: '0.82rem', height: '34px', width: '220px' }}
                  />
                  {botSearchQuery && (
                    <button
                      onClick={() => setBotSearchQuery('')}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <span style={{
                  background: 'rgba(34, 197, 94, 0.12)',
                  color: '#22c55e',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  whiteSpace: 'nowrap'
                }}>
                  {groupedBotChats.length} Contacts Active ({botLogs.length} Messages)
                </span>
              </div>
            </div>

            {/* Quick Contact Inboxes Bar */}
            {groupedBotChats.length > 0 && (
              <div style={{
                display: 'flex',
                gap: '10px',
                overflowX: 'auto',
                paddingBottom: '12px',
                marginBottom: '16px',
                borderBottom: '1px solid var(--border-color)'
              }}>
                {groupedBotChats.map((contact) => (
                  <div
                    key={contact.phone}
                    onClick={() => setSelectedBotChatContact(contact)}
                    style={{
                      flexShrink: 0,
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '0.85rem'
                    }}>
                      <User size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{contact.studentName}</span>
                        <span style={{ fontSize: '0.7rem', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)', padding: '1px 6px', borderRadius: '4px' }}>
                          {contact.totalInteractions} msgs
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                        📱 {contact.phone} {contact.rollNo !== '--' ? `• Roll ${contact.rollNo}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {botLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                <MessageCircle size={42} style={{ margin: '0 auto 10px auto', opacity: 0.4 }} />
                <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>No Incoming Parent Messages Yet</p>
                <span style={{ fontSize: '0.8rem' }}>When a parent sends a WhatsApp message, their entire conversation tab and live stream will appear here.</span>
              </div>
            ) : (
              <div className="table-responsive" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '10px 14px', width: '90px' }}>TIME</th>
                      <th style={{ padding: '10px 14px', width: '130px' }}>PARENT PHONE</th>
                      <th style={{ padding: '10px 14px', width: '180px' }}>ENROLLED STUDENT</th>
                      <th style={{ padding: '10px 14px', width: '180px' }}>PARENT QUERY</th>
                      <th style={{ padding: '10px 14px' }}>BOT AUTOMATED RESPONSE</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', width: '130px' }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {botLogs.map((log) => {
                      const contactData = groupedBotChats.find(c => c.phone === log.phone) || {
                        phone: log.phone,
                        studentName: log.studentName,
                        rollNo: log.rollNo,
                        logs: [log]
                      };

                      return (
                        <tr
                          key={log.id}
                          onClick={() => setSelectedBotChatContact(contactData)}
                          style={{ cursor: 'pointer', transition: 'background 0.15s ease' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          <td style={{ fontSize: '0.76rem', whiteSpace: 'nowrap', color: 'var(--text-muted)', padding: '10px 14px' }}>
                            {new Date(log.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td style={{ fontWeight: 800, fontSize: '0.86rem', padding: '10px 14px', whiteSpace: 'nowrap' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Smartphone size={14} color="#22c55e" />
                              {log.phone}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--accent-blue)', fontSize: '0.85rem' }}>
                              {log.studentName}
                            </div>
                            {log.rollNo && log.rollNo !== '--' && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Roll: {log.rollNo}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '10px 14px', maxWidth: '200px' }}>
                            <span style={{
                              display: 'inline-block',
                              background: '#005c4b',
                              color: '#ffffff',
                              padding: '4px 10px',
                              borderRadius: '12px 12px 2px 12px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              maxWidth: '100%',
                              wordBreak: 'break-word'
                            }}>
                              {log.incomingText}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: '0.82rem', color: 'var(--text-primary)', maxWidth: '380px' }}>
                            <div style={{
                              background: 'var(--bg-tertiary)',
                              padding: '6px 10px',
                              borderRadius: '8px',
                              border: '1px solid var(--border-color)',
                              maxHeight: '48px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }} title={log.botReply}>
                              {log.botReply}
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBotChatContact(contactData);
                              }}
                              style={{
                                fontSize: '0.75rem',
                                padding: '4px 10px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                borderColor: 'var(--accent-blue)',
                                color: 'var(--accent-blue)'
                              }}
                            >
                              <Eye size={13} />
                              <span>Full Chat</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* 📱 Full WhatsApp Parent Conversation Drawer / Modal */}
      <AnimatePresence>
        {selectedBotChatContact && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedBotChatContact(null)}
            style={{ zIndex: 1100, backdropFilter: 'blur(4px)' }}
          >
            <motion.div
              className="modal-content"
              style={{
                maxWidth: '620px',
                width: '95%',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                padding: 0,
                overflow: 'hidden',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
              }}
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* WhatsApp Modal Header */}
              <div style={{
                background: 'linear-gradient(135deg, #075e54 0%, #128c7e 100%)',
                color: '#ffffff',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem',
                    fontWeight: 800
                  }}>
                    👤
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 2px 0', fontSize: '1.1rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {selectedBotChatContact.studentName}
                      {selectedBotChatContact.rollNo !== '--' && (
                        <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.25)', padding: '2px 8px', borderRadius: '10px' }}>
                          Roll: {selectedBotChatContact.rollNo}
                        </span>
                      )}
                    </h3>
                    <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                      📱 {selectedBotChatContact.phone} • {selectedBotChatContact.logs?.length || 0} Messages Exchanged
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => {
                      const fullChatText = (selectedBotChatContact.logs || [])
                        .slice()
                        .reverse()
                        .map(l => `[${new Date(l.timestamp).toLocaleTimeString()}]\nParent: ${l.incomingText}\nBot:\n${l.botReply}\n-------------------`)
                        .join('\n\n');
                      navigator.clipboard.writeText(fullChatText);
                      toast.success('Chat copied to clipboard!');
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      border: 'none',
                      color: '#ffffff',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 700
                    }}
                  >
                    <Copy size={14} /> Copy Chat
                  </button>
                  <button
                    onClick={() => setSelectedBotChatContact(null)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      border: 'none',
                      color: '#ffffff',
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
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

              {/* WhatsApp Chat Conversation Timeline */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                background: 'var(--bg-tertiary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                minHeight: '350px',
                maxHeight: '520px'
              }}>
                <div style={{ textAlign: 'center', margin: '4px 0 10px 0' }}>
                  <span style={{
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-muted)',
                    fontSize: '0.72rem',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)'
                  }}>
                    End-to-End Automated WhatsApp Assistant Thread
                  </span>
                </div>

                {(selectedBotChatContact.logs || [])
                  .slice()
                  .reverse()
                  .map((log, index) => (
                    <div key={log.id || index} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {/* 1. Parent Message Bubble (Right-aligned) */}
                      <div style={{
                        alignSelf: 'flex-end',
                        maxWidth: '85%',
                        background: '#005c4b',
                        color: '#ffffff',
                        padding: '10px 14px',
                        borderRadius: '14px 14px 2px 14px',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.25)',
                        fontSize: '0.88rem',
                        lineHeight: 1.45
                      }}>
                        <div style={{ fontSize: '0.7rem', color: '#a7f3d0', marginBottom: '4px', fontWeight: 700, display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                          <span>📱 Parent ({selectedBotChatContact.phone})</span>
                          <span>{new Date(log.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {log.incomingText}
                        </div>
                      </div>

                      {/* 2. Bot Automated Reply Bubble (Left-aligned) */}
                      <div style={{
                        alignSelf: 'flex-start',
                        maxWidth: '88%',
                        background: '#202c33',
                        color: '#ffffff',
                        padding: '12px 16px',
                        borderRadius: '14px 14px 14px 2px',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.25)',
                        fontSize: '0.86rem',
                        lineHeight: 1.5,
                        border: '1px solid rgba(255,255,255,0.05)'
                      }}>
                        <div style={{ fontSize: '0.7rem', color: '#60a5fa', marginBottom: '6px', fontWeight: 700, display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                          <span>🤖 {botConfig.coachingName || 'Career Xone'} Bot</span>
                          <span style={{ color: 'var(--text-muted)' }}>{new Date(log.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#f3f4f6' }}>
                          {log.botReply}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '0.68rem', color: '#34d399' }}>
                          <Check size={12} />
                          <span>⚡ Automated reply delivered in &lt;1s</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Modal Footer */}
              <div style={{
                background: 'var(--bg-secondary)',
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: '1px solid var(--border-color)'
              }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Showing complete chat history for <strong>{selectedBotChatContact.phone}</strong>
                </span>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setSelectedBotChatContact(null)}
                  style={{ padding: '6px 18px' }}
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export SMS Modal */}
      <AnimatePresence>
        {showExportModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowExportModal(false)}
          >
            <motion.div
              className="modal-content"
              style={{ maxWidth: '400px' }}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>Export SMS to Excel</h2>
                <button
                  className="icon-btn"
                  onClick={() => setShowExportModal(false)}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label>From Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={exportDateRange.from}
                    onChange={(e) => setExportDateRange({ ...exportDateRange, from: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>To Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={exportDateRange.to}
                    onChange={(e) => setExportDateRange({ ...exportDateRange, to: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ marginTop: '24px' }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowExportModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleExportSMS}
                >
                  <Download size={18} style={{ marginRight: '8px' }} /> Export
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Send Custom SMS Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowModal(false)}
          >
            <motion.div
              className="modal-content"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>📱 Send Custom SMS</h3>
                <button
                  className="modal-close"
                  onClick={() => setShowModal(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Select Student</label>
                  <Select
                    options={studentOptions}
                    value={studentOptions.find(o => o.value === selectedStudent) || studentOptions[0]}
                    onChange={(selected) => setSelectedStudent(selected.value)}
                    isSearchable={true}
                    placeholder="Search by Name, Mobile, or Roll No..."
                    className="react-select-container"
                    classNamePrefix="react-select"
                    styles={{
                      control: (base) => ({
                        ...base,
                        borderRadius: '0.5rem',
                        borderColor: 'var(--border-color)',
                        padding: '2px',
                        boxShadow: 'none',
                        '&:hover': {
                          borderColor: 'var(--accent-blue)'
                        }
                      }),
                      menu: (base) => ({
                        ...base,
                        borderRadius: '0.5rem',
                        overflow: 'hidden',
                        zIndex: 9999
                      })
                    }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Message</label>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    placeholder="Type your message here..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    {message.length} characters
                  </span>
                </div>

                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Paperclip size={16} /> Attach Image/File (Optional)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label 
                      className="btn btn-outline" 
                      style={{ cursor: 'pointer', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <ImageIcon size={16} /> Select File
                      <input 
                        type="file" 
                        accept="image/*,application/pdf"
                        onChange={handleFileChange} 
                        style={{ display: 'none' }} 
                      />
                    </label>
                    {attachment && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-tertiary)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem' }}>
                        <span className="truncate" style={{ maxWidth: '150px' }}>{attachment.filename}</span>
                        <button 
                          onClick={() => setAttachment(null)}
                          style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', padding: 0, display: 'flex' }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Max size: 5MB. Supported: Images, PDF.
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="btn btn-ghost"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSend}
                  disabled={sending || !message.trim()}
                >
                  <Send size={16} />
                  {sending ? 'Sending...' : selectedStudent === 'all' ? 'Send to All' : 'Send SMS'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message Preview Modal */}
      <AnimatePresence>
        {selectedMessage && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedMessage(null)}
          >
            <motion.div
              className="modal-content"
              style={{ maxWidth: '500px' }}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Message Details</h3>
                <button className="modal-close" onClick={() => setSelectedMessage(null)}>
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body" style={{ lineHeight: '1.6' }}>
                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>Student:</strong> <span style={{ color: 'var(--text-secondary)' }}>{getStudentName(selectedMessage.studentId)}</span>
                  </div>
                  <div>
                    <strong>Phone:</strong> <span style={{ color: 'var(--text-secondary)' }}>{selectedMessage.parentPhone}</span>
                  </div>
                </div>
                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>Type:</strong> <span className={typeBadgeMap[selectedMessage.type]?.className || 'badge badge-info'}>{typeBadgeMap[selectedMessage.type]?.label || 'SMS'}</span>
                  </div>
                  <div>
                    <strong>Status:</strong> <span className={`sms-status ${selectedMessage.status || 'sent'}`}>{selectedMessage.status || 'sent'}</span>
                  </div>
                </div>
                <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-md)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-primary)' }}>
                  {selectedMessage.message}
                </div>
                <div style={{ marginTop: '16px', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                  {selectedMessage.timestamp ? new Date(selectedMessage.timestamp).toLocaleString() : '-'}
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button 
                  className="btn btn-outline" 
                  style={{ color: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this SMS log?')) {
                      deleteSMS(selectedMessage._id || selectedMessage.id);
                      setSelectedMessage(null);
                    }
                  }}
                >
                  <Trash2 size={16} />
                  Delete SMS
                </button>
                <button className="btn btn-primary" onClick={() => setSelectedMessage(null)}>
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Code Modal */}
      <AnimatePresence>
        {showQrModal && qrCode && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowQrModal(false)}
          >
            <motion.div
              className="modal-content"
              style={{ maxWidth: '400px', textAlign: 'center' }}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>Scan QR to Link WhatsApp</h3>
                <button className="modal-close" onClick={() => setShowQrModal(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body" style={{ padding: '24px' }}>
                <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
                  Open WhatsApp on your phone and scan this QR code to connect your account.
                </p>
                <div style={{ background: 'white', padding: '16px', borderRadius: '12px', display: 'inline-block' }}>
                  <img src={qrCode} alt="WhatsApp QR Code" style={{ width: '256px', height: '256px' }} />
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'center' }}>
                <button className="btn btn-primary" onClick={() => setShowQrModal(false)}>
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDeleteConfirmModal(null)}
          >
            <motion.div
              className="modal-content"
              style={{ maxWidth: '440px' }}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <h3 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <Trash2 size={20} />
                  {deleteConfirmModal.type === 'all'
                    ? 'Clear All SMS Logs?'
                    : deleteConfirmModal.type === 'bulk'
                    ? `Delete ${deleteConfirmModal.count} Selected Logs?`
                    : 'Delete SMS Log?'}
                </h3>
                <button className="modal-close" onClick={() => setDeleteConfirmModal(null)}>
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body" style={{ padding: '20px 0', lineHeight: 1.5 }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', margin: 0 }}>
                  {deleteConfirmModal.type === 'all'
                    ? `Are you sure you want to permanently delete ALL ${deleteConfirmModal.count} SMS logs? This will clean up all message records from both local database and cloud storage.`
                    : deleteConfirmModal.type === 'bulk'
                    ? `Are you sure you want to permanently delete the ${deleteConfirmModal.count} selected SMS logs?`
                    : 'Are you sure you want to permanently delete this SMS log?'}
                </p>
                <div style={{ marginTop: '14px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>This action cannot be undone.</span>
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button className="btn btn-ghost" onClick={() => setDeleteConfirmModal(null)}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', borderColor: '#dc2626' }}
                  onClick={handleConfirmDelete}
                >
                  <Trash2 size={16} /> Yes, Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
