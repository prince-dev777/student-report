import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { processPunchRecord } from '../biometric.js';
import StaffAttendance from '../models/StaffAttendance.js';
import Staff from '../models/Staff.js';
import { isCurrentMachineMaster } from './deviceNodeService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, '../telegram_bot_config.json');

// --- Configuration Management ---
let botConfig = {
  enabled: true,
  botToken: '8839798696:AAHnc973JZ-5BEDse0SQWeRmJUll6oZaeY8',
  users: {
    prince: {
      staffId: '1',
      name: 'Prince Kumar',
      phone: '8538949912',
      chatId: null,
      username: null
    },
    rahul: {
      staffId: '2',
      name: 'Rahul Titarmare',
      phone: '9270875415',
      chatId: null,
      username: null
    }
  }
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      botConfig = JSON.parse(raw);
    } else {
      saveConfig();
    }
  } catch (err) {
    console.warn('[TelegramBot] Failed to load config, using default:', err.message);
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(botConfig, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[TelegramBot] Failed to save config:', err.message);
  }
}

// --- Telegram API Client ---
function telegramRequest(method, payload = {}) {
  return new Promise((resolve, reject) => {
    if (!botConfig.botToken) {
      return reject(new Error('Bot token is not configured'));
    }

    const postData = JSON.stringify(payload);
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${botConfig.botToken}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 35000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          resolve({ ok: false, error: 'JSON_PARSE_ERROR', raw: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'TIMEOUT' });
    });

    req.write(postData);
    req.end();
  });
}

async function sendTelegramMessage(chatId, text, extra = {}) {
  try {
    return await telegramRequest('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...extra
    });
  } catch (err) {
    console.warn('[TelegramBot] sendMessage error:', err.message);
    return null;
  }
}

async function answerCallbackQuery(callbackQueryId, text = '') {
  try {
    return await telegramRequest('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text
    });
  } catch (e) {
    return null;
  }
}

// --- Keyboard Layouts ---
// --- Keyboard Layouts ---
function getLinkKeyboard() {
  // If Prince is already linked, only show Rahul Sir's link button (100% privacy)
  return {
    inline_keyboard: [
      [
        { text: '👨‍🏫 Connect My Attendance (Rahul Sir)', callback_data: 'link_rahul' }
      ]
    ]
  };
}

function getActionKeyboard() {
  return {
    keyboard: [
      [
        { text: '🟢 Check-In' },
        { text: '🔴 Check-Out' }
      ],
      [
        { text: '⏱️ Today Status' }
      ]
    ],
    resize_keyboard: true,
    persistent: true
  };
}

// --- Helper: Find which profile a chatId belongs to ---
function getProfileByChatId(chatId) {
  const strId = String(chatId);
  for (const [key, user] of Object.entries(botConfig.users)) {
    if (user.chatId && String(user.chatId) === strId) {
      return { key, ...user };
    }
  }
  return null;
}

// --- Helper: Parse optional time parameter (e.g. "05:30 PM", "17:30") ---
function parseCustomTimeString(text) {
  if (!text) return null;
  const match = text.match(/(\d{1,2}):(\d{1,2})(?::\d{2})?\s*(AM|PM)?/i);
  if (!match) return null;

  let h = parseInt(match[1], 10);
  const m = String(match[2]).padStart(2, '0');
  let mod = match[3] ? match[3].toUpperCase() : null;

  if (!mod) {
    mod = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
  } else {
    h = h % 12 || 12;
  }

  return `${String(h).padStart(2, '0')}:${m} ${mod}`;
}

