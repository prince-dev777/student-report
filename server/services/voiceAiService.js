import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import VoiceCallLog from '../models/VoiceCallLog.js';
import { logInfo, logError, logWarn } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VOICE_UPLOADS_DIR = path.join(__dirname, '../public/uploads/voice');

// Ensure uploads/voice directory exists
if (!fs.existsSync(VOICE_UPLOADS_DIR)) {
  fs.mkdirSync(VOICE_UPLOADS_DIR, { recursive: true });
}

/**
 * Synthesizes text to natural neural MP3 speech using edge-tts (100% Free)
 * @param {string} text - Text to speak in Hindi/English
 * @param {string} voice - Voice model (default: hi-IN-SwaraNeural or hi-IN-MadhurNeural)
 * @returns {Promise<{ success: boolean, audioUrl: string, filePath: string }>}
 */
export async function synthesizeSpeech(text, voice = 'hi-IN-SwaraNeural') {
  return new Promise((resolve, reject) => {
    try {
      if (!text || !text.trim()) {
        return reject(new Error('Text cannot be empty'));
      }

      const fileName = `voice_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.mp3`;
      const outputFilePath = path.join(VOICE_UPLOADS_DIR, fileName);
      const relativeUrl = `/uploads/voice/${fileName}`;

      const tempJsonPath = path.join(VOICE_UPLOADS_DIR, `args_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.json`);
      fs.writeFileSync(tempJsonPath, JSON.stringify({
        text: text.trim(),
        voice: voice || 'hi-IN-SwaraNeural',
        output_path: outputFilePath
      }, null, 2), 'utf-8');

      const pythonScriptPath = path.join(__dirname, 'voice_tts_engine.py');
      const pyProcess = spawn('python', [pythonScriptPath, tempJsonPath]);

      let stdout = '';
      let stderr = '';

      pyProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pyProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pyProcess.on('close', (code) => {
        try {
          if (fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath);
        } catch (e) {}

        if (code === 0 && fs.existsSync(outputFilePath)) {
          resolve({
            success: true,
            audioUrl: relativeUrl,
            filePath: outputFilePath,
            fileName: fileName
          });
        } else {
          logError('VOICE_AI', `TTS generation failed: ${stderr || stdout}`);
          reject(new Error(stderr || stdout || 'Voice synthesis process exited with error'));
        }
      });
    } catch (err) {
      logError('VOICE_AI', `Synthesis exception: ${err.message}`);
      reject(err);
    }
  });
}

/**
 * Intelligent Conversational Dialog Engine for Voice Calls (Hindi / Hinglish)
 * Generates natural spoken response and pre-synthesizes audio stream.
 */
