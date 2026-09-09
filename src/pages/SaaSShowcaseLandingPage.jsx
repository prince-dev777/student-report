import React, { useState } from 'react';
import { 
  Sparkles, Smartphone, QrCode, MessageSquare, CheckCircle, ArrowRight, 
  UserCheck, Users, Shield, Cpu, RefreshCw, BarChart3, Database, 
  FileSpreadsheet, Award, Clock, PhoneCall, ChevronRight, Lock, 
  CheckCircle2, Zap, FileText, School, Send, Layers, HelpCircle,
  TrendingUp, Laptop, WifiOff, Globe, BookOpen, AlertCircle
} from 'lucide-react';

export default function SaaSShowcaseLandingPage() {
  const logo = localStorage.getItem('institute_logo') || localStorage.getItem('logo') || '/logo.png';
  const name = localStorage.getItem('institute_name') || 'Career Xone';

  const [activeTab, setActiveTab] = useState('all');

  const coreModules = [
    {
      id: 'omr',
      category: 'evaluation',
      icon: QrCode,
      tag: 'Proprietary AI Tech',
      title: 'High-Speed AI OMR Evaluation Engine',
      badge: 'Sub-Second Grading',
      badgeBg: '#e0f2fe',
      badgeColor: '#0284c7',
      desc: 'Advanced computer-vision algorithm evaluates 100+ answer sheets per minute directly via high-speed flatbed scanners or smartphone camera.',
      features: [
        'Automatic 7-template alignment (T1–T7) with skew correction',
        'Multi-subject grading (Physics, Chemistry, Maths, Bio) in one scan',
        'Custom negative marking (+4 / -1 or custom scoring rules)',
        'Instant rank list, percentile, and subject-wise score computation',
        'Visual bubble inspector with manual review and audit override'
      ]
    },
    {
      id: 'biometric',
      category: 'attendance',
      icon: Clock,
      tag: 'Hardware Integration',
      title: 'Real-Time Biometric Machine Sync (ADMS Push)',
      badge: 'Zero-Proxy Attendance',
      badgeBg: '#ecfdf5',
      badgeColor: '#059669',
      desc: 'Direct TCP/HTTP push listener connects with ZKTeco and standard biometric devices on local network for real-time punch capture.',
      features: [
        'Instant In & Out punch recording with second-precision timestamp',
        'Automated detection of continuous study vs unattended departures',
        'Custom grace period rules for late arrivals and missed check-outs',
        'Works with Fingerprint, Facial Recognition, and RFID cards',
        'Hardware health monitor with auto-reconnect heartbeat'
      ]
    },
    {
      id: 'whatsapp',
      category: 'communication',
      icon: MessageSquare,
      tag: 'Parent Engagement',
      title: 'Automated WhatsApp Messaging Engine',
      badge: '100% Delivery Rate',
      badgeBg: '#f0fdf4',
      badgeColor: '#16a34a',
      desc: 'Multi-threaded automated notification service that delivers transparent daily updates directly to parents on WhatsApp without per-SMS costs.',
      features: [
        'Instant entry and departure alert sent to parents in < 3 seconds',
        'Detailed OMR exam report cards with rank, total marks & percentage',
        'Automated absent alerts sent to parents after class start time',
        'Multi-batch announcement broadcasts for holidays and exam schedules',
        'Dedicated anti-ban rate limiting with smart queue protection'
      ]
    },
    {
      id: 'analytics',
      category: 'analytics',
      icon: BarChart3,
      tag: 'Student Intelligence',
      title: '360° Academic Dossier & Student Analytics',
      badge: 'Deep Progress Tracking',
      badgeBg: '#fef3c7',
      badgeColor: '#d97706',
      desc: 'Complete student academic intelligence dashboard giving faculty and administration instant visibility into performance trajectories.',
      features: [
        'Historical performance trajectory graph across all test series',
        'Subject-wise strength & weakness breakdown (JEE / NEET / Boards)',
        'Attendance percentage correlation with test score benchmarks',
        'Downloadable consolidated PDF report cards with institute watermark',
        'Searchable 5-digit roll number, batch & session archive'
      ]
    },
    {
      id: 'hybrid-sync',
      category: 'architecture',
      icon: RefreshCw,
      tag: 'Hybrid Architecture',
      title: 'Offline-First Desktop + Cloud Sync Engine',
      badge: '100% Operational Uptime',
      badgeBg: '#f5f3ff',
      badgeColor: '#7c3aed',
      desc: 'Mission-critical design ensures institute computers operate with 100% speed and reliability even during internet blackouts.',
      features: [
        'Embedded high-speed local database handles scanning and attendance offline',
        'Automatic two-way background cloud sync when internet is restored',
        'Conflict-free snapshot merging with automatic database backup',
        'Zero cloud downtime risk — daily operations never freeze',
        'Ultra-low bandwidth consumption with delta synchronization'
      ]
    },
    {
      id: 'portals',
      category: 'portals',
      icon: Smartphone,
      tag: 'Mobile Ecosystem',
      title: 'Specialized Multi-Stakeholder Web Portals',
      badge: 'Serverless PWA',
      badgeBg: '#eff6ff',
      badgeColor: '#2563eb',
      desc: 'Tailored, feather-light (~35 KB) mobile web applications giving parents, teachers, and staff instant role-specific access anywhere.',
      features: [
        'Parent Portal: Live attendance records, scorecards & teacher notices',
        'Teacher Portal: 360° student academic dossier & 1-tap parent contact',
        'Staff Attendance Web App: Rapid mobile manual punch & absent marking',
        'Front-Desk Inquiry Desk: Walk-in lead pipeline & follow-up tracker',
        'Installable Progressive Web App (PWA) with zero app store install needed'
      ]
    },
    {
      id: 'inquiries',
      category: 'crm',
      icon: Users,
      tag: 'Admissions CRM',
      title: 'Front-Desk Inquiry & Admission Pipeline',
      badge: 'Conversion Booster',
      badgeBg: '#fff1f2',
      badgeColor: '#e11d48',
      desc: 'Capture, organize, and follow up with prospective students and parents from first walk-in to confirmed admission.',
      features: [
        'Quick mobile entry for student details, target course & previous scores',
        'Lead status tracking: Pending, Follow-up, Admitted, or Archived',
        '1-Tap WhatsApp chat initiation and direct phone dialing',
        'Staff follow-up notes and callback scheduling reminders',
        'Real-time synchronization between front desk and admin office'
      ]
    },
    {
      id: 'questions',
      category: 'evaluation',
      icon: FileText,
      tag: 'Curriculum Tools',
      title: 'Integrated Test Series & Question Paper Builder',
      badge: 'Smart Exam Creator',
      badgeBg: '#e0e7ff',
      badgeColor: '#4338ca',
      desc: 'Build, schedule, and print competitive exam papers and customized OMR bubble answer sheets in just a few clicks.',
      features: [
        'Comprehensive question bank covering JEE Main, Advanced & NEET syllabus',
        'Chapter-wise and topic-wise difficulty filtering (Easy, Medium, Hard)',
        'Automatic answer key generation matching OMR scanner templates',
        'Export printable high-resolution PDF question booklets',
        'Multi-batch assignment with custom exam schedules and duration'
      ]
    }
  ];

  const workflowSteps = [
    {
      num: '01',
      title: 'Data Capture',
      desc: 'Students punch biometric device or fill physical OMR sheets during scheduled test exams.',
      icon: Clock,
      color: '#0284c7'
    },
    {
      num: '02',
      title: 'Instant Processing',
      desc: 'High-speed AI engine checks 100 sheets/min and biometrics record attendance in milliseconds.',
      icon: Zap,
      color: '#0ea5e9'
    },
    {
      num: '03',
      title: 'Parent Alerting',
      desc: 'Parents instantly receive punch arrival/departure alerts and test scorecards on WhatsApp.',
      icon: MessageSquare,
      color: '#10b981'
    },
    {
      num: '04',
      title: 'Academic Analytics',
      desc: 'Management and teachers track live batches, rank distributions, and progress trends 24/7.',
      icon: BarChart3,
      color: '#6366f1'
    }
  ];

  const filteredModules = activeTab === 'all' 
    ? coreModules 
    : coreModules.filter(m => m.category === activeTab);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 30%, #f8fafc 100%)',
      color: '#0f172a',
      fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif",
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* Decorative Sky Blue Ambient Glows */}
      <div style={{
        position: 'absolute', top: '-150px', left: '50%', transform: 'translateX(-50%)',
        width: '900px', height: '450px',
        background: 'radial-gradient(ellipse at top, rgba(56, 189, 248, 0.25) 0%, rgba(224, 242, 254, 0) 70%)',
        pointerEvents: 'none', zIndex: 0
      }} />

      {/* Top Navbar */}
      <header style={{
        padding: '14px 6%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(186, 230, 253, 0.7)',
        background: 'rgba(255, 255, 255, 0.82)',
        backdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 4px 20px -2px rgba(14, 165, 233, 0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img 
            src={logo} 
            alt="Logo" 
            style={{ 
              width: '42px', height: '42px', borderRadius: '10px', 
              objectFit: 'contain', background: '#ffffff', padding: '3px',
              border: '1px solid #bae6fd',
              boxShadow: '0 2px 8px rgba(14, 165, 233, 0.15)'
            }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0369a1', letterSpacing: '-0.4px' }}>
                {name}
              </h2>
              <span style={{ 
                background: 'linear-gradient(135deg, #0284c7, #0369a1)', 
                color: '#ffffff', 
                fontSize: '0.65rem', 
                fontWeight: 800, 
                padding: '2px 8px', 
                borderRadius: '6px',
                letterSpacing: '0.5px'
              }}>
                ERP SYSTEM
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
              Institute Automation & Student Analytics
            </span>
          </div>
        </div>

        {/* Quick Portal Direct Links (No credentials shown) */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <a href="#/parent" style={{
            background: '#ffffff',
            border: '1px solid #bae6fd',
            color: '#0284c7',
            padding: '7px 14px',
            borderRadius: '10px',
            textDecoration: 'none',
            fontSize: '0.8rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 6px rgba(14, 165, 233, 0.08)',
            transition: 'all 0.15s ease'
          }}>
            <Users size={15} /> Parent Portal
          </a>
          <a href="#/teacher" style={{
            background: '#ffffff',
            border: '1px solid #bae6fd',
            color: '#0369a1',
            padding: '7px 14px',
            borderRadius: '10px',
            textDecoration: 'none',
            fontSize: '0.8rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 6px rgba(14, 165, 233, 0.08)',
            transition: 'all 0.15s ease'
          }}>
            <Sparkles size={15} /> Faculty Portal
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{ 
        padding: '60px 6% 40px', 
        textAlign: 'center', 
        maxWidth: '1080px', 
        margin: '0 auto',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Highlight Pill */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: 'rgba(255, 255, 255, 0.9)', 
          border: '1px solid #7dd3fc',
          padding: '6px 18px', borderRadius: '50px', fontSize: '0.82rem', 
          color: '#0369a1', fontWeight: 700,
          boxShadow: '0 4px 14px rgba(14, 165, 233, 0.12)',
          marginBottom: '22px'
        }}>
          <Sparkles size={15} color="#0284c7" /> 
          Complete Institute Automation & Student Analytics Ecosystem
        </div>

        {/* Hero Title */}
        <h1 style={{
          fontSize: 'clamp(2.3rem, 5.2vw, 3.6rem)', 
          fontWeight: 900, 
          lineHeight: 1.15, 
          marginBottom: '20px',
          color: '#0f172a',
          letterSpacing: '-1.2px'
        }}>
          Powering Modern Coaching & Institutes with{' '}
          <span style={{
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Automated Intelligence
          </span>
        </h1>

        {/* Hero Subtitle */}
        <p style={{ 
          fontSize: '1.15rem', 
          color: '#475569', 
          lineHeight: 1.65, 
          marginBottom: '36px', 
          maxWidth: '820px', 
          margin: '0 auto 36px', 
          fontWeight: 450 
        }}>
          From optical OMR evaluation and real-time biometric tracking to instant WhatsApp scorecards and comprehensive student dossiers — an all-in-one software platform built for high reliability, zero proxy, and effortless academic administration.
        </p>

        {/* Key Pillars Highlights */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '12px',
          marginBottom: '30px'
        }}>
          {[
            { text: 'Sub-Second AI OMR Grading', icon: QrCode },
            { text: 'Real-time Biometric Push Sync', icon: Clock },
            { text: 'Automated WhatsApp Delivery', icon: MessageSquare },
            { text: 'Offline-First Hybrid Architecture', icon: WifiOff },
            { text: 'Multi-Stakeholder Web Portals', icon: Smartphone }
          ].map((pill, i) => {
            const Icon = pill.icon;
            return (
              <div key={i} style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                background: '#ffffff',
                border: '1px solid #bae6fd',
                padding: '7px 16px',
                borderRadius: '50px',
                fontSize: '0.82rem',
                color: '#0369a1',
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(14, 165, 233, 0.08)'
              }}>
                <Icon size={14} color="#0284c7" />
                <span>{pill.text}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Filter Tabs for System Modules */}
      <section style={{ maxWidth: '1240px', margin: '0 auto 30px', padding: '0 6%' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          flexWrap: 'wrap', 
          gap: '8px', 
          marginBottom: '32px' 
        }}>
          {[
            { id: 'all', label: 'All System Modules' },
            { id: 'evaluation', label: 'AI OMR & Exams' },
            { id: 'attendance', label: 'Biometrics & Attendance' },
            { id: 'communication', label: 'WhatsApp Alerts' },
            { id: 'analytics', label: 'Student Dossier & Analytics' },
            { id: 'portals', label: 'Mobile Portals' },
            { id: 'architecture', label: 'Offline Hybrid Sync' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: activeTab === tab.id ? '#0284c7' : '#ffffff',
                color: activeTab === tab.id ? '#ffffff' : '#0369a1',
                border: activeTab === tab.id ? '1px solid #0284c7' : '1px solid #bae6fd',
                padding: '8px 18px',
                borderRadius: '30px',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: activeTab === tab.id 
                  ? '0 4px 12px rgba(2, 132, 199, 0.3)' 
                  : '0 2px 6px rgba(14, 165, 233, 0.06)'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Feature Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '24px'
        }}>
          {filteredModules.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.88)',
                  border: '1px solid #bae6fd',
                  borderRadius: '22px',
                  padding: '28px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 10px 28px -6px rgba(14, 165, 233, 0.1), 0 4px 12px -2px rgba(14, 165, 233, 0.05)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  position: 'relative'
                }}
              >
                <div>
                  {/* Card Header: Tag & Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '14px',
                      background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)',
                      color: '#0284c7',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1px solid #7dd3fc',
                      boxShadow: '0 4px 12px rgba(14, 165, 233, 0.15)'
                    }}>
                      <Icon size={24} />
                    </div>
                    <span style={{
                      background: mod.badgeBg,
                      color: mod.badgeColor,
                      border: `1px solid ${mod.badgeColor}33`,
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      letterSpacing: '0.3px'
                    }}>
                      {mod.badge}
                    </span>
                  </div>

                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    {mod.tag}
                  </span>

                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '4px 0 10px', lineHeight: 1.3 }}>
                    {mod.title}
                  </h3>

                  <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: 1.55, margin: '0 0 20px' }}>
                    {mod.desc}
                  </p>

                  {/* Feature Checkpoints */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '10px' }}>
                    {mod.features.map((feat, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', fontSize: '0.82rem', color: '#334155' }}>
                        <CheckCircle2 size={15} color="#0284c7" style={{ marginTop: '2px', flexShrink: 0 }} />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Workflow Section (How It Works) */}
      <section style={{ maxWidth: '1240px', margin: '60px auto 80px', padding: '0 6%' }}>
        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Seamless Daily Workflow
          </span>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#0f172a', margin: '6px 0 10px', letterSpacing: '-0.5px' }}>
            How The Ecosystem Operates Every Day
          </h2>
          <p style={{ fontSize: '0.95rem', color: '#64748b', maxWidth: '650px', margin: '0 auto' }}>
            Completely automated pipeline from the moment students step inside the institute to the delivery of their academic scorecard.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '20px'
        }}>
          {workflowSteps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={idx}
                style={{
                  background: '#ffffff',
                  border: '1px solid #bae6fd',
                  borderRadius: '20px',
                  padding: '28px 24px',
                  boxShadow: '0 8px 24px -4px rgba(14, 165, 233, 0.08)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                    <span style={{ 
                      fontSize: '1.4rem', 
                      fontWeight: 900, 
                      color: '#bae6fd',
                      fontFamily: 'monospace'
                    }}>
                      {step.num}
                    </span>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '12px',
                      background: '#f0f9ff', color: step.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1px solid #e0f2fe'
                    }}>
                      <Icon size={20} />
                    </div>
                  </div>

                  <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
                    {step.title}
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5, margin: 0 }}>
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* System Security & Reliability Guarantee Banner */}
      <section style={{ maxWidth: '1120px', margin: '0 auto 80px', padding: '0 6%' }}>
        <div style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)',
          border: '1.5px solid #7dd3fc',
          borderRadius: '24px',
          padding: '36px 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '24px',
          boxShadow: '0 12px 36px -8px rgba(14, 165, 233, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '18px', maxWidth: '720px' }}>
            <div style={{
              width: '54px', height: '54px', borderRadius: '16px',
              background: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#ffffff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              boxShadow: '0 6px 16px rgba(2, 132, 199, 0.3)'
            }}>
              <Shield size={28} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 6px', fontSize: '1.25rem', fontWeight: 900, color: '#0f172a' }}>
                Bank-Grade Data Privacy & Local Control
              </h3>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', lineHeight: 1.55 }}>
                Your student records, contact numbers, and test scores remain strictly private. The software functions independently on your local machines with end-to-end encrypted backup to your private cloud cluster.
              </p>
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '0.82rem',
            color: '#0369a1',
            fontWeight: 700
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} color="#0284c7" /> Zero Third-Party Tracking
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} color="#0284c7" /> Auto Local Database Backup
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} color="#0284c7" /> 100% Offline Capable
            </span>
          </div>
        </div>
      </section>

      {/* Clean Light-Blue Footer */}
      <footer style={{
        textAlign: 'center',
        fontSize: '0.84rem',
        color: '#64748b',
        borderTop: '1px solid #bae6fd',
        background: '#ffffff',
        padding: '36px 6% 40px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <img 
            src={logo} 
            alt="Logo" 
            style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'contain' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>{name}</strong>
          <span style={{ color: '#cbd5e1' }}>•</span>
          <span style={{ color: '#0284c7', fontWeight: 600 }}>Institute Automation System</span>
        </div>
        <p style={{ margin: '0 0 6px' }}>
          &copy; {new Date().getFullYear()} <strong>{name}</strong>. All rights reserved.
        </p>
        <p style={{ margin: 0, fontSize: '0.76rem', color: '#94a3b8' }}>
          Equipped with Sub-Second AI OMR Evaluation • Real-Time Biometric Push Sync • Automated WhatsApp Engine • Multi-Portal Serverless Architecture
        </p>
      </footer>
    </div>
  );
}
