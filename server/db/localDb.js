import mongoose from 'mongoose';
import { logInfo, logError, logWarn } from '../utils/logger.js';

let localConnection = null;

export const LOCAL_MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/student-report';

export async function connectLocalDb() {
  if (localConnection && localConnection.readyState === 1) {
    return localConnection;
  }

  const primaryUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/student-report';
  const fallbackLocalUri = 'mongodb://127.0.0.1:27017/student-report';
  const cloudFallbackUri = process.env.CLOUD_MONGODB_URI || 
    'mongodb://student_report:helloai.com@ac-hqw4l9b-shard-00-00.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-01.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-02.thx91mx.mongodb.net:27017/test?ssl=true&replicaSet=atlas-srcmx3-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0';

  // 1. Try Local Embedded MongoDB (Port 27018)
  try {
    logInfo('LOCAL_DB', `Connecting to Local MongoDB at ${primaryUri}...`);
    localConnection = await mongoose.connect(primaryUri, {
      serverSelectionTimeoutMS: 1200,
      connectTimeoutMS: 1200
    });
    logInfo('LOCAL_DB', '✅ Connected to Local MongoDB (Port 27018). Offline mode ready.');
    return localConnection;
  } catch (err1) {
    // 2. Try Standard Local MongoDB (Port 27017)
    try {
      logInfo('LOCAL_DB', `Port 27018 unavailable, trying standard port 27017...`);
      localConnection = await mongoose.connect(fallbackLocalUri, {
        serverSelectionTimeoutMS: 1200,
        connectTimeoutMS: 1200
      });
      logInfo('LOCAL_DB', '✅ Connected to Local MongoDB (Port 27017). Offline mode ready.');
      return localConnection;
    } catch (err2) {
      // 3. Fallback to Cloud Atlas (if internet is available)
      logWarn('LOCAL_DB', 'Local mongod is not active. Attempting Cloud Atlas fallback...');
      try {
        localConnection = await mongoose.connect(cloudFallbackUri, {
          serverSelectionTimeoutMS: 3000,
          connectTimeoutMS: 3000
        });
        logInfo('LOCAL_DB', '✅ Connected to Cloud Atlas.');
        return localConnection;
      } catch (cloudErr) {
        logWarn('LOCAL_DB', `⚠️ Running in Offline Standalone Mode (No Cloud Connection: ${cloudErr.message})`);
        throw cloudErr;
      }
    }
  }
}

export function getLocalDb() {
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  return localConnection;
}

export function isLocalDbReady() {
  return mongoose.connection && mongoose.connection.readyState === 1;
}

export function getLocalCollection(collectionName) {
  const db = getLocalDb();
  if (!db) throw new Error('Local database is not connected');
  return db.collection(collectionName);
}
