import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Menu, Search, Bell, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Topbar() {
  const { setSidebarOpen, resetData } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = () => {
    setIsResetting(true);
    resetData();
    setTimeout(() => setIsResetting(false), 600);
  };

  return (
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

        <motion.button
          className="topbar-btn"
          onClick={handleReset}
          aria-label="Reset data"
          animate={{ rotate: isResetting ? 360 : 0 }}
          transition={{ duration: 0.6 }}
        >
          <RefreshCw size={18} />
        </motion.button>

        <div className="topbar-avatar">AD</div>
      </div>
    </motion.header>
  );
}
