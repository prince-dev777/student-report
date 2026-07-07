import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const UserSchema = new mongoose.Schema({
  username: String,
  password: { type: String, required: true },
}, { strict: false });

const User = mongoose.model('User', UserSchema);

async function test() {
  console.log("Connecting to live MongoDB database...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected!\n");

  const username = "rohitjha";
  const pass = "cxadmin2025secure";

  const user = await User.findOne({ username });
  if (!user) {
    console.error(`User "${username}" not found!`);
    mongoose.disconnect();
    return;
  }

  console.log("User details from DB:");
  console.log(`- ID: ${user._id}`);
  console.log(`- Username: ${user.username}`);
  console.log(`- Stored Hash: ${user.password}`);

  const isMatch = await bcrypt.compare(pass, user.password);
  console.log(`\nPassword compare result for "${pass}": ${isMatch ? "✅ MATCH" : "❌ NO MATCH"}`);

  mongoose.disconnect();
}

test().catch(console.error);
