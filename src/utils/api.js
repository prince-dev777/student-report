// ============================================
// Career Xone Pro - Frontend API Client
// ============================================
// Interacts with Node.js + Express backend (http://localhost:5000)
// and handles fallback to localStorage if backend is down.

const isElectron = navigator.userAgent.toLowerCase().indexOf(' electron/') > -1;
const isDev = window.location.port === '5173';
// Use Cloud API server as the primary source of truth for the database
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
export const API_BASE = import.meta.env.VITE_API_BASE_URL || ((isLocalhost || isElectron) ? 'http://localhost:5000/api' : 'https://student-report-ezgw.onrender.com/api');

// Helper to check if backend is online
export async function checkBackendStatus() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds max
    const signal = typeof AbortSignal.timeout === 'function' 
      ? AbortSignal.timeout(15000) 
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
  
  // Electron edge-computing: local uploads (like OMR images) are on local server
  if (isElectron && (normalizedPath.startsWith('/uploads/') || normalizedPath.startsWith('uploads/'))) {
    const safePath = normalizedPath.startsWith('/') ? normalizedPath : '/' + normalizedPath;
    return `http://localhost:5000${safePath}`;
  }
  
  const base = API_BASE.replace('/api', '');
  return `${base}${normalizedPath.startsWith('/') ? '' : '/'}${normalizedPath}`;
}

