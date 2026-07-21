import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Smartphone, Link as LinkIcon, MessageSquare, Copy, CheckCircle2, Download, Send, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ShareApp() {
  const { students, sendBulkManualSMS } = useApp();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const appLink = "https://expo.dev/accounts/myrentalaap/projects/career-xone-parent/builds/b719907b-68c3-4f54-b987-43b203a4fe81";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(appLink);
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
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

  const handleSendToAll = async () => {
    if (!students || students.length === 0) {
      toast.error("No students found to send the link!");
      return;
    }

    const confirmSend = window.confirm(
      `Are you sure you want to send the Parents App link via WhatsApp to all ${students.length} parents?`
    );
    
    if (confirmSend) {
      setIsSending(true);
      try {
        const studentIds = students.map(s => s.id);
        const message = `Dear Parent, please download our Institute's official Parents App to track your child's Attendance and Marks.\n\n📱 Download Link: ${appLink}\n\nUser ID: {{parentPhone}}\nPassword: {{password}}`;
        await sendBulkManualSMS(studentIds, message);
        toast.success(`WhatsApp blast initiated for ${students.length} parents!`);
      } catch (error) {
        toast.error("Failed to send links.");
        console.error(error);
      } finally {
        setIsSending(false);
      }
    }
  };

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
            Share Parents App
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
            Official App Link
          </span>
        </div>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
          Distribute your branded Parents App to parents via QR Code, Direct Link, or Automated WhatsApp Blast.
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
            Scan to Download
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginBottom: '20px', maxWidth: '300px' }}>
            Parents can scan this QR code with their mobile phone camera to instantly open and install the app.
          </p>

          <div style={{
            padding: '16px',
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid rgba(0,0,0,0.06)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
            marginBottom: '20px'
          }}>
            <QRCodeSVG id="parent-app-qr" value={appLink} size={190} level="H" includeMargin={true} />
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
            Tip: Print this QR code and paste it on your institute notice board
          </div>
        </motion.div>

        {/* Card 2: Direct Link & WhatsApp Blast */}
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
          {/* Section 1: Copy Link */}
          <div style={{ marginBottom: '24px' }}>
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
                  Direct App Link
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                  Copy this link to share manually anywhere.
                </p>
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '8px',
              marginTop: '12px'
            }}>
              <input
                type="text"
                readOnly
                value={appLink}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  outline: 'none',
                  fontFamily: 'monospace'
                }}
              />
              <button
                onClick={handleCopyLink}
                style={{
                  padding: '10px 18px',
                  background: copied ? 'var(--accent-green)' : 'var(--accent-blue)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                  flexShrink: 0
                }}
              >
                {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div style={{ height: '1px', background: 'var(--border-color-light)', margin: '12px 0 24px' }} />

          {/* Section 2: WhatsApp Blast */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: 'rgba(5, 150, 105, 0.1)', color: 'var(--accent-green)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <MessageSquare size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  WhatsApp Blast to All Parents
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                  Send app download link to all <strong>{students?.length || 0}</strong> registered parents.
                </p>
              </div>
            </div>

            {/* Message Preview Box */}
            <div style={{
              background: 'rgba(5, 150, 105, 0.04)',
              border: '1px solid rgba(5, 150, 105, 0.15)',
              borderRadius: 'var(--radius-md)',
              padding: '14px',
              margin: '14px 0 18px'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-green)', display: 'block', marginBottom: '4px' }}>
                MESSAGE PREVIEW:
              </span>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, fontStyle: 'italic' }}>
                "Dear Parent, please download our Institute's official Parents App to track your child's Attendance and Marks... Link: {appLink}"
              </p>
            </div>

            <button
              onClick={handleSendToAll}
              disabled={isSending || !students || students.length === 0}
              style={{
                width: '100%',
                padding: '12px 20px',
                background: isSending || !students || students.length === 0 
                  ? '#94a3b8' 
                  : 'linear-gradient(135deg, #059669, #10b981)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.92rem',
                fontWeight: 600,
                cursor: isSending || !students || students.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: isSending ? 'none' : '0 4px 14px rgba(5, 150, 105, 0.35)',
                transition: 'all 0.2s ease'
              }}
            >
              <Send size={18} />
              <span>{isSending ? 'Sending to all parents...' : `Send WhatsApp Blast to ${students?.length || 0} Parents`}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

