import React from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
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

const KEEP_ALIVE_ROUTES = [
  { path: '/', component: Dashboard, id: 'dashboard' },
  { path: '/students', component: Students, id: 'students' },
  { path: '/attendance', component: Attendance, id: 'attendance' },
  { path: '/sessions', component: Sessions, id: 'sessions' },
  { path: '/tests', component: Tests, id: 'tests' },
  { path: '/test-series', component: TestSeries, id: 'test-series' },
  { path: '/inquiries', component: Inquiries, id: 'inquiries' },
  { path: '/sms', component: SMSCenter, id: 'sms' },
  { path: '/share-app', component: ShareApp, id: 'share-app' },
  { path: '/settings', component: Settings, id: 'settings' },
  { path: '/teacher', component: TeacherPortalWeb, id: 'teacher' },
  { path: '/inquiry', component: StaffInquiryWeb, id: 'inquiry' },
];

function KeepAlivePageOutlet() {
  const location = useLocation();
  const currentPath = location.pathname || '/';
  
  // Track visited paths to lazily mount components on first visit
  const [visitedPaths, setVisitedPaths] = React.useState(() => new Set([currentPath]));

  React.useEffect(() => {
    setVisitedPaths(prev => {
      if (prev.has(currentPath)) return prev;
      const next = new Set(prev);
      next.add(currentPath);
      return next;
    });
  }, [currentPath]);

  const isKnownRoute = KEEP_ALIVE_ROUTES.some(r => r.path === currentPath);

  return (
    <div className="keep-alive-container" style={{ width: '100%', minHeight: '100%' }}>
      {KEEP_ALIVE_ROUTES.map(route => {
        if (!visitedPaths.has(route.path)) return null;

        const Component = route.component;
        const isActive = currentPath === route.path;

        return (
          <div
            key={route.path}
            id={`keep-alive-view-${route.id}`}
            style={{
              display: isActive ? 'block' : 'none',
              width: '100%',
              minHeight: '100%'
            }}
          >
            <Component />
          </div>
        );
      })}

      {!isKnownRoute && (
        <Routes>
          <Route path="*" element={<Dashboard />} />
        </Routes>
      )}
    </div>
  );
}

function AppLayout() {
  const { sidebarCollapsed, startupSyncing, startupSyncText } = useApp();
  
  if (startupSyncing) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'radial-gradient(ellipse at center, #0f172a 0%, #020617 100%)',
        color: '#f8fafc',
        fontFamily: "'Inter', sans-serif"
      }}>
        <div style={{
          padding: '36px 44px',
          borderRadius: '24px',
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(59, 130, 246, 0.15)',
          backdropFilter: 'blur(16px)',
          textAlign: 'center',
          maxWidth: '460px',
          width: '90%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '18px'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '18px',
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(59, 130, 246, 0.4)',
            marginBottom: '4px'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              border: '3.5px solid rgba(255, 255, 255, 0.3)',
              borderTopColor: '#ffffff',
              borderRadius: '50%',
              animation: 'cxSpin 0.9s linear infinite'
            }} />
          </div>

          <div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Career Xone Pro
            </h3>
            <p style={{ margin: 0, fontSize: '0.86rem', color: '#94a3b8' }}>
              Syncing offline database with Cloud Atlas...
            </p>
          </div>

          <div style={{
            width: '100%',
            height: '6px',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <div style={{
              height: '100%',
              background: 'linear-gradient(90deg, #3b82f6, #60a5fa, #6366f1)',
              borderRadius: '10px',
              animation: 'cxPulseBar 1.8s ease-in-out infinite'
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
        <KeepAlivePageOutlet />
      </div>
    </div>
  );
}

const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().indexOf(' electron/') > -1;

export default function App() {
  // 🔄 24/7 Keep-Alive: Ping Render Cloud every 10 minutes so it never goes to sleep
  React.useEffect(() => {
    const pingCloud = async () => {
      try {
        await fetch('https://student-report-ezgw.onrender.com/api/health', {
          headers: { 'User-Agent': 'CareerXone-WebPWA-KeepAlive/1.0' }
        });
      } catch (e) {}
    };
    pingCloud();
    const interval = setInterval(pingCloud, 10 * 60 * 1000); // 10 mins
    return () => clearInterval(interval);
  }, []);

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

