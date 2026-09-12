import mongoose from 'mongoose';
import { getLocalDb, getLocalCollection, isLocalDbReady } from './localDb.js';
import { connectCloudDb, getCloudDb, getCloudCollection, isCloudDbAvailable } from './cloudDb.js';
import { ALL_COLLECTIONS } from '../services/jsonBackupService.js';
import { logInfo, logError, logWarn } from '../utils/logger.js';
import { uploadOMRScan, uploadStudentPhoto } from '../services/cloudinaryService.js';
import fs from 'fs';
import path from 'path';
import { mergeDuplicatesOnDb } from './duplicateCleaner.js';

let isSyncing = false;
let pendingSync = false;
let lastSyncTimestamp = null;
let sseBroadcastCallback = null;

export function registerSSEBroadcaster(fn) {
  sseBroadcastCallback = fn;
}

function broadcastUpdate(event, data = {}) {
  if (typeof sseBroadcastCallback === 'function') {
    sseBroadcastCallback(event, data);
  }
}

/**
 * Deep converter to ensure string hex ObjectIds are converted to real mongoose.Types.ObjectId
 */
export function fixObjectIds(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string' && /^[a-f0-9]{24}$/.test(obj)) {
    try {
      return new mongoose.Types.ObjectId(obj);
    } catch (e) {
      return obj;
    }
  }
  if (Array.isArray(obj)) return obj.map(fixObjectIds);
  if (typeof obj === 'object' && !(obj instanceof Date) && !(obj instanceof mongoose.Types.ObjectId)) {
    const fixed = {};
    for (const [k, v] of Object.entries(obj)) {
      fixed[k] = fixObjectIds(v);
    }
    return fixed;
  }
  return obj;
}

/**
 * Mirror write to Cloud Atlas immediately upon any local creation or update
 */
export async function mirrorWrite(collectionName, doc) {
  if (!doc) return;
  try {
    const cloudColl = await getCloudCollection(collectionName);
    if (!cloudColl) return;

    const repl = { ...doc };
    delete repl._id;

    if (collectionName === 'students' || collectionName === 'tests') {
      if (collectionName === 'students' && !repl.photo) {
        delete repl.photo;
      }
      await cloudColl.updateOne(
        { $or: [{ id: doc.id }, { _id: doc._id }] },
        { $set: repl },
        { upsert: true }
      );
    } else if (collectionName === 'testresults') {
      await cloudColl.updateOne(
        { $or: [{ testId: doc.testId, studentId: doc.studentId }, { id: doc.id }, { _id: doc._id }] },
        { $set: repl },
        { upsert: true }
      );
    } else if (collectionName === 'attendances' && doc.studentId && doc.date) {
      await cloudColl.updateOne(
        { studentId: doc.studentId, date: doc.date },
        { $set: repl },
        { upsert: true }
      );
    } else {
      await cloudColl.updateOne(
        { _id: doc._id },
        { $set: repl },
        { upsert: true }
      );
    }
    logInfo('SYNC_MIRROR', `⚡ Mirrored doc [${doc._id || doc.id}] to Cloud [${collectionName}]`);
  } catch (err) {
    logWarn('SYNC_MIRROR', `Failed to mirror write on [${collectionName}]: ${err.message}`);
  }
}

const PENDING_TOMBSTONES_FILE = path.join(process.cwd(), 'server', 'data', 'pending_tombstones.json');

function ensureDataDirExists() {
  const dir = path.dirname(PENDING_TOMBSTONES_FILE);
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  }
}

/**
 * Save tombstones locally for offline persistence
 */
