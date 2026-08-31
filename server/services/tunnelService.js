import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let tunnelProcess = null;
let tunnelUrl = null;
let tunnelStatus = 'stopped'; // 'stopped' | 'starting' | 'online' | 'error'
let tunnelError = null;

const BIN_PATH = path.join(__dirname, '..', 'bin', 'cloudflared.exe');
const INFO_FILE = path.join(__dirname, '..', 'tunnel-info.json');

export function getTunnelState() {
  return {
    status: tunnelStatus,
    url: tunnelUrl,
    error: tunnelError,
    installed: fs.existsSync(BIN_PATH)
  };
}

export function startCloudflareTunnel(port = 5000) {
  if (tunnelStatus === 'online' && tunnelUrl) {
    return Promise.resolve({ success: true, url: tunnelUrl, status: tunnelStatus });
  }

  if (!fs.existsSync(BIN_PATH)) {
    tunnelStatus = 'error';
    tunnelError = 'cloudflared.exe binary not found';
    return Promise.resolve({ success: false, error: tunnelError });
  }

  return new Promise((resolve) => {
    try {
      stopCloudflareTunnel();

      tunnelStatus = 'starting';
      tunnelError = null;

      console.log(`[CloudflareTunnel] Starting Cloudflare Tunnel on port ${port}...`);
      tunnelProcess = spawn(BIN_PATH, ['tunnel', '--url', `http://localhost:${port}`], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      });

      let resolved = false;

      const handleOutput = (chunk) => {
        const text = chunk.toString();
        const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (match && !tunnelUrl) {
          tunnelUrl = match[0];
          tunnelStatus = 'online';
          console.log(`[CloudflareTunnel] 🚀 LIVE PUBLIC TUNNEL ACTIVE: ${tunnelUrl}`);

          // Persist to tunnel-info.json
          try {
            fs.writeFileSync(INFO_FILE, JSON.stringify({
              url: tunnelUrl,
              parentPortal: `${tunnelUrl}/?app=parent#/parent`,
              teacherPortal: `${tunnelUrl}/?app=teacher#/teacher`,
              inquiryPortal: `${tunnelUrl}/?app=inquiry#/inquiry`,
              updatedAt: new Date().toISOString()
            }, null, 2));
          } catch (e) {}

          if (!resolved) {
            resolved = true;
            resolve({ success: true, url: tunnelUrl, status: 'online' });
          }
        }
      };

      tunnelProcess.stderr.on('data', handleOutput);
      tunnelProcess.stdout.on('data', handleOutput);

      tunnelProcess.on('error', (err) => {
        console.error('[CloudflareTunnel] Process error:', err.message);
        tunnelStatus = 'error';
        tunnelError = err.message;
        if (!resolved) {
          resolved = true;
          resolve({ success: false, error: err.message });
        }
      });

      tunnelProcess.on('exit', (code) => {
        console.log(`[CloudflareTunnel] Process exited with code ${code}`);
        tunnelStatus = 'stopped';
        tunnelUrl = null;
        if (!resolved) {
          resolved = true;
          resolve({ success: false, error: `Exited with code ${code}` });
        }
      });

      // Timeout fallback after 15 seconds
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          if (tunnelUrl) {
            resolve({ success: true, url: tunnelUrl, status: 'online' });
          } else {
            resolve({ success: false, error: 'Tunnel start timed out' });
          }
        }
      }, 15000);

    } catch (e) {
      tunnelStatus = 'error';
      tunnelError = e.message;
      resolve({ success: false, error: e.message });
    }
  });
}

export function stopCloudflareTunnel() {
  if (tunnelProcess) {
    try {
      tunnelProcess.kill();
      console.log('[CloudflareTunnel] Stopped tunnel process.');
    } catch (e) {}
    tunnelProcess = null;
  }
  tunnelStatus = 'stopped';
  tunnelUrl = null;
}
