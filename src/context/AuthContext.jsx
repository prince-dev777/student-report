import React, { createContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { api } from '../utils/api';

export const AuthContext = createContext(null);

// Re-export useAuth so existing imports from './AuthContext' keep working
export { useAuth } from './useAuth';

function isTokenValid(token) {
  if (!token || typeof token !== 'string') return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    const stored = localStorage.getItem('token');
    if (stored && isTokenValid(stored)) return stored;
    if (stored) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return null;
  });
  const [user, setUser] = useState(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken || !isTokenValid(storedToken)) return null;
    return localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;
  });
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!token && isTokenValid(token));

  useEffect(() => {
    const handleExpired = () => {
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      toast.error('Login session expired. Please log in again.', { id: 'session-expired' });
    };
    window.addEventListener('auth-session-expired', handleExpired);
    return () => window.removeEventListener('auth-session-expired', handleExpired);
  }, []);

  useEffect(() => {
    if (token && isTokenValid(token)) {
      localStorage.setItem('token', token);
      setIsAuthenticated(true);
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setIsAuthenticated(false);
      setUser(null);
    }
  }, [token]);

  const login = async (username, password) => {
    try {
      const response = await api.login({ username, password });
      setToken(response.token);
      const userData = { username: response.username, instituteName: response.instituteName, logo: response.logo };
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      toast.success('Login successful!');
      return true;
    } catch (err) {
      toast.error(err.message || 'Invalid credentials');
      return false;
    }
  };

  const register = async (instituteName, adminName, username, password) => {
    try {
      const response = await api.register({ instituteName, adminName, username, password });
      setToken(response.token);
      const userData = { username: response.username, instituteName: response.instituteName, logo: response.logo };
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      toast.success('Registration successful!');
      return true;
    } catch (err) {
      toast.error(err.message || 'Registration failed');
      return false;
    }
  };

  const updateUser = (newData) => {
    const updated = { ...user, ...newData };
    setUser(updated);
    localStorage.setItem('user', JSON.stringify(updated));
  };

  const logout = () => {
    setToken(null);
    toast.success('Logged out successfully');
  };

  return (
    <AuthContext.Provider value={{ token, user, isAuthenticated, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