// Generic fetch handler
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  const token = localStorage.getItem('token') || 
                localStorage.getItem('teacherToken') || 
                localStorage.getItem('staffToken') || 
                localStorage.getItem('parentToken');
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
  verifyAdminPassword: async (password) => {
    try {
      return await apiRequest('/auth/verify-admin-password', { method: 'POST', body: JSON.stringify({ password }) });
    } catch (err) {
      if (err.message && err.message.includes('404')) {
        const userStr = localStorage.getItem('user');
        const userObj = userStr ? JSON.parse(userStr) : null;
        const username = userObj?.username || 'admin';
        const res = await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
        if (res?.token) {
          return { success: true, message: 'Admin verified successfully' };
        }
      }
      throw err;
    }
  },
  getSettings: () => apiRequest('/settings'),
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
  uploadOMRImages: (formData) => apiRequest('/test-results/omr-process', { method: 'POST', body: formData }),
  saveTestResultsBulk: (results) => apiRequest('/test-results/bulk', { method: 'POST', body: JSON.stringify(results) }),
  publishTestResults: (testId, sendSMS) => apiRequest(`/test-results/${testId}/publish`, { method: 'PUT', body: JSON.stringify({ sendSMS }) }),

  // Teacher, Staff & Inquiry Portal
  teacherLogin: (data) => apiRequest('/auth/teacher-login', { method: 'POST', body: JSON.stringify(data) }),
  staffLogin: (data) => apiRequest('/auth/staff-login', { method: 'POST', body: JSON.stringify(data) }),
  inquiryLogin: (data) => apiRequest('/auth/inquiry-login', { method: 'POST', body: JSON.stringify(data) }),
  getTeacherData: () => apiRequest('/teacher/data'),

  // SMS Logs
  getSMSLogs: () => apiRequest('/sms-logs'),
  createSMSLog: (log) => apiRequest('/sms-logs', { method: 'POST', body: JSON.stringify(log) }),
  deleteSMSLog: (id) => apiRequest(`/sms-logs/${id}`, { method: 'DELETE' }),
  deleteSMSLogsBulk: (ids) => apiRequest('/sms-logs/bulk', { method: 'DELETE', body: JSON.stringify({ ids }) }),
  deleteAllSMSLogs: () => apiRequest('/sms-logs/all', { method: 'DELETE' }),

  // Cloud Pull & Bidirectional Sync
  pullCloudData: () => apiRequest('/sync/pull-cloud', { method: 'POST' }),
  bidirectionalSync: () => apiRequest('/sync/bidirectional', { method: 'POST' }),

  // Batch Sessions & Timing Management
  getSessions: () => apiRequest('/sessions'),
  createSession: (session) => apiRequest('/sessions', { method: 'POST', body: JSON.stringify(session) }),
  updateSession: (id, session) => apiRequest(`/sessions/${id}`, { method: 'PUT', body: JSON.stringify(session) }),
  deleteSession: (id) => apiRequest(`/sessions/${id}`, { method: 'DELETE' }),

  // Front-Desk Inquiries
  getInquiries: () => apiRequest('/inquiries'),
  createInquiry: (inquiry) => apiRequest('/inquiries', { method: 'POST', body: JSON.stringify(inquiry) }),
  updateInquiry: (id, inquiry) => apiRequest(`/inquiries/${id}`, { method: 'PUT', body: JSON.stringify(inquiry) }),
  deleteInquiry: (id) => apiRequest(`/inquiries/${id}`, { method: 'DELETE' }),

  // Database Management
  seedDatabase: (data) => apiRequest('/seed', { method: 'POST', body: JSON.stringify(data) }),
  resetDatabase: () => apiRequest('/reset', { method: 'POST' }),

  // Notifications
  markNotificationRead: (id) => apiRequest(`/notifications/${id}/read`, { method: 'PUT' }),

  // System Updates
  getUpdateStatus: async () => {
    try {
      const response = await fetch(`${API_BASE}/system/update-status`);
      if (response.ok) return await response.json();
    } catch (e) {}
    return { status: 'idle', version: '', releaseDate: '', currentVersion: '', progress: 0 };
  },
  startUpdateDownload: async () => {
    try {
      const response = await fetch(`${API_BASE}/system/start-download`, { method: 'POST' });
      if (response.ok) return await response.json();
    } catch (e) {}
  },
  restartAndUpdate: async () => {
    try {
      await fetch(`${API_BASE}/system/restart-and-update`, { method: 'POST' });
    } catch (e) {}
  },
  
  // Cloud Sync
  syncDataToCloud: () => apiRequest('/sync', { method: 'POST' }),
  getBackupInfo: () => apiRequest('/system/backup-info'),

  // Local Database & Storage Manager
  getDatabaseOverview: () => apiRequest('/database/overview'),
  getDatabaseItems: (collection, filter = 'all', search = '') => 
    apiRequest(`/database/items/${collection}?filter=${filter}&search=${encodeURIComponent(search)}`),
  deleteDatabaseItem: (collection, id) => 
    apiRequest(`/database/item/${collection}/${id}`, { method: 'DELETE' }),
  purgeDeletedRecords: (collection = 'all') => 
    apiRequest('/database/purge-deleted', { method: 'POST', body: JSON.stringify({ collection }) }),
  wipeCollection: (collection, confirmation = 'WIPE') => 
    apiRequest('/database/wipe-collection', { method: 'POST', body: JSON.stringify({ collection, confirmation }) }),
  purgeOrphanedFiles: () => 
    apiRequest('/database/purge-orphaned-files', { method: 'POST' }),
  deleteMediaFile: (folder, filename) => 
    apiRequest(`/database/media-file?folder=${encodeURIComponent(folder)}&filename=${encodeURIComponent(filename)}`, { method: 'DELETE' }),
  getCloudinaryStats: () => 
    apiRequest('/database/cloudinary-stats'),
  purgeCloudinaryUnwanted: () => 
    apiRequest('/database/purge-cloudinary-unwanted', { method: 'POST' }),
  getSystemLogs: () => 
    apiRequest('/system/logs'),

  // Biometric Control Center
  scanBiometricDevices: () => 
    apiRequest('/biometric/scan', { method: 'POST' }),
  testBiometricConnection: (data) => 
    apiRequest('/biometric/test', { method: 'POST', body: JSON.stringify(data) }),
  syncBiometricNow: (data) => 
    apiRequest('/biometric/sync', { method: 'POST', body: JSON.stringify(data) }),
  toggleBiometricAutoSync: (data) => 
    apiRequest('/biometric/auto-sync', { method: 'POST', body: JSON.stringify(data) }),
  getBiometricStatus: () => 
    apiRequest('/biometric/status'),
  saveBiometricConfig: (data) => 
    apiRequest('/biometric/config', { method: 'POST', body: JSON.stringify(data) }),

  // WhatsApp Parent Auto-Reply Bot
  getWhatsAppBotConfig: () => 
    apiRequest('/whatsapp/bot-config'),
  saveWhatsAppBotConfig: (data) => 
    apiRequest('/whatsapp/bot-config', { method: 'POST', body: JSON.stringify(data) }),
  getWhatsAppBotLogs: () => 
    apiRequest('/whatsapp/bot-logs'),
  simulateWhatsAppBotMessage: (data) =>
    apiRequest('/whatsapp/bot/simulate', { method: 'POST', body: JSON.stringify(data) }),
};
