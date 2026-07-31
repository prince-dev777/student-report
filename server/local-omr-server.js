import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { spawn, spawnSync, exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import os from 'os';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env (for VITE_API_BASE_URL) and server/.env (for local configurations)
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '.env') });
// Fallback to .env.production if .env doesn't have the tokens
dotenv.config({ path: path.join(__dirname, '.env.production') });

process.on('unhandledRejection', (reason, promise) => {
  console.warn('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

// Handle graceful shutdown to avoid zombie Chromium/Node processes locking port 5001
const gracefulShutdown = async () => {
  console.log('\nShutting down local-omr-server gracefully...');
  try {
    const { disconnectWhatsAppClient } = await import('./services/whatsappClient.js');
    disconnectWhatsAppClient(); // Safely closes Puppeteer and releases session locks
  } catch (err) {
    console.error('Error during shutdown:', err);
  }
  process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('exit', () => console.log('Local Server Exited.'));

import { 
  initializeWhatsAppClient, 
  getWhatsAppClientState, 
  disconnectWhatsAppClient, 
  sendWhatsAppMessageWeb,
  resetRetryCount
} from './services/whatsappClient.js';

const app = express();
const PORT = 5001;

// Helper to get Local IP
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

app.get('/api/local-ip', (req, res) => {
  res.json({ ip: getLocalIP() });
});

// Middleware
app.use(cors());
// Biometric ADMS needs raw text
app.use('/iclock', express.text({ type: '*/*' }));
app.use(express.json());
const dataPath = process.env.USER_DATA_PATH || __dirname;
// Expose uploads directory so frontend can show the scanned images
app.use('/uploads', express.static(path.join(dataPath, 'uploads')));

// Ensure upload directory exists
const uploadDir = path.join(dataPath, 'uploads', 'omr');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

function safeUnlink(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    console.warn(`Failed to remove uploaded file ${filePath}:`, err.message);
  }
}

function cleanupOldOMRFiles() {
  try {
    const files = fs.readdirSync(uploadDir);
    const now = Date.now();
    // Only delete temporary JSON args files older than 24 hours
    // NEVER delete OMR image files — they are needed for "View OMR" in results
    const maxAge = 24 * 60 * 60 * 1000;
    
    let deletedCount = 0;
    files.forEach(file => {
      const filePath = path.join(uploadDir, file);
      const stats = fs.statSync(filePath);
      
      // Only delete temp args JSON files, not actual OMR images
      if (stats.isFile() && file.endsWith('.json') && file.startsWith('omr_args_')) {
        if (now - stats.mtimeMs > maxAge) {
          safeUnlink(filePath);
          deletedCount++;
        }
      }
    });
    if (deletedCount > 0) {
      console.log(`[Cleanup] Deleted ${deletedCount} old temp args files from uploads directory.`);
    }
  } catch (err) {
    console.warn('[Cleanup] Failed to clean up old files:', err.message);
  }
}

// Run cleanup immediately on server startup, and every 12 hours thereafter
cleanupOldOMRFiles();
setInterval(cleanupOldOMRFiles, 12 * 60 * 60 * 1000);

app.post('/api/local-omr-process', upload.array('images', 500), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    const imagePaths = req.files.map(file => file.path);
    const pythonScriptPath = path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), 'omr_engine_v2.py');

    let templateId = req.body.templateId;
    const questionsToDetect = Number(req.body.questionsToDetect) || 0;
    
    // Parse test details sent from frontend
    const testData = JSON.parse(req.body.testData || '{}');
    const marksPerQuestion = testData.marksPerQuestion || 1;
    const negativeMarking = testData.negativeMarking !== undefined ? testData.negativeMarking : 0;
    let answer_keys = testData.answer_keys || {};
    if (Array.isArray(answer_keys)) {
      answer_keys = { "General": answer_keys };
    }
    let template_config = testData.template_config;
    let mapped_questions = testData.mapped_questions || [];
    
    // Do NOT override templateId — the frontend already sends the correct value
    // (either 'jee_75' for MCQ-only or 'jee_75_with_numerical' for MCQ+Numerical).
    // The Python engine's determine_template() handles fallback detection correctly.

    const tempArgsPath = path.join(uploadDir, `omr_args_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.json`);
    const jsonPayload = {
      image_paths: imagePaths,
      original_names: req.files.map(file => file.originalname),
      answer_keys: answer_keys,
      mapped_questions: mapped_questions,
      marks_per_question: marksPerQuestion,
      negative_marking: negativeMarking
    };
    if (templateId) jsonPayload.template_id = templateId;
    if (template_config) jsonPayload.template_config = template_config;

    fs.writeFileSync(tempArgsPath, JSON.stringify(jsonPayload));

    let pythonProcess;
    const exePath = path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), 'omr_engine_v2.exe');
    
    if (fs.existsSync(exePath)) {
      // Spawn compiled executable directly
      pythonProcess = spawn(exePath, [tempArgsPath]);
    } else {
      let pythonCmd = process.env.PYTHON_CMD;
      if (!pythonCmd) {
        const python3Check = spawnSync('python3', ['--version']);
        pythonCmd = python3Check.error ? 'python' : 'python3';
      }
      pythonProcess = spawn(pythonCmd, [pythonScriptPath, tempArgsPath]);
    }

    let pythonOutput = '';
    let pythonError = '';

    pythonProcess.stdout.on('data', (data) => {
      pythonOutput += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      pythonError += data.toString();
    });

    pythonProcess.on('close', async (code) => {
      fs.writeFileSync(path.join(uploadDir, 'last_python_output.txt'), pythonOutput);
      fs.writeFileSync(path.join(uploadDir, 'last_python_error.txt'), pythonError);
      safeUnlink(tempArgsPath);

      let parsedResults = null;
      let parseSuccess = false;
      try {
        parsedResults = JSON.parse(pythonOutput);
        parseSuccess = true;
      } catch (e) {}

      // If python failed AND it didn't produce a valid results array
      if (code !== 0 && (!parseSuccess || !Array.isArray(parsedResults))) {
        imagePaths.forEach(safeUnlink);
        console.error('Python Error:', pythonError);
        if (parseSuccess && parsedResults && parsedResults.error) {
          return res.status(500).json({ error: parsedResults.error, details: pythonError });
        }
        return res.status(500).json({ error: 'OMR Processing failed', details: pythonError });
      }

      const results = parsedResults;
      if (!results || results.error) {
        imagePaths.forEach(safeUnlink);
        return res.status(400).json({ error: results ? results.error : 'Unknown error' });
      }

        const parsedData = [];
        const errors = [];

        for (let idx = 0; idx < results.length; idx++) {
          const r = results[idx];
          const imgPath = imagePaths[idx];

          if (r.error) {
            errors.push({ error: r.error, details: r.details || '', rollNumber: r.rollNumber || 'Unknown' });
            continue;
          }

          let studentAnswers = [];
          if (r.subjects) {
            const subjectNames = Object.keys(r.subjects).sort();
            for (const subj of subjectNames) {
              studentAnswers = studentAnswers.concat(r.subjects[subj]);
            }
          } else {
            studentAnswers = r.studentAnswers || [];
          }

          // Return raw data to React, React will match with Student DB
          let webPath = 'http://localhost:5001/uploads/omr/' + path.basename(imgPath);
          try {
             const base64Data = fs.readFileSync(imgPath).toString('base64');
             webPath = 'data:image/jpeg;base64,' + base64Data;
          } catch (imgErr) {
             console.error('Failed to read image for base64 conversion:', imgErr.message);
          }

          parsedData.push({
            rollNo: r.rollNumber,
            marks: r.totalMarks !== undefined ? r.totalMarks : (r.marks || 0),
            correctCount: r.correctCount,
            wrongCount: r.wrongCount,
            studentAnswers: studentAnswers,
            omrSheetImage: webPath
          });
        }

        res.status(200).json({ message: 'Images Processed Successfully.', results: parsedData, errors });

    });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---- 📡 Biometric ADMS Local Proxy Relay ----
