import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { logInfo, logError, logWarn } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ALL_COLLECTIONS = [
  'users',
  'institutes',
  'students',
  'tests',
  'testresults',
  'attendances',
  'smslogs',
  'sessions',
  'inquiries',
  'notifications',
  'voicecalllogs',
  'devices'
];

export async function generateDatabaseSnapshot(dataPath) {
  if (mongoose.connection.readyState !== 1) {
    return null;
  }

  try {
    const backupDir = dataPath ? path.join(dataPath, 'backup') : path.join(__dirname, '..', 'backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const snapshot = {
      exportedAt: new Date().toISOString(),
      appVersion: '1.0.41',
      totalCollections: ALL_COLLECTIONS.length,
      data: {}
    };

    let totalRecords = 0;

    for (const collName of ALL_COLLECTIONS) {
      try {
        const coll = mongoose.connection.collection(collName);
        const docs = await coll.find({ isDeleted: { $ne: true } }).toArray();
        snapshot.data[collName] = docs;
        totalRecords += docs.length;
      } catch (err) {
        logWarn('SNAPSHOT', `Could not export collection [${collName}]: ${err.message}`);
        snapshot.data[collName] = [];
      }
    }

    snapshot.totalRecords = totalRecords;

    const snapshotFile = path.join(backupDir, 'database_snapshot.json');
    fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2), 'utf8');

    logInfo('SNAPSHOT', `✅ Local Database JSON Snapshot saved (${totalRecords} records across ${ALL_COLLECTIONS.length} collections)`);
    return {
      filePath: snapshotFile,
      totalRecords,
      exportedAt: snapshot.exportedAt
    };
  } catch (err) {
    logError('SNAPSHOT', 'Failed to generate database snapshot', err);
    return null;
  }
}
