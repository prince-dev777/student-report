// ==============================================================================
// Career Xone Pro — Bulk Student Photo Uploader & Cloudinary Sync Engine
// ==============================================================================
// Usage:
//   node scripts/bulk_upload_student_photos.js [optional_folder_path] [--force]
// Example:
//   node scripts/bulk_upload_student_photos.js "C:\Users\sawar\Downloads\student_photos"
// Or simply drop photos into the project's default folder: ./student_photos/
// ==============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Load packages seamlessly from server/node_modules
const serverRequire = createRequire(path.join(rootDir, 'server', 'package.json'));
const dotenv = serverRequire('dotenv');
const mongoose = serverRequire('mongoose');
const { v2: cloudinary } = serverRequire('cloudinary');

// Load environment variables
dotenv.config({ path: path.join(rootDir, '.env') });
dotenv.config({ path: path.join(rootDir, 'server', '.env') });
dotenv.config({ path: path.join(rootDir, 'server', '.env.production') });

// Cloudinary Configuration
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'oh1uu2ap';
const API_KEY = process.env.CLOUDINARY_API_KEY || '582756462519588';
const API_SECRET = process.env.CLOUDINARY_API_SECRET || 'isOqU56bSg41ctfEqqH2Cz9Z_bM';

cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: API_KEY,
  api_secret: API_SECRET,
  secure: true
});

// MongoDB Connection URI (Local + Cloud Fallback)
const CLOUD_MONGO_URI = process.env.MONGODB_URI || process.env.CLOUD_MONGODB_URI || 'mongodb://student_report:helloai.com@ac-hqw4l9b-shard-00-00.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-01.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-02.thx91mx.mongodb.net:27017/test?ssl=true&replicaSet=atlas-srcmx3-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0';
const LOCAL_MONGO_URI = process.env.LOCAL_MONGODB_URI || 'mongodb://127.0.0.1:27018/student-report';

// Supported Image Extensions
const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.jfif', '.avif', '.bmp']);

/**
 * Smart Roll Number Extractor from Filename
 * Handles:
 * - "8074.jpg" -> "8074"
 * - "roll_8074.png" -> "8074"
 * - "Roll-8074.jpeg" -> "8074"
 * - "CAREER8074.jpg" -> "8074"
 * - "8074_photo.jpg" -> "8074"
 * - "8074 (1).jpg" -> "8074"
 * - "STU_101.jpg" -> "101"
 */
function extractRollNumber(filename) {
  const ext = path.extname(filename);
  let base = path.basename(filename, ext).trim();

  // Strip common prefixes
  base = base.replace(/^(roll[_\-\s]*|r[_\-\s]*|stu[_\-\s]*|student[_\-\s]*)/i, '');
  base = base.replace(/^(career[_\-\s]*)/i, '');

  // Strip duplicate markers like "(1)", "_copy", "_photo"
  base = base.replace(/\s*\(\d+\)$/, '');
  base = base.replace(/[_\-\s]*(photo|img|pic|image|avatar|passport).*$/i, '');
  base = base.trim();

  // If there's a strong numeric sequence, extract it
  const numMatch = base.match(/^(\d+)/);
  if (numMatch && numMatch[1]) {
    return numMatch[1];
  }

  return base;
}

async function connectDatabases() {
  console.log('📡 Connecting to MongoDB Database...');
  let localConn = null;
  let cloudConn = null;

  // Try local first
  try {
    localConn = await mongoose.createConnection(LOCAL_MONGO_URI, { serverSelectionTimeoutMS: 2000 }).asPromise();
    console.log('  ✅ Connected to Local MongoDB (Desktop Engine).');
  } catch (err) {
    try {
      localConn = await mongoose.createConnection('mongodb://127.0.0.1:27017/student-report', { serverSelectionTimeoutMS: 2000 }).asPromise();
      console.log('  ✅ Connected to Standard Local MongoDB (Port 27017).');
    } catch (e) {
      console.log('  ℹ️ Local MongoDB daemon not active; operating directly on Cloud MongoDB Atlas.');
    }
  }

  // Always connect to Cloud Atlas to ensure instant cloud synchronization
  try {
    cloudConn = await mongoose.createConnection(CLOUD_MONGO_URI, { serverSelectionTimeoutMS: 8000 }).asPromise();
    console.log('  ✅ Connected to Cloud MongoDB Atlas (Web & Portals).');
  } catch (err) {
    console.warn('  ⚠️ Cloud Atlas connection error:', err.message);
  }

  if (!localConn && !cloudConn) {
    throw new Error('Could not connect to neither Local nor Cloud MongoDB! Please verify database connectivity.');
  }

  const StudentSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
  const LocalStudent = localConn ? localConn.model('Student', StudentSchema) : null;
  const CloudStudent = cloudConn ? cloudConn.model('Student', StudentSchema) : null;

  return { localConn, cloudConn, LocalStudent, CloudStudent };
}

