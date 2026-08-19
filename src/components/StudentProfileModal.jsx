import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, User, Phone, MapPin, Calendar, CheckCircle2, 
  AlertTriangle, BookOpen, Clock, Mail, LineChart, BarChart2,
  CreditCard, Printer
} from 'lucide-react';
import { 
  LineChart as ReLineChart, Line, XAxis, YAxis, Tooltip, 
  ResponsiveContainer, CartesianGrid 
} from 'recharts';
import { getAvatarClass, getInitials } from '../data/sampleData';
import { formatDate, formatTime, calcAttendancePercent } from '../utils/helpers';
import { useApp } from '../context/AppContext';
import { QRCodeSVG } from 'qrcode.react';
import idLogo from '../assets/id-logo.png';

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
                        <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px', textAlign: 'center' }}>
                          🪪 FRONT SIDE
                        </div>
                        <div className="print-id-card" style={{ 
                          width: '240px', 
                          height: '380px', 
                          boxSizing: 'border-box',
                          background: 'linear-gradient(135deg, #f0f7ff 0%, #dbeafe 100%)', 
                          borderRadius: '12px', 
                          boxShadow: '0 8px 24px rgba(0,0,0,0.15)', 
                          overflow: 'hidden', 
                          display: 'flex', 
                          flexDirection: 'column',
                          border: '1px solid #bfdbfe',
                          position: 'relative',
                          fontFamily: "'Montserrat', sans-serif"
                        }}>
                          <div style={{ boxSizing: 'border-box', height: '100px', width: 'calc(100% - 8px)', margin: '4px auto 0', overflow: 'hidden', background: '#fff', border: '1.5px solid #3b82f6', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <img src={idLogo} alt="Career Xone" style={{ width: '92%', height: '88%', objectFit: 'contain' }} />
                          </div>
                          
                          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '-45px', zIndex: 2 }}>
                            {student.photo ? (
                              <img src={student.photo} alt={student.name} style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', border: '3px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
                            ) : (
                              <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', fontSize: '2rem', color: 'var(--text-tertiary)', fontWeight: 'bold' }}>
                                {getInitials(student.name)}
                              </div>
                            )}
                          </div>
                          
                          <div style={{ padding: '8px 14px 10px', textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                              <h3 style={{ margin: '0 0 2px 0', fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: '700' }}>{student.name}</h3>
                              <p style={{ margin: '0 0 8px 0', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Course: {batches?.find(b => b.id === student.batch)?.name || student.batch || 'N/A'}</p>
                              
                              <div style={{ textAlign: 'left', fontSize: '0.72rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                                <div style={{ display: 'flex' }}><strong style={{ width: '56px' }}>Roll No:</strong> <span>{student.rollNo}</span></div>
                                <div style={{ display: 'flex' }}><strong style={{ width: '56px' }}>Parent:</strong> <span>{student.parentName || 'N/A'}</span></div>
                                <div style={{ display: 'flex' }}><strong style={{ width: '56px' }}>Contact:</strong> <span>{student.parentPhone}</span></div>
                                <div style={{ display: 'flex', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><strong style={{ width: '56px' }}>Address:</strong> <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{student.address || 'N/A'}</span></div>
                              </div>
                            </div>
                            
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '8px', padding: '0 4px' }}>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ width: '48px', height: '18px', borderBottom: '1px solid var(--border-color)', marginBottom: '2px' }}></div>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <QRCodeSVG value={String(student.rollNo || '')} size={48} level="M" />
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ width: '48px', height: '18px', borderBottom: '1px solid var(--border-color)', marginBottom: '2px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                                  <img src="/principal-sign.png" alt="Principal" style={{ maxHeight: '18px', maxWidth: '48px', display: 'none' }} onError={(e) => e.target.style.display = 'none'} onLoad={(e) => { e.target.style.display = 'block'; e.target.parentElement.style.borderBottom = 'none'; }} />
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div style={{ background: '#3b82f6', padding: '6px', textAlign: 'center', fontSize: '0.66rem', color: '#fff', fontWeight: '700', letterSpacing: '0.5px' }}>
                            STUDENT ID: {student.id}
                          </div>
                        </div>
                      </div>

                      {/* BACK SIDE */}
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px', textAlign: 'center' }}>
                          📜 BACK SIDE (Terms & Conditions)
                        </div>
                        <div className="print-id-card" style={{ 
                          width: '240px', 
                          height: '380px', 
                          boxSizing: 'border-box',
                          background: '#ffffff', 
                          borderRadius: '12px', 
                          boxShadow: '0 8px 24px rgba(0,0,0,0.15)', 
                          overflow: 'hidden', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          justifyContent: 'space-between',
                          border: '1px solid #bfdbfe',
                          position: 'relative',
                          fontFamily: "'Montserrat', sans-serif"
                        }}>
                          {/* Header */}
                          <div style={{ background: 'linear-gradient(135deg, #1e3a8a, #2563eb)', padding: '6px 8px', textAlign: 'center', color: '#fff' }}>
                            <h4 style={{ margin: 0, fontSize: '0.76rem', fontWeight: 800, letterSpacing: '0.5px' }}>Terms & Conditions</h4>
                            <span style={{ fontSize: '0.50rem', opacity: 0.9 }}>Career Xone Rules & Regulations</span>
                          </div>

                          {/* Rules Body */}
                          <div style={{ padding: '6px 8px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <ul style={{ 
                              margin: 0, 
                              paddingLeft: 0, 
                              listStyle: 'none', 
                              fontSize: '0.49rem', 
                              color: '#1e293b', 
                              lineHeight: '1.24', 
                              display: 'flex', 
                              flexDirection: 'column', 
                              gap: '3px', 
                              textAlign: 'left' 
                            }}>
                              <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                <span style={{ color: '#2563eb', fontSize: '0.45rem', marginTop: '1px' }}>◆</span>
                                <span>Student should carry the ID card and produce it on demand.</span>
                              </li>
                              <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                <span style={{ color: '#2563eb', fontSize: '0.45rem', marginTop: '1px' }}>◆</span>
                                <span>Be ensured to update the Entry card before the Expiry date.</span>
                              </li>
                              <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                <span style={{ color: '#2563eb', fontSize: '0.45rem', marginTop: '1px' }}>◆</span>
                                <span>Reach class before time; parent's permission needed to leave early.</span>
                              </li>
                              <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                <span style={{ color: '#2563eb', fontSize: '0.45rem', marginTop: '1px' }}>◆</span>
                                <span>All students should wear proper uniform with shoes.</span>
                              </li>
                              <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                <span style={{ color: '#2563eb', fontSize: '0.45rem', marginTop: '1px' }}>◆</span>
                                <span>Student should maintain decency and decorum of institute.</span>
                              </li>
                              <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                <span style={{ color: '#2563eb', fontSize: '0.45rem', marginTop: '1px' }}>◆</span>
                                <span>Student found guilty of any misbehaviour will be rusticated.</span>
                              </li>
                              <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                <span style={{ color: '#2563eb', fontSize: '0.45rem', marginTop: '1px' }}>◆</span>
                                <span>Use or carry of Mobile Phone is strictly prohibited inside campus.</span>
                              </li>
                              <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                <span style={{ color: '#2563eb', fontSize: '0.45rem', marginTop: '1px' }}>◆</span>
                                <span>To issue a New ID Card in case of Lost/Damage ₹200/- will be charged.</span>
                              </li>
                              <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                <span style={{ color: '#2563eb', fontSize: '0.45rem', marginTop: '1px' }}>◆</span>
                                <span>If found outside premises, please deposit at Reception Counter.</span>
                              </li>
                              <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                <span style={{ color: '#2563eb', fontSize: '0.45rem', marginTop: '1px' }}>◆</span>
                                <span>Unhealthy culture affecting academic reputation will be strictly dealt with.</span>
                              </li>
                              <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                <span style={{ color: '#2563eb', fontSize: '0.45rem', marginTop: '1px' }}>◆</span>
                                <span>All immoral, antisocial, communal activities of student are prohibited.</span>
                              </li>
                              <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
                                <span style={{ color: '#2563eb', fontSize: '0.45rem', marginTop: '1px' }}>◆</span>
                                <span>To change Course / Batch allotted at admission charges will apply.</span>
                              </li>
                            </ul>

                            {/* Emergency & Address Box */}
                            <div style={{ 
                              background: '#f0f9ff', 
                              border: '1px solid #bae6fd', 
                              borderRadius: '6px', 
                              padding: '3px 6px', 
                              fontSize: '0.48rem', 
                              color: '#0369a1', 
                              textAlign: 'center', 
                              lineHeight: '1.2',
                              marginTop: '2px'
                            }}>
                              <strong>Reception:</strong> 9673383561 / 9145481323 | Gondia (MH)
                            </div>
                          </div>

                          {/* Footer */}
                          <div style={{ background: '#1e3a8a', padding: '4px', textAlign: 'center', fontSize: '0.52rem', color: '#fff', fontWeight: 700, letterSpacing: '0.5px' }}>
                            CAREER XONE • ACADEMIC EXCELLENCE
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <button 
                      className="btn btn-primary" 
                      onClick={() => window.print()}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}
                    >
                      <Printer size={16} /> Print Both Sides (Front & Back)
                    </button>
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
