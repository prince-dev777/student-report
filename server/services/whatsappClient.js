import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { exec, execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let client = null;
let qrCodeData = null; // Stores the latest base64 QR code image
let pairingCodeData = null; // Stores { code, phoneNumber, requestedAt }
let clientStatus = 'disconnected'; // 'disconnected' | 'qr' | 'connecting' | 'authenticated' | 'ready' | 'auth_failure'
let initRetryCount = 0;
const MAX_INIT_RETRIES = 3;
const RETRY_DELAYS = [3000, 6000, 15000]; // exponential backoff

function getAuthDataPath() {
  const appData = process.env.APPDATA || (process.platform === 'darwin' 
    ? path.join(os.homedir(), 'Library', 'Application Support') 
    : path.join(os.homedir(), '.config'));

  // Canonical persistent storage directory in AppData/Roaming for both Dev and Production
  const canonicalUserData = process.env.USER_DATA_PATH || path.join(appData, 'Career Xone Pro');
  const canonicalSession = path.join(canonicalUserData, 'data', '.wwebjs_auth', 'session', 'Default', 'IndexedDB');
  const canonicalVault = path.join(canonicalUserData, 'data', '.wwebjs_auth', 'session_vault', 'IndexedDB');

  // If canonical location already has an active session, always use it directly
  if (fs.existsSync(canonicalSession) || fs.existsSync(canonicalVault)) {
    console.log(`[WhatsAppClient] 📁 Using canonical persistent session at: ${canonicalUserData}`);
    return canonicalUserData;
  }

  // Check candidate directories (excluding any packed/unpacked program resources) for existing session to auto-migrate
  const candidatePaths = [
    path.join(appData, 'student-report'),
    !__dirname.includes('app.asar') ? path.join(__dirname, '..') : null
  ].filter(Boolean);

  for (const cPath of candidatePaths) {
    if (cPath === canonicalUserData) continue;
    const idbPath = path.join(cPath, 'data', '.wwebjs_auth', 'session', 'Default', 'IndexedDB');
    const vaultPath = path.join(cPath, 'data', '.wwebjs_auth', 'session_vault', 'IndexedDB');
    if (fs.existsSync(idbPath) || fs.existsSync(vaultPath)) {
      console.log(`[WhatsAppClient] 📦 Auto-migrating session from ${cPath} -> ${canonicalUserData}...`);
      try {
        const srcAuth = path.join(cPath, 'data', '.wwebjs_auth');
        const dstAuth = path.join(canonicalUserData, 'data', '.wwebjs_auth');
        fs.mkdirSync(dstAuth, { recursive: true });
        fs.cpSync(srcAuth, dstAuth, { recursive: true, force: true });
        clearChromiumLocks(dstAuth);
        console.log(`[WhatsAppClient] ✅ Successfully migrated session to: ${canonicalUserData}`);
        return canonicalUserData;
      } catch (err) {
        console.warn(`[WhatsAppClient] Migration notice:`, err.message);
      }
    }
  }

  // Fallback to canonical app directory
  try { fs.mkdirSync(canonicalUserData, { recursive: true }); } catch (e) {}
  return canonicalUserData;
}

export function getWhatsAppClientState() {
  const isFunctionallyReady = (client && client.info && client.info.wid) || clientStatus === 'ready';
  return { 
    status: isFunctionallyReady ? 'ready' : clientStatus, 
    qrCode: qrCodeData,
    pairingCode: pairingCodeData,
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

// Helper: safely remove SingletonLock, lockfile, and Chromium socket locks without deleting session credentials or LevelDB locks
function clearChromiumLocks(dirPath) {
  // CRITICAL: NEVER touch or delete lockfiles while Chrome is actively running!
  if (client && clientStatus !== 'disconnected') return;
  if (!fs.existsSync(dirPath)) return;
  const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'lockfile'];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        // Never recurse into or delete inside leveldb directories
        if (!entry.name.endsWith('.leveldb') && !entry.name.endsWith('.ldb')) {
          clearChromiumLocks(fullPath);
        }
      } else if (lockFiles.includes(entry.name)) {
        try {
          fs.unlinkSync(fullPath);
          console.log(`[WhatsAppClient] 🔓 Cleared stale Chromium lock file: ${fullPath}`);
        } catch (e) {}
      }
    }
  } catch (err) {}
}

