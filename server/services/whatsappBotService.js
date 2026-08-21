import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { logInfo, logError, logWarn } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.join(__dirname, '../whatsapp_ai_config.json');

let botConfig = {
  enabled: true,
  coachingName: 'Career Xone',
  welcomeHeader: 'Namaste! Welcome to Career Xone Intelligent Academic Assistant.',
  counselingPhone1: '9673383561',
  counselingPhone2: '9145481323',
  campusAddress: 'Hadditoli Road, Near Ananya Hospital, Gondia, Maharashtra 441601',
  email: 'cxjeeneet@gmail.com',
  googleMapsUrl: 'https://maps.app.goo.gl/ECzbg6DcixL7ZxpW7',
  enableAttendance: true,
  enableMarks: true,
  enableTimetable: true,
  enableReport: true,
  enableHelp: true,
  enableLeaveLogger: true,
  enableLocationGuide: true,
  customFaqs: []
};

// Load saved config on boot
try {
  if (fs.existsSync(CONFIG_FILE)) {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const saved = JSON.parse(raw);
    botConfig = { ...botConfig, ...saved };
    logInfo('WHATSAPP_AI', `📁 Loaded saved AI settings (Helpline 1: ${botConfig.counselingPhone1}, Helpline 2: ${botConfig.counselingPhone2})`);
  }
} catch (e) {
  logWarn('WHATSAPP_AI', 'Using default AI configuration');
}

// In-memory interaction logs (stores latest 200 bot chats for UI)
const botLogs = [];
const lastRepliedTimeMap = new Map();
const sentBotTexts = new Set(); // Tracks outgoing bot messages to prevent self-trigger loops
const COOLDOWN_MS = 1500; // 1.5 seconds per sender

function markBotSent(text) {
  if (!text) return;
  const trimmed = text.trim();
  sentBotTexts.add(trimmed);
  if (sentBotTexts.size > 200) {
    const first = sentBotTexts.values().next().value;
    sentBotTexts.delete(first);
  }
}

// Helper: Normalize phone to 10-digit Indian number or clean international digits
function cleanPhone(raw) {
  if (!raw) return '';
  const base = String(raw).split('@')[0].split(':')[0];
  let digits = base.replace(/\D/g, '');
  if (!digits) return '';

  // If starts with 91 (India) and has 12 digits (e.g. 919145481323)
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  // If starts with 0 (e.g. 09145481323) and has 11 digits
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  // If starts with 91 and has more than 10 digits
  if (digits.length > 10 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  // If standard 10 digits
  if (digits.length === 10) {
    return digits;
  }
  // If longer than 10 digits
  if (digits.length > 10) {
    return digits.slice(-10);
  }
  return digits;
}

// Helper: Fuzzy Spelling & Phonetic Normalizer for Hinglish & Typos
function normalizeQuery(rawText) {
  if (!rawText) return '';
  let str = rawText.toLowerCase().trim();

  // Replace common spelling mistakes & abbreviations
  const typoMap = [
    [/\b(atndnc|atendans|atndns|attendence|attendens|presnt|absnt|hajri|hajiri|hajari|attandance|attandence)\b/g, 'attendance'],
    [/\b(mrks|mrk|reslt|rsult|prcntg|precentage|rankk|tst|papr|pariksha)\b/g, 'test marks'],
    [/\b(tmtbl|timetabl|scedule|scdule|clas|bch|tming|lectur)\b/g, 'timetable'],
    [/\b(fess|feee|feess|fees|fee|paymnt|pyment|kist|intallment|instolment|pysa|paise|rupye|rupees|cost|charge|charges)\b/g, 'fees'],
    [/\b(adres|adress|adrs|locatn|kidhr|kaha\s*hai|kaha\s*h|kahan\s*h)\b/g, 'location address'],
    [/\b(hw|homwrk|hmwrk|syllabs|sylabus|notse|padai|pdhai)\b/g, 'syllabus homework'],
    [/\b(bimar|tabiyat|tabiat|fever|bukhar|leave|chutti|chuti|nahi\s*aayega|ni\s*aayega|nahi\s*ayega)\b/g, 'leave application'],
    [/\b(shukriya|dhanyawad|dhanyavad|tq|thnx|thnks|thanx|thanku|thankyou|thanks)\b/g, 'thank you'],
    [/\b(gm|g\s*m|gud\s*mrng|good\s*mrng|gud\s*morning)\b/g, 'good morning'],
    [/\b(no|numbr|nmbr|contct|mob|phon|fone)\b/g, 'contact number']
  ];

  for (const [pattern, replacement] of typoMap) {
    str = str.replace(pattern, replacement);
  }

  return str;
}

// Helper: Log bot chat for UI monitor
function recordBotLog({ phone, studentName, rollNo, incomingText, botReply, status = 'success' }) {
  const logItem = {
    id: 'AI-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    phone,
    studentName: studentName || 'Unknown / Guest',
    rollNo: rollNo || '--',
    incomingText: String(incomingText || ''),
    botReply: String(botReply || ''),
    timestamp: new Date().toISOString(),
    status
  };
  botLogs.unshift(logItem);
  if (botLogs.length > 250) botLogs.pop();
}

// 1. Get Bot Configuration & Status
export function getBotConfig() {
  return {
    ...botConfig,
    totalLogsCount: botLogs.length
  };
}

// 2. Update Bot Configuration
export function updateBotConfig(newConfig) {
  botConfig = { ...botConfig, ...newConfig };
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(botConfig, null, 2), 'utf-8');
    logInfo('WHATSAPP_AI', `💾 Persisted updated AI settings to disk (Helpline 1: ${botConfig.counselingPhone1}, Helpline 2: ${botConfig.counselingPhone2})`);
  } catch (e) {
    logError('WHATSAPP_AI', 'Failed to persist AI config to disk', e);
  }
  return { success: true, config: botConfig };
}

// 3. Get Recent Bot Logs
export function getBotLogs() {
  return [...botLogs];
}

