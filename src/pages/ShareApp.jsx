import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { 
  Smartphone, Link as LinkIcon, MessageSquare, Copy, CheckCircle2, 
  Download, Send, Sparkles, UserCheck, Key, User, Users 
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ShareApp() {
  const { students, sendBulkManualSMS, sendManualSMS } = useApp();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [staffCopied, setStaffCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // WhatsApp Mode: 'BULK' or 'SINGLE'
  const [sendMode, setSendMode] = useState('BULK');
  const [selectedStudentId, setSelectedStudentId] = useState('');

  // Staff Passcode (Stored in localStorage or default '1234')
  const [staffPasscode, setStaffPasscode] = useState(
    localStorage.getItem('staff_passcode') || '1234'
  );

  const parentAppLink = "https://studentreport.cxjeeneet.com/#/parent";
  const staffWebLink = "https://studentreport.cxjeeneet.com/#/staff";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(parentAppLink);
    setCopied(true);
    toast.success("Parents App link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyStaffInvite = () => {
    const inviteText = `Career Xone Staff Portal Access:\n🔗 Link: ${staffWebLink}\n🔑 Access Passcode: ${staffPasscode}`;
    navigator.clipboard.writeText(inviteText);
    setStaffCopied(true);
    toast.success("Staff Portal Invite copied to clipboard!");
    setTimeout(() => setStaffCopied(false), 2000);
  };

  const handleSaveStaffPasscode = (newCode) => {
    setStaffPasscode(newCode);
    localStorage.setItem('staff_passcode', newCode);
    toast.success("Staff Passcode updated!");
  };

  const handleDownloadQR = () => {
    const svg = document.getElementById("parent-app-qr");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width + 40;
      canvas.height = img.height + 40;
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 20, 20);
        const pngFile = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.download = "Parents_App_QR_CareerXone.png";
        downloadLink.href = pngFile;
        downloadLink.click();
        toast.success("QR Code downloaded!");
      }
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  // Handle Bulk Send
  const handleSendToAll = async () => {
    if (!students || students.length === 0) {
      toast.error("No students found to send the link!");
      return;
    }

    const confirmSend = window.confirm(
      `Are you sure you want to send the Parents App link via WhatsApp to ALL ${students.length} parents?`
    );
    
    if (confirmSend) {
      setIsSending(true);
      try {
        const studentIds = students.map(s => s.id);
        const message = `Dear Parent, please download our Institute's official Parents App to track your child's Attendance and Marks.\n\n📱 Download Link: ${parentAppLink}\n\nUser ID: {{parentPhone}}\nPassword: {{password}}`;
        await sendBulkManualSMS(studentIds, message);
        toast.success(`WhatsApp blast queued for ${students.length} parents!`);
      } catch (error) {
        toast.error("Failed to send links.");
        console.error(error);
      } finally {
        setIsSending(false);
      }
    }
  };

  // Handle Single Student Send
  const handleSendToSingle = async () => {
    const student = students.find(s => s.id === selectedStudentId);
    if (!student) {
      toast.error("Please select a student first!");
      return;
    }

    setIsSending(true);
    try {
      const instName = user?.instituteName || 'Career Xone Pro';
      const message = `Dear Parent (${student.name}), please download our Institute's official Parents App to track your child's Attendance and Marks.\n\n📱 Download Link: ${parentAppLink}\n\nUser ID: ${student.parentPhone}\nPassword: ${student.parentPasswordPlain || '123456'}\n- ${instName}`;
      
      await sendManualSMS(student.id, message, 'custom');
      toast.success(`App link sent to ${student.name}'s parent via WhatsApp!`);
    } catch (error) {
      toast.error("Failed to send SMS.");
    } finally {
      setIsSending(false);
    }
  };

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '28px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Share & Distribute Apps
          </h1>
          <span style={{
            background: 'linear-gradient(135deg, #2563eb15, #7c3aed15)',
            color: 'var(--accent-blue)',
            border: '1px solid rgba(37, 99, 235, 0.2)',
            padding: '2px 10px',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: 600
          }}>
            Parents & Staff Portals
          </span>
        </div>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
          Share Parents Mobile App with parents or give Staff Attendance Web Portal access to your staff.
        </p>
      </motion.div>

      {/* Grid Container */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '24px'
      }}>
        {/* Card 1: QR Code Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="glass-card"
          style={{
            padding: '28px',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center'
          }}
        >
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(37,99,235,0.1), rgba(99,102,241,0.1))',
            color: 'var(--accent-blue)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            <Smartphone size={26} />
          </div>

          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Parents App — Scan to Download
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginBottom: '20px', maxWidth: '300px' }}>
            Parents can scan this QR code with their mobile camera to instantly install the app.
          </p>

          <div style={{
            padding: '16px',
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid rgba(0,0,0,0.06)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
            marginBottom: '20px'
          }}>
            <QRCodeSVG id="parent-app-qr" value={parentAppLink} size={180} level="H" includeMargin={true} />
          </div>

          <button
            onClick={handleDownloadQR}
            className="btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 18px',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: '16px'
            }}
          >
            <Download size={16} />
            Download QR PNG
          </button>

          <div style={{
            background: 'rgba(37, 99, 235, 0.06)',
            border: '1px solid rgba(37, 99, 235, 0.15)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 14px',
            fontSize: '0.78rem',
            color: 'var(--accent-blue)',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Sparkles size={14} />
            Tip: Print this QR code and paste it on your notice board
          </div>
        </motion.div>

        {/* Card 2: WhatsApp Share (Bulk vs Separate Mode) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="glass-card"
          style={{
            padding: '28px',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          {/* Direct Link */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: 'rgba(124, 58, 237, 0.1)', color: 'var(--accent-purple)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <LinkIcon size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Direct Parents App Link
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                  Copy this link to share manually anywhere.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
              <input
                type="text"
                readOnly
                value={parentAppLink}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  outline: 'none',
                  fontFamily: 'monospace'
                }}
              />
              <button
                onClick={handleCopyLink}
                style={{
                  padding: '9px 16px',
                  background: copied ? 'var(--accent-green)' : 'var(--accent-blue)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div style={{ height: '1px', background: 'var(--border-color-light)', margin: '8px 0 16px' }} />

          {/* WhatsApp Mode Toggle */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={18} color="var(--accent-green)" />
                Send via WhatsApp
              </h3>

              {/* Toggle Buttons: Bulk vs Separate */}
              <div style={{
                display: 'flex', background: 'rgba(0,0,0,0.05)',
                padding: '3px', borderRadius: '10px', gap: '2px'
              }}>
                <button
                  onClick={() => setSendMode('BULK')}
                  style={{
                    padding: '4px 10px', borderRadius: '8px', border: 'none',
                    fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                    background: sendMode === 'BULK' ? '#ffffff' : 'transparent',
                    color: sendMode === 'BULK' ? 'var(--accent-blue)' : 'var(--text-tertiary)',
                    boxShadow: sendMode === 'BULK' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  <Users size={12} style={{ display: 'inline', marginRight: 4 }} />
                  Bulk (All)
                </button>
                <button
                  onClick={() => setSendMode('SINGLE')}
                  style={{
                    padding: '4px 10px', borderRadius: '8px', border: 'none',
                    fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                    background: sendMode === 'SINGLE' ? '#ffffff' : 'transparent',
                    color: sendMode === 'SINGLE' ? 'var(--accent-blue)' : 'var(--text-tertiary)',
                    boxShadow: sendMode === 'SINGLE' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  <User size={12} style={{ display: 'inline', marginRight: 4 }} />
                  Separate (Single)
                </button>
              </div>
            </div>

            {/* BULK MODE */}
            {sendMode === 'BULK' ? (
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '12px' }}>
                  Send Parents App download link + credentials to all <strong>{students?.length || 0}</strong> registered parents.
                </p>

                <div style={{
                  background: 'rgba(5, 150, 105, 0.04)',
                  border: '1px solid rgba(5, 150, 105, 0.15)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  marginBottom: '14px'
                }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-green)', display: 'block', marginBottom: '2px' }}>
                    BULK MESSAGE PREVIEW:
                  </span>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4, fontStyle: 'italic' }}>
                    "Dear Parent, please download our Institute's official Parents App... Link: {parentAppLink}"
                  </p>
                </div>

                <button
                  onClick={handleSendToAll}
                  disabled={isSending || !students || students.length === 0}
                  style={{
                    width: '100%', padding: '11px 18px',
                    background: isSending || !students || students.length === 0 ? '#94a3b8' : 'linear-gradient(135deg, #059669, #10b981)',
                    color: '#ffffff', border: 'none', borderRadius: 'var(--radius-md)',
                    fontSize: '0.88rem', fontWeight: 600,
                    cursor: isSending || !students || students.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    boxShadow: isSending ? 'none' : '0 4px 14px rgba(5, 150, 105, 0.35)'
                  }}
                >
                  <Send size={16} />
                  <span>{isSending ? 'Sending...' : `Send Bulk WhatsApp Blast to ${students?.length || 0} Parents`}</span>
                </button>
              </div>
            ) : (
              /* SEPARATE MODE */
              <div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '10px' }}>
                  Select a student to send their parent a personalized App link via WhatsApp.
                </p>

                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px',
                    borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)', fontSize: '0.85rem', fontWeight: 500,
                    color: 'var(--text-primary)', outline: 'none', marginBottom: '12px'
                  }}
                >
                  <option value="">-- Select Student --</option>
                  {(students || []).map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Roll: {s.rollNo || 'N/A'}) — Parent: {s.parentPhone}
                    </option>
                  ))}
                </select>

                {selectedStudent && (
                  <div style={{
                    background: 'rgba(37, 99, 235, 0.04)',
                    border: '1px solid rgba(37, 99, 235, 0.15)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    marginBottom: '14px'
                  }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-blue)', display: 'block', marginBottom: '2px' }}>
                      INDIVIDUAL PREVIEW FOR {selectedStudent.name.toUpperCase()}:
                    </span>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, fontStyle: 'italic' }}>
                      "Dear Parent ({selectedStudent.name}), download Parents App... User ID: {selectedStudent.parentPhone}, Password: {selectedStudent.parentPasswordPlain || '123456'}"
                    </p>
                  </div>
                )}

                <button
                  onClick={handleSendToSingle}
                  disabled={isSending || !selectedStudentId}
                  style={{
                    width: '100%', padding: '11px 18px',
                    background: isSending || !selectedStudentId ? '#94a3b8' : 'linear-gradient(135deg, #2563eb, #3b82f6)',
                    color: '#ffffff', border: 'none', borderRadius: 'var(--radius-md)',
                    fontSize: '0.88rem', fontWeight: 600,
                    cursor: isSending || !selectedStudentId ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    boxShadow: isSending || !selectedStudentId ? 'none' : '0 4px 14px rgba(37, 99, 235, 0.35)'
                  }}
                >
                  <Send size={16} />
                  <span>{isSending ? 'Sending...' : `Send Link to ${selectedStudent?.name || 'Selected Student'}`}</span>
                </button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Card 3: Staff Web App Access Portal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="glass-card"
          style={{
            padding: '28px',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gridColumn: 'span 1'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.1)', color: '#10b981',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <UserCheck size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Staff Attendance Web App
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                  Give staff members web access to mark manual attendance on mobile/laptop.
                </p>
              </div>
            </div>

            {/* Staff Link */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>
                STAFF WEB APP URL:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  readOnly
                  value={staffWebLink}
                  style={{
                    flex: 1, padding: '9px 12px', background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)',
                    fontSize: '0.8rem', color: 'var(--text-secondary)', outline: 'none', fontFamily: 'monospace'
                  }}
                />
              </div>
            </div>

            {/* Staff Passcode */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>
                STAFF ACCESS PASSCODE:
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Key size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={staffPasscode}
                    onChange={(e) => handleSaveStaffPasscode(e.target.value)}
                    placeholder="Enter 4-digit passcode"
                    maxLength={10}
                    style={{
                      width: '100%', padding: '9px 12px 9px 32px',
                      background: '#ffffff', border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)', fontSize: '0.85rem',
                      fontWeight: 700, color: 'var(--accent-purple)', outline: 'none',
                      letterSpacing: '1px'
                    }}
                  />
                </div>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Editable</span>
              </div>
            </div>

            {/* Staff Invite Box Preview */}
            <div style={{
              background: 'rgba(124, 58, 237, 0.04)',
              border: '1px solid rgba(124, 58, 237, 0.15)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              marginBottom: '16px'
            }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-purple)', display: 'block', marginBottom: '2px' }}>
                STAFF INVITE MESSAGE PREVIEW:
              </span>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, fontFamily: 'monospace' }}>
                Link: {staffWebLink}<br />
                Passcode: {staffPasscode}
              </p>
            </div>
          </div>

          <button
            onClick={handleCopyStaffInvite}
            style={{
              width: '100%', padding: '11px 18px',
              background: staffCopied ? 'var(--accent-green)' : 'linear-gradient(135deg, #7c3aed, #6366f1)',
              color: '#ffffff', border: 'none', borderRadius: 'var(--radius-md)',
              fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)'
            }}
          >
            {staffCopied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
            <span>{staffCopied ? 'Invite Copied!' : 'Copy Staff App Invite & Passcode'}</span>
          </button>
        </motion.div>
      </div>
    </div>
  );
}


