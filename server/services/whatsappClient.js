import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

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
  return { status: clientStatus, qrCode: qrCodeData };
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

// Helper: kill any leftover Chromium/Chrome processes from whatsapp-web.js
function killLeftoverChromium() {
  return new Promise((resolve) => {
    // Only kill Chrome processes that belong to wwebjs (by checking command line for wwebjs_auth)
    exec('tasklist /FI "IMAGENAME eq chrome.exe" /FO CSV /NH', (err, stdout) => {
      if (err || !stdout.trim()) return resolve();
      // Simple approach: don't kill all chrome, just resolve. The EBUSY retry handles it.
      resolve();
    });
  });
}

export async function disconnectWhatsAppClient() {
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

    // Now safely delete session folder
    const dataPath = getAuthDataPath();
    const authPath = path.join(dataPath, '.wwebjs_auth');
    await safeDeleteDir(authPath);

    return true;
  }
  
  // Even if no client, reset state
  clientStatus = 'disconnected';
  qrCodeData = null;
  initRetryCount = 0;
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

  try {
    const dataPath = getAuthDataPath();
    
    const puppeteerOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    };

    // Use Electron's own Chromium binary if running in packaged app
    if (process.env.ELECTRON_EXEC_PATH) {
      puppeteerOptions.executablePath = process.env.ELECTRON_EXEC_PATH;
    }

    client = new Client({
      authStrategy: new LocalAuth({
        dataPath: path.join(dataPath, '.wwebjs_auth')
      }),
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
      clientStatus = 'ready';
      qrCodeData = null;
      initRetryCount = 0; // Reset on success
    });

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
        
        // If "browser already running", try to clean up first
        if (err.message && err.message.includes('already running')) {
          killLeftoverChromium().then(() => {
            const dataPath = getAuthDataPath();
            safeDeleteDir(path.join(dataPath, '.wwebjs_auth')).then(() => {
              setTimeout(() => initializeWhatsAppClient(), delay);
            });
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
}

// Reset retry counter (called externally when user manually triggers re-init)
export function resetRetryCount() {
  initRetryCount = 0;
}

export async function sendWhatsAppMessageWeb(to, message) {
  if (!client || clientStatus !== 'ready') {
    throw new Error(`WhatsApp client is not ready (Status: ${clientStatus})`);
  }

  // Format phone number: remove non-digits
  let cleanNumber = to.replace(/\D/g, '');
  
  // Ensure it has country code (default to 91 if it's 10 digits)
  if (cleanNumber.length === 10) {
    cleanNumber = '91' + cleanNumber;
  }
  
  // Format for whatsapp-web.js: <phone>@c.us
  if (!cleanNumber.endsWith('@c.us')) {
    cleanNumber = `${cleanNumber}@c.us`;
  }

  console.log(`[WhatsAppClient] Sending message to ${cleanNumber}: "${message.slice(0, 40)}..."`);
  const response = await client.sendMessage(cleanNumber, message);
  return response;
}
