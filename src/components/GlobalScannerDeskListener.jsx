import React, { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import toast from 'react-hot-toast';
import { getTodayStr, formatTime } from '../utils/helpers';

// Synthesizer Chimes
const playScannerSound = (type = 'entry') => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (type === 'entry') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'exit') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(587.33, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {
    console.error('Audio synthesizer error:', e);
  }
};

export default function GlobalScannerDeskListener() {
  const { students = [], attendance = [], markAttendance } = useApp();
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const recentPunchesRef = useRef({});

  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      const isInputFocused = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';
      const isKioskInput = document.activeElement?.id === 'kiosk-hardware-receiver' || document.activeElement?.getAttribute('data-kiosk-receiver') === 'true';

      // If user is actively typing in a normal form input (and not the kiosk receiver), let them type normally
      if (isInputFocused && !isKioskInput) {
        // However, if the keystroke speed is under 25ms (hardware scanner speed), intercept it
        const now = Date.now();
        const timeDiff = now - lastKeyTimeRef.current;
        if (timeDiff > 70 && e.key !== 'Enter') {
          // Manual human typing, ignore
          bufferRef.current = '';
          return;
        }
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // If delay between keystrokes is > 120ms and buffer has started, it's human typing -> reset
      if (timeDiff > 120 && bufferRef.current.length > 0 && e.key !== 'Enter') {
        bufferRef.current = '';
      }

      if (e.key === 'Enter') {
        const rawCode = bufferRef.current.trim();
        bufferRef.current = '';

        if (!rawCode || rawCode.length < 2) return;

        // Process Scan from Shreyans Tabletop Desktop Scanner
        processDesktopScan(rawCode);
      } else if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    };

    const processDesktopScan = (raw) => {
      // 1. Clean and parse barcode / QR code format
      let extracted = raw;
      try {
        if (raw.startsWith('{') && raw.endsWith('}')) {
          const parsed = JSON.parse(raw);
          extracted = String(parsed.rollNo || parsed.roll || parsed.id || parsed.studentId || raw);
        }
      } catch (err) {}

      if (extracted.startsWith('http://') || extracted.startsWith('https://')) {
        try {
          const u = new URL(extracted);
          const parts = u.pathname.split('/').filter(Boolean);
          extracted = u.searchParams.get('roll') || u.searchParams.get('id') || parts[parts.length - 1] || extracted;
        } catch (err) {}
      }

      extracted = String(extracted).trim();
      if (!extracted) return;

      const target = extracted.toLowerCase();

      // 2. Match student in database
      const matched = students.find((s) => {
        if (s.isDeleted || s.status === 'inactive') return false;
        const r = String(s.rollNo || '').trim().toLowerCase();
        const id = String(s.id || '').trim().toLowerCase();
        const phone = String(s.parentPhone || s.phone || '').trim();
        return r === target || id === target || phone === target;
      }) || students.find((s) => {
        if (s.isDeleted || s.status === 'inactive') return false;
        const rNum = parseInt(s.rollNo, 10);
        const targetNum = parseInt(extracted, 10);
        return !isNaN(rNum) && !isNaN(targetNum) && rNum === targetNum;
      });

      if (!matched) {
        playScannerSound('error');
        toast.error(`❌ Student not found for Scan: "${extracted}"`, { id: 'scanner-toast' });
        return;
      }

      // 3. Anti-bounce protection (60 seconds / 1 min cooldown)
      const now = Date.now();
      const lastPunchTime = recentPunchesRef.current[matched.id] || 0;
      if (now - lastPunchTime < 60000) {
        const elapsed = Math.round((now - lastPunchTime) / 1000);
        const remaining = 60 - elapsed;
        toast(`⏳ ${matched.name} already scanned ${elapsed}s ago! Please wait ${remaining}s.`, { icon: '⚠️', id: 'scanner-toast' });
        return;
      }

      // 4. Auto Entry / Exit Detection
      const todayStr = getTodayStr();
      const todayRecord = attendance.find((a) => a.studentId === matched.id && a.date === todayStr);

      let punchType = 'entry';
      if (!todayRecord || !todayRecord.entryTime) {
        punchType = 'entry';
      } else if (todayRecord.entryTime && !todayRecord.exitTime) {
        // If entry was marked less than 2 minutes ago, prevent accidental double punch
        const [eh, em] = todayRecord.entryTime.split(':').map(Number);
        const cur = new Date();
        const currentMin = cur.getHours() * 60 + cur.getMinutes();
        const entryMin = eh * 60 + em;
        if (currentMin - entryMin < 2) {
          playScannerSound('error');
          toast(`⚠️ ${matched.name} already checked in at ${formatTime(todayRecord.entryTime)}!`, { icon: 'ℹ️', id: 'scanner-toast' });
          return;
        }
        punchType = 'exit';
      } else {
        playScannerSound('error');
        toast.error(`⚠️ ${matched.name} already completed Entry & Exit today!`, { id: 'scanner-toast' });
        return;
      }

      // 5. Update timestamp and trigger mark attendance
      recentPunchesRef.current[matched.id] = now;
      markAttendance(matched.id, punchType);
      playScannerSound(punchType);

      const timeNow = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

      toast.custom(
        (t) => (
          <div
            style={{
              background: punchType === 'entry' ? '#0f172a' : '#1e1b4b',
              border: `2px solid ${punchType === 'entry' ? '#10b981' : '#6366f1'}`,
              borderRadius: '16px',
              padding: '14px 18px',
              color: '#ffffff',
              boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              minWidth: '300px',
              animation: t.visible ? 'custom-enter 0.3s ease' : 'custom-leave 0.3s ease'
            }}
          >
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: punchType === 'entry' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.2)',
              color: punchType === 'entry' ? '#10b981' : '#818cf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem'
            }}>
              {punchType === 'entry' ? '⚡' : '👋'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong style={{ fontSize: '1rem', color: '#ffffff' }}>{matched.name}</strong>
                <span style={{
                  background: punchType === 'entry' ? '#10b981' : '#6366f1',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.70rem',
                  padding: '2px 8px',
                  borderRadius: '6px'
                }}>
                  {punchType.toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: '0.80rem', color: '#94a3b8', marginTop: '2px' }}>
                Roll: <strong>{matched.rollNo}</strong> • Time: <strong>{timeNow}</strong>
              </div>
            </div>
          </div>
        ),
        { id: 'scanner-toast', duration: 4000 }
      );
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [students, attendance, markAttendance]);

  return null;
}
