import mongoose from 'mongoose';
import Test from './models/Test.js';

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27018/student-report');
  try {
    // Find a test
    const testDoc = await Test.findOne({});
    if (!testDoc) {
      console.log('No tests found.');
      process.exit();
    }
    console.log('Found Test:', testDoc.id);

    const lookup = { instituteId: testDoc.instituteId, isDeleted: { $ne: true }, $or: [{ id: testDoc.id }] };
    console.log('Lookup:', lookup);
    
    const test = await Test.findOneAndUpdate(
      lookup,
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );
    console.log('Updated test:', test);
  } catch (err) {
    console.error('ERROR:', err);
  }
  process.exit();
}
run();
