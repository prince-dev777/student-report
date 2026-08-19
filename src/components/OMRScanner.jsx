import React, { useState, useEffect } from 'react';
import { UploadCloud, CheckCircle, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { api } from '../utils/api';
import { calculateRanks, generateId } from '../utils/helpers';

export default function OMRScanner() {
  const [tests, setTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [status, setStatus] = useState('idle'); // idle, uploading, success, error
  const [errorMsg, setErrorMsg] = useState('');
  const [draftResults, setDraftResults] = useState([]);
  const [omrTemplate, setOmrTemplate] = useState('neet_180');
  const [detectQuestions, setDetectQuestions] = useState(180);

  const [students, setStudents] = useState([]);

  useEffect(() => {
    fetchTests();
    fetchStudents();
  }, []);

  const fetchTests = async () => {
    try {
      const data = await api.getTests();
      setTests(data);
    } catch (err) {
      console.error('Failed to load tests', err);
    }
  };

  const fetchStudents = async () => {
    try {
      const data = await api.getStudents();
      setStudents(data);
    } catch (err) {
      console.error('Failed to load students', err);
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    // Filter to ensure only images are uploaded
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      setErrorMsg('Please select valid image files (.jpg, .png)');
      setStatus('error');
      return;
    }

    if (imageFiles.length > 500) {
      setErrorMsg('Maximum 500 images can be processed at once.');
      setStatus('error');
      return;
    }

    setSelectedFiles(imageFiles);
    setStatus('idle');
  };

  const handleUpload = async () => {
    if (!selectedTest || selectedFiles.length === 0) return;
    setStatus('uploading');
    
    const test = tests.find(t => t.id === selectedTest);
    
    const formData = new FormData();
    formData.append('testId', selectedTest);
    formData.append('templateId', omrTemplate);
    formData.append('questionsToDetect', detectQuestions);
    formData.append('testData', JSON.stringify({
      marksPerQuestion: test?.marksPerQuestion || 1,
      negativeMarking: test?.negativeMarking || 0,
      answer_keys: test?.answerKey || {},
      template_config: test?.templateConfig
    }));
    
    selectedFiles.forEach(file => {
      formData.append('images', file);
    });
    
    try {
      const res = await api.uploadOMRImages(formData);
      setStatus('success');
      setSelectedFiles([]);
      
      const rawResults = res.results || [];
      const mappedResults = [];
      const localErrors = res.errors || [];
      
      for (const r of rawResults) {
        const rollRaw = String(r.rollNo || '').trim();
        const rollClean = rollRaw.replace(/^\?+|\?+$/g, '').trim();
        const rollDigits = rollRaw.replace(/[^0-9]/g, '');
        
        const student = students.find(s => {
          const sRoll = String(s.rollNo || '').trim();
          if (sRoll === rollRaw || sRoll === rollClean) return true;
          if (rollDigits && sRoll === rollDigits) return true;
          if (!isNaN(sRoll) && !isNaN(rollClean) && rollClean !== '') {
            return Number(sRoll) === Number(rollClean);
          }
          return false;
        });
        if (student) {
          mappedResults.push({
            studentId: student.id,
            mongoStudentId: student._id,
            studentName: student.name,
            rollNo: rollClean || r.rollNo,
            marks: r.marks,
            correctCount: r.correctCount,
            wrongCount: r.wrongCount,
            studentAnswers: r.studentAnswers,
            omrSheetImage: r.omrSheetImage
          });
        } else {
          localErrors.push({ error: 'Student not found in database', rollNumber: r.rollNo });
        }
      }
      
      setDraftResults(mappedResults);
      if (localErrors.length > 0) {
        console.warn('OMR Mapping Errors:', localErrors);
        setErrorMsg(`Success! Matched ${mappedResults.length} students, but failed to match ${localErrors.length} roll numbers.`);
      } else {
        setErrorMsg(`Success! Scanned ${selectedFiles.length} images and matched ${mappedResults.length} students.`);
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Failed to process OMR images. Is the local engine running?');
    }
  };

  const handlePublish = async () => {
    try {
      const test = tests.find((item) => item.id === selectedTest);
      if (!test || draftResults.length === 0) return;

      setStatus('uploading');
      const ranked = calculateRanks(draftResults.map((result) => ({
        studentId: result.studentId,
        marks: Number(result.marks),
        studentAnswers: result.studentAnswers || []
      })));
      const totalStudents = ranked.length;
      const payload = ranked.map((result) => ({
        id: generateId('RES'),
        testId: test.id,
        studentId: result.studentId,
        marks: result.marks,
        totalMarks: test.totalMarks,
        percentage: Math.round((result.marks / test.totalMarks) * 1000) / 10,
        rank: result.rank,
        totalStudents,
        smsSent: true,
        status: 'Published',
        studentAnswers: result.studentAnswers
      }));

      await api.saveTestResultsBulk(payload);
      setStatus('success');
      setErrorMsg('Successfully published results and notified parents!');
      setDraftResults([]);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message || 'Failed to publish results');
    }
  };

  return (
    <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="card-header mb-16">
        <h3 className="card-title">AI OMR Scanner</h3>
        <p className="card-subtitle">Upload photos of OMR sheets. Our AI will grade them automatically.</p>
      </div>
        <div className="form-group">
          <label className="form-label">Select Test</label>
          <select 
            className="form-select" 
            value={selectedTest} 
            onChange={(e) => {
              const testId = e.target.value;
              setSelectedTest(testId);
              setDraftResults([]);
              setSelectedFiles([]);
              setStatus('idle');
              setErrorMsg('');
              
              const test = tests.find(t => t.id === testId);
              if (test) {
                if (test.templateId) {
                  setOmrTemplate(test.templateId);
                }
                if (test.questionsToDetect) {
                  setDetectQuestions(test.questionsToDetect);
                }
              }
            }}
          >
            <option value="">-- Choose a test --</option>
            {tests.map(test => (
              <option key={test.id} value={test.id}>
                {test.name} - {test.subject} - {new Date(test.date).toLocaleDateString()} (Total: {test.totalMarks})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ marginTop: '20px' }}>
          <label className="form-label">Select OMR Template</label>
          <select 
            className="form-select" 
            value={omrTemplate} 
            onChange={(e) => {
              const tempId = e.target.value;
              setOmrTemplate(tempId);
              let defaultDetect = 180;
              if (tempId === 'neet_90') defaultDetect = 90;
              else if (tempId === 'jee_75' || tempId === 'jee_75_with_numerical') defaultDetect = 75;
              else if (tempId === 'omr_50') defaultDetect = 50;
              else if (tempId === 'mhcet_200' || tempId === 'mhcet_200_bio') defaultDetect = 200;
              setDetectQuestions(defaultDetect);
            }}
          >
            <option value="neet_180">NEET 180 (Physics, Chemistry, Biology)</option>
            <option value="neet_90">NEET 90 (Biology)</option>
            <option value="jee_75">JEE 75 (MCQ Only)</option>
            <option value="jee_75_with_numerical">JEE 75 (MCQ + Numerical)</option>
            <option value="omr_50">50-Question OMR (Universal)</option>
            <option value="mhcet_200">MHCET 200 (PCB/PCM)</option>
            <option value="mhcet_200_bio">MHCET 200 (Biology Only)</option>
          </select>
        </div>

        <div className="form-group" style={{ marginTop: '20px' }}>
          <label className="form-label">Questions to Detect</label>
          {omrTemplate === 'omr_50' ? (
            <select
              className="form-select"
              value={detectQuestions}
              onChange={(e) => setDetectQuestions(Number(e.target.value))}
            >
              <option value={25}>25</option>
              <option value={45}>45</option>
              <option value={50}>50</option>
            </select>
          ) : (
            <input
              type="number"
              className="form-input"
              value={detectQuestions}
              onChange={(e) => setDetectQuestions(Number(e.target.value))}
              min="1"
              max={
                omrTemplate === 'mhcet_200' ? 200 :
                omrTemplate === 'neet_180' ? 180 :
                omrTemplate === 'neet_90' ? 90 :
                (omrTemplate === 'jee_75' || omrTemplate === 'jee_75_with_numerical') ? 75 : 50
              }
            />
          )}
        </div>

        <div className="form-group" style={{ marginTop: '20px' }}>
          <label className="form-label">Upload OMR Images (.jpg, .png)</label>
          
          <div 
            style={{
              border: '2px dashed var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '40px 20px',
              textAlign: 'center',
              background: 'var(--bg-tertiary)',
              cursor: 'pointer',
              position: 'relative'
            }}
          >
            <input 
              type="file" 
              accept="image/jpeg, image/png"
              multiple
              onChange={handleFileUpload}
              style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '100%',
                opacity: 0, cursor: 'pointer'
              }}
            />
            {selectedFiles.length > 0 ? (
              <div>
                <ImageIcon size={48} color="var(--accent-blue)" style={{ margin: '0 auto 12px' }} />
                <h4>Images Selected</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {selectedFiles.length} images ready to be scanned and processed.
                </p>
              </div>
            ) : (
              <div>
                <UploadCloud size={48} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
                <h4>Drag & Drop Folder or Click to Browse</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Upload a folder containing up to 500 scanned OMR images at once.
                </p>
              </div>
            )}
          </div>
        </div>

        {status === 'success' && (
          <div style={{ padding: '12px', background: 'rgba(5, 150, 105, 0.1)', color: 'var(--accent-green)', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={18} />
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{errorMsg}</span>
          </div>
        )}

        {status === 'error' && (
          <div style={{ padding: '12px', background: 'rgba(220, 38, 38, 0.1)', color: 'var(--accent-red)', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{errorMsg}</span>
          </div>
        )}

        {status === 'uploading' && (
          <div style={{ padding: '20px', textAlign: 'center', marginBottom: '16px' }}>
             <div className="btn-spinner" style={{ borderColor: 'var(--accent-blue)', borderRightColor: 'transparent', width: '30px', height: '30px', margin: '0 auto 10px' }}></div>
             <p style={{ color: 'var(--accent-blue)', fontWeight: 500, margin: 0 }}>Scanning Images using Python OpenCV...</p>
          </div>
        )}

        <button 
          className="btn btn-primary" 
          style={{ width: '100%', marginBottom: '20px' }}
          disabled={!selectedTest || selectedFiles.length === 0 || status === 'uploading'}
          onClick={handleUpload}
        >
          {status === 'uploading' && draftResults.length === 0 ? 'Processing in Background...' : 'Scan & Save as Draft'}
        </button>

        {draftResults.length > 0 && (
          <div style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ marginBottom: '12px' }}>Draft Results Review</h4>
            <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Roll No (approx)</th>
                    <th>Marks</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {draftResults.map((r, i) => (
                    <tr key={i}>
                      <td>{r.rollNo || r.studentId}</td>
                      <td>{r.marks}</td>
                      <td><span className="badge badge-warning">{r.studentName || 'Matched'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: '12px' }}>
              Review the scanned marks above. If everything looks good, click Publish to save ranks and notify parents.
            </p>
            <button 
              className="btn btn-success" 
              style={{ width: '100%', marginTop: '12px' }}
              onClick={handlePublish}
              disabled={status === 'uploading'}
            >
              {status === 'uploading' ? 'Publishing...' : 'Publish Results & Notify Parents'}
            </button>
          </div>
        )}
    </div>
  );
}
