import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { logInfo, logError, logWarn } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') }); // Load root .env

const CLOUD_URI = process.env.CLOUD_MONGODB_URI || 'mongodb://student_report:helloai.com@ac-hqw4l9b-shard-00-00.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-01.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-02.thx91mx.mongodb.net:27017/test?ssl=true&replicaSet=atlas-srcmx3-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0';

async function getLocalConnection() {
  const possibleUris = [
    process.env.MONGODB_URI,
    'mongodb://127.0.0.1:27018/student-report?directConnection=true',
    'mongodb://127.0.0.1:27017/student-report?directConnection=true',
    'mongodb://localhost:27018/student-report?directConnection=true',
    'mongodb://localhost:27017/student-report?directConnection=true',
    'mongodb://127.0.0.1:27018/student-report',
    'mongodb://127.0.0.1:27017/student-report'
  ].filter(Boolean);

  for (const uri of possibleUris) {
    try {
      const conn = await mongoose.createConnection(uri, {
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 2000,
        directConnection: true
      }).asPromise();
      logInfo('RESTORE', `Successfully connected to local MongoDB at: ${uri}`);
      return conn;
    } catch (e) {
      // Try next port
    }
  }
  throw new Error('Could not connect to local MongoDB on port 27018 or 27017. Please ensure MongoDB is running.');
}

async function restoreFromCloud() {
  logInfo('RESTORE', 'Starting Data Restoration from Cloud...');
  let localConn, cloudConn;
  try {
    logInfo('RESTORE', `Connecting to cloud DB: ${CLOUD_URI.replace(/:[^:@]+@/, ':****@')}`);
    cloudConn = await mongoose.createConnection(CLOUD_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000
    }).asPromise();
    logInfo('RESTORE', 'Successfully connected to MongoDB Atlas Cloud.');
    
    localConn = await getLocalConnection();

    const collections = ['users', 'institutes', 'students', 'tests', 'testresults', 'attendances', 'smslogs', 'sessions', 'inquiries', 'notifications', 'voicecalllogs', 'devices'];
    let totalRestored = 0;

    for (const collName of collections) {
      try {
        const cloudColl = cloudConn.useDb('test').db.collection(collName);
        const localColl = localConn.collection(collName);

        // Fetch all documents from Cloud
        const docs = await cloudColl.find({}).toArray();
        if (docs.length === 0) {
          logInfo('RESTORE', `Collection [${collName}]: 0 documents found in Cloud. Skipping.`);
          continue;
        }

        // Upsert to Local
        let bulkOps;
        if (collName === 'attendances') {
          bulkOps = docs.map(doc => ({
            replaceOne: {
              filter: { studentId: doc.studentId, date: doc.date },
              replacement: doc,
              upsert: true
            }
          }));
        } else {
          bulkOps = docs.map(doc => ({
            replaceOne: {
              filter: { _id: doc._id },
              replacement: doc,
              upsert: true
            }
          }));
        }

        let result = { upsertedCount: 0, modifiedCount: 0 };
        try {
          result = await localColl.bulkWrite(bulkOps, { ordered: false });
        } catch (bulkErr) {
          if (bulkErr.result) result = bulkErr.result;
        }
        totalRestored += docs.length;
        logInfo('RESTORE', `Collection [${collName}]: Restored ${docs.length} documents (${result.upsertedCount || 0} new, ${result.modifiedCount || 0} updated).`);

        // Purge orphaned local records for configuration collections (sessions, institutes, users)
        if (['sessions', 'institutes', 'users', 'smslogs'].includes(collName)) {
          const cloudIds = docs.map(d => d._id);
          const purgeRes = await localColl.deleteMany({ _id: { $nin: cloudIds } });
          if (purgeRes.deletedCount > 0) {
            logInfo('RESTORE', `Collection [${collName}]: Cleaned up ${purgeRes.deletedCount} orphaned local records.`);
          }
        }
      } catch (collErr) {
        logWarn('RESTORE', `Warning on collection [${collName}]: ${collErr.message}`);
      }
    }

    logInfo('RESTORE', `✅ Data Restoration Completed Successfully! Total records restored: ${totalRestored}`);
  } catch (err) {
    logError('RESTORE', 'Data Restoration Failed', err);
    process.exit(1);
  } finally {
    if (localConn) await localConn.close();
    if (cloudConn) await cloudConn.close();
    process.exit(0);
  }
}

restoreFromCloud();