export async function savePendingTombstones(tombstones) {
  if (!Array.isArray(tombstones) || tombstones.length === 0) return;
  
  // 1. Save to Local MongoDB pending_tombstones collection
  try {
    const localColl = getLocalCollection('pending_tombstones');
    if (localColl) {
      await localColl.insertMany(tombstones.map(t => ({ ...t, createdAt: new Date() })), { ordered: false }).catch(() => {});
    }
  } catch (err) {}

  // 2. Save to local disk JSON file for 100% durability across restarts
  try {
    ensureDataDirExists();
    let existing = [];
    if (fs.existsSync(PENDING_TOMBSTONES_FILE)) {
      try {
        existing = JSON.parse(fs.readFileSync(PENDING_TOMBSTONES_FILE, 'utf8')) || [];
      } catch (e) { existing = []; }
    }
    const combined = [...existing, ...tombstones];
    const seen = new Set();
    const unique = combined.filter(t => {
      const k = `${t.collectionName}_${t.docId || ''}_${t.customId || ''}_${t.rollNo || ''}_${t.username || ''}_${t.studentId || ''}_${t.testId || ''}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    fs.writeFileSync(PENDING_TOMBSTONES_FILE, JSON.stringify(unique, null, 2), 'utf8');
  } catch (err) {
    logWarn('SYNC_DELETE', `Failed to write pending_tombstones.json: ${err.message}`);
  }
}

/**
 * Drain pending offline tombstones to Cloud Atlas
 */
export async function drainPendingTombstones() {
  const cloudConn = await connectCloudDb();
  if (!cloudConn || cloudConn.readyState !== 1) return false;

  try {
    const cloudDb = cloudConn.useDb('test').db;
    const tombstonesColl = cloudDb.collection('deletedrecords');
    tombstonesColl.createIndex({ deletedAt: 1 }, { expireAfterSeconds: 1209600 }).catch(() => {});

    // Read from both Local DB collection and Disk JSON file
    let pending = [];
    try {
      const localColl = getLocalCollection('pending_tombstones');
      if (localColl) {
        pending = await localColl.find({}).toArray().catch(() => []);
      }
    } catch (e) {}

    let filePending = [];
    if (fs.existsSync(PENDING_TOMBSTONES_FILE)) {
      try {
        filePending = JSON.parse(fs.readFileSync(PENDING_TOMBSTONES_FILE, 'utf8')) || [];
      } catch (e) {}
    }

    const allPending = [...pending, ...filePending];
    if (allPending.length === 0) return true;

    // Deduplicate
    const seen = new Set();
    const uniquePending = allPending.filter(t => {
      const k = `${t.collectionName}_${t.docId || ''}_${t.customId || ''}_${t.rollNo || ''}_${t.username || ''}_${t.studentId || ''}_${t.testId || ''}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    logInfo('SYNC_TOMBSTONE', `⚡ Draining ${uniquePending.length} pending offline tombstones to Cloud Atlas...`);

    // For each unique tombstone: purge matching records from Cloud Atlas collection
    for (const t of uniquePending) {
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

    // Insert clean tombstones into Cloud Atlas deletedrecords
    const cleanTombstones = uniquePending.map(t => ({
      collectionName: t.collectionName,
      docId: t.docId ? String(t.docId) : null,
      customId: t.customId ? String(t.customId) : null,
      rollNo: t.rollNo ? String(t.rollNo) : null,
      username: t.username ? String(t.username) : null,
      studentId: t.studentId ? String(t.studentId) : null,
      testId: t.testId ? String(t.testId) : null,
      deletedAt: t.deletedAt ? new Date(t.deletedAt) : new Date()
    }));

    if (cleanTombstones.length > 0) {
      await tombstonesColl.insertMany(cleanTombstones, { ordered: false }).catch(() => {});
    }

    // Clear local pending queue
    try {
      const localColl = getLocalCollection('pending_tombstones');
      if (localColl) await localColl.deleteMany({}).catch(() => {});
    } catch (e) {}

    if (fs.existsSync(PENDING_TOMBSTONES_FILE)) {
      try { fs.writeFileSync(PENDING_TOMBSTONES_FILE, '[]', 'utf8'); } catch (e) {}
    }

    logInfo('SYNC_TOMBSTONE', `✅ Successfully drained & synchronized ${uniquePending.length} tombstones to Cloud Atlas.`);
    return true;
  } catch (err) {
    logWarn('SYNC_TOMBSTONE', `Failed to drain pending tombstones: ${err.message}`);
    return false;
  }
}

/**
 * Direct Dual-Delete: Permanently deletes record and related items from BOTH Local and Cloud DBs,
 * using multi-key matching (id, rollNo, username, studentId, testId) so records never resurrect.
 */
export async function dualDelete(collectionName, filter, cascadeRelations = []) {
  try {
    let localColl = null;
    try {
      localColl = getLocalCollection(collectionName);
    } catch (e) {}

    const cloudColl = await getCloudCollection(collectionName);
    const fixedFilter = fixObjectIds(filter);

    // 0. Resolve ALL matching documents and their multi-key identifiers across both Local and Cloud
    let localDocs = [];
    let cloudDocs = [];

    try {
      if (localColl) {
        localDocs = await localColl.find(fixedFilter).toArray().catch(() => []);
      }
    } catch (e) {}

    // Extract identifiers from local docs to search on Cloud as well
    const searchKeys = {
      _ids: new Set(localDocs.map(d => String(d._id))),
      ids: new Set(localDocs.map(d => d.id).filter(Boolean)),
      rollNos: new Set(localDocs.map(d => d.rollNo ? String(d.rollNo) : null).filter(Boolean)),
      usernames: new Set(localDocs.map(d => d.username ? String(d.username) : null).filter(Boolean)),
      studentIds: new Set(localDocs.map(d => d.studentId ? String(d.studentId) : null).filter(Boolean)),
      testIds: new Set(localDocs.map(d => d.testId ? String(d.testId) : null).filter(Boolean))
    };

    // Extract directly from filter clauses
    const extractFilterKeys = (f) => {
      if (!f || typeof f !== 'object') return;
      if (f._id) {
        if (Array.isArray(f._id?.$in)) f._id.$in.forEach(id => searchKeys._ids.add(String(id)));
        else searchKeys._ids.add(String(f._id));
      }
      if (f.id) {
        if (Array.isArray(f.id?.$in)) f.id.$in.forEach(id => searchKeys.ids.add(String(id)));
        else searchKeys.ids.add(String(f.id));
      }
      if (f.rollNo) {
        if (Array.isArray(f.rollNo?.$in)) f.rollNo.$in.forEach(r => searchKeys.rollNos.add(String(r)));
        else searchKeys.rollNos.add(String(f.rollNo));
      }
      if (f.username) {
        if (Array.isArray(f.username?.$in)) f.username.$in.forEach(u => searchKeys.usernames.add(String(u)));
        else searchKeys.usernames.add(String(f.username));
      }
      if (f.studentId) {
        if (Array.isArray(f.studentId?.$in)) f.studentId.$in.forEach(s => searchKeys.studentIds.add(String(s)));
        else searchKeys.studentIds.add(String(f.studentId));
      }
      if (f.testId) {
        if (Array.isArray(f.testId?.$in)) f.testId.$in.forEach(t => searchKeys.testIds.add(String(t)));
        else searchKeys.testIds.add(String(f.testId));
      }
      if (Array.isArray(f.$or)) f.$or.forEach(extractFilterKeys);
    };
    extractFilterKeys(fixedFilter);

    // Build comprehensive query for Cloud search & delete
    const buildOrQuery = (keys, fallback) => {
      const orClauses = [];
      const objIds = Array.from(keys._ids).filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
      const strIds = Array.from(keys._ids);
      if (objIds.length > 0 || strIds.length > 0) {
        orClauses.push({ _id: { $in: [...objIds, ...strIds] } });
      }
      if (keys.ids.size > 0) orClauses.push({ id: { $in: Array.from(keys.ids) } });
      if (keys.rollNos.size > 0) orClauses.push({ rollNo: { $in: Array.from(keys.rollNos) } });
      if (keys.usernames.size > 0) orClauses.push({ username: { $in: Array.from(keys.usernames) } });
      if (keys.studentIds.size > 0) orClauses.push({ studentId: { $in: Array.from(keys.studentIds) } });
      if (keys.testIds.size > 0) orClauses.push({ testId: { $in: Array.from(keys.testIds) } });
      return orClauses.length > 0 ? { $or: orClauses } : fallback;
    };

    const initialCloudQuery = buildOrQuery(searchKeys, fixedFilter);

    try {
      if (cloudColl) {
        cloudDocs = await cloudColl.find(initialCloudQuery).toArray().catch(() => []);
        cloudDocs.forEach(cd => {
          if (cd._id) searchKeys._ids.add(String(cd._id));
          if (cd.id) searchKeys.ids.add(String(cd.id));
          if (cd.rollNo) searchKeys.rollNos.add(String(cd.rollNo));
          if (cd.username) searchKeys.usernames.add(String(cd.username));
          if (cd.studentId) searchKeys.studentIds.add(String(cd.studentId));
          if (cd.testId) searchKeys.testIds.add(String(cd.testId));
        });
      }
    } catch (e) {}

    const universalDeleteFilter = buildOrQuery(searchKeys, fixedFilter);

    // 1. Delete from Local DB
    let localDeleted = 0;
    if (localColl) {
      const localRes = await localColl.deleteMany(universalDeleteFilter).catch(() => ({ deletedCount: 0 }));
      localDeleted = localRes.deletedCount || 0;
    }

    // 2. Delete from Cloud Atlas
    let cloudDeleted = 0;
    let cloudConnected = false;
    if (cloudColl) {
      try {
        const cloudRes = await cloudColl.deleteMany(universalDeleteFilter);
        cloudDeleted = cloudRes.deletedCount || 0;
        cloudConnected = true;
      } catch (cloudErr) {
        logWarn('SYNC_DELETE', `Cloud delete error on [${collectionName}]: ${cloudErr.message}`);
      }
    }

    // Build rich tombstones
    const tombstonesToRecord = [];
    const seenTombstoneKeys = new Set();
    const addTombstone = (t) => {
      const key = `${t.collectionName}_${t.docId || ''}_${t.customId || ''}_${t.rollNo || ''}_${t.username || ''}_${t.studentId || ''}_${t.testId || ''}`;
      if (!seenTombstoneKeys.has(key)) {
        seenTombstoneKeys.add(key);
        tombstonesToRecord.push(t);
      }
    };

    [...localDocs, ...cloudDocs].forEach(d => {
      addTombstone({
        collectionName,
        docId: String(d._id),
        customId: d.id ? String(d.id) : null,
        rollNo: d.rollNo ? String(d.rollNo) : null,
        username: d.username ? String(d.username) : null,
        studentId: d.studentId ? String(d.studentId) : null,
        testId: d.testId ? String(d.testId) : null,
        deletedAt: new Date()
      });
    });

    searchKeys.rollNos.forEach(r => addTombstone({ collectionName, docId: null, customId: null, rollNo: String(r), username: null, studentId: null, testId: null, deletedAt: new Date() }));
    searchKeys.ids.forEach(id => addTombstone({ collectionName, docId: null, customId: String(id), rollNo: null, username: null, studentId: null, testId: null, deletedAt: new Date() }));
    searchKeys.usernames.forEach(u => addTombstone({ collectionName, docId: null, customId: null, rollNo: null, username: String(u), studentId: null, testId: null, deletedAt: new Date() }));

    // 3. Handle cascaded relations with universal multi-key deletion
    for (const rel of cascadeRelations) {
      try {
        let localRelColl = null;
        try { localRelColl = getLocalCollection(rel.collection); } catch (e) {}
        const cloudRelColl = await getCloudCollection(rel.collection);
        const fixedRelFilter = fixObjectIds(rel.filter);

        let relLocalDocs = [];
        let relCloudDocs = [];
        if (localRelColl) {
          relLocalDocs = await localRelColl.find(fixedRelFilter).toArray().catch(() => []);
        }

        const relKeys = {
          _ids: new Set(relLocalDocs.map(d => String(d._id))),
          ids: new Set(relLocalDocs.map(d => d.id).filter(Boolean)),
          rollNos: new Set(relLocalDocs.map(d => d.rollNo ? String(d.rollNo) : null).filter(Boolean)),
          usernames: new Set(relLocalDocs.map(d => d.username ? String(d.username) : null).filter(Boolean)),
          studentIds: new Set(relLocalDocs.map(d => d.studentId ? String(d.studentId) : null).filter(Boolean)),
          testIds: new Set(relLocalDocs.map(d => d.testId ? String(d.testId) : null).filter(Boolean))
        };

        const extractRelFilterKeys = (f) => {
          if (!f || typeof f !== 'object') return;
          if (f.username) {
            if (Array.isArray(f.username?.$in)) f.username.$in.forEach(u => relKeys.usernames.add(String(u)));
            else relKeys.usernames.add(String(f.username));
          }
          if (f.studentId) {
            if (Array.isArray(f.studentId?.$in)) f.studentId.$in.forEach(s => relKeys.studentIds.add(String(s)));
            else relKeys.studentIds.add(String(f.studentId));
          }
          if (f.testId) {
            if (Array.isArray(f.testId?.$in)) f.testId.$in.forEach(t => relKeys.testIds.add(String(t)));
            else relKeys.testIds.add(String(f.testId));
          }
          if (Array.isArray(f.$or)) f.$or.forEach(extractRelFilterKeys);
        };
        extractRelFilterKeys(fixedRelFilter);

        const relInitialQuery = buildOrQuery(relKeys, fixedRelFilter);

        if (cloudRelColl) {
          relCloudDocs = await cloudRelColl.find(relInitialQuery).toArray().catch(() => []);
          relCloudDocs.forEach(cd => {
            if (cd._id) relKeys._ids.add(String(cd._id));
            if (cd.id) relKeys.ids.add(String(cd.id));
            if (cd.username) relKeys.usernames.add(String(cd.username));
            if (cd.studentId) relKeys.studentIds.add(String(cd.studentId));
            if (cd.testId) relKeys.testIds.add(String(cd.testId));
          });
        }

        const finalRelUniversalQuery = buildOrQuery(relKeys, fixedRelFilter);

        if (localRelColl) {
          await localRelColl.deleteMany(finalRelUniversalQuery).catch(() => {});
        }
        if (cloudRelColl) {
          await cloudRelColl.deleteMany(finalRelUniversalQuery).catch(() => {});
        }

        [...relLocalDocs, ...relCloudDocs].forEach(d => {
          addTombstone({
            collectionName: rel.collection,
            docId: String(d._id),
            customId: d.id ? String(d.id) : null,
            rollNo: d.rollNo ? String(d.rollNo) : null,
            username: d.username ? String(d.username) : null,
            studentId: d.studentId ? String(d.studentId) : null,
            testId: d.testId ? String(d.testId) : null,
            deletedAt: new Date()
          });
        });

        relKeys.usernames.forEach(u => addTombstone({ collectionName: rel.collection, docId: null, customId: null, rollNo: null, username: String(u), studentId: null, testId: null, deletedAt: new Date() }));
        relKeys.studentIds.forEach(s => addTombstone({ collectionName: rel.collection, docId: null, customId: null, rollNo: null, username: null, studentId: String(s), testId: null, deletedAt: new Date() }));
        relKeys.testIds.forEach(t => addTombstone({ collectionName: rel.collection, docId: null, customId: null, rollNo: null, username: null, studentId: null, testId: String(t), deletedAt: new Date() }));
      } catch (relErr) {
        logWarn('SYNC_DELETE', `Cascade delete notice on [${rel.collection}]: ${relErr.message}`);
      }
    }

    // 4. Save tombstones locally (Durable offline queue)
    await savePendingTombstones(tombstonesToRecord);

    // 5. If Cloud Atlas is reachable, push tombstones to Cloud Atlas deletedrecords and drain queue
    if (cloudConnected) {
      try {
        await drainPendingTombstones();
      } catch (tombErr) {
        logWarn('SYNC_DELETE', `Tombstone cloud push notice: ${tombErr.message}`);
      }
    }

    logInfo('SYNC_DELETE', `🗑️ Dual-deleted ${localDeleted} local & ${cloudDeleted} cloud docs from [${collectionName}] with ${tombstonesToRecord.length} durable tombstones`);
    
    // Broadcast live change
    broadcastUpdate('data-updated', { source: 'dual-delete', collection: collectionName });

    return { localDeleted, cloudDeleted };
  } catch (err) {
    logError('SYNC_DELETE', `Dual-delete failed on [${collectionName}]`, err);
    throw err;
  }
}

/**
 * Full Two-Way Synchronization Engine
 * Safe Two-Way Sync: Never wipes Cloud when Local is empty. Pulls missing records from Cloud to Local.
 * Enforces Cloud Tombstones with multi-key checks so deleted records and credentials NEVER resurrect.
 */
export async function performFullSync() {
  if (!isLocalDbReady()) {
    logWarn('SYNC', 'Local MongoDB not ready yet. Skipping sync.');
    return { success: false, error: 'Local DB not ready' };
  }

  const cloudConn = await connectCloudDb();
  if (!cloudConn || cloudConn.readyState !== 1) {
    logWarn('SYNC', 'Cloud Atlas not reachable. Skipping sync.');
    return { success: false, error: 'Cloud Atlas not reachable' };
  }

  let totalPushed = 0;
  let totalPulled = 0;
  let totalPurged = 0;

  try {
    const cloudDb = cloudConn.useDb('test').db;

    // STEP 0: Drain any offline pending tombstones first!
    await drainPendingTombstones();

    // Fetch active Cloud tombstones (deleted on other PCs or queued)
    let cloudTombstones = [];
    try {
      cloudTombstones = await cloudDb.collection('deletedrecords').find({}).toArray();
    } catch (tErr) {}

    for (const collName of ALL_COLLECTIONS) {
      try {
        const localColl = mongoose.connection.collection(collName);
        const cloudColl = cloudDb.collection(collName);

        // Build rich tombstone lookup sets for this collection
        const collTombstones = cloudTombstones.filter(t => t.collectionName === collName);
        const tDocIds = new Set(collTombstones.map(t => t.docId).filter(Boolean).map(String));
        const tCustomIds = new Set(collTombstones.map(t => t.customId).filter(Boolean).map(String));
        const tRollNos = new Set(collTombstones.map(t => t.rollNo).filter(Boolean).map(String));
        const tUsernames = new Set(collTombstones.map(t => t.username).filter(Boolean).map(String));
        const tStudentIds = new Set(collTombstones.map(t => t.studentId).filter(Boolean).map(String));
        const tTestIds = new Set(collTombstones.map(t => t.testId).filter(Boolean).map(String));

        const isDocTombstoned = (d) => {
          if (!d) return false;
          if (d._id && tDocIds.has(String(d._id))) return true;
          if (d.id && tCustomIds.has(String(d.id))) return true;
          if (d.rollNo && tRollNos.has(String(d.rollNo))) return true;
          if (d.username && tUsernames.has(String(d.username))) return true;
          if (d.studentId && tStudentIds.has(String(d.studentId))) return true;
          if (d.testId && tTestIds.has(String(d.testId))) return true;
          if (d.parentUserId && tUsernames.has(String(d.parentUserId))) return true;
          return false;
        };

        // 0. Purge any Local docs that have tombstones on Cloud
        const tombFilterClauses = [
          ...(tDocIds.size > 0 ? [
            { _id: { $in: Array.from(tDocIds).filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id)) } },
            { _id: { $in: Array.from(tDocIds) } }
          ] : []),
          ...(tCustomIds.size > 0 ? [{ id: { $in: Array.from(tCustomIds) } }] : []),
          ...(tRollNos.size > 0 ? [{ rollNo: { $in: Array.from(tRollNos) } }] : []),
          ...(tUsernames.size > 0 ? [{ username: { $in: Array.from(tUsernames) } }] : []),
          ...(tStudentIds.size > 0 ? [{ studentId: { $in: Array.from(tStudentIds) } }] : []),
          ...(tTestIds.size > 0 ? [{ testId: { $in: Array.from(tTestIds) } }] : [])
        ];

        if (tombFilterClauses.length > 0) {
          const tombFilter = { $or: tombFilterClauses };
          const purgeRes = await localColl.deleteMany(tombFilter).catch(() => ({ deletedCount: 0 }));
          if (purgeRes.deletedCount > 0) {
            totalPurged += purgeRes.deletedCount;
            logInfo('SYNC', `🧹 Purged ${purgeRes.deletedCount} locally deleted records from [${collName}] via Cloud tombstones`);
          }
        }

        // Fetch Local docs after tombstone purge
        const localDocs = await localColl.find({}).toArray();
        const activeLocalDocs = localDocs.filter(d => !d.isDeleted && !isDocTombstoned(d));
        const deletedLocalIds = localDocs.filter(d => d.isDeleted).map(d => d._id);

        // Fetch Cloud docs
        const rawCloudDocs = await cloudColl.find({}).toArray();

        // IMMEDIATELY wipe any tombstoned documents found on Cloud Atlas!
        const tombstonedCloudIds = [];
        const cleanCloudDocs = [];
        for (const cd of rawCloudDocs) {
          if (isDocTombstoned(cd)) {
            tombstonedCloudIds.push(cd._id);
          } else {
            cleanCloudDocs.push(cd);
          }
        }
        if (tombstonedCloudIds.length > 0) {
          await cloudColl.deleteMany({ _id: { $in: tombstonedCloudIds } }).catch(() => {});
          totalPurged += tombstonedCloudIds.length;
          logInfo('SYNC', `🧹 Permanently wiped ${tombstonedCloudIds.length} tombstoned records from Cloud Atlas [${collName}]`);
        }

        const cloudDocs = cleanCloudDocs;

        // 1. If Local is completely empty and Cloud has data: AUTO-PULL from Cloud (for core entities ONLY, never resurrect cleared logs)
        const logCollections = ['smslogs', 'notifications', 'voicecalllogs'];
        if (activeLocalDocs.length === 0 && cloudDocs.length > 0) {
          if (logCollections.includes(collName)) {
            // If local logs were cleared, purge cloud logs as well so deleted logs never resurrect
            await cloudColl.deleteMany({}).catch(() => {});
            totalPurged += cloudDocs.length;
            logInfo('SYNC', `🧹 Cleared ${cloudDocs.length} cloud records for empty local log collection [${collName}]`);
            continue;
          }

          const fixedCloudDocs = cloudDocs.map(fixObjectIds);
          for (let i = 0; i < fixedCloudDocs.length; i += 500) {
            const batch = fixedCloudDocs.slice(i, i + 500).map(doc => ({
              replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true }
            }));
            await localColl.bulkWrite(batch, { ordered: false });
          }
          totalPulled += cloudDocs.length;
          logInfo('SYNC', `📥 Auto-pulled ${cloudDocs.length} records into empty local collection [${collName}]`);
          continue;
        }

        // 2. Purge soft-deleted documents from Cloud
        if (deletedLocalIds.length > 0) {
          await cloudColl.deleteMany({ _id: { $in: deletedLocalIds } }).catch(() => {});
        }

        // 3. Push Active Local Docs to Cloud Atlas (Upsert)
        if (activeLocalDocs.length > 0) {
          if (collName === 'testresults') {
            let publishedTestIds = new Set();
            try {
              const testsColl = await getLocalCollection('tests');
              if (testsColl) {
                const pubTests = await testsColl.find({
                  isDeleted: { $ne: true },
                  $or: [{ isPublished: true }, { status: 'Published' }, { status: 'published' }]
                }, { projection: { id: 1, _id: 1 } }).toArray();
                pubTests.forEach(t => {
                  if (t.id) publishedTestIds.add(String(t.id));
                  if (t._id) publishedTestIds.add(String(t._id));
                });
              }
            } catch (pubErr) {}

            for (const doc of activeLocalDocs) {
              const isPub = publishedTestIds.has(String(doc.testId)) || doc.status === 'Published';
              if (isPub && doc.omrSheetImage && !doc.omrSheetImage.startsWith('http')) {
                try {
                  const res = await uploadOMRScan(doc.omrSheetImage, `${doc.testId}_${doc.studentId || doc.rollNo}`);
                  if (res && res.url) {
                    doc.omrSheetImage = res.url;
                    doc.omrSheetPublicId = res.publicId;
                    await localColl.updateOne({ _id: doc._id }, { $set: { omrSheetImage: res.url, omrSheetPublicId: res.publicId } }).catch(() => {});
                  }
                } catch (omrErr) {}
              }
            }
          }

          if (collName === 'students') {
            for (const doc of activeLocalDocs) {
              if (doc.photo && typeof doc.photo === 'string' && !doc.photo.startsWith('http') && doc.photo.trim() !== '') {
                try {
                  const cloudUrl = await uploadStudentPhoto(doc.photo, doc.rollNo || doc.id);
                  if (cloudUrl && cloudUrl.startsWith('http')) {
                    doc.photo = cloudUrl;
                    await localColl.updateOne({ _id: doc._id }, { $set: { photo: cloudUrl } }).catch(() => {});
                  }
                } catch (photoErr) {}
              }
            }
          }

          const cloudMap = new Map();
          cloudDocs.forEach(cd => {
            if (collName === 'testresults') cloudMap.set(`${cd.testId}_${cd.studentId}`, cd);
            else if (collName === 'attendances') cloudMap.set(`${cd.studentId}_${cd.date}`, cd);
            else if (collName === 'students' || collName === 'tests') cloudMap.set(cd.id, cd);
            else cloudMap.set(String(cd._id), cd);
          });

          const toPushToCloud = activeLocalDocs.filter(ld => {
            // CRITICAL GUARD: Never push tombstoned records to Cloud! Delete locally instead.
            if (isDocTombstoned(ld)) {
              localColl.deleteOne({ _id: ld._id }).catch(() => {});
              return false;
            }

            let key = String(ld._id);
            if (collName === 'testresults') key = `${ld.testId}_${ld.studentId}`;
            else if (collName === 'attendances') key = `${ld.studentId}_${ld.date}`;
            else if (collName === 'students' || collName === 'tests') key = ld.id;

            const cloudDoc = cloudMap.get(key);
            if (!cloudDoc) return true;
            const localTime = new Date(ld.updatedAt || 0).getTime();
            const cloudTime = new Date(cloudDoc.updatedAt || 0).getTime();
            return localTime >= cloudTime;
          });

          for (let i = 0; i < toPushToCloud.length; i += 500) {
            const batch = toPushToCloud.slice(i, i + 500).map(doc => {
              if (collName === 'testresults') {
                const repl = { ...doc };
                delete repl._id;
                return {
                  updateOne: {
                    filter: { $or: [{ testId: doc.testId, studentId: doc.studentId }, { id: doc.id }, { _id: doc._id }] },
                    update: { $set: repl },
                    upsert: true
                  }
                };
              }
              if (collName === 'students' || collName === 'tests') {
                const repl = { ...doc };
                delete repl._id;
                if (collName === 'students' && !repl.photo) {
                  delete repl.photo;
                }
                return {
                  updateOne: {
                    filter: { $or: [{ id: doc.id }, { _id: doc._id }] },
                    update: { $set: repl },
                    upsert: true
                  }
                };
              }
              const filter = collName === 'attendances' && doc.studentId && doc.date
                ? { studentId: doc.studentId, date: doc.date }
                : { _id: doc._id };
              return {
                replaceOne: {
                  filter,
                  replacement: doc,
                  upsert: true
                }
              };
            });
            await cloudColl.bulkWrite(batch, { ordered: false });
          }
          totalPushed += toPushToCloud.length;
        }

        // 4. Pull any Cloud docs that are not yet in Local (Safe Two-Way Merge for core entities)
        if (cloudDocs.length > 0) {
          if (logCollections.includes(collName)) {
            // For log collections, ensure Cloud purges any records that were deleted locally so they never resurrect
            const activeLocalIds = new Set(activeLocalDocs.map(d => String(d._id)));
            const cloudIdsToPurge = cloudDocs.filter(cd => !activeLocalIds.has(String(cd._id))).map(cd => cd._id);
            if (cloudIdsToPurge.length > 0) {
              await cloudColl.deleteMany({ _id: { $in: cloudIdsToPurge } }).catch(() => {});
              totalPurged += cloudIdsToPurge.length;
              logInfo('SYNC', `🧹 Purged ${cloudIdsToPurge.length} deleted logs from Cloud [${collName}]`);
            }
          } else {
            const localMap = new Map();
            localDocs.forEach(ld => {
              if (collName === 'testresults') localMap.set(`${ld.testId}_${ld.studentId}`, ld);
              else if (collName === 'attendances') localMap.set(`${ld.studentId}_${ld.date}`, ld);
              else if (collName === 'students' || collName === 'tests') localMap.set(ld.id, ld);
              else localMap.set(String(ld._id), ld);
            });

            const toPullToLocal = cloudDocs.filter(cd => {
              if (cd.isDeleted) return false;

              // CRITICAL GUARD: Never pull tombstoned records from Cloud to Local! Purge from Cloud instead.
              if (isDocTombstoned(cd)) {
                cloudColl.deleteOne({ _id: cd._id }).catch(() => {});
                return false;
              }

              let key = String(cd._id);
              if (collName === 'testresults') key = `${cd.testId}_${cd.studentId}`;
              else if (collName === 'attendances') key = `${cd.studentId}_${cd.date}`;
              else if (collName === 'students' || collName === 'tests') key = cd.id;

              const localDoc = localMap.get(key);
              if (!localDoc) return true;
              const cloudTime = new Date(cd.updatedAt || 0).getTime();
              const localTime = new Date(localDoc.updatedAt || 0).getTime();
              return cloudTime > localTime;
            });

            if (toPullToLocal.length > 0) {
              const fixedMissing = toPullToLocal.map(fixObjectIds);
              for (let i = 0; i < fixedMissing.length; i += 500) {
                const batch = fixedMissing.slice(i, i + 500).map(doc => {
                  if (collName === 'testresults') {
                    const repl = { ...doc };
                    delete repl._id;
                    return {
                      updateOne: {
                        filter: { $or: [{ testId: doc.testId, studentId: doc.studentId }, { id: doc.id }, { _id: doc._id }] },
                        update: { $set: repl },
                        upsert: true
                      }
                    };
                  }
                  if (collName === 'attendances') {
                    const repl = { ...doc };
                    delete repl._id;
                    return {
                      updateOne: {
                        filter: { studentId: doc.studentId, date: doc.date },
                        update: { $set: repl },
                        upsert: true
                      }
                    };
                  }
                  if (collName === 'students' || collName === 'tests') {
                    const repl = { ...doc };
                    delete repl._id;
                    if (collName === 'students' && !repl.photo) {
                      delete repl.photo;
                    }
                    return {
                      updateOne: {
                        filter: { $or: [{ id: doc.id }, { _id: doc._id }] },
                        update: { $set: repl },
                        upsert: true
                      }
                    };
                  }
                  return {
                    replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true }
                  };
                });
                await localColl.bulkWrite(batch, { ordered: false });
              }
              totalPulled += toPullToLocal.length;
              logInfo('SYNC', `📥 Pulled/Updated ${toPullToLocal.length} records from Cloud into [${collName}]`);
            }

            // For sessions and core config collections, ensure local matches cloud exactly (purge deleted sessions/institutes from other PCs)
            if (['sessions', 'institutes', 'users'].includes(collName)) {
              const cloudIds = cloudDocs.map(d => d._id);
              const purgeRes = await localColl.deleteMany({ _id: { $nin: cloudIds } }).catch(() => ({ deletedCount: 0 }));
              if (purgeRes.deletedCount > 0) {
                logInfo('SYNC', `🧹 Cleaned up ${purgeRes.deletedCount} stale ${collName} from Local DB`);
              }
            }
          }
        }

      } catch (collErr) {
        logWarn('SYNC', `Sync notice on collection [${collName}]: ${collErr.message}`);
      }
    }

    lastSyncTimestamp = new Date().toISOString();

    // Persist status
    try {
      const statusFile = path.join(process.cwd(), 'server', 'sync-status.json');
      fs.writeFileSync(statusFile, JSON.stringify({ lastSync: lastSyncTimestamp }), 'utf8');
    } catch (e) {}

    logInfo('SYNC', `✅ Safe Two-Way Sync Completed! (Pushed: ${totalPushed}, Pulled: ${totalPulled}, Purged: ${totalPurged})`);

    broadcastUpdate('data-updated', {
      source: 'full-sync',
      lastSync: lastSyncTimestamp,
      totalPushed,
      totalPulled,
      totalPurged
    });

    return {
      success: true,
      lastSync: lastSyncTimestamp,
      totalPushed,
      totalPulled,
      totalPurged
    };
  } catch (err) {
    logError('SYNC', 'Two-Way Sync Failed', err);
    return { success: false, error: err.message };
  }
}

