import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { exec, execSync } from 'child_process';

// 🛡️ Monkey-patch Client.prototype.inject to gracefully handle "Execution context was destroyed, most likely because of a navigation"
if (Client && Client.prototype && typeof Client.prototype.inject === 'function') {
  const origInject = Client.prototype.inject;
  Client.prototype.inject = async function () {
    try {
      return await origInject.apply(this, arguments);
    } catch (err) {
      const msg = err ? (err.message || String(err)) : '';
      if (msg.includes('Execution context was destroyed') || msg.includes('navigation')) {
        console.warn('[WhatsAppClient] 🛡️ Handled transient navigation in inject():', msg);
        await new Promise(r => setTimeout(r, 1200));
        try {
          if (this.pupPage && !this.pupPage.isClosed()) {
            return await origInject.apply(this, arguments);
          }
        } catch (retryErr) {
          console.warn('[WhatsAppClient] Handled secondary inject notice:', retryErr.message);
        }
        return;
      }
      throw err;
    }
  };
}

// 🛡️ Monkey-patch Client.prototype.initialize to gracefully handle navigation and ensure clean state
if (Client && Client.prototype && typeof Client.prototype.initialize === 'function') {
  const origInitialize = Client.prototype.initialize;
  Client.prototype.initialize = async function () {
    this.lastLoggedOut = false;
    try {
      return await origInitialize.apply(this, arguments);
    } catch (err) {
      const msg = err ? (err.message || String(err)) : '';
      if (msg.includes('Execution context was destroyed') || msg.includes('navigation')) {
        console.warn('[WhatsAppClient] 🛡️ Handled transient navigation during initialize():', msg);
        await new Promise(r => setTimeout(r, 1500));
        try {
          if (this.pupPage && !this.pupPage.isClosed()) {
            await this.inject().catch(() => {});
            return;
          }
        } catch (e) {
          console.warn('[WhatsAppClient] Handled post-nav inject notice:', e.message);
        }
      }
      throw err;
    }
  };
}

let isManualDisconnecting = false;
let clientReadyAt = null;

// 🛡️ Monkey-patch LocalAuth.prototype.logout to NEVER delete session directory unless user explicitly clicked Disconnect in UI
if (LocalAuth && LocalAuth.prototype && typeof LocalAuth.prototype.logout === 'function') {
  const origLocalAuthLogout = LocalAuth.prototype.logout;
  LocalAuth.prototype.logout = async function () {
    if (!isManualDisconnecting) {
      console.warn('[WhatsAppClient] 🛡️ Blocked LocalAuth.prototype.logout() — Absolute session immunity preserved!');
      return null;
    }
    return await origLocalAuthLogout.apply(this, arguments);
  };
}

// 🛡️ Helper: Check if client has finished initial offline sync after connection
export function isWhatsAppClientSettled() {
  const isFunctionallyReady = (client && client.info && client.info.wid) || clientStatus === 'ready';
  if (!isFunctionallyReady || !clientReadyAt) return false;
  return (Date.now() - clientReadyAt) > 45000;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let client = null;
let qrCodeData = null; // Stores the latest base64 QR code image
let pairingCodeData = null; // Stores { code, phoneNumber, requestedAt }
let clientStatus = 'disconnected'; // 'disconnected' | 'qr' | 'connecting' | 'authenticated' | 'ready' | 'auth_failure'
let initRetryCount = 0;
let lastInitFailureTime = 0;
let autoReconnectTimer = null;
const FAST_RETRY_DELAYS = [3000, 6000, 15000]; // initial quick retries
const STEADY_RETRY_INTERVAL = 30000; // steady 30s background reconnection loop (never gives up!)

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
  if (isFunctionallyReady && clientStatus !== 'ready') {
    clientStatus = 'ready';
  }
  return { 
    status: isFunctionallyReady ? 'ready' : clientStatus, 
    qrCode: isFunctionallyReady ? null : qrCodeData,
    pairingCode: isFunctionallyReady ? null : pairingCodeData,
    info: client && client.info ? {
      pushname: client.info.pushname,
      wid: client.info.wid
    } : null
  };
}

