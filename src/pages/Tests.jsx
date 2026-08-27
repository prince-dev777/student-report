import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ClipboardList, Plus, FileSpreadsheet, BookOpen, 
  UserCheck, Award, TrendingUp, X, Check, Calculator, Upload, Trash2, Save, Download, Loader2, ZoomIn, ZoomOut, AlertTriangle, Eye, Edit2,
  Search, Sparkles, ArrowRight, CheckCircle2, ChevronRight, Layers, FileCheck, RefreshCw, Filter, Calendar, Users, Copy,
  LayoutGrid, List, ArrowUpDown, SlidersHorizontal, ChevronLeft
} from 'lucide-react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { useApp } from '../context/AppContext';
import { subjects } from '../data/sampleData';
import { formatDate, calcTestAverage, getMarksCategory, getRankBadgeClass, formatBatchName } from '../utils/helpers';
import toast from 'react-hot-toast';
import { api, getMediaUrl } from '../utils/api';
import omrTemplatePdf from '../assets/OMR_Templates.pdf';
import EditTestModal from '../components/EditTestModal';
import MultiClassSelect from '../components/MultiClassSelect';

// Helper to identify bonus questions in answer keys (e.g. '*', '*A', '*B', '*1', 'BONUS')
export const isBonusAnswer = (key) => {
  if (key === undefined || key === null) return false;
  const str = String(key).trim().toUpperCase();
  return str === '*' || str.startsWith('*') || str.endsWith('*') || str.includes('BONUS') || str.includes('STAR');
};

// Helper to check if a student belongs to the test's target classes
export const isStudentInTestClasses = (studentClass, test) => {
  if (!test) return true;
  // 1. Array check (new multi-class format)
  if (Array.isArray(test.targetClasses) && test.targetClasses.length > 0) {
    return test.targetClasses.includes(studentClass);
  }
  // 2. Comma-separated or single string check (backward compatibility)
  if (test.targetClass && typeof test.targetClass === 'string' && test.targetClass.trim() !== '') {
    const classes = test.targetClass.split(',').map((c) => c.trim()).filter(Boolean);
    if (classes.length === 0) return true;
    return classes.includes(studentClass);
  }
  // 3. Fallback: all classes in course match
  return true;
};

