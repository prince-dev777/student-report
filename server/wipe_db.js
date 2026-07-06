import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

async function wipeDB() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/edutrack';
    await mongoose.connect(uri);
    console.log('Connected to DB:', uri);
    const collections = await mongoose.connection.db.collections();
    for (let collection of collections) {
      if (collection.collectionName !== 'users' && collection.collectionName !== 'institutes') {
        await collection.drop();
        console.log(`Dropped collection: ${collection.collectionName}`);
      }
    }
    console.log('Wipe complete (users and institutes kept).');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
wipeDB();
