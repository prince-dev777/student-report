import mongoose from '../server/node_modules/mongoose/index.js';
const ObjectId = mongoose.Types.ObjectId;
import { connectLocalDb, getLocalCollection } from '../server/db/localDb.js';
import { connectCloudDb, getCloudCollection } from '../server/db/cloudDb.js';
import { performFullSync } from '../server/db/syncEngine.js';

async function runTest() {
  console.log('🧪 [TEST 1] Starting SMS Delete & Sync Resurrection Prevention Test...');

  await connectLocalDb();
  await connectCloudDb();

  const localSMS = getLocalCollection('smslogs');
  const cloudSMS = await getCloudCollection('smslogs');

  // Step 1: Insert test logs
  const testId = `SMS_TEST_${Date.now()}`;
  await localSMS.deleteMany({ id: { $regex: '^SMS_TEST_' } });

  const dummyDoc = {
    _id: new ObjectId(),
    id: testId,
    type: 'custom',
    studentId: 'STUMSXG0DNO6WUR',
    parentPhone: '9673383561',
    message: 'Test automated validation message',
    status: 'pending',
    createdAt: new Date(),
    isDeleted: false
  };

  await localSMS.insertOne(dummyDoc);
  console.log('✅ Step 1: Inserted test SMS doc');

  // Step 2: Simulate Purge All
  await localSMS.deleteMany({ id: testId });
  if (cloudSMS) {
    await cloudSMS.deleteMany({ id: testId });
  }
  console.log('✅ Step 2: Performed hard delete on Local and Cloud');

  // Step 3: Trigger full bidirectional sync
  console.log('🔄 Step 3: Running performFullSync()...');
  const syncRes = await performFullSync();
  console.log('Sync result:', syncRes?.success !== false ? 'SUCCESS' : 'FAILED');

  // Step 4: Verify test log did not resurrect
  const localCheck = await localSMS.findOne({ id: testId });
  const cloudCheck = cloudSMS ? await cloudSMS.findOne({ id: testId }) : null;

  if (!localCheck && !cloudCheck) {
    console.log('🎉 [PASS] SMS Delete Test PASSED: 0 resurrected records found across Local DB & Cloud Atlas!');
  } else {
    console.error('❌ [FAIL] SMS Delete Test FAILED: Record was resurrected!');
    process.exit(1);
  }

  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
