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
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000
    }).asPromise();
    logInfo('SYNC', 'Connected to cloud DB.');

    const collections = ['users', 'institutes', 'students', 'tests', 'testresults', 'attendances', 'smslogs', 'sessions', 'inquiries', 'notifications', 'voicecalllogs', 'devices'];

    for (const collName of collections) {
      const localColl = localConn.collection(collName);
      const cloudColl = cloudConn.collection(collName);

      const docs = await localColl.find({}).toArray();
      if (docs.length === 0) {
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

      if (activeDocs.length === 0) {
        console.log(`   - 0 active documents to sync.`);
        continue;
      }

      // Process specific collections for local file uploads (OMR images)
      if (collName === 'testresults') {
        // Fetch all published tests to make sure we ONLY upload OMRs of published tests to Cloudinary!
        let publishedTestIds = new Set();
        try {
          const testsColl = localConn.collection('tests');
          const publishedTests = await testsColl.find({
            isDeleted: { $ne: true },
            $or: [{ isPublished: true }, { status: 'published' }]
          }).project({ id: 1, _id: 1 }).toArray();
          publishedTestIds = new Set(publishedTests.map(t => String(t.id || t._id)));
        } catch (e) {}

        for (let i = 0; i < activeDocs.length; i++) {
          const doc = activeDocs[i];
          // Check if this test result belongs to a published test
          const testIdStr = String(doc.testId || '');
          if (!publishedTestIds.has(testIdStr)) {
            // Test is not published yet - skip Cloudinary upload to save quota
            continue;
          }

          // If the OMR image is a local path (starts with /uploads/omr/)
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
                
                // Update local DB so it doesn't upload again next time
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

      // Upsert active documents to cloud
      const bulkOps = activeDocs.map(doc => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true
        }
      }));

      const result = await cloudColl.bulkWrite(bulkOps);
      
      // Note: Never use $nin deleteMany across all collections as other desktops/web apps
      // create documents in the cloud that should not be wiped out by this local machine.
      console.log(`   - Synced ${activeDocs.length} active documents (${result.upsertedCount} new, ${result.modifiedCount} updated).`);
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
