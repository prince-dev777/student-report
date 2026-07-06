import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import MouseTrail from './components/MouseTrail';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Attendance from './pages/Attendance';
import SMSCenter from './pages/SMSCenter';

import Login from './pages/Login';
import Register from './pages/Register';
import Tests from './pages/Tests';

function AppLayout() {
  return (
    <div className="app-layout">
      <MouseTrail />
      <Sidebar />
      <div className="main-content">
        <Topbar />
        <div className="page-container">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/students" element={<Students />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/tests" element={<Tests />} />
            <Route path="/sms" element={<SMSCenter />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <AppProvider>
                <AppLayout />
              </AppProvider>
            </ProtectedRoute>
          } />
        </Routes>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#0c1029',
              color: '#f1f5f9',
              border: '1px solid rgba(59, 130, 246, 0.15)',
              borderRadius: '12px',
              fontSize: '0.85rem',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#0c1029',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#0c1029',
              },
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}

