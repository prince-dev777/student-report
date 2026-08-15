const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'server.js');
let content = fs.readFileSync(serverPath, 'utf8');

// 1. Replace the /api/sync implementation
const oldSyncTarget = `// ---- 🔄 Sync API (Local to Cloud Backup) ----
app.post('/api/sync', protect, async (req, res) => {
  const CLOUD_URI = 'mongodb://student_report:helloai.com@ac-hqw4l9b-shard-00-00.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-01.thx91mx.mongodb.net:27017,ac-hqw4l9b-shard-00-02.thx91mx.mongodb.net:27017/test?ssl=true&replicaSet=atlas-srcmx3-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0';
  
  try {
    console.log('🔄 Starting Backup Sync to Cloud...');
    
    // Connect to Cloud DB
    const cloudConn = await mongoose.createConnection(CLOUD_URI).asPromise();
    
    const collections = ['institutes', 'users', 'students', 'tests', 'testresults', 'attendances', 'smslogs', 'notifications', 'devices'];
    
    let totalMigrated = 0;

    for (const colName of collections) {
      const localDocs = await mongoose.connection.collection(colName).find({}).toArray();
      
      if (localDocs.length > 0) {
        const cloudCollection = cloudConn.collection(colName);
        await cloudCollection.deleteMany({}); // Wipe cloud target
        await cloudCollection.insertMany(localDocs); // Insert all
        totalMigrated += localDocs.length;
      }
    }

    await cloudConn.close();
    console.log(\`✅ Backup complete! Migrated \${totalMigrated} documents to Cloud.\`);
    res.json({ message: \`Successfully backed up \${totalMigrated} records to the Cloud.\` });
  } catch (err) {
    console.error('❌ Sync failed:', err);
    res.status(500).json({ error: 'Failed to sync data to the cloud. Check internet connection.' });
  }
});`;

const newSyncContent = `// ---- 🔄 Sync API (Local to Cloud Backup) ----
app.post('/api/sync', protect, (req, res) => {
  console.log('🔄 Triggering sync-cloud.js...');
  
  const child = spawn(process.execPath, ['sync-cloud.js'], { cwd: __dirname, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
  
  let output = '';
  child.stdout.on('data', (data) => output += data.toString());
  child.stderr.on('data', (data) => output += data.toString());
  
  child.on('close', (code) => {
    if (code !== 0) {
      console.error(\`❌ Sync failed with code \${code}. Output: \${output}\`);
      return res.status(500).json({ error: 'Failed to sync data to the cloud. Check internet connection.' });
    }
    console.log(\`✅ Backup complete! Output: \${output}\`);
    // Record successful sync
    try {
      fs.writeFileSync(path.join(__dirname, 'sync-status.json'), JSON.stringify({ lastSync: new Date().toISOString() }));
    } catch(e) { console.error('Failed to write sync-status.json', e); }
    res.json({ message: 'Successfully backed up all records and images to the Cloud.' });
  });
});

app.get('/api/system/backup-info', protect, (req, res) => {
  let lastSync = null;
  const statusFile = path.join(__dirname, 'sync-status.json');
  if (fs.existsSync(statusFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(statusFile));
      lastSync = data.lastSync;
    } catch(e) {}
  }
  res.json({ autoBackupTime: '11:00 PM', lastSync });
});`;

content = content.replace(oldSyncTarget, newSyncContent);

// 2. Append the scheduler at the end of the file
const schedulerContent = `

// ---- 🕒 Auto-Backup Scheduler ----
let isSyncingAuto = false;
setInterval(() => {
  const now = new Date();
  let lastSync = null;
  const statusFile = path.join(__dirname, 'sync-status.json');
  
  if (fs.existsSync(statusFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(statusFile));
      if (data.lastSync) lastSync = new Date(data.lastSync);
    } catch(e) {}
  }

  const todayStr = now.toISOString().split('T')[0];
  const lastSyncStr = lastSync ? lastSync.toISOString().split('T')[0] : null;

  let shouldBackup = false;
  if (lastSyncStr !== todayStr) {
    if (now.getHours() >= 23) {
      shouldBackup = true; // 11:00 PM reached
    } else if (lastSync) {
      // If we missed yesterday completely (more than 24h ago), catch up now
      const msSinceLastSync = now - lastSync;
      if (msSinceLastSync > 24 * 60 * 60 * 1000) {
        shouldBackup = true;
      }
    }
  }

  if (shouldBackup && !isSyncingAuto) {
    isSyncingAuto = true;
    console.log('🔄 [Scheduler] Auto-Backup triggered...');
    
    const child = spawn(process.execPath, ['sync-cloud.js'], { cwd: __dirname, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
    
    child.on('close', (code) => {
      isSyncingAuto = false;
      if (code !== 0) {
        console.error(\`❌ [Scheduler] Auto-Backup failed with code \${code} (will retry in 10 mins)\`);
      } else {
        console.log(\`✅ [Scheduler] Auto-Backup complete!\`);
        try {
          fs.writeFileSync(statusFile, JSON.stringify({ lastSync: new Date().toISOString() }));
        } catch(e) {}
      }
    });
  }
}, 10 * 60 * 1000); // Check every 10 minutes
`;

if (!content.includes('// ---- 🕒 Auto-Backup Scheduler ----')) {
  content += schedulerContent;
}

fs.writeFileSync(serverPath, content, 'utf8');
console.log('Successfully updated server.js');