// ============================================================================
// 🛡️ SESSION VAULT (Self-Healing Backup & Automatic Integrity Restoration)
// ============================================================================

function backupSessionVault(dataPath) {
  try {
    const sessionDir = path.join(dataPath, 'data', '.wwebjs_auth', 'session');
    const vaultDir = path.join(dataPath, 'data', '.wwebjs_auth', 'session_vault');
    if (!fs.existsSync(sessionDir)) return;

    const idbDir = path.join(sessionDir, 'Default', 'IndexedDB', 'https_web.whatsapp.com_0.indexeddb.leveldb');
    if (!fs.existsSync(idbDir)) return;

    // Verify it actually has data files before snapshotting
    const idbFiles = fs.readdirSync(idbDir);
    const hasData = idbFiles.some(f => f.endsWith('.ldb') || f.endsWith('.log'));
    if (!hasData) return;

    fs.mkdirSync(vaultDir, { recursive: true });

    // Copy IndexedDB
    const vaultIdb = path.join(vaultDir, 'IndexedDB');
    fs.mkdirSync(vaultIdb, { recursive: true });
    fs.cpSync(path.join(sessionDir, 'Default', 'IndexedDB'), vaultIdb, { recursive: true, force: true });

    // Copy Local Storage
    const lsDir = path.join(sessionDir, 'Default', 'Local Storage');
    if (fs.existsSync(lsDir)) {
      const vaultLs = path.join(vaultDir, 'Local Storage');
      fs.mkdirSync(vaultLs, { recursive: true });
      fs.cpSync(lsDir, vaultLs, { recursive: true, force: true });
    }

    // Copy Local State
    const localState = path.join(sessionDir, 'Local State');
    if (fs.existsSync(localState)) {
      fs.copyFileSync(localState, path.join(vaultDir, 'Local State'));
    }

    // Write vault metadata
    fs.writeFileSync(path.join(vaultDir, 'vault_meta.json'), JSON.stringify({
      timestamp: new Date().toISOString(),
      user: client?.info?.pushname || 'Authenticated WhatsApp User',
      wid: client?.info?.wid?._serialized || ''
    }, null, 2));

    console.log('[WhatsAppVault] 🛡️ Permanent session snapshot successfully sealed in vault!');
  } catch (err) {
    console.warn('[WhatsAppVault] Failed to snapshot session:', err.message);
  }
}

function restoreSessionFromVault(dataPath) {
  try {
    const sessionDir = path.join(dataPath, 'data', '.wwebjs_auth', 'session');
    const vaultDir = path.join(dataPath, 'data', '.wwebjs_auth', 'session_vault');
    if (!fs.existsSync(vaultDir)) return false;

    const metaFile = path.join(vaultDir, 'vault_meta.json');
    if (!fs.existsSync(metaFile)) return false;

    const vaultIdb = path.join(vaultDir, 'IndexedDB');
    if (!fs.existsSync(vaultIdb)) return false;

    console.log('[WhatsAppVault] 🔄 Self-healing: Restoring authenticated session keys from vault...');

    const destDefault = path.join(sessionDir, 'Default');
    fs.mkdirSync(destDefault, { recursive: true });

    // Restore IndexedDB
    const destIdb = path.join(destDefault, 'IndexedDB');
    fs.mkdirSync(destIdb, { recursive: true });
    fs.cpSync(vaultIdb, destIdb, { recursive: true, force: true });

    // Restore Local Storage
    const vaultLs = path.join(vaultDir, 'Local Storage');
    if (fs.existsSync(vaultLs)) {
      const destLs = path.join(destDefault, 'Local Storage');
      fs.mkdirSync(destLs, { recursive: true });
      fs.cpSync(vaultLs, destLs, { recursive: true, force: true });
    }

    // Restore Local State
    const vaultLocalState = path.join(vaultDir, 'Local State');
    if (fs.existsSync(vaultLocalState)) {
      fs.copyFileSync(vaultLocalState, path.join(sessionDir, 'Local State'));
    }

    clearChromiumLocks(sessionDir);
    console.log('[WhatsAppVault] ✅ Session restored successfully from vault!');
    return true;
  } catch (err) {
    console.warn('[WhatsAppVault] Restore notice:', err.message);
    return false;
  }
}

