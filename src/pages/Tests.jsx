import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ClipboardList, Plus, FileSpreadsheet, BookOpen, 
  UserCheck, Award, TrendingUp, X, Check, Calculator, Upload 
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { subjects } from '../data/sampleData';
import { formatDate, calcTestAverage, getMarksCategory, getRankBadgeClass } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function Tests() {
  const { 
    tests, testResults, students, batches, 
    addTest, submitTestResults 
  } = useApp();

  const [activeTab, setActiveTab] = useState('all-tests');
  const [selectedTestResults, setSelectedTestResults] = useState(null);
  const [showResultsModal, setShowResultsModal] = useState(false);

  // For Create Test form
  const [testForm, setTestForm] = useState({
    name: '',
    batch: '',
    date: new Date().toISOString().split('T')[0],
    totalMarks: 100
  });
  const [selectedSubjects, setSelectedSubjects] = useState([subjects[0] || 'Physics']);

  // For Marks Entry
  const [entryTestId, setEntryTestId] = useState('');
  const [marksData, setMarksData] = useState({}); // studentId: marks

  // Filter tests by having results
  const getTestsWithoutResults = () => {
    return tests.filter(t => !testResults.some(r => r.testId === t.id));
  };

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
      totalMarks: Number(testForm.totalMarks)
    });

    setTestForm({
      name: '',
      batch: '',
      date: new Date().toISOString().split('T')[0],
      totalMarks: 100
    });
    setSelectedSubjects([subjects[0] || 'Physics']);

    setActiveTab('all-tests');
  };

  // Handle test selection for marks entry
  const handleEntryTestChange = (testId) => {
    setEntryTestId(testId);
    if (!testId) {
      setMarksData({});
      return;
    }

    const test = tests.find(t => t.id === testId);
    if (!test) return;

    // Get all active students in the selected test's batch
    const batchStudents = students.filter(s => s.batch === test.batch && s.status === 'active');
    
    // Check if there are existing results for this test to pre-fill
    const existing = testResults.filter(r => r.testId === testId);
    const initialMarks = {};
    
    batchStudents.forEach(s => {
      const match = existing.find(r => r.studentId === s.id);
      initialMarks[s.id] = match ? match.marks : '';
    });
    
    setMarksData(initialMarks);
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

    const test = tests.find(t => t.id === entryTestId);
    if (!test) return;

    // Check if any mark exceeds totalMarks or is negative
    const batchStudents = students.filter(s => s.batch === test.batch && s.status === 'active');
    const resultsPayload = [];

    for (const student of batchStudents) {
      const mark = marksData[student.id];
      if (mark === '' || mark === undefined) {
        return toast.error(`Please enter marks for ${student.name}`);
      }
      if (mark < 0 || mark > test.totalMarks) {
        return toast.error(`Marks for ${student.name} must be between 0 and ${test.totalMarks}`);
      }
      resultsPayload.push({
        studentId: student.id,
        marks: Number(mark)
      });
    }

    await submitTestResults(entryTestId, resultsPayload);
    setEntryTestId('');
    setMarksData({});
    setActiveTab('all-tests');
  };

  // Handle OMR CSV File Upload
  const handleOMRUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const test = tests.find(t => t.id === entryTestId);
    if (!test) return toast.error('Please select a test first');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r?\n/);
        const parsedData = {}; // rollNo -> marks

        let startIdx = 0;
        // Skip header line if present
        if (lines[0].toLowerCase().includes('roll') || lines[0].toLowerCase().includes('mark') || lines[0].toLowerCase().includes('score')) {
          startIdx = 1;
        }

        for (let i = startIdx; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const parts = line.split(',');
          if (parts.length >= 2) {
            const rollNo = parts[0].trim();
            const score = Number(parts[1].trim());
            if (rollNo && !isNaN(score)) {
              parsedData[rollNo] = score;
            }
          }
        }

        const batchStudents = students.filter(s => s.batch === test.batch && s.status === 'active');
        const newMarksData = { ...marksData };
        let matchedCount = 0;

        batchStudents.forEach(student => {
          if (parsedData[student.rollNo] !== undefined) {
            const score = Math.min(parsedData[student.rollNo], test.totalMarks);
            newMarksData[student.id] = score;
            matchedCount++;
          }
        });

        setMarksData(newMarksData);
        toast.success(`Matched ${matchedCount} / ${batchStudents.length} students from OMR scanner sheet!`);
      } catch (err) {
        console.error(err);
        toast.error('Failed to read OMR file format.');
      }
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
                        {test.subject.split(', ').map(s => (
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
                      <button 
                        className="btn btn-secondary w-full justify-center btn-sm"
                        onClick={() => handleViewResults(test)}
                      >
                        <Award size={14} />
                        View Leaderboard
                      </button>
                    </div>
                  ) : (
                    <button 
                      className="btn btn-primary w-full justify-center btn-sm mt-8"
                      onClick={() => {
                        setEntryTestId(test.id);
                        handleEntryTestChange(test.id);
                        setActiveTab('enter-marks');
                      }}
                    >
                      <FileSpreadsheet size={14} />
                      Enter Marks
                    </button>
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
                  {getTestsWithoutResults().map(t => (
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
                        Test: <strong>{tests.find(t => t.id === entryTestId)?.name}</strong> | 
                        Max Marks: <strong>{tests.find(t => t.id === entryTestId)?.totalMarks}</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-12">
                      <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-flex', gap: '6px' }} title="Upload CSV with columns: rollNo, marks">
                        <Upload size={14} />
                        Upload OMR CSV
                        <input 
                          type="file" 
                          accept=".csv" 
                          onChange={handleOMRUpload} 
                          style={{ display: 'none' }} 
                        />
                      </label>
                      <button type="submit" className="btn btn-success">
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
                          .filter(s => s.batch === tests.find(t => t.id === entryTestId)?.batch && s.status === 'active')
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
                                  max={tests.find(t => t.id === entryTestId)?.totalMarks}
                                  value={marksData[student.id] ?? ''}
                                  onChange={e => handleMarksChange(student.id, e.target.value)}
                                  style={{ padding: '6px 12px' }}
                                />
                              </td>
                              <td>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                  / {tests.find(t => t.id === entryTestId)?.totalMarks}
                                </span>
                                {marksData[student.id] !== '' && marksData[student.id] !== undefined && (
                                  <span style={{ marginLeft: '12px', fontSize: '0.8rem', fontWeight: '600' }} className={
                                    ((marksData[student.id] / tests.find(t => t.id === entryTestId)?.totalMarks) >= 0.85) ? 'text-success' :
                                    ((marksData[student.id] / tests.find(t => t.id === entryTestId)?.totalMarks) >= 0.60) ? 'text-warning' : 'text-danger'
                                  }>
                                    ({Math.round((marksData[student.id] / tests.find(t => t.id === entryTestId)?.totalMarks) * 100)}%)
                                  </span>
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
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTestResults.results.map((res) => {
                      const rankClass = getRankBadgeClass(res.rank);
                      const marksCategory = getMarksCategory(res.percentage);

                      return (
                        <tr key={res.id}>
                          <td>
                            <span className={`rank-badge ${rankClass}`}>
                              {res.rank}
                            </span>
                          </td>
                          <td>{res.rollNo}</td>
                          <td><strong>{res.studentName}</strong></td>
                          <td>{res.marks} / {res.totalMarks}</td>
                          <td>
                            <span className={`marks-pill ${marksCategory}`}>
                              {res.percentage}%
                            </span>
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
