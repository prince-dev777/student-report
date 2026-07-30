// ============================================
// Career Xone Pro - Frontend API Client
// ============================================
// Interacts with Node.js + Express backend (http://localhost:5000)
// and handles fallback to localStorage if backend is down.

const isElectron = navigator.userAgent.toLowerCase().indexOf(' electron/') > -1;
const isDev = window.location.port === '5173';
// Use Cloud API server as the primary source of truth for the database
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Helper to check if backend is online
export async function checkBackendStatus() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes for Render free tier wake up
    const signal = typeof AbortSignal.timeout === 'function' 
      ? AbortSignal.timeout(180000) 
      : controller.signal;
    
    const res = await fetch(`${API_BASE.replace('/api', '')}/`, { method: 'GET', signal });
    clearTimeout(timeoutId);
    return res.ok;
  } catch (e) {
    return false;
  }
}

export function getMediaUrl(path) {
  if (!path) return '';
  if (path.startsWith('data:')) return path;
  if (path.startsWith('http')) return path;
  
  // replace backslashes with forward slashes for URLs
  const normalizedPath = path.replace(/\\/g, '/');
  
  const base = API_BASE.replace('/api', '');
  return `${base}${normalizedPath.startsWith('/') ? '' : '/'}${normalizedPath}`;
}

// Generic fetch handler
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  const token = localStorage.getItem('token');
  const headers = {
    ...options.headers,
  };
  
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Auth
  login: (credentials) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  register: (data) => apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  updateSettings: (data) => apiRequest('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  parentLogin: (data) => apiRequest('/parent/login', { method: 'POST', body: JSON.stringify(data) }),
  regenerateParentCredentials: (id) => apiRequest(`/students/${id}/regenerate-parent`, { method: 'POST' }),
  
  // Parent Data
  getParentData: () => apiRequest('/parent/data'),

  // Students
  getStudents: (page = 1, limit = 50, search = '') => {
    const params = new URLSearchParams({ page, limit });
    if (search) params.append('search', search);
    return apiRequest(`/students?${params.toString()}`);
  },
  getStudent: (id) => apiRequest(`/students/${id}`),
  createStudent: (student) => apiRequest('/students', { method: 'POST', body: JSON.stringify(student) }),
  addStudentsBulk: (studentsData) => apiRequest('/students/bulk', { method: 'POST', body: JSON.stringify({ studentsData }) }),
  updateStudent: (id, updates) => apiRequest(`/students/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  deleteStudent: (id) => apiRequest(`/students/${id}`, { method: 'DELETE' }),

  // Attendance
  getAttendance: () => apiRequest('/attendance'),
  markAttendance: (record) => apiRequest('/attendance', { method: 'POST', body: JSON.stringify(record) }),

  // Tests
  getTests: () => apiRequest('/tests'),
  createTest: (test) => apiRequest('/tests', { method: 'POST', body: JSON.stringify(test) }),
  updateTest: (id, updates) => apiRequest(`/tests/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  deleteTest: (id) => apiRequest(`/tests/${id}`, { method: 'DELETE' }),
  regradeTest: (id) => apiRequest(`/tests/${id}/regrade`, { method: 'POST' }),

  // Test Results
  getTestResults: () => apiRequest('/test-results'),
  downloadOMRImages: (data) => apiRequest('/test-results/download-omr-images', { method: 'POST', body: JSON.stringify(data) }),
  uploadOMRImages: async (formData) => {
    // Check if running inside Electron Desktop App
    const isElectron = navigator.userAgent.toLowerCase().indexOf(' electron/') > -1;
    
    if (isElectron) {
      // Edge Computing: Send heavy images to LOCAL server instead of cloud
      const token = localStorage.getItem('token');
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch('/api/test-results/omr-process', {
        method: 'POST',
        headers,
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Local Server Error: ${response.status}`);
      }
      return response.json();
    } else {
      // Running on Web (Browser), fallback to Cloud API
      return apiRequest('/test-results/omr-process', { method: 'POST', body: formData });
    }
  },
  saveTestResultsBulk: (results) => apiRequest('/test-results/bulk', { method: 'POST', body: JSON.stringify(results) }),
  publishTestResults: (testId, sendSMS) => apiRequest(`/test-results/${testId}/publish`, { method: 'PUT', body: JSON.stringify({ sendSMS }) }),

  // SMS Logs
  getSMSLogs: () => apiRequest('/sms-logs'),
  createSMSLog: (log) => apiRequest('/sms-logs', { method: 'POST', body: JSON.stringify(log) }),
  deleteSMSLog: (id) => apiRequest(`/sms-logs/${id}`, { method: 'DELETE' }),

  // Seed / Reset
  seedDatabase: (data) => apiRequest('/seed', { method: 'POST', body: JSON.stringify(data) }),
  resetDatabase: () => apiRequest('/reset', { method: 'POST' }),

  // Notifications
  markNotificationRead: (id) => apiRequest(`/notifications/${id}/read`, { method: 'PUT' }),

  // System Updates
  getUpdateStatus: async () => {
    try {
      const response = await fetch('/api/system/update-status');
      if (response.ok) return await response.json();
    } catch (e) {}
    return { status: 'idle', version: '', releaseDate: '', currentVersion: '', progress: 0 };
  },
  startUpdateDownload: async () => {
    try {
      const response = await fetch('/api/system/start-download', { method: 'POST' });
      if (response.ok) return await response.json();
    } catch (e) {}
  },
  restartAndUpdate: async () => {
    try {
      await fetch('/api/system/restart-and-update', { method: 'POST' });
    } catch (e) {}
  },
};