/**
 * Pull and Restore all records from Cloud Atlas into Local DB
 */
export async function pullAndRestoreFromCloud() {
  if (!isLocalDbReady()) return { success: false, error: 'Local DB offline' };

  const cloudConn = await connectCloudDb();
  if (!cloudConn || cloudConn.readyState !== 1) {
    logWarn('PULL', 'Cloud Atlas offline, attempting snapshot restore...');
    return restoreLocalFromSnapshot();
  }

  try {
    const cloudDb = cloudConn.useDb('test').db;
    let totalRestored = 0;

    // STEP 0: Drain any offline pending tombstones first!
    await drainPendingTombstones();

    let cloudTombstones = [];
    try {
      cloudTombstones = await cloudDb.collection('deletedrecords').find({}).toArray();
    } catch (tErr) {}

    for (const collName of ALL_COLLECTIONS) {
      try {
        const cloudColl = cloudDb.collection(collName);
        const localColl = mongoose.connection.collection(collName);

        // Build rich tombstone lookup sets for this collection
        const collTombstones = cloudTombstones.filter(t => t.collectionName === collName);
        const tDocIds = new Set(collTombstones.map(t => t.docId).filter(Boolean).map(String));
        const tCustomIds = new Set(collTombstones.map(t => t.customId).filter(Boolean).map(String));
        const tRollNos = new Set(collTombstones.map(t => t.rollNo).filter(Boolean).map(String));
        const tUsernames = new Set(collTombstones.map(t => t.username).filter(Boolean).map(String));
        const tStudentIds = new Set(collTombstones.map(t => t.studentId).filter(Boolean).map(String));
        const tTestIds = new Set(collTombstones.map(t => t.testId).filter(Boolean).map(String));

        const isDocTombstoned = (d) => {
          if (!d) return false;
          if (d._id && tDocIds.has(String(d._id))) return true;
          if (d.id && tCustomIds.has(String(d.id))) return true;
          if (d.rollNo && tRollNos.has(String(d.rollNo))) return true;
          if (d.username && tUsernames.has(String(d.username))) return true;
          if (d.studentId && tStudentIds.has(String(d.studentId))) return true;
          if (d.testId && tTestIds.has(String(d.testId))) return true;
          if (d.parentUserId && tUsernames.has(String(d.parentUserId))) return true;
          return false;
        };

        // Purge local docs that have tombstones on Cloud
        const tombFilterClauses = [
          ...(tDocIds.size > 0 ? [
            { _id: { $in: Array.from(tDocIds).filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id)) } },
            { _id: { $in: Array.from(tDocIds) } }
          ] : []),
          ...(tCustomIds.size > 0 ? [{ id: { $in: Array.from(tCustomIds) } }] : []),
          ...(tRollNos.size > 0 ? [{ rollNo: { $in: Array.from(tRollNos) } }] : []),
          ...(tUsernames.size > 0 ? [{ username: { $in: Array.from(tUsernames) } }] : []),
          ...(tStudentIds.size > 0 ? [{ studentId: { $in: Array.from(tStudentIds) } }] : []),
          ...(tTestIds.size > 0 ? [{ testId: { $in: Array.from(tTestIds) } }] : [])
        ];

        if (tombFilterClauses.length > 0) {
          await localColl.deleteMany({ $or: tombFilterClauses }).catch(() => {});
        }

        const rawDocs = await cloudColl.find({}).toArray();
        if (!rawDocs || rawDocs.length === 0) continue;

        // Filter out any docs that match tombstones and purge them from Cloud
        const tombstonedCloudIds = [];
        const docs = [];
        for (const d of rawDocs) {
          if (d.isDeleted || isDocTombstoned(d)) {
            tombstonedCloudIds.push(d._id);
          } else {
            docs.push(d);
          }
        }

        if (tombstonedCloudIds.length > 0) {
          await cloudColl.deleteMany({ _id: { $in: tombstonedCloudIds } }).catch(() => {});
          logInfo('PULL', `🧹 Purged ${tombstonedCloudIds.length} tombstoned records from Cloud Atlas [${collName}]`);
        }

        if (docs.length === 0) continue;

        const fixedDocs = docs.map(fixObjectIds);
        for (let i = 0; i < fixedDocs.length; i += 500) {
          const batch = fixedDocs.slice(i, i + 500).map(doc => {
            if (collName === 'testresults') {
              const repl = { ...doc };
              delete repl._id;
              return {
                updateOne: {
                  filter: { $or: [{ testId: doc.testId, studentId: doc.studentId }, { id: doc.id }, { _id: doc._id }] },
                  update: { $set: repl },
                  upsert: true
                }
              };
            }
            if (collName === 'attendances') {
              const repl = { ...doc };
              delete repl._id;
              return {
                updateOne: {
                  filter: { studentId: doc.studentId, date: doc.date },
                  update: { $set: repl },
                  upsert: true
                }
              };
            }
            if (collName === 'students' || collName === 'tests') {
              const repl = { ...doc };
              delete repl._id;
              if (collName === 'students' && !repl.photo) {
                delete repl.photo;
              }
              return {
                updateOne: {
                  filter: { $or: [{ id: doc.id }, { _id: doc._id }] },
                  update: { $set: repl },
                  upsert: true
                }
              };
            }
            return {
              replaceOne: {
                filter: { _id: doc._id },
                replacement: doc,
                upsert: true
              }
            };
          });
          await localColl.bulkWrite(batch, { ordered: false });
        }
        totalRestored += docs.length;

        // Purge orphaned local records for configuration collections (sessions, institutes, users)
        if (['sessions', 'institutes', 'users', 'smslogs'].includes(collName)) {
          const cloudIds = fixedDocs.map(d => d._id);
          const purgeRes = await localColl.deleteMany({ _id: { $nin: cloudIds } }).catch(() => ({ deletedCount: 0 }));
          if (purgeRes.deletedCount > 0) {
            logInfo('PULL', `Cleaned up ${purgeRes.deletedCount} orphaned local records from [${collName}]`);
          }
        }
      } catch (collErr) {
        logWarn('PULL', `Warning pulling [${collName}]: ${collErr.message}`);
      }
    }

    // If Cloud was empty, fallback to bundled snapshot
    if (totalRestored === 0) {
      logWarn('PULL', 'Cloud was empty, seeding from bundled database_snapshot.json...');
      return restoreLocalFromSnapshot();
    }

    logInfo('PULL', `✅ Pull from Cloud completed (${totalRestored} records restored with ObjectIds)`);
    broadcastUpdate('data-updated', { source: 'cloud-pull', totalRestored });
    return { success: true, totalRestored };
  } catch (err) {
    logError('PULL', 'Failed to pull from Cloud Atlas', err);
    return restoreLocalFromSnapshot();
  }
}

