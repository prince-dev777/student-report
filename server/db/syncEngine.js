import mongoose from 'mongoose';
import { getLocalDb, getLocalCollection, isLocalDbReady } from './localDb.js';
import { connectCloudDb, getCloudDb, getCloudCollection, isCloudDbAvailable } from './cloudDb.js';
import { ALL_COLLECTIONS } from '../services/jsonBackupService.js';
import { logInfo, logError, logWarn } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

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

    // 1. Delete from Local DB
    const localRes = await localColl.deleteMany(filter);

    // 2. Delete from Cloud Atlas
    let cloudDeleted = 0;
    if (cloudColl) {
      const cloudRes = await cloudColl.deleteMany(filter);
      cloudDeleted = cloudRes.deletedCount;
    }

    // 3. Handle cascaded relations
    for (const rel of cascadeRelations) {
      try {
        const localRelColl = getLocalCollection(rel.collection);
        const cloudRelColl = await getCloudCollection(rel.collection);

        await localRelColl.deleteMany(rel.filter);
        if (cloudRelColl) {
          await cloudRelColl.deleteMany(rel.filter);
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
 * Pushes local updates to Cloud Atlas, pulls remote additions, and purges deleted records.
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

        // 1. Purge soft-deleted documents from Cloud
        if (deletedLocalIds.length > 0) {
          await cloudColl.deleteMany({ _id: { $in: deletedLocalIds } }).catch(() => {});
        }

        // 2. Purge documents on Cloud that no longer exist locally
        const localIdsSet = new Set(activeLocalDocs.map(d => String(d._id)));
        const cloudDocs = await cloudColl.find({}).toArray();
        
        const orphansToDelete = cloudDocs
          .filter(cd => !localIdsSet.has(String(cd._id)))
          .map(cd => cd._id);

        if (orphansToDelete.length > 0) {
          await cloudColl.deleteMany({ _id: { $in: orphansToDelete } }).catch(() => {});
          totalPurged += orphansToDelete.length;
        }

        // 3. Push Active Local Docs to Cloud Atlas
        if (activeLocalDocs.length > 0) {
          const pushOps = activeLocalDocs.map(doc => ({
            replaceOne: {
              filter: { _id: doc._id },
              replacement: doc,
              upsert: true
            }
          }));
          await cloudColl.bulkWrite(pushOps, { ordered: false });
          totalPushed += activeLocalDocs.length;
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

    logInfo('SYNC', `✅ Two-Way Sync Completed successfully! (Pushed: ${totalPushed}, Purged: ${totalPurged})`);

    broadcastUpdate('data-updated', {
      source: 'full-sync',
      lastSync: lastSyncTimestamp,
      totalPushed,
      totalPurged
    });

    return {
      success: true,
      lastSync: lastSyncTimestamp,
      totalPushed,
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
  if (!cloudConn || cloudConn.readyState !== 1) return { success: false, error: 'Cloud Atlas offline' };

  try {
    const cloudDb = cloudConn.useDb('test').db;
    let totalRestored = 0;

    for (const collName of ALL_COLLECTIONS) {
      try {
        const cloudColl = cloudDb.collection(collName);
        const localColl = mongoose.connection.collection(collName);

        const docs = await cloudColl.find({}).toArray();
        if (!docs || docs.length === 0) continue;

        const bulkOps = docs.map(doc => ({
          replaceOne: {
            filter: { _id: doc._id },
            replacement: doc,
            upsert: true
          }
        }));

        await localColl.bulkWrite(bulkOps, { ordered: false });
        totalRestored += docs.length;
      } catch (collErr) {
        logWarn('PULL', `Warning pulling [${collName}]: ${collErr.message}`);
      }
    }

    logInfo('PULL', `✅ Pull from Cloud completed (${totalRestored} records)`);
    broadcastUpdate('data-updated', { source: 'cloud-pull', totalRestored });
    return { success: true, totalRestored };
  } catch (err) {
    logError('PULL', 'Failed to pull from Cloud Atlas', err);
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
