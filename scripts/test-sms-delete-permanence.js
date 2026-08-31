import mongoose from '../server/node_modules/mongoose/index.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../server/.env') });

const CLOUD_URI = process.env.CLOUD_MONGODB_URI || 'mongodb://student_report:helloai.com@ac-hqw4l9b-shard-00-00.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-01.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-02.thx91mx.mongodb.net:27017/test?ssl=true&replicaSet=atlas-srcmx3-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0';
const LOCAL_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/student-report?directConnection=true';

async function verify() {
  console.log('🧪 [TEST 6] Verifying SMS Logs Permanently 0 in Local & Cloud Atlas...');

  const localConn = await mongoose.createConnection(LOCAL_URI, {
    serverSelectionTimeoutMS: 3000,
    directConnection: true
  }).asPromise();
  const localCol = localConn.collection('smslogs');
  const localCount = await localCol.countDocuments();

  const cloudConn = await mongoose.createConnection(CLOUD_URI, {
    serverSelectionTimeoutMS: 10000
  }).asPromise();
  const cloudCol = cloudConn.useDb('test').collection('smslogs');
  const cloudCount = await cloudCol.countDocuments();

  console.log(`Local SMSLog count: ${localCount}`);
  console.log(`Cloud Atlas SMSLog count: ${cloudCount}`);

  await localConn.close();
  await cloudConn.close();

  if (localCount === 0 && cloudCount === 0) {
    console.log('🎉 [PASS] SMS Logs are completely 0 in both Local DB and Cloud Atlas! They will NEVER return.');
    process.exit(0);
  } else {
    console.error('❌ [FAIL] SMS Logs are not 0!');
    process.exit(1);
  }
}

verify().catch(console.error);