/**
 * Offline / Cold-start fallback: Restore local MongoDB directly from bundled database_snapshot.json
 */
export async function restoreLocalFromSnapshot() {
  try {
    const snapshotPaths = [
      path.join(process.cwd(), 'server', 'backup', 'database_snapshot.json'),
      path.join(__dirname, '..', 'backup', 'database_snapshot.json'),
      path.join(process.resourcesPath || '', 'app.asar.unpacked', 'server', 'backup', 'database_snapshot.json')
    ];

    let snapPath = snapshotPaths.find(p => fs.existsSync(p));
    if (!snapPath) {
      logWarn('RESTORE_SNAP', 'No database_snapshot.json found.');
      return { success: false, error: 'Snapshot not found' };
    }

    const raw = fs.readFileSync(snapPath, 'utf8');
    const snap = JSON.parse(raw);
    if (!snap.data) return { success: false, error: 'Invalid snapshot' };

    let totalRestored = 0;
    for (const [collName, docs] of Object.entries(snap.data)) {
      if (!docs || docs.length === 0) continue;
      const localColl = mongoose.connection.collection(collName);
      const fixedDocs = docs.map(fixObjectIds);

      for (let i = 0; i < fixedDocs.length; i += 500) {
        const batch = fixedDocs.slice(i, i + 500).map(doc => ({
          replaceOne: {
            filter: { _id: doc._id },
            replacement: doc,
            upsert: true
          }
        }));
        await localColl.bulkWrite(batch, { ordered: false });
      }
      totalRestored += docs.length;
    }

    logInfo('RESTORE_SNAP', `✅ Restored ${totalRestored} records from local snapshot [${snapPath}]`);
    broadcastUpdate('data-updated', { source: 'snapshot-restore', totalRestored });
    return { success: true, totalRestored };
  } catch (err) {
    logError('RESTORE_SNAP', 'Failed to restore from snapshot', err);
    return { success: false, error: err.message };
  }
}

/**
 * Trigger background sync with debouncing
 */
export function triggerBackgroundSync() {
  if (isSyncing) {
    pendingSync = true;
    return;
  }

  isSyncing = true;
  pendingSync = false;

  setImmediate(async () => {
    try {
      await performFullSync();
    } catch (err) {
      logWarn('SYNC', `Background sync error: ${err.message}`);
    } finally {
      isSyncing = false;
      if (pendingSync) {
        pendingSync = false;
        setTimeout(triggerBackgroundSync, 3000);
      }
    }
  });
}

/**
 * Start periodic sync loop
 */
export function startPeriodicSync(intervalMs = 180000) {
  setInterval(triggerBackgroundSync, intervalMs);
}
