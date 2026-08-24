const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, 'server', 'server.js');
const content = fs.readFileSync(serverFile, 'utf8');

// Find all routes that mutate data:
// Students: POST /api/students, POST /api/students/bulk, PUT /api/students/:id, DELETE /api/students/:id, POST /api/students/bulk-delete
// Tests: POST /api/tests, PUT /api/tests/:id, DELETE /api/tests/:id, POST /api/tests/:id/regrade
// Results: POST /api/test-results/bulk, PUT /api/test-results/:testId/publish, DELETE /api/test-results/:id
// Attendance: POST /api/attendance, POST /api/attendance/bulk, DELETE /api/attendance/:id
// Sessions: POST /api/sessions, PUT /api/sessions/:id, DELETE /api/sessions/:id
// Inquiries: POST /api/inquiries, PUT /api/inquiries/:id, DELETE /api/inquiries/:id
// Institute: PUT /api/institute
// Notifications / SMS: POST /api/sms/send, etc.

const endpoints = [
  '/api/students',
  '/api/tests',
  '/api/test-results',
  '/api/attendance',
  '/api/sessions',
  '/api/inquiries',
  '/api/institute',
  '/api/notifications'
];

const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes('app.post(') || line.includes('app.put(') || line.includes('app.delete(') || line.includes('app.patch(')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
