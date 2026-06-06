// ============================================
// EduTrack Pro - Frontend API Client
// ============================================
// Interacts with Node.js + Express backend (http://localhost:5000)
// and handles fallback to localStorage if backend is down.

const API_BASE = 'https://student-report-ezgw.onrender.com/api';

// Helper to check if backend is online
export async function checkBackendStatus() {
  try {
    const res = await fetch(`${API_BASE.replace('/api', '')}/`, { method: 'GET', signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch (e) {
    return false;
  }
}

// Generic fetch handler
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Students
  getStudents: () => apiRequest('/students'),
  createStudent: (student) => apiRequest('/students', { method: 'POST', body: JSON.stringify(student) }),
  updateStudent: (id, updates) => apiRequest(`/students/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  deleteStudent: (id) => apiRequest(`/students/${id}`, { method: 'DELETE' }),

  // Attendance
  getAttendance: () => apiRequest('/attendance'),
  markAttendance: (record) => apiRequest('/attendance', { method: 'POST', body: JSON.stringify(record) }),

  // Tests
  getTests: () => apiRequest('/tests'),
  createTest: (test) => apiRequest('/tests', { method: 'POST', body: JSON.stringify(test) }),

  // Test Results
  getTestResults: () => apiRequest('/test-results'),
  saveTestResultsBulk: (results) => apiRequest('/test-results/bulk', { method: 'POST', body: JSON.stringify(results) }),

  // SMS Logs
  getSMSLogs: () => apiRequest('/sms-logs'),
  createSMSLog: (log) => apiRequest('/sms-logs', { method: 'POST', body: JSON.stringify(log) }),

  // Seed / Reset
  seedDatabase: (data) => apiRequest('/seed', { method: 'POST', body: JSON.stringify(data) }),
  resetDatabase: () => apiRequest('/reset', { method: 'POST' }),
};