export async function getWhatsAppDebugInfo() {
  if (!client) {
    return { clientExists: false, clientStatus };
  }
  if (!client.pupPage || client.pupPage.isClosed()) {
    return { clientExists: true, hasPupPage: false, clientStatus };
  }
  try {
    const pageUrl = client.pupPage.url();
    const domState = await client.pupPage.evaluate(() => {
      const hasChatList = !!(document.querySelector('#pane-side') || document.querySelector('[aria-label="Chat list"]') || document.querySelector('[data-icon="chat"]'));
      const hasQRCanvas = !!(document.querySelector('canvas') || document.querySelector('[data-testid="qrcode"]'));
      const hasProgress = !!document.querySelector('[data-testid="intro-title"]');

      let socketState = null;
      let socketHasSynced = null;
      try {
        const Socket = window.require?.('WAWebSocketModel')?.Socket;
        if (Socket) {
          socketState = Socket.state;
          socketHasSynced = Socket.hasSynced;
        }
      } catch (e) {
        socketState = e.message;
      }

      let meUser = null;
      try {
        const UserPrefs = window.require?.('WAWebUserPrefsMeUser');
        meUser = UserPrefs?.getMaybeMePnUser?.() || UserPrefs?.getMaybeMeLidUser?.();
      } catch (e) {
        meUser = e.message;
      }

      return {
        hasChatList,
        hasQRCanvas,
        hasProgress,
        socketState,
        socketHasSynced,
        meUser,
        hasWWebJS: typeof window.WWebJS !== 'undefined',
        title: document.title
      };
    });

    return {
      clientExists: true,
      hasPupPage: true,
      clientStatus,
      clientInfo: client.info ? { wid: client.info.wid, pushname: client.info.pushname } : null,
      pageUrl,
      domState
    };
  } catch (err) {
    return { clientExists: true, hasPupPage: true, clientStatus, error: err.message };
  }
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

export function backupSessionVault(dataPath, options = {}) {
  try {
    // 🛡️ CRITICAL SAFETY RULE: NEVER copy LevelDB files while Chromium is actively running!
    // On Windows, reading/copying LevelDB SSTables concurrently while Chromium writes
    // causes ERROR_SHARING_VIOLATION in Chrome, which crashes the IndexedDB engine and forces WhatsApp Web to log out!
    // Database vault backups are ONLY performed when Chromium is stopped or during graceful shutdown.
    if (client && options.reason !== 'graceful_shutdown') {
      console.log(`[WhatsAppVault] 🛡️ Live Chromium process is active. Preserving open LevelDB file handles (Snapshot deferred to clean shutdown).`);
      return true;
    }

    const sessionDir = path.join(dataPath, 'data', '.wwebjs_auth', 'session');
    const vaultDir = path.join(dataPath, 'data', '.wwebjs_auth', 'session_vault');
    if (!fs.existsSync(sessionDir)) return false;

    // 🛡️ CRITICAL GUARD: Only snapshot when client has a verified authenticated user (wid)!
    // This permanently prevents an unauthenticated or logged-out state from corrupting the valid vault backup.
    const hasActiveAuth = client && client.info && client.info.wid && client.info.wid.user;
    if (!hasActiveAuth && options.reason !== 'graceful_shutdown') {
      console.warn('[WhatsAppVault] ⚠️ Blocked snapshot: Client is not actively authenticated. Existing vault preserved.');
      return false;
    }

    const idbDir = path.join(sessionDir, 'Default', 'IndexedDB', 'https_web.whatsapp.com_0.indexeddb.leveldb');
    if (!fs.existsSync(idbDir)) return false;

    // Verify it actually has data files before snapshotting
    const idbFiles = fs.readdirSync(idbDir);
    const hasData = idbFiles.some(f => f.endsWith('.ldb') || f.endsWith('.log'));
    if (!hasData) return false;

    fs.mkdirSync(vaultDir, { recursive: true });

    // CRITICAL: Filter out active lock files so live Chromium does not trigger EBUSY or lock corruption
    const safeCopyFilter = (src) => {
      const base = path.basename(src);
      if (base === 'LOCK' || base === 'SingletonLock' || base === 'SingletonCookie' || base === 'SingletonSocket' || base === 'lockfile') {
        return false;
      }
      return true;
    };

    // Copy IndexedDB safely
    const vaultIdb = path.join(vaultDir, 'IndexedDB');
    fs.mkdirSync(vaultIdb, { recursive: true });
    fs.cpSync(path.join(sessionDir, 'Default', 'IndexedDB'), vaultIdb, { 
      recursive: true, 
      force: true, 
      filter: safeCopyFilter 
    });

    // Copy Local Storage safely
    const lsDir = path.join(sessionDir, 'Default', 'Local Storage');
    if (fs.existsSync(lsDir)) {
      const vaultLs = path.join(vaultDir, 'Local Storage');
      fs.mkdirSync(vaultLs, { recursive: true });
      fs.cpSync(lsDir, vaultLs, { 
        recursive: true, 
        force: true, 
        filter: safeCopyFilter 
      });
    }

    // Copy Local State safely
    const localState = path.join(sessionDir, 'Local State');
    if (fs.existsSync(localState)) {
      fs.copyFileSync(localState, path.join(vaultDir, 'Local State'));
    }

    // Write vault metadata
    fs.writeFileSync(path.join(vaultDir, 'vault_meta.json'), JSON.stringify({
      timestamp: new Date().toISOString(),
      user: client?.info?.pushname || 'Authenticated WhatsApp User',
      wid: client?.info?.wid?._serialized || '',
      phone: client?.info?.wid?.user || '',
      reason: options.reason || 'live_snapshot'
    }, null, 2));

    console.log(`[WhatsAppVault] 🛡️ Permanent session snapshot successfully sealed in vault! (Reason: ${options.reason || 'live_snapshot'})`);

    // 🛡️ MULTI-DESTINATION MIRROR: Mirror snapshot to permanent local directory & any connected USB drive
    mirrorVaultToSafeDestinations(vaultDir);

    return true;
  } catch (err) {
    console.warn('[WhatsAppVault] Failed to snapshot session:', err.message);
    return false;
  }
}

// Helper: Safely mirror session vault to permanent backup directories and connected pendrives
function mirrorVaultToSafeDestinations(vaultDir) {
  try {
    // 1. Permanent PC backup directory (immune to AppData wipe or program uninstalls)
    const localSafeDir = 'C:\\CareerXone_Backups\\WhatsApp_Session_Vault';
    try {
      if (!fs.existsSync(localSafeDir)) {
        fs.mkdirSync(localSafeDir, { recursive: true });
      }
      fs.cpSync(vaultDir, localSafeDir, { recursive: true, force: true });
      console.log(`[WhatsAppVault] 💾 Mirrored session vault to safe local backup: ${localSafeDir}`);
    } catch (_) {}

    // 2. Removable USB Drives (e.g. D:, E:, F:, G:)
    const driveLetters = ['D', 'E', 'F', 'G'];
    for (const dl of driveLetters) {
      const driveRoot = `${dl}:\\`;
      if (fs.existsSync(driveRoot)) {
        const usbVaultDir = path.join(driveRoot, 'CareerXone_WhatsApp_Vault');
        try {
          fs.mkdirSync(usbVaultDir, { recursive: true });
          fs.cpSync(vaultDir, usbVaultDir, { recursive: true, force: true });
          console.log(`[WhatsAppVault] 🔌 USB Pendrive detected at ${driveRoot}. Mirrored session vault to: ${usbVaultDir}`);
        } catch (_) {}
      }
    }
  } catch (mirrorErr) {
    console.warn('[WhatsAppVault] Multi-destination mirror notice:', mirrorErr.message);
  }
}

export function restoreSessionFromVault(dataPath, options = {}) {
  try {
    const sessionDir = path.join(dataPath, 'data', '.wwebjs_auth', 'session');
    let vaultDir = path.join(dataPath, 'data', '.wwebjs_auth', 'session_vault');
    const disconnectMarker = path.join(dataPath, 'data', '.wwebjs_auth', '.manual_disconnect');

    // If user explicitly performed manual disconnect, do NOT auto-restore unless force: true
    if (!options.force && fs.existsSync(disconnectMarker)) {
      console.log('[WhatsAppVault] Manual disconnect marker present. Skipping auto-restore.');
      return false;
    }

    if (options.force && fs.existsSync(disconnectMarker)) {
      try { fs.unlinkSync(disconnectMarker); } catch (_) {}
    }

    // Fallback: If canonical vault is missing, check permanent local backup or USB pendrive
    if (!fs.existsSync(path.join(vaultDir, 'IndexedDB'))) {
      const fallbackCandidates = [
        'C:\\CareerXone_Backups\\WhatsApp_Session_Vault',
        'D:\\CareerXone_WhatsApp_Vault',
        'E:\\CareerXone_WhatsApp_Vault',
        'F:\\CareerXone_WhatsApp_Vault'
      ];
      for (const fb of fallbackCandidates) {
        if (fs.existsSync(path.join(fb, 'IndexedDB'))) {
          console.log(`[WhatsAppVault] 📦 Found session backup in external/fallback location: ${fb}. Auto-importing...`);
          try {
            fs.mkdirSync(vaultDir, { recursive: true });
            fs.cpSync(fb, vaultDir, { recursive: true, force: true });
            if (fb !== 'C:\\CareerXone_Backups\\WhatsApp_Session_Vault') {
              try {
                fs.mkdirSync('C:\\CareerXone_Backups\\WhatsApp_Session_Vault', { recursive: true });
                fs.cpSync(fb, 'C:\\CareerXone_Backups\\WhatsApp_Session_Vault', { recursive: true, force: true });
              } catch (_) {}
            }
            break;
          } catch (_) {}
        }
      }
    }

    if (!fs.existsSync(vaultDir)) return false;

    const metaFile = path.join(vaultDir, 'vault_meta.json');
    if (!fs.existsSync(metaFile)) return false;

    const vaultIdb = path.join(vaultDir, 'IndexedDB');
    if (!fs.existsSync(vaultIdb)) return false;

    console.log('[WhatsAppVault] 🔄 Self-healing: Restoring authenticated session keys from vault...');

    const destDefault = path.join(sessionDir, 'Default');
    fs.mkdirSync(destDefault, { recursive: true });

    // Restore IndexedDB cleanly
    const destIdb = path.join(destDefault, 'IndexedDB');
    try {
      if (fs.existsSync(destIdb)) {
        fs.rmSync(destIdb, { recursive: true, force: true });
      }
    } catch (_) {}
    fs.mkdirSync(destIdb, { recursive: true });
    fs.cpSync(vaultIdb, destIdb, { recursive: true, force: true });

    // Restore Local Storage cleanly
    const vaultLs = path.join(vaultDir, 'Local Storage');
    if (fs.existsSync(vaultLs)) {
      const destLs = path.join(destDefault, 'Local Storage');
      try {
        if (fs.existsSync(destLs)) {
          fs.rmSync(destLs, { recursive: true, force: true });
        }
      } catch (_) {}
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

// Helper: kill any leftover Chromium/Chrome/Edge processes from whatsapp-web.js
function killLeftoverChromium() {
  return new Promise((resolve) => {
    try {
      const out = execSync('powershell -Command "Get-CimInstance Win32_Process -Filter \\"Name=\'chrome.exe\' OR Name=\'msedge.exe\'\\" | Select-Object CommandLine, ProcessId | ConvertTo-Json"').toString();
      if (!out || out.trim() === '') return resolve();
      
      const processes = JSON.parse(out);
      for (const proc of Array.isArray(processes) ? processes : [processes]) {
        if (proc && proc.CommandLine && (proc.CommandLine.includes('wwebjs_auth') || proc.CommandLine.includes('.wwebjs_cache'))) {
          console.log(`[WhatsAppClient] Killing zombie headless browser (PID: ${proc.ProcessId})`);
          try {
            execSync('taskkill /F /PID ' + proc.ProcessId);
          } catch (e) {}
        }
      }
    } catch (e) {
      console.log('[WhatsAppClient] Failed to scan/kill zombie Chrome/Edge processes:', e.message);
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

let heartbeatInterval = null;
let heartbeatTicks = 0;

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTicks = 0;
  heartbeatInterval = setInterval(async () => {
    if (!client || clientStatus !== 'ready') return;
    heartbeatTicks++;

    // 🛡️ Periodic auto-snapshot every 15 minutes while client is active and authenticated (20 ticks x 45s = 15m)
    if (heartbeatTicks % 20 === 0) {
      try {
        const authPath = getAuthDataPath();
        backupSessionVault(authPath, { reason: 'periodic_15min' });
      } catch (vaultErr) {
        console.warn('[WhatsAppVault] Periodic snapshot notice:', vaultErr.message);
      }
    }

    try {
      // 1. Library-level state check
      const statePromise = client.getState();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Heartbeat Timeout')), 10000)
      );
      const state = await Promise.race([statePromise, timeoutPromise]);
      if (state && state !== 'CONNECTED') {
        console.log(`[WhatsAppHeartbeat] Client reporting state: ${state}`);
      }

      // 2. Active DOM & WebSocket ping inside Chromium to keep connection hot and prevent socket hibernation
      if (client.pupPage && !client.pupPage.isClosed()) {
        await client.pupPage.evaluate(() => {
          try {
            const Socket = window.require?.('WAWebSocketModel')?.Socket;
            if (Socket && Socket.state !== 'CONNECTED' && typeof Socket.takeover === 'function') {
              Socket.takeover();
            }
          } catch (_) {}
        });
      }
    } catch (err) {
      // Soft notice only - NEVER forcibly destroy an active client on a momentary delay!
      console.log(`[WhatsAppHeartbeat] Soft notice: ${err.message}`);
    }
  }, 45000);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    heartbeatTicks = 0;
  }
}

export async function disconnectWhatsAppClient() {
  isManualDisconnecting = true;
  stopHeartbeat();
  if (autoReconnectTimer) {
    clearTimeout(autoReconnectTimer);
    autoReconnectTimer = null;
  }
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

  // 🛡️ User explicitly clicked Disconnect in UI:
  // Wipe active session AND remove local persistent vault so local storage is cleanly freed!
  const dataPath = getAuthDataPath();
  const sessionDir = path.join(dataPath, 'data', '.wwebjs_auth', 'session');
  const vaultDir = path.join(dataPath, 'data', '.wwebjs_auth', 'session_vault');
  const localSafeDir = 'C:\\CareerXone_Backups\\WhatsApp_Session_Vault';
  const disconnectMarker = path.join(dataPath, 'data', '.wwebjs_auth', '.manual_disconnect');

  await safeDeleteDir(sessionDir);
  await safeDeleteDir(vaultDir);
  await safeDeleteDir(localSafeDir);

  try {
    fs.mkdirSync(path.dirname(disconnectMarker), { recursive: true });
    fs.writeFileSync(disconnectMarker, new Date().toISOString());
    console.log('[WhatsAppClient] 🔒 Local storage session and vaults cleanly removed on explicit user disconnect.');
  } catch (_) {}

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
        backupSessionVault(dataPath, { reason: 'graceful_shutdown' });
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

// ===============================================================================================================
// 🚀                                                             INITIALIZATION
// ===============================================================================================================

export function initializeWhatsAppClient() {


  // If already connecting or ready or authenticated, do not duplicate
  if (clientStatus === 'connecting' || clientStatus === 'ready' || clientStatus === 'qr' || clientStatus === 'authenticated') {
    console.log(`[WhatsAppClient] Client already in status: ${clientStatus}. Skipping duplicate initialization.`);
    return;
  }


  console.log(`[WhatsAppClient] Starting WhatsApp Web client... (attempt #${initRetryCount + 1})`);
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
      takeoverOnConflict: false,
      puppeteer: puppeteerOptions
    });
    // Ensure lastLoggedOut is false on initialization so stale frame state never triggers bogus logout
    client.lastLoggedOut = false;

    // 🛡️ CRITICAL SCAN RECOVERY: Watch browser state every 1.5s to catch scan/auth transitions immediately!
    let authPoller = null;
    const stopAuthPoller = () => {
      if (authPoller) {
        clearInterval(authPoller);
        authPoller = null;
      }
    };

    authPoller = setInterval(async () => {
      try {
        if (!client || clientStatus === 'ready' || clientStatus === 'disconnected') {
          stopAuthPoller();
          return;
        }
        if (client.pupPage && !client.pupPage.isClosed() && (clientStatus === 'qr' || clientStatus === 'connecting' || clientStatus === 'authenticated')) {
          const authCheck = await client.pupPage.evaluate(() => {
            try {
              const hasChatList = !!(document.querySelector('#pane-side') || document.querySelector('[aria-label="Chat list"]') || document.querySelector('[data-icon="chat"]'));
              const Socket = window.require?.('WAWebSocketModel')?.Socket;
              const UserPrefs = window.require?.('WAWebUserPrefsMeUser');
              const meUser = UserPrefs?.getMaybeMePnUser?.() || UserPrefs?.getMaybeMeLidUser?.();
              const isAuthed = hasChatList || !!meUser || Socket?.state === 'CONNECTED' || Socket?.hasSynced;
              return { isAuthed, hasChatList, meUser, socketSynced: Socket?.hasSynced };
            } catch (_) {
              return { isAuthed: false };
            }
          });

          if (authCheck && authCheck.isAuthed) {
            console.log('[WhatsAppClient] 🎯 Auto-detected authenticated browser session!', authCheck);
            stopAuthPoller();
            if (!client.info) {
              try {
                const infoData = await client.pupPage.evaluate(() => {
                  try {
                    const conn = window.require('WAWebConnModel')?.Conn?.serialize?.() || {};
                    const userPrefs = window.require('WAWebUserPrefsMeUser');
                    const wid = userPrefs?.getMaybeMePnUser?.() || userPrefs?.getMaybeMeLidUser?.();
                    return { ...conn, wid };
                  } catch (_) {
                    return {};
                  }
                });
                const { ClientInfo } = await import('whatsapp-web.js/src/structures/ClientInfo.js');
                client.info = new ClientInfo(client, infoData);
              } catch (_) {}
            }
            clientStatus = 'ready';
            clientReadyAt = Date.now();
            qrCodeData = null;
            pairingCodeData = null;
            client.emit('ready');
          }
        }
      } catch (_) {}
    }, 1500);

    client.on('qr', async (qr) => {
      // 🛡️ CRITICAL GUARD: If client is already ready or authenticated, NEVER allow a late QR event to overwrite status!
      if (clientStatus === 'ready' || clientStatus === 'authenticated' || (client && client.info && client.info.wid)) {
        console.log('[WhatsAppClient] 🛡️ Ignored late QR event because client is already ready/authenticated.');
        return;
      }
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
      stopAuthPoller();
      console.log('[WhatsAppClient] WhatsApp Client is READY and authenticated!');
      console.log('[WhatsAppClient] Info:', client.info ? client.info.pushname : 'No info');
      clientStatus = 'ready';
      clientReadyAt = Date.now();
      qrCodeData = null;
      pairingCodeData = null;
      initRetryCount = 0; // Reset on success
      if (autoReconnectTimer) {
        clearTimeout(autoReconnectTimer);
        autoReconnectTimer = null;
      }

      // Clear manual disconnect marker if present
      try {
        const dataPath = getAuthDataPath();
        const disconnectMarker = path.join(dataPath, 'data', '.wwebjs_auth', '.manual_disconnect');
        if (fs.existsSync(disconnectMarker)) fs.unlinkSync(disconnectMarker);
      } catch (_) {}

      // 🛡️ Override browser onLogoutEvent to prevent false logout triggers
      try {
        if (client.pupPage && !client.pupPage.isClosed()) {
          client.pupPage.evaluate(() => {
            window.onLogoutEvent = async () => {
              console.log('[PROB-GUARD] Neutralized bogus browser onLogoutEvent');
            };
          }).catch(() => {});
          console.log('[WhatsAppClient] 🛡️ Installed runtime guard against bogus browser logout');
        }
      } catch (_) {}

      // Start periodic keep-alive heartbeat
      startHeartbeat();

      // 🛡️ NEUTRALIZE onLogoutEvent: Override the browser-side callback that sets lastLoggedOut=true
      // The library exposes this via exposeFunctionIfAbsent. We override it to no-op.
      if (client && client.pupPage && !client.pupPage.isClosed()) {
        (async () => {
          try {
            if (client && client.pupPage && !client.pupPage.isClosed()) {
              await client.pupPage.evaluate(() => {
                window.onLogoutEvent = async () => {
                  console.log('[PROB-GUARD] Neutralized bogus browser onLogoutEvent');
                };
              });
              console.log('[WhatsAppClient] 🛡️ Neutralized browser-side onLogoutEvent callback');
            }
          } catch (_) {}
        })();
      }
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
      stopAuthPoller();
      stopHeartbeat();
      clientStatus = 'auth_failure';
      qrCodeData = null;
      client = null;
    });

    client.on('disconnected', (reason) => {
      console.log('[WhatsAppClient] WhatsApp Client disconnected. Reason:', reason);
      const wasReady = clientStatus === 'ready';

      // If client was never READY before, this is a transient navigation or websocket reconnect during QR scanning!
      // DO NOT destroy session, DO NOT kill Chromium, allow handshake to complete!
      if (!wasReady && !isManualDisconnecting) {
        console.warn(`[WhatsAppClient] 🛡️ Ignored transient disconnect during QR/handshake (${reason}). Allowing Chromium to complete login...`);
        return;
      }

      stopAuthPoller();
      stopHeartbeat();
      clientStatus = 'disconnected';
      clientReadyAt = null;
      qrCodeData = null;
      client = null;

      // 🛡️ ABSOLUTE SESSION IMMUNITY: NEVER delete session directory or vault on any disconnect event!
      // Session files are ONLY removed if the user explicitly clicked Disconnect in the UI (isManualDisconnecting === true).
      if (!isManualDisconnecting) {
        console.log(`[WhatsAppClient] 🛡️ [Session-Immunity] Disconnected (${reason}). Preserving all session & vault files. Auto-reconnecting in 4s...`);
        clearTimeout(autoReconnectTimer);
        autoReconnectTimer = setTimeout(() => {
          if (!isManualDisconnecting && !client) {
            killLeftoverChromium().then(() => {
              initializeWhatsAppClient();
            });
          }
        }, 4000);
      }
    });

    client.initialize().catch(err => {
      console.error('[WhatsAppClient] Initialization call failed:', err.message);
      clientStatus = 'disconnected';
      client = null;
      initRetryCount++;
      lastInitFailureTime = Date.now();

      // Infinite Resilient Auto-Reconnect Engine:
      // Fast retries for attempts 1-3 (3s, 6s, 15s), then steady 30s background loop (never gives up!)
      if (!isManualDisconnecting) {
        const delay = initRetryCount <= FAST_RETRY_DELAYS.length 
          ? FAST_RETRY_DELAYS[initRetryCount - 1] 
          : STEADY_RETRY_INTERVAL;
        console.log(`[WhatsAppClient] 🔄 Will auto-reconnect in ${delay / 1000}s... (attempt #${initRetryCount})`);
        
        clearTimeout(autoReconnectTimer);
        autoReconnectTimer = setTimeout(() => {
          if (clientStatus === 'disconnected' && !isManualDisconnecting) {
            killLeftoverChromium().then(() => {
              const dataPath = getAuthDataPath();
              clearChromiumLocks(path.join(dataPath, 'data', '.wwebjs_auth'));
              clearChromiumLocks(path.join(dataPath, '.wwebjs_auth'));
              initializeWhatsAppClient();
            });
          }
        }, delay);
      }
    });

  } catch (err) {
    console.error('[WhatsAppClient] Failed to create client instance:', err.message);
    clientStatus = 'disconnected';
    client = null;
    initRetryCount++;
    lastInitFailureTime = Date.now();
  }
  }); // end of killLeftoverChromium
}

// Reset retry counter (called externally when user manually triggers re-init)
export function resetRetryCount() {
  initRetryCount = 0;
  lastInitFailureTime = 0;
  if (autoReconnectTimer) {
    clearTimeout(autoReconnectTimer);
    autoReconnectTimer = null;
  }
  try {
    const dataPath = getAuthDataPath();
    const disconnectMarker = path.join(dataPath, 'data', '.wwebjs_auth', '.manual_disconnect');
    if (fs.existsSync(disconnectMarker)) fs.unlinkSync(disconnectMarker);
  } catch (_) {}
}

// 🛡️ Mutex chain to strictly serialize concurrent WhatsApp sends across all workers (prevents Puppeteer page collision)
let sendMutexChain = Promise.resolve();

export async function sendWhatsAppMessageWeb(to, message, attachment = null) {
  return new Promise((resolve, reject) => {
    sendMutexChain = sendMutexChain.then(async () => {
      try {
        const result = await _executeSendWhatsAppMessage(to, message, attachment);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    }).catch(() => {});
  });
}

async function _executeSendWhatsAppMessage(to, message, attachment = null) {
  const isFunctionallyReady = (client && client.info && client.info.wid) || clientStatus === 'ready';
  if (!client || !isFunctionallyReady) {
    throw new Error(`WhatsApp client is not ready (Status: ${clientStatus})`);
  }

  // 🛡️ ANTI-BOT SHIELD: If newly paired, wait for companion chat sync to settle before sending
  if (!isWhatsAppClientSettled()) {
    const elapsed = Date.now() - (clientReadyAt || Date.now());
    const remaining = Math.max(1000, 45000 - elapsed);
    console.log(`[WhatsAppClient] ⏳ Initial chat sync in progress. Waiting ${(remaining/1000).toFixed(1)}s before sending to avoid anti-bot flagging...`);
    await new Promise(r => setTimeout(r, Math.min(remaining, 15000)));
  }

  // Format phone number: remove non-digits and strip any leading zeroes (e.g. 09876543210 -> 9876543210)
  let cleanNumber = to.replace(/\D/g, '').replace(/^0+/, '');
  
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
