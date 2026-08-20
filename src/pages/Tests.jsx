import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ClipboardList, Plus, FileSpreadsheet, BookOpen, 
  UserCheck, Award, TrendingUp, X, Check, Calculator, Upload, Trash2, Save, Download, Loader2, ZoomIn, ZoomOut, AlertTriangle, Eye, Edit2,
  Search, Sparkles, ArrowRight, CheckCircle2, ChevronRight, Layers, FileCheck, RefreshCw, Filter, Calendar, Users
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

  // For Create Test form (Answer Key input removed as it is now moved to Enter Marks page)
  const [testForm, setTestForm] = useState({
    name: '',
    batch: '',
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
  const [entryMarksSearch, setEntryMarksSearch] = useState('');
  const [marksData, setMarksData] = useState({}); // studentId: marks
  const [omrStats, setOmrStats] = useState({}); // studentId: { correct, wrong }
  const [scannedAnswersData, setScannedAnswersData] = useState({}); // studentId: [selectedOption1, selectedOption2, ...]
  const [omrUploading, setOmrUploading] = useState(false);
  const [omrTemplate, setOmrTemplate] = useState('T1');
  const [lastOmrScanDir, setLastOmrScanDir] = useState(() => localStorage.getItem('last_omr_scan_dir') || '');
  const [lastScannedImages, setLastScannedImages] = useState([]);
  const [isDownloadingOmrs, setIsDownloadingOmrs] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(null);
  const [omrImagesData, setOmrImagesData] = useState({}); // studentId: image dataURI
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

  // Filter tests list for the Enter Marks selector view
  const filteredEntryTests = React.useMemo(() => {
    return (tests || []).filter(t => {
      if (entryMarksBatchFilter !== 'ALL') {
        const batchName = formatBatchName(t.batch).toLowerCase();
        const courseName = getCourseName(t.batch).toLowerCase();
        const target = entryMarksBatchFilter.toLowerCase();
        if (!batchName.includes(target) && !courseName.includes(target) && t.batch !== entryMarksBatchFilter) {
          return false;
        }
      }
      if (entryMarksSearch.trim()) {
        const q = entryMarksSearch.toLowerCase();
        const nameMatch = (t.name || '').toLowerCase().includes(q);
        const subMatch = (t.subject || '').toLowerCase().includes(q);
        const batchMatch = formatBatchName(t.batch || '').toLowerCase().includes(q);
        return nameMatch || subMatch || batchMatch;
      }
      return true;
    });
  }, [tests, entryMarksBatchFilter, entryMarksSearch]);

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
        targetClass: testForm.targetClass,
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
      targetClass: '',
      date: new Date().toISOString().split('T')[0],
      totalMarks: 300,
      marksPerQuestion: 4,
      negativeMarking: 1,
      templateId: 'T1',
      questionsToDetect: 75,
    });
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
      return;
    }

    const test = tests.find(t => t.id === testId);
    if (!test) return;

    if (test.templateId) {
      setOmrTemplate(test.templateId);
    } else {
      setOmrTemplate('T1');
    }

    // Get all active students in the selected test's course & class
    const batchStudents = students.filter(s => s.batch === test.batch && (!test.targetClass || s.class === test.targetClass) && s.status === 'active');
    
    // Check if there are existing results for this test to pre-fill
    const existing = testResults.filter(r => r.testId === testId);
    const initialMarks = {};
    const initialScannedAnswers = {};
    const initialOmrStats = {};
    const initialOmrImages = {};
    
    batchStudents.forEach(s => {
      const match = existing.find(r => r.studentId === s.id);
      initialMarks[s.id] = match ? match.marks : '';
      initialScannedAnswers[s.id] = (match && match.studentAnswers) ? match.studentAnswers : [];
      if (match && match.omrSheetImage) {
        initialOmrImages[s.id] = match.omrSheetImage;
      }
      if (match && match.studentAnswers && match.studentAnswers.length > 0) {
        const answerKey = test.answerKey || [];
        let correct = 0;
        let wrong = 0;
        match.studentAnswers.forEach((ans, idx) => {
           const isObj = typeof ans === 'object' && ans !== null;
           const status = isObj ? ans.status : (ans && ans !== 'NULL' ? 'valid' : 'blank');
           const selected = isObj ? ans.selectedOption : ans;
           
           let isMapped = true;
           if (test.subjectMapping && test.subjectMapping.length > 0) {
              const qNum = idx + 1;
              isMapped = test.subjectMapping.some(m => qNum >= m.fromQ && qNum <= m.toQ);
           }
           
           if (isMapped) {
              if (status === 'invalid') {
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
        });
        initialOmrStats[s.id] = { correct, wrong };
      }
    });
    setMarksData(initialMarks);
    setScannedAnswersData(initialScannedAnswers);
    setOmrStats(initialOmrStats);
    setOmrImagesData(initialOmrImages);
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
    const batchStudents = students.filter(s => s.batch === test.batch && (!test.targetClass || s.class === test.targetClass) && s.status === 'active');
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
        omrSheetImage: omrImagesData[student.id] || null
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
    if (window.electronAPI && typeof window.electronAPI.getPathForFile === 'function') {
      try {
        detectedPath = window.electronAPI.getPathForFile(imageFiles[0]);
      } catch (e) {}
    }
    if (!detectedPath && imageFiles[0] && imageFiles[0].path) {
      detectedPath = imageFiles[0].path;
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
      let matchedCount = 0;
      const currentErrors = res.errors || [];
      const seenRolls = new Set();

      const allScannedImages = [];
      res.results.forEach(r => {
        if (r.omrSheetImage) allScannedImages.push({ url: r.omrSheetImage, rollNo: String(r.rollNo) });
      });
      currentErrors.forEach((e, i) => {
        if (e.omrSheetImage) allScannedImages.push({ url: e.omrSheetImage, rollNo: 'Wrong_OMR_' + (i + 1) });
      });
      setLastScannedImages(allScannedImages);

      res.results.forEach(r => {
        let isDuplicate = false;
        if (r.rollNo) {
          if (seenRolls.has(String(r.rollNo))) {
            isDuplicate = true;
          }
          seenRolls.add(String(r.rollNo));
        }

        // Map rollNo to studentId using the students list
        // Strip ? and compare exact, numeric, or digit-only matching
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
        if (!matchedStudent || isDuplicate) {
          currentErrors.push({
            rollNumber: r.rollNo,
            error: isDuplicate ? `Duplicate Roll No: ${r.rollNo}` : (r.rollNo ? `Roll No ${r.rollNo} not found` : 'Roll No missing'),
            omrSheetImage: r.omrSheetImage,
            filename: r.filename
          });
          
          if (!matchedStudent) {
            console.warn(`OMR Scan: Student with Roll No ${r.rollNo} not found in database.`);
            return;
          }
          if (isDuplicate) {
            console.warn(`OMR Scan: Duplicate Roll No ${r.rollNo}.`);
            return;
          }
        }
        
        const sId = matchedStudent.id;
        newMarksData[sId] = r.marks;
        if (r.omrSheetImage) {
          newOmrImagesData[sId] = r.omrSheetImage;
        }
        
        let rawAnswers = [];
        if (r.studentAnswers) {
          rawAnswers = r.studentAnswers; // Fallback if no subjects
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
           // ans could be string or object depending on python output version
           const isObj = typeof ans === 'object' && ans !== null;
           const status = isObj ? ans.status : (ans ? 'valid' : 'blank');
           const selected = isObj ? ans.selectedOption : ans;
           
           let isMapped = true;
           if (test.subjectMapping && test.subjectMapping.length > 0) {
              const qNum = idx + 1;
              isMapped = test.subjectMapping.some(m => qNum >= m.fromQ && qNum <= m.toQ);
           }
           
           if (isMapped) {
              if (status === 'invalid') {
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

      newMarksData[sId] = r.marks || 0;
      if (r.omrSheetImage) {
        newOmrImagesData[sId] = r.omrSheetImage;
        setLastScannedImages(prev => [...prev.filter(x => x.rollNo !== String(r.rollNo)), { url: r.omrSheetImage, rollNo: String(r.rollNo || sId) }]);
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
            if (status === 'invalid') {
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
      
      toast.success(`OMR uploaded and forcefully mapped to student!`);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to scan OMR image for this student');
    } finally {
      setSingleOmrUploadingId(null);
      e.target.value = null; // reset input
    }
  };

  const handleDownloadOMRs = async () => {
    // Collect ALL scanned OMR images from:
    // 1. Current marks entry state (omrImagesData)
    // 2. Saved test results for this test in database
    // 3. Last scanned images list
    // 4. Any OMR scan errors / unmatched sheets
    const imagesMap = new Map();

    // 1. Current marks entry state
    if (omrImagesData && Object.keys(omrImagesData).length > 0) {
      Object.entries(omrImagesData).forEach(([studentId, url]) => {
        if (!url) return;
        const stu = students.find(s => s.id === studentId || s._id === studentId);
        const cleanRoll = stu?.rollNo ? String(stu.rollNo).replace(/^\?+|\?+$/g, '').trim() : '';
        const name = stu?.name || '';
        imagesMap.set(url, { url, rollNo: cleanRoll, name, studentId });
      });
    }

    // 2. Saved test results for this test
    if (testResults && testResults.length > 0 && (entryTestId || selectedEntryTest)) {
      const tId = entryTestId || selectedEntryTest?.id || selectedEntryTest?._id;
      const savedForThisTest = testResults.filter(r => 
        (r.testId === tId || (selectedEntryTest && (r.testId === selectedEntryTest.id || r.testId === selectedEntryTest._id))) && r.omrSheetImage
      );
      savedForThisTest.forEach(r => {
        if (r.omrSheetImage && !imagesMap.has(r.omrSheetImage)) {
          const stu = students.find(s => s.id === r.studentId || s._id === r.studentId || (r.rollNo && String(s.rollNo) === String(r.rollNo)));
          const cleanRoll = (r.rollNo || stu?.rollNo) ? String(r.rollNo || stu.rollNo).replace(/^\?+|\?+$/g, '').trim() : '';
          const name = stu?.name || r.studentName || '';
          imagesMap.set(r.omrSheetImage, { url: r.omrSheetImage, rollNo: cleanRoll, name, studentId: r.studentId });
        }
      });
    }

    // 3. Last scanned images list
    if (lastScannedImages && lastScannedImages.length > 0) {
      lastScannedImages.forEach((item, idx) => {
        if (item.url && !imagesMap.has(item.url)) {
          let rawRoll = item.rollNo ? String(item.rollNo).replace(/^\?+|\?+$/g, '').trim() : '';
          const stu = students.find(s => {
            if (!rawRoll) return false;
            const sRoll = String(s.rollNo).replace(/^\?+|\?+$/g, '').trim();
            return sRoll === rawRoll || (!isNaN(sRoll) && !isNaN(rawRoll) && Number(sRoll) === Number(rawRoll));
          });
          const rollNo = rawRoll || (stu?.rollNo ? String(stu.rollNo) : `Sheet_${idx + 1}`);
          const name = stu?.name || '';
          imagesMap.set(item.url, { url: item.url, rollNo, name });
        }
      });
    }

    // 4. Any OMR scan errors / unmatched sheets
    if (omrScanErrors && omrScanErrors.length > 0) {
      omrScanErrors.forEach((err, idx) => {
        if (err.omrSheetImage && !imagesMap.has(err.omrSheetImage)) {
          imagesMap.set(err.omrSheetImage, {
            url: err.omrSheetImage,
            rollNo: err.rollNumber && !err.rollNumber.includes('?') ? err.rollNumber : `Unmatched_${idx + 1}`,
            name: 'Scanned_Sheet'
          });
        }
      });
    }

    const imagesToDownload = Array.from(imagesMap.values());

    if (!imagesToDownload || imagesToDownload.length === 0) {
      return toast.error('No scanned OMR images available to download.');
    }

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

    // In web browser mode without local folder picker:
    if (!window.electronAPI && (!targetDir || targetDir === '')) {
      const toastId = toast.loading(`Downloading ${imagesToDownload.length} OMR images...`);
      let successCount = 0;
      for (const item of imagesToDownload) {
        const fullUrl = getMediaUrl(item.url);
        const fileName = `OMR_${item.rollNo || 'Roll'}_${(item.name || '').replace(/\s+/g, '_')}.jpg`;
        try {
          const resp = await fetch(fullUrl);
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
          await new Promise(r => setTimeout(r, 200));
        } catch (e) {
          console.warn('Direct download error:', e);
        }
      }
      toast.dismiss(toastId);
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
      toast.success(`🎉 Saved ${res.copiedCount} OMR images to:\n${res.outputDir}`, { duration: 5000 });
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
      const link = document.createElement('a');
      link.href = getMediaUrl(rawUrl);
      link.download = `OMR_${student.rollNo || student.id || 'Student'}.jpg`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
            if (
              idx < tokens.length && 
              ansStr && 
              ansStr !== 'NULL' && 
              tokens[idx]
            ) {
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

    if (manualAnswersGrid.length !== questionNumbers.length) {
      setManualAnswersGrid(new Array(questionNumbers.length).fill(''));
    }
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
          if (idx < tokens.length && ansStr && ansStr !== 'NULL' && tokens[idx]) {
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
      (!test.targetClass || s.class === test.targetClass) && 
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
        
        if (!sAnsStr || sAnsStr === 'NULL' || sAnsStr === 'UNDEFINED' || sAnsStr === '') {
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
            className="grid-3"
          >
            {tests.map((test) => {
              const appeared = getAppearedCount(test.id);
              const avg = calcTestAverage(testResults.filter(r => r.testId === test.id));
              const highest = getHighestScore(test.id);

              return (
                <div key={test.id} className="card flex flex-col justify-between" style={{ minHeight: '220px' }}>
                  <div>
                    <div className="flex justify-between items-center mb-8">
                      <div className="flex flex-wrap gap-4">
                        {test.subject?.split(', ').map(s => (
                          <span key={s} className="badge badge-info">{s}</span>
                        ))}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        {formatDate(test.date)}
                      </span>
                    </div>
                    <h3 className="mb-8">{test.name}</h3>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }} className="mb-16">
                      <div><strong>Course:</strong> {getCourseName(test.batch)}</div>
                      {test.targetClass && <div><strong>Class:</strong> {test.targetClass}</div>}
                      <div><strong>Total Marks:</strong> {test.totalMarks}</div>
                      {(test.negativeMarking > 0 || test.marksPerQuestion > 1) && (
                        <div>
                          <strong>Marking:</strong> +{test.marksPerQuestion || 1} / -{test.negativeMarking || 0}
                        </div>
                      )}
                      <div><strong>Appeared:</strong> {appeared > 0 ? `${appeared} students` : 'Results pending'}</div>
                    </div>
                  </div>

                  {appeared > 0 ? (
                    <div>
                      <div className="flex justify-between border-glass mt-8 pt-8 mb-16" style={{ borderTop: '1px solid var(--border-color-light)', fontSize: '0.8rem' }}>
                        <div>
                          <div style={{ color: 'var(--text-tertiary)' }}>Class Avg</div>
                          <strong className="text-gradient" style={{ fontSize: '1rem' }}>{avg}%</strong>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-tertiary)' }}>Highest</div>
                          <strong style={{ color: 'var(--accent-green)', fontSize: '1rem' }}>{highest}/{test.totalMarks}</strong>
                        </div>
                      </div>
                      <div className="flex gap-8">
                        <button 
                          className="btn btn-secondary flex-1 justify-center btn-sm"
                          onClick={() => handleViewResults(test)}
                        >
                          <Award size={14} />
                          View Leaderboard
                        </button>
                        <button 
                          className="btn btn-sm justify-center"
                          onClick={() => setEditingTest(test)}
                          style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '6px 10px' }}
                          title="Edit Test Details"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          className="btn btn-sm justify-center"
                          onClick={() => setTestToDelete(test)}
                          style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '6px 10px' }}
                          title="Delete Test"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-8">
                      <button 
                        className="btn btn-primary flex-1 justify-center btn-sm mt-8"
                        onClick={() => {
                          setEntryTestId(test.id);
                          handleEntryTestChange(test.id);
                          setActiveTab('enter-marks');
                        }}
                      >
                        <FileSpreadsheet size={14} />
                        Enter Marks
                      </button>
                      <button 
                        className="btn btn-sm mt-8 justify-center"
                        onClick={() => setEditingTest(test)}
                        style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '6px 10px' }}
                        title="Edit Test Details"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        className="btn btn-sm mt-8 justify-center"
                        onClick={() => setTestToDelete(test)}
                        style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '6px 10px' }}
                        title="Delete Test"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}

        {activeTab === 'create-test' && (
          <motion.div
            key="create-test"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex justify-center"
          >
            <div className="card w-full" style={{ maxWidth: '600px' }}>
              <div className="card-header">
                <h3 className="card-title">Schedule a New Exam</h3>
              </div>
              <form onSubmit={handleCreateTest} className="mt-8">
                <div className="form-group">
                  <label className="form-label">Test Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Monthly Mock Test, Unit Test 1"
                    value={testForm.name}
                    onChange={e => setTestForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Default OMR Layout</label>
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
                        } else if (tempId === 'T5') {
                          defaultDetect = 200; defaultMarksPerQ = 1; defaultNegMarks = 0; // Configured for MHCET
                        } else if (tempId === 'T6') {
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
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <div className="form-label flex justify-between items-center">
                      <span>Subject-Question Mapping *</span>
                      <button 
                        type="button" 
                        className="btn btn-sm btn-secondary"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSubjectMapping(prev => [...prev, { subject: 'Physics', fromQ: prev.length ? prev[prev.length-1].toQ + 1 : 1, toQ: '' }]);
                        }}
                      >
                        <Plus size={14} style={{ marginRight: '4px' }} /> Add Row
                      </button>
                    </div>
                    <div className="table-container mt-8" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      <table className="data-table" style={{ fontSize: '0.85rem' }}>
                        <thead>
                          <tr>
                            <th>Subject</th>
                            <th>From Q</th>
                            <th>To Q</th>
                            <th style={{ width: '40px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {subjectMapping.map((mapping, idx) => (
                            <tr key={idx}>
                              <td style={{ padding: '4px 8px' }}>
                                <select 
                                  className="form-select w-full" 
                                  style={{ padding: '4px 8px', fontSize: '0.85rem', height: '30px' }}
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
                                </select>
                              </td>
                              <td style={{ padding: '4px 8px' }}>
                                <input 
                                  type="number" 
                                  className="form-input w-full" 
                                  style={{ padding: '4px 8px', fontSize: '0.85rem', height: '30px' }}
                                  value={mapping.fromQ}
                                  onChange={(e) => {
                                    const newMap = [...subjectMapping];
                                    newMap[idx].fromQ = Number(e.target.value);
                                    setSubjectMapping(newMap);
                                  }}
                                  min="1"
                                />
                              </td>
                              <td style={{ padding: '4px 8px' }}>
                                <input 
                                  type="number" 
                                  className="form-input w-full" 
                                  style={{ padding: '4px 8px', fontSize: '0.85rem', height: '30px' }}
                                  value={mapping.toQ}
                                  onChange={(e) => {
                                    const newMap = [...subjectMapping];
                                    newMap[idx].toQ = Number(e.target.value);
                                    setSubjectMapping(newMap);
                                  }}
                                  min="1"
                                />
                              </td>
                              <td style={{ padding: '4px 8px' }}>
                                <button 
                                  type="button" 
                                  className="btn btn-sm"
                                  style={{ color: '#ef4444', background: 'transparent', padding: '4px' }}
                                  onClick={() => {
                                    setSubjectMapping(prev => prev.filter((_, i) => i !== idx));
                                  }}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {subjectMapping.length === 0 && (
                            <tr>
                              <td colSpan="4" className="text-center text-secondary py-16">
                                No subjects mapped. Please add a row.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label text-primary" style={{ fontWeight: '600' }}>OMR Sheet Layout (Bubbles)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={testForm.questionsToDetect}
                      readOnly
                      style={{ background: 'var(--surface-color)', cursor: 'not-allowed', fontWeight: 'bold' }}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Target Course *</label>
                    <select
                      className="form-select w-full"
                      value={testForm.batch}
                      onChange={e => setTestForm(prev => ({ ...prev, batch: e.target.value }))}
                    >
                      <option value="">Select Course</option>
                      {batches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Target Class (Optional)</label>
                    <select
                      className="form-select w-full"
                      value={testForm.targetClass}
                      onChange={e => setTestForm(prev => ({ ...prev, targetClass: e.target.value }))}
                    >
                      <option value="">All Classes</option>
                      {uniqueClasses.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={testForm.date}
                      onChange={e => setTestForm(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Marks per Correct Answer</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="e.g. 4 for NEET"
                      min="1"
                      value={testForm.marksPerQuestion}
                      onChange={e => setTestForm(prev => ({ ...prev, marksPerQuestion: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Negative Marking (per wrong)</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="e.g. 1 for NEET"
                      min="0"
                      step="0.25"
                      value={testForm.negativeMarking}
                      onChange={e => setTestForm(prev => ({ ...prev, negativeMarking: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label text-primary" style={{ fontWeight: '600' }}>Total Marks (Auto-calculated)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={testForm.totalMarks}
                      readOnly
                      style={{ background: 'var(--surface-color)', cursor: 'not-allowed', fontWeight: 'bold' }}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-8 mt-16 pt-16" style={{ borderTop: '1px solid var(--border-color-light)' }}>
                  <button type="submit" className="btn btn-primary" disabled={submittingAction === 'CreateTest'}>
                    {submittingAction === 'CreateTest' ? <Loader2 size={16} className="animate-spin" /> : <BookOpen size={16} />}
                    {submittingAction === 'CreateTest' ? 'Scheduling...' : 'Schedule Test'}
                  </button>
                </div>
              </form>
            </div>
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
                      {tests.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({getCourseName(t.batch)}{t.targetClass ? ` - ${t.targetClass}` : ''}) • {t.subject}
                        </option>
                      ))}
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

                {/* Right side: Search when picking tests */}
                {!entryTestId && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        type="text"
                        placeholder="Search test name or subject..."
                        value={entryMarksSearch}
                        onChange={(e) => setEntryMarksSearch(e.target.value)}
                        style={{
                          padding: '9px 12px 9px 36px',
                          borderRadius: '10px',
                          border: '1.5px solid #cbd5e1',
                          fontSize: '0.85rem',
                          width: '240px',
                          outline: 'none',
                          background: '#ffffff'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Batch Filter Pills (when choosing a test) */}
              {!entryTestId && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '16px',
                  paddingTop: '14px',
                  borderTop: '1px solid #f1f5f9',
                  flexWrap: 'wrap'
                }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Filter size={13} /> Filter Course:
                  </span>
                  {['ALL', 'JEE Mains', 'NEET', 'JEE Advanced', 'MHCET'].map(course => (
                    <button
                      key={course}
                      type="button"
                      onClick={() => setEntryMarksBatchFilter(course)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '20px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        border: entryMarksBatchFilter === course ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                        background: entryMarksBatchFilter === course ? '#2563eb' : '#ffffff',
                        color: entryMarksBatchFilter === course ? '#ffffff' : '#475569',
                        boxShadow: entryMarksBatchFilter === course ? '0 2px 8px rgba(37, 99, 235, 0.25)' : 'none'
                      }}
                    >
                      {course === 'ALL' ? '🎓 All Courses' : course}
                    </button>
                  ))}
                  {(entryMarksBatchFilter !== 'ALL' || entryMarksSearch) && (
                    <button
                      type="button"
                      onClick={() => { setEntryMarksBatchFilter('ALL'); setEntryMarksSearch(''); }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: '#f1f5f9',
                        color: '#64748b',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <X size={12} /> Clear
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* When NO test is selected: Show Visual Test Picker Cards + 3-Step Guided Workflow */}
            {!entryTestId && (
              <div>
                {/* Active Scheduled Tests Grid */}
                <div style={{ marginBottom: '32px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>📋 Pick a Test to Enter Marks & Scan OMR</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                          {filteredEntryTests.length} Tests Available
                        </span>
                      </h3>
                      <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 0' }}>
                        Click on any test card to open its live marksheet, upload answer keys, or start scanning OMR sheets.
                      </p>
                    </div>
                  </div>

                  {filteredEntryTests.length === 0 ? (
                    <div style={{
                      background: '#ffffff',
                      borderRadius: '16px',
                      padding: '48px 24px',
                      textAlign: 'center',
                      border: '1.5px dashed #cbd5e1'
                    }}>
                      <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '16px',
                        background: '#f1f5f9',
                        color: '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px'
                      }}>
                        <FileSpreadsheet size={28} />
                      </div>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', margin: '0 0 6px' }}>
                        No Scheduled Tests Found
                      </h4>
                      <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 20px', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
                        {entryMarksSearch || entryMarksBatchFilter !== 'ALL'
                          ? 'No tests matched your current filter criteria. Try clearing filters.'
                          : 'Create your first test to start recording marks and evaluating OMR sheets.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('create-test')}
                        className="btn btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                      >
                        <Plus size={16} /> Schedule New Test
                      </button>
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
                      gap: '16px'
                    }}>
                      {filteredEntryTests.map(test => {
                        const appeared = getAppearedCount(test.id);
                        const totalStudentsInBatch = (students || []).filter(s => 
                          s.batch === test.batch && (!test.targetClass || s.class === test.targetClass) && s.status === 'active'
                        ).length || 0;
                        const hasAnswerKey = test.answerKey && test.answerKey.length > 0;
                        const isFullyEvaluated = totalStudentsInBatch > 0 && appeared >= totalStudentsInBatch;

                        return (
                          <div
                            key={test.id}
                            onClick={() => handleEntryTestChange(test.id)}
                            style={{
                              background: '#ffffff',
                              borderRadius: '16px',
                              border: '1.5px solid #e2e8f0',
                              padding: '20px',
                              cursor: 'pointer',
                              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              position: 'relative',
                              overflow: 'hidden'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = '#3b82f6';
                              e.currentTarget.style.transform = 'translateY(-3px)';
                              e.currentTarget.style.boxShadow = '0 12px 24px -6px rgba(37, 99, 235, 0.12)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = '#e2e8f0';
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.04)';
                            }}
                          >
                            <div>
                              {/* Top Bar: Subject tags & Date */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {(test.subject || '').split(',').map((sub, i) => (
                                    <span key={i} style={{
                                      fontSize: '0.7rem',
                                      fontWeight: 700,
                                      background: '#f1f5f9',
                                      color: '#334155',
                                      padding: '2px 8px',
                                      borderRadius: '6px',
                                      border: '1px solid #e2e8f0'
                                    }}>
                                      {sub.trim()}
                                    </span>
                                  ))}
                                </div>
                                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Calendar size={12} /> {test.date ? formatDate(test.date) : 'N/A'}
                                </span>
                              </div>

                              {/* Test Title */}
                              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 10px', lineHeight: 1.3 }}>
                                {test.name}
                              </h4>

                              {/* Course & Class Badges */}
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '14px' }}>
                                <span style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                                  color: '#1d4ed8',
                                  padding: '3px 10px',
                                  borderRadius: '20px',
                                  border: '1px solid #bfdbfe'
                                }}>
                                  🎓 {getCourseName(test.batch)}
                                </span>
                                {test.targetClass && (
                                  <span style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    background: '#f8fafc',
                                    color: '#475569',
                                    padding: '3px 8px',
                                    borderRadius: '20px',
                                    border: '1px solid #e2e8f0'
                                  }}>
                                    Class: {test.targetClass}
                                  </span>
                                )}
                                <span style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  background: '#f0fdf4',
                                  color: '#15803d',
                                  padding: '3px 8px',
                                  borderRadius: '20px',
                                  border: '1px solid #bbf7d0'
                                }}>
                                  🎯 {test.totalMarks} Marks
                                </span>
                              </div>

                              {/* Evaluation Progress & Key Status */}
                              <div style={{
                                background: '#f8fafc',
                                borderRadius: '10px',
                                padding: '10px 12px',
                                marginBottom: '16px',
                                border: '1px solid #f1f5f9'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Users size={12} /> Evaluation Status:
                                  </span>
                                  <span style={{
                                    fontSize: '0.74rem',
                                    fontWeight: 800,
                                    color: isFullyEvaluated ? '#15803d' : appeared > 0 ? '#2563eb' : '#94a3b8'
                                  }}>
                                    {appeared} / {totalStudentsInBatch || '–'} Evaluated
                                  </span>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                    Answer Key:
                                  </span>
                                  <span style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    color: hasAnswerKey ? '#16a34a' : '#d97706',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}>
                                    {hasAnswerKey ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                                    {hasAnswerKey ? `${test.answerKey.length} Qs Configured` : 'Key Not Set'}
                                  </span>
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
                                padding: '9px',
                                borderRadius: '10px',
                                fontWeight: 700,
                                fontSize: '0.82rem'
                              }}
                            >
                              <FileSpreadsheet size={15} />
                              Open Marksheet & Scan OMR ➔
                            </button>
                          </div>
                        );
                      })}
                    </div>
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
                          <BookOpen size={14} /> Enter Answer Key
                        </button>
                      </div>
                      {selectedEntryTest && selectedEntryTest.answerKey && selectedEntryTest.answerKey.length > 0 && (
                        <button 
                          type="button" 
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => {
                            const newGrid = new Array(questionNumbers.length).fill('');
                            questionNumbers.forEach((qNum, idx) => {
                              if (qNum && qNum <= selectedEntryTest.answerKey.length) {
                                newGrid[idx] = selectedEntryTest.answerKey[qNum - 1] || '';
                              }
                            });
                            setManualAnswersGrid(newGrid);
                            setShowManualAnswerKeyModal(true);
                          }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: '6px', marginRight: '6px' }}
                          title="Review Uploaded Answer Key"
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
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-800 bg-white px-2 py-0.5 rounded text-sm border border-gray-200 shadow-sm">
                                  Roll No: {err.rollNumber || 'Unknown'} ⇒ 
                                </span>
                                {err.filename && (
                                  <span className="font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded text-sm border border-gray-200">
                                    {err.filename} ⇒ 
                                  </span>
                                )}
                                <span className="text-sm font-medium text-red-600">{err.error}</span>
                              </div>
                              {err.details && <p className="text-xs text-gray-500">{err.details}</p>}
                            </div>
                            {err.omrSheetImage && (
                              <button 
                                type="button"
                                onClick={() => setSelectedOmrImage(getMediaUrl(err.omrSheetImage))}
                                className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors"
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
                          .filter(s => s.batch === selectedEntryTest?.batch && (!selectedEntryTest?.targetClass || s.class === selectedEntryTest?.targetClass) && s.status === 'active')
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
                                          onClick={() => setSelectedOmrImage(getMediaUrl(omrImagesData[student.id]))}
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
                                    onClick={() => setSelectedOmrImage(getMediaUrl(res.omrSheetImage))}
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
            {({ zoomIn, zoomOut, resetTransform, state }) => (
              <div style={{ background: 'var(--bg-primary)', borderRadius: '18px', padding: '18px', maxWidth: '900px', width: '90vw', textAlign: 'center', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Scanned OMR Sheet</h4>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button className="btn btn-sm btn-ghost" onClick={() => zoomOut()}><ZoomOut size={16} /></button>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, minWidth: '40px' }}>{Math.round(state.scale * 100)}%</span>
                    <button className="btn btn-sm btn-ghost" onClick={() => zoomIn()}><ZoomIn size={16} /></button>
                    <button className="btn btn-sm btn-ghost" style={{ marginLeft: '4px' }} onClick={() => resetTransform()}>Reset</button>
                  </div>
                </div>
                
                <div style={{ flex: 1, overflow: 'hidden', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', cursor: 'grab' }}>
                  <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '100%' }}>
                    <img 
                      src={selectedOmrImage} 
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
            )}
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
                    onClick={() => setSelectedOmrImage(getMediaUrl(selectedStudentResult.omrSheetImage))}
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
                      
                      let isCorrect = false;
                      let isSkipped = false;
                      
                      if (!selStr || selStr === 'NULL') {
                        isSkipped = true;
                      } else if (selStr === corStr) {
                        isCorrect = true;
                      } else if (!isNaN(parseFloat(selStr)) && !isNaN(parseFloat(corStr)) && parseFloat(selStr) === parseFloat(corStr)) {
                        isCorrect = true;
                      }

                      let bgColor = 'var(--bg-primary)';
                      let color = 'var(--text-primary)';
                      let borderColor = 'var(--border-color)';

                      if (isSkipped) {
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
                          border: `1px solid ${borderColor}`, textAlign: 'center'
                        }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', fontSize: '0.75rem' }}>Q{idx + 1}</span>
                          <div style={{ fontSize: '0.9rem', fontWeight: 800, color }}>
                            {selStr !== 'NULL' && selStr ? selStr : '-'}
                          </div>
                          {!isCorrect && !isSkipped && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '2px', fontWeight: 600 }}>
                              Ans: {corStr}
                            </div>
                          )}
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
          <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Manual Answer Key Entry</h3>
              <button className="modal-close" onClick={() => setShowManualAnswerKeyModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="mb-4">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-sm text-gray-600 m-0">
                    Type your answers below and press <kbd style={{ padding: '2px 6px', background: '#e2e8f0', borderRadius: '4px', fontSize: '0.8rem' }}>Tab</kbd> or <kbd style={{ padding: '2px 6px', background: '#e2e8f0', borderRadius: '4px', fontSize: '0.8rem' }}>Enter</kbd> to move to the next box.
                  </p>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm" 
                    onClick={handleManualGridPaste}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <ClipboardList size={14} /> Quick Paste
                  </button>
                </div>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px', fontSize: '0.85rem', color: '#475569' }}>
                  <strong>💡 How to use Quick Paste:</strong> Open Notepad, write your answers separated by commas (e.g., <code>A, B, C, D...</code>), press <code>Ctrl + A</code> to select all, copy them, and click the <strong>Quick Paste</strong> button above to fill all boxes instantly!
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px', maxHeight: '50vh', overflowY: 'auto', padding: '4px' }}>
                {manualAnswersGrid.map((ans, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-tertiary)', width: '24px' }}>{questionNumbers[idx] || (idx + 1)}.</span>
                    <input
                      type="text"
                      className="form-input"
                      style={{ width: '100%', padding: '4px', textAlign: 'center', fontWeight: 'bold', border: 'none', background: 'transparent' }}
                      value={ans}
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
                                break;
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
                      maxLength={4}
                    />
                  </div>
                ))}
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