// 4. Main Incoming Message Handler (Ultra-Smart NLP & AI Engine)
export async function handleIncomingWhatsAppMessage(client, msg) {
  try {
    if (!botConfig.enabled) return;
    if (!msg || !client) return;

    const fromId = msg.from || '';
    const toId = msg.to || '';
    const remoteId = msg.id?.remote || fromId || toId;

    // Ignore group chats and broadcast status
    if (fromId.endsWith('@g.us') || toId.endsWith('@g.us') || remoteId.endsWith('@g.us') || fromId === 'status@broadcast') {
      return;
    }

    const bodyText = (msg.body || '').trim();
    if (!bodyText) return;

    // If this message was generated and sent by our AI, ignore it immediately!
    if (sentBotTexts.has(bodyText)) return;

    const myWid = client.info?.wid?._serialized || '';
    const myPhone = client.info?.wid ? cleanPhone(client.info.wid.user) : '';

    // Resolve Real Sender Phone & Push Name (Handles WhatsApp LID & Multi-Device JIDs)
    let senderRaw = remoteId || fromId;
    let pushName = '';

    try {
      if (typeof msg.getContact === 'function') {
        const contact = await msg.getContact();
        if (contact) {
          if (contact.number && !contact.number.includes('@lid')) {
            senderRaw = contact.number;
          } else if (contact.id?.user && !contact.id._serialized?.endsWith('@lid')) {
            senderRaw = contact.id.user;
          }
          pushName = contact.pushname || contact.name || '';
        }
      }
    } catch (contactErr) {}

    // Additional Fallback for LID participants
    if (senderRaw.includes('@lid') || (fromId && fromId.includes('@lid'))) {
      if (msg.author && !msg.author.includes('@lid')) {
        senderRaw = msg.author;
      } else if (msg._data?.id?.participant && !msg._data.id.participant.includes('@lid')) {
        senderRaw = msg._data.id.participant;
      }
    }

    const remotePhone = cleanPhone(remoteId);
    const fromPhone = cleanPhone(fromId);
    const toPhone = cleanPhone(toId);

    // Self-Chat Detection: When user messages themselves ("Message yourself" / chat with own number)
    const isSelfChat = (myPhone && (remotePhone === myPhone || fromPhone === myPhone && toPhone === myPhone)) || 
                       (myWid && (remoteId === myWid || fromId === toId));

    // If message is outgoing to someone else (e.g. an SMS notification to a parent), do not auto-reply
    if (msg.fromMe && !isSelfChat) {
      return;
    }

    const targetChatId = remoteId || (isSelfChat ? myWid : fromId);
    const cleanNumber = isSelfChat ? myPhone : (cleanPhone(senderRaw) || remotePhone || fromPhone);
    if (!cleanNumber || cleanNumber.length < 6) return;

    // Loop protection signatures
    if (
      bodyText.includes('Academic Assistant') ||
      bodyText.includes('Career Xone AI') ||
      bodyText.includes('ATTENDANCE REPORT') ||
      bodyText.includes('LATEST TEST RESULT') ||
      bodyText.includes('CLASS TIMETABLE') ||
      bodyText.includes('PERFORMANCE SUMMARY') ||
      bodyText.includes('Admission & Fee Counseling Desk') ||
      bodyText.includes('Empowering Students')
    ) {
      return;
    }

    // Anti-loop rate limiting
    const now = Date.now();
    const lastReplied = lastRepliedTimeMap.get(cleanNumber) || 0;
    if (now - lastReplied < COOLDOWN_MS) {
      logWarn('WHATSAPP_AI', `⏳ Cooldown active for ${cleanNumber}. Skipping duplicate.`);
      return;
    }
    lastRepliedTimeMap.set(cleanNumber, now);

    logInfo('WHATSAPP_AI', `📩 Processing AI Query from ${cleanNumber}${isSelfChat ? ' (Self-Test)' : ''}: "${bodyText.slice(0, 80)}"`);

    // Lookup Student from DB by parent phone, student phone, or rollNo
    const Student = mongoose.model('Student');
    const studentQuery = {
      isDeleted: { $ne: true },
      $or: [
        { parentPhone: { $regex: cleanNumber } },
        { parentPhone2: { $regex: cleanNumber } },
        { phone: { $regex: cleanNumber } },
        { rollNo: cleanNumber }
      ]
    };

    const students = await Student.find(studentQuery).limit(3);

    let replyText = '';
    let studentName = '';
    let rollNo = '';

    if (students && students.length > 0) {
      const student = students[0];
      studentName = student.name;
      rollNo = student.rollNo;
      replyText = await generateSmartStudentReply(student, bodyText, cleanNumber);
    } else {
      studentName = pushName ? `${pushName} (Guest)` : 'Guest / Inquiry';
      replyText = await generateSmartGuestReply(bodyText, cleanNumber);
    }

    if (replyText) {
      markBotSent(replyText); // Remember AI text to prevent loop
      await client.sendMessage(targetChatId, replyText);
      logInfo('WHATSAPP_AI', `📤 Replied to ${cleanNumber} [Student: ${studentName || 'Guest'}]: "${replyText.slice(0, 80)}..."`);
      recordBotLog({
        phone: cleanNumber,
        studentName,
        rollNo,
        incomingText: bodyText,
        botReply: replyText,
        status: 'replied'
      });
    }
  } catch (err) {
    logError('WHATSAPP_AI', 'Error processing incoming WhatsApp message', err);
  }
}