async function findStudentByRoll(models, rollNo) {
  const { LocalStudent, CloudStudent } = models;
  const targetModel = LocalStudent || CloudStudent;
  if (!targetModel) return null;

  const cleanRoll = String(rollNo).trim();
  const digitsOnly = cleanRoll.replace(/\D/g, '');

  const searchQueries = [
    { rollNo: cleanRoll },
    { rollNo: { $regex: new RegExp(`^${cleanRoll}$`, 'i') } },
    { rollNumber: cleanRoll },
    { parentUserId: cleanRoll },
    { parentUserId: { $regex: new RegExp(`^${cleanRoll}$`, 'i') } },
    { id: cleanRoll }
  ];

  if (cleanRoll.toUpperCase().startsWith('CAREER')) {
    const stripped = cleanRoll.substring(6);
    searchQueries.push({ rollNo: stripped });
    searchQueries.push({ rollNumber: stripped });
  } else {
    searchQueries.push({ parentUserId: `CAREER${cleanRoll}` });
  }

  if (digitsOnly) {
    const num = parseInt(digitsOnly, 10);
    searchQueries.push({ rollNo: digitsOnly });
    searchQueries.push({ rollNo: num });
    searchQueries.push({ rollNumber: digitsOnly });
    searchQueries.push({ rollNumber: num });
    if (digitsOnly.length === 4) {
      searchQueries.push({ rollNo: `1${digitsOnly}` });
      searchQueries.push({ rollNumber: `1${digitsOnly}` });
    }
  }

  const student = await targetModel.findOne({
    isDeleted: { $ne: true },
    $or: searchQueries
  }).lean();

  return student;
}

async function updateStudentPhoto(models, studentId, photoUrl) {
  const { LocalStudent, CloudStudent } = models;
  const updatePayload = { photo: photoUrl };

  if (LocalStudent) {
    await LocalStudent.updateOne({ _id: studentId }, { $set: updatePayload });
  }
  if (CloudStudent) {
    await CloudStudent.updateOne({ _id: studentId }, { $set: updatePayload });
  }
}

