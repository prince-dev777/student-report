import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const CLOUD_URI = process.env.MONGODB_URI || 'mongodb://student_report:helloai.com@ac-hqw4l9b-shard-00-00.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-01.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-02.thx91mx.mongodb.net:27017/test?ssl=true&replicaSet=atlas-srcmx3-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0';
const LOCAL_URI = 'mongodb://127.0.0.1:27018/student-report';

async function migrate() {
  console.log('🔄 Starting Data Migration: Cloud -> Local');
  console.log('---');
  
  // 1. Connect to Cloud DB
  console.log(`📡 Connecting to Cloud Database (Atlas)...`);
  const cloudConn = await mongoose.createConnection(CLOUD_URI).asPromise();
  console.log('✅ Connected to Cloud DB');

  // 2. Connect to Local DB
  console.log(`🏠 Connecting to Local Database (${LOCAL_URI})...`);
  const localConn = await mongoose.createConnection(LOCAL_URI).asPromise();
  console.log('✅ Connected to Local DB');

  // 3. Get all collections from cloud
  const collections = await cloudConn.db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);
  console.log(`\n📋 Found ${collectionNames.length} collections in Cloud DB: ${collectionNames.join(', ')}`);

  // 4. Migrate each collection
  for (const collectionName of collectionNames) {
    if (collectionName.startsWith('system.')) continue;
    
    console.log(`\n📦 Migrating collection: [${collectionName}]`);
    
    const cloudCollection = cloudConn.collection(collectionName);
    const localCollection = localConn.collection(collectionName);
    
    // Clear local collection first to avoid duplicates (safeguard)
    await localCollection.deleteMany({});
    
    // Fetch all documents from cloud
    const documents = await cloudCollection.find({}).toArray();
    
    if (documents.length === 0) {
      console.log(`   - 0 documents found. Skipping.`);
      continue;
    }
    
    // Insert into local
    await localCollection.insertMany(documents);
    console.log(`   ✅ Successfully migrated ${documents.length} documents.`);
  }

  console.log('\n🎉 MIGRATION COMPLETE! All data has been securely copied to your local machine.');
  console.log('You can now switch your .env MONGODB_URI to the local URL.');
  
  await cloudConn.close();
  await localConn.close();
  process.exit(0);
}

migrate().catch(err => {
  console.error('\n❌ Migration Failed:', err);
  process.exit(1);
});