// 5. Ultra-Smart NLP Student & Parent Contextual Reply Generator
export async function generateSmartStudentReply(student, rawQuery, phone) {
  const q = normalizeQuery(rawQuery);
  const coaching = botConfig.coachingName || 'Career Xone';

  // Check Custom FAQs first
  if (Array.isArray(botConfig.customFaqs)) {
    for (const faq of botConfig.customFaqs) {
      if (faq.keywords && faq.keywords.some(kw => q.includes(kw.toLowerCase()))) {
        return faq.answer.replace(/{student_name}/g, student.name).replace(/{roll_no}/g, student.rollNo);
      }
    }
  }

  // 1️⃣ STRICT FEE / PAYMENT POLICY: Redirect immediately to Official Counseling Helpline
  const feeRegex = /\b(fee|fees|payment|installment|kist|paisa|rupee|charges|cost|kitna\s*paisa|due|dues|balance|discount|scholarship)\b/i;
  if (feeRegex.test(q) || q === '3') {
    return getFeeCounselingReply(student);
  }

  // 2️⃣ LEAVE APPLICATION / ILLNESS INTIMATION: Auto-Acknowledgement & Concern
  const leaveRegex = /\b(leave\s*application|bimar|tabiyat|tabiat|fever|bukhar|hospital|out\s*of\s*station|nahi\s*aayega|aaj\s*nahi\s*aayega|chutti\s*hai|chutti\s*chahiye)\b/i;
  if (leaveRegex.test(q)) {
    return getLeaveIntimationReply(student);
  }

  // 3️⃣ PARENT COUNSELING & CONCERN (Marks kam kyu aaye, padhai me dhyan, etc.)
  const worryRegex = /\b(kam\s*marks|focus|dhyan\s*nahi|improve|weak|padhta\s*nahi|problem|tension|dar\s*lag\s*raha)\b/i;
  if (worryRegex.test(q)) {
    return getParentCounselingGuidanceReply(student);
  }

  // 4️⃣ SYLLABUS, HOMEWORK & NOTES QUERY
  const studyRegex = /\b(syllabus|homework|notes|assignment|study\s*material|curriculum|kya\s*padhaya|doubt)\b/i;
  if (studyRegex.test(q)) {
    return getSyllabusHomeworkReply(student);
  }

  // 5️⃣ LOCATION, ADDRESS & MAP GUIDE
  const locationRegex = /\b(location|address|kahan\s*hai|kidhar\s*hai|landmark|route|map|direction)\b/i;
  if (locationRegex.test(q)) {
    return getLocationGuideReply();
  }

  // 6️⃣ TIMETABLE & BATCH TIMINGS
  const timeRegex = /\b(timetable|time\s*table|schedule|routine|kab\s*hai|timing|class\s*timing|lecture|batch\s*time)\b/i;
  if (botConfig.enableTimetable && (timeRegex.test(q) || q === '4')) {
    return await getTimetableReply(student);
  }

  // 7️⃣ COACHING SELECTIONS, TOPPERS & TRACK RECORD (IIT Bombay, NEET MBBS, CXSAT Scholarship)
  const matchedTopper = findTopperByName(rawQuery);
  if (matchedTopper) {
    return getInstituteTrackRecordReply(matchedTopper);
  }

  // 8️⃣ SCHOLARSHIP & CXSAT TEST
  const scholarshipRegex = /\b(cxsat|scholarship|discount|waiver|concession|scholarship\s*test)\b/i;
  if (scholarshipRegex.test(q)) {
    return getScholarshipDetailedReply();
  }

  // 9️⃣ COURSES & BATCHES OVERVIEW
  const courseRegex = /\b(course|courses|program|foundation|mht\s*cet|dropper|repeater|11th\s*batch|12th\s*batch)\b/i;
  if (courseRegex.test(q)) {
    return getCoursesDetailedReply();
  }

  // 🔟 SOCIAL MEDIA & CHANNELS
  const socialRegex = /\b(youtube|instagram|facebook|insta|fb|channel|video|videos)\b/i;
  if (socialRegex.test(q)) {
    return getSocialMediaReply();
  }

  const trackRecordRegex = /\b(selection|topper|toppers|iit\s*bombay|iit\s*roorkee|aiims|mbbs|past\s*result|previous\s*result|kaun\s*select|selection\s*rate|vidarbha|rohit\s*jha|doctor\s*faculty|history)\b/i;
  if (trackRecordRegex.test(q)) {
    return getInstituteTrackRecordReply();
  }

  // 1️⃣1️⃣ TEST MARKS & RESULTS (For student's own internal marks)
  const testRegex = /\b(test|marks|result|score|kitne\s*number|number\s*kitne|rank|exam|pariksha|paper|mock|test\s*series)\b/i;
  if (botConfig.enableMarks && (testRegex.test(q) || q === '2')) {
    return await getTestMarksReply(student);
  }

  // 1️⃣2️⃣ ATTENDANCE (Punch entry/exit, present/absent)
  const attendanceRegex = /\b(attend|attendance|present|absent|haajri|hajri|checkin|checkout|entry|punch|aaya|aayi|gaya|gayi|in\s*time|time\s*in)\b/i;
  if (botConfig.enableAttendance && (attendanceRegex.test(q) || q === '1' || (q.includes('aaj') && !q.includes('time') && !q.includes('class')))) {
    return await getAttendanceReply(student);
  }

  // 1️⃣3️⃣ HELPDESK & DIRECT TEACHER/OFFICE CONTACT (Priority before generic acknowledgement)
  const helpRegex = /\b(help|helpdesk|contact|phone|call|director|teacher|director\s*sir|madad|reception|office|center|helpline|kisse\s*baat\s*karein)\b/i;
  if (botConfig.enableHelp && (helpRegex.test(q) || q === '6')) {
    return getHelpDeskReply(student);
  }

  // 1️⃣4️⃣ POLITE ACKNOWLEDGEMENTS & GRATITUDE
  const thanksRegex = /\b(thank|thanks|shukriya|dhanyawad|ok|okay|thik\s*hai|theek|good|great|nice|super|shandar|good\s*morning|namaste)\b/i;
  if (thanksRegex.test(q)) {
    return `🙏 *Most welcome Sir/Madam!*

Aapko *${student.name}* ke baare me koi aur update chahiye ho, toh kabhi bhi *MENU* likhkar bhej sakte hain.

_Career Xone AI Assistant • Empowering Students_ 🎓✨`;
  }

  // 1️⃣5️⃣ PERFORMANCE SUMMARY REPORT
  const reportRegex = /\b(report|summary|progress|performance|overall|dashboard|profile|card)\b/i;
  if (botConfig.enableReport && (reportRegex.test(q) || q === '5')) {
    return await getReportSummaryReply(student);
  }

  // DEFAULT / INTENT 0: Main Interactive AI Menu
  return getMainSmartMenu(student, coaching);
}

// 🏛️ Fee Inquiry Direct Redirection (No amounts disclosed in chat)
function getFeeCounselingReply(student) {
  const p1 = botConfig.counselingPhone1 || '9673383561';
  const p2 = botConfig.counselingPhone2 || '9145481323';
  const addr = botConfig.campusAddress || 'Hadditoli Road, Near Ananya Hospital, Gondia, Maharashtra 441601';
  const mapUrl = botConfig.googleMapsUrl || 'https://maps.app.goo.gl/ECzbg6DcixL7ZxpW7';

  return `🎓 *Career Xone Admission & Fee Counseling Desk*

Namaste Sir/Madam!
*${student ? student.name : 'Student'}* ke fee structure, installment plans, aur scholarship concessions ki poori jankari hamare senior academic counselors dwara personally provide ki jaati hai.

📞 *Kripya hamari direct counseling desk par call karein:*
• 📱 *+91 ${p1}*
• 📱 *+91 ${p2}*

⏰ *Counseling Timings:* 08:00 AM - 08:00 PM (Monday to Saturday)
📍 *Campus Address:*
${addr}
🗺️ *Location Map:* ${mapUrl}

_Career Xone AI Assistant • Empowering Students_ 🎓✨`;
}

// 📝 Leave Application / Illness Notification Response
function getLeaveIntimationReply(student) {
  return `📝 *LEAVE INTIMATION RECORDED*

Namaste Sir/Madam!
Humne *${student.name}* (Roll No: *${student.rollNo}*) ke leave / absence ki jankari system me note kar li hai aur batch faculty ko notify kar diya gaya hai.

🌸 *Umeed hai ${student.name} jaldi theek ho jayenge!*
Aaj ke missed topics ke notes aur daily doubt session ke liye student coaching aane par batch faculty se direct connect kar sakte hain.

_Career Xone AI Assistant • Student Care Desk_ 🎓✨`;
}

// 💡 Parent Guidance for Student Performance & Focus
function getParentCounselingGuidanceReply(student) {
  const p1 = botConfig.counselingPhone1 || '9673383561';
  const p2 = botConfig.counselingPhone2 || '9145481323';

  return `🤝 *STUDENT ACADEMIC & MENTORSHIP SUPPORT*

Namaste Sir/Madam!
Har student ki learning speed alag hoti hai. *${student.name}* ke test analysis aur study schedule ko improve karne ke liye hamare senior mentors special doubt & strategy sessions conduct karte hain.

🎯 *Action Plan:*
1. Daily 4:00 PM - 6:00 PM open faculty doubt desk.
2. Personalized weak-topic question sets.
3. 1-on-1 discussion with Director / HOD.

📞 *Parent-Teacher Discussion ke liye call karein:*
• 📱 *+91 ${p1}*
• 📱 *+91 ${p2}*

_Career Xone AI Assistant • Empowering Students_ 🎓✨`;
}

