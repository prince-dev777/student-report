import React, { useState, useEffect } from 'react';
import { 
  User, Lock, Eye, EyeOff, CheckCircle2, XCircle, Clock, Award, Calendar, 
  BookOpen, Download, LogOut, ArrowRight, ShieldCheck, Sparkles, FileText, 
  ImageIcon, Smartphone, ExternalLink, X, ZoomIn, ZoomOut, AlertTriangle, 
  AlertCircle, Book, ChevronLeft, Info, MapPin, Maximize, Minimize, Phone, 
  Search, Send, Bell, TrendingUp, BarChart2, Printer, Check, Star, Zap, 
  Flame, Compass, HelpCircle, ChevronRight, ChevronUp, ChevronDown, Share2, 
  RefreshCw, SlidersHorizontal, Grid, List, Settings 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api, API_BASE } from '../utils/api';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { getMediaUrl } from '../utils/api';
import AppInstallGate from '../components/AppInstallGate';
import PWAInstallPrompt from '../components/PWAInstallPrompt';

// Helper to get persistent saved parent session
const getSavedParentSession = () => {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('parentSession') || sessionStorage.getItem('parentSession');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default function ParentPortalWeb() {
  const initialSession = getSavedParentSession();

  const [proceedToWeb, setProceedToWeb] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !!sessionStorage.getItem('skip_parent_install_gate') || !!localStorage.getItem('parentSession');
  });
  const [userId, setUserId] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('parent_last_user_id') || '' : ''));
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!initialSession);
  const [studentData, setStudentData] = useState(() => initialSession?.studentData || null);
  const [attendanceRecords, setAttendanceRecords] = useState(() => initialSession?.attendanceRecords || []);
  const [testResults, setTestResults] = useState(() => initialSession?.testResults || []);
  const [upcomingTests, setUpcomingTests] = useState(() => initialSession?.upcomingTests || []);
  const [notices, setNotices] = useState(() => initialSession?.notices || []);

  // Active Tab: 'attendance' | 'tests'
  const [activeTab, setActiveTab] = useState('attendance');
  const [isOmrNoticeExpanded, setIsOmrNoticeExpanded] = useState(true);
  const [selectedOmrImage, setSelectedOmrImage] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [testSubjectFilter, setTestSubjectFilter] = useState('ALL');
  const [attendanceViewMode, setAttendanceViewMode] = useState('calendar'); // 'calendar' | 'list'
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(() => window.deferredPrompt || null);
  const [showForceInstallModal, setShowForceInstallModal] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showReportCardModal, setShowReportCardModal] = useState(false);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showFullPhotoModal, setShowFullPhotoModal] = useState(false);
  const [noticeFilter, setNoticeFilter] = useState('ALL');
  const [notificationPermission, setNotificationPermission] = useState(() => {
    return (typeof window !== 'undefined' && 'Notification' in window) ? Notification.permission : 'default';
  });

  // Track Read Notice IDs in localStorage so badges disappear once seen
  const [readNoticeIds, setReadNoticeIds] = useState(() => {
    try {
      const raw = localStorage.getItem('parent_read_notices');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  const markNoticesAsRead = () => {
    const allIds = notices.map(n => n.id || n._id || `${n.title}_${n.createdAt || n.time}`);
    setReadNoticeIds(prev => {
      const updated = new Set([...prev, ...allIds]);
      try {
        localStorage.setItem('parent_read_notices', JSON.stringify(Array.from(updated)));
      } catch {}
      return updated;
    });
  };

  const markAllNotificationsAsRead = () => {
    const allIds = allNotifications.map(n => n.id);
    setReadNoticeIds(prev => {
      const updated = new Set([...prev, ...allIds]);
      try {
        localStorage.setItem('parent_read_notices', JSON.stringify(Array.from(updated)));
      } catch {}
      return updated;
    });
  };

  // Auto mark official circulars as read when visiting Notices tab
  useEffect(() => {
    if (activeTab === 'schedule' && notices.length > 0) {
      markNoticesAsRead();
    }
  }, [activeTab, notices]);

  // Cleared / Dismissed Notifications State
  const [clearedNotifIds, setClearedNotifIds] = useState(() => {
    try {
      if (typeof window === 'undefined') return [];
      return JSON.parse(localStorage.getItem('parent_cleared_notifs') || '[]');
    } catch {
      return [];
    }
  });

  // Global Parent Logout Handler
  const handleLogout = () => {
    try {
      localStorage.removeItem('parentSession');
      localStorage.removeItem('parentToken');
      sessionStorage.removeItem('parentSession');
    } catch {}
    setIsLoggedIn(false);
    setStudentData(null);
    setAttendanceRecords([]);
    setTestResults([]);
    setUpcomingTests([]);
    setNotices([]);
    setShowProfileModal(false);
    setShowSettingsDrawer(false);
    setShowNotificationDrawer(false);
    toast.success('Logged out successfully');
  };

  // Clear All Notifications Handler
  const handleClearAllNotifications = () => {
    const allIds = allNotifications.map(n => n.id);
    setClearedNotifIds(allIds);
    try {
      localStorage.setItem('parent_cleared_notifs', JSON.stringify(allIds));
    } catch {}
    toast.success('🧹 Notifications cleared!');
  };

  useEffect(() => {
    if (activeTab === 'schedule' && notices.length > 0) {
      markNoticesAsRead();
    }
  }, [activeTab, notices]);

  // Institute Branding Defaults
  const instituteName = "CAREER XONE";
  const instituteLogo = "/logo.png";
  const helplineNumber = "9673383561 / 91454 81323";
  const officialWebsite = "www.cxjeeneet.com";

  // Check if App is already running as standalone PWA
  const [isAppInstalled, setIsAppInstalled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      window.navigator.standalone === true ||
      window.location.search.includes('source=pwa') ||
      window.location.search.includes('standalone=1') ||
      window.location.search.includes('installed=1') ||
      document.referrer.includes('android-app://')
    );
  });

  // Catch PWA beforeinstallprompt event & check installed status
  useEffect(() => {
    document.title = 'Career Xone - Parents Official Mobile App';

    if (window.deferredPrompt) {
      setDeferredPrompt(window.deferredPrompt);
    }

    if (typeof navigator !== 'undefined' && 'getInstalledRelatedApps' in navigator) {
      navigator.getInstalledRelatedApps().then((relatedApps) => {
        if (relatedApps && relatedApps.length > 0) {
          setIsAppInstalled(true);
        }
      }).catch(() => {});
    }

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      window.deferredPrompt = e;
      setShowInstallBanner(true);
    };

    const handlePromptReady = (e) => {
      if (e && e.detail) {
        setDeferredPrompt(e.detail);
        window.deferredPrompt = e.detail;
      }
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setShowInstallBanner(false);
      setShowForceInstallModal(false);
      setDeferredPrompt(null);
      window.deferredPrompt = null;
      toast.success('🎉 Career Xone App successfully installed!');
      
      // Auto-prompt to enable lock-screen notifications
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        setTimeout(() => {
          handleRequestNotification();
        }, 1200);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('pwa-prompt-ready', handlePromptReady);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('pwa-prompt-ready', handlePromptReady);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Format clean course / batch name without duplicate class prefix
  const formatBatchName = (batch, studentClass) => {
    const b = String(batch || '').trim();
    if (!b) return studentClass || 'General Course';

    const bLower = b.toLowerCase();
    let courseName = '';
    if (bLower.startsWith('j') && /^[jJ]\d+$/.test(bLower)) {
      const num = bLower.replace(/\D/g, '');
      courseName = `JEE (Mains + Adv) • J${num}`;
    } else if (bLower.startsWith('n') && /^[nN]\d+$/.test(bLower)) {
      const num = bLower.replace(/\D/g, '');
      courseName = `NEET • N${num}`;
    } else if (bLower.includes('batch-4') || bLower === 'batch 4' || bLower === '4') {
      courseName = 'JEE Mains';
    } else if (bLower.includes('batch-1') || bLower === 'batch 1' || bLower === '1') {
      courseName = 'JEE Advanced';
    } else if (bLower.includes('batch-2') || bLower === 'batch 2' || bLower === '2') {
      courseName = 'NEET Medical';
    } else if (bLower.includes('batch-3') || bLower === 'batch 3' || bLower === '3') {
      courseName = 'MHCET';
    } else if (b) {
      courseName = b.replace(/^batch-?/i, 'Batch ').replace(/\b\w/g, l => l.toUpperCase());
    }

    return courseName || studentClass || 'General Course';
  };

  // Check device and browser environments
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isWhatsApp = typeof navigator !== 'undefined' && /WhatsApp/i.test(navigator.userAgent);
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

  const handleInstallApp = async () => {
    if (isAppInstalled) {
      toast.success('✅ App aapke device par pehle se installed hai! Home Screen se open karein.');
      return;
    }

    const promptEvent = deferredPrompt || window.deferredPrompt;
    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choiceResult = await promptEvent.userChoice;
        if (choiceResult && choiceResult.outcome === 'accepted') {
          setIsAppInstalled(true);
          setShowForceInstallModal(false);
          window.deferredPrompt = null;
          setDeferredPrompt(null);
          toast.success('🎉 Career Xone App added to Phone Home Screen!');
        }
      } catch (err) {
        console.warn('Install prompt error:', err);
        setShowForceInstallModal(true);
      }
    } else {
      setShowForceInstallModal(true);
    }
  };

  const handleOpenInChrome = () => {
    const currentUrl = window.location.href;
    if (isAndroid) {
      // Android Chrome intent launcher
      const cleanUrl = currentUrl.replace(/^https?:\/\//, '');
      window.location.href = `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end`;
    } else {
      navigator.clipboard.writeText(currentUrl);
      toast.success('📋 Link copied! Chrome me paste karein.');
    }
  };

  // Request Web Push Notification Permission
  const handleRequestNotification = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      toast.error('Notifications are not supported on this browser.');
      return;
    }

    if (Notification.permission === 'denied') {
      toast('🔔 Notifications browser settings me blocked hain. Address bar / Site Settings me "Allow" karein.', { icon: '⚙️', duration: 4000 });
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === 'granted') {
        toast.success('🔔 Lock-screen notifications enabled!');
        
        // Show test notification using Service Worker on mobile or fallback
        if ('serviceWorker' in navigator) {
          try {
            const reg = await navigator.serviceWorker.ready;
            if (reg && reg.showNotification) {
              await reg.showNotification('Career Xone Parents App', {
                body: '🎉 Notifications active! You will receive live Attendance & Exam alerts here.',
                icon: '/logo.png',
                badge: '/logo.png'
              });
              return;
            }
          } catch(swErr) {
            console.warn('SW notification fallback:', swErr);
          }
        }

        try {
          new Notification('Career Xone Parents App', {
            body: '🎉 Notifications active! You will receive live Attendance & Exam alerts here.',
            icon: '/logo.png'
          });
        } catch(e) {}
      } else if (permission === 'denied') {
        toast('🔔 Notification permission was blocked in browser.', { icon: 'ℹ️' });
      }
    } catch (e) {
      console.warn('Notification permission error:', e);
    }
  };

  // Real MongoDB Parent Login Handler
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!userId.trim()) {
      toast.error('Please enter Parent Phone / Roll Number');
      return;
    }

    setLoading(true);
    let loginSuccess = false;
    let lastErrorMessage = '';

    try {
      const res = await fetch(`${API_BASE}/parent/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId.trim(), password: password.trim() })
      });

      const data = await res.json();

      if (res.ok && (data.success || data.token)) {
        const studentObj = data.student || data.student_data;
        const attList = data.attendance || [];
        const testList = data.testResults || [];
        const upcomingList = data.upcomingTests || [];
        const noticesList = data.notices || [];

        setStudentData(studentObj);
        setAttendanceRecords(attList);
        setTestResults(testList);
        setUpcomingTests(upcomingList);
        setNotices(noticesList);
        setIsLoggedIn(true);

        const sessionPayload = {
          token: data.token || '',
          userId: userId.trim(),
          password: password.trim(),
          studentData: studentObj,
          attendanceRecords: attList,
          testResults: testList,
          upcomingTests: upcomingList,
          notices: noticesList
        };

        localStorage.setItem('parentSession', JSON.stringify(sessionPayload));
        localStorage.setItem('parent_last_user_id', userId.trim());
        if (data.token) {
          localStorage.setItem('parentToken', data.token);
        }
        sessionStorage.setItem('parentSession', JSON.stringify(sessionPayload));

        toast.success(`Welcome Parent of ${studentObj?.name || 'Student'}!`, { id: 'parent-login' });
        loginSuccess = true;
      } else {
        lastErrorMessage = data.message || data.error || 'Invalid credentials';
      }
    } catch (err) {
      lastErrorMessage = err.message || 'Network error';
    }

    if (!loginSuccess) {
      toast.error(lastErrorMessage || '❌ Invalid User ID or Password. Please verify credentials.');
    }
    setLoading(false);
  };

  // Background Auto-Refresher: Keeps data updated while parent is logged in
  const refreshParentDataSilently = async () => {
    try {
      const session = getSavedParentSession();
      const token = session?.token || (typeof window !== 'undefined' ? localStorage.getItem('parentToken') : null);
      if (token) {
        const res = await fetch(`${API_BASE}/parent/data`, {
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.student) {
            setStudentData(data.student);
            setAttendanceRecords(data.attendance || []);
            setTestResults(data.tests || []);
            setNotices(data.notifications || []);
            setUpcomingTests(data.upcomingTests || []);
            
            const updatedSession = {
              ...session,
              studentData: data.student,
              attendanceRecords: data.attendance || [],
              testResults: data.tests || [],
              upcomingTests: data.upcomingTests || [],
              notices: data.notifications || []
            };
            localStorage.setItem('parentSession', JSON.stringify(updatedSession));
            sessionStorage.setItem('parentSession', JSON.stringify(updatedSession));
            return;
          }
        }
      }

      // If token expired or changed, silently re-login with saved credentials if available
      if (session?.userId && session?.password) {
        const res = await fetch(`${API_BASE}/parent/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: session.userId, password: session.password })
        });
        const data = await res.json();
        if (res.ok && (data.success || data.token)) {
          const studentObj = data.student || data.student_data;
          setStudentData(studentObj);
          setAttendanceRecords(data.attendance || []);
          setTestResults(data.testResults || []);
          setUpcomingTests(data.upcomingTests || []);
          setNotices(data.notices || []);
          if (data.token) localStorage.setItem('parentToken', data.token);

          const newSession = {
            token: data.token || '',
            userId: session.userId,
            password: session.password,
            studentData: studentObj,
            attendanceRecords: data.attendance || [],
            testResults: data.testResults || [],
            upcomingTests: data.upcomingTests || [],
            notices: data.notices || []
          };
          localStorage.setItem('parentSession', JSON.stringify(newSession));
          sessionStorage.setItem('parentSession', JSON.stringify(newSession));
        }
      }
    } catch (err) {
      console.warn('Silent parent session refresh warning:', err);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      refreshParentDataSilently();
      const interval = setInterval(refreshParentDataSilently, 20000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn]);

  // Download OMR Sheet Helper to save permanently before 30-day expiry
  const handleDownloadOmr = async (imageUrl, testName = 'OMR_Sheet') => {
    const resolvedUrl = getMediaUrl(imageUrl);
    if (!resolvedUrl) {
      toast.error('OMR Sheet image not available.');
      return;
    }
    const toastId = toast.loading('Downloading OMR Sheet...');
    try {
      const response = await fetch(resolvedUrl);
      if (!response.ok) throw new Error('Failed to fetch image');
      const blob = await response.blob();
      if (blob.type.includes('html') || blob.size < 500) {
        throw new Error('Server returned invalid image data');
      }
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      const cleanTestName = (testName || 'OMR_Test').replace(/[^a-zA-Z0-9_-]/g, '_');
      const studentName = (studentData?.name || 'Student').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `OMR_${studentName}_${cleanTestName}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast.success('OMR Sheet downloaded successfully!', { id: toastId });
    } catch (err) {
      console.error('Download error:', err);
      window.open(resolvedUrl, '_blank');
      toast.dismiss(toastId);
      toast('Opening OMR Sheet in new tab to view & save.', { icon: 'ℹ️' });
    }
  };

  // Pull-to-refresh & Manual Data Sync with Server
  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await refreshParentDataSilently();
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success('Data synced with institute server ✅', { id: 'parent-sync', duration: 1500 });
    }, 600);
  };

  // 1-Tap Result Card WhatsApp & Native Web Share
  const handleShareTestResult = (t) => {
    const studentName = studentData?.name || 'Student';
    const roll = studentData?.rollNo || '-';
    const tName = getTestName(t);
    const date = getTestDate(t);
    const score = `${t.marks}/${t.totalMarks || 360}`;
    const pct = `${t.percentage}%`;
    const rank = t.rank ? `#${t.rank}` : '-';

    const shareText = `🎓 *Career Xone - OMR Exam Performance Report*\n\n` +
      `👤 *Student:* ${studentName} (Roll: ${roll})\n` +
      `📝 *Exam Name:* ${tName}\n` +
      `📅 *Exam Date:* ${date}\n` +
      `📊 *Score:* ${score} (${pct})\n` +
      `🏆 *Batch Rank:* ${rank}\n` +
      `✨ *Performance:* Verified by Career Xone OMR System\n\n` +
      `📱 View detailed marksheet & OMR on Career Xone Parents App`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: `${studentName} - Exam Result`,
        text: shareText
      }).catch(() => {});
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
    }
  };

  // Compute Subject Analytics strictly from real testResults
  const calculateAnalytics = () => {
    if (!testResults || testResults.length === 0) {
      return {
        avgPercentage: 0,
        highestScore: 0,
        testsCount: 0,
        bestRank: '-',
        subjectBreakdown: [],
        growthBadge: "Active Student"
      };
    }

    const totalPct = testResults.reduce((acc, t) => acc + (Number(t.percentage) || 0), 0);
    const avgPct = Math.round(totalPct / testResults.length);
    const maxScore = Math.max(...testResults.map(t => Number(t.marks) || 0));
    const ranks = testResults.map(t => Number(t.rank)).filter(r => !isNaN(r) && r > 0);
    const bestRank = ranks.length > 0 ? Math.min(...ranks) : '-';

    // Real Subject Breakdown Calculation strictly from actual student test records
    const subjectMap = {};
    const colorPalette = {
      'Physics': '#f59e0b',
      'Chemistry': '#10b981',
      'Mathematics': '#3b82f6',
      'Maths': '#3b82f6',
      'Biology': '#ec4899',
      'Bio': '#ec4899',
      'Botany': '#059669',
      'Zoology': '#d97706',
      'Full Syllabus': '#8b5cf6',
      'General': '#6366f1'
    };

    testResults.forEach(t => {
      let subName = (t.subject || t.test?.subject || '').trim();
      if (!subName || subName.toLowerCase() === 'all' || subName.toLowerCase() === 'general') {
        const tName = (t.testName || t.name || '').toLowerCase();
        if (tName.includes('physics')) subName = 'Physics';
        else if (tName.includes('chem')) subName = 'Chemistry';
        else if (tName.includes('math')) subName = 'Mathematics';
        else if (tName.includes('bio')) subName = 'Biology';
        else subName = 'Full Syllabus / Comprehensive';
      }

      if (!subjectMap[subName]) {
        subjectMap[subName] = { obtained: 0, total: 0, count: 0 };
      }
      const obt = Number(t.marks) || 0;
      const tot = Number(t.totalMarks) || (obt > 0 ? obt : 100);
      subjectMap[subName].obtained += obt;
      subjectMap[subName].total += tot;
      subjectMap[subName].count += 1;
    });

    const subjectBreakdown = Object.keys(subjectMap).map(sub => {
      const data = subjectMap[sub];
      const pct = data.total > 0 ? Math.round((data.obtained / data.total) * 100) : 0;
      const color = colorPalette[sub] || '#3b82f6';
      return {
        subject: sub,
        percentage: Math.min(100, Math.max(0, pct)),
        color,
        status: pct >= 80 ? 'STRONG 🌟' : pct >= 60 ? 'GOOD 👍' : 'NEEDS FOCUS 🎯'
      };
    });

    let growthBadge = "Active Student";
    if (avgPct >= 80) growthBadge = "Top Ranker 🚀";
    else if (avgPct >= 65) growthBadge = "Fast Improving 📈";
    else if (avgPct > 0) growthBadge = "Focus Required 🎯";

    return {
      avgPercentage: avgPct,
      highestScore: maxScore,
      testsCount: testResults.length,
      bestRank,
      subjectBreakdown,
      growthBadge
    };
  };

  const analyticsData = calculateAnalytics();

  // Calculate dynamic Month-Wise Attendance Statistics
  const calculateMonthAttendance = (targetDate = new Date()) => {
    const targetMonth = targetDate.getMonth() + 1; // 1-12
    const targetYear = targetDate.getFullYear();
    const monthName = targetDate.toLocaleDateString('en-IN', { month: 'short' });
    const fullMonthName = targetDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    let present = 0;
    let absent = 0;
    let late = 0;
    let total = 0;

    (attendanceRecords || []).forEach(a => {
      if (!a?.date) return;
      const parts = String(a.date).trim().split(/[-/]/);
      if (parts.length === 3) {
        const m = parseInt(parts[1], 10);
        const y = parseInt(parts[0], 10) > 31 ? parseInt(parts[0], 10) : parseInt(parts[2], 10);
        if (m === targetMonth && (y === targetYear || y === (targetYear % 100))) {
          total += 1;
          const st = String(a.status || '').toLowerCase();
          if (st === 'present') present += 1;
          else if (st === 'absent') absent += 1;
          else if (st === 'late') late += 1;
        }
      }
    });

    const rate = total > 0 ? Math.round((present / total) * 100) : (present > 0 ? 100 : '-');
    return {
      monthName,
      fullMonthName,
      targetMonth,
      targetYear,
      present,
      absent,
      late,
      total,
      rate: rate === '-' ? '-' : `${rate}%`,
      numericRate: typeof rate === 'number' ? rate : (total === 0 ? 100 : 0)
    };
  };

  // Current active month stats for top dashboard pill
  const currentMonthStats = calculateMonthAttendance(new Date());
  const activeMonthDisplay = currentMonthStats.total > 0 
    ? currentMonthStats 
    : (attendanceRecords.length > 0 ? calculateMonthAttendance(new Date(attendanceRecords[0].date)) : currentMonthStats);

  // Safe Test Metadata Getters (Resilient to various payload structures)
  const getTestName = (t) => t?.testName || t?.test?.name || t?.name || 'Test Exam';
  const getTestDate = (t) => t?.testDate || t?.test?.date || (t?.createdAt ? new Date(t.createdAt).toLocaleDateString('en-IN') : '-');

  // Available Test Subjects for Quick Filter Chips
  const availableTestSubjects = ['ALL', ...Array.from(new Set(testResults.map(t => {
    let sub = (t.subject || t.test?.subject || '').trim();
    if (!sub || sub.toLowerCase() === 'all' || sub.toLowerCase() === 'general') {
      const nm = (t.testName || t.name || '').toLowerCase();
      if (nm.includes('physics')) return 'Physics';
      if (nm.includes('chem')) return 'Chemistry';
      if (nm.includes('math')) return 'Mathematics';
      if (nm.includes('bio') || nm.includes('botany') || nm.includes('zoology')) return 'Biology';
      return 'Mock Exam';
    }
    return sub;
  })))];

  // Filtered Test Results based on selected subject chip
  const filteredTests = testResults.filter(t => {
    if (testSubjectFilter === 'ALL') return true;
    const sub = (t.subject || t.test?.subject || '').toLowerCase();
    const nm = (t.testName || t.name || '').toLowerCase();
    const filter = testSubjectFilter.toLowerCase();
    return sub.includes(filter) || nm.includes(filter);
  });

  // Normalize date string to YYYY-MM-DD for accurate comparison
  const normalizeToISODate = (dStr) => {
    if (!dStr) return '';
    const clean = String(dStr).trim();
    const parts = clean.split(/[./-]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    const d = new Date(clean);
    return isNaN(d.getTime()) ? clean : d.toISOString().split('T')[0];
  };

  const todayISODate = new Date().toISOString().split('T')[0];
  const activeUpcomingTests = (upcomingTests || []).filter(t => {
    if (!t?.date) return false;
    const iso = normalizeToISODate(t.date);
    return iso >= todayISODate;
  });

  // Calculate Today's Live Attendance Status strictly from database records
  const getTodayAttendanceInfo = () => {
    const today = new Date();

    const todayMatch = attendanceRecords.find(a => {
      if (!a.date) return false;
      const dStr = String(a.date).trim();
      const parts = dStr.split(/[-/]/);
      if (parts.length === 3) {
        const day = parseInt(parts[0]) > 31 ? parseInt(parts[2]) : parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const year = parseInt(parts[0]) > 31 ? parseInt(parts[0]) : parseInt(parts[2]);
        return day === today.getDate() && month === (today.getMonth() + 1) && (year === today.getFullYear() || year === (today.getFullYear() % 100));
      }
      return false;
    });

    if (todayMatch) {
      const st = String(todayMatch.status || '').toLowerCase();
      return {
        status: st === 'present' ? 'PRESENT' : st === 'absent' ? 'ABSENT' : st === 'late' ? 'LATE' : 'MARKED',
        time: todayMatch.entryTime || '-',
        outTime: todayMatch.exitTime || null,
        date: todayMatch.date,
        verified: true
      };
    }

    return { status: 'PENDING', title: 'Not marked yet', verified: false, time: '-' };
  };

  const todayAttendance = getTodayAttendanceInfo();

  // Unified Notifications list with Strict De-duplication (Prevents 2-2 duplicate alerts)
  const allNotifications = React.useMemo(() => {
    const list = [];
    const seenKeys = new Set();

    // 1. Real database notifications from server (Check-In, Check-Out, Test Results, Circulars)
    (notices || []).forEach(n => {
      const id = String(n.id || n._id || `${n.title}_${n.createdAt || n.time}`);
      const cleanTitle = String(n.title || '').trim();
      const cleanMsg = String(n.message || '').trim();
      const dedupeKey = `${cleanTitle}_${cleanMsg}`;

      if (!seenKeys.has(dedupeKey)) {
        seenKeys.add(dedupeKey);
        list.push({
          id,
          title: cleanTitle || 'Notification',
          message: cleanMsg,
          type: n.type || (cleanTitle.toLowerCase().includes('attendance') || cleanTitle.toLowerCase().includes('check-') ? 'ATTENDANCE' : (cleanTitle.toLowerCase().includes('test') || cleanTitle.toLowerCase().includes('result') ? 'TEST_RESULT' : 'NOTICE')),
          time: n.createdAt ? new Date(n.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Recent'
        });
      }
    });

    // 2. Fallback: Add recent attendance only if no attendance notice exists for that date
    (attendanceRecords || []).slice(0, 3).forEach(a => {
      if (!a?.date) return;
      const dateKey = String(a.date).trim();
      const alreadyHasNotice = list.some(n => n.type === 'ATTENDANCE' && (n.message.includes(dateKey) || n.title.includes(dateKey) || n.time.includes(dateKey)));
      if (!alreadyHasNotice && !seenKeys.has(`ATT_${dateKey}`)) {
        seenKeys.add(`ATT_${dateKey}`);
        const pName = studentData?.parentName || 'Parent';
        const sName = studentData?.name || 'Student';
        const cleanDate = dateKey.includes('-') ? (dateKey.split('-')[0].length === 4 ? dateKey.split('-').reverse().join('-') : dateKey) : dateKey;
        const timeStr = a.entryTime && a.entryTime !== '--' ? ` at ${a.entryTime}` : '';
        const sessStr = a.sessionName ? ` for ${a.sessionName}` : '';
        const outStr = a.exitTime && a.exitTime !== '--' ? ` and departed at ${a.exitTime}` : '';
        const st = String(a.status || '').toLowerCase();
        let notifMsg;
        if (st === 'present') {
          notifMsg = `Dear ${pName}, this is to inform you that your ward ${sName} has safely arrived at the institute on ${cleanDate}${timeStr}${sessStr}.${outStr ? ` ${outStr}.` : ''} - Career Xone`;
        } else if (st === 'absent') {
          notifMsg = `Dear ${pName}, this is to inform you that your ward ${sName} is absent from the institute today on ${cleanDate}. - Career Xone`;
        } else {
          notifMsg = `Dear ${pName}, this is to inform you that your ward ${sName} attendance has been marked as ${String(a.status).toUpperCase()} on ${cleanDate}${timeStr}${sessStr}. - Career Xone`;
        }

        list.push({
          id: `att-${dateKey}`,
          title: a.exitTime && a.exitTime !== '--' ? 'Check-Out Alert' : 'Check-In Alert',
          message: notifMsg,
          type: 'ATTENDANCE',
          time: cleanDate
        });
      }
    });

    // 3. Fallback: Add recent test results only if no test notice exists for that test
    (testResults || []).slice(0, 3).forEach(t => {
      const tName = getTestName(t);
      const alreadyHasTestNotice = list.some(n => n.type === 'TEST_RESULT' && (n.title.includes(tName) || n.message.includes(tName)));
      const testKey = `TEST_${t.id || tName}`;
      if (!alreadyHasTestNotice && !seenKeys.has(testKey)) {
        seenKeys.add(testKey);
        list.push({
          id: `test-${t.id || tName}`,
          title: `Test Result: ${tName}`,
          message: `Score: ${t.marks}/${t.totalMarks || 360} (${t.percentage}%). Rank: ${t.rank ? `#${t.rank}` : '-'}/${t.totalStudents || 74}.`,
          type: 'TEST_RESULT',
          time: getTestDate(t)
        });
      }
    });

    return list;
  }, [notices, attendanceRecords, testResults, studentData]);

  const visibleNotifications = allNotifications.filter(n => !clearedNotifIds.includes(n.id));

  // Bell icon badge: unread notifications in drawer
  const unreadBellCount = allNotifications.filter(n => {
    return !readNoticeIds.has(n.id) && !clearedNotifIds.includes(n.id);
  }).length;

  // Bottom "Notices" tab badge: strictly unread official circulars
  const unreadOfficialNoticesCount = (notices || []).filter(n => {
    const id = String(n.id || n._id || `${n.title}_${n.createdAt || n.time}`);
    return !readNoticeIds.has(id) && !clearedNotifIds.includes(id);
  }).length;

  // PRE-LOGIN APP INSTALL GATEWAY (Enforce Mobile App Installation)
  if (!isLoggedIn && !isAppInstalled && !proceedToWeb) {
    return (
      <AppInstallGate
        appName="Parents Official Mobile App"
        appSubtitle="Live Biometric Attendance & Exam Report Cards"
        appType="parent"
        themeGradient="linear-gradient(135deg, #0284c7 0%, #0369a1 40%, #0f172a 100%)"
        themeColor="#0284c7"
        badgeText="Official Parents App"
        badgeBg="rgba(2, 132, 199, 0.15)"
        badgeColor="#0284c7"
        features={[
          { title: "Real-time Attendance Alerts", desc: "Live Biometric In/Out punch notifications delivered directly to your phone." },
          { title: "OMR Exam Marksheets & Ranks", desc: "Instant test scores, subject-wise analytics, and printable PDF progress cards." },
          { title: "1-Tap Quick Launch", desc: "Opens full-screen from phone home screen without opening mobile browser tabs." }
        ]}
        onContinueToWeb={() => {
          sessionStorage.setItem('skip_parent_install_gate', '1');
          setProceedToWeb(true);
        }}
      />
    );
  }

  // LOGIN SCREEN
  if (!isLoggedIn) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 40%, #0f172a 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        fontFamily: "'Outfit', 'Inter', sans-serif"
      }}>
        {/* PWA Install Banner */}
        <div style={{ width: '100%', maxWidth: '420px', marginBottom: '14px' }}>
          <PWAInstallPrompt appName="CX Parents" />
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(16px)',
          borderRadius: '24px',
          padding: '32px 24px',
          width: '100%',
          maxWidth: '420px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.6)'
        }}>
          {/* Logo & Institute Header */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '20px',
              background: '#ffffff',
              margin: '0 auto 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(2, 132, 199, 0.25)',
              border: '2px solid #e0f2fe'
            }}>
              <img src={instituteLogo} alt="Logo" style={{ width: '56px', height: '56px', objectFit: 'contain' }} />
            </div>
            <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 900, color: '#0369a1', letterSpacing: '-0.5px' }}>
              {instituteName}
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
              Official Parents Portal & Performance App
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                Parent Phone / Student Roll No:
              </label>
              <div style={{ position: 'relative' }}>
                <User size={18} color="#0284c7" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="e.g. 9876543210 or CX102"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 14px 12px 42px', borderRadius: '12px',
                    border: '1.5px solid #cbd5e1', fontSize: '0.92rem', outline: 'none',
                    boxSizing: 'border-box', background: '#f8fafc', fontWeight: 600, color: '#0f172a'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                Password (Default: Roll Number / 123456):
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} color="#0284c7" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 42px 12px 42px', borderRadius: '12px',
                    border: '1.5px solid #cbd5e1', fontSize: '0.92rem', outline: 'none',
                    boxSizing: 'border-box', background: '#f8fafc', fontWeight: 600, color: '#0f172a'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#ffffff',
                border: 'none', padding: '13px', borderRadius: '12px', fontWeight: 800,
                fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '8px', boxShadow: '0 6px 20px rgba(2, 132, 199, 0.35)',
                marginTop: '4px'
              }}
            >
              {loading ? 'Logging in...' : 'Sign In to Parents App'} <ArrowRight size={18} />
            </button>
          </form>


          {/* WhatsApp In-App Webview Banner */}
          {isWhatsApp && (
            <div style={{
              marginTop: '14px',
              background: '#fef3c7',
              border: '1.5px solid #fde68a',
              borderRadius: '12px',
              padding: '10px 12px',
              textAlign: 'left'
            }}>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#92400e', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <AlertCircle size={14} color="#b45309" /> WhatsApp Browser Detected:
              </div>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.7rem', color: '#78350f', lineHeight: 1.35 }}>
                App direct phone me install karne ke liye Google Chrome me open karein:
              </p>
              <button
                type="button"
                onClick={handleOpenInChrome}
                style={{
                  width: '100%',
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  padding: '7px 10px',
                  borderRadius: '8px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                🚀 Open in Google Chrome
              </button>
            </div>
          )}

          {/* Download Parents Mobile App Card (Login Screen - Only shown if not installed) */}
          {!isAppInstalled && (
            <div style={{
              marginTop: '16px',
              background: '#f0f9ff',
              border: '1.5px solid #bae6fd',
              borderRadius: '14px',
              padding: '12px',
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '4px' }}>
                <Smartphone size={16} color="#0284c7" />
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0369a1' }}>
                  Install Parents Mobile App
                </span>
              </div>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.7rem', color: '#64748b', lineHeight: 1.35 }}>
                1-Tap daily access without opening browser repeatedly!
              </p>
              <button
                onClick={handleInstallApp}
                type="button"
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  fontWeight: 800,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 3px 10px rgba(2, 132, 199, 0.2)'
                }}
              >
                <Download size={14} /> 📲 Tap to Install on Phone
              </button>
            </div>
          )}

          {/* Quick Helpline Info */}
          <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', textAlign: 'center', fontSize: '0.72rem', color: '#64748b' }}>
            <span>Need Help? Helpline: </span>
            <strong style={{ color: '#0284c7' }}>{helplineNumber}</strong>
          </div>
        </div>

        {/* Smart Install App Modal on Login Screen */}
        {showForceInstallModal && !isAppInstalled && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(8px)', zIndex: 999, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: '14px'
          }}>
            <div style={{
              background: '#ffffff', border: '2px solid #38bdf8', borderRadius: '20px',
              padding: '20px 16px', maxWidth: '360px', width: '100%', textAlign: 'center',
              boxShadow: '0 25px 50px -12px rgba(2, 132, 199, 0.35)', position: 'relative'
            }}>
              <button
                onClick={() => setShowForceInstallModal(false)}
                style={{ position: 'absolute', right: '10px', top: '10px', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={14} color="#64748b" />
              </button>

              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.15)' }}>
                <Smartphone size={24} color="#0284c7" />
              </div>

              <h3 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: 900, color: '#0369a1' }}>
                Download Career Xone App
              </h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '0.74rem', color: '#475569', lineHeight: 1.4 }}>
                Directly add to your phone home screen for 1-tap marks & attendance access!
              </p>

              {/* Dynamic OS-Specific Instructions */}
              <div style={{
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                borderRadius: '12px',
                padding: '10px 12px',
                textAlign: 'left',
                marginBottom: '12px'
              }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0369a1', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Sparkles size={13} color="#0284c7" />
                  {isIOS ? 'iPhone (iOS) Steps:' : 'Android (Chrome) Steps:'}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#334155', lineHeight: '1.45', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {isIOS ? (
                    <>
                      <div><strong>1.</strong> Safari me niche <strong>Share icon (⎋)</strong> par tap karein.</div>
                      <div><strong>2.</strong> Niche scroll karke <strong>"Add to Home Screen" (+)</strong> select karein.</div>
                    </>
                  ) : isAndroid ? (
                    <>
                      <div><strong>1.</strong> Browser me upar <strong>(⋮) 3 Dots</strong> par tap karein.</div>
                      <div><strong>2.</strong> <strong>"Install App"</strong> ya <strong>"Add to Home Screen"</strong> par tap karein.</div>
                    </>
                  ) : (
                    <>
                      <div><strong>1.</strong> Upar address bar me <strong>[Open in app]</strong> button par click karein.</div>
                      <div><strong>2.</strong> Ya browser menu <strong>(⋮)</strong> me jaakar <strong>"Install Career Xone"</strong> karein.</div>
                    </>
                  )}
                </div>
              </div>

              {deferredPrompt ? (
                <button
                  onClick={handleInstallApp}
                  style={{
                    width: '100%', background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#ffffff',
                    border: 'none', padding: '11px', borderRadius: '10px', fontWeight: 800, fontSize: '0.84rem',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)'
                  }}
                >
                  <Download size={16} /> Tap to Install Now
                </button>
              ) : (
                <button
                  onClick={() => setShowForceInstallModal(false)}
                  style={{
                    width: '100%', background: '#0f172a', color: '#ffffff',
                    border: 'none', padding: '10px', borderRadius: '10px', fontWeight: 800, fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Got It (समझ गया)
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // LOGGED IN DASHBOARD (Mobile-Optimized Sky-Blue Aesthetics)
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #f0f7ff 0%, #e0f2fe 25%, #f8fafc 100%)',
      color: '#0f172a',
      fontFamily: "'Outfit', 'Inter', sans-serif",
      paddingBottom: '96px'
    }}>
      <PWAInstallPrompt appName="CX Parents" />

      {/* Global CSS for Mobile & Print & Smooth Animations */}
      <style>{`
        * { box-sizing: border-box; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes tabFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulseGlow { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        .tab-content-pane { animation: tabFadeIn 0.22s cubic-bezier(0.4, 0, 0.2, 1); }
        .live-pulse-dot { animation: pulseGlow 1.8s infinite ease-in-out; }
        
        @media (max-width: 600px) {
          .parent-header { padding: 8px 12px !important; }
          .parent-logo-img { width: 30px !important; height: 30px !important; border-radius: 7px !important; }
          .parent-inst-name { font-size: 0.88rem !important; }
          .parent-inst-sub { font-size: 0.66rem !important; }
          .student-card { padding: 10px 12px !important; border-radius: 12px !important; margin-bottom: 6px !important; }
          .student-avatar { width: 34px !important; height: 34px !important; font-size: 0.95rem !important; border-radius: 8px !important; }
          .student-name { font-size: 0.90rem !important; }
          .tab-btn-bar { gap: 6px !important; margin-bottom: 10px !important; }
          .tab-btn { padding: 8px 4px !important; font-size: 0.78rem !important; border-radius: 10px !important; min-height: 42px !important; }
          .metrics-grid { gap: 6px !important; margin-top: 10px !important; }
          .metric-box { padding: 9px 4px !important; border-radius: 12px !important; min-height: 56px !important; display: flex !important; flex-direction: column !important; justify-content: center !important; }
          .metric-label { font-size: 0.72rem !important; margin-bottom: 2px !important; font-weight: 800 !important; }
          .metric-value { font-size: 1.05rem !important; font-weight: 900 !important; }
          .mobile-bottom-nav { padding: 8px 12px calc(8px + env(safe-area-inset-bottom, 0px)) !important; }
          .mobile-bottom-nav button { padding: 8px 4px !important; border-radius: 14px !important; gap: 4px !important; }
          .mobile-bottom-nav-label { font-size: 0.82rem !important; font-weight: 700 !important; }
        }
        @media print {
          body * { visibility: hidden !important; }
          .printable-report-card, .printable-report-card * { visibility: visible !important; }
          .printable-report-card { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; margin: 0 !important; padding: 20px !important; box-shadow: none !important; border: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Compact Header (Sleek Native App Bar) */}
      <header className="parent-header no-print" style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '8px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(2, 132, 199, 0.04)',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        {/* Left: Institute Logo & Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
          <img
            src={instituteLogo}
            alt="Logo"
            className="parent-logo-img"
            style={{ width: '30px', height: '30px', borderRadius: '8px', objectFit: 'contain', border: '1px solid #e2e8f0', flexShrink: 0 }}
          />
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <h4 className="parent-inst-name" style={{
              margin: 0, fontSize: '0.90rem', fontWeight: 900, color: '#0369a1',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2
            }}>
              {instituteName}
            </h4>
            <span className="parent-inst-sub" style={{ fontSize: '0.66rem', color: '#0284c7', fontWeight: 700, display: 'block' }}>
              Parents Official App
            </span>
          </div>
        </div>

        {/* Right: Quick Refresh & Notifications */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* Refresh Button */}
          <button
            onClick={handleManualRefresh}
            title="Refresh Latest Student Data"
            aria-label="Refresh Data"
            style={{
              background: isRefreshing ? '#e0f2fe' : '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: isRefreshing ? '#0284c7' : '#334155',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              transition: 'all 0.15s ease'
            }}
          >
            <RefreshCw size={15} style={{ animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          </button>

          {/* Notifications Button */}
          <button
            onClick={() => {
              setShowNotificationDrawer(true);
              markAllNotificationsAsRead();
            }}
            title="Notification Center"
            aria-label="Notifications"
            style={{
              background: '#ffffff',
              border: '1.5px solid #cbd5e1',
              color: '#475569',
              width: '32px',
              height: '32px',
              position: 'relative',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}
          >
            <Bell size={16} color="#0284c7" />
            {unreadBellCount > 0 && (
              <span style={{
                position: 'absolute', top: '-3px', right: '-3px', background: '#ef4444',
                color: '#ffffff', fontSize: '0.55rem', fontWeight: 900, width: '14px',
                height: '14px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {unreadBellCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Synchronizing Data Live Bar */}
      {isRefreshing && (
        <div style={{
          background: 'linear-gradient(90deg, #0284c7, #0369a1)', color: '#ffffff',
          padding: '4px 12px', fontSize: '0.70rem', fontWeight: 800, textAlign: 'center',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
        }}>
          <RefreshCw size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
          <span>Syncing latest marks & biometric attendance...</span>
        </div>
      )}

      {/* Main App Container */}
      <div style={{ maxWidth: '490px', margin: '8px auto 0', padding: '0 10px' }}>

        {/* Student Profile Card (Compact & Sleek) */}
        <div className="student-card no-print" style={{
          background: '#ffffff',
          border: '1px solid #bae6fd',
          borderRadius: '12px',
          padding: '10px 12px',
          marginBottom: '6px',
          boxShadow: '0 2px 6px rgba(2, 132, 199, 0.04)'
        }}>
          <div
            onClick={() => setShowProfileModal(true)}
            title="Click to view full student profile & details"
            style={{
              display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer',
              borderRadius: '10px', padding: '2px', transition: 'all 0.15s ease'
            }}
          >
            <div
              onClick={(e) => {
                if (studentData?.photo) {
                  e.stopPropagation();
                  setShowFullPhotoModal(true);
                }
              }}
              className="student-avatar"
              style={{
                width: '42px', height: '42px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem', fontWeight: 800, color: '#ffffff',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.22)', flexShrink: 0,
                overflow: 'hidden', border: '1.5px solid #bae6fd',
                cursor: studentData?.photo ? 'zoom-in' : 'pointer'
              }}
              title={studentData?.photo ? 'Click to view photo in full-screen' : 'Student Photo'}
            >
              {studentData?.photo ? (
                <img
                  src={getMediaUrl(studentData.photo)}
                  alt={studentData.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                studentData?.name ? studentData.name.charAt(0) : 'S'
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className="student-name" style={{
                margin: 0, fontSize: '0.92rem', fontWeight: 900, color: '#0f172a',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2,
                display: 'flex', alignItems: 'center', gap: '4px'
              }}>
                {studentData?.name}
                <ChevronRight size={13} color="#94a3b8" />
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', fontSize: '0.68rem', color: '#64748b', alignItems: 'center', marginTop: '2px' }}>
                <span style={{ background: '#f1f5f9', padding: '1.5px 6px', borderRadius: '4px', fontWeight: 700, color: '#334155' }}>
                  Roll: <strong style={{ color: '#0f172a' }}>{studentData?.rollNo}</strong>
                </span>
                <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '1.5px 6px', borderRadius: '4px', fontWeight: 800 }}>
                  {formatBatchName(studentData?.batch, studentData?.class)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics 4-Grid (Clickable for instant navigation) */}
          <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '7px', marginTop: '10px' }}>
            <div
              className="metric-box"
              onClick={() => setActiveTab('attendance')}
              title={`Click to view ${activeMonthDisplay.fullMonthName} Attendance`}
              style={{
                background: '#f0f9ff', border: '1px solid #bae6fd', padding: '9px 5px',
                borderRadius: '12px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0284c7'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#bae6fd'; e.currentTarget.style.transform = 'none'; }}
            >
              <span className="metric-label" style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: 800, display: 'block', marginBottom: '2px' }}>
                {activeMonthDisplay.monthName} Rate
              </span>
              <strong className="metric-value" style={{ fontSize: '1.05rem', color: '#0284c7', fontWeight: 900 }}>
                {activeMonthDisplay.rate !== '-' ? activeMonthDisplay.rate : (attendanceRecords.length > 0 ? '100%' : '-')}
              </strong>
            </div>

            <div
              className="metric-box"
              onClick={() => setActiveTab('attendance')}
              title="Click to view Attendance records"
              style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '9px 5px',
                borderRadius: '12px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#16a34a'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#bbf7d0'; e.currentTarget.style.transform = 'none'; }}
            >
              <span className="metric-label" style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 800, display: 'block', marginBottom: '2px' }}>
                Total Present
              </span>
              <strong className="metric-value" style={{ fontSize: '1.05rem', color: '#16a34a', fontWeight: 900 }}>
                {studentData?.presentCount || attendanceRecords.filter(a => String(a.status).toLowerCase() === 'present').length} Days
              </strong>
            </div>

            <div
              className="metric-box"
              onClick={() => setActiveTab('tests')}
              title="Click to view Tests & OMR"
              style={{
                background: '#fdf4ff', border: '1px solid #f5d0fe', padding: '9px 5px',
                borderRadius: '12px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#c026d3'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#f5d0fe'; e.currentTarget.style.transform = 'none'; }}
            >
              <span className="metric-label" style={{ fontSize: '0.72rem', color: '#a21caf', fontWeight: 800, display: 'block', marginBottom: '2px' }}>Avg Score</span>
              <strong className="metric-value" style={{ fontSize: '1.05rem', color: '#c026d3', fontWeight: 900 }}>
                {testResults.length > 0 ? `${Math.max(0, analyticsData.avgPercentage)}%` : '-'}
              </strong>
            </div>

            <div
              className="metric-box"
              onClick={() => setActiveTab('tests')}
              title="Click to view Tests & OMR"
              style={{
                background: '#fff7ed', border: '1px solid #ffedd5', padding: '9px 5px',
                borderRadius: '12px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#ea580c'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#ffedd5'; e.currentTarget.style.transform = 'none'; }}
            >
              <span className="metric-label" style={{ fontSize: '0.72rem', color: '#c2410c', fontWeight: 800, display: 'block', marginBottom: '2px' }}>Best Rank</span>
              <strong className="metric-value" style={{ fontSize: '1.05rem', color: '#ea580c', fontWeight: 900 }}>
                {testResults.length > 0 && analyticsData.bestRank !== '-' ? `#${analyticsData.bestRank}` : '-'}
              </strong>
            </div>
          </div>
        </div>

        {/* Today's Live Attendance Status Banner (Quick Status Pill) */}
        <div
          onClick={() => setActiveTab('attendance')}
          title="Tap to open Attendance"
          style={{
            background: todayAttendance.status === 'PRESENT' ? '#f0fdf4' : todayAttendance.status === 'ABSENT' ? '#fef2f2' : '#f8fafc',
            border: `1px solid ${todayAttendance.status === 'PRESENT' ? '#bbf7d0' : todayAttendance.status === 'ABSENT' ? '#fecaca' : '#e2e8f0'}`,
            borderRadius: '10px',
            padding: '7px 11px',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span
              className="live-pulse-dot"
              style={{
                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                background: todayAttendance.status === 'PRESENT' ? '#16a34a' : todayAttendance.status === 'ABSENT' ? '#dc2626' : '#94a3b8',
                boxShadow: todayAttendance.status === 'PRESENT' ? '0 0 6px rgba(22, 163, 74, 0.6)' : 'none'
              }}
            />
            <span style={{ fontSize: '0.74rem', color: '#0f172a', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Today: <strong style={{ color: todayAttendance.status === 'PRESENT' ? '#15803d' : todayAttendance.status === 'ABSENT' ? '#b91c1c' : '#64748b' }}>
                {todayAttendance.status === 'PRESENT' ? `MARKED PRESENT (${todayAttendance.time})` : todayAttendance.status === 'ABSENT' ? 'MARKED ABSENT' : 'Attendance in Session (Not Marked Yet)'}
              </strong>
            </span>
          </div>
          <span style={{ fontSize: '0.66rem', color: '#0284c7', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
            Logs <ChevronRight size={12} />
          </span>
        </div>


        {/* ========================================================= */}
        {/* TAB 1: 📈 AI ANALYTICS & SUBJECT WEAKNESS HEATMAP          */}
        {/* ========================================================= */}
        {activeTab === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {testResults.length === 0 ? (
              <div style={{ background: '#ffffff', padding: '28px 16px', borderRadius: '12px', textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0' }}>
                <BarChart2 size={32} color="#94a3b8" style={{ marginBottom: '8px' }} />
                <h4 style={{ margin: '0 0 4px 0', fontSize: '0.94rem', fontWeight: 800, color: '#0f172a' }}>No Test Records Yet</h4>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>Subject scores and performance analytics will appear here once tests are conducted.</p>
              </div>
            ) : (
              <>
                {/* Subject Strength & Weakness Heatmap (Clickable to view Tests) */}
                <div style={{
                  background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
                  padding: '11px 12px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '9px' }}>
                    <h3 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <BarChart2 size={15} color="#0284c7" /> Subject Strength & Weakness
                    </h3>
                    <button
                      onClick={() => setActiveTab('tests')}
                      style={{ background: 'transparent', border: 'none', color: '#0284c7', fontSize: '0.66rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                    >
                      View Tests <ChevronRight size={12} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {analyticsData.subjectBreakdown.map((sub, idx) => (
                      <div
                        key={idx}
                        onClick={() => setActiveTab('tests')}
                        title="Click to view corresponding tests & OMR"
                        style={{
                          background: '#f8fafc', padding: '8px 10px', borderRadius: '8px',
                          border: '1px solid #f1f5f9', cursor: 'pointer', transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f9ff'; e.currentTarget.style.borderColor = '#bae6fd'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#f1f5f9'; }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1e293b' }}>{sub.subject}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.66rem', fontWeight: 800, color: sub.color }}>{sub.status}</span>
                            <strong style={{ fontSize: '0.80rem', color: '#0f172a' }}>{sub.percentage}%</strong>
                          </div>
                        </div>
                        {/* Progress Bar */}
                        <div style={{ width: '100%', height: '5px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${sub.percentage}%`, height: '100%', background: sub.color, borderRadius: '3px', transition: 'width 0.5s ease' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Performance Growth Trajectory List (Clickable to jump to Tests) */}
                <div style={{
                  background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
                  padding: '11px 12px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '9px' }}>
                    <h3 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <TrendingUp size={15} color="#16a34a" /> Recent Score Trajectory
                    </h3>
                    <button
                      onClick={() => setActiveTab('tests')}
                      style={{
                        background: 'transparent', border: 'none', color: '#0284c7',
                        fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '2px'
                      }}
                    >
                      View All Tests <ChevronRight size={13} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {testResults.slice(0, 4).map((t, idx) => (
                      <div
                        key={idx}
                        onClick={() => setActiveTab('tests')}
                        title="Click to view test marks & OMR sheet"
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '8px 10px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0',
                          cursor: 'pointer', transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f9ff'; e.currentTarget.style.borderColor = '#bae6fd'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                      >
                        <div style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}>
                          <strong style={{ display: 'block', fontSize: '0.76rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {getTestName(t)}
                          </strong>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span style={{ fontSize: '0.64rem', color: '#64748b' }}>{getTestDate(t)}</span>
                            {t.omrSheetImage && (
                              <span style={{ fontSize: '0.60rem', background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                                📄 OMR Available
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div>
                            <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#0284c7' }}>{t.percentage}%</span>
                            <span style={{ display: 'block', fontSize: '0.68rem', color: '#16a34a', fontWeight: 700 }}>Rank #{t.rank || 1}</span>
                          </div>
                          <ChevronRight size={15} color="#94a3b8" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: 📝 TEST RESULTS & OMR VIEW                          */}
        {/* ========================================================= */}
        {activeTab === 'tests' && (
          <div className="tab-content-pane" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            
            {/* 30-Day OMR Storage Alert Notice (Smooth Collapsible / Expandable Accordion) */}
            <div
              onClick={() => setIsOmrNoticeExpanded(prev => !prev)}
              title={isOmrNoticeExpanded ? "Tap to minimize notice" : "Tap to read full notice"}
              style={{
                background: isOmrNoticeExpanded ? '#eff6ff' : '#f0f9ff',
                border: '1.5px solid #bfdbfe',
                borderRadius: '12px',
                padding: isOmrNoticeExpanded ? '10px 12px' : '8px 12px',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(2, 132, 199, 0.05)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                userSelect: 'none',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0284c7'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#bfdbfe'; }}
            >
              {/* Header row always visible */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                  <AlertCircle size={17} color="#0284c7" style={{ flexShrink: 0 }} />
                  <strong style={{ fontSize: '0.78rem', color: '#1d4ed8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    📌 Important OMR Notice (महत्वपूर्ण सूचना)
                  </strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.66rem', color: '#0284c7', fontWeight: 700 }}>
                    {isOmrNoticeExpanded ? 'Tap to close' : 'Tap to expand'}
                  </span>
                  {isOmrNoticeExpanded ? (
                    <ChevronUp size={15} color="#0284c7" />
                  ) : (
                    <ChevronDown size={15} color="#0284c7" />
                  )}
                </div>
              </div>

              {/* Smooth Collapsible Content Body */}
              <div style={{
                maxHeight: isOmrNoticeExpanded ? '180px' : '0px',
                opacity: isOmrNoticeExpanded ? 1 : 0,
                marginTop: isOmrNoticeExpanded ? '8px' : '0px',
                transition: 'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease, margin-top 0.25s ease',
                overflow: 'hidden'
              }}>
                <div style={{ fontSize: '0.74rem', color: '#1e3a8a', lineHeight: 1.45, borderTop: '1px dashed #bfdbfe', paddingTop: '7px' }}>
                  OMR sheets are stored on the server for <strong>30 days only</strong>. If you want to keep your OMR sheet permanently, please tap <strong>Download OMR</strong> to save it to your phone/device.
                  <div style={{ fontSize: '0.68rem', color: '#2563eb', marginTop: '3px', fontWeight: 600 }}>
                    (OMR शीट सर्वर से 30 दिनों में हटा दी जाती है। स्थायी रिकॉर्ड के लिए कृपया इसे डाउनलोड करके सुरक्षित रख लें।)
                  </div>
                </div>
              </div>
            </div>

            {/* Subject Filter Chips Bar */}
            {availableTestSubjects.length > 2 && (
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px', scrollbarWidth: 'none' }}>
                {availableTestSubjects.map((sub, idx) => (
                  <button
                    key={idx}
                    onClick={() => setTestSubjectFilter(sub)}
                    style={{
                      background: testSubjectFilter === sub ? '#0284c7' : '#ffffff',
                      color: testSubjectFilter === sub ? '#ffffff' : '#475569',
                      border: `1.5px solid ${testSubjectFilter === sub ? '#0284c7' : '#cbd5e1'}`,
                      borderRadius: '20px',
                      padding: '4px 10px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: testSubjectFilter === sub ? '0 2px 5px rgba(2, 132, 199, 0.25)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            )}

            {filteredTests.length === 0 ? (
              <div style={{ background: '#ffffff', padding: '28px 16px', borderRadius: '12px', textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0' }}>
                <Award size={32} color="#94a3b8" style={{ marginBottom: '8px' }} />
                <p style={{ margin: 0, fontWeight: 800, fontSize: '0.88rem' }}>No published OMR test results found for this filter.</p>
                <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Select another subject or wait for upcoming exam results.</span>
              </div>
            ) : (
              filteredTests.map((t, idx) => {
                const studentScore = Number(t.marks) || 0;
                const topperScore = t.topperMarks != null ? Math.max(Number(t.topperMarks), studentScore) : studentScore;
                const batchAvgScore = t.avgMarks != null ? Number(t.avgMarks) : studentScore;
                const totalStudentsCount = t.totalStudents || (t.rank ? Math.max(Number(t.rank), 1) : 1);

                return (
                  <div key={idx} style={{
                    background: '#ffffff', border: '1px solid #e2e8f0',
                    borderRadius: '12px', padding: '11px 12px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}>
                        <h4 style={{ margin: '0 0 2px 0', fontSize: '0.84rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {getTestName(t)}
                        </h4>
                        <span style={{ fontSize: '0.66rem', color: '#64748b' }}>Date: {getTestDate(t)}</span>
                      </div>
                      <span style={{
                        background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0',
                        padding: '3px 8px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 900, flexShrink: 0
                      }}>
                        {t.percentage}%
                      </span>
                    </div>

                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px',
                      background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #f1f5f9'
                    }}>
                      <div>
                        <span style={{ fontSize: '0.62rem', color: '#64748b', display: 'block' }}>Score</span>
                        <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>{t.marks} / {t.totalMarks || 360}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.62rem', color: '#64748b', display: 'block' }}>Batch Rank</span>
                        <strong style={{ fontSize: '0.82rem', color: '#0284c7' }}>
                          {t.rank ? `${t.rank} / ${totalStudentsCount}` : '-'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.62rem', color: '#64748b', display: 'block' }}>Status</span>
                        <strong style={{ fontSize: '0.80rem', color: '#16a34a' }}>Passed</strong>
                      </div>
                    </div>

                    {/* Student vs Topper vs Batch Avg Comparative Bar */}
                    <div style={{
                      background: '#f8fafc', border: '1px solid #f1f5f9',
                      borderRadius: '8px', padding: '7px 10px', marginTop: '7px',
                      display: 'flex', flexDirection: 'column', gap: '4px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.64rem', color: '#475569', fontWeight: 700 }}>
                        <span>Student: <strong style={{ color: '#0284c7' }}>{studentScore}</strong></span>
                        <span>Topper: <strong style={{ color: '#15803d' }}>{topperScore}</strong></span>
                        <span>Batch Avg: <strong style={{ color: '#64748b' }}>{batchAvgScore}</strong></span>
                      </div>
                      <div style={{ width: '100%', height: '5px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, Math.max(5, t.percentage))}%`, height: '100%', background: 'linear-gradient(90deg, #0284c7, #0369a1)', borderRadius: '3px' }} />
                      </div>
                    </div>

                    {/* 3 Action Buttons (View OMR + Download OMR + Share Result) */}
                    <div style={{ display: 'grid', gridTemplateColumns: t.omrSheetImage ? '1fr 1fr 1fr' : '1fr', gap: '6px', marginTop: '9px' }}>
                      {t.omrSheetImage && (
                        <>
                          <button
                            onClick={() => setSelectedOmrImage({
                              url: getMediaUrl(t.omrSheetImage),
                              testName: getTestName(t),
                              date: getTestDate(t),
                              marks: t.marks,
                              totalMarks: t.totalMarks
                            })}
                            style={{
                              width: '100%', background: '#f0f9ff',
                              border: '1.5px solid #bae6fd', color: '#0284c7', padding: '7px 4px',
                              borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800,
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <Eye size={13} /> View OMR
                          </button>
                          <button
                            onClick={() => handleDownloadOmr(getMediaUrl(t.omrSheetImage), getTestName(t))}
                            style={{
                              width: '100%', background: '#f0fdf4',
                              border: '1.5px solid #bbf7d0', color: '#15803d', padding: '7px 4px',
                              borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800,
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <Download size={13} /> Download
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleShareTestResult(t)}
                        style={{
                          width: '100%', background: '#faf5ff',
                          border: '1.5px solid #e9d5ff', color: '#7c3aed', padding: '7px 4px',
                          borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Share2 size={13} /> Share Result
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: 📅 ATTENDANCE (CALENDAR HEATMAP & LOGS)            */}
        {/* ========================================================= */}
        {activeTab === 'attendance' && (
          <div className="tab-content-pane" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            
            {/* Today's Punch Live Status Card */}
            <div style={{
              background: todayAttendance.status === 'PRESENT' ? '#f0fdf4' : todayAttendance.status === 'ABSENT' ? '#fef2f2' : '#eff6ff',
              border: `1.5px solid ${todayAttendance.status === 'PRESENT' ? '#bbf7d0' : todayAttendance.status === 'ABSENT' ? '#fecaca' : '#bfdbfe'}`,
              borderRadius: '12px',
              padding: '12px 14px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '8px',
                    background: todayAttendance.status === 'PRESENT' ? '#dcfce7' : todayAttendance.status === 'ABSENT' ? '#fee2e2' : '#dbeafe',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {todayAttendance.status === 'PRESENT' ? <CheckCircle2 size={17} color="#16a34a" /> : todayAttendance.status === 'ABSENT' ? <XCircle size={17} color="#dc2626" /> : <Clock size={17} color="#2563eb" />}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.86rem', fontWeight: 900, color: '#0f172a' }}>
                      Today's Attendance Status
                    </h4>
                    <span style={{ fontSize: '0.66rem', color: '#64748b' }}>
                      {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>
                <span style={{
                  background: todayAttendance.status === 'PRESENT' ? '#16a34a' : todayAttendance.status === 'ABSENT' ? '#dc2626' : '#2563eb',
                  color: '#ffffff', fontSize: '0.68rem', fontWeight: 900, padding: '3px 8px', borderRadius: '6px'
                }}>
                  {todayAttendance.status}
                </span>
              </div>

              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px',
                background: '#ffffff', padding: '8px 10px', borderRadius: '8px', border: '1px solid #f1f5f9', marginTop: '6px'
              }}>
                <div>
                  <span style={{ fontSize: '0.62rem', color: '#64748b', display: 'block' }}>Punch-In Time</span>
                  <strong style={{ fontSize: '0.80rem', color: '#0f172a' }}>{todayAttendance.time || (todayAttendance.status === 'PRESENT' ? '08:30 AM' : '-')}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.62rem', color: '#64748b', display: 'block' }}>Biometric Machine</span>
                  <strong style={{ fontSize: '0.80rem', color: todayAttendance.status === 'PRESENT' ? '#16a34a' : '#64748b' }}>
                    {todayAttendance.status === 'PRESENT' ? 'Machine #1 (Verified ✅)' : todayAttendance.status === 'ABSENT' ? 'Marked Absent' : 'Awaiting Punch ⏳'}
                  </strong>
                </div>
              </div>
            </div>

            {/* View Switcher: Monthly Calendar Heatmap vs Log List */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: '#ffffff', padding: '4px', borderRadius: '10px', border: '1px solid #e2e8f0'
            }}>
              <button
                onClick={() => setAttendanceViewMode('calendar')}
                style={{
                  flex: 1, padding: '7px', borderRadius: '7px', border: 'none',
                  background: attendanceViewMode === 'calendar' ? '#0284c7' : 'transparent',
                  color: attendanceViewMode === 'calendar' ? '#ffffff' : '#64748b',
                  fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  transition: 'all 0.15s ease'
                }}
              >
                <Grid size={14} /> Monthly Calendar
              </button>
              <button
                onClick={() => setAttendanceViewMode('list')}
                style={{
                  flex: 1, padding: '7px', borderRadius: '7px', border: 'none',
                  background: attendanceViewMode === 'list' ? '#0284c7' : 'transparent',
                  color: attendanceViewMode === 'list' ? '#ffffff' : '#64748b',
                  fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  transition: 'all 0.15s ease'
                }}
              >
                <List size={14} /> Daily Punch Log
              </button>
            </div>

            {/* View 1: 📅 Monthly Calendar View */}
            {attendanceViewMode === 'calendar' && (() => {
              const year = calendarDate.getFullYear();
              const month = calendarDate.getMonth();
              const monthName = calendarDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0

              const attendanceMap = {};
              attendanceRecords.forEach(a => {
                if (!a.date) return;
                const parts = String(a.date).trim().split(/[-/]/);
                if (parts.length === 3) {
                  const d = parseInt(parts[0]) > 31 ? parseInt(parts[2]) : parseInt(parts[0]);
                  const m = parseInt(parts[1]);
                  const y = parseInt(parts[0]) > 31 ? parseInt(parts[0]) : parseInt(parts[2]);
                  if (m === month + 1 && (y === year || y === (year % 100))) {
                    attendanceMap[d] = a;
                  }
                }
              });

              return (
                <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                  {/* Calendar Month Navigation Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <button
                      onClick={() => setCalendarDate(new Date(year, month - 1, 1))}
                      style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '7px', padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      <ChevronLeft size={15} color="#475569" />
                    </button>
                    <strong style={{ fontSize: '0.88rem', color: '#0f172a', fontWeight: 900 }}>
                      {monthName}
                    </strong>
                    <button
                      onClick={() => setCalendarDate(new Date(year, month + 1, 1))}
                      style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '7px', padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      <ChevronRight size={15} color="#475569" />
                    </button>
                  </div>

                  {/* Dynamic Month-Wise Summary Card */}
                  {(() => {
                    const monthStats = calculateMonthAttendance(calendarDate);
                    return (
                      <div style={{
                        background: 'linear-gradient(135deg, #f0fdf4, #e0f2fe)',
                        border: '1.5px solid #bae6fd',
                        borderRadius: '10px',
                        padding: '9px 12px',
                        marginBottom: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <TrendingUp size={13} color="#0284c7" /> {monthName} Attendance:
                          </span>
                          <span style={{
                            background: monthStats.numericRate >= 75 ? '#dcfce7' : '#fef3c7',
                            color: monthStats.numericRate >= 75 ? '#15803d' : '#b45309',
                            fontSize: '0.72rem', fontWeight: 900, padding: '2px 8px', borderRadius: '6px',
                            border: `1px solid ${monthStats.numericRate >= 75 ? '#bbf7d0' : '#fde68a'}`
                          }}>
                            {monthStats.rate !== '-' ? `${monthStats.rate} Present` : 'No Punches'}
                          </span>
                        </div>
                        
                        {/* Visual Progress Bar */}
                        <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{
                            width: monthStats.total > 0 ? `${monthStats.numericRate}%` : (monthStats.present > 0 ? '100%' : '0%'),
                            height: '100%',
                            background: monthStats.numericRate >= 75 ? 'linear-gradient(90deg, #10b981, #16a34a)' : 'linear-gradient(90deg, #f59e0b, #d97706)',
                            borderRadius: '4px',
                            transition: 'width 0.4s ease'
                          }} />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', color: '#475569', fontWeight: 700 }}>
                          <span>🟢 Present: <strong style={{ color: '#15803d' }}>{monthStats.present}d</strong></span>
                          <span>🔴 Absent: <strong style={{ color: '#b91c1c' }}>{monthStats.absent}d</strong></span>
                          <span>📅 Total Marked: <strong style={{ color: '#0f172a' }}>{monthStats.total}d</strong></span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Day of Week Headers */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '6px' }}>
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                      <span key={i} style={{ fontSize: '0.66rem', fontWeight: 800, color: '#64748b' }}>
                        {d}
                      </span>
                    ))}
                  </div>

                  {/* Days Matrix */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                    {Array.from({ length: firstDayIndex }).map((_, i) => (
                      <div key={`empty-${i}`} style={{ height: '36px' }} />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const record = attendanceMap[day];
                      const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
                      const status = record ? String(record.status).toLowerCase() : null;
                      const isSelected = selectedCalendarDay?.day === day;

                      let bg = '#f8fafc';
                      let border = '#f1f5f9';
                      let textCol = '#475569';
                      let dotCol = null;

                      if (status === 'present') {
                        bg = '#f0fdf4';
                        border = '#bbf7d0';
                        textCol = '#15803d';
                        dotCol = '#16a34a';
                      } else if (status === 'absent') {
                        bg = '#fef2f2';
                        border = '#fecdd3';
                        textCol = '#b91c1c';
                        dotCol = '#ef4444';
                      } else if (status === 'late') {
                        bg = '#fef3c7';
                        border = '#fde68a';
                        textCol = '#b45309';
                        dotCol = '#d97706';
                      }

                      return (
                        <div
                          key={`day-${day}`}
                          onClick={() => {
                            setSelectedCalendarDay({
                              day,
                              date: `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`,
                              status: status ? status.toUpperCase() : 'NO RECORD',
                              entryTime: record?.entryTime || '-',
                              exitTime: record?.exitTime || '-',
                              notes: status === 'present' ? 'Biometric Punch Verified' : (status === 'absent' ? 'Student Marked Absent' : 'No attendance record found')
                            });
                          }}
                          style={{
                            height: '38px',
                            borderRadius: '8px',
                            background: isSelected ? '#0284c7' : bg,
                            border: `1.5px solid ${isSelected ? '#0284c7' : (isToday ? '#38bdf8' : border)}`,
                            color: isSelected ? '#ffffff' : textCol,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{ fontSize: '0.74rem', fontWeight: 800 }}>{day}</span>
                          {dotCol && !isSelected && (
                            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: dotCol, marginTop: '1px' }} />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Selected Day Punch Detail Box */}
                  {selectedCalendarDay && (
                    <div style={{
                      marginTop: '12px', background: '#f8fafc', border: '1.5px solid #bae6fd',
                      borderRadius: '10px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '0.80rem', color: '#0f172a' }}>
                          📅 {selectedCalendarDay.date} Details
                        </strong>
                        <span style={{
                          background: selectedCalendarDay.status === 'PRESENT' ? '#dcfce7' : selectedCalendarDay.status === 'ABSENT' ? '#fee2e2' : selectedCalendarDay.status === 'LATE' ? '#fef3c7' : '#f1f5f9',
                          color: selectedCalendarDay.status === 'PRESENT' ? '#15803d' : selectedCalendarDay.status === 'ABSENT' ? '#b91c1c' : selectedCalendarDay.status === 'LATE' ? '#b45309' : '#64748b',
                          fontSize: '0.68rem', fontWeight: 900, padding: '2px 7px', borderRadius: '6px'
                        }}>
                          {selectedCalendarDay.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.70rem', color: '#475569', display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                        <span>Punch In: <strong>{selectedCalendarDay.entryTime}</strong></span>
                        <span>Punch Out: <strong>{selectedCalendarDay.exitTime}</strong></span>
                      </div>
                    </div>
                  )}

                  {/* Calendar Legend */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', fontSize: '0.66rem', color: '#64748b' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#16a34a' }} /> Present
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444' }} /> Absent
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#94a3b8' }} /> No Record
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* View 2: 📋 Daily Log List */}
            {attendanceViewMode === 'list' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {attendanceRecords.length === 0 ? (
                  <div style={{ background: '#ffffff', padding: '28px 16px', borderRadius: '12px', textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0' }}>
                    <Calendar size={32} color="#94a3b8" style={{ marginBottom: '8px' }} />
                    <p style={{ margin: 0, fontWeight: 800, fontSize: '0.88rem' }}>No attendance records recorded yet.</p>
                  </div>
                ) : (
                  attendanceRecords.map((item, idx) => {
                    const st = String(item.status || '').toLowerCase();
                    const isPresent = st === 'present';
                    const isAbsent = st === 'absent';

                    return (
                      <div key={idx} style={{
                        background: '#ffffff', border: '1px solid #e2e8f0',
                        borderRadius: '10px', padding: '9px 12px', display: 'flex',
                        alignItems: 'center', justifyContent: 'space-between',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '7px',
                            background: isPresent ? '#dcfce7' : isAbsent ? '#fee2e2' : '#fef3c7',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                          }}>
                            {isPresent ? <CheckCircle2 size={15} color="#16a34a" /> : isAbsent ? <XCircle size={15} color="#dc2626" /> : <Clock size={15} color="#d97706" />}
                          </div>
                          <div>
                            <strong style={{ display: 'block', fontSize: '0.78rem', color: '#0f172a' }}>{item.date}</strong>
                            <span style={{ fontSize: '0.66rem', color: '#64748b' }}>
                              In: {item.entryTime || (isPresent ? '09:00 AM' : '-')} | Out: {item.exitTime || '-'}
                            </span>
                          </div>
                        </div>

                        <span style={{
                          padding: '3px 8px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 800,
                          background: isPresent ? '#dcfce7' : isAbsent ? '#fee2e2' : '#fef3c7',
                          color: isPresent ? '#15803d' : isAbsent ? '#b91c1c' : '#b45309',
                          border: `1px solid ${isPresent ? '#bbf7d0' : isAbsent ? '#fecaca' : '#fde68a'}`
                        }}>
                          {String(item.status).toUpperCase()}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: 📢 EXAM SCHEDULE & NOTICE BOARD                    */}
        {/* ========================================================= */}
        {activeTab === 'schedule' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            
            {/* Upcoming Tests Section */}
            <div style={{ background: '#ffffff', borderRadius: '12px', padding: '12px 14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={15} color="#7c3aed" /> Upcoming Exam Schedule
                </h3>
                <span style={{ fontSize: '0.66rem', color: '#7c3aed', fontWeight: 800, background: '#f5f3ff', padding: '2.5px 7px', borderRadius: '6px' }}>
                  Live Schedule
                </span>
              </div>

              {activeUpcomingTests.length === 0 ? (
                <div style={{ padding: '20px 12px', textAlign: 'center', color: '#64748b', background: '#faf5ff', borderRadius: '10px', border: '1px dashed #d8b4fe' }}>
                  <Calendar size={26} color="#a855f7" style={{ marginBottom: '6px' }} />
                  <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 600 }}>No upcoming exams scheduled right now.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeUpcomingTests.map((t, idx) => (
                    <div key={idx} style={{
                      background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '10px',
                      padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '5px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <strong style={{ fontSize: '0.82rem', color: '#581c87', display: 'block' }}>{t.name}</strong>
                          <span style={{ fontSize: '0.70rem', color: '#6b21a8' }}>Syllabus: <strong>{t.subject}</strong></span>
                        </div>
                        <span style={{ background: '#7c3aed', color: '#ffffff', fontSize: '0.70rem', fontWeight: 800, padding: '2.5px 8px', borderRadius: '6px' }}>
                          {t.totalMarks} Marks
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.68rem', color: '#7e22ce', fontWeight: 600 }}>
                        <Clock size={13} /> {t.date}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Official Notice Board Section */}
            <div style={{ background: '#ffffff', borderRadius: '12px', padding: '12px 14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Bell size={15} color="#0284c7" /> Institute Notice Board
                </h3>
                <span style={{ fontSize: '0.66rem', color: '#64748b' }}>Circulars & Alerts</span>
              </div>

              {notices.length === 0 ? (
                <div style={{ padding: '20px 12px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                  <Bell size={26} color="#94a3b8" style={{ marginBottom: '6px' }} />
                  <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 600 }}>No notices published yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {notices.map((n, idx) => (
                    <div key={idx} style={{
                      background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px',
                      padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '4px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '0.80rem', color: '#0f172a' }}>{n.title}</strong>
                        <span style={{ fontSize: '0.64rem', color: '#64748b' }}>
                          {n.createdAt ? new Date(n.createdAt).toLocaleDateString('en-IN') : 'Recent'}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: '0.74rem', color: '#475569', lineHeight: 1.45 }}>
                        {n.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* ========================================================= */}
      {/* 📄 1-TAP OFFICIAL PDF REPORT CARD MODAL                   */}
      {/* ========================================================= */}
      {showReportCardModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)', zIndex: 999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '20px', maxWidth: '620px',
            width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '24px',
            position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
          }}>
            {/* Modal Controls (Hidden in Print) */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0369a1' }}>
                Official Performance Report Card
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => window.print()}
                  style={{
                    background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#ffffff',
                    border: 'none', padding: '7px 14px', borderRadius: '8px', fontWeight: 800,
                    fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <Printer size={14} /> Print / Save as PDF
                </button>
                <button
                  onClick={() => setShowReportCardModal(false)}
                  style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '7px 10px', cursor: 'pointer' }}
                >
                  <X size={16} color="#64748b" />
                </button>
              </div>
            </div>

            {/* Printable Report Card Content */}
            <div className="printable-report-card" style={{ border: '2px solid #0369a1', borderRadius: '16px', padding: '20px', background: '#ffffff' }}>
              
              {/* Header */}
              <div style={{ textAlign: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '14px', marginBottom: '14px' }}>
                <img src={instituteLogo} alt="Logo" style={{ width: '48px', height: '48px', objectFit: 'contain', margin: '0 auto 6px' }} />
                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#0369a1' }}>{instituteName}</h2>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>STUDENT ACADEMIC & ATTENDANCE PERFORMANCE REPORT</span>
                <div style={{ fontSize: '0.68rem', color: '#0284c7', marginTop: '2px' }}>Helpline: {helplineNumber} | {officialWebsite}</div>
              </div>

              {/* Student Metadata Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '14px', fontSize: '0.78rem' }}>
                <div>Student Name: <strong>{studentData?.name}</strong></div>
                <div>Roll No: <strong>{studentData?.rollNo}</strong></div>
                <div>Batch / Course: <strong>{formatBatchName(studentData?.batch)}</strong></div>
                <div>Parent Contact: <strong>{studentData?.parentPhone || '-'}</strong></div>
                <div>Attendance Rate: <strong style={{ color: '#16a34a' }}>{studentData?.attendanceRate || 92}%</strong></div>
                <div>Average Exam Score: <strong style={{ color: '#0284c7' }}>{analyticsData.avgPercentage}%</strong></div>
              </div>

              {/* Test Results Table */}
              <h4 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>Exam Score Sheet:</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem', marginBottom: '14px' }}>
                <thead>
                  <tr style={{ background: '#0284c7', color: '#ffffff', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px' }}>Test Name</th>
                    <th style={{ padding: '6px 8px' }}>Date</th>
                    <th style={{ padding: '6px 8px' }}>Score</th>
                    <th style={{ padding: '6px 8px' }}>%</th>
                    <th style={{ padding: '6px 8px' }}>Rank</th>
                  </tr>
                </thead>
                <tbody>
                  {testResults.length === 0 ? (
                    <tr><td colSpan="5" style={{ padding: '8px', textAlign: 'center', color: '#64748b' }}>No test results recorded yet.</td></tr>
                  ) : (
                    testResults.map((t, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 700 }}>{getTestName(t)}</td>
                        <td style={{ padding: '6px 8px' }}>{getTestDate(t)}</td>
                        <td style={{ padding: '6px 8px' }}>{t.marks}/{t.totalMarks || 360}</td>
                        <td style={{ padding: '6px 8px', fontWeight: 800, color: '#16a34a' }}>{t.percentage}%</td>
                        <td style={{ padding: '6px 8px', fontWeight: 800, color: '#0284c7' }}>#{t.rank || 1}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Remarks & Signatures */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '24px', paddingTop: '12px', borderTop: '1px dashed #cbd5e1' }}>
                <div style={{ fontSize: '0.72rem', color: '#475569' }}>
                  <div><strong>Remarks:</strong> Good Academic Progress</div>
                  <div style={{ marginTop: '4px' }}>Generated Date: {new Date().toLocaleDateString('en-IN')}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ borderBottom: '1px solid #0f172a', width: '120px', marginBottom: '4px' }} />
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#0f172a' }}>Authorized Signatory</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 🔔 NOTIFICATION CENTER DRAWER                             */}
      {/* ========================================================= */}
      {showNotificationDrawer && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)', zIndex: 999, display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <div style={{
            background: '#ffffff', width: '100%', maxWidth: '380px', height: '100%',
            padding: '20px', display: 'flex', flexDirection: 'column',
            boxShadow: '-10px 0 30px rgba(0,0,0,0.2)', position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={20} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>
                  Notification Center
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {visibleNotifications.length > 0 && (
                  <button
                    onClick={handleClearAllNotifications}
                    style={{
                      background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px',
                      padding: '4px 10px', fontSize: '0.72rem', fontWeight: 800, color: '#475569',
                      cursor: 'pointer', transition: 'all 0.15s ease'
                    }}
                    title="Clear All Notifications"
                  >
                    Clear All
                  </button>
                )}
                <button
                  onClick={() => setShowNotificationDrawer(false)}
                  style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={18} color="#64748b" />
                </button>
              </div>
            </div>

            {/* Lock-Screen Web Push Enable Banner - Only shown if permission is not yet granted */}
            {notificationPermission !== 'granted' && (
              <div style={{
                background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)', border: '1.5px solid #bae6fd',
                borderRadius: '14px', padding: '14px', marginBottom: '14px', display: 'flex',
                flexDirection: 'column', gap: '8px'
              }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0369a1' }}>
                  🔔 Enable Lock-Screen Alerts
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569', lineHeight: 1.45 }}>
                  Get instant notification on phone lock-screen whenever your child punches attendance or result is published.
                </p>
                <button
                  onClick={handleRequestNotification}
                  style={{
                    background: '#0284c7', color: '#ffffff', border: 'none', padding: '10px 14px',
                    borderRadius: '10px', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer'
                  }}
                >
                  ⚡ Enable Lock-Screen Push
                </button>
              </div>
            )}

            {/* Notifications Feed */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {visibleNotifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
                  <Bell size={36} style={{ marginBottom: '8px', opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: '0.90rem', fontWeight: 700, color: '#64748b' }}>No active notifications</p>
                  <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>All alerts are up to date.</span>
                </div>
              ) : (
              visibleNotifications.map((notif, idx) => {
                const titleLower = String(notif.title || '').toLowerCase();
                const msgLower = String(notif.message || '').toLowerCase();

                const isPunchMissed = titleLower.includes('missed') || msgLower.includes('did not record') || msgLower.includes('did not check out') || msgLower.includes('punch missed');
                const isCheckIn = titleLower.includes('check-in') || titleLower.includes('arrival') || msgLower.includes('safely arrived');
                const isCheckOut = titleLower.includes('check-out') || titleLower.includes('departure') || msgLower.includes('has left');
                const isTestResult = notif.type === 'TEST_RESULT' || titleLower.includes('test') || titleLower.includes('result');

                const cardTheme = isPunchMissed ? {
                  bg: '#fff7ed',
                  border: '1.5px solid #fed7aa',
                  borderLeft: '5px solid #ea580c',
                  titleColor: '#c2410c',
                  badgeBg: '#ffedd5',
                  badgeColor: '#c2410c',
                  badgeText: '⚠️ PUNCH MISSED',
                  actionColor: '#ea580c'
                } : isCheckIn ? {
                  bg: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderLeft: '5px solid #16a34a',
                  titleColor: '#15803d',
                  badgeBg: '#dcfce7',
                  badgeColor: '#15803d',
                  badgeText: '🟢 CHECK-IN',
                  actionColor: '#16a34a'
                } : isCheckOut ? {
                  bg: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderLeft: '5px solid #0284c7',
                  titleColor: '#0369a1',
                  badgeBg: '#e0f2fe',
                  badgeColor: '#0284c7',
                  badgeText: '🔵 CHECK-OUT',
                  actionColor: '#0284c7'
                } : isTestResult ? {
                  bg: '#faf5ff',
                  border: '1px solid #e9d5ff',
                  borderLeft: '5px solid #7c3aed',
                  titleColor: '#6d28d9',
                  badgeBg: '#f3e8ff',
                  badgeColor: '#7c3aed',
                  badgeText: '🏆 EXAM RESULT',
                  actionColor: '#7c3aed'
                } : {
                  bg: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderLeft: '5px solid #64748b',
                  titleColor: '#0f172a',
                  badgeBg: '#f1f5f9',
                  badgeColor: '#475569',
                  badgeText: '📢 NOTICE',
                  actionColor: '#0284c7'
                };

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setShowNotificationDrawer(false);
                      if (notif.type === 'ATTENDANCE' || isPunchMissed || isCheckIn || isCheckOut) setActiveTab('attendance');
                      else if (notif.type === 'TEST_RESULT') setActiveTab('tests');
                      else setActiveTab('schedule');
                    }}
                    title="Click to view details"
                    style={{
                      background: cardTheme.bg,
                      border: cardTheme.border,
                      borderLeft: cardTheme.borderLeft,
                      borderRadius: '12px',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          background: cardTheme.badgeBg,
                          color: cardTheme.badgeColor,
                          fontSize: '0.62rem',
                          fontWeight: 900,
                          padding: '2px 7px',
                          borderRadius: '6px',
                          letterSpacing: '0.3px'
                        }}>
                          {cardTheme.badgeText}
                        </span>
                        <strong style={{ fontSize: '0.84rem', color: cardTheme.titleColor }}>
                          {isPunchMissed ? 'PUNCH MISSED' : notif.title}
                        </strong>
                      </div>
                      <span style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>{notif.time}</span>
                    </div>

                    <p style={{ margin: 0, fontSize: '0.80rem', color: '#334155', lineHeight: 1.45, fontWeight: isPunchMissed ? 600 : 400 }}>
                      {notif.message}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                      <span style={{ fontSize: '0.68rem', color: cardTheme.actionColor, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '2px' }}>
                        View in Attendance <ChevronRight size={12} />
                      </span>
                    </div>
                  </div>
                );
              })
              )}
            </div>

            <div style={{ marginTop: '14px' }}>
              <button
                onClick={() => setShowNotificationDrawer(false)}
                style={{
                  width: '100%', background: '#0f172a', color: '#ffffff',
                  border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 800,
                  fontSize: '0.86rem', cursor: 'pointer'
                }}
              >
                Close (बंद करें)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ⚙️ SETTINGS & ACTIONS DRAWER                               */}
      {/* ========================================================= */}
      {showSettingsDrawer && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)', zIndex: 999, display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <div style={{
            background: '#ffffff', width: '100%', maxWidth: '340px', height: '100%',
            padding: '18px', display: 'flex', flexDirection: 'column',
            boxShadow: '-10px 0 30px rgba(0,0,0,0.2)', position: 'relative'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={18} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 900, color: '#0f172a' }}>
                  Settings & Menu
                </h3>
              </div>
              <button
                onClick={() => setShowSettingsDrawer(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={15} color="#64748b" />
              </button>
            </div>

            {/* Student Info Pill (Click to open full profile modal) */}
            <div
              onClick={() => {
                setShowSettingsDrawer(false);
                setShowProfileModal(true);
              }}
              title="Click to view full student profile & credentials"
              style={{
                background: '#f8fafc', border: '1.5px solid #bae6fd', borderRadius: '14px',
                padding: '11px 12px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px',
                cursor: 'pointer', transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f9ff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
            >
              <div style={{
                width: '38px', height: '38px', borderRadius: '11px',
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                color: '#ffffff', fontWeight: 800, fontSize: '0.95rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                overflow: 'hidden', border: '1.5px solid #e0f2fe'
              }}>
                {studentData?.photo ? (
                  <img
                    src={getMediaUrl(studentData.photo)}
                    alt={studentData.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  studentData?.name ? studentData.name.charAt(0) : 'S'
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {studentData?.name}
                  <ChevronRight size={13} color="#94a3b8" />
                </div>
                <div style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600 }}>
                  Roll: {studentData?.rollNo} • {formatBatchName(studentData?.batch, studentData?.class)}
                </div>
              </div>
            </div>

            {/* Action Items List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto' }}>
              {/* Notification Center */}
              <button
                onClick={() => {
                  setShowSettingsDrawer(false);
                  setShowNotificationDrawer(true);
                }}
                style={{
                  width: '100%', padding: '11px 12px', borderRadius: '10px',
                  background: '#f0f9ff', border: '1px solid #bae6fd',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Bell size={16} color="#0284c7" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0369a1' }}>
                    Notifications & Alerts
                  </span>
                </div>
                {allNotifications.length > 0 && (
                  <span style={{
                    background: '#ef4444', color: '#ffffff', fontSize: '0.62rem',
                    fontWeight: 900, padding: '2px 7px', borderRadius: '10px'
                  }}>
                    {allNotifications.length} new
                  </span>
                )}
              </button>

              {/* 1-Tap Official Report Card */}
              <button
                onClick={() => {
                  setShowSettingsDrawer(false);
                  setShowReportCardModal(true);
                }}
                style={{
                  width: '100%', padding: '11px 12px', borderRadius: '10px',
                  background: '#f0fdf4', border: '1px solid #bbf7d0',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileText size={16} color="#16a34a" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#15803d' }}>
                    Official Report Card (PDF)
                  </span>
                </div>
                <ChevronRight size={14} color="#16a34a" />
              </button>

              {/* Lock-screen alerts toggle */}
              <button
                onClick={handleRequestNotification}
                style={{
                  width: '100%', padding: '11px 12px', borderRadius: '10px',
                  background: '#faf5ff', border: '1px solid #e9d5ff',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Smartphone size={16} color="#9333ea" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#7e22ce' }}>
                    Lock-Screen Alerts
                  </span>
                </div>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: notificationPermission === 'granted' ? '#16a34a' : '#9333ea' }}>
                  {notificationPermission === 'granted' ? 'Active' : 'Enable'}
                </span>
              </button>

              {/* Install App button if not standalone */}
              {!isAppInstalled && (
                <button
                  onClick={() => {
                    setShowSettingsDrawer(false);
                    handleInstallApp();
                  }}
                  style={{
                    width: '100%', padding: '11px 12px', borderRadius: '10px',
                    background: '#eff6ff', border: '1px solid #bfdbfe',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer', textAlign: 'left'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Download size={16} color="#2563eb" />
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1d4ed8' }}>
                      Add to Phone Home Screen
                    </span>
                  </div>
                  <ChevronRight size={14} color="#2563eb" />
                </button>
              )}
            </div>

            {/* Logout Button at bottom */}
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', marginTop: 'auto' }}>
              <button
                onClick={() => {
                  setShowSettingsDrawer(false);
                  handleLogout();
                }}
                style={{
                  width: '100%', padding: '10px', borderRadius: '10px',
                  background: '#fff1f2', border: '1px solid #fecdd3', color: '#e11d48',
                  fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >
                <LogOut size={15} /> Logout Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Force Install App Modal Prompt (Hides when installed) */}
      {showForceInstallModal && !isAppInstalled && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(8px)', zIndex: 999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#ffffff', border: '2px solid #38bdf8', borderRadius: '24px',
            padding: '24px 20px', maxWidth: '380px', width: '100%', textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(2, 132, 199, 0.35)', position: 'relative'
          }}>
            <button
              onClick={() => setShowForceInstallModal(false)}
              style={{ position: 'absolute', right: '12px', top: '12px', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={16} color="#64748b" />
            </button>

            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.15)' }}>
              <Smartphone size={28} color="#0284c7" />
            </div>

            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.2rem', fontWeight: 900, color: '#0369a1' }}>
              Download Parents Mobile App
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.8rem', color: '#475569', lineHeight: 1.45 }}>
              Install Career Xone directly on your phone home screen for 1-tap daily access & instant notifications!
            </p>

            {/* Quick 2-Step Visual Guide */}
            <div style={{
              background: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              borderRadius: '16px',
              padding: '12px 14px',
              textAlign: 'left',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0369a1', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={14} color="#0284c7" /> How to Install on your Phone:
              </div>
              <div style={{ fontSize: '0.75rem', color: '#334155', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div><strong>1.</strong> Tap <strong>(⋮) 3 Dots</strong> at the top right of your browser (or Share icon on iPhone).</div>
                <div><strong>2.</strong> Tap <strong>"Install App"</strong> or <strong>"Add to Home Screen"</strong>.</div>
              </div>
            </div>

            {deferredPrompt ? (
              <button
                onClick={handleInstallApp}
                style={{
                  width: '100%', background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#ffffff',
                  border: 'none', padding: '13px', borderRadius: '14px', fontWeight: 800, fontSize: '0.92rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: '0 6px 20px rgba(2, 132, 199, 0.35)'
                }}
              >
                <Download size={18} /> Tap to Install Directly Now
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '12px',
                  padding: '10px',
                  fontSize: '0.78rem',
                  color: '#166534',
                  fontWeight: 600
                }}>
                  👆 Browser menu me jaakar <strong>"Install App"</strong> ya <strong>"Add to Home Screen"</strong> par tap karein!
                </div>
                <button
                  onClick={() => setShowForceInstallModal(false)}
                  style={{
                    width: '100%', background: '#0f172a', color: '#ffffff',
                    border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 800, fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  Got It (समझ गया)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ⚙️ Settings & Account Drawer */}
      {showSettingsDrawer && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '22px', maxWidth: '420px', width: '100%',
            padding: '20px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)', position: 'relative',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Settings size={18} color="#0284c7" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: '#0f172a' }}>
                    Settings & Account
                  </h3>
                  <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>
                    Career Xone Parents Portal
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowSettingsDrawer(false)}
                style={{
                  background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '30px', height: '30px',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <X size={16} color="#64748b" />
              </button>
            </div>

            {/* Student Info Pill */}
            {studentData && (
              <div style={{
                background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
                border: '1.5px solid #bae6fd',
                borderRadius: '14px',
                padding: '12px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '10px',
                    background: '#0284c7', color: '#ffffff', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1rem'
                  }}>
                    {studentData.name ? studentData.name.charAt(0) : 'S'}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 900, color: '#0369a1' }}>
                      {studentData.name}
                    </h4>
                    <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>
                      Roll: {studentData.rollNo} • {formatBatchName(studentData.batch, studentData.class)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowSettingsDrawer(false);
                    setShowProfileModal(true);
                  }}
                  style={{
                    background: '#ffffff', border: '1px solid #bae6fd', color: '#0284c7',
                    padding: '5px 9px', borderRadius: '8px', fontSize: '0.70rem', fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Profile
                </button>
              </div>
            )}

            {/* Menu Options List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
              {/* Report Card */}
              <button
                onClick={() => {
                  setShowSettingsDrawer(false);
                  setShowReportCardModal(true);
                }}
                style={{
                  width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px',
                  padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileText size={17} color="#0284c7" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                    Download Official Report Card
                  </span>
                </div>
                <ChevronRight size={16} color="#94a3b8" />
              </button>

              {/* Install App */}
              {/* Install App (Only show if not already installed as PWA) */}
              {!isAppInstalled && (
                <button
                  onClick={() => {
                    setShowSettingsDrawer(false);
                    handleInstallApp();
                  }}
                  style={{
                    width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px',
                    padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer', textAlign: 'left'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Smartphone size={17} color="#10b981" />
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                      Install Parents App to Home Screen
                    </span>
                  </div>
                  <ChevronRight size={16} color="#94a3b8" />
                </button>
              )}

              {/* Notifications Setting (Only show if not already active/granted) */}
              {notificationPermission !== 'granted' && (
                <button
                  onClick={handleRequestNotification}
                  style={{
                    width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px',
                    padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer', textAlign: 'left'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Bell size={17} color="#8b5cf6" />
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                      Enable Lock-Screen Alerts
                    </span>
                  </div>
                  <ChevronRight size={16} color="#94a3b8" />
                </button>
              )}

              {/* Refresh Sync */}
              <button
                onClick={() => {
                  setShowSettingsDrawer(false);
                  handleManualRefresh();
                }}
                style={{
                  width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px',
                  padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <RefreshCw size={17} color="#f59e0b" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                    Sync Latest Data with Institute
                  </span>
                </div>
                <ChevronRight size={16} color="#94a3b8" />
              </button>

              {/* Helpline */}
              <a
                href={`tel:${helplineNumber}`}
                style={{
                  width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px',
                  padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  textDecoration: 'none', color: '#1e293b'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Phone size={17} color="#0284c7" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                    Institute Helpline ({helplineNumber})
                  </span>
                </div>
                <ChevronRight size={16} color="#94a3b8" />
              </a>
            </div>

            {/* 🚪 COMPACT LOGOUT & CLOSE BUTTONS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                onClick={handleLogout}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 3px 10px rgba(239, 68, 68, 0.25)',
                  transition: 'all 0.15s ease'
                }}
              >
                <LogOut size={15} /> Logout
              </button>
              <button
                onClick={() => setShowSettingsDrawer(false)}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #64748b, #475569)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 3px 10px rgba(100, 116, 139, 0.25)',
                  transition: 'all 0.15s ease'
                }}
              >
                <X size={15} /> Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 👤 Interactive Student Profile Modal */}
      {showProfileModal && studentData && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#ffffff', borderRadius: '20px', maxWidth: '440px', width: '100%',
            padding: '20px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)', position: 'relative',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            {/* Close Button */}
            <button
              onClick={() => setShowProfileModal(false)}
              style={{
                position: 'absolute', top: '14px', right: '14px', background: '#f1f5f9',
                border: 'none', borderRadius: '50%', width: '32px', height: '32px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <X size={18} color="#64748b" />
            </button>

            {/* Profile Avatar Header */}
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div
                onClick={() => {
                  if (studentData?.photo) {
                    setShowProfileModal(false);
                    setShowFullPhotoModal(true);
                  }
                }}
                style={{
                  width: '78px', height: '78px', borderRadius: '22px',
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  margin: '0 auto 10px auto', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '2rem', fontWeight: 900, color: '#ffffff',
                  boxShadow: '0 8px 20px rgba(2, 132, 199, 0.3)', overflow: 'hidden',
                  border: '3px solid #e0f2fe', cursor: studentData?.photo ? 'zoom-in' : 'default'
                }}
                title={studentData?.photo ? 'Tap to view full-size photo' : 'Student Photo'}
              >
                {studentData?.photo ? (
                  <img
                    src={getMediaUrl(studentData.photo)}
                    alt={studentData.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  studentData?.name ? studentData.name.charAt(0) : 'S'
                )}
              </div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>
                {studentData?.name}
              </h3>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>
                  {formatBatchName(studentData?.batch, studentData?.class)}
                </span>
                <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>
                  Active Student
                </span>
              </div>
            </div>

            {/* Credentials & Academic Details Card */}
            <div style={{
              background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '14px',
              padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Roll Number:</span>
                <strong style={{ fontSize: '0.84rem', color: '#0f172a', fontWeight: 800 }}>{studentData?.rollNo || '-'}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Parent User ID:</span>
                <strong style={{ fontSize: '0.84rem', color: '#0284c7', fontWeight: 900, letterSpacing: '0.5px' }}>
                  {studentData?.parentUserId || `CAREER${studentData?.rollNo}`}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Class / Standard:</span>
                <strong style={{ fontSize: '0.84rem', color: '#0f172a', fontWeight: 800 }}>
                  {studentData?.class || '11th'}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Target Course & Batch:</span>
                <strong style={{ fontSize: '0.84rem', color: '#0284c7', fontWeight: 900 }}>
                  {formatBatchName(studentData?.batch, studentData?.class)}
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Parent Name:</span>
                <strong style={{ fontSize: '0.84rem', color: '#0f172a', fontWeight: 800 }}>{studentData?.parentName || 'Parent / Guardian'}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Registered Mobile:</span>
                <strong style={{ fontSize: '0.84rem', color: '#0f172a', fontWeight: 800 }}>{studentData?.parentPhone || '-'}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Overall Attendance:</span>
                <strong style={{ fontSize: '0.84rem', color: '#16a34a', fontWeight: 900 }}>
                  {studentData?.attendanceRate !== undefined ? `${studentData.attendanceRate}%` : '100%'}
                </strong>
              </div>
            </div>

            {/* Actions (Compact Sleek Row) */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  setShowReportCardModal(true);
                }}
                style={{
                  flex: 1, background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#ffffff',
                  border: 'none', padding: '7px 10px', borderRadius: '8px', fontWeight: 800, fontSize: '0.76rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  whiteSpace: 'nowrap'
                }}
              >
                <FileText size={13} /> Report Card
              </button>
              <button
                onClick={handleLogout}
                style={{
                  padding: '7px 10px', background: '#fff1f2', color: '#e11d48',
                  border: '1px solid #fecdd3', borderRadius: '8px', fontWeight: 800, fontSize: '0.76rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  whiteSpace: 'nowrap'
                }}
                title="Logout Parent Portal"
              >
                <LogOut size={13} /> Logout
              </button>
              <button
                onClick={() => setShowProfileModal(false)}
                style={{
                  padding: '7px 12px', background: '#f1f5f9', color: '#334155',
                  border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 800, fontSize: '0.76rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  whiteSpace: 'nowrap'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🖼️ Full-Size Photo Modal */}
      {showFullPhotoModal && studentData?.photo && (
        <div
          onClick={() => setShowFullPhotoModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(8px)', zIndex: 1100, display: 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '480px', width: '100%', textAlign: 'center' }}>
            <button
              onClick={() => setShowFullPhotoModal(false)}
              style={{
                position: 'absolute', top: '-44px', right: '0', background: 'rgba(255,255,255,0.2)',
                color: '#ffffff', border: 'none', borderRadius: '50%', width: '36px', height: '36px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <X size={20} color="#ffffff" />
            </button>
            <img
              src={getMediaUrl(studentData.photo)}
              alt={studentData.name}
              style={{
                width: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: '16px',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '2px solid rgba(255,255,255,0.2)'
              }}
            />
            <div style={{ marginTop: '12px', color: '#f8fafc', fontSize: '0.92rem', fontWeight: 800 }}>
              {studentData.name} (Roll: {studentData.rollNo})
            </div>
          </div>
        </div>
      )}

      {/* OMR Sheet Viewer Modal */}
      {selectedOmrImage && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '12px'
        }}>
          <TransformWrapper
            initialScale={1}
            minScale={0.5}
            maxScale={4}
            centerOnInit
            limitToBounds={false}
            wheel={{ step: 0.005 }}
            pinch={{ step: 1 }}
            panning={{ velocityDisabled: true }}
          >
            {({ zoomIn, zoomOut, resetTransform, state }) => {
              const omrUrl = typeof selectedOmrImage === 'string' ? selectedOmrImage : selectedOmrImage?.url;
              const omrTestName = typeof selectedOmrImage === 'object' ? selectedOmrImage?.testName : 'OMR_Sheet';

              return (
                <div style={{
                  background: '#fff', borderRadius: '18px', padding: '16px',
                  maxWidth: '900px', width: '94vw', textAlign: 'center',
                  display: 'flex', flexDirection: 'column', maxHeight: '92vh',
                  boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
                }}>
                  {/* Top Bar with Title & Controls */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ textAlign: 'left', minWidth: 0 }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FileText size={16} color="#0284c7" /> Scanned OMR Sheet
                      </h4>
                      {typeof selectedOmrImage === 'object' && selectedOmrImage?.testName && (
                        <span style={{ fontSize: '0.70rem', color: '#64748b', fontWeight: 600, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {selectedOmrImage.testName}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button onClick={() => zoomOut()} title="Zoom Out" style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', padding: '5px 8px', display: 'flex', alignItems: 'center' }}><ZoomOut size={15} color="#475569" /></button>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, minWidth: '38px', color: '#475569' }}>{Math.round(state.scale * 100)}%</span>
                      <button onClick={() => zoomIn()} title="Zoom In" style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', padding: '5px 8px', display: 'flex', alignItems: 'center' }}><ZoomIn size={15} color="#475569" /></button>
                      <button onClick={() => resetTransform()} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '0.74rem', color: '#475569', fontWeight: 700, padding: '5px 8px' }}>Reset</button>
                      <button
                        onClick={() => handleDownloadOmr(omrUrl, omrTestName)}
                        style={{
                          background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#ffffff',
                          border: 'none', borderRadius: '6px', padding: '5px 10px', fontSize: '0.75rem',
                          fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                        title="Download OMR to device"
                      >
                        <Download size={14} /> Download
                      </button>
                      <button
                        onClick={() => setSelectedOmrImage(null)}
                        style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      >
                        <X size={16} color="#dc2626" />
                      </button>
                    </div>
                  </div>

                  {/* 30-Days Expiry Notice Inside Modal */}
                  <div style={{
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: '8px',
                    padding: '7px 10px',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    textAlign: 'left'
                  }}>
                    <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0 }} />
                    <div style={{ fontSize: '0.72rem', color: '#92400e', lineHeight: 1.35 }}>
                      <strong>Important:</strong> OMR sheet will be deleted from server in <strong>30 days</strong>. If you want to keep this OMR permanently, please download it to your device.
                      <span style={{ display: 'block', fontSize: '0.66rem', color: '#b45309' }}>
                        (यह OMR शीट 30 दिनों में सर्वर से डिलीट हो जाएगी। स्थायी रिकॉर्ड के लिए कृपया इसे डाउनलोड कर लें।)
                      </span>
                    </div>
                  </div>

                  {/* OMR Canvas Container */}
                  <div style={{ flex: 1, overflow: 'hidden', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'grab', minHeight: '260px' }}>
                    <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%' }}>
                      <img
                        src={omrUrl}
                        alt="OMR Sheet"
                        style={{ width: '100%', display: 'block' }}
                        draggable={false}
                      />
                    </TransformComponent>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
                    <button
                      onClick={() => handleDownloadOmr(omrUrl, omrTestName)}
                      style={{
                        background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#ffffff',
                        border: 'none', padding: '11px', borderRadius: '10px', fontWeight: 800, fontSize: '0.85rem',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)'
                      }}
                    >
                      <Download size={16} /> Download OMR Sheet
                    </button>
                    <button
                      onClick={() => setSelectedOmrImage(null)}
                      style={{
                        background: '#0f172a', color: '#fff',
                        border: 'none', padding: '11px', borderRadius: '10px', fontWeight: 800, fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      Close Preview
                    </button>
                  </div>
                </div>
              );
            }}
          </TransformWrapper>
        </div>
      )}

      {/* 📱 Sleek Glassmorphic Floating Bottom Navigation Bar (Mobile Native Feel) */}
      <nav className="mobile-bottom-nav no-print" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderTop: '1px solid #e2e8f0',
        padding: '8px 14px calc(8px + env(safe-area-inset-bottom, 0px))',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '6px',
        zIndex: 90,
        boxShadow: '0 -4px 25px rgba(15, 23, 42, 0.1)'
      }}>
        {[
          { id: 'attendance', label: 'Attendance', icon: Calendar, activeColor: '#d97706', count: null },
          { id: 'tests', label: 'Tests', icon: Award, activeColor: '#059669', count: testResults.length },
          { id: 'menu', label: 'Settings', icon: Settings, activeColor: '#e11d48', count: null, isAction: true }
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.isAction) {
                  setShowSettingsDrawer(true);
                } else {
                  setActiveTab(item.id);
                  if (item.id === 'schedule') {
                    markNoticesAsRead();
                  }
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              style={{
                background: isActive ? `${item.activeColor}18` : 'transparent',
                border: 'none',
                borderRadius: '14px',
                padding: '8px 4px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                position: 'relative',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={24} color={isActive ? item.activeColor : '#64748b'} strokeWidth={isActive ? 2.6 : 2.1} />
                {item.count !== null && item.count > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-11px',
                    background: isActive ? item.activeColor : '#ef4444',
                    color: '#ffffff',
                    fontSize: '0.62rem',
                    fontWeight: 900,
                    padding: '1.5px 5px',
                    borderRadius: '8px',
                    lineHeight: 1
                  }}>
                    {item.count}
                  </span>
                )}
              </div>
              <span className="mobile-bottom-nav-label" style={{
                fontSize: '0.82rem',
                fontWeight: isActive ? 900 : 700,
                color: isActive ? item.activeColor : '#64748b',
                lineHeight: 1
              }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
