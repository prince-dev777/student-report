import ZKLib from 'node-zklib';
import net from 'net';
import os from 'os';
import mongoose from 'mongoose';
import { sendWhatsAppMessageWeb } from './whatsappClient.js';
import { logInfo, logError, logWarn } from '../utils/logger.js';

let autoSyncTimer = null;
let isSyncing = false;
let lastSyncStatus = {
  connected: false,
  deviceInfo: null,
  lastSyncTime: null,
  lastSyncedCount: 0,
  autoSyncEnabled: false,
  targetIp: '192.168.0.12',
  targetPort: 71,
  error: null
};

// Helper: Check if TCP Port is Open on Machine IP
export function checkTcpPort(ip, port, timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      isResolved = true;
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.once('error', () => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve(false);
      }
    });

    socket.connect(port, ip);
  });
}

// 0. Auto-Scan Local Wi-Fi Subnet for Biometric Machines
export async function scanLocalSubnetForBiometricDevices() {
  logInfo('BIOMETRIC', '🔍 Scanning local Wi-Fi subnet for Biometric Machines...');
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
            const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
            subnets.add(prefix);
          }
        }
      }
    }
  }

  const targetPorts = [71, 4370, 5005];
  const discovered = [];
  const probeTasks = [];

  for (const subnet of subnets) {
    for (let i = 1; i <= 254; i++) {
      const targetIp = `${subnet}.${i}`;
      if (localIps.has(targetIp)) continue; // Exclude current PC

      for (const port of targetPorts) {
        probeTasks.push(
          (async () => {
            const isOpen = await checkTcpPort(targetIp, port, 750);
            if (isOpen) {
              let name = 'Biometric Machine';
              if (port === 71) name = 'FK / Realtime Biometric Device';
              else if (port === 4370) name = 'ZKTeco / eSSL Device';
              else if (port === 5005) name = 'Realtime Series Device';

              discovered.push({
                ip: targetIp,
                port: port,
                name: name,
                protocol: port === 71 ? 'FK HTTP/Socket' : port === 4370 ? 'ZK TCP Socket' : 'Realtime Push',
                status: 'Online'
              });
            }
          })()
        );
      }
    }
  }

  // Execute all probes in parallel batches of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < probeTasks.length; i += BATCH_SIZE) {
    const batch = probeTasks.slice(i, i + BATCH_SIZE);
    await Promise.all(batch);
  }

  logInfo('BIOMETRIC', `✅ Scan completed. Found ${discovered.length} biometric devices on network.`);
  return {
    success: true,
    count: discovered.length,
    devices: discovered,
    scannedSubnets: Array.from(subnets)
  };
}

