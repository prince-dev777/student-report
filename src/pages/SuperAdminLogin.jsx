import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, User, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SuperAdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await fetch('http://localhost:5000/api/superadmin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('superadminToken', data.token);
        toast.success('Super Admin Login Successful!');
        navigate('/superadmin/dashboard');
      } else {
        toast.error(data.error || 'Login failed');
      }
    } catch (err) {
      toast.error('Network error');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-box" style={{ borderTop: '4px solid #ef4444' }}>
        <div className="login-header">
          <div className="logo-icon-login" style={{ background: 'none', width: 'auto', height: 'auto', marginBottom: '16px' }}>
            <ShieldAlert size={64} color="#ef4444" />
          </div>
          <h2>SUPER ADMIN</h2>
          <p>Global Security & Provisioning</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label>Master Username</label>
            <div className="input-with-icon">
              <User size={18} className="input-icon" />
              <input
                type="text"
                placeholder="Enter master username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label>Master Password</label>
            <div className="input-with-icon">
              <ShieldAlert size={18} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter master password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="login-btn" style={{ background: '#ef4444' }} disabled={isLoading}>
            {isLoading ? 'Authenticating...' : 'Authorize Access'}
          </button>
        </form>
      </div>
      
      <style>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0f172a;
          padding: 20px;
        }
        .login-box {
          background: #1e293b;
          border-radius: 24px;
          padding: 40px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }
        .login-header h2 {
          color: #f8fafc;
          font-size: 1.5rem;
          margin: 0 0 8px 0;
          font-weight: 600;
        }
        .login-header p {
          color: #94a3b8;
          font-size: 0.95rem;
          margin: 0;
        }
        .input-group {
          margin-bottom: 20px;
        }
        .input-group label {
          display: block;
          color: #cbd5e1;
          font-size: 0.9rem;
          margin-bottom: 8px;
          font-weight: 500;
        }
        .input-with-icon {
          position: relative;
        }
        .input-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
        }
        .input-with-icon input {
          width: 100%;
          padding: 12px 14px 12px 42px;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 12px;
          color: #f8fafc;
          font-size: 0.95rem;
          transition: all 0.2s;
        }
        .input-with-icon input:focus {
          outline: none;
          border-color: #ef4444;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
        }
        .login-btn {
          width: 100%;
          padding: 14px;
          border: none;
          border-radius: 12px;
          color: white;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          margin-top: 10px;
        }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        }
        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
