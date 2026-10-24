import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  User,
  Phone,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Edit3,
  Save,
  Printer,
  Sparkles,
  History,
  ShieldCheck,
  CreditCard,
  LogIn,
  LogOut,
  RefreshCw,
  MessageSquare,
  Mail,
  QrCode,
  Check,
  Camera,
  Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../utils/api';
import StaffIdCard from './StaffIdCard';
import { getInitials } from '../data/sampleData';

export default function StaffProfileModal({
  staff: initialStaff,
  onClose,
  onStaffUpdated,
  onManualPunch,
  onStaffDeleted
}) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'attendance' | 'idcard'
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [historyStats, setHistoryStats] = useState({ presentCount: 0, totalRecords: 0 });
  // ID Card Custom Dimension State (User controllable Width, Height & Presets)
  const [modalCardSizePreset, setModalCardSizePreset] = useState('standard'); // 'standard' | 'compact' | 'small' | 'mini' | 'custom'
  const [modalCardWidth, setModalCardWidth] = useState(260);
  const [modalCardHeight, setModalCardHeight] = useState(390);
  const [modalLockRatio, setModalLockRatio] = useState(true);

  const handleDeleteStaff = async () => {
    const memberName = currentStaff?.name || 'this staff member';
    const sId = currentStaff?.staffId || staffId;
    const confirmed = window.confirm(
      `⚠️ PERMANENT DELETE CONFIRMATION:\n\nAre you sure you want to permanently delete "${memberName}" (#${sId})?\n\nThis will completely remove the staff record and all associated attendance logs from both Local and Cloud MongoDB databases. This action CANNOT be undone.`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    const toastId = toast.loading(`Permanently deleting staff #${sId}...`);
    try {
      const res = await api.deleteStaffMember(sId, true);
      const data = res?.data || res;
      if (data?.success) {
        toast.success(`✅ Permanently deleted ${memberName}!`, { id: toastId });
        if (onStaffDeleted) onStaffDeleted(sId);
        onClose();
      } else {
        toast.error(data?.error || 'Failed to delete staff member', { id: toastId });
      }
    } catch (err) {
      console.error('Delete staff error:', err);
      toast.error(err.message || 'Error deleting staff member', { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleModalPresetChange = (presetId) => {
    setModalCardSizePreset(presetId);
    if (presetId === 'standard') {
      setModalCardWidth(260);
      setModalCardHeight(390);
    } else if (presetId === 'compact') {
      setModalCardWidth(230);
      setModalCardHeight(355);
    } else if (presetId === 'small') {
      setModalCardWidth(205);
      setModalCardHeight(315);
    } else if (presetId === 'mini') {
      setModalCardWidth(185);
      setModalCardHeight(280);
    }
  };

  const handleModalWidthChange = (val) => {
    const num = Math.max(140, Math.min(500, parseInt(val, 10) || 140));
    setModalCardWidth(num);
    setModalCardSizePreset('custom');
    if (modalLockRatio) {
      setModalCardHeight(Math.round(num * 1.5));
    }
  };

  const handleModalHeightChange = (val) => {
    const num = Math.max(200, Math.min(750, parseInt(val, 10) || 200));
    setModalCardHeight(num);
    setModalCardSizePreset('custom');
    if (modalLockRatio) {
      setModalCardWidth(Math.round(num / 1.5));
    }
  };

  // 🔄 Local Reactive Staff State (Guarantees live phone and contact updates without modal reopen)
  const [currentStaff, setCurrentStaff] = useState(initialStaff || {});

  // Form State for editing staff info
  const [formData, setFormData] = useState({
    staffId: initialStaff?.staffId || '',
    name: initialStaff?.name || '',
    phone: initialStaff?.phone || '',
    department: initialStaff?.department || 'General',
    designation: initialStaff?.designation || 'Faculty / Staff',
    email: initialStaff?.email || '',
    role: initialStaff?.role || 'staff',
    photo: initialStaff?.photo || null
  });

  const staffId = currentStaff?.staffId || initialStaff?.staffId;
  const isPrince = String(staffId) === '340';

  // Image compressor helper
  const compressImage = (file, maxWidth = 500, maxHeight = 500, quality = 0.85) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => reject(new Error('Failed to load image for compression'));
        img.src = readerEvent.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file, 500, 500, 0.85);
        setFormData(prev => ({ ...prev, photo: compressed }));
      } catch (err) {
        console.warn('Compression fallback to FileReader:', err);
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData(prev => ({ ...prev, photo: reader.result }));
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Sync when initialStaff prop changes
  useEffect(() => {
    if (initialStaff) {
      setCurrentStaff(prev => ({ ...prev, ...initialStaff }));
      setFormData(prev => ({
        staffId: initialStaff.staffId || prev.staffId,
        name: initialStaff.name || prev.name,
        phone: initialStaff.phone || prev.phone,
        department: initialStaff.department || prev.department,
        designation: initialStaff.designation || prev.designation,
        email: initialStaff.email || prev.email,
        role: initialStaff.role || prev.role,
        photo: initialStaff.photo || prev.photo || null
      }));
    }
  }, [initialStaff]);

  // 🚀 Auto-fetch latest staff details from DB to guarantee live phone number is never stale
  useEffect(() => {
    let isMounted = true;
    const fetchFreshProfile = async () => {
      if (!staffId) return;
      try {
        const res = await api.getStaffMembers();
        const list = res?.staff || res?.data?.staff || [];
        const found = list.find(s => String(s.staffId) === String(staffId));
        if (found && isMounted) {
          setCurrentStaff(prev => ({ ...prev, ...found }));
          setFormData(prev => ({
            ...prev,
            staffId: found.staffId || prev.staffId,
            name: found.name || prev.name,
            phone: found.phone || prev.phone,
            department: found.department || prev.department,
            designation: found.designation || prev.designation,
            email: found.email || prev.email,
            role: found.role || prev.role,
            photo: found.photo || prev.photo || null
          }));
        }
      } catch (err) {
        console.warn('Could not auto-fetch fresh staff profile:', err);
      }
    };
    fetchFreshProfile();
    return () => { isMounted = false; };
  }, [staffId]);

  // Load attendance history for this staff member
  const loadHistory = async () => {
    if (!staffId) return;
    setIsLoadingHistory(true);
    try {
      const cleanId = String(staffId).replace(/^#+/, '').trim();
      const res = await api.getStaffAttendanceHistory(cleanId);
      const data = res?.data || res;
      let recs = data?.records || [];
      // Fallback: If DB records is empty but currentStaff has entry punch today, display today's live record
      if (recs.length === 0 && (currentStaff?.entryTime && currentStaff.entryTime !== '--')) {
        recs = [{
          date: currentStaff.date || new Date().toISOString().split('T')[0],
          status: currentStaff.status || 'present',
          entryTime: currentStaff.entryTime,
          exitTime: currentStaff.exitTime || '--',
          workHoursFormatted: currentStaff.workHoursFormatted || '0h 0m',
          deviceSN: currentStaff.deviceSN || 'Auto Bio / Web'
        }];
      }
      setAttendanceHistory(recs);
      setHistoryStats({
        presentCount: data?.presentCount || (recs.length > 0 ? 1 : 0),
        totalRecords: recs.length
      });
    } catch (err) {
      console.warn('Failed to load staff attendance history:', err.message);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [staffId, currentStaff?.entryTime, currentStaff?.exitTime]);

  // Handle Save Staff Profile
  const handleSaveProfile = async (e) => {
    e?.preventDefault();
    if (!formData.name.trim()) {
      return toast.error('Full Name is required');
    }
    if (!formData.staffId.trim()) {
      return toast.error('Staff ID is required');
    }
    setIsSaving(true);
    const toastId = toast.loading('Saving profile changes...');
    try {
      const payload = {
        originalStaffId: currentStaff?.staffId || initialStaff?.staffId,
        staffId: String(formData.staffId).trim(),
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        department: formData.department.trim(),
        designation: formData.designation.trim(),
        email: (formData.email || '').trim(),
        role: formData.role,
        photo: formData.photo !== undefined ? formData.photo : (currentStaff?.photo || null)
      };

      const res = await api.createStaffMember(payload);
      const data = res?.data || res;
      if (data?.success) {
        const savedMember = data.member || payload;
        setCurrentStaff(prev => ({ ...prev, ...savedMember }));
        setFormData(prev => ({
          ...prev,
          staffId: savedMember.staffId || prev.staffId,
          name: savedMember.name || prev.name,
          phone: savedMember.phone || prev.phone,
          department: savedMember.department || prev.department,
          designation: savedMember.designation || prev.designation,
          email: savedMember.email || prev.email,
          role: savedMember.role || prev.role,
          photo: savedMember.photo || null
        }));
        toast.success(`✅ Saved profile for ${formData.name}!`, { id: toastId });
        setIsEditing(false);
        if (onStaffUpdated) {
          onStaffUpdated(savedMember);
        }
      } else {
        toast.error(data?.error || 'Failed to save staff profile', { id: toastId });
      }
    } catch (err) {
      console.error('Save staff error:', err);
      toast.error(err.message || 'Error updating profile', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const isPresentToday = currentStaff?.status === 'present' || (currentStaff?.entryTime && currentStaff?.entryTime !== '--');

  return createPortal(
    <AnimatePresence>
      <div
        className="modal-overlay"
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}
      >
        <motion.div
          className="modal-content"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          style={{
            width: '95vw',
            maxWidth: '1050px',
            height: '92vh',
            maxHeight: '94vh',
            background: 'var(--bg-card, #ffffff)',
            color: 'var(--text-primary, #0f172a)',
            border: '1.5px solid var(--border-color, #e2e8f0)',
            borderRadius: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Top Banner Header: All primary Identity in one place */}
          <div
            style={{
              padding: '22px 26px',
              borderBottom: '1px solid var(--border-color, #e2e8f0)',
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.03) 0%, rgba(59, 130, 246, 0.05) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {currentStaff?.photo ? (
                <img
                  src={currentStaff.photo}
                  alt={currentStaff?.name || 'Staff'}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    objectFit: 'cover',
                    border: '2.5px solid #2563eb',
                    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15)',
                    display: 'block'
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 16,
                    background: isPrince
                      ? 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)'
                      : 'linear-gradient(135deg, #0d9488 0%, #0284c7 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: '1.25rem',
                    boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15)'
                  }}
                >
                  {getInitials(currentStaff?.name || 'Staff')}
                </div>
              )}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {currentStaff?.name}
                  </h2>
                  <span
                    style={{
                      background: 'rgba(59, 130, 246, 0.1)',
                      color: '#2563eb',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 10,
                      fontFamily: 'monospace'
                    }}
                  >
                    ID: {currentStaff?.staffId}
                  </span>
                  {isPrince && (
                    <span
                      style={{
                        background: '#3b82f6',
                        color: '#ffffff',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 10
                      }}
                    >
                      ⭐ You
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <span>{currentStaff?.designation || 'Staff / Faculty'}</span>
                  <span>•</span>
                  <span>{currentStaff?.department || 'General'}</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1.5px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '50%',
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#ef4444',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
              title="Close Profile (Esc)"
            >
              <X size={18} />
            </button>
          </div>

          {/* Today's Punch Summary Strip */}
          <div
            style={{
              padding: '12px 26px',
              background: 'var(--bg-light, #f8fafc)',
              borderBottom: '1px solid var(--border-color, #e2e8f0)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: 12,
              fontSize: '0.80rem'
            }}
          >
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.72rem', fontWeight: 600 }}>TODAY'S STATUS</span>
              <span
                style={{
                  display: 'inline-block',
                  marginTop: 2,
                  padding: '2px 8px',
                  borderRadius: 8,
                  fontWeight: 800,
                  fontSize: '0.72rem',
                  background: isPresentToday ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  color: isPresentToday ? '#10b981' : '#ef4444'
                }}
              >
                {isPresentToday ? '✓ PRESENT' : '✗ ABSENT'}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.72rem', fontWeight: 600 }}>CHECK-IN TIME</span>
              <strong style={{ color: currentStaff?.entryTime !== '--' ? '#10b981' : 'var(--text-secondary)', fontSize: '0.86rem' }}>
                {currentStaff?.entryTime || '--'}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.72rem', fontWeight: 600 }}>CHECK-OUT TIME</span>
              <strong style={{ color: currentStaff?.exitTime !== '--' ? '#3b82f6' : 'var(--text-secondary)', fontSize: '0.86rem' }}>
                {currentStaff?.exitTime || '--'}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.72rem', fontWeight: 600 }}>WORK DURATION</span>
              <strong style={{ color: 'var(--text-primary)', fontSize: '0.86rem' }}>
                {currentStaff?.workHoursFormatted || '0h 0m'}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.72rem', fontWeight: 600 }}>PUNCH DEVICE</span>
              <strong style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                {String(currentStaff?.deviceSN || 'Auto Bio / Web').replace(/telegram\s*remote/gi, 'Biomax Device').replace(/telegram/gi, 'Biomax Device')}
              </strong>
            </div>
          </div>

          {/* Tab Navigation */}
          <div
            style={{
              padding: '0 26px',
              display: 'flex',
              gap: 8,
              borderBottom: '1px solid var(--border-color, #e2e8f0)',
              background: 'var(--bg-card, #ffffff)'
            }}
          >
            <button
              onClick={() => setActiveTab('overview')}
              style={{
                padding: '12px 16px',
                border: 'none',
                background: 'transparent',
                borderBottom: activeTab === 'overview' ? '2.5px solid #2563eb' : '2.5px solid transparent',
                color: activeTab === 'overview' ? '#2563eb' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.86rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <User size={15} />
              Profile Details
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              style={{
                padding: '12px 16px',
                border: 'none',
                background: 'transparent',
                borderBottom: activeTab === 'attendance' ? '2.5px solid #2563eb' : '2.5px solid transparent',
                color: activeTab === 'attendance' ? '#2563eb' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.86rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <History size={15} />
              Attendance Records ({historyStats.totalRecords})
            </button>
            <button
              onClick={() => setActiveTab('idcard')}
              style={{
                padding: '12px 16px',
                border: 'none',
                background: 'transparent',
                borderBottom: activeTab === 'idcard' ? '2.5px solid #2563eb' : '2.5px solid transparent',
                color: activeTab === 'idcard' ? '#2563eb' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: '0.86rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <CreditCard size={15} />
              Official ID Card
            </button>
          </div>

          {/* Modal Body / Tab Contents */}
          <div
            style={{
              padding: '24px 26px',
              overflowY: 'auto',
              flex: 1,
              background: 'var(--bg-card, #ffffff)'
            }}
          >
            {/* TAB 1: OVERVIEW & PROFILE EDIT (Clean, Non-repetitive) */}
            {activeTab === 'overview' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Contact & Notifications</h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Manage WhatsApp alerts and internal profile configurations.
                    </p>
                  </div>
                  {!isEditing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        onClick={handleDeleteStaff}
                        disabled={isDeleting}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 8,
                          border: '1.5px solid rgba(239, 68, 68, 0.4)',
                          background: 'rgba(239, 68, 68, 0.08)',
                          color: '#ef4444',
                          fontWeight: 700,
                          fontSize: '0.80rem',
                          cursor: isDeleting ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}
                        title="Permanently delete staff from Local & Cloud MongoDB"
                      >
                        <Trash2 size={14} />
                        <span>{isDeleting ? 'Deleting...' : 'Delete Staff'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 8,
                          border: '1.5px solid #2563eb',
                          background: 'rgba(37, 99, 235, 0.08)',
                          color: '#2563eb',
                          fontWeight: 700,
                          fontSize: '0.80rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5
                        }}
                      >
                        <Edit3 size={14} />
                        Edit Profile
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 8,
                        border: '1px solid var(--border-color)',
                        background: 'transparent',
                        color: 'var(--text-secondary)',
                        fontWeight: 600,
                        fontSize: '0.80rem',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {!isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* 📱 WhatsApp Notification Channel Card (Prominent & High-Priority) */}
                    <div
                      style={{
                        padding: '18px 20px',
                        borderRadius: '16px',
                        background: currentStaff?.phone
                          ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.02) 100%)'
                          : 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.02) 100%)',
                        border: currentStaff?.phone
                          ? '1.5px solid rgba(16, 185, 129, 0.3)'
                          : '1.5px solid rgba(245, 158, 11, 0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 12,
                              background: currentStaff?.phone ? '#10b981' : '#f59e0b',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: currentStaff?.phone ? '0 4px 12px rgba(16, 185, 129, 0.3)' : '0 4px 12px rgba(245, 158, 11, 0.3)'
                            }}
                          >
                            <Phone size={19} />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                              WhatsApp Punch Alerts
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              Automated Check-In and Check-Out confirmations
                            </div>
                          </div>
                        </div>

                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '4px 12px',
                            borderRadius: 20,
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            background: currentStaff?.phone ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: currentStaff?.phone ? '#059669' : '#d97706',
                            border: currentStaff?.phone ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(245, 158, 11, 0.25)'
                          }}
                        >
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: currentStaff?.phone ? '#10b981' : '#f59e0b' }} />
                          {currentStaff?.phone ? 'Active & Receiving Alerts' : 'No Phone Configured'}
                        </span>
                      </div>

                      <div
                        style={{
                          padding: '14px 16px',
                          borderRadius: 12,
                          background: 'var(--bg-card, #ffffff)',
                          border: '1px solid var(--border-color, #e2e8f0)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          flexWrap: 'wrap'
                        }}
                      >
                        <div>
                          <span style={{ fontSize: '0.70rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                            Registered WhatsApp Number
                          </span>
                          <div style={{ fontSize: '1.20rem', fontWeight: 800, color: currentStaff?.phone ? 'var(--text-primary)' : '#ef4444', fontFamily: 'monospace', marginTop: 3 }}>
                            {currentStaff?.phone ? `+91 ${currentStaff.phone}` : 'No phone set (SMS will not be sent)'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsEditing(true)}
                          style={{
                            padding: '7px 16px',
                            borderRadius: 8,
                            border: '1.5px solid #2563eb',
                            background: 'rgba(37, 99, 235, 0.08)',
                            color: '#2563eb',
                            fontWeight: 700,
                            fontSize: '0.80rem',
                            cursor: 'pointer'
                          }}
                        >
                          {currentStaff?.phone ? 'Change Number' : '+ Add Number'}
                        </button>
                      </div>

                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                        💡 When this employee checks in or checks out using the 2D Barcode scanner desk or Biometric device, the Career Xone WhatsApp bot automatically dispatches an instant delivery confirmation to this exact phone number.
                      </p>
                    </div>

                    {/* 🛡️ System Role & Account Credentials (Non-redundant) */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: 12
                      }}
                    >
                      <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-light, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <ShieldCheck size={14} style={{ color: '#2563eb' }} />
                          <span style={{ fontSize: '0.70rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                            System Role
                          </span>
                        </div>
                        <div style={{ fontSize: '0.94rem', fontWeight: 800, textTransform: 'capitalize', color: 'var(--text-primary)' }}>
                          {currentStaff?.role || 'Staff Member'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                          Attendance & Portal Verified
                        </div>
                      </div>

                      <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-light, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <Mail size={14} style={{ color: '#0d9488' }} />
                          <span style={{ fontSize: '0.70rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                            Email Address
                          </span>
                        </div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 800, color: currentStaff?.email ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {currentStaff?.email || 'Not configured'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                          Internal Communications
                        </div>
                      </div>

                      <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-light, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <QrCode size={14} style={{ color: '#8b5cf6' }} />
                          <span style={{ fontSize: '0.70rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                            Hardware Barcode Key
                          </span>
                        </div>
                        <div style={{ fontSize: '0.94rem', fontWeight: 800, fontFamily: 'monospace', color: '#2563eb' }}>
                          {currentStaff?.staffId ? `#${currentStaff.staffId}` : '--'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                          2D Gun & Handheld Scannable
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ✏️ EDIT MODE FORM */
                  <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* 📸 Profile Photo Upload / Edit */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      padding: 14,
                      borderRadius: 14,
                      background: 'var(--bg-light, #f8fafc)',
                      border: '1.5px dashed var(--border-color, #cbd5e1)'
                    }}>
                      <div style={{ position: 'relative', width: 68, height: 68, flexShrink: 0 }}>
                        {formData.photo ? (
                          <img
                            src={formData.photo}
                            alt="Profile"
                            style={{
                              width: 68,
                              height: 68,
                              borderRadius: 14,
                              objectFit: 'cover',
                              border: '2px solid #2563eb',
                              display: 'block'
                            }}
                          />
                        ) : (
                          <div style={{
                            width: 68,
                            height: 68,
                            borderRadius: 14,
                            background: 'rgba(37, 99, 235, 0.1)',
                            color: '#2563eb',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1.5px dashed #3b82f6'
                          }}>
                            <Camera size={22} />
                            <span style={{ fontSize: '0.62rem', fontWeight: 700, marginTop: 2 }}>No Photo</span>
                          </div>
                        )}
                        <label
                          htmlFor="staff-profile-photo-upload"
                          style={{
                            position: 'absolute',
                            bottom: -4,
                            right: -4,
                            background: '#2563eb',
                            color: '#ffffff',
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                            border: '2px solid #ffffff'
                          }}
                          title="Upload / Change Photo"
                        >
                          <Camera size={13} />
                          <input
                            id="staff-profile-photo-upload"
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handlePhotoUpload}
                          />
                        </label>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          Staff Profile Photo
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                          Appears on official PVC ID card, scanner kiosk, and attendance roster.
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <label
                            htmlFor="staff-profile-photo-upload"
                            style={{
                              padding: '5px 12px',
                              borderRadius: 6,
                              background: '#2563eb',
                              color: '#ffffff',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <Camera size={12} />
                            {formData.photo ? 'Change Photo' : 'Upload Photo'}
                          </label>
                          {formData.photo && (
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, photo: null }))}
                              style={{
                                padding: '5px 12px',
                                borderRadius: 6,
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: '#ef4444',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                            >
                              <Trash2 size={12} />
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                          Staff ID * (Biometric / 2D Gun Key)
                        </label>
                        <input
                          type="text"
                          value={formData.staffId}
                          onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                          required
                          placeholder="e.g. 301, 340, EMP10"
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1.5px solid var(--border-color, #cbd5e1)',
                            background: 'var(--bg-card, #ffffff)',
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            color: 'var(--text-primary)'
                          }}
                        />
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: 2, display: 'block' }}>
                          💡 Editable. Syncs attendance logs automatically.
                        </span>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                          Full Name *
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1.5px solid var(--border-color, #cbd5e1)',
                            background: 'var(--bg-card, #ffffff)',
                            color: 'var(--text-primary)',
                            fontWeight: 600
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        WhatsApp Mobile Number * (For Instant Check-In/Out Messages)
                      </label>
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="e.g. 8538949912 (10-digit number)"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: '1.5px solid #3b82f6',
                          background: 'rgba(59, 130, 246, 0.04)',
                          color: 'var(--text-primary)',
                          fontWeight: 700,
                          fontSize: '0.94rem'
                        }}
                      />
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 4, display: 'block' }}>
                        💡 Alerts are dispatched via WhatsApp Bot to this exact phone number whenever check-in or check-out is recorded.
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                          Department
                        </label>
                        <input
                          type="text"
                          value={formData.department}
                          onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                          placeholder="e.g. Engineering, Mathematics, Admin"
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1.5px solid var(--border-color, #cbd5e1)',
                            background: 'var(--bg-card, #ffffff)',
                            color: 'var(--text-primary)'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                          Designation
                        </label>
                        <input
                          type="text"
                          value={formData.designation}
                          onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                          placeholder="e.g. Senior Faculty, Lab Incharge"
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1.5px solid var(--border-color, #cbd5e1)',
                            background: 'var(--bg-card, #ffffff)',
                            color: 'var(--text-primary)'
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                          Email Address (Optional)
                        </label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="staff@institute.edu"
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1.5px solid var(--border-color, #cbd5e1)',
                            background: 'var(--bg-card, #ffffff)',
                            color: 'var(--text-primary)'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                          System Role
                        </label>
                        <select
                          value={formData.role}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: '1.5px solid var(--border-color, #cbd5e1)',
                            background: 'var(--bg-card, #ffffff)',
                            color: 'var(--text-primary)',
                            fontWeight: 600
                          }}
                        >
                          <option value="staff">Staff Member</option>
                          <option value="teacher">Teacher</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="btn btn-secondary btn-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="btn btn-primary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <Save size={15} />
                        {isSaving ? 'Saving...' : 'Save Profile Changes'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* TAB 2: ATTENDANCE RECORDS */}
            {activeTab === 'attendance' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Attendance Punch History</h4>
                    <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Complete check-in and check-out timeline recorded via Biometric & 2D QR Scanner.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={loadHistory}
                    disabled={isLoadingHistory}
                    style={{
                      background: 'rgba(0,0,0,0.05)',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: 8,
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5
                    }}
                  >
                    <RefreshCw size={13} className={isLoadingHistory ? 'spin' : ''} />
                    Refresh History
                  </button>
                </div>

                {isLoadingHistory ? (
                  <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Loading attendance records...
                  </div>
                ) : attendanceHistory.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-secondary)' }}>
                    <Clock size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                    <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600 }}>No attendance records found yet</p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.76rem' }}>
                      Punches from the 2D barcode scanner or biometric device will appear here.
                    </p>
                  </div>
                ) : (
                  <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: 12 }}>
                    <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                      <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-light, #f8fafc)', zIndex: 1 }}>
                        <tr>
                          <th>Date</th>
                          <th>Status</th>
                          <th>Check-In</th>
                          <th>Check-Out</th>
                          <th>Duration</th>
                          <th>Device / Mode</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceHistory.map((rec, idx) => {
                          const isRecPresent = rec.status === 'present' || rec.entryTime !== '--';
                          return (
                            <tr key={idx}>
                              <td>
                                <strong style={{ fontFamily: 'monospace' }}>{rec.date}</strong>
                              </td>
                              <td>
                                <span
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                    fontSize: '0.70rem',
                                    fontWeight: 800,
                                    background: isRecPresent ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                    color: isRecPresent ? '#10b981' : '#ef4444'
                                  }}
                                >
                                  {isRecPresent ? 'PRESENT' : 'ABSENT'}
                                </span>
                              </td>
                              <td>
                                <span style={{ color: rec.entryTime !== '--' ? '#10b981' : 'var(--text-secondary)', fontWeight: 700, fontSize: '0.84rem' }}>
                                  {rec.entryTime || '--'}
                                </span>
                              </td>
                              <td>
                                <span style={{ color: rec.exitTime !== '--' ? '#3b82f6' : (rec.entryTime !== '--' ? '#10b981' : 'var(--text-secondary)'), fontWeight: 700, fontSize: '0.84rem' }}>
                                  {rec.exitTime !== '--' ? rec.exitTime : (rec.entryTime !== '--' ? '🟢 Active IN' : '--')}
                                </span>
                              </td>
                              <td>
                                <div>
                                  <strong style={{ fontSize: '0.84rem' }}>{rec.workHoursFormatted || '0h 0m'}</strong>
                                  {rec.punches && rec.punches.filter(p => p.type === 'IN').length > 1 && (
                                    <div style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 700 }}>
                                      {rec.punches.filter(p => p.type === 'IN').length} Shifts
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td>
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                  {String(rec.deviceSN || 'Auto Bio / Web').replace(/telegram\s*remote/gi, 'Biomax Device').replace(/telegram/gi, 'Biomax Device')}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: ID CARD PREVIEW & CUSTOM PRINT */}
            {activeTab === 'idcard' && (
              <div style={{ textAlign: 'center' }}>
                {/* Secondary Size & Dimension Toolbar */}
                <div
                  className="no-print"
                  style={{
                    background: 'var(--bg-light, #f8fafc)',
                    border: '1.5px solid var(--border-color, #e2e8f0)',
                    borderRadius: 14,
                    padding: '12px 16px',
                    margin: '0 0 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    alignItems: 'center'
                  }}
                >
                  {/* Preset Pills */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)' }}>📏 SIZE PRESETS:</span>
                    <div style={{ display: 'inline-flex', background: 'var(--bg-card, #ffffff)', padding: 3, borderRadius: 8, border: '1px solid var(--border-color, #e2e8f0)', flexWrap: 'wrap', gap: 2 }}>
                      {[
                        { id: 'standard', label: '🌟 Standard (260×390)' },
                        { id: 'compact', label: '📏 Compact (230×355)' },
                        { id: 'small', label: '🪪 Pocket (205×315)' },
                        { id: 'mini', label: '🤏 Mini (185×280)' },
                        { id: 'custom', label: '⚙️ Custom' }
                      ].map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleModalPresetChange(s.id)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: 'none',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            background: modalCardSizePreset === s.id ? '#0f766e' : 'transparent',
                            color: modalCardSizePreset === s.id ? '#ffffff' : 'var(--text-secondary)',
                            boxShadow: modalCardSizePreset === s.id ? '0 2px 6px rgba(15, 118, 110, 0.3)' : 'none'
                          }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dimension Controls: Width & Height Inputs */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
                    {/* Width */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>↔️ Width:</span>
                      <input
                        type="number"
                        min="140"
                        max="500"
                        step="5"
                        value={modalCardWidth}
                        onChange={(e) => handleModalWidthChange(e.target.value)}
                        style={{
                          width: '70px',
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1.5px solid var(--border-color, #cbd5e1)',
                          background: 'var(--bg-card, #ffffff)',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          textAlign: 'center',
                          color: 'var(--text-primary)'
                        }}
                      />
                      <span style={{ fontSize: '0.70rem', color: 'var(--text-secondary)', fontWeight: 700 }}>px (~{(modalCardWidth * 0.208).toFixed(0)}mm)</span>
                    </div>

                    {/* Height / Length */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>↕️ Length:</span>
                      <input
                        type="number"
                        min="200"
                        max="750"
                        step="5"
                        value={modalCardHeight}
                        onChange={(e) => handleModalHeightChange(e.target.value)}
                        style={{
                          width: '70px',
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1.5px solid var(--border-color, #cbd5e1)',
                          background: 'var(--bg-card, #ffffff)',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          textAlign: 'center',
                          color: 'var(--text-primary)'
                        }}
                      />
                      <span style={{ fontSize: '0.70rem', color: 'var(--text-secondary)', fontWeight: 700 }}>px (~{(modalCardHeight * 0.208).toFixed(0)}mm)</span>
                    </div>

                    {/* Ratio Lock */}
                    <button
                      type="button"
                      onClick={() => setModalLockRatio(!modalLockRatio)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--border-color, #cbd5e1)',
                        background: modalLockRatio ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-card, #ffffff)',
                        color: modalLockRatio ? '#dc2626' : 'var(--text-secondary)',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                      title={modalLockRatio ? 'Lock Proportions (1:1.5 standard ratio)' : 'Free Size (unlock ratio)'}
                    >
                      {modalLockRatio ? '🔗 Ratio Locked' : '🔓 Free Size'}
                    </button>

                    {/* Direct Print Button */}
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="btn btn-sm"
                      style={{
                        background: '#dc2626',
                        color: '#ffffff',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontWeight: 800,
                        padding: '5px 14px',
                        boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)'
                      }}
                    >
                      <Printer size={14} />
                      Print This ID Card
                    </button>
                  </div>
                </div>

                {/* Live Preview Container (Screen + Print) */}
                <div
                  className="staff-profile-print-card-container"
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 24,
                    flexWrap: 'wrap',
                    marginBottom: 20
                  }}
                >
                  <div>
                    <span className="no-print" style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                      FRONT SIDE
                    </span>
                    <StaffIdCard staff={currentStaff} side="front" customWidth={modalCardWidth} customHeight={modalCardHeight} />
                  </div>
                  <div>
                    <span className="no-print" style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                      BACK SIDE
                    </span>
                    <StaffIdCard staff={currentStaff} side="back" customWidth={modalCardWidth} customHeight={modalCardHeight} />
                  </div>
                </div>

                {/* Print Styles for Staff Profile Modal */}
                <style>{`
                  @media print {
                    body * {
                      visibility: hidden !important;
                    }
                    .staff-profile-print-card-container,
                    .staff-profile-print-card-container * {
                      visibility: visible !important;
                    }
                    .staff-profile-print-card-container {
                      position: fixed !important;
                      left: 0 !important;
                      top: 0 !important;
                      width: 100% !important;
                      margin: 0 !important;
                      padding: 20px !important;
                      display: flex !important;
                      justify-content: center !important;
                      align-items: flex-start !important;
                      gap: 24px !important;
                      background: #ffffff !important;
                      box-shadow: none !important;
                    }
                    .no-print {
                      display: none !important;
                    }
                  }
                `}</style>
              </div>
            )}
          </div>

          {/* Modal Footer Controls */}
          <div
            style={{
              padding: '16px 26px',
              borderTop: '1px solid var(--border-color, #e2e8f0)',
              background: 'var(--bg-light, #f8fafc)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap'
            }}
          >
            {/* Quick Punch Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Quick Action:</span>
              <button
                type="button"
                onClick={() => onManualPunch && onManualPunch(staffId, 'IN')}
                className="btn btn-sm"
                style={{
                  background: '#10b981',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontWeight: 700,
                  fontSize: '0.78rem'
                }}
              >
                <LogIn size={13} />
                Record IN
              </button>
              <button
                type="button"
                onClick={() => onManualPunch && onManualPunch(staffId, 'OUT')}
                className="btn btn-sm"
                style={{
                  background: '#3b82f6',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontWeight: 700,
                  fontSize: '0.78rem'
                }}
              >
                <LogOut size={13} />
                Record OUT
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {activeTab === 'idcard' && (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn btn-sm no-print"
                  style={{
                    background: '#0f766e',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontWeight: 800
                  }}
                >
                  <Printer size={13} />
                  Print ID Card
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary btn-sm"
                style={{ fontWeight: 700 }}
              >
                Close Profile
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
