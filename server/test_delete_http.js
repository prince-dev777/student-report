import fetch from 'node-fetch';
import mongoose from 'mongoose';
import Test from './models/Test.js';
import User from './models/User.js';
import jwt from 'jsonwebtoken';

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27018/student-report');
  
  // 1. Restore the test so it's not deleted
  // Find owner first
  const JWT_SECRET = process.env.JWT_SECRET || '8f5b8a6d4e2c9a1f3c7e6b5d4a9f8e2d1c3b5a4f7e6d8c9b0a1f2e3d4c5b6a7f';
  const user = await User.findOne({ role: 'owner' });
  
  // Restore the test for this user
  let testDoc = await Test.findOneAndUpdate(
    { instituteId: user.instituteId, name: 'For some students' },
    { $unset: { isDeleted: "", deletedAt: "" } },
    { new: true }
  );
  if (!testDoc) {
    testDoc = await Test.findOne({ instituteId: user.instituteId, name: 'For some students' });
  }
  
  if (!testDoc) {
    console.log("No tests exist in DB to test.");
    process.exit();
  }
  
  // 2. Generate a token directly
  const token = jwt.sign({ 
      id: user._id, 
      username: user.username, 
      role: user.role, 
      instituteId: user.instituteId 
    }, 
    JWT_SECRET, 
    { expiresIn: '24h' }
  );
  try {
    const res = await fetch(`http://localhost:5000/api/tests`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const text = await res.json();
    console.log("HTTP Status:", res.status);
    console.log("First test:", text[0]);
  } catch (err) {
    console.error("Fetch Error:", err);
  }
  
  process.exit();
}
run();
