import { connectLocalDb, getLocalCollection } from '../server/db/localDb.js';
import { getCloudCollection } from '../server/services/syncEngine.js';

async function run() {
  console.log('🧪 Checking SMS logs in local and cloud...');
  await connectLocalDb();
  const localCol = getLocalCollection('smslogs');
  const localCount = await localCol.countDocuments();
  console.log(`Local SMSLog count before delete: ${localCount}`);

  let cloudCount = 0;
  try {
    const cloudCol = await getCloudCollection('smslogs');
    if (cloudCol) {
      cloudCount = await cloudCol.countDocuments();
      console.log(`Cloud Atlas SMSLog count before delete: ${cloudCount}`);
    }
  } catch (e) {
    console.warn('Cloud check error:', e.message);
  }

  // Delete all from Local
  const localDel = await localCol.deleteMany({});
  console.log(`Deleted from Local DB: ${localDel.deletedCount}`);

  // Delete all from Cloud Atlas
  try {
    const cloudCol = await getCloudCollection('smslogs');
    if (cloudCol) {
      const cloudDel = await cloudCol.deleteMany({});
      console.log(`Deleted from Cloud Atlas: ${cloudDel.deletedCount}`);
    }
  } catch (e) {
    console.warn('Cloud delete error:', e.message);
  }

  const finalLocal = await localCol.countDocuments();
  console.log(`Final Local SMSLog count: ${finalLocal}`);
  process.exit(0);
}

run().catch(console.error);
