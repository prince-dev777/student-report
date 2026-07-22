import React from 'react';
import { Shield, Sparkles, Smartphone, QrCode, MessageSquare, CheckCircle, ArrowRight, UserCheck, Users, Download, Lock } from 'lucide-react';

export default function SaaSShowcaseLandingPage() {
  const logo = localStorage.getItem('institute_logo') || localStorage.getItem('logo') || '/logo.png';
  const name = localStorage.getItem('institute_name') || 'Career Xone';

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      color: '#f8fafc',
      fontFamily: "'Outfit', 'Inter', sans-serif",
      position: 'relative',
      overflowX: 'hidden',
      paddingBottom: '60px'
    }}>
      {/* Background Ambient Glow Effects */}
      <div style={{
        position: 'absolute', top: '-150px', right: '-150px', width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(37, 99, 235, 0.25) 0%, rgba(15, 23, 42, 0) 70%)',
        borderRadius: '50%', pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', top: '30%', left: '-150px', width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.18) 0%, rgba(15, 23, 42, 0) 70%)',
        borderRadius: '50%', pointerEvents: 'none'
      }} />

      {/* Navigation Header */}
      <header style={{
        maxHeight: '80px',
        padding: '20px 5%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(12px)',
        sticky: 'top',
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src={logo} alt="Logo" style={{ width: '38px', height: '38px', borderRadius: '10px', objectFit: 'contain' }} />
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.5px' }}>
              {name} <span style={{ color: '#38bdf8', fontSize: '0.85rem', fontWeight: 600 }}>PRO</span>
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Smart Student Management System</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <a href="#/staff" style={{
            background: 'rgba(37, 99, 235, 0.15)',
            border: '1px solid rgba(37, 99, 235, 0.4)',
            color: '#60a5fa',
            padding: '8px 16px',
            borderRadius: '10px',
            textDecoration: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <UserCheck size={16} /> Staff Portal
          </a>
          <a href="#/parent" style={{
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: '#ffffff',
            padding: '8px 18px',
            borderRadius: '10px',
            textDecoration: 'none',
            fontSize: '0.85rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
          }}>
            <Users size={16} /> Parent Portal
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{ padding: '60px 5% 40px', textAlign: 'center', maxWidth: '900px', margin: '0 auto' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)',
          padding: '6px 16px', borderRadius: '50px', fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600,
          marginBottom: '24px'
        }}>
          <Sparkles size={14} /> AI-Powered OMR • Biometric Sync • WhatsApp Alerts
        </div>

        <h1 style={{
          fontSize: '2.8rem', fontWeight: 900, lineHeight: 1.15, marginBottom: '18px',
          background: 'linear-gradient(135deg, #ffffff 30%, #94a3b8 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
        }}>
          All-in-One Coaching & School Automation Platform
        </h1>

        <p style={{ fontSize: '1.1rem', color: '#94a3b8', lineHeight: 1.6, marginBottom: '36px', fontWeight: 400 }}>
          Manage biometric attendance, automated WhatsApp report cards, staff manual marking, and parent tracking seamlessly across desktop and mobile.
        </p>

        {/* Quick Portal Access Cards */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', textAlign: 'left',
          marginBottom: '50px'
        }}>
          {/* Staff Card */}
          <div style={{
            background: 'linear-gradient(145deg, rgba(30,41,59,0.8), rgba(15,23,42,0.9))',
            border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '18px', padding: '24px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
          }}>
            <div>
              <div style={{
                width: '46px', height: '46px', borderRadius: '12px', background: 'rgba(37,99,235,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px'
              }}>
                <UserCheck size={24} color="#3b82f6" />
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
                Staff Attendance Web
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5 }}>
                For institute staff to mark manual attendance on phones or laptops with passcode protection.
              </p>
            </div>
            <a href="#/staff" style={{
              marginTop: '20px', background: '#2563eb', color: '#fff', textDecoration: 'none',
              padding: '12px', borderRadius: '10px', textAlign: 'center', fontWeight: 700,
              fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}>
              Open Staff Portal <ArrowRight size={16} />
            </a>
          </div>

          {/* Parent Card */}
          <div style={{
            background: 'linear-gradient(145deg, rgba(30,41,59,0.8), rgba(15,23,42,0.9))',
            border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '18px', padding: '24px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
          }}>
            <div>
              <div style={{
                width: '46px', height: '46px', borderRadius: '12px', background: 'rgba(16,185,129,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px'
              }}>
                <Users size={24} color="#10b981" />
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
                Parent Web App Portal
              </h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5 }}>
                For parents to track daily attendance, OMR exam scores, performance charts & report cards.
              </p>
            </div>
            <a href="#/parent" style={{
              marginTop: '20px', background: '#059669', color: '#fff', textDecoration: 'none',
              padding: '12px', borderRadius: '10px', textAlign: 'center', fontWeight: 700,
              fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}>
              Open Parent Portal <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section style={{ maxWidth: '1100px', margin: '0 auto 60px', padding: '0 5%' }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.8rem', fontWeight: 800, marginBottom: '32px', color: '#f8fafc' }}>
          Core System Capabilities
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          
          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <QrCode size={24} color="#38bdf8" style={{ marginBottom: '12px' }} />
            <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 700 }}>Lightning OMR Scanning</h4>
            <p style={{ margin: 0, fontSize: '0.83rem', color: '#94a3b8', lineHeight: 1.5 }}>
              Scan 100+ answer sheets in minutes with sub-second optical detection and automatic score calculation.
            </p>
          </div>

          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Smartphone size={24} color="#10b981" style={{ marginBottom: '12px' }} />
            <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 700 }}>Biometric ADMS Sync</h4>
            <p style={{ margin: 0, fontSize: '0.83rem', color: '#94a3b8', lineHeight: 1.5 }}>
              Automatic real-time fingerprint/face machine synchronization for instant student punch records.
            </p>
          </div>

          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <MessageSquare size={24} color="#a855f7" style={{ marginBottom: '12px' }} />
            <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 700 }}>Automated WhatsApp Alerts</h4>
            <p style={{ margin: 0, fontSize: '0.83rem', color: '#94a3b8', lineHeight: 1.5 }}>
              Instant absent SMS/WhatsApp messages & detailed OMR test PDF reports delivered directly to parents.
            </p>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer style={{ textAlign: 'center', fontSize: '0.8rem', color: '#64748b', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '30px' }}>
        &copy; {new Date().getFullYear()} {name}. All rights reserved. • Powered by Career Xone Automation Engine
      </footer>
    </div>
  );
}