// 📚 Syllabus, Notes & Homework Guide
function getSyllabusHomeworkReply(student) {
  return `📚 *SYLLABUS & STUDY MATERIAL OVERVIEW*
👤 *Student:* *${student.name}* (Batch: *${student.batch}*)

📖 *Academic Highlights:*
• *Daily Assignments (DPP):* Regular classroom booklets & practice sheets are distributed daily.
• *Doubt Clearing Desk:* Available Monday to Saturday (04:00 PM - 06:00 PM).
• *Upcoming Weekend Test:* OMR-based test series conducted every Sunday.

💡 Agar kisi specific chapter ke notes chahiye, toh student reception / teacher desk se collect kar sakte hain.

_Career Xone AI Assistant_ 🎓`;
}

// 📍 Campus Location & Address Guide
function getLocationGuideReply() {
  const coaching = botConfig.coachingName || 'Career Xone';
  const addr = botConfig.campusAddress || 'Hadditoli Road, Near Ananya Hospital, Gondia, Maharashtra 441601';
  const p1 = botConfig.counselingPhone1 || '9673383561';
  const p2 = botConfig.counselingPhone2 || '9145481323';
  const mapUrl = botConfig.googleMapsUrl || 'https://maps.app.goo.gl/ECzbg6DcixL7ZxpW7';
  const email = botConfig.email || 'cxjeeneet@gmail.com';

  return `📍 *${coaching} CAMPUS LOCATION & CONTACT*

🏛️ *Address:*
${addr}

🗺️ *Google Maps Live Location:*
${mapUrl}

⏰ *Visiting & Counseling Hours:*
08:00 AM - 08:00 PM (Monday to Saturday)

📞 *Helpline Numbers:*
• 📱 *+91 ${p1}*
• 📱 *+91 ${p2}*
📧 *Email:* ${email}

_Career Xone AI Assistant • Empowering Students_ 🎓✨`;
}

