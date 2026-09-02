import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { exec, execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let client = null;
let qrCodeData = null; // Stores the latest base64 QR code image
let clientStatus = 'disconnected'; // 'disconnected' | 'qr' | 'connecting' | 'ready' | 'auth_failure'
let initRetryCount = 0;
const MAX_INIT_RETRIES = 3;
const RETRY_DELAYS = [3000, 6000, 15000]; // exponential backoff

function getAuthDataPath() {
  return process.env.USER_DATA_PATH || path.join(__dirname, '..');
}

export function getWhatsAppClientState() {
  return { 
    status: clientStatus, 
    qrCode: qrCodeData,
    info: client && client.info ? {
      pushname: client.info.pushname,
      wid: client.info.wid
    } : null
  };
}

// Helper: safely delete a directory with retry for EBUSY errors
async function safeDeleteDir(dirPath, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
        console.log(`[WhatsAppClient] Deleted session folder: ${dirPath}`);
      }
      return true;
    } catch (err) {
      if (err.code === 'EBUSY' || err.code === 'EPERM') {
        console.warn(`[WhatsAppClient] Session folder busy (attempt ${i + 1}/${maxRetries}), waiting...`);
        // Wait progressively longer for Puppeteer processes to release file locks
        await new Promise(resolve => setTimeout(resolve, (i + 1) * 2000));
      } else {
        console.error(`[WhatsAppClient] Failed to delete session folder:`, err.message);
        return false;
      }
    }
  }
  console.warn(`[WhatsAppClient] Could not delete session folder after ${maxRetries} attempts.`);
  return false;
}

// Helper: safely remove SingletonLock, lockfile, and Chromium socket locks without deleting session credentials
function clearChromiumLocks(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'lockfile'];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        clearChromiumLocks(fullPath);
      } else if (lockFiles.includes(entry.name)) {
        try {
          fs.unlinkSync(fullPath);
          console.log(`[WhatsAppClient] 🔓 Cleared stale Chromium lock file: ${fullPath}`);
        } catch (e) {}
      }
    }
  } catch (err) {}
}

// Helper: kill any leftover Chromium/Chrome processes from whatsapp-web.js
function killLeftoverChromium() {
  return new Promise((resolve) => {
    try {
      const out = execSync('powershell -Command "Get-CimInstance Win32_Process -Filter \\"Name=\'chrome.exe\'\\" | Select-Object CommandLine, ProcessId | ConvertTo-Json"').toString();
      if (!out || out.trim() === '') return resolve();
      
      const processes = JSON.parse(out);
      for (const proc of Array.isArray(processes) ? processes : [processes]) {
        if (proc && proc.CommandLine && (proc.CommandLine.includes('wwebjs_auth') || proc.CommandLine.includes('.wwebjs_cache') || proc.CommandLine.includes('--headless'))) {
          console.log(`[WhatsAppClient] Killing zombie headless Chrome (PID: ${proc.ProcessId})`);
          try {
            execSync('taskkill /F /PID ' + proc.ProcessId);
          } catch (e) {}
        }
      }
    } catch (e) {
      console.log('[WhatsAppClient] Failed to scan/kill zombie Chrome processes:', e.message);
    }

    // Clear stale locks from saved session folders so Chromium can bind cleanly
    try {
      const dataPath = getAuthDataPath();
      clearChromiumLocks(path.join(dataPath, 'data', '.wwebjs_auth'));
      clearChromiumLocks(path.join(dataPath, '.wwebjs_auth'));
    } catch (e) {}

    resolve();
  });
}

let isManualDisconnecting = false;

export async function disconnectWhatsAppClient() {
  isManualDisconnecting = true;
  if (client) {
    try {
      // First destroy the client (closes Puppeteer browser)
      await client.destroy();
      console.log('[WhatsAppClient] Client destroyed successfully.');
    } catch (err) {
      console.error('[WhatsAppClient] Error during client.destroy():', err.message);
    }

    // Reset state immediately
    client = null;
    clientStatus = 'disconnected';
    qrCodeData = null;
    initRetryCount = 0;

    // Wait for Puppeteer/Chromium processes to fully exit
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Now safely delete session folder on manual disconnect
    const dataPath = getAuthDataPath();
    await safeDeleteDir(path.join(dataPath, 'data', '.wwebjs_auth'));
    await safeDeleteDir(path.join(dataPath, '.wwebjs_auth'));

    isManualDisconnecting = false;
    return true;
  }
  
  // Even if no client, reset state
  clientStatus = 'disconnected';
  qrCodeData = null;
  initRetryCount = 0;
  isManualDisconnecting = false;
  return false;
}

