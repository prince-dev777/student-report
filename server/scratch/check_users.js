import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const UserSchema = new mongoose.Schema({
  username: String,
  email: String,
  instituteName: String,
}, { strict: false });

const User = mongoose.model('User', UserSchema);

async function check() {
  console.log("Connecting to live MongoDB database...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected!\n");

  const users = await User.find();
  console.log(`Found ${users.length} registered users:`);
  users.forEach(u => {
    console.log(`- Username: "${u.username}" | Email: "${u.email}" | Institute: "${u.instituteName}"`);
  });

  mongoose.disconnect();
}

check().catch(console.error);
