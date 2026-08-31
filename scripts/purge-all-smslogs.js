import mongoose from '../server/node_modules/mongoose/index.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../server/.env') });

const CLOUD_URI = process.env.CLOUD_MONGODB_URI || 'mongodb://student_report:helloai.com@ac-hqw4l9b-shard-00-00.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-01.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-02.thx91mx.mongodb.net:27017/test?ssl=true&replicaSet=atlas-srcmx3-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0';
const LOCAL_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/student-report?directConnection=true';

async function purgeAllSMS() {
  console.log('🧹 Purging ALL SMS logs from Local and Cloud Atlas...');

  // 1. Connect Local
  let localConn = null;
  try {
    localConn = await mongoose.createConnection(LOCAL_URI, {
      serverSelectionTimeoutMS: 3000,
      directConnection: true
    }).asPromise();
    const localCol = localConn.collection('smslogs');
    const localDel = await localCol.deleteMany({});
    console.log(`✅ Deleted from Local MongoDB: ${localDel.deletedCount} SMS logs`);
  } catch (err) {
    console.error('Local delete error:', err.message);
  }

  // 2. Connect Cloud Atlas
  let cloudConn = null;
  try {
    cloudConn = await mongoose.createConnection(CLOUD_URI, {
      serverSelectionTimeoutMS: 10000
    }).asPromise();
    const cloudCol = cloudConn.useDb('test').collection('smslogs');
    const cloudDel = await cloudCol.deleteMany({});
    console.log(`✅ Deleted from Cloud Atlas MongoDB: ${cloudDel.deletedCount} SMS logs`);
  } catch (err) {
    console.error('Cloud delete error:', err.message);
  }

  if (localConn) await localConn.close();
  if (cloudConn) await cloudConn.close();

  console.log('🎉 [SUCCESS] All SMS logs have been completely purged from both Local and Cloud Atlas!');
  process.exit(0);
}

purgeAllSMS().catch(console.error);
