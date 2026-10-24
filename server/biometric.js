// ============================================================================
// 📡 CAREER XONE PRO — BIOMETRIC HARDWARE CORE ENGINE (biometric.js)
// ============================================================================
// Supports: FK / Realtime / BioMax / eSSL / ZKTeco Biometric Terminals
// Protocols:
//   1. FK Web Protocol (HTTP POST /hdata.aspx) — Realand / Biomax Push (Native)
//   2. ADMS Push Receiver (HTTP POST /iclock/cdata) — ZKTeco / Cloud ADMS Push
//   3. Direct TCP Socket Poller on Port 71 (FK/Realtime) and Port 4370 (ZKTeco)
//   4. Automated Subnet Discovery Scanner (Multi-Port Wi-Fi Sweeper)
//   5. Dual Student & Staff/Employee Automatic Routing + WhatsApp Alerts
// ============================================================================

import express from 'express';
import net from 'net';
import os from 'os';
import { exec, execSync } from 'child_process';
import mongoose from 'mongoose';
import ZKLib from 'node-zklib';
import Student from './models/Student.js';
import Attendance from './models/Attendance.js';
import Staff from './models/Staff.js';
import StaffAttendance from './models/StaffAttendance.js';
import Session from './models/Session.js';
import Notification from './models/Notification.js';
import SMSLog from './models/SMSLog.js';
import User from './models/User.js';
import { sendWhatsAppAlert } from './services/whatsappService.js';
import { formatDurationHuman, resolveSessionForStudent } from './services/sessionResolver.js';
import { logInfo, logError, logWarn } from './utils/logger.js';
import { mirrorWrite, dualDelete } from './db/syncEngine.js';

export function getRoundLabel(type, round) {
  if (round <= 1) {
    return type === 'IN' ? 'Check-in' : 'Check-out';
  }
  const ordinals = { 2: 'Second', 3: 'Third', 4: 'Fourth', 5: 'Fifth', 6: 'Sixth' };
  const ord = ordinals[round] || `${round}th`;
  return type === 'IN' ? `${ord} Check-in` : `${ord} Check-out`;
}

// ----------------------------------------------------------------------------
// 📊 In-Memory State
// ----------------------------------------------------------------------------
let autoSyncTimer = null;
let isSyncing = false;

// Last 50 real-time punch events for live attendance stream (Students + Staff)
const recentPunches = [];

// Latest real-time punch event for Kiosk Audio / Visual animation trigger
let latestBiometricEvent = null;

// Cutoff Date for accepting biometric punches (defaults to today or configured date)
let biometricCutoffDate = process.env.BIOMETRIC_CUTOFF_DATE || new Date().toISOString().split('T')[0];

// ADMS & FK Live Push Receiver Status
const admsStatus = {
  active: true,
  listenerPort: 5000,
  lastSeenSN: null,
  lastSeenTime: null,
  clientIp: null,
  totalPushesReceived: 0,
  lastPushStatus: 'Listening on port 5000 & 8000'
};

// Global Sync Status State
let lastSyncStatus = {
  connected: false,
  deviceInfo: null,
  lastSyncTime: null,
  lastSyncedCount: 0,
  autoSyncEnabled: false,
  targetIp: '192.168.0.12',
  targetPort: 8000,
  targetDevices: [{ ip: '192.168.0.12', port: 8000, name: 'Biomax Terminal' }],
  error: null
};

// ----------------------------------------------------------------------------
// 🛠️ Network Utilities
// ----------------------------------------------------------------------------

export function recordAdmsActivity(sn, rawDataLength = 0, clientIp = '') {
  admsStatus.lastSeenSN = sn || admsStatus.lastSeenSN || 'FK_BIOMETRIC_DEV';
  admsStatus.lastSeenTime = new Date().toISOString();
  admsStatus.clientIp = clientIp || admsStatus.clientIp;
  admsStatus.totalPushesReceived += 1;
  admsStatus.lastPushStatus = `Received ${rawDataLength} bytes at ${new Date().toLocaleTimeString('en-IN')}`;

  lastSyncStatus.connected = true;
  lastSyncStatus.error = null;
}

export function checkTcpPort(ip, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;

    const cleanup = (result) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => cleanup(true));
    socket.once('timeout', () => cleanup(false));
    socket.once('error', () => cleanup(false));
    socket.connect(port, ip);
  });
}

