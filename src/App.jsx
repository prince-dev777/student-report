import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import MouseTrail from './components/MouseTrail';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Attendance from './pages/Attendance';
import SMSCenter from './pages/SMSCenter';
import ShareApp from './pages/ShareApp';
import Sessions from './pages/Sessions';
import Inquiries from './pages/Inquiries';
import SuperAdminLogin from './pages/SuperAdminLogin';
import SuperAdminDashboard from './pages/SuperAdminDashboard';

import Login from './pages/Login';
import Register from './pages/Register';
import Tests from './pages/Tests';
import TestSeries from './pages/TestSeries';
import Settings from './pages/Settings';

import StaffAttendanceWeb from './pages/StaffAttendanceWeb';
import SaaSShowcaseLandingPage from './pages/SaaSShowcaseLandingPage';
import ParentPortalWeb from './pages/ParentPortalWeb';
import TeacherPortalWeb from './pages/TeacherPortalWeb';
import StaffInquiryWeb from './pages/StaffInquiryWeb';
import GlobalScannerDeskListener from './components/GlobalScannerDeskListener';

import { useApp } from './context/AppContext';

function AppLayout() {
  const { sidebarCollapsed, startupSyncing, startupSyncText } = useApp();
  
  if (startupSyncing) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'linear-gradient(135deg, #0b0f19 0%, #111827 50%, #0f172a 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        color: '#f8fafc',
        fontFamily: "'Inter', sans-serif"
      }}>
        <div style={{
          background: 'rgba(30, 41, 59, 0.7)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: '24px',
          padding: '40px 48px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: '460px',
          width: '90%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(59, 130, 246, 0.15)',
          backdropFilter: 'blur(16px)',
          textAlign: 'center'
        }}>
          {/* Animated Cloud / Sync Icon */}
          <div style={{
            position: 'relative',
            width: '76px',
            height: '76px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(37, 99, 235, 0.4)',
            marginBottom: '20px'
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'cxSpin 3s linear infinite' }}>
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
          </div>

          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: '-0.02em', margin: '0 0 6px 0', color: '#ffffff' }}>
            CAREER XONE <span style={{ color: '#60a5fa' }}>PRO</span>
          </h2>
          <p style={{ fontSize: '0.80rem', color: '#94a3b8', margin: '0 0 24px 0', fontWeight: 600 }}>
            Cloud Database Sync & Realtime Link Active
          </p>

          {/* Progress loader */}
          <div style={{ width: '100%', height: '6px', background: 'rgba(51, 65, 85, 0.5)', borderRadius: '3px', overflow: 'hidden', marginBottom: '16px' }}>
            <div style={{
              width: '65%',
              height: '100%',
              background: 'linear-gradient(90deg, #3b82f6, #60a5fa, #93c5fd)',
              borderRadius: '3px',
              animation: 'cxPulseBar 1.5s ease-in-out infinite'
            }} />
          </div>

          <span style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            🔄 {startupSyncText}
          </span>
        </div>

        <style>{`
          @keyframes cxSpin { 100% { transform: rotate(360deg); } }
          @keyframes cxPulseBar {
            0% { transform: translateX(-100%); width: 40%; }
            50% { width: 80%; }
            100% { transform: translateX(200%); width: 40%; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <GlobalScannerDeskListener />
      <MouseTrail />
      <Sidebar />
      <div className="main-content">
        <Topbar />
        <div className="page-container">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/students" element={<Students />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/tests" element={<Tests />} />
            <Route path="/test-series" element={<TestSeries />} />
            <Route path="/inquiries" element={<Inquiries />} />
            <Route path="/sms" element={<SMSCenter />} />
            <Route path="/share-app" element={<ShareApp />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/teacher" element={<TeacherPortalWeb />} />
            <Route path="/inquiry" element={<StaffInquiryWeb />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

const isElectron = navigator.userAgent.toLowerCase().indexOf(' electron/') > -1;

export default function App() {
  if (!isElectron) {
    if (typeof window !== 'undefined') {
      const path = (window.location.pathname || '').toLowerCase();
      const search = (window.location.search || '').toLowerCase();
      const hash = (window.location.hash || '').toLowerCase();

      if (!hash || hash === '#/' || hash === '#') {
        if (path.includes('/teacher') || search.includes('app=teacher')) {
          window.location.hash = '/teacher';
        } else if (path.includes('/staff') || search.includes('app=staff')) {
          window.location.hash = '/staff';
        } else if (path.includes('/inquiry') || search.includes('app=inquiry')) {
          window.location.hash = '/inquiry';
        } else if (path.includes('/parent') || search.includes('app=parent') || search.includes('source=pwa')) {
          window.location.hash = '/parent';
        } else if (path.includes('/superadmin') || search.includes('app=superadmin')) {
          window.location.hash = '/superadmin';
        }
      }
    }

    return (
      <HashRouter>
        <Routes>
          <Route path="/staff" element={<StaffAttendanceWeb />} />
          <Route path="/parent" element={<ParentPortalWeb />} />
          <Route path="/teacher" element={<TeacherPortalWeb />} />
          <Route path="/inquiry" element={<StaffInquiryWeb />} />
          <Route path="/superadmin" element={<SuperAdminLogin />} />
          <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
          <Route path="/*" element={<SaaSShowcaseLandingPage />} />
        </Routes>
        <Toaster position="top-right" />
      </HashRouter>
    );
  }

  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/superadmin" element={<SuperAdminLogin />} />
          <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
          <Route path="/teacher" element={<TeacherPortalWeb />} />
          <Route path="/inquiry" element={<StaffInquiryWeb />} />
          <Route path="/parent" element={<ParentPortalWeb />} />
          <Route path="/staff" element={<StaffAttendanceWeb />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <AppProvider>
                <AppLayout />
              </AppProvider>
            </ProtectedRoute>
          } />
        </Routes>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#0c1029',
              color: '#f1f5f9',
              border: '1px solid rgba(59, 130, 246, 0.15)',
              borderRadius: '12px',
              fontSize: '0.85rem',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#0c1029',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#0c1029',
              },
            },
          }}
        />
      </AuthProvider>
    </HashRouter>
  );
}

