import mongoose from 'mongoose';

const testSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true }
});

const TestModel = mongoose.model('TestIdTest', testSchema);

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27018/student-report');
  
  // Create a document
  const doc = new TestModel({ id: "CUSTOM_STRING_123", name: "Test" });
  await doc.save();
  
  // Find it
  const found = await TestModel.findOne({ id: "CUSTOM_STRING_123" });
  console.log("Raw object:", found.toObject());
  console.log("Property .id:", found.id);
  console.log("Property ._id:", found._id);
  
  await TestModel.deleteMany({});
  process.exit();
}
run();
