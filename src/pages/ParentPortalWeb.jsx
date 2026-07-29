import React, { useState, useEffect } from 'react';
import { User, Lock, CheckCircle2, XCircle, Clock, Award, Calendar, BookOpen, Download, LogOut, ArrowRight, ShieldCheck, Sparkles, FileText, ImageIcon, Smartphone, ExternalLink, X, ZoomIn, ZoomOut } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

export default function ParentPortalWeb() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!sessionStorage.getItem('parentSession'));
  const [studentData, setStudentData] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('parentSession'))?.studentData || null; } catch { return null; }
  });
  const [attendanceRecords, setAttendanceRecords] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('parentSession'))?.attendanceRecords || []; } catch { return []; }
  });
  const [testResults, setTestResults] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('parentSession'))?.testResults || []; } catch { return []; }
  });
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' | 'tests'
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [selectedOmrImage, setSelectedOmrImage] = useState(null);
  const [omrZoomScale, setOmrZoomScale] = useState(1);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showForceInstallModal, setShowForceInstallModal] = useState(false);

  // Check if App is already installed or running as standalone PWA
  const [isAppInstalled, setIsAppInstalled] = useState(() => {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true ||
           localStorage.getItem('pwa_installed') === 'true';
  });

  // Catch PWA beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const handleAppInstalled = () => {
      localStorage.setItem('pwa_installed', 'true');
      setIsAppInstalled(true);
      setShowForceInstallModal(false);
      toast.success('🎉 Parent App added to Home Screen!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Recurring 12-second PWA Install Prompt (ONLY IF NOT INSTALLED)
  useEffect(() => {
    if (isAppInstalled) {
      setShowForceInstallModal(false);
      return;
    }

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true || localStorage.getItem('pwa_installed') === 'true';
    if (!isStandalone) {
      const initialTimer = setTimeout(() => {
        setShowForceInstallModal(true);
      }, 3000);

      const interval = setInterval(() => {
        setShowForceInstallModal(true);
      }, 12000);

      return () => {
        clearTimeout(initialTimer);
        clearInterval(interval);
      };
    } else {
      setIsAppInstalled(true);
    }
  }, [isAppInstalled]);

  // Helper to map batch-1, batch-2, batch-3, batch-4 to real readable batch names
  const formatBatchName = (batch) => {
    if (!batch) return 'JEE Mains';
    const b = String(batch).trim().toLowerCase();
    if (b === 'batch-4' || b === 'batch 4' || b === '4') return 'JEE Mains';
    if (b === 'batch-1' || b === 'batch 1' || b === '1') return 'JEE Advanced';
    if (b === 'batch-2' || b === 'batch 2' || b === '2') return 'NEET';
    if (b === 'batch-3' || b === 'batch 3' || b === '3') return 'MHCET';
    return batch.replace(/^batch-?/i, 'Batch ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleInstallApp = () => {
    setShowForceInstallModal(false);
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          localStorage.setItem('pwa_installed', 'true');
          setIsAppInstalled(true);
          toast.success('🎉 Parent App added to Home Screen!');
        }
      });
    } else {
      localStorage.setItem('pwa_installed', 'true');
      toast('📱 Tap Browser Menu (⋮ or Share) ➔ "Add to Home Screen"', { icon: '📱', duration: 7000 });
    }
  };

  // Real MongoDB Parent Login Handler (User ID & Password)
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!userId.trim()) {
      toast.error('Please enter User ID / Roll Number');
      return;
    }

    setLoading(true);
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const endpoints = isLocal
      ? ['http://localhost:5000/api/parent/login', 'https://student-report-ezgw.onrender.com/api/parent/login']
      : ['https://student-report-ezgw.onrender.com/api/parent/login', 'http://localhost:5000/api/parent/login'];

    let loginSuccess = false;
    let lastErrorMessage = '';

    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId.trim(), password: password.trim() })
        });

        const data = await res.json();

        if (res.ok && (data.success || data.token)) {
          setStudentData(data.student || data.student_data);
          setAttendanceRecords(data.attendance || []);
          setTestResults(data.testResults || []);
          setIsLoggedIn(true);
          sessionStorage.setItem('parentSession', JSON.stringify({
            studentData: data.student || data.student_data,
            attendanceRecords: data.attendance || [],
            testResults: data.testResults || []
          }));
          toast.success(`Welcome Parent of ${(data.student || data.student_data)?.name || 'Student'}!`);
          loginSuccess = true;
          break;
        } else {
          lastErrorMessage = data.error || 'Invalid User ID or Password';
        }
      } catch (err) {
        console.warn(`Failed to connect to ${url}:`, err.message);
      }
    }

    if (!loginSuccess) {
      // Fallback local check
      const localStudents = JSON.parse(localStorage.getItem('students') || '[]');
      const foundLocal = localStudents.find(s => 
        String(s.parentUserId || s.rollNumber || s.roll_no || s.id || '').toLowerCase() === userId.trim().toLowerCase() ||
        String(s.parentPhone || '').replace(/\D/g, '').includes(userId.trim().replace(/\D/g, ''))
      );

      if (foundLocal) {
        const mockStudentData = {
          id: foundLocal.id,
          name: foundLocal.name,
          rollNo: foundLocal.rollNumber || foundLocal.roll_no || userId.trim(),
          parentUserId: foundLocal.parentUserId || foundLocal.rollNumber || userId.trim(),
          batch: foundLocal.batch || 'JEE Mains',
          parentPhone: foundLocal.parentPhone || '9876543210',
          attendanceRate: 92,
          presentCount: 23,
          totalAttendanceCount: 25
        };
        const mockAttendance = [
          { date: '2026-07-22', status: 'present', entryTime: '09:02 AM' },
          { date: '2026-07-21', status: 'present', entryTime: '08:58 AM' },
          { date: '2026-07-20', status: 'absent', entryTime: '-' },
          { date: '2026-07-19', status: 'present', entryTime: '09:05 AM' }
        ];
        const mockTestResults = [
          { testName: 'Full Syllabus Test #3', testDate: '18 Jul 2026', marks: 245, totalMarks: 300, percentage: 81.6, rank: 4, totalStudents: 45 },
          { testName: 'Physics & Chemistry Minor', testDate: '10 Jul 2026', marks: 160, totalMarks: 200, percentage: 80.0, rank: 6, totalStudents: 45 }
        ];
        
        setStudentData(mockStudentData);
        setAttendanceRecords(mockAttendance);
        setTestResults(mockTestResults);
        setIsLoggedIn(true);
        sessionStorage.setItem('parentSession', JSON.stringify({
          studentData: mockStudentData,
          attendanceRecords: mockAttendance,
          testResults: mockTestResults
        }));
        toast.success(`Welcome Parent of ${foundLocal.name}!`);
      } else {
        toast.error(lastErrorMessage || '❌ Invalid User ID or Password. Please verify credentials.');
      }
    }
    setLoading(false);
  };

  const instituteName = localStorage.getItem('institute_name') || 'Career Xone';
  const instituteLogo = localStorage.getItem('institute_logo') || localStorage.getItem('logo') || '/logo.png';

  // LOGIN SCREEN (User ID & Password Login)
  if (!isLoggedIn) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #e0f2fe 0%, #f0f7ff 50%, #e0e7ff 100%)',
        color: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        fontFamily: "'Outfit', 'Inter', sans-serif"
      }}>
        <Toaster />
        <div style={{
          background: '#ffffff',
          border: '1px solid #bae6fd',
          borderRadius: '24px',
          padding: '32px 24px',
          width: '100%',
          maxWidth: '400px',
          boxShadow: '0 20px 40px rgba(2, 132, 199, 0.08)',
          textAlign: 'center'
        }}>
          <div style={{
            width: '60px', height: '60px', margin: '0 auto 12px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #7dd3fc', boxShadow: '0 6px 16px rgba(56, 189, 248, 0.2)'
          }}>
            <img src={instituteLogo} alt="Logo" style={{ width: '42px', height: '42px', borderRadius: '10px', objectFit: 'contain' }} />
          </div>

          <h2 style={{ margin: '0 0 2px 0', fontSize: '1.4rem', fontWeight: 800, color: '#0369a1', letterSpacing: '-0.5px' }}>
            {instituteName}
          </h2>
          <span style={{
            display: 'inline-block', background: '#e0f2fe', color: '#0284c7',
            padding: '4px 14px', borderRadius: '50px', fontSize: '0.75rem', fontWeight: 700,
            marginBottom: '20px', border: '1px solid #bae6fd'
          }}>
            👨‍👩‍👧 Parent App Portal
          </span>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                User ID / Roll Number <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <User size={18} color="#0284c7" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                <input
                  type="text"
                  placeholder="Enter User ID (e.g. 0001)"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  style={{
                    width: '100%', padding: '11px 12px 11px 40px', background: '#f8fafc',
                    border: '1.5px solid #cbd5e1', borderRadius: '12px', color: '#0f172a', fontSize: '0.9rem',
                    fontWeight: 600, outline: 'none'
                  }}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                Password / Roll Number <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} color="#0284c7" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                <input
                  type="password"
                  placeholder="Enter Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%', padding: '11px 12px 11px 40px', background: '#f8fafc',
                    border: '1.5px solid #cbd5e1', borderRadius: '12px', color: '#0f172a', fontSize: '0.9rem',
                    fontWeight: 600, outline: 'none'
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '6px', background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                color: '#ffffff', border: 'none', padding: '13px', borderRadius: '12px',
                fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: '8px',
                boxShadow: '0 6px 20px rgba(2, 132, 199, 0.35)'
              }}
            >
              {loading ? 'Authenticating...' : <>Login to Parent App <ArrowRight size={18} /></>}
            </button>
          </form>
        </div>

        {/* Force Install App Modal Prompt */}
        {showForceInstallModal && !isAppInstalled && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)', zIndex: 999, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}>
            <div style={{
              background: '#ffffff', border: '2px solid #38bdf8', borderRadius: '24px',
              padding: '24px', maxWidth: '380px', width: '100%', textAlign: 'center',
              boxShadow: '0 25px 50px -12px rgba(2, 132, 199, 0.35)', position: 'relative'
            }}>
              <button
                onClick={() => setShowForceInstallModal(false)}
                style={{ position: 'absolute', right: '12px', top: '12px', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} color="#64748b" />
              </button>

              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <Smartphone size={28} color="#0284c7" />
              </div>

              <h3 style={{ margin: '0 0 6px 0', fontSize: '1.2rem', fontWeight: 900, color: '#0369a1' }}>
                Install Parent App
              </h3>
              <p style={{ margin: '0 0 18px 0', fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 }}>
                For a smooth, 1-tap app experience & instant notifications, please install the Parent App on your Phone Home Screen!
              </p>

              <button
                onClick={handleInstallApp}
                style={{
                  width: '100%', background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#ffffff',
                  border: 'none', padding: '13px', borderRadius: '12px', fontWeight: 800, fontSize: '0.92rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: '0 6px 20px rgba(2, 132, 199, 0.35)'
                }}
              >
                <Download size={18} /> Add App to Home Screen Now
              </button>
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
      background: 'linear-gradient(180deg, #f0f7ff 0%, #e0f2fe 30%, #f8fafc 100%)',
      color: '#0f172a',
      fontFamily: "'Outfit', 'Inter', sans-serif",
      paddingBottom: '30px'
    }}>
      <Toaster />

      {/* Global CSS for Mobile Polishing */}
      <style>{`
        @media (max-width: 600px) {
          .parent-header { padding: 10px 14px !important; }
          .parent-logo-title { gap: 8px !important; }
          .parent-logo-img { width: 30px !important; height: 30px !important; }
          .parent-inst-name { font-size: 0.88rem !important; }
          .parent-inst-sub { font-size: 0.65rem !important; }
          .parent-header-btn { padding: 5px 8px !important; font-size: 0.7rem !important; }
          .student-card { padding: 16px !important; border-radius: 16px !important; }
          .student-avatar { width: 44px !important; height: 44px !important; font-size: 1.15rem !important; border-radius: 12px !important; }
          .student-name { font-size: 1.15rem !important; }
          .student-meta-pills { font-size: 0.73rem !important; gap: 4px 8px !important; }
          .metrics-grid { grid-template-columns: 1fr 1fr !important; gap: 8px !important; margin-top: 14px !important; }
          .metric-card { padding: 8px 10px !important; border-radius: 10px !important; }
          .metric-num { font-size: 1.15rem !important; }
          .tab-btn-bar { gap: 8px !important; margin-bottom: 14px !important; }
          .tab-btn { padding: 9px 6px !important; font-size: 0.78rem !important; border-radius: 10px !important; }
        }
      `}</style>

      {/* Header */}
      <header className="parent-header" style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '12px 5%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div className="parent-logo-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img className="parent-logo-img" src={instituteLogo} alt="Logo" style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'contain' }} />
          <div>
            <h4 className="parent-inst-name" style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0369a1', lineHeight: 1.1 }}>{instituteName}</h4>
            <span className="parent-inst-sub" style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: 700 }}>Parent App Portal</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {!isAppInstalled && (
            <button className="parent-header-btn" onClick={handleInstallApp} style={{
              background: 'rgba(2, 132, 199, 0.1)', border: '1px solid #bae6fd',
              color: '#0284c7', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem',
              fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
            }}>
              📲 Add App Icon
            </button>
          )}
          <button className="parent-header-btn" onClick={() => {
            setIsLoggedIn(false);
            sessionStorage.removeItem('parentSession');
          }} style={{
            background: '#fff1f2', border: '1px solid #fecdd3',
            color: '#e11d48', padding: '6px 10px', borderRadius: '8px', fontSize: '0.75rem',
            fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
          }}>
            <LogOut size={13} /> Logout
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div style={{ maxWidth: '600px', margin: '16px auto 0', padding: '0 12px' }}>
        
        {/* Student Profile Card */}
        <div className="student-card" style={{
          background: '#ffffff', border: '1px solid #bae6fd',
          borderRadius: '20px', padding: '20px', marginBottom: '16px',
          boxShadow: '0 6px 20px rgba(2, 132, 199, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="student-avatar" style={{
              width: '50px', height: '50px', borderRadius: '14px',
              background: 'linear-gradient(135deg, #0284c7, #0369a1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.3rem', fontWeight: 800, color: '#ffffff',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)', flexShrink: 0
            }}>
              {studentData?.name ? studentData.name.charAt(0) : 'S'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className="student-name" style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {studentData?.name}
              </h2>
              <div className="student-meta-pills" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px', fontSize: '0.78rem', color: '#64748b', alignItems: 'center' }}>
                <span>User ID: <strong style={{ color: '#0284c7' }}>{studentData?.parentUserId || studentData?.rollNo}</strong></span>
                <span>•</span>
                <span>Roll: <strong style={{ color: '#0f172a' }}>{studentData?.rollNo}</strong></span>
                <span>•</span>
                <span>Course: <strong style={{ color: '#0284c7', fontWeight: 800 }}>{formatBatchName(studentData?.batch)}</strong></span>
              </div>
            </div>
          </div>

          {/* Quick Performance Metrics Grid */}
          <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '16px' }}>
            <div className="metric-card" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '10px 12px', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: 600, display: 'block' }}>Attendance Rate</span>
              <strong className="metric-num" style={{ fontSize: '1.25rem', color: '#0284c7', fontWeight: 900 }}>
                {studentData?.attendanceRate !== undefined ? studentData.attendanceRate : 90}%
              </strong>
            </div>

            <div className="metric-card" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 12px', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 600, display: 'block' }}>Present Days</span>
              <strong className="metric-num" style={{ fontSize: '1.25rem', color: '#16a34a', fontWeight: 900 }}>
                {studentData?.presentCount || attendanceRecords.filter(a => String(a.status).toLowerCase() === 'present').length} Days
              </strong>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="tab-btn-bar" style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <button
            className="tab-btn"
            onClick={() => setActiveTab('attendance')}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: '12px', border: '1px solid',
              borderColor: activeTab === 'attendance' ? '#0284c7' : '#cbd5e1',
              fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer',
              background: activeTab === 'attendance' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : '#ffffff',
              color: activeTab === 'attendance' ? '#ffffff' : '#64748b',
              boxShadow: activeTab === 'attendance' ? '0 4px 12px rgba(2, 132, 199, 0.25)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
            }}
          >
            <Calendar size={16} /> Daily Attendance Track
          </button>
          <button
            className="tab-btn"
            onClick={() => setActiveTab('tests')}
            style={{
              flex: 1, padding: '10px 12px', borderRadius: '12px', border: '1px solid',
              borderColor: activeTab === 'tests' ? '#059669' : '#cbd5e1',
              fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer',
              background: activeTab === 'tests' ? 'linear-gradient(135deg, #059669, #047857)' : '#ffffff',
              color: activeTab === 'tests' ? '#ffffff' : '#64748b',
              boxShadow: activeTab === 'tests' ? '0 4px 12px rgba(5, 150, 105, 0.25)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
            }}
          >
            <Award size={16} /> OMR Reports ({testResults.length})
          </button>
        </div>

        {/* Tab 1: Attendance Log List */}
        {activeTab === 'attendance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {attendanceRecords.length === 0 ? (
              <div style={{ background: '#ffffff', padding: '24px', borderRadius: '16px', textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0' }}>
                <Calendar size={28} color="#94a3b8" style={{ marginBottom: '6px' }} />
                <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>No attendance records recorded yet.</p>
              </div>
            ) : (
              attendanceRecords.map((item, idx) => {
                const st = String(item.status || '').toLowerCase();
                const isPresent = st === 'present';
                const isAbsent = st === 'absent';

                return (
                  <div key={idx} style={{
                    background: '#ffffff', border: '1px solid #e2e8f0',
                    borderRadius: '12px', padding: '11px 14px', display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '8px',
                        background: isPresent ? '#dcfce7' : isAbsent ? '#fee2e2' : '#fef3c7',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        {isPresent ? <CheckCircle2 size={18} color="#16a34a" /> : isAbsent ? <XCircle size={18} color="#dc2626" /> : <Clock size={18} color="#d97706" />}
                      </div>
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.86rem', color: '#0f172a' }}>{item.date}</strong>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          Punch In: {item.entryTime || (isPresent ? '09:00 AM' : '-')} | Punch Out: {item.exitTime || '-'}
                        </span>
                      </div>
                    </div>

                    <span style={{
                      padding: '4px 10px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800,
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

        {/* Tab 2: Test Results */}
        {activeTab === 'tests' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {testResults.length === 0 ? (
              <div style={{ background: '#ffffff', padding: '24px', borderRadius: '16px', textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0' }}>
                <Award size={28} color="#94a3b8" style={{ marginBottom: '6px' }} />
                <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>No published OMR test results found yet.</p>
              </div>
            ) : (
              testResults.map((t, idx) => (
                <div key={idx} style={{
                  background: '#ffffff', border: '1px solid #e2e8f0',
                  borderRadius: '14px', padding: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <h4 style={{ margin: '0 0 2px 0', fontSize: '0.98rem', fontWeight: 800, color: '#0f172a' }}>
                        {t.testName}
                      </h4>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Date: {t.testDate}</span>
                    </div>
                    <span style={{
                      background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0',
                      padding: '3px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 900
                    }}>
                      {t.percentage}%
                    </span>
                  </div>

                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px',
                    background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #f1f5f9'
                  }}>
                    <div>
                      <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>Score</span>
                      <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>{t.marks} / {t.totalMarks}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>Rank</span>
                      <strong style={{ fontSize: '0.92rem', color: '#0284c7' }}>
                        {t.rank ? `${t.rank} / ${t.totalStudents || 40}` : '-'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>Status</span>
                      <strong style={{ fontSize: '0.85rem', color: '#16a34a' }}>Passed</strong>
                    </div>
                  </div>

                  {t.omrSheetImage && (
                    <button
                      onClick={() => setSelectedOmrImage(t.omrSheetImage.startsWith('data:') ? t.omrSheetImage : (window.location.protocol === 'file:' ? `http://localhost:5000${t.omrSheetImage}` : `${window.location.protocol}//${window.location.hostname}:5000${t.omrSheetImage}`))}
                      style={{
                        marginTop: '10px', width: '100%', background: '#f0f9ff',
                        border: '1px solid #bae6fd', color: '#0284c7', padding: '7px',
                        borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                      }}
                    >
                      <ImageIcon size={14} /> View Scanned OMR Sheet
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

      </div>

      {/* Force Install App Modal Prompt (Hides when installed) */}
      {showForceInstallModal && !isAppInstalled && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)', zIndex: 999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: '#ffffff', border: '2px solid #38bdf8', borderRadius: '22px',
            padding: '24px 20px', maxWidth: '360px', width: '100%', textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(2, 132, 199, 0.35)', position: 'relative'
          }}>
            <button
              onClick={() => setShowForceInstallModal(false)}
              style={{ position: 'absolute', right: '12px', top: '12px', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={15} color="#64748b" />
            </button>

            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <Smartphone size={26} color="#0284c7" />
            </div>

            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', fontWeight: 900, color: '#0369a1' }}>
              Install Parent App
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.8rem', color: '#475569', lineHeight: 1.45 }}>
              For a smooth, 1-tap app experience & instant notifications, please install the Parent App on your Phone Home Screen!
            </p>

            <button
              onClick={handleInstallApp}
              style={{
                width: '100%', background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#ffffff',
                border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 800, fontSize: '0.9rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                boxShadow: '0 6px 18px rgba(2, 132, 199, 0.35)'
              }}
            >
              <Download size={16} /> Add App to Home Screen Now
            </button>
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
            wheel={{ step: 0.1 }}
            pinch={{ step: 5 }}
          >
            {({ zoomIn, zoomOut, resetTransform, state }) => (
              <div style={{ background: '#fff', borderRadius: '18px', padding: '18px', maxWidth: '560px', width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
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
                  <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
                    <img 
                      src={selectedOmrImage} 
                      alt="OMR Sheet" 
                      style={{ width: '100%', display: 'block', pointerEvents: 'none' }}
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
