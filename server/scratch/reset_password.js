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
  passwordHash: String,
}, { strict: false });

const User = mongoose.model('User', UserSchema);

async function reset() {
  console.log("Connecting to live MongoDB database...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected!\n");

  const username = "rohitjha";
  const newPassword = "cxadmin2025secure";

  const user = await User.findOne({ username });
  if (!user) {
    console.error(`User "${username}" not found!`);
    mongoose.disconnect();
    return;
  }

  user.password = newPassword;
  await user.save();

  console.log(`SUCCESS! Password for user "${username}" has been reset to "${newPassword}".`);

  mongoose.disconnect();
}

reset().catch(console.error);
