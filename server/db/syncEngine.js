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

/**
 * Direct Dual-Delete: Permanently deletes record and related items from BOTH Local and Cloud DBs,
 * and leaves a tombstone on Cloud Atlas so other PCs automatically delete their local copy on sync.
 */
export async function dualDelete(collectionName, filter, cascadeRelations = []) {
  try {
    let localColl = null;
    try {
      localColl = getLocalCollection(collectionName);
    } catch (e) {}

    const cloudColl = await getCloudCollection(collectionName);
    const fixedFilter = fixObjectIds(filter);

    // 0. Gather IDs of records being deleted for tombstones (check local, fallback to cloud if local already deleted)
    let docsToDelete = [];
    try {
      if (localColl) {
        docsToDelete = await localColl.find(fixedFilter, { projection: { _id: 1, id: 1, testId: 1 } }).toArray();
      }
      if (docsToDelete.length === 0 && cloudColl) {
        docsToDelete = await cloudColl.find(fixedFilter, { projection: { _id: 1, id: 1, testId: 1 } }).toArray().catch(() => []);
      }
    } catch (e) {}

    // 1. Delete from Local DB
    let localDeleted = 0;
    if (localColl) {
      const localRes = await localColl.deleteMany(fixedFilter).catch(() => ({ deletedCount: 0 }));
      localDeleted = localRes.deletedCount || 0;
    }

    // 2. Delete from Cloud Atlas
    let cloudDeleted = 0;
    if (cloudColl) {
      const cloudRes = await cloudColl.deleteMany(fixedFilter);
      cloudDeleted = cloudRes.deletedCount;
    }

    // 3. Handle cascaded relations
    const cascadedTombstones = [];
    for (const rel of cascadeRelations) {
      try {
        let localRelColl = null;
        try {
          localRelColl = getLocalCollection(rel.collection);
        } catch (e) {}

        const cloudRelColl = await getCloudCollection(rel.collection);
        const fixedRelFilter = fixObjectIds(rel.filter);

        let relDocs = [];
        if (localRelColl) {
          relDocs = await localRelColl.find(fixedRelFilter, { projection: { _id: 1, id: 1, testId: 1, studentId: 1 } }).toArray().catch(() => []);
        }
        if (relDocs.length === 0 && cloudRelColl) {
          relDocs = await cloudRelColl.find(fixedRelFilter, { projection: { _id: 1, id: 1, testId: 1, studentId: 1 } }).toArray().catch(() => []);
        }

        relDocs.forEach(d => {
          cascadedTombstones.push({
            collectionName: rel.collection,
            docId: String(d._id),
            customId: d.id ? String(d.id) : null,
            testId: d.testId ? String(d.testId) : null,
            studentId: d.studentId ? String(d.studentId) : null,
            deletedAt: new Date()
          });
        });

        // If rel.filter has testId, add explicit testId tombstone so PC-2 cleans ALL results for that testId
        if (rel.collection === 'testresults' && rel.filter && rel.filter.testId) {
          const rawTestIds = Array.isArray(rel.filter.testId?.$in) 
            ? rel.filter.testId.$in 
            : [rel.filter.testId];
          rawTestIds.forEach(tId => {
            if (tId) {
              cascadedTombstones.push({
                collectionName: 'testresults',
                docId: null,
                customId: null,
                testId: String(tId),
                deletedAt: new Date()
              });
            }
          });
        }

        if (localRelColl) {
          await localRelColl.deleteMany(fixedRelFilter).catch(() => {});
        }
        if (cloudRelColl) {
          await cloudRelColl.deleteMany(fixedRelFilter);
        }
      } catch (relErr) {
        logWarn('SYNC_DELETE', `Cascade delete notice on [${rel.collection}]: ${relErr.message}`);
      }
    }

    // Also if tests were deleted, automatically add testId tombstones for testresults
    if (collectionName === 'tests') {
      docsToDelete.forEach(d => {
        const tKeys = [d.id, String(d._id)].filter(Boolean);
        tKeys.forEach(k => {
          cascadedTombstones.push({
            collectionName: 'testresults',
            docId: null,
            customId: null,
            testId: String(k),
            deletedAt: new Date()
          });
        });
      });
    }

    // 4. Save tombstones to Cloud Atlas (so PC-2 deletes them and never pushes them back)
    try {
      const cloudConn = await connectCloudDb();
      if (cloudConn && cloudConn.readyState === 1) {
        const cloudDb = cloudConn.useDb('test').db;
        const tombstonesColl = cloudDb.collection('deletedrecords');
        // Ensure TTL Index exists
        tombstonesColl.createIndex({ deletedAt: 1 }, { expireAfterSeconds: 1209600 }).catch(() => {});

        const allTombstones = [
          ...docsToDelete.map(d => ({
            collectionName,
            docId: String(d._id),
            customId: d.id ? String(d.id) : null,
            testId: d.testId ? String(d.testId) : null,
            deletedAt: new Date()
          })),
          ...cascadedTombstones
        ];

        if (allTombstones.length > 0) {
          await tombstonesColl.insertMany(allTombstones, { ordered: false }).catch(() => {});
        }
      }
    } catch (tombErr) {
      logWarn('SYNC_DELETE', `Tombstone record notice: ${tombErr.message}`);
    }

    logInfo('SYNC_DELETE', `🗑️ Dual-deleted ${localDeleted} local & ${cloudDeleted} cloud docs from [${collectionName}]`);
    
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
 * Enforces Cloud Tombstones so PC-2 immediately purges locally deleted records without resurrection.
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

    // Fetch active Cloud tombstones (deleted on other PCs)
    let cloudTombstones = [];
    try {
      cloudTombstones = await cloudDb.collection('deletedrecords').find({}).toArray();
    } catch (tErr) {}

    for (const collName of ALL_COLLECTIONS) {
      try {
        const localColl = mongoose.connection.collection(collName);
        const cloudColl = cloudDb.collection(collName);

        // 0. Purge any Local docs that have tombstones on Cloud
        const collTombstones = cloudTombstones.filter(t => t.collectionName === collName);
        const tDocIds = collTombstones.map(t => t.docId).filter(Boolean);
        const tCustomIds = collTombstones.map(t => t.customId).filter(Boolean);
        const tTestIds = collTombstones.map(t => t.testId).filter(Boolean);
        const tObjectIds = tDocIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));

        const tombFilterClauses = [
          { _id: { $in: [...tDocIds, ...tObjectIds] } },
          ...(tCustomIds.length > 0 ? [{ id: { $in: tCustomIds } }] : []),
          ...(collName === 'testresults' && tTestIds.length > 0 ? [{ testId: { $in: tTestIds } }] : [])
        ];

        if (collTombstones.length > 0 && tombFilterClauses.length > 0) {
          const tombFilter = { $or: tombFilterClauses };
          const purgeRes = await localColl.deleteMany(tombFilter).catch(() => ({ deletedCount: 0 }));
          if (purgeRes.deletedCount > 0) {
            totalPurged += purgeRes.deletedCount;
            logInfo('SYNC', `🧹 Purged ${purgeRes.deletedCount} locally deleted records from [${collName}] via Cloud tombstones`);
          }
        }

        const tombstoneDocIds = new Set(tDocIds.map(String));
        const tombstoneCustomIds = new Set(tCustomIds.map(String));
        const tombstoneTestIds = new Set(tTestIds.map(String));

        // Fetch Local docs after tombstone purge
        const localDocs = await localColl.find({}).toArray();
        const activeLocalDocs = localDocs.filter(d => !d.isDeleted);
        const deletedLocalIds = localDocs.filter(d => d.isDeleted).map(d => d._id);

        // Fetch Cloud docs
        const cloudDocs = await cloudColl.find({}).toArray();

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
            const isTombstoned = tombstoneDocIds.has(String(ld._id)) ||
              (ld.id && tombstoneCustomIds.has(String(ld.id))) ||
              (collName === 'testresults' && ld.testId && tombstoneTestIds.has(String(ld.testId)));

            if (isTombstoned) {
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
              const isTombstoned = tombstoneDocIds.has(String(cd._id)) ||
                (cd.id && tombstoneCustomIds.has(String(cd.id))) ||
                (collName === 'testresults' && cd.testId && tombstoneTestIds.has(String(cd.testId)));

              if (isTombstoned) {
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

    let cloudTombstones = [];
    try {
      cloudTombstones = await cloudDb.collection('deletedrecords').find({}).toArray();
    } catch (tErr) {}

    for (const collName of ALL_COLLECTIONS) {
      try {
        const cloudColl = cloudDb.collection(collName);
        const localColl = mongoose.connection.collection(collName);

        // Purge local docs that have tombstones on Cloud
        const collTombstones = cloudTombstones.filter(t => t.collectionName === collName);
        const tDocIds = collTombstones.map(t => t.docId).filter(Boolean);
        const tCustomIds = collTombstones.map(t => t.customId).filter(Boolean);
        const tTestIds = collTombstones.map(t => t.testId).filter(Boolean);
        const tObjectIds = tDocIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));

        const tombFilterClauses = [
          { _id: { $in: [...tDocIds, ...tObjectIds] } },
          ...(tCustomIds.length > 0 ? [{ id: { $in: tCustomIds } }] : []),
          ...(collName === 'testresults' && tTestIds.length > 0 ? [{ testId: { $in: tTestIds } }] : [])
        ];

        if (collTombstones.length > 0 && tombFilterClauses.length > 0) {
          await localColl.deleteMany({ $or: tombFilterClauses }).catch(() => {});
        }

        const tombstoneDocIds = new Set(tDocIds.map(String));
        const tombstoneCustomIds = new Set(tCustomIds.map(String));
        const tombstoneTestIds = new Set(tTestIds.map(String));

        const rawDocs = await cloudColl.find({}).toArray();
        if (!rawDocs || rawDocs.length === 0) continue;

        // Filter out any docs that match tombstones
        const docs = rawDocs.filter(d => {
          if (d.isDeleted) return false;
          if (tombstoneDocIds.has(String(d._id))) return false;
          if (d.id && tombstoneCustomIds.has(String(d.id))) return false;
          if (collName === 'testresults' && d.testId && tombstoneTestIds.has(String(d.testId))) return false;
          return true;
        });

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
