import SMSLog from '../models/SMSLog.js';

/**
 * Sends a WhatsApp message to the specified parent phone number.
 * Logs the message details to the database (SMSLog).
 * 
 * @param {string} instituteId - Mongoose ObjectId of the Institute
 * @param {string} studentId - Custom student ID (e.g. STU...)
 * @param {string} parentPhone - Parent phone number
 * @param {string} studentName - Name of the student
 * @param {string} type - 'IN' | 'OUT' | 'ABSENT'
 * @param {string} detail - time (for IN/OUT) or date (for ABSENT)
 */
export async function sendWhatsAppAlert({ instituteId, studentId, parentPhone, studentName, type, detail }) {
  // Construct clean international number format (WhatsApp needs country code, e.g. +91)
  let formattedPhone = parentPhone.replace(/\D/g, ''); // strip non-digits
  if (formattedPhone.length === 10) {
    formattedPhone = '91' + formattedPhone; // default to India country code if 10 digits
  }
  if (!formattedPhone.startsWith('+') && formattedPhone.length > 0) {
    formattedPhone = '+' + formattedPhone;
  }

  // Construct message text
  let messageText = '';
  if (type === 'IN') {
    messageText = `Check-In Alert:\nDear Parent, your child ${studentName} has checked in at ${detail}.\n- CAREER XONE`;
  } else if (type === 'OUT') {
    messageText = `Check-Out Alert:\nDear Parent, your child ${studentName} has checked out at ${detail}.\n- CAREER XONE`;
  } else if (type === 'ABSENT') {
    messageText = `Absent Alert:\nDear Parent, your child ${studentName} is marked ABSENT for today (${detail}).\n- CAREER XONE`;
  } else if (type === 'TEST_RESULT') {
    messageText = `Result Alert:\nDear Parent, ${studentName} scored ${detail.marks}/${detail.totalMarks} in ${detail.subject} test. Rank: ${detail.rank}/${detail.totalStudents}.\n- CAREER XONE`;
  }

  const provider = (process.env.WHATSAPP_PROVIDER || 'mock').toLowerCase();
  let status = 'sent';

  console.log(`[WhatsAppService] Sending WhatsApp alert via provider: ${provider} to ${formattedPhone}`);
  console.log(`[WhatsAppService] Message Content: "${messageText}"`);

  try {
    if (provider === 'ultramsg') {
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
      console.log('[WhatsAppService] Ultramsg response:', resData);
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
      console.log('[WhatsAppService] Twilio response:', resData);
      status = 'delivered';
    } else {
      // Mock / Simulation mode
      console.log('[WhatsAppService] Simulated message sent successfully.');
      status = 'sent';
    }
  } catch (err) {
    console.error('[WhatsAppService] Error sending WhatsApp message:', err.message);
    status = 'failed';
  }

  // Create Log in SMSLog DB Collection
  try {
    const log = new SMSLog({
      instituteId,
      id: `SMS${Date.now()}`,
      type: type === 'ABSENT' ? 'absent' : 'attendance',
      studentId,
      parentPhone,
      message: messageText,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
      status
    });
    await log.save();
    console.log(`[WhatsAppService] SMSLog saved successfully (Status: ${status}).`);
  } catch (logErr) {
    console.error('[WhatsAppService] Failed to save SMSLog:', logErr.message);
  }
}
