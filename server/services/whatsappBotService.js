import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { logInfo, logError, logWarn } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.join(__dirname, '../whatsapp_ai_config.json');

let botConfig = {
  enabled: false,
  paused: true,
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
const userSessionStudentMap = new Map(); // phone -> { student, timestamp }
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
    // 🛑 PERMANENTLY PAUSED GUARD: Zero automated replies
    if (!botConfig.enabled || botConfig.paused === true) return;
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

    let targetChatId = remoteId || fromId || (isSelfChat ? myWid : '');
    const cleanNumber = isSelfChat ? myPhone : (cleanPhone(senderRaw) || remotePhone || fromPhone);
    if (!cleanNumber || cleanNumber.length < 6) return;

    if (cleanNumber && (targetChatId.includes('@lid') || targetChatId.includes(':'))) {
      targetChatId = `${cleanNumber.length === 10 ? '91' + cleanNumber : cleanNumber}@c.us`;
    }

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

    // Anti-loop rate limiting: only debounce identical duplicate text within 2 seconds
    const now = Date.now();
    const lastData = lastRepliedTimeMap.get(cleanNumber) || { time: 0, text: '' };
    if (lastData.text === bodyText && (now - lastData.time < 2000)) {
      logWarn('WHATSAPP_AI', `⏳ Duplicate message ignored for ${cleanNumber}: "${bodyText}"`);
      return;
    }
    lastRepliedTimeMap.set(cleanNumber, { time: now, text: bodyText });

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

    let students = await Student.find(studentQuery).limit(3);
    let hasExplicitRollQuery = false;
    let replyText = null;

    let explicitNotFoundRollOrName = null;

    // If not linked by phone, check if user provided a Roll Number in text
    if (!students || students.length === 0) {
      const rollMatch = bodyText.match(/\b(?:roll\s*no\.?|roll\s*number|rollno|roll|id)\s*[:\-#]?\s*([0-9a-zA-Z]+)\b/i) ||
                        bodyText.match(/^\s*([0-9]{1,8})\s*$/);
      if (rollMatch) {
        const potentialRoll = rollMatch[1].trim();
        const foundByRoll = await Student.findOne({
          isDeleted: { $ne: true },
          $or: [
            { rollNo: potentialRoll },
            { rollNo: potentialRoll.replace(/^0+/, '') },
            { rollNo: String(parseInt(potentialRoll, 10)) },
            { id: potentialRoll }
          ]
        });
        if (foundByRoll) {
          students = [foundByRoll];
          hasExplicitRollQuery = true;
          userSessionStudentMap.set(cleanNumber, { student: foundByRoll, timestamp: Date.now() });
        } else {
          explicitNotFoundRollOrName = potentialRoll;
        }
      }
    }

    // If still not found by roll, search if user mentioned a student's full or first name in text (e.g. "Prince", "Prince Kumar")
    if ((!students || students.length === 0) && !explicitNotFoundRollOrName) {
      const cleanWords = bodyText.replace(/[^a-zA-Z\s]/g, ' ').trim().split(/\s+/).filter(w => w.length >= 3 && !/^(kya|hai|mere|mera|meri|bete|beta|beti|bacha|bachha|bache|bachi|batao|bata|sakta|dekhna|janna|please|sir|madam|coaching|class|test|marks|report|result|attendance|kaun|kab|kahan|kaise|hello|menu|fees|course)$/i.test(w));
      
      if (cleanWords.length >= 1 && cleanWords.length <= 3) {
        const nameQuery = cleanWords.join(' ');
        const matchingStudents = await Student.find({
          isDeleted: { $ne: true },
          name: { $regex: new RegExp(nameQuery, 'i') }
        }).limit(5);

        if (matchingStudents && matchingStudents.length === 1) {
          students = matchingStudents;
          userSessionStudentMap.set(cleanNumber, { student: matchingStudents[0], timestamp: Date.now() });
        } else if (matchingStudents && matchingStudents.length > 1) {
          replyText = `🔍 *${matchingStudents.length} Students Mile:* Kripya student ka Roll Number likhkar bhejein:\n` +
            matchingStudents.map(s => `• *${s.name}* ➔ \`ROLL ${s.rollNo}\``).join('\n');
        }
      }
    }

    // If still not found, check conversation session memory (within 2 hours)
    if (!students || students.length === 0) {
      const activeSession = userSessionStudentMap.get(cleanNumber);
      if (activeSession && (Date.now() - activeSession.timestamp < 2 * 3600 * 1000)) {
        students = [activeSession.student];
      }
    }

    let studentName = '';
    let rollNo = '';

    if (!replyText) {
      if (students && students.length > 0) {
        const student = students[0];
        studentName = student.name;
        rollNo = student.rollNo;
        userSessionStudentMap.set(cleanNumber, { student, timestamp: Date.now() });

        // If user specifically searched / provided this roll number, show their 360° Academic Summary immediately!
        if (hasExplicitRollQuery) {
          replyText = await getReportSummaryReply(student);
        } else {
          replyText = await generateSmartStudentReply(student, bodyText, cleanNumber);
        }
      } else if (explicitNotFoundRollOrName) {
        const p1 = botConfig.counselingPhone1 || '9673383561';
        replyText = `❌ *Student Record Nahi Mila*

Roll Number \`${explicitNotFoundRollOrName}\` hamare registered database me nahi mila.

🔍 *Kripya check karein:*
1. Student ka sahi **Roll Number** (jaise: \`340\`)
2. Ya student ka **Full Name** (jaise: \`Prince Kumar\`) likhkar bhejein.

📞 Direct Helpdesk: *+91 ${p1}*`;
      } else {
        studentName = pushName ? `${pushName} (Guest)` : 'Guest / Inquiry';
        replyText = await generateSmartGuestReply(bodyText, cleanNumber);
      }
    }

    if (replyText) {
      markBotSent(replyText); // Remember AI text to prevent loop
      
      let finalSendChatId = targetChatId;
      if (!finalSendChatId || finalSendChatId.includes('@lid') || finalSendChatId.includes(':')) {
        const digits = cleanNumber.replace(/\D/g, '');
        finalSendChatId = `${digits.length === 10 ? '91' + digits : digits}@c.us`;
      }

      try {
        if (typeof msg.reply === 'function' && !isSelfChat) {
          await msg.reply(replyText);
        } else {
          await client.sendMessage(finalSendChatId, replyText);
        }
      } catch (sendErr) {
        logWarn('WHATSAPP_AI', `Failed to send via primary route, falling back to finalSendChatId: ${sendErr.message}`);
        await client.sendMessage(finalSendChatId, replyText);
      }
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

// =========================================================================================
// 🧠 MASTER CONTEXTUAL SENTENCE COMPREHENSION & MULTI-LAYER NLP INTENT ENGINE
// Understands full sentences, natural Hindi/Hinglish speech, parent inquiries, and complex clauses
// =========================================================================================

const SEMANTIC_INTENTS = {
  ATTENDANCE: {
    id: 'ATTENDANCE',
    stems: [
      'attend', 'attendance', 'present', 'absent', 'haajri', 'hajri', 'checkin', 'checkout',
      'entry', 'exit', 'punch', 'biometric', 'thumb', 'aaya', 'aayi', 'aaye', 'aayen',
      'gaya', 'gayi', 'gaye', 'pahucha', 'pahuncha', 'pahuch', 'pahunch', 'in time', 'out time',
      'gate pass', 'scan', 'nikla', 'nikli', 'chhoot', 'chhutti kab', 'ghar kab'
    ],
    phrases: [
      'coaching me hai kya', 'coaching me hai', 'class me hai kya', 'class me hai',
      'center me hai kya', 'institute me hai kya', 'aaj gaya hai kya', 'aaj gayi hai kya',
      'aaj pahuncha kya', 'entry hui kya', 'punch hua kya', 'kitne baje aaya', 'kitne baje nikla',
      'kitne baje chhutti', 'ghar kab aayega', 'ghar kab bhejoge', 'aaj present hai',
      'aaj absent kyu', 'absent dikha raha hai', 'biometric laga kya', 'thumb laga kya',
      'live status', 'aaj ki haajri', 'monthly attendance', 'attendance percentage'
    ],
    relationTriggers: ['beta', 'beti', 'bacha', 'bachha', 'bache', 'bachi', 'ladka', 'ladki', 'ward', 'student'],
    relationContexts: ['coaching', 'class', 'aaya', 'gaya', 'hai', 'kahan', 'kidhar', 'pahuncha']
  },

  TEST_MARKS: {
    id: 'TEST_MARKS',
    stems: [
      'test', 'marks', 'mark', 'result', 'score', 'number', 'rank', 'exam', 'pariksha',
      'paper', 'mock', 'omr', 'percentile', 'percentage', 'highest', 'topper', 'cutoff',
      'physics', 'chemistry', 'biology', 'maths', 'zoology', 'botany', 'answer key', 'solution'
    ],
    phrases: [
      'kitne number aaye', 'kitne marks mile', 'test ka score', 'rank kya hai',
      'class me kya rank', 'kaisa perform kiya', 'performance kaisa hai', 'result kaisa raha',
      'omr test ka marks', 'sunday test result', 'physics me kitne', 'chemistry me kitne',
      'bio me kitne', 'maths me kitne', 'highest score kitna', 'test series result',
      'marks sheet', 'score card', 'latest test'
    ]
  },

  TIMETABLE: {
    id: 'TIMETABLE',
    stems: [
      'timetable', 'schedule', 'routine', 'timing', 'lecture', 'batch time', 'holiday',
      'chhutti', 'chutti', 'khula', 'band', 'sunday test time', 'subah', 'shaam', 'evening', 'morning'
    ],
    phrases: [
      'aaj coaching khula hai', 'aaj coaching khula hai kya', 'aaj class hai kya',
      'aaj chhutti hai kya', 'kal class hai kya', 'kal chhutti hai kya', 'kitne baje aana hai',
      'kitne baje se class', 'kab se kab tak', 'lecture timing', 'class routine', 'batch schedule',
      'physics ki class kab', 'chemistry ki class kab', 'bio ki class kab', 'maths ki class kab',
      'doubt counter timing', 'sunday test kitne baje'
    ]
  },

  LEAVE: {
    id: 'LEAVE',
    stems: [
      'leave', 'bimar', 'bimari', 'tabiyat', 'tabiat', 'fever', 'bukhar', 'hospital',
      'doctor', 'out of station', 'shadi', 'wedding', 'function', 'emergency', 'urgent',
      'gaon', 'application', 'absent application'
    ],
    phrases: [
      'aaj nahi aayega', 'aaj nahi aa payega', 'aaj nahi aayegi', 'aaj nahi aa sakti',
      'tabiyat kharab hai', 'bukhar aa gaya', 'hospital jana hai', 'gaon gaye hain',
      'do din nahi aayega', 'kal nahi aayega', 'chhutti chahiye', 'leave note kar lo',
      'absent rahega', 'attend nahi kar payega'
    ]
  },

  MENTORSHIP: {
    id: 'MENTORSHIP',
    stems: [
      'focus', 'dhyan', 'weak', 'kamzor', 'padhta nahi', 'padhti nahi', 'phone',
      'distract', 'distraction', 'tension', 'dar', 'ptm', 'meeting', 'rohit sir',
      'mentor', 'mentorship', 'counseling', 'guidance', 'backlog', 'strategy'
    ],
    phrases: [
      'marks kam aa rahe hain', 'padhai me dhyan nahi de raha', 'padhta nahi hai',
      'phone chalata rehta hai', 'focus nahi kar pa raha', 'rohit jha sir se milna hai',
      'director sir se baat', 'teacher se baat karni hai', 'parents meeting kab hai',
      'ptm kab hai', 'physics me bahut weak hai', 'chemistry samajh nahi aati',
      'doubt clear nahi ho rahe', 'extra class mil sakti hai', 'backlog kaise karein'
    ]
  },

  REPORT: {
    id: 'REPORT',
    stems: [
      'report', 'summary', 'progress', 'overall', 'dashboard', 'profile', 'card',
      'performance report', 'status', 'review', 'kaisa padh raha', 'kaisa chal raha'
    ],
    phrases: [
      'bete ke bare me batao', 'bache ke bare me batao', 'meri beti ke bare me batao',
      'student ke bare me batao', 'report card bhejo', 'progress card do',
      'overall performance', 'pura detail bhejo', 'kaisa padh raha hai', 'academic summary'
    ]
  },

  FEES: {
    id: 'FEES',
    stems: [
      'fee', 'fees', 'payment', 'installment', 'kist', 'paisa', 'cost', 'charge',
      'due', 'dues', 'balance', 'receipt', 'slip', 'concession', 'discount', 'qr code', 'bank'
    ],
    phrases: [
      'fees kitni hai', 'fee structure kya hai', 'kitna paisa lagega', 'installment me de sakte hain',
      'kist me payment', 'baki fees kitni hai', 'due date kab hai', 'fee receipt bhejo',
      'payment kaise karein', 'online payment link', 'qr code bhejo'
    ]
  },

  SCHOLARSHIP: {
    id: 'SCHOLARSHIP',
    stems: [
      'cxsat', 'scholarship', 'waiver', 'scholarship test', 'sunday test', 'free admission', 'concession test'
    ],
    phrases: [
      'scholarship test kab hai', 'cxsat kya hai', '100% scholarship kaise milegi',
      'scholarship form', 'test me discount kitna', 'sunday scholarship test'
    ]
  },

  COURSES: {
    id: 'COURSES',
    stems: [
      'course', 'courses', 'program', 'programmes', 'foundation', 'dropper', 'repeater',
      '11th', '12th', 'class 11', 'class 12', 'mht cet', 'crash course'
    ],
    phrases: [
      'kaun se courses hain', 'jee ke courses', 'neet ke courses', 'foundation batch',
      'dropper batch kab shuru', '11th admission', '12th admission', 'mht cet batch'
    ]
  },

  TOPPERS: {
    id: 'TOPPERS',
    stems: [
      'topper', 'toppers', 'selection', 'selections', 'iit bombay', 'aiims', 'mbbs',
      'rank 1', 'highest score', 'history', 'track record', 'faculty', 'teachers'
    ],
    phrases: [
      'topper kaun hai', 'pichhle saal kitne select huye', 'iit me kitne bache gaye',
      'aiims me kitne doctor bane', 'highest marks kitna tha', 'rohit jha sir ka result',
      'teachers kaise hain', 'faculty team'
    ]
  },

  LOCATION: {
    id: 'LOCATION',
    stems: [
      'location', 'address', 'map', 'google map', 'landmark', 'hospital', 'station',
      'hostel', 'mess', 'transport', 'van', 'bus'
    ],
    phrases: [
      'coaching kahan par hai', 'gondia me address', 'google maps link', 'ananya hospital ke pass',
      'railway station se kitni dur', 'hostel suvidha hai kya', 'mess suvidha', 'van facility'
    ]
  },

  STUDY_MATERIAL: {
    id: 'STUDY_MATERIAL',
    stems: [
      'dpp', 'module', 'modules', 'notes', 'homework', 'assignment', 'book', 'books',
      'study material', 'formula sheet', 'ncert', 'question bank'
    ],
    phrases: [
      'dpp mila kya', 'study material kab मिलेगा', 'modules kahan milenge',
      'notes download', 'homework kya mila hai', 'formula book'
    ]
  },

  SOCIAL: {
    id: 'SOCIAL',
    stems: ['youtube', 'instagram', 'facebook', 'insta', 'fb', 'channel', 'video', 'videos', 'website'],
    phrases: ['youtube link', 'instagram handle', 'online videos', 'official website']
  },

  CONTACT: {
    id: 'CONTACT',
    stems: ['contact', 'phone', 'call', 'number', 'helpline', 'reception', 'office', 'director number'],
    phrases: ['reception ka number', 'director sir ka number', 'kisse baat karein', 'office helpline']
  },

  GREETINGS: {
    id: 'GREETINGS',
    stems: ['namaste', 'pranam', 'good morning', 'hello', 'hi', 'hey', 'radhe radhe', 'ram ram', 'menu', 'start', 'help'],
    phrases: ['good morning', 'good afternoon', 'good evening', 'namaste sir', 'ram ram ji']
  },

  THANKS: {
    id: 'THANKS',
    stems: ['thank', 'thanks', 'shukriya', 'dhanyawad', 'ok', 'okay', 'theek hai', 'thik hai', 'got it', 'samajh gaya'],
    phrases: ['thank you sir', 'ok sir', 'bahut badhiya', 'theek hai sir']
  }
};

// 🧠 Advanced Sentence Semantic Intent Classifier
function classifySentenceIntent(normalizedQuery, rawQuery, isStudentContext = true) {
  const q = normalizedQuery.toLowerCase();
  const raw = rawQuery.toLowerCase();
  
  const scores = {};
  for (const intentKey of Object.keys(SEMANTIC_INTENTS)) {
    scores[intentKey] = 0;
  }

  // 1. Check exact phrase matches (Highest Weight: 10)
  for (const [key, intent] of Object.entries(SEMANTIC_INTENTS)) {
    if (intent.phrases) {
      for (const phrase of intent.phrases) {
        if (q.includes(phrase) || raw.includes(phrase)) {
          scores[key] += 10;
        }
      }
    }
  }

  // 2. Check keyword stems (Weight: 2.5 per match)
  for (const [key, intent] of Object.entries(SEMANTIC_INTENTS)) {
    if (intent.stems) {
      for (const stem of intent.stems) {
        const regex = new RegExp('\\b' + stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
        if (regex.test(q) || regex.test(raw)) {
          scores[key] += 2.5;
        }
      }
    }
  }

  // 3. Domain-Specific Disambiguation Boosters
  if (/\b(iit|aiims|neet\s*topper|jee\s*topper|selection|selections|kitne\s*select|kitne\s*gaye|result\s*kaisa|history|record)\b/i.test(raw)) {
    scores.TOPPERS += 15;
  }

  if (/\b(bare\s*me|kaisa\s*padh|kaisa\s*chal|profile|summary|overall\s*report|performance\s*report|details\s*bhejo)\b/i.test(q)) {
    scores.REPORT += 12;
  }

  // 4. Relational context booster for parent questions (e.g. "Mera beta coaching me hai kya")
  const hasRelation = /\b(beta|beti|bacha|bachha|bache|bachi|ladka|ladki|ward|student|son|daughter)\b/i.test(q) ||
                      /\b(beta|beti|bacha|bachha|bache|bachi|ladka|ladki|ward|student|son|daughter)\b/i.test(raw);
  
  if (hasRelation) {
    if (q.includes('coaching') || q.includes('class') || q.includes('pahuncha') || q.includes('aaya') || q.includes('entry') || q.includes('nikla')) {
      scores.ATTENDANCE += 8;
    }
    if (q.includes('marks') || q.includes('number') || q.includes('score') || q.includes('test')) {
      scores.TEST_MARKS += 8;
    }
    if (q.includes('bare me') || q.includes('batao') || q.includes('bata sakta') || q.includes('kaisa hai') || q.includes('report')) {
      scores.REPORT += 8;
    }
  }

  // Find maximum scoring intent
  let topIntent = 'MENU';
  let maxScore = 0;

  for (const [intentKey, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      topIntent = intentKey;
    }
  }

  return { intent: maxScore >= 2.5 ? topIntent : 'MENU', score: maxScore };
}

// 5. Ultra-Smart NLP Student & Parent Contextual Reply Generator (Handles 1000s of Natural Questions)
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

  // Perform Master Contextual Sentence Comprehension
  const { intent, score } = classifySentenceIntent(q, rawQuery, true);

  // Intent 1: Attendance / Presence
  if (intent === 'ATTENDANCE' || q === '1') {
    if (botConfig.enableAttendance) return await getAttendanceReply(student);
  }

  // Intent 2: Test Marks & Results
  if (intent === 'TEST_MARKS' || q === '2') {
    if (botConfig.enableMarks) return await getTestMarksReply(student);
  }

  // Intent 3: Timetable & Schedule
  if (intent === 'TIMETABLE' || q === '3') {
    if (botConfig.enableTimetable) return await getTimetableReply(student);
  }

  // Intent 4: Fee Structure & Payments
  if (intent === 'FEES' || q === '4') {
    return getFeeCounselingReply(student);
  }

  // Intent 5: Leave Application / Illness
  if (intent === 'LEAVE') {
    return getLeaveIntimationReply(student);
  }

  // Intent 6: Academic Guidance & Mentorship
  if (intent === 'MENTORSHIP') {
    return getParentCounselingGuidanceReply(student);
  }

  // Intent 7: 360 Degree Academic Summary Report
  if (intent === 'REPORT' || q === '5') {
    if (botConfig.enableReport) return await getReportSummaryReply(student);
  }

  // Intent 8: Specific Topper Lookup
  const matchedTopper = findTopperByName(rawQuery);
  if (matchedTopper) {
    return getInstituteTrackRecordReply(matchedTopper);
  }

  // Intent 9: Coaching Track Record & Selections
  if (intent === 'TOPPERS') {
    return getInstituteTrackRecordReply();
  }

  // Intent 10: Scholarship / CXSAT Test
  if (intent === 'SCHOLARSHIP') {
    return getScholarshipDetailedReply();
  }

  // Intent 11: Courses & Programmes
  if (intent === 'COURSES') {
    return getCoursesDetailedReply();
  }

  // Intent 12: Location & Campus Map
  if (intent === 'LOCATION') {
    return getLocationGuideReply();
  }

  // Intent 13: Study Material / DPP / Notes
  if (intent === 'STUDY_MATERIAL') {
    return getSyllabusHomeworkReply(student);
  }

  // Intent 14: Social Media Channels
  if (intent === 'SOCIAL') {
    return getSocialMediaReply();
  }

  // Intent 15: Helpdesk & Direct Contact
  if (intent === 'CONTACT' || q === '6') {
    if (botConfig.enableHelp) return getHelpDeskReply(student);
  }

  // Intent 16: Thanks / Acknowledgement
  if (intent === 'THANKS' && q !== 'menu') {
    return `🙏 *Most welcome!*

Aapko *${student.name}* ke baare me koi aur update chahiye ho, toh kabhi bhi *MENU* likhkar bhej sakte hain.`;
  }

  // Intent 17: General Greetings
  if (intent === 'GREETINGS' && q !== 'menu') {
    return `👋 *Namaste!*

Aap *${student.name}* (Roll No: *${student.rollNo}*) ke baare me kya janna chahte hain?
• 1️⃣ *Attendance* (Live Haajri)
• 2️⃣ *Marks* (Latest Test Score & Rank)
• 3️⃣ *Timetable* (Daily Lectures)
• 4️⃣ *Report* (Complete 360° Summary)`;
  }

  // DEFAULT FALLBACK: Interactive Main Menu
  return getMainSmartMenu(student, coaching);
}

// 🏛️ Fee Inquiry Direct Redirection (No amounts disclosed in chat)
function getFeeCounselingReply(student) {
  const p1 = botConfig.counselingPhone1 || '9673383561';
  const p2 = botConfig.counselingPhone2 || '9145481323';
  const addr = botConfig.campusAddress || 'Hadditoli Road, Near Ananya Hospital, Gondia, Maharashtra 441601';
  const mapUrl = botConfig.googleMapsUrl || 'https://maps.app.goo.gl/ECzbg6DcixL7ZxpW7';

  return `🎓 *Career Xone Fee Counseling Helpdesk*
*${student ? student.name : 'Student'}* ke fee structure, installment schedule, aur scholarship concession ki details hamare counselors provide karte hain:

📞 *Direct Counseling Desk:*
• 📱 *+91 ${p1}*
• 📱 *+91 ${p2}*

⏰ *Timings:* 08:00 AM - 08:00 PM (Mon-Sat)
📍 *Campus Address:* ${addr}
🗺️ *Location:* ${mapUrl}`;
}

// 📝 Leave Application / Illness Notification Response
function getLeaveIntimationReply(student) {
  return `📝 *LEAVE INTIMATION RECORDED*
Humne *${student.name}* (Roll No: *${student.rollNo}*) ke leave / absence ki jankari system me note kar li hai aur batch faculty ko notify kar diya gaya hai.

🌸 *Umeed hai ${student.name} jaldi theek ho jayenge!*
Missed topics ke notes ke liye student coaching aane par batch faculty se connect kar sakte hain.`;
}

// 💡 Parent Guidance for Student Performance & Focus
function getParentCounselingGuidanceReply(student) {
  const p1 = botConfig.counselingPhone1 || '9673383561';
  const p2 = botConfig.counselingPhone2 || '9145481323';

  return `🤝 *STUDENT ACADEMIC & MENTORSHIP SUPPORT*
*${student.name}* ke test analysis aur study schedule ko improve karne ke liye hamare senior mentors special doubt & strategy sessions conduct karte hain.

🎯 *Action Plan:*
1. Daily 4:00 PM - 6:00 PM open faculty doubt desk.
2. Personalized weak-topic question sets.
3. 1-on-1 discussion with Director / HOD.

📞 *Direct Mentorship Contact:*
• 📱 *+91 ${p1}* / *+91 ${p2}*`;
}

// 📚 Syllabus, Notes & Homework Guide
function getSyllabusHomeworkReply(student) {
  return `📚 *SYLLABUS & STUDY MATERIAL OVERVIEW*
👤 *Student:* *${student.name}* (Batch: *${student.batch}*)

📖 *Academic Highlights:*
• *Daily Assignments (DPP):* Regular classroom booklets & practice sheets are distributed daily.
• *Doubt Clearing Desk:* Available Monday to Saturday (04:00 PM - 06:00 PM).
• *Upcoming Weekend Test:* OMR-based test series conducted every Sunday.

💡 Agar kisi specific chapter ke notes chahiye, toh student reception / teacher desk se collect kar sakte hain.`;
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
📧 *Email:* ${email}`;
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
🎓 *Institute:* Career Xone (Mentored by Rohit Jha Sir & Team)`;
    } else {
      return `🌟 *CAREER XONE NEET TOPPER*

👤 *Student:* *${topperMatch.name}* ${topperMatch.type ? `(${topperMatch.type})` : ''}
🏆 *Exam:* ${topperMatch.exam}
🎯 *Marks Scored:* *${topperMatch.score}*
🏥 *Status:* *${topperMatch.status}*
🎓 *Institute:* Career Xone (Mentored by Rohit Jha Sir & Team)`;
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
🌐 *Website:* https://cxjeeneet.com`;
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
• 📱 *+91 ${p2}*`;
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
🌐 *Website:* https://cxjeeneet.com`;
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
https://cxjeeneet.com`;
}

// Helper: Format Student Target Course / Batch intelligently (e.g. "11th JEE (Main & Advanced)", "12th NEET (Medical Target)")
function formatStudentCourseBatch(student) {
  if (!student) return 'JEE / NEET Target Batch';
  const c = (student.class || '').trim();
  const b = (student.batch || '').trim();

  // 1. Analyze class field (which contains human course strings like '11th jee 1st batch ( 26-28 )', '12TH NEET 25-27', 'j1', 'n1')
  if (c) {
    const cl = c.toLowerCase();
    if (cl.includes('jee') && (cl.includes('11') || cl.includes('11th'))) return '11th JEE (Main & Advanced)';
    if (cl.includes('jee') && (cl.includes('12') || cl.includes('12th'))) return '12th JEE (Main & Advanced)';
    if (cl.includes('neet') && (cl.includes('11') || cl.includes('11th'))) return '11th NEET (Medical Target)';
    if (cl.includes('neet') && (cl.includes('12') || cl.includes('12th'))) return '12th NEET (Medical Target)';
    if (cl === 'j1' || cl === 'j2' || cl === 'jee' || cl.startsWith('jee')) return 'JEE (Main & Advanced)';
    if (cl === 'n1' || cl === 'n2' || cl === 'neet' || cl.startsWith('neet')) return 'NEET (Medical Target)';
    if (cl.includes('cet') || cl.includes('mht')) return 'MHT-CET Target Batch';
    if (cl.includes('foundation') || cl.includes('8th') || cl.includes('9th') || cl.includes('10th')) return `${c} Foundation`;

    // If it's another non-system class name, strip internal bracket ranges
    if (!cl.startsWith('batch') && cl !== 'default' && cl !== '--') {
      return c.replace(/\(\s*\d+-\d+\s*\)/g, '').trim();
    }
  }

  // 2. Analyze batch field (if not internal 'batch-1', 'batch-2', etc.)
  if (b && !/^batch[-_\s]*\d+$/i.test(b) && b.toLowerCase() !== 'batch' && b.toLowerCase() !== 'default') {
    const bl = b.toLowerCase();
    if (bl.includes('jee')) return 'JEE (Main & Advanced)';
    if (bl.includes('neet')) return 'NEET (Medical Target)';
    if (bl.includes('cet')) return 'MHT-CET Target Batch';
    return b;
  }

  return 'NEET / JEE Target Batch';
}

// 📱 Main Interactive AI Menu
function getMainSmartMenu(student, coaching) {
  const courseBatch = formatStudentCourseBatch(student);
  return `🎓 *${coaching} Student Portal* • *${student.name}*
🎫 *Roll No:* *${student.rollNo || '--'}* | 🎯 *Target:* *${courseBatch}*

📌 *Kripya number ya topic reply karein:*
1️⃣ *1* ya *ATTENDANCE* ➔ Live Haajri & Monthly %
2️⃣ *2* ya *MARKS* ➔ Latest Exam Score & Rank
3️⃣ *3* ya *TIMETABLE* ➔ Daily Lectures & Timings
4️⃣ *4* ya *FEES* ➔ Fee Counseling Helpdesk
5️⃣ *5* ya *REPORT* ➔ Complete Performance Report
6️⃣ *6* ya *HELP* ➔ Direct Helplines`;
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

_Reply *MENU* for all options._`;
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

_Reply *MENU* for all options._`;
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

_Reply *MENU* for all options._`;
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
🎯 *Course / Target:* *${formatStudentCourseBatch(student)}*

📅 *Daily Lectures & Timings:*
${sessionLines}

_Reply *MENU* for all options._`;
  } catch (err) {
    return `⏰ *Batch Details:* ${student.name} is in *${formatStudentCourseBatch(student)}*. Reply *MENU* for options.`;
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
🎯 *Course / Target:* *${formatStudentCourseBatch(student)}*

📈 *Overall Attendance:* *${attPct}%* (${presentCount} Days Present)
📝 *Latest Exam Score:* ${latestResult ? `*${latestResult.marks}/${latestResult.totalMarks}* (${latestResult.percentage.toFixed(1)}%)` : 'Active'}
🌟 *Institute:* ${botConfig.coachingName || 'Career Xone'}

_Reply *MENU* to see all options._`;
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

  // Check specific topper search first
  const matchedTopper = findTopperByName(rawQuery);
  if (matchedTopper) {
    return getInstituteTrackRecordReply(matchedTopper);
  }

  // Perform Sentence Comprehension
  const { intent } = classifySentenceIntent(q, rawQuery, false);

  // 1. Student Academic Inquiry from Unlinked Phone (Prompts for Roll No or Name)
  const isStudentRelated = ['ATTENDANCE', 'TEST_MARKS', 'TIMETABLE', 'LEAVE', 'MENTORSHIP', 'REPORT'].includes(intent) ||
                           /\b(student|students|bete|beta|beti|bacha|bachha|bache|bachey|baccha|bacche|bachi|bachhi|ward|ladka|ladki|balak|son|daughter|kid|child|attendance|marks|result|report|progress|card|haajri|hajri|score)\b/i.test(q) ||
                           /mere\s*(bete|beta|beti|bacha|bachha|bache|bachi|student)|(bete|beta|beti|bacha|bachha|bache|bachi|student)\s*ke\s*bare|kaisa\s*(padh|chal)/i.test(rawQuery);

  if (isStudentRelated) {
    return `🌸 *Namaste Sir/Madam!*

Aapka yeh WhatsApp number hamare database me kisi registered student se direct link nahi mila.

🔍 *Student ka live academic report (Haajri, Test Marks, Rank) dekhne ke liye:*
👉 Kripya student ka **Roll Number** (jaise: \`340\`) ya student ka **Full Name** (jaise: \`Prince Kumar\`) likhkar bhejein!

Hum turant unka complete academic report share kar denge.`;
  }

  // 2. Fees Inquiry
  if (intent === 'FEES') {
    return getFeeCounselingReply(null);
  }

  // 3. Scholarship CXSAT Test Inquiry
  if (intent === 'SCHOLARSHIP') {
    return getScholarshipDetailedReply();
  }

  // 4. Courses & Batches Inquiry
  if (intent === 'COURSES' || intent === 'STUDY_MATERIAL') {
    return getCoursesDetailedReply();
  }

  // 5. Track Record, Selections & Faculty
  if (intent === 'TOPPERS') {
    return getInstituteTrackRecordReply();
  }

  // 6. Location, Address & Hostel/Transport
  if (intent === 'LOCATION') {
    return getLocationGuideReply();
  }

  // 7. Contact Numbers & Office Helpdesk
  if (intent === 'CONTACT') {
    return getHelpDeskReply(null);
  }

  // 8. Social Media & Online Handles
  if (intent === 'SOCIAL') {
    return getSocialMediaReply();
  }

  // 9. Polite Acknowledgements & Gratitude
  if (intent === 'THANKS') {
    return `🙏 *Most welcome!*

Career Xone ke courses, admissions, scholarship test ya campus visit ke baare me koi aur jankari chahiye ho, toh batayein.

📞 *Direct Counseling Desk:* *+91 ${p1}* / *+91 ${p2}*`;
  }

  // 10. Greetings & Warm Welcome
  if (intent === 'GREETINGS') {
    return `👋 *Welcome to ${coaching}!*

Aap in vishayon par reply karke jankari le sakte hain:
1️⃣ *COURSES* ➔ 11th, 12th, NEET, JEE & Foundation
2️⃣ *FEES* ➔ Fee Counseling Desk & Installments
3️⃣ *SCHOLARSHIP* ➔ Sunday CXSAT Test (Upto 100%)
4️⃣ *RESULTS* ➔ Toppers, AIIMS & IIT Selections
5️⃣ *LOCATION* ➔ Campus Address & Google Maps
6️⃣ *CONTACT* ➔ Direct Helplines: +91 ${p1} / +91 ${p2}`;
  }

  // 11. Smart Concise Fallback Menu
  return `Aap in vishayon par reply karke jankari le sakte hain:

1️⃣ *COURSES* ➔ JEE, NEET, Foundation & Droppers
2️⃣ *FEES* ➔ Fee Structure & Installment Helpdesk
3️⃣ *SCHOLARSHIP* ➔ Sunday CXSAT Test (Upto 100%)
4️⃣ *RESULTS* ➔ Toppers & IIT/AIIMS Selections
5️⃣ *LOCATION* ➔ Campus Address & Google Maps
6️⃣ *CONTACT* ➔ +91 ${p1} / +91 ${p2}`;
}
