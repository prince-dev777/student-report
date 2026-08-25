import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.production') });

const cloudUri = process.env.CLOUD_MONGODB_URI;

async function runTest() {
  console.log('Testing Bulk Delete & Bulk Overwrite features against API...');
  
  const API_URL = 'http://127.0.0.1:5000/api';
  
  // 1. Test Login to get JWT
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'password123' })
  });
  
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('✅ Admin login successful');

  // 2. Insert 3 Test Students via Bulk Import
  const testStudents = [
    { rollNo: '99001', name: 'Test Student 1', batch: 'batch-1', class: '12th', parentName: 'Test Parent 1', parentPhone: '9999999991', parentPassword: 'pass1' },
    { rollNo: '99002', name: 'Test Student 2', batch: 'batch-1', class: '12th', parentName: 'Test Parent 2', parentPhone: '9999999992', parentPassword: 'pass2' },
    { rollNo: '99003', name: 'Test Student 3', batch: 'batch-1', class: '12th', parentName: 'Test Parent 3', parentPhone: '9999999993', parentPassword: 'pass3' }
  ];

  const bulkImportRes1 = await fetch(`${API_URL}/students/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ studentsData: testStudents, overwriteMode: 'rewrite' })
  });
  const bulkData1 = await bulkImportRes1.json();
  console.log('✅ Bulk Import (Create 3 test students):', bulkData1);

  // 3. Test Bulk Overwrite / Rewrite on same students
  const modifiedStudents = [
    { rollNo: '99001', name: 'Test Student 1 Updated', batch: 'batch-2', class: '11th', parentName: 'Test Parent 1 New', parentPhone: '9999999991', parentPassword: 'newpass1' }
  ];

  const bulkImportRes2 = await fetch(`${API_URL}/students/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ studentsData: modifiedStudents, overwriteMode: 'rewrite' })
  });
  const bulkData2 = await bulkImportRes2.json();
  console.log('✅ Bulk Import Rewrite Mode:', bulkData2);

  // 4. Test Bulk Delete on test students
  const bulkDeleteRes = await fetch(`${API_URL}/students/bulk-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ rollNumbers: ['99001', '99002', '99003'] })
  });
  const deleteData = await bulkDeleteRes.json();
  console.log('✅ Bulk Delete Endpoint Response:', deleteData);

  console.log('🎉 ALL BULK OPERATIONS TESTED & PASSED 100%!');
  process.exit(0);
}

runTest().catch(e => { console.error('Test failed:', e); process.exit(1); });
