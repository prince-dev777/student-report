// ============================================
// Career Xone Pro - SMS Service (Simulated)
// ============================================
// In production, replace sendSMS() with actual API call
// to MSG91, Fast2SMS, Twilio, etc.

import { generateId, getCurrentTime, getTodayStr } from './helpers';

// SMS Templates
export const smsTemplates = {
  attendanceEntry: (parentName, studentName, time, instituteName = 'Institute') =>
    `Dear ${parentName}, this is to inform you that your ward ${studentName} has safely arrived at the institute at ${time}. - ${instituteName}`,

  attendanceExit: (parentName, studentName, time, instituteName = 'Institute') =>
    `Dear ${parentName}, this is to inform you that your ward ${studentName} has left the institute at ${time}. - ${instituteName}`,

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
export function createSMSLog(type, student, parentPhone, message, status = 'sent') {
  return {
    id: generateId('SMS'),
    type,
    studentId: student.id,
    parentPhone,
    message,
    timestamp: `${getTodayStr()}T${getCurrentTime()}:00`,
    status,
  };
}

// Send attendance SMS and return log
export async function sendAttendanceSMS(student, type, time, instituteName = 'Institute') {
  const template = type === 'entry'
    ? smsTemplates.attendanceEntry(student.parentName, student.name, time, instituteName)
    : smsTemplates.attendanceExit(student.parentName, student.name, time, instituteName);

  const result = await sendSMS(student.parentPhone, template);

  return createSMSLog(
    `attendance-${type}`,
    student,
    student.parentPhone,
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

  const result = await sendSMS(student.parentPhone, template);

  return createSMSLog(
    'test-result',
    student,
    student.parentPhone,
    template,
    result.status
  );
}

// Send custom SMS
export async function sendCustomSMS(student, message, instituteName = 'Institute') {
  const parsedMessage = message
    .replace(/\{\{rollNo\}\}/gi, student.rollNo || '')
    .replace(/\{\{password\}\}/gi, student.parentPasswordPlain || student.password || '123456');

  const template = smsTemplates.general(student.parentName, parsedMessage, instituteName);
  const result = await sendSMS(student.parentPhone, template);

  return createSMSLog(
    'custom',
    student,
    student.parentPhone,
    template,
    result.status
  );
}

// Bulk send SMS to multiple students
export async function sendBulkSMS(students, messageGenerator) {
  const results = [];

  for (const student of students) {
    const message = messageGenerator(student);
    const result = await sendSMS(student.parentPhone, message);
    results.push(
      createSMSLog('bulk', student, student.parentPhone, message, result.status)
    );
  }

  return results;
}