async function runBulkUpload() {
  console.log('==============================================================================');
  console.log('📸 CAREER XONE PRO — BULK STUDENT PHOTO UPLOADER & CLOUDINARY SYNC');
  console.log('==============================================================================');

  const args = process.argv.slice(2);
  const forceOverwrite = args.includes('--force') || args.includes('-f');
  const customPathArg = args.find(a => !a.startsWith('-'));

  // Determine target photos folder
  let photosDir = customPathArg 
    ? path.resolve(customPathArg) 
    : path.join(rootDir, 'student_photos');

  if (!fs.existsSync(photosDir)) {
    // If default folder doesn't exist, create it and guide the user
    fs.mkdirSync(photosDir, { recursive: true });
    console.log(`\n📁 Created default photo drop directory: ${photosDir}`);
    console.log('\n👉 HOW TO USE:');
    console.log(`1. Copy all student photo files into this folder:`);
    console.log(`   📂 ${photosDir}`);
    console.log(`2. Make sure each photo filename contains the student roll number (e.g. 8074.jpg, 101.png).`);
    console.log(`3. Re-run this command:`);
    console.log(`   node scripts/bulk_upload_student_photos.js\n`);
    process.exit(0);
  }

  console.log(`📂 Scanning directory: ${photosDir}`);
  const allFiles = fs.readdirSync(photosDir);
  const imageFiles = allFiles.filter(f => {
    const ext = path.extname(f).toLowerCase();
    return SUPPORTED_EXTENSIONS.has(ext);
  });

  if (imageFiles.length === 0) {
    console.log(`\n⚠️ No supported image files (.jpg, .png, .webp) found in:\n   ${photosDir}`);
    console.log('👉 Please put your student photos inside this folder and run the command again.\n');
    process.exit(0);
  }

  console.log(`🎯 Found ${imageFiles.length} photo files to process.`);
  console.log(`⚙️ Overwrite existing photos: ${forceOverwrite ? 'YES (--force active)' : 'NO (skips students who already have a photo)'}\n`);

  // Connect to DB
  const models = await connectDatabases();

  const stats = {
    total: imageFiles.length,
    uploaded: 0,
    skippedAlreadyHasPhoto: 0,
    unmatchedStudents: [],
    errors: []
  };

  let index = 0;
  for (const filename of imageFiles) {
    index++;
    const filePath = path.join(photosDir, filename);
    const rollNo = extractRollNumber(filename);
    const progressPrefix = `[${index}/${imageFiles.length}] (${Math.round((index / imageFiles.length) * 100)}%)`;

    if (!rollNo) {
      console.log(`${progressPrefix} ⚠️ Could not extract roll number from "${filename}". Skipping.`);
      stats.unmatchedStudents.push({ file: filename, rollNo: null, reason: 'No roll number found in filename' });
      continue;
    }

    // Match student in database
    const student = await findStudentByRoll(models, rollNo);
    if (!student) {
      console.log(`${progressPrefix} ❌ Roll #${rollNo} ("${filename}"): No student found in database.`);
      stats.unmatchedStudents.push({ file: filename, rollNo, reason: 'Student not found in DB' });
      continue;
    }

    // Check if already has photo
    if (student.photo && student.photo.startsWith('https://res.cloudinary.com/') && !forceOverwrite) {
      console.log(`${progressPrefix} ⏩ Roll #${student.rollNo} (${student.name}): Photo already exists. Skipped.`);
      stats.skippedAlreadyHasPhoto++;
      continue;
    }

    // Upload to Cloudinary
    try {
      const publicId = `stu_${student.rollNo || rollNo}_${Date.now()}`;
      process.stdout.write(`${progressPrefix} 📤 Uploading Roll #${student.rollNo} (${student.name})... `);

      const uploadRes = await cloudinary.uploader.upload(filePath, {
        folder: 'careerxone_students',
        public_id: publicId,
        overwrite: true,
        transformation: [
          { width: 500, height: 500, crop: 'limit', quality: 'auto', fetch_format: 'auto' }
        ]
      });

      const secureUrl = uploadRes.secure_url;
      await updateStudentPhoto(models, student._id, secureUrl);
      console.log(`✅ Success! (${uploadRes.format.toUpperCase()}, ${Math.round(uploadRes.bytes / 1024)} KB)`);
      stats.uploaded++;
    } catch (uploadErr) {
      console.log(`❌ Failed: ${uploadErr.message}`);
      stats.errors.push({ file: filename, rollNo, error: uploadErr.message });
    }
  }

  // Cleanup Database Connections
  if (models.localConn) await models.localConn.close();
  if (models.cloudConn) await models.cloudConn.close();

  // Print Final Summary Dashboard
  console.log('\n==============================================================================');
  console.log('📊 BULK PHOTO UPLOAD COMPLETED — SUMMARY REPORT');
  console.log('==============================================================================');
  console.log(`📁 Total Photos Scanned    : ${stats.total}`);
  console.log(`✅ Successfully Uploaded   : ${stats.uploaded}`);
  console.log(`⏩ Skipped (Already Photo) : ${stats.skippedAlreadyHasPhoto} ${!forceOverwrite ? '(Use --force to overwrite)' : ''}`);
  console.log(`❌ Unmatched Roll Numbers  : ${stats.unmatchedStudents.length}`);
  console.log(`⚠️ Errors / Failures       : ${stats.errors.length}`);
  console.log('==============================================================================');

  if (stats.unmatchedStudents.length > 0) {
    console.log('\n⚠️ Unmatched Photos (Check roll numbers or filenames):');
    stats.unmatchedStudents.slice(0, 15).forEach(u => {
      console.log(`  - File: "${u.file}" (Parsed Roll: ${u.rollNo || 'N/A'}) ➡️ ${u.reason}`);
    });
    if (stats.unmatchedStudents.length > 15) {
      console.log(`  ... and ${stats.unmatchedStudents.length - 15} more unmatched files.`);
    }
  }

  console.log('\n🎉 ALL UPLOADED PHOTOS ARE NOW LIVE IN MONGODB ATLAS & DESKTOP APP!');
  console.log('👉 You can now print official student ID cards with high-resolution photos.\n');
}

runBulkUpload().catch(err => {
  console.error('Fatal Script Error:', err);
  process.exit(1);
});
