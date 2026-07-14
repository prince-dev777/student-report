import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ClipboardList, Plus, FileSpreadsheet, BookOpen, 
  UserCheck, Award, TrendingUp, X, Check, Calculator, Upload, Trash2 
} from 'lucide-react';
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

  // For Create Test form (Answer Key input removed as it is now moved to Enter Marks page)
  const [testForm, setTestForm] = useState({
    name: '',
    batch: '',
    date: new Date().toISOString().split('T')[0],
    totalMarks: 720,
    marksPerQuestion: 4,
    negativeMarking: 1,
    templateId: 'neet_180',
    questionsToDetect: 180,
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

  const [selectedSubjects, setSelectedSubjects] = useState(subjects.length > 0 ? [subjects[0]] : []);

  // For Marks Entry
  const [entryTestId, setEntryTestId] = useState('');
  const [marksData, setMarksData] = useState({}); // studentId: marks
  const [omrStats, setOmrStats] = useState({}); // studentId: { correct, wrong }
  const [scannedAnswersData, setScannedAnswersData] = useState({}); // studentId: [selectedOption1, selectedOption2, ...]
  const [omrUploading, setOmrUploading] = useState(false);
  const [omrTemplate, setOmrTemplate] = useState('neet_180');
  const [detectQuestions, setDetectQuestions] = useState(180);

  // Memoize selected test for marks entry
  const selectedEntryTest = React.useMemo(() => {
    return tests.find(t => t.id === entryTestId) || null;
  }, [tests, entryTestId]);

  // Handle test creation
  const handleCreateTest = (e) => {
    e.preventDefault();
    if (!testForm.name.trim()) return toast.error('Test Name is required');
    if (!testForm.batch) return toast.error('Please select a batch');
    if (!testForm.totalMarks || testForm.totalMarks <= 0) return toast.error('Total Marks must be greater than 0');

    if (selectedSubjects.length === 0) return toast.error('Please select at least one subject');

    addTest({
      name: testForm.name,
      subject: selectedSubjects.join(', '),
      batch: testForm.batch,
      date: testForm.date,
      totalMarks: Number(testForm.totalMarks),
      marksPerQuestion: Number(testForm.marksPerQuestion) || 1,
      negativeMarking: Number(testForm.negativeMarking) || 0,
      templateId: testForm.templateId || 'neet_180',
      questionsToDetect: Number(testForm.questionsToDetect) || 180,
      answerKey: [] // Created without answer key initially
    });

    setTestForm({
      name: '',
      batch: '',
      date: new Date().toISOString().split('T')[0],
      totalMarks: 100,
      marksPerQuestion: 4,
      negativeMarking: 1,
      templateId: 'neet_180',
      questionsToDetect: 180,
    });
    setSelectedSubjects(subjects.length > 0 ? [subjects[0]] : []);

    setActiveTab('all-tests');
  };

  // Handle test selection for marks entry
  const handleEntryTestChange = (testId) => {
    setEntryTestId(testId);
    if (!testId) {
      setMarksData({});
      setOmrStats({});
      setScannedAnswersData({});
      return;
    }

    const test = tests.find(t => t.id === testId);
    if (!test) return;

    if (test.templateId) {
      setOmrTemplate(test.templateId);
    } else {
      setOmrTemplate('neet_180');
    }
    if (test.questionsToDetect) {
      setDetectQuestions(test.questionsToDetect);
    } else {
      setDetectQuestions(180);
    }

    // Get all active students in the selected test's batch
    const batchStudents = students.filter(s => s.batch === test.batch && s.status === 'active');
    
    // Check if there are existing results for this test to pre-fill
    const existing = testResults.filter(r => r.testId === testId);
    const initialMarks = {};
    const initialScannedAnswers = {};
    const initialOmrStats = {};
    
    batchStudents.forEach(s => {
      const match = existing.find(r => r.studentId === s.id);
      initialMarks[s.id] = match ? match.marks : '';
      initialScannedAnswers[s.id] = (match && match.studentAnswers) ? match.studentAnswers : [];
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
  };

  // Handle marks changes
  const handleMarksChange = (studentId, val) => {
    setMarksData(prev => ({
      ...prev,
      [studentId]: val === '' ? '' : Number(val)
    }));
  };

  // Submit test results
  const handleMarksSubmit = async (e) => {
    e.preventDefault();
    if (!entryTestId) return toast.error('Select a test first');

    const test = selectedEntryTest;
    if (!test) return;

    // Check if any mark exceeds totalMarks or is negative
    const batchStudents = students.filter(s => s.batch === test.batch && s.status === 'active');
    const resultsPayload = [];

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
        studentAnswers: scannedAnswersData[student.id] || []
      });
    }

    if (resultsPayload.length === 0) {
      return toast.error('No student marks have been entered.');
    }

    await submitTestResults(entryTestId, resultsPayload);
    setEntryTestId('');
    setMarksData({});
    setOmrStats({});
    setScannedAnswersData({});
    setActiveTab('all-tests');
  };

  // Handle OMR Images Upload
  const handleOMRUpload = async (e) => {
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
      let matchedCount = 0;

      res.results.forEach(r => {
        // Map rollNo to studentId using the students list
        const matchedStudent = students.find(s => String(s.rollNo) === String(r.rollNo));
        if (!matchedStudent) {
          console.warn(`OMR Scan: Student with Roll No ${r.rollNo} not found in database.`);
          return;
        }
        
        const sId = matchedStudent.id;
        newMarksData[sId] = r.marks;
        
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
      setOmrStats(newOmrStats);
      setScannedAnswersData(newScannedAnswers);
      toast.success(`Successfully scanned and matched ${matchedCount} students!`);
      
      if (res.errors && res.errors.length > 0) {
        toast.error(`${res.errors.length} images could not be scanned. See details.`);
        console.error('OMR Errors:', res.errors);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to scan OMR images');
    } finally {
      setOmrUploading(false);
      e.target.value = null; // reset input
    }
  };

  // Handle Answer Key File Upload (CSV/TXT)
  const handleAnswerKeyFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      const parsedLines = lines.map(line => line.split(',').map(c => c.trim()));
      
      // Group questions by subject
      const subjectsList = ['PHYSICS', 'CHEMISTRY', 'MATHEMATICS', 'MATHS', 'MATH', 'BIOLOGY', 'BIO', 'ENGLISH', 'GENERAL'];
      let currentSubject = 'GENERAL';
      const subjectGroups = {}; // subjectName: [ { qNum, answer } ]
      const subjectOrder = []; // to keep track of the order of subjects in the file
      
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
    reader.onerror = () => {
      toast.error('Failed to read the answer key file.');
    };
    reader.readAsText(file);
    e.target.value = null; // reset input
  };

  // Handle Answer Key Upload & Update on the Enter Marks page (for re-grading)
  const handleAnswerKeyUpdateUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!entryTestId) return toast.error('Please select a test first');

    const test = selectedEntryTest;
    if (!test) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      
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
    reader.onerror = () => {
      toast.error('Failed to read the answer key file.');
    };
    reader.readAsText(file);
    e.target.value = null; // reset input
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

  const getBatchName = (batchId) => {
    const batch = batches.find((b) => b.id === batchId);
    return batch ? batch.name : 'Unknown';
  };

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
                      <div><strong>Batch:</strong> {getBatchName(test.batch)}</div>
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
                  <div className="form-group">
                    <label className="form-label">Subjects *</label>
                    <div className="flex flex-wrap gap-8 mt-8">
                      {subjects.map(s => {
                        const isSelected = selectedSubjects.includes(s);
                        return (
                          <button
                            key={s}
                            type="button"
                            className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => {
                              setSelectedSubjects(prev => {
                                if (prev.includes(s)) {
                                  if (prev.length === 1) return prev; // Keep at least one selected
                                  return prev.filter(x => x !== s);
                                } else {
                                  return [...prev, s];
                                }
                              });
                            }}
                            style={{ padding: '6px 12px', borderRadius: '20px' }}
                          >
                            {isSelected && <Check size={12} style={{ marginRight: '4px' }} />}
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Target Batch *</label>
                    <select
                      className="form-select"
                      value={testForm.batch}
                      onChange={e => setTestForm(prev => ({ ...prev, batch: e.target.value }))}
                      style={{ marginTop: '8px' }}
                    >
                      <option value="">Select Batch</option>
                      {batches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
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
                        let defaultDetect = 180;
                        if (tempId === 'neet_90') defaultDetect = 90;
                        else if (tempId === 'jee_75' || tempId === 'jee_75_with_numerical') defaultDetect = 75;
                        else if (tempId === 'omr_50') defaultDetect = 50;
                        else if (tempId === 'mhcet_200') defaultDetect = 200;
                        
                        setTestForm(prev => ({ 
                          ...prev, 
                          templateId: tempId,
                          questionsToDetect: defaultDetect
                        }));
                      }}
                    >
                      <option value="neet_180">NEET 180 (MCQs)</option>
                      <option value="neet_90">NEET 90 (MCQs)</option>
                      <option value="jee_75">JEE 75 (MCQs)</option>
                      <option value="jee_75_with_numerical">JEE 75 (MCQ + Num)</option>
                      <option value="mhcet_200">MHCET 200</option>
                      <option value="omr_50">50-Question OMR</option>
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
                  <button type="submit" className="btn btn-primary">
                    <BookOpen size={16} />
                    Schedule Test
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
                      {t.name} ({getBatchName(t.batch)}) - {t.subject}
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
                            let defaultDetect = 180;
                            if (tempId === 'neet_90') defaultDetect = 90;
                            else if (tempId === 'jee_75' || tempId === 'jee_75_with_numerical') defaultDetect = 75;
                            else if (tempId === 'omr_50') defaultDetect = 50;
                            else if (tempId === 'mhcet_200' || tempId === 'mhcet_200_bio') defaultDetect = 200;
                            setDetectQuestions(defaultDetect);
                          }}
                          style={{ width: '180px', padding: '4px 8px', fontSize: '0.85rem' }}
                        >
                          <option value="neet_180">NEET 180 (MCQs)</option>
                          <option value="neet_90">NEET 90 (Biology)</option>
                          <option value="jee_75">JEE 75 (MCQ Only)</option>
                          <option value="jee_75_with_numerical">JEE 75 (MCQ + Num)</option>
                          <option value="omr_50">50-Question OMR (Universal)</option>
                          <option value="mhcet_200">MHCET 200 (PCB/PCM)</option>
                          <option value="mhcet_200_bio">MHCET 200 (Biology Only)</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-4">
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Detect:</span>
                        {omrTemplate === 'omr_50' ? (
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
                              omrTemplate === 'mhcet_200' ? 200 :
                              omrTemplate === 'neet_180' ? 180 :
                              omrTemplate === 'neet_90' ? 90 :
                              (omrTemplate === 'jee_75' || omrTemplate === 'jee_75_with_numerical') ? 75 : 50
                            }
                            style={{ width: '80px', padding: '4px 8px', fontSize: '0.85rem', display: 'inline-block' }}
                          />
                        )}
                      </div>
                      <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', gap: '6px' }} title="Upload Answer Key CSV to update evaluation">
                        <FileSpreadsheet size={14} />
                        Upload Answer Key CSV
                        <input 
                          type="file" 
                          accept=".csv"
                          onChange={handleAnswerKeyUpdateUpload} 
                          style={{ display: 'none' }} 
                        />
                      </label>
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
                      <button type="submit" className="btn btn-success" disabled={omrUploading}>
                        <UserCheck size={16} />
                        Publish & Send SMS
                      </button>
                    </div>
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
                          .filter(s => s.batch === selectedEntryTest?.batch && s.status === 'active')
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
      {showResultsModal && selectedTestResults && (
        <div className="modal-overlay" onClick={() => setShowResultsModal(false)}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Leaderboard - {selectedTestResults.test.name}</h3>
                <p className="card-subtitle" style={{ margin: 0 }}>
                  Subject: <strong>{selectedTestResults.test.subject}</strong> | Date: <strong>{formatDate(selectedTestResults.test.date)}</strong>
                </p>
              </div>
              <button className="modal-close" onClick={() => setShowResultsModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="table-container">
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
                            {res.omrSheetImage ? (
                              <a 
                                href={`${window.location.protocol}//${window.location.hostname}:5000${res.omrSheetImage}`}
                                target="_blank" 
                                rel="noreferrer" 
                                className="btn btn-ghost btn-xs text-accent"
                                style={{ padding: '2px 6px', fontSize: '0.75rem', textDecoration: 'none' }}
                              >
                                View OMR
                              </a>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>N/A</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowResultsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
