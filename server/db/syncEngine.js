import mongoose from 'mongoose';
import { getLocalDb, getLocalCollection, isLocalDbReady } from './localDb.js';
import { connectCloudDb, getCloudDb, getCloudCollection, isCloudDbAvailable } from './cloudDb.js';
import { ALL_COLLECTIONS } from '../services/jsonBackupService.js';
import { logInfo, logError, logWarn } from '../utils/logger.js';
import { uploadOMRScan } from '../services/cloudinaryService.js';
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

    await cloudColl.replaceOne(
      { _id: doc._id },
      doc,
      { upsert: true }
    );
    logInfo('SYNC_MIRROR', `⚡ Mirrored doc [${doc._id}] to Cloud [${collectionName}]`);
  } catch (err) {
    logWarn('SYNC_MIRROR', `Failed to mirror write on [${collectionName}]: ${err.message}`);
  }
}

/**
 * Direct Dual-Delete: Permanently deletes record and related items from BOTH Local and Cloud DBs
 */
export async function dualDelete(collectionName, filter, cascadeRelations = []) {
  try {
    const localColl = getLocalCollection(collectionName);
    const cloudColl = await getCloudCollection(collectionName);
    const fixedFilter = fixObjectIds(filter);

    // 1. Delete from Local DB
    const localRes = await localColl.deleteMany(fixedFilter);

    // 2. Delete from Cloud Atlas
    let cloudDeleted = 0;
    if (cloudColl) {
      const cloudRes = await cloudColl.deleteMany(fixedFilter);
      cloudDeleted = cloudRes.deletedCount;
    }

    // 3. Handle cascaded relations
    for (const rel of cascadeRelations) {
      try {
        const localRelColl = getLocalCollection(rel.collection);
        const cloudRelColl = await getCloudCollection(rel.collection);
        const fixedRelFilter = fixObjectIds(rel.filter);

        await localRelColl.deleteMany(fixedRelFilter);
        if (cloudRelColl) {
          await cloudRelColl.deleteMany(fixedRelFilter);
        }
      } catch (relErr) {
        logWarn('SYNC_DELETE', `Cascade delete notice on [${rel.collection}]: ${relErr.message}`);
      }
    }

    logInfo('SYNC_DELETE', `🗑️ Dual-deleted ${localRes.deletedCount} local & ${cloudDeleted} cloud docs from [${collectionName}]`);
    
    // Broadcast live change
    broadcastUpdate('data-updated', { source: 'dual-delete', collection: collectionName });

    return { localDeleted: localRes.deletedCount, cloudDeleted };
  } catch (err) {
    logError('SYNC_DELETE', `Dual-delete failed on [${collectionName}]`, err);
    throw err;
  }
}

/**
 * Full Two-Way Synchronization Engine
 * Safe Two-Way Sync: Never wipes Cloud when Local is empty. Pulls missing records from Cloud to Local.
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

    for (const collName of ALL_COLLECTIONS) {
      try {
        const localColl = mongoose.connection.collection(collName);
        const cloudColl = cloudDb.collection(collName);

        // Fetch Local docs
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
            for (const doc of activeLocalDocs) {
              if (doc.omrSheetImage && !doc.omrSheetImage.startsWith('http')) {
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

          for (let i = 0; i < activeLocalDocs.length; i += 500) {
            const batch = activeLocalDocs.slice(i, i + 500).map(doc => ({
              replaceOne: {
                filter: { _id: doc._id },
                replacement: doc,
                upsert: true
              }
            }));
            await cloudColl.bulkWrite(batch, { ordered: false });
          }
          totalPushed += activeLocalDocs.length;
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
            const localIdsSet = new Set(localDocs.map(d => String(d._id)));
            const missingInLocal = cloudDocs.filter(cd => !localIdsSet.has(String(cd._id)) && !cd.isDeleted);
            if (missingInLocal.length > 0) {
              const fixedMissing = missingInLocal.map(fixObjectIds);
              for (let i = 0; i < fixedMissing.length; i += 500) {
                const batch = fixedMissing.slice(i, i + 500).map(doc => ({
                  replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true }
                }));
                await localColl.bulkWrite(batch, { ordered: false });
              }
              totalPulled += missingInLocal.length;
              logInfo('SYNC', `📥 Pulled ${missingInLocal.length} new records from Cloud into [${collName}]`);
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

    for (const collName of ALL_COLLECTIONS) {
      try {
        const cloudColl = cloudDb.collection(collName);
        const localColl = mongoose.connection.collection(collName);

        const docs = await cloudColl.find({}).toArray();
        if (!docs || docs.length === 0) continue;

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
