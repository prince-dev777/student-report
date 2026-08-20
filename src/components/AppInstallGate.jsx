import React, { useState, useEffect } from 'react';
import { 
  Smartphone, Download, ArrowRight, Share, PlusSquare, 
  CheckCircle2, Sparkles, ShieldCheck, Zap, Bell, Globe, AlertCircle, X
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AppInstallGate({
  appName = "Parents Official Mobile App",
  appSubtitle = "Official Institute Student Analytics & Attendance App",
  appType = "parent", // 'parent' | 'teacher' | 'staff' | 'inquiry'
  themeGradient = "linear-gradient(135deg, #0284c7 0%, #0369a1 40%, #0f172a 100%)",
  themeColor = "#0284c7",
  badgeText = "Official Mobile App",
  badgeBg = "rgba(2, 132, 199, 0.15)",
  badgeColor = "#38bdf8",
  features = [
    { title: "Instant Attendance Alerts", desc: "Live real-time Biometric In/Out punch notifications on lock screen." },
    { title: "OMR Exam Results & Marksheets", desc: "Instant test report cards, rank trajectories, and subject percentiles." },
    { title: "1-Tap Fast Launch", desc: "Launches full-screen from phone home screen with zero browser URL bars." }
  ],
  onContinueToWeb
}) {
  const [deferredPrompt, setDeferredPrompt] = useState(() => window.deferredPrompt || null);
  const [isStandalone, setIsStandalone] = useState(() => {
    if (typeof window === 'undefined') return false;
    const isApp = window.matchMedia('(display-mode: standalone)').matches || 
                  window.navigator.standalone === true ||
                  window.location.search.includes('source=pwa') ||
                  window.location.search.includes('standalone=1') ||
                  window.location.search.includes('installed=1');
    return isApp;
  });
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isWhatsApp = typeof navigator !== 'undefined' && /WhatsApp/i.test(navigator.userAgent);
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

  const instituteName = localStorage.getItem('institute_name') || 'CAREER XONE';
  const instituteLogo = localStorage.getItem('institute_logo') || localStorage.getItem('logo') || '/logo.png';

  useEffect(() => {
    if (window.deferredPrompt) {
      setDeferredPrompt(window.deferredPrompt);
    }

    const handlePromptReady = (e) => {
      if (e && e.detail) {
        setDeferredPrompt(e.detail);
        window.deferredPrompt = e.detail;
      }
    };

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      window.deferredPrompt = e;
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setShowIOSModal(false);
      setDeferredPrompt(null);
      window.deferredPrompt = null;
      toast.success(`🎉 ${appName} successfully installed! Opening login...`);
      if (onContinueToWeb) onContinueToWeb();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('pwa-prompt-ready', handlePromptReady);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('pwa-prompt-ready', handlePromptReady);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [appType, appName, onContinueToWeb]);

  const handleTriggerInstall = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    const promptEvent = deferredPrompt || window.deferredPrompt;
    if (promptEvent) {
      try {
        setIsInstalling(true);
        await promptEvent.prompt();
        const choiceResult = await promptEvent.userChoice;
        if (choiceResult && choiceResult.outcome === 'accepted') {
          setIsStandalone(true);
          setDeferredPrompt(null);
          window.deferredPrompt = null;
          toast.success(`🎉 ${appName} added to Home Screen!`);
          if (onContinueToWeb) onContinueToWeb();
        }
      } catch (err) {
        console.warn('PWA install prompt error:', err);
        setShowIOSModal(true);
      } finally {
        setIsInstalling(false);
      }
    } else {
      setShowIOSModal(true);
    }
  };

  const handleOpenInChrome = () => {
    const currentUrl = window.location.href;
    if (isAndroid) {
      const cleanUrl = currentUrl.replace(/^https?:\/\//, '');
      window.location.href = `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end`;
    } else {
      navigator.clipboard.writeText(currentUrl);
      toast.success('📋 Link copied! Paste into Google Chrome.');
    }
  };

  // If running inside standalone installed app, automatically trigger onContinueToWeb
  useEffect(() => {
    if (isStandalone && onContinueToWeb) {
      onContinueToWeb();
    }
  }, [isStandalone, onContinueToWeb]);

  return (
    <div style={{
      minHeight: '100vh',
      background: themeGradient,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif",
      color: '#f8fafc',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* Ambient Lighting */}
      <div style={{
        position: 'absolute', top: '-120px', right: '-120px', width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(0,0,0,0) 70%)',
        borderRadius: '50%', pointerEvents: 'none'
      }} />

      <div style={{
        background: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(20px)',
        borderRadius: '28px',
        padding: '32px 24px',
        width: '100%',
        maxWidth: '440px',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.8)',
        color: '#0f172a',
        textAlign: 'center'
      }}>
        {/* Institute & App Header */}
        <div style={{
          width: '76px',
          height: '76px',
          borderRadius: '22px',
          background: '#ffffff',
          margin: '0 auto 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
          border: '2px solid #e2e8f0',
          padding: '4px'
        }}>
          <img 
            src={instituteLogo} 
            alt="Logo" 
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          background: badgeBg, color: badgeColor,
          padding: '4px 12px', borderRadius: '50px',
          fontSize: '0.75rem', fontWeight: 800, marginBottom: '10px'
        }}>
          <Sparkles size={13} /> {badgeText}
        </div>

        <h1 style={{
          margin: '0 0 6px',
          fontSize: '1.45rem',
          fontWeight: 900,
          color: '#0f172a',
          letterSpacing: '-0.5px'
        }}>
          {appName}
        </h1>
        <p style={{ margin: '0 0 22px', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.4, fontWeight: 500 }}>
          {appSubtitle}
        </p>

        {/* WhatsApp Browser Warning & 1-Tap Switch */}
        {isWhatsApp && (
          <div style={{
            background: '#fef3c7',
            border: '1.5px solid #fde68a',
            borderRadius: '14px',
            padding: '12px',
            textAlign: 'left',
            marginBottom: '18px'
          }}>
            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#92400e', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={15} color="#b45309" /> WhatsApp Browser Detected:
            </div>
            <p style={{ margin: '0 0 8px 0', fontSize: '0.72rem', color: '#78350f', lineHeight: 1.35 }}>
              Phone me official App install karne ke liye Google Chrome me open karein:
            </p>
            <button
              type="button"
              onClick={handleOpenInChrome}
              style={{
                width: '100%',
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                padding: '8px 12px',
                borderRadius: '10px',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              🚀 Open in Google Chrome to Install
            </button>
          </div>
        )}

        {/* Feature Benefits List */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '18px',
          padding: '16px',
          textAlign: 'left',
          marginBottom: '22px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {features.map((feat, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%',
                background: `${themeColor}15`, color: themeColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: '2px'
              }}>
                <CheckCircle2 size={15} />
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '0.82rem', color: '#1e293b', lineHeight: 1.3 }}>
                  {feat.title}
                </strong>
                <span style={{ fontSize: '0.74rem', color: '#64748b', lineHeight: 1.35, display: 'block' }}>
                  {feat.desc}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Primary Action: INSTALL APP BUTTON */}
        <button
          type="button"
          onClick={handleTriggerInstall}
          disabled={isInstalling}
          style={{
            width: '100%',
            background: `linear-gradient(135deg, ${themeColor}, #0f172a)`,
            color: '#ffffff',
            border: 'none',
            padding: '15px 20px',
            borderRadius: '16px',
            fontSize: '1rem',
            fontWeight: 800,
            cursor: isInstalling ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: `0 8px 24px ${themeColor}50`,
            transition: 'all 0.2s ease'
          }}
        >
          <Download size={20} />
          <span>{isInstalling ? 'Preparing App...' : '📲 Install App to Home Screen'}</span>
        </button>

        {/* Secondary Action: If already installed or wanting to open directly */}
        <button
          type="button"
          onClick={() => {
            setIsStandalone(true);
            if (onContinueToWeb) onContinueToWeb();
          }}
          style={{
            width: '100%',
            background: 'transparent',
            color: '#64748b',
            border: '1px solid #cbd5e1',
            padding: '11px 16px',
            borderRadius: '14px',
            fontSize: '0.84rem',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            marginTop: '10px'
          }}
        >
          <ArrowRight size={16} />
          <span>Already Installed? Open Portal</span>
        </button>

        <p style={{ margin: '12px 0 0', fontSize: '0.74rem', color: '#94a3b8', fontWeight: 600 }}>
          🔒 To access your student portal, install and open from your Phone Home Screen.
        </p>
      </div>

      {/* iOS / Fallback Visual Guide Modal */}
      {showIOSModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          backdropFilter: 'blur(6px)'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '24px',
            padding: '26px 20px',
            maxWidth: '380px',
            width: '100%',
            boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
            color: '#1e293b',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowIOSModal(false)}
              style={{ position: 'absolute', right: '16px', top: '16px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '12px',
                background: `${themeColor}15`, color: themeColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Smartphone size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                  Install on Phone
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  3 easy steps to add App icon
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.82rem', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#f8fafc', padding: '10px 12px', borderRadius: '12px' }}>
                <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: themeColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>
                  1
                </div>
                <div>
                  Tap browser menu <strong>(⋮)</strong> or Share button <strong>(<Share size={13} style={{ display: 'inline' }} />)</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#f8fafc', padding: '10px 12px', borderRadius: '12px' }}>
                <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: themeColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>
                  2
                </div>
                <div>
                  Select <strong>"Add to Home Screen" <PlusSquare size={13} style={{ display: 'inline' }} /></strong> or <strong>"Install App"</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: '#f8fafc', padding: '10px 12px', borderRadius: '12px' }}>
                <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: themeColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>
                  3
                </div>
                <div>
                  Tap <strong>Add</strong> and then launch the App from your phone home screen!
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowIOSModal(false);
                  if (onContinueToWeb) onContinueToWeb();
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: themeColor,
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <span>Proceed to Login Portal</span>
                <ArrowRight size={16} />
              </button>

              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: 'transparent',
                  color: '#64748b',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
