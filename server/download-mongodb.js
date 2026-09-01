import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import AdmZip from 'adm-zip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// URL for MongoDB 7.0 Windows x64 binaries
const MONGODB_URL = 'https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.12.zip';
const BIN_DIR = path.join(__dirname, 'bin');
const ZIP_PATH = path.join(BIN_DIR, 'mongodb.zip');

async function downloadMongoDB() {
  if (process.platform !== 'win32' || process.env.VERCEL || process.env.CI) {
    console.log('ℹ️ Non-Windows or CI environment detected. Skipping Windows mongod.exe binary download.');
    return;
  }

  if (fs.existsSync(path.join(BIN_DIR, 'mongod.exe'))) {
    console.log('✅ mongod.exe already exists. Skipping download.');
    return;
  }

  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR, { recursive: true });
  }

  console.log('⏳ Downloading MongoDB binaries (this might take a minute)...');
  
  const writer = fs.createWriteStream(ZIP_PATH);
  
  const response = await axios({
    url: MONGODB_URL,
    method: 'GET',
    responseType: 'stream'
  });

  let totalSize = parseInt(response.headers['content-length'], 10);
  let downloadedSize = 0;

  response.data.on('data', (chunk) => {
    downloadedSize += chunk.length;
    const percentage = ((downloadedSize / totalSize) * 100).toFixed(2);
    process.stdout.write(`\rDownloading... ${percentage}%`);
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function extractMongoDB() {
  if (fs.existsSync(path.join(BIN_DIR, 'mongod.exe'))) {
    return;
  }

  console.log('\n📦 Extracting MongoDB binaries...');
  const zip = new AdmZip(ZIP_PATH);
  
  const zipEntries = zip.getEntries();
  for (const entry of zipEntries) {
    if (entry.entryName.endsWith('mongod.exe')) {
      // Extract only mongod.exe directly to bin/
      const content = zip.readFile(entry);
      fs.writeFileSync(path.join(BIN_DIR, 'mongod.exe'), content);
      break;
    }
  }

  console.log('✅ MongoDB mongod.exe extracted successfully!');
  
  // Clean up zip
  if (fs.existsSync(ZIP_PATH)) {
    fs.unlinkSync(ZIP_PATH);
  }
}

async function run() {
  if (process.platform !== 'win32' || process.env.VERCEL || process.env.CI) {
    console.log('ℹ️ Non-Windows or CI environment detected. Skipping local MongoDB binary setup.');
    return;
  }

  try {
    await downloadMongoDB();
    await extractMongoDB();
    console.log('🎉 Local MongoDB setup complete!');
  } catch (error) {
    console.error('\n❌ Failed to setup local MongoDB:', error.message);
    process.exit(1);
  }
}

run();