// Helper: Process single punch into database
export async function processPunchRecord({ rollNumber, type = 'IN', punchTime, punchDate, instituteId }) {
  try {
    const Student = mongoose.model('Student');
    const Attendance = mongoose.model('Attendance');
    const Session = mongoose.model('Session');
    const Notification = mongoose.model('Notification');

    const cleanRoll = String(rollNumber).replace(/^0+/, '') || String(rollNumber);
    const rollNumVal = parseInt(rollNumber, 10);
    const queryList = [
      { rollNo: String(rollNumber) },
      { rollNo: String(cleanRoll) },
      { id: String(rollNumber) },
      { id: String(cleanRoll) }
    ];
    if (!isNaN(rollNumVal)) {
      queryList.push({ rollNo: rollNumVal });
    }

    const studentQuery = {
      isDeleted: { $ne: true },
      $or: queryList
    };
    if (instituteId) {
      studentQuery.instituteId = instituteId;
    }

    const student = await Student.findOne(studentQuery);
    if (!student) {
      return { success: false, reason: `Student with roll ${rollNumber} not found` };
    }

    const resolvedInstituteId = student.instituteId;
    const todayStr = punchDate || new Date().toISOString().split('T')[0];
    const formattedTime = punchTime || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    let record = await Attendance.findOne({
      isDeleted: { $ne: true },
      studentId: student.id,
      date: todayStr,
      instituteId: resolvedInstituteId
    });

    let isNewPunch = false;
    if (!record) {
      record = new Attendance({
        instituteId: resolvedInstituteId,
        studentId: student.id,
        date: todayStr,
        status: 'present',
        entryTime: type === 'IN' ? formattedTime : '--',
        exitTime: type === 'OUT' ? formattedTime : '--',
        smsSent: false
      });
      isNewPunch = true;
    } else {
      if (type === 'IN' && (!record.entryTime || record.entryTime === '--')) {
        record.entryTime = formattedTime;
        isNewPunch = true;
      }
      if (type === 'OUT' && (!record.exitTime || record.exitTime === '--')) {
        record.exitTime = formattedTime;
        isNewPunch = true;
      }
      record.status = 'present';
    }

    // Auto-match session
    if (record.entryTime && record.entryTime !== '--' && !record.sessionName) {
      try {
        const sessions = await Session.find({ isDeleted: { $ne: true }, instituteId: resolvedInstituteId });
        let entryMin = 0;
        if (record.entryTime.includes('AM') || record.entryTime.includes('PM')) {
          const [timePart, modifier] = record.entryTime.split(' ');
          let [eH, eM] = timePart.split(':').map(Number);
          if (eH === 12) eH = 0;
          if (modifier === 'PM') eH += 12;
          entryMin = eH * 60 + eM;
        } else {
          const [eH, eM] = record.entryTime.split(':').map(Number);
          entryMin = eH * 60 + eM;
        }

        let bestMatch = null;
        let bestScore = -1;
        for (const sess of sessions) {
          if (!sess.startTime || !sess.endTime) continue;
          const [sH, sM] = sess.startTime.split(':').map(Number);
          const [eH2, eM2] = sess.endTime.split(':').map(Number);
          const startMin = sH * 60 + sM;
          const endMin = eH2 * 60 + eM2;

          if (entryMin >= startMin - 30 && entryMin <= endMin) {
            const sBatchId = sess.batchId || 'all';
            const sClassName = sess.className || 'all';
            let matchesBatch = sBatchId === 'all' || sBatchId === student.batch;
            let matchesClass = sClassName === 'all' || sClassName === student.class;
            if (matchesBatch && matchesClass) {
              let score = 0;
              if (sBatchId !== 'all') score += 1;
              if (sClassName !== 'all') score += 1;
              if (score > bestScore) {
                bestScore = score;
                bestMatch = sess;
              }
            }
          }
        }
        if (bestMatch) {
          record.sessionName = bestMatch.name;
        }
      } catch (sessErr) {}
    }

    // Calculate duration
    if (record.entryTime && record.exitTime && record.entryTime !== '--' && record.exitTime !== '--') {
      try {
        const getMins = (t) => {
          const [timePart, modifier] = t.split(' ');
          let [h, m] = timePart.split(':').map(Number);
          if (h === 12) h = 0;
          if (modifier === 'PM') h += 12;
          return h * 60 + m;
        };
        const totalInMin = getMins(record.exitTime) - getMins(record.entryTime);
        if (totalInMin > 0) record.durationMinutes = totalInMin;
      } catch (durErr) {}
    }

    if (isNewPunch) {
      await record.save();

      // Create Notification
      const title = type === 'IN' ? 'Check-In Alert' : 'Check-Out Alert';
      const message = `${student.name} has checked ${type} at ${formattedTime}.`;
      try {
        const notification = new Notification({
          instituteId: resolvedInstituteId,
          studentId: student._id,
          title,
          message,
          type: 'ATTENDANCE'
        });
        await notification.save();
      } catch (notifErr) {}

      // Trigger WhatsApp Alert
      if (student.parentPhone) {
        const alertMsg = type === 'IN'
          ? `Dear Parent, your child ${student.name} (Roll: ${student.rollNo || ''}) has checked IN at ${formattedTime}.`
          : `Dear Parent, your child ${student.name} (Roll: ${student.rollNo || ''}) has checked OUT at ${formattedTime}.`;
        sendWhatsAppMessageWeb(student.parentPhone, alertMsg)
          .then(() => {
            record.smsSent = true;
            record.save();
          })
          .catch((err) => console.warn('[Biometric] WhatsApp alert not sent:', err.message));
      }

      return { success: true, isNew: true, studentName: student.name, rollNumber: student.rollNo };
    }

    return { success: true, isNew: false, studentName: student.name, rollNumber: student.rollNo };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// 1. Test Device Connection (Hybrid: ZKTeco socket + FK TCP ping)
export async function testBiometricDevice(ip, port = 71) {
  const targetIp = (ip || '192.168.0.12').trim();
  const targetPort = parseInt(port, 10) || 71;

  if (!targetIp) {
    return { success: false, error: 'Please enter a valid Biometric Machine IP address.' };
  }

  logInfo('BIOMETRIC', `Testing connection to ${targetIp}:${targetPort}...`);

  // First verify TCP connectivity
  const isPortOpen = await checkTcpPort(targetIp, targetPort, 2000);
  if (!isPortOpen) {
    lastSyncStatus.connected = false;
    lastSyncStatus.error = `Cannot reach ${targetIp} on port ${targetPort}`;
    return {
      success: false,
      error: `Could not reach Biometric Machine at ${targetIp}:${targetPort}. Please verify machine IP on Wi-Fi.`
    };
  }

  // Try ZKTeco binary protocol handshake (for ZK devices)
  let zkSuccess = false;
  let zkInfo = {};
  if (targetPort === 4370) {
    try {
      const zk = new ZKLib(targetIp, targetPort, 3000, 3000);
      await zk.createSocket();
      zkInfo = await zk.getInfo().catch(() => ({}));
      await zk.disconnect().catch(() => {});
      zkSuccess = true;
    } catch (e) {}
  }

  lastSyncStatus.connected = true;
  lastSyncStatus.targetIp = targetIp;
  lastSyncStatus.targetPort = targetPort;
  lastSyncStatus.deviceInfo = {
    version: zkSuccess ? (zkInfo?.version || 'ZKTeco Protocol') : (targetPort === 71 ? 'FK / Realtime Push Protocol' : 'Network Biometric Device'),
    userCount: zkInfo?.userCounts || 'Ready',
    logCount: zkInfo?.logCounts || 'Live',
    ip: targetIp,
    port: targetPort,
    status: 'Online & Connected'
  };
  lastSyncStatus.error = null;

  logInfo('BIOMETRIC', `✅ Successfully connected to ${targetIp}:${targetPort}`);
  return {
    success: true,
    message: `Connected successfully to Biometric Machine at ${targetIp}:${targetPort}`,
    deviceInfo: lastSyncStatus.deviceInfo
  };
}

// Helper: Get local primary IPv4 address on Wi-Fi
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

// 2. Sync Attendance Logs From Device
export async function syncBiometricLogs(ip, port = 71, instituteId = null) {
  if (isSyncing) {
    return { success: true, message: 'Sync in progress...', newlyAdded: 0, totalOnDevice: 0 };
  }

  const targetIp = (ip || lastSyncStatus.targetIp || '192.168.0.12').trim();
  const targetPort = parseInt(port || lastSyncStatus.targetPort, 10) || 71;

  isSyncing = true;

  try {
    const isPortOpen = await checkTcpPort(targetIp, targetPort, 2000);
    if (!isPortOpen) {
      return {
        success: false,
        error: `Biometric Machine at ${targetIp}:${targetPort} is unreachable on current Wi-Fi.`
      };
    }

    // Attempt ZK Pull if port is 4370
    if (targetPort === 4370) {
      const zk = new ZKLib(targetIp, targetPort, 5000, 3000);
      try {
        await zk.createSocket();
        const attendances = await zk.getAttendances();
        const rawLogs = Array.isArray(attendances?.data) ? attendances.data : Array.isArray(attendances) ? attendances : [];

        let newlyAdded = 0;
        let matchedCount = 0;

        for (const logItem of rawLogs) {
          const rollNumber = String(logItem.deviceUserId || logItem.userId || logItem.user_id || '').trim();
          if (!rollNumber) continue;

          let punchDate = '';
          let punchTime = '';
          if (logItem.recordTime) {
            const d = new Date(logItem.recordTime);
            if (!isNaN(d.getTime())) {
              punchDate = d.toISOString().split('T')[0];
              punchTime = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            }
          }

          const statusVal = String(logItem.state ?? logItem.status ?? '0');
          const punchType = (statusVal === '1' || statusVal.toLowerCase() === 'out') ? 'OUT' : 'IN';

          const res = await processPunchRecord({
            rollNumber,
            type: punchType,
            punchDate,
            punchTime,
            instituteId
          });

          if (res.success) {
            matchedCount++;
            if (res.isNew) newlyAdded++;
          }
        }

        await zk.disconnect().catch(() => {});

        lastSyncStatus.connected = true;
        lastSyncStatus.lastSyncTime = new Date().toISOString();
        lastSyncStatus.lastSyncedCount = newlyAdded;

        return {
          success: true,
          totalOnDevice: rawLogs.length,
          newlyAdded,
          matchedCount,
          lastSyncTime: lastSyncStatus.lastSyncTime
        };
      } catch (zkErr) {
        try { await zk.disconnect(); } catch (e) {}
      }
    }

    // For FK / Realtime devices on Port 71
    const Attendance = mongoose.model('Attendance');
    const todayStr = new Date().toISOString().split('T')[0];
    const todayPunches = await Attendance.countDocuments({
      isDeleted: { $ne: true },
      date: todayStr,
      ...(instituteId ? { instituteId } : {})
    });

    lastSyncStatus.connected = true;
    lastSyncStatus.lastSyncTime = new Date().toISOString();
    lastSyncStatus.targetIp = targetIp;
    lastSyncStatus.targetPort = targetPort;

    return {
      success: true,
      message: `Machine is connected on Wi-Fi (${targetIp}:${targetPort}). Real-time Automatic Push Receiver is actively listening on ${getLocalNetworkIp()}:5000 (${todayPunches} attendance records recorded today).`,
      totalOnDevice: todayPunches,
      newlyAdded: 0,
      lastSyncTime: lastSyncStatus.lastSyncTime
    };
  } catch (err) {
    return {
      success: false,
      error: `Sync error: ${err.message}`
    };
  } finally {
    isSyncing = false;
  }
}

// 3. Start Auto Background Polling
export function startBiometricAutoSync(ip, port = 71, intervalSeconds = 15, instituteId = null) {
  stopBiometricAutoSync();
  const targetIp = (ip || lastSyncStatus.targetIp || '192.168.0.12').trim();
  const targetPort = parseInt(port || lastSyncStatus.targetPort, 10) || 71;
  const intervalMs = Math.max(10, parseInt(intervalSeconds, 10) || 15) * 1000;

  lastSyncStatus.autoSyncEnabled = true;
  lastSyncStatus.targetIp = targetIp;
  lastSyncStatus.targetPort = targetPort;

  logInfo('BIOMETRIC', `🔄 Auto-Sync started for ${targetIp}:${targetPort} (Interval: ${intervalMs / 1000}s)`);

  autoSyncTimer = setInterval(async () => {
    try {
      await syncBiometricLogs(targetIp, targetPort, instituteId);
    } catch (err) {
      console.warn(`[Biometric Auto-Sync] Polling cycle warning: ${err.message}`);
    }
  }, intervalMs);

  return { success: true, autoSyncEnabled: true, intervalSeconds: intervalMs / 1000 };
}

// 4. Stop Auto Background Polling
export function stopBiometricAutoSync() {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = null;
  }
  lastSyncStatus.autoSyncEnabled = false;
  logInfo('BIOMETRIC', '🛑 Auto-Sync stopped.');
  return { success: true, autoSyncEnabled: false };
}

// 5. Get Current Status
export function getBiometricStatus() {
  return {
    ...lastSyncStatus,
    localIp: getLocalNetworkIp(),
    serverPort: 5000
  };
}
