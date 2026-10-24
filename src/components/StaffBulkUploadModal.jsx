import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UploadCloud, Download, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

export default function StaffBulkUploadModal({ isOpen, onClose, onSuccess }) {
  const [isUploading, setIsUploading] = useState(false);
  const [overwriteMode, setOverwriteMode] = useState('rewrite'); // 'rewrite' | 'skip'
  const [previewData, setPreviewData] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  // 📥 Download Professional Styled Excel Sample Template
  const handleDownloadTemplate = () => {
    const sampleRows = [
      {
        'Staff ID': '301',
        'Full Name': 'Dr. Rajesh Verma',
        'Department': 'Physics',
        'Designation': 'Senior Faculty',
        'Phone Number': '9876543210',
        'Email Address': 'rajesh.verma@careerxone.in'
      },
      {
        'Staff ID': '302',
        'Full Name': 'Prof. Anita Sharma',
        'Department': 'Mathematics',
        'Designation': 'HOD Mathematics',
        'Phone Number': '9876543211',
        'Email Address': 'anita.sharma@careerxone.in'
      },
      {
        'Staff ID': '303',
        'Full Name': 'Suresh Kumar',
        'Department': 'Administration',
        'Designation': 'Office Administrator',
        'Phone Number': '9876543212',
        'Email Address': 'suresh.kumar@careerxone.in'
      },
      {
        'Staff ID': '304',
        'Full Name': 'Dr. Meena Iyer',
        'Department': 'Chemistry',
        'Designation': 'Senior Lecturer',
        'Phone Number': '9876543213',
        'Email Address': 'meena.iyer@careerxone.in'
      },
      {
        'Staff ID': '305',
        'Full Name': 'Rakesh Deshmukh',
        'Department': 'IT & Operations',
        'Designation': 'Lab Technician',
        'Phone Number': '9876543214',
        'Email Address': 'rakesh.d@careerxone.in'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();

    // Professional column widths
    ws['!cols'] = [
      { wch: 14 }, // Staff ID
      { wch: 26 }, // Full Name
      { wch: 18 }, // Department
      { wch: 22 }, // Designation
      { wch: 16 }, // Phone Number
      { wch: 30 }  // Email Address
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Staff_Bulk_Upload_Template');
    XLSX.writeFile(wb, 'Staff_Bulk_Upload_Template.xlsx');
    toast.success('📥 Template downloaded: Staff_Bulk_Upload_Template.xlsx');
  };

  // Helper to normalize Excel row keys (handles case and space variations)
  const normalizeRow = (row) => {
    const keys = Object.keys(row);
    const findVal = (...aliases) => {
      for (const alias of aliases) {
        const lowerAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const k of keys) {
          const normK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (normK === lowerAlias) {
            return row[k];
          }
        }
      }
      return '';
    };

    const rawStaffId = findVal('staffId', 'staff_id', 'staff id', 'id', 'empId', 'employeeId', 'employee id');
    const rawName = findVal('name', 'fullName', 'full name', 'employee name', 'staff name');
    const rawDept = findVal('department', 'dept', 'stream');
    const rawDesig = findVal('designation', 'desig', 'destination', 'post', 'title');
    const rawPhone = findVal('phone', 'phoneNumber', 'phone number', 'mobile', 'contact', 'whatsapp');
    const rawEmail = findVal('email', 'emailAddress', 'email address', 'mail');
    const rawRole = findVal('role', 'type');

    if (!rawStaffId && !rawName) return null;

    const cleanDesig = String(rawDesig || 'Faculty / Staff').trim();
    let inferredRole = 'staff';
    const lowerDesig = cleanDesig.toLowerCase();
    if (lowerDesig.includes('teach') || lowerDesig.includes('facult') || lowerDesig.includes('hod') || lowerDesig.includes('prof') || lowerDesig.includes('lectur')) {
      inferredRole = 'faculty';
    } else if (lowerDesig.includes('admin') || lowerDesig.includes('boss') || lowerDesig.includes('director') || lowerDesig.includes('manager')) {
      inferredRole = 'admin';
    }

    return {
      staffId: String(rawStaffId || '').replace(/^#+/, '').trim(),
      name: String(rawName || '').trim(),
      department: String(rawDept || 'General').trim(),
      designation: cleanDesig,
      phone: String(rawPhone || '').replace(/\D/g, '').trim(),
      email: String(rawEmail || '').trim(),
      role: String(rawRole || inferredRole).trim().toLowerCase()
    };
  };

  // Handle Excel file selection & preview
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawJson = XLSX.utils.sheet_to_json(worksheet);

      if (rawJson.length === 0) {
        toast.error('The selected Excel file is empty.');
        return;
      }

      const parsed = rawJson.map(normalizeRow).filter(Boolean);
      const valid = parsed.filter(item => item.staffId && item.name);

      if (valid.length === 0) {
        toast.error('Could not find any valid staff records. Please check the Excel column names.');
        return;
      }

      setPreviewData(valid);
      toast.success(`Found ${valid.length} staff records ready to upload!`);
    } catch (err) {
      console.error('Failed to parse Excel:', err);
      toast.error('Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.');
    }
  };

  // Submit bulk upload to backend
  const handleConfirmUpload = async () => {
    if (!previewData || previewData.length === 0) return;

    setIsUploading(true);
    const toastId = toast.loading(`Uploading ${previewData.length} staff members...`);
    try {
      const res = await api.addStaffBulk(previewData, overwriteMode);
      const data = res?.data || res;

      if (data?.success) {
        toast.success(
          `✅ Bulk Upload Complete: Added ${data.added}, Updated ${data.updated}${data.skipped ? `, Skipped ${data.skipped}` : ''}!`,
          { id: toastId, duration: 4000 }
        );
        setPreviewData(null);
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast.error(data?.error || 'Bulk upload failed', { id: toastId });
      }
    } catch (err) {
      console.error('Bulk upload error:', err);
      toast.error(err.message || 'Error executing bulk staff upload', { id: toastId });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
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
            width: '100%',
            maxWidth: 620,
            background: 'var(--bg-card, #ffffff)',
            borderRadius: 20,
            border: '1.5px solid var(--border-color, #e2e8f0)',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border-color, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.08) 0%, rgba(2, 132, 199, 0.08) 100%)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #0d9488, #0284c7)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(13, 148, 136, 0.25)'
                }}
              >
                <FileSpreadsheet size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Bulk Import Staff / Employees
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Upload Excel (.xlsx, .xls) sheet to add or update staff members in bulk
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Download Template Banner */}
            <div
              style={{
                background: 'var(--bg-light, #f8fafc)',
                border: '1.5px dashed var(--border-color, #cbd5e1)',
                borderRadius: 14,
                padding: '16px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16
              }}
            >
              <div>
                <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)', display: 'block' }}>
                  Need the Excel Template?
                </strong>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                  Download the sample template with pre-filled sample staff data and column headers.
                </span>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                style={{
                  padding: '8px 16px',
                  borderRadius: 10,
                  border: '1px solid #0284c7',
                  background: 'rgba(2, 132, 199, 0.10)',
                  color: '#0284c7',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap'
                }}
              >
                <Download size={15} />
                <span>Download Sample</span>
              </button>
            </div>

            {/* File Upload Drop Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed #0d9488',
                borderRadius: 16,
                padding: '28px 20px',
                textAlign: 'center',
                background: previewData ? 'rgba(13, 148, 136, 0.04)' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />

              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  background: 'rgba(13, 148, 136, 0.12)',
                  color: '#0d9488',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 10px'
                }}
              >
                <UploadCloud size={26} />
              </div>

              <h4 style={{ margin: '0 0 4px', fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {previewData ? `Selected: ${previewData.length} Staff Records Ready` : 'Click to Browse or Drag & Drop Excel File'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                Supports Microsoft Excel files (.xlsx, .xls)
              </p>
            </div>

            {/* Preview of Parsed Staff Records */}
            {previewData && (
              <div
                style={{
                  background: 'var(--bg-light, #f8fafc)',
                  borderRadius: 12,
                  padding: '12px 16px',
                  border: '1px solid var(--border-color, #e2e8f0)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.80rem', fontWeight: 800, color: '#0d9488', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <CheckCircle2 size={15} />
                    Ready to Import {previewData.length} Staff Members
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewData(null)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      fontSize: '0.74rem',
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    Clear
                  </button>
                </div>

                <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {previewData.slice(0, 10).map((st, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: '0.74rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '3px 6px',
                        background: 'var(--bg-card, #ffffff)',
                        borderRadius: 6,
                        border: '1px solid var(--border-color, #e2e8f0)'
                      }}
                    >
                      <span><strong>#{st.staffId}</strong> — {st.name} ({st.designation})</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{st.phone || 'No phone'}</span>
                    </div>
                  ))}
                  {previewData.length > 10 && (
                    <div style={{ fontSize: '0.70rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: 2 }}>
                      + {previewData.length - 10} more staff members
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Overwrite Mode Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Conflict Strategy:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: overwriteMode === 'rewrite' ? '2px solid #0284c7' : '1px solid var(--border-color, #e2e8f0)',
                    background: overwriteMode === 'rewrite' ? 'rgba(2, 132, 199, 0.06)' : 'transparent',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="radio"
                    name="overwriteMode"
                    value="rewrite"
                    checked={overwriteMode === 'rewrite'}
                    onChange={() => setOverwriteMode('rewrite')}
                    style={{ marginTop: 2 }}
                  />
                  <div>
                    <strong style={{ fontSize: '0.80rem', display: 'block', color: 'var(--text-primary)' }}>
                      Update Existing (Rewrite)
                    </strong>
                    <span style={{ fontSize: '0.70rem', color: 'var(--text-secondary)' }}>
                      Updates existing staff info with new Excel data.
                    </span>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: overwriteMode === 'skip' ? '2px solid #0284c7' : '1px solid var(--border-color, #e2e8f0)',
                    background: overwriteMode === 'skip' ? 'rgba(2, 132, 199, 0.06)' : 'transparent',
                    cursor: 'pointer'
                  }}
                >
                  <input
                    type="radio"
                    name="overwriteMode"
                    value="skip"
                    checked={overwriteMode === 'skip'}
                    onChange={() => setOverwriteMode('skip')}
                    style={{ marginTop: 2 }}
                  />
                  <div>
                    <strong style={{ fontSize: '0.80rem', display: 'block', color: 'var(--text-primary)' }}>
                      Skip Existing (New Only)
                    </strong>
                    <span style={{ fontSize: '0.70rem', color: 'var(--text-secondary)' }}>
                      Keeps existing staff intact and adds new members.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '14px 24px',
              borderTop: '1px solid var(--border-color, #e2e8f0)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 12,
              background: 'var(--bg-light, #f8fafc)'
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="btn btn-secondary"
              style={{ padding: '8px 18px', fontWeight: 600, fontSize: '0.84rem' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmUpload}
              disabled={!previewData || previewData.length === 0 || isUploading}
              style={{
                padding: '8px 22px',
                borderRadius: 10,
                border: 'none',
                background: previewData && previewData.length > 0 ? 'linear-gradient(135deg, #0d9488 0%, #0284c7 100%)' : '#94a3b8',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.84rem',
                cursor: previewData && previewData.length > 0 ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: previewData && previewData.length > 0 ? '0 4px 14px rgba(13, 148, 136, 0.35)' : 'none'
              }}
            >
              <FileSpreadsheet size={16} />
              <span>{isUploading ? 'Importing Staff...' : `Import ${previewData ? previewData.length : ''} Staff`}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
