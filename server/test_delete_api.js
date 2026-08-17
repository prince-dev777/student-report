import mongoose from 'mongoose';
import Test from './models/Test.js';
import User from './models/User.js';
import TestResult from './models/TestResult.js';

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27018/student-report');
  
  // 1. Un-delete the test we touched in test_debug.js so it appears in the UI
  let testDoc = await Test.findOneAndUpdate(
    { isDeleted: true },
    { $unset: { isDeleted: "", deletedAt: "" } },
    { new: true }
  );
  if (!testDoc) {
    testDoc = await Test.findOne();
  }
  
  if (!testDoc) {
    console.log("No tests exist in DB to test.");
    process.exit();
  }
  
  console.log("Target test ID:", testDoc.id);

  try {
    const updatedTest = await Test.findOneAndUpdate(
      { instituteId: testDoc.instituteId, isDeleted: { $ne: true }, $or: [{id: testDoc.id}] },
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );
    console.log("Updated test in API simulation:", updatedTest ? "Success" : "Not Found");
    
    if (updatedTest) {
      await TestResult.updateMany(
        { testId: updatedTest.id, instituteId: updatedTest.instituteId },
        { isDeleted: true, deletedAt: new Date() }
      );
      console.log("Updated test results");
    }
  } catch (err) {
    console.error("SIMULATION ERROR:", err.message, err.stack);
  }
  
  process.exit();
}
run();