export function initializeWhatsAppClient() {
  // If already connecting or ready, do not duplicate
  if (clientStatus === 'connecting' || clientStatus === 'ready' || clientStatus === 'qr') {
    console.log(`[WhatsAppClient] Client already in status: ${clientStatus}. Skipping initialization.`);
    return;
  }

  // Check retry limit
  if (initRetryCount >= MAX_INIT_RETRIES) {
    console.error(`[WhatsAppClient] Max initialization retries (${MAX_INIT_RETRIES}) reached. Stopping.`);
    clientStatus = 'disconnected';
    return;
  }

  console.log(`[WhatsAppClient] Starting WhatsApp Web client... (attempt ${initRetryCount + 1}/${MAX_INIT_RETRIES})`);
  clientStatus = 'connecting';
  qrCodeData = null;

  // Proactively kill any zombie Chromium processes before attempting to start
  killLeftoverChromium().then(() => {
    try {
      const dataPath = getAuthDataPath();
    
    const puppeteerOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-blink-features=AutomationControlled',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        '--disable-infobars',
        '--window-size=1280,800',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    };

    // Always search for system Chrome or Edge for fast, stable Puppeteer launch
    const browserPaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
    
    for (const bPath of browserPaths) {
      if (fs.existsSync(bPath)) {
        puppeteerOptions.executablePath = bPath;
        console.log(`[WhatsAppClient] Found system browser at: ${bPath}`);
        break;
      }
    }
    
    if (!puppeteerOptions.executablePath) {
      console.warn('[WhatsAppClient] WARNING: Could not find system Chrome or Edge! Falling back to bundled Puppeteer.');
    }

    client = new Client({
      authStrategy: new LocalAuth({
        dataPath: path.join(dataPath, 'data', '.wwebjs_auth')
      }),
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1045814658-alpha.html'
      },
      puppeteer: puppeteerOptions
    });

    client.on('qr', async (qr) => {
      console.log('[WhatsAppClient] QR Code received. Scan it to authenticate.');
      clientStatus = 'qr';
      // Reset retry count on QR — means init was successful
      initRetryCount = 0;
      try {
        // Generate base64 Data URL for the QR code image
        qrCodeData = await qrcode.toDataURL(qr);
      } catch (err) {
        console.error('[WhatsAppClient] Failed to generate QR code image:', err.message);
        qrCodeData = qr; // fallback to raw string
      }
    });

    client.on('ready', () => {
      console.log('[WhatsAppClient] WhatsApp Client is READY and authenticated!');
      console.log('[WhatsAppClient] Info:', client.info ? client.info.pushname : 'No info');
      clientStatus = 'ready';
      qrCodeData = null;
      initRetryCount = 0; // Reset on success
    });

    // 🤖 Hook WhatsApp Parent Auto-Reply Bot (catches incoming messages & self-test chats)
    const processedMsgIds = new Set();
    const processMsgSafe = async (msg, eventName) => {
      try {
        if (!msg || !msg.id) {
          console.log(`[WhatsAppBot][${eventName}] ⚠️ Received null/no-id message, skipping.`);
          return;
        }
        const msgId = msg.id._serialized || msg.id.id || `${msg.from}_${msg.timestamp}`;
        console.log(`[WhatsAppBot][${eventName}] 📨 RAW EVENT: from=${msg.from} to=${msg.to} body="${(msg.body||'').slice(0,50)}" fromMe=${msg.fromMe} id=${msgId}`);
        if (processedMsgIds.has(msgId)) {
          console.log(`[WhatsAppBot][${eventName}] 🔁 Duplicate msg ${msgId}, skipping.`);
          return;
        }
        processedMsgIds.add(msgId);
        if (processedMsgIds.size > 500) {
          const first = processedMsgIds.values().next().value;
          processedMsgIds.delete(first);
        }

        const { getBotConfig, handleIncomingWhatsAppMessage } = await import('./whatsappBotService.js');
        const currentBotConfig = getBotConfig ? getBotConfig() : null;
        if (!currentBotConfig || !currentBotConfig.enabled || currentBotConfig.paused === true) {
          return;
        }
        await handleIncomingWhatsAppMessage(client, msg);
      } catch (botErr) {
        console.error(`[WhatsAppBot][${eventName}] ❌ Error handling message:`, botErr.message, botErr.stack);
      }
    };

    client.on('message', (msg) => processMsgSafe(msg, 'message'));
    client.on('message_create', (msg) => processMsgSafe(msg, 'message_create'));

    client.on('authenticated', () => {
      console.log('[WhatsAppClient] WhatsApp Client authenticated.');
    });

    client.on('auth_failure', (msg) => {
      console.error('[WhatsAppClient] WhatsApp Authentication failure:', msg);
      clientStatus = 'auth_failure';
      qrCodeData = null;
      client = null;
    });

    client.on('disconnected', (reason) => {
      console.log('[WhatsAppClient] WhatsApp Client disconnected. Reason:', reason);
      clientStatus = 'disconnected';
      qrCodeData = null;
      client = null;

      // If this was NOT a manual disconnect and NOT an explicit logout on phone, auto-reconnect!
      if (!isManualDisconnecting && reason !== 'LOGOUT') {
        const dataPath = getAuthDataPath();
        const sessionDir = path.join(dataPath, 'data', '.wwebjs_auth');
        if (fs.existsSync(sessionDir)) {
          console.log('[WhatsAppClient] 🔄 Transient network disconnect detected. Auto-reconnecting saved session in 5 seconds...');
          setTimeout(() => {
            if (clientStatus === 'disconnected') {
              initializeWhatsAppClient();
            }
          }, 5000);
        }
      }
    });

    client.initialize().catch(err => {
      console.error('[WhatsAppClient] Initialization call failed:', err.message);
      clientStatus = 'disconnected';
      client = null;
      initRetryCount++;

      // Retry with exponential backoff
      if (initRetryCount < MAX_INIT_RETRIES) {
        const delay = RETRY_DELAYS[initRetryCount - 1] || 15000;
        console.log(`[WhatsAppClient] Will retry in ${delay / 1000}s...`);
        
        // If "browser already running" or locked, kill leftover process and clear lock files
        if (err.message && (err.message.includes('already running') || err.message.includes('EBUSY') || err.message.includes('lock'))) {
          killLeftoverChromium().then(() => {
            const dataPath = getAuthDataPath();
            clearChromiumLocks(path.join(dataPath, 'data', '.wwebjs_auth'));
            clearChromiumLocks(path.join(dataPath, '.wwebjs_auth'));
            setTimeout(() => initializeWhatsAppClient(), delay);
          });
        } else {
          setTimeout(() => initializeWhatsAppClient(), delay);
        }
      } else {
        console.error(`[WhatsAppClient] Giving up after ${MAX_INIT_RETRIES} failed attempts.`);
      }
    });

  } catch (err) {
    console.error('[WhatsAppClient] Failed to create client instance:', err.message);
    clientStatus = 'disconnected';
    client = null;
    initRetryCount++;
  }
  }); // end of killLeftoverChromium
}

