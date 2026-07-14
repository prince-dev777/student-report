import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { spawn, spawnSync } from 'child_process';
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
  sendWhatsAppMessageWeb 
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
const upload = multer({ dest: uploadDir });

function safeUnlink(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    console.warn(`Failed to remove uploaded file ${filePath}:`, err.message);
  }
}

app.post('/api/local-omr-process', upload.array('images', 500), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }

    const imagePaths = req.files.map(file => file.path);
    const pythonScriptPath = path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), 'omr_engine_v2.py');

    const templateId = req.body.templateId;
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

    const tempArgsPath = path.join(uploadDir, `omr_args_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.json`);
    const jsonPayload = {
      image_paths: imagePaths,
      original_names: req.files.map(file => file.originalname),
      answer_keys: answer_keys,
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
          const webPath = 'http://localhost:5001/uploads/omr/' + path.basename(imgPath);

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
  // In development, this could be localhost:5000, in prod it's the render URL.
  // We can read it from an env var or default to the known production URL
  return process.env.VITE_API_BASE_URL ? process.env.VITE_API_BASE_URL.replace('/api', '') : 'https://student-report-ezgw.onrender.com';
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
          await sendWhatsAppMessageWeb(log.parentPhone, log.message);
          
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

app.listen(PORT, () => {
  console.log(`🔌 Local Edge OMR Server & Biometric Relay listening on http://localhost:${PORT}`);
});
