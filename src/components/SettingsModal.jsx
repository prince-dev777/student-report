import React, { useState, useRef } from 'react';
import { X, Upload, Check, Lock, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import '../index.css';

export default function SettingsModal({ onClose }) {
  const { user, updateUser } = useAuth();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [logoPreview, setLogoPreview] = useState(user?.logo || '');
  const [isLoading, setIsLoading] = useState(false);
  
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
      const payload = {};
      if (currentPassword && newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }
      if (logoPreview !== user?.logo) {
        payload.logoBase64 = logoPreview;
      }

      // If nothing changed
      if (Object.keys(payload).length === 0) {
        toast('No changes made', { icon: 'ℹ️' });
        onClose();
        return;
      }

      const response = await api.updateSettings(payload);
      
      // Update local context and localStorage
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
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content" style={{ maxWidth: '500px' }}>
        
        {/* Header */}
        <div className="modal-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={18} style={{ color: 'var(--accent-blue)' }} />
            Institute Settings
          </h3>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="modal-body">
          <form id="settings-form" onSubmit={handleSave}>
            
            {/* Profile Details Section */}
            <div style={{ marginBottom: '24px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 12px 0', color: 'var(--text-primary)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ padding: '4px', background: 'var(--bg-tertiary)', borderRadius: '4px' }}>👤</span>
                Profile Details
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span style={{ fontWeight: '500' }}>Institute Name</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{user?.instituteName || 'Not Set'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '500' }}>User ID / Email</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{user?.username || 'Not Set'}</span>
                </div>
              </div>
            </div>
            
            {/* Logo Upload Section */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                <ImageIcon size={16} style={{ color: 'var(--accent-blue)' }} />
                Institute Logo
              </label>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ 
                  width: '80px', height: '80px', 
                  borderRadius: 'var(--radius-lg)', 
                  border: '2px dashed var(--border-color)', 
                  overflow: 'hidden', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--bg-tertiary)'
                }}>
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-accent)' }}>
                      {user?.instituteName?.substring(0, 2).toUpperCase() || 'IN'}
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
                    className="btn btn-outline"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Upload size={16} />
                    Upload New Logo
                  </button>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '8px' }}>
                    Recommended: 256x256px, max 2MB (PNG/JPG)
                  </p>
                </div>
              </div>
            </div>

            <hr style={{ borderTop: '1px solid var(--border-color)', margin: '24px 0' }} />

            {/* Password Section */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>
                <Lock size={16} style={{ color: 'var(--accent-blue)' }} />
                Change Password
              </label>
              
              <div className="form-group">
                <input 
                  type="password"
                  className="input-field"
                  placeholder="Current Password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginTop: '12px' }}>
                <input 
                  type="password"
                  className="input-field"
                  placeholder="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginTop: '12px' }}>
                <input 
                  type="password"
                  className="input-field"
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
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
