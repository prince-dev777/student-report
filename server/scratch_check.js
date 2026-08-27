import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Student from './models/Student.js';
import Test from './models/Test.js';
import TestResult from './models/TestResult.js';
import Attendance from './models/Attendance.js';
import User from './models/User.js';
import Institute from './models/Institute.js';
import { connectLocalDb } from './db/localDb.js';

dotenv.config();

async function check() {
  await connectLocalDb();
  console.log('Connected to DB');

  const defaultUser = await User.findOne({ isDeleted: { $ne: true } });
  console.log('Default user:', defaultUser ? { id: defaultUser._id, username: defaultUser.username, instituteId: defaultUser.instituteId } : null);

  const defaultInst = await Institute.findOne({ isDeleted: { $ne: true } });
  console.log('Default institute:', defaultInst ? { id: defaultInst._id, name: defaultInst.name } : null);

  const allInstitutes = await Institute.find().lean();
  console.log('All institutes count:', allInstitutes.length);

  const totalStudents = await Student.countDocuments({ isDeleted: { $ne: true } });
  console.log('Total non-deleted students in DB:', totalStudents);

  const allStudents = await Student.find({ isDeleted: { $ne: true } }).lean();
  console.log('Unique Institute IDs across students:', Array.from(new Set(allStudents.map(s => String(s.instituteId)))));
  console.log('Unique batches across students:', Array.from(new Set(allStudents.map(s => s.batch))));
  console.log('Unique classes across students:', Array.from(new Set(allStudents.map(s => s.class))));
  console.log('Sample student object:', allStudents[0]);

  // Now test the exact query used in /api/teacher/data:
  let instId = null;
  if (defaultUser) instId = defaultUser.instituteId;

  const instQuery = instId ? {
    $or: [
      { instituteId: instId },
      { instituteId: String(instId) },
      { instituteId: { $exists: false } },
      { instituteId: null }
    ]
  } : {};

  console.log('instId used in /api/teacher/data:', instId);
  console.log('instQuery used in /api/teacher/data:', JSON.stringify(instQuery));

  const queryStudents = await Student.find({ ...instQuery, isDeleted: { $ne: true } }).lean();
  console.log('Students returned by /api/teacher/data query:', queryStudents.length);

  await mongoose.disconnect();
}

check().catch(console.error);
