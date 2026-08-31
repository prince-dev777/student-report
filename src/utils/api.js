// ============================================
// Career Xone Pro - Frontend API Client
// ============================================
// Interacts with Node.js + Express backend (http://localhost:5000)
// and handles fallback to localStorage if backend is down.

const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().indexOf(' electron/') > -1;
const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// In Electron / Local desktop app, always prioritize local fast backend on port 5000
export const API_BASE = (isLocalhost || isElectron)
  ? 'http://localhost:5000/api'
  : (import.meta.env.VITE_API_BASE_URL || 'https://student-report-4j6t.onrender.com/api');

// Helper to check if backend is online with automatic retry for smooth startup
export async function checkBackendStatus(retries = (isElectron ? 5 : 2), delay = 800) {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const signal = typeof AbortSignal.timeout === 'function' 
        ? AbortSignal.timeout(3000) 
        : controller.signal;
      
      const res = await fetch(`${API_BASE}/health`, { method: 'GET', signal });
      clearTimeout(timeoutId);
      if (res.ok) return true;
    } catch (e) {
      // If we still have retries, wait and retry
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  return false;
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

  const text = await response.text();

  if (!response.ok) {
    let errMsg = `HTTP error! status: ${response.status}`;
    try {
      const err = JSON.parse(text);
      errMsg = err.error || err.message || errMsg;
    } catch (_) {
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        errMsg = `Server endpoint ${endpoint} not found (HTTP ${response.status})`;
      }
    }
    throw new Error(errMsg);
  }

  try {
    return JSON.parse(text);
  } catch (parseErr) {
    if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      throw new Error(`Server returned HTML instead of JSON for ${endpoint}`);
    }
    return text;
  }
}

export const api = {
  // Generic HTTP Methods
  get: (endpoint, options = {}) => apiRequest(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body = {}, options = {}) => apiRequest(endpoint, { 
    method: 'POST', 
    body: body instanceof FormData ? body : JSON.stringify(body), 
    ...options 
  }),
  put: (endpoint, body = {}, options = {}) => apiRequest(endpoint, { 
    method: 'PUT', 
    body: body instanceof FormData ? body : JSON.stringify(body), 
    ...options 
  }),
  delete: (endpoint, options = {}) => apiRequest(endpoint, { method: 'DELETE', ...options }),

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
  addStudentsBulk: (studentsData, overwriteMode = 'rewrite') => apiRequest('/students/bulk', { method: 'POST', body: JSON.stringify({ studentsData, overwriteMode }) }),
  deleteStudentsBulk: (studentIds) => apiRequest('/students/bulk-delete', { method: 'POST', body: JSON.stringify({ studentIds }) }),
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
  getInquiries: (sync = false) => apiRequest(`/inquiries${sync ? '?sync=1' : ''}`),
  syncCloudInquiries: () => apiRequest('/inquiries/sync-cloud', { method: 'POST' }),
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
  syncAllBiometricDevices: (data) => 
    apiRequest('/biometric/sync-all', { method: 'POST', body: JSON.stringify(data) }),
  toggleBiometricAutoSync: (data) => 
    apiRequest('/biometric/auto-sync', { method: 'POST', body: JSON.stringify(data) }),
  getBiometricStatus: () => 
    apiRequest('/biometric/status'),
  getRecentBiometricPunches: (limit = 25) =>
    apiRequest(`/biometric/recent-punches?limit=${limit}`),
  manualBiometricPunch: (data) =>
    apiRequest('/biometric/manual-punch', { method: 'POST', body: JSON.stringify(data) }),
  cleanBiometricHistory: () =>
    apiRequest('/biometric/clean-history', { method: 'POST' }),
  getBiometricNetworkStatus: () =>
    apiRequest('/biometric/network-status'),
  lockBiometricStaticIp: (data = {}) =>
    apiRequest('/biometric/lock-static-ip', { method: 'POST', body: JSON.stringify(data) }),
  resetBiometricDhcp: (data = {}) =>
    apiRequest('/biometric/reset-dhcp', { method: 'POST', body: JSON.stringify(data) }),

  // 👥 Staff / Employee Attendance Control Center
  getStaffAttendance: (date) =>
    apiRequest(`/staff-attendance${date ? `?date=${date}` : ''}`),
  manualStaffPunch: (data) =>
    apiRequest('/staff-attendance/punch', { method: 'POST', body: JSON.stringify(data) }),
  getStaffMembers: () =>
    apiRequest('/staff-members'),
  createStaffMember: (data) =>
    apiRequest('/staff-members', { method: 'POST', body: JSON.stringify(data) }),

  // WhatsApp Parent Auto-Reply Bot
  getWhatsAppBotConfig: () => 
    apiRequest('/whatsapp/bot-config'),
  saveWhatsAppBotConfig: (data) => 
    apiRequest('/whatsapp/bot-config', { method: 'POST', body: JSON.stringify(data) }),
  getWhatsAppBotLogs: () => 
    apiRequest('/whatsapp/bot-logs'),
  simulateWhatsAppBotMessage: (data) =>
    apiRequest('/whatsapp/bot/simulate', { method: 'POST', body: JSON.stringify(data) }),

  // 🎙️ AI Voice Calling & Telephony
  synthesizeVoice: (text, voice) => 
    apiRequest('/voice-ai/synthesize', { method: 'POST', body: JSON.stringify({ text, voice }) }),
  processVoiceChat: (data) => 
    apiRequest('/voice-ai/chat', { method: 'POST', body: JSON.stringify(data) }),
  getVoiceCallLogs: (limit = 50) => 
    apiRequest(`/voice-ai/logs?limit=${limit}`),
  logVoiceCall: (data) => 
    apiRequest('/voice-ai/log', { method: 'POST', body: JSON.stringify(data) }),

  // 📄 Test Series PDF Generation
  generateTestSeriesPdf: async (data) => {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}/test-series/generate-pdf`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      let errMsg = `Server error: ${response.status}`;
      try {
        const errJson = await response.json();
        errMsg = errJson.error || errMsg;
      } catch (_) {}
      throw new Error(errMsg);
    }
    return await response.blob();
  },
};
