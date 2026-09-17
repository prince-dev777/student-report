import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, RefreshCw, ExternalLink, Copy, Check, Smartphone, 
  Tablet, Monitor, Globe, Laptop, Sparkles 
} from 'lucide-react';
import toast from 'react-hot-toast';

const LIVE_PORTAL_URL = 'https://studentreport.cxjeeneet.com/parent';
const LOCAL_PORTAL_URL = 'http://localhost:3000/parent';

export default function ParentPortalWeb() {
  const navigate = useNavigate();
  const iframeRef = useRef(null);

  // States
  const [targetEnv, setTargetEnv] = useState('live'); // 'live' | 'local'
  const [viewMode, setViewMode] = useState('mobile'); // 'mobile' | 'tablet' | 'desktop'
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const activeUrl = targetEnv === 'live' ? LIVE_PORTAL_URL : LOCAL_PORTAL_URL;

  const handleRefresh = () => {
    setIsLoading(true);
    setIframeKey((prev) => prev + 1);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(activeUrl);
    setCopied(true);
    toast.success('Parent Portal link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenExternal = () => {
    try {
      if (window.electronAPI?.openExternal) {
        window.electronAPI.openExternal(activeUrl);
      } else {
        window.open(activeUrl, '_blank', 'noopener,noreferrer');
      }
    } catch {
      window.open(activeUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Dimensions based on device selection
  const getContainerStyles = () => {
    if (viewMode === 'mobile') {
      return {
        width: '414px',
        height: '840px',
        maxHeight: 'calc(100vh - 120px)',
        borderRadius: '36px',
        border: '10px solid #1e293b',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255,255,255,0.1)',
        overflow: 'hidden',
        background: '#ffffff',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      };
    }
    if (viewMode === 'tablet') {
      return {
        width: '768px',
        height: '920px',
        maxHeight: 'calc(100vh - 120px)',
        borderRadius: '24px',
        border: '8px solid #334155',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        background: '#ffffff',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      };
    }
    return {
      width: '100%',
      height: 'calc(100vh - 80px)',
      borderRadius: '12px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
      overflow: 'hidden',
      background: '#ffffff',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    };
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      background: '#0f172a',
      color: '#f8fafc',
      overflow: 'hidden',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {/* Top Navigation & Controls Bar */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 20px',
        background: '#1e293b',
        borderBottom: '1px solid #334155',
        zIndex: 10,
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        {/* Left: Back & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#334155',
              border: '1px solid #475569',
              color: '#f8fafc',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            title="Go Back"
            onMouseEnter={(e) => (e.currentTarget.style.background = '#475569')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#334155')}
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 800, fontSize: '0.98rem', color: '#ffffff', letterSpacing: '-0.02em' }}>
                Parent Portal
              </span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.70rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '12px',
                background: targetEnv === 'live' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                color: targetEnv === 'live' ? '#4ade80' : '#facc15',
                border: targetEnv === 'live' ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(234, 179, 8, 0.3)'
              }}>
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: targetEnv === 'live' ? '#22c55e' : '#eab308',
                  boxShadow: targetEnv === 'live' ? '0 0 8px #22c55e' : '0 0 8px #eab308'
                }} />
                {targetEnv === 'live' ? 'Next.js Cloud Live' : 'Next.js Local (3000)'}
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '1px' }}>
              Source of Truth: <code style={{ color: '#38bdf8', fontSize: '0.70rem' }}>careerxone-portal/src/app/parent</code>
            </div>
          </div>
        </div>

        {/* Center: Environment & Device Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Environment Selector */}
          <div style={{
            display: 'flex',
            background: '#0f172a',
            padding: '3px',
            borderRadius: '8px',
            border: '1px solid #334155'
          }}>
            <button
              onClick={() => { setTargetEnv('live'); setIsLoading(true); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: targetEnv === 'live' ? '#0284c7' : 'transparent',
                color: targetEnv === 'live' ? '#ffffff' : '#94a3b8',
                transition: 'all 0.15s'
              }}
            >
              <Globe size={13} />
              Cloud Live
            </button>
            <button
              onClick={() => { setTargetEnv('local'); setIsLoading(true); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: targetEnv === 'local' ? '#d97706' : 'transparent',
                color: targetEnv === 'local' ? '#ffffff' : '#94a3b8',
                transition: 'all 0.15s'
              }}
              title="Ensure 'npm run dev' is running inside careerxone-portal"
            >
              <Laptop size={13} />
              Localhost:3000
            </button>
          </div>

          {/* Viewport Mode Switcher */}
          <div style={{
            display: 'flex',
            background: '#0f172a',
            padding: '3px',
            borderRadius: '8px',
            border: '1px solid #334155'
          }}>
            <button
              onClick={() => setViewMode('mobile')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 9px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: viewMode === 'mobile' ? '#334155' : 'transparent',
                color: viewMode === 'mobile' ? '#38bdf8' : '#94a3b8',
                transition: 'all 0.15s'
              }}
              title="Mobile Phone View (Parents Perspective)"
            >
              <Smartphone size={13} />
              Mobile
            </button>
            <button
              onClick={() => setViewMode('tablet')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 9px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: viewMode === 'tablet' ? '#334155' : 'transparent',
                color: viewMode === 'tablet' ? '#38bdf8' : '#94a3b8',
                transition: 'all 0.15s'
              }}
              title="Tablet View"
            >
              <Tablet size={13} />
              Tablet
            </button>
            <button
              onClick={() => setViewMode('desktop')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 9px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: viewMode === 'desktop' ? '#334155' : 'transparent',
                color: viewMode === 'desktop' ? '#38bdf8' : '#94a3b8',
                transition: 'all 0.15s'
              }}
              title="Full Desktop View"
            >
              <Monitor size={13} />
              Full
            </button>
          </div>
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={handleRefresh}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.74rem',
              fontWeight: 700,
              background: '#334155',
              border: '1px solid #475569',
              color: '#f8fafc',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            title="Reload Portal Frame"
          >
            <RefreshCw size={13} />
            Reload
          </button>

          <button
            onClick={handleCopyLink}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.74rem',
              fontWeight: 700,
              background: '#334155',
              border: '1px solid #475569',
              color: '#f8fafc',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            title="Copy Public Portal URL"
          >
            {copied ? <Check size={13} color="#4ade80" /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy Link'}
          </button>

          <button
            onClick={handleOpenExternal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.74rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
              transition: 'transform 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
            title="Open Live in Chrome / Default Browser"
          >
            <ExternalLink size={13} />
            Open in Browser
          </button>
        </div>
      </header>

      {/* Main Preview Container */}
      <main style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: viewMode === 'desktop' ? '0' : '16px',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Loading Overlay */}
        {isLoading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(4px)',
            zIndex: 5,
            gap: '12px'
          }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              border: '3px solid #334155',
              borderTopColor: '#38bdf8',
              animation: 'spin 0.8s linear infinite'
            }} />
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '0.90rem', color: '#f8fafc' }}>
                Loading Career Xone Parent Portal
              </div>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>
                Connecting to {activeUrl}...
              </div>
            </div>
          </div>
        )}

        {/* Embedded Responsive Iframe */}
        <div style={getContainerStyles()}>
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={activeUrl}
            title="Career Xone Parent Portal"
            onLoad={() => setIsLoading(false)}
            onError={() => setIsLoading(false)}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block'
            }}
            allow="camera; microphone; geolocation; clipboard-write; clipboard-read"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
          />
        </div>
      </main>
    </div>
  );
}
