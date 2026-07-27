import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ClipboardList, Plus, FileSpreadsheet, BookOpen, 
  UserCheck, Award, TrendingUp, X, Check, Calculator, Upload, Trash2, Save, Download, Loader2, ZoomIn, ZoomOut, AlertTriangle, Eye
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext';
import { subjects } from '../data/sampleData';
import { formatDate, calcTestAverage, getMarksCategory, getRankBadgeClass } from '../utils/helpers';
import toast from 'react-hot-toast';
import { api } from '../utils/api';

export default function Tests() {
  const { 
    tests, testResults, students, batches, 
    addTest, updateTestAnswerKey, deleteTest, submitTestResults 
  } = useApp();

  const [activeTab, setActiveTab] = useState('all-tests');
  const [selectedTestResults, setSelectedTestResults] = useState(null);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [selectedStudentResult, setSelectedStudentResult] = useState(null);
  const [omrScanErrors, setOmrScanErrors] = useState([]);

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

  // Auto-calculate Total Marks when questions or marks-per-question change
  React.useEffect(() => {
    setTestForm(prev => {
      const qCount = Number(prev.questionsToDetect) || 0;
      const mPerQ = Number(prev.marksPerQuestion) || 0;
      const expectedTotal = qCount * mPerQ;
      if (prev.totalMarks !== expectedTotal) {
        return { ...prev, totalMarks: expectedTotal };
      }
      return prev;
    });
  }, [testForm.questionsToDetect, testForm.marksPerQuestion]);

  const [subjectMapping, setSubjectMapping] = useState([]);

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
        { subject: 'Mathematics', fromQ: 101, toQ: 150 }
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
  const [marksData, setMarksData] = useState({}); // studentId: marks
  const [omrStats, setOmrStats] = useState({}); // studentId: { correct, wrong }
  const [scannedAnswersData, setScannedAnswersData] = useState({}); // studentId: [selectedOption1, selectedOption2, ...]
  const [omrUploading, setOmrUploading] = useState(false);
  const [omrTemplate, setOmrTemplate] = useState('T1');
  const [detectQuestions, setDetectQuestions] = useState(180);
  const [submittingAction, setSubmittingAction] = useState(null);
  const [omrImagesData, setOmrImagesData] = useState({}); // studentId: image dataURI
  const [selectedOmrImage, setSelectedOmrImage] = useState(null);
  const [omrZoomScale, setOmrZoomScale] = useState(1);
  const [showManualAnswerKeyModal, setShowManualAnswerKeyModal] = useState(false);
  const [manualAnswersGrid, setManualAnswersGrid] = useState([]);
  const [searchStudentQuery, setSearchStudentQuery] = useState('');
  const [singleOmrUploadingId, setSingleOmrUploadingId] = useState(null);

  // Auto-update manual answer grid when detect questions change
  React.useEffect(() => {
    if (detectQuestions > 0) {
      setManualAnswersGrid(prev => {
        if (prev.length === detectQuestions) return prev;
        const newGrid = new Array(detectQuestions).fill('');
        for (let i = 0; i < Math.min(prev.length, detectQuestions); i++) {
          newGrid[i] = prev[i];
        }
        return newGrid;
      });
    }
  }, [detectQuestions]);

  // Memoize selected test for marks entry
  const selectedEntryTest = React.useMemo(() => {
    return tests.find(t => t.id === entryTestId) || null;
  }, [tests, entryTestId]);

  // Handle test creation
  const handleCreateTest = async (e) => {
    e.preventDefault();
    if (!testForm.name.trim()) return toast.error('Test Name is required');
    if (!testForm.batch) return toast.error('Please select a course');
    if (!testForm.totalMarks || testForm.totalMarks <= 0) return toast.error('Total Marks must be greater than 0');

    if (subjectMapping.length === 0) return toast.error('Please add at least one subject mapping');
    const hasEmptySubject = subjectMapping.some(m => !m.subject || !m.fromQ || !m.toQ);
    if (hasEmptySubject) return toast.error('Please fill all subject mapping fields');

    // Warn if ranges don't seem to match questionsToDetect, but don't block
    const maxQ = Math.max(...subjectMapping.map(m => Number(m.toQ)));
    if (maxQ !== Number(testForm.questionsToDetect)) {
      toast.warn(`Highest mapped question is ${maxQ}, but detect count is ${testForm.questionsToDetect}.`);
    }

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
    if (test.questionsToDetect) {
      setDetectQuestions(test.questionsToDetect);
    } else {
      setDetectQuestions(180);
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
        initialOmrStats[s.id] = {
          correct: match.marks,
          wrong: match.studentAnswers.length - match.marks
        };
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
    const action = forceAction || (e?.nativeEvent?.submitter?.value) || 'Publish';
    const submitStatus = action === 'Save' ? 'Saved' : 'Published';
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
      if (mark < 0 || mark > test.totalMarks) {
        return toast.error(`Marks for ${student.name} must be between 0 and ${test.totalMarks}`);
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

    setOmrUploading(true);
    const formData = new FormData();
    formData.append('testId', entryTestId);
    formData.append('templateId', omrTemplate);
    formData.append('questionsToDetect', detectQuestions);
    
    // Pass test configurations for grading
    const testData = {
      marksPerQuestion: test.marksPerQuestion || 1,
      negativeMarking: test.negativeMarking || 0,
      answer_keys: test.answerKey || {}
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

      res.results.forEach(r => {
        let isDuplicate = false;
        if (r.rollNo) {
          if (seenRolls.has(String(r.rollNo))) {
            isDuplicate = true;
          }
          seenRolls.add(String(r.rollNo));
        }

        // Map rollNo to studentId using the students list
        // Convert both to Number to handle leading zeros (e.g. '0340' vs '340')
        const matchedStudent = students.find(s => {
          if (s.rollNo == null || r.rollNo == null) return false;
          // If they contain letters, compare as string, otherwise as numbers
          const sRollStr = String(s.rollNo).trim();
          const rRollStr = String(r.rollNo).trim();
          if (!isNaN(sRollStr) && !isNaN(rRollStr)) {
            return Number(sRollStr) === Number(rRollStr);
          }
          return sRollStr.toLowerCase() === rRollStr.toLowerCase();
        });
        if (!matchedStudent || isDuplicate) {
          currentErrors.push({
            rollNumber: r.rollNo,
            error: isDuplicate ? `Duplicate Roll No: ${r.rollNo}` : (r.rollNo ? `Roll No ${r.rollNo} not found` : 'Roll No missing'),
            omrSheetImage: r.omrSheetImage
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

        if (detectQuestions > 0 && rawAnswers.length > detectQuestions) {
          rawAnswers = rawAnswers.slice(0, detectQuestions);
        }

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
           return selected;
        });

        newScannedAnswers[sId] = flatAnswers;
        newMarksData[sId] = Math.max(0, (correct * marksPerQ) - (wrong * negMarks));

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

    setSingleOmrUploadingId(studentId);
    const formData = new FormData();
    formData.append('testId', entryTestId);
    formData.append('templateId', omrTemplate);
    formData.append('questionsToDetect', detectQuestions);
    
    const testData = {
      marksPerQuestion: test.marksPerQuestion || 1,
      negativeMarking: test.negativeMarking || 0,
      answer_keys: test.answerKey || {}
    };
    formData.append('testData', JSON.stringify(testData));
    formData.append('images', file);

    try {
      const res = await api.uploadOMRImages(formData);
      if (!res.results || res.results.length === 0) {
        throw new Error('No OMR results returned from server.');
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

      if (detectQuestions > 0 && rawAnswers.length > detectQuestions) {
        rawAnswers = rawAnswers.slice(0, detectQuestions);
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
         return selected;
      });

      newScannedAnswers[sId] = flatAnswers;
      newMarksData[sId] = Math.max(0, (correct * marksPerQ) - (wrong * negMarks));
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
        if (cols.length || cols[0] === '') return;
        
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
            const ansStr = String(ans).trim().toUpperCase();
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
          const score = Math.max(0, (correct * marksPerQ) - (wrong * negMarks));
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

  const handleOpenManualEntry = (e) => {
    if (e && e.target) {
      const details = e.target.closest('details');
      if (details) details.removeAttribute('open');
    }

    const totalQ = selectedEntryTest?.questionsToDetect || detectQuestions || 100;
    if (manualAnswersGrid.length !== totalQ) {
      setManualAnswersGrid(new Array(totalQ).fill(''));
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
    
    // Trim and clean grid values
    const tokens = manualAnswersGrid.map(val => (val || '').trim().toUpperCase());
    
    // Check if empty
    if (tokens.every(t => t === '')) {
      toast.error('Answer key is completely empty.');
      return;
    }

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
          const ansStr = String(ans).trim().toUpperCase();
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
        const score = Math.max(0, (correct * marksPerQ) - (wrong * negMarks));
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

  // View Test Results Details
  const handleViewResults = (test) => {
    const results = testResults.filter(r => r.testId === test.id);
    setSelectedTestResults({
      test,
      results: results.map(r => {
        const student = students.find(s => s.id === r.studentId);
        return {
          ...r,
          studentName: student ? student.name : 'Unknown Student',
          rollNo: student ? student.rollNo : 'N/A'
        };
      }).sort((a, b) => a.rank - b.rank)
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
        
        const sAnsStr = studentAns ? String(studentAns).trim().toUpperCase() : 'NULL';
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
      
      const marks = Math.max(0, (correct * marksPerQ) - (wrong * negMarks));
      
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

  const handleDownloadExcel = () => {
    if (!selectedTestResults || !selectedTestResults.results) return;
    
    const test = selectedTestResults.test;
    const worksheetData = selectedTestResults.results.map(res => {
      const baseData = {
        'Rank': res.rank !== undefined ? res.rank : 'N/A',
        'Roll No': res.rollNo,
        'Student Name': res.studentName
      };

      const subjectStats = calculateSubjectStats(res, test);
      subjectStats.forEach(stat => {
        baseData[`${stat.subject} Marks`] = stat.marks;
      });

      baseData['Total Marks'] = `${res.marks} / ${res.totalMarks}`;
      baseData['Percentage'] = res.percentage !== undefined ? `${res.percentage}%` : 'N/A';

      return baseData;
    });

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    
    // Auto-size columns
    const colWidths = [
      { wch: 8 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 12 }
    ];
    
    if (worksheetData.length > 0) {
      const extraCols = Object.keys(worksheetData[0]).length - 5;
      for (let i = 0; i < extraCols; i++) {
        colWidths.push({ wch: 15 });
      }
    }
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();

    // Make header bold
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + '1';
      if (!worksheet[address]) continue;
      worksheet[address].s = { font: { bold: true } };
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, "Leaderboard");
    
    const fileName = `${test.name}_${test.subject}_Leaderboard.xlsx`.replace(/[^a-zA-Z0-9_.-]/g, '_');
    XLSX.writeFile(workbook, fileName);
  };

  const getCourseName = (batchId) => {
    const batch = batches.find((b) => b.id === batchId);
    return batch ? batch.name : 'Unknown';
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
      <div className="page-header">
        <h1>Test & Exam Management</h1>
        <p>Create tests, record scores, automatically calculate ranks and notify parents instantly.</p>
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
                          onClick={() => { if(confirm('Delete this test and all results?')) deleteTest(test.id); }}
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
                        onClick={() => { if(confirm('Delete this test?')) deleteTest(test.id); }}
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
                    <label className="form-label flex justify-between items-center">
                      <span>Subject-Question Mapping *</span>
                      <button 
                        type="button" 
                        className="btn btn-sm btn-secondary"
                        onClick={() => setSubjectMapping(prev => [...prev, { subject: 'Physics', fromQ: prev.length ? prev[prev.length-1].toQ + 1 : 1, toQ: '' }])}
                      >
                        <Plus size={14} style={{ marginRight: '4px' }} /> Add Row
                      </button>
                    </label>
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
                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={testForm.date}
                      onChange={e => setTestForm(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Total Marks *</label>
                    <input
                      type="number"
                      className="form-input"
                      value={testForm.totalMarks}
                      onChange={e => setTestForm(prev => ({ ...prev, totalMarks: e.target.value }))}
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
                  <div className="form-group">
                    <label className="form-label">Default OMR Layout</label>
                    <select
                      className="form-select"
                      value={testForm.templateId}
                      onChange={e => {
                        const tempId = e.target.value;
                        let defaultDetect = 75;
                        if (tempId === 'T1' || tempId === 'T2') defaultDetect = 75;
                        else if (tempId === 'T3') defaultDetect = 180;
                        else if (tempId === 'T4') defaultDetect = 90;
                        else if (tempId === 'T5' || tempId === 'T6') defaultDetect = 200;
                        else if (tempId === 'T7') defaultDetect = 50;
                        
                        setTestForm(prev => ({ 
                          ...prev, 
                          templateId: tempId,
                          questionsToDetect: defaultDetect
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
                  <div className="form-group">
                    <label className="form-label">Default Questions to Detect</label>
                    <input
                      type="number"
                      className="form-input"
                      min="1"
                      value={testForm.questionsToDetect}
                      onChange={e => setTestForm(prev => ({ ...prev, questionsToDetect: e.target.value }))}
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
            <div className="card mb-24">
              <div className="form-group mb-0" style={{ maxWidth: '400px' }}>
                <label className="form-label">Select Scheduled Test</label>
                <select
                  className="form-select"
                  value={entryTestId}
                  onChange={e => handleEntryTestChange(e.target.value)}
                >
                  <option value="">-- Select Test to Enter Marks --</option>
                  {tests.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({getCourseName(t.batch)}{t.targetClass ? ` - ${t.targetClass}` : ''}) - {t.subject}
                    </option>
                  ))}
                </select>
              </div>
            </div>

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
                            let defaultDetect = 75;
                            if (tempId === 'T1' || tempId === 'T2') defaultDetect = 75;
                            else if (tempId === 'T3') defaultDetect = 180;
                            else if (tempId === 'T4') defaultDetect = 90;
                            else if (tempId === 'T5' || tempId === 'T6') defaultDetect = 200;
                            else if (tempId === 'T7') defaultDetect = 50;
                            setDetectQuestions(defaultDetect);
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

                      <div className="flex items-center gap-4">
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Detect:</span>
                        {omrTemplate === 'T7' ? (
                          <select
                            className="form-select form-select-sm"
                            value={detectQuestions}
                            onChange={e => setDetectQuestions(Number(e.target.value))}
                            style={{ width: '150px', padding: '4px 8px', fontSize: '0.85rem' }}
                          >
                            <option value={25}>25</option>
                            <option value={45}>45</option>
                            <option value={50}>50</option>
                          </select>
                        ) : (
                          <input
                            type="number"
                            className="form-input form-input-sm"
                            value={detectQuestions}
                            onChange={e => setDetectQuestions(Number(e.target.value))}
                            min="1"
                            max={
                              omrTemplate === 'T5' || omrTemplate === 'T6' ? 200 :
                              omrTemplate === 'T3' ? 180 :
                              omrTemplate === 'T4' ? 90 :
                              (omrTemplate === 'T1' || omrTemplate === 'T2') ? 75 : 50
                            }
                            style={{ width: '80px', padding: '4px 8px', fontSize: '0.85rem', display: 'inline-block' }}
                          />
                        )}
                      </div>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <details className="dropdown">
                          <summary className="btn btn-secondary btn-sm m-1" style={{ display: 'inline-flex', gap: '6px', cursor: 'pointer', userSelect: 'none' }}>
                            <BookOpen size={14} /> Upload Answer Key
                          </summary>
                          <ul className="menu dropdown-content shadow" style={{ position: 'absolute', backgroundColor: 'white', border: '1px solid #e2e8f0', zIndex: 10, listStyle: 'none', padding: '8px', margin: 0, borderRadius: '8px', minWidth: '160px', top: '100%', left: 0 }}>
                            <li style={{ marginBottom: '8px' }}>
                              <label style={{ cursor: 'pointer', display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.9rem', color: 'var(--text-primary)' }} className="hover:text-primary">
                                <FileSpreadsheet size={14} /> Excel / CSV
                                <input 
                                  type="file" 
                                  accept=".csv, .xlsx"
                                  onChange={handleAnswerKeyUpdateUpload} 
                                  style={{ display: 'none' }} 
                                />
                              </label>
                            </li>
                            <li>
                              <button 
                                type="button" 
                                onClick={(e) => handleOpenManualEntry(e)}
                                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.9rem', width: '100%', textAlign: 'left', color: 'var(--text-primary)' }}
                                className="hover:text-primary"
                              >
                                <Plus size={14} /> Manual Entry
                              </button>
                            </li>
                          </ul>
                        </details>
                      </div>
                      <label className={`btn btn-secondary btn-sm ${omrUploading ? 'opacity-50 pointer-events-none' : ''}`} style={{ cursor: 'pointer', display: 'inline-flex', gap: '6px' }} title="Upload folder of OMR images">
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
                        name="action" 
                        value="Save" 
                        className="btn btn-outline-primary" 
                        disabled={omrUploading || submittingAction}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        onClick={(e) => handleMarksSubmit(e, 'Save')}
                      >
                        {submittingAction === 'Save' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {submittingAction === 'Save' ? 'Saving...' : 'Save Marks'}
                      </button>
                      <button 
                        type="button" 
                        name="action" 
                        value="Publish" 
                        className="btn btn-success" 
                        disabled={omrUploading || submittingAction}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        onClick={(e) => handleMarksSubmit(e, 'Publish')}
                      >
                        {submittingAction === 'Publish' ? <Loader2 size={16} className="animate-spin" /> : <UserCheck size={16} />}
                        {submittingAction === 'Publish' ? 'Publishing...' : 'Publish & Send SMS'}
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
                                  Roll No: {err.rollNumber || 'Unknown'}
                                </span>
                                <span className="text-sm font-medium text-red-600">{err.error}</span>
                              </div>
                              {err.details && <p className="text-xs text-gray-500">{err.details}</p>}
                            </div>
                            {err.omrSheetImage && (
                              <button 
                                type="button"
                                onClick={() => setSelectedOmrImage(err.omrSheetImage.startsWith('data:') ? err.omrSheetImage : (window.location.protocol === 'file:' ? `http://localhost:5000${err.omrSheetImage}` : `${window.location.protocol}//${window.location.hostname}:5000${err.omrSheetImage}`))}
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
                                  <div className="flex flex-col gap-2 items-end">
                                    {omrImagesData[student.id] && (
                                      <button
                                        type="button"
                                        onClick={() => setSelectedOmrImage(omrImagesData[student.id].startsWith('data:') ? omrImagesData[student.id] : (window.location.protocol === 'file:' ? `http://localhost:5000${omrImagesData[student.id]}` : `${window.location.protocol}//${window.location.hostname}:5000${omrImagesData[student.id]}`))}
                                        className="btn btn-ghost btn-xs text-accent flex-shrink-0"
                                        style={{ padding: '4px 8px', fontSize: '0.75rem', marginTop: '-2px' }}
                                      >
                                        View OMR
                                      </button>
                                    )}
                                    <label 
                                      className={`btn btn-outline-secondary btn-xs flex-shrink-0 ${singleOmrUploadingId === student.id ? 'opacity-50 pointer-events-none' : ''}`} 
                                      style={{ padding: '4px 8px', fontSize: '0.75rem', marginTop: '-2px', cursor: 'pointer', display: 'inline-block' }}
                                    >
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
          <div className="modal-content modal-lg" style={{ maxHeight: '75vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ flexShrink: 0, padding: '16px 24px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Leaderboard - {selectedTestResults.test.name}
                </h3>
                <p className="card-subtitle" style={{ margin: '4px 0 0 0', fontSize: '0.82rem' }}>
                  Subject: <strong>{selectedTestResults.test.subject}</strong> | Date: <strong>{formatDate(selectedTestResults.test.date)}</strong>
                </p>
              </div>
              <button className="modal-close" onClick={() => setShowResultsModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ flex: '1 1 auto', overflowY: 'auto', minHeight: 0, padding: '16px 24px' }}>
              <div className="table-container" style={{ maxHeight: 'calc(75vh - 140px)', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>Rank</th>
                      <th>Roll No</th>
                      <th>Student</th>
                      <th style={{ width: '120px' }}>Marks</th>
                      <th>Percentage</th>
                      <th>OMR Sheet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTestResults.results.map((res) => {
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
                          <td>{res.marks} / {res.totalMarks}</td>
                          <td>
                            <span className={`marks-pill ${marksCategory}`}>
                              {res.percentage !== undefined ? `${res.percentage}%` : 'N/A'}
                            </span>
                          </td>
                          <td>
                            <div className="flex gap-4">
                              <button 
                                onClick={() => setSelectedStudentResult(res)}
                                className="btn btn-ghost btn-xs text-primary"
                                style={{ padding: '2px 6px', fontSize: '0.75rem', textDecoration: 'none' }}
                              >
                                View Results
                              </button>
                              {res.omrSheetImage && (
                                <button 
                                  onClick={() => setSelectedOmrImage(res.omrSheetImage.startsWith('data:') ? res.omrSheetImage : (window.location.protocol === 'file:' ? `http://localhost:5000${res.omrSheetImage}` : `${window.location.protocol}//${window.location.hostname}:5000${res.omrSheetImage}`))}
                                  className="btn btn-ghost btn-xs text-accent"
                                  style={{ padding: '2px 6px', fontSize: '0.75rem', textDecoration: 'none' }}
                                >
                                  View OMR
                                </button>
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
              <button className="btn btn-outline-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={handleDownloadExcel}>
                <Download size={16} />
                Download Excel
              </button>
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
            wheel={{ step: 0.1 }}
            pinch={{ step: 5 }}
          >
            {({ zoomIn, zoomOut, resetTransform, state }) => (
              <div style={{ background: 'var(--bg-primary)', borderRadius: '18px', padding: '18px', maxWidth: '560px', width: '100%', textAlign: 'center', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
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
                  <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
                    <img 
                      src={selectedOmrImage} 
                      alt="OMR Sheet" 
                      style={{ width: '100%', display: 'block', pointerEvents: 'none' }}
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
          <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
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
                    onClick={() => setSelectedOmrImage(
                      selectedStudentResult.omrSheetImage.startsWith('data:') 
                        ? selectedStudentResult.omrSheetImage 
                        : (window.location.protocol === 'file:' ? `http://localhost:5000${selectedStudentResult.omrSheetImage}` : `${window.location.protocol}//${window.location.hostname}:5000${selectedStudentResult.omrSheetImage}`)
                    )}
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
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-600 m-0">
                  Type your answers below and press <kbd style={{ padding: '2px 6px', background: '#e2e8f0', borderRadius: '4px', fontSize: '0.8rem' }}>Tab</kbd> or <kbd style={{ padding: '2px 6px', background: '#e2e8f0', borderRadius: '4px', fontSize: '0.8rem' }}>Enter</kbd> to move to the next box. Quick Paste supports lists like <code>1-A, 2-B</code> or <code>A, B, C</code>.
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
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px', maxHeight: '50vh', overflowY: 'auto', padding: '4px' }}>
                {manualAnswersGrid.map((ans, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-tertiary)', width: '24px' }}>{idx + 1}.</span>
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
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const inputs = Array.from(e.target.closest('.modal-body').querySelectorAll('input'));
                          const index = inputs.indexOf(e.target);
                          if (index > -1 && index < inputs.length - 1) {
                            inputs[index + 1].focus();
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
    </motion.div>
  );
}
