import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import SMSLog from '../models/SMSLog.js';
import MessageLock from '../models/MessageLock.js';
import { sendWhatsAppMessageWeb, getWhatsAppClientState } from './whatsappClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MESSAGING_CONFIG_FILE = path.join(__dirname, '../whatsapp_messaging_config.json');

// --- Persistent Outbound Messaging Switch ---
let outboundMessagingEnabled = true;
try {
  if (fs.existsSync(MESSAGING_CONFIG_FILE)) {
    const raw = fs.readFileSync(MESSAGING_CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (typeof parsed.outboundMessagingEnabled === 'boolean') {
      outboundMessagingEnabled = parsed.outboundMessagingEnabled;
    }
  }
} catch (e) {}

export function getOutboundMessagingStatus() {
  return outboundMessagingEnabled;
}

export function setOutboundMessagingStatus(enabled) {
  outboundMessagingEnabled = !!enabled;
  try {
    fs.writeFileSync(MESSAGING_CONFIG_FILE, JSON.stringify({ outboundMessagingEnabled }, null, 2), 'utf-8');
  } catch (e) {}
  return outboundMessagingEnabled;
}

// --- Multi-PC / Peer Instance In-Memory De-duplication Lock ---
const sentAlertLockMap = new Map();

function isDuplicateAlert(studentId, type, dateStr, sessionName = null) {
  const lockKey = `${studentId}_${type}_${dateStr}_${sessionName || 'GEN'}`;
  const now = Date.now();
  if (sentAlertLockMap.has(lockKey)) {
    const timestamp = sentAlertLockMap.get(lockKey);
    if (now - timestamp < 10 * 60 * 1000) {
      return true;
    }
  }
  return false;
}

function recordSentAlert(studentId, type, dateStr, sessionName = null) {
  const lockKey = `${studentId}_${type}_${dateStr}_${sessionName || 'GEN'}`;
  sentAlertLockMap.set(lockKey, Date.now());
  if (sentAlertLockMap.size > 500) {
    const now = Date.now();
    for (const [k, v] of sentAlertLockMap.entries()) {
      if (now - v > 15 * 60 * 1000) sentAlertLockMap.delete(k);
    }
  }
}

/**
 * Sends a WhatsApp message to the specified parent phone number.
 * Logs the message details to the database (SMSLog).
 * Includes Atomic Multi-PC duplicate lock and persistent messaging check.
 */
export async function sendWhatsAppAlert({ instituteId, studentId, parentPhone, studentName, parentName, type, detail, sessionName = null, sessionId = null }) {
  // 1. Check persistent Master Messaging Switch
  const isMessagingPaused = !getOutboundMessagingStatus();

  // 2. In-Memory Fast De-duplication Guard
  const todayStr = new Date().toISOString().split('T')[0];
  if (isDuplicateAlert(studentId, type, todayStr, sessionName)) {
    console.log(`[WhatsAppService] 🛡️ Duplicate alert prevented for ${studentName} (${type}) - Already sent by connected PC instance!`);
    return { success: true, skipped: true, reason: 'Duplicate alert prevented' };
  }

  // 3. 🛡️ ATOMIC MULTI-PC DISTRIBUTED LOCK (Database-Level Guarantee)
  const lockKey = `${studentId}_${type}_${todayStr}_${sessionName || 'GEN'}`;
  try {
    await MessageLock.create({
      lockKey,
      instituteId,
      studentId,
      type,
      sessionName: sessionName || 'General',
      date: todayStr,
      lockedBy: os.hostname()
    });
    recordSentAlert(studentId, type, todayStr, sessionName);
  } catch (lockErr) {
    if (lockErr.code === 11000 || lockErr.message?.includes('duplicate key')) {
      recordSentAlert(studentId, type, todayStr, sessionName);
      console.log(`[WhatsAppService] 🛡️ ATOMIC MULTI-PC LOCK: Duplicate prevented for ${studentName} (${type} - ${sessionName || 'General'}). Another PC instance already sent/locked this message!`);
      return { success: true, skipped: true, reason: 'Duplicate alert prevented by Atomic Distributed Lock' };
    }
  }

  // 4. Multi-PC De-duplication Guard (Historical SMSLog Database Cross-Check)
  try {
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
    const mappedType = type === 'WELCOME' ? 'welcome' : (type === 'ABSENT' ? 'absent' : (type === 'TEST_RESULT' ? 'test-result' : (type === 'OUT' ? 'attendance-exit' : 'attendance-entry')));
    const existingLog = await SMSLog.findOne({
      studentId,
      type: mappedType,
      createdAt: { $gte: tenMinsAgo },
      status: { $in: ['delivered', 'sent'] }
    });
    if (existingLog) {
      recordSentAlert(studentId, type, todayStr, sessionName);
      console.log(`[WhatsAppService] 🛡️ Duplicate alert prevented in DB for ${studentName} (${type}) - Already logged by peer PC!`);
      return { success: true, skipped: true, reason: 'Duplicate alert already logged' };
    }
  } catch (dbErr) {}

  const provider = (process.env.WHATSAPP_PROVIDER || 'mock').toLowerCase();
  let status = isMessagingPaused ? 'pending' : 'sent';

  // Format current date in Indian style (DD-MM-YYYY)
  const now = new Date();
  const formattedDate = now.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');

  // Build message text based on type
  const pName = parentName || 'Parent';
  const isStaffAlert = (typeof detail === 'string' && detail.includes('Staff Attendance')) || (sessionName && sessionName.includes('Duty'));
  let messageText;
  if (isStaffAlert) {
    if (type === 'IN') {
      messageText = `Dear ${studentName}, your staff attendance check-in has been safely recorded on ${formattedDate} at ${detail}. - Career Xone`;
    } else if (type === 'OUT') {
      messageText = `Dear ${studentName}, your staff attendance check-out has been safely recorded on ${formattedDate} at ${detail}. - Career Xone`;
    } else {
      messageText = `Dear ${studentName}, your staff attendance status has been updated on ${formattedDate} (${detail}). - Career Xone`;
    }
  } else if (type === 'IN') {
    messageText = `Dear ${pName}, this is to inform you that your ward ${studentName} has safely arrived at the institute on ${formattedDate} at ${detail}. - Career Xone`;
  } else if (type === 'OUT') {
    messageText = `Dear ${pName}, this is to inform you that your ward ${studentName} has left the institute on ${formattedDate} at ${detail}. - Career Xone`;
  } else if (type === 'ABSENT') {
    messageText = `Dear ${pName}, this is to inform you that your ward ${studentName} is absent from the institute today on ${formattedDate} (${detail}). - Career Xone`;
  } else if (type === 'TEST_RESULT' && typeof detail === 'object') {
    const portalUrl = process.env.PUBLIC_PORTAL_URL || 'https://studentreport.cxjeeneet.com/?app=parent#/parent';
    const percent = detail.percentage ?? (detail.totalMarks ? Math.round((Number(detail.marks) / detail.totalMarks) * 1000) / 10 : 0);
    messageText = `📊 *Test Result Announcement - Career Xone*\n\nDear Parent, your ward *${studentName}* has appeared for *${detail.testName || detail.subject || 'Exam'}* on ${formattedDate}.\n\n🎯 *Marks Scored:* ${detail.marks}/${detail.totalMarks} (${percent}%)\n🏆 *Rank:* ${detail.rank || '-'}/${detail.totalStudents || '-'}\n\n📱 *View Complete Report & Scanned OMR Sheet:*\n🔗 ${portalUrl}\n\n- Career Xone (CX Career Academy)`;
  } else if (type === 'SESSION_CONTINUE') {
    const prev = typeof detail === 'object' ? (detail.prevSession || 'Morning Class') : 'Morning Class';
    const next = typeof detail === 'object' ? (detail.nextSession || 'Self Study') : (detail || 'Self Study');
    messageText = `Dear ${pName}, this is to inform you that your ward ${studentName} did not check out after ${prev} and is continuing at the institute on ${formattedDate} for ${next}. - Career Xone`;
  } else if (type === 'MISSED_EXIT') {
    const sess = typeof detail === 'object' ? (detail.sessionName || 'Self Study') : (detail || 'the session');
    const timeStr = typeof detail === 'object' && detail.time ? ` (${detail.time})` : '';
    messageText = `Dear ${pName}, this is to inform you that your ward ${studentName} did not record a check-out punch on ${formattedDate} before the end of ${sess}${timeStr}. - Career Xone`;
  } else if (type === 'WELCOME') {
    const portalUrl = process.env.PUBLIC_PORTAL_URL || 'https://studentreport.cxjeeneet.com/?app=parent#/parent';
    messageText = `🎉 Welcome to Career Xone!\n\n${studentName} has been registered successfully on ${formattedDate}.\n\n📱 *Download/Access Parents App:*\n🔗 Link: ${portalUrl}\n\n*Login Credentials:*\nUser ID: ${detail.parentUserId}\nPassword: ${detail.parentPassword}\n\nPlease login to track attendance and test results regularly.`;
  } else {
    messageText = `Notification for ${studentName} (${formattedDate}): ${detail || 'No details provided.'}`;
  }

  const phoneNumbers = parentPhone ? parentPhone.split(',').map(p => p.trim()).filter(Boolean) : [];

  if (isMessagingPaused) {
    console.log(`[WhatsAppService] ⏸️ Outbound messaging is PAUSED. Logging SMS in SMS Center as pending for ${studentName} (${type}).`);
  } else {
    for (const phone of phoneNumbers) {
      let formattedPhone = phone.replace(/\D/g, '');
      if (formattedPhone.length === 10) {
        formattedPhone = '91' + formattedPhone;
      }
      if (!formattedPhone.startsWith('+') && formattedPhone.length > 0) {
        formattedPhone = '+' + formattedPhone;
      }

      console.log(`[WhatsAppService] Sending WhatsApp alert to ${formattedPhone} (Type: ${type})`);

      try {
        const waState = getWhatsAppClientState();
        if (waState && waState.status === 'ready') {
          await sendWhatsAppMessageWeb(formattedPhone, messageText);
          status = 'delivered';
          recordSentAlert(studentId, type, todayStr);
          console.log(`[WhatsAppService] Successfully sent WhatsApp message via local client to ${formattedPhone}`);
        } else if (provider === 'ultramsg') {
        const instanceId = process.env.WHATSAPP_INSTANCE_ID;
        const token = process.env.WHATSAPP_TOKEN;

        if (!instanceId || !token) {
          throw new Error('Ultramsg config missing (WHATSAPP_INSTANCE_ID or WHATSAPP_TOKEN)');
        }

        const response = await fetch(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: token,
            to: formattedPhone,
            body: messageText
          })
        });

        const resData = await response.json();
        if (!response.ok || resData.error) {
          throw new Error(resData.error || `HTTP ${response.status}`);
        }
        status = 'delivered';

      } else if (provider === 'twilio') {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'; // sandbox number fallback

        if (!accountSid || !authToken) {
          throw new Error('Twilio config missing (TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN)');
        }

        const authHeader = 'Basic ' + Buffer.from(accountSid + ':' + authToken).toString('base64');
        const params = new URLSearchParams();
        params.append('From', fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`);
        params.append('To', formattedPhone.startsWith('whatsapp:') ? formattedPhone : `whatsapp:${formattedPhone}`);
        params.append('Body', messageText);

        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params.toString()
        });

        const resData = await response.json();
        if (!response.ok) {
          throw new Error(resData.message || `HTTP ${response.status}`);
        }
        status = 'delivered';
      } else {
        status = 'pending';
      }
      } catch (err) {
        console.error('[WhatsAppService] Error sending WhatsApp message:', err.message);
        status = 'failed';
      }
    }
  }

  // Create Log in SMSLog DB Collection
  try {
    const log = new SMSLog({
      instituteId,
      id: `SMS${Date.now()}`,
      type: type === 'WELCOME' ? 'welcome' : (type === 'ABSENT' ? 'absent' : (type === 'TEST_RESULT' ? 'test-result' : (type === 'OUT' ? 'attendance-exit' : 'attendance-entry'))),
      studentId,
      parentPhone,
      message: messageText,
      timestamp: new Date().toISOString(),
      status,
      sessionName: sessionName || (typeof detail === 'string' && detail.includes(' for ') ? detail.split(' for ')[1]?.split(' (')[0]?.trim() : null),
      sessionId: sessionId || null
    });
    await log.save();
    console.log(`[WhatsAppService] SMSLog saved successfully (Type: ${log.type}, Status: ${status}, Session: ${log.sessionName || 'General'}).`);
    return { success: status !== 'failed', status, logId: log.id, message: messageText };
  } catch (logErr) {
    console.error('[WhatsAppService] Failed to save SMSLog:', logErr.message);
    return { success: false, error: logErr.message };
  }
}