function verifyAndHealSession(dataPath) {
  const sessionDir = path.join(dataPath, 'data', '.wwebjs_auth', 'session');
  clearChromiumLocks(sessionDir);

  const idbLevelDb = path.join(sessionDir, 'Default', 'IndexedDB', 'https_web.whatsapp.com_0.indexeddb.leveldb');
  let needsHealing = false;

  if (fs.existsSync(idbLevelDb)) {
    const files = fs.readdirSync(idbLevelDb);
    const hasManifest = files.some(f => f.startsWith('MANIFEST'));
    const hasCurrent = files.includes('CURRENT');
    const hasData = files.some(f => f.endsWith('.ldb') || f.endsWith('.log'));
    if (!hasManifest || !hasCurrent || !hasData) {
      console.warn('[WhatsAppVault] ⚠️ Detected corrupted or incomplete LevelDB in session! Triggering self-healing...');
      needsHealing = true;
    }
  } else {
    // If session directory doesn't have LevelDB yet, check if vault has a backup
    needsHealing = true;
  }

  if (needsHealing) {
    restoreSessionFromVault(dataPath);
  }
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

    // Clear stale locks and heal session if needed
    try {
      const dataPath = getAuthDataPath();
      verifyAndHealSession(dataPath);
      clearChromiumLocks(path.join(dataPath, 'data', '.wwebjs_auth'));
      clearChromiumLocks(path.join(dataPath, '.wwebjs_auth'));
    } catch (e) {}

    resolve();
  });
}

let isManualDisconnecting = false;
let heartbeatInterval = null;

function startHeartbeat() {
  stopHeartbeat();
  heartbeatInterval = setInterval(async () => {
    if (!client || clientStatus !== 'ready') return;
    try {
      const statePromise = client.getState();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Heartbeat Timeout')), 10000)
      );
      const state = await Promise.race([statePromise, timeoutPromise]);
      if (state && state !== 'CONNECTED') {
        console.log(`[WhatsAppHeartbeat] Client reporting state: ${state}`);
      }
    } catch (err) {
      // Soft notice only - NEVER forcibly destroy an active client on a momentary delay!
      console.log(`[WhatsAppHeartbeat] Soft notice: ${err.message}`);
    }
  }, 60000);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

export async function disconnectWhatsAppClient() {
  isManualDisconnecting = true;
  stopHeartbeat();
  if (client) {
    try {
      await Promise.race([
        client.destroy(),
        new Promise(resolve => setTimeout(resolve, 3000))
      ]);
      console.log('[WhatsAppClient] Client destroyed successfully.');
    } catch (err) {
      console.error('[WhatsAppClient] Error during client.destroy():', err.message);
    }
    client = null;
  }

  clientStatus = 'disconnected';
  qrCodeData = null;
  pairingCodeData = null;
  initRetryCount = 0;

  await new Promise(resolve => setTimeout(resolve, 2000));

  // On manual disconnect, wipe both session and vault
  const dataPath = getAuthDataPath();
  await safeDeleteDir(path.join(dataPath, 'data', '.wwebjs_auth'));
  await safeDeleteDir(path.join(dataPath, '.wwebjs_auth'));

  isManualDisconnecting = false;
  return true;
}