export default function Tests() {
  const { 
    tests, testResults, students, batches, 
    addTest, updateTest, updateTestAnswerKey, deleteTest, submitTestResults 
  } = useApp();

  const getCourseName = (batchId) => {
    return formatBatchName(batchId, batches);
  };

  const [activeTab, setActiveTab] = useState('all-tests');
  const [selectedTestResults, setSelectedTestResults] = useState(null);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [selectedStudentResult, setSelectedStudentResult] = useState(null);
  const [omrScanErrors, setOmrScanErrors] = useState([]);
  const [testToDelete, setTestToDelete] = useState(null);
  const [editingTest, setEditingTest] = useState(null);

  // 🔍 All Tests Tab Controls (Search, Filters, Sort, View Mode & Pagination)
  const [testSearchQuery, setTestSearchQuery] = useState('');
  const [testCourseFilter, setTestCourseFilter] = useState('ALL');
  const [testStatusFilter, setTestStatusFilter] = useState('ALL');
  const [testSortBy, setTestSortBy] = useState('newest');
  const [testViewMode, setTestViewMode] = useState(() => {
    try {
      return localStorage.getItem('tests_view_mode') || 'grid';
    } catch (e) {
      return 'grid';
    }
  });
  const [testCurrentPage, setTestCurrentPage] = useState(1);
  const [testPageSize, setTestPageSize] = useState(12);

  const handleViewModeChange = (mode) => {
    setTestViewMode(mode);
    try {
      localStorage.setItem('tests_view_mode', mode);
    } catch (e) {}
  };

  // For Create Test form (Answer Key input removed as it is now moved to Enter Marks page)
  const [testForm, setTestForm] = useState({
    name: '',
    batch: '',
    targetClasses: [],
    targetClass: '',
    date: new Date().toISOString().split('T')[0],
    totalMarks: 300,
    marksPerQuestion: 4,
    negativeMarking: 1,
    templateId: 'T1',
    questionsToDetect: 75,
  });

  const [subjectMapping, setSubjectMapping] = useState([]);

  // Close details dropdowns when clicking outside
  React.useEffect(() => {
    const handleOutsideClick = (e) => {
      const dropdowns = document.querySelectorAll('details.dropdown[open]');
      dropdowns.forEach(dropdown => {
        if (!dropdown.contains(e.target)) {
          dropdown.removeAttribute('open');
        }
      });
    };
    
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Auto-calculate Total Marks and Questions to Detect when subject mapping or marks-per-question change
  React.useEffect(() => {
    let selectedQuestionsCount = 0;
    if (subjectMapping && subjectMapping.length > 0) {
      subjectMapping.forEach(m => {
        if (m.fromQ && m.toQ) {
          selectedQuestionsCount += (Number(m.toQ) - Number(m.fromQ) + 1);
        }
      });
    } else {
      selectedQuestionsCount = Number(testForm.questionsToDetect) || 0;
    }

    setTestForm(prev => {
      const mPerQ = Number(prev.marksPerQuestion) || 0;
      const expectedTotal = selectedQuestionsCount * mPerQ;
      const nextQuestionsToDetect = selectedQuestionsCount;
      
      if (prev.totalMarks !== expectedTotal || prev.questionsToDetect !== nextQuestionsToDetect) {
        return { 
          ...prev, 
          totalMarks: expectedTotal,
          questionsToDetect: nextQuestionsToDetect
        };
      }
      return prev;
    });
  }, [subjectMapping, testForm.marksPerQuestion]);

  // Auto-populate subjectMapping based on template
  React.useEffect(() => {
    const t = testForm.templateId;
    if (t === 'T1' || t === 'T2') {
      setSubjectMapping([
        { subject: 'Physics', fromQ: 1, toQ: 25 },
        { subject: 'Chemistry', fromQ: 26, toQ: 50 },
        { subject: 'Mathematics', fromQ: 51, toQ: 75 }
      ]);
    } else if (t === 'T3') {
      setSubjectMapping([
        { subject: 'Physics', fromQ: 1, toQ: 45 },
        { subject: 'Chemistry', fromQ: 46, toQ: 90 },
        { subject: 'Biology', fromQ: 91, toQ: 180 }
      ]);
    } else if (t === 'T4') {
      setSubjectMapping([
        { subject: 'Biology', fromQ: 1, toQ: 90 }
      ]);
    } else if (t === 'T5') {
      setSubjectMapping([
        { subject: 'Physics', fromQ: 1, toQ: 50 },
        { subject: 'Chemistry', fromQ: 51, toQ: 100 },
        { subject: 'Mathematics', fromQ: 101, toQ: 150 },
        { subject: 'Biology', fromQ: 151, toQ: 200 }
      ]);
    } else if (t === 'T6') {
      setSubjectMapping([
        { subject: 'Physics', fromQ: 1, toQ: 50 },
        { subject: 'Chemistry', fromQ: 51, toQ: 100 },
        { subject: 'Biology', fromQ: 101, toQ: 200 }
      ]);
    } else {
      // T7 and fallback
      setSubjectMapping([
        { subject: 'General', fromQ: 1, toQ: 50 }
      ]);
    }
  }, [testForm.templateId]);


  // For Marks Entry
  const [entryTestId, setEntryTestId] = useState('');
  const [entryMarksBatchFilter, setEntryMarksBatchFilter] = useState('ALL');
  const [entryMarksStatusFilter, setEntryMarksStatusFilter] = useState('ALL');
  const [entryMarksSortBy, setEntryMarksSortBy] = useState('newest');
  const [entryMarksSearch, setEntryMarksSearch] = useState('');
  const [entryMarksViewMode, setEntryMarksViewMode] = useState(() => {
    try {
      return localStorage.getItem('entry_marks_view_mode') || 'grid';
    } catch (e) {
      return 'grid';
    }
  });
  const [entryMarksPageSize, setEntryMarksPageSize] = useState(12);
  const [entryMarksCurrentPage, setEntryMarksCurrentPage] = useState(1);

  const handleEntryMarksViewModeChange = (mode) => {
    setEntryMarksViewMode(mode);
    try {
      localStorage.setItem('entry_marks_view_mode', mode);
    } catch (e) {}
  };

  const [marksData, setMarksData] = useState({}); // studentId: marks
  const [omrStats, setOmrStats] = useState({}); // studentId: { correct, wrong }
  const [scannedAnswersData, setScannedAnswersData] = useState({}); // studentId: [selectedOption1, selectedOption2, ...]
  const [omrUploading, setOmrUploading] = useState(false);
  const [omrTemplate, setOmrTemplate] = useState('T1');
  const [lastOmrScanDir, setLastOmrScanDir] = useState(() => localStorage.getItem('last_omr_scan_dir') || '');
  const [lastScannedImages, setLastScannedImages] = useState([]);
  const [isDownloadingOmrs, setIsDownloadingOmrs] = useState(false);
  const [showDownloadOmrModal, setShowDownloadOmrModal] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(null);
  const [omrImagesData, setOmrImagesData] = useState({}); // studentId: image dataURI
  const [omrFilenames, setOmrFilenames] = useState({}); // studentId: original folder filename
  const [selectedOmrImage, setSelectedOmrImage] = useState(null);
  const [omrZoomScale, setOmrZoomScale] = useState(1);
  const [showManualAnswerKeyModal, setShowManualAnswerKeyModal] = useState(false);
  const [manualAnswersGrid, setManualAnswersGrid] = useState([]);
  const [searchStudentQuery, setSearchStudentQuery] = useState('');
  const [searchLeaderboardQuery, setSearchLeaderboardQuery] = useState('');
  const [singleOmrUploadingId, setSingleOmrUploadingId] = useState(null);

  // Memoize selected test for marks entry
  const selectedEntryTest = React.useMemo(() => {
    return tests.find(t => t.id === entryTestId) || null;
  }, [tests, entryTestId]);

  // Filter & sort tests list for the Enter Marks selector view
  const filteredEntryTests = React.useMemo(() => {
    let list = (tests || []).filter(t => {
      // 1. Search Query
      if (entryMarksSearch.trim()) {
        const q = entryMarksSearch.toLowerCase();
        const nameMatch = (t.name || '').toLowerCase().includes(q);
        const subMatch = (t.subject || '').toLowerCase().includes(q);
        const batchMatch = formatBatchName(t.batch, batches).toLowerCase().includes(q);
        const classMatch = (Array.isArray(t.targetClasses) ? t.targetClasses.join(' ') : (t.targetClass || '')).toLowerCase().includes(q);
        const dateMatch = formatDate(t.date).toLowerCase().includes(q) || (t.date || '').toLowerCase().includes(q);
        if (!nameMatch && !subMatch && !batchMatch && !classMatch && !dateMatch) {
          return false;
        }
      }

      // 2. Course / Batch Filter
      if (entryMarksBatchFilter !== 'ALL') {
        const courseName = getCourseName(t.batch).toLowerCase();
        const target = entryMarksBatchFilter.toLowerCase();
        if (!courseName.includes(target) && t.batch !== entryMarksBatchFilter) {
          return false;
        }
      }

      // 3. Status Filter (Evaluated vs Pending)
      if (entryMarksStatusFilter !== 'ALL') {
        const appeared = testResults.filter(r => r.testId === t.id).length;
        if (entryMarksStatusFilter === 'evaluated' && appeared === 0) return false;
        if (entryMarksStatusFilter === 'pending' && appeared > 0) return false;
      }

      return true;
    });

    // Sort
    list.sort((a, b) => {
      if (entryMarksSortBy === 'newest') {
        return new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0);
      }
      if (entryMarksSortBy === 'oldest') {
        return new Date(a.date || a.createdAt || 0) - new Date(b.date || b.createdAt || 0);
      }
      if (entryMarksSortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (entryMarksSortBy === 'marks') {
        return (Number(b.totalMarks) || 0) - (Number(a.totalMarks) || 0);
      }
      if (entryMarksSortBy === 'appeared') {
        const appA = testResults.filter(r => r.testId === a.id).length;
        const appB = testResults.filter(r => r.testId === b.id).length;
        return appB - appA;
      }
      return 0;
    });

    return list;
  }, [tests, testResults, entryMarksBatchFilter, entryMarksStatusFilter, entryMarksSortBy, entryMarksSearch, batches]);

  // Reset page when filters change
  React.useEffect(() => {
    setEntryMarksCurrentPage(1);
  }, [entryMarksSearch, entryMarksBatchFilter, entryMarksStatusFilter, entryMarksSortBy, entryMarksPageSize]);

  // Paginated Entry Tests
  const actualEntryPageSize = entryMarksPageSize === 'all' ? (filteredEntryTests.length || 1) : Number(entryMarksPageSize);
  const totalEntryTestPages = Math.ceil(filteredEntryTests.length / actualEntryPageSize) || 1;
  const paginatedEntryTests = React.useMemo(() => {
    if (entryMarksPageSize === 'all') return filteredEntryTests;
    const start = (entryMarksCurrentPage - 1) * actualEntryPageSize;
    return filteredEntryTests.slice(start, start + actualEntryPageSize);
  }, [filteredEntryTests, entryMarksCurrentPage, entryMarksPageSize, actualEntryPageSize]);

  // Dynamically compute the physical question numbers mapped for the entry test
  const questionNumbers = React.useMemo(() => {
    const qNums = [];
    if (selectedEntryTest && selectedEntryTest.subjectMapping && selectedEntryTest.subjectMapping.length > 0) {
      selectedEntryTest.subjectMapping.forEach(m => {
        if (m.fromQ && m.toQ) {
          for (let i = Number(m.fromQ); i <= Number(m.toQ); i++) {
            qNums.push(i);
          }
        }
      });
    } else {
      const totalQ = selectedEntryTest?.questionsToDetect || 100;
      for (let i = 1; i <= totalQ; i++) {
        qNums.push(i);
      }
    }
    return qNums;
  }, [selectedEntryTest]);

  // Handle test creation
  const handleCreateTest = async (e) => {
    e.preventDefault();
    if (!testForm.name.trim()) return toast.error('Test Name is required');
    if (!testForm.batch) return toast.error('Please select a course');
    if (!testForm.totalMarks || testForm.totalMarks <= 0) return toast.error('Total Marks must be greater than 0');

    if (subjectMapping.length === 0) return toast.error('Please add at least one subject mapping');
    const hasEmptySubject = subjectMapping.some(m => !m.subject || !m.fromQ || !m.toQ);
    if (hasEmptySubject) return toast.error('Please fill all subject mapping fields');



    setSubmittingAction('CreateTest');
    try {
      await addTest({
        name: testForm.name,
        subject: subjectMapping.map(s => s.subject).join(', '),
        subjectMapping: subjectMapping,
        batch: testForm.batch,
        targetClasses: testForm.targetClasses || [],
        targetClass: Array.isArray(testForm.targetClasses) && testForm.targetClasses.length > 0
          ? testForm.targetClasses.join(', ')
          : testForm.targetClass || '',
        date: testForm.date,
        totalMarks: Number(testForm.totalMarks),
        marksPerQuestion: Number(testForm.marksPerQuestion) || 1,
        negativeMarking: Number(testForm.negativeMarking) || 0,
        templateId: testForm.templateId || 'T1',
        questionsToDetect: Number(testForm.questionsToDetect) || 75,
        answerKey: [] // Created without answer key initially
      });

    setTestForm({
      name: '',
      batch: '',
      targetClasses: [],
      targetClass: '',
      date: new Date().toISOString().split('T')[0],
      totalMarks: 300,
      marksPerQuestion: 4,
      negativeMarking: 1,
      templateId: 'T1',
      questionsToDetect: 75,
    });
    setManualAnswersGrid([]);
    // Subject mapping is auto-handled by useEffect when templateId resets

      setActiveTab('all-tests');
    } finally {
      setSubmittingAction(null);
    }
  };

  // Handle test selection for marks entry
  const handleEntryTestChange = (testId) => {
    setEntryTestId(testId);
    if (!testId) {
      setMarksData({});
      setOmrStats({});
      setScannedAnswersData({});
      setOmrImagesData({});
      setOmrFilenames({});
      setManualAnswersGrid([]);
      return;
    }

    const test = tests.find(t => t.id === testId || t._id === testId);
    if (!test) return;

    if (test.templateId) {
      setOmrTemplate(test.templateId);
    } else {
      setOmrTemplate('T1');
    }

    // Compute question numbers for this specific test
    const qNums = [];
    if (test.subjectMapping && test.subjectMapping.length > 0) {
      test.subjectMapping.forEach(m => {
        if (m.fromQ && m.toQ) {
          for (let i = Number(m.fromQ); i <= Number(m.toQ); i++) {
            qNums.push(i);
          }
        }
      });
    } else {
      const totalQ = test.questionsToDetect || 100;
      for (let i = 1; i <= totalQ; i++) {
        qNums.push(i);
      }
    }

    // Initialize fresh manualAnswersGrid for this test!
    const initialKey = Array.isArray(test.answerKey) ? test.answerKey : [];
    const newGrid = new Array(qNums.length).fill('');
    qNums.forEach((qNum, idx) => {
      if (qNum && qNum <= initialKey.length) {
        newGrid[idx] = initialKey[qNum - 1] || '';
      }
    });
    setManualAnswersGrid(newGrid);

    // Get all active students in the selected test's course & class
    const batchStudents = students.filter(s => s.batch === test.batch && isStudentInTestClasses(s.class, test) && s.status === 'active');
    
    // Check if there are existing results for this test to pre-fill
    const existing = testResults.filter(r => r.testId === testId);
    const initialMarks = {};
    const initialScannedAnswers = {};
    const initialOmrStats = {};
    const initialOmrImages = {};
    const initialOmrFilenames = {};
    
    batchStudents.forEach(s => {
      const match = existing.find(r => r.studentId === s.id);
      initialMarks[s.id] = match ? match.marks : '';
      initialScannedAnswers[s.id] = (match && match.studentAnswers) ? match.studentAnswers : [];
      if (match && match.omrSheetImage) {
        initialOmrImages[s.id] = match.omrSheetImage;
        initialOmrFilenames[s.id] = match.omrOriginalFilename || null;
      }
      if (match && match.studentAnswers && match.studentAnswers.length > 0) {
        const answerKey = test.answerKey || [];
        let correct = 0;
        let wrong = 0;
        match.studentAnswers.forEach((ans, idx) => {
          const isObj = typeof ans === 'object' && ans !== null;
          const status = isObj ? ans.status : (ans && ans !== 'NULL' ? 'valid' : 'blank');
          const val = isObj ? ans.selectedOption : ans;

          let isMapped = true;
          if (test.subjectMapping && test.subjectMapping.length > 0) {
            const qNum = idx + 1;
            isMapped = test.subjectMapping.some(sub => qNum >= sub.fromQ && qNum <= sub.toQ);
          }

          if (isMapped) {
            if (status === 'invalid') {
              wrong++;
            } else if (status === 'valid' && val && val !== 'NULL' && idx < answerKey.length) {
              const k = String(answerKey[idx]).trim().toUpperCase();
              const a = String(val).trim().toUpperCase();
              const isBonus = isBonusAnswer(k);
              const isMatch = (a === k) || (!isNaN(parseFloat(a)) && !isNaN(parseFloat(k)) && parseFloat(a) === parseFloat(k));
              if (isBonus || isMatch) {
                correct++;
              } else {
                wrong++;
              }
            }
          }
        });
        initialOmrStats[s.id] = { correct, wrong };
      }
    });

    setMarksData(initialMarks);
    setScannedAnswersData(initialScannedAnswers);
    setOmrStats(initialOmrStats);
    setOmrImagesData(initialOmrImages);
    setOmrFilenames(initialOmrFilenames);
  };

  // Handle marks changes
  const handleMarksChange = (studentId, val) => {
    setMarksData(prev => ({
      ...prev,
      [studentId]: val === '' ? '' : Number(val)
    }));
  };

  // Submit test results
  const handleMarksSubmit = async (e, forceAction) => {
    if (e) e.preventDefault();
    const action = forceAction || (e?.nativeEvent?.submitter?.value) || 'Save';
    const submitStatus = 'Draft';
    if (!entryTestId) return toast.error('Select a test first');

    const test = selectedEntryTest;
    if (!test) return;

    // Check if any mark exceeds totalMarks or is negative
    const batchStudents = students.filter(s => s.batch === test.batch && isStudentInTestClasses(s.class, test) && s.status === 'active');
    const resultsPayload = [];

    setSubmittingAction(action);
    try {
      for (const student of batchStudents) {
        const mark = marksData[student.id];
      // Skip empty fields to allow partial submissions (as requested)
      if (mark === '' || mark === undefined) {
        continue;
      }
      if (mark > test.totalMarks) {
        return toast.error(`Marks for ${student.name} cannot exceed maximum marks (${test.totalMarks})`);
      }
      resultsPayload.push({
        studentId: student.id,
        marks: Number(mark),
        studentAnswers: scannedAnswersData[student.id] || [],
        omrSheetImage: omrImagesData[student.id] || null,
        omrOriginalFilename: omrFilenames[student.id] || null
      });
    }

      if (resultsPayload.length === 0) {
        return toast.error('No student marks have been entered.');
      }

      await submitTestResults(entryTestId, resultsPayload, submitStatus);
      setEntryTestId('');
      setMarksData({});
      setOmrStats({});
      setScannedAnswersData({});
      setOmrImagesData({});
      setOmrFilenames({});
      setActiveTab('all-tests');
    } finally {
      setSubmittingAction(null);
    }
  };

  // Handle OMR Images Upload
  const handleOMRUpload = async (e) => {
    setOmrScanErrors([]);
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const test = selectedEntryTest;
    if (!test) return toast.error('Please select a test first');

    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return toast.error('Please select valid image files (.jpg, .png)');

    // Extract exact source directory path from the uploaded image files
    let detectedPath = '';
    for (const f of imageFiles) {
      if (window.electronAPI && typeof window.electronAPI.getPathForFile === 'function') {
        try {
          detectedPath = window.electronAPI.getPathForFile(f);
        } catch (e) {}
      }
      if (!detectedPath && f && f.path) {
        detectedPath = f.path;
      }
      if (detectedPath) break;
    }
    if (detectedPath) {
      const sourceDir = detectedPath.replace(/[/\\][^/\\]+$/, '');
      setLastOmrScanDir(sourceDir);
      localStorage.setItem('last_omr_scan_dir', sourceDir);
      console.log('📁 Detected OMR Source Folder:', sourceDir);
    }

    setOmrUploading(true);
    const formData = new FormData();
    formData.append('testId', entryTestId);
    formData.append('templateId', omrTemplate);
    
    let maxMappedQ = test.questionsToDetect || 180;
    if (test.subjectMapping && test.subjectMapping.length > 0) {
        maxMappedQ = Math.max(...test.subjectMapping.map(m => Number(m.toQ) || 0));
    }
    formData.append('questionsToDetect', maxMappedQ);
    
    // Pass test configurations for grading
    const testData = {
      marksPerQuestion: test.marksPerQuestion || 1,
      negativeMarking: test.negativeMarking || 0,
      answer_keys: test.answerKey || {},
      mapped_questions: questionNumbers || []
    };
    formData.append('testData', JSON.stringify(testData));
    
    imageFiles.forEach(file => {
      formData.append('images', file);
    });

    try {
      const res = await api.uploadOMRImages(formData);
      
      const newMarksData = { ...marksData };
      const newOmrStats = { ...omrStats };
      const newScannedAnswers = { ...scannedAnswersData };
      const newOmrImagesData = { ...omrImagesData };
      const newOmrFilenames = { ...omrFilenames };
      let matchedCount = 0;
      const currentErrors = res.errors || [];

      const allScannedImages = [];
      (res.results || []).forEach(r => {
        if (r.omrSheetImage) allScannedImages.push({ url: r.omrSheetImage, rollNo: String(r.rollNo), filename: r.filename });
      });
      currentErrors.forEach((e, i) => {
        if (e.omrSheetImage) allScannedImages.push({ url: e.omrSheetImage, rollNo: 'Wrong_OMR_' + (i + 1), filename: e.filename });
      });
      setLastScannedImages(allScannedImages);

      // 1. Map each result to student
      const mappedResults = (res.results || []).map(r => {
        const matchedStudent = students.find(s => {
          if (s.rollNo == null || r.rollNo == null) return false;
          const sRollStr = String(s.rollNo).trim();
          const rRollRaw = String(r.rollNo).trim();
          const rRollClean = rRollRaw.replace(/^\?+|\?+$/g, '').trim();
          const rDigits = rRollRaw.replace(/[^0-9]/g, '');

          if (sRollStr.toLowerCase() === rRollRaw.toLowerCase() || sRollStr.toLowerCase() === rRollClean.toLowerCase()) {
            return true;
          }
          if (!isNaN(sRollStr) && !isNaN(rRollClean) && rRollClean !== '') {
            return Number(sRollStr) === Number(rRollClean);
          }
          if (!isNaN(sRollStr) && rDigits !== '' && !isNaN(rDigits)) {
            return Number(sRollStr) === Number(rDigits);
          }
          return false;
        });

        const key = matchedStudent
          ? `STU_${matchedStudent.id}`
          : (r.rollNo ? `ROLL_${String(r.rollNo).trim()}` : `UNMATCHED_${Math.random()}`);

        return {
          result: r,
          student: matchedStudent || null,
          studentKey: key
        };
      });

      // 2. Count occurrences to detect duplicates across the batch
      const keyCounts = {};
      mappedResults.forEach(item => {
        keyCounts[item.studentKey] = (keyCounts[item.studentKey] || 0) + 1;
      });

      // 3. Process each scanned OMR
      mappedResults.forEach((item, itemIdx) => {
        const r = item.result;
        const matchedStudent = item.student;
        const isDuplicate = keyCounts[item.studentKey] > 1;

        if (!matchedStudent) {
          currentErrors.push({
            rollNumber: r.rollNo || 'Missing',
            studentName: '',
            error: r.rollNo ? `Roll No ${r.rollNo} not found in database` : 'Roll No missing on sheet',
            details: `File: ${r.filename || 'Unknown file'}`,
            omrSheetImage: r.omrSheetImage,
            filename: r.filename
          });
          return;
        }

        if (isDuplicate) {
          currentErrors.push({
            rollNumber: r.rollNo || matchedStudent.rollNo,
            studentName: matchedStudent.name,
            error: `Duplicate OMR Detected (${r.rollNo || matchedStudent.rollNo}) - Not Inserted`,
            details: `File: ${r.filename || 'Unknown file'}. Multiple sheets detected with this Roll No. Both are kept outside for review.`,
            omrSheetImage: r.omrSheetImage,
            filename: r.filename
          });
          console.warn(`OMR Scan: Duplicate Roll No ${r.rollNo}. Neither sheet will be inserted automatically.`);
          return;
        }

        // Valid single student -> Insert marks & image
        const sId = matchedStudent.id;
        newMarksData[sId] = r.marks;
        if (r.omrSheetImage) {
          newOmrImagesData[sId] = r.omrSheetImage;
          newOmrFilenames[sId] = r.filename;
        }

        let rawAnswers = [];
        if (r.studentAnswers) {
          rawAnswers = r.studentAnswers;
        } else if (r.subjects) {
          const subjectNames = Object.keys(r.subjects).sort();
          for (const subj of subjectNames) {
            rawAnswers = rawAnswers.concat(r.subjects[subj]);
          }
        }

        const answerKey = test.answerKey || [];
        const marksPerQ = test.marksPerQuestion || 1;
        const negMarks = test.negativeMarking || 0;
        let correct = 0;
        let wrong = 0;

        const flatAnswers = rawAnswers.map((ans, idx) => {
           const isObj = typeof ans === 'object' && ans !== null;
           const status = isObj ? ans.status : (ans ? 'valid' : 'blank');
           const selected = isObj ? ans.selectedOption : ans;
           
           let isMapped = true;
           if (test.subjectMapping && test.subjectMapping.length > 0) {
              const qNum = idx + 1;
              isMapped = test.subjectMapping.some(m => qNum >= m.fromQ && qNum <= m.toQ);
           }
           
           if (isMapped) {
              if (idx < answerKey.length && isBonusAnswer(answerKey[idx])) {
                 correct++;
              } else if (status === 'invalid') {
                 wrong++;
              } else if (status === 'valid' && selected && selected !== 'NULL') {
                 if (idx < answerKey.length) {
                    const corStr = String(answerKey[idx]).trim().toUpperCase();
                    const selStr = String(selected).trim().toUpperCase();
                    
                    let matched = false;
                    if (selStr === corStr) matched = true;
                    else if (!isNaN(parseFloat(selStr)) && !isNaN(parseFloat(corStr)) && parseFloat(selStr) === parseFloat(corStr)) matched = true;
                    
                    if (matched) correct++;
                    else wrong++;
                 }
              }
           }
           return selected;
        });

        newScannedAnswers[sId] = flatAnswers;
        newMarksData[sId] = (correct * marksPerQ) - (wrong * negMarks);

        newOmrStats[sId] = {
          correct: correct,
          wrong: wrong
        };
        
        matchedCount++;
      });

      setMarksData(newMarksData);
      setScannedAnswersData(newScannedAnswers);
      setOmrStats(newOmrStats);
      setOmrImagesData(newOmrImagesData);
      setOmrFilenames(newOmrFilenames);
      setOmrScanErrors(currentErrors);

      toast.success(`Successfully scanned and matched ${matchedCount} OMR sheets.`);
      if (currentErrors.length > 0) {
        toast.error(`${currentErrors.length} sheets had issues (Duplicate or Missing Roll No). Please check the error log.`);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to scan OMR images');
    } finally {
      setOmrUploading(false);
      e.target.value = null; // reset input
    }
  };

  // Handle Single Student OMR Upload (override)
  const handleSingleStudentOMRUpload = async (e, studentId) => {
    const file = e.target.files[0];
    if (!file) return;

    const test = selectedEntryTest;
    if (!test) return toast.error('Please select a test first');

    if (!file.type.startsWith('image/')) return toast.error('Please select a valid image file (.jpg, .png)');

    // Extract exact source directory path from single image
    let detectedPath = '';
    if (window.electronAPI && typeof window.electronAPI.getPathForFile === 'function') {
      try {
        detectedPath = window.electronAPI.getPathForFile(file);
      } catch (e) {}
    }
    if (!detectedPath && file && file.path) {
      detectedPath = file.path;
    }
    if (detectedPath) {
      const sourceDir = detectedPath.replace(/[/\\][^/\\]+$/, '');
      setLastOmrScanDir(sourceDir);
      localStorage.setItem('last_omr_scan_dir', sourceDir);
    }

    setSingleOmrUploadingId(studentId);
    const formData = new FormData();
    formData.append('testId', entryTestId);
    formData.append('templateId', omrTemplate);
    
    let maxMappedQ = test.questionsToDetect || 180;
    if (test.subjectMapping && test.subjectMapping.length > 0) {
        maxMappedQ = Math.max(...test.subjectMapping.map(m => Number(m.toQ) || 0));
    }
    formData.append('questionsToDetect', maxMappedQ);
    
    const testData = {
      marksPerQuestion: test.marksPerQuestion || 1,
      negativeMarking: test.negativeMarking || 0,
      answer_keys: test.answerKey || {},
      mapped_questions: questionNumbers || []
    };
    formData.append('testData', JSON.stringify(testData));
    formData.append('images', file);

    try {
      const res = await api.uploadOMRImages(formData);
      if (!res.results || res.results.length === 0) {
        const errorDetail = (res.errors && res.errors.length > 0 && res.errors[0].error)
          ? res.errors[0].error
          : (res.error || 'No OMR results returned from server.');
        throw new Error(errorDetail);
      }
      
      const r = res.results[0];
      const sId = studentId; // FORCE ASSIGN

      const newMarksData = { ...marksData };
      const newOmrStats = { ...omrStats };
      const newScannedAnswers = { ...scannedAnswersData };
      const newOmrImagesData = { ...omrImagesData };
      const newOmrFilenames = { ...omrFilenames };

      newMarksData[sId] = r.marks || 0;
      if (r.omrSheetImage) {
        newOmrImagesData[sId] = r.omrSheetImage;
        newOmrFilenames[sId] = r.filename || file.name;
        setLastScannedImages(prev => [...prev.filter(x => x.rollNo !== String(r.rollNo)), { url: r.omrSheetImage, rollNo: String(r.rollNo || sId), filename: r.filename || file.name }]);
      }
      
      let rawAnswers = [];
      if (r.studentAnswers) {
        rawAnswers = r.studentAnswers;
      } else if (r.subjects) {
        const subjectNames = Object.keys(r.subjects).sort();
        for (const subj of subjectNames) {
          rawAnswers = rawAnswers.concat(r.subjects[subj]);
        }
      }

      // Do not slice rawAnswers by detectQuestions here, because answerKey acts as a natural bound
      // and slicing breaks non-contiguous mappings (e.g. Q1-25 and Q51-75).

      const answerKey = test.answerKey || [];
      const marksPerQ = test.marksPerQuestion || 1;
      const negMarks = test.negativeMarking || 0;
      let correct = 0;
      let wrong = 0;

      const flatAnswers = rawAnswers.map((ans, idx) => {
         const isObj = typeof ans === 'object' && ans !== null;
         const status = isObj ? ans.status : (ans ? 'valid' : 'blank');
         const selected = isObj ? ans.selectedOption : ans;
         
         let isMapped = true;
         if (test.subjectMapping && test.subjectMapping.length > 0) {
            const qNum = idx + 1;
            isMapped = test.subjectMapping.some(m => qNum >= m.fromQ && qNum <= m.toQ);
         }
         
         if (isMapped) {
            if (idx < answerKey.length && isBonusAnswer(answerKey[idx])) {
               // ⭐ Bonus Question: full marks awarded unconditionally, zero negative deduction
               correct++;
            } else if (status === 'invalid') {
               wrong++;
            } else if (status === 'valid' && selected && selected !== 'NULL') {
               if (idx < answerKey.length && answerKey[idx]) {
                  const corStr = String(answerKey[idx]).trim().toUpperCase();
                  const selStr = String(selected).trim().toUpperCase();
                  
                  let matched = false;
                  if (selStr === corStr) matched = true;
                  else if (!isNaN(parseFloat(selStr)) && !isNaN(parseFloat(corStr)) && parseFloat(selStr) === parseFloat(corStr)) matched = true;
                  
                  if (matched) correct++;
                  else wrong++;
               }
            }
         }
         return selected;
      });

      newScannedAnswers[sId] = flatAnswers;
      newMarksData[sId] = (correct * marksPerQ) - (wrong * negMarks);
      newOmrStats[sId] = { correct, wrong };

      setMarksData(newMarksData);
      setScannedAnswersData(newScannedAnswers);
      setOmrStats(newOmrStats);
      setOmrImagesData(newOmrImagesData);
      setOmrFilenames(newOmrFilenames);
      
      toast.success(`OMR uploaded and forcefully mapped to student!`);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to scan OMR image for this student');
    } finally {
      setSingleOmrUploadingId(null);
      e.target.value = null; // reset input
    }
  };

  // Helper to gather all categorized OMR sets for download with deduplication
  const getOmrDownloadSets = () => {
    const currentList = [];
    const savedList = [];
    const errorList = [];

    // 1. Current marks entry state (Fresh in-memory evaluated OMRs)
    if (omrImagesData && Object.keys(omrImagesData).length > 0) {
      Object.entries(omrImagesData).forEach(([studentId, url]) => {
        if (!url) return;
        const stu = students.find(s => s.id === studentId || s._id === studentId);
        const cleanRoll = stu?.rollNo ? String(stu.rollNo).replace(/^\?+|\?+$/g, '').trim() : '';
        const name = stu?.name || '';
        currentList.push({ url, rollNo: cleanRoll, name, studentId, source: 'current' });
      });
    }

    // 2. Saved test results for this test in database
    if (testResults && testResults.length > 0 && (entryTestId || selectedEntryTest)) {
      const tId = entryTestId || selectedEntryTest?.id || selectedEntryTest?._id;
      const savedForThisTest = testResults.filter(r => 
        (r.testId === tId || (selectedEntryTest && (r.testId === selectedEntryTest.id || r.testId === selectedEntryTest._id))) && r.omrSheetImage
      );
      savedForThisTest.forEach(r => {
        if (r.omrSheetImage) {
          const stu = students.find(s => s.id === r.studentId || s._id === r.studentId || (r.rollNo && String(s.rollNo) === String(r.rollNo)));
          const cleanRoll = (r.rollNo || stu?.rollNo) ? String(r.rollNo || stu.rollNo).replace(/^\?+|\?+$/g, '').trim() : '';
          const name = stu?.name || r.studentName || '';
          savedList.push({ url: r.omrSheetImage, rollNo: cleanRoll, name, studentId: r.studentId, source: 'saved' });
        }
      });
    }

    // 3. Any OMR scan errors / unmatched sheets
    if (omrScanErrors && omrScanErrors.length > 0) {
      omrScanErrors.forEach((err, idx) => {
        if (err.omrSheetImage) {
          errorList.push({
            url: err.omrSheetImage,
            rollNo: err.rollNumber && !err.rollNumber.includes('?') ? err.rollNumber : `Unmatched_${idx + 1}`,
            name: 'Unmatched_Sheet',
            source: 'error'
          });
        }
      });
    }

    // Merged Deduplicated Set: Current takes 100% precedence over older saved sheets for the same student
    const deduplicatedMap = new Map();
    currentList.forEach(item => {
      const key = item.studentId ? `STU_${item.studentId}` : `URL_${item.url}`;
      deduplicatedMap.set(key, item);
    });
    savedList.forEach(item => {
      const key = item.studentId ? `STU_${item.studentId}` : `URL_${item.url}`;
      if (!deduplicatedMap.has(key)) {
        deduplicatedMap.set(key, item);
      }
    });
    errorList.forEach((item, idx) => {
      deduplicatedMap.set(`ERR_${idx}_${item.url}`, item);
    });

    const allList = Array.from(deduplicatedMap.values());

    return { currentList, savedList, errorList, allList };
  };

  const handleDownloadOMRs = () => {
    const { currentList, savedList, allList } = getOmrDownloadSets();

    if (allList.length === 0) {
      return toast.error('No scanned OMR images available to download.');
    }

    // If both freshly scanned sheets and previously saved sheets exist, open the options modal
    if (currentList.length > 0 && savedList.length > 0) {
      setShowDownloadOmrModal(true);
      return;
    }

    // Otherwise directly execute download without prompting
    if (currentList.length > 0) {
      executeOmrDownload(currentList, 'Current Scanned');
    } else if (savedList.length > 0) {
      executeOmrDownload(savedList, 'Saved Database');
    } else {
      executeOmrDownload(allList, 'All Available');
    }
  };

  const executeOmrDownload = async (imagesList, setLabel = '') => {
    if (!imagesList || imagesList.length === 0) {
      return toast.error('No OMR images in the selected category to download.');
    }

    // Strictly deduplicate by studentId to prevent duplicate files
    const uniqueMap = new Map();
    imagesList.forEach(item => {
      if (!item.url) return;
      const key = item.studentId ? `STU_${item.studentId}` : `URL_${item.url}`;
      if (!uniqueMap.has(key) || item.source === 'current') {
        uniqueMap.set(key, item);
      }
    });
    const imagesToDownload = Array.from(uniqueMap.values());

    let targetDir = lastOmrScanDir || localStorage.getItem('last_omr_scan_dir') || '';

    // If source directory is not automatically detected, open folder picker in Electron
    if (!targetDir && window.electronAPI && typeof window.electronAPI.selectDirectory === 'function') {
      try {
        const dialogResult = await window.electronAPI.selectDirectory({
          title: 'Select Destination Folder to Save Scanned OMR Images',
          properties: ['openDirectory', 'createDirectory']
        });
        if (dialogResult && !dialogResult.canceled && dialogResult.filePaths && dialogResult.filePaths.length > 0) {
          targetDir = dialogResult.filePaths[0];
          setLastOmrScanDir(targetDir);
          localStorage.setItem('last_omr_scan_dir', targetDir);
        } else {
          return toast.error('Download cancelled — No folder selected');
        }
      } catch (e) {
        console.warn('Folder picker error:', e);
      }
    }

    // In pure web browser mode without local folder picker / Electron:
    if (!window.electronAPI && (!targetDir || targetDir === '')) {
      const toastId = toast.loading(`Downloading ${imagesToDownload.length} OMR images...`);
      let successCount = 0;
      for (const item of imagesToDownload) {
        const fullUrl = getMediaUrl(item.url);
        const fileName = `OMR_${item.rollNo || 'Roll'}_${(item.name || '').replace(/\s+/g, '_')}.jpg`;
        try {
          const resp = await fetch(fullUrl);
          if (!resp.ok) continue;
          const blob = await resp.blob();
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
          successCount++;
          await new Promise(r => setTimeout(r, 150));
        } catch (e) {
          console.warn('Direct download error:', e);
        }
      }
      toast.dismiss(toastId);
      setShowDownloadOmrModal(false);
      return toast.success(`🎉 Downloaded ${successCount} OMR sheets!`);
    }

    if (!targetDir) {
      return toast.error('Source directory could not be determined. Please select a destination folder.');
    }

    setIsDownloadingOmrs(true);
    try {
      const res = await api.downloadOMRImages({
        targetDir: targetDir,
        images: imagesToDownload
      });

      // Automatically reveal the saved folder in Windows File Explorer
      if (window.electronAPI && typeof window.electronAPI.openPath === 'function' && res.outputDir) {
        try {
          await window.electronAPI.openPath(res.outputDir);
        } catch (e) {
          console.warn('Could not auto-open folder:', e);
        }
      }

      setShowDownloadOmrModal(false);
      toast.success(`🎉 Saved ${res.copiedCount} evaluated OMR images (${setLabel || 'Clean'}) to:\n${res.outputDir}`, { duration: 6000 });
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to save OMR images');
    } finally {
      setIsDownloadingOmrs(false);
    }
  };

  const handleDownloadSingleStudentOMR = async (student, rawUrl) => {
    if (!rawUrl) return toast.error('No scanned OMR available for this student');
    try {
      const fullUrl = getMediaUrl(rawUrl);
      const safeName = (student.name || student.studentName || 'Student').replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeRoll = (student.rollNo || 'Roll').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `OMR_${safeRoll}_${safeName}.jpg`;

      const response = await fetch(fullUrl);
      if (!response.ok) throw new Error('Could not fetch image file');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);

      toast.success(`Downloaded OMR for ${student.name || student.studentName || safeRoll}`);
    } catch (err) {
      console.warn('Blob download fallback:', err);
      try {
        const link = document.createElement('a');
        link.href = getMediaUrl(rawUrl);
        link.download = `OMR_${student.rollNo || student.id || 'Student'}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (e) {}
    }
  };

  // Handle Answer Key File Upload (CSV/TXT)
  const handleAnswerKeyFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const processText = (text) => {
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      const parsedLines = lines.map(line => line.split(',').map(c => c.trim()));
      
      // Group questions by subject
      const subjectsList = ['PHYSICS', 'CHEMISTRY', 'MATHEMATICS', 'MATHS', 'MATH', 'BIOLOGY', 'BIO', 'ENGLISH', 'GENERAL'];
      let currentSubject = 'GENERAL';
      const subjectGroups = {}; // subjectName: [ { qNum, answer } ]
      const subjectOrder = []; // to keep track of the order of subjects in the file
      
      parsedLines.forEach(cols => {
        if (!cols.length || cols[0] === '') return;
        
        const firstColUpper = cols[0].toUpperCase();
        
        // Check if this row is a subject header
        if (subjectsList.includes(firstColUpper) || (cols.length === 1 && isNaN(cols[0]))) {
          currentSubject = firstColUpper;
          if (!subjectOrder.includes(currentSubject)) {
            subjectOrder.push(currentSubject);
          }
          return;
        }
        
        // If it's a question row: first column is question number, second is answer
        if (cols.length >= 2 && /^\d+$/.test(cols[0])) {
          const qNum = parseInt(cols[0], 10);
          const answer = cols[1].toUpperCase();
          
          if (!subjectGroups[currentSubject]) {
            subjectGroups[currentSubject] = [];
            if (!subjectOrder.includes(currentSubject)) {
              subjectOrder.push(currentSubject);
            }
          }
          
          subjectGroups[currentSubject].push({ qNum, answer });
        }
      });
      
      // Assemble flat answers array
      let tokens = [];
      if (subjectOrder.length > 0) {
        subjectOrder.forEach(subj => {
          const group = subjectGroups[subj] || [];
          // Sort questions within this subject section by question number
          group.sort((a, b) => a.qNum - b.qNum);
          group.forEach(item => {
            tokens.push(item.answer);
          });
        });
      } else {
        // Fallback: split by all common separators and read flat array
        tokens = text.split(/[\s,;\t\r\n]+/)
          .map(t => t.trim().toUpperCase())
          .filter(t => t.length > 0);
          
        if (tokens.length > 0 && (tokens[0] === 'QUESTION' || tokens[0] === 'ANSWER')) {
          tokens.shift();
        }
      }
      
      if (tokens.length === 0) {
        toast.error('No answers found in the uploaded file.');
        return;
      }
      
      setTestForm(prev => ({
        ...prev,
        answerKeyInput: tokens.join(', ')
      }));
      toast.success(`Successfully loaded ${tokens.length} answers from file!`);
    };

    if (file.name.endsWith('.xlsx')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const csvText = XLSX.utils.sheet_to_csv(worksheet);
        processText(csvText);
      };
      reader.onerror = () => toast.error('Failed to read the answer key file.');
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => processText(evt.target.result);
      reader.onerror = () => toast.error('Failed to read the answer key file.');
      reader.readAsText(file);
    }
    e.target.value = null; // reset input
  };

  // Handle Answer Key Upload & Update on the Enter Marks page (for re-grading)
  const handleAnswerKeyUpdateUpload = async (e) => {
    // Close dropdown if it's inside one
    if (e && e.target) {
      const details = e.target.closest('details');
      if (details) details.removeAttribute('open');
    }

    const file = e.target.files[0];
    if (!file) return;
    if (!entryTestId) return toast.error('Please select a test first');

    const test = selectedEntryTest;
    if (!test) return;

    const processText = async (text) => {
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      const parsedLines = lines.map(line => line.split(',').map(c => c.trim()));
      
      // Group questions by subject
      const subjectsList = ['PHYSICS', 'CHEMISTRY', 'MATHEMATICS', 'MATHS', 'MATH', 'BIOLOGY', 'BIO', 'ENGLISH', 'GENERAL'];
      let currentSubject = 'GENERAL';
      const subjectGroups = {};
      const subjectOrder = [];
      
      parsedLines.forEach(cols => {
        if (cols.length === 0 || cols[0] === '') return;
        
        const firstColUpper = cols[0].toUpperCase();
        
        // Check if this row is a subject header
        if (subjectsList.includes(firstColUpper) || (cols.length === 1 && isNaN(cols[0]))) {
          currentSubject = firstColUpper;
          if (!subjectOrder.includes(currentSubject)) {
            subjectOrder.push(currentSubject);
          }
          return;
        }
        
        // Question row
        if (cols.length >= 2 && /^\d+$/.test(cols[0])) {
          const qNum = parseInt(cols[0], 10);
          const answer = cols[1].toUpperCase();
          
          if (!subjectGroups[currentSubject]) {
            subjectGroups[currentSubject] = [];
            if (!subjectOrder.includes(currentSubject)) {
              subjectOrder.push(currentSubject);
            }
          }
          
          subjectGroups[currentSubject].push({ qNum, answer });
        }
      });
      
      // Assemble flat answers array
      let tokens = [];
      if (subjectOrder.length > 0) {
        subjectOrder.forEach(subj => {
          const group = subjectGroups[subj] || [];
          group.sort((a, b) => a.qNum - b.qNum);
          group.forEach(item => {
            tokens.push(item.answer);
          });
        });
      } else {
        tokens = text.split(/[\s,;\t\r\n]+/)
          .map(t => t.trim().toUpperCase())
          .filter(t => t.length > 0);
          
        if (tokens.length > 0 && (tokens[0] === 'QUESTION' || tokens[0] === 'ANSWER')) {
          tokens.shift();
        }
      }
      
      if (tokens.length === 0) {
        toast.error('No answers found in the uploaded file.');
        return;
      }

      // 1. Save new Answer Key to MongoDB
      const updatedTest = await updateTestAnswerKey(entryTestId, tokens);
      if (!updatedTest) return;

      // Update manualAnswersGrid as well for immediate consistency
      const newGrid = new Array(questionNumbers.length).fill('');
      questionNumbers.forEach((qNum, idx) => {
        if (qNum && qNum <= tokens.length) {
          newGrid[idx] = tokens[qNum - 1] || '';
        }
      });
      setManualAnswersGrid(newGrid);

      // 2. Re-grade all students currently loaded in state
      const newMarksData = { ...marksData };
      const newOmrStats = { ...omrStats };
      let regradedCount = 0;

      Object.keys(scannedAnswersData).forEach(studentId => {
        const studentAnswers = scannedAnswersData[studentId];
        if (studentAnswers && studentAnswers.length > 0) {
          const marksPerQ = selectedEntryTest?.marksPerQuestion || 1;
          const negMarks = selectedEntryTest?.negativeMarking || 0;
          let correct = 0;
          let wrong = 0;
          studentAnswers.forEach((ans, idx) => {
            let extractedAns = '';
            if (typeof ans === 'object' && ans !== null) {
              extractedAns = ans.selectedOption || '';
            } else {
              extractedAns = ans;
            }
            const ansStr = String(extractedAns).trim().toUpperCase();
            if (idx < tokens.length) {
              if (isBonusAnswer(tokens[idx])) {
                // ⭐ Bonus Question: full marks awarded unconditionally
                correct++;
              } else if (ansStr && ansStr !== 'NULL' && tokens[idx]) {
                const corStr = String(tokens[idx]).trim().toUpperCase();
                let matched = false;
                if (ansStr === corStr) {
                  matched = true;
                } else {
                  const parsedAns = parseFloat(ansStr);
                  const parsedCor = parseFloat(corStr);
                  if (!isNaN(parsedAns) && !isNaN(parsedCor) && parsedAns === parsedCor) {
                    matched = true;
                  }
                }

                if (matched) {
                  correct++;
                } else {
                  wrong++;
                }
              }
            }
          });
          const score = (correct * marksPerQ) - (wrong * negMarks);
          newMarksData[studentId] = score;
          newOmrStats[studentId] = {
            correct,
            wrong
          };
          regradedCount++;
        }
      });

      setMarksData(newMarksData);
      setOmrStats(newOmrStats);
      if (regradedCount > 0) {
        toast.success(`✅ Re-graded ${regradedCount} students!`);
      }
    };

    if (file.name.endsWith('.xlsx')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const csvText = XLSX.utils.sheet_to_csv(worksheet);
        processText(csvText);
      };
      reader.onerror = () => toast.error('Failed to read the answer key file.');
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => processText(evt.target.result);
      reader.onerror = () => toast.error('Failed to read the answer key file.');
      reader.readAsText(file);
    }
    e.target.value = null; // reset input
  };

  const handleDownloadSampleExcel = (e) => {
    if (e && e.target) {
      const details = e.target.closest('details');
      if (details) details.removeAttribute('open');
    }
    
    const wb = XLSX.utils.book_new();
    const wsData = [
      ["PHYSICS"],
      ["1", "A"],
      ["2", "B"],
      ["3", "C"],
      ["4", "D"],
      ["5", "A"],
      [""],
      ["CHEMISTRY"],
      ["26", "B"],
      ["27", "C"],
      ["28", "D"],
      ["29", "A"],
      ["30", "B"],
      [""],
      ["MATHEMATICS"],
      ["51", "C"],
      ["52", "D"],
      ["53", "A"],
      ["54", "B"],
      ["55", "C"]
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 15 }, { wch: 10 }];
    
    XLSX.utils.book_append_sheet(wb, ws, "Sample Answer Key");
    XLSX.writeFile(wb, "Sample_Answer_Key.xlsx");
  };

  const handleOpenManualEntry = (e) => {
    if (e && e.target) {
      const details = e.target.closest('details');
      if (details) details.removeAttribute('open');
    }

    if (!selectedEntryTest) {
      toast.error('Please select a test first');
      return;
    }

    // Always populate the grid cleanly with the selected test's actual answer key
    const currentKey = Array.isArray(selectedEntryTest.answerKey) ? selectedEntryTest.answerKey : [];
    const newGrid = new Array(questionNumbers.length).fill('');
    questionNumbers.forEach((qNum, idx) => {
      if (qNum && qNum <= currentKey.length) {
        newGrid[idx] = currentKey[qNum - 1] || '';
      }
    });
    setManualAnswersGrid(newGrid);
    setShowManualAnswerKeyModal(true);
  };

  const handleManualGridPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      
      const tokens = text.split(/[\s,;\t\r\n]+/)
        .map(t => t.trim().toUpperCase())
        .filter(t => t.length > 0 && t !== '-' && t !== ':');
        
      if (tokens.length === 0) return;
      
      let cleanTokens = [];
      const mappingRegex = /(\d+)\s*[-:]\s*([A-Za-z0-9.]+)/g;
      let match;
      const mappedAnswers = {};
      let hasMapping = false;
      let maxQ = 0;
      
      while ((match = mappingRegex.exec(text)) !== null) {
        hasMapping = true;
        const qNum = parseInt(match[1], 10);
        const ans = match[2].toUpperCase();
        mappedAnswers[qNum] = ans;
        if (qNum > maxQ) maxQ = qNum;
      }
      
      if (hasMapping) {
        for (let i = 1; i <= Math.max(maxQ, manualAnswersGrid.length); i++) {
          cleanTokens.push(mappedAnswers[i] || '');
        }
      } else {
        cleanTokens = tokens;
        if (cleanTokens[0] === 'QUESTION' || cleanTokens[0] === 'ANSWER') {
          cleanTokens.shift();
        }
      }

      setManualAnswersGrid(prev => {
        const newGrid = [...prev];
        for (let i = 0; i < Math.min(cleanTokens.length, newGrid.length); i++) {
          if (cleanTokens[i]) newGrid[i] = cleanTokens[i];
        }
        return newGrid;
      });
      toast.success('Pasted from clipboard!');
    } catch (err) {
      toast.error('Failed to read clipboard.');
    }
  };

  const handleCopyAnswerKey = async () => {
    try {
      if (!manualAnswersGrid || manualAnswersGrid.length === 0 || manualAnswersGrid.every(t => !t || t.trim() === '')) {
        return toast.error('Answer key is currently empty.');
      }

      // Convert grid to clean comma-separated answers (e.g. A, B, C, D...)
      const formattedAnswers = manualAnswersGrid.map(ans => (ans || '').trim().toUpperCase()).join(', ');

      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(formattedAnswers);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = formattedAnswers;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      const filledCount = manualAnswersGrid.filter(t => t && t.trim() !== '').length;
      toast.success(`📋 Copied ${filledCount} answer keys to clipboard! (Comma separated, ready to paste)`);
    } catch (err) {
      console.error('Failed to copy answer key:', err);
      toast.error('Failed to copy to clipboard.');
    }
  };

  const handleManualAnswerKeySubmit = async () => {
    if (!entryTestId) return toast.error('Please select a test first');
    
    // Check if empty
    if (manualAnswersGrid.every(t => !t || t.trim() === '')) {
      toast.error('Answer key is completely empty.');
      return;
    }

    // Convert flat grid back to sparse array aligning with physical question numbers
    const maxQ = questionNumbers.length > 0 ? Math.max(...questionNumbers) : manualAnswersGrid.length;
    const tokens = new Array(maxQ).fill('');
    manualAnswersGrid.forEach((ans, idx) => {
      const qNum = questionNumbers[idx];
      if (qNum && qNum >= 1 && qNum <= maxQ) {
        tokens[qNum - 1] = (ans || '').trim().toUpperCase();
      }
    });

    const updatedTest = await updateTestAnswerKey(entryTestId, tokens);
    if (!updatedTest) return;

    const newMarksData = { ...marksData };
    const newOmrStats = { ...omrStats };
    let regradedCount = 0;

    Object.keys(scannedAnswersData).forEach(studentId => {
      const studentAnswers = scannedAnswersData[studentId];
      if (studentAnswers && studentAnswers.length > 0) {
        const marksPerQ = selectedEntryTest?.marksPerQuestion || 1;
        const negMarks = selectedEntryTest?.negativeMarking || 0;
        let correct = 0;
        let wrong = 0;
        studentAnswers.forEach((ans, idx) => {
          let extractedAns = '';
          if (typeof ans === 'object' && ans !== null) {
            extractedAns = ans.selectedOption || '';
          } else {
            extractedAns = ans;
          }
          const ansStr = String(extractedAns).trim().toUpperCase();
          if (idx < tokens.length) {
            if (isBonusAnswer(tokens[idx])) {
              // ⭐ Bonus Question: full marks awarded unconditionally
              correct++;
            } else if (ansStr && ansStr !== 'NULL' && tokens[idx]) {
              const corStr = String(tokens[idx]).trim().toUpperCase();
              let matched = false;
              if (ansStr === corStr) {
                matched = true;
              } else {
                const parsedAns = parseFloat(ansStr);
                const parsedCor = parseFloat(corStr);
                if (!isNaN(parsedAns) && !isNaN(parsedCor) && parsedAns === parsedCor) {
                  matched = true;
                }
              }
              if (matched) correct++;
              else wrong++;
            }
          }
        });
        const score = (correct * marksPerQ) - (wrong * negMarks);
        newMarksData[studentId] = score;
        newOmrStats[studentId] = { correct, wrong };
        regradedCount++;
      }
    });

    setMarksData(newMarksData);
    setOmrStats(newOmrStats);
    if (regradedCount > 0) {
      toast.success(`✅ Re-graded ${regradedCount} students!`);
    } else {
      toast.success('Manual Answer Key saved successfully!');
    }
    setShowManualAnswerKeyModal(false);
  };

  // View Test Results Details / Full Leaderboard
  const handleViewResults = (test) => {
    const results = testResults.filter(r => r.testId === test.id);
    const scannedMap = new Map();

    const mappedScannedResults = results.map(r => {
      const student = students.find(s => s.id === r.studentId || s._id === r.studentId);
      if (student) scannedMap.set(student.id, true);
      return {
        ...r,
        studentName: student ? student.name : 'Unknown Student',
        rollNo: student ? student.rollNo : 'N/A',
        isNotScanned: false
      };
    }).sort((a, b) => (Number(a.rank) || 999999) - (Number(b.rank) || 999999));

    // Include all active students belonging to this test course/batch
    const batchStudents = students.filter(s => 
      s.batch === test.batch && 
      isStudentInTestClasses(s.class, test) && 
      s.status === 'active'
    );

    const unscannedStudents = [];
    batchStudents.forEach(s => {
      if (!scannedMap.has(s.id)) {
        unscannedStudents.push({
          id: `unscanned_${s.id}`,
          testId: test.id,
          studentId: s.id,
          studentName: s.name,
          rollNo: s.rollNo,
          marks: 0,
          totalMarks: test.totalMarks,
          percentage: 0,
          rank: '-',
          isNotScanned: true,
          studentAnswers: [],
          omrSheetImage: null
        });
      }
    });

    // Sort unscanned students by Roll No
    unscannedStudents.sort((a, b) => {
      const numA = Number(a.rollNo);
      const numB = Number(b.rollNo);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return String(a.rollNo || '').localeCompare(String(b.rollNo || ''));
    });

    setSelectedTestResults({
      test,
      results: [...mappedScannedResults, ...unscannedStudents]
    });
    setShowResultsModal(true);
  };

  const calculateSubjectStats = (studentResult, test) => {
    const { studentAnswers } = studentResult;
    const answerKey = test.answerKey || [];
    const subjectsArray = test.subject ? test.subject.split(',').map(s => s.trim()) : ['General'];
    const marksPerQ = test.marksPerQuestion || 1;
    const negMarks = test.negativeMarking || 0;
    
    const totalQuestions = answerKey.length > 0 ? answerKey.length : (studentAnswers ? studentAnswers.length : 0);
    if (totalQuestions === 0) return [];

    let subjectConfig = [];
    if (test.subjectMapping && test.subjectMapping.length > 0) {
      const maxMappedQ = Math.max(...test.subjectMapping.map(m => m.toQ));
      // If the actual totalQuestions is much less than the mapping (e.g. they uploaded a 50Q OMR for a 90Q test)
      // and it's not a case where they just didn't provide answer key, let's gracefully fallback
      if (totalQuestions > 0 && totalQuestions < maxMappedQ && totalQuestions !== 50 && totalQuestions !== 90 && totalQuestions !== 75 && totalQuestions !== 200 && totalQuestions !== 180) {
         // It might just be an incomplete answer key, so we'll still use the config, but it might look weird.
         subjectConfig = test.subjectMapping;
      } else if (totalQuestions > 0 && (totalQuestions === 50 || totalQuestions === 90 || totalQuestions === 75 || totalQuestions === 200 || totalQuestions === 180) && maxMappedQ !== totalQuestions) {
         // It's a clear mismatch (e.g., 50 bubbles scanned, but mapping expects 90).
         // Fallback to avoid splitting 50 questions into Phys(1-23), Chem(24-45), Bio(46-90).
         subjectConfig = [{ subject: 'General (Auto-mapped)', fromQ: 1, toQ: totalQuestions }];
      } else {
         subjectConfig = test.subjectMapping;
      }
    } else {
      // Fallback old logic
      const qPerSubject = Math.floor(totalQuestions / subjectsArray.length);
      subjectConfig = subjectsArray.map((subj, index) => ({
        subject: subj,
        fromQ: index * qPerSubject + 1,
        toQ: (index === subjectsArray.length - 1) ? totalQuestions : (index + 1) * qPerSubject
      }));
    }
    
    const stats = subjectConfig.map((mapping) => {
      const startIdx = Math.max(0, mapping.fromQ - 1);
      const endIdx = Math.min(totalQuestions, mapping.toQ);
      const subj = mapping.subject;
      
      let correct = 0;
      let wrong = 0;
      let skipped = 0;
      
      for (let i = startIdx; i < endIdx; i++) {
        const studentAns = studentAnswers ? studentAnswers[i] : null;
        const correctAns = answerKey[i];
        
        let extractedAns = '';
        if (typeof studentAns === 'object' && studentAns !== null) {
          extractedAns = studentAns.selectedOption || '';
        } else {
          extractedAns = studentAns;
        }
        
        const sAnsStr = extractedAns ? String(extractedAns).trim().toUpperCase() : 'NULL';
        const cAnsStr = correctAns ? String(correctAns).trim().toUpperCase() : 'NULL';
        
        if (isBonusAnswer(correctAns)) {
          // ⭐ Bonus Question: full marks awarded to subject
          correct++;
        } else if (!sAnsStr || sAnsStr === 'NULL' || sAnsStr === 'UNDEFINED' || sAnsStr === '') {
          skipped++;
        } else if (cAnsStr && cAnsStr !== 'NULL' && cAnsStr !== 'UNDEFINED' && cAnsStr !== '') {
          let matched = false;
          if (sAnsStr === cAnsStr) {
            matched = true;
          } else {
            const parsedAns = parseFloat(sAnsStr);
            const parsedCor = parseFloat(cAnsStr);
            if (!isNaN(parsedAns) && !isNaN(parsedCor) && parsedAns === parsedCor) {
              matched = true;
            }
          }
          
          if (matched) correct++;
          else wrong++;
        } else {
          skipped++; 
        }
      }
      
      const marks = (correct * marksPerQ) - (wrong * negMarks);
      
      return {
        subject: subj,
        correct,
        wrong,
        skipped,
        marks
      };
    });
    
    return stats;
  };
  const handlePublishTest = async (sendSMS) => {
    if (!selectedTestResults || !selectedTestResults.test) return;
    const toastId = toast.loading(sendSMS ? 'Publishing and Sending SMS...' : 'Publishing Results...');
    try {
      const res = await api.publishTestResults(selectedTestResults.test.id, sendSMS);
      toast.success(res.message || 'Results published successfully', { id: toastId });
      setShowResultsModal(false);
      if (updateTest) {
        updateTest(selectedTestResults.test.id, { isPublished: true });
      }
    } catch (err) {
      toast.error(err.message || 'Failed to publish results', { id: toastId });
    }
  };

  const handleDownloadExcel = async () => {
    if (!selectedTestResults || !selectedTestResults.results) return;
    
    const test = selectedTestResults.test;
    const toastId = toast.loading('Generating Excel Leaderboard with Logo...');

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Career Xone';
      workbook.lastModifiedBy = 'Career Xone';
      workbook.created = new Date();
      workbook.modified = new Date();

      const worksheet = workbook.addWorksheet('Leaderboard', {
        views: [{ showGridLines: true }]
      });

      // 1. Try to load and embed Career Xone Logo
      try {
        const logoResp = await fetch('/logo.png');
        if (logoResp.ok) {
          const logoBuffer = await logoResp.arrayBuffer();
          const imageId = workbook.addImage({
            buffer: logoBuffer,
            extension: 'png',
          });
          worksheet.addImage(imageId, {
            tl: { col: 0.15, row: 0.2 },
            ext: { width: 130, height: 55 },
            editAs: 'oneCell'
          });
        }
      } catch (logoErr) {
        console.warn('Could not load logo for Excel export:', logoErr);
      }

      // Set header row heights
      worksheet.getRow(1).height = 24;
      worksheet.getRow(2).height = 28;
      worksheet.getRow(3).height = 20;
      worksheet.getRow(4).height = 20;
      worksheet.getRow(5).height = 10; // spacer row

      // Top Title Block
      // Institute Heading
      worksheet.mergeCells('C1:H1');
      const instCell = worksheet.getCell('C1');
      instCell.value = 'CAREER XONE - INSTITUTE OF EXCELLENCE';
      instCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF1E293B' } };
      instCell.alignment = { vertical: 'middle', horizontal: 'left' };

      // Test Name
      worksheet.mergeCells('C2:H2');
      const testNameCell = worksheet.getCell('C2');
      testNameCell.value = `TEST: ${test.name}`.toUpperCase();
      testNameCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF1E3A8A' } };
      testNameCell.alignment = { vertical: 'middle', horizontal: 'left' };

      // Test Details Line 1
      worksheet.mergeCells('C3:H3');
      const metaCell1 = worksheet.getCell('C3');
      metaCell1.value = `Subject: ${test.subject}   |   Date: ${formatDate(test.date)}   |   Total Marks: ${test.totalMarks}`;
      metaCell1.font = { name: 'Calibri', size: 11, bold: false, color: { argb: 'FF475569' } };
      metaCell1.alignment = { vertical: 'middle', horizontal: 'left' };

      // Test Details Line 2
      worksheet.mergeCells('C4:H4');
      const metaCell2 = worksheet.getCell('C4');
      const appearedCount = selectedTestResults.results.filter(r => !r.isNotScanned).length;
      metaCell2.value = `Batch: ${getCourseName(test.batch)}   |   Total Students: ${selectedTestResults.results.length}   |   Appeared / Scanned: ${appearedCount}`;
      metaCell2.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
      metaCell2.alignment = { vertical: 'middle', horizontal: 'left' };

      // Columns Definition
      const columns = [
        { header: 'Rank', key: 'rank', width: 10 },
        { header: 'Roll No', key: 'rollNo', width: 16 },
        { header: 'Student Name', key: 'name', width: 30 }
      ];

      if (test.subjectMapping && test.subjectMapping.length > 0) {
        test.subjectMapping.forEach(m => {
          columns.push({
            header: `${m.subject} Marks`,
            key: `subj_${m.subject}`,
            width: 16
          });
        });
      }

      columns.push(
        { header: 'Total Marks', key: 'marks', width: 18 },
        { header: 'Percentage', key: 'percentage', width: 16 },
        { header: 'Status', key: 'status', width: 22 }
      );

      const headerRowIndex = 6;
      const headerRow = worksheet.getRow(headerRowIndex);
      headerRow.height = 26;

      columns.forEach((col, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = col.header;
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E3A8A' } // Deep Navy Blue
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF0F172A' } },
          left: { style: 'thin', color: { argb: 'FF0F172A' } },
          bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
          right: { style: 'thin', color: { argb: 'FF0F172A' } }
        };
        worksheet.getColumn(idx + 1).width = col.width;
      });

      // Populate Data Rows
      selectedTestResults.results.forEach((res, index) => {
        const rowIndex = headerRowIndex + 1 + index;
        const row = worksheet.getRow(rowIndex);
        row.height = 22;

        const isEven = index % 2 === 0;
        const rowBgColor = isEven ? 'FFFFFFFF' : 'FFF8FAFC';

        if (res.isNotScanned) {
          let colIdx = 1;
          // Rank
          const rankCell = row.getCell(colIdx++);
          rankCell.value = '-';
          rankCell.alignment = { vertical: 'middle', horizontal: 'center' };

          // Roll No
          const rollCell = row.getCell(colIdx++);
          rollCell.value = res.rollNo || '-';
          rollCell.alignment = { vertical: 'middle', horizontal: 'center' };

          // Student Name
          const nameCell = row.getCell(colIdx++);
          nameCell.value = res.studentName || 'Student';
          nameCell.alignment = { vertical: 'middle', horizontal: 'left' };
          nameCell.font = { name: 'Calibri', size: 11, bold: false, color: { argb: 'FF64748B' } };

          // Subject Mapping
          if (test.subjectMapping && test.subjectMapping.length > 0) {
            test.subjectMapping.forEach(() => {
              const sc = row.getCell(colIdx++);
              sc.value = '-';
              sc.alignment = { vertical: 'middle', horizontal: 'center' };
              sc.font = { color: { argb: 'FF94A3B8' } };
            });
          }

          // Total Marks
          const marksCell = row.getCell(colIdx++);
          marksCell.value = '-';
          marksCell.alignment = { vertical: 'middle', horizontal: 'center' };
          marksCell.font = { color: { argb: 'FF94A3B8' } };

          // Percentage
          const pctCell = row.getCell(colIdx++);
          pctCell.value = '-';
          pctCell.alignment = { vertical: 'middle', horizontal: 'center' };
          pctCell.font = { color: { argb: 'FF94A3B8' } };

          // Status
          const statusCell = row.getCell(colIdx++);
          statusCell.value = 'OMR Not Scanned';
          statusCell.alignment = { vertical: 'middle', horizontal: 'center' };
          statusCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFD97706' } };
          statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFBEB' }
          };
        } else {
          let colIdx = 1;
          // Rank
          const rankCell = row.getCell(colIdx++);
          rankCell.value = res.rank !== undefined ? res.rank : index + 1;
          rankCell.alignment = { vertical: 'middle', horizontal: 'center' };
          rankCell.font = { name: 'Calibri', size: 11, bold: true };

          // Highlight Top 3 ranks
          if (res.rank === 1) {
            rankCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF08A' } }; // Gold
          } else if (res.rank === 2) {
            rankCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }; // Silver
          } else if (res.rank === 3) {
            rankCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFED7AA' } }; // Bronze
          }

          // Roll No
          const rollCell = row.getCell(colIdx++);
          rollCell.value = res.rollNo || '-';
          rollCell.alignment = { vertical: 'middle', horizontal: 'center' };
          rollCell.font = { name: 'Calibri', size: 11 };

          // Student Name
          const nameCell = row.getCell(colIdx++);
          nameCell.value = res.studentName;
          nameCell.alignment = { vertical: 'middle', horizontal: 'left' };
          nameCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };

          // Subject Mapping
          const subjectStats = calculateSubjectStats(res, test);
          if (test.subjectMapping && test.subjectMapping.length > 0) {
            subjectStats.forEach(stat => {
              const sc = row.getCell(colIdx++);
              sc.value = typeof stat.marks === 'number' ? stat.marks : Number(stat.marks) || 0;
              sc.alignment = { vertical: 'middle', horizontal: 'center' };
              sc.font = { name: 'Calibri', size: 11 };
            });
          }

          // Total Marks
          const marksCell = row.getCell(colIdx++);
          marksCell.value = `${res.marks} / ${res.totalMarks}`;
          marksCell.alignment = { vertical: 'middle', horizontal: 'center' };
          marksCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };

          // Percentage
          const pctCell = row.getCell(colIdx++);
          pctCell.value = res.percentage !== undefined ? `${res.percentage}%` : 'N/A';
          pctCell.alignment = { vertical: 'middle', horizontal: 'center' };
          pctCell.font = { name: 'Calibri', size: 11, bold: true, color: (res.percentage >= 60 ? { argb: 'FF16A34A' } : { argb: 'FFDC2626' }) };

          // Status
          const statusCell = row.getCell(colIdx++);
          statusCell.value = 'Evaluated';
          statusCell.alignment = { vertical: 'middle', horizontal: 'center' };
          statusCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF16A34A' } };
        }

        // Apply borders & background to cells if not custom-filled
        for (let c = 1; c <= columns.length; c++) {
          const cell = row.getCell(c);
          if (!cell.fill) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: rowBgColor }
            };
          }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
        }
      });

      // Generate buffer and trigger download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${test.name}_${test.subject}_Leaderboard.xlsx`.replace(/[^a-zA-Z0-9_.-]/g, '_');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);

      toast.dismiss(toastId);
      toast.success('🎉 Excel Leaderboard with Logo downloaded successfully!');
    } catch (err) {
      console.error('ExcelJS Export Error:', err);
      toast.dismiss(toastId);
      toast.error('Failed to export Excel with logo: ' + err.message);
    }
  };

  const uniqueClasses = Array.from(new Set(students.map(s => s.class))).filter(Boolean);

  // Helper to count how many students took a test
  const getAppearedCount = (testId) => {
    return testResults.filter(r => r.testId === testId).length;
  };

  // Helper to get max score for a test
  const getHighestScore = (testId) => {
    const results = testResults.filter(r => r.testId === testId);
    if (results.length === 0) return 0;
    return Math.max(...results.map(r => r.marks));
  };

  // Unique Courses list for filter dropdown
  const uniqueCourses = React.useMemo(() => {
    const set = new Set();
    (tests || []).forEach(t => {
      const c = getCourseName(t.batch);
      if (c) set.add(c);
    });
    return Array.from(set);
  }, [tests, batches]);

  // Filtered and Sorted Tests for the All Tests Tab
  const filteredTests = React.useMemo(() => {
    let list = (tests || []).filter(test => {
      // 1. Search Query
      if (testSearchQuery.trim()) {
        const q = testSearchQuery.toLowerCase();
        const nameMatch = (test.name || '').toLowerCase().includes(q);
        const subMatch = (test.subject || '').toLowerCase().includes(q);
        const batchMatch = formatBatchName(test.batch, batches).toLowerCase().includes(q);
        const classMatch = (Array.isArray(test.targetClasses) ? test.targetClasses.join(' ') : (test.targetClass || '')).toLowerCase().includes(q);
        const dateMatch = formatDate(test.date).toLowerCase().includes(q) || (test.date || '').toLowerCase().includes(q);
        if (!nameMatch && !subMatch && !batchMatch && !classMatch && !dateMatch) {
          return false;
        }
      }

      // 2. Course Filter
      if (testCourseFilter !== 'ALL') {
        const courseName = getCourseName(test.batch).toLowerCase();
        const target = testCourseFilter.toLowerCase();
        if (!courseName.includes(target) && test.batch !== testCourseFilter) {
          return false;
        }
      }

      // 3. Status Filter (Evaluated vs Pending)
      if (testStatusFilter !== 'ALL') {
        const appeared = testResults.filter(r => r.testId === test.id).length;
        if (testStatusFilter === 'evaluated' && appeared === 0) return false;
        if (testStatusFilter === 'pending' && appeared > 0) return false;
      }

      return true;
    });

    // Sort
    list.sort((a, b) => {
      if (testSortBy === 'newest') {
        return new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0);
      }
      if (testSortBy === 'oldest') {
        return new Date(a.date || a.createdAt || 0) - new Date(b.date || b.createdAt || 0);
      }
      if (testSortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (testSortBy === 'marks') {
        return (Number(b.totalMarks) || 0) - (Number(a.totalMarks) || 0);
      }
      if (testSortBy === 'appeared') {
        const appA = testResults.filter(r => r.testId === a.id).length;
        const appB = testResults.filter(r => r.testId === b.id).length;
        return appB - appA;
      }
      return 0;
    });

    return list;
  }, [tests, testResults, testSearchQuery, testCourseFilter, testStatusFilter, testSortBy, batches]);

  // Reset current page when filters change
  React.useEffect(() => {
    setTestCurrentPage(1);
  }, [testSearchQuery, testCourseFilter, testStatusFilter, testSortBy, testPageSize]);

  // Paginated Tests
  const actualPageSize = testPageSize === 'all' ? (filteredTests.length || 1) : Number(testPageSize);
  const totalTestPages = Math.ceil(filteredTests.length / actualPageSize) || 1;
  const paginatedTests = React.useMemo(() => {
    if (testPageSize === 'all') return filteredTests;
    const start = (testCurrentPage - 1) * actualPageSize;
    return filteredTests.slice(start, start + actualPageSize);
  }, [filteredTests, testCurrentPage, testPageSize, actualPageSize]);

  return (
    <motion.div 
      className="page-container animate-fade"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1>Test & Exam Management</h1>
          <p>Create tests, record scores, automatically calculate ranks and notify parents instantly.</p>
        </div>
        <a 
          href={omrTemplatePdf} 
          download="OMR_Templates.pdf"
          className="btn btn-primary" 
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          <Download size={18} />
          Download OMR Template
        </a>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'all-tests' ? 'active' : ''}`}
          onClick={() => setActiveTab('all-tests')}
        >
          <ClipboardList size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          All Tests
        </button>
        <button 
          className={`tab ${activeTab === 'create-test' ? 'active' : ''}`}
          onClick={() => setActiveTab('create-test')}
        >
          <Plus size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Create Test
        </button>
        <button 
          className={`tab ${activeTab === 'enter-marks' ? 'active' : ''}`}
          onClick={() => setActiveTab('enter-marks')}
        >
          <FileSpreadsheet size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Enter Marks
        </button>
      </div>

      {/* Tab Contents */}
      <AnimatePresence mode="wait">
        {activeTab === 'all-tests' && (
          <motion.div
            key="all-tests"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-16"
          >
            {/* 🔍 Search & Filter Toolbar */}
            <div className="card" style={{ padding: '14px 18px', background: 'var(--surface-color)', border: '1.5px solid var(--border-color)', borderRadius: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                {/* Search Input */}
                <div style={{ position: 'relative', flex: '1 1 260px', minWidth: '220px' }}>
                  <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input
                    type="text"
                    className="form-input"
                    value={testSearchQuery}
                    onChange={(e) => setTestSearchQuery(e.target.value)}
                    placeholder="Search tests by name, course, batch, class or date..."
                    style={{ paddingLeft: 34, paddingRight: testSearchQuery ? 30 : 12, fontSize: '0.82rem', height: 38 }}
                  />
                  {testSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setTestSearchQuery('')}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Filter Controls Group */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {/* Course Filter */}
                  <select
                    className="form-select"
                    value={testCourseFilter}
                    onChange={(e) => setTestCourseFilter(e.target.value)}
                    style={{ fontSize: '0.80rem', padding: '6px 10px', height: 38, minWidth: 130 }}
                  >
                    <option value="ALL">All Courses</option>
                    {uniqueCourses.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>

                  {/* Status Filter */}
                  <select
                    className="form-select"
                    value={testStatusFilter}
                    onChange={(e) => setTestStatusFilter(e.target.value)}
                    style={{ fontSize: '0.80rem', padding: '6px 10px', height: 38, minWidth: 130 }}
                  >
                    <option value="ALL">All Status</option>
                    <option value="evaluated">✅ Results Declared</option>
                    <option value="pending">⏳ Results Pending</option>
                  </select>

                  {/* Sort By */}
                  <select
                    className="form-select"
                    value={testSortBy}
                    onChange={(e) => setTestSortBy(e.target.value)}
                    style={{ fontSize: '0.80rem', padding: '6px 10px', height: 38, minWidth: 135 }}
                  >
                    <option value="newest">📅 Newest First</option>
                    <option value="oldest">📅 Oldest First</option>
                    <option value="name">🔤 Name (A-Z)</option>
                    <option value="marks">🎯 Highest Marks</option>
                    <option value="appeared">👥 Most Appeared</option>
                  </select>

                  {/* Per Page */}
                  <select
                    className="form-select"
                    value={testPageSize}
                    onChange={(e) => setTestPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    style={{ fontSize: '0.80rem', padding: '6px 8px', height: 38, minWidth: 95 }}
                    title="Cards / Rows per page"
                  >
                    <option value={12}>12 / page</option>
                    <option value={24}>24 / page</option>
                    <option value={48}>48 / page</option>
                    <option value="all">All ({filteredTests.length})</option>
                  </select>

                  {/* Grid vs Table View Switcher */}
                  <div style={{ display: 'flex', background: 'var(--bg-color)', padding: 3, borderRadius: 10, border: '1px solid var(--border-color)' }}>
                    <button
                      type="button"
                      onClick={() => handleViewModeChange('grid')}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 7,
                        border: 'none',
                        cursor: 'pointer',
                        background: testViewMode === 'grid' ? 'var(--accent-blue)' : 'transparent',
                        color: testViewMode === 'grid' ? '#ffffff' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '0.78rem',
                        fontWeight: 700
                      }}
                      title="Compact Grid Cards View"
                    >
                      <LayoutGrid size={14} />
                      <span className="hide-mobile">Grid</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleViewModeChange('list')}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 7,
                        border: 'none',
                        cursor: 'pointer',
                        background: testViewMode === 'list' ? 'var(--accent-blue)' : 'transparent',
                        color: testViewMode === 'list' ? '#ffffff' : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '0.78rem',
                        fontWeight: 700
                      }}
                      title="High-Density Table View (Fast for 1,000+ Tests)"
                    >
                      <List size={14} />
                      <span className="hide-mobile">Table</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Status & Active Filter summary */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-color-light)', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                <div>
                  Showing <strong>{filteredTests.length > 0 ? (testPageSize === 'all' ? `1–${filteredTests.length}` : `${(testCurrentPage - 1) * actualPageSize + 1}–${Math.min(testCurrentPage * actualPageSize, filteredTests.length)}`) : 0}</strong> of <strong>{filteredTests.length}</strong> Tests {filteredTests.length !== tests.length && `(Filtered from ${tests.length} total)`}
                </div>
                {(testSearchQuery || testCourseFilter !== 'ALL' || testStatusFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setTestSearchQuery('');
                      setTestCourseFilter('ALL');
                      setTestStatusFilter('ALL');
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 600 }}
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            </div>

            {/* Empty State */}
            {filteredTests.length === 0 ? (
              <div className="card text-center" style={{ padding: '48px 24px', borderRadius: 16 }}>
                <ClipboardList size={48} style={{ color: 'var(--text-tertiary)', margin: '0 auto 12px' }} />
                <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem', color: 'var(--text-primary)' }}>No Tests Found</h3>
                <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {testSearchQuery || testCourseFilter !== 'ALL' || testStatusFilter !== 'ALL'
                    ? 'No exams match your active search and filter criteria.'
                    : 'No exams have been created yet.'}
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                  {(testSearchQuery || testCourseFilter !== 'ALL' || testStatusFilter !== 'ALL') && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setTestSearchQuery('');
                        setTestCourseFilter('ALL');
                        setTestStatusFilter('ALL');
                      }}
                    >
                      Clear Filters
                    </button>
                  )}
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setActiveTab('create-test')}
                  >
                    <Plus size={14} /> Create New Test
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* ================= VIEW 1: COMPACT GRID VIEW ================= */}
                {testViewMode === 'grid' && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                      gap: 16
                    }}
                  >
                    {paginatedTests.map((test) => {
                      const appeared = getAppearedCount(test.id);
                      const avg = calcTestAverage(testResults.filter(r => r.testId === test.id));
                      const highest = getHighestScore(test.id);
                      const targetClassDisplay = test.targetClasses?.length > 0 ? test.targetClasses.join(', ') : test.targetClass;

                      return (
                        <div
                          key={test.id}
                          className="card"
                          style={{
                            padding: '16px',
                            borderRadius: 14,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            border: '1px solid var(--border-color)',
                            background: 'var(--surface-color)',
                            transition: 'all 0.2s',
                            position: 'relative'
                          }}
                        >
                          <div>
                            {/* Top Row: Subjects + Date */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {test.subject?.split(', ').map(s => (
                                  <span
                                    key={s}
                                    style={{
                                      background: 'rgba(59, 130, 246, 0.12)',
                                      color: 'var(--accent-blue)',
                                      fontSize: '0.68rem',
                                      fontWeight: 700,
                                      padding: '2px 6px',
                                      borderRadius: 6
                                    }}
                                  >
                                    {s}
                                  </span>
                                ))}
                              </div>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                                {formatDate(test.date)}
                              </span>
                            </div>

                            {/* Test Title */}
                            <h3
                              title={test.name}
                              style={{
                                fontSize: '0.98rem',
                                fontWeight: 800,
                                margin: '0 0 8px',
                                color: 'var(--text-primary)',
                                lineHeight: 1.3,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}
                            >
                              {test.name}
                            </h3>

                            {/* Compact Info Grid */}
                            <div
                              style={{
                                background: 'var(--bg-color)',
                                padding: '8px 10px',
                                borderRadius: 8,
                                border: '1px solid var(--border-color-light)',
                                fontSize: '0.76rem',
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '4px 8px',
                                marginBottom: 12
                              }}
                            >
                              <div>
                                <span style={{ color: 'var(--text-secondary)' }}>Course: </span>
                                <strong style={{ color: 'var(--text-primary)' }}>{getCourseName(test.batch)}</strong>
                              </div>
                              <div>
                                <span style={{ color: 'var(--text-secondary)' }}>Marks: </span>
                                <strong style={{ color: 'var(--text-primary)' }}>
                                  {test.totalMarks} {test.marksPerQuestion ? `(+${test.marksPerQuestion}/-${test.negativeMarking || 0})` : ''}
                                </strong>
                              </div>
                              {targetClassDisplay && (
                                <div style={{ gridColumn: '1 / -1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>Class: </span>
                                  <strong style={{ color: 'var(--text-primary)' }}>{targetClassDisplay}</strong>
                                </div>
                              )}
                              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Status: </span>
                                {appeared > 0 ? (
                                  <span style={{ color: '#10b981', fontWeight: 800, fontSize: '0.74rem' }}>
                                    ✅ {appeared} Evaluated
                                  </span>
                                ) : (
                                  <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.74rem' }}>
                                    ⏳ Results Pending
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Bottom Row: Stats & Action Buttons */}
                          <div>
                            {appeared > 0 && (
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '6px 10px',
                                  background: 'rgba(59, 130, 246, 0.06)',
                                  borderRadius: 8,
                                  border: '1px solid rgba(59, 130, 246, 0.15)',
                                  marginBottom: 10,
                                  fontSize: '0.76rem'
                                }}
                              >
                                <div>
                                  <span style={{ color: 'var(--text-secondary)' }}>Avg: </span>
                                  <strong style={{ color: 'var(--accent-blue)' }}>{avg}%</strong>
                                </div>
                                <div>
                                  <span style={{ color: 'var(--text-secondary)' }}>Top: </span>
                                  <strong style={{ color: 'var(--accent-green)' }}>{highest}/{test.totalMarks}</strong>
                                </div>
                              </div>
                            )}

                            <div style={{ display: 'flex', gap: 6 }}>
                              {appeared > 0 ? (
                                <button
                                  className="btn btn-secondary flex-1 justify-center btn-sm"
                                  onClick={() => handleViewResults(test)}
                                  style={{ fontSize: '0.76rem', padding: '6px 8px' }}
                                >
                                  <Award size={13} />
                                  <span>Leaderboard</span>
                                </button>
                              ) : (
                                <button
                                  className="btn btn-primary flex-1 justify-center btn-sm"
                                  onClick={() => {
                                    setEntryTestId(test.id);
                                    handleEntryTestChange(test.id);
                                    setActiveTab('enter-marks');
                                  }}
                                  style={{ fontSize: '0.76rem', padding: '6px 8px' }}
                                >
                                  <FileSpreadsheet size={13} />
                                  <span>Enter Marks</span>
                                </button>
                              )}

                              <button
                                className="btn btn-sm justify-center"
                                onClick={() => setEditingTest(test)}
                                style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '6px 9px' }}
                                title="Edit Test Details"
                              >
                                <Edit2 size={13} />
                              </button>

                              <button
                                className="btn btn-sm justify-center"
                                onClick={() => setTestToDelete(test)}
                                style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '6px 9px' }}
                                title="Delete Test"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ================= VIEW 2: HIGH-DENSITY TABLE VIEW ================= */}
                {testViewMode === 'list' && (
                  <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 16, border: '1.5px solid var(--border-color)' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-color)', borderBottom: '1.5px solid var(--border-color)', textAlign: 'left' }}>
                            <th style={{ padding: '12px 16px', fontWeight: 800 }}>Test Name &amp; Date</th>
                            <th style={{ padding: '12px 14px', fontWeight: 800 }}>Course &amp; Class</th>
                            <th style={{ padding: '12px 14px', fontWeight: 800 }}>Subjects</th>
                            <th style={{ padding: '12px 14px', fontWeight: 800 }}>Total Marks</th>
                            <th style={{ padding: '12px 14px', fontWeight: 800 }}>Evaluation Status</th>
                            <th style={{ padding: '12px 14px', fontWeight: 800 }}>Performance</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800 }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedTests.map((test) => {
                            const appeared = getAppearedCount(test.id);
                            const avg = calcTestAverage(testResults.filter(r => r.testId === test.id));
                            const highest = getHighestScore(test.id);
                            const targetClassDisplay = test.targetClasses?.length > 0 ? test.targetClasses.join(', ') : test.targetClass;

                            return (
                              <tr
                                key={test.id}
                                style={{
                                  borderBottom: '1px solid var(--border-color-light)',
                                  transition: 'background 0.15s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                {/* Test Name & Date */}
                                <td style={{ padding: '10px 16px' }}>
                                  <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{test.name}</div>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                                    📅 {formatDate(test.date)}
                                  </div>
                                </td>

                                {/* Course & Class */}
                                <td style={{ padding: '10px 14px' }}>
                                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{getCourseName(test.batch)}</div>
                                  {targetClassDisplay && (
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                                      {targetClassDisplay}
                                    </div>
                                  )}
                                </td>

                                {/* Subjects */}
                                <td style={{ padding: '10px 14px' }}>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {test.subject?.split(', ').map(s => (
                                      <span
                                        key={s}
                                        style={{
                                          background: 'rgba(59, 130, 246, 0.1)',
                                          color: 'var(--accent-blue)',
                                          fontSize: '0.68rem',
                                          fontWeight: 700,
                                          padding: '1px 5px',
                                          borderRadius: 4
                                        }}
                                      >
                                        {s}
                                      </span>
                                    ))}
                                  </div>
                                </td>

                                {/* Total Marks */}
                                <td style={{ padding: '10px 14px' }}>
                                  <strong style={{ color: 'var(--text-primary)' }}>{test.totalMarks}</strong>
                                  {test.marksPerQuestion ? (
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginLeft: 4 }}>
                                      (+{test.marksPerQuestion}/-{test.negativeMarking || 0})
                                    </span>
                                  ) : null}
                                </td>

                                {/* Evaluation Status */}
                                <td style={{ padding: '10px 14px' }}>
                                  {appeared > 0 ? (
                                    <span
                                      style={{
                                        background: 'rgba(16, 185, 129, 0.12)',
                                        color: '#10b981',
                                        fontSize: '0.72rem',
                                        fontWeight: 800,
                                        padding: '3px 8px',
                                        borderRadius: 12,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4
                                      }}
                                    >
                                      <CheckCircle2 size={12} /> {appeared} Evaluated
                                    </span>
                                  ) : (
                                    <span
                                      style={{
                                        background: 'rgba(245, 158, 11, 0.12)',
                                        color: '#f59e0b',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        padding: '3px 8px',
                                        borderRadius: 12
                                      }}
                                    >
                                      ⏳ Results Pending
                                    </span>
                                  )}
                                </td>

                                {/* Performance */}
                                <td style={{ padding: '10px 14px' }}>
                                  {appeared > 0 ? (
                                    <div style={{ fontSize: '0.76rem' }}>
                                      <div>Avg: <strong style={{ color: 'var(--accent-blue)' }}>{avg}%</strong></div>
                                      <div>Top: <strong style={{ color: 'var(--accent-green)' }}>{highest}/{test.totalMarks}</strong></div>
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>—</span>
                                  )}
                                </td>

                                {/* Actions */}
                                <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    {appeared > 0 ? (
                                      <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => handleViewResults(test)}
                                        style={{ fontSize: '0.74rem', padding: '4px 10px' }}
                                        title="View Leaderboard & Marks"
                                      >
                                        <Award size={13} />
                                        <span>Leaderboard</span>
                                      </button>
                                    ) : (
                                      <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => {
                                          setEntryTestId(test.id);
                                          handleEntryTestChange(test.id);
                                          setActiveTab('enter-marks');
                                        }}
                                        style={{ fontSize: '0.74rem', padding: '4px 10px' }}
                                        title="Enter / Scan Marks"
                                      >
                                        <FileSpreadsheet size={13} />
                                        <span>Enter Marks</span>
                                      </button>
                                    )}

                                    <button
                                      className="btn btn-sm"
                                      onClick={() => setEditingTest(test)}
                                      style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '4px 8px' }}
                                      title="Edit Test"
                                    >
                                      <Edit2 size={13} />
                                    </button>

                                    <button
                                      className="btn btn-sm"
                                      onClick={() => setTestToDelete(test)}
                                      style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '4px 8px' }}
                                      title="Delete Test"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ================= PAGINATION CONTROLS ================= */}
                {totalTestPages > 1 && testPageSize !== 'all' && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12,
                      padding: '12px 18px',
                      background: 'var(--surface-color)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 14,
                      marginTop: 6
                    }}
                  >
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Page <strong>{testCurrentPage}</strong> of <strong>{totalTestPages}</strong> ({filteredTests.length} Tests Total)
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={testCurrentPage <= 1}
                        onClick={() => setTestCurrentPage(p => Math.max(1, p - 1))}
                        style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                      >
                        <ChevronLeft size={14} /> Previous
                      </button>

                      {/* Numeric Page Buttons */}
                      {Array.from({ length: totalTestPages }).map((_, idx) => {
                        const pageNum = idx + 1;
                        // Windowing: show first, last, and current +/- 1
                        if (
                          pageNum === 1 ||
                          pageNum === totalTestPages ||
                          (pageNum >= testCurrentPage - 1 && pageNum <= testCurrentPage + 1)
                        ) {
                          return (
                            <button
                              key={pageNum}
                              type="button"
                              onClick={() => setTestCurrentPage(pageNum)}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                border: 'none',
                                cursor: 'pointer',
                                background: testCurrentPage === pageNum ? 'var(--accent-blue)' : 'var(--bg-color)',
                                color: testCurrentPage === pageNum ? '#ffffff' : 'var(--text-primary)',
                                fontWeight: 700,
                                fontSize: '0.78rem'
                              }}
                            >
                              {pageNum}
                            </button>
                          );
                        } else if (
                          (pageNum === testCurrentPage - 2 && pageNum > 1) ||
                          (pageNum === testCurrentPage + 2 && pageNum < totalTestPages)
                        ) {
                          return <span key={pageNum} style={{ color: 'var(--text-tertiary)', padding: '0 2px' }}>...</span>;
                        }
                        return null;
                      })}

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={testCurrentPage >= totalTestPages}
                        onClick={() => setTestCurrentPage(p => Math.min(totalTestPages, p + 1))}
                        style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                      >
                        Next <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {activeTab === 'create-test' && (
          <motion.div
            key="create-test"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}
          >
            <form onSubmit={handleCreateTest}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: '24px',
                alignItems: 'start'
              }}>
                {/* ================= LEFT COLUMN: MAIN CONFIGURATION FORM ================= */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Card 1: Basic Exam Information */}
                  <div className="card" style={{
                    background: 'var(--surface-color)',
                    border: '1.5px solid var(--border-color)',
                    borderRadius: '18px',
                    padding: '24px',
                    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)',
                    position: 'relative',
                    zIndex: 20
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
                      }}>
                        <BookOpen size={20} />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          Exam Blueprint & Details
                        </h3>
                        <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          Define test title, scheduled date, target audience and course.
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* Test Name */}
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '6px' }}>
                          Test / Exam Title <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. JEE Main Full Mock Test 01 (Physics / Chem / Maths)"
                          value={testForm.name}
                          onChange={e => setTestForm(prev => ({ ...prev, name: e.target.value }))}
                          style={{ fontSize: '0.90rem', padding: '10px 14px', borderRadius: '10px', height: '42px' }}
                          required
                        />
                      </div>

                      {/* Date & Target Course in 2 Columns */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '6px' }}>
                            Exam Date
                          </label>
                          <input
                            type="date"
                            className="form-input"
                            value={testForm.date}
                            onChange={e => setTestForm(prev => ({ ...prev, date: e.target.value }))}
                            style={{ fontSize: '0.85rem', padding: '8px 12px', borderRadius: '10px', height: '42px' }}
                          />
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '6px' }}>
                            Target Course <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <select
                            className="form-select w-full"
                            value={testForm.batch}
                            onChange={e => setTestForm(prev => ({ ...prev, batch: e.target.value }))}
                            style={{ fontSize: '0.85rem', padding: '8px 12px', borderRadius: '10px', height: '42px' }}
                            required
                          >
                            <option value="">-- Select Target Course --</option>
                            {batches.map(b => (
                              <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Multi-Class Selector */}
                      <div className="form-group" style={{ margin: 0, position: 'relative', zIndex: 30 }}>
                        <MultiClassSelect
                          availableClasses={uniqueClasses}
                          selectedClasses={testForm.targetClasses || []}
                          onChange={selected => setTestForm(prev => ({
                            ...prev,
                            targetClasses: selected,
                            targetClass: selected.length > 0 ? selected.join(', ') : ''
                          }))}
                          label="Target Classes (Optional)"
                          placeholder="All Classes enrolled in course"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 2: OMR Template & Subject Mapping */}
                  <div className="card" style={{
                    background: 'var(--surface-color)',
                    border: '1.5px solid var(--border-color)',
                    borderRadius: '18px',
                    padding: '24px',
                    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)',
                    position: 'relative',
                    zIndex: 10
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                        }}>
                          <Layers size={20} />
                        </div>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            OMR Layout & Subject Mapping
                          </h3>
                          <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            Select master OMR sheet template and configure subject ranges.
                          </p>
                        </div>
                      </div>

                      <span style={{
                        background: 'rgba(16, 185, 129, 0.12)',
                        color: '#10b981',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        padding: '4px 10px',
                        borderRadius: '8px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <CheckCircle2 size={13} /> {testForm.questionsToDetect} Total Questions
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {/* OMR Template Selector */}
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '6px' }}>
                          Default OMR Template Layout
                        </label>
                        <select
                          className="form-select"
                          value={testForm.templateId}
                          onChange={e => {
                            const tempId = e.target.value;
                            let defaultDetect = 75;
                            let defaultMarksPerQ = 4;
                            let defaultNegMarks = 1;

                            if (tempId === 'T1' || tempId === 'T2') {
                              defaultDetect = 75; defaultMarksPerQ = 4; defaultNegMarks = 1;
                            } else if (tempId === 'T3') {
                              defaultDetect = 180; defaultMarksPerQ = 4; defaultNegMarks = 1;
                            } else if (tempId === 'T4') {
                              defaultDetect = 90; defaultMarksPerQ = 4; defaultNegMarks = 1;
                            } else if (tempId === 'T5' || tempId === 'T6') {
                              defaultDetect = 200; defaultMarksPerQ = 1; defaultNegMarks = 0;
                            } else if (tempId === 'T7') {
                              defaultDetect = 50; defaultMarksPerQ = 4; defaultNegMarks = 1;
                            }
                            
                            setTestForm(prev => ({ 
                              ...prev, 
                              templateId: tempId,
                              questionsToDetect: defaultDetect,
                              marksPerQuestion: defaultMarksPerQ,
                              negativeMarking: defaultNegMarks
                            }));
                          }}
                          style={{ fontSize: '0.88rem', padding: '10px 14px', borderRadius: '10px', fontWeight: 600, height: '44px' }}
                        >
                          <option value="T1">T1 — JEE Main 75 Questions (Physics, Chem, Maths • MCQ)</option>
                          <option value="T2">T2 — JEE Main 75 Mixed (MCQ + Numerical Section)</option>
                          <option value="T3">T3 — NEET 180 Questions (Physics, Chem, Biology)</option>
                          <option value="T4">T4 — NEET 90 Questions (Biology Section Only)</option>
                          <option value="T5">T5 — MHCET 200 Questions (Physics, Chem, Maths, Bio)</option>
                          <option value="T6">T6 — MHCET 200 Questions (Physics, Chem, Bio)</option>
                          <option value="T7">T7 — Standard 50 Questions (General / Foundation)</option>
                        </select>
                      </div>

                      {/* Subject Mapping Table */}
                      <div className="form-group" style={{ margin: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem', margin: 0 }}>
                            Subject-Question Ranges <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <button 
                            type="button" 
                            className="btn btn-sm btn-secondary"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSubjectMapping(prev => [...prev, { subject: 'Physics', fromQ: prev.length ? (Number(prev[prev.length-1].toQ) || 0) + 1 : 1, toQ: '' }]);
                            }}
                            style={{ fontSize: '0.76rem', padding: '4px 10px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Plus size={13} /> Add Subject Row
                          </button>
                        </div>

                        <div style={{
                          border: '1.5px solid var(--border-color)',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          background: 'var(--bg-color)'
                        }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                              <tr style={{ background: 'var(--surface-color)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                                <th style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--text-secondary)' }}>Subject</th>
                                <th style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--text-secondary)', width: '90px' }}>From Q</th>
                                <th style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--text-secondary)', width: '90px' }}>To Q</th>
                                <th style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--text-secondary)', width: '80px', textAlign: 'center' }}>Total Qs</th>
                                <th style={{ padding: '10px 10px', width: '40px' }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {subjectMapping.map((mapping, idx) => {
                                const qCount = (mapping.fromQ && mapping.toQ) ? Math.max(0, Number(mapping.toQ) - Number(mapping.fromQ) + 1) : 0;
                                const getSubjectBadgeColor = (sub) => {
                                  if (sub === 'Physics') return '#2563eb';
                                  if (sub === 'Chemistry') return '#059669';
                                  if (sub === 'Mathematics') return '#7c3aed';
                                  if (sub === 'Biology') return '#d97706';
                                  return '#475569';
                                };

                                return (
                                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)' }}>
                                    <td style={{ padding: '8px 12px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: getSubjectBadgeColor(mapping.subject) }}></div>
                                        <select 
                                          className="form-select" 
                                          style={{ padding: '6px 10px', fontSize: '0.82rem', height: '34px', borderRadius: '8px', fontWeight: 600 }}
                                          value={mapping.subject}
                                          onChange={(e) => {
                                            const newMap = [...subjectMapping];
                                            newMap[idx].subject = e.target.value;
                                            setSubjectMapping(newMap);
                                          }}
                                        >
                                          <option value="Physics">Physics</option>
                                          <option value="Chemistry">Chemistry</option>
                                          <option value="Mathematics">Mathematics</option>
                                          <option value="Biology">Biology</option>
                                          <option value="General">General / Foundation</option>
                                        </select>
                                      </div>
                                    </td>
                                    <td style={{ padding: '8px 12px' }}>
                                      <input 
                                        type="number" 
                                        className="form-input" 
                                        style={{ padding: '6px 8px', fontSize: '0.82rem', height: '34px', borderRadius: '8px', textAlign: 'center', fontWeight: 700 }}
                                        value={mapping.fromQ}
                                        onChange={(e) => {
                                          const newMap = [...subjectMapping];
                                          newMap[idx].fromQ = Number(e.target.value);
                                          setSubjectMapping(newMap);
                                        }}
                                        min="1"
                                      />
                                    </td>
                                    <td style={{ padding: '8px 12px' }}>
                                      <input 
                                        type="number" 
                                        className="form-input" 
                                        style={{ padding: '6px 8px', fontSize: '0.82rem', height: '34px', borderRadius: '8px', textAlign: 'center', fontWeight: 700 }}
                                        value={mapping.toQ}
                                        onChange={(e) => {
                                          const newMap = [...subjectMapping];
                                          newMap[idx].toQ = Number(e.target.value);
                                          setSubjectMapping(newMap);
                                        }}
                                        min="1"
                                      />
                                    </td>
                                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                      <span style={{
                                        fontWeight: 800,
                                        fontSize: '0.78rem',
                                        color: qCount > 0 ? getSubjectBadgeColor(mapping.subject) : 'var(--text-tertiary)',
                                        background: qCount > 0 ? 'var(--surface-color)' : 'transparent',
                                        padding: '3px 8px',
                                        borderRadius: '6px',
                                        border: qCount > 0 ? '1px solid var(--border-color)' : 'none'
                                      }}>
                                        {qCount} Qs
                                      </span>
                                    </td>
                                    <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                                      <button 
                                        type="button" 
                                        className="btn btn-sm"
                                        style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.08)', padding: '6px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
                                        onClick={() => {
                                          setSubjectMapping(prev => prev.filter((_, i) => i !== idx));
                                        }}
                                        title="Delete Row"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                              {subjectMapping.length === 0 && (
                                <tr>
                                  <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                                    No subjects mapped. Click "+ Add Subject Row" above.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Card 3: Marking Scheme in 2 Columns */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '4px' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '6px' }}>
                            Marks per Correct Answer
                          </label>
                          <input
                            type="number"
                            className="form-input"
                            placeholder="e.g. 4 for JEE/NEET"
                            min="1"
                            value={testForm.marksPerQuestion}
                            onChange={e => setTestForm(prev => ({ ...prev, marksPerQuestion: e.target.value }))}
                            style={{ fontSize: '0.88rem', padding: '8px 12px', borderRadius: '10px', height: '42px', fontWeight: 700, color: '#10b981' }}
                          />
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontWeight: 700, fontSize: '0.82rem', marginBottom: '6px' }}>
                            Negative Penalty (per wrong)
                          </label>
                          <input
                            type="number"
                            className="form-input"
                            placeholder="e.g. 1 for JEE/NEET"
                            min="0"
                            step="0.25"
                            value={testForm.negativeMarking}
                            onChange={e => setTestForm(prev => ({ ...prev, negativeMarking: e.target.value }))}
                            style={{ fontSize: '0.88rem', padding: '8px 12px', borderRadius: '10px', height: '42px', fontWeight: 700, color: '#ef4444' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ================= RIGHT COLUMN: LIVE TEST ARCHITECTURE BLUEPRINT ================= */}
                <div style={{ position: 'sticky', top: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="card" style={{
                    background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.04) 0%, rgba(59, 130, 246, 0.06) 100%)',
                    border: '1.5px solid rgba(59, 130, 246, 0.25)',
                    borderRadius: '20px',
                    padding: '24px',
                    boxShadow: '0 12px 36px rgba(37, 99, 235, 0.08)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Sparkles size={18} style={{ color: '#2563eb' }} />
                        <span style={{ fontSize: '0.90rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Live Test Blueprint
                        </span>
                      </div>
                      <span style={{
                        background: '#2563eb',
                        color: '#ffffff',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '6px'
                      }}>
                        {testForm.templateId}
                      </span>
                    </div>

                    {/* Stat Badges Grid 2x2 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                      <div style={{ background: 'var(--surface-color)', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.70rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Total Marks</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#10b981', marginTop: '2px' }}>
                          {testForm.totalMarks || 0}
                        </div>
                      </div>

                      <div style={{ background: 'var(--surface-color)', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.70rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Questions</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#2563eb', marginTop: '2px' }}>
                          {testForm.questionsToDetect || 0} Qs
                        </div>
                      </div>

                      <div style={{ background: 'var(--surface-color)', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.70rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Scoring Ratio</div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                          +{testForm.marksPerQuestion || 0} / -{testForm.negativeMarking || 0}
                        </div>
                      </div>

                      <div style={{ background: 'var(--surface-color)', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '0.70rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Date</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {formatDate(testForm.date) || 'Today'}
                        </div>
                      </div>
                    </div>

                    {/* Subject Distribution Visual Progress Bar */}
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Subject Distribution</span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2563eb' }}>{subjectMapping.length} Sections</span>
                      </div>

                      {/* Multi-color segment bar */}
                      <div style={{ height: '8px', borderRadius: '6px', overflow: 'hidden', display: 'flex', background: 'var(--border-color)', marginBottom: '12px' }}>
                        {subjectMapping.map((m, i) => {
                          const count = (m.fromQ && m.toQ) ? Math.max(0, Number(m.toQ) - Number(m.fromQ) + 1) : 0;
                          const total = Number(testForm.questionsToDetect) || 1;
                          const pct = (count / total) * 100;
                          const colors = ['#2563eb', '#10b981', '#7c3aed', '#d97706', '#06b6d4'];
                          return (
                            <div 
                              key={i} 
                              style={{ width: `${pct}%`, background: colors[i % colors.length] }} 
                              title={`${m.subject}: ${count} Qs (${pct.toFixed(0)}%)`}
                            />
                          );
                        })}
                      </div>

                      {/* Subject items list */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {subjectMapping.map((m, i) => {
                          const count = (m.fromQ && m.toQ) ? Math.max(0, Number(m.toQ) - Number(m.fromQ) + 1) : 0;
                          const subMarks = count * (Number(testForm.marksPerQuestion) || 0);
                          const colors = ['#2563eb', '#10b981', '#7c3aed', '#d97706', '#06b6d4'];
                          return (
                            <div key={i} style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '0.76rem',
                              padding: '6px 10px',
                              background: 'var(--surface-color)',
                              borderRadius: '8px',
                              border: '1px solid var(--border-color)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors[i % colors.length] }}></div>
                                <strong style={{ color: 'var(--text-primary)' }}>{m.subject}</strong>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.70rem' }}>(Q{m.fromQ}–Q{m.toQ})</span>
                              </div>
                              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                {count} Qs • <span style={{ color: '#10b981' }}>{subMarks}M</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Target Course & Class summary */}
                    <div style={{
                      background: 'var(--surface-color)',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: '1px solid var(--border-color)',
                      marginBottom: '20px',
                      fontSize: '0.76rem'
                    }}>
                      <div style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px' }}>Target Audience:</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{
                          background: 'rgba(37, 99, 235, 0.10)',
                          color: '#2563eb',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px'
                        }}>
                          {batches.find(b => b.id === testForm.batch)?.name || 'Course Not Selected'}
                        </span>
                        {testForm.targetClasses?.length > 0 ? (
                          testForm.targetClasses.map(c => (
                            <span key={c} style={{ background: 'rgba(16, 185, 129, 0.10)', color: '#10b981', fontWeight: 700, padding: '2px 8px', borderRadius: '6px' }}>
                              Class: {c}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: 'var(--text-secondary)' }}>• All Classes</span>
                        )}
                      </div>
                    </div>

                    {/* Action Schedule Button */}
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={submittingAction === 'CreateTest'}
                      style={{
                        width: '100%',
                        padding: '14px',
                        borderRadius: '12px',
                        fontSize: '0.94rem',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                        boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35)',
                        border: 'none'
                      }}
                    >
                      {submittingAction === 'CreateTest' ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          <span>Scheduling Exam...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={18} />
                          <span>Schedule Exam & Next</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </motion.div>
        )}

        {activeTab === 'enter-marks' && (
          <motion.div
            key="enter-marks"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {/* Top Selector Header Card */}
            <div className="card mb-20" style={{
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.98) 100%)',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '20px 24px',
              boxShadow: '0 4px 20px -4px rgba(0, 0, 0, 0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ flex: '1', minWidth: '280px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <FileSpreadsheet size={15} />
                    </div>
                    <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                      Select Scheduled Test
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                      className="form-select"
                      value={entryTestId}
                      onChange={e => handleEntryTestChange(e.target.value)}
                      style={{
                        minWidth: '280px',
                        maxWidth: '460px',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1.5px solid #cbd5e1'
                      }}
                    >
                      <option value="">-- Click to Select Test from List --</option>
                      {tests.map(t => {
                        const classLabel = t.targetClasses?.length > 0 ? t.targetClasses.join(', ') : t.targetClass;
                        return (
                          <option key={t.id} value={t.id}>
                            {t.name} ({getCourseName(t.batch)}{classLabel ? ` - ${classLabel}` : ''}) • {t.subject}
                          </option>
                        );
                      })}
                    </select>

                    {entryTestId && (
                      <button
                        type="button"
                        onClick={() => setEntryTestId('')}
                        className="btn btn-outline-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px' }}
                      >
                        <RefreshCw size={14} /> Switch / Change Test
                      </button>
                    )}
                  </div>
                </div>

                {/* Right side: Search & Filters when picking tests */}
                {!entryTestId && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {/* Search Input */}
                    <div style={{ position: 'relative', minWidth: '220px' }}>
                      <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                      <input
                        type="text"
                        placeholder="Search test name, course, class..."
                        value={entryMarksSearch}
                        onChange={(e) => setEntryMarksSearch(e.target.value)}
                        className="form-input"
                        style={{
                          paddingLeft: '34px',
                          paddingRight: entryMarksSearch ? '30px' : '12px',
                          fontSize: '0.82rem',
                          height: '38px'
                        }}
                      />
                      {entryMarksSearch && (
                        <button
                          type="button"
                          onClick={() => setEntryMarksSearch('')}
                          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {/* Course Filter */}
                    <select
                      className="form-select"
                      value={entryMarksBatchFilter}
                      onChange={(e) => setEntryMarksBatchFilter(e.target.value)}
                      style={{ fontSize: '0.80rem', padding: '6px 10px', height: 38, minWidth: 130 }}
                    >
                      <option value="ALL">All Courses</option>
                      {uniqueCourses.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>

                    {/* Status Filter */}
                    <select
                      className="form-select"
                      value={entryMarksStatusFilter}
                      onChange={(e) => setEntryMarksStatusFilter(e.target.value)}
                      style={{ fontSize: '0.80rem', padding: '6px 10px', height: 38, minWidth: 130 }}
                    >
                      <option value="ALL">All Status</option>
                      <option value="evaluated">✅ Results Declared</option>
                      <option value="pending">⏳ Results Pending</option>
                    </select>

                    {/* Sort By */}
                    <select
                      className="form-select"
                      value={entryMarksSortBy}
                      onChange={(e) => setEntryMarksSortBy(e.target.value)}
                      style={{ fontSize: '0.80rem', padding: '6px 10px', height: 38, minWidth: 135 }}
                    >
                      <option value="newest">📅 Newest First</option>
                      <option value="oldest">📅 Oldest First</option>
                      <option value="name">🔤 Name (A-Z)</option>
                      <option value="marks">🎯 Highest Marks</option>
                      <option value="appeared">👥 Most Appeared</option>
                    </select>

                    {/* Per Page */}
                    <select
                      className="form-select"
                      value={entryMarksPageSize}
                      onChange={(e) => setEntryMarksPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                      style={{ fontSize: '0.80rem', padding: '6px 8px', height: 38, minWidth: 95 }}
                      title="Cards / Rows per page"
                    >
                      <option value={12}>12 / page</option>
                      <option value={24}>24 / page</option>
                      <option value={48}>48 / page</option>
                      <option value="all">All ({filteredEntryTests.length})</option>
                    </select>

                    {/* Grid vs Table View Switcher */}
                    <div style={{ display: 'flex', background: 'var(--bg-color)', padding: 3, borderRadius: 10, border: '1px solid var(--border-color)' }}>
                      <button
                        type="button"
                        onClick={() => handleEntryMarksViewModeChange('grid')}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 7,
                          border: 'none',
                          cursor: 'pointer',
                          background: entryMarksViewMode === 'grid' ? 'var(--accent-blue)' : 'transparent',
                          color: entryMarksViewMode === 'grid' ? '#ffffff' : 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: '0.78rem',
                          fontWeight: 700
                        }}
                        title="Compact Grid Cards View"
                      >
                        <LayoutGrid size={14} />
                        <span className="hide-mobile">Grid</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEntryMarksViewModeChange('list')}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 7,
                          border: 'none',
                          cursor: 'pointer',
                          background: entryMarksViewMode === 'list' ? 'var(--accent-blue)' : 'transparent',
                          color: entryMarksViewMode === 'list' ? '#ffffff' : 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: '0.78rem',
                          fontWeight: 700
                        }}
                        title="High-Density Table View (Fast for 1,000+ Tests)"
                      >
                        <List size={14} />
                        <span className="hide-mobile">Table</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Status & Active Filter summary for Enter Marks */}
              {!entryTestId && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-color-light)', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                  <div>
                    Showing <strong>{filteredEntryTests.length > 0 ? (entryMarksPageSize === 'all' ? `1–${filteredEntryTests.length}` : `${(entryMarksCurrentPage - 1) * actualEntryPageSize + 1}–${Math.min(entryMarksCurrentPage * actualEntryPageSize, filteredEntryTests.length)}`) : 0}</strong> of <strong>{filteredEntryTests.length}</strong> Tests {filteredEntryTests.length !== tests.length && `(Filtered from ${tests.length} total)`}
                  </div>
                  {(entryMarksSearch || entryMarksBatchFilter !== 'ALL' || entryMarksStatusFilter !== 'ALL') && (
                    <button
                      type="button"
                      onClick={() => {
                        setEntryMarksSearch('');
                        setEntryMarksBatchFilter('ALL');
                        setEntryMarksStatusFilter('ALL');
                      }}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 600 }}
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* When NO test is selected: Show Visual Test Picker Cards / Table + Pagination */}
            {!entryTestId && (
              <div>
                {/* Active Scheduled Tests Container */}
                <div style={{ marginBottom: '32px' }}>
                  {filteredEntryTests.length === 0 ? (
                    <div className="card text-center" style={{ padding: '48px 24px', borderRadius: 16 }}>
                      <ClipboardList size={48} style={{ color: 'var(--text-tertiary)', margin: '0 auto 12px' }} />
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                        No Scheduled Tests Found
                      </h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 20px', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
                        {entryMarksSearch || entryMarksBatchFilter !== 'ALL' || entryMarksStatusFilter !== 'ALL'
                          ? 'No tests matched your current filter criteria. Try clearing filters.'
                          : 'Create your first test to start recording marks and evaluating OMR sheets.'}
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                        {(entryMarksSearch || entryMarksBatchFilter !== 'ALL' || entryMarksStatusFilter !== 'ALL') && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setEntryMarksSearch('');
                              setEntryMarksBatchFilter('ALL');
                              setEntryMarksStatusFilter('ALL');
                            }}
                          >
                            Clear Filters
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveTab('create-test')}
                          className="btn btn-primary btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Plus size={14} /> Schedule New Test
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* ================= VIEW 1: COMPACT GRID VIEW ================= */}
                      {entryMarksViewMode === 'grid' && (
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                            gap: '16px'
                          }}
                        >
                          {paginatedEntryTests.map(test => {
                            const appeared = getAppearedCount(test.id);
                            const totalStudentsInBatch = (students || []).filter(s => 
                              s.batch === test.batch && isStudentInTestClasses(s.class, test) && s.status === 'active'
                            ).length || 0;
                            const hasAnswerKey = test.answerKey && test.answerKey.length > 0;
                            const isFullyEvaluated = totalStudentsInBatch > 0 && appeared >= totalStudentsInBatch;
                            const targetClassDisplay = test.targetClasses?.length > 0 ? test.targetClasses.join(', ') : test.targetClass;

                            return (
                              <div
                                key={test.id}
                                onClick={() => handleEntryTestChange(test.id)}
                                className="card"
                                style={{
                                  padding: '16px',
                                  borderRadius: '14px',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'space-between',
                                  border: '1px solid var(--border-color)',
                                  background: 'var(--surface-color)',
                                  position: 'relative'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.borderColor = 'var(--accent-blue)';
                                  e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = 'var(--border-color)';
                                  e.currentTarget.style.transform = 'translateY(0)';
                                }}
                              >
                                <div>
                                  {/* Top Bar: Subject tags & Date */}
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: '8px' }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                      {(test.subject || '').split(',').map((sub, i) => (
                                        <span key={i} style={{
                                          fontSize: '0.68rem',
                                          fontWeight: 700,
                                          background: 'rgba(59, 130, 246, 0.12)',
                                          color: 'var(--accent-blue)',
                                          padding: '2px 6px',
                                          borderRadius: '6px'
                                        }}>
                                          {sub.trim()}
                                        </span>
                                      ))}
                                    </div>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                                      {test.date ? formatDate(test.date) : 'N/A'}
                                    </span>
                                  </div>

                                  {/* Test Title */}
                                  <h4
                                    title={test.name}
                                    style={{
                                      fontSize: '0.98rem',
                                      fontWeight: 800,
                                      color: 'var(--text-primary)',
                                      margin: '0 0 8px',
                                      lineHeight: 1.3,
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden'
                                    }}
                                  >
                                    {test.name}
                                  </h4>

                                  {/* Compact Info Grid */}
                                  <div
                                    style={{
                                      background: 'var(--bg-color)',
                                      padding: '8px 10px',
                                      borderRadius: 8,
                                      border: '1px solid var(--border-color-light)',
                                      fontSize: '0.76rem',
                                      display: 'grid',
                                      gridTemplateColumns: '1fr 1fr',
                                      gap: '4px 8px',
                                      marginBottom: 12
                                    }}
                                  >
                                    <div>
                                      <span style={{ color: 'var(--text-secondary)' }}>Course: </span>
                                      <strong style={{ color: 'var(--text-primary)' }}>{getCourseName(test.batch)}</strong>
                                    </div>
                                    <div>
                                      <span style={{ color: 'var(--text-secondary)' }}>Marks: </span>
                                      <strong style={{ color: 'var(--text-primary)' }}>{test.totalMarks}</strong>
                                    </div>
                                    {targetClassDisplay && (
                                      <div style={{ gridColumn: '1 / -1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Class: </span>
                                        <strong style={{ color: 'var(--text-primary)' }}>{targetClassDisplay}</strong>
                                      </div>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <span style={{ color: 'var(--text-secondary)' }}>Progress: </span>
                                      <strong style={{ color: isFullyEvaluated ? '#10b981' : appeared > 0 ? 'var(--accent-blue)' : 'var(--text-tertiary)' }}>
                                        {appeared}/{totalStudentsInBatch || '–'}
                                      </strong>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <span style={{ color: 'var(--text-secondary)' }}>Key: </span>
                                      <strong style={{ color: hasAnswerKey ? '#10b981' : '#f59e0b', fontSize: '0.72rem' }}>
                                        {hasAnswerKey ? `Configured` : `Not Set`}
                                      </strong>
                                    </div>
                                  </div>
                                </div>

                                {/* Action Button */}
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    padding: '7px',
                                    borderRadius: '8px',
                                    fontWeight: 700,
                                    fontSize: '0.78rem'
                                  }}
                                >
                                  <FileSpreadsheet size={14} />
                                  Open Marksheet &amp; Scan OMR ➔
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* ================= VIEW 2: HIGH-DENSITY TABLE VIEW ================= */}
                      {entryMarksViewMode === 'list' && (
                        <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 16, border: '1.5px solid var(--border-color)' }}>
                          <div style={{ overflowX: 'auto' }}>
                            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                              <thead>
                                <tr style={{ background: 'var(--bg-color)', borderBottom: '1.5px solid var(--border-color)', textAlign: 'left' }}>
                                  <th style={{ padding: '12px 16px', fontWeight: 800 }}>Test Name &amp; Date</th>
                                  <th style={{ padding: '12px 14px', fontWeight: 800 }}>Course &amp; Class</th>
                                  <th style={{ padding: '12px 14px', fontWeight: 800 }}>Subjects</th>
                                  <th style={{ padding: '12px 14px', fontWeight: 800 }}>Total Marks</th>
                                  <th style={{ padding: '12px 14px', fontWeight: 800 }}>Evaluation Status</th>
                                  <th style={{ padding: '12px 14px', fontWeight: 800 }}>Answer Key</th>
                                  <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800 }}>Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {paginatedEntryTests.map((test) => {
                                  const appeared = getAppearedCount(test.id);
                                  const totalStudentsInBatch = (students || []).filter(s => 
                                    s.batch === test.batch && isStudentInTestClasses(s.class, test) && s.status === 'active'
                                  ).length || 0;
                                  const hasAnswerKey = test.answerKey && test.answerKey.length > 0;
                                  const isFullyEvaluated = totalStudentsInBatch > 0 && appeared >= totalStudentsInBatch;
                                  const targetClassDisplay = test.targetClasses?.length > 0 ? test.targetClasses.join(', ') : test.targetClass;

                                  return (
                                    <tr
                                      key={test.id}
                                      onClick={() => handleEntryTestChange(test.id)}
                                      style={{
                                        borderBottom: '1px solid var(--border-color-light)',
                                        cursor: 'pointer',
                                        transition: 'background 0.15s'
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                      {/* Test Name & Date */}
                                      <td style={{ padding: '10px 16px' }}>
                                        <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{test.name}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                                          📅 {formatDate(test.date)}
                                        </div>
                                      </td>

                                      {/* Course & Class */}
                                      <td style={{ padding: '10px 14px' }}>
                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{getCourseName(test.batch)}</div>
                                        {targetClassDisplay && (
                                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                                            {targetClassDisplay}
                                          </div>
                                        )}
                                      </td>

                                      {/* Subjects */}
                                      <td style={{ padding: '10px 14px' }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                          {(test.subject || '').split(',').map((s, i) => (
                                            <span
                                              key={i}
                                              style={{
                                                background: 'rgba(59, 130, 246, 0.1)',
                                                color: 'var(--accent-blue)',
                                                fontSize: '0.68rem',
                                                fontWeight: 700,
                                                padding: '1px 5px',
                                                borderRadius: 4
                                              }}
                                            >
                                              {s.trim()}
                                            </span>
                                          ))}
                                        </div>
                                      </td>

                                      {/* Total Marks */}
                                      <td style={{ padding: '10px 14px' }}>
                                        <strong style={{ color: 'var(--text-primary)' }}>{test.totalMarks}</strong>
                                      </td>

                                      {/* Evaluation Status */}
                                      <td style={{ padding: '10px 14px' }}>
                                        <span
                                          style={{
                                            background: isFullyEvaluated ? 'rgba(16, 185, 129, 0.12)' : appeared > 0 ? 'rgba(59, 130, 246, 0.12)' : 'rgba(148, 163, 184, 0.12)',
                                            color: isFullyEvaluated ? '#10b981' : appeared > 0 ? 'var(--accent-blue)' : 'var(--text-secondary)',
                                            fontSize: '0.72rem',
                                            fontWeight: 800,
                                            padding: '3px 8px',
                                            borderRadius: 12,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 4
                                          }}
                                        >
                                          {isFullyEvaluated ? <CheckCircle2 size={12} /> : null}
                                          {appeared} / {totalStudentsInBatch || '–'} Evaluated
                                        </span>
                                      </td>

                                      {/* Answer Key */}
                                      <td style={{ padding: '10px 14px' }}>
                                        <span
                                          style={{
                                            color: hasAnswerKey ? '#10b981' : '#f59e0b',
                                            fontSize: '0.74rem',
                                            fontWeight: 700,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 4
                                          }}
                                        >
                                          {hasAnswerKey ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                                          {hasAnswerKey ? `${test.answerKey.length} Qs` : 'Key Not Set'}
                                        </span>
                                      </td>

                                      {/* Action */}
                                      <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                                        <button
                                          type="button"
                                          className="btn btn-primary btn-sm"
                                          style={{ fontSize: '0.74rem', padding: '4px 10px' }}
                                        >
                                          <FileSpreadsheet size={13} />
                                          <span>Open Marksheet ➔</span>
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* ================= PAGINATION CONTROLS ================= */}
                      {totalEntryTestPages > 1 && entryMarksPageSize !== 'all' && (
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 12,
                            padding: '12px 18px',
                            background: 'var(--surface-color)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 14,
                            marginTop: 12
                          }}
                        >
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            Page <strong>{entryMarksCurrentPage}</strong> of <strong>{totalEntryTestPages}</strong> ({filteredEntryTests.length} Tests Total)
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={entryMarksCurrentPage <= 1}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEntryMarksCurrentPage(p => Math.max(1, p - 1));
                              }}
                              style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                            >
                              <ChevronLeft size={14} /> Previous
                            </button>

                            {/* Numeric Page Buttons */}
                            {Array.from({ length: totalEntryTestPages }).map((_, idx) => {
                              const pageNum = idx + 1;
                              if (
                                pageNum === 1 ||
                                pageNum === totalEntryTestPages ||
                                (pageNum >= entryMarksCurrentPage - 1 && pageNum <= entryMarksCurrentPage + 1)
                              ) {
                                return (
                                  <button
                                    key={pageNum}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEntryMarksCurrentPage(pageNum);
                                    }}
                                    style={{
                                      width: 32,
                                      height: 32,
                                      borderRadius: 8,
                                      border: 'none',
                                      cursor: 'pointer',
                                      background: entryMarksCurrentPage === pageNum ? 'var(--accent-blue)' : 'var(--bg-color)',
                                      color: entryMarksCurrentPage === pageNum ? '#ffffff' : 'var(--text-primary)',
                                      fontWeight: 700,
                                      fontSize: '0.78rem'
                                    }}
                                  >
                                    {pageNum}
                                  </button>
                                );
                              } else if (
                                (pageNum === entryMarksCurrentPage - 2 && pageNum > 1) ||
                                (pageNum === entryMarksCurrentPage + 2 && pageNum < totalEntryTestPages)
                              ) {
                                return <span key={pageNum} style={{ color: 'var(--text-tertiary)', padding: '0 2px' }}>...</span>;
                              }
                              return null;
                            })}

                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={entryMarksCurrentPage >= totalEntryTestPages}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEntryMarksCurrentPage(p => Math.min(totalEntryTestPages, p + 1));
                              }}
                              style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                            >
                              Next <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {entryTestId && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card"
              >
                <form onSubmit={handleMarksSubmit}>
                  <div className="flex justify-between items-center mb-16 flex-wrap gap-8">
                    <div>
                      <h3 className="card-title">Marksheet Entry</h3>
                      <p className="card-subtitle">
                        Test: <strong>{selectedEntryTest?.name}</strong> | 
                        Max Marks: <strong>{selectedEntryTest?.totalMarks}</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-12 flex-wrap">
                      <div className="flex items-center gap-4">
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>OMR Layout:</span>
                        <select 
                          className="form-select form-select-sm"
                          value={omrTemplate}
                          onChange={e => {
                            const tempId = e.target.value;
                            setOmrTemplate(tempId);
                          }}
                          style={{ width: '180px', padding: '4px 8px', fontSize: '0.85rem' }}
                        >
                          <option value="T1">T1 — JEE Main 75 (MCQ)</option>
                          <option value="T2">T2 — JEE Main 75 Mixed (MCQ + Numerical)</option>
                          <option value="T3">T3 — NEET 180 Questions (Physics/Chem/Bio)</option>
                          <option value="T4">T4 — NEET 90 Questions (Biology only)</option>
                          <option value="T5">T5 — MHCET 200 Maths</option>
                          <option value="T6">T6 — MHCET 200 Biology</option>
                          <option value="T7">T7 — OMR 50 Questions</option>
                        </select>
                      </div>

                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <button 
                          type="button" 
                          className="btn btn-secondary btn-sm m-1"
                          onClick={(e) => handleOpenManualEntry(e)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <BookOpen size={14} /> Enter / Edit Answer Key
                        </button>
                      </div>
                      {selectedEntryTest && selectedEntryTest.answerKey && selectedEntryTest.answerKey.length > 0 && (
                        <button 
                          type="button" 
                          className="btn btn-outline-secondary btn-sm"
                          onClick={(e) => handleOpenManualEntry(e)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: '6px', marginRight: '6px' }}
                          title="Review / Edit Uploaded Answer Key"
                        >
                          <Eye size={14} /> Show Answer Key
                        </button>
                      )}
                      <label 
                        className={`btn btn-secondary btn-sm ${omrUploading ? 'opacity-50 pointer-events-none' : ''}`}
                        style={{ display: 'inline-flex', gap: '6px', cursor: 'pointer', margin: 0 }}
                      >
                        {omrUploading ? (
                          <div className="btn-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', marginRight: '4px' }}></div>
                        ) : (
                          <Upload size={14} />
                        )}
                        {omrUploading ? 'Scanning...' : 'Scan OMR Images'}
                        <input 
                          type="file" 
                          accept="image/*"
                          multiple
                          onChange={handleOMRUpload} 
                          style={{ display: 'none' }} 
                        />
                      </label>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', gap: '6px', marginLeft: '6px' }}
                        onClick={handleDownloadOMRs}
                        disabled={(lastScannedImages.length === 0 && Object.keys(omrImagesData).length === 0) || isDownloadingOmrs || omrUploading}
                        title="Save scanned OMRs with green bubbles to the original folder"
                      >
                        {isDownloadingOmrs ? (
                          <div className="btn-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', marginRight: '4px' }}></div>
                        ) : (
                          <Download size={14} />
                        )}
                        {isDownloadingOmrs ? 'Saving...' : 'Download OMRs'}
                      </button>
                      <button 
                        type="button" 
                        name="action" 
                        value="Draft" 
                        className="btn btn-outline-primary" 
                        disabled={omrUploading || submittingAction}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        onClick={(e) => handleMarksSubmit(e, 'Draft')}
                      >
                        {submittingAction === 'Draft' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {submittingAction === 'Draft' ? 'Saving...' : 'Save Draft'}
                      </button>
                    </div>
                  </div>

                  {omrScanErrors && omrScanErrors.length > 0 && (
                    <div className="mb-6 border border-red-200 rounded-lg overflow-hidden shadow-sm">
                      <div className="bg-red-50 p-4 border-b border-red-100 flex justify-between items-start">
                        <div className="flex items-start gap-3">
                          <div className="bg-red-100 text-red-600 p-2 rounded-full mt-0.5">
                            <AlertTriangle size={20} />
                          </div>
                          <div>
                            <h4 className="text-red-800 font-semibold text-base">
                              OMR Scan Issues ({omrScanErrors.length})
                            </h4>
                            <p className="text-sm text-red-600 mt-1">
                              The following OMR sheets could not be matched automatically or have duplicate roll numbers. Please check them manually.
                            </p>
                          </div>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setOmrScanErrors([])} 
                          className="text-red-400 hover:text-red-600 hover:bg-red-100 p-1.5 rounded-md transition-colors"
                          title="Dismiss All"
                        >
                          <X size={18} />
                        </button>
                      </div>
                      <div className="bg-white max-h-80 overflow-y-auto p-4 flex flex-col gap-3">
                        {omrScanErrors.map((err, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded-md border border-gray-100 hover:border-red-100 transition-colors">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-gray-800 bg-white px-2 py-0.5 rounded text-sm border border-gray-200 shadow-sm">
                                  Roll No: {err.rollNumber || 'Unknown'}
                                </span>
                                {err.studentName && (
                                  <span className="font-medium text-gray-700 bg-white px-2 py-0.5 rounded text-sm border border-gray-200">
                                    {err.studentName}
                                  </span>
                                )}
                                {err.filename && (
                                  <span className="font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-sm border border-blue-200">
                                    📄 {err.filename}
                                  </span>
                                )}
                                <span className="text-sm font-medium text-red-600">{err.error}</span>
                              </div>
                              {err.details && <p className="text-xs text-gray-500">{err.details}</p>}
                            </div>
                            {err.omrSheetImage && (
                              <button 
                                type="button"
                                onClick={() => setSelectedOmrImage({
                                  url: getMediaUrl(err.omrSheetImage),
                                  filename: err.filename || (err.rollNumber ? `Roll_${err.rollNumber}_OMR.jpg` : 'OMR_Sheet.jpg'),
                                  rollNo: err.rollNumber,
                                  studentName: err.studentName || ''
                                })}
                                className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors flex-shrink-0"
                              >
                                <Eye size={16} />
                                View OMR
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center mb-12" style={{ padding: '0 4px' }}>
                    <input 
                      type="text" 
                      className="form-input form-input-sm" 
                      placeholder="Search by Name or Roll No..." 
                      style={{ width: '300px' }}
                      value={searchStudentQuery}
                      onChange={e => setSearchStudentQuery(e.target.value)}
                    />
                  </div>

                  <div className="table-container mb-16">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: '80px' }}>Roll No</th>
                          <th>Student Name</th>
                          <th style={{ width: '220px' }}>Marks Obtained</th>
                          <th>Status / Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students
                          .filter(s => s.batch === selectedEntryTest?.batch && isStudentInTestClasses(s.class, selectedEntryTest) && s.status === 'active')
                          .filter(s => {
                            if (!searchStudentQuery) return true;
                            const query = searchStudentQuery.toLowerCase();
                            const nameMatch = s.name && s.name.toLowerCase().includes(query);
                            const rollMatch = s.rollNo && String(s.rollNo).toLowerCase().includes(query);
                            return nameMatch || rollMatch;
                          })
                          .sort((a, b) => {
                            const hasMarksA = marksData[a.id] !== '' && marksData[a.id] !== undefined;
                            const hasMarksB = marksData[b.id] !== '' && marksData[b.id] !== undefined;
                            
                            if (hasMarksA && !hasMarksB) return -1;
                            if (!hasMarksA && hasMarksB) return 1;

                            if (hasMarksA && hasMarksB) {
                              const marksA = Number(marksData[a.id]);
                              const marksB = Number(marksData[b.id]);
                              if (marksA !== marksB) {
                                return marksB - marksA; // Descending order
                              }
                            }
                            
                            const rollA = a.rollNo ? String(a.rollNo) : '';
                            const rollB = b.rollNo ? String(b.rollNo) : '';
                            return rollA.localeCompare(rollB, undefined, { numeric: true });
                          })
                          .map((student) => (
                            <tr key={student.id}>
                              <td>{student.rollNo}</td>
                              <td>
                                <strong>{student.name}</strong>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>ID: {student.id}</div>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="form-input"
                                  placeholder="Enter marks"
                                  min="0"
                                  max={selectedEntryTest?.totalMarks}
                                  value={marksData[student.id] ?? ''}
                                  onChange={e => handleMarksChange(student.id, e.target.value)}
                                  style={{ padding: '6px 12px' }}
                                />
                              </td>
                              <td>
                                <div className="flex justify-between items-start gap-4">
                                  <div>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                      / {selectedEntryTest?.totalMarks}
                                    </span>
                                    {marksData[student.id] !== '' && marksData[student.id] !== undefined && (
                                      <div style={{ marginTop: '4px' }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: '600' }} className={
                                          ((marksData[student.id] / selectedEntryTest?.totalMarks) >= 0.85) ? 'text-success' :
                                          ((marksData[student.id] / selectedEntryTest?.totalMarks) >= 0.60) ? 'text-warning' : 'text-danger'
                                        }>
                                          ({Math.round((marksData[student.id] / selectedEntryTest?.totalMarks) * 100)}%)
                                        </span>
                                        {omrStats[student.id] && (
                                          <span style={{ fontSize: '0.75rem', marginLeft: '8px', color: 'var(--text-tertiary)' }}>
                                            <span className="text-success">{omrStats[student.id].correct} ✓</span> | <span className="text-danger">{omrStats[student.id].wrong} ✗</span>
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-2 items-center justify-end">
                                    {omrImagesData[student.id] && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => setSelectedOmrImage({
                                            url: getMediaUrl(omrImagesData[student.id]),
                                            filename: omrFilenames[student.id] || (student.rollNo ? `${student.rollNo}_${student.name}.jpg` : 'OMR_Sheet.jpg'),
                                            rollNo: student.rollNo,
                                            studentName: student.name
                                          })}
                                          className="btn btn-ghost btn-xs text-accent flex-shrink-0"
                                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                          title="Preview scanned OMR Sheet"
                                        >
                                          View OMR
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDownloadSingleStudentOMR(student, omrImagesData[student.id])}
                                          className="btn btn-outline-primary btn-xs flex-shrink-0"
                                          style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                          title="Download scanned OMR Sheet"
                                        >
                                          <Download size={12} />
                                          Download OMR
                                        </button>
                                      </>
                                    )}
                                    <label 
                                      className={`btn btn-outline-secondary btn-xs flex-shrink-0 ${singleOmrUploadingId === student.id ? 'opacity-50 pointer-events-none' : ''}`} 
                                      style={{ padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                      title="Upload and scan OMR for this student"
                                    >
                                      <Upload size={12} />
                                      {singleOmrUploadingId === student.id ? 'Uploading...' : 'Upload OMR'}
                                      <input 
                                        type="file" 
                                        accept="image/*"
                                        onChange={(e) => handleSingleStudentOMRUpload(e, student.id)} 
                                        style={{ display: 'none' }} 
                                      />
                                    </label>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </form>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results details / leaderboard Modal */}
      {showResultsModal && selectedTestResults && createPortal(
        <div className="modal-overlay" onClick={() => setShowResultsModal(false)}>
          <div className="modal-content modal-lg" style={{ width: '95vw', maxWidth: '1200px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ flexShrink: 0, padding: '16px 24px', display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Leaderboard - {selectedTestResults.test.name}
                </h3>
                <p className="card-subtitle" style={{ margin: '4px 0 0 0', fontSize: '0.82rem' }}>
                  Subject: <strong>{selectedTestResults.test.subject}</strong> | Date: <strong>{formatDate(selectedTestResults.test.date)}</strong>
                </p>
              </div>
              <div style={{ marginRight: '40px' }}>
                <input 
                  type="text" 
                  className="form-input form-input-sm" 
                  placeholder="Search student..." 
                  style={{ width: '250px', padding: '6px 12px' }}
                  value={searchLeaderboardQuery}
                  onChange={e => setSearchLeaderboardQuery(e.target.value)}
                />
              </div>
              <button className="modal-close" onClick={() => setShowResultsModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ flex: '1 1 auto', overflowY: 'auto', minHeight: 0, padding: '16px 24px' }}>
              <div className="table-container" style={{ maxHeight: 'calc(90vh - 140px)', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>Rank</th>
                      <th>Roll No</th>
                      <th>Student</th>
                      {selectedTestResults.test.subjectMapping?.length > 0 && 
                        selectedTestResults.test.subjectMapping.map((m, i) => (
                          <th key={i}>{m.subject}</th>
                        ))
                      }
                      <th style={{ width: '120px' }}>Total Marks</th>
                      <th>Percentage</th>
                      <th>OMR Sheet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTestResults.results
                      .filter(res => {
                        if (!searchLeaderboardQuery) return true;
                        const query = searchLeaderboardQuery.toLowerCase();
                        return (res.studentName && res.studentName.toLowerCase().includes(query)) ||
                               (res.rollNo && String(res.rollNo).toLowerCase().includes(query));
                      })
                      .map((res) => {
                      if (res.isNotScanned) {
                        return (
                          <tr key={res.id} style={{ opacity: 0.85, background: 'rgba(241, 245, 249, 0.4)' }}>
                            <td>
                              <span className="badge badge-secondary" style={{ fontSize: '0.75rem', opacity: 0.7, padding: '2px 8px' }}>
                                -
                              </span>
                            </td>
                            <td>{res.rollNo}</td>
                            <td>
                              <strong>{res.studentName}</strong>
                            </td>
                            {selectedTestResults.test.subjectMapping?.length > 0 && 
                              selectedTestResults.test.subjectMapping.map((m, i) => (
                                <td key={i} style={{ color: 'var(--text-tertiary)' }}>-</td>
                              ))
                            }
                            <td style={{ color: 'var(--text-tertiary)' }}>- / {res.totalMarks}</td>
                            <td>
                              <span 
                                style={{ 
                                  fontSize: '0.75rem', 
                                  fontWeight: 600, 
                                  padding: '4px 8px', 
                                  borderRadius: '6px', 
                                  background: 'rgba(234, 179, 8, 0.12)', 
                                  color: '#b45309', 
                                  border: '1px solid rgba(234, 179, 8, 0.3)',
                                  display: 'inline-block'
                                }}
                              >
                                OMR Not Scanned
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                                OMR Not Scanned
                              </span>
                            </td>
                          </tr>
                        );
                      }

                      const rankClass = res.rank !== undefined ? getRankBadgeClass(res.rank) : 'rank-badge-default';
                      const marksCategory = res.percentage !== undefined ? getMarksCategory(res.percentage) : 'badge-default';

                      return (
                        <tr key={res.id}>
                          <td>
                            <span className={`rank-badge ${rankClass}`}>
                              {res.rank !== undefined ? res.rank : 'N/A'}
                            </span>
                          </td>
                          <td>{res.rollNo}</td>
                          <td><strong>{res.studentName}</strong></td>
                          
                          {selectedTestResults.test.subjectMapping?.length > 0 && 
                            calculateSubjectStats(res, selectedTestResults.test).map((stat, i) => (
                              <td key={i}>{stat.marks}</td>
                            ))
                          }

                          <td>{res.marks} / {res.totalMarks}</td>
                          <td>
                            <span className={`marks-pill ${marksCategory}`}>
                              {res.percentage !== undefined ? `${res.percentage}%` : 'N/A'}
                            </span>
                          </td>
                          <td>
                            <div className="flex gap-2 items-center">
                              <button 
                                onClick={() => setSelectedStudentResult(res)}
                                className="btn btn-ghost btn-xs text-primary"
                                style={{ padding: '2px 6px', fontSize: '0.75rem', textDecoration: 'none' }}
                              >
                                View Results
                              </button>
                              {res.omrSheetImage && (
                                <>
                                  <button 
                                    onClick={() => setSelectedOmrImage({
                                      url: getMediaUrl(res.omrSheetImage),
                                      filename: res.omrOriginalFilename || (res.rollNo ? `${res.rollNo}_${res.studentName}.jpg` : 'OMR_Sheet.jpg'),
                                      rollNo: res.rollNo,
                                      studentName: res.studentName
                                    })}
                                    className="btn btn-ghost btn-xs text-accent"
                                    style={{ padding: '2px 6px', fontSize: '0.75rem', textDecoration: 'none' }}
                                  >
                                    View OMR
                                  </button>
                                  <button 
                                    onClick={() => handleDownloadSingleStudentOMR({ name: res.studentName, rollNo: res.rollNo }, res.omrSheetImage)}
                                    className="btn btn-outline-primary btn-xs"
                                    style={{ padding: '2px 6px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                                    title="Download scanned OMR"
                                  >
                                    <Download size={11} />
                                    Download OMR
                                  </button>
                                </>
                              )}
                              {!res.omrSheetImage && <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', padding: '2px 6px' }}>No OMR</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer" style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="btn btn-outline-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={handleDownloadExcel}>
                  <Download size={16} />
                  Download Excel
                </button>
                <button className="btn btn-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => handlePublishTest(false)}>
                  <Award size={16} />
                  Publish Marks
                </button>
                <button className="btn btn-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => handlePublishTest(true)}>
                  <UserCheck size={16} />
                  Publish & Send SMS
                </button>
              </div>
              <button className="btn btn-primary" onClick={() => setShowResultsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* OMR Sheet Viewer Modal */}
      {selectedOmrImage && createPortal(
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <TransformWrapper
            initialScale={1}
            minScale={0.5}
            maxScale={4}
            centerOnInit
            limitToBounds={false}
            wheel={{ step: 0.005 }}
            pinch={{ step: 1 }}
            panning={{ velocityDisabled: true }}
          >
            {({ zoomIn, zoomOut, resetTransform, state }) => {
              const omrUrl = typeof selectedOmrImage === 'object' && selectedOmrImage !== null ? selectedOmrImage.url : selectedOmrImage;
              const omrFilename = typeof selectedOmrImage === 'object' && selectedOmrImage !== null ? selectedOmrImage.filename : '';
              const omrRollNo = typeof selectedOmrImage === 'object' && selectedOmrImage !== null ? selectedOmrImage.rollNo : '';
              const omrStudentName = typeof selectedOmrImage === 'object' && selectedOmrImage !== null ? selectedOmrImage.studentName : '';

              return (
                <div style={{ background: 'var(--bg-primary)', borderRadius: '18px', padding: '18px', maxWidth: '900px', width: '90vw', textAlign: 'center', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', minWidth: 0, flex: 1, paddingRight: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '100%' }}>
                        <span style={{ fontSize: '1.1rem' }}>📄</span>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {omrFilename || 'Scanned OMR Sheet'}
                        </h4>
                      </div>
                      {(omrRollNo || omrStudentName) && (
                        <p style={{ margin: '2px 0 0 24px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {omrRollNo ? <>Roll No: <strong style={{ color: 'var(--text-primary)' }}>{omrRollNo}</strong></> : null}
                          {omrStudentName ? <span style={{ marginLeft: '8px' }}>| Student: <strong>{omrStudentName}</strong></span> : null}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => zoomOut()}><ZoomOut size={16} /></button>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, minWidth: '40px' }}>{Math.round(state.scale * 100)}%</span>
                      <button className="btn btn-sm btn-ghost" onClick={() => zoomIn()}><ZoomIn size={16} /></button>
                      <button className="btn btn-sm btn-ghost" style={{ marginLeft: '4px' }} onClick={() => resetTransform()}>Reset</button>
                    </div>
                  </div>
                  
                  <div style={{ flex: 1, overflow: 'hidden', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'grab' }}>
                    <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%' }}>
                      <img 
                        src={omrUrl} 
                        alt="OMR Sheet" 
                        style={{ width: '100%', display: 'block' }}
                        draggable={false}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentElement.innerHTML = `
                            <div style="padding: 40px 20px; text-align: center; color: #64748b;">
                              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 12px;">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                <polyline points="21 15 16 10 5 21"></polyline>
                              </svg>
                              <p style="font-weight: 600; font-size: 1rem; margin: 0 0 6px;">OMR Sheet Unavailable</p>
                              <p style="font-size: 0.85rem; margin: 0; color: #94a3b8;">This image was deleted from local storage.<br/>Please re-scan the OMR sheet to view it again.</p>
                            </div>`;
                        }}
                      />
                    </TransformComponent>
                  </div>

                  <button
                    onClick={() => { setSelectedOmrImage(null); }}
                    className="btn btn-primary"
                    style={{ marginTop: '14px', width: '100%' }}
                  >
                    Close Preview
                  </button>
                </div>
              );
            }}
          </TransformWrapper>
        </div>
      , document.body)}

      {/* Student Result Details Modal */}
      {selectedStudentResult && selectedTestResults && createPortal(
        <div className="modal-overlay" onClick={() => setSelectedStudentResult(null)} style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ width: '90vw', maxWidth: '1000px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Result Details - {selectedStudentResult.studentName}</h3>
                <p className="card-subtitle" style={{ margin: 0 }}>
                  Roll No: <strong>{selectedStudentResult.rollNo}</strong> | Test: <strong>{selectedTestResults.test.name}</strong>
                </p>
              </div>
              <div className="flex gap-4">
                {selectedStudentResult.omrSheetImage && (
                  <button 
                    className="btn btn-outline-primary btn-sm flex items-center gap-2"
                    onClick={() => setSelectedOmrImage({
                      url: getMediaUrl(selectedStudentResult.omrSheetImage),
                      filename: selectedStudentResult.omrOriginalFilename || (selectedStudentResult.rollNo ? `${selectedStudentResult.rollNo}_${selectedStudentResult.studentName}.jpg` : 'OMR_Sheet.jpg'),
                      rollNo: selectedStudentResult.rollNo,
                      studentName: selectedStudentResult.studentName
                    })}
                  >
                    <Eye size={16} /> View OMR
                  </button>
                )}
                <button className="modal-close" onClick={() => setSelectedStudentResult(null)}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="modal-body">
              <div className="flex justify-between items-center mb-16 p-16" style={{ background: 'var(--bg-secondary)', borderRadius: '12px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Marks</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{selectedStudentResult.marks} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>/ {selectedTestResults.test.totalMarks}</span></div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Percentage</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-green)' }}>{selectedStudentResult.percentage}%</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Rank</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-orange)' }}>#{selectedStudentResult.rank}</div>
                </div>
              </div>

              <h4 className="mb-8">Subject-wise Performance</h4>
              <div className="table-container mb-16">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th style={{ textAlign: 'center' }}>Correct</th>
                      <th style={{ textAlign: 'center' }}>Incorrect</th>
                      <th style={{ textAlign: 'center' }}>Skipped</th>
                      <th style={{ textAlign: 'right' }}>Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculateSubjectStats(selectedStudentResult, selectedTestResults.test).map((stat, idx) => (
                      <tr key={idx}>
                        <td><strong>{stat.subject}</strong></td>
                        <td style={{ textAlign: 'center', color: 'var(--accent-green)', fontWeight: 600 }}>{stat.correct}</td>
                        <td style={{ textAlign: 'center', color: '#ef4444', fontWeight: 600 }}>{stat.wrong}</td>
                        <td style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>{stat.skipped}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800 }}>{stat.marks}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot style={{ borderTop: '2px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                    <tr>
                      <td><strong>Total</strong></td>
                      <td style={{ textAlign: 'center', color: 'var(--accent-green)', fontWeight: 800 }}>
                        {calculateSubjectStats(selectedStudentResult, selectedTestResults.test).reduce((sum, stat) => sum + stat.correct, 0)}
                      </td>
                      <td style={{ textAlign: 'center', color: '#ef4444', fontWeight: 800 }}>
                        {calculateSubjectStats(selectedStudentResult, selectedTestResults.test).reduce((sum, stat) => sum + stat.wrong, 0)}
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontWeight: 800 }}>
                        {calculateSubjectStats(selectedStudentResult, selectedTestResults.test).reduce((sum, stat) => sum + stat.skipped, 0)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800 }}>
                        {calculateSubjectStats(selectedStudentResult, selectedTestResults.test).reduce((sum, stat) => sum + stat.marks, 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {selectedStudentResult.studentAnswers && selectedStudentResult.studentAnswers.length > 0 && selectedTestResults.test.answerKey && selectedTestResults.test.answerKey.length > 0 && (
                <>
                  <h4 className="mb-8 mt-16">Question-wise Analysis</h4>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', 
                    gap: '8px', 
                    maxHeight: '250px', 
                    overflowY: 'auto', 
                    padding: '12px', 
                    background: 'var(--bg-secondary)', 
                    borderRadius: '12px', 
                    border: '1px solid var(--border-color)' 
                  }}>
                    {selectedStudentResult.studentAnswers.map((ans, idx) => {
                      const correctAns = selectedTestResults.test.answerKey[idx];
                      if (correctAns === undefined || correctAns === null) return null;
                      
                      const selStr = String(ans || '').trim().toUpperCase();
                      const corStr = String(correctAns).trim().toUpperCase();
                      const isBonus = isBonusAnswer(corStr);
                      
                      let isCorrect = false;
                      let isSkipped = false;
                      
                      if (isBonus) {
                        isCorrect = true;
                      } else if (!selStr || selStr === 'NULL') {
                        isSkipped = true;
                      } else if (selStr === corStr) {
                        isCorrect = true;
                      } else if (!isNaN(parseFloat(selStr)) && !isNaN(parseFloat(corStr)) && parseFloat(selStr) === parseFloat(corStr)) {
                        isCorrect = true;
                      }

                      let bgColor = 'var(--bg-primary)';
                      let color = 'var(--text-primary)';
                      let borderColor = 'var(--border-color)';

                      if (isBonus) {
                        bgColor = 'rgba(245, 158, 11, 0.14)';
                        color = '#b45309';
                        borderColor = 'rgba(245, 158, 11, 0.45)';
                      } else if (isSkipped) {
                        color = 'var(--text-tertiary)';
                      } else if (isCorrect) {
                        bgColor = 'rgba(34, 197, 94, 0.1)';
                        color = 'var(--accent-green)';
                        borderColor = 'rgba(34, 197, 94, 0.3)';
                      } else {
                        bgColor = 'rgba(239, 68, 68, 0.1)';
                        color = '#ef4444';
                        borderColor = 'rgba(239, 68, 68, 0.3)';
                      }

                      return (
                        <div key={idx} style={{ 
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          padding: '8px 4px', borderRadius: '8px', background: bgColor, 
                          border: `1.5px solid ${borderColor}`, textAlign: 'center'
                        }}>
                          <span style={{ fontWeight: 700, color: isBonus ? '#b45309' : 'var(--text-secondary)', marginBottom: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            Q{idx + 1} {isBonus && '⭐'}
                          </span>
                          <div style={{ fontSize: '0.9rem', fontWeight: 800, color }}>
                            {selStr !== 'NULL' && selStr ? selStr : '-'}
                          </div>
                          {isBonus ? (
                            <div style={{ fontSize: '0.64rem', color: '#b45309', marginTop: '2px', fontWeight: 800 }}>
                              BONUS (+{selectedTestResults?.test?.marksPerQuestion || 4})
                            </div>
                          ) : (!isCorrect && !isSkipped && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '2px', fontWeight: 600 }}>
                              Ans: {corStr}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setSelectedStudentResult(null)}>
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Manual Answer Key Modal */}
      {showManualAnswerKeyModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowManualAnswerKeyModal(false)} style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: '650px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Manual Answer Key Entry
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Test: <strong style={{ color: '#2563eb' }}>{selectedEntryTest?.name || 'Selected Test'}</strong>
                  {selectedEntryTest?.subject ? ` (${selectedEntryTest.subject})` : ''} • Total Qs: <strong>{questionNumbers.length}</strong>
                </p>
              </div>
              <button className="modal-close" onClick={() => setShowManualAnswerKeyModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="mb-4">
                <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                  <p className="text-sm text-gray-600 m-0">
                    Type your answers below and press <kbd style={{ padding: '2px 6px', background: '#e2e8f0', borderRadius: '4px', fontSize: '0.8rem' }}>Tab</kbd> or <kbd style={{ padding: '2px 6px', background: '#e2e8f0', borderRadius: '4px', fontSize: '0.8rem' }}>Enter</kbd> to move to next box.
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button 
                      type="button" 
                      className="btn btn-outline-danger btn-sm" 
                      onClick={() => {
                        if (window.confirm('Are you sure you want to clear all answer boxes for this test?')) {
                          setManualAnswersGrid(new Array(questionNumbers.length).fill(''));
                        }
                      }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', fontSize: '0.78rem' }}
                      title="Clear all entered answers"
                    >
                      <Trash2 size={13} /> Clear All
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-outline-primary btn-sm" 
                      onClick={handleCopyAnswerKey}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', fontSize: '0.78rem', fontWeight: 600 }}
                      title="Copy all answers as comma-separated text to paste in Notepad or another test"
                    >
                      <Copy size={13} /> Copy Answer Key
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm" 
                      onClick={handleManualGridPaste}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', fontSize: '0.78rem' }}
                      title="Quick paste comma-separated answers from clipboard"
                    >
                      <ClipboardList size={14} /> Quick Paste
                    </button>
                  </div>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', fontSize: '0.85rem', color: '#475569' }}>
                  <strong>💡 How to use Copy & Quick Paste:</strong> Click <strong>Copy Answer Key</strong> to copy all answers as comma-separated values (e.g., <code>A, B, C, D...</code>) to save in Notepad or paste into another test. You can also copy from Notepad and click <strong>Quick Paste</strong> to fill all boxes instantly!
                </div>
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '9px 12px', fontSize: '0.82rem', color: '#92400e', display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '8px' }}>
                  <Sparkles size={16} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>⭐ Bonus Questions:</strong> Type <code>*</code>, <code>*A</code>, <code>*B</code>, <code>*1</code>, or <code>BONUS</code> in any box to mark that question as a <strong>BONUS</strong>. All students will automatically get full marks (+{selectedEntryTest?.marksPerQuestion || 4}) for bonus questions!
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: '8px', maxHeight: '50vh', overflowY: 'auto', padding: '4px' }}>
                {manualAnswersGrid.map((ans, idx) => {
                  const isBonus = isBonusAnswer(ans);
                  return (
                    <div 
                      key={idx} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        background: isBonus ? '#fffbeb' : 'var(--bg-secondary)', 
                        padding: '4px 8px', 
                        borderRadius: '6px', 
                        border: isBonus ? '1.5px solid #f59e0b' : '1px solid var(--border-color)',
                        boxShadow: isBonus ? '0 1px 5px rgba(245, 158, 11, 0.25)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: isBonus ? '#b45309' : 'var(--text-tertiary)', width: isBonus ? '30px' : '24px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                        {questionNumbers[idx] || (idx + 1)}.{isBonus && '⭐'}
                      </span>
                      <input
                        type="text"
                        className="form-input"
                        style={{ 
                          width: '100%', 
                          padding: '4px', 
                          textAlign: 'center', 
                          fontWeight: 800, 
                          border: 'none', 
                          background: 'transparent',
                          color: isBonus ? '#b45309' : 'inherit'
                        }}
                        value={ans}
                        placeholder="-"
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          setManualAnswersGrid(prev => {
                            const newGrid = [...prev];
                            newGrid[idx] = val;
                            return newGrid;
                          });
                        }}
                        onKeyDown={(e) => {
                          const inputs = Array.from(e.target.closest('.modal-body').querySelectorAll('input'));
                          const index = inputs.indexOf(e.target);
                          
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (index > -1 && index < inputs.length - 1) {
                              inputs[index + 1].focus();
                            }
                          } else if (e.key === 'Backspace') {
                            if (e.target.value === '' && index > 0) {
                              e.preventDefault();
                              inputs[index - 1].focus();
                            }
                          } else if (e.key === 'ArrowRight') {
                            if (e.target.selectionStart === e.target.value.length && index < inputs.length - 1) {
                              e.preventDefault();
                              inputs[index + 1].focus();
                            }
                          } else if (e.key === 'ArrowLeft') {
                            if (e.target.selectionEnd === 0 && index > 0) {
                              e.preventDefault();
                              inputs[index - 1].focus();
                            }
                          } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                            e.preventDefault();
                            let cols = 0;
                            if (inputs.length > 0) {
                              const firstTop = inputs[0].offsetTop;
                              for (let i = 1; i < inputs.length; i++) {
                                if (inputs[i].offsetTop > firstTop) {
                                  cols = i;
                                }
                              }
                              if (cols === 0) cols = inputs.length;
                            }
                            
                            if (e.key === 'ArrowUp' && index >= cols) {
                              inputs[index - cols].focus();
                            } else if (e.key === 'ArrowDown' && index + cols < inputs.length) {
                              inputs[index + cols].focus();
                            }
                          }
                        }}
                        maxLength={8}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setShowManualAnswerKeyModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleManualAnswerKeySubmit}>Save Answer Key</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Test Confirmation Modal */}
      {testToDelete && createPortal(
        <div className="modal-overlay" onClick={() => setTestToDelete(null)} style={{ zIndex: 99999 }}>
          <div className="modal-content" style={{ maxWidth: '420px', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '10px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Delete Test</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Are you sure you want to delete <strong>{testToDelete.name}</strong>?
                </p>
              </div>
            </div>
            {getAppearedCount(testToDelete.id) > 0 && (
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.8rem', color: '#ef4444' }}>
                ⚠️ This will also permanently delete all student results and leaderboard data for this test.
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button"
                className="btn btn-secondary btn-sm" 
                onClick={() => setTestToDelete(null)}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="btn btn-sm" 
                style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 14px' }}
                onClick={() => {
                  const id = testToDelete.id;
                  setTestToDelete(null);
                  deleteTest(id);
                }}
              >
                Delete Test
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Smart Download OMR Choice Modal */}
      {showDownloadOmrModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowDownloadOmrModal(false)} style={{ zIndex: 99999 }}>
          <div className="modal-content" style={{ maxWidth: '540px', padding: '24px', borderRadius: '16px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#eff6ff', color: '#2563eb', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Download size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                    Download Scanned OMRs
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                    Choose which evaluated OMR sheets you want to save:
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDownloadOmrModal(false)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={16} color="#64748b" />
              </button>
            </div>

            {(() => {
              const { currentList, savedList, allList } = getOmrDownloadSets();
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                  {/* Option 1: Current / Freshly Scanned OMRs */}
                  {currentList.length > 0 && (
                    <div
                      onClick={() => executeOmrDownload(currentList, 'Current Fresh')}
                      style={{
                        border: '2px solid #2563eb',
                        borderRadius: '12px',
                        padding: '14px 16px',
                        background: '#f8fafc',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.15s ease',
                        boxShadow: '0 2px 8px rgba(37, 99, 235, 0.08)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#eff6ff'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#f8fafc'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.4rem' }}>🌟</span>
                        <div>
                          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>Download Freshly Scanned OMRs</span>
                            <span style={{ fontSize: '0.72rem', background: '#2563eb', color: '#ffffff', padding: '1px 8px', borderRadius: '10px' }}>Recommended</span>
                          </div>
                          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                            Only saves the <strong>{currentList.length}</strong> latest evaluated sheets from your active scan. (Zero duplicates)
                          </div>
                        </div>
                      </div>
                      <div style={{ color: '#2563eb', fontWeight: 800, fontSize: '0.85rem' }}>
                        ➔
                      </div>
                    </div>
                  )}

                  {/* Option 2: Previously Saved Database OMRs */}
                  {savedList.length > 0 && (
                    <div
                      onClick={() => executeOmrDownload(savedList, 'Saved Database')}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '14px 16px',
                        background: '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.4rem' }}>📦</span>
                        <div>
                          <div style={{ fontSize: '0.90rem', fontWeight: 800, color: '#334155' }}>
                            Download Saved Database OMRs ({savedList.length} sheets)
                          </div>
                          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                            Saves previously submitted draft/published sheets from the database.
                          </div>
                        </div>
                      </div>
                      <div style={{ color: '#64748b', fontWeight: 800, fontSize: '0.85rem' }}>
                        ➔
                      </div>
                    </div>
                  )}

                  {/* Option 3: All Available OMRs (Deduplicated) */}
                  {allList.length > 0 && (
                    <div
                      onClick={() => executeOmrDownload(allList, 'All Deduplicated')}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '14px 16px',
                        background: '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.4rem' }}>📂</span>
                        <div>
                          <div style={{ fontSize: '0.90rem', fontWeight: 800, color: '#334155' }}>
                            Download All Unique Sheets ({allList.length} total)
                          </div>
                          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                            1 latest sheet per student across all records plus unmatched sheets.
                          </div>
                        </div>
                      </div>
                      <div style={{ color: '#64748b', fontWeight: 800, fontSize: '0.85rem' }}>
                        ➔
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowDownloadOmrModal(false)}
                style={{ padding: '7px 18px', borderRadius: '8px' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Test Modal */}
      {editingTest && (
        <EditTestModal
          test={editingTest}
          onClose={() => setEditingTest(null)}
          onSave={async (updatedData) => {
            await updateTest(editingTest.id || editingTest._id, updatedData);
          }}
        />
      )}
    </motion.div>
  );
}
