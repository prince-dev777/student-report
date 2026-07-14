import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Search, Bell, LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import SettingsModal from './SettingsModal';

export default function Topbar() {
  const { setSidebarOpen } = useApp();
  const { logout, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);

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
              placeholder="Search students, tests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Right side */}
        <div className="topbar-right">
          <button className="topbar-btn" aria-label="Notifications">
            <Bell size={19} />
            <span className="notification-dot" />
          </button>

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
