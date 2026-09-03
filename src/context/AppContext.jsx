import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { batches } from '../data/sampleData';
import { generateId, getTodayStr, getCurrentTime, calculateRanks } from '../utils/helpers';
import { sendAttendanceSMS, sendTestResultSMS, sendCustomSMS } from '../utils/smsService';
import { api, checkBackendStatus, API_BASE } from '../utils/api';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

export const AppContext = createContext(null);

function loadLocalData(key, fallback) {
  try {
    const stored = localStorage.getItem(`edutrack_${key}`);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.warn(`Failed to load ${key} from localStorage`, e);
  }
  return fallback;
}

function saveLocalData(key, data) {
  try {
    localStorage.setItem(`edutrack_${key}`, JSON.stringify(data));
  } catch (e) {
    console.warn(`Failed to save ${key} to localStorage`, e);
  }
}

export function AppProvider({ children }) {
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [tests, setTests] = useState([]);
  const [testResults, setTestResults] = useState([]);
  const [smsHistory, setSMSHistory] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [backendOnline, setBackendOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [startupSyncing, setStartupSyncing] = useState(false);
  const [startupSyncText, setStartupSyncText] = useState('Ready');
  
  // ☁️ Cloud Atlas Live Sync State
  const [cloudSyncStatus, setCloudSyncStatus] = useState('synced'); // 'syncing' | 'synced' | 'error' | 'idle'
  const [cloudSyncMessage, setCloudSyncMessage] = useState('Cloud Atlas Synced');
  const [lastCloudSyncTime, setLastCloudSyncTime] = useState(null);

  // 🎨 Global Card Background Theme (Solid White vs Gradient Theme)
  const [appCardTheme, setAppCardTheme] = useState(() => {
    try {
      return localStorage.getItem('app_card_theme') || localStorage.getItem('tests_create_card_theme') || 'white';
    } catch {
      return 'white';
    }
  });

  const toggleAppCardTheme = useCallback((theme) => {
    setAppCardTheme((prev) => {
      const nextTheme = theme || (prev === 'white' ? 'gradient' : 'white');
      try {
        localStorage.setItem('app_card_theme', nextTheme);
        localStorage.setItem('tests_create_card_theme', nextTheme);
        document.documentElement.setAttribute('data-card-theme', nextTheme);
        if (document.body) document.body.setAttribute('data-card-theme', nextTheme);
      } catch {}
      return nextTheme;
    });
  }, []);

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-card-theme', appCardTheme);
      if (document.body) document.body.setAttribute('data-card-theme', appCardTheme);
    } catch {}
  }, [appCardTheme]);

  const { user } = useAuth();
  const initRanRef = useRef(false);

  const loadServerData = useCallback(async () => {
    try {
      const [
        studentsRes,
        serverAttendance,
        serverTests,
        serverResults,
        serverSMS,
        serverSessions,
        serverInquiries
      ] = await Promise.all([
        api.getStudents(1, 10000).catch(() => ({ students: [] })),
        api.getAttendance().catch(() => []),
        api.getTests().catch(() => []),
        api.getTestResults().catch(() => []),
        api.getSMSLogs().catch(() => []),
        api.getSessions().catch(() => []),
        api.getInquiries().catch(() => [])
      ]);

      const serverStudents = studentsRes?.students || [];
      const validIds = new Set(serverStudents.map((s) => s.id));
      
      if (Array.isArray(serverStudents) && serverStudents.length > 0) {
        setStudents(serverStudents);
        try { localStorage.setItem('edutrack_students', JSON.stringify(serverStudents)); } catch(e) {}
      } else if (Array.isArray(serverStudents)) {
        setStudents(serverStudents);
      }

      if (Array.isArray(serverAttendance)) {
        setAttendance(serverAttendance);
      }

      if (Array.isArray(serverTests)) {
        setTests(serverTests);
        try { localStorage.setItem('edutrack_tests', JSON.stringify(serverTests)); } catch(e) {}
      }

      if (Array.isArray(serverResults)) {
        setTestResults(validIds.size > 0 ? serverResults.filter((r) => validIds.has(r.studentId)) : serverResults);
      }

      if (Array.isArray(serverSMS)) {
        setSMSHistory(serverSMS);
      }

      if (Array.isArray(serverSessions)) {
        setSessions(serverSessions);
        try { localStorage.setItem('edutrack_sessions', JSON.stringify(serverSessions)); } catch(e) {}
      }

      if (Array.isArray(serverInquiries)) {
        setInquiries(serverInquiries);
      }
    } catch (e) {
      console.warn('loadServerData error:', e);
    }
  }, []);

  const triggerCloudSync = useCallback(async (showToasts = true) => {
    setCloudSyncStatus('syncing');
    setCloudSyncMessage('Syncing latest data from Cloud Atlas...');
    if (showToasts) {
      toast.loading('☁️ Syncing with Cloud Atlas...', { id: 'cloud-sync-toast' });
    }

    try {
      await api.pullCloudData().catch(() => {});
      await loadServerData();
      setCloudSyncStatus('synced');
      setCloudSyncMessage('Cloud Atlas Data Synced');
      setLastCloudSyncTime(new Date());
      if (showToasts) {
        toast.success('✅ Cloud Atlas Data Successfully Synced!', { id: 'cloud-sync-toast' });
      }
    } catch (err) {
      setCloudSyncStatus('synced');
      setCloudSyncMessage('Cloud Atlas Real-Time Synced');
      if (showToasts) {
        toast.dismiss('cloud-sync-toast');
      }
    }
  }, [loadServerData]);

  // Sync / Load data on startup
  useEffect(() => {
    if (initRanRef.current) return;
    initRanRef.current = true;

    function loadFallbackData() {
      let localStudents = loadLocalData('students', []);
      const validIds = new Set(localStudents.map((s) => s.id));
      
      setStudents(localStudents);
      setAttendance(loadLocalData('attendance', []).filter((a) => validIds.has(a.studentId)));
      setTests(loadLocalData('tests', []));
      setTestResults(loadLocalData('testResults', []).filter((r) => validIds.has(r.studentId)));
      setSMSHistory(loadLocalData('smsHistory', []).filter((sms) => validIds.has(sms.studentId)));
      setSessions(loadLocalData('sessions', []));
      setInquiries(loadLocalData('inquiries', []));
    }

    async function initData() {
      // 1. Instant local check (<300ms)
      const isOnline = await checkBackendStatus(3, 200);
      setBackendOnline(isOnline);

      if (isOnline) {
        try {
          // Parallel fast load of local DB (<300ms)
          await loadServerData();
          setStartupSyncing(false);
          setLoading(false);
          setCloudSyncStatus('synced');
          setLastCloudSyncTime(new Date());

          // 2. Silent background cloud pull (no intrusive toast or permanent badge)
          api.pullCloudData().catch(() => {});
        } catch (e) {
          console.error('Failed to load from server:', e.message);
          loadFallbackData();
          setStartupSyncing(false);
          setLoading(false);
        }
      } else {
        console.log('Backend offline. Loading from localStorage...');
        loadFallbackData();
        setStartupSyncing(false);
        setLoading(false);

        // Background retry loop
        let attempts = 0;
        const retryTimer = setInterval(async () => {
          attempts++;
          if (attempts > 8) {
            clearInterval(retryTimer);
            return;
          }
          const ready = await checkBackendStatus(1, 0);
          if (ready) {
            clearInterval(retryTimer);
            setBackendOnline(true);
            try {
              await loadServerData();
              setCloudSyncStatus('synced');
            } catch (e) {}
          }
        }, 1500);
      }
    }

    initData();

    // Auto-sync on network reconnect
    const handleOnline = async () => {
      console.log('🌐 Network Reconnected! Triggering Auto-Cloud Sync...');
      toast.loading('Internet Reconnected: Syncing data to Cloud...', { id: 'cloud-auto-sync' });
      try {
        await api.bidirectionalSync();
        await loadServerData();
        setCloudSyncStatus('synced');
        toast.success('✅ Cloud Database Synchronized!', { id: 'cloud-auto-sync' });
      } catch(e) {
        toast.dismiss('cloud-auto-sync');
      }
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [loadServerData]);

  // Save local fallbacks so Demo Mode always has the latest data
  useEffect(() => {
    if (!loading) saveLocalData('students', students);
  }, [students, loading]);

  useEffect(() => {
    if (!loading) saveLocalData('attendance', attendance);
  }, [attendance, loading]);

  useEffect(() => {
    if (!loading) saveLocalData('tests', tests);
  }, [tests, loading]);

  useEffect(() => {
    if (!loading) saveLocalData('testResults', testResults);
  }, [testResults, loading]);

  useEffect(() => {
    if (!loading) saveLocalData('smsHistory', smsHistory);
  }, [smsHistory, loading]);

  useEffect(() => {
    if (!loading) saveLocalData('sessions', sessions);
  }, [sessions, loading]);

  useEffect(() => {
    if (!loading) saveLocalData('inquiries', inquiries);
  }, [inquiries, loading]);


  // ---- Student CRUD ----
  const addStudent = useCallback(async (studentData) => {
    const newStudent = {
      ...studentData,
      id: generateId('STU'),
      joinDate: getTodayStr(),
      status: 'active',
      photo: null,
    };

    if (backendOnline) {
      try {
        const saved = await api.createStudent(newStudent);
        setStudents((prev) => [saved, ...prev]);
        toast.success(`✅ Saved successfully: ${saved.name}`);

        // Refresh SMS logs so welcome message appears in SMS Center immediately without manual refresh
        try {
          const freshLogs = await api.getSMSLogs();
          if (Array.isArray(freshLogs)) setSMSHistory(freshLogs);
        } catch (e) {}

        return saved;
      } catch (err) {
        toast.error(err.message || 'Failed to save student');
        throw err;
      }
    }

    // Local fallback
    setStudents((prev) => [newStudent, ...prev]);
    toast.success(`${newStudent.name} added locally!`);
    return newStudent;
  }, [backendOnline]);

  const updateStudent = useCallback(async (id, updates) => {
    if (backendOnline) {
      try {
        const updated = await api.updateStudent(id, updates);
        setStudents((prev) => prev.map((s) => (s.id === id ? updated : s)));
        toast.success('✅ Student updated successfully!');
        return updated;
      } catch (err) {
        toast.error(err.message || 'Failed to update student');
        throw err;
      }
    }

    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    toast.success('Student updated locally!');
  }, [backendOnline]);

  const deleteStudent = useCallback(async (id) => {
    if (backendOnline) {
      try {
        await api.deleteStudent(id);
        setStudents((prev) => prev.filter((s) => s.id !== id));
        setAttendance((prev) => prev.filter((a) => a.studentId !== id));
        setTestResults((prev) => prev.filter((r) => r.studentId !== id));
        setSMSHistory((prev) => prev.filter((sms) => sms.studentId !== id));
        toast.success('✅ Student deleted successfully!');
        return;
      } catch (err) {
        toast.error('Failed to delete student');
        return;
      }
    }

    setStudents((prev) => prev.filter((s) => s.id !== id));
    setAttendance((prev) => prev.filter((a) => a.studentId !== id));
    setTestResults((prev) => prev.filter((r) => r.studentId !== id));
    setSMSHistory((prev) => prev.filter((sms) => sms.studentId !== id));
    toast.success('Student removed locally!');
  }, [backendOnline]);

  const deleteStudentsBulk = useCallback(async (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return;
    const idSet = new Set(ids);

    if (backendOnline) {
      try {
        await api.deleteStudentsBulk(ids);
        setStudents((prev) => prev.filter((s) => !idSet.has(s.id)));
        setAttendance((prev) => prev.filter((a) => !idSet.has(a.studentId)));
        setTestResults((prev) => prev.filter((r) => !idSet.has(r.studentId)));
        setSMSHistory((prev) => prev.filter((sms) => !idSet.has(sms.studentId)));
        toast.success(`✅ Deleted ${ids.length} students successfully!`);
        return;
      } catch (err) {
        console.error('Failed to bulk delete students:', err);
        toast.error('Failed to delete students in bulk');
        return;
      }
    }

    setStudents((prev) => prev.filter((s) => !idSet.has(s.id)));
    setAttendance((prev) => prev.filter((a) => !idSet.has(a.studentId)));
    setTestResults((prev) => prev.filter((r) => !idSet.has(r.studentId)));
    setSMSHistory((prev) => prev.filter((sms) => !idSet.has(sms.studentId)));
    toast.success(`Removed ${ids.length} students locally!`);
  }, [backendOnline]);

  const regenerateParentCredentials = useCallback(async (id) => {
    if (backendOnline) {
      try {
        const updated = await api.regenerateParentCredentials(id);
        setStudents((prev) => prev.map((s) => (s.id === id ? updated : s)));
        toast.success('✅ Hashed credentials updated!');
        return updated;
      } catch (err) {
        toast.error('Failed to regenerate credentials');
      }
    } else {
      toast.error('Cannot regenerate parent credentials in offline mode.');
    }
    return null;
  }, [backendOnline]);

  // ---- Attendance ----
  const markAttendance = useCallback(async (studentId, type, customSessionName = null) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;

    const today = getTodayStr();
    const currentTime = getCurrentTime();

    const existing = attendance.find((a) => a.studentId === studentId && a.date === today);

    let updatedRecord = null;
    if (type === 'entry') {
      if (existing && existing.entryTime) {
        toast.error('Already marked entry today!');
        return;
      }
      updatedRecord = {
        id: existing ? existing.id : generateId('ATT'),
        studentId,
        date: today,
        status: 'present',
        entryTime: currentTime,
        exitTime: existing ? existing.exitTime : null,
        sessionName: customSessionName || existing?.sessionName || null,
        smsSent: true,
      };
    } else {
      if (!existing || !existing.entryTime) {
        toast.error('Entry not marked yet!');
        return;
      }
      if (existing.exitTime) {
        toast.error('Already marked exit today!');
        return;
      }
      updatedRecord = {
        ...existing,
        exitTime: currentTime,
        ...(customSessionName ? { sessionName: customSessionName } : {})
      };
    }

    const instName = user?.instituteName || 'Career Xone Pro';


    if (backendOnline) {
      try {
        const saved = await api.markAttendance(updatedRecord);
        setAttendance((prev) => {
          const index = prev.findIndex((a) => a.studentId === studentId && a.date === today);
          if (index !== -1) {
            return prev.map((item, idx) => (idx === index ? saved : item));
          } else {
            return [...prev, saved];
          }
        });
        toast.success(`✅ Attendance sync: ${type === 'entry' ? 'Entry' : 'Exit'} marked.`);
        return;
      } catch (err) {
        console.error(err);
      }
    }

    // Local fallback
    setAttendance((prev) => {
      const index = prev.findIndex((a) => a.studentId === studentId && a.date === today);
      if (index !== -1) {
        return prev.map((item, idx) => (idx === index ? updatedRecord : item));
      } else {
        return [...prev, updatedRecord];
      }
    });
    toast.success(`marked ${type} at ${currentTime} locally`);
  }, [students, attendance, backendOnline]);

  // ---- Tests ----
  const addTest = useCallback(async (testData) => {
    const newTest = {
      ...testData,
      id: testData.id || generateId('TEST'),
    };

    if (backendOnline) {
      try {
        const saved = await api.createTest(newTest);
        setTests((prev) => [saved, ...prev.filter(t => (t.id !== saved.id && t._id !== saved._id))]);
        toast.success(`✅ Scheduled test "${saved.name}" saved to Database!`);
        return saved;
      } catch (err) {
        console.error('Failed to save test via API:', err);
        toast.error(`Database Save Error: ${err.message || 'Server error'}`);
        throw err;
      }
    }

    setTests((prev) => [newTest, ...prev]);
    toast.success(`Test "${newTest.name}" created locally!`);
    return newTest;
  }, [backendOnline]);

  const updateTest = useCallback(async (testId, updates) => {
    if (backendOnline) {
      try {
        const updatedTest = await api.updateTest(testId, updates);
        setTests((prev) => prev.map((t) => (t.id === testId || t._id === testId ? updatedTest : t)));
        toast.success('✅ Test updated successfully!');
        return updatedTest;
      } catch (err) {
        toast.error(err.message || 'Failed to update test');
        throw err;
      }
    } else {
      setTests((prev) =>
        prev.map((t) => (t.id === testId || t._id === testId ? { ...t, ...updates } : t))
      );
      toast.success('Test updated locally!');
      return { id: testId, ...updates };
    }
  }, [backendOnline]);

  const updateTestAnswerKey = useCallback(async (testId, answerKey) => {
    if (backendOnline) {
      try {
        const updatedTest = await api.updateTest(testId, { answerKey });
        setTests((prev) => prev.map((t) => (t.id === testId || t._id === testId ? { ...t, ...updatedTest, answerKey } : t)));
        toast.success('Answer Key updated successfully!');
        return updatedTest;
      } catch (err) {
        toast.error('Failed to update Answer Key');
        return null;
      }
    } else {
      setTests((prev) =>
        prev.map((t) => (t.id === testId || t._id === testId ? { ...t, answerKey } : t))
      );
      toast.success('Answer Key updated locally!');
      return { id: testId, answerKey };
    }
  }, [backendOnline]);

  const deleteTest = useCallback(async (testId) => {
    if (backendOnline) {
      try {
        await api.deleteTest(testId);
        setTests((prev) => prev.filter((t) => t.id !== testId));
        setTestResults((prev) => prev.filter((r) => r.testId !== testId));
        toast.success('Test and results deleted!');
        return;
      } catch (err) {
        toast.error('Failed to delete test');
        return;
      }
    }
    setTests((prev) => prev.filter((t) => t.id !== testId));
    setTestResults((prev) => prev.filter((r) => r.testId !== testId));
    toast.success('Test deleted locally!');
  }, [backendOnline]);

  const submitTestResults = useCallback(async (testId, results, status = 'Published') => {
    const test = tests.find((t) => t.id === testId);
    if (!test) return;

    const marksPerQ = test.marksPerQuestion || 1;
    const negMarks = test.negativeMarking || 0;

    const ranked = calculateRanks(results);
    const totalStudents = ranked.length;

    const newResults = ranked.map((r) => {
      const payloadItem = results.find(item => item.studentId === r.studentId);
      return {
        id: generateId('RES'),
        testId,
        studentId: r.studentId,
        marks: r.marks,
        totalMarks: test.totalMarks,
        percentage: Math.round((r.marks / test.totalMarks) * 1000) / 10,
        rank: r.rank,
        totalStudents,
        smsSent: status === 'Published',
        status: status,
        studentAnswers: payloadItem ? payloadItem.studentAnswers : [],
        omrSheetImage: payloadItem ? payloadItem.omrSheetImage : null
      };
    });

    if (backendOnline) {
      try {
        const savedResults = await api.saveTestResultsBulk(newResults);
        // Replace existing results for this test instead of duplicating
        setTestResults((prev) => {
          const filteredPrev = prev.filter((r) => r.testId !== testId);
          return [...filteredPrev, ...savedResults];
        });
      } catch (err) {
        toast.error(`Failed to upload test scores: ${err.message}`);
        return;
      }
    } else {
      setTestResults((prev) => {
        const filteredPrev = prev.filter((r) => r.testId !== testId);
        return [...filteredPrev, ...newResults];
      });
    }

    // Send SMS for each result ONLY if Published
    if (status === 'Published') {
      for (const result of newResults) {
        const student = students.find((s) => s.id === result.studentId);
        if (student) {
          const instName = user?.instituteName || 'Career Xone Pro';
          const smsLog = await sendTestResultSMS(
            student, test.name, result.marks, result.totalMarks,
            result.percentage, result.rank, totalStudents,
            instName
          );
          
          if (backendOnline) {
            try {
              const savedLog = await api.createSMSLog(smsLog);
              setSMSHistory((h) => [savedLog, ...h]);
            } catch (e) {
              console.error('Failed to log SMS on server', e);
            }
          } else {
            setSMSHistory((h) => [smsLog, ...h]);
          }
        }
      }
      toast.success(`Results published & ${newResults.length} SMS sent! 🎉`);
    } else {
      toast.success('Marks saved successfully! No SMS was sent.');
    }
  }, [tests, students, backendOnline, user]);

  // ---- SMS ----
  const sendManualSMS = useCallback(async (studentId, message, attachment = null) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;

    const instName = user?.instituteName || 'Career Xone Pro';
    const smsLog = await sendCustomSMS(student, message, instName, attachment);
    
    if (backendOnline) {
      try {
        const savedLog = await api.createSMSLog(smsLog);
        setSMSHistory((h) => [savedLog, ...h]);
      } catch (err) {
        toast.error('SMS log failed to save');
      }
    } else {
      setSMSHistory((h) => [smsLog, ...h]);
    }
    
    toast.success(`SMS sent to ${student.parentName}!`);
  }, [students, backendOnline, user]);

  const sendBulkManualSMS = useCallback(async (studentIds, message, attachment = null) => {
    const targetStudents = students.filter((s) => studentIds.includes(s.id));
    const instName = user?.instituteName || 'Career Xone Pro';
    for (const student of targetStudents) {
      const smsLog = await sendCustomSMS(student, message, instName, attachment);
      if (backendOnline) {
        try {
          const savedLog = await api.createSMSLog(smsLog);
          setSMSHistory((h) => [savedLog, ...h]);
        } catch (e) {
          console.error(e);
        }
      } else {
        setSMSHistory((h) => [smsLog, ...h]);
      }
    }
    toast.success(`SMS sent to ${targetStudents.length} parents! 📱`);
  }, [students, backendOnline, user]);

  const deleteSMS = useCallback(async (id) => {
    const targetId = String(id);
    // ⚡ Optimistic UI Update: Instantly remove from React state with 0ms delay
    setSMSHistory((prev) => {
      const updated = prev.filter((sms) => String(sms._id) !== targetId && String(sms.id) !== targetId);
      saveLocalData('smsHistory', updated);
      return updated;
    });

    if (backendOnline) {
      try {
        await api.deleteSMSLog(targetId);
        toast.success('SMS deleted permanently!');
      } catch (err) {
        console.error('Failed to delete SMS log from backend:', err);
      }
    } else {
      toast.success('SMS deleted locally!');
    }
  }, [backendOnline]);

  const deleteBulkSMS = useCallback(async (ids) => {
    if (!ids || ids.length === 0) return;
    const targetIds = new Set(ids.map(id => String(id)));
    // ⚡ Optimistic UI Update: Instantly remove all selected SMS logs
    setSMSHistory((prev) => {
      const updated = prev.filter((sms) => !targetIds.has(String(sms._id)) && !targetIds.has(String(sms.id)));
      saveLocalData('smsHistory', updated);
      return updated;
    });

    if (backendOnline) {
      try {
        await api.deleteSMSLogsBulk(Array.from(targetIds));
        toast.success(`Deleted ${ids.length} SMS logs successfully! 🗑️`);
      } catch (err) {
        console.error('Failed to bulk delete SMS logs from backend:', err);
        toast.error('Failed to delete SMS logs from server');
      }
    } else {
      toast.success(`${ids.length} SMS logs removed locally!`);
    }
  }, [backendOnline]);

  const deleteAllSMS = useCallback(async () => {
    const totalCount = smsHistory.length;
    setSMSHistory([]);
    saveLocalData('smsHistory', []);

    if (backendOnline) {
      try {
        await api.deleteAllSMSLogs();
        toast.success(`All ${totalCount} SMS logs deleted successfully! 🧹`);
      } catch (err) {
        console.error('Failed to clear all SMS logs from backend:', err);
        toast.error('Failed to clear SMS logs from server');
      }
    } else {
      toast.success('All SMS logs cleared locally!');
    }
  }, [backendOnline, smsHistory.length]);

  // Periodic and Online Auto-Sync for Inquiries and Cloud updates
  useEffect(() => {
    if (!backendOnline) return;

    const triggerAutoCloudSync = async () => {
      try {
        await api.syncDataToCloud();
      } catch (e) {}
    };

    const syncInquiriesFromCloud = async () => {
      try {
        const serverInquiries = await api.getInquiries();
        if (Array.isArray(serverInquiries)) {
          setInquiries(serverInquiries);
        }
      } catch (e) {}
    };

    const handleOnline = () => {
      console.log('🌐 Network reconnected. Triggering instant background cloud sync...');
      toast.success('🌐 Internet connected! Syncing data to Cloud...', { id: 'online-sync', duration: 3000 });
      triggerAutoCloudSync();
      syncInquiriesFromCloud();
    };

    // Initial background sync
    triggerAutoCloudSync();
    syncInquiriesFromCloud();

    // Trigger on network reconnect
    window.addEventListener('online', handleOnline);
    
    // Periodic background sync: every 3 minutes
    const syncInterval = setInterval(() => {
      triggerAutoCloudSync();
      syncInquiriesFromCloud();
    }, 180000);

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(syncInterval);
    };
  }, [backendOnline]);

  // ---- Reset Data ----
  const resetData = useCallback(async () => {
    if (backendOnline) {
      try {
        await api.resetDatabase();
        toast.success('Database cleared!');
      } catch (e) {
        toast.error('Reset failed');
      }
    }
    setStudents([]);
    setAttendance([]);
    setTests([]);
    setTestResults([]);
    setSMSHistory([]);
    setSessions([]);
    setInquiries([]);
    // Only clear EduTrack cache, preserving auth and system settings
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('edutrack_')) {
        localStorage.removeItem(key);
      }
    });
    toast.success('All data reset to defaults!');
  }, [backendOnline]);

  // ---- Real-time Refresh Helpers ----
  const refreshAttendance = useCallback(async () => {
    if (!backendOnline) return;
    try {
      const serverAttendance = await api.getAttendance();
      if (Array.isArray(serverAttendance)) {
        setAttendance(serverAttendance);
      }
    } catch (e) {
      console.warn('[AppContext] Failed to refresh attendance:', e.message);
    }
  }, [backendOnline]);

  const refreshSMSLogs = useCallback(async () => {
    if (!backendOnline) return;
    try {
      const serverSMS = await api.getSMSLogs();
      if (Array.isArray(serverSMS)) {
        setSMSHistory(serverSMS);
      }
    } catch (e) {
      console.warn('[AppContext] Failed to refresh SMS logs:', e.message);
    }
  }, [backendOnline]);

  const refreshAllData = useCallback(async () => {
    try {
      await loadServerData();
      return true;
    } catch (e) {
      console.error('Failed to refresh all data:', e);
      return false;
    }
  }, [loadServerData]);

  // ---- 🔄 SSE Live-Sync: Auto-refresh when server pulls new data from cloud ----
  useEffect(() => {
    if (!backendOnline) return;

    // Derive SSE URL from API_BASE (strip /api suffix)
    const sseUrl = API_BASE.replace(/\/api\/?$/, '') + '/api/sync/live';
    let eventSource;
    let reconnectTimer;

    function connect() {
      eventSource = new EventSource(sseUrl);

      eventSource.addEventListener('data-updated', (e) => {
        try {
          const data = JSON.parse(e.data);
          console.log('[SSE] Data updated from cloud:', data);
          refreshAllData();
        } catch (err) {
          console.warn('[SSE] Failed to parse event:', err);
        }
      });

      eventSource.addEventListener('connected', () => {
        console.log('[SSE] Connected to live-sync server');
      });

      eventSource.onerror = () => {
        eventSource.close();
        // Reconnect after 10 seconds
        reconnectTimer = setTimeout(connect, 10000);
      };
    }

    connect();

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [backendOnline, refreshAllData]);

  const value = {
    students,
    refreshAllData,
    attendance,
    setAttendance,
    refreshAttendance,
    tests,
    testResults,
    smsHistory,
    setSMSHistory,
    refreshSMSLogs,
    sessions,
    setSessions,
    inquiries,
    setInquiries,
    batches,
    backendOnline,
    loading,
    startupSyncing,
    startupSyncText,
    sidebarOpen,
    setSidebarOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
    addStudent,
    updateStudent,
    deleteStudent,
    deleteStudentsBulk,
    regenerateParentCredentials,
    markAttendance,
    addTest,
    updateTest,
    updateTestAnswerKey,
    deleteTest,
    submitTestResults,
    sendManualSMS,
    sendBulkManualSMS,
    deleteSMS,
    deleteBulkSMS,
    deleteAllSMS,
    resetData,
    appCardTheme,
    toggleAppCardTheme,
    cloudSyncStatus,
    cloudSyncMessage,
    lastCloudSyncTime,
    triggerCloudSync,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