// Graceful shutdown before app exit (saves session state cleanly without corruption or hanging)
export async function gracefulShutdownWhatsAppClient() {
  stopHeartbeat();
  if (client) {
    try {
      console.log('[WhatsAppClient] 🛑 Gracefully closing WhatsApp browser and saving session...');
      const dataPath = getAuthDataPath();
      const wasReady = clientStatus === 'ready' || clientStatus === 'authenticated';
      await Promise.race([
        client.destroy(),
        new Promise(resolve => setTimeout(resolve, 4000))
      ]);
      console.log('[WhatsAppClient] ✅ WhatsApp client destroyed gracefully.');
      client = null;
      if (wasReady) {
        // Safe to snapshot only after browser process has cleanly exited and closed all files!
        backupSessionVault(dataPath);
      }
    } catch (e) {
      console.warn('[WhatsAppClient] Notice during graceful shutdown:', e.message);
      client = null;
    }
  }
}

// Hook Node process signals for clean shutdown
process.on('SIGINT', async () => {
  await gracefulShutdownWhatsAppClient();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await gracefulShutdownWhatsAppClient();
  process.exit(0);
});

// ============================================================================
// 📱 PHONE NUMBER LOGIN (Pairing Code)
// ============================================================================

export async function requestWhatsAppPairingCode(phoneNumber) {
  if (!phoneNumber) throw new Error('Phone number is required');
  let cleanNumber = phoneNumber.replace(/\D/g, '');
  if (cleanNumber.length === 10) cleanNumber = '91' + cleanNumber;
  if (cleanNumber.length < 10) throw new Error('Invalid phone number (must be at least 10 digits)');

  // Ensure WhatsApp client is active and page is loaded
  if (!client || clientStatus === 'disconnected' || clientStatus === 'auth_failure') {
    initializeWhatsAppClient();
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 500));
      if (client && client.pupPage) break;
    }
  }

  if (!client || !client.pupPage) {
    throw new Error('WhatsApp service is starting up. Please try again in 5 seconds.');
  }

  console.log(`[WhatsAppClient] 📱 Requesting Pairing Code for: ${cleanNumber}`);
  const code = await client.requestPairingCode(cleanNumber, true);
  pairingCodeData = {
    code,
    phoneNumber: cleanNumber,
    requestedAt: new Date().toISOString()
  };
  console.log(`[WhatsAppClient] 📱 Pairing code generated: ${code}`);
  return pairingCodeData;
}

export async function cancelWhatsAppPairingCode() {
  pairingCodeData = null;
  if (client && typeof client.cancelPairingCode === 'function') {
    try { await client.cancelPairingCode(); } catch(e) {}
  }
  return true;
}

// ============================================================================
// 🚀 INITIALIZATION
// ============================================================================

