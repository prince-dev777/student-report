import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X, Share, PlusSquare, Check } from 'lucide-react';

export default function PWAInstallPrompt({ appName = "Career Xone App" }) {
  const [deferredPrompt, setDeferredPrompt] = useState(() => window.deferredPrompt || null);
  const [showBanner, setShowBanner] = useState(true);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already in standalone mode (installed)
    const isApp = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    setIsStandalone(isApp);
    if (isApp) {
      setShowBanner(false);
      return;
    }

    // Check if iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(ios);

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
      setShowBanner(true);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setShowBanner(false);
      setShowIOSModal(false);
      setDeferredPrompt(null);
      window.deferredPrompt = null;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('pwa-prompt-ready', handlePromptReady);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('pwa-prompt-ready', handlePromptReady);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    const promptEvent = deferredPrompt || window.deferredPrompt;
    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choiceResult = await promptEvent.userChoice;
        if (choiceResult && choiceResult.outcome === 'accepted') {
          setShowBanner(false);
          setIsStandalone(true);
        }
        setDeferredPrompt(null);
        window.deferredPrompt = null;
      } catch (err) {
        console.warn('PWA install error:', err);
        setShowIOSModal(true);
      }
    } else {
      // Fallback instructions modal
      setShowIOSModal(true);
    }
  };

  if (isStandalone || !showBanner) return null;

  return (
    <>
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #2563eb 100%)',
        color: '#ffffff',
        padding: '8px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        fontSize: '0.80rem',
        boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.3)',
        position: 'sticky',
        top: 0,
        zIndex: 999,
        borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
        backdropFilter: 'blur(8px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.3)'
          }}>
            <Smartphone size={15} color="#ffffff" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '0.80rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{appName}</span>
              <span style={{ fontSize: '0.66rem', background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: '10px', fontWeight: 700 }}>1-Tap App</span>
            </div>
            <div style={{ fontSize: '0.70rem', opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Add to home screen for fast direct access
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <button
            onClick={handleInstallClick}
            style={{
              background: '#ffffff',
              color: '#1e3a8a',
              border: 'none',
              borderRadius: '20px',
              padding: '5px 12px',
              fontSize: '0.75rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
              transition: 'transform 0.15s ease'
            }}
          >
            <Download size={13} />
            <span>Install</span>
          </button>
          <button
            onClick={() => setShowBanner(false)}
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: 'none',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              color: 'rgba(255, 255, 255, 0.85)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0
            }}
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* iOS / Fallback Installation Modal */}
      {showIOSModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '380px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            color: '#1e293b'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1e3a8a' }}>
                📲 Install on your Phone
              </h3>
              <button
                onClick={() => setShowIOSModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.5, marginBottom: '16px' }}>
              To install <strong>{appName}</strong> on your mobile home screen:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.82rem', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  1
                </div>
                <div>
                  Tap the browser menu <strong>(⋮)</strong> or Share button <strong>(<Share size={13} style={{ display: 'inline' }} />)</strong>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  2
                </div>
                <div>
                  Scroll down & select <strong>"Add to Home Screen" <PlusSquare size={13} style={{ display: 'inline' }} /></strong> or <strong>"Install App"</strong>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  3
                </div>
                <div>
                  Tap <strong>Add / Install</strong> to open it anytime from your phone!
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              style={{
                width: '100%',
                padding: '10px',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer'
              }}
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
