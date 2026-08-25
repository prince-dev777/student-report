import mongoose from 'mongoose';
import { logInfo, logError, logWarn } from '../utils/logger.js';

export const CLOUD_MONGODB_URI = process.env.CLOUD_MONGODB_URI || 
  'mongodb://student_report:helloai.com@ac-hqw4l9b-shard-00-00.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-01.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-02.thx91mx.mongodb.net:27017/test?ssl=true&replicaSet=atlas-srcmx3-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0';

let cloudConnectionPool = null;

export async function connectCloudDb() {
  if (cloudConnectionPool && cloudConnectionPool.readyState === 1) {
    return cloudConnectionPool;
  }

  try {
    logInfo('CLOUD_DB', 'Connecting to MongoDB Atlas Cloud Cluster...');
    cloudConnectionPool = await mongoose.createConnection(CLOUD_MONGODB_URI, {
      serverSelectionTimeoutMS: 12000,
      connectTimeoutMS: 12000,
      maxPoolSize: 10,
      minPoolSize: 2
    }).asPromise();

    logInfo('CLOUD_DB', '✅ Connected to MongoDB Atlas Cloud Cluster successfully.');
    return cloudConnectionPool;
  } catch (err) {
    logWarn('CLOUD_DB', `Failed to connect to MongoDB Atlas Cloud: ${err.message}`);
    cloudConnectionPool = null;
    return null;
  }
}

export function getCloudDb() {
  if (cloudConnectionPool && cloudConnectionPool.readyState === 1) {
    return cloudConnectionPool.useDb('test').db;
  }
  return null;
}

export async function getCloudCollection(collectionName) {
  let conn = cloudConnectionPool;
  if (!conn || conn.readyState !== 1) {
    conn = await connectCloudDb();
  }
  if (!conn || conn.readyState !== 1) {
    return null;
  }
  return conn.useDb('test').db.collection(collectionName);
}

export async function isCloudDbAvailable() {
  try {
    const conn = await connectCloudDb();
    return !!(conn && conn.readyState === 1);
  } catch (e) {
    return false;
  }
}
