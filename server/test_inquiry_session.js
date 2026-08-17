import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'your-secret-key-123'; // Matches server.js hardcoded secret
const token = jwt.sign({ 
    id: 'test-admin', 
    username: 'admin', 
    role: 'superadmin', 
    instituteId: '66bc6da5da3415cf7c91e1d0' 
  }, 
  JWT_SECRET, 
  { expiresIn: '24h' }
);

async function runTests() {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  try {
    // 1. Create Session
    let res = await fetch('http://localhost:5000/api/sessions', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Morning Class', startTime: '08:00', endTime: '12:00', id: 'SESS123' })
    });
    console.log("Create Session:", res.status, await res.text());

    // 2. Get Sessions
    res = await fetch('http://localhost:5000/api/sessions', { headers });
    console.log("Get Sessions:", res.status, await res.text());

    // 3. Create Inquiry
    res = await fetch('http://localhost:5000/api/inquiries', {
      method: 'POST',
      headers,
      body: JSON.stringify({ visitorName: 'Ramesh', studentName: 'Suresh', contactNumber: '9999999999', date: '2026-08-16', id: 'INQ123' })
    });
    console.log("Create Inquiry:", res.status, await res.text());

    // 4. Get Inquiries
    res = await fetch('http://localhost:5000/api/inquiries', { headers });
    console.log("Get Inquiries:", res.status, await res.text());

  } catch (err) {
    console.error("Test Error:", err);
  }
}

runTests();
