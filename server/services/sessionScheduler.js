import mongoose from 'mongoose';
import Session from '../models/Session.js';
import Student from '../models/Student.js';
import Attendance from '../models/Attendance.js';
import Notification from '../models/Notification.js';
import { mirrorWrite } from '../db/syncEngine.js';
import { sendWhatsAppAlert } from './whatsappService.js';

// Cache to prevent duplicate automated alerts within the same day
const automatedAlertsSent = new Set();

function getTodayISO() {
  return new Date().toISOString().split('T')[0];
}

function getCurrentTimeHHMM() {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function startSessionScheduler() {
  console.log('⏰ [SessionScheduler] Auto-Rollover & Missed-Exit Monitor started (1-minute interval)');

  // Run every 60 seconds
  setInterval(async () => {
    try {
      if (mongoose.connection.readyState !== 1) return;

      const todayStr = getTodayISO();
      const currentHHMM = getCurrentTimeHHMM();

      // Clean up old date keys from memory
      for (const key of automatedAlertsSent) {
        if (!key.startsWith(todayStr)) {
          automatedAlertsSent.delete(key);
        }
      }

      // Fetch all non-deleted sessions grouped by institute
      const sessions = await Session.find({ isDeleted: { $ne: true } }).sort({ startTime: 1 });
      if (!sessions || sessions.length === 0) return;

      // Group sessions by instituteId
      const sessionsByInst = {};
      for (const sess of sessions) {
        const instId = sess.instituteId ? String(sess.instituteId) : 'default';
        if (!sessionsByInst[instId]) sessionsByInst[instId] = [];
        sessionsByInst[instId].push(sess);
      }

      for (const [instId, instSessions] of Object.entries(sessionsByInst)) {
        for (let i = 0; i < instSessions.length; i++) {
          const currentSess = instSessions[i];
          const prevSess = i > 0 ? instSessions[i - 1] : null;

          // ------------------------------------------------------------------
          // 1. Session Start Auto-Rollover Alert (e.g. 13:00 / Self Study start)
          // ------------------------------------------------------------------
          if (currentSess.startTime === currentHHMM && prevSess) {
            const rolloverKey = `${todayStr}_ROLLOVER_${currentSess.id}`;
            if (!automatedAlertsSent.has(rolloverKey)) {
              automatedAlertsSent.add(rolloverKey);

              // Find students who punched in for previous session and NEVER checked out
              const openAttendances = await Attendance.find({
                isDeleted: { $ne: true },
                date: todayStr,
                $or: [{ exitTime: '--' }, { exitTime: null }, { exitTime: { $exists: false } }]
              });

              for (const att of openAttendances) {
                const student = await Student.findOne({ id: att.studentId, isDeleted: { $ne: true } });
                if (!student) continue;

                // Create In-App Notification directly for Parents Mobile App
                const pName = student.parentName || 'Parent';
                const todayFormatted = todayStr.includes('-') ? (todayStr.split('-')[0].length === 4 ? todayStr.split('-').reverse().join('-') : todayStr) : todayStr;
                const punchMissedMsg = `PUNCH MISSED AT ${todayFormatted} PLEASE VERIFY MANUALLY AT CAREER XONE !`;

                try {
                  const notif = new Notification({
                    instituteId: student.instituteId || currentSess.instituteId,
                    studentId: student._id || student.id,
                    title: 'PUNCH MISSED',
                    message: punchMissedMsg,
                    type: 'ATTENDANCE'
                  });
                  await notif.save();
                  mirrorWrite('notifications', notif.toObject ? notif.toObject() : notif);
                } catch (notifErr) {}

                // WhatsApp alert (whatsappService will auto-filter by whitelist — PUNCH_MISSED goes to app-only)
                if (student.parentPhone) {
                  await sendWhatsAppAlert({
                    instituteId: student.instituteId || currentSess.instituteId,
                    studentId: student.id,
                    parentPhone: student.parentPhone,
                    studentName: student.name,
                    parentName: student.parentName,
                    type: 'PUNCH_MISSED',
                    sessionName: prevSess.name,
                    detail: {
                      sessionName: prevSess.name,
                      time: prevSess.endTime
                    }
                  }).catch(() => {});
                }

                // Update sessionName to the current new session
                att.sessionName = currentSess.name;
                await att.save().catch(() => {});
              }
              console.log(`⏰ [SessionScheduler] Rollover In-App notification sent for session: ${currentSess.name}`);
            }
          }

          // ------------------------------------------------------------------
          // 2. Session End Missed-Exit Alert (Only on final session of the day e.g. 22:00)
          // ------------------------------------------------------------------
          const nextSess = i < instSessions.length - 1 ? instSessions[i + 1] : null;
          if (currentSess.endTime === currentHHMM && !nextSess) {
            const exitKey = `${todayStr}_MISSED_EXIT_${currentSess.id}`;
            if (!automatedAlertsSent.has(exitKey)) {
              automatedAlertsSent.add(exitKey);

              const openAttendances = await Attendance.find({
                isDeleted: { $ne: true },
                date: todayStr,
                sessionName: currentSess.name,
                $or: [{ exitTime: '--' }, { exitTime: null }, { exitTime: { $exists: false } }]
              });

              for (const att of openAttendances) {
                const student = await Student.findOne({ id: att.studentId, isDeleted: { $ne: true } });
                if (!student) continue;

                // Create In-App Notification directly for Parents Mobile App
                const pName = student.parentName || 'Parent';
                const todayFormatted = todayStr.includes('-') ? (todayStr.split('-')[0].length === 4 ? todayStr.split('-').reverse().join('-') : todayStr) : todayStr;
                const punchMissedMsg = `PUNCH MISSED AT ${todayFormatted} PLEASE VERIFY MANUALLY AT CAREER XONE !`;

                try {
                  const notif = new Notification({
                    instituteId: student.instituteId || currentSess.instituteId,
                    studentId: student._id || student.id,
                    title: 'PUNCH MISSED',
                    message: punchMissedMsg,
                    type: 'ATTENDANCE'
                  });
                  await notif.save();
                  mirrorWrite('notifications', notif.toObject ? notif.toObject() : notif);
                } catch (notifErr) {}

                // WhatsApp alert (whatsappService will auto-filter by whitelist — PUNCH_MISSED goes to app-only)
                if (student.parentPhone) {
                  await sendWhatsAppAlert({
                    instituteId: student.instituteId || currentSess.instituteId,
                    studentId: student.id,
                    parentPhone: student.parentPhone,
                    studentName: student.name,
                    parentName: student.parentName,
                    type: 'PUNCH_MISSED',
                    sessionName: currentSess.name,
                    detail: {
                      sessionName: currentSess.name,
                      time: currentSess.endTime
                    }
                  }).catch(() => {});
                }
              }
              console.log(`⏰ [SessionScheduler] Missed-exit In-App alerts checked for final session: ${currentSess.name}`);
            }
          }
        }
      }
    } catch (err) {
      console.warn('⏰ [SessionScheduler] Error:', err.message);
    }
  }, 60 * 1000);
}
