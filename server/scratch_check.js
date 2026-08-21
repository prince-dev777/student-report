import mongoose from 'mongoose';

async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27018/student-report');
  const Student = mongoose.model('Student', new mongoose.Schema({}, { strict: false }));
  const st = await Student.findOne({ rollNo: { $in: ['340', 340] } });
  console.log('STUDENT 340:', st ? { name: st.name, rollNo: st.rollNo, id: st.id } : 'NOT FOUND');
  
  const sample = await Student.find({ isDeleted: { $ne: true } }).limit(6);
  console.log('SAMPLE STUDENTS:', sample.map(s => ({ name: s.name, rollNo: s.rollNo, id: s.id })));
  
  await mongoose.disconnect();
}

check().catch(console.error);