export async function processVoiceTurn({ userSpeech, sessionContext = {}, conversationHistory = [] }) {
  try {
    const text = (userSpeech || '').trim();
    const lower = text.toLowerCase();
    const {
      type = 'custom',
      studentName = 'Student',
      visitorName = 'Parent',
      rollNo = '',
      marks = '',
      rank = '',
      absenceDate = 'today',
      voice = 'hi-IN-SwaraNeural'
    } = sessionContext;

    let replyText = '';
    let detectedIntent = 'general';
    let callShouldEnd = false;

    // First greeting turn if user initiates with Hi/Hello or picked up call
    if (!conversationHistory || conversationHistory.length === 0) {
      if (type === 'absentee') {
        replyText = `नमस्ते! मैं करियर ज़ोन कोचिंग से AI असिस्टेंट बात कर रहा हूँ। क्या मेरी बात ${studentName || 'विद्यार्थी'} के अभिभावक से हो रही है?`;
        detectedIntent = 'absentee_greeting';
      } else if (type === 'inquiry') {
        replyText = `नमस्ते ${visitorName || ''} जी! मैं करियर ज़ोन से बात कर रहा हूँ। आपने ${studentName || 'विद्यार्थी'} के एडमिशन के बारे में जानकारी माँगी थी। क्या मैं आपकी कुछ सहायता कर सकता हूँ?`;
        detectedIntent = 'inquiry_greeting';
      } else if (type === 'test-result') {
        replyText = `नमस्ते! मैं करियर ज़ोन से बात कर रहा हूँ। ${studentName || 'विद्यार्थी'} के टेस्ट रिज़ल्ट की जानकारी देने के लिए कॉल किया गया है।`;
        detectedIntent = 'result_greeting';
      } else {
        replyText = `नमस्ते! करियर ज़ोन में आपका स्वागत है। मैं आपकी क्या मदद कर सकता हूँ?`;
        detectedIntent = 'general_greeting';
      }
    } 
    // Absentee Follow-up Conversation Flow
    else if (type === 'absentee') {
      if (lower.includes('haan') || lower.includes('yes') || lower.includes('boliye') || lower.includes('bolie') || lower.includes('ji haan')) {
        replyText = `जी, आज ${studentName || 'विद्यार्थी'} क्लास में उपस्थित नहीं हुए हैं। क्या कोई विशेष कारण या तबियत खराब है?`;
        detectedIntent = 'ask_absence_reason';
      } else if (lower.includes('tabiyat') || lower.includes('bimar') || lower.includes('sick') || lower.includes('fever') || lower.includes('doctor') || lower.includes('dard')) {
        replyText = `जी ठीक है, हमने नोट कर लिया है कि ${studentName || 'उनकी'} तबियत ठीक नहीं है। कृपया उनका ध्यान रखें। स्वस्थ होने पर उन्हें क्लास में भेजें। धन्यवाद!`;
        detectedIntent = 'absence_sick_noted';
        callShouldEnd = true;
      } else if (lower.includes('bahar') || lower.includes('out of station') || lower.includes('shaadi') || lower.includes('function') || lower.includes('gaon') || lower.includes('trip')) {
        replyText = `जी बहुत अच्छा, हमने रजिस्टर में नोट कर लिया है। कृपया वापस आते ही उन्हें नियमित क्लास में भेजें। धन्यवाद!`;
        detectedIntent = 'absence_travel_noted';
        callShouldEnd = true;
      } else if (lower.includes('kal') || lower.includes('tomorrow') || lower.includes('aayega') || lower.includes('aayegi') || lower.includes('bhejenge')) {
        replyText = `जी धन्यवाद! हमने अपडेट कर दिया है कि ${studentName || 'वे'} कल से नियमित रूप से उपस्थित रहेंगे। शुभ दिन!`;
        detectedIntent = 'absence_tomorrow_confirmed';
        callShouldEnd = true;
      } else {
        replyText = `जी धन्यवाद आपकी जानकारी के लिए। हमने संस्थान के रिकॉर्ड में इसे दर्ज कर लिया है। यदि कोई समस्या हो तो कृपया हेल्पलाइन नंबर पर संपर्क करें।`;
        detectedIntent = 'absence_generic_noted';
        callShouldEnd = true;
      }
    }
    // Inquiry Follow-up Conversation Flow
    else if (type === 'inquiry') {
      if (lower.includes('fee') || lower.includes('fees') || lower.includes('kitna') || lower.includes('paisa') || lower.includes('discount')) {
        replyText = `फीस और स्कॉलरशिप की पूरी जानकारी के लिए हमारे एडमिशन काउंसलर आपसे संपर्क करेंगे। आप चाहें तो हेल्पलाइन नंबर 9673383561 पर भी बात कर सकते हैं। क्या आप इस रविवार को डेमो क्लास के लिए आ सकते हैं?`;
        detectedIntent = 'fee_counseling_redirect';
      } else if (lower.includes('kab') || lower.includes('time') || lower.includes('timing') || lower.includes('batch')) {
        replyText = `हमारे नए बैचेस सुबह 8 बजे और दोपहर 2 बजे से शुरू हो रहे हैं। क्या आप क्लासरूम और स्टडी मैटेरियल देखने के लिए कल कैंपस विज़िट कर सकते हैं?`;
        detectedIntent = 'timing_info';
      } else if (lower.includes('haan') || lower.includes('aayenge') || lower.includes('aaunga') || lower.includes('thik hai') || lower.includes('sure')) {
        replyText = `बहुत बढ़िया! हमने आपका स्लॉट बुक कर लिया है। हमारा पता है: हद्डिटोली रोड, अनन्या हॉस्पिटल के पास, गोंदिया। आपका स्वागत रहेगा!`;
        detectedIntent = 'visit_scheduled';
        callShouldEnd = true;
      } else {
        replyText = `जी बहुत अच्छा। यदि आपके कोई और प्रश्न हों तो आप कभी भी संस्थान में आ सकते हैं। करियर ज़ोन से जुड़ने के लिए धन्यवाद!`;
        detectedIntent = 'inquiry_closing';
        callShouldEnd = true;
      }
    }
    // Test Results Conversation Flow
    else if (type === 'test-result') {
      replyText = `हाल ही में हुए एग्ज़ाम में ${studentName || 'विद्यार्थी'} ने कुल ${marks || 'शानदार'} अंक प्राप्त किए हैं और बैच में रैंक ${rank || '1'} रही है। पूरी रिपोर्ट WhatsApp पर भी भेज दी गई है। बधाई!`;
      detectedIntent = 'result_delivered';
      callShouldEnd = true;
    }
    // General Natural Response
    else {
      if (lower.includes('namaste') || lower.includes('hello') || lower.includes('hi')) {
        replyText = `नमस्ते! करियर ज़ोन में आपका स्वागत है। मैं आपकी क्या सहायता कर सकता हूँ?`;
      } else if (lower.includes('kahan') || lower.includes('address') || lower.includes('location') || lower.includes('pata')) {
        replyText = `हमारा संस्थान हद्डिटोली रोड, अनन्या हॉस्पिटल के पास, गोंदिया में स्थित है।`;
      } else if (lower.includes('dhanyawad') || lower.includes('thank') || lower.includes('bye') || lower.includes('ok')) {
        replyText = `आपका बहुत-बहुत धन्यवाद! करियर ज़ोन आपकी उज्ज्वल भविष्य की कामना करता है।`;
        callShouldEnd = true;
      } else {
        replyText = `जी, आपकी बात नोट कर ली गई है। हमारी टीम जल्द ही आपसे संपर्क करेगी। धन्यवाद!`;
      }
    }

    // Synthesize natural neural speech for the AI reply
    const ttsResult = await synthesizeSpeech(replyText, voice);

    return {
      success: true,
      replyText,
      audioUrl: ttsResult.audioUrl,
      detectedIntent,
      callShouldEnd
    };
  } catch (err) {
    logError('VOICE_AI', `Voice turn processing error: ${err.message}`);
    return {
      success: false,
      error: err.message,
      replyText: 'माफ़ कीजिए, मैं आपकी बात ठीक से सुन नहीं पाया। कृपया पुनः बोलें।'
    };
  }
}

/**
 * Saves a completed or simulated voice call to MongoDB
 */
export async function saveCallLog(callData) {
  try {
    const log = new VoiceCallLog(callData);
    await log.save();
    logInfo('VOICE_AI', `Logged voice call with ID: ${log._id} (${callData.phone})`);
    return log;
  } catch (err) {
    logError('VOICE_AI', `Failed to save voice call log: ${err.message}`);
    throw err;
  }
}

/**
 * Retrieves latest voice call logs
 */
export async function getCallLogs(limit = 50) {
  try {
    return await VoiceCallLog.find({ isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  } catch (err) {
    logError('VOICE_AI', `Failed to fetch call logs: ${err.message}`);
    return [];
  }
}