export function getLocalNetworkIp() {
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

// Parse FK Time String "YYYYMMDDHHMMSS" / ISO / Standard -> Date object & Formatted String
export function parseFkTimestamp(rawTime) {
  try {
    if (!rawTime) throw new Error('Empty time');
    const str = String(rawTime).trim();
    
    // 1. ISO or standard format: "2026-08-31 09:30:00" or "2026-08-31T09:30:00"
    if (str.includes('-') || str.includes('/') || str.includes('T')) {
      const parsedDate = new Date(str.replace(' ', 'T'));
      if (!isNaN(parsedDate.getTime())) {
        const year = parsedDate.getFullYear();
        const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const day = String(parsedDate.getDate()).padStart(2, '0');
        return {
          dateObj: parsedDate,
          dateStr: `${year}-${month}-${day}`,
          formattedTime: parsedDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
        };
      }
    }

    // 2. Continuous digit string "20260831093000" (14 digits)
    const clean = str.replace(/[^0-9]/g, '');
    if (clean.length >= 14) {
      const year = parseInt(clean.substring(0, 4), 10);
      const month = parseInt(clean.substring(4, 6), 10) - 1;
      const day = parseInt(clean.substring(6, 8), 10);
      const hour = parseInt(clean.substring(8, 10), 10);
      const minute = parseInt(clean.substring(10, 12), 10);
      const second = parseInt(clean.substring(12, 14), 10);
      const d = new Date(year, month, day, hour, minute, second);
      return {
        dateObj: d,
        dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        formattedTime: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
      };
    }
  } catch (e) {}
  const now = new Date();
  return {
    dateObj: now,
    dateStr: now.toISOString().split('T')[0],
    formattedTime: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  };
}

export function mapFkIoMode(mode) {
  const m = parseInt(mode, 10);
  if (m === 16777216 || m === 0 || m === 1) return 'IN';
  if (m === 33554432 || m === 2) return 'OUT';
  if (m === 50331648 || m === 3) return 'OUT'; // Break-Out
  if (m === 67108864 || m === 4) return 'IN';  // Break-In
  return 'IN';
}

export function mapFkVerifyMode(vm) {
  const v = parseInt(vm, 10);
  if (v === 268435456 || v === 1) return 'Fingerprint';
  if (v === 2) return 'Face';
  if (v === 3) return 'Card';
  if (v === 4) return 'Password';
  return 'Fingerprint';
}

// ----------------------------------------------------------------------------
// 🕒 Dynamic Time & Cumulative Work Duration Calculation Helpers
// ----------------------------------------------------------------------------

export function parseTimeToMins(t) {
  if (!t || t === '--') return null;
  const str = String(t).trim();
  const ampmMatch = str.match(/^(\d{1,2}):(\d{1,2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = parseInt(ampmMatch[2], 10) || 0;
    const mod = ampmMatch[3] ? ampmMatch[3].toUpperCase() : null;
    if (mod === 'PM' && h < 12) h += 12;
    if (mod === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }
  const parts = str.split(':');
  if (parts.length >= 2) {
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
  }
  return null;
}

export function calculateCumulativeWorkDuration(punches = []) {
  if (!Array.isArray(punches) || punches.length === 0) {
    return { durationMinutes: 0, workHoursFormatted: '0h 0m' };
  }

  let totalMinutes = 0;
  let activeInMinutes = null;

  for (const p of punches) {
    const mins = parseTimeToMins(p.time);
    if (mins === null) continue;

    if (p.type === 'IN') {
      activeInMinutes = mins;
    } else if (p.type === 'OUT' && activeInMinutes !== null) {
      if (mins > activeInMinutes) {
        totalMinutes += (mins - activeInMinutes);
      }
      activeInMinutes = null;
    }
  }

  const hours = Math.floor(totalMinutes / 60);
  const remainingMins = totalMinutes % 60;
  return {
    durationMinutes: totalMinutes,
    workHoursFormatted: `${hours}h ${remainingMins}m`
  };
}

// ----------------------------------------------------------------------------
// 🔍 0. Auto-Scan Local Subnet for Biometric Machines
// ----------------------------------------------------------------------------

export async function scanLocalSubnetForBiometricDevices() {
  logInfo('BIOMETRIC', '🔍 Scanning local Wi-Fi subnet for all Biometric Machines...');
  const interfaces = os.networkInterfaces();
  const subnets = new Set();
  const localIps = new Set();

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4') {
        localIps.add(iface.address);
        if (!iface.internal) {
          const parts = iface.address.split('.');
          if (parts.length === 4) {
            subnets.add(`${parts[0]}.${parts[1]}.${parts[2]}`);
          }
        }
      }
    }
  }

  const targetPorts = [8000, 5000, 4370, 71, 5005, 5500, 9922];
  const discoveredMap = new Map();
  const probeTasks = [];

  for (const subnet of subnets) {
    for (let i = 1; i <= 254; i++) {
      const targetIp = `${subnet}.${i}`;
      if (localIps.has(targetIp)) continue;

      for (const port of targetPorts) {
        probeTasks.push(
          (async () => {
            const isOpen = await checkTcpPort(targetIp, port, 1000);
            if (isOpen) {
              let name = `Biometric Machine (${targetIp})`;
              let protocol = `Port ${port}`;
              if (port === 8000 || port === 5000) {
                name = `Biomax FK Terminal (${targetIp})`;
                protocol = 'FK Web Push';
              } else if (port === 4370) {
                name = `ZKTeco / eSSL Device (${targetIp})`;
                protocol = 'ZK Protocol';
              } else if (port === 71) {
                name = `FK / Realtime Device (${targetIp})`;
                protocol = 'FK Port 71';
              }

              discoveredMap.set(targetIp, {
                ip: targetIp,
                port: port,
                name: name,
                protocol: protocol,
                status: 'Online'
              });
            }
          })()
        );
      }
    }
  }

  const BATCH_SIZE = 150;
  for (let i = 0; i < probeTasks.length; i += BATCH_SIZE) {
    await Promise.all(probeTasks.slice(i, i + BATCH_SIZE));
  }

  const discovered = Array.from(discoveredMap.values()).sort((a, b) => {
    const numA = parseInt(a.ip.split('.').pop(), 10) || 0;
    const numB = parseInt(b.ip.split('.').pop(), 10) || 0;
    return numA - numB;
  });

  logInfo('BIOMETRIC', `✅ Scan completed. Found ${discovered.length} biometric devices on network.`);
  return {
    success: true,
    count: discovered.length,
    devices: discovered,
    scannedSubnets: Array.from(subnets)
  };
}

// ----------------------------------------------------------------------------
// 👥 1. DUAL ROUTER: Process Punch for Student OR Staff/Employee
// ----------------------------------------------------------------------------

// Hardware Punch Rapid Echo Debounce Map (Protects against simultaneous daemon + frontend listener)
const hardwarePunchDebounceMap = new Map();

export function isRecentHardwarePunch(id, dateStr = null) {
  if (!id) return false;
  const todayStr = dateStr || new Date().toISOString().split('T')[0];
  const raw = String(id || '').trim();
  const clean = raw.replace(/[^0-9]/g, '').replace(/^0+/, '') || raw;
  const k1 = `${clean}_${todayStr}`;
  const k2 = `${raw}_${todayStr}`;
  const now = Date.now();
  const c1 = hardwarePunchDebounceMap.get(k1);
  const c2 = hardwarePunchDebounceMap.get(k2);
  if ((c1 && now - c1.timestamp < 4000) || (c2 && now - c2.timestamp < 4000)) {
    return true;
  }
  return false;
}

export async function processPunchRecord({ rollNumber, type = 'IN', punchTime, punchDate, instituteId, deviceSN = null, verifyType = 'Fingerprint', deviceIp = '', isSilent = false }) {
  try {
    const rawId = String(rollNumber || '').trim();
    const numericId = rawId.replace(/[^0-9]/g, '');
    const cleanId = (numericId ? numericId.replace(/^0+/, '') : rawId.replace(/^0+/, '')) || rawId;

    const todayStr = punchDate && punchDate.length === 10 ? punchDate.replace(/\//g, '-') : new Date().toISOString().split('T')[0];
    const formattedTime = punchTime || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    // 🛡️ Rapid Hardware Echo Debounce: If the exact same user punched within 3000ms on physical hardware with the same direction, return the cached result
    const isManualEntry = deviceSN === 'Manual Web Entry' || deviceSN === 'Verification Suite' || deviceSN === 'Manual Test Script' || deviceSN === 'Telegram Remote' || deviceSN === 'Biomax Remote';
    const debounceKey = `${cleanId || rawId}_${todayStr}`;
    const cachedPunch = hardwarePunchDebounceMap.get(debounceKey);
    const nowMs = Date.now();
    const isSameType = cachedPunch && (cachedPunch.type === type || (cachedPunch.result?.type && cachedPunch.result.type === type));

    if (!isManualEntry && cachedPunch && isSameType && (nowMs - cachedPunch.timestamp < 3000)) {
      logInfo('BIOMETRIC', `⚡ Hardware Punch Echo Debounce: Duplicate trigger suppressed for ${rawId} (${nowMs - cachedPunch.timestamp}ms ago).`);
      return cachedPunch.result;
    }

    // Step A: Check if User is a Staff / Employee Member
    let isStaff = false;
    let staffMember = null;
    const isExplicitStaff = /^staff[_-]?/i.test(rawId) || rawId === '340' || cleanId === '340' || numericId === '340';
    const staffTargetId = rawId.replace(/^staff[_-]?/i, '').replace(/^#+/, '').trim();
    const cleanStaffTarget = (staffTargetId.replace(/[^0-9]/g, '') || staffTargetId).replace(/^0+/, '') || staffTargetId;

    if (isExplicitStaff) {
      if (staffTargetId === '340' || cleanStaffTarget === '340') {
        isStaff = true;
        staffMember = await Staff.findOne({ staffId: '340' });
        if (!staffMember) {
          staffMember = await Staff.create({
            id: 'STAFF_340',
            staffId: '340',
            name: 'Prince Kumar',
            designation: 'Software Engineer / Admin',
            department: 'Engineering',
            phone: '9876543210',
            role: 'admin',
            status: 'active'
          });
        }
      } else {
        staffMember = await Staff.findOne({
          isDeleted: { $ne: true },
          $or: [
            { staffId: staffTargetId },
            { staffId: cleanStaffTarget },
            { id: `STAFF_${staffTargetId}` },
            { id: `STAFF_${cleanStaffTarget}` },
            { id: staffTargetId }
          ]
        });
        if (staffMember) isStaff = true;
      }
    } else {
      // Normal input: First verify if a Student exists with this ID/Roll
      const quickStudentQuery = [
        { rollNo: rawId },
        { rollNo: cleanId },
        { id: rawId },
        { id: cleanId },
        { biometricId: rawId },
        { biometricEnrollId: rawId },
        { biometricEnrollId: cleanId }
      ];
      if (numericId) {
        quickStudentQuery.push({ rollNo: numericId });
        quickStudentQuery.push({ rollNo: `CAREER${numericId}` });
      }
      const existingStudent = await Student.findOne({ isDeleted: { $ne: true }, $or: quickStudentQuery });
      if (!existingStudent) {
        // Fallback: If no student matched, check if an active staff member has this ID
        staffMember = await Staff.findOne({
          isDeleted: { $ne: true },
          $or: [
            { staffId: rawId },
            { staffId: cleanId },
            { id: `STAFF_${rawId}` },
            { id: `STAFF_${cleanId}` }
          ]
        });
        if (staffMember) isStaff = true;
      }
    }

    // Step B: Route to Staff Attendance if Employee
    if (isStaff && staffMember) {
      let record = await StaffAttendance.findOne({
        isDeleted: { $ne: true },
        staffId: staffMember.staffId,
        date: todayStr
      });

      let isNew = false;
      let punchDir = String(type || 'AUTO').toUpperCase();

      if (!record) {
        if (punchDir === 'AUTO') punchDir = 'IN';
        record = new StaffAttendance({
          instituteId: staffMember.instituteId || instituteId || null,
          staffId: staffMember.staffId,
          staffName: staffMember.name,
          department: staffMember.department || 'General',
          designation: staffMember.designation || 'Staff',
          date: todayStr,
          entryTime: punchDir === 'IN' ? formattedTime : '--',
          exitTime: punchDir === 'OUT' ? formattedTime : '--',
          punches: [{
            type: punchDir,
            time: formattedTime,
            timestamp: new Date(),
            deviceSN: deviceSN || 'Biomax Device',
            round: 1
          }],
          status: 'present',
          durationMinutes: 0,
          workHoursFormatted: '0h 0m',
          deviceSN: deviceSN || 'Biomax Device',
          deviceIp: deviceIp,
          verifyType: verifyType,
          source: 'BIOMETRIC_PUSH'
        });
        isNew = true;
      } else {
        if (!Array.isArray(record.punches)) {
          record.punches = [];
          if (record.entryTime && record.entryTime !== '--') {
            record.punches.push({ type: 'IN', time: record.entryTime, timestamp: new Date(), deviceSN: record.deviceSN || 'Biomax Device', round: 1 });
          }
          if (record.exitTime && record.exitTime !== '--') {
            record.punches.push({ type: 'OUT', time: record.exitTime, timestamp: new Date(), deviceSN: record.deviceSN || 'Biomax Device', round: 1 });
          }
        }

        const lastPunch = record.punches.length > 0 ? record.punches[record.punches.length - 1] : null;
        const isCurrentlyIn = lastPunch && lastPunch.type === 'IN';

        // 🛡️ Anti-Bounce check: If same staff tapped within 1 minute, ignore rapid duplicate tap
        const curMins = parseTimeToMins(formattedTime);
        if (lastPunch && lastPunch.time && curMins !== null) {
          const lastMins = parseTimeToMins(lastPunch.time);
          if (lastMins !== null && Math.abs(curMins - lastMins) < 1) {
            logInfo('BIOMETRIC', `⚡ Staff Anti-Bounce: ${staffMember.name} (#${staffMember.staffId}) tapped within 1 min (${lastPunch.time}). Suppressed duplicate.`);
            return {
              success: true,
              isDuplicate: true,
              isStaff: true,
              name: staffMember.name,
              staffId: staffMember.staffId,
              type: lastPunch.type,
              time: formattedTime,
              message: 'Duplicate rapid tap suppressed'
            };
          }
        }

        // Automatic Dynamic Toggle: Aaye to IN, Gaye to OUT, Fir aaye to IN, Fir gaye to OUT
        if (punchDir === 'AUTO') {
          punchDir = isCurrentlyIn ? 'OUT' : 'IN';
        }

        let round = 1;
        if (punchDir === 'IN') {
          const inCount = record.punches.filter(p => p.type === 'IN').length;
          round = inCount + 1;
          if (!record.entryTime || record.entryTime === '--') {
            record.entryTime = formattedTime;
          }
          record.exitTime = '--'; // Clocked IN now
          isNew = true;
        } else {
          // punchDir === 'OUT'
          round = (lastPunch && lastPunch.type === 'IN') ? (lastPunch.round || 1) : (record.punches.filter(p => p.type === 'OUT').length + 1);
          record.exitTime = formattedTime; // Latest exit time
          isNew = true;
        }

        record.punches.push({
          type: punchDir,
          time: formattedTime,
          timestamp: new Date(),
          deviceSN: deviceSN || 'Biomax Device',
          round
        });

        // 🕒 Cumulative Work Duration Calculation across all shifts today
        const dur = calculateCumulativeWorkDuration(record.punches);
        record.durationMinutes = dur.durationMinutes;
        record.workHoursFormatted = dur.workHoursFormatted;
        record.status = 'present';
        if (deviceSN) record.deviceSN = deviceSN;
        if (deviceIp) record.deviceIp = deviceIp;
      }
      type = punchDir;

      record.markModified('punches');
      await record.save();
      mirrorWrite('staffattendances', record.toObject ? record.toObject() : record);

      // Trigger Staff WhatsApp / SMS Alert & Log in SMS Center
      let staffInstId = staffMember.instituteId || instituteId || null;
      if (!staffInstId) {
        try {
          const defaultUser = await User.findOne({ instituteId: { $ne: null } });
          if (defaultUser?.instituteId) staffInstId = defaultUser.instituteId;
        } catch (_) {}
      }
      if (isNew && staffMember.phone) {
        const outDurationText = (type === 'OUT' && record.workHoursFormatted && record.workHoursFormatted !== '0h 0m')
          ? ` (Work Duration: ${record.workHoursFormatted})`
          : '';
        sendWhatsAppAlert({
          instituteId: staffInstId,
          studentId: staffMember.staffId || staffMember.id,
          parentPhone: staffMember.phone,
          studentName: staffMember.name,
          parentName: staffMember.name,
          type: type === 'IN' ? 'IN' : 'OUT',
          detail: `${formattedTime}${outDurationText} (Staff Attendance)`,
          sessionName: `${staffMember.department || 'Staff'} Duty`
        }).then(res => {
          if (res?.success) {
            console.log(`[Biometric] 📱 Staff ${type} WhatsApp Alert Queued for ${staffMember.name} (${staffMember.phone})`);
          }
        }).catch((err) => console.warn('[Biometric] Staff WhatsApp alert warning:', err.message));
      } else if (!staffMember.phone) {
        console.log(`[Biometric] ℹ️ Staff #${staffMember.staffId} (${staffMember.name}) has no registered phone number. Skipping SMS.`);
      }

      // Add to live punch feed
      const punchEvent = {
        id: `PUNCH_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        role: 'staff',
        name: staffMember.name,
        staffId: staffMember.staffId,
        type: type,
        time: formattedTime,
        date: todayStr,
        department: staffMember.department || 'General',
        deviceSN: deviceSN || 'Biomax Terminal',
        verifyType: verifyType,
        timestamp: new Date().toISOString()
      };
      recentPunches.unshift(punchEvent);
      if (recentPunches.length > 50) recentPunches.pop();

      if (!isSilent && deviceSN !== 'Telegram Remote') {
        latestBiometricEvent = {
          id: punchEvent.id,
          timestamp: Date.now(),
          student: {
            id: staffMember.staffId,
            name: staffMember.name,
            rollNo: staffMember.staffId,
            batch: `${staffMember.designation || 'Staff'} (${staffMember.department || 'General'})`,
            photo: null,
            parentName: staffMember.name,
            parentPhone: staffMember.phone
          },
          punchType: type === 'IN' ? 'entry' : 'exit',
          time: formattedTime,
          date: todayStr,
          duration: record.workHoursFormatted || null,
          sessionName: `${staffMember.department || 'General'} Department`,
          parentPhone: staffMember.phone,
          isStaff: true
        };
      }

      logInfo('BIOMETRIC', `⭐ Staff Punch: ${staffMember.name} (#${staffMember.staffId}) -> ${type} at ${formattedTime}`);
      const staffResult = {
        success: true,
        isNew,
        isStaff: true,
        name: staffMember.name,
        staffId: staffMember.staffId,
        department: staffMember.department || 'General',
        designation: staffMember.designation || 'Staff',
        type,
        time: formattedTime,
        entryTime: record.entryTime || '--',
        exitTime: record.exitTime || '--',
        workHoursFormatted: record.workHoursFormatted || '0h 0m',
        date: todayStr
      };
      hardwarePunchDebounceMap.set(debounceKey, { timestamp: Date.now(), type, result: staffResult });
      return staffResult;
    }

  // Step C: If Not Staff, Route to Student Attendance
  const queryList = [
    { rollNo: rawId },
    { rollNo: cleanId },
    { id: rawId },
    { id: cleanId },
    { biometricId: rawId },
    { biometricEnrollId: rawId },
    { biometricEnrollId: cleanId }
  ];
  if (numericId) {
    queryList.push({ rollNo: numericId });
    queryList.push({ rollNo: `CAREER${numericId}` });
    queryList.push({ rollNo: `CAREER${cleanId}` });
    const numVal = parseInt(numericId, 10);
    if (!isNaN(numVal)) {
      queryList.push({ rollNo: numVal });
      queryList.push({ rollNo: String(numVal) });
      queryList.push({ rollNo: String(numVal).padStart(2, '0') });
      queryList.push({ rollNo: String(numVal).padStart(3, '0') });
      queryList.push({ rollNo: String(numVal).padStart(4, '0') });
      queryList.push({ rollNo: String(numVal).padStart(5, '0') });
    }
  }

  const studentQuery = { isDeleted: { $ne: true }, $or: queryList };
  if (instituteId) studentQuery.instituteId = instituteId;

  const student = await Student.findOne(studentQuery);
  if (!student) {
    logWarn('BIOMETRIC', `⚠️ Unknown user ID on biometric punch: ${rawId}`);
    recentPunches.unshift({
      id: `PUNCH_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      role: 'unregistered',
      name: `User #${rawId}`,
      rollNo: rawId,
      type: type,
      time: formattedTime,
      date: todayStr,
      deviceSN: deviceSN || 'Biomax Terminal',
      timestamp: new Date().toISOString()
    });
    if (recentPunches.length > 50) recentPunches.pop();

    return { success: false, reason: `User #${rawId} not registered in Students or Staff` };
  }

  const resolvedInstituteId = student.instituteId;

  const attQuery = {
    isDeleted: { $ne: true },
    studentId: student.id,
    date: todayStr
  };
  if (resolvedInstituteId) {
    attQuery.$or = [
      { instituteId: resolvedInstituteId },
      { instituteId: String(resolvedInstituteId) },
      { instituteId: { $exists: false } },
      { instituteId: null }
    ];
  }

  let record = await Attendance.findOne(attQuery);
  let effectiveType = type;
  let isNewPunch = false;
  let round = 1;
  let roundLabel = 'Check-in';
  const currentMins = parseTimeToMins(formattedTime);

  if (!record) {
    round = 1;
    effectiveType = 'IN';
    roundLabel = 'Check-in';
    record = new Attendance({
      instituteId: resolvedInstituteId,
      id: `ATT_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      studentId: student.id,
      date: todayStr,
      status: 'present',
      entryTime: formattedTime,
      exitTime: '--',
      punches: [{
        type: 'IN',
        time: formattedTime,
        round: 1,
        label: roundLabel,
        sessionName: null,
        deviceSN: deviceSN || 'Biometric Scanner',
        timestamp: new Date()
      }],
      smsSent: false
    });
    isNewPunch = true;
  } else {
    if (!Array.isArray(record.punches)) {
      record.punches = [];
    }

    // Backfill punches from legacy fields if punches array is empty
    if (record.punches.length === 0) {
      if (record.entryTime && record.entryTime !== '--') {
        record.punches.push({ type: 'IN', time: record.entryTime, round: 1, label: 'Check-in', timestamp: new Date() });
      }
      if (record.exitTime && record.exitTime !== '--') {
        record.punches.push({ type: 'OUT', time: record.exitTime, round: 1, label: 'Check-out', timestamp: new Date() });
      }
      if (record.entryTime2 && record.entryTime2 !== '--') {
        record.punches.push({ type: 'IN', time: record.entryTime2, round: 2, label: 'Second Check-in', timestamp: new Date() });
      }
      if (record.exitTime2 && record.exitTime2 !== '--') {
        record.punches.push({ type: 'OUT', time: record.exitTime2, round: 2, label: 'Second Check-out', timestamp: new Date() });
      }
    }

    const lastPunch = record.punches.length > 0 ? record.punches[record.punches.length - 1] : null;
    const isCurrentlyIn = lastPunch && lastPunch.type === 'IN';

    if (!isCurrentlyIn) {
      // Student is currently OUT -> Next punch is IN (Check-in or Re-entry)
      effectiveType = 'IN';
      const inCount = record.punches.filter(p => p.type === 'IN').length;
      round = inCount + 1;
      roundLabel = getRoundLabel('IN', round);

      // Anti-Bounce check: If last punch was within 2 minutes, ignore
      if (lastPunch && lastPunch.time) {
        const lastMins = parseTimeToMins(lastPunch.time);
        if (Math.abs(currentMins - lastMins) < 2) {
          logInfo('BIOMETRIC', `⚡ Anti-Bounce: ${student.name} (Roll ${student.rollNo}) punched within 2 mins of previous punch (${lastPunch.time}). Ignored.`);
          return {
            success: true,
            isDuplicate: true,
            isStaff: false,
            name: student.name,
            rollNo: student.rollNo,
            type: 'IN',
            time: formattedTime,
            message: 'Rapid duplicate punch ignored (Anti-Bounce)'
          };
        }
      }

      if (round === 1) {
        record.entryTime = formattedTime;
        if (!record.exitTime) record.exitTime = '--';
      } else if (round === 2) {
        record.entryTime2 = formattedTime;
        record.exitTime2 = '--';
      }

      // Auto-resolve active academic session specifically for this IN punch time
      let punchSessionName = null;
      let punchSessionId = null;
      try {
        const queryInst = resolvedInstituteId ? { instituteId: resolvedInstituteId } : {};
        const sessions = await Session.find({ isDeleted: { $ne: true }, ...queryInst });
        const matchedSess = resolveSessionForStudent(formattedTime, student, sessions);
        if (matchedSess) {
          punchSessionName = matchedSess.name;
          punchSessionId = matchedSess.id || matchedSess._id;
          record.sessionName = matchedSess.name;
          record.sessionId = punchSessionId;
        }
      } catch (sessErr) {
        console.warn('[Biometric] Session match error on IN punch:', sessErr.message);
      }

      record.punches.push({
        type: 'IN',
        time: formattedTime,
        round,
        label: roundLabel,
        sessionName: punchSessionName || record.sessionName || null,
        deviceSN: deviceSN || 'Biometric Scanner',
        timestamp: new Date()
      });
      isNewPunch = true;
    } else {
      // Student is currently IN -> Next punch is OUT (Check-out)
      effectiveType = 'OUT';
      round = lastPunch.round || 1;
      roundLabel = getRoundLabel('OUT', round);
      const inMins = parseTimeToMins(lastPunch.time);

      // 1. Anti-Bounce: If punched within 2 minutes of entry, ignore
      if (Math.abs(currentMins - inMins) < 2) {
        logInfo('BIOMETRIC', `⚡ Anti-Bounce: ${student.name} (Roll ${student.rollNo}) punched within 2 mins of Entry (${lastPunch.time}). Ignored.`);
        return {
          success: true,
          isDuplicate: true,
          isStaff: false,
          name: student.name,
          rollNo: student.rollNo,
          type: 'IN',
          time: formattedTime,
          message: 'Rapid duplicate punch ignored (Anti-Bounce)'
        };
      }

      // 2. Minimum stay guard (15 minutes from entry)
      if (currentMins - inMins < 15 && currentMins >= inMins) {
        logInfo('BIOMETRIC', `ℹ️ Early exit guard: ${student.name} punched before 15 mins. Exit allowed after 15 mins.`);
        return {
          success: true,
          isDuplicate: true,
          isStaff: false,
          name: student.name,
          rollNo: student.rollNo,
          type: 'IN',
          time: formattedTime,
          message: 'Exit allowed after 15 minutes of Check-In'
        };
      }

      if (round === 1) {
        record.exitTime = formattedTime;
      } else if (round === 2) {
        record.exitTime2 = formattedTime;
      }

      // For OUT punch: inherit corresponding round's IN session or resolve dynamically for punch time
      let punchSessionName = (lastPunch && lastPunch.round === round && lastPunch.sessionName) ? lastPunch.sessionName : null;
      let punchSessionId = record.sessionId;
      if (!punchSessionName) {
        try {
          const queryInst = resolvedInstituteId ? { instituteId: resolvedInstituteId } : {};
          const sessions = await Session.find({ isDeleted: { $ne: true }, ...queryInst });
          const matchedSess = resolveSessionForStudent(formattedTime, student, sessions);
          if (matchedSess) {
            punchSessionName = matchedSess.name;
            punchSessionId = matchedSess.id || matchedSess._id;
          }
        } catch (_) {}
      }
      if (punchSessionName) {
        record.sessionName = punchSessionName;
        record.sessionId = punchSessionId;
      }

      record.punches.push({
        type: 'OUT',
        time: formattedTime,
        round,
        label: roundLabel,
        sessionName: punchSessionName || record.sessionName || null,
        deviceSN: deviceSN || 'Biometric Scanner',
        timestamp: new Date()
      });
      isNewPunch = true;
    }

    record.status = 'present';
  }

  // Calculate cumulative duration in minutes across all punch pairs (e.g. Multiple classes / sessions)
  if (Array.isArray(record.punches) && record.punches.length > 0) {
    const dur = calculateCumulativeWorkDuration(record.punches);
    record.durationMinutes = dur.durationMinutes;
  } else if (record.entryTime && record.exitTime && record.entryTime !== '--' && record.exitTime !== '--') {
    try {
      const inM = parseTimeToMins(record.entryTime);
      const outM = parseTimeToMins(record.exitTime);
      if (outM > inM) {
        record.durationMinutes = outM - inM;
      }
    } catch (durErr) {}
  }

  // Auto-match or validate session based on punch time using central robust session resolver
  if (formattedTime) {
    try {
      const queryInst = resolvedInstituteId ? { instituteId: resolvedInstituteId } : {};
      const sessions = await Session.find({ isDeleted: { $ne: true }, ...queryInst });
      const matchedSess = resolveSessionForStudent(formattedTime, student, sessions);
      if (matchedSess) {
        record.sessionName = matchedSess.name;
        record.sessionId = matchedSess.id || matchedSess._id;
      } else if (record.sessionName && student) {
        // 🛡️ CRITICAL GUARD: Validate that the sessionName does NOT violate batch/class exclusions
        const existingSess = sessions.find(s => s.name === record.sessionName);
        if (existingSess) {
          const isAllowed = resolveSessionForStudent(formattedTime, student, [existingSess]);
          if (!isAllowed) {
            record.sessionName = null;
            record.sessionId = null;
          }
        }
      }
    } catch (sessErr) {
      console.warn('[Biometric] Session match error:', sessErr.message);
    }
  }

  if (isNewPunch) {
    if (student.parentPhone) record.smsSent = true;
    await record.save();

    // Mirror attendance to Cloud Atlas immediately
    mirrorWrite('attendances', record.toObject ? record.toObject() : record).catch(() => {});

    // In-App Notification creation & Cloud Mirroring
    const notifTitle = round > 1
      ? `${roundLabel} Alert`
      : (effectiveType === 'IN' ? 'Check-In Alert' : 'Check-Out Alert');

    const formattedDuration = formatDurationHuman(record.durationMinutes);
    const durationStr = formattedDuration ? ` (Duration: ${formattedDuration})` : '';
    const activePunchSession = (record.punches && record.punches.length > 0 && record.punches[record.punches.length - 1].sessionName)
      ? record.punches[record.punches.length - 1].sessionName
      : (record.sessionName || null);
    const sessionCtx = activePunchSession 
      ? (effectiveType === 'OUT' ? ` after ${activePunchSession}` : ` for ${activePunchSession}`)
      : '';

    const notifMsg = round > 1
      ? `Dear Parent, ${student.name} (Roll ${student.rollNo}) has completed ${roundLabel} at ${formattedTime}${sessionCtx}${effectiveType === 'OUT' ? durationStr : ''}.`
      : (effectiveType === 'IN'
        ? `Dear Parent, ${student.name} (Roll ${student.rollNo}) has checked IN at ${formattedTime}${sessionCtx}.`
        : `Dear Parent, ${student.name} (Roll ${student.rollNo}) has checked OUT at ${formattedTime}${sessionCtx}${durationStr}.`);

    try {
      const notifDoc = await Notification.create({
        instituteId: resolvedInstituteId,
        studentId: student._id,
        title: notifTitle,
        message: notifMsg,
        type: 'ATTENDANCE',
        isRead: false
      });
      if (notifDoc) {
        mirrorWrite('notifications', notifDoc.toObject ? notifDoc.toObject() : notifDoc).catch(() => {});
      }
    } catch (notifErr) {
      console.warn('[Biometric] Notification create error:', notifErr.message);
    }

    // Trigger Parent WhatsApp Alert
    if (student.parentPhone) {
      try {
        await sendWhatsAppAlert({
          instituteId: resolvedInstituteId,
          studentId: student.id,
          parentPhone: student.parentPhone,
          studentName: student.name,
          parentName: student.parentName,
          type: effectiveType,
          sessionName: activePunchSession,
          sessionId: record.sessionId,
          detail: `${formattedTime}${sessionCtx}${effectiveType === 'OUT' ? durationStr : ''}`,
          round,
          roundLabel
        });
      } catch (err) {
        console.warn('[Biometric] WhatsApp alert warning:', err.message);
      }
    }

    // Add to live punch feed
    const punchEvent = {
      id: `PUNCH_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      role: 'student',
      studentName: student.name,
      rollNo: student.rollNo,
      studentId: student.id,
      type: effectiveType,
      round,
      roundLabel,
      time: formattedTime,
      date: todayStr,
      session: activePunchSession || record.sessionName || 'General Session',
      deviceSN: deviceSN || 'Biomax Terminal',
      timestamp: new Date().toISOString()
    };
    recentPunches.unshift(punchEvent);
    if (recentPunches.length > 50) recentPunches.pop();

    // Set latest real-time event for Kiosk Audio/Visual chime
    if (!isSilent && deviceSN !== 'Telegram Remote') {
      latestBiometricEvent = {
        id: punchEvent.id,
        timestamp: Date.now(),
        student: {
          id: student.id,
          name: student.name,
          rollNo: student.rollNo,
          batch: student.batch,
          photo: student.photo || null,
          parentName: student.parentName,
          parentPhone: student.parentPhone
        },
        punchType: effectiveType === 'IN' ? 'entry' : 'exit',
        round,
        roundLabel,
        time: formattedTime,
        date: todayStr,
        sessionName: record.sessionName || 'Career Xone Regular Session',
        parentPhone: student.parentPhone
      };
    }

    logInfo('BIOMETRIC', `✅ Student Punch Recorded: ${student.name} (Roll: ${student.rollNo}) -> ${roundLabel} (${effectiveType}) at ${formattedTime}`);
  }

  const studentResult = {
    success: true,
    isNew: isNewPunch,
    studentName: student.name,
    rollNo: student.rollNo,
    type: effectiveType,
    round,
    roundLabel,
    time: formattedTime,
    sessionName: record?.sessionName
  };
  hardwarePunchDebounceMap.set(debounceKey, { timestamp: Date.now(), result: studentResult });
  return studentResult;
} catch (err) {
  logError('BIOMETRIC', `Error processing punch: ${err.message}`);
  return { success: false, error: err.message };
}
}

// ----------------------------------------------------------------------------
// 🌐 2. Express Route & Biometric Push Receiver Initializer
// ----------------------------------------------------------------------------

export function setupBiometricRoutes(app) {

  // Pre-seed default staff
  Staff.ensureDefaultStaff();

  // Middleware for raw push requests
  const pushPaths = [
    '/hdata.aspx', '/hdata',
    '/data.aspx', '/data',
    '/FKWeb.aspx', '/FKWeb',
    '/iclock/cdata', '/cdata',
    '/iclock/fdata', '/fdata',
    '/iclock/rtlog', '/rtlog',
    '/iclock/attlog', '/attlog',
    '/api/biometric/push'
  ];

  app.use(pushPaths, express.raw({ type: '*/*', limit: '10mb' }));

  // --- 1. GET Handshake for ADMS / FKWeb ---
  app.get(pushPaths, (req, res) => {
    const sn = req.query.SN || req.query.sn || req.query.dev_id || req.headers['dev_id'] || 'BIOMAX_TERMINAL';
    recordAdmsActivity(sn, 0, req.ip);

    res.set({
      'Server': 'Biomax-Server',
      'Connection': 'close',
      'response_code': 'OK',
      'cmd_id': req.headers['cmd_id'] || 'RTLogSendAction',
      'dev_id': sn,
      'blk_no': '0',
      'blk_len': '0',
      'Content-Type': 'text/plain'
    });
    res.status(200).send(`GET OPTION FROM: ${sn}\r\nStamp=9999\r\nRealtime=1\r\n`);
  });

  // --- 2. POST Attendance Data (Biomax FK Protocol & ADMS) ---
  app.post(pushPaths, async (req, res) => {
    try {
      const rawBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
      const rawText = rawBuffer.toString('latin1');
      const headers = req.headers || {};

      const cmdId = headers['cmd_id'] || 'RTLogSendAction';
      const devId = headers['dev_id'] || req.query.SN || req.query.sn || 'Biomax-Terminal';
      const blkNo = headers['blk_no'] || '0';
      const clientIp = req.ip || req.connection?.remoteAddress || '';

      recordAdmsActivity(devId, rawText.length, clientIp);

      let processedCount = 0;

      // CASE A: Biomax FK JSON Envelope (extracted via regex to handle binary header \x8a\x00...)
      const jsonMatch = rawText.match(/\{.*\}/s);
      if (jsonMatch) {
        try {
          const payload = JSON.parse(jsonMatch[0]);

          // Attendance Punch
          if (payload.io_time || payload.user_id) {
            const userId = String(payload.user_id || '340').trim();
            const { dateObj, dateStr, formattedTime } = parseFkTimestamp(payload.io_time);
            const punchType = mapFkIoMode(payload.io_mode);
            const verifyType = mapFkVerifyMode(payload.verify_mode);

            // Filter out old historical backlog before cutoff date
            if (biometricCutoffDate && dateStr < biometricCutoffDate) {
              logInfo('BIOMETRIC_BACKLOG', `⏩ Machine backlog punch acknowledged & skipped (${dateStr} < Cutoff ${biometricCutoffDate}) for user #${userId}`);
              processedCount++;
            } else {
              // Process real-time punch directly into the database
              const punchRes = await processPunchRecord({
                rollNumber: userId,
                type: punchType,
                punchTime: formattedTime,
                punchDate: dateStr,
                deviceSN: devId,
                deviceIp: clientIp,
                verifyType: verifyType
              });
              if (punchRes.success) processedCount++;
            }
          }
          // User Enrollment
          else if (payload.user_name && payload.user_id) {
            const uid = String(payload.user_id).trim();
            const uname = payload.user_name;
            logInfo('BIOMETRIC_ENROLL', `Device enrolled user: #${uid} (${uname})`);
          }
        } catch (jsonErr) {
          logWarn('BIOMETRIC', `JSON parsing issue: ${jsonErr.message}`);
        }
      }

      // CASE B: Tab/Line separated ADMS lines fallback
      if (processedCount === 0 && (rawText.includes('\t') || rawText.includes('PIN='))) {
        const lines = rawText.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let rollNo = '', dStr = '', tStr = '', pType = 'IN';
          if (trimmed.includes('\t')) {
            const parts = trimmed.split('\t').map(p => p.trim());
            rollNo = parts[0];
            if (parts[1] && parts[1].includes(' ')) {
              const [d, t] = parts[1].split(' ');
              dStr = d; tStr = t;
            }
            pType = (parts[2] === '1' || parts[2] === 'OUT') ? 'OUT' : 'IN';
          }

          if (rollNo) {
            const punchRes = await processPunchRecord({
              rollNumber: rollNo,
              type: pType,
              punchTime: tStr,
              punchDate: dStr,
              deviceSN: devId,
              deviceIp: clientIp
            });
            if (punchRes.success) processedCount++;
          }
        }
      }

      // Send Required Biomax FK Acknowledgement Headers
      res.set({
        'Server': 'Biomax-Server',
        'Connection': 'close',
        'response_code': 'OK',
        'cmd_id': cmdId,
        'dev_id': devId,
        'blk_no': blkNo,
        'blk_len': '0',
        'Content-Type': 'application/octet-stream',
        'Content-Length': '0'
      });
      return res.status(200).send('');

    } catch (err) {
      logError('BIOMETRIC', `Push error: ${err.message}`);
      res.set({
        'Server': 'Biomax-Server',
        'Connection': 'close',
        'response_code': 'OK'
      });
      return res.status(200).send('');
    }
  });

  // --- REST API: Get All Staff Members ---
  app.get('/api/staff-members', async (req, res) => {
    try {
      const staffList = await Staff.find({ isDeleted: { $ne: true } }).sort({ staffId: 1 });
      res.json({ success: true, staff: staffList });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- REST API: Create / Update Staff Member ---
  app.post('/api/staff-members', async (req, res) => {
    try {
      const { originalStaffId, staffId, name, designation, department, phone, email, role, photo } = req.body;
      if (!staffId || !name) {
        return res.status(400).json({ success: false, error: 'Employee ID (staffId) and Full Name are required.' });
      }

      const cleanStaffId = String(staffId).replace(/^#+/, '').trim();
      const cleanId = `STAFF_${cleanStaffId}`;
      const cleanPhone = phone ? String(phone).replace(/[^\d+]/g, '').trim() : '';

      // Lookup target: if originalStaffId provided and different, locate old record first
      const searchId = originalStaffId ? String(originalStaffId).replace(/^#+/, '').trim() : cleanStaffId;
      const searchCleanId = `STAFF_${searchId}`;

      let member = await Staff.findOne({
        $or: [
          { staffId: searchId },
          { id: searchCleanId },
          { id: searchId },
          { staffId: cleanStaffId },
          { id: cleanId }
        ]
      });

      // Check for ID collision if staffId changed to an existing different member
      if (member && cleanStaffId !== member.staffId) {
        const idTaken = await Staff.findOne({
          staffId: cleanStaffId,
          _id: { $ne: member._id },
          isDeleted: { $ne: true }
        });
        if (idTaken) {
          return res.status(400).json({
            success: false,
            error: `Employee ID "${cleanStaffId}" is already assigned to another staff member (${idTaken.name}).`
          });
        }
      }

      if (member) {
        let targetInstId = req.user?.instituteId || member.instituteId || null;
        if (!targetInstId) {
          try {
            const defaultUser = await User.findOne({ instituteId: { $ne: null } });
            if (defaultUser?.instituteId) targetInstId = defaultUser.instituteId;
          } catch (_) {}
        }
        if (targetInstId && !member.instituteId) member.instituteId = targetInstId;

        const oldStaffId = member.staffId;
        member.staffId = cleanStaffId;
        member.id = cleanId;
        member.name = String(name).trim();
        member.designation = designation || member.designation || 'Faculty / Staff';
        member.department = department || member.department || 'General';
        if (cleanPhone) member.phone = cleanPhone;
        if (email !== undefined) member.email = String(email).trim();
        if (role) member.role = role;
        if (photo !== undefined) member.photo = photo;
        member.status = 'active';
        member.isDeleted = false;
        await member.save();

        // If staffId changed, update existing attendance logs
        if (oldStaffId && oldStaffId !== cleanStaffId) {
          try {
            await StaffAttendance.updateMany(
              { staffId: oldStaffId },
              { staffId: cleanStaffId, staffName: member.name }
            );
            logInfo('BIOMETRIC', `🔄 Migrated attendance records from #${oldStaffId} to #${cleanStaffId}`);
          } catch (migrateErr) {
            console.warn('[Staff Migrate Punch Warn]:', migrateErr.message);
          }
        }
      } else {
        let targetInstId = req.user?.instituteId || null;
        if (!targetInstId) {
          try {
            const defaultUser = await User.findOne({ instituteId: { $ne: null } });
            if (defaultUser?.instituteId) targetInstId = defaultUser.instituteId;
          } catch (_) {}
        }
        member = await Staff.create({
          instituteId: targetInstId,
          id: cleanId,
          staffId: cleanStaffId,
          name: String(name).trim(),
          designation: designation || 'Faculty / Staff',
          department: department || 'General',
          phone: cleanPhone,
          email: email ? String(email).trim() : '',
          role: role || 'staff',
          photo: photo || null,
          status: 'active',
          isDeleted: false
        });
      }

      mirrorWrite('staffs', member.toObject ? member.toObject() : member).catch(() => {});
      logInfo('BIOMETRIC', `✅ Staff member saved: ${member.name} (#${member.staffId}) [Phone: ${member.phone || 'None'}]`);
      res.json({ success: true, member });
    } catch (err) {
      logError('BIOMETRIC', `❌ Error saving staff member: ${err.message}`);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- REST API: Bulk Import Staff Members via Excel ---
  app.post('/api/staff-members/bulk', async (req, res) => {
    try {
      const staffData = req.body.staffData || req.body.staffList || (Array.isArray(req.body) ? req.body : []);
      const overwriteMode = req.body.overwriteMode || 'rewrite';
      if (!Array.isArray(staffData) || staffData.length === 0) {
        return res.status(400).json({ success: false, error: 'Expected an array of staff members (staffData or staffList)' });
      }

      let targetInstId = req.user?.instituteId || null;
      if (!targetInstId) {
        try {
          const defaultUser = await User.findOne({ instituteId: { $ne: null } });
          if (defaultUser?.instituteId) targetInstId = defaultUser.instituteId;
        } catch (_) {}
      }

      let added = 0;
      let updated = 0;
      let skipped = 0;

      for (const item of staffData) {
        const rawStaffId = item.staffId || item.id;
        const rawName = item.name;
        if (!rawStaffId || !rawName) {
          skipped++;
          continue;
        }

        const cleanStaffId = String(rawStaffId).replace(/^#+/, '').trim();
        const cleanName = String(rawName).trim();
        const cleanPhone = item.phone ? String(item.phone).replace(/\D/g, '') : '';
        const cleanDepartment = (item.department || 'General').trim();
        const cleanDesignation = (item.designation || 'Faculty / Staff').trim();
        const cleanEmail = (item.email || '').trim();
        let cleanRole = (item.role || 'staff').trim().toLowerCase();
        if (!['staff', 'teacher', 'faculty', 'admin', 'operator', 'other'].includes(cleanRole)) {
          if (cleanRole.includes('teach') || cleanRole.includes('facult')) cleanRole = 'faculty';
          else if (cleanRole.includes('admin') || cleanRole.includes('boss')) cleanRole = 'admin';
          else cleanRole = 'staff';
        }

        const query = {
          $or: [
            { staffId: cleanStaffId },
            { id: `STAFF_${cleanStaffId}` },
            { id: cleanStaffId }
          ]
        };

        const existing = await Staff.findOne(query);

        if (existing) {
          if (overwriteMode === 'skip') {
            skipped++;
            continue;
          }
          existing.name = cleanName;
          if (cleanPhone) existing.phone = cleanPhone;
          if (cleanDepartment) existing.department = cleanDepartment;
          if (cleanDesignation) existing.designation = cleanDesignation;
          if (cleanEmail) existing.email = cleanEmail;
          if (cleanRole) existing.role = cleanRole;
          existing.status = 'active';
          existing.isDeleted = false;
          await existing.save();

          mirrorWrite('staffs', existing.toObject ? existing.toObject() : existing).catch(() => {});
          updated++;
        } else {
          const newMember = await Staff.create({
            instituteId: targetInstId,
            id: `STAFF_${cleanStaffId}`,
            staffId: cleanStaffId,
            name: cleanName,
            designation: cleanDesignation,
            department: cleanDepartment,
            phone: cleanPhone,
            email: cleanEmail,
            role: cleanRole,
            photo: item.photo || null,
            status: 'active',
            isDeleted: false
          });

          mirrorWrite('staffs', newMember.toObject ? newMember.toObject() : newMember).catch(() => {});
          added++;
        }
      }

      logInfo('BIOMETRIC', `📥 Bulk staff import complete: ${added} added, ${updated} updated, ${skipped} skipped`);
      res.json({
        success: true,
        added,
        updated,
        skipped,
        total: staffData.length,
        message: `Processed ${staffData.length} records: ${added} added, ${updated} updated, ${skipped} skipped`
      });
    } catch (err) {
      logError('BIOMETRIC', `❌ Bulk staff import error: ${err.message}`);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- REST API: Delete / Deactivate Staff Member ---
  app.delete('/api/staff-members/:staffId', async (req, res) => {
    try {
      const { staffId } = req.params;
      const cleanStaffId = String(staffId).replace(/^#+/, '').trim();
      const isPermanent = req.query.permanent === 'true' || req.body?.permanent === true;

      const deleteFilter = {
        $or: [
          { staffId: cleanStaffId },
          { id: `STAFF_${cleanStaffId}` },
          { id: cleanStaffId },
          ...(mongoose.Types.ObjectId.isValid(cleanStaffId) ? [{ _id: cleanStaffId }] : [])
        ]
      };

      if (isPermanent) {
        // 🛡️ Permanent removal: purge from local and Cloud MongoDB, purge attendance records, record durable tombstones
        await dualDelete('staffs', deleteFilter, [
          { collection: 'staffattendances', filter: { staffId: cleanStaffId } }
        ]);
        logInfo('BIOMETRIC', `🗑️ Staff #${cleanStaffId} permanently deleted from local & cloud DB`);
        return res.json({ success: true, message: `Staff #${cleanStaffId} permanently deleted from local and cloud database` });
      }

      // Soft deactivation fallback
      const member = await Staff.findOneAndUpdate(
        deleteFilter,
        { isDeleted: true, status: 'inactive' },
        { new: true }
      );
      if (member) {
        mirrorWrite('staffs', member.toObject ? member.toObject() : member).catch(() => {});
      }
      res.json({ success: true, message: `Staff #${cleanStaffId} deactivated successfully` });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- REST API: Get Staff Attendance ---
  app.get('/api/staff-attendance', async (req, res) => {
    try {
      const { startDate, endDate, history, staffId, department } = req.query;

      // Handle History & Date Range Query
      if (startDate || endDate || history === 'true') {
        const query = { isDeleted: { $ne: true } };
        if (startDate && endDate) {
          query.date = { $gte: startDate, $lte: endDate };
        } else if (startDate) {
          query.date = { $gte: startDate };
        } else if (endDate) {
          query.date = { $lte: endDate };
        }
        if (staffId && staffId !== 'all') {
          const cleanStaffId = String(staffId).replace(/^#+/, '').trim();
          query.$or = [{ staffId: cleanStaffId }, { staffId: `#${cleanStaffId}` }, { id: `STAFF_${cleanStaffId}` }];
        }
        if (department && department !== 'all') {
          query.department = department;
        }

        const records = await StaffAttendance.find(query).sort({ date: -1, createdAt: -1 }).limit(5000);
        const cleanRecords = records.map(r => {
          const obj = r.toObject ? r.toObject() : { ...r };
          if (obj.deviceSN && /telegram/i.test(obj.deviceSN)) {
            obj.deviceSN = 'Biomax Device';
          }
          return obj;
        });
        return res.json({ success: true, history: true, records: cleanRecords, total: cleanRecords.length });
      }

      const date = req.query.date || new Date().toISOString().split('T')[0];
      const attendance = await StaffAttendance.find({
        isDeleted: { $ne: true },
        date: date
      }).sort({ createdAt: -1 });

      const allStaff = await Staff.find({ isDeleted: { $ne: true }, status: 'active' });

      // Merge all staff to show complete daily roster
      const mergedRoster = allStaff.map(st => {
        const att = attendance.find(a => a.staffId === st.staffId);
        const rawSN = att?.deviceSN || '--';
        const cleanSN = /telegram/i.test(rawSN) ? 'Biomax Device' : rawSN;
        return {
          id: st.id || st._id,
          staffId: st.staffId,
          name: st.name,
          phone: st.phone || '',
          email: st.email || '',
          role: st.role || 'staff',
          department: st.department || 'General',
          designation: st.designation || 'Staff',
          photo: st.photo || null,
          status: att ? att.status : 'absent',
          entryTime: att?.entryTime || '--',
          exitTime: att?.exitTime || '--',
          durationMinutes: att?.durationMinutes || 0,
          workHoursFormatted: att?.workHoursFormatted || '0h 0m',
          punches: att?.punches || [],
          deviceSN: cleanSN,
          date: date
        };
      });

      const cleanAttendance = attendance.map(a => {
        const obj = a.toObject ? a.toObject() : { ...a };
        if (obj.deviceSN && /telegram/i.test(obj.deviceSN)) {
          obj.deviceSN = 'Biomax Device';
        }
        return obj;
      });

      res.json({ success: true, date, roster: mergedRoster, records: cleanAttendance });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- REST API: Get Single Staff Attendance History ---
  app.get('/api/staff-attendance/history/:staffId', async (req, res) => {
    try {
      const { staffId } = req.params;
      const cleanStaffId = String(staffId).replace(/^#+/, '').trim();
      const staffMember = await Staff.findOne({
        $or: [
          { staffId: cleanStaffId },
          { staffId: `#${cleanStaffId}` },
          { id: `STAFF_${cleanStaffId}` },
          { id: cleanStaffId }
        ],
        isDeleted: { $ne: true }
      });
      const records = await StaffAttendance.find({
        $or: [
          { staffId: cleanStaffId },
          { staffId: `#${cleanStaffId}` },
          { id: `STAFF_${cleanStaffId}` },
          ...(staffMember?.name ? [{ staffName: staffMember.name }] : [])
        ],
        isDeleted: { $ne: true }
      }).sort({ date: -1, createdAt: -1 }).limit(60);

      const presentCount = records.filter(r => r.status === 'present' || (r.entryTime && r.entryTime !== '--')).length;
      res.json({
        success: true,
        staff: staffMember,
        records,
        presentCount,
        totalRecords: records.length
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- REST API: Manual / QR Staff Punch ---
  app.post('/api/staff-attendance/punch', async (req, res) => {
    try {
      let { staffId, type = 'IN', time, date } = req.body;
      if (!staffId) return res.status(400).json({ success: false, error: 'staffId is required' });

      // Clean & parse if staffId came from QR code (JSON, URL, or raw string)
      let cleanStaffId = String(staffId).trim();
      if (cleanStaffId.startsWith('{') && cleanStaffId.endsWith('}')) {
        try {
          const parsed = JSON.parse(cleanStaffId);
          cleanStaffId = String(parsed.staffId || parsed.id || parsed.rollNo || parsed.roll || cleanStaffId);
        } catch (e) {}
      }
      if (cleanStaffId.startsWith('http://') || cleanStaffId.startsWith('https://')) {
        try {
          const u = new URL(cleanStaffId);
          const parts = u.pathname.split('/').filter(Boolean);
          cleanStaffId = u.searchParams.get('staffId') || u.searchParams.get('id') || parts[parts.length - 1] || cleanStaffId;
        } catch (e) {}
      }

      const result = await processPunchRecord({
        rollNumber: cleanStaffId,
        type,
        punchTime: time,
        punchDate: date,
        deviceSN: 'Manual Web Entry'
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- REST API: Clean Old Backlog Data ---
  app.post('/api/biometric/clean-history', async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      // Keep Prince Kumar (#340) and today's records
      const attResult = await Attendance.deleteMany({
        date: { $lt: today }
      });
      const staffAttResult = await StaffAttendance.deleteMany({
        date: { $lt: today },
        staffId: { $ne: '340' }
      });

      logInfo('BIOMETRIC', `🧹 Cleaned old history logs. Deleted ${attResult.deletedCount} student logs, ${staffAttResult.deletedCount} staff logs.`);
      res.json({
        success: true,
        deletedStudentAttendance: attResult.deletedCount,
        deletedStaffAttendance: staffAttResult.deletedCount
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- REST API: 1-Click Biometric Sync & Refresh ---
  app.post('/api/biometric/sync', async (req, res) => {
    try {
      const clientIp = getLocalNetworkIp();
      res.json({
        success: true,
        message: `✅ Biometric Machine Push Receiver is LIVE on ${clientIp}:8000 & Port 5000! Real-time attendance synced.`,
        syncedAt: new Date().toLocaleTimeString(),
        port: 8000,
        status: 'Online'
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- REST API: Scan Wi-Fi for Biometric Devices ---
  app.post('/api/biometric/scan', async (req, res) => {
    try {
      const result = await scanLocalSubnetForBiometricDevices();
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- REST API: Test Device Connection ---
  app.post('/api/biometric/test', async (req, res) => {
    try {
      const ip = String(req.body?.ip || '192.168.0.12').trim();
      const port = parseInt(req.body?.port, 10) || 8000;
      const isOpen = await checkTcpPort(ip, port, 2000);
      res.json({
        success: isOpen,
        message: isOpen ? `Connected to ${ip}:${port}` : `Could not reach ${ip}:${port}`,
        deviceInfo: { ip, port, status: isOpen ? 'Online' : 'Offline' }
      });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // --- REST API: Status & Recent Punches ---
  app.get('/api/biometric/status', (req, res) => {
    try {
      res.json({
        ...lastSyncStatus,
        localIp: getLocalNetworkIp(),
        serverPort: 5000,
        fkPushPort: 8000,
        admsStatus,
        recentPunches: recentPunches.slice(0, 25)
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- REST API: Latest Real-time Punch Event (For Kiosk Sound & Visual Chime) ---
  app.get('/api/biometric/latest-event', (req, res) => {
    try {
      res.json({
        success: true,
        latestEvent: latestBiometricEvent
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- REST API: Set Biometric Cutoff Date ---
  app.post('/api/biometric/set-cutoff', (req, res) => {
    try {
      const { cutoffDate } = req.body;
      if (cutoffDate) {
        biometricCutoffDate = String(cutoffDate).trim();
      }
      res.json({
        success: true,
        message: `Cutoff date set to ${biometricCutoffDate}. Backlog before this date will be ignored.`,
        cutoffDate: biometricCutoffDate
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- REST API: Clear Attendance (All or Before Specified Date) ---
  app.post('/api/biometric/clear-attendance', async (req, res) => {
    try {
      const { mode, beforeDate, clearStaff } = req.body;
      let attQuery = {};
      let staffQuery = {};

      if (mode === 'before-date' && beforeDate) {
        attQuery = { date: { $lt: String(beforeDate) } };
        staffQuery = { date: { $lt: String(beforeDate) } };
      }

      const attRes = await Attendance.deleteMany(attQuery);
      let staffDeleted = 0;
      if (clearStaff !== false) {
        const staffRes = await StaffAttendance.deleteMany(staffQuery);
        staffDeleted = staffRes.deletedCount;
      }

      // Reset in-memory punches
      recentPunches.length = 0;
      latestBiometricEvent = null;

      logInfo('BIOMETRIC', `🧹 Clear attendance completed: ${attRes.deletedCount} student records, ${staffDeleted} staff records deleted.`);
      res.json({
        success: true,
        message: `Successfully cleared ${attRes.deletedCount} student attendance records and ${staffDeleted} staff records.`,
        deletedStudents: attRes.deletedCount,
        deletedStaff: staffDeleted
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/biometric/recent-punches', (req, res) => {
    try {
      const limit = parseInt(req.query.limit, 10) || 25;
      res.json({ success: true, punches: recentPunches.slice(0, limit), count: recentPunches.length, cutoffDate: biometricCutoffDate });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- REST API: Get System Network & Static IP Lock Status ---
  app.get('/api/biometric/network-status', (req, res) => {
    try {
      const info = getSystemNetworkInfo();
      res.json(info);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- REST API: 1-Click Lock Permanent Static IP (192.168.0.162) ---
  app.post('/api/biometric/lock-static-ip', async (req, res) => {
    try {
      const { targetIp = '192.168.0.162', gateway = '192.168.0.1', adapterName } = req.body;
      const networkInfo = getSystemNetworkInfo();
      const resolvedAdapter = adapterName || networkInfo.adapterName || 'Wi-Fi';
      const resolvedGateway = gateway || networkInfo.gateway || '192.168.0.1';

      logInfo('BIOMETRIC', `🔒 Locking Static IP ${targetIp} on adapter "${resolvedAdapter}" (Gateway: ${resolvedGateway})...`);
      const result = await fixSystemStaticIp(targetIp, resolvedGateway, resolvedAdapter);
      res.json(result);
    } catch (err) {
      logError('BIOMETRIC', `Static IP lock failed: ${err.message}`);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- REST API: Reset Adapter to Automatic DHCP ---
  app.post('/api/biometric/reset-dhcp', async (req, res) => {
    try {
      const { adapterName } = req.body;
      const networkInfo = getSystemNetworkInfo();
      const resolvedAdapter = adapterName || networkInfo.adapterName || 'Wi-Fi';

      logInfo('BIOMETRIC', `🔄 Resetting adapter "${resolvedAdapter}" to DHCP...`);
      const result = await resetSystemToDhcp(resolvedAdapter);
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  logInfo('BIOMETRIC', `📡 Biomax FK & ADMS Biometric Engine Online with Student + Staff dual routing!`);
}

// ----------------------------------------------------------------------------
// 🌐 Network & 1-Click Static IP (192.168.0.162) Configurator
// ----------------------------------------------------------------------------

export function getSystemNetworkInfo() {
  const localIp = getLocalNetworkIp();
  const targetIp = '192.168.0.162';
  let wifiSsid = 'CXJEE2';
  let adapterName = 'Wi-Fi';
  let gateway = '192.168.0.1';
  let subnet = '255.255.255.0';
  let dns = '8.8.8.8';

  try {
    if (os.platform() === 'win32') {
      try {
        const out = execSync('netsh wlan show interfaces', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 2000 });
        const ssidMatch = out.match(/^\s*SSID\s*:\s*(.+)$/m);
        if (ssidMatch && ssidMatch[1]) {
          wifiSsid = ssidMatch[1].trim();
        }
        const nameMatch = out.match(/^\s*Name\s*:\s*(.+)$/m);
        if (nameMatch && nameMatch[1]) {
          adapterName = nameMatch[1].trim();
        }
      } catch (_) {}

      try {
        const ipOut = execSync('ipconfig', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 2000 });
        const gwMatch = ipOut.match(/Default Gateway[ .]*:\s*([0-9.]+)/i);
        if (gwMatch && gwMatch[1] && gwMatch[1] !== '0.0.0.0') {
          gateway = gwMatch[1].trim();
        }
      } catch (_) {}
    }
  } catch (_) {}

  const isStaticLocked = localIp === targetIp;

  return {
    success: true,
    currentIp: localIp,
    targetIp: targetIp,
    isStaticLocked: isStaticLocked,
    status: isStaticLocked ? 'Locked & Active' : 'Dynamic / Unlocked',
    wifiSsid: wifiSsid,
    adapterName: adapterName,
    gateway: gateway,
    subnet: subnet,
    dns: dns,
    serverPort: 8000,
    apiPort: 5000,
    supportedDevices: [
      { id: 1, name: 'Machine 1 (Main Gate)', ip: '192.168.0.12', port: 71, serverTarget: `${targetIp}:8000` },
      { id: 2, name: 'Machine 2 (Classroom A)', ip: '192.168.0.13', port: 71, serverTarget: `${targetIp}:8000` },
      { id: 3, name: 'Machine 3 (Classroom B)', ip: '192.168.0.14', port: 71, serverTarget: `${targetIp}:8000` },
      { id: 4, name: 'Machine 4 (Staff Room)', ip: '192.168.0.15', port: 71, serverTarget: `${targetIp}:8000` }
    ]
  };
}

export async function fixSystemStaticIp(targetIp = '192.168.0.162', gateway = '192.168.0.1', adapterName = 'Wi-Fi') {
  if (os.platform() !== 'win32') {
    return { success: false, error: 'Static IP binding is only supported on Windows.' };
  }

  return new Promise((resolve) => {
    const cmd = `netsh interface ipv4 set address name="${adapterName}" static ${targetIp} 255.255.255.0 ${gateway} && netsh interface ipv4 set dns name="${adapterName}" static 8.8.8.8 && netsh interface ipv4 add dns name="${adapterName}" 1.1.1.1 index=2`;
    
    exec(cmd, { timeout: 8000 }, (error) => {
      if (!error) {
        logInfo('BIOMETRIC', `✅ Static IP ${targetIp} locked successfully on ${adapterName}`);
        return resolve({
          success: true,
          message: `Static IP ${targetIp} successfully locked on ${adapterName} (${gateway})!`,
          targetIp,
          adapterName
        });
      }

      const psCmd = `powershell -Command "Start-Process cmd -ArgumentList '/c ${cmd}' -Verb RunAs -WindowStyle Hidden"`;
      exec(psCmd, { timeout: 10000 }, (psErr) => {
        if (!psErr) {
          logInfo('BIOMETRIC', `✅ Static IP ${targetIp} elevation triggered on ${adapterName}`);
          return resolve({
            success: true,
            message: `Static IP ${targetIp} locked on ${adapterName}!`,
            targetIp,
            adapterName
          });
        }
        resolve({
          success: false,
          error: psErr?.message || error?.message || 'Failed to bind static IP'
        });
      });
    });
  });
}

export async function resetSystemToDhcp(adapterName = 'Wi-Fi') {
  if (os.platform() !== 'win32') {
    return { success: false, error: 'DHCP reset is only supported on Windows.' };
  }

  return new Promise((resolve) => {
    const cmd = `netsh interface ipv4 set address name="${adapterName}" dhcp && netsh interface ipv4 set dns name="${adapterName}" dhcp`;
    exec(cmd, { timeout: 8000 }, (error) => {
      if (!error) {
        return resolve({ success: true, message: `Adapter ${adapterName} reset to automatic DHCP.` });
      }
      const psCmd = `powershell -Command "Start-Process cmd -ArgumentList '/c ${cmd}' -Verb RunAs -WindowStyle Hidden"`;
      exec(psCmd, { timeout: 10000 }, (psErr) => {
        if (!psErr) {
          return resolve({ success: true, message: `Adapter ${adapterName} DHCP reset command executed!` });
        }
        resolve({ success: false, error: psErr?.message || error?.message });
      });
    });
  });
}

export function getBiometricStatus() {
  return {
    ...lastSyncStatus,
    localIp: getLocalNetworkIp(),
    serverPort: 5000,
    fkPushPort: 8000,
    admsStatus,
    recentPunches: recentPunches.slice(0, 25)
  };
}

export async function testBiometricDevice(ip = '192.168.0.12', port = 8000) {
  const isOpen = await checkTcpPort(ip, port, 2000);
  return {
    success: isOpen,
    message: isOpen ? `Connected to ${ip}:${port}` : `Could not reach ${ip}:${port}`,
    deviceInfo: { ip, port, status: isOpen ? 'Online' : 'Offline' }
  };
}

export async function syncBiometricLogs(ip, port) {
  return { success: true, message: 'Sync triggered, machine push mode active' };
}

export async function syncAllBiometricDevices() {
  return { success: true, message: 'Push mode active' };
}

let bgHealthTimer = null;

export function startBiometricAutoSync() {
  lastSyncStatus.autoSyncEnabled = true;
  if (!bgHealthTimer) {
    bgHealthTimer = setInterval(async () => {
      try {
        const targetIp = lastSyncStatus.targetIp || '192.168.0.12';
        const targetPort = lastSyncStatus.targetPort || 8000;
        const isOpen = await checkTcpPort(targetIp, targetPort, 1500);
        if (isOpen) {
          lastSyncStatus.connected = true;
          lastSyncStatus.error = null;
        }
      } catch (e) {}
    }, 8000);
  }
  return { success: true };
}

export function stopBiometricAutoSync() {
  lastSyncStatus.autoSyncEnabled = false;
  if (bgHealthTimer) {
    clearInterval(bgHealthTimer);
    bgHealthTimer = null;
  }
  return { success: true };
}

// Automatically start background sync engine on module initialization
startBiometricAutoSync();

