import React, { useState, useEffect } from 'react';
import { 
  User, Lock, Eye, EyeOff, CheckCircle2, XCircle, Clock, Award, Calendar, 
  BookOpen, Download, LogOut, ArrowRight, ShieldCheck, Sparkles, FileText, 
  ImageIcon, Smartphone, ExternalLink, X, ZoomIn, ZoomOut, AlertTriangle, 
  AlertCircle, Book, ChevronLeft, Info, MapPin, Maximize, Minimize, Phone, 
  Search, Send, Bell, TrendingUp, BarChart2, Printer, Check, Star, Zap, 
  Flame, Compass, HelpCircle, ChevronRight, Share2, Settings 
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
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

  // Active Tab: 'analytics' | 'tests' | 'attendance' | 'schedule'
  const [activeTab, setActiveTab] = useState('analytics');
  const [selectedOmrImage, setSelectedOmrImage] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(() => window.deferredPrompt || null);
  const [showForceInstallModal, setShowForceInstallModal] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showReportCardModal, setShowReportCardModal] = useState(false);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [noticeFilter, setNoticeFilter] = useState('ALL');
  const [notificationPermission, setNotificationPermission] = useState(() => {
    return (typeof window !== 'undefined' && 'Notification' in window) ? Notification.permission : 'default';
  });

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

  // Format batch helper
  const formatBatchName = (batch) => {
    if (!batch) return 'JEE Mains';
    const b = String(batch).trim().toLowerCase();
    if (b === 'batch-4' || b === 'batch 4' || b === '4') return 'JEE Mains';
    if (b === 'batch-1' || b === 'batch 1' || b === '1') return 'JEE Advanced';
    if (b === 'batch-2' || b === 'batch 2' || b === '2') return 'NEET';
    if (b === 'batch-3' || b === 'batch 3' || b === '3') return 'MHCET';
    return batch.replace(/^batch-?/i, 'Batch ').replace(/\b\w/g, l => l.toUpperCase());
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

        toast.success(`Welcome Parent of ${studentObj?.name || 'Student'}!`);
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
            
            const updatedSession = {
              ...session,
              studentData: data.student,
              attendanceRecords: data.attendance || [],
              testResults: data.tests || [],
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

  const handleLogout = () => {
    setIsLoggedIn(false);
    setStudentData(null);
    setAttendanceRecords([]);
    setTestResults([]);
    setUpcomingTests([]);
    setNotices([]);
    localStorage.removeItem('parentSession');
    localStorage.removeItem('parentToken');
    sessionStorage.removeItem('parentSession');
    toast.success('Logged out successfully');
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

  // Safe Test Metadata Getters (Resilient to various payload structures)
  const getTestName = (t) => t?.testName || t?.test?.name || t?.name || '12TH NEET ALL BATCH ( 25-27 ) 18.08.2026';
  const getTestDate = (t) => t?.testDate || t?.test?.date || (t?.createdAt ? new Date(t.createdAt).toLocaleDateString('en-IN') : '18/08/2026');

  // Unified Notifications list (Attendance + Results + Notices strictly from real data)
  const allNotifications = [
    ...(attendanceRecords.slice(0, 3).map(a => ({
      id: `att-${a.date}`,
      title: `Attendance: ${a.date}`,
      message: `${studentData?.name || 'Student'} was marked ${String(a.status).toUpperCase()} on ${a.date}.`,
      type: 'ATTENDANCE',
      time: a.date
    }))),
    ...(testResults.slice(0, 3).map(t => ({
      id: `test-${t.id || getTestName(t)}`,
      title: `Test Result: ${getTestName(t)}`,
      message: `Score: ${t.marks}/${t.totalMarks || 360} (${t.percentage}%). Rank: ${t.rank || '-'}/${t.totalStudents || 74}.`,
      type: 'TEST_RESULT',
      time: getTestDate(t)
    }))),
    ...(notices.map(n => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: 'NOTICE',
      time: 'Recent'
    })))
  ];

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
        <Toaster />
        
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
      paddingBottom: '40px'
    }}>
      <Toaster />
      <PWAInstallPrompt appName="CX Parents" />

      {/* Global CSS for Mobile & Print */}
      <style>{`
        * { box-sizing: border-box; }
        @media (max-width: 600px) {
          .parent-header { padding: 8px 12px !important; }
          .parent-logo-img { width: 30px !important; height: 30px !important; border-radius: 7px !important; }
          .parent-inst-name { font-size: 0.88rem !important; }
          .parent-inst-sub { font-size: 0.66rem !important; }
          .student-card { padding: 10px 12px !important; border-radius: 12px !important; margin-bottom: 8px !important; }
          .student-avatar { width: 34px !important; height: 34px !important; font-size: 0.95rem !important; border-radius: 8px !important; }
          .student-name { font-size: 0.90rem !important; }
          .tab-btn-bar { gap: 4px !important; margin-bottom: 8px !important; }
          .tab-btn { padding: 5px 2px !important; font-size: 0.72rem !important; border-radius: 8px !important; height: 30px !important; }
          .metrics-grid { gap: 5px !important; margin-top: 8px !important; }
          .metric-box { padding: 6px 3px !important; border-radius: 8px !important; }
          .metric-label { font-size: 0.62rem !important; }
          .metric-value { font-size: 0.86rem !important; }
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

        {/* Right: Settings & Actions Menu */}
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <button
            onClick={() => setShowSettingsDrawer(true)}
            aria-label="Settings & Menu"
            style={{
              position: 'relative',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#334155',
              width: '30px',
              height: '30px',
              borderRadius: '7px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}
          >
            <Settings size={15} />
            {allNotifications.length > 0 && (
              <span style={{
                position: 'absolute', top: '-3px', right: '-3px', background: '#ef4444',
                color: '#ffffff', fontSize: '0.55rem', fontWeight: 900, width: '14px',
                height: '14px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {allNotifications.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main App Container */}
      <div style={{ maxWidth: '490px', margin: '8px auto 0', padding: '0 10px' }}>

        {/* Student Profile Card (Compact & Sleek) */}
        <div className="student-card no-print" style={{
          background: '#ffffff',
          border: '1px solid #bae6fd',
          borderRadius: '12px',
          padding: '10px 12px',
          marginBottom: '8px',
          boxShadow: '0 2px 6px rgba(2, 132, 199, 0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <div className="student-avatar" style={{
              width: '34px', height: '34px', borderRadius: '8px',
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.95rem', fontWeight: 800, color: '#ffffff',
              boxShadow: '0 1px 5px rgba(2, 132, 199, 0.18)', flexShrink: 0
            }}>
              {studentData?.name ? studentData.name.charAt(0) : 'S'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className="student-name" style={{
                margin: 0, fontSize: '0.90rem', fontWeight: 900, color: '#0f172a',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2
              }}>
                {studentData?.name}
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', fontSize: '0.68rem', color: '#64748b', alignItems: 'center', marginTop: '2px' }}>
                <span style={{ background: '#f1f5f9', padding: '1.5px 6px', borderRadius: '4px', fontWeight: 700, color: '#334155' }}>
                  Roll: <strong style={{ color: '#0f172a' }}>{studentData?.rollNo}</strong>
                </span>
                <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '1.5px 6px', borderRadius: '4px', fontWeight: 800 }}>
                  {formatBatchName(studentData?.batch)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics 4-Grid */}
          <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px', marginTop: '8px' }}>
            <div className="metric-box" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '6px 3px', borderRadius: '8px', textAlign: 'center' }}>
              <span className="metric-label" style={{ fontSize: '0.62rem', color: '#0369a1', fontWeight: 700, display: 'block', marginBottom: '1px' }}>Attendance</span>
              <strong className="metric-value" style={{ fontSize: '0.86rem', color: '#0284c7', fontWeight: 900 }}>
                {studentData?.attendanceRate !== undefined ? studentData.attendanceRate : (attendanceRecords.length > 0 ? Math.round((attendanceRecords.filter(a => String(a.status).toLowerCase() === 'present').length / attendanceRecords.length) * 100) : 100)}%
              </strong>
            </div>

            <div className="metric-box" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '6px 3px', borderRadius: '8px', textAlign: 'center' }}>
              <span className="metric-label" style={{ fontSize: '0.62rem', color: '#15803d', fontWeight: 700, display: 'block', marginBottom: '1px' }}>Present</span>
              <strong className="metric-value" style={{ fontSize: '0.86rem', color: '#16a34a', fontWeight: 900 }}>
                {studentData?.presentCount || attendanceRecords.filter(a => String(a.status).toLowerCase() === 'present').length}d
              </strong>
            </div>

            <div className="metric-box" style={{ background: '#fdf4ff', border: '1px solid #f5d0fe', padding: '6px 3px', borderRadius: '8px', textAlign: 'center' }}>
              <span className="metric-label" style={{ fontSize: '0.62rem', color: '#a21caf', fontWeight: 700, display: 'block', marginBottom: '1px' }}>Avg Score</span>
              <strong className="metric-value" style={{ fontSize: '0.86rem', color: '#c026d3', fontWeight: 900 }}>
                {testResults.length > 0 ? `${Math.max(0, analyticsData.avgPercentage)}%` : '-'}
              </strong>
            </div>

            <div className="metric-box" style={{ background: '#fff7ed', border: '1px solid #ffedd5', padding: '6px 3px', borderRadius: '8px', textAlign: 'center' }}>
              <span className="metric-label" style={{ fontSize: '0.62rem', color: '#c2410c', fontWeight: 700, display: 'block', marginBottom: '1px' }}>Best Rank</span>
              <strong className="metric-value" style={{ fontSize: '0.86rem', color: '#ea580c', fontWeight: 900 }}>
                {testResults.length > 0 && analyticsData.bestRank !== '-' ? `#${analyticsData.bestRank}` : '-'}
              </strong>
            </div>
          </div>
        </div>

        {/* 4 Navigation Tabs Switcher (Compact Horizontal Pill Row) */}
        <div className="tab-btn-bar no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginBottom: '8px' }}>
          <button
            className="tab-btn"
            onClick={() => setActiveTab('analytics')}
            style={{
              padding: '5px 2px', borderRadius: '8px', border: '1px solid',
              borderColor: activeTab === 'analytics' ? '#0284c7' : '#cbd5e1',
              fontWeight: 800, fontSize: '0.70rem', cursor: 'pointer', height: '29px',
              background: activeTab === 'analytics' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : '#ffffff',
              color: activeTab === 'analytics' ? '#ffffff' : '#475569',
              boxShadow: activeTab === 'analytics' ? '0 1px 3px rgba(2, 132, 199, 0.2)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px'
            }}
          >
            <TrendingUp size={13} /> <span>Analytics</span>
          </button>

          <button
            className="tab-btn"
            onClick={() => setActiveTab('tests')}
            style={{
              padding: '5px 2px', borderRadius: '8px', border: '1px solid',
              borderColor: activeTab === 'tests' ? '#059669' : '#cbd5e1',
              fontWeight: 800, fontSize: '0.70rem', cursor: 'pointer', height: '29px',
              background: activeTab === 'tests' ? 'linear-gradient(135deg, #059669, #047857)' : '#ffffff',
              color: activeTab === 'tests' ? '#ffffff' : '#475569',
              boxShadow: activeTab === 'tests' ? '0 1px 3px rgba(5, 150, 105, 0.2)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px'
            }}
          >
            <Award size={13} /> <span>Tests ({testResults.length})</span>
          </button>

          <button
            className="tab-btn"
            onClick={() => setActiveTab('attendance')}
            style={{
              padding: '5px 2px', borderRadius: '8px', border: '1px solid',
              borderColor: activeTab === 'attendance' ? '#d97706' : '#cbd5e1',
              fontWeight: 800, fontSize: '0.70rem', cursor: 'pointer', height: '29px',
              background: activeTab === 'attendance' ? 'linear-gradient(135deg, #d97706, #b45309)' : '#ffffff',
              color: activeTab === 'attendance' ? '#ffffff' : '#475569',
              boxShadow: activeTab === 'attendance' ? '0 1px 3px rgba(217, 119, 6, 0.2)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px'
            }}
          >
            <Calendar size={13} /> <span>Attendance</span>
          </button>

          <button
            className="tab-btn"
            onClick={() => setActiveTab('schedule')}
            style={{
              padding: '5px 2px', borderRadius: '8px', border: '1px solid',
              borderColor: activeTab === 'schedule' ? '#7c3aed' : '#cbd5e1',
              fontWeight: 800, fontSize: '0.70rem', cursor: 'pointer', height: '29px',
              background: activeTab === 'schedule' ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : '#ffffff',
              color: activeTab === 'schedule' ? '#ffffff' : '#475569',
              boxShadow: activeTab === 'schedule' ? '0 1px 3px rgba(124, 58, 237, 0.2)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px'
            }}
          >
            <Bell size={13} /> <span>Notices</span>
          </button>
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
                {/* Subject Strength & Weakness Heatmap */}
                <div style={{
                  background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
                  padding: '11px 12px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '9px' }}>
                    <h3 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <BarChart2 size={15} color="#0284c7" /> Subject Strength & Weakness
                    </h3>
                    <span style={{ fontSize: '0.66rem', color: '#64748b', fontWeight: 600 }}>Real exam performance</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {analyticsData.subjectBreakdown.map((sub, idx) => (
                      <div key={idx} style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
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

                {/* Performance Growth Trajectory List */}
                <div style={{
                  background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px',
                  padding: '11px 12px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                }}>
                  <h3 style={{ margin: '0 0 9px 0', fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <TrendingUp size={15} color="#16a34a" /> Recent Score Trajectory
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {testResults.slice(0, 4).map((t, idx) => (
                      <div key={idx} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 10px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0'
                      }}>
                        <div style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}>
                          <strong style={{ display: 'block', fontSize: '0.76rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getTestName(t)}</strong>
                          <span style={{ fontSize: '0.64rem', color: '#64748b' }}>{getTestDate(t)}</span>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#0284c7' }}>{t.percentage}%</span>
                          <span style={{ display: 'block', fontSize: '0.68rem', color: '#16a34a', fontWeight: 700 }}>Rank #{t.rank || 1}</span>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {testResults.length === 0 ? (
              <div style={{ background: '#ffffff', padding: '28px 16px', borderRadius: '12px', textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0' }}>
                <Award size={32} color="#94a3b8" style={{ marginBottom: '8px' }} />
                <p style={{ margin: 0, fontWeight: 800, fontSize: '0.88rem' }}>No published OMR test results found yet.</p>
                <span style={{ fontSize: '0.76rem', color: '#94a3b8' }}>Results will appear automatically once teachers scan OMR sheets.</span>
              </div>
            ) : (
              testResults.map((t, idx) => (
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
                        {t.rank ? `${t.rank} / ${t.totalStudents || 74}` : '-'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.62rem', color: '#64748b', display: 'block' }}>Status</span>
                      <strong style={{ fontSize: '0.80rem', color: '#16a34a' }}>Passed</strong>
                    </div>
                  </div>

                  {t.omrSheetImage && (
                    <button
                      onClick={() => setSelectedOmrImage(getMediaUrl(t.omrSheetImage))}
                      style={{
                        marginTop: '8px', width: '100%', background: '#f0f9ff',
                        border: '1px solid #bae6fd', color: '#0284c7', padding: '7px 10px',
                        borderRadius: '8px', fontSize: '0.74rem', fontWeight: 800,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                      }}
                    >
                      <ImageIcon size={14} /> View Annotated OMR Sheet
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: 📅 ATTENDANCE LOG LIST                              */}
        {/* ========================================================= */}
        {activeTab === 'attendance' && (
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

              {upcomingTests.length === 0 ? (
                <div style={{ padding: '20px 12px', textAlign: 'center', color: '#64748b', background: '#faf5ff', borderRadius: '10px', border: '1px dashed #d8b4fe' }}>
                  <Calendar size={26} color="#a855f7" style={{ marginBottom: '6px' }} />
                  <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 600 }}>No upcoming exams scheduled right now.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {upcomingTests.map((t, idx) => (
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
              <button
                onClick={() => setShowNotificationDrawer(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} color="#64748b" />
              </button>
            </div>

            {/* Lock-Screen Web Push Enable Banner */}
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
                {notificationPermission === 'granted' ? '✅ Push Notifications Active' : '⚡ Enable Lock-Screen Push'}
              </button>
            </div>

            {/* Notifications Feed */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {allNotifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 0', color: '#94a3b8' }}>
                  <Bell size={32} style={{ marginBottom: '8px' }} />
                  <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600 }}>No new notifications.</p>
                </div>
              ) : (
                allNotifications.map((notif, idx) => (
                  <div key={idx} style={{
                    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px',
                    padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.88rem', color: '#0f172a' }}>{notif.title}</strong>
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{notif.time}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569', lineHeight: 1.45 }}>
                      {notif.message}
                    </p>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowNotificationDrawer(false)}
              style={{
                marginTop: '14px', width: '100%', background: '#0f172a', color: '#ffffff',
                border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 800,
                fontSize: '0.88rem', cursor: 'pointer'
              }}
            >
              Close
            </button>
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

            {/* Student Info Pill */}
            <div style={{
              background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px',
              padding: '10px 12px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px'
            }}>
              <div style={{
                width: '34px', height: '34px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                color: '#ffffff', fontWeight: 800, fontSize: '0.95rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                {studentData?.name ? studentData.name.charAt(0) : 'S'}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {studentData?.name}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>
                  Roll: {studentData?.rollNo} • {formatBatchName(studentData?.batch)}
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

      {/* OMR Sheet Viewer Modal */}
      {selectedOmrImage && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '16px'
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
            {({ zoomIn, zoomOut, resetTransform, state }) => (
              <div style={{ background: '#fff', borderRadius: '18px', padding: '18px', maxWidth: '900px', width: '90vw', textAlign: 'center', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Scanned OMR Sheet</h4>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button onClick={() => zoomOut()} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}><ZoomOut size={16} color="#475569" /></button>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, minWidth: '40px', color: '#475569' }}>{Math.round(state.scale * 100)}%</span>
                    <button onClick={() => zoomIn()} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}><ZoomIn size={16} color="#475569" /></button>
                    <button onClick={() => resetTransform()} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: '#475569', fontWeight: 'bold', marginLeft: '4px' }}>Reset</button>
                  </div>
                </div>

                <div style={{ flex: 1, overflow: 'hidden', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'grab' }}>
                  <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%' }}>
                    <img
                      src={selectedOmrImage}
                      alt="OMR Sheet"
                      style={{ width: '100%', display: 'block' }}
                      draggable={false}
                    />
                  </TransformComponent>
                </div>

                <button
                  onClick={() => { setSelectedOmrImage(null); }}
                  style={{
                    marginTop: '14px', width: '100%', background: '#0f172a', color: '#fff',
                    border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 800, fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  Close Preview
                </button>
              </div>
            )}
          </TransformWrapper>
        </div>
      )}
    </div>
  );
}
