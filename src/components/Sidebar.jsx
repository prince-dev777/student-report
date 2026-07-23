import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  Fingerprint,
  ClipboardList,
  MessageSquare,
  Brain,
  FileJson,
  Smartphone
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

const mainMenuItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/students', icon: Users, label: 'Students' },
  { to: '/attendance', icon: Fingerprint, label: 'Attendance' },
  { to: '/tests', icon: ClipboardList, label: 'Tests' },
];

const commMenuItems = [
  { to: '/sms', icon: MessageSquare, label: 'SMS Center', hasBadge: true },
  { to: '/share-app', icon: Smartphone, label: 'Share App', hasBadge: false },
];

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen, smsHistory } = useApp();
  const { user } = useAuth();
  const location = useLocation();
  const [lastSeenSmsCount, setLastSeenSmsCount] = useState(smsHistory.length);
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    // Check for version from Electron main process
    const checkVersion = () => {
      if (window.__APP_VERSION__) {
        setAppVersion(window.__APP_VERSION__);
      }
    };
    checkVersion();
    // Re-check after a short delay in case Electron sets it after load
    const timer = setTimeout(checkVersion, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (location.pathname === '/sms') {
      setLastSeenSmsCount(smsHistory.length);
    }
  }, [location.pathname, smsHistory.length]);

  const unreadCount = smsHistory.length - lastSeenSmsCount;

  const linkClass = ({ isActive }) =>
    `sidebar-link${isActive ? ' active' : ''}`;

  const handleNavClick = () => {
    // Close sidebar on mobile after navigating
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="sidebar-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setSidebarOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(4px)',
              zIndex: 99,
              display: window.innerWidth <= 768 ? 'block' : 'none',
            }}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        className={`sidebar${sidebarOpen ? ' open' : ''}`}
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Brand */}
        <div className="sidebar-brand" style={{ gap: '10px' }}>
          <img 
            src={user?.logo || "./logo.jpg"} 
            alt="Logo" 
            style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'cover' }} 
          />
          <div className="sidebar-brand-text">
            <h2>{user?.instituteName || 'CAREER XONE PRO'}</h2>
            <span>Student Management</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {/* Main Menu Section */}
          <div className="sidebar-section-title">Main Menu</div>
          {mainMenuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={linkClass}
              onClick={handleNavClick}
            >
              <item.icon className="sidebar-link-icon" size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}

          {/* Communication Section */}
          <div className="sidebar-section-title">Communication</div>
          {commMenuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={linkClass}
              onClick={handleNavClick}
            >
              <item.icon className="sidebar-link-icon" size={20} />
              <span>{item.label}</span>
              {item.hasBadge && unreadCount > 0 && (
                <span className="sidebar-link-badge">{unreadCount}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Version Info */}
        {appVersion && (
          <div style={{
            padding: '12px 20px',
            marginTop: 'auto',
            borderTop: '1px solid var(--border-color)',
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            opacity: 0.6,
            letterSpacing: '0.5px'
          }}>
            Version: {appVersion}
          </div>
        )}
      </motion.aside>
    </>
  );
}
