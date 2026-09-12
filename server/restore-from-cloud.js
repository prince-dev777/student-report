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

    const cloudDb = cloudConn.useDb('test').db;

    // 0. Drain any pending offline tombstones from local queue to Cloud Atlas
    const PENDING_TOMBSTONES_FILE = path.join(__dirname, 'data', 'pending_tombstones.json');
    let pendingTombstones = [];
    try {
      const localPendingColl = localConn.collection('pending_tombstones');
      if (localPendingColl) {
        pendingTombstones = await localPendingColl.find({}).toArray().catch(() => []);
      }
    } catch (e) {}

    if (fs.existsSync(PENDING_TOMBSTONES_FILE)) {
      try {
        const fileData = JSON.parse(fs.readFileSync(PENDING_TOMBSTONES_FILE, 'utf8')) || [];
        pendingTombstones = [...pendingTombstones, ...fileData];
      } catch (e) {}
    }

    if (pendingTombstones.length > 0) {
      logInfo('RESTORE', `⚡ Draining ${pendingTombstones.length} pending offline tombstones to Cloud Atlas...`);
      const tombstonesColl = cloudDb.collection('deletedrecords');
      for (const t of pendingTombstones) {
        if (!t.collectionName) continue;
        const targetCloudColl = cloudDb.collection(t.collectionName);
        const clauses = [];
        if (t.docId && mongoose.Types.ObjectId.isValid(t.docId)) clauses.push({ _id: new mongoose.Types.ObjectId(t.docId) });
        if (t.docId) clauses.push({ _id: String(t.docId) });
        if (t.customId) clauses.push({ id: String(t.customId) });
        if (t.rollNo) clauses.push({ rollNo: String(t.rollNo) });
        if (t.username) clauses.push({ username: String(t.username) });
        if (t.studentId) clauses.push({ studentId: String(t.studentId) });
        if (t.testId) clauses.push({ testId: String(t.testId) });
        if (clauses.length > 0) {
          await targetCloudColl.deleteMany({ $or: clauses }).catch(() => {});
        }
      }

      const cleanTombstones = pendingTombstones.map(t => ({
        collectionName: t.collectionName,
        docId: t.docId ? String(t.docId) : null,
        customId: t.customId ? String(t.customId) : null,
        rollNo: t.rollNo ? String(t.rollNo) : null,
        username: t.username ? String(t.username) : null,
        studentId: t.studentId ? String(t.studentId) : null,
        testId: t.testId ? String(t.testId) : null,
        deletedAt: t.deletedAt ? new Date(t.deletedAt) : new Date()
      }));

      await tombstonesColl.insertMany(cleanTombstones, { ordered: false }).catch(() => {});

      try {
        await localConn.collection('pending_tombstones').deleteMany({}).catch(() => {});
      } catch (e) {}
      if (fs.existsSync(PENDING_TOMBSTONES_FILE)) {
        try { fs.writeFileSync(PENDING_TOMBSTONES_FILE, '[]', 'utf8'); } catch (e) {}
      }
      logInfo('RESTORE', `✅ Successfully drained ${pendingTombstones.length} pending tombstones.`);
    }

    let cloudTombstones = [];
    try {
      cloudTombstones = await cloudDb.collection('deletedrecords').find({}).toArray();
    } catch (tErr) {}

    let localTombstones = [];
    try {
      localTombstones = await localConn.collection('deletedrecords').find({}).toArray();
    } catch (tErr) {}

    const allTombstones = [...cloudTombstones, ...localTombstones];

    const collections = ['users', 'institutes', 'students', 'tests', 'testresults', 'attendances', 'smslogs', 'sessions', 'inquiries', 'notifications', 'voicecalllogs', 'devices'];
    let totalRestored = 0;

    for (const collName of collections) {
      try {
        const cloudColl = cloudDb.collection(collName);
        const localColl = localConn.collection(collName);

        // Purge local & cloud docs that match tombstones
        const collTombstones = allTombstones.filter(t => t.collectionName === collName);
        const tDocIds = collTombstones.map(t => t.docId).filter(Boolean);
        const tCustomIds = collTombstones.map(t => t.customId).filter(Boolean);
        const tRollNos = collTombstones.map(t => t.rollNo).filter(Boolean);
        const tUsernames = collTombstones.map(t => t.username).filter(Boolean);
        const tStudentIds = collTombstones.map(t => t.studentId).filter(Boolean);
        const tTestIds = collTombstones.map(t => t.testId).filter(Boolean);
        const tObjectIds = tDocIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));

        const tombFilterClauses = [
          ...(tDocIds.length > 0 || tObjectIds.length > 0 ? [{ _id: { $in: [...tDocIds, ...tObjectIds] } }] : []),
          ...(tCustomIds.length > 0 ? [{ id: { $in: tCustomIds } }] : []),
          ...(tRollNos.length > 0 ? [{ rollNo: { $in: tRollNos } }] : []),
          ...(tUsernames.length > 0 ? [{ username: { $in: tUsernames } }] : []),
          ...(tStudentIds.length > 0 ? [{ studentId: { $in: tStudentIds } }] : []),
          ...(tTestIds.length > 0 ? [{ testId: { $in: tTestIds } }] : [])
        ];

        if (collTombstones.length > 0 && tombFilterClauses.length > 0) {
          await localColl.deleteMany({ $or: tombFilterClauses }).catch(() => {});
          await cloudColl.deleteMany({ $or: tombFilterClauses }).catch(() => {});
        }

        const tombstoneDocIds = new Set(tDocIds.map(String));
        const tombstoneCustomIds = new Set(tCustomIds.map(String));
        const tombstoneRollNos = new Set(tRollNos.map(String));
        const tombstoneUsernames = new Set(tUsernames.map(String));
        const tombstoneStudentIds = new Set(tStudentIds.map(String));
        const tombstoneTestIds = new Set(tTestIds.map(String));

        // Fetch all documents from Cloud, filtering out tombstoned items
        const rawDocs = await cloudColl.find({}).toArray();
        const docs = rawDocs.filter(d => {
          if (d.isDeleted) return false;
          if (tombstoneDocIds.has(String(d._id))) return false;
          if (d.id && tombstoneCustomIds.has(String(d.id))) return false;
          if (d.rollNo && tombstoneRollNos.has(String(d.rollNo))) return false;
          if (d.username && tombstoneUsernames.has(String(d.username))) return false;
          if (d.studentId && tombstoneStudentIds.has(String(d.studentId))) return false;
          if (d.testId && tombstoneTestIds.has(String(d.testId))) return false;
          return true;
        });

        if (docs.length === 0) {
          logInfo('RESTORE', `Collection [${collName}]: 0 documents found in Cloud (after tombstone filter). Skipping.`);
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
        } else if (collName === 'testresults') {
          bulkOps = docs.map(doc => {
            const repl = { ...doc };
            delete repl._id;
            return {
              updateOne: {
                filter: { $or: [{ testId: doc.testId, studentId: doc.studentId }, { id: doc.id }, { _id: doc._id }] },
                update: { $set: repl },
                upsert: true
              }
            };
          });
        } else if (collName === 'students' || collName === 'tests') {
          bulkOps = docs.map(doc => {
            const repl = { ...doc };
            delete repl._id;
            return {
              updateOne: {
                filter: { $or: [{ id: doc.id }, ...(doc.rollNo ? [{ rollNo: doc.rollNo }] : []), { _id: doc._id }] },
                update: { $set: repl },
                upsert: true
              }
            };
          });
        } else if (collName === 'users') {
          bulkOps = docs.map(doc => {
            const repl = { ...doc };
            delete repl._id;
            return {
              updateOne: {
                filter: { $or: [{ username: doc.username }, { _id: doc._id }] },
                update: { $set: repl },
                upsert: true
              }
            };
          });
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
