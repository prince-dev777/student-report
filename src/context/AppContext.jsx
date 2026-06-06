import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  initialStudents,
  initialAttendance,
  initialTests,
  initialTestResults,
  initialSMSHistory,
  batches,
} from '../data/sampleData';
import { generateId, getTodayStr, getCurrentTime, calculateRanks } from '../utils/helpers';
import { sendAttendanceSMS, sendTestResultSMS, sendCustomSMS } from '../utils/smsService';
import { api, checkBackendStatus } from '../utils/api';
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
  const [backendOnline, setBackendOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sync / Load data on startup
  useEffect(() => {
    async function initData() {
      const isOnline = await checkBackendStatus();
      setBackendOnline(isOnline);

      if (isOnline) {
        try {
          console.log('🔌 Backend is online. Fetching data from MongoDB...');
          const serverStudents = await api.getStudents();
          
          // Seed if database is completely empty
          if (serverStudents.length === 0) {
            console.log('🌱 Database is empty. Seeding with sample data...');
            await api.seedDatabase({
              students: initialStudents,
              attendance: initialAttendance,
              tests: initialTests,
              testResults: initialTestResults,
              smsHistory: initialSMSHistory
            });
            
            setStudents(initialStudents);
            setAttendance(initialAttendance);
            setTests(initialTests);
            setTestResults(initialTestResults);
            setSMSHistory(initialSMSHistory);
            toast.success('Database seeded with sample data!');
          } else {
            // Load all from server
            const serverAttendance = await api.getAttendance();
            const serverTests = await api.getTests();
            const serverResults = await api.getTestResults();
            const serverSMS = await api.getSMSLogs();

            setStudents(serverStudents);
            setAttendance(serverAttendance);
            setTests(serverTests);
            setTestResults(serverResults);
            setSMSHistory(serverSMS);
            toast.success('Synced successfully with MongoDB!');
          }
        } catch (e) {
          console.error('Failed to load from server. Falling back to local.', e);
          loadFallbackData();
        }
      } else {
        console.log('⚠️ Backend offline. Loading from localStorage...');
        loadFallbackData();
        toast('Demo Mode: Backend offline. Using LocalStorage.', { icon: 'ℹ️' });
      }
      setLoading(false);
    }

    function loadFallbackData() {
      setStudents(loadLocalData('students', initialStudents));
      setAttendance(loadLocalData('attendance', initialAttendance));
      setTests(loadLocalData('tests', initialTests));
      setTestResults(loadLocalData('testResults', initialTestResults));
      setSMSHistory(loadLocalData('smsHistory', initialSMSHistory));
    }

    initData();
  }, []);

  // Save local fallbacks if backend offline
  useEffect(() => {
    if (!backendOnline && !loading) {
      saveLocalData('students', students);
    }
  }, [students, backendOnline, loading]);

  useEffect(() => {
    if (!backendOnline && !loading) {
      saveLocalData('attendance', attendance);
    }
  }, [attendance, backendOnline, loading]);

  useEffect(() => {
    if (!backendOnline && !loading) {
      saveLocalData('tests', tests);
    }
  }, [tests, backendOnline, loading]);

  useEffect(() => {
    if (!backendOnline && !loading) {
      saveLocalData('testResults', testResults);
    }
  }, [testResults, backendOnline, loading]);

  useEffect(() => {
    if (!backendOnline && !loading) {
      saveLocalData('smsHistory', smsHistory);
    }
  }, [smsHistory, backendOnline, loading]);

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
        toast.success(`✅ Saved to MongoDB: ${saved.name}`);
        return saved;
      } catch (err) {
        toast.error('Failed to save to backend');
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
        toast.success('✅ Student updated in MongoDB!');
        return;
      } catch (err) {
        toast.error('Failed to update student on server');
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
        toast.success('✅ Student deleted from MongoDB!');
        return;
      } catch (err) {
        toast.error('Failed to delete student from server');
      }
    }

    setStudents((prev) => prev.filter((s) => s.id !== id));
    toast.success('Student removed locally!');
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

    // Trigger SMS and update log
    sendAttendanceSMS(student, type, currentTime).then(async (smsLog) => {
      if (backendOnline) {
        try {
          const savedLog = await api.createSMSLog(smsLog);
          setSMSHistory((h) => [savedLog, ...h]);
        } catch (e) {
          console.error('Failed to save SMS log to backend', e);
        }
      } else {
        setSMSHistory((h) => [smsLog, ...h]);
      }
    });

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
      id: generateId('TEST'),
    };

    if (backendOnline) {
      try {
        const saved = await api.createTest(newTest);
        setTests((prev) => [...prev, saved]);
        toast.success(`✅ Scheduled test saved to MongoDB!`);
        return saved;
      } catch (err) {
        toast.error('Failed to save test to server');
      }
    }

    setTests((prev) => [...prev, newTest]);
    toast.success(`Test "${newTest.name}" created locally!`);
    return newTest;
  }, [backendOnline]);

  const submitTestResults = useCallback(async (testId, results) => {
    const test = tests.find((t) => t.id === testId);
    if (!test) return;

    const ranked = calculateRanks(results);
    const totalStudents = ranked.length;

    const newResults = ranked.map((r) => ({
      id: generateId('RES'),
      testId,
      studentId: r.studentId,
      marks: r.marks,
      totalMarks: test.totalMarks,
      percentage: Math.round((r.marks / test.totalMarks) * 1000) / 10,
      rank: r.rank,
      totalStudents,
      smsSent: true,
    }));

    if (backendOnline) {
      try {
        const savedResults = await api.saveTestResultsBulk(newResults);
        setTestResults((prev) => [...prev, ...savedResults]);
      } catch (err) {
        toast.error('Failed to upload test scores to server');
        return;
      }
    } else {
      setTestResults((prev) => [...prev, ...newResults]);
    }

    // Send SMS for each result
    for (const result of newResults) {
      const student = students.find((s) => s.id === result.studentId);
      if (student) {
        const smsLog = await sendTestResultSMS(
          student, test.name, result.marks, result.totalMarks,
          result.percentage, result.rank, totalStudents
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

    toast.success(`Results submitted & ${newResults.length} SMS sent! 🎉`);
  }, [tests, students, backendOnline]);

  // ---- SMS ----
  const sendManualSMS = useCallback(async (studentId, message) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;

    const smsLog = await sendCustomSMS(student, message);
    
    if (backendOnline) {
      try {
        const savedLog = await api.createSMSLog(smsLog);
        setSMSHistory((h) => [savedLog, ...h]);
      } catch (err) {
        toast.error('SMS log failed on server');
      }
    } else {
      setSMSHistory((h) => [smsLog, ...h]);
    }
    
    toast.success(`SMS sent to ${student.parentName}!`);
  }, [students, backendOnline]);

  const sendBulkManualSMS = useCallback(async (studentIds, message) => {
    const targetStudents = students.filter((s) => studentIds.includes(s.id));
    for (const student of targetStudents) {
      const smsLog = await sendCustomSMS(student, message);
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
  }, [students, backendOnline]);

  // ---- Reset Data ----
  const resetData = useCallback(async () => {
    if (backendOnline) {
      try {
        await api.resetDatabase();
        toast.success('MongoDB Database cleared!');
      } catch (e) {
        toast.error('Server reset failed');
      }
    }
    setStudents(initialStudents);
    setAttendance(initialAttendance);
    setTests(initialTests);
    setTestResults(initialTestResults);
    setSMSHistory(initialSMSHistory);
    localStorage.clear();
    toast.success('All data reset to defaults!');
  }, [backendOnline]);

  const value = {
    students,
    attendance,
    tests,
    testResults,
    smsHistory,
    batches,
    backendOnline,
    loading,
    sidebarOpen,
    setSidebarOpen,
    addStudent,
    updateStudent,
    deleteStudent,
    markAttendance,
    addTest,
    submitTestResults,
    sendManualSMS,
    sendBulkManualSMS,
    resetData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
