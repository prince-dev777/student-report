import React from 'react';

export default function AppStartupSplash({ message = 'Starting intelligent workspace & database...', subtext = 'Hardware push listeners & local server active' }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 35%, #1e293b 0%, #090d16 85%)',
      color: '#f8fafc',
      fontFamily: "'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      userSelect: 'none',
      zIndex: 9999999,
      overflow: 'hidden'
    }}>
      {/* Ambient background glow orb */}
      <div style={{
        position: 'absolute',
        width: '320px',
        height: '320px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(2, 132, 199, 0.18) 0%, rgba(99, 102, 241, 0.08) 60%, transparent 80%)',
        filter: 'blur(30px)',
        pointerEvents: 'none',
        animation: 'cxAmbientGlow 3s ease-in-out infinite alternate'
      }} />

      {/* Floating 3D Logo Card */}
      <div style={{
        position: 'relative',
        marginBottom: '26px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          position: 'absolute',
          width: '100px',
          height: '100px',
          borderRadius: '28px',
          background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.5), rgba(99, 102, 241, 0.5))',
          filter: 'blur(20px)',
          animation: 'cxGlowPulse 2.2s ease-in-out infinite'
        }} />
        <div style={{
          width: '84px',
          height: '84px',
          borderRadius: '24px',
          background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 50%, #6366f1 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '38px',
          fontWeight: 900,
          color: '#ffffff',
          boxShadow: '0 16px 36px -4px rgba(2, 132, 199, 0.55), inset 0 1px 1px rgba(255, 255, 255, 0.45)',
          position: 'relative',
          letterSpacing: '-1px',
          animation: 'cxLogoFloat 2.6s ease-in-out infinite'
        }}>
          CX
        </div>
      </div>

      {/* Brand Title */}
      <div style={{
        fontSize: '1.45rem',
        fontWeight: 800,
        letterSpacing: '-0.5px',
        marginBottom: '8px',
        color: '#ffffff',
        textShadow: '0 2px 10px rgba(0, 0, 0, 0.5)'
      }}>
        Career Xone Pro
      </div>

      {/* Dynamic Status message */}
      <div style={{
        fontSize: '0.88rem',
        color: '#94a3b8',
        marginBottom: '26px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontWeight: 500
      }}>
        <span style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#10b981',
          boxShadow: '0 0 10px #10b981',
          animation: 'cxStatusBlink 1.4s infinite'
        }} />
        <span>{message}</span>
      </div>

      {/* Shimmering sleek progress bar */}
      <div style={{
        width: '240px',
        height: '5px',
        background: 'rgba(255, 255, 255, 0.08)',
        borderRadius: '999px',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{
          position: 'absolute',
          height: '100%',
          width: '38%',
          background: 'linear-gradient(90deg, #0284c7, #38bdf8, #818cf8)',
          borderRadius: '999px',
          animation: 'cxBarSlide 1.3s ease-in-out infinite'
        }} />
      </div>

      {/* Micro-subtext */}
      {subtext && (
        <div style={{
          fontSize: '0.72rem',
          color: '#64748b',
          marginTop: '16px',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          fontWeight: 600
        }}>
          {subtext}
        </div>
      )}

      <style>{`
        @keyframes cxLogoFloat {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-4px) scale(1.02); }
        }
        @keyframes cxGlowPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.95; transform: scale(1.15); }
        }
        @keyframes cxBarSlide {
          0% { left: -38%; }
          100% { left: 100%; }
        }
        @keyframes cxStatusBlink {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
        @keyframes cxAmbientGlow {
          0% { transform: scale(0.9); opacity: 0.7; }
          100% { transform: scale(1.15); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