export function initializeWhatsAppClient() {
  // If already connecting or ready or authenticated, do not duplicate
  if (clientStatus === 'connecting' || clientStatus === 'ready' || clientStatus === 'qr' || clientStatus === 'authenticated') {
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

  // Proactively kill any zombie Chromium processes and heal session before starting
  killLeftoverChromium().then(() => {
    try {
      const dataPath = getAuthDataPath();
      verifyAndHealSession(dataPath);
    
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
        '--no-default-browser-check',
        '--no-zygote',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-ipc-flooding-protection',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-session-crashed-bubble',
        '--disable-features=CalculateNativeWinOcclusion,Translate,OptimizationHints,MediaRouter,DialMediaRouteProvider',
        '--force-color-profile=srgb',
        '--mute-audio'
      ],
      timeout: 120000
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

    const localAuthStrategy = new LocalAuth({
      dataPath: path.join(dataPath, 'data', '.wwebjs_auth')
    });
    // Windows file-lock & multi-device protection: Prevent unhandled EBUSY and prevent accidental session wipe on transient disconnects
    if (typeof localAuthStrategy.logout === 'function') {
      const originalLogout = localAuthStrategy.logout.bind(localAuthStrategy);
      localAuthStrategy.logout = async function () {
        // ONLY delete session directory if the user explicitly clicked Disconnect in the UI!
        if (!isManualDisconnecting) {
          console.warn('[WhatsAppClient] 🛡️ Blocked automatic session directory wipe on transient logout/sync event!');
          return null;
        }
        try {
          return await originalLogout();
        } catch (logoutErr) {
          console.warn('[WhatsAppClient] Handled lockfile/EBUSY notice during logout:', logoutErr.message);
          return null;
        }
      };
    }

    client = new Client({
      authStrategy: localAuthStrategy,
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1045814658-alpha.html',
        strict: false
      },
      puppeteer: puppeteerOptions
    });

    client.on('qr', async (qr) => {
      console.log('[WhatsAppClient] QR Code received. Scan it to authenticate.');
      clientStatus = 'qr';
      initRetryCount = 0;
      try {
        qrCodeData = await qrcode.toDataURL(qr);
      } catch (err) {
        console.error('[WhatsAppClient] Failed to generate QR code image:', err.message);
        qrCodeData = qr;
      }
    });

    client.on('code', (code) => {
      console.log('[WhatsAppClient] 📱 Pairing code received event:', code);
      pairingCodeData = {
        code,
        updatedAt: new Date().toISOString()
      };
    });

    client.on('ready', () => {
      console.log('[WhatsAppClient] WhatsApp Client is READY and authenticated!');
      console.log('[WhatsAppClient] Info:', client.info ? client.info.pushname : 'No info');
      clientStatus = 'ready';
      qrCodeData = null;
      pairingCodeData = null;
      initRetryCount = 0; // Reset on success

      // Start periodic keep-alive heartbeat
      startHeartbeat();
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
      console.log('[WhatsAppClient] WhatsApp Client authenticated. Session active.');
      clientStatus = 'authenticated';
      qrCodeData = null;
      pairingCodeData = null;
    });

    client.on('auth_failure', (msg) => {
      console.error('[WhatsAppClient] WhatsApp Authentication failure:', msg);
      stopHeartbeat();
      clientStatus = 'auth_failure';
      qrCodeData = null;
      client = null;
    });

    client.on('disconnected', (reason) => {
      console.log('[WhatsAppClient] WhatsApp Client disconnected. Reason:', reason);
      stopHeartbeat();
      clientStatus = 'disconnected';
      qrCodeData = null;
      client = null;

      // If this was NOT a manual disconnect, auto-reconnect using saved session / vault!
      if (!isManualDisconnecting) {
        const dataPath = getAuthDataPath();
        const sessionDir = path.join(dataPath, 'data', '.wwebjs_auth');
        if (fs.existsSync(sessionDir)) {
          if (reason === 'LOGOUT' || reason === 'CONFLICT') {
            console.log(`[WhatsAppClient] ⚠️ Session unlinked by WhatsApp server (${reason}). Refreshing connection for new pairing...`);
            killLeftoverChromium().then(() => {
              initializeWhatsAppClient();
            });
          } else {
            console.log(`[WhatsAppClient] 🔄 Network/transient disconnect detected (${reason}). Auto-reconnecting saved session in 5 seconds...`);
            setTimeout(() => {
              if (clientStatus === 'disconnected') {
                killLeftoverChromium().then(() => {
                  initializeWhatsAppClient();
                });
              }
            }, 5000);
          }
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
  const isFunctionallyReady = (client && client.info && client.info.wid) || clientStatus === 'ready';
  if (!client || !isFunctionallyReady) {
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
  
  // 1. Simulate Human "Seen" + Typing Indicator before sending
  try {
    const chat = await client.getChatById(cleanNumber);
    // Pre-typing "seen" delay (1.0-2.5s) — mimics reading contact & chat
    const seenDelay = Math.floor(Math.random() * 1500) + 1000;
    await new Promise(resolve => setTimeout(resolve, seenDelay));
    
    if (chat && typeof chat.sendStateTyping === 'function') {
      await chat.sendStateTyping();
      // Natural typing delay between 3s and 6s based on message length (human pace)
      const typingDelay = Math.min(6000, Math.max(3000, Math.floor(Math.random() * 3000) + 3000));
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
