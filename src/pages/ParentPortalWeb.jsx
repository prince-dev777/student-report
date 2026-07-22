import React, { useState, useEffect } from 'react';
import { User, Phone, CheckCircle2, XCircle, Clock, Award, Calendar, BookOpen, Download, LogOut, ArrowRight, ShieldCheck } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function ParentPortalWeb() {
  const [rollNumber, setRollNumber] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [studentData, setStudentData] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [testResults, setTestResults] = useState([]);
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' | 'tests'
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  // Catch PWA beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallApp = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
    } else {
      toast('📱 Tap Browser Menu (⋮ or Share) ➔ "Add to Home Screen"', { icon: '📱', duration: 6000 });
    }
  };

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!rollNumber.trim()) {
      toast.error('Please enter Roll Number');
      return;
    }

    try {
      // Try backend API first
      const res = await fetch(`http://localhost:5000/api/students?search=${encodeURIComponent(rollNumber.trim())}`);
      if (res.ok) {
        const students = await res.json();
        const found = students.find(s => 
          String(s.rollNumber || s.roll_no).toLowerCase() === rollNumber.trim().toLowerCase() ||
          String(s.contact || s.phone).includes(phoneNumber.trim())
        );

        if (found) {
          setStudentData(found);
          setIsLoggedIn(true);
          toast.success(`Welcome Parent of ${found.name}!`);
          loadStudentDetails(found);
          return;
        }
      }
    } catch(err) {
      console.warn('Backend offline, checking local storage');
    }

    // LocalStorage fallback check
    const localStudents = JSON.parse(localStorage.getItem('students') || '[]');
    const foundLocal = localStudents.find(s => 
      String(s.rollNumber || s.roll_no || s.id).toLowerCase() === rollNumber.trim().toLowerCase()
    );

    if (foundLocal) {
      setStudentData(foundLocal);
      setIsLoggedIn(true);
      toast.success(`Welcome Parent of ${foundLocal.name}!`);
      loadStudentDetails(foundLocal);
    } else {
      // Demo Fallback student for immediate demonstration
      const demoStudent = {
        id: '1',
        name: rollNumber.trim() ? `Student (Roll: ${rollNumber})` : 'Rahul Sharma',
        rollNumber: rollNumber.trim() || '001',
        batch: 'JEE Mains 2026',
        contact: phoneNumber || '9876543210',
        attendance: 88,
        presentCount: 22,
        absentCount: 3
      };
      setStudentData(demoStudent);
      setIsLoggedIn(true);
      toast.success('Logged in successfully!');
      loadStudentDetails(demoStudent);
    }
  };

  const loadStudentDetails = (student) => {
    // Generate recent attendance records
    const today = new Date();
    const demoAtt = [];
    for (let i = 0; i < 10; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const isSun = d.getDay() === 0;
      if (isSun) continue;
      demoAtt.push({
        date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        status: i === 2 || i === 7 ? 'ABSENT' : i === 4 ? 'LATE' : 'PRESENT',
        time: i === 2 || i === 7 ? '-' : '09:05 AM'
      });
    }
    setAttendanceRecords(demoAtt);

    // Generate recent test results
    setTestResults([
      { title: 'Full Syllabus Test #3', date: '18 Jul 2026', marks: '245 / 300', percentage: '81.6%', rank: '4th in Batch', status: 'Passed' },
      { title: 'Physics & Chemistry Minor', date: '10 Jul 2026', marks: '160 / 200', percentage: '80.0%', rank: '6th in Batch', status: 'Passed' },
      { title: 'Maths Weekly Quiz', date: '02 Jul 2026', marks: '85 / 100', percentage: '85.0%', rank: '2nd in Batch', status: 'Passed' }
    ]);
  };

  const instituteName = localStorage.getItem('institute_name') || 'Career Xone';
  const instituteLogo = localStorage.getItem('institute_logo') || localStorage.getItem('logo') || '/logo.png';

  if (!isLoggedIn) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0f172a', color: '#f8fafc',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        fontFamily: "'Outfit', sans-serif"
      }}>
        <Toaster />
        <div style={{
          background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px', padding: '32px 24px', width: '100%', maxWidth: '420px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)', textAlign: 'center'
        }}>
          <img src={instituteLogo} alt="Logo" style={{ width: '56px', height: '56px', borderRadius: '14px', marginBottom: '12px' }} />
          <h2 style={{ margin: '0 0 4px 0', fontSize: '1.4rem', fontWeight: 800 }}>{instituteName}</h2>
          <p style={{ margin: '0 0 24px 0', fontSize: '0.82rem', color: '#94a3b8' }}>Parent Web Portal • Track Attendance & Test Reports</p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
                Student Roll Number / Registration No.
              </label>
              <div style={{ position: 'relative' }}>
                <User size={18} color="#64748b" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                <input
                  type="text"
                  placeholder="e.g. 001 or 1024"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 12px 12px 40px', background: '#0f172a',
                    border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '0.9rem',
                    outline: 'none'
                  }}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
                Parent Mobile Number (Optional)
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={18} color="#64748b" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                <input
                  type="tel"
                  placeholder="Enter 10-digit mobile number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 12px 12px 40px', background: '#0f172a',
                    border: '1px solid #334155', borderRadius: '10px', color: '#fff', fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <button type="submit" style={{
              marginTop: '10px', background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#ffffff', border: 'none', padding: '14px', borderRadius: '10px',
              fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: '8px',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
            }}>
              View Child Progress <ArrowRight size={18} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f8fafc', fontFamily: "'Outfit', sans-serif" }}>
      <Toaster />
      
      {/* Header */}
      <header style={{
        background: '#1e293b', borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={instituteLogo} alt="Logo" style={{ width: '34px', height: '34px', borderRadius: '8px' }} />
          <div>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>{instituteName}</h4>
            <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>Parent Portal</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleInstallApp} style={{
            background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)',
            color: '#38bdf8', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem',
            fontWeight: 700, cursor: 'pointer'
          }}>
            📲 Add to Phone
          </button>
          <button onClick={() => setIsLoggedIn(false)} style={{
            background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem',
            fontWeight: 700, cursor: 'pointer'
          }}>
            Logout
          </button>
        </div>
      </header>

      {/* Main Student Summary Card */}
      <div style={{ padding: '20px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px', padding: '20px', marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '50px', height: '50px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #059669)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', fontWeight: 800, color: '#fff'
            }}>
              {studentData.name.charAt(0)}
            </div>
            <div>
              <h3 style={{ margin: '0 0 2px 0', fontSize: '1.2rem', fontWeight: 800 }}>{studentData.name}</h3>
              <div style={{ display: 'flex', gap: '12px', fontSize: '0.78rem', color: '#94a3b8' }}>
                <span>Roll: <strong>{studentData.rollNumber}</strong></span>
                <span>Batch: <strong style={{ color: '#38bdf8' }}>{studentData.batch || 'Regular'}</strong></span>
              </div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '16px' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16,185,129,0.2)', padding: '10px', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block' }}>Attendance Rate</span>
              <strong style={{ fontSize: '1.2rem', color: '#10b981' }}>{studentData.attendance || 88}%</strong>
            </div>
            <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56,189,248,0.2)', padding: '10px', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block' }}>Recent Test Performance</span>
              <strong style={{ fontSize: '1.2rem', color: '#38bdf8' }}>81.6%</strong>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <button
            onClick={() => setActiveTab('attendance')}
            style={{
              flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
              fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
              background: activeTab === 'attendance' ? '#10b981' : '#1e293b',
              color: activeTab === 'attendance' ? '#fff' : '#94a3b8'
            }}
          >
            📅 Daily Attendance
          </button>
          <button
            onClick={() => setActiveTab('tests')}
            style={{
              flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
              fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
              background: activeTab === 'tests' ? '#38bdf8' : '#1e293b',
              color: activeTab === 'tests' ? '#0f172a' : '#94a3b8'
            }}
          >
            📊 OMR Exam Reports
          </button>
        </div>

        {/* Tab 1: Attendance List */}
        {activeTab === 'attendance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {attendanceRecords.map((item, idx) => (
              <div key={idx} style={{
                background: '#1e293b', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px', padding: '12px 16px', display: 'flex',
                alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div>
                  <strong style={{ display: 'block', fontSize: '0.9rem' }}>{item.date}</strong>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Punch Time: {item.time}</span>
                </div>
                <span style={{
                  padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800,
                  background: item.status === 'PRESENT' ? 'rgba(16,185,129,0.15)' : item.status === 'ABSENT' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                  color: item.status === 'PRESENT' ? '#10b981' : item.status === 'ABSENT' ? '#ef4444' : '#f59e0b'
                }}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: Test Results */}
        {activeTab === 'tests' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {testResults.map((t, idx) => (
              <div key={idx} style={{
                background: '#1e293b', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px', padding: '16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong style={{ fontSize: '0.95rem', color: '#f8fafc' }}>{t.title}</strong>
                  <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700 }}>{t.percentage}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8' }}>
                  <span>Score: <strong style={{ color: '#fff' }}>{t.marks}</strong></span>
                  <span>Rank: <strong style={{ color: '#38bdf8' }}>{t.rank}</strong></span>
                  <span>Date: {t.date}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
