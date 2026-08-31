import ZKLib from 'node-zklib';
import net from 'net';
import os from 'os';
import mongoose from 'mongoose';
import Student from '../models/Student.js';
import Attendance from '../models/Attendance.js';
import Session from '../models/Session.js';
import Notification from '../models/Notification.js';
import SMSLog from '../models/SMSLog.js';
import { sendWhatsAppAlert } from './whatsappService.js';
import { logInfo, logError, logWarn } from '../utils/logger.js';

let autoSyncTimer = null;
let isSyncing = false;

// Live in-memory ring buffer for recent biometric punch activities (last 25 punches)
const recentPunches = [];

// Real-time ADMS Push Receiver Status
const admsStatus = {
  active: true,
  listenerPort: 5000,
  lastSeenSN: null,
  lastSeenTime: null,
  clientIp: null,
  totalPushesReceived: 0,
  lastPushStatus: 'Listening on port 5000'
};

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

// Helper: Record ADMS Push Activity from hardware
export function recordAdmsActivity(sn, rawDataLength = 0, clientIp = '') {
  admsStatus.lastSeenSN = sn || admsStatus.lastSeenSN || 'UNKNOWN_DEVICE';
  admsStatus.lastSeenTime = new Date().toISOString();
  admsStatus.clientIp = clientIp || admsStatus.clientIp;
  admsStatus.totalPushesReceived += 1;
  admsStatus.lastPushStatus = `Received ${rawDataLength} bytes at ${new Date().toLocaleTimeString('en-US')}`;
}

