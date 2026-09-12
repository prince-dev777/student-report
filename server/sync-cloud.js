import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { logInfo, logError, logWarn } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') }); // Load root .env for Cloudinary keys if running locally

const CLOUD_URI = process.env.CLOUD_MONGODB_URI || 'mongodb://student_report:helloai.com@ac-hqw4l9b-shard-00-00.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-01.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-02.thx91mx.mongodb.net:27017/test?ssl=true&replicaSet=atlas-srcmx3-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0';
const dataPath = process.env.USER_DATA_PATH || __dirname;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

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
      return conn;
    } catch (e) {
      // Try next port
    }
  }
  throw new Error('Could not connect to local MongoDB on port 27018 or 27017.');
}

async function syncToCloud() {
  logInfo('SYNC', 'Starting Cloud Sync...');
  let localConn, cloudConn;
  try {
    localConn = await getLocalConnection();
    logInfo('SYNC', 'Connected to local DB.');

    cloudConn = await mongoose.createConnection(CLOUD_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      retryWrites: true,
      w: 'majority'
    }).asPromise();
    logInfo('SYNC', 'Connected to MongoDB Atlas Cloud.');
    
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
      logInfo('SYNC', `⚡ Draining ${pendingTombstones.length} pending offline tombstones to Cloud Atlas...`);
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
      logInfo('SYNC', `✅ Successfully drained ${pendingTombstones.length} pending tombstones.`);
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

    for (const collName of collections) {
      const localColl = localConn.collection(collName);
      const cloudColl = cloudDb.collection(collName);

      const docs = await localColl.find({}).toArray();
      if (docs.length === 0) {
        if (collName === 'smslogs') {
          await cloudColl.deleteMany({});
        }
        continue;
      }

      // Separate active and deleted documents
      const activeDocs = docs.filter(doc => !doc.isDeleted);
      const deletedDocIds = docs.filter(doc => doc.isDeleted).map(doc => doc._id);

      // 1. Purge soft-deleted documents from Cloud
      if (deletedDocIds.length > 0) {
        const purgeRes = await cloudColl.deleteMany({ _id: { $in: deletedDocIds } });
        if (purgeRes.deletedCount > 0) {
          console.log(`   - 🗑️ Purged ${purgeRes.deletedCount} soft-deleted records from Cloud.`);
        }
      }

      // Filter out any local activeDocs that match tombstones so they are NEVER re-uploaded to Cloud!
      const collTombstones = allTombstones.filter(t => t.collectionName === collName);
      const tDocIds = new Set(collTombstones.map(t => String(t.docId)).filter(Boolean));
      const tCustomIds = new Set(collTombstones.map(t => String(t.customId)).filter(Boolean));
      const tRollNos = new Set(collTombstones.map(t => String(t.rollNo)).filter(Boolean));
      const tUsernames = new Set(collTombstones.map(t => String(t.username)).filter(Boolean));
      const tStudentIds = new Set(collTombstones.map(t => String(t.studentId)).filter(Boolean));
      const tTestIds = new Set(collTombstones.map(t => String(t.testId)).filter(Boolean));

      // Also purge matching records from cloudColl immediately
      const tObjectIds = Array.from(tDocIds).filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
      const tombPurgeClauses = [
        ...(tDocIds.size > 0 || tObjectIds.length > 0 ? [{ _id: { $in: [...Array.from(tDocIds), ...tObjectIds] } }] : []),
        ...(tCustomIds.size > 0 ? [{ id: { $in: Array.from(tCustomIds) } }] : []),
        ...(tRollNos.size > 0 ? [{ rollNo: { $in: Array.from(tRollNos) } }] : []),
        ...(tUsernames.size > 0 ? [{ username: { $in: Array.from(tUsernames) } }] : []),
        ...(tStudentIds.size > 0 ? [{ studentId: { $in: Array.from(tStudentIds) } }] : []),
        ...(tTestIds.size > 0 ? [{ testId: { $in: Array.from(tTestIds) } }] : [])
      ];

      if (tombPurgeClauses.length > 0) {
        await cloudColl.deleteMany({ $or: tombPurgeClauses }).catch(() => {});
      }

      const cleanActiveDocs = [];
      const tombstonedLocalIds = [];
      for (const doc of activeDocs) {
        const isTombstoned = tDocIds.has(String(doc._id)) ||
          (doc.id && tCustomIds.has(String(doc.id))) ||
          (doc.rollNo && tRollNos.has(String(doc.rollNo))) ||
          (doc.username && tUsernames.has(String(doc.username))) ||
          (doc.studentId && tStudentIds.has(String(doc.studentId))) ||
          (doc.testId && tTestIds.has(String(doc.testId)));
        if (isTombstoned) {
          tombstonedLocalIds.push(doc._id);
        } else {
          cleanActiveDocs.push(doc);
        }
      }

      if (tombstonedLocalIds.length > 0) {
        await localColl.deleteMany({ _id: { $in: tombstonedLocalIds } }).catch(() => {});
        console.log(`   - 🧹 Purged ${tombstonedLocalIds.length} tombstoned records from local [${collName}]`);
      }

      if (cleanActiveDocs.length === 0) {
        console.log(`   - 0 active documents to sync (after tombstone filter).`);
        continue;
      }

      // Process specific collections for local file uploads (OMR images)
      if (collName === 'testresults') {
        let publishedTestIds = new Set();
        try {
          const publishedTests = await localConn.collection('tests').find({ status: 'Published' }).project({ id: 1, _id: 1 }).toArray();
          publishedTests.forEach(t => {
            if (t.id) publishedTestIds.add(String(t.id));
            if (t._id) publishedTestIds.add(String(t._id));
          });
        } catch (tErr) {}

        for (let i = 0; i < cleanActiveDocs.length; i++) {
          const doc = cleanActiveDocs[i];
          const testIdStr = String(doc.testId || '');
          if (!publishedTestIds.has(testIdStr)) {
            continue;
          }

          if (doc.omrSheetImage && doc.omrSheetImage.startsWith('/uploads/omr/')) {
            const localFilePath = path.join(dataPath, doc.omrSheetImage);
            if (fs.existsSync(localFilePath)) {
              console.log(`   - 📤 Uploading published OMR image to Cloudinary: ${doc.omrSheetImage}`);
              try {
                const uploadRes = await cloudinary.uploader.upload(localFilePath, {
                  folder: 'student_report_omr',
                  format: 'jpg'
                });
                doc.omrSheetImage = uploadRes.secure_url;
                doc.omrSheetPublicId = uploadRes.public_id;
                
                await localColl.updateOne({ _id: doc._id }, { $set: { omrSheetImage: uploadRes.secure_url, omrSheetPublicId: uploadRes.public_id } });
              } catch (uploadErr) {
                console.error(`   - ❌ Failed to upload OMR image for test result ${doc._id}:`, uploadErr.message);
              }
            } else {
              console.warn(`   - ⚠️ Local OMR image not found at ${localFilePath}`);
            }
          }
        }
      }

      // Upsert active documents to cloud safely using multi-key filters
      let bulkOps;
      if (collName === 'attendances') {
        bulkOps = cleanActiveDocs.map(doc => ({
          replaceOne: {
            filter: { studentId: doc.studentId, date: doc.date },
            replacement: doc,
            upsert: true
          }
        }));
      } else if (collName === 'students' || collName === 'tests') {
        bulkOps = cleanActiveDocs.map(doc => {
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
      } else if (collName === 'testresults') {
        bulkOps = cleanActiveDocs.map(doc => {
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
      } else if (collName === 'users') {
        bulkOps = cleanActiveDocs.map(doc => {
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
        bulkOps = cleanActiveDocs.map(doc => ({
          replaceOne: {
            filter: { _id: doc._id },
            replacement: doc,
            upsert: true
          }
        }));
      }

      let result = { upsertedCount: 0, modifiedCount: 0 };
      try {
        result = await cloudColl.bulkWrite(bulkOps, { ordered: false });
      } catch (bulkErr) {
        if (bulkErr.result) {
          result = bulkErr.result;
        }
        console.warn(`   - ⚠️ Notice on [${collName}] bulkWrite:`, bulkErr.message?.slice(0, 100));
      }
      
      // For sessions and configuration collections, purge documents from cloud that were deleted locally
      if (['sessions', 'institutes'].includes(collName)) {
        const localActiveIds = activeDocs.map(d => d._id);
        const cloudPurge = await cloudColl.deleteMany({ _id: { $nin: localActiveIds } });
        if (cloudPurge.deletedCount > 0) {
          console.log(`   - 🗑️ Purged ${cloudPurge.deletedCount} deleted sessions from Cloud.`);
        }
      }

      console.log(`   - Synced ${activeDocs.length} active documents (${result.upsertedCount || 0} new, ${result.modifiedCount || 0} updated).`);
    }

    const syncTime = new Date().toISOString();
    try {
      fs.writeFileSync(path.join(__dirname, 'sync-status.json'), JSON.stringify({ lastSync: syncTime }));
    } catch (e) {}

    logInfo('SYNC', `✅ Cloud Sync Completed Successfully at ${syncTime}`);
  } catch (err) {
    logError('SYNC', '❌ Cloud Sync Failed', err);
  } finally {
    if (localConn) await localConn.close();
    if (cloudConn) await cloudConn.close();
    process.exit(0);
  }
}

syncToCloud();