// --- Status Command Helper ---
async function getTodayStatusText(staffId, staffName) {
  const todayStr = new Date().toISOString().split('T')[0];
  const record = await StaffAttendance.findOne({
    isDeleted: { $ne: true },
    staffId: String(staffId),
    date: todayStr
  });

  const entry = record?.entryTime && record.entryTime !== '--' ? record.entryTime : 'Not Marked';
  const exit = record?.exitTime && record.exitTime !== '--' ? record.exitTime : 'Not Marked';
  const duration = record?.workHoursFormatted && record.workHoursFormatted !== '0h 0m' ? record.workHoursFormatted : '--';

  let emojiStatus = '⚪ Not Started';
  if (entry !== 'Not Marked' && exit === 'Not Marked') {
    emojiStatus = '🟢 Currently on Duty';
  } else if (exit !== 'Not Marked') {
    emojiStatus = '🏁 Completed for Today';
  }

  return `📊 <b>Today's Attendance Status</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>Staff:</b> ${staffName} (#${staffId})\n` +
    `📅 <b>Date:</b> ${todayStr}\n` +
    `📌 <b>Status:</b> ${emojiStatus}\n` +
    `🕒 <b>Check-In:</b> <code>${entry}</code>\n` +
    `🕕 <b>Check-Out:</b> <code>${exit}</code>\n` +
    `⏱️ <b>Duty Hours:</b> <b>${duration}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;
}

// --- Handle Individual Update ---
async function handleTelegramUpdate(update) {
  try {
    // 1. Handle Inline Button Clicks (Callback Queries)
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message?.chat?.id;
      const data = cb.data;
      const fromUser = cb.from?.username || cb.from?.first_name || 'User';

      await answerCallbackQuery(cb.id, 'Processing...');

      if (data === 'link_prince') {
        botConfig.users.prince.chatId = String(chatId);
        botConfig.users.prince.username = fromUser;
        saveConfig();

        await sendTelegramMessage(
          chatId,
          `✅ <b>Account Linked Successfully!</b>\n\n` +
          `👤 Linked as: <b>Prince Kumar</b> (#1)\n` +
          `📱 Registered Phone: <code>8538949912</code>\n` +
          `🤫 <b>Stealth Mode:</b> Active (Zero speaker/machine noise)\n\n` +
          `You can now use the buttons below to check in or out anytime!`,
          { reply_markup: getActionKeyboard('prince') }
        );
        return;
      }

      if (data === 'link_rahul') {
        botConfig.users.rahul.chatId = String(chatId);
        botConfig.users.rahul.username = fromUser;
        saveConfig();

        await sendTelegramMessage(
          chatId,
          `✅ <b>Connected Successfully!</b>\n\n` +
          `👤 Logged in as: <b>Rahul Titarmare</b> (#2)\n` +
          `📱 Registered Phone: <code>9270875415</code>\n\n` +
          `You can now use the buttons below to check in or out anytime!`,
          { reply_markup: getActionKeyboard() }
        );
        return;
      }
    }

    // 2. Handle Text Messages
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const rawText = update.message.text.trim();
      const lowerText = rawText.toLowerCase();

      // Check if this chat is already registered
      let profile = getProfileByChatId(chatId);

      // A. If NOT Registered (Exclusively tailored for Rahul Sir)
      if (!profile) {
        await sendTelegramMessage(
          chatId,
          `👋 <b>Welcome Rahul Sir!</b>\n\n` +
          `Career Xone Staff Attendance Portal\n` +
          `Tap the button below to connect your Telegram account:`,
          { reply_markup: getLinkKeyboard() }
        );
        return;
      }

      // B. If Already Registered (Prince or Rahul)
      const staffId = profile.staffId;
      const staffName = profile.name;
      const staffPhone = profile.phone;
      const profileKey = profile.key;

      // Handle Switch / Unlink
      if (lowerText.includes('switch') || lowerText.includes('unlink') || lowerText === '/unlink') {
        botConfig.users[profileKey].chatId = null;
        botConfig.users[profileKey].username = null;
        saveConfig();
        await sendTelegramMessage(
          chatId,
          `🔄 <b>Account Unlinked!</b>\nPlease choose a new profile to link:`,
          { reply_markup: getLinkKeyboard() }
        );
        return;
      }

      // Handle Status Check
      if (lowerText.includes('status') || lowerText === '/status') {
        const statusReport = await getTodayStatusText(staffId, staffName);
        await sendTelegramMessage(chatId, statusReport, { reply_markup: getActionKeyboard(profileKey) });
        return;
      }

      // Handle Check-In
      const isCheckInCmd = lowerText.startsWith('/in') || lowerText.includes('check-in') || lowerText.includes('punch-in');
      if (isCheckInCmd) {
        const customTime = parseCustomTimeString(rawText);
        const formattedTime = customTime || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        const todayStr = new Date().toISOString().split('T')[0];

        const result = await processPunchRecord({
          rollNumber: staffId,
          type: 'IN',
          punchTime: formattedTime,
          punchDate: todayStr,
          deviceSN: 'Biomax Device',
          verifyType: 'Biometric Push',
          isSilent: true
        });

        const replyMsg =
          `🟢 <b>CHECK-IN RECORDED!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `👤 <b>Staff:</b> ${staffName} (#${staffId})\n` +
          `📅 <b>Date:</b> ${todayStr}\n` +
          `🕒 <b>Time:</b> <code>${formattedTime}</code>\n` +
          `📱 <b>WhatsApp:</b> Triggered for <code>${staffPhone}</code>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `<i>Have a productive day at Career Xone!</i>`;

        await sendTelegramMessage(chatId, replyMsg, { reply_markup: getActionKeyboard(profileKey) });
        return;
      }

      // Handle Check-Out
      const isCheckOutCmd = lowerText.startsWith('/out') || lowerText.includes('check-out') || lowerText.includes('punch-out');
      if (isCheckOutCmd) {
        const customTime = parseCustomTimeString(rawText);
        const formattedTime = customTime || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        const todayStr = new Date().toISOString().split('T')[0];

        const result = await processPunchRecord({
          rollNumber: staffId,
          type: 'OUT',
          punchTime: formattedTime,
          punchDate: todayStr,
          deviceSN: 'Biomax Device',
          verifyType: 'Biometric Push',
          isSilent: true
        });

        // Re-fetch record to get precise work duration
        const record = await StaffAttendance.findOne({
          isDeleted: { $ne: true },
          staffId: String(staffId),
          date: todayStr
        });

        const duration = record?.workHoursFormatted && record.workHoursFormatted !== '0h 0m'
          ? record.workHoursFormatted
          : (result?.workHoursFormatted || 'Recorded');

        const replyMsg =
          `🔴 <b>CHECK-OUT RECORDED!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `👤 <b>Staff:</b> ${staffName} (#${staffId})\n` +
          `📅 <b>Date:</b> ${todayStr}\n` +
          `🕒 <b>Exit Time:</b> <code>${formattedTime}</code>\n` +
          `⏱️ <b>Total Duty:</b> <b>${duration}</b>\n` +
          `📱 <b>WhatsApp:</b> Triggered with Duration for <code>${staffPhone}</code>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `<i>Great job today! Rest well.</i>`;

        await sendTelegramMessage(chatId, replyMsg, { reply_markup: getActionKeyboard(profileKey) });
        return;
      }

      // Default Help / Fallback
      await sendTelegramMessage(
        chatId,
        `👋 Hello <b>${staffName}</b>!\n\n` +
        `Use the buttons below to mark your attendance, or type:\n` +
        `• <code>/in</code> ➔ Check-In now\n` +
        `• <code>/out</code> ➔ Check-Out now\n` +
        `• <code>/status</code> ➔ View today's duty hours`,
        { reply_markup: getActionKeyboard() }
      );
    }
  } catch (err) {
    console.warn('[TelegramBot] Error handling update:', err.message);
  }
}