// Helper: Check if TCP Port is Open on Machine IP
export function checkTcpPort(ip, port, timeoutMs = 1200) {
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

// 0. Auto-Scan Local Wi-Fi Subnet for Biometric Machines
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
            const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
            subnets.add(prefix);
          }
        }
      }
    }
  }

  // Common Biometric Hardware Ports (FK/Realtime: 71, ZKTeco/eSSL: 4370, Realtime: 5005, Biomax: 5500/8000, eSSL: 9922/6001)
  const targetPorts = [71, 4370, 5005, 5500, 8000, 9922, 6001, 7005];
  const discoveredMap = new Map();
  const probeTasks = [];

  for (const subnet of subnets) {
    for (let i = 1; i <= 254; i++) {
      const targetIp = `${subnet}.${i}`;
      if (localIps.has(targetIp)) continue; // Exclude current PC
      // Skip router default gateway (usually .1) if no biometric port is explicitly requested
      if (i === 1 && !targetPorts.includes(71) && !targetPorts.includes(4370)) continue;

      for (const port of targetPorts) {
        probeTasks.push(
          (async () => {
            const isOpen = await checkTcpPort(targetIp, port, 1200);
            if (isOpen) {
              let name = `Biometric Machine (${targetIp})`;
              let protocol = `Port ${port}`;
              if (port === 71) {
                name = `FK / Realtime Device (${targetIp})`;
                protocol = 'FK Port 71';
              } else if (port === 4370) {
                name = `ZKTeco / eSSL Device (${targetIp})`;
                protocol = 'ZK Port 4370';
              } else if (port === 5005) {
                name = `Realtime Series Device (${targetIp})`;
                protocol = 'Realtime Port 5005';
              } else if (port === 5500 || port === 8000) {
                name = `Biomax / ZK Device (${targetIp})`;
                protocol = `Port ${port}`;
              }

              if (!discoveredMap.has(targetIp) || port === 71 || port === 4370) {
                discoveredMap.set(targetIp, {
                  ip: targetIp,
                  port: port,
                  name: name,
                  protocol: protocol,
                  status: 'Online'
                });
              }
            }
          })()
        );
      }
    }
  }

  // Execute all probes in parallel batches of 150
  const BATCH_SIZE = 150;
  for (let i = 0; i < probeTasks.length; i += BATCH_SIZE) {
    const batch = probeTasks.slice(i, i + BATCH_SIZE);
    await Promise.all(batch);
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

// 1. Process Single Punch Record with End-to-End Attendance & WhatsApp Alert Creation
export async function processPunchRecord({ rollNumber, type = 'IN', punchTime, punchDate, instituteId, deviceSN = null }) {
  try {
    const Student = mongoose.model('Student');
    const Attendance = mongoose.model('Attendance');
    const Session = mongoose.model('Session');
    const Notification = mongoose.model('Notification');

    const cleanRoll = String(rollNumber || '').trim().replace(/^0+/, '') || String(rollNumber).trim();
    const rollNumVal = parseInt(cleanRoll, 10);
    
    // Multi-format forgiving query list
    const queryList = [
      { rollNo: String(rollNumber).trim() },
      { rollNo: String(cleanRoll) },
      { id: String(rollNumber).trim() },
      { id: String(cleanRoll) }
    ];

    // Add zero-padded variations e.g. '01', '001', '0001'
    if (!isNaN(rollNumVal)) {
      queryList.push({ rollNo: rollNumVal });
      queryList.push({ rollNo: String(rollNumVal).padStart(2, '0') });
      queryList.push({ rollNo: String(rollNumVal).padStart(3, '0') });
      queryList.push({ rollNo: String(rollNumVal).padStart(4, '0') });
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
      logWarn('BIOMETRIC', `⚠️ Student not found for biometric roll/ID: ${rollNumber}`);
      return { success: false, reason: `Student with roll ${rollNumber} not found in database` };
    }

    const resolvedInstituteId = student.instituteId;
    const todayStr = punchDate && punchDate.length === 10 ? punchDate.replace(/\//g, '-') : new Date().toISOString().split('T')[0];
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
        id: `ATT_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        studentId: student.id,
        date: todayStr,
        status: 'present',
        entryTime: type === 'IN' ? formattedTime : '--',
        exitTime: type === 'OUT' ? formattedTime : '--',
        smsSent: false
      });
      isNewPunch = true;
    } else {
      if (type === 'IN') {
        if (!record.entryTime || record.entryTime === '--') {
          record.entryTime = formattedTime;
          isNewPunch = true;
        }
      } else if (type === 'OUT') {
        if (!record.exitTime || record.exitTime === '--') {
          record.exitTime = formattedTime;
          isNewPunch = true;
        }
      }
      record.status = 'present';
    }

    // Auto-match session based on punch time
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

          if (entryMin >= startMin - 45 && entryMin <= endMin + 30) {
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

    // Calculate duration in minutes if both entry and exit are recorded
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
      if (student.parentPhone) {
        record.smsSent = true;
      }
      await record.save();

      // Create in-app Notification
      const title = type === 'IN' ? 'Check-In Alert' : 'Check-Out Alert';
      const message = `${student.name} (Roll ${student.rollNo}) has checked ${type} at ${formattedTime}.`;
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

      // Trigger Parent WhatsApp Alert & Log to SMSLog DB collection
      if (student.parentPhone) {
        const sessionCtx = record.sessionName ? ` for ${record.sessionName}` : '';
        const durationStr = record.durationMinutes ? ` (Duration: ${record.durationMinutes} mins)` : '';

        sendWhatsAppAlert({
          instituteId: resolvedInstituteId,
          studentId: student.id,
          parentPhone: student.parentPhone,
          studentName: student.name,
          parentName: student.parentName,
          type: type,
          detail: `${formattedTime}${type === 'IN' ? sessionCtx : durationStr}`
        }).catch((err) => console.warn('[Biometric] WhatsApp alert warning:', err.message));
      }

      // Add to live activity feed
      recentPunches.unshift({
        id: `PUNCH_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        studentName: student.name,
        rollNo: student.rollNo,
        studentId: student.id,
        type: type,
        time: formattedTime,
        date: todayStr,
        session: record.sessionName || 'General Session',
        deviceSN: deviceSN || 'Biometric Device',
        timestamp: new Date().toISOString()
      });
      if (recentPunches.length > 25) recentPunches.pop();

      logInfo('BIOMETRIC', `✅ New ${type} punch recorded for ${student.name} (Roll ${student.rollNo}) at ${formattedTime}`);
      return { success: true, isNew: true, studentName: student.name, rollNumber: student.rollNo, type, time: formattedTime };
    }

    return { success: true, isNew: false, studentName: student.name, rollNumber: student.rollNo, type, time: formattedTime };
  } catch (err) {
    logError('BIOMETRIC', `Error processing punch: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// 2. Test Device Connection (Hybrid: ZKTeco socket + TCP probe)
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
      error: `Could not reach Biometric Machine at ${targetIp}:${targetPort}. Please ensure the device is ON and on the same Wi-Fi. (If using ADMS Push mode, machine pushes to PC:5000).`
    };
  }

  // Try ZKTeco binary protocol handshake (for port 4370 or 71)
  let zkSuccess = false;
  let zkInfo = {};
  if (targetPort === 4370) {
    try {
      const zk = new ZKLib(targetIp, targetPort, 4000, 3000);
      await zk.createSocket();
      zkInfo = await zk.getInfo().catch(() => ({}));
      await zk.disconnect().catch(() => {});
      zkSuccess = true;
    } catch (e) {
      logWarn('BIOMETRIC', `ZKTeco handshake warning on ${targetIp}:${targetPort}: ${e.message}`);
    }
  }

  lastSyncStatus.connected = true;
  lastSyncStatus.targetIp = targetIp;
  lastSyncStatus.targetPort = targetPort;
  lastSyncStatus.deviceInfo = {
    version: zkSuccess ? (zkInfo?.version || 'ZKTeco Hardware Protocol') : (targetPort === 4370 ? 'ZKTeco Port Open' : `Hardware Port ${targetPort} Active`),
    userCount: zkInfo?.userCounts ?? 'Online',
    logCount: zkInfo?.logCounts ?? 'Live',
    ip: targetIp,
    port: targetPort,
    status: 'Online & Connected'
  };
  lastSyncStatus.error = null;

  logInfo('BIOMETRIC', `✅ Successfully connected to ${targetIp}:${targetPort}`);
  return {
    success: true,
    message: `Connected successfully to Biometric Machine at ${targetIp}:${targetPort}!`,
    deviceInfo: lastSyncStatus.deviceInfo
  };
}

// 3. Sync Attendance Logs From Device
export async function syncBiometricLogs(ip, port = 71, instituteId = null) {
  if (isSyncing) {
    return { success: true, message: 'Sync already in progress...', newlyAdded: 0, totalOnDevice: 0 };
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

    // Pull from ZKTeco device if port is 4370
    if (targetPort === 4370) {
      const zk = new ZKLib(targetIp, targetPort, 6000, 4000);
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
          message: `Successfully synchronized ${rawLogs.length} total logs from device (${newlyAdded} new attendance punches recorded).`,
          totalOnDevice: rawLogs.length,
          newlyAdded,
          matchedCount,
          lastSyncTime: lastSyncStatus.lastSyncTime
        };
      } catch (zkErr) {
        try { await zk.disconnect(); } catch (e) {}
        logWarn('BIOMETRIC', `ZKTeco pull error: ${zkErr.message}`);
        return {
          success: false,
          error: `ZK Protocol Error: ${zkErr.message}. If machine is in ADMS mode, set server to ${getLocalNetworkIp()}:5000 in machine menu.`
        };
      }
    }

    // For other ports (e.g. FK / Realtime on Port 71)
    lastSyncStatus.connected = true;
    lastSyncStatus.targetPort = targetPort;
    lastSyncStatus.targetIp = targetIp;
    lastSyncStatus.error = null;
    lastSyncStatus.lastSyncTime = new Date().toISOString();
    return {
      success: true,
      message: `Machine port ${targetPort} is open and active. Real-time ADMS Push Receiver is listening on ${getLocalNetworkIp()}:5000.`,
      totalOnDevice: 0,
      newlyAdded: 0,
      lastSyncTime: lastSyncStatus.lastSyncTime
    };
  } catch (err) {
    lastSyncStatus.error = err.message;
    return {
      success: false,
      error: `Sync error: ${err.message}`
    };
  } finally {
    isSyncing = false;
  }
}

// 3b. Sync Multiple Biometric Devices Simultaneously (Multi-Device Wi-Fi Batch Sync)
export async function syncAllBiometricDevices(deviceList = [], instituteId = null) {
  if (!Array.isArray(deviceList) || deviceList.length === 0) {
    return { success: false, error: 'No devices provided for batch sync.' };
  }

  logInfo('BIOMETRIC', `🚀 Batch syncing ${deviceList.length} biometric devices on Wi-Fi...`);

  let totalNew = 0;
  let totalLogs = 0;
  let successCount = 0;
  const deviceResults = [];

  for (const dev of deviceList) {
    const devIp = (dev.ip || '').trim();
    const devPort = parseInt(dev.port, 10) || 71;
    if (!devIp) continue;

    try {
      const res = await syncBiometricLogs(devIp, devPort, instituteId);
      if (res && res.success) {
        successCount++;
        totalNew += (res.newlyAdded || 0);
        totalLogs += (res.totalOnDevice || 0);
      }
      deviceResults.push({
        ip: devIp,
        port: devPort,
        name: dev.name || `Device (${devIp})`,
        ...res
      });
    } catch (err) {
      deviceResults.push({
        ip: devIp,
        port: devPort,
        name: dev.name || `Device (${devIp})`,
        success: false,
        error: err.message
      });
    }
  }

  lastSyncStatus.lastSyncTime = new Date().toISOString();
  lastSyncStatus.lastSyncedCount = totalNew;

  return {
    success: successCount > 0 || deviceList.length === 0,
    message: `Batch sync complete: ${successCount}/${deviceList.length} machines synced (${totalNew} new attendance logs recorded).`,
    totalDevices: deviceList.length,
    successfulDevices: successCount,
    newlyAdded: totalNew,
    totalOnDevices: totalLogs,
    lastSyncTime: lastSyncStatus.lastSyncTime,
    deviceResults
  };
}

// 4. Start Auto Background Polling (Supports single IP or list of devices)
export function startBiometricAutoSync(devicesOrIp, port = 71, intervalSeconds = 15, instituteId = null) {
  stopBiometricAutoSync();
  const intervalMs = Math.max(10, parseInt(intervalSeconds, 10) || 15) * 1000;

  let deviceList = [];
  if (Array.isArray(devicesOrIp)) {
    deviceList = devicesOrIp;
  } else {
    const targetIp = (devicesOrIp || lastSyncStatus.targetIp || '192.168.0.12').trim();
    const targetPort = parseInt(port || lastSyncStatus.targetPort, 10) || 71;
    deviceList = [{ ip: targetIp, port: targetPort }];
  }

  lastSyncStatus.autoSyncEnabled = true;
  lastSyncStatus.targetDevices = deviceList;

  logInfo('BIOMETRIC', `🔄 Auto-Sync active for ${deviceList.length} device(s) (Interval: ${intervalMs / 1000}s)`);

  autoSyncTimer = setInterval(async () => {
    try {
      if (deviceList.length === 1) {
        await syncBiometricLogs(deviceList[0].ip, deviceList[0].port, instituteId);
      } else {
        await syncAllBiometricDevices(deviceList, instituteId);
      }
    } catch (err) {
      console.warn(`[Biometric Auto-Sync] Multi-device cycle warning: ${err.message}`);
    }
  }, intervalMs);

  return { success: true, autoSyncEnabled: true, intervalSeconds: intervalMs / 1000, devicesCount: deviceList.length };
}

// 5. Stop Auto Background Polling
export function stopBiometricAutoSync() {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = null;
  }
  lastSyncStatus.autoSyncEnabled = false;
  logInfo('BIOMETRIC', '🛑 Auto-Sync stopped.');
  return { success: true, autoSyncEnabled: false };
}

// 6. Get Current Status & Real-Time Diagnostics
export function getBiometricStatus() {
  return {
    ...lastSyncStatus,
    localIp: getLocalNetworkIp(),
    serverPort: 5000,
    admsStatus: {
      ...admsStatus,
      localReceiverUrl: `http://${getLocalNetworkIp()}:5000/iclock/cdata`
    },
    recentPunches: recentPunches.slice(0, 15)
  };
}
