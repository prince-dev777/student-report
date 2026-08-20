import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { 
  Smartphone, Link as LinkIcon, MessageSquare, Copy, CheckCircle2, 
  Download, Send, Sparkles, UserCheck, Key, User, Users, Search, X 
} from 'lucide-react';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

export default function ShareApp() {
  const { students, sendBulkManualSMS, sendManualSMS } = useApp();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [staffCopied, setStaffCopied] = useState(false);
  const [teacherCopied, setTeacherCopied] = useState(false);
  const [inquiryCopied, setInquiryCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // WhatsApp Mode: 'BULK' or 'SINGLE'
  const [sendMode, setSendMode] = useState('BULK');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  const selectedStudent = React.useMemo(() => {
    return (students || []).find(s => s.id === selectedStudentId) || null;
  }, [students, selectedStudentId]);

  const filteredStudents = React.useMemo(() => {
    if (!students) return [];
    const q = studentSearchQuery.toLowerCase().trim();
    if (!q) return students;
    return students.filter(s => 
      (s.name || '').toLowerCase().includes(q) ||
      String(s.rollNo || '').toLowerCase().includes(q) ||
      String(s.parentPhone || '').includes(q) ||
      String(s.batch || '').toLowerCase().includes(q)
    );
  }, [students, studentSearchQuery]);

  // Independent Passcodes
  const [staffPasscode, setStaffPasscode] = useState(
    localStorage.getItem('staff_passcode') || '1234'
  );
  const [teacherPasscode, setTeacherPasscode] = useState(
    localStorage.getItem('teacher_passcode') || '1234'
  );
  const [inquiryPasscode, setInquiryPasscode] = useState(
    localStorage.getItem('inquiry_passcode') || '1234'
  );

  // Fetch from server settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await api.getSettings();
        if (settings) {
          if (settings.staffPasscode) {
            setStaffPasscode(settings.staffPasscode);
            localStorage.setItem('staff_passcode', settings.staffPasscode);
          }
          if (settings.teacherPasscode) {
            setTeacherPasscode(settings.teacherPasscode);
            localStorage.setItem('teacher_passcode', settings.teacherPasscode);
          }
          if (settings.inquiryPasscode) {
            setInquiryPasscode(settings.inquiryPasscode);
            localStorage.setItem('inquiry_passcode', settings.inquiryPasscode);
          }
        }
      } catch (err) {
        console.warn('Failed to load remote settings, using local passcodes:', err);
      }
    };
    loadSettings();
  }, []);

  const parentAppLink = "https://studentreport.cxjeeneet.com/?app=parent#/parent";
  const staffWebLink = "https://studentreport.cxjeeneet.com/?app=staff#/staff";
  const teacherWebLink = "https://studentreport.cxjeeneet.com/?app=teacher#/teacher";
  const inquiryWebLink = "https://studentreport.cxjeeneet.com/?app=inquiry#/inquiry";

  const [copiedParentUrl, setCopiedParentUrl] = useState(false);
  const [copiedStaffUrl, setCopiedStaffUrl] = useState(false);
  const [copiedTeacherUrl, setCopiedTeacherUrl] = useState(false);
  const [copiedInquiryUrl, setCopiedInquiryUrl] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(parentAppLink);
    setCopied(true);
    setCopiedParentUrl(true);
    toast.success("Parents App link copied!");
    setTimeout(() => {
      setCopied(false);
      setCopiedParentUrl(false);
    }, 2000);
  };

  const handleCopyStaffInvite = () => {
    const inviteText = `Career Xone Staff Attendance Portal Access:\n🔗 Link: ${staffWebLink}\n🔑 Access Passcode: ${staffPasscode}`;
    navigator.clipboard.writeText(inviteText);
    setStaffCopied(true);
    toast.success("Staff Portal Invite copied to clipboard!");
    setTimeout(() => setStaffCopied(false), 2000);
  };

  const handleCopyTeacherInvite = () => {
    const inviteText = `Career Xone Teacher & Faculty Portal Access:\n🔗 Link: ${teacherWebLink}\n🔑 Access Passcode: ${teacherPasscode}`;
    navigator.clipboard.writeText(inviteText);
    setTeacherCopied(true);
    toast.success("Teacher Portal Invite copied to clipboard!");
    setTimeout(() => setTeacherCopied(false), 2000);
  };

  const handleCopyInquiryInvite = () => {
    const inviteText = `Career Xone Front-Desk Inquiry Desk Access:\n🔗 Link: ${inquiryWebLink}\n🔑 Access Passcode: ${inquiryPasscode}`;
    navigator.clipboard.writeText(inviteText);
    setInquiryCopied(true);
    toast.success("Inquiry Desk Invite copied to clipboard!");
    setTimeout(() => setInquiryCopied(false), 2000);
  };

  const handleSaveStaffPasscode = async (newCode) => {
    setStaffPasscode(newCode);
    localStorage.setItem('staff_passcode', newCode);
    try {
      await api.updateSettings({ staffPasscode: newCode });
    } catch (e) {}
    toast.success("Staff Passcode updated!");
  };

  const handleSaveTeacherPasscode = async (newCode) => {
    setTeacherPasscode(newCode);
    localStorage.setItem('teacher_passcode', newCode);
    try {
      await api.updateSettings({ teacherPasscode: newCode });
    } catch (e) {}
    toast.success("Teacher Passcode updated!");
  };

  const handleSaveInquiryPasscode = async (newCode) => {
    setInquiryPasscode(newCode);
    localStorage.setItem('inquiry_passcode', newCode);
    try {
      await api.updateSettings({ inquiryPasscode: newCode });
    } catch (e) {}
    toast.success("Inquiry Passcode updated!");
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
      
      await sendManualSMS(student.id, message);
      toast.success(`App link sent to ${student.name}'s parent via WhatsApp!`);
    } catch (error) {
      toast.error("Failed to send SMS.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '24px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Share & Distribute Portals
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
            Parents, Teachers & Staff
          </span>
        </div>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
          Distribute web portals and customize independent security passcodes for your staff and faculty.
        </p>
      </motion.div>

      {/* Grid Container */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '20px'
      }}>

        {/* Card 1: Parents App Share (Bulk vs Separate Mode) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="glass-card"
          style={{
            padding: '24px',
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
          <div style={{ marginBottom: '18px' }}>
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
                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                  Search and select a student to send their parent a personalized App link via WhatsApp.
                </p>

                {/* Search Student Input */}
                <div style={{ position: 'relative', marginBottom: '8px' }}>
                  <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    placeholder="Search student by Name, Roll No, Phone..."
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 28px 8px 32px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-primary)',
                      fontSize: '0.82rem',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  {studentSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setStudentSearchQuery('')}
                      style={{
                        position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px', display: 'flex'
                      }}
                      title="Clear Search"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

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
                  <option value="">
                    {filteredStudents.length === 0 ? '-- No students match search --' : `-- Select Student (${filteredStudents.length} available) --`}
                  </option>
                  {filteredStudents.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Roll: {s.rollNo || 'N/A'}) — 📞 {s.parentPhone}
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

        {/* Card 2: Staff Attendance Web App */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="glass-card"
          style={{
            padding: '24px',
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
            <div style={{ marginBottom: '14px' }}>
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
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(staffWebLink);
                    setCopiedStaffUrl(true);
                    toast.success('Staff Web App URL copied!');
                    setTimeout(() => setCopiedStaffUrl(false), 2000);
                  }}
                  style={{
                    padding: '8px 16px', fontSize: '0.82rem', fontWeight: 600,
                    background: copiedStaffUrl ? 'var(--accent-green)' : 'linear-gradient(135deg, #7c3aed, #6366f1)',
                    border: 'none', borderRadius: 'var(--radius-md)', color: '#fff', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '6px'
                  }}
                  title="Copy Staff App URL"
                >
                  {copiedStaffUrl ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                  <span>{copiedStaffUrl ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Staff Passcode Input */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                STAFF ACCESS PASSCODE:
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Key size={14} color="#7c3aed" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={staffPasscode}
                    onChange={(e) => handleSaveStaffPasscode(e.target.value)}
                    placeholder="Set Staff Passcode"
                    maxLength={10}
                    style={{
                      width: '100%', padding: '9px 12px 9px 32px',
                      background: '#ffffff', border: '1.5px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)', fontSize: '0.88rem',
                      fontWeight: 700, color: 'var(--accent-purple)', outline: 'none',
                      letterSpacing: '1px'
                    }}
                  />
                </div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Auto-Saved</span>
              </div>
            </div>

            {/* Staff Invite Box Preview */}
            <div style={{
              background: 'rgba(124, 58, 237, 0.04)',
              border: '1px solid rgba(124, 58, 237, 0.15)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              marginBottom: '14px'
            }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-purple)', display: 'block', marginBottom: '2px' }}>
                STAFF INVITE PREVIEW:
              </span>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, fontFamily: 'monospace', margin: 0 }}>
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
            <span>{staffCopied ? 'Invite Copied!' : 'Copy Staff Invite & Passcode'}</span>
          </button>
        </motion.div>

        {/* Card 3: Teacher & Faculty Portal Web App */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="glass-card"
          style={{
            padding: '24px',
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
                background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Sparkles size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Teacher & Faculty Portal Web App
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                  360° Student Dossier, Test Series Analytics, Rank Trajectory & Attendance.
                </p>
              </div>
            </div>

            {/* Teacher Link */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>
                TEACHER PORTAL URL:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  readOnly
                  value={teacherWebLink}
                  style={{
                    flex: 1, padding: '9px 12px', background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)',
                    fontSize: '0.8rem', color: 'var(--text-secondary)', outline: 'none', fontFamily: 'monospace'
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(teacherWebLink);
                    setCopiedTeacherUrl(true);
                    toast.success('Teacher Portal URL copied!');
                    setTimeout(() => setCopiedTeacherUrl(false), 2000);
                  }}
                  style={{
                    padding: '8px 16px', fontSize: '0.82rem', fontWeight: 600,
                    background: copiedTeacherUrl ? 'var(--accent-green)' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                    border: 'none', borderRadius: 'var(--radius-md)', color: '#fff', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '6px'
                  }}
                  title="Copy Teacher Portal URL"
                >
                  {copiedTeacherUrl ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                  <span>{copiedTeacherUrl ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Dedicated Teacher Passcode Input */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                TEACHER ACCESS PASSCODE:
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Key size={14} color="#2563eb" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={teacherPasscode}
                    onChange={(e) => handleSaveTeacherPasscode(e.target.value)}
                    placeholder="Set Teacher Passcode"
                    maxLength={10}
                    style={{
                      width: '100%', padding: '9px 12px 9px 32px',
                      background: '#ffffff', border: '1.5px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)', fontSize: '0.88rem',
                      fontWeight: 700, color: '#2563eb', outline: 'none',
                      letterSpacing: '1px'
                    }}
                  />
                </div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Auto-Saved</span>
              </div>
            </div>

            {/* Teacher Invite Box Preview */}
            <div style={{
              background: 'rgba(37, 99, 235, 0.04)',
              border: '1px solid rgba(37, 99, 235, 0.15)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              marginBottom: '14px'
            }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2563eb', display: 'block', marginBottom: '2px' }}>
                TEACHER INVITE PREVIEW:
              </span>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, fontFamily: 'monospace', margin: 0 }}>
                Link: {teacherWebLink}<br />
                Passcode: {teacherPasscode}
              </p>
            </div>
          </div>

          <button
            onClick={handleCopyTeacherInvite}
            style={{
              width: '100%', padding: '11px 18px',
              background: teacherCopied ? 'var(--accent-green)' : 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#ffffff', border: 'none', borderRadius: 'var(--radius-md)',
              fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)'
            }}
          >
            {teacherCopied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
            <span>{teacherCopied ? 'Invite Copied!' : 'Copy Teacher Invite & Passcode'}</span>
          </button>
        </motion.div>

        {/* Card 4: Front-Desk Inquiry Web App */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="glass-card"
          style={{
            padding: '24px',
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
                background: 'rgba(5, 150, 105, 0.1)', color: '#059669',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <MessageSquare size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Front-Desk Inquiry Web App
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                  Fast mobile inquiry entry for staff with real-time cloud-to-desktop sync.
                </p>
              </div>
            </div>

            {/* Inquiry Link */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>
                INQUIRY WEB APP URL:
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  readOnly
                  value={inquiryWebLink}
                  style={{
                    flex: 1, padding: '9px 12px', background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)',
                    fontSize: '0.8rem', color: 'var(--text-secondary)', outline: 'none', fontFamily: 'monospace'
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(inquiryWebLink);
                    setCopiedInquiryUrl(true);
                    toast.success('Inquiry Web App URL copied!');
                    setTimeout(() => setCopiedInquiryUrl(false), 2000);
                  }}
                  style={{
                    padding: '8px 16px', fontSize: '0.82rem', fontWeight: 600,
                    background: copiedInquiryUrl ? 'var(--accent-green)' : 'linear-gradient(135deg, #059669, #047857)',
                    border: 'none', borderRadius: 'var(--radius-md)', color: '#fff', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '6px'
                  }}
                  title="Copy Inquiry Portal URL"
                >
                  {copiedInquiryUrl ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                  <span>{copiedInquiryUrl ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Dedicated Inquiry Passcode Input */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                INQUIRY ACCESS PASSCODE:
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Key size={14} color="#059669" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={inquiryPasscode}
                    onChange={(e) => handleSaveInquiryPasscode(e.target.value)}
                    placeholder="Set Inquiry Passcode"
                    maxLength={10}
                    style={{
                      width: '100%', padding: '9px 12px 9px 32px',
                      background: '#ffffff', border: '1.5px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)', fontSize: '0.88rem',
                      fontWeight: 700, color: '#059669', outline: 'none',
                      letterSpacing: '1px'
                    }}
                  />
                </div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Auto-Saved</span>
              </div>
            </div>

            {/* Inquiry Invite Box Preview */}
            <div style={{
              background: 'rgba(5, 150, 105, 0.04)',
              border: '1px solid rgba(5, 150, 105, 0.15)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              marginBottom: '14px'
            }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669', display: 'block', marginBottom: '2px' }}>
                INQUIRY INVITE PREVIEW:
              </span>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, fontFamily: 'monospace', margin: 0 }}>
                Link: {inquiryWebLink}<br />
                Passcode: {inquiryPasscode}
              </p>
            </div>
          </div>

          <button
            onClick={handleCopyInquiryInvite}
            style={{
              width: '100%', padding: '11px 18px',
              background: inquiryCopied ? 'var(--accent-green)' : 'linear-gradient(135deg, #059669, #047857)',
              color: '#ffffff', border: 'none', borderRadius: 'var(--radius-md)',
              fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              boxShadow: '0 4px 14px rgba(5, 150, 105, 0.35)'
            }}
          >
            {inquiryCopied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
            <span>{inquiryCopied ? 'Invite Copied!' : 'Copy Inquiry Invite & Passcode'}</span>
          </button>
        </motion.div>
      </div>
    </div>
  );
}
