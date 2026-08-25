import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { batches } from '../data/sampleData';
import { generateId, getTodayStr, getCurrentTime, calculateRanks } from '../utils/helpers';
import { sendAttendanceSMS, sendTestResultSMS, sendCustomSMS } from '../utils/smsService';
import { api, checkBackendStatus, API_BASE } from '../utils/api';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const AppContext = createContext(null);

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
  const [startupSyncing, setStartupSyncing] = useState(true);
  const [startupSyncText, setStartupSyncText] = useState('Initializing Database & Cloud Connection...');
  
  const { user } = useAuth();
  const initRanRef = useRef(false);

  // Sync / Load data on startup
  useEffect(() => {
    if (initRanRef.current) return;
    initRanRef.current = true;

    async function loadServerData() {
      const studentsRes = await api.getStudents(1, 10000);
      const serverStudents = studentsRes.students || [];
      
      if (serverStudents.length === 0) {
        console.log('🌱 Database is empty. Starting fresh...');
        setStudents([]);
        setAttendance([]);
        setTests([]);
        setTestResults([]);
        setSMSHistory([]);
        setSessions([]);
        setInquiries([]);
      } else {
        const serverAttendance = await api.getAttendance();
        const serverTests = await api.getTests();
        const serverResults = await api.getTestResults();
        const serverSMS = await api.getSMSLogs();
        
        let serverSessions = [];
        let serverInquiries = [];
        try {
          serverSessions = await api.getSessions();
          serverInquiries = await api.getInquiries();
        } catch(e) { console.warn('Failed to load new schemas', e); }

        const validIds = new Set(serverStudents.map((s) => s.id));
        setStudents(serverStudents);
        setAttendance(Array.isArray(serverAttendance) ? serverAttendance : []);
        setTests(serverTests);
        setTestResults(serverResults.filter((r) => validIds.has(r.studentId)));
        setSMSHistory(Array.isArray(serverSMS) ? serverSMS : []);
        setSessions(serverSessions);
        setInquiries(serverInquiries);

        // Update local storage backup
        try {
          localStorage.setItem('edutrack_students', JSON.stringify(serverStudents));
          localStorage.setItem('edutrack_tests', JSON.stringify(serverTests));
        } catch(e) {}
      }
    }

    async function initData() {
      setStartupSyncing(true);
      setStartupSyncText('Connecting to Local & Cloud Database...');

      const isOnline = await checkBackendStatus();
      setBackendOnline(isOnline);

      if (isOnline) {
        try {
          setStartupSyncText('Syncing latest student records from Cloud Atlas...');
          // Trigger background pull from cloud if available
          try {
            await api.pullCloudData().catch(() => {});
          } catch(e) {}

          setStartupSyncText('Loading updated student dossiers & roll numbers...');
          await loadServerData();
        } catch (e) {
          console.error('❌ [DEBUG] Failed to load from server. Error:', e.message);
          loadFallbackData();
        }
      } else {
        console.log('⚠️ [DEBUG] Backend offline. Loading from localStorage...');
        loadFallbackData();
        toast('Offline Mode: Operating from local offline storage.', { id: 'backend-status-toast', icon: 'ℹ️' });

        // Background retry loop: if backend was spinning up, auto-sync when ready
        let attempts = 0;
        const retryTimer = setInterval(async () => {
          attempts++;
          if (attempts > 5) {
            clearInterval(retryTimer);
            return;
          }
          const ready = await checkBackendStatus(1, 0);
          if (ready) {
            clearInterval(retryTimer);
            setBackendOnline(true);
            try {
              await loadServerData();
              toast.success('Connected & Synced with Cloud Database!', { id: 'backend-status-toast' });
            } catch (e) {}
          }
        }, 2500);
      }

      setTimeout(() => {
        setStartupSyncing(false);
        setLoading(false);
      }, 600);
    }

    function loadFallbackData() {
      let localStudents = loadLocalData('students', []);
      localStudents = localStudents.map((s) => {
        const r = String(s.rollNo || '').trim();
        if (/^\d{1,4}$/.test(r)) {
          const newRoll = r.length === 4 ? `1${r}` : `1${r.padStart(4, '0')}`;
          return {
            ...s,
            rollNo: newRoll,
            parentUserId: s.parentUserId ? s.parentUserId.replace(r, newRoll) : `CAREER${newRoll}`
          };
        }
        return s;
      });

      const validIds = new Set(localStudents.map((s) => s.id));
      
      setStudents(localStudents);
      setAttendance(loadLocalData('attendance', []).filter((a) => validIds.has(a.studentId)));
      setTests(loadLocalData('tests', []));
      setTestResults(loadLocalData('testResults', []).filter((r) => validIds.has(r.studentId)));
      setSMSHistory(loadLocalData('smsHistory', []).filter((sms) => validIds.has(sms.studentId)));
      setSessions(loadLocalData('sessions', []));
      setInquiries(loadLocalData('inquiries', []));
    }

    initData();

    // Auto-sync on network reconnect
    const handleOnline = async () => {
      console.log('🌐 Network Reconnected! Triggering Auto-Cloud Sync...');
      toast.loading('Internet Reconnected: Syncing data to Cloud...', { id: 'cloud-auto-sync' });
      try {
        await api.bidirectionalSync();
        await loadServerData();
        toast.success('✅ Cloud Database Synchronized!', { id: 'cloud-auto-sync' });
      } catch(e) {
        toast.dismiss('cloud-auto-sync');
      }
    };

    window.addEventListener('online', handleOnline);

    // Periodic Background Auto-Sync (Every 60 Seconds)
    const periodicSync = setInterval(() => {
      if (navigator.onLine) {
        api.syncDataToCloud().catch(() => {});
      }
    }, 60000);

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(periodicSync);
    };
  }, []);

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
  const markAttendance = useCallback(async (studentId, type) => {
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
        
        // Trigger SMS and update log with correct session name
        sendAttendanceSMS(student, type, currentTime, instName, saved.sessionName).then(async (smsLog) => {
          try {
            const savedLog = await api.createSMSLog(smsLog);
            setSMSHistory((h) => [savedLog, ...h]);
          } catch (e) {
            console.error('Failed to save SMS log to backend', e);
          }
        });
        
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
    setSMSHistory((prev) => prev.filter((sms) => String(sms._id) !== targetId && String(sms.id) !== targetId));

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
    setSMSHistory((prev) => prev.filter((sms) => !targetIds.has(String(sms._id)) && !targetIds.has(String(sms.id))));

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
      const studentsRes = await api.getStudents(1, 10000);
      const serverStudents = studentsRes.students || [];
      const serverAttendance = await api.getAttendance();
      const serverTests = await api.getTests();
      const serverResults = await api.getTestResults();
      const serverSMS = await api.getSMSLogs();
      
      let serverSessions = [];
      let serverInquiries = [];
      try {
        serverSessions = await api.getSessions();
        serverInquiries = await api.getInquiries();
      } catch(e) {}

      const validIds = new Set(serverStudents.map((s) => s.id));
      setStudents(serverStudents);
      setAttendance(Array.isArray(serverAttendance) ? serverAttendance : []);
      setTests(serverTests);
      setTestResults(serverResults.filter((r) => validIds.has(r.studentId)));
      setSMSHistory(Array.isArray(serverSMS) ? serverSMS : []);
      setSessions(serverSessions);
      setInquiries(serverInquiries);
      return true;
    } catch (e) {
      console.error('Failed to refresh all data:', e);
      return false;
    }
  }, []);

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
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
