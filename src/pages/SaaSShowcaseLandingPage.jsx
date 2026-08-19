import React from 'react';
import { 
  Sparkles, Smartphone, QrCode, MessageSquare, CheckCircle, ArrowRight, 
  UserCheck, Users, Shield, Cpu, RefreshCw, BarChart3, Database, 
  FileSpreadsheet, Award, Clock, PhoneCall, ChevronRight, Lock
} from 'lucide-react';

export default function SaaSShowcaseLandingPage() {
  const logo = localStorage.getItem('institute_logo') || localStorage.getItem('logo') || '/logo.png';
  const name = localStorage.getItem('institute_name') || 'Career Xone';

  const portals = [
    {
      id: 'parent',
      title: 'Parents Web & Mobile App',
      badge: 'Parent Portal',
      badgeColor: '#10b981',
      badgeBg: 'rgba(16, 185, 129, 0.1)',
      icon: Users,
      iconColor: '#10b981',
      iconBg: 'rgba(16, 185, 129, 0.12)',
      btnBg: 'linear-gradient(135deg, #10b981, #059669)',
      btnShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
      link: '#/parent',
      description: 'Gives parents instant transparency into their child\'s daily attendance, academic scores, and overall progress.',
      features: [
        'Real-time Biometric In/Out Punch Alerts',
        'OMR Test Marksheets & Rank Analytics',
        'Subject-wise Performance & Percentile Charts',
        'Downloadable Detailed PDF Progress Cards'
      ]
    },
    {
      id: 'teacher',
      title: 'Teacher & Faculty Portal',
      badge: 'Faculty Portal',
      badgeColor: '#3b82f6',
      badgeBg: 'rgba(59, 130, 246, 0.1)',
      icon: Sparkles,
      iconColor: '#3b82f6',
      iconBg: 'rgba(59, 130, 246, 0.12)',
      btnBg: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
      btnShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
      link: '#/teacher',
      description: 'Empowers mentors with a 360° student academic dossier, test series evaluation, and student engagement history.',
      features: [
        '360° Comprehensive Student Academic Dossier',
        'Test Series Average, Top & Low Benchmark Analysis',
        'Daily Class Hours & Biometric Punch History',
        '1-Tap Direct Parent WhatsApp & Calling Contact'
      ]
    },
    {
      id: 'staff',
      title: 'Staff Attendance Web App',
      badge: 'Staff Attendance',
      badgeColor: '#8b5cf6',
      badgeBg: 'rgba(139, 92, 246, 0.1)',
      icon: UserCheck,
      iconColor: '#8b5cf6',
      iconBg: 'rgba(139, 92, 246, 0.12)',
      btnBg: 'linear-gradient(135deg, #7c3aed, #6366f1)',
      btnShadow: '0 4px 14px rgba(124, 58, 237, 0.35)',
      link: '#/staff',
      description: 'High-speed manual attendance check-in & check-out tool designed specifically for mobile and front-desk staff.',
      features: [
        'Ultra-fast 1-Tap Check-In, Check-Out & Absent marking',
        'Quick Filter by Course (JEE, NEET, MHCET) & Batch',
        'Instant Name, Roll Number & Phone Search Bar',
        'Real-time Sync with Desktop Admin Database'
      ]
    },
    {
      id: 'inquiry',
      title: 'Front-Desk Inquiry Desk',
      badge: 'Lead Management',
      badgeColor: '#f59e0b',
      badgeBg: 'rgba(245, 158, 11, 0.1)',
      icon: MessageSquare,
      iconColor: '#f59e0b',
      iconBg: 'rgba(245, 158, 11, 0.12)',
      btnBg: 'linear-gradient(135deg, #f59e0b, #d97706)',
      btnShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
      link: '#/inquiry',
      description: 'Streamlines walk-in admissions, parent inquiries, and follow-ups with instant status updates and communication.',
      features: [
        'Instant Walk-in Student & Parent Inquiry Entry',
        'Status Pipeline: Pending, Follow-up, Admitted, Resolved',
        '1-Tap WhatsApp Chat & Direct Phone Dialing',
        'Live Cloud-to-Desktop Synchronization'
      ]
    }
  ];

  const capabilities = [
    {
      icon: QrCode,
      color: '#38bdf8',
      title: 'High-Speed AI OMR Scanner',
      desc: 'Sub-second optical bubble detection engine. Evaluates 100+ answer sheets per minute with automated answer key grading, negative marking, and rank generation.'
    },
    {
      icon: MessageSquare,
      color: '#22c55e',
      title: 'Automated WhatsApp Messaging',
      desc: 'Instant automated notification suite for biometric punch arrival/exit, detailed OMR exam scorecards with PDF report cards, and targeted batch broadcasts.'
    },
    {
      icon: Clock,
      color: '#a855f7',
      title: 'Biometric Machine Sync (ADMS)',
      desc: 'Seamless real-time integration with fingerprint, face recognition, and RFID biometric devices for automated proxy-free student attendance.'
    },
    {
      icon: RefreshCw,
      color: '#ec4899',
      title: 'Hybrid Cloud & Local Sync',
      desc: 'Offline-first architecture ensures 100% operational uptime on desktop app even without internet, with automated two-way background cloud sync.'
    },
    {
      icon: BarChart3,
      color: '#f97316',
      title: 'Test Series & Rank Analytics',
      desc: 'Deep multi-test comparative analytics, subject breakdown (Physics, Chemistry, Maths, Bio), percentile rankings, and historical progress trajectories.'
    },
    {
      icon: Database,
      color: '#06b6d4',
      title: 'Student Dossier & Session Records',
      desc: 'Complete student academic database with batch assignments, roll number allocation, multi-session archiving, and parent credential management.'
    }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0f1d',
      color: '#f8fafc',
      fontFamily: "'Outfit', 'Inter', sans-serif",
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* Background Ambient Lights */}
      <div style={{
        position: 'absolute', top: '-180px', right: '-120px', width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(37, 99, 235, 0.2) 0%, rgba(10, 15, 29, 0) 70%)',
        borderRadius: '50%', pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', top: '35%', left: '-180px', width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, rgba(10, 15, 29, 0) 70%)',
        borderRadius: '50%', pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', right: '-150px', width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, rgba(10, 15, 29, 0) 70%)',
        borderRadius: '50%', pointerEvents: 'none'
      }} />

      {/* Top Navigation Bar */}
      <header style={{
        padding: '16px 5%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(10, 15, 29, 0.85)',
        backdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img 
            src={logo} 
            alt="Logo" 
            style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'contain', background: '#ffffff', padding: '2px' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px' }}>
                {name}
              </h3>
              <span style={{ 
                background: 'linear-gradient(135deg, #38bdf8, #2563eb)', 
                color: '#ffffff', 
                fontSize: '0.65rem', 
                fontWeight: 800, 
                padding: '2px 7px', 
                borderRadius: '6px',
                letterSpacing: '0.5px'
              }}>
                PRO ECOSYSTEM
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Institute Automation & Student Analytics</span>
          </div>
        </div>

        {/* Quick Nav Links */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <a href="#/parent" style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            padding: '7px 14px',
            borderRadius: '9px',
            textDecoration: 'none',
            fontSize: '0.8rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Users size={15} /> Parent Portal
          </a>

          <a href="#/teacher" style={{
            background: 'rgba(59, 130, 246, 0.12)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            color: '#60a5fa',
            padding: '7px 14px',
            borderRadius: '9px',
            textDecoration: 'none',
            fontSize: '0.8rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Sparkles size={15} /> Teacher Portal
          </a>

          <a href="#/staff" style={{
            background: 'rgba(139, 92, 246, 0.12)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            color: '#c084fc',
            padding: '7px 14px',
            borderRadius: '9px',
            textDecoration: 'none',
            fontSize: '0.8rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <UserCheck size={15} /> Staff Portal
          </a>

          <a href="#/inquiry" style={{
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#fbbf24',
            padding: '7px 14px',
            borderRadius: '9px',
            textDecoration: 'none',
            fontSize: '0.8rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <MessageSquare size={15} /> Inquiry Desk
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{ padding: '60px 5% 40px', textAlign: 'center', maxWidth: '960px', margin: '0 auto' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)',
          padding: '6px 16px', borderRadius: '50px', fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600,
          marginBottom: '20px'
        }}>
          <Sparkles size={14} /> AI OMR • Real-time Biometric • WhatsApp Engine • Hybrid Cloud Sync
        </div>

        <h1 style={{
          fontSize: 'clamp(2.2rem, 5vw, 3.4rem)', fontWeight: 900, lineHeight: 1.15, marginBottom: '18px',
          background: 'linear-gradient(135deg, #ffffff 40%, #94a3b8 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          letterSpacing: '-1px'
        }}>
          Complete Institute Automation & Student Analytics Ecosystem
        </h1>

        <p style={{ 
          fontSize: '1.1rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: '40px', 
          maxWidth: '780px', margin: '0 auto 40px', fontWeight: 400 
        }}>
          Bridging Parents, Faculty, Staff, and Institute Leadership through real-time attendance tracking, automated WhatsApp scorecards, sub-second OMR grading, and full academic dossiers.
        </p>
      </section>

      {/* 4 Specialized Web Portals Section */}
      <section style={{ maxWidth: '1240px', margin: '0 auto 70px', padding: '0 5%' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h2 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 8px' }}>
            Specialized Web Portals
          </h2>
          <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: 0 }}>
            Dedicated portals crafted with tailored views for every stakeholder.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px'
        }}>
          {portals.map((p) => {
            const IconComponent = p.icon;
            return (
              <div
                key={p.id}
                style={{
                  background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.85))',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '20px',
                  padding: '26px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
                  transition: 'transform 0.2s ease, border-color 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div>
                  {/* Top Badge & Icon */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                    <div style={{
                      width: '46px', height: '46px', borderRadius: '12px',
                      background: p.iconBg, color: p.iconColor,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <IconComponent size={24} />
                    </div>
                    <span style={{
                      background: p.badgeBg, color: p.badgeColor,
                      border: `1px solid ${p.badgeColor}33`,
                      padding: '3px 10px', borderRadius: '20px',
                      fontSize: '0.72rem', fontWeight: 700
                    }}>
                      {p.badge}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 10px' }}>
                    {p.title}
                  </h3>
                  <p style={{ fontSize: '0.84rem', color: '#94a3b8', lineHeight: 1.5, margin: '0 0 18px' }}>
                    {p.description}
                  </p>

                  {/* Feature Checkpoints */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                    {p.features.map((feat, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.78rem', color: '#cbd5e1' }}>
                        <CheckCircle size={14} color={p.iconColor} style={{ marginTop: '2px', flexShrink: 0 }} />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Open Button */}
                <a
                  href={p.link}
                  style={{
                    background: p.btnBg,
                    color: '#ffffff',
                    padding: '12px 18px',
                    borderRadius: '12px',
                    textDecoration: 'none',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: p.btnShadow,
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span>Launch Portal</span>
                  <ArrowRight size={16} />
                </a>
              </div>
            );
          })}
        </div>
      </section>

      {/* Core Platform Capabilities Grid */}
      <section style={{ maxWidth: '1240px', margin: '0 auto 80px', padding: '0 5%' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 8px' }}>
            End-to-End System Capabilities
          </h2>
          <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: 0 }}>
            Engineered for high reliability, accuracy, and effortless day-to-day administration.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px'
        }}>
          {capabilities.map((cap, i) => {
            const Icon = cap.icon;
            return (
              <div
                key={i}
                style={{
                  background: 'rgba(30, 41, 59, 0.45)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '16px',
                  padding: '24px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px'
                }}
              >
                <div style={{
                  width: '42px', height: '42px', borderRadius: '10px',
                  background: `${cap.color}15`, color: cap.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Icon size={22} />
                </div>
                <div>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 6px' }}>
                    {cap.title}
                  </h4>
                  <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
                    {cap.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Security & Access Banner */}
      <section style={{ maxWidth: '1100px', margin: '0 auto 60px', padding: '0 5%' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.1), rgba(124, 58, 237, 0.1))',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: '20px',
          padding: '30px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', maxWidth: '650px' }}>
            <div style={{
              width: '50px', height: '50px', borderRadius: '14px',
              background: 'rgba(59, 130, 246, 0.2)', color: '#38bdf8',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <Lock size={26} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
                Multi-Tenant Role Security & Independent Passcodes
              </h3>
              <p style={{ margin: 0, fontSize: '0.83rem', color: '#94a3b8', lineHeight: 1.4 }}>
                All staff, teacher, and front-desk portals are protected with custom access passcodes configurable directly by the institute administrator with JWT session encryption.
              </p>
            </div>
          </div>

          <a
            href="#/parent"
            style={{
              background: '#ffffff',
              color: '#0f172a',
              padding: '10px 20px',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.85rem',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Access System <ChevronRight size={16} />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        fontSize: '0.8rem',
        color: '#64748b',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '30px 5% 40px'
      }}>
        <p style={{ margin: '0 0 6px' }}>
          &copy; {new Date().getFullYear()} <strong>{name}</strong>. All rights reserved.
        </p>
        <p style={{ margin: 0, fontSize: '0.74rem', color: '#475569' }}>
          Powered by Career Xone Pro Automation Engine • Fast AI OMR • Biometric Sync • WhatsApp Cloud Service
        </p>
      </footer>
    </div>
  );
}
