import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') }); // Load root .env

const CLOUD_URI = 'mongodb://student_report:helloai.com@ac-hqw4l9b-shard-00-00.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-01.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-02.thx91mx.mongodb.net:27017/test?ssl=true&replicaSet=atlas-srcmx3-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0';
const LOCAL_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/student-report';

async function restoreFromCloud() {
  console.log('🔄 Starting Data Restoration from Cloud...');
  let localConn, cloudConn;
  try {
    console.log(`☁️ Connecting to cloud DB: ${CLOUD_URI}`);
    cloudConn = await mongoose.createConnection(CLOUD_URI).asPromise();
    
    console.log(`🔌 Connecting to local DB: ${LOCAL_URI}`);
    localConn = await mongoose.createConnection(LOCAL_URI).asPromise();

    const collections = ['users', 'institutes', 'students', 'tests', 'testresults', 'attendances', 'smslogs'];

    for (const collName of collections) {
      console.log(`📦 Restoring collection: ${collName}...`);
      const cloudColl = cloudConn.collection(collName);
      const localColl = localConn.collection(collName);

      // Fetch all documents from Cloud
      const docs = await cloudColl.find({}).toArray();
      if (docs.length === 0) {
        console.log(`   - 0 documents found in Cloud. Skipping.`);
        continue;
      }

      // Upsert to Local (Download data from Cloud to Local)
      // We use upsert so we don't duplicate existing local data, but overwrite with cloud versions if they exist
      const bulkOps = docs.map(doc => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true
        }
      }));

      const result = await localColl.bulkWrite(bulkOps);
      console.log(`   - Restored ${docs.length} documents (${result.upsertedCount} new, ${result.modifiedCount} updated).`);
    }

    console.log('✅ Data Restoration from Cloud Completed Successfully!');
  } catch (err) {
    console.error('❌ Data Restoration Failed:', err);
    process.exit(1);
  } finally {
    if (localConn) await localConn.close();
    if (cloudConn) await cloudConn.close();
    process.exit(0);
  }
}

restoreFromCloud();
