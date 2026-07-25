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
  const [backendOnline, setBackendOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const { user } = useAuth();

  // Sync / Load data on startup
  useEffect(() => {
    async function initData() {
      console.log('🔍 [DEBUG] initData started');
      console.log('🔍 [DEBUG] API_BASE from api.js will be used');
      console.log('🔍 [DEBUG] Token in localStorage:', localStorage.getItem('token') ? 'EXISTS (length=' + localStorage.getItem('token').length + ')' : 'MISSING');
      
      const isOnline = await checkBackendStatus();
      setBackendOnline(isOnline);
      console.log('🔍 [DEBUG] checkBackendStatus result:', isOnline);

      if (isOnline) {
        try {
          console.log('🔌 Backend is online. Fetching data from MongoDB...');
          console.log('🔍 [DEBUG] Calling api.getStudents()...');
          const studentsRes = await api.getStudents(1, 10000);
          const serverStudents = studentsRes.students || [];
          console.log('🔍 [DEBUG] api.getStudents() returned:', serverStudents.length, 'students');
          
          // If database is completely empty
          if (serverStudents.length === 0) {
            console.log('🌱 Database is empty. Starting fresh...');
            setStudents([]);
            setAttendance([]);
            setTests([]);
            setTestResults([]);
            setSMSHistory([]);
          } else {
            // Load all from server
            const serverAttendance = await api.getAttendance();
            const serverTests = await api.getTests();
            const serverResults = await api.getTestResults();
            const serverSMS = await api.getSMSLogs();

            const validIds = new Set(serverStudents.map((s) => s.id));
            setStudents(serverStudents);
            setAttendance(serverAttendance.filter((a) => validIds.has(a.studentId)));
            setTests(serverTests);
            setTestResults(serverResults.filter((r) => validIds.has(r.studentId)));
            setSMSHistory(serverSMS.filter((sms) => validIds.has(sms.studentId)));
            
            toast.success('Synced successfully!');
          }
        } catch (e) {
          console.error('❌ [DEBUG] Failed to load from server. Error:', e.message);
          console.error('❌ [DEBUG] Full error:', e);
          loadFallbackData();
        }
      } else {
        console.log('⚠️ [DEBUG] Backend offline. Loading from localStorage...');
        loadFallbackData();
        toast('Demo Mode: Backend offline. Using LocalStorage.', { icon: 'ℹ️' });
      }
      setLoading(false);
    }

    function loadFallbackData() {
      const localStudents = loadLocalData('students', []);
      const validIds = new Set(localStudents.map((s) => s.id));
      
      setStudents(localStudents);
      setAttendance(loadLocalData('attendance', []).filter((a) => validIds.has(a.studentId)));
      setTests(loadLocalData('tests', []));
      setTestResults(loadLocalData('testResults', []).filter((r) => validIds.has(r.studentId)));
      setSMSHistory(loadLocalData('smsHistory', []).filter((sms) => validIds.has(sms.studentId)));
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
        toast.success(`✅ Saved successfully: ${saved.name}`);

        return saved;
      } catch (err) {
        toast.error('Failed to save data');
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
        return;
      } catch (err) {
        toast.error('Failed to update student');
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
      }
    }

    setStudents((prev) => prev.filter((s) => s.id !== id));
    setAttendance((prev) => prev.filter((a) => a.studentId !== id));
    setTestResults((prev) => prev.filter((r) => r.studentId !== id));
    setSMSHistory((prev) => prev.filter((sms) => sms.studentId !== id));
    toast.success('Student removed locally!');
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
    // Trigger SMS and update log
    sendAttendanceSMS(student, type, currentTime, instName).then(async (smsLog) => {
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
        setTests((prev) => [saved, ...prev]);
        toast.success(`✅ Scheduled test saved!`);
        return saved;
      } catch (err) {
        toast.error('Failed to save test');
      }
    }

    setTests((prev) => [newTest, ...prev]);
    toast.success(`Test "${newTest.name}" created locally!`);
    return newTest;
  }, [backendOnline]);

  const updateTestAnswerKey = useCallback(async (testId, answerKey) => {
    if (backendOnline) {
      try {
        const updatedTest = await api.updateTest(testId, { answerKey });
        setTests((prev) => prev.map((t) => (t.id === testId ? updatedTest : t)));
        toast.success('Answer Key updated successfully!');
        return updatedTest;
      } catch (err) {
        toast.error('Failed to update Answer Key');
        return null;
      }
    } else {
      setTests((prev) =>
        prev.map((t) => (t.id === testId ? { ...t, answerKey } : t))
      );
      toast.success('Answer Key updated locally!');
      return null;
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
    if (backendOnline) {
      try {
        await api.deleteSMSLog(id);
        setSMSHistory((prev) => prev.filter((sms) => (sms._id || sms.id) !== id));
        toast.success('SMS deleted from database!');
        return;
      } catch (err) {
        toast.error('Failed to delete SMS');
      }
    }
    setSMSHistory((prev) => prev.filter((sms) => (sms._id || sms.id) !== id));
    toast.success('SMS deleted locally!');
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
    regenerateParentCredentials,
    markAttendance,
    addTest,
    updateTestAnswerKey,
    deleteTest,
    submitTestResults,
    sendManualSMS,
    sendBulkManualSMS,
    deleteSMS,
    resetData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
