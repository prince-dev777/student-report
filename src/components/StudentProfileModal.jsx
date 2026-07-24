import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, User, Phone, MapPin, Calendar, CheckCircle2, 
  AlertTriangle, BookOpen, Clock, Mail, LineChart, BarChart2 
} from 'lucide-react';
import { 
  LineChart as ReLineChart, Line, XAxis, YAxis, Tooltip, 
  ResponsiveContainer, CartesianGrid 
} from 'recharts';
import { getAvatarClass, getInitials } from '../data/sampleData';
import { formatDate, formatTime, calcAttendancePercent } from '../utils/helpers';
import { useApp } from '../context/AppContext';

export default function StudentProfileModal({ student: initialStudent, onClose, attendance, testResults, tests, smsHistory }) {
  const { students, regenerateParentCredentials } = useApp();
  const [regenPassword, setRegenPassword] = useState('');

  const student = useMemo(() => {
    return students.find((s) => s.id === initialStudent.id) || initialStudent;
  }, [students, initialStudent]);

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

  // Filter test results for this student
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
      .sort((a, b) => a.date.localeCompare(b.date)); // chronological order for line chart
  }, [testResults, tests, student.id]);

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
                    style={{ width: '48px', height: '48px', objectFit: 'cover', border: '1px solid var(--border-color)' }} 
                  />
                ) : (
                  <div className={`student-avatar av-1`} style={{ width: '48px', height: '48px', fontSize: '1.2rem' }}>
                    {getInitials(student.name)}
                  </div>
                )}
                <div>
                  <h3 style={{ fontSize: '1.4rem', margin: 0 }}>{student.name}</h3>
                  <p className="card-subtitle" style={{ margin: 0 }}>
                    Roll No: <strong>{student.rollNo}</strong> | ID: <strong>{student.id}</strong>
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
                        <div className="flex justify-between mb-4">
                          <span className="text-secondary">Tests Attempted:</span>
                          <strong>{studentResults.length} exams</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-secondary">Enrollment Status:</span>
                          <span className={`badge ${student.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                            {student.status}
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
                      {studentResults.length > 0 ? (
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
                            {studentResults.map((res) => (
                              <tr key={res.id}>
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
    </AnimatePresence>,
    document.body
  );
}