// 🏆 Complete Hall of Fame & Historical Toppers Knowledge Base (JEE & NEET)
const HALL_OF_FAME_TOPPERS = [
  // 🏛️ Engineering (IIT & Premier Institutes Stars)
  { name: 'Shreyansh Wankar', exam: 'JEE Advanced', college: 'IISc. BANGALORE', tag: 'Premier Research Institute' },
  { name: 'Harshit Goplani', exam: 'JEE Advanced', college: 'IIT BOMBAY', score: '99.91 %ile', tag: 'Engineering Topper' },
  { name: 'Nishant Patel', exam: 'JEE Advanced', college: 'IIT BOMBAY', score: '99.7 %ile', tag: 'Engineering Topper' },
  { name: 'Anant Asati', exam: 'JEE Advanced', college: 'IIT BOMBAY (AIR 2135)', score: '99.2 %ile', tag: 'Engineering Topper' },
  { name: 'Tanmay Bisen', exam: 'JEE Advanced', college: 'IIT BOMBAY (AIR 215)', score: '97.1 %ile', tag: 'Engineering Topper' },
  { name: 'Rishil Kolhare', exam: 'JEE Advanced', college: 'IIT BOMBAY', tag: 'Engineering Star' },
  { name: 'Harshad Rangari', exam: 'JEE Advanced', college: 'IIT BOMBAY', tag: 'Engineering Star' },
  { name: 'Pritesh Dhakate', exam: 'JEE Advanced', college: 'IIT BOMBAY', tag: 'Engineering Star' },
  { name: 'Shafak Sheikh', exam: 'JEE Advanced', college: 'IIT DELHI', tag: 'Engineering Star' },
  { name: 'Achal Choudhari', exam: 'JEE Advanced', college: 'IIT DELHI', tag: 'Engineering Star' },
  { name: 'Rishabh Parihar', exam: 'JEE Advanced', college: 'IIT KHARAGPUR (CRL 4862)', score: '99.6 %ile', tag: 'Engineering Topper' },
  { name: 'Paras Rahamatkar', exam: 'JEE Advanced', college: 'IIT KHARAGPUR', score: '99.6 %ile', tag: 'Engineering Topper' },
  { name: 'Arnav Lihare', exam: 'JEE Advanced', college: 'IIT KHARAGPUR', score: '99.17 %ile', tag: 'Engineering Topper' },
  { name: 'Bhavesh Choudhari', exam: 'JEE Advanced', college: 'IIT KHARAGPUR', score: '97.56 %ile', tag: 'Engineering Topper' },
  { name: 'Swamik Biswas', exam: 'JEE Advanced', college: 'IIT MADRAS', score: '99.91 %ile', tag: 'Engineering Star' },
  { name: 'Sankalp Kothewar', exam: 'JEE Advanced', college: 'IIT ROORKEE', tag: 'Engineering Star' },
  { name: 'Pravin Parate', exam: 'JEE Advanced', college: 'IIT HYDERABAD', score: '98.52 %ile', tag: 'Engineering Star' },
  { name: 'Kanak Gadpayle', exam: 'JEE Advanced', college: 'IIT BHU (Varanasi)', tag: 'Engineering Star' },
  { name: 'Palak Harinkhede', exam: 'JEE Advanced', college: 'IIT BHU (Varanasi)', tag: 'Engineering Star' },
  { name: 'Shrisai Khobragade', exam: 'JEE Advanced', college: 'IIT BHU (Varanasi)', tag: 'Engineering Star' },
  { name: 'Krush Agrawal', exam: 'JEE Advanced', college: 'IIT BHU (Varanasi)', tag: 'Engineering Star' },
  { name: 'Harshal Sakhare', exam: 'JEE Advanced', college: 'IIT BHU (Varanasi)', tag: 'Engineering Star' },
  { name: 'Daniyal Khan', exam: 'JEE Advanced', college: 'IIT KHARAGPUR', tag: 'Engineering Star' },
  { name: 'Sahil Bisen', exam: 'JEE Advanced', college: 'IIT KHARAGPUR', tag: 'Engineering Star' },
  { name: 'Mohini Sonwane', exam: 'JEE Mains', college: 'IIIT JABALPUR', score: '97.9 %ile', tag: 'IIITian' },
  { name: 'Mukul Patil', exam: 'JEE Mains', college: 'IIIT CHITOOR', score: '97.6 %ile', tag: 'IIITian' },
  { name: 'Janhvi Gokhale', exam: 'JEE Mains', college: 'IIIT JABALPUR', score: '97.52 %ile', tag: 'IIITian' },
  { name: 'Rohit Tandekar', exam: 'JEE Mains', college: 'IIIT ALLAHABAD (AIR 1092)', score: '97.0 %ile', tag: 'IIITian' },
  { name: 'Ananya Patel', exam: 'JEE Mains', college: 'IIIT NAGPUR', score: '97.0 %ile', tag: 'IIITian' },
  { name: 'Purvi Jangde', exam: 'JEE Mains', college: 'IIIT ALLAHABAD', tag: 'IIITian' },
  { name: 'Soham Donode', exam: 'JEE Mains', college: 'IIIT ALLAHABAD', tag: 'IIITian' },
  { name: 'Lucky Raut', exam: 'JEE Mains', college: 'IIIT ALLAHABAD', tag: 'IIITian' },
  { name: 'Abhash Hatwar', exam: 'JEE Mains', college: 'IIIT GWALIOR', tag: 'IIITian' },
  { name: 'Rohit Deshpande', exam: 'JEE Mains', college: 'IIIT PUNE', tag: 'IIITian' },
  { name: 'Sanskriti Bhaladhare', exam: 'JEE Mains', college: 'IIIT ALLAHABAD', tag: 'IIITian' },

  // 🩺 Medical (AIIMS, MAMC, Grant, BJMC & Top GMC Doctors)
  { name: 'Sourav Melekar', exam: 'NEET UG', college: 'AIIMS DELHI', score: '666 Marks', status: 'AIIMS Doctor' },
  { name: 'Prashik Shahare', exam: 'NEET UG', college: 'MAMC DELHI (Maulana Azad)', score: '670 Marks', status: 'MAMC Delhi Doctor' },
  { name: 'Harshita Khalari', exam: 'NEET UG', college: 'AIIMS NAGPUR', score: 'AIIMS Doctor', status: 'AIIMS Doctor' },
  { name: 'Prerna Hasija', exam: 'NEET UG', college: 'AIIMS RAIPUR', score: 'AIIMS Doctor', status: 'AIIMS Doctor' },
  { name: 'Anurag Ramteke', exam: 'NEET UG', college: 'AIIMS BHOPAL', score: 'AIIMS Doctor', status: 'AIIMS Doctor' },
  { name: 'Sewak Avinash Thakur', exam: 'NEET UG', college: 'AIIMS HYDERABAD', score: 'AIIMS Doctor', status: 'AIIMS Doctor' },
  { name: 'Sheekha Hanwate', exam: 'NEET UG', college: 'AIIMS NAGPUR', score: 'AIIMS Doctor', status: 'AIIMS Doctor' },
  { name: 'Shrutee Rahangdale', exam: 'NEET UG', college: 'GRANT MEDICAL COLLEGE MUMBAI', score: '642 Marks', status: 'GMC Doctor' },
  { name: 'Ayush Banote', exam: 'NEET UG', college: 'GRANT MEDICAL COLLEGE MUMBAI', score: '641 Marks', status: 'GMC Doctor' },
  { name: 'Nidhi Yele', exam: 'NEET UG', college: 'BJMC PUNE', score: '640 Marks', status: 'BJMC Pune Doctor' },
  { name: 'Kirti Chute', exam: 'NEET UG', college: 'NAIR MEDICAL COLLEGE MUMBAI', score: '630 Marks', status: 'Nair Mumbai Doctor' },
  { name: 'Divyani Bagalkar', exam: 'NEET UG', college: 'GMC NAGPUR', score: '616 Marks', status: 'GMC Nagpur Doctor' },
  { name: 'Vibha Thakare', exam: 'NEET UG', college: 'GMC NAGPUR', score: '615 Marks', status: 'GMC Nagpur Doctor' },
  { name: 'Anshul Katre', exam: 'NEET UG', college: 'IGMC NAGPUR', score: '615 Marks', status: 'IGMC Doctor' },
  { name: 'Parth Pardhi', exam: 'NEET UG', college: 'GMC YAVATMAL', score: '670 / 720 Marks', status: 'GMC Doctor' },

  // 🩺 Recent NEET 2026 Batch Top Scorers
  { name: 'Muskan Rahangdale', score: '607 Marks', exam: 'NEET 2026', type: 'Fresher', status: 'Eligible for MBBS' },
  { name: 'Veer Kumar', score: '600 Marks', exam: 'NEET 2026', type: 'Fresher', status: 'Eligible for MBBS' },
  { name: 'Sufiyan Khan', score: '594 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Gaurav Bhelave', score: '588 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Yukta Lohakar', score: '573 Marks', exam: 'NEET 2026', type: 'Fresher', status: 'Eligible for MBBS' },
  { name: 'Aastha Katre', score: '573 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Shirish Katre', score: '572 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Yashwary Gajbhiye', score: '571 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Rohini Lanjewar', score: '571 Marks', exam: 'NEET 2026', type: 'Fresher', status: 'Eligible for MBBS' },
  { name: 'Tanushree Naktode', score: '561 Marks', exam: 'NEET 2026', type: 'Fresher', status: 'Eligible for MBBS' },
  { name: 'Kalash Lilhare', score: '560 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Mrugendra Upwanshi', score: '560 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Vanshika Katre', score: '558 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Soham Gurav', score: '558 Marks', exam: 'NEET 2026', type: 'Fresher', status: 'Eligible for MBBS' },
  { name: 'Saharsh Bhure', score: '555 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Shivansh Rahangdale', score: '554 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Tanmay Hwankhede', score: '554 Marks', exam: 'NEET 2026', type: 'Fresher', status: 'Eligible for MBBS' },
  { name: 'Palak Tighare', score: '550 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Shejal Rahangdale', score: '548 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Arayan Asati', score: '547 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Love Tembhare', score: '543 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Vedant Raut', score: '540 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Pooja Mohare', score: '536 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Pratidnya Tembhurnikar', score: '534 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Sakshi Patle', score: '533 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Shadhvi Kanoje', score: '532 Marks', exam: 'NEET 2026', type: 'Fresher', status: 'Eligible for MBBS' },
  { name: 'Nihal Banothe', score: '529 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Surbhi Pardhi', score: '528 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Rohan Dhekawar', score: '527 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Pranav Nagpure', score: '524 Marks', exam: 'NEET 2026', type: 'Fresher', status: 'Eligible for MBBS' },
  { name: 'Damini Patle', score: '522 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Nikhil Kumbalwar', score: '522 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Paarthi Apar', score: '515 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Anstha Agrawal', score: '514 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Viplav Khobragade', score: '513 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Akanksha Farkunde', score: '512 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Naman Lohbhare', score: '509 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Prajakta Patil', score: '507 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Pratik Nagpure', score: '505 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Tanvi Choudhry', score: '500 Marks', exam: 'NEET 2026', type: 'Top Scorer', status: 'Eligible for MBBS' },
  { name: 'Koshika Lilhare', score: '500 Marks', exam: 'NEET 2026', type: 'Fresher', status: 'Eligible for MBBS' }
];

function findTopperByName(query) {
  if (!query) return null;
  const q = query.toLowerCase();
  for (const t of HALL_OF_FAME_TOPPERS) {
    const fullName = t.name.toLowerCase();
    const parts = fullName.split(' ');
    if (q.includes(fullName) || (parts.length > 1 && q.includes(parts[0]) && q.includes(parts[1]))) {
      return t;
    }
  }
  return null;
}

