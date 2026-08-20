import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = process.env.USER_DATA_PATH || path.join(__dirname, '..');
const logsDir = path.join(dataPath, 'logs');

if (!fs.existsSync(logsDir)) {
  try {
    fs.mkdirSync(logsDir, { recursive: true });
  } catch (e) {}
}

const syncLogPath = path.join(logsDir, 'sync-activity.log');
const errorLogPath = path.join(logsDir, 'system-error.log');

function formatTimestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function appendLog(filePath, level, tag, message, extra = null) {
  const ts = formatTimestamp();
  let line = `[${ts}] [${level}] [${tag}] ${message}`;
  if (extra) {
    if (extra instanceof Error) {
      line += `\n   Error: ${extra.message}\n   Stack: ${extra.stack}`;
    } else if (typeof extra === 'object') {
      line += `\n   Details: ${JSON.stringify(extra, null, 2)}`;
    } else {
      line += ` | ${extra}`;
    }
  }
  line += '\n';

  try {
    fs.appendFileSync(filePath, line, 'utf8');
  } catch (e) {
    console.error('Failed to write to log file:', e.message);
  }
}

export function logInfo(tag, message, extra) {
  console.log(`[${tag}] ${message}`);
  appendLog(syncLogPath, 'INFO', tag, message, extra);
}

export function logWarn(tag, message, extra) {
  console.warn(`[${tag}] ⚠️ ${message}`);
  appendLog(syncLogPath, 'WARN', tag, message, extra);
}

export function logError(tag, message, error) {
  console.error(`[${tag}] ❌ ${message}`, error ? (error.message || error) : '');
  appendLog(errorLogPath, 'ERROR', tag, message, error);
  appendLog(syncLogPath, 'ERROR', tag, message, error);
}

export function getRecentLogs(maxLines = 100) {
  const logs = [];
  try {
    if (fs.existsSync(syncLogPath)) {
      const content = fs.readFileSync(syncLogPath, 'utf8');
      const lines = content.split('\n').filter(Boolean);
      logs.push(...lines.slice(-maxLines));
    }
  } catch (e) {}
  return logs;
}

export function getLogsDir() {
  return logsDir;
}
