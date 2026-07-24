import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, ShieldAlert, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const success = await login(username, password);
    if (success) {
      navigate('/');
    }
    setIsLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <div className="logo-icon-login" style={{ background: 'none', width: 'auto', height: 'auto', marginBottom: '16px' }}>
            <img 
              src="./logo.jpg" 
              alt="Logo" 
              style={{ width: '80px', height: '80px', borderRadius: '16px', objectFit: 'contain' }} 
            />
          </div>
          <h2>CAREER XONE</h2>
          <p>Admin Security Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label>Username</label>
            <div className="input-with-icon">
              <User size={18} className="input-icon" />
              <input
                type="text"
                placeholder="Enter admin username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="input-group">
            <label>Password</label>
            <div className="input-with-icon">
              <ShieldAlert size={18} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
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

          <button type="submit" className="login-btn" disabled={isLoading}>
            {isLoading ? 'Authenticating...' : 'Secure Login'}
          </button>

          <p className="auth-link">
            New coaching institute? <Link to="/register">Register here</Link>
          </p>
        </form>
      </div>

      <style>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f0f5fc;
          background-image: 
            radial-gradient(ellipse at 20% 0%, rgba(37, 99, 235, 0.05) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 100%, rgba(124, 58, 237, 0.05) 0%, transparent 50%);
        }
        .login-box {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(37, 99, 235, 0.15);
          padding: 40px;
          border-radius: 24px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 8px 32px rgba(37, 99, 235, 0.12);
        }
        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }
        .logo-icon-login {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #2563eb, #6366f1);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          box-shadow: 0 4px 16px rgba(37, 99, 235, 0.2);
        }
        .login-header h2 {
          color: #0f172a;
          font-size: 1.8rem;
          margin-bottom: 4px;
        }
        .login-header p {
          color: #475569;
          font-size: 0.9rem;
        }
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .input-group label {
          display: block;
          color: #475569;
          font-size: 0.85rem;
          margin-bottom: 8px;
          font-weight: 600;
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
          background: #ffffff;
          border: 1px solid rgba(37, 99, 235, 0.15);
          padding: 12px 42px 12px 42px;
          border-radius: 12px;
          color: #0f172a;
          font-size: 0.95rem;
          transition: all 0.25s ease;
          box-shadow: 0 2px 8px rgba(37, 99, 235, 0.04);
        }
        .input-with-icon input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
        }
        .input-with-icon input::placeholder {
          color: #94a3b8;
        }
        .login-btn {
          margin-top: 10px;
          background: linear-gradient(135deg, #2563eb, #6366f1);
          color: white;
          border: none;
          padding: 14px;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s ease;
          box-shadow: 0 2px 10px rgba(37, 99, 235, 0.2);
        }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(37, 99, 235, 0.35);
        }
        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .auth-link {
          text-align: center;
          margin-top: 15px;
          color: #64748b;
          font-size: 0.9rem;
        }
        .auth-link a {
          color: #2563eb;
          text-decoration: none;
          font-weight: 600;
        }
        .auth-link a:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
