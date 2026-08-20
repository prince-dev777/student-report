import React from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react';

export default class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error('🚨 [GlobalErrorBoundary Caught Crash]:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.hash = '#/';
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif",
          color: '#f8fafc'
        }}>
          <div style={{
            background: 'rgba(30, 41, 59, 0.85)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '24px',
            padding: '32px 24px',
            maxWidth: '480px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7)'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              border: '2px solid rgba(239, 68, 68, 0.3)'
            }}>
              <AlertTriangle size={32} />
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 6px', color: '#ffffff' }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: '0.84rem', color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.4 }}>
              An unexpected error occurred in this view. Don&apos;t worry, your data is safe.
            </p>

            {this.state.error && (
              <div style={{
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '12px',
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                color: '#fca5a5',
                textAlign: 'left',
                maxHeight: '120px',
                overflowY: 'auto',
                marginBottom: '20px',
                wordBreak: 'break-word'
              }}>
                {this.state.error.toString()}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '12px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)'
                }}
              >
                <RefreshCw size={16} /> Reload App
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#f8fafc',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  padding: '12px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Home size={16} /> Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
