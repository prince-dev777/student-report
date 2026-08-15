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
  Smartphone,
  PanelLeftClose,
  PanelLeftOpen,
  Cloud,
  Archive
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { api, API_BASE } from '../utils/api';
import toast from 'react-hot-toast';

const mainMenuItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/students', icon: Users, label: 'Admission' },
  { to: '/attendance', icon: Fingerprint, label: 'Attendance' },
  { to: '/tests', icon: ClipboardList, label: 'Tests' },
];

const commMenuItems = [
  { to: '/sms', icon: MessageSquare, label: 'SMS Center', hasBadge: true },
  { to: '/share-app', icon: Smartphone, label: 'Share App', hasBadge: false },
];

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen, smsHistory, sidebarCollapsed, setSidebarCollapsed } = useApp();
  const { user } = useAuth();
  const location = useLocation();
  const [lastSeenSmsCount, setLastSeenSmsCount] = useState(smsHistory.length);
  const [appVersion, setAppVersion] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

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

  const handleSync = async () => {
    const confirmSync = window.confirm('Are you sure you want to push all local data to the Cloud? This will overwrite the Cloud database with your current data.');
    if (!confirmSync) return;
    
    setIsSyncing(true);
    const tid = toast.loading('Syncing data to Cloud...');
    try {
      const res = await api.syncDataToCloud();
      toast.success(res.message || 'Sync successful!', { id: tid });
    } catch (err) {
      toast.error(err.message || 'Sync failed. Check internet connection.', { id: tid });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLocalBackup = async () => {
    const tid = toast.loading('Generating local backup... Please wait.');
    try {
      const response = await fetch(`${API_BASE}/system/local-backup`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to generate backup');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `CareerXone_Backup_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Backup downloaded successfully!', { id: tid });
    } catch (err) {
      toast.error(err.message || 'Backup failed.', { id: tid });
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
        <div className="sidebar-brand" style={{ gap: '10px', position: 'relative' }}>
          <img 
            src={user?.logo || "./logo.jpg"} 
            alt="Logo" 
            onClick={() => sidebarCollapsed && setSidebarCollapsed(false)}
            style={{ 
              width: '36px', 
              height: '36px', 
              borderRadius: '8px', 
              objectFit: 'cover',
              cursor: sidebarCollapsed ? 'pointer' : 'default'
            }} 
            title={sidebarCollapsed ? "Expand Sidebar" : ""}
          />
          <div className="sidebar-brand-text">
            <h2>{user?.instituteName || 'CAREER XONE PRO'}</h2>
            <span>Student Management</span>
          </div>
          {!sidebarCollapsed && (
            <button 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              style={{ 
                position: 'absolute', 
                right: '10px', 
                top: '20px', 
                background: 'transparent', 
                border: 'none', 
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: window.innerWidth > 768 ? 'block' : 'none'
              }}
              title="Collapse Sidebar"
            >
              <PanelLeftClose size={20} />
            </button>
          )}
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

        {/* Sync Button */}
        <div style={{ padding: '0 20px', marginTop: 'auto', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button 
            className="btn btn-primary" 
            style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px', opacity: isSyncing ? 0.7 : 1 }}
            onClick={handleSync}
            disabled={isSyncing}
          >
            <Cloud size={18} />
            {isSyncing ? 'Syncing...' : 'Cloud Backup'}
          </button>
          
          <button 
            className="btn btn-outline" 
            style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '8px' }}
            onClick={handleLocalBackup}
          >
            <Archive size={18} />
            Local Backup
          </button>
        </div>

        {/* Version Info */}
        {appVersion && (
          <div style={{
            padding: '12px 20px',
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
