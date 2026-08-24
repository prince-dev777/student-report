import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Phone, PhoneCall, PhoneOff, Mic, MicOff, Volume2, 
  VolumeX, Play, Pause, RotateCcw, Sparkles, User, 
  Clock, Calendar, FileText, CheckCircle2, AlertCircle, 
  Headphones, Radio, ShieldCheck, ChevronRight
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api, API_BASE } from '../utils/api';
import toast from 'react-hot-toast';

export default function VoiceCallerSimulator() {
  const { students = [], inquiries = [] } = useApp();

  // Call Settings & Scenario
  const [scenario, setScenario] = useState('absentee'); // 'absentee' | 'inquiry' | 'test-result' | 'custom'
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedInquiryId, setSelectedInquiryId] = useState('');
  const [targetPhone, setTargetPhone] = useState('');
  const [contactName, setContactName] = useState('Mukesh Sharma');
  const [studentName, setStudentName] = useState('Prince Kumar');
  const [voice, setVoice] = useState('hi-IN-SwaraNeural');

  // Live Call State
  const [callState, setCallState] = useState('idle'); // 'idle' | 'dialing' | 'connected' | 'ended'
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [transcripts, setTranscripts] = useState([]);
  const [customUserInput, setCustomUserInput] = useState('');
  const [recentLogs, setRecentLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Audio Player State
  const [playingAudioUrl, setPlayingAudioUrl] = useState(null);
  const audioRef = useRef(new Audio());
  const timerRef = useRef(null);
  const recognitionRef = useRef(null);

  // Sync details when selecting student
  useEffect(() => {
    if (scenario === 'absentee' || scenario === 'test-result') {
      if (selectedStudentId) {
        const found = students.find(s => (s.id || s._id) === selectedStudentId);
        if (found) {
          setStudentName(found.name || '');
          setContactName(found.parentName || `Parent of ${found.name}`);
          setTargetPhone(found.phone || found.parentPhone || '');
        }
      } else if (students.length > 0) {
        const first = students[0];
        setSelectedStudentId(first.id || first._id);
        setStudentName(first.name || '');
        setContactName(first.parentName || `Parent of ${first.name}`);
        setTargetPhone(first.phone || first.parentPhone || '');
      }
    } else if (scenario === 'inquiry') {
      if (selectedInquiryId) {
        const found = inquiries.find(i => (i.id || i._id) === selectedInquiryId);
        if (found) {
          setStudentName(found.studentName || '');
          setContactName(found.visitorName || '');
          setTargetPhone(found.contactNumber || '');
        }
      } else if (inquiries.length > 0) {
        const first = inquiries[0];
        setSelectedInquiryId(first.id || first._id);
        setStudentName(first.studentName || '');
        setContactName(first.visitorName || '');
        setTargetPhone(first.contactNumber || '');
      }
    }
  }, [scenario, selectedStudentId, selectedInquiryId, students, inquiries]);

  // Fetch past call logs
  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const res = await api.getVoiceCallLogs(20);
      if (res && res.logs) {
        setRecentLogs(res.logs);
      }
    } catch (e) {
      console.warn('Failed to load call logs:', e.message);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Web Speech Recognition for Live Mic (Hearing user voice)
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'hi-IN';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        if (text) {
          handleParentSpeech(text);
        }
      };

      recognition.onerror = (e) => {
        console.warn('Speech recognition error:', e.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [callState, transcripts]);

  // Call Timer
  useEffect(() => {
    if (callState === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // Audio Playback Helper
  const playAudio = (url) => {
    if (!url) return;
    try {
      audioRef.current.pause();
      const serverBase = (API_BASE || '').replace('/api', '') || 'http://localhost:5000';
      const fullUrl = url.startsWith('http') ? url : `${serverBase}${url}`;
      audioRef.current.src = fullUrl;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setPlayingAudioUrl(url);
          setIsAiSpeaking(true);
        }).catch(err => {
          console.warn('Audio playback error/autoplay restriction:', err);
          setIsAiSpeaking(false);
        });
      }

      audioRef.current.onended = () => {
        setIsAiSpeaking(false);
        setPlayingAudioUrl(null);
      };
    } catch (e) {
      console.error('Audio play error:', e);
      setIsAiSpeaking(false);
    }
  };

  // Start Call (Simulated / Physical Gateway)
  const handleStartCall = async () => {
    try {
      setCallState('dialing');
      setCallDuration(0);
      setTranscripts([]);

      // 1. Initial Greeting turn from AI
      setTimeout(async () => {
        setCallState('connected');
        toast.success(`📞 Connected to ${contactName || targetPhone}!`);

        const sessionContext = {
          type: scenario,
          studentName: studentName || 'विद्यार्थी',
          visitorName: contactName || 'अभिभावक',
          voice: voice
        };

        const res = await api.processVoiceChat({
          userSpeech: '',
          sessionContext,
          conversationHistory: []
        });

        if (res && res.success) {
          const aiMsg = {
            speaker: 'ai',
            text: res.replyText,
            audioUrl: res.audioUrl,
            time: new Date()
          };
          setTranscripts([aiMsg]);
          if (res.audioUrl) {
            playAudio(res.audioUrl);
          }
        }
      }, 1800);
    } catch (e) {
      toast.error('Failed to initiate call: ' + e.message);
      setCallState('idle');
    }
  };

  // Handle Parent / User Spoken Turn
  const handleParentSpeech = async (spokenText) => {
    if (!spokenText || !spokenText.trim() || callState !== 'connected') return;

    const parentMsg = {
      speaker: 'parent',
      text: spokenText.trim(),
      time: new Date()
    };

    const newHistory = [...transcripts, parentMsg];
    setTranscripts(newHistory);
    setCustomUserInput('');

    try {
      const sessionContext = {
        type: scenario,
        studentName: studentName || 'विद्यार्थी',
        visitorName: contactName || 'अभिभावक',
        voice: voice
      };

      const res = await api.processVoiceChat({
        userSpeech: spokenText.trim(),
        sessionContext,
        conversationHistory: newHistory
      });

      if (res && res.success) {
        const aiMsg = {
          speaker: 'ai',
          text: res.replyText,
          audioUrl: res.audioUrl,
          time: new Date()
        };
        setTranscripts(prev => [...prev, aiMsg]);
        if (res.audioUrl) {
          playAudio(res.audioUrl);
        }

        if (res.callShouldEnd) {
          setTimeout(() => {
            handleEndCall(false);
          }, 6000);
        }
      }
    } catch (e) {
      toast.error('Voice AI dialog error: ' + e.message);
    }
  };

  // End Call & Save to Database
  const handleEndCall = async (manual = true) => {
    try {
      audioRef.current.pause();
      setIsAiSpeaking(false);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }

      setCallState('ended');
      if (timerRef.current) clearInterval(timerRef.current);

      if (transcripts.length > 0) {
        const callPayload = {
          phone: targetPhone || '9876543210',
          contactName: contactName || 'Parent',
          studentName: studentName || '',
          type: scenario,
          status: 'completed',
          durationSeconds: callDuration,
          transcript: transcripts.map(t => ({
            speaker: t.speaker,
            text: t.text,
            time: t.time
          })),
          summary: `Call completed with ${contactName} regarding ${scenario}. Conversation had ${transcripts.length} exchanges.`,
          recordingUrl: transcripts.find(t => t.audioUrl)?.audioUrl || ''
        };

        await api.logVoiceCall(callPayload);
        toast.success(`💾 Call recording & transcript saved to MongoDB!`);
        fetchLogs();
      }

      setTimeout(() => {
        setCallState('idle');
      }, 2500);
    } catch (e) {
      console.warn('Call save error:', e);
      setCallState('idle');
    }
  };

  // Format seconds to mm:ss
  const formatTime = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Top Banner: Voice AI Telephony Status */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
        padding: '20px 24px',
        borderRadius: '16px',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 10px 25px rgba(67, 56, 202, 0.25)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '14px',
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.6rem'
          }}>
            🎙️
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, letterSpacing: '-0.3px', color: '#ffffff' }}>
                AI Voice Caller & Smart Telephony
              </h2>
              <span style={{ background: '#22c55e', color: '#ffffff', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '12px' }}>
                HINDI & ENGLISH NEURAL VOICE
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: 'rgba(255, 255, 255, 0.92)' }}>
              Outbound parent calls with Real-time Neural Voice Engine, Speech-to-Text, and Automated Call Logging.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(0,0,0,0.25)', padding: '6px 14px', borderRadius: '10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff' }}>
            <Radio size={14} style={{ color: '#22c55e' }} />
            <span style={{ color: '#ffffff' }}>Gateway: <strong>Local PC Mic / SIM Bridge Ready</strong></span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Setup & Right Live Call Visualizer */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(380px, 1.3fr)', gap: '20px' }}>
        
        {/* Left Column: Call Setup & Target Audience */}
        <div className="card" style={{ padding: '20px', borderRadius: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <Headphones size={18} style={{ color: 'var(--accent-blue)' }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Call Target & Campaign Configuration</h3>
          </div>

          {/* Scenario Selection */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '6px', color: 'var(--text-secondary)' }}>
              Select Calling Scenario (कॉल का उद्देश्य):
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                { id: 'absentee', label: '1️⃣ Absentee Follow-up', desc: 'अनियमित छात्र पूछताछ' },
                { id: 'inquiry', label: '2️⃣ Inquiry Admission', desc: 'डेमो क्लास आमंत्रण' },
                { id: 'test-result', label: '3️⃣ Test Score Report', desc: 'एग्ज़ाम मार्क्स रिपोर्ट' },
                { id: 'custom', label: '4️⃣ General Calling', desc: 'कस्टम सामान्य बातचीत' }
              ].map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setScenario(s.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: scenario === s.id ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)',
                    background: scenario === s.id ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.84rem', color: scenario === s.id ? 'var(--accent-blue)' : 'var(--text-primary)' }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {s.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Student Selector */}
          {(scenario === 'absentee' || scenario === 'test-result') && (
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                Target Student (विद्यार्थी चुनें):
              </label>
              <select
                className="form-select w-full"
                value={selectedStudentId}
                onChange={e => setSelectedStudentId(e.target.value)}
                style={{ borderRadius: '8px', height: '38px', fontSize: '0.85rem' }}
              >
                {students.map(st => (
                  <option key={st.id || st._id} value={st.id || st._id}>
                    {st.name} (Roll: {st.rollNo || 'N/A'}) - Batch: {st.batch || 'General'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Inquiry Selector */}
          {scenario === 'inquiry' && (
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                Target Inquiry / Lead (इंक्वायरी चुनें):
              </label>
              <select
                className="form-select w-full"
                value={selectedInquiryId}
                onChange={e => setSelectedInquiryId(e.target.value)}
                style={{ borderRadius: '8px', height: '38px', fontSize: '0.85rem' }}
              >
                {inquiries.map(iq => (
                  <option key={iq.id || iq._id} value={iq.id || iq._id}>
                    {iq.visitorName} (Student: {iq.studentName}) - {iq.contactNumber}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Target Phone & Parent Name Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Parent / Contact Name:
              </label>
              <input
                type="text"
                className="form-input w-full"
                value={contactName}
                onChange={e => setContactName(e.target.value)}
                style={{ height: '36px', borderRadius: '8px', fontSize: '0.85rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Target Phone Number:
              </label>
              <input
                type="text"
                className="form-input w-full"
                value={targetPhone}
                onChange={e => setTargetPhone(e.target.value)}
                style={{ height: '36px', borderRadius: '8px', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {/* Voice Model Selector */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: '6px', color: 'var(--text-secondary)' }}>
              AI Hindi Neural Voice Model (आवाज़ चुनें):
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { id: 'hi-IN-SwaraNeural', label: '👩 Swara (Natural Female Hindi)' },
                { id: 'hi-IN-MadhurNeural', label: '👨 Madhur (Professional Male Hindi)' }
              ].map(v => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVoice(v.id)}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: voice === v.id ? '2px solid #8b5cf6' : '1px solid var(--border-color)',
                    background: voice === v.id ? 'rgba(139, 92, 246, 0.12)' : 'var(--bg-card)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: voice === v.id ? '#8b5cf6' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Call Action Button */}
          <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
            {callState === 'idle' ? (
              <button
                type="button"
                className="btn btn-primary w-full"
                onClick={handleStartCall}
                style={{
                  height: '46px',
                  borderRadius: '12px',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                  boxShadow: '0 4px 14px rgba(34, 197, 94, 0.35)'
                }}
              >
                <PhoneCall size={18} />
                <span>Start AI Call (कॉल शुरू करें)</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn w-full"
                onClick={() => handleEndCall(true)}
                style={{
                  height: '46px',
                  borderRadius: '12px',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: '#ef4444',
                  color: '#ffffff',
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)'
                }}
              >
                <PhoneOff size={18} />
                <span>Hang Up / End Call (कॉल समाप्त करें)</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Live Call Interface & Transcript Screen */}
        <div className="card" style={{ padding: '20px', borderRadius: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
          
          {/* Call Screen Header */}
          <div style={{
            background: 'var(--bg-card)',
            padding: '14px 18px',
            borderRadius: '14px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: callState === 'connected' ? 'rgba(34, 197, 94, 0.2)' : callState === 'dialing' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                color: callState === 'connected' ? '#22c55e' : callState === 'dialing' ? '#eab308' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Phone size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  {contactName || 'Target Phone'} ({targetPhone || '—'})
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Student: <strong>{studentName || '—'}</strong>
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                color: callState === 'connected' ? '#22c55e' : callState === 'dialing' ? '#eab308' : 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {callState === 'connected' ? '● ON CALL' : callState === 'dialing' ? 'DIALING...' : 'STANDBY'}
              </div>
              {callState === 'connected' && (
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                  {formatTime(callDuration)}
                </div>
              )}
            </div>
          </div>

          {/* Live Waveform Indicator */}
          {callState === 'connected' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)',
                padding: '10px 16px',
                borderRadius: '12px',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: isAiSpeaking ? '#8b5cf6' : '#22c55e',
                  display: 'inline-block',
                  boxShadow: isAiSpeaking ? '0 0 10px #8b5cf6' : '0 0 10px #22c55e'
                }}></span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isAiSpeaking ? '#8b5cf6' : '#22c55e' }}>
                  {isAiSpeaking ? '🗣️ AI is Speaking (Neural Hindi Engine)...' : isListening ? '👂 Listening to Parent Voice (Speak now)...' : '🎧 Call Active'}
                </span>
              </div>

              {/* Speech Recognition Toggle */}
              {window.webkitSpeechRecognition && (
                <button
                  type="button"
                  onClick={() => {
                    if (isListening) {
                      recognitionRef.current?.stop();
                    } else {
                      try { recognitionRef.current?.start(); } catch(e) {}
                    }
                  }}
                  style={{
                    background: isListening ? '#ef4444' : '#22c55e',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {isListening ? <MicOff size={13} /> : <Mic size={13} />}
                  <span>{isListening ? 'Stop Mic' : 'Live Mic'}</span>
                </button>
              )}
            </motion.div>
          )}

          {/* Live Conversation Transcript Feed */}
          <div style={{
            flex: 1,
            minHeight: '220px',
            maxHeight: '260px',
            overflowY: 'auto',
            background: 'var(--bg-card)',
            borderRadius: '12px',
            padding: '14px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            marginBottom: '14px'
          }}>
            {transcripts.length === 0 ? (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <p style={{ margin: 0 }}>📞 Click <strong>"Start AI Call"</strong> to begin voice conversation.</p>
                <p style={{ margin: '4px 0 0', fontSize: '0.75rem' }}>The AI will dial and speak naturally in Hindi.</p>
              </div>
            ) : (
              transcripts.map((t, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: t.speaker === 'ai' ? 'flex-start' : 'flex-end'
                  }}
                >
                  <div style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    marginBottom: '2px',
                    color: t.speaker === 'ai' ? '#8b5cf6' : '#10b981'
                  }}>
                    {t.speaker === 'ai' ? '🤖 Career Xone AI Assistant' : '👤 Parent / Student'}
                  </div>
                  <div style={{
                    maxWidth: '82%',
                    padding: '10px 14px',
                    borderRadius: t.speaker === 'ai' ? '14px 14px 14px 2px' : '14px 14px 2px 14px',
                    background: t.speaker === 'ai' ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)' : 'rgba(16, 185, 129, 0.15)',
                    border: t.speaker === 'ai' ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                    color: 'var(--text-primary)',
                    fontSize: '0.88rem',
                    lineHeight: '1.4'
                  }}>
                    {t.text}
                    {t.audioUrl && (
                      <button
                        type="button"
                        onClick={() => playAudio(t.audioUrl)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'rgba(0,0,0,0.1)',
                          border: 'none',
                          padding: '2px 6px',
                          borderRadius: '6px',
                          fontSize: '0.7rem',
                          marginLeft: '8px',
                          cursor: 'pointer',
                          color: 'inherit'
                        }}
                        title="Replay Voice Audio"
                      >
                        <Volume2 size={12} />
                        <span>Play</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quick Simulation Phrases / Live Text Response Input */}
          {callState === 'connected' && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Quick Responses (Parent की तरफ से बोलें या क्लिक करें):
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                {[
                  'हाँ बोलिए',
                  'उसकी तबियत खराब है',
                  'कल से क्लास आएगा',
                  'हम बाहर गाँव गए हैं',
                  'फीस कितनी है?',
                  'रविवार को 11 बजे आएंगे',
                  'धन्यवाद'
                ].map(phrase => (
                  <button
                    key={phrase}
                    type="button"
                    onClick={() => handleParentSpeech(phrase)}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      color: 'var(--text-primary)'
                    }}
                  >
                    "{phrase}"
                  </button>
                ))}
              </div>

              {/* Custom Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleParentSpeech(customUserInput);
                }}
                style={{ display: 'flex', gap: '8px' }}
              >
                <input
                  type="text"
                  className="form-input flex-1"
                  placeholder="Type or speak what parent says..."
                  value={customUserInput}
                  onChange={e => setCustomUserInput(e.target.value)}
                  style={{ height: '36px', borderRadius: '8px', fontSize: '0.84rem' }}
                />
                <button
                  type="submit"
                  className="btn btn-sm btn-primary"
                  style={{ height: '36px', borderRadius: '8px', padding: '0 14px', fontWeight: 700 }}
                >
                  Send Speech
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Call History & Audio Recordings Table */}
      <div className="card" style={{ padding: '20px', borderRadius: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} style={{ color: 'var(--accent-blue)' }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
              Recent AI Voice Call Recordings & Transcripts
            </h3>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={fetchLogs}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RotateCcw size={14} />
            <span>Refresh Logs</span>
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Target Contact</th>
                <th>Scenario</th>
                <th>Duration</th>
                <th>Conversation Summary / Outcome</th>
                <th className="text-right">Audio Playback</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No recorded voice calls found yet. Start your first simulated AI call above!
                  </td>
                </tr>
              ) : (
                recentLogs.map(log => (
                  <tr key={log._id || log.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                        <span>{new Date(log.createdAt || log.startedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{log.contactName || 'Parent'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.phone} {log.studentName ? `• ${log.studentName}` : ''}</div>
                    </td>
                    <td>
                      <span style={{
                        background: log.type === 'absentee' ? 'rgba(239, 68, 68, 0.15)' : log.type === 'inquiry' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                        color: log.type === 'absentee' ? '#ef4444' : log.type === 'inquiry' ? '#3b82f6' : '#8b5cf6',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        textTransform: 'uppercase'
                      }}>
                        {log.type}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                      {log.durationSeconds ? `${log.durationSeconds}s` : '—'}
                    </td>
                    <td style={{ maxWidth: '300px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {log.summary || 'Conversation transcript recorded.'}
                    </td>
                    <td className="text-right">
                      {log.recordingUrl ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => playAudio(log.recordingUrl)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '8px' }}
                        >
                          <Volume2 size={14} />
                          <span>Play Audio</span>
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No audio</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
