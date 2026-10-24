import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, User, Phone, MapPin, Calendar, CheckCircle2, 
  AlertTriangle, BookOpen, Clock, Mail, LineChart, BarChart2,
  CreditCard, Printer, GraduationCap, Layers, Eye, ZoomIn, ZoomOut
} from 'lucide-react';
import { 
  LineChart as ReLineChart, Line, XAxis, YAxis, Tooltip, 
  ResponsiveContainer, CartesianGrid 
} from 'recharts';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { getAvatarClass, getInitials } from '../data/sampleData';
import { formatDate, formatTime, calcAttendancePercent, formatBatchName } from '../utils/helpers';
import { getMediaUrl } from '../utils/api';
import { useApp } from '../context/AppContext';
import StudentIdCard from './StudentIdCard';

export default function StudentProfileModal({ 
  student: initialStudent, 
  onClose, 
  attendance = [], 
  testResults = [], 
  tests = [], 
  smsHistory = [] 
}) {
  const { students, batches, regenerateParentCredentials } = useApp();
  const [regenPassword, setRegenPassword] = useState('');
  const [selectedOmrImage, setSelectedOmrImage] = useState(null);

  const student = useMemo(() => {
    return students.find((s) => s.id === initialStudent.id) || initialStudent;
  }, [students, initialStudent]);

  // Resolve Course and Class
  const resolvedCourse = useMemo(() => {
    return formatBatchName(student.batch || student.course || student.targetClass, batches);
  }, [student, batches]);

  const resolvedClass = useMemo(() => {
    if (student.class) return student.class;
    if (student.targetClass && (student.targetClass.toLowerCase().includes('11') || student.targetClass.toLowerCase().includes('12'))) {
      return student.targetClass;
    }
    const bStr = String(student.batch || '').toLowerCase();
    if (bStr.includes('11')) return '11th';
    if (bStr.includes('12')) return '12th';
    return student.targetClass || '12th';
  }, [student]);

  const handleRegenCreds = async () => {
    if (window.confirm('Are you sure you want to regenerate new parent portal credentials? The old password will stop working.')) {
      const res = await regenerateParentCredentials(initialStudent.id);
      if (res && res.parentPlainPassword) {
        setRegenPassword(res.parentPlainPassword);
      }
    }
  };

  const [activeTab, setActiveTab] = useState('overview');

  // Filter attendance records for this student
  const studentAttendance = useMemo(() => {
    return attendance
      .filter((a) => a.studentId === student.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [attendance, student.id]);

  // Filter test results for this student (chronological order for performance graph)
  const studentResults = useMemo(() => {
    return testResults
      .filter((r) => r.studentId === student.id)
      .map((r) => {
        const testDetails = tests.find((t) => t.id === r.testId);
        return {
          ...r,
          testName: testDetails ? testDetails.name : 'Unknown Test',
          subject: testDetails ? testDetails.subject : 'N/A',
          date: testDetails ? testDetails.date : 'N/A'
        };
      })
      .sort((a, b) => (a.date || '').localeCompare(b.date || '')); // chronological order for line chart
  }, [testResults, tests, student.id]);

  // Sort test results descending by date (most recent test first) for table display
  const sortedStudentResults = useMemo(() => {
    return [...studentResults].sort((a, b) => {
      const timeA = new Date(a.date).getTime() || 0;
      const timeB = new Date(b.date).getTime() || 0;
      if (timeA !== timeB) return timeB - timeA;
      return (b.date || '').localeCompare(a.date || '');
    });
  }, [studentResults]);

  // Filter SMS logs for this student
  const studentSMS = useMemo(() => {
    return smsHistory
      .filter((sms) => sms.studentId === student.id)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [smsHistory, student.id]);

  // Calculate statistics
  const attPercent = calcAttendancePercent(attendance, student.id);
  
  const avgTestScore = useMemo(() => {
    if (studentResults.length === 0) return 0;
    const total = studentResults.reduce((sum, r) => sum + r.percentage, 0);
    return Math.round((total / studentResults.length) * 10) / 10;
  }, [studentResults]);

  // Handle overlay click to close
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return createPortal(
    <AnimatePresence>
      <div className="modal-overlay" onClick={handleOverlayClick}>
        <motion.div
          className="modal-content modal-xl"
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.98 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
            {/* Header */}
            <div className="modal-header">
              <div className="flex items-center gap-16">
                {student.photo ? (
                  <img 
                    src={student.photo} 
                    alt={student.name} 
                    className="student-avatar" 
                    style={{ width: '52px', height: '52px', objectFit: 'cover', border: '1px solid var(--border-color)', borderRadius: '12px' }} 
                  />
                ) : (
                  <div className={`student-avatar av-1`} style={{ width: '52px', height: '52px', fontSize: '1.2rem', borderRadius: '12px' }}>
                    {getInitials(student.name)}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-8 flex-wrap">
                    <h3 style={{ fontSize: '1.4rem', margin: 0 }}>{student.name}</h3>
                    <span className="badge" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#fff', fontSize: '0.75rem', padding: '3px 9px', borderRadius: '6px', fontWeight: 600 }}>
                      {resolvedCourse}
                    </span>
                    <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', border: '1px solid rgba(139, 92, 246, 0.3)', fontSize: '0.75rem', padding: '3px 9px', borderRadius: '6px', fontWeight: 600 }}>
                      {resolvedClass}
                    </span>
                  </div>
                  <p className="card-subtitle" style={{ margin: '4px 0 0 0', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.85rem' }}>
                    <span>Roll No: <strong>{student.rollNo}</strong></span>
                    <span>•</span>
                    <span>ID: <strong>{student.id}</strong></span>
                    <span>•</span>
                    <span>Course: <strong style={{ color: '#38bdf8' }}>{resolvedCourse}</strong></span>
                    <span>•</span>
                    <span>Class: <strong style={{ color: '#c084fc' }}>{resolvedClass}</strong></span>
                  </p>
                </div>
              </div>
              <button className="modal-close" onClick={onClose}>
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div style={{ padding: '0 24px', marginTop: '12px' }}>
              <div className="tabs" style={{ marginBottom: 0 }}>
                <button
                  className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setActiveTab('overview')}
                >
                  <User size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                  Overview
                </button>
                <button
                  className={`tab ${activeTab === 'attendance' ? 'active' : ''}`}
                  onClick={() => setActiveTab('attendance')}
                >
                  <Clock size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                  Attendance ({attPercent}%)
                </button>
                <button
                  className={`tab ${activeTab === 'tests' ? 'active' : ''}`}
                  onClick={() => setActiveTab('tests')}
                >
                  <BookOpen size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                  Test Results ({studentResults.length})
                </button>
                <button
                  className={`tab ${activeTab === 'sms' ? 'active' : ''}`}
                  onClick={() => setActiveTab('sms')}
                >
                  <Mail size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                  SMS Logs ({studentSMS.length})
                </button>
                <button
                  className={`tab ${activeTab === 'idcard' ? 'active' : ''}`}
                  onClick={() => setActiveTab('idcard')}
                >
                  <CreditCard size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                  ID Card
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="modal-body" style={{ minHeight: '400px' }}>
              <AnimatePresence mode="wait">
                {activeTab === 'overview' && (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="grid-2"
                  >
                    {/* Left Details Card */}
                    <div className="card" style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                      {student.photo && (
                        <img 
                          src={student.photo} 
                          alt={student.name} 
                          style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'cover', border: '1px solid var(--border-color)', flexShrink: 0 }} 
                        />
                      )}
                      <div className="flex-1">
                        <h4 className="mb-16" style={{ marginTop: 0 }}>Personal & Contact Info</h4>
                      <div className="flex flex-col gap-12" style={{ fontSize: '0.9rem' }}>
                        <div className="flex items-center gap-12 text-secondary">
                          <GraduationCap size={16} className="text-accent" />
                          <div>
                            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', display: 'block' }}>Course / Batch</span>
                            <strong style={{ color: '#38bdf8' }}>{resolvedCourse}</strong>
                          </div>
                        </div>
                        <div className="flex items-center gap-12 text-secondary">
                          <Layers size={16} className="text-accent" />
                          <div>
                            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', display: 'block' }}>Class / Standard</span>
                            <strong style={{ color: '#c084fc' }}>{resolvedClass}</strong>
                          </div>
                        </div>
                        <div className="flex items-center gap-12 text-secondary">
                          <User size={16} className="text-accent" />
                          <div>
                            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', display: 'block' }}>Parent Name</span>
                            <strong>{student.parentName || 'N/A'}</strong>
                          </div>
                        </div>
                        <div className="flex items-center gap-12 text-secondary">
                          <Phone size={16} className="text-accent" />
                          <div>
                            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', display: 'block' }}>Parent Mobile</span>
                            <strong>+91 {student.parentPhone}</strong>
                            {student.parentPhone2 && (
                              <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                +91 {student.parentPhone2} (Alt)
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-12 text-secondary">
                          <Calendar size={16} className="text-accent" />
                          <div>
                            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', display: 'block' }}>Join Date</span>
                            <strong>{formatDate(student.joinDate)}</strong>
                          </div>
                        </div>
                        <div className="flex items-center gap-12 text-secondary">
                          <BookOpen size={16} className="text-accent" />
                          <div>
                            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', display: 'block' }}>School Name</span>
                            <strong>{student.schoolName || 'Not specified'}</strong>
                          </div>
                        </div>
                        <div className="flex items-center gap-12 text-secondary">
                          <MapPin size={16} className="text-accent" />
                          <div>
                            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', display: 'block' }}>Residential Address</span>
                            <strong>{student.address || 'No address logged'}</strong>
                          </div>
                        </div>

                        {/* Parent Portal Mobile App Credentials */}
                        <div className="border-glass pt-12 mt-12" style={{ borderTop: '1px dashed var(--border-color-light)' }}>
                          <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>PARENT MOBILE APP CREDENTIALS</span>
                          <div className="flex justify-between items-center flex-wrap gap-8" style={{ fontSize: '0.85rem' }}>
                            <div>
                              <div>
                                <span style={{ color: 'var(--text-tertiary)' }}>User ID:</span>{' '}
                                <strong style={{ color: 'var(--text-primary)' }}>{student.parentUserId || 'None'}</strong>
                              </div>
                              <div style={{ marginTop: '4px' }}>
                                <span style={{ color: 'var(--text-tertiary)' }}>Password:</span>{' '}
                                <strong style={{ color: 'var(--text-primary)' }}>{student.parentPasswordPlain || 'Not Set (Click Regenerate)'}</strong>
                              </div>
                            </div>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={handleRegenCreds}
                              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            >
                              Regenerate Password
                            </button>
                          </div>
                          {regenPassword && (
                            <div className="mt-8" style={{ padding: '8px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                              <p style={{ margin: '0 0 4px 0', color: 'var(--accent-blue-light)' }}><strong>New Credentials Generated:</strong></p>
                              <div>User ID: <strong>{student.parentUserId}</strong></div>
                              <div>Password: <strong>{regenPassword}</strong></div>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block', marginTop: '4px' }}>Save these! The password will not be displayed again.</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                    {/* Right Stats Card */}
                    <div className="card flex flex-col justify-between">
                      <div>
                        <h4 className="mb-16">Academic Stats</h4>
                        <div className="grid-2 mb-16">
                          <div className="stat-card blue" style={{ padding: '12px' }}>
                            <div className="stat-card-value" style={{ fontSize: '1.4rem' }}>{attPercent}%</div>
                            <div className="stat-card-label" style={{ fontSize: '0.75rem' }}>Attendance Rate</div>
                          </div>
                          <div className="stat-card purple" style={{ padding: '12px' }}>
                            <div className="stat-card-value" style={{ fontSize: '1.4rem' }}>{avgTestScore}%</div>
                            <div className="stat-card-label" style={{ fontSize: '0.75rem' }}>Average Score</div>
                          </div>
                        </div>
                      </div>

                      <div className="border-glass pt-12" style={{ borderTop: '1px solid var(--border-color-light)', fontSize: '0.85rem' }}>
                        <div className="flex justify-between mb-8">
                          <span className="text-secondary">Course / Batch:</span>
                          <strong style={{ color: '#38bdf8' }}>{resolvedCourse}</strong>
                        </div>
                        <div className="flex justify-between mb-8">
                          <span className="text-secondary">Class / Standard:</span>
                          <strong style={{ color: '#c084fc' }}>{resolvedClass}</strong>
                        </div>
                        <div className="flex justify-between mb-8">
                          <span className="text-secondary">Tests Attempted:</span>
                          <strong>{studentResults.length} exams</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-secondary">Enrollment Status:</span>
                          <span className={`badge ${student.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                            {student.status || 'ACTIVE'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'attendance' && (
                  <motion.div
                    key="attendance"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                  >
                    <div className="table-container">
                      {studentAttendance.length > 0 ? (
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Status</th>
                              <th>Entry Time</th>
                              <th>Exit Time</th>
                              <th>SMS Notification</th>
                            </tr>
                          </thead>
                          <tbody>
                            {studentAttendance.map((rec) => (
                              <tr key={rec.id}>
                                <td>{formatDate(rec.date)}</td>
                                <td>
                                  <span className={`badge ${
                                    rec.status === 'present' ? 'badge-present' : 
                                    rec.status === 'late' ? 'badge-late' : 'badge-absent'
                                  }`}>
                                    {rec.status}
                                  </span>
                                </td>
                                <td>{formatTime(rec.entryTime)}</td>
                                <td>{formatTime(rec.exitTime)}</td>
                                <td>
                                  <span className={`badge ${rec.smsSent ? 'badge-success' : 'badge-danger'}`}>
                                    {rec.smsSent ? 'Sent' : 'Failed/No SMS'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="empty-state">
                          <div className="empty-state-icon"><Clock size={28} /></div>
                          <h3>No Attendance Records</h3>
                          <p>No entry or exit logs recorded for this student yet.</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'tests' && (
                  <motion.div
                    key="tests"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                  >
                    {studentResults.length > 1 && (
                      <div className="card mb-16" style={{ padding: '16px' }}>
                        <h4 className="mb-12 flex items-center gap-8" style={{ fontSize: '0.95rem' }}>
                          <LineChart size={16} className="text-accent" />
                          Performance Trend Graph
                        </h4>
                        <ResponsiveContainer width="100%" height={160}>
                          <ReLineChart data={studentResults} margin={{ left: -20, right: 10, top: 5, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(37,99,235,0.08)" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(d) => d.slice(5)} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
                            <Tooltip formatter={(v) => [`${v}%`, 'Percentage']} />
                            <Line type="monotone" dataKey="percentage" stroke="var(--accent-blue-light)" strokeWidth={2.5} dot={{ r: 4 }} />
                          </ReLineChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    <div className="table-container">
                      {sortedStudentResults.length > 0 ? (
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Test Name</th>
                              <th>Subject</th>
                              <th>Score</th>
                              <th>Percentage</th>
                              <th>Rank</th>
                              <th>OMR Sheet</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedStudentResults.map((res) => (
                              <tr key={res.id || res._id}>
                                <td>{formatDate(res.date)}</td>
                                <td><strong>{res.testName}</strong></td>
                                <td>
                                  <span className="badge badge-info">{res.subject}</span>
                                </td>
                                <td>{res.marks} / {res.totalMarks}</td>
                                <td>
                                  <span className={`marks-pill ${
                                    res.percentage >= 85 ? 'high' : res.percentage >= 60 ? 'medium' : 'low'
                                  }`}>
                                    {res.percentage}%
                                  </span>
                                </td>
                                <td>
                                  <strong>{res.rank}</strong> <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>/ {res.totalStudents}</span>
                                </td>
                                <td>
                                  {res.omrSheetImage ? (
                                    <button 
                                      type="button"
                                      onClick={() => setSelectedOmrImage({
                                        url: getMediaUrl(res.omrSheetImage),
                                        filename: res.omrOriginalFilename || res.filename || (res.omrSheetImage ? res.omrSheetImage.split('/').pop().split('?')[0] : 'Scanned_OMR.jpg'),
                                        rollNo: student.rollNo,
                                        studentName: student.name,
                                        testName: res.testName,
                                        date: res.date
                                      })}
                                      className="btn btn-ghost btn-xs text-accent flex items-center gap-1"
                                      style={{ padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '6px' }}
                                      title="View Scanned OMR Sheet"
                                    >
                                      <Eye size={13} />
                                      <span>View OMR</span>
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>N/A</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="empty-state">
                          <div className="empty-state-icon"><BookOpen size={28} /></div>
                          <h3>No Exam Data</h3>
                          <p>This student has not participated in any graded tests yet.</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'sms' && (
                  <motion.div
                    key="sms"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                  >
                    <div className="table-container">
                      {studentSMS.length > 0 ? (
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Timestamp</th>
                              <th>Type</th>
                              <th>Message</th>
                              <th>Parent Mobile</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {studentSMS.map((sms) => (
                              <tr key={sms.id}>
                                <td style={{ fontSize: '0.78rem' }}>{formatDate(sms.timestamp.split('T')[0])} {formatTime(sms.timestamp.split('T')[1]?.slice(0,5))}</td>
                                <td>
                                  <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                                    {sms.type.toUpperCase()}
                                  </span>
                                </td>
                                <td style={{ fontSize: '0.8rem', maxWidth: '300px', whiteSpace: 'normal', lineHeight: '1.4' }}>
                                  {sms.message}
                                </td>
                                <td>{sms.parentPhone}</td>
                                <td>
                                  <span className={`sms-status ${sms.status}`}>
                                    {sms.status.toUpperCase()}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="empty-state">
                          <div className="empty-state-icon"><Mail size={28} /></div>
                          <h3>No Message Logs</h3>
                          <p>No SMS notifications sent to this student's parents yet.</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
                {activeTab === 'idcard' && (
                  <motion.div
                    key="idcard"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '20px' }}
                  >
                    <div className="print-id-container" style={{ display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      {/* FRONT SIDE */}
                      <div>
                        <div className="no-print" style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px', textAlign: 'center' }}>
                          🪪 FRONT SIDE
                        </div>
                        <StudentIdCard student={student} side="front" batches={batches} />
                      </div>

                      {/* BACK SIDE */}
                      <div>
                        <div className="no-print" style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px', textAlign: 'center' }}>
                          📜 BACK SIDE (Terms &amp; Conditions)
                        </div>
                        <StudentIdCard student={student} side="back" batches={batches} />
                      </div>
                    </div>
                    
                    <button 
                      className="btn btn-primary no-print" 
                      onClick={() => window.print()}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}
                    >
                      <Printer size={16} /> Print Both Sides (Front &amp; Back)
                    </button>

                    <style>{`
                      @media print {
                        body * {
                          visibility: hidden !important;
                        }
                        .print-id-container, .print-id-container * {
                          visibility: visible !important;
                        }
                        .print-id-container {
                          position: fixed !important;
                          left: 0 !important;
                          top: 0 !important;
                          width: 100% !important;
                          margin: 0 !important;
                          padding: 20px !important;
                          display: flex !important;
                          justify-content: center !important;
                          align-items: flex-start !important;
                          gap: 30px !important;
                          background: #ffffff !important;
                          box-shadow: none !important;
                        }
                      }
                    `}</style>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={onClose}>
                Close Profile
              </button>
            </div>
          </motion.div>
      </div>

      {/* Interactive OMR Viewer Modal */}
      {selectedOmrImage && (
        <div 
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(8px)', zIndex: 999999, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: '16px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedOmrImage(null);
          }}
        >
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
              const omrTestName = typeof selectedOmrImage === 'object' && selectedOmrImage !== null ? selectedOmrImage.testName : '';

              return (
                <div 
                  style={{ 
                    background: 'var(--bg-primary, #ffffff)', 
                    borderRadius: '18px', 
                    padding: '18px', 
                    maxWidth: '900px', 
                    width: '90vw', 
                    textAlign: 'center', 
                    border: '1px solid var(--border-color, #e2e8f0)', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    maxHeight: '90vh',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', minWidth: 0, flex: 1, paddingRight: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '100%' }}>
                        <span style={{ fontSize: '1.1rem' }}>📄</span>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {omrFilename || (omrTestName ? `${omrTestName} - OMR` : 'Scanned OMR Sheet')}
                        </h4>
                      </div>
                      {(omrRollNo || omrStudentName || omrTestName) && (
                        <p style={{ margin: '2px 0 0 24px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {omrRollNo ? <>Roll No: <strong style={{ color: 'var(--text-primary)' }}>{omrRollNo}</strong></> : null}
                          {omrStudentName ? <span style={{ marginLeft: '8px' }}>| Student: <strong>{omrStudentName}</strong></span> : null}
                          {omrTestName ? <span style={{ marginLeft: '8px' }}>| Test: <strong>{omrTestName}</strong></span> : null}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => zoomOut()} title="Zoom Out"><ZoomOut size={16} /></button>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, minWidth: '40px' }}>{Math.round(state.scale * 100)}%</span>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => zoomIn()} title="Zoom In"><ZoomIn size={16} /></button>
                      <button type="button" className="btn btn-sm btn-ghost" style={{ marginLeft: '4px' }} onClick={() => resetTransform()} title="Reset Zoom">Reset</button>
                      <button 
                        type="button" 
                        className="modal-close" 
                        style={{ marginLeft: '8px' }} 
                        onClick={() => setSelectedOmrImage(null)}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                  
                  <div style={{ flex: 1, minHeight: '350px', overflow: 'hidden', borderRadius: '10px', background: '#0b0f19', border: '1px solid var(--border-color, #334155)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab' }}>
                    <TransformComponent wrapperStyle={{ width: '100%', height: '100%', maxHeight: '68vh' }} contentStyle={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <img 
                        src={omrUrl} 
                        alt="OMR Sheet" 
                        style={{ maxWidth: '100%', maxHeight: '68vh', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                        draggable={false}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          if (e.target.parentElement) {
                            e.target.parentElement.innerHTML = `
                              <div style="padding: 40px 20px; text-align: center; color: #94a3b8;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 12px;">
                                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                  <polyline points="21 15 16 10 5 21"></polyline>
                                </svg>
                                <p style="font-weight: 600; font-size: 1rem; margin: 0 0 6px; color: #f1f5f9;">OMR Sheet Unavailable</p>
                                <p style="font-size: 0.85rem; margin: 0; color: #94a3b8;">The image could not be loaded from storage.<br/>Please verify server connection or re-scan.</p>
                              </div>`;
                          }
                        }}
                      />
                    </TransformComponent>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                    {omrUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.electronAPI?.openExternal) {
                            window.electronAPI.openExternal(omrUrl);
                          } else {
                            window.open(omrUrl, '_blank');
                          }
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ flex: 1 }}
                      >
                        Open Full Image
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedOmrImage(null)}
                      className="btn btn-primary btn-sm"
                      style={{ flex: 2 }}
                    >
                      Close Preview
                    </button>
                  </div>
                </div>
              );
            }}
          </TransformWrapper>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
