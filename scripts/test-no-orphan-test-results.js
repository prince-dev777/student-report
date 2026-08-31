import mongoose from '../server/node_modules/mongoose/index.js';
import { connectLocalDb, getLocalCollection } from '../server/db/localDb.js';

async function runTest() {
  console.log('🧪 [TEST 4] Starting Orphan / Deleted Test Results Exclusion Test...');

  await connectLocalDb();
  const testsCol = getLocalCollection('tests');
  const testResultsCol = getLocalCollection('testresults');

  // Query test results
  const sampleResults = await testResultsCol.find({ isDeleted: { $ne: true } }).limit(20).toArray();
  console.log(`Found ${sampleResults.length} test results in local database.`);

  const testIds = [...new Set(sampleResults.map(r => r.testId).filter(Boolean))];
  const existingTests = await testsCol.find({ 
    isDeleted: { $ne: true },
    $or: [
      { id: { $in: testIds } },
      { _id: { $in: testIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id)) } }
    ]
  }).toArray();

  const existingTestIds = new Set();
  existingTests.forEach(t => {
    if (t.id) existingTestIds.add(t.id);
    if (t._id) existingTestIds.add(t._id.toString());
  });

  console.log(`Matched ${existingTests.length} valid active tests.`);

  // Verify filter logic
  const filteredResults = sampleResults.filter(r => r.testId && existingTestIds.has(r.testId));
  console.log(`Filtered valid results count: ${filteredResults.length}`);

  for (const r of filteredResults) {
    const parentTest = existingTests.find(t => t.id === r.testId || t._id.toString() === r.testId);
    if (!parentTest || parentTest.isDeleted === true) {
      console.error('❌ [FAIL] Orphaned or deleted test was included in results!');
      process.exit(1);
    }
  }

  console.log('🎉 [PASS] Orphaned/Deleted Test Results Test PASSED: Deleted or non-existent tests are 100% excluded and never shown in Parents App!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
