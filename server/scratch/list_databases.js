import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function list() {
  console.log("Connecting to MongoDB cluster...");
  const conn = await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected!");

  const admin = new mongoose.mongo.Admin(conn.connection.db);
  const result = await admin.listDatabases();
  console.log("\nDatabases in Cluster:");
  result.databases.forEach(db => {
    console.log(`- ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
  });

  mongoose.disconnect();
}

list().catch(console.error);