// --- Main Long Polling Loop ---
let isPollingActive = false;
let pollingOffset = 0;

export async function startTelegramAttendanceBot() {
  loadConfig();

  if (!botConfig.enabled || !botConfig.botToken) {
    console.log('[TelegramBot] ℹ️ Bot is disabled or missing botToken. Skipping start.');
    return;
  }

  if (!isCurrentMachineMaster()) {
    console.log('[TelegramBot] ℹ️ This PC is in Client Workstation mode. Telegram polling disabled to avoid 409 conflict with Master PC.');
    return;
  }

  if (isPollingActive) {
    console.log('[TelegramBot] ℹ️ Long polling is already active.');
    return;
  }

  isPollingActive = true;
  console.log('🤖 [TelegramBot] Remote Attendance Bot Service Starting (Long Polling)...');

  // Verify Bot Connection
  try {
    const me = await telegramRequest('getMe');
    if (me?.ok) {
      console.log(`🤖 [TelegramBot] Connected as @${me.result.username} (ID: ${me.result.id})`);
    } else {
      console.warn('[TelegramBot] ⚠️ getMe verification failed:', me?.description || me?.error);
    }
  } catch (e) {
    console.warn('[TelegramBot] ⚠️ Could not contact Telegram on startup:', e.message);
  }

  // Polling Loop
  const poll = async () => {
    if (!isPollingActive) return;

    try {
      const updatesRes = await telegramRequest('getUpdates', {
        offset: pollingOffset,
        timeout: 25,
        allowed_updates: ['message', 'callback_query']
      });

      if (updatesRes && updatesRes.ok && Array.isArray(updatesRes.result)) {
        for (const update of updatesRes.result) {
          pollingOffset = update.update_id + 1;
          await handleTelegramUpdate(update);
        }
      }
    } catch (pollErr) {
      // Quietly wait on network error before retrying
      await new Promise((r) => setTimeout(r, 4000));
    }

    // Schedule next poll iteration
    setTimeout(poll, 1000);
  };

  poll();
}

export function stopTelegramAttendanceBot() {
  isPollingActive = false;
  console.log('[TelegramBot] Bot service stopped.');
}

export function getTelegramBotStatus() {
  return {
    enabled: botConfig.enabled,
    hasToken: !!botConfig.botToken,
    users: botConfig.users,
    isPolling: isPollingActive
  };
}
