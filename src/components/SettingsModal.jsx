import React, { useState, useRef } from 'react';
import { X, Upload, Check, Lock, Image as ImageIcon, Sparkles, Sliders, ShieldCheck, RefreshCw, Smartphone, Key } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import '../index.css';

export default function SettingsModal({ onClose }) {
  const { user, updateUser } = useAuth();
  const { appCardTheme, toggleAppCardTheme } = useApp();
  
  const [activeTab, setActiveTab] = useState('general');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [logoPreview, setLogoPreview] = useState(user?.logo || '');
  const [staffPasscode, setStaffPasscode] = useState(() => localStorage.getItem('staff_passcode') || '1234');
  const [teacherPasscode, setTeacherPasscode] = useState(() => localStorage.getItem('teacher_passcode') || '5678');
  const [inquiryPasscode, setInquiryPasscode] = useState(() => localStorage.getItem('inquiry_passcode') || '9999');
  const [isLoading, setIsLoading] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);
  
  const fileInputRef = useRef(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleTriggerCloudSync = async () => {
    setSyncingCloud(true);
    const toastId = toast.loading('Running Bidirectional Cloud Database Sync...');
    try {
      await api.bidirectionalSync();
      toast.success('✅ Cloud & Local Database 100% Synchronized!', { id: toastId });
    } catch (err) {
      toast.error('Sync failed: ' + err.message, { id: toastId });
    } finally {
      setSyncingCloud(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    // Validation
    if (newPassword && !currentPassword) {
      toast.error('Please enter your current password to change it.');
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const payload = {
        staffPasscode,
        teacherPasscode,
        inquiryPasscode
      };
      localStorage.setItem('staff_passcode', staffPasscode);
      localStorage.setItem('teacher_passcode', teacherPasscode);
      localStorage.setItem('inquiry_passcode', inquiryPasscode);

      if (currentPassword && newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }
      if (logoPreview !== user?.logo) {
        payload.logoBase64 = logoPreview;
      }

      const response = await api.updateSettings(payload);
      
      if (response.logo !== undefined) {
        updateUser({ logo: response.logo });
      }

      toast.success(response.message || 'Settings updated successfully!');
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to update settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick} style={{ zIndex: 99999 }}>
      <div className="modal-content" style={{ maxWidth: '580px', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1.15rem' }}>
            <Sliders size={20} style={{ color: 'var(--accent-blue)' }} />
            Institute & Application Settings
          </h3>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '8px 16px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          overflowX: 'auto'
        }}>
          {[
            { id: 'general', label: '🎨 Appearance', icon: Sparkles },
            { id: 'profile', label: '🏢 Profile & Logo', icon: ImageIcon },
            { id: 'security', label: '🔐 Passcodes & Auth', icon: Key },
            { id: 'cloud', label: '☁️ Cloud & Sync', icon: RefreshCw }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.80rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: activeTab === tab.id ? 'var(--accent-blue)' : 'transparent',
                color: activeTab === tab.id ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all 0.15s ease'
              }}
            >
              <tab.icon size={13} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="modal-body" style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          <form id="settings-form" onSubmit={handleSave}>
            
            {/* TAB 1: GENERAL & THEME */}
            {activeTab === 'general' && (
              <div>
                <div style={{ marginBottom: '20px', padding: '14px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <label style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>
                    Card Background Theme
                  </label>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    Choose how data cards, dashboards, and tables appear across all pages of the application.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div
                      onClick={() => toggleAppCardTheme('white')}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        border: appCardTheme === 'white' ? '2px solid #2563eb' : '1px solid var(--border-color)',
                        background: '#ffffff',
                        cursor: 'pointer',
                        boxShadow: appCardTheme === 'white' ? '0 2px 10px rgba(37,99,235,0.2)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '0.85rem', color: '#0f172a' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                        ⚪ Solid White Cards
                      </div>
                      <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '6px 0 0' }}>
                        Clean, high-contrast, minimalist flat cards.
                      </p>
                    </div>

                    <div
                      onClick={() => toggleAppCardTheme('gradient')}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        border: appCardTheme === 'gradient' ? '2px solid #2563eb' : '1px solid var(--border-color)',
                        background: 'linear-gradient(135deg, rgba(238,242,255,0.9) 0%, rgba(240,246,255,0.7) 100%)',
                        cursor: 'pointer',
                        boxShadow: appCardTheme === 'gradient' ? '0 2px 10px rgba(37,99,235,0.2)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, fontSize: '0.85rem', color: '#1e3a8a' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
                        🎨 Gradient Theme
                      </div>
                      <p style={{ fontSize: '0.72rem', color: '#475569', margin: '6px 0 0' }}>
                        Modern glassmorphic cards with soft accent glows.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: PROFILE & LOGO */}
            {activeTab === 'profile' && (
              <div>
                {/* Profile Details Section */}
                <div style={{ marginBottom: '20px', padding: '14px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-primary)', fontSize: '0.92rem', fontWeight: 800 }}>
                    Institute Profile
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color-light)', paddingBottom: '6px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Institute Name</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{user?.instituteName || 'Career Xone'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Admin User ID</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{user?.username || 'Admin'}</span>
                    </div>
                  </div>
                </div>
                
                {/* Logo Upload Section */}
                <div style={{ marginBottom: '20px', padding: '14px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontWeight: 800, fontSize: '0.90rem', color: 'var(--text-primary)' }}>
                    <ImageIcon size={16} style={{ color: 'var(--accent-blue)' }} />
                    Institute Logo
                  </label>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ 
                      width: '72px', height: '72px', 
                      borderRadius: '12px', 
                      border: '2px dashed var(--border-color)', 
                      overflow: 'hidden', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: '#ffffff'
                    }}>
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      ) : (
                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-accent)' }}>
                          {user?.instituteName?.substring(0, 2).toUpperCase() || 'CX'}
                        </span>
                      )}
                    </div>
                    
                    <div>
                      <input 
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        ref={fileInputRef}
                        onChange={handleImageChange}
                      />
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => fileInputRef.current?.click()}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Upload size={14} />
                        Upload New Logo
                      </button>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                        Auto-uploaded to Cloudinary for report cards & mobile apps.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: PASSCODES & SECURITY */}
            {activeTab === 'security' && (
              <div>
                {/* Panel Passcodes */}
                <div style={{ marginBottom: '20px', padding: '14px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.90rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    🔑 Web Portal Access Passcodes
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Staff Attendance Passcode:
                      </label>
                      <input
                        type="text"
                        value={staffPasscode}
                        onChange={(e) => setStaffPasscode(e.target.value)}
                        className="form-input"
                        placeholder="Staff Passcode"
                        style={{ height: '36px', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '1px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Teacher & Faculty Portal Passcode:
                      </label>
                      <input
                        type="text"
                        value={teacherPasscode}
                        onChange={(e) => setTeacherPasscode(e.target.value)}
                        className="form-input"
                        placeholder="Teacher Passcode"
                        style={{ height: '36px', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '1px' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                        Front-Desk Inquiry Desk Passcode:
                      </label>
                      <input
                        type="text"
                        value={inquiryPasscode}
                        onChange={(e) => setInquiryPasscode(e.target.value)}
                        className="form-input"
                        placeholder="Inquiry Passcode"
                        style={{ height: '36px', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '1px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Change Admin Password */}
                <div style={{ padding: '14px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontWeight: 800, fontSize: '0.90rem', color: 'var(--text-primary)' }}>
                    <Lock size={15} style={{ color: 'var(--accent-blue)' }} />
                    Change Admin Password
                  </label>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input 
                      type="password"
                      className="form-input"
                      placeholder="Current Password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      style={{ height: '36px', fontSize: '0.85rem' }}
                    />
                    <input 
                      type="password"
                      className="form-input"
                      placeholder="New Password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      style={{ height: '36px', fontSize: '0.85rem' }}
                    />
                    <input 
                      type="password"
                      className="form-input"
                      placeholder="Confirm New Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      style={{ height: '36px', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: CLOUD & BACKUP */}
            {activeTab === 'cloud' && (
              <div>
                <div style={{ padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    ☁️ Cloud Atlas Database Status
                  </h4>
                  <p style={{ fontSize: '0.80rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                    Your local MongoDB automatically mirrors to Cloud MongoDB Atlas with encrypted sync.
                  </p>

                  <button
                    type="button"
                    onClick={handleTriggerCloudSync}
                    disabled={syncingCloud}
                    className="btn btn-primary"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <RefreshCw size={15} className={syncingCloud ? 'spin' : ''} />
                    <span>{syncingCloud ? 'Synchronizing with Cloud...' : 'Trigger Full Two-Way Sync Now'}</span>
                  </button>
                </div>
              </div>
            )}

          </form>
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            form="settings-form"
            type="submit"
            className="btn btn-primary"
            disabled={isLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {isLoading ? (
              <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            ) : (
              <Check size={16} />
            )}
            Save Changes
          </button>
        </div>

      </div>
    </div>
  );
}
