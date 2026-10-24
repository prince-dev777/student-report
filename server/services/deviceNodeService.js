import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.join(__dirname, '../device_config.json');

// Default initial config
function getDefaultConfig() {
  const currentHost = os.hostname();
  return {
    deviceName: currentHost === 'PRINCE' ? 'Attendance & Master PC' : `${currentHost} Workstation`,
    deviceRole: currentHost === 'PRINCE' ? 'master' : 'client', // 'master' | 'client'
    isMasterMessagingNode: currentHost === 'PRINCE', // Default true for PRINCE
    masterHostname: 'PRINCE',
    updatedAt: new Date().toISOString()
  };
}

let cachedConfig = null;

export function getDeviceNodeConfig() {
  if (cachedConfig) return cachedConfig;
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      cachedConfig = { ...getDefaultConfig(), ...data };
      return cachedConfig;
    }
  } catch (err) {
    console.warn('[DeviceNode] Error reading device_config.json:', err.message);
  }
  cachedConfig = getDefaultConfig();
  saveDeviceNodeConfig(cachedConfig);
  return cachedConfig;
}

export function saveDeviceNodeConfig(newConfig) {
  try {
    cachedConfig = { ...getDefaultConfig(), ...cachedConfig, ...newConfig, updatedAt: new Date().toISOString() };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cachedConfig, null, 2), 'utf-8');
    return cachedConfig;
  } catch (err) {
    console.error('[DeviceNode] Error saving device_config.json:', err.message);
    return cachedConfig;
  }
}

/**
 * Returns true if this physical PC is designated as the active Master Messaging Node
 */
export function isCurrentMachineMaster() {
  const config = getDeviceNodeConfig();
  const currentHost = os.hostname().toUpperCase();
  const targetHost = (config.masterHostname || 'PRINCE').toUpperCase();

  if (config.deviceRole === 'master' || config.isMasterMessagingNode === true) {
    return true;
  }
  return currentHost === targetHost;
}

/**
 * Helper to get local IP address
 */
export function getLocalIpAddress() {
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