// Forward local network requests from biometric machine to Cloud Server

function getCloudApiUrl() {
  // Always use Render Cloud URL for WhatsApp polling and cloud communication.
  // In dev mode, VITE_API_BASE_URL points to localhost:5000 which doesn't have
  // the WHATSAPP_TOKEN configured locally, causing 401 errors.
  return 'https://student-report-ezgw.onrender.com';
}

app.get('/iclock/cdata', async (req, res) => {
  try {
    const cloudUrl = getCloudApiUrl();
    const response = await fetch(`${cloudUrl}/iclock/cdata?${new URLSearchParams(req.query)}`);
    const text = await response.text();
    res.send(text);
  } catch (err) {
    console.error('[ADMS Proxy] Error in GET /iclock/cdata:', err.message);
    res.send('OK');
  }
});

app.get('/iclock/getrequest', async (req, res) => {
  try {
    const cloudUrl = getCloudApiUrl();
    const response = await fetch(`${cloudUrl}/iclock/getrequest?${new URLSearchParams(req.query)}`);
    const text = await response.text();
    res.send(text);
  } catch (err) {
    console.error('[ADMS Proxy] Error in GET /iclock/getrequest:', err.message);
    res.send('OK');
  }
});

app.post('/iclock/cdata', async (req, res) => {
  try {
    const rawData = req.body;
    const cloudUrl = getCloudApiUrl();
    
    // Forward the raw punch data to the actual cloud server
    const response = await fetch(`${cloudUrl}/iclock/cdata?${new URLSearchParams(req.query)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: rawData
    });
    
    const text = await response.text();
    res.send(text);
  } catch (err) {
    console.error('[ADMS Proxy] Error in POST /iclock/cdata (Pushing to Cloud):', err.message);
    res.send('OK'); // Return OK to machine so it doesn't get stuck
  }
});

// ---- 📱 Local WhatsApp Client API Endpoints ----
app.get('/api/whatsapp/local-status', (req, res) => {
  res.json(getWhatsAppClientState());
});

app.post('/api/whatsapp/local-initialize', (req, res) => {
  resetRetryCount(); // Reset retry counter on manual user action
  initializeWhatsAppClient();
  res.json({ success: true, message: 'WhatsApp client initialization started.' });
});

app.post('/api/whatsapp/local-disconnect', async (req, res) => {
  const success = await disconnectWhatsAppClient();
  res.json({ success, message: success ? 'WhatsApp client disconnected.' : 'Failed to disconnect.' });
});

// ---- 🖥️ System Info API ----
app.get('/api/system/local-ip', (req, res) => {
  const nets = os.networkInterfaces();
  let localIp = '127.0.0.1';
  
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        // Return the first one found (usually the active Wi-Fi or Ethernet adapter)
        localIp = net.address;
        break;
      }
    }
    if (localIp !== '127.0.0.1') break;
  }
  
  res.json({ ip: localIp, port: 5001 });
});

// ---- 📡 Background Polling Loop for Pending WhatsApp Messages ----
let isPolling = false;

async function pollPendingWhatsAppMessages() {
  if (isPolling) return;
  if (process.env.WHATSAPP_PROVIDER !== 'whatsapp-web') return;

  const state = getWhatsAppClientState();
  if (state.status !== 'ready') return;

  isPolling = true;

  try {
    const cloudUrl = getCloudApiUrl();
    const token = process.env.WHATSAPP_TOKEN;

    if (!token) {
      isPolling = false;
      return;
    }

    const response = await fetch(`${cloudUrl}/api/whatsapp/pending?token=${token}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const pendingLogs = await response.json();

    if (pendingLogs && pendingLogs.length > 0) {
      console.log(`[WhatsApp Poller] Found ${pendingLogs.length} pending messages.`);
      
      for (const log of pendingLogs) {
        try {
          const phones = log.parentPhone.split(',').map(p => p.trim()).filter(Boolean);
          for (const phone of phones) {
            await sendWhatsAppMessageWeb(phone, log.message, log.attachment);
            // Small delay between sending to two numbers of the same student
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          await fetch(`${cloudUrl}/api/whatsapp/status?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logId: log.id, status: 'delivered' })
          });
          console.log(`[WhatsApp Poller] Message sent to ${log.parentPhone} and status updated to delivered.`);
        } catch (sendErr) {
          console.error(`[WhatsApp Poller] Failed to send message to ${log.parentPhone}:`, sendErr.message);
          
          await fetch(`${cloudUrl}/api/whatsapp/status?token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logId: log.id, status: 'failed' })
          });
        }
        
        // Rate limit: 2 seconds delay between messages to prevent bans
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  } catch (err) {
    console.error('[WhatsApp Poller] Polling error:', err.message);
  } finally {
    isPolling = false;
  }
}

// Auto-initialize local WhatsApp client if configured as provider
if (process.env.WHATSAPP_PROVIDER === 'whatsapp-web') {
  initializeWhatsAppClient();
}

// Poll every 5 seconds
setInterval(pollPendingWhatsAppMessages, 5000);

// ============================================
// WhatsApp Local API Routes
// ============================================

app.post('/api/whatsapp/local-initialize', (req, res) => {
  initializeWhatsAppClient();
  res.json({ success: true, message: 'Initialization started' });
});

app.post('/api/whatsapp/local-disconnect', async (req, res) => {
  const success = await disconnectWhatsAppClient();
  res.json({ success, message: success ? 'Disconnected' : 'Not connected' });
});

app.get('/api/whatsapp/local-status', (req, res) => {
  res.json(getWhatsAppClientState());
});

// ============================================
// System Update API Routes
// ============================================
let updateState = { 
  status: 'idle', // 'idle' | 'available' | 'downloading' | 'downloaded'
  version: '', 
  releaseDate: '',
  currentVersion: '',
  progress: 0 
};

process.on('message', (msg) => {
  if (msg && msg.type === 'APP_INFO') {
    updateState.currentVersion = msg.version;
  }
  else if (msg && msg.type === 'UPDATE_AVAILABLE') {
    updateState = { 
      ...updateState, 
      status: 'available', 
      version: msg.version, 
      releaseDate: msg.releaseDate || '' 
    };
    console.log('[Local OMR] Update available:', msg.version);
  }
  else if (msg && msg.type === 'UPDATE_PROGRESS') {
    updateState.status = 'downloading';
    updateState.progress = msg.percent;
  }
  else if (msg && msg.type === 'UPDATE_DOWNLOADED') {
    updateState.status = 'downloaded';
    updateState.version = msg.version || 'new';
    console.log('[Local OMR] Update downloaded from main process:', msg.version);
  }
});

app.get('/api/system/update-status', (req, res) => {
  res.json(updateState);
});

app.post('/api/system/start-download', (req, res) => {
  if (process.send) {
    try { process.send({ type: 'START_DOWNLOAD' }); } catch(e) {}
  }
  res.json({ success: true, message: 'Download started' });
});

app.post('/api/system/restart-and-update', (req, res) => {
  if (process.send) {
    try { process.send({ type: 'QUIT_AND_INSTALL' }); } catch(e) {}
  }
  res.json({ success: true, message: 'Restarting application...' });
});

// ============================================
// Cloud API Proxy - Forward non-local API requests to Render server
// This keeps everything same-origin (no CORS issues in Electron)
// ============================================
app.all('/api/*', async (req, res) => {
  const targetUrl = `${getCloudApiUrl()}${req.originalUrl}`;
  
  try {
    const proxyHeaders = {};
    if (req.headers['content-type']) proxyHeaders['Content-Type'] = req.headers['content-type'];
    if (req.headers['authorization']) proxyHeaders['Authorization'] = req.headers['authorization'];
    
    const fetchOptions = {
      method: req.method,
      headers: proxyHeaders,
    };
    
    if (!['GET', 'HEAD'].includes(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }
    
    const response = await fetch(targetUrl, fetchOptions);
    
    res.status(response.status);
    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    
    const data = await response.text();
    res.send(data);
  } catch (err) {
    console.error(`[Proxy] Error forwarding ${req.method} ${req.originalUrl}:`, err.message);
    res.status(502).json({ error: 'Cloud server unavailable: ' + err.message });
  }
});

// Serve frontend static files (for Electron production mode)
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA catch-all: serve index.html for any non-API route
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads') && !req.path.startsWith('/iclock')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// Helper: kill process using a specific port (Windows)
function killProcessOnPort(port) {
  return new Promise((resolve) => {
    exec(`netstat -ano | findstr :${port} | findstr LISTENING`, (err, stdout) => {
      if (err || !stdout.trim()) return resolve(false);
      const lines = stdout.trim().split('\n');
      const pids = new Set();
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0' && pid !== String(process.pid)) {
          pids.add(pid);
        }
      }
      if (pids.size === 0) return resolve(false);
      let killed = 0;
      for (const pid of pids) {
        exec(`taskkill /PID ${pid} /F`, (killErr) => {
          killed++;
          if (killed === pids.size) resolve(true);
        });
      }
    });
  });
}

function startListening(retryCount = 0) {
  const server = app.listen(PORT, () => {
    console.log(`🔌 Local Edge OMR Server & Biometric Relay listening on http://localhost:${PORT}`);
  });

  server.on('error', async (err) => {
    if (err.code === 'EADDRINUSE' && retryCount < 3) {
      console.warn(`[Server] Port ${PORT} in use. Killing old process and retrying... (attempt ${retryCount + 1})`);
      await killProcessOnPort(PORT);
      // Wait a moment for port to be released
      setTimeout(() => startListening(retryCount + 1), 2000);
    } else {
      console.error(`[Server] Fatal error starting server:`, err.message);
    }
  });
}

// Listen for shutdown message from Electron parent process
process.on('message', (msg) => {
  if (msg === 'shutdown') {
    console.log('[Server] Received shutdown signal from Electron.');
    gracefulShutdown();
  }
});

startListening();