// 🏆 Career Xone Cumulative Selections, Toppers & Track Record
function getInstituteTrackRecordReply(topperMatch = null) {
  const coaching = botConfig.coachingName || 'Career Xone';
  const p1 = botConfig.counselingPhone1 || '9673383561';
  const p2 = botConfig.counselingPhone2 || '9145481323';

  if (topperMatch) {
    if (topperMatch.college) {
      return `🌟 *CAREER XONE HALL OF FAME STAR*

👤 *Student:* *${topperMatch.name}*
🏆 *Exam:* ${topperMatch.exam}
🏛️ *Selection / College:* *${topperMatch.college}*
${topperMatch.score ? `🎯 *Score / Percentile:* *${topperMatch.score}*\n` : ''}🎖️ *Achievement:* ${topperMatch.tag || 'Premier College Selection'}
🎓 *Institute:* Career Xone (Mentored by Rohit Jha Sir & Team)

_Career Xone AI Assistant • Empowering Students_ 🎓✨`;
    } else {
      return `🌟 *CAREER XONE NEET TOPPER*

👤 *Student:* *${topperMatch.name}* ${topperMatch.type ? `(${topperMatch.type})` : ''}
🏆 *Exam:* ${topperMatch.exam}
🎯 *Marks Scored:* *${topperMatch.score}*
🏥 *Status:* *${topperMatch.status}*
🎓 *Institute:* Career Xone (Mentored by Rohit Jha Sir & Team)

_Career Xone AI Assistant • Empowering Students_ 🎓✨`;
    }
  }

  return `🏆 *${coaching.toUpperCase()} — VIDARBHA'S #1 SELECTION RATE*
_12+ Years of Excellence (Since 2014) • Bringing Kota-Level Coaching to Vidarbha_

👑 *Founder & Mentor:* ROHIT JHA Sir along with top IITian & DOCTOR Faculties from across India.

🌟 *IIT-JEE (Engineering Excellence):*
• 🥇 *74+ IIT Selections* (IIT Bombay, IIT Delhi, IIT Kharagpur, IIT Madras, IIT Roorkee, IISc Bangalore)
• 🥇 *367+ NIT & IIIT Selections* across India
• 📐 *100 Percentile* in Mathematics

🩺 *NEET (Medical Excellence):*
• 🩺 *37+ Doctors in AIIMS* (AIIMS Delhi, AIIMS Nagpur, Raipur, Bhopal, Hyderabad)
• 🩺 *367+ Doctors in Top Govt Medical Colleges (GMCs)* (MAMC Delhi, Grant Mumbai, BJMC Pune)
• 🩺 *695/720* Highest NEET Score
• 🩺 *53+ Students* Eligible for MBBS in Recent Batch!

📝 *CXSAT Scholarship Test:*
Sunday Scholarship Test conducts every weekend (Up to 100% Fee Waiver).

📞 *Admissions & Scholarship Desk:*
• 📱 *+91 ${p1}*
• 📱 *+91 ${p2}*
🌐 *Website:* https://cxjeeneet.com

_Career Xone AI Assistant • Empowering Students_ 🎓✨`;
}

// 📚 Courses, Batches & Academic Programs Overview
function getCoursesDetailedReply() {
  const p1 = botConfig.counselingPhone1 || '9673383561';
  const p2 = botConfig.counselingPhone2 || '9145481323';

  return `📚 *CAREER XONE CLASSROOM & TARGET PROGRAMMES*

1️⃣ *JEE (Main & Advanced) — Engineering:*
• For: Class 11th, 12th & Repeater/Dropper Batches.
• Includes: Rigorous Kota-level pedagogy, Daily Practice Problems (DPP), Chapter-wise Theory & Question Modules, All India Test Series.

2️⃣ *NEET (UG) — Medical Entrance:*
• For: Class 11th, 12th & Repeater/Dropper Batches.
• Includes: NCERT-centric line-by-line preparation, Biology memory drills, AIIMS & GMC targeted mock tests.

3️⃣ *Foundation Programme (Class 6th to 10th):*
• Strong base building for Olympiads, NTSE, CBSE & State Board excellence.
• Covers: Science, Maths & Mental Ability (Logical Reasoning).

4️⃣ *MHT-CET & Board Acceleration:*
• State Board sync with high-speed problem solving.

⏰ *Daily Routine:*
• Morning Classes: 07:00 AM - 12:00 PM
• Afternoon Self-Study & Doubt Clearing: 02:00 PM - 08:00 PM

📞 *Batch Registration & Admission Helpline:*
• 📱 *+91 ${p1}*
• 📱 *+91 ${p2}*

_Career Xone AI Assistant • Empowering Students_ 🎓✨`;
}

// 🎁 CXSAT Scholarship Test Details
function getScholarshipDetailedReply() {
  const p1 = botConfig.counselingPhone1 || '9673383561';
  const p2 = botConfig.counselingPhone2 || '9145481323';

  return `🎁 *CAREER XONE SCHOLARSHIP ADMISSION TEST (CXSAT)*
_Talent Ko Milega Sahi Mancha — Financial constraints won't stop talent!_

📅 *Exam Schedule:* Conducted Every Sunday
🎯 *Eligible Classes:* Class 6th to 12th & Repeaters (JEE/NEET)

🏆 *Merit-Based Scholarship Slabs:*
• 🥇 *90% - 100% Score:* Up to *70% - 100% Scholarship*
• 🥈 *80% - 90% Score:* *60% Scholarship*
• 🥉 *70% - 80% Score:* *40% Scholarship*
• 🌟 *60% - 70% Score:* *25% Scholarship*

🌸 *Special Quotas:* Extra concessions for Meritorious Girls and EWS/Need-Based financial assistance.

📞 *Sunday Test Registration Desk:*
• 📱 *+91 ${p1}*
• 📱 *+91 ${p2}*
🌐 *Website:* https://cxjeeneet.com

_Career Xone AI Assistant • Empowering Students_ 🎓✨`;
}

// 🌐 Official Social Media & Online Handles
function getSocialMediaReply() {
  return `🌐 *CONNECT WITH CAREER XONE GONDIA*

Stay updated with lecture videos, topper interviews, and exam notifications:

📺 *YouTube Channel:*
https://www.youtube.com/@careerxonegondiajeeneet4961

📸 *Instagram Page:*
https://www.instagram.com/career_xone_gondia

👥 *Facebook Page:*
https://www.facebook.com/CareerXone

🌐 *Official Website:*
https://cxjeeneet.com

_Career Xone AI Assistant • Empowering Students_ 🎓✨`;
}

// 📱 Main Interactive AI Menu
function getMainSmartMenu(student, coaching) {
  return `👋 *Namaste Sir/Madam!*
Welcome to *${coaching} AI Assistant* — Personalized Portal for *${student.name}*.

👤 *Student:* *${student.name}*
🎫 *Roll No:* *${student.rollNo || '--'}*
🏷️ *Batch:* *${student.batch || '--'}*

📌 *Kripya kisi bhi jankari ke liye number ya text reply karein:*
1️⃣ *1* ya *ATTENDANCE* ➔ Live Entry/Exit & Monthly Attendance
2️⃣ *2* ya *TEST MARKS* ➔ Latest Exam Score & Batch Rank
3️⃣ *3* ya *FEES* ➔ Fee Counseling Desk & Direct Numbers
4️⃣ *4* ya *TIMETABLE* ➔ Daily Lecture & Batch Timings
5️⃣ *5* ya *REPORT* ➔ Complete Performance Report
6️⃣ *6* ya *HELP* ➔ Coaching Helpline & Director Desk

_Career Xone AI Assistant • Empowering Students_ 🎓✨`;
}

