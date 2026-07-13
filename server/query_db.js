import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const db = mongoose.connection.db;
    const tests = await db.collection('tests').find({}).toArray();
    console.log(JSON.stringify(tests, null, 2));
    process.exit(0);
  });