// Reset retry counter (called externally when user manually triggers re-init)
export function resetRetryCount() {
  initRetryCount = 0;
}

export async function sendWhatsAppMessageWeb(to, message, attachment = null) {
  if (!client || clientStatus !== 'ready') {
    throw new Error(`WhatsApp client is not ready (Status: ${clientStatus})`);
  }

  // Format phone number: remove non-digits
  let cleanNumber = to.replace(/\D/g, '');
  
  if (!cleanNumber || cleanNumber.length < 10) {
    throw new Error(`Invalid phone number: "${to}" (Must contain at least 10 digits)`);
  }

  // Ensure it has country code (default to 91 if it's 10 digits)
  if (cleanNumber.length === 10) {
    cleanNumber = '91' + cleanNumber;
  }
  
  // Format for whatsapp-web.js: <phone>@c.us
  if (!cleanNumber.endsWith('@c.us')) {
    cleanNumber = `${cleanNumber}@c.us`;
  }

  console.log(`[WhatsAppClient] 🛡️ [Anti-Ban Guard] Preparing human-like delivery to ${cleanNumber}`);
  
  // 1. Simulate Human Typing Indicator before sending
  try {
    const chat = await client.getChatById(cleanNumber);
    if (chat && typeof chat.sendStateTyping === 'function') {
      await chat.sendStateTyping();
      // Natural typing delay between 1.5s and 3.5s based on message length
      const typingDelay = Math.min(3500, Math.max(1500, Math.floor(Math.random() * 2000) + 1500));
      await new Promise(resolve => setTimeout(resolve, typingDelay));
    }
  } catch (typingErr) {
    // Non-fatal, proceed with sending
  }

  // 2. Add subtle micro-entropy (multi-char invisible zero-width permutations) for 100% unique cryptographic hashes
  const zwChars = ['\u200B', '\u200C', '\u200D', '\uFEFF'];
  let zeroWidthVariation = '';
  const seqLength = Math.floor(Math.random() * 6) + 8; // 8 to 13 chars (over 1,000,000 unique permutations)
  for (let k = 0; k < seqLength; k++) {
    zeroWidthVariation += zwChars[Math.floor(Math.random() * zwChars.length)];
  }
  const secureMessage = `${message}${zeroWidthVariation}`;

  if (attachment && attachment.data) {
    try {
      const { MessageMedia } = pkg;
      const media = new MessageMedia(attachment.mimetype, attachment.data, attachment.filename);
      const response = await client.sendMessage(cleanNumber, secureMessage, { media });
      return response;
    } catch (e) {
      console.error(`[WhatsAppClient] Failed to send media: ${e.message}. Falling back to text.`);
      const response = await client.sendMessage(cleanNumber, secureMessage);
      return response;
    }
  } else {
    const response = await client.sendMessage(cleanNumber, secureMessage);
    return response;
  }
}
