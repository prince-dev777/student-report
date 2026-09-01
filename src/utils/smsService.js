// ============================================
// Career Xone Pro - SMS Service (Simulated)
// ============================================
// In production, replace sendSMS() with actual API call
// to MSG91, Fast2SMS, Twilio, etc.

import { generateId, getCurrentTime, getTodayStr } from './helpers.js';

export function formatDurationHuman(minutes) {
  if (!minutes || isNaN(minutes) || minutes <= 0) return '';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0 && mins > 0) return `${hrs} hr${hrs > 1 ? 's' : ''} ${mins} min${mins > 1 ? 's' : ''}`;
  if (hrs > 0) return `${hrs} hr${hrs > 1 ? 's' : ''}`;
  return `${mins} min${mins > 1 ? 's' : ''}`;
}

// SMS Templates
export const smsTemplates = {
  attendanceEntry: (parentName, studentName, time, instituteName = 'Institute', sessionName = null) => {
    const sessionCtx = sessionName ? ` for ${sessionName}` : '';
    return `Dear ${parentName}, this is to inform you that your ward ${studentName} has safely arrived at the institute at ${time}${sessionCtx}. - ${instituteName}`;
  },

  attendanceExit: (parentName, studentName, time, instituteName = 'Institute', sessionName = null, durationMinutes = null) => {
    const sessionCtx = sessionName ? ` after ${sessionName}` : '';
    const formattedDuration = formatDurationHuman(durationMinutes);
    const durationStr = formattedDuration ? ` (Duration: ${formattedDuration})` : '';
    return `Dear ${parentName}, this is to inform you that your ward ${studentName} has left the institute at ${time}${sessionCtx}${durationStr}. - ${instituteName}`;
  },

  testResult: (parentName, studentName, testName, marks, totalMarks, percentage, rank, totalStudents, instituteName = 'Institute') =>
    `Dear ${parentName}, ${studentName}'s result for ${testName} has been declared. Score: ${marks}/${totalMarks} (${percentage}%), Rank: ${rank}/${totalStudents}. - ${instituteName}`,

  absentNotice: (parentName, studentName, date, instituteName = 'Institute') =>
    `Dear ${parentName}, this is to inform you that your ward ${studentName} is absent from the institute today (${date}). - ${instituteName}`,

  general: (parentName, message, instituteName = 'Institute') =>
    `Dear ${parentName}, ${message} - ${instituteName}`,

  feeReminder: (parentName, studentName, amount, dueDate, instituteName = 'Institute') =>
    `Dear ${parentName}, a fee payment of ₹${amount} for ${studentName} is due on or before ${dueDate}. Kindly ensure timely payment. - ${instituteName}`,
};

// Send SMS (returns a Promise with pending status for local whatsapp client to pick up)
export async function sendSMS(phoneNumber, message) {
  console.log(`📱 SMS queued for ${phoneNumber}: ${message.slice(0, 50)}...`);

  return {
    success: true,
    status: 'pending', // Important: Must be pending so local whatsapp poller picks it up
    timestamp: new Date().toISOString(),
  };
}

// Create SMS log entry
export function createSMSLog(type, student, parentPhone, message, status = 'sent', attachment = null) {
  const log = {
    id: generateId('SMS'),
    type,
    studentId: student.id,
    parentPhone,
    message,
    timestamp: `${getTodayStr()}T${getCurrentTime()}:00`,
    status,
  };
  if (attachment) {
    log.attachment = attachment;
  }
  return log;
}

// Send attendance SMS and return log
export async function sendAttendanceSMS(student, type, time, instituteName = 'Institute', sessionName = null) {
  const template = type === 'entry'
    ? smsTemplates.attendanceEntry(student.parentName, student.name, time, instituteName, sessionName)
    : smsTemplates.attendanceExit(student.parentName, student.name, time, instituteName, sessionName);

  const targetPhones = student.parentPhone2 ? `${student.parentPhone}, ${student.parentPhone2}` : student.parentPhone;
  const result = await sendSMS(targetPhones, template);

  return createSMSLog(
    `attendance-${type}`,
    student,
    targetPhones,
    template,
    result.status
  );
}

// Send test result SMS and return log
export async function sendTestResultSMS(student, testName, marks, totalMarks, percentage, rank, totalStudents, instituteName = 'Institute') {
  const template = smsTemplates.testResult(
    student.parentName, student.name, testName,
    marks, totalMarks, percentage, rank, totalStudents,
    instituteName
  );

  const targetPhones = student.parentPhone2 ? `${student.parentPhone}, ${student.parentPhone2}` : student.parentPhone;
  const result = await sendSMS(targetPhones, template);

  return createSMSLog(
    'test-result',
    student,
    targetPhones,
    template,
    result.status
  );
}

// Send custom SMS
export async function sendCustomSMS(student, message, instituteName = 'Institute', attachment = null) {
  const pName = student.parentName || 'Parent';
  const sName = student.name || 'Student';
  const pPhone = student.parentPhone || student.phone || '';
  const sPass = student.parentPasswordPlain || student.password || String(student.rollNo || '123456');
  const sRoll = String(student.rollNo || '');
  const sBatch = student.batch || '';
  const pUserId = student.parentUserId || `CAREER${sRoll}` || sRoll;

  let parsedMessage = message
    .replace(/\{\{studentName\}\}/gi, sName)
    .replace(/\{\{parentName\}\}/gi, pName)
    .replace(/\{\{parentPhone\}\}/gi, pPhone)
    .replace(/\{\{parentUserId\}\}/gi, pUserId)
    .replace(/\{\{userId\}\}/gi, pUserId)
    .replace(/\{\{rollNo\}\}/gi, sRoll)
    .replace(/\{\{batch\}\}/gi, sBatch)
    .replace(/\{\{password\}\}/gi, sPass);

  // Avoid duplicate "Dear ..." prefix if custom message already contains a greeting
  let finalTemplate = parsedMessage;
  if (!parsedMessage.trim().toLowerCase().startsWith('dear') && !parsedMessage.trim().toLowerCase().startsWith('namaste')) {
    finalTemplate = smsTemplates.general(pName, parsedMessage, instituteName);
  } else if (!parsedMessage.includes(instituteName)) {
    finalTemplate = `${parsedMessage}\n\n- ${instituteName}`;
  }
  
  const targetPhones = student.parentPhone2 ? `${student.parentPhone}, ${student.parentPhone2}` : student.parentPhone;
  const result = await sendSMS(targetPhones, finalTemplate);

  return createSMSLog(
    'custom',
    student,
    targetPhones,
    finalTemplate,
    result.status,
    attachment
  );
}

// Bulk send SMS to multiple students
export async function sendBulkSMS(students, messageGenerator) {
  const results = [];

  for (const student of students) {
    const message = messageGenerator(student);
    const targetPhones = student.parentPhone2 ? `${student.parentPhone}, ${student.parentPhone2}` : student.parentPhone;
    const result = await sendSMS(targetPhones, message);
    results.push(
      createSMSLog('bulk', student, targetPhones, message, result.status)
    );
  }

  return results;
}
