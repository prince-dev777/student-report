import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Search, Bell, LogOut, MessageSquare, UserPlus, ClipboardCheck, X, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import SettingsModal from './SettingsModal';

export default function Topbar() {
  const { setSidebarOpen, smsHistory, students } = useApp();
  const { logout, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [updateState, setUpdateState] = useState({ status: 'idle', version: '', releaseDate: '', currentVersion: '', progress: 0 });
  const notifRef = useRef(null);

  // Check for app updates
  useEffect(() => {
    async function checkUpdate() {
      const res = await api.getUpdateStatus();
      if (res) {
        setUpdateState(res);
      }
    }
    checkUpdate();
    const interval = setInterval(checkUpdate, 1000); // Check every 1 second as requested
    return () => clearInterval(interval);
  }, []);

  const handleUpdateAction = async () => {
    if (updateState.status === 'available') {
      toast.success('Downloading update in background...');
      await api.startUpdateDownload();
    } else if (updateState.status === 'downloaded') {
      toast.loading('Restarting application to apply update...', { duration: 4000 });
      await api.restartAndUpdate();
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get recent notifications (last 10 SMS logs)
  const recentNotifs = (smsHistory || []).slice(0, 10);
  const unreadCount = recentNotifs.filter(n => n.status === 'pending').length;

  const getNotifIcon = (type) => {
    if (type === 'attendance-entry' || type === 'attendance-exit') return <ClipboardCheck size={14} />;
    if (type === 'welcome') return <UserPlus size={14} />;
    return <MessageSquare size={14} />;
  };

  const getNotifColor = (status) => {
    if (status === 'delivered') return '#22c55e';
    if (status === 'pending') return '#f59e0b';
    if (status === 'failed') return '#ef4444';
    return '#6b7280';
  };

  const getStudentName = (studentId) => {
    const s = (students || []).find(st => st.id === studentId);
    return s ? s.name : 'Unknown';
  };

  const timeAgo = (timestamp) => {
    if (!timestamp) return '';
    const now = new Date();
    const t = new Date(timestamp);
    const diff = Math.floor((now - t) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <>
      <motion.header
        className="topbar"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        {/* Left side */}
        <div className="topbar-left">
          <button
            className="topbar-hamburger"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label="Toggle sidebar"
          >
            <Menu size={22} />
          </button>

          <div className="topbar-search">
            <Search className="topbar-search-icon" size={16} />
            <input
              type="text"
              placeholder="Search students, IDs, tests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Right side */}
        <div className="topbar-right">
          {(updateState.status === 'available' || updateState.status === 'downloading' || updateState.status === 'downloaded') && (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <motion.button
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={updateState.status !== 'downloading' ? { scale: 1.02 } : {}}
                whileTap={updateState.status !== 'downloading' ? { scale: 0.98 } : {}}
                onClick={handleUpdateAction}
                disabled={updateState.status === 'downloading'}
                style={{
                  background: '#007acc', // VS Code Blue
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px', // Slight rounding like VS Code
                  padding: '4px 14px',
                  fontSize: '13px',
                  fontWeight: '400',
                  cursor: updateState.status === 'downloading' ? 'default' : 'pointer',
                  marginRight: '8px',
                  opacity: updateState.status === 'downloading' ? 0.8 : 1,
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}
                title={`Current Version: ${updateState.currentVersion || 'v1.0.10'}\nLatest Version: ${updateState.version}\nRelease Date: ${updateState.releaseDate ? new Date(updateState.releaseDate).toLocaleDateString() : 'Just now'}`}
              >
                {updateState.status === 'available' && 'Update'}
                {updateState.status === 'downloading' && `Downloading ${Math.round(updateState.progress)}%`}
                {updateState.status === 'downloaded' && 'Restart'}
              </motion.button>
            </div>
          )}

          <div ref={notifRef} style={{ position: 'relative' }}>
            <button 
              className="topbar-btn" 
              aria-label="Notifications"
              onClick={() => setShowNotifications(prev => !prev)}
              style={{ cursor: 'pointer' }}
            >
              <Bell size={19} />
              {unreadCount > 0 && (
                <span className="notification-dot" style={{
                  position: 'absolute', top: 4, right: 4,
                  background: '#ef4444', borderRadius: '50%',
                  width: 8, height: 8, border: '2px solid var(--bg-primary)'
                }} />
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    position: 'fixed', top: 60, right: 20,
                    width: 340, maxHeight: 420, overflowY: 'auto',
                    background: '#ffffff',
                    borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
                    border: '1px solid #e5e7eb',
                    zIndex: 99999
                  }}
                >
                  <div style={{
                    padding: '14px 16px', borderBottom: '1px solid var(--border-color, #e5e7eb)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                      🔔 Notifications {unreadCount > 0 && <span style={{
                        background: '#ef4444', color: '#fff', borderRadius: 10,
                        padding: '1px 8px', fontSize: 11, marginLeft: 6
                      }}>{unreadCount}</span>}
                    </h4>
                    <button onClick={() => setShowNotifications(false)} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-secondary)', padding: 2
                    }}>
                      <X size={16} />
                    </button>
                  </div>

                  {recentNotifs.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                      No notifications yet
                    </div>
                  ) : (
                    recentNotifs.map((notif, i) => (
                      <div key={notif.id || i} style={{
                        padding: '10px 16px', borderBottom: '1px solid var(--border-color, #f3f4f6)',
                        display: 'flex', gap: 10, alignItems: 'flex-start',
                        background: notif.status === 'pending' ? 'rgba(245,158,11,0.05)' : 'transparent'
                      }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: 8,
                          background: `${getNotifColor(notif.status)}15`,
                          color: getNotifColor(notif.status),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, marginTop: 2
                        }}>
                          {getNotifIcon(notif.type)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            margin: 0, fontSize: 12.5, fontWeight: 500,
                            color: 'var(--text-primary)', lineHeight: 1.4
                          }}>
                            <strong>{getStudentName(notif.studentId)}</strong>
                            {' — '}
                            <span style={{ textTransform: 'capitalize', color: getNotifColor(notif.status) }}>
                              {notif.status}
                            </span>
                          </p>
                          <p style={{
                            margin: '2px 0 0', fontSize: 11.5, color: '#9ca3af',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                          }}>
                            {notif.message?.substring(0, 50)}...
                          </p>
                          <span style={{ fontSize: 10.5, color: '#c4c4c4' }}>
                            {timeAgo(notif.timestamp || notif.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button 
            className="topbar-btn logout-btn" 
            onClick={logout} 
            aria-label="Logout"
            title="Logout"
            style={{ color: '#ef4444' }}
          >
            <LogOut size={18} />
          </button>

          <div 
            className="topbar-avatar" 
            title={user?.instituteName || 'Settings'}
            onClick={() => setShowSettings(true)}
            style={{ cursor: 'pointer', overflow: 'hidden' }}
          >
            {user?.logo ? (
              <img src={user.logo} alt="Institute Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              user?.username?.substring(0, 2).toUpperCase() || 'AD'
            )}
          </div>
        </div>
      </motion.header>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      </AnimatePresence>
    </>
  );
}
