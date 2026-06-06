// ============================================
// EduTrack Pro - SMS Service (Simulated)
// ============================================
// In production, replace sendSMS() with actual API call
// to MSG91, Fast2SMS, Twilio, etc.

import { generateId, getCurrentTime, getTodayStr } from './helpers';

// SMS Templates
export const smsTemplates = {
  attendanceEntry: (parentName, studentName, time) =>
    `Namaste ${parentName} ji, aapka bachha ${studentName} aaj ${time} par coaching me aa gaya hai. - EduTrack Pro`,

  attendanceExit: (parentName, studentName, time) =>
    `Namaste ${parentName} ji, aapka bachha ${studentName} aaj ${time} par coaching se nikal gaya hai. - EduTrack Pro`,

  testResult: (parentName, studentName, testName, marks, totalMarks, percentage, rank, totalStudents) =>
    `Namaste ${parentName} ji, ${studentName} ka ${testName} result: Marks ${marks}/${totalMarks} (${percentage}%), Rank: ${rank}/${totalStudents}. Keep motivating! - EduTrack Pro`,

  absentNotice: (parentName, studentName, date) =>
    `Namaste ${parentName} ji, aapka bachha ${studentName} aaj ${date} ko coaching me nahi aaya. Kripya dhyan dein. - EduTrack Pro`,

  general: (parentName, message) =>
    `Namaste ${parentName} ji, ${message} - EduTrack Pro`,

  feeReminder: (parentName, studentName, amount, dueDate) =>
    `Namaste ${parentName} ji, ${studentName} ki fees ₹${amount} ka last date ${dueDate} hai. Kripya samay par jama karein. - EduTrack Pro`,
};

// Simulate sending SMS (returns a Promise)
export async function sendSMS(phoneNumber, message) {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 500));

  // Simulate 95% success rate
  const success = Math.random() > 0.05;

  console.log(`📱 SMS ${success ? 'Sent' : 'Failed'} to ${phoneNumber}: ${message.slice(0, 50)}...`);

  return {
    success,
    status: success ? 'delivered' : 'failed',
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
export async function sendAttendanceSMS(student, type, time) {
  const template = type === 'entry'
    ? smsTemplates.attendanceEntry(student.parentName, student.name, time)
    : smsTemplates.attendanceExit(student.parentName, student.name, time);

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
export async function sendTestResultSMS(student, testName, marks, totalMarks, percentage, rank, totalStudents) {
  const template = smsTemplates.testResult(
    student.parentName, student.name, testName,
    marks, totalMarks, percentage, rank, totalStudents
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
export async function sendCustomSMS(student, message) {
  const template = smsTemplates.general(student.parentName, message);
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
