/**
 * messageQueue.js — Anti-Ban Rate-Limited WhatsApp Message Queue
 * 
 * All WhatsApp messages flow through this queue to prevent bans.
 * Features:
 * - Serial processing (one message at a time)
 * - Random inter-message delay (8-15 seconds)
 * - Burst limit: Max 20 messages per 5-minute window
 * - Hourly cap: Max 100 messages per hour
 * - 3 retries with exponential backoff on failure
 */

import { sendWhatsAppMessageWeb, getWhatsAppClientState } from './whatsappClient.js';

// --- Configuration ---
const CONFIG = {
  MIN_DELAY_MS: 8000,        // 8 seconds minimum between messages
  MAX_DELAY_MS: 15000,       // 15 seconds maximum between messages
  BURST_LIMIT: 20,           // Max messages per burst window
  BURST_WINDOW_MS: 5 * 60 * 1000,  // 5-minute burst window
  HOURLY_CAP: 100,           // Max messages per hour
  MAX_RETRIES: 3,
  RETRY_DELAYS: [5000, 15000, 30000], // Exponential backoff
};

// --- Queue State ---
const queue = [];             // FIFO message queue
let isProcessing = false;     // Lock to ensure serial processing
const sentTimestamps = [];    // Timestamps of recently sent messages for rate tracking

// --- Stats ---
const stats = {
  totalQueued: 0,
  totalSent: 0,
  totalFailed: 0,
  totalDropped: 0,
  queueLength: 0,
  lastSentAt: null,
};

/**
 * Add a WhatsApp message to the queue.
 * @param {string} to - Phone number
 * @param {string} message - Message text
 * @param {object} metadata - Optional metadata for logging (studentName, type, etc.)
 * @returns {{ queued: boolean, position: number, reason?: string }}
 */
export function queueWhatsAppMessage(to, message, metadata = {}) {
  // Check hourly cap
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const hourlyCount = sentTimestamps.filter(t => t > oneHourAgo).length + queue.length;
  if (hourlyCount >= CONFIG.HOURLY_CAP) {
    stats.totalDropped++;
    console.warn(`[MessageQueue] ⛔ HOURLY CAP (${CONFIG.HOURLY_CAP}) reached. Dropping message for ${metadata.studentName || to}`);
    return { queued: false, position: -1, reason: `Hourly cap (${CONFIG.HOURLY_CAP}) reached` };
  }

  const entry = {
    id: `MQ_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    to,
    message,
    metadata,
    retries: 0,
    status: 'queued',
    queuedAt: Date.now(),
  };

  queue.push(entry);
  stats.totalQueued++;
  stats.queueLength = queue.length;

  console.log(`[MessageQueue] 📥 Queued message #${stats.totalQueued} for ${metadata.studentName || to} (${metadata.type || 'unknown'}) | Queue size: ${queue.length}`);

  // Kick off processing if not already running
  if (!isProcessing) {
    processQueue();
  }

  return { queued: true, position: queue.length };
}

/**
 * Serial queue processor — processes one message at a time with delays.
 */
async function processQueue() {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;

  console.log(`[MessageQueue] 🚀 Queue processor started. ${queue.length} message(s) pending.`);

  while (queue.length > 0) {
    const entry = queue[0]; // Peek at front

    // Burst limit check — if we've sent too many recently, wait
    const burstWindowStart = Date.now() - CONFIG.BURST_WINDOW_MS;
    const recentCount = sentTimestamps.filter(t => t > burstWindowStart).length;
    if (recentCount >= CONFIG.BURST_LIMIT) {
      const oldestInWindow = sentTimestamps.find(t => t > burstWindowStart);
      const waitTime = oldestInWindow ? (oldestInWindow + CONFIG.BURST_WINDOW_MS - Date.now() + 1000) : 30000;
      console.log(`[MessageQueue] 🛑 Burst limit (${CONFIG.BURST_LIMIT}/${CONFIG.BURST_WINDOW_MS / 1000}s) hit. Pausing for ${Math.round(waitTime / 1000)}s...`);
      await sleep(Math.min(waitTime, 60000));
      continue; // Re-check after waiting
    }

    // Check WhatsApp client readiness
    const waState = getWhatsAppClientState();
    if (!waState || waState.status !== 'ready') {
      console.warn(`[MessageQueue] ⚠️ WhatsApp client not ready (${waState?.status}). Pausing queue for 30s...`);
      await sleep(30000);
      continue;
    }

    // Dequeue and send
    queue.shift();
    entry.status = 'sending';

    let success = false;
    for (let attempt = 0; attempt <= CONFIG.MAX_RETRIES; attempt++) {
      try {
        await sendWhatsAppMessageWeb(entry.to, entry.message);
        success = true;
        entry.status = 'delivered';
        stats.totalSent++;
        stats.lastSentAt = new Date().toISOString();
        sentTimestamps.push(Date.now());

        // Prune old timestamps (keep last 2 hours only)
        while (sentTimestamps.length > 0 && sentTimestamps[0] < Date.now() - 2 * 60 * 60 * 1000) {
          sentTimestamps.shift();
        }

        console.log(`[MessageQueue] ✅ Delivered to ${entry.metadata.studentName || entry.to} (${entry.metadata.type || '?'}) | Sent: ${stats.totalSent} | Remaining: ${queue.length}`);
        break;
      } catch (err) {
        entry.retries = attempt + 1;
        if (attempt < CONFIG.MAX_RETRIES) {
          const retryDelay = CONFIG.RETRY_DELAYS[attempt] || 30000;
          console.warn(`[MessageQueue] ⚠️ Send failed (attempt ${attempt + 1}/${CONFIG.MAX_RETRIES + 1}): ${err.message}. Retrying in ${retryDelay / 1000}s...`);
          await sleep(retryDelay);
        } else {
          entry.status = 'failed';
          stats.totalFailed++;
          console.error(`[MessageQueue] ❌ FAILED after ${CONFIG.MAX_RETRIES + 1} attempts for ${entry.metadata.studentName || entry.to}: ${err.message}`);
        }
      }
    }

    stats.queueLength = queue.length;

    // Inter-message delay (human-like random gap)
    if (queue.length > 0) {
      const delay = randomDelay(CONFIG.MIN_DELAY_MS, CONFIG.MAX_DELAY_MS);
      console.log(`[MessageQueue] ⏳ Waiting ${Math.round(delay / 1000)}s before next message...`);
      await sleep(delay);
    }
  }

  isProcessing = false;
  console.log(`[MessageQueue] ✅ Queue empty. Processor idle. (Total sent: ${stats.totalSent}, Failed: ${stats.totalFailed})`);
}

/**
 * Get current queue stats.
 */
export function getQueueStats() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const burstWindowStart = Date.now() - CONFIG.BURST_WINDOW_MS;
  return {
    ...stats,
    queueLength: queue.length,
    isProcessing,
    messagesInLastHour: sentTimestamps.filter(t => t > oneHourAgo).length,
    messagesInBurstWindow: sentTimestamps.filter(t => t > burstWindowStart).length,
    config: CONFIG,
  };
}

// --- Helpers ---
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
