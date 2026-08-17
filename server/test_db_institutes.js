import mongoose from 'mongoose';
import Test from './models/Test.js';
import User from './models/User.js';

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27018/student-report');
  
  const testDoc = await Test.findOne();
  console.log("Test Institute:", testDoc.instituteId);

  const user = await User.findOne({ role: 'owner' });
  console.log("User Institute:", user.instituteId);

  process.exit();
}
run();
