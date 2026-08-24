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
  DownloadCloud,
  Archive,
  PhoneCall,
  Clock,
  Library,
  Sparkles,
  Settings as SettingsIcon,
  ChevronDown
} from 'lucide-react';
import UpdateNotesModal from './UpdateNotesModal';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { api, API_BASE } from '../utils/api';
import toast from 'react-hot-toast';

const mainMenuItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/students', icon: Users, label: 'Admission' },
  { to: '/inquiries', icon: PhoneCall, label: 'Inquiries' },
  { to: '/attendance', icon: Fingerprint, label: 'Attendance' },
  { to: '/sessions', icon: Clock, label: 'Sessions' },
  { to: '/tests', icon: ClipboardList, label: 'Tests' },
  { to: '/test-series', icon: Library, label: 'Test Series' },
];

const commMenuItems = [
  { to: '/sms', icon: MessageSquare, label: 'SMS Center', hasBadge: true },
  { to: '/share-app', icon: Smartphone, label: 'Share App', hasBadge: false },
];

const systemMenuItems = [
  { to: '/settings', icon: SettingsIcon, label: 'Settings', hasBadge: false },
];

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen, smsHistory, sidebarCollapsed, setSidebarCollapsed, loading, refreshAllData } = useApp();
  const { user } = useAuth();
  const location = useLocation();
  const [lastSeenSmsCount, setLastSeenSmsCount] = useState(0);
  const [appVersion, setAppVersion] = useState('');
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupMenuOpen, setBackupMenuOpen] = useState(false);
  const [backupInfo, setBackupInfo] = useState(null);

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
    
    // Fetch backup info
    const fetchBackup = async () => {
      try {
        const info = await api.getBackupInfo();
        setBackupInfo(info);
      } catch(e) {}
    };
    fetchBackup();
    const backupTimer = setInterval(fetchBackup, 30000); // refresh every 30s

    return () => {
      clearTimeout(timer);
      clearInterval(backupTimer);
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      setLastSeenSmsCount(smsHistory.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    if (location.pathname === '/sms') {
      setLastSeenSmsCount(smsHistory.length);
    }
  }, [location.pathname, smsHistory.length]);

  const unreadCount = Math.max(0, smsHistory.length - lastSeenSmsCount);

  const linkClass = ({ isActive }) =>
    `sidebar-link${isActive ? ' active' : ''}`;

  const handleNavClick = () => {
    // Close sidebar on mobile after navigating
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  };

  const handleRestoreCloud = async () => {
    const confirmRestore = window.confirm('Are you sure you want to restore data from the Cloud? This will download all missing data from Cloud to your Local PC.');
    if (!confirmRestore) return;
    
    setIsRestoring(true);
    const tid = toast.loading('Restoring data from Cloud... Please wait.');
    try {
      const response = await fetch(`${API_BASE}/system/restore-cloud`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to restore');
      
      if (typeof refreshAllData === 'function') {
        await refreshAllData();
      }
      
      toast.success(data.message || 'Restore successful!', { id: tid });
    } catch (err) {
      toast.error(err.message || 'Restore failed. Check internet connection.', { id: tid });
    } finally {
      setIsRestoring(false);
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

          {/* System & Database Section */}
          <div className="sidebar-section-title">System</div>
          {systemMenuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={linkClass}
              onClick={handleNavClick}
            >
              <item.icon className="sidebar-link-icon" size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}

          {/* Collapsible Cloud & Backup Button */}
          <div style={{ position: 'relative', marginTop: '2px' }}>
            <button
              type="button"
              className="sidebar-link"
              onClick={() => setBackupMenuOpen(!backupMenuOpen)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: sidebarCollapsed ? 'center' : 'space-between',
                border: 'none',
                background: backupMenuOpen ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                color: backupMenuOpen ? '#3b82f6' : 'var(--text-secondary)',
                cursor: 'pointer',
                textAlign: 'left',
                padding: sidebarCollapsed ? '10px 0' : '10px 14px',
                borderRadius: '10px',
                transition: 'all 0.2s ease'
              }}
              title="Cloud & Backup Manager"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Cloud className="sidebar-link-icon" size={20} color={backupMenuOpen ? '#3b82f6' : 'currentColor'} />
                {!sidebarCollapsed && <span style={{ fontWeight: 600 }}>Cloud & Backup</span>}
              </div>
              {!sidebarCollapsed && (
                <ChevronDown
                  size={16}
                  style={{
                    transform: backupMenuOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s ease',
                    color: 'var(--text-muted)'
                  }}
                />
              )}
            </button>

            {/* Submenu Options */}
            <AnimatePresence>
              {backupMenuOpen && !sidebarCollapsed && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    overflow: 'hidden',
                    padding: '8px 10px 12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    background: 'var(--surface-color, rgba(0, 0, 0, 0.03))',
                    borderRadius: '10px',
                    margin: '4px 6px 8px'
                  }}
                >
                  <button
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      opacity: isSyncing ? 0.7 : 1
                    }}
                    onClick={handleSync}
                    disabled={isSyncing}
                  >
                    <Cloud size={16} />
                    <span>{isSyncing ? 'Syncing...' : 'Cloud Backup'}</span>
                  </button>

                  <button
                    className="btn btn-outline"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '7px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      opacity: isRestoring ? 0.7 : 1
                    }}
                    onClick={handleRestoreCloud}
                    disabled={isRestoring}
                  >
                    <DownloadCloud size={15} />
                    <span>{isRestoring ? 'Restoring...' : 'Restore from Cloud'}</span>
                  </button>

                  <button
                    className="btn btn-outline"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '7px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 600
                    }}
                    onClick={handleLocalBackup}
                  >
                    <Archive size={15} />
                    <span>Local Backup (ZIP)</span>
                  </button>

                  {backupInfo && (
                    <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '2px', lineHeight: 1.3 }}>
                      Auto-Sync: {backupInfo.autoBackupTime}
                      <br />
                      Last: {backupInfo.lastSync ? new Date(backupInfo.lastSync).toLocaleDateString() + ' ' + new Date(backupInfo.lastSync).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Pending'}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>

        {/* Version Info & What's New */}
        {!sidebarCollapsed && (
          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            letterSpacing: '0.5px'
          }}>
            <span>Version: {appVersion || '1.0.41'}</span>
            <button
              type="button"
              onClick={() => setShowNotesModal(true)}
              style={{
                background: 'rgba(59, 130, 246, 0.12)',
                color: '#3b82f6',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '0.68rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="View Release & Update Notes"
            >
              <Sparkles size={11} /> What&apos;s New
            </button>
          </div>
        )}
      </motion.aside>

      <UpdateNotesModal
        isOpen={showNotesModal}
        onClose={() => setShowNotesModal(false)}
        currentVersion={appVersion || '1.0.41'}
      />
    </>
  );
}
