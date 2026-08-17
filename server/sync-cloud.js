import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') }); // Load root .env for Cloudinary keys if running locally

const CLOUD_URI = 'mongodb://student_report:helloai.com@ac-hqw4l9b-shard-00-00.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-01.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-02.thx91mx.mongodb.net:27017/test?ssl=true&replicaSet=atlas-srcmx3-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0';
const LOCAL_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/student-report';
const dataPath = process.env.USER_DATA_PATH || __dirname;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function syncToCloud() {
  console.log('🔄 Starting Cloud Sync...');
  let localConn, cloudConn;
  try {
    console.log(`🔌 Connecting to local DB: ${LOCAL_URI}`);
    localConn = await mongoose.createConnection(LOCAL_URI).asPromise();
    
    console.log(`☁️ Connecting to cloud DB: ${CLOUD_URI}`);
    cloudConn = await mongoose.createConnection(CLOUD_URI).asPromise();

    const collections = ['users', 'institutes', 'students', 'tests', 'testresults', 'attendances', 'smslogs', 'sessions', 'inquiries'];

    for (const collName of collections) {
      console.log(`📦 Syncing collection: ${collName}...`);
      const localColl = localConn.collection(collName);
      const cloudColl = cloudConn.collection(collName);

      const docs = await localColl.find({}).toArray();
      if (docs.length === 0) {
        console.log(`   - 0 documents found. Skipping.`);
        continue;
      }

      // Process specific collections for local file uploads (OMR images)
      if (collName === 'testresults') {
        for (let i = 0; i < docs.length; i++) {
          const doc = docs[i];
          // If the OMR image is a local path (starts with /uploads/omr/)
          if (doc.omrSheetImage && doc.omrSheetImage.startsWith('/uploads/omr/')) {
            const localFilePath = path.join(dataPath, doc.omrSheetImage);
            if (fs.existsSync(localFilePath)) {
              console.log(`   - 📤 Uploading local OMR image to Cloudinary: ${doc.omrSheetImage}`);
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

      // Upsert to cloud
      const bulkOps = docs.map(doc => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true
        }
      }));

      const result = await cloudColl.bulkWrite(bulkOps);
      
      // Cleanup orphaned documents on the cloud (docs that exist in cloud for this institute but not locally)
      if (collName !== 'institutes' && docs.length > 0) {
        // Find the institute ID from the first document (assuming all docs belong to the local institute)
        const instId = docs[0].instituteId;
        if (instId) {
          const localIds = docs.map(doc => doc._id);
          const delResult = await cloudColl.deleteMany({
            instituteId: instId,
            _id: { $nin: localIds }
          });
          if (delResult.deletedCount > 0) {
            console.log(`   - 🗑️ Deleted ${delResult.deletedCount} orphaned cloud documents.`);
          }
        }
      }

      console.log(`   - Synced ${docs.length} documents (${result.upsertedCount} new, ${result.modifiedCount} updated).`);
    }

    console.log('✅ Cloud Sync Completed Successfully!');
  } catch (err) {
    console.error('❌ Cloud Sync Failed:', err);
  } finally {
    if (localConn) await localConn.close();
    if (cloudConn) await cloudConn.close();
    process.exit(0);
  }
}

syncToCloud();
