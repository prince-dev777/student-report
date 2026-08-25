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

  try {
    logInfo('LOCAL_DB', `Connecting to Local MongoDB at ${primaryUri}...`);
    localConnection = await mongoose.connect(primaryUri, {
      serverSelectionTimeoutMS: 2000,
      connectTimeoutMS: 2000
    });
    logInfo('LOCAL_DB', '✅ Connected to Local MongoDB (Port 27018).');
    return localConnection;
  } catch (err1) {
    try {
      logInfo('LOCAL_DB', `Port 27018 unavailable, trying standard port 27017...`);
      localConnection = await mongoose.connect(fallbackLocalUri, {
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 2000
      });
      logInfo('LOCAL_DB', '✅ Connected to Local MongoDB (Port 27017).');
      return localConnection;
    } catch (err2) {
      logWarn('LOCAL_DB', 'Local mongod is not active. Connecting to Cloud Atlas fallback...');
      localConnection = await mongoose.connect(cloudFallbackUri, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000
      });
      logInfo('LOCAL_DB', '✅ Connected to Cloud Atlas.');
      return localConnection;
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
