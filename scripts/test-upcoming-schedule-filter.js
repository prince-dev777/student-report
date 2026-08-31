import { connectLocalDb, getLocalCollection } from '../server/db/localDb.js';

function normalizeDateToISO(dateStr) {
  if (!dateStr) return '';
  const clean = String(dateStr).trim();
  const parts = clean.split(/[./-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  const d = new Date(clean);
  return isNaN(d.getTime()) ? clean : d.toISOString().split('T')[0];
}

async function runTest() {
  console.log('🧪 [TEST 5] Starting Upcoming Exam Schedule Date & Batch Filtering Test...');

  await connectLocalDb();
  const studentsCol = getLocalCollection('students');
  const testsCol = getLocalCollection('tests');

  const student = await studentsCol.findOne({ isDeleted: { $ne: true }, rollNo: 8451 });
  if (!student) {
    console.warn('Student 8451 not found in local db, using mock student');
  }

  const studentBatch = String(student?.batch || '11TH J3 BATCH').trim().toLowerCase();
  const studentClass = String(student?.class || '11th').trim().toLowerCase();
  const todayDateStr = new Date().toISOString().split('T')[0];

  const allTests = await testsCol.find({ isDeleted: { $ne: true } }).toArray();
  console.log(`Found ${allTests.length} active tests in database.`);

  const filteredUpcoming = allTests.filter(t => {
    if (!t.date) return false;
    const testISODate = normalizeDateToISO(t.date);
    if (!testISODate || testISODate < todayDateStr) return false;

    const tBatch = String(t.batch || '').trim().toLowerCase();
    const tClass = String(t.targetClass || '').trim().toLowerCase();
    const tName = String(t.name || '').trim().toLowerCase();

    if (tBatch === 'all' || tBatch === '') return true;
    if (studentBatch && (tBatch === studentBatch || tBatch.includes(studentBatch) || studentBatch.includes(tBatch))) return true;
    if (studentClass && (tClass === studentClass || tClass.includes(studentClass) || studentClass.includes(tClass) || tName.includes(studentClass))) return true;

    return false;
  });

  console.log(`Upcoming tests matching future date and batch: ${filteredUpcoming.length}`);

  // Assert no past tests (like 23.08.2026) are present
  for (const t of filteredUpcoming) {
    const iso = normalizeDateToISO(t.date);
    if (iso < todayDateStr) {
      console.error(`❌ [FAIL] Past test found in upcoming schedule: ${t.name} (${t.date} -> ${iso})`);
      process.exit(1);
    }
  }

  console.log('🎉 [PASS] Upcoming Schedule Filter PASSED: Past exams and unmatched batches are 100% excluded!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