// 📊 Live Attendance Report
async function getAttendanceReply(student) {
  try {
    const Attendance = mongoose.model('Attendance');
    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonthPrefix = todayStr.slice(0, 7); // YYYY-MM

    // Today's punch
    const todayRecord = await Attendance.findOne({
      isDeleted: { $ne: true },
      studentId: student.id,
      date: todayStr
    });

    // Monthly attendance records
    const monthRecords = await Attendance.find({
      isDeleted: { $ne: true },
      studentId: student.id,
      date: { $regex: `^${currentMonthPrefix}` }
    });

    const totalDays = monthRecords.length;
    const presentDays = monthRecords.filter(r => r.status && r.status.toLowerCase() === 'present').length;
    const pct = totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : '100';

    let todayStatusText = '⚪ Not Marked Yet (Aaya nahi hai / punch baki hai)';
    if (todayRecord) {
      if (todayRecord.status && todayRecord.status.toLowerCase() === 'present') {
        const inTime = todayRecord.entryTime && todayRecord.entryTime !== '--' ? todayRecord.entryTime : 'Recorded';
        const outTime = todayRecord.exitTime && todayRecord.exitTime !== '--' ? ` | Exit: ${todayRecord.exitTime}` : '';
        todayStatusText = `🟢 *Present* (Entry: ${inTime}${outTime})`;
      } else {
        todayStatusText = `🔴 *Absent* (Aaj attend nahi kiya)`;
      }
    }

    const formattedToday = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const currentMonthName = new Date().toLocaleDateString('en-IN', { month: 'long' });

    return `📊 *LIVE ATTENDANCE REPORT*
👤 *Student:* *${student.name}* (Roll: ${student.rollNo})
📅 *Date:* ${formattedToday}

📍 *Today's Status:*
${todayStatusText}
🏛️ *Session:* ${todayRecord?.sessionName || 'Regular Batch Lecture'}

📈 *Monthly Summary (${currentMonthName}):*
• Present Days: *${presentDays}* / *${totalDays || 1}* Days
• Attendance Rate: *${pct}%*

_Reply *MENU* to see all options._
_Career Xone AI Assistant_ 🎓`;
  } catch (err) {
    return `📊 *Attendance Report for ${student.name}:* Enrolled in Batch *${student.batch}*. Regular biometric records are active. Reply *MENU* for more options.`;
  }
}

// 📝 Latest Test Marks & Rank
async function getTestMarksReply(student) {
  try {
    const TestResult = mongoose.model('TestResult');
    const Test = mongoose.model('Test');

    const results = await TestResult.find({
      isDeleted: { $ne: true },
      studentId: student.id
    }).sort({ createdAt: -1 }).limit(3);

    if (!results || results.length === 0) {
      return `📝 *Test Performance for ${student.name}:*
Abhi tak koi published exam record available nahi hai. Naye test ke marks calculate hote hi yahan instant update honge.

_Reply *MENU* for all options._
_Career Xone AI Assistant_ 🎓`;
    }

    const latest = results[0];
    let testDetails = null;
    try {
      testDetails = await Test.findOne({ id: latest.testId });
    } catch (e) {}

    const testName = testDetails?.name || 'Recent Test';
    const testDate = testDetails?.date || latest.createdAt.toISOString().split('T')[0];
    const rankStr = latest.rank ? `${latest.rank}` : '--';
    const totalStudents = latest.totalStudents ? ` / ${latest.totalStudents}` : '';

    return `📝 *LATEST EXAM PERFORMANCE*
👤 *Student:* *${student.name}* (Roll: ${student.rollNo})
🏆 *Test:* *${testName}*
📅 *Exam Date:* ${testDate}

🎯 *Marks Scored:* *${latest.marks}* / *${latest.totalMarks}* (*${latest.percentage.toFixed(1)}%*)
🥇 *Batch Rank:* *${rankStr}${totalStudents}*
💡 *Result Status:* ${latest.percentage >= 40 ? 'Passed ✅ (Good Effort)' : 'Needs Focused Practice ⚠️'}

_Reply *MENU* for all options._
_Career Xone AI Assistant_ 🎓`;
  } catch (err) {
    return `📝 *Test Marks for ${student.name}:* Records are active. Reply *MENU* for more options.`;
  }
}

// ⏰ Class Timetable & Schedule
async function getTimetableReply(student) {
  try {
    const Session = mongoose.model('Session');
    const sessions = await Session.find({
      isDeleted: { $ne: true },
      $or: [
        { batchId: student.batch },
        { batchId: 'all' }
      ]
    });

    let sessionLines = '';
    if (sessions && sessions.length > 0) {
      sessionLines = sessions.map(s => `• *${s.name}*: ${s.startTime} - ${s.endTime}`).join('\n');
    } else {
      sessionLines = '• *Regular Batch Sessions*: 08:30 AM - 12:30 PM (Mon-Sat)\n• *Doubt Clearing*: 04:00 PM - 06:00 PM';
    }

    return `⏰ *CLASS TIMETABLE & SCHEDULE*
👤 *Student:* *${student.name}*
🏷️ *Batch:* *${student.batch}* ${student.class ? `(Class ${student.class})` : ''}

📅 *Daily Lectures & Timings:*
${sessionLines}

_Reply *MENU* for all options._
_Career Xone AI Assistant_ 🎓`;
  } catch (err) {
    return `⏰ *Batch Details:* ${student.name} is in Batch *${student.batch}*. Reply *MENU* for options.`;
  }
}

// 📋 Comprehensive Performance Summary
async function getReportSummaryReply(student) {
  try {
    const Attendance = mongoose.model('Attendance');
    const TestResult = mongoose.model('TestResult');

    const totalAttendance = await Attendance.countDocuments({ isDeleted: { $ne: true }, studentId: student.id });
    const presentCount = await Attendance.countDocuments({ isDeleted: { $ne: true }, studentId: student.id, status: { $regex: /present/i } });
    const attPct = totalAttendance > 0 ? ((presentCount / totalAttendance) * 100).toFixed(1) : '100';

    const latestResult = await TestResult.findOne({ isDeleted: { $ne: true }, studentId: student.id }).sort({ createdAt: -1 });

    return `📋 *COMPLETE ACADEMIC REPORT*
👤 *Student:* *${student.name}*
🎫 *Roll No:* *${student.rollNo}*
🏷️ *Batch:* *${student.batch}*

📈 *Overall Attendance:* *${attPct}%* (${presentCount} Days Present)
📝 *Latest Exam Score:* ${latestResult ? `*${latestResult.marks}/${latestResult.totalMarks}* (${latestResult.percentage.toFixed(1)}%)` : 'Active'}
🌟 *Institute:* ${botConfig.coachingName || 'Career Xone'}

_Reply *MENU* to see all options._
_Career Xone AI Assistant_ 🎓`;
  } catch (err) {
    return `📋 *Summary for ${student.name}:* Enrolled in Batch ${student.batch}. Reply *MENU* for options.`;
  }
}

// 📞 Helpdesk & Direct Contact
function getHelpDeskReply(student) {
  const coaching = botConfig.coachingName || 'Career Xone';
  const p1 = botConfig.counselingPhone1 || '9673383561';
  const p2 = botConfig.counselingPhone2 || '9145481323';
  const addr = botConfig.campusAddress || 'Hadditoli Road, Near Ananya Hospital, Gondia, Maharashtra 441601';
  const mapUrl = botConfig.googleMapsUrl || 'https://maps.app.goo.gl/ECzbg6DcixL7ZxpW7';
  const email = botConfig.email || 'cxjeeneet@gmail.com';

  return `🏛️ *${coaching} Academic Helpdesk & Support*

Aap direct coaching reception ya director desk par call kar sakte hain:
📞 *Primary Helpline:* *+91 ${p1}*
📞 *Alternate Helpline:* *+91 ${p2}*
📧 *Official Email:* ${email}

⏰ *Office Hours:* 08:00 AM - 08:00 PM (Monday to Saturday)
📍 *Campus Location:*
${addr}
🗺️ *Map:* ${mapUrl}

_Career Xone AI Assistant • Empowering Students_ 🎓✨`;
}

// 👤 Smart Guest / Non-Student Inquiry Handler
export async function generateSmartGuestReply(rawQuery, phone) {
  const coaching = botConfig.coachingName || 'Career Xone';
  const q = normalizeQuery(rawQuery);
  const p1 = botConfig.counselingPhone1 || '9673383561';
  const p2 = botConfig.counselingPhone2 || '9145481323';

  // 1️⃣ Greetings & Warm Welcome (e.g. "Good morning", "Hello", "Hi", "Namaste")
  const greetingRegex = /\b(good\s*morning|good\s*afternoon|good\s*evening|hello|hi|hey|namaste|namaskar|pranam|ram\s*ram)\b/i;
  if (greetingRegex.test(q)) {
    return `👋 *Namaste & Welcome to ${coaching}!*

Aapka swagat hai! Hum aapki kya sahayata kar sakte hain?
📌 *Aap in vishayon par reply karke jankari le sakte hain:*
1️⃣ *COURSES* ➔ 11th, 12th, NEET, JEE & Foundation
2️⃣ *FEES* ➔ Fee Counseling Desk & Installment Options
3️⃣ *SCHOLARSHIP* ➔ Sunday CXSAT Test (Upto 100% Waiver)
4️⃣ *RESULTS* ➔ Toppers, AIIMS & IIT Selections
5️⃣ *LOCATION* ➔ Campus Address & Google Maps Link
6️⃣ *CONTACT* ➔ Direct Helplines: +91 ${p1} / +91 ${p2}

_Career Xone AI Assistant • Empowering Students_ 🎓✨`;
  }

  // 2️⃣ Polite Acknowledgements & Gratitude (e.g. "Ok sir", "Thank you", "Theek hai", "Ji sir")
  const ackRegex = /\b(ok|okay|ok\s*sir|theek\s*hai|thik\s*hai|thik\s*h|theek\s*h|thank|thanks|shukriya|dhanyawad|ji\s*sir|achha|acha|samajh\s*gaya|got\s*it)\b/i;
  if (ackRegex.test(q)) {
    return `🙏 *Most welcome Sir/Madam!*

Career Xone ke courses, admissions, scholarship test ya campus visit ke baare me koi aur jankari chahiye ho, toh batayein.

📞 *Direct Counseling Desk:* *+91 ${p1}* / *+91 ${p2}*

_Career Xone AI Assistant • Student Care Desk_ 🎓✨`;
  }

  // 3️⃣ Fee / Payment / Installments inquiry (Includes typo 'fess', 'fee', 'kist', etc.)
  const feeRegex = /\b(fee|fees|payment|installment|kist|paisa|cost|admission|charge|charges|kitna\s*lagega)\b/i;
  if (feeRegex.test(q)) {
    return getFeeCounselingReply(null);
  }

  // 4️⃣ Direct Contact Number / Helpline / Phone inquiry
  const contactRegex = /\b(contact|phone|call|number|helpline|reception|office|director|madad|kisse\s*baat\s*karein|baat\s*karni\s*hai)\b/i;
  if (contactRegex.test(q)) {
    return getHelpDeskReply(null);
  }

  // 5️⃣ CXSAT Scholarship Test
  const scholarshipRegex = /\b(cxsat|scholarship|discount|waiver|concession|scholarship\s*test)\b/i;
  if (scholarshipRegex.test(q)) {
    return getScholarshipDetailedReply();
  }

  // 6️⃣ Courses & Classroom Batches
  const courseRegex = /\b(course|courses|program|foundation|mht\s*cet|dropper|repeater|11th|12th|class\s*11|class\s*12)\b/i;
  if (courseRegex.test(q)) {
    return getCoursesDetailedReply();
  }

  // 7️⃣ Social Media / YouTube / Instagram
  const socialRegex = /\b(youtube|instagram|facebook|insta|fb|channel|video|videos)\b/i;
  if (socialRegex.test(q)) {
    return getSocialMediaReply();
  }

  // 8️⃣ Specific Topper / Results inquiry
  const matchedTopper = findTopperByName(rawQuery);
  if (matchedTopper) {
    return getInstituteTrackRecordReply(matchedTopper);
  }

  const trackRecordRegex = /\b(selection|topper|toppers|iit\s*bombay|iit\s*roorkee|aiims|mbbs|past\s*result|previous\s*result|kaun\s*select|selection\s*rate|vidarbha|rohit\s*jha|doctor\s*faculty|result|neet|jee|topper\s*list)\b/i;
  if (trackRecordRegex.test(q)) {
    return getInstituteTrackRecordReply();
  }

  // 9️⃣ Location / Address inquiry
  if (q.includes('location') || q.includes('address') || q.includes('map') || q.includes('kahan') || q.includes('kidhar')) {
    return getLocationGuideReply();
  }

  // 🔟 Smart Concise Fallback Menu (No repetitive essays!)
  return `👋 *Career Xone AI Assistant*

Aapki query samajhne me thodi dikkat hui. Kripya kisi bhi jankari ke liye vishay reply karein:

1️⃣ *COURSES* ➔ JEE, NEET, Foundation & Droppers
2️⃣ *FEES* ➔ Fee Structure & Installment Helpdesk
3️⃣ *SCHOLARSHIP* ➔ Sunday CXSAT Test (Upto 100%)
4️⃣ *RESULTS* ➔ Toppers & IIT/AIIMS Selections
5️⃣ *LOCATION* ➔ Campus Address & Google Maps
6️⃣ *CONTACT* ➔ +91 ${p1} / +91 ${p2}

_Career Xone AI Assistant • Empowering Students_ 🎓✨`;
}
