import React, { useState, useEffect, useMemo } from 'react';
import {
  GraduationCap, Users, Calendar, Clock, Search, Filter,
  TrendingUp, CheckCircle2, XCircle, AlertCircle,
  ChevronRight, Phone, MessageCircle, ArrowLeft,
  RefreshCw, Smartphone, Award, BookOpen, User, Check, X
} from 'lucide-react';
import { api } from '../utils/api';
import { formatBatchName } from '../utils/helpers';
import toast, { Toaster } from 'react-hot-toast';
import PWAInstallPrompt from '../components/PWAInstallPrompt';

export default function TeacherPortalWeb() {
  const [proceedToWeb, setProceedToWeb] = useState(() => !!sessionStorage.getItem('skip_teacher_install_gate'));
  const [loading, setLoading] = useState(false);
  const [teacherData, setTeacherData] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('teacherSession')) || null;
    } catch {
      return null;
    }
  });

  // Filters & State
  const [selectedCourse, setSelectedCourse] = useState('ALL');
  const [selectedClass, setSelectedClass] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [dossierTab, setDossierTab] = useState('tests'); // 'tests' | 'attendance'

  useEffect(() => {
    document.title = 'Career Xone - Teacher Portal';
    fetchTeacherData();
  }, []);

  // Institute Branding
  const instituteName = teacherData?.instituteName || 'Career Xone';

  // Load Data
  const fetchTeacherData = async (isManual = false) => {
    setLoading(true);
    let toastId = null;
    if (isManual) {
      toastId = toast.loading('Syncing latest student records...');
    }

    try {
      const data = await api.getTeacherData();
      if (data && Array.isArray(data.students)) {
        setTeacherData(data);
        sessionStorage.setItem('teacherSession', JSON.stringify(data));
        if (isManual) {
          toast.success(`Synced! Refreshed ${data.students.length} students & ${data.tests?.length || 0} tests 🚀`, { id: toastId });
        }
      } else {
        throw new Error('Invalid data format received');
      }
    } catch (err) {
      console.error('Failed to fetch teacher data:', err);
      try {
        const localStudents = JSON.parse(localStorage.getItem('edutrack_students') || '[]');
        const localTests = JSON.parse(localStorage.getItem('edutrack_tests') || '[]');
        const localResults = JSON.parse(localStorage.getItem('edutrack_testResults') || '[]');
        const localAtt = JSON.parse(localStorage.getItem('edutrack_attendance') || '[]');
        const fallbackData = {
          instituteName: 'Career Xone',
          students: localStudents,
          tests: localTests,
          testResults: localResults,
          attendances: localAtt,
          sessions: []
        };
        setTeacherData(fallbackData);
        sessionStorage.setItem('teacherSession', JSON.stringify(fallbackData));
        if (isManual) {
          toast.success(`Synced from local cache (${localStudents.length} students)`, { id: toastId });
        }
      } catch (e) {
        if (isManual) {
          toast.error('Sync failed. Please check network connection.', { id: toastId });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Raw data collections
  const students = useMemo(() => teacherData?.students || [], [teacherData]);
  const tests = useMemo(() => teacherData?.tests || [], [teacherData]);
  const testResults = useMemo(() => teacherData?.testResults || [], [teacherData]);
  const attendances = useMemo(() => teacherData?.attendances || [], [teacherData]);

  // Extract unique courses (e.g. JEE Mains, NEET, JEE Advanced, MHCET)
  const availableCourses = useMemo(() => {
    const set = new Set();
    students.forEach((s) => {
      const c = formatBatchName(s.batch || s.course);
      if (c && c !== 'General') set.add(c);
      else if (s.course) set.add(s.course);
    });
    return Array.from(set).sort();
  }, [students]);

  // Extract unique classes (e.g. 11th, 12th, etc.)
  const availableClasses = useMemo(() => {
    const set = new Set();
    students.forEach((s) => {
      if (s.class) set.add(String(s.class).trim());
    });
    return Array.from(set).sort();
  }, [students]);

  // Calculate Student Complete History Metrics
  const enrichedStudents = useMemo(() => {
    return students.map((st) => {
      const stId = st.id || st._id;

      // 1. Full Attendance stats & daily list
      const stAtt = attendances
        .filter((a) => a.studentId === stId)
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

      const totalAttDays = stAtt.length;
      const presentDays = stAtt.filter((a) => a.status === 'present' || a.entryTime).length;
      const lateDays = stAtt.filter((a) => a.status === 'late').length;
      const absentDays = stAtt.filter((a) => a.status === 'absent' && !a.entryTime).length;
      const attPercentage = totalAttDays > 0 ? Math.round(((presentDays + lateDays) / totalAttDays) * 100) : (st.attendanceRate || 0);

      // Daily hours
      let totalDurationMins = 0;
      stAtt.forEach((a) => {
        if (a.entryTime && a.exitTime) {
          const [inH, inM] = a.entryTime.split(':').map(Number);
          const [outH, outM] = a.exitTime.split(':').map(Number);
          if (!isNaN(inH) && !isNaN(outH)) {
            const diff = (outH * 60 + outM) - (inH * 60 + inM);
            if (diff > 0) totalDurationMins += diff;
          }
        }
      });
      const avgDailyHours = totalAttDays > 0 ? (totalDurationMins / totalAttDays / 60).toFixed(1) : '0';

      // 2. Full Test Results list
      const stResults = testResults
        .filter((r) => r.studentId === stId)
        .map((r) => {
          const testObj = tests.find((t) => (t.id === r.testId || t._id === r.testId));
          const totalMarks = testObj?.totalMarks || r.totalMarks || 100;
          const score = Number(r.marks ?? r.score ?? 0);
          const pct = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : (r.percentage || 0);

          return {
            ...r,
            testName: testObj?.name || r.testName || `Test Series #${r.testId || 1}`,
            testDate: testObj?.date || r.date || r.createdAt || 'Recent',
            subject: testObj?.subject || r.subject || 'All Subjects',
            score,
            totalMarks,
            percentage: pct,
            rank: r.rank || r.rankInBatch || null,
            subjectBreakdown: r.subjects || r.subjectMarks || null
          };
        })
        .sort((a, b) => new Date(b.testDate || 0) - new Date(a.testDate || 0));

      const testsCount = stResults.length;
      const totalScoreSum = stResults.reduce((sum, r) => sum + r.percentage, 0);
      const avgScore = testsCount > 0 ? Math.round(totalScoreSum / testsCount) : (st.avgScore || 0);
      const bestScore = testsCount > 0 ? Math.max(...stResults.map(r => r.percentage)) : 0;
      const latestTest = stResults.length > 0 ? stResults[0] : null;

      return {
        ...st,
        stId,
        attPercentage,
        presentDays,
        lateDays,
        absentDays,
        totalAttDays,
        avgDailyHours,
        testsCount,
        avgScore,
        bestScore,
        latestTest,
        testResultsList: stResults,
        attendanceList: stAtt
      };
    });
  }, [students, attendances, testResults, tests]);

  // Filter students based on search, course, and class
  const filteredStudents = useMemo(() => {
    return enrichedStudents.filter((st) => {
      // 1. Course Filter
      if (selectedCourse !== 'ALL') {
        const studentCourse = formatBatchName(st.batch || st.course);
        const matchesCourse = studentCourse === selectedCourse ||
          st.batch === selectedCourse ||
          st.course === selectedCourse;
        if (!matchesCourse) return false;
      }

      // 2. Class Filter
      if (selectedClass !== 'ALL') {
        const studentClass = String(st.class || '').trim();
        const matchesClass = studentClass === selectedClass ||
          studentClass.toLowerCase() === selectedClass.toLowerCase();
        if (!matchesClass) return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          (st.name || '').toLowerCase().includes(q) ||
          String(st.rollNo || '').toLowerCase().includes(q) ||
          (st.parentPhone || '').includes(q) ||
          (st.batch || '').toLowerCase().includes(q) ||
          formatBatchName(st.batch || '').toLowerCase().includes(q) ||
          String(st.class || '').toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [enrichedStudents, selectedCourse, selectedClass, searchQuery]);

  // Keep selected student synced
  useEffect(() => {
    if (selectedStudent) {
      const refreshed = enrichedStudents.find(s => s.stId === selectedStudent.stId);
      if (refreshed) setSelectedStudent(refreshed);
    }
  }, [enrichedStudents]);

  // ----------------------------------------------------
  // MAIN APP INTERFACE (Direct Access, No Password Gate)
  // ----------------------------------------------------

  // Helper for dynamic vibrant avatar gradients
  const getAvatarGradient = (name = 'Student', index = 0) => {
    const gradients = [
      'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', // Royal Blue
      'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', // Purple Violet
      'linear-gradient(135deg, #059669 0%, #047857 100%)', // Emerald Teal
      'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', // Ocean Sky
      'linear-gradient(135deg, #d97706 0%, #b45309 100%)', // Warm Amber
      'linear-gradient(135deg, #db2777 0%, #be185d 100%)', // Rose Pink
      'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)'  // Deep Indigo
    ];
    const charCode = (name.charCodeAt(0) || 0) + (name.charCodeAt(name.length - 1) || 0) + index;
    return gradients[charCode % gradients.length];
  };

  // ----------------------------------------------------
  // MAIN APP INTERFACE (Ultra-Modern, Mobile-First UX)
  // ----------------------------------------------------
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
      fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif",
      color: '#0f172a',
      paddingBottom: '60px'
    }}>
      <Toaster position="top-center" />
      
      {/* 📲 Modern PWA Install Banner */}
      <PWAInstallPrompt appName="CX Teacher" />

      {/* Top Glassmorphic Header (Compact & Refined) */}
      <header style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
        padding: '8px 12px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)'
      }}>
        <div style={{
          maxWidth: '900px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flexShrink: 0,
              padding: '2px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
            }}>
              <img
                src={teacherData?.instituteLogo || '/logo.png'}
                alt="Career Xone Logo"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div style={{
                fontSize: '0.94rem',
                fontWeight: 900,
                color: '#0f172a',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                letterSpacing: '-0.2px'
              }}>
                {instituteName}
              </div>
              <div style={{
                fontSize: '0.68rem',
                color: '#2563eb',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '1px'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                <span>Faculty Portal • 360° Dossier</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <button
              onClick={() => fetchTeacherData(true)}
              disabled={loading}
              style={{
                padding: '5px 10px',
                background: loading ? '#e2e8f0' : 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                color: '#1d4ed8',
                fontSize: '0.74rem',
                fontWeight: 800,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 1px 3px rgba(37, 99, 235, 0.08)',
                transition: 'all 0.2s'
              }}
              title="Click to sync and refresh latest student data"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'Syncing...' : 'Sync'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '8px 10px' }}>

        {/* Compact Search Bar */}
        <div style={{
          position: 'relative',
          width: '100%',
          marginBottom: '6px'
        }}>
          <Search size={14} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search student by Name, Roll No, Phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 30px 7px 30px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#0f172a',
              outline: 'none',
              boxSizing: 'border-box',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: '#e2e8f0',
                border: 'none',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={10} color="#475569" />
            </button>
          )}
        </div>

        {/* Compact Horizontal Quick-Filter Chips */}
        <div style={{
          display: 'flex',
          gap: '5px',
          overflowX: 'auto',
          paddingBottom: '4px',
          marginBottom: '6px',
          scrollbarWidth: 'none'
        }}>
          <button
            onClick={() => setSelectedCourse('ALL')}
            style={{
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '0.70rem',
              fontWeight: 800,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              border: selectedCourse === 'ALL' ? 'none' : '1px solid #cbd5e1',
              background: selectedCourse === 'ALL' ? 'linear-gradient(135deg, #1e40af, #2563eb)' : '#ffffff',
              color: selectedCourse === 'ALL' ? '#ffffff' : '#475569',
              boxShadow: selectedCourse === 'ALL' ? '0 2px 6px rgba(37, 99, 235, 0.2)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            🎓 All ({students.length})
          </button>

          {availableCourses.map((c) => {
            const isSel = selectedCourse === c;
            return (
              <button
                key={c}
                onClick={() => setSelectedCourse(c)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '0.70rem',
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  border: isSel ? 'none' : '1px solid #cbd5e1',
                  background: isSel ? 'linear-gradient(135deg, #1e40af, #2563eb)' : '#ffffff',
                  color: isSel ? '#ffffff' : '#475569',
                  boxShadow: isSel ? '0 2px 6px rgba(37, 99, 235, 0.2)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {c}
              </button>
            );
          })}

          {availableClasses.length > 0 && (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                style={{
                  padding: '4px 20px 4px 8px',
                  borderRadius: '12px',
                  fontSize: '0.70rem',
                  fontWeight: 800,
                  border: selectedClass !== 'ALL' ? 'none' : '1px solid #cbd5e1',
                  background: selectedClass !== 'ALL' ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : '#ffffff',
                  color: selectedClass !== 'ALL' ? '#ffffff' : '#475569',
                  outline: 'none',
                  appearance: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="ALL">🏷️ All Classes</option>
                {availableClasses.map((cls) => (
                  <option key={cls} value={cls} style={{ color: '#0f172a' }}>
                    {cls.toLowerCase().startsWith('class') ? cls : `Class ${cls}`}
                  </option>
                ))}
              </select>
              <Filter size={10} color={selectedClass !== 'ALL' ? '#ffffff' : '#64748b'} style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          )}
        </div>

        {/* Compact Counter Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px',
          padding: '0 2px',
          fontSize: '0.72rem',
          color: '#64748b',
          fontWeight: 700
        }}>
          <span>Showing <strong style={{ color: '#0f172a' }}>{filteredStudents.length}</strong> Students</span>
          <span style={{ color: '#2563eb' }}>Tap for dossier ➔</span>
        </div>

        {/* Student Cards List (Crisp Typography, Spacious Name, Never Truncates) */}
        {filteredStudents.length === 0 ? (
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '24px 16px',
            textAlign: 'center',
            border: '1px solid #e2e8f0',
            color: '#64748b'
          }}>
            <Users size={28} color="#94a3b8" style={{ margin: '0 auto 6px' }} />
            <div style={{ fontSize: '0.90rem', fontWeight: 800, color: '#334155' }}>No students match your filter</div>
            <div style={{ fontSize: '0.74rem', marginTop: '2px' }}>Try searching by another name or clearing filters.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {filteredStudents.map((st, index) => (
              <div
                key={st.stId}
                onClick={() => setSelectedStudent(st)}
                style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  padding: '9px 12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 4px rgba(15, 23, 42, 0.03)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  transition: 'all 0.15s ease'
                }}
              >
                {/* Left: Avatar + Student Name & Line 2 Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                  {st.photo ? (
                    <img
                      src={st.photo}
                      alt={st.name}
                      style={{ width: '34px', height: '34px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0, border: '1px solid #cbd5e1' }}
                    />
                  ) : (
                    <div style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      background: getAvatarGradient(st.name, index),
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: '0.92rem',
                      flexShrink: 0,
                      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)'
                    }}>
                      {(st.name || 'S').charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div style={{ minWidth: 0, flex: 1 }}>
                    {/* Line 1: Student Name with Full Width */}
                    <div style={{
                      fontSize: '0.88rem',
                      fontWeight: 800,
                      color: '#0f172a',
                      lineHeight: 1.25,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {st.name}
                    </div>

                    {/* Line 2: Roll Badge + Batch Pill side-by-side */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px', flexWrap: 'wrap' }}>
                      <span style={{
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        border: '1px solid #dbeafe',
                        whiteSpace: 'nowrap'
                      }}>
                        Roll: {st.rollNo || 'N/A'}
                      </span>

                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: '#475569',
                        background: '#f1f5f9',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        🎯 {formatBatchName(st.batch || st.course) || 'General Batch'}
                      </span>

                      {st.class && (
                        <span style={{
                          fontSize: '0.66rem',
                          fontWeight: 700,
                          color: '#64748b',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          whiteSpace: 'nowrap'
                        }}>
                          {String(st.class).toLowerCase().startsWith('class') ? st.class : `Class ${st.class}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Arrow */}
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94a3b8',
                  flexShrink: 0
                }}>
                  <ChevronRight size={13} />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ----------------------------------------------------
          STUDENT COMPLETE HISTORY DOSSIER (Ultra-Modern Modal)
          ---------------------------------------------------- */}
      {selectedStudent && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.70)',
          backdropFilter: 'blur(8px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0'
        }}>
          <div style={{
            background: '#f8fafc',
            width: '100%',
            maxWidth: '600px',
            height: '100%',
            maxHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* 1. Modal Top Bar */}
            <div style={{
              background: '#ffffff',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #e2e8f0',
              flexShrink: 0
            }}>
              <button
                onClick={() => setSelectedStudent(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  color: '#334155',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.80rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>

              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>
                Student 360° Dossier
              </div>

              <button
                onClick={() => setSelectedStudent(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Modal Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* 2. Hero Profile Card */}
              <div style={{
                background: '#ffffff',
                borderRadius: '16px',
                padding: '14px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {selectedStudent.photo ? (
                    <img
                      src={selectedStudent.photo}
                      alt={selectedStudent.name}
                      style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover', border: '2px solid #dbeafe', flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      background: getAvatarGradient(selectedStudent.name),
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: '1.25rem',
                      flexShrink: 0,
                      boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)'
                    }}>
                      {(selectedStudent.name || 'S').charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h2 style={{
                      fontSize: '1.05rem',
                      fontWeight: 900,
                      color: '#0f172a',
                      margin: 0,
                      lineHeight: 1.25
                    }}>
                      {selectedStudent.name}
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                      <span style={{
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        border: '1px solid #dbeafe'
                      }}>
                        Roll: {selectedStudent.rollNo || 'N/A'}
                      </span>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: '#475569',
                        background: '#f1f5f9',
                        padding: '2px 8px',
                        borderRadius: '6px'
                      }}>
                        🎯 {formatBatchName(selectedStudent.batch || selectedStudent.course) || 'General Batch'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Direct Parent Contact Buttons (Full Width & Clean) */}
                {selectedStudent.parentPhone && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    marginTop: '12px',
                    paddingTop: '12px',
                    borderTop: '1px dashed #e2e8f0'
                  }}>
                    <a
                      href={`tel:${selectedStudent.parentPhone}`}
                      style={{
                        background: '#f8fafc',
                        color: '#1e3a8a',
                        border: '1px solid #cbd5e1',
                        padding: '8px 10px',
                        borderRadius: '10px',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                      }}
                    >
                      <Phone size={14} color="#2563eb" /> <span>Call Parent</span>
                    </a>

                    <a
                      href={`https://wa.me/91${selectedStudent.parentPhone.replace(/\D/g, '').slice(-10)}?text=Hello%20Parent,%20regarding%20${encodeURIComponent(selectedStudent.name)}'s%20performance%20at%20${encodeURIComponent(instituteName)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                        color: '#ffffff',
                        border: 'none',
                        padding: '8px 10px',
                        borderRadius: '10px',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 6px rgba(34, 197, 94, 0.25)'
                      }}
                    >
                      <MessageCircle size={14} /> <span>WhatsApp</span>
                    </a>
                  </div>
                )}
              </div>

              {/* 3. 2x2 Clean Balanced KPI Metric Tiles */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px'
              }}>
                {/* 1. Attendance Card */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: '14px',
                  padding: '10px 12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: '#ecfdf5',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Calendar size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 800 }}>ATTENDANCE</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#047857', lineHeight: 1.1 }}>
                      {selectedStudent.totalAttDays > 0 ? `${selectedStudent.attPercentage}%` : '--'}
                    </div>
                    <div style={{ fontSize: '0.66rem', color: '#64748b', marginTop: '1px' }}>
                      {selectedStudent.totalAttDays > 0 ? `${selectedStudent.presentDays}/${selectedStudent.totalAttDays} Days` : 'No punch records'}
                    </div>
                  </div>
                </div>

                {/* 2. Avg Marks Card */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: '14px',
                  padding: '10px 12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: '#eff6ff',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <TrendingUp size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 800 }}>AVG MARKS</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#1d4ed8', lineHeight: 1.1 }}>
                      {selectedStudent.testsCount > 0 ? `${selectedStudent.avgScore}%` : '--'}
                    </div>
                    <div style={{ fontSize: '0.66rem', color: '#64748b', marginTop: '1px' }}>
                      {selectedStudent.testsCount > 0 ? `${selectedStudent.testsCount} Tests Graded` : 'Pending test score'}
                    </div>
                  </div>
                </div>

                {/* 3. Best Score Card */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: '14px',
                  padding: '10px 12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: '#f5f3ff',
                    color: '#7c3aed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Award size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 800 }}>BEST SCORE</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#6d28d9', lineHeight: 1.1 }}>
                      {selectedStudent.bestScore > 0 ? `${selectedStudent.bestScore}%` : '--'}
                    </div>
                    <div style={{ fontSize: '0.66rem', color: '#64748b', marginTop: '1px' }}>
                      {selectedStudent.bestScore > 0 ? 'Peak Score Achieved' : 'No records yet'}
                    </div>
                  </div>
                </div>

                {/* 4. Daily Hours Card */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: '14px',
                  padding: '10px 12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: '#fffbeb',
                    color: '#d97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Clock size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 800 }}>CAMPUS TIME</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#b45309', lineHeight: 1.1 }}>
                      {selectedStudent.avgDailyHours > 0 ? `${selectedStudent.avgDailyHours}h` : '--'}
                    </div>
                    <div style={{ fontSize: '0.66rem', color: '#64748b', marginTop: '1px' }}>
                      {selectedStudent.avgDailyHours > 0 ? 'Daily Biometric Avg' : 'Pending punch log'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Sleek Segmented Pill Tabs */}
              <div style={{
                background: '#e2e8f0',
                padding: '3px',
                borderRadius: '12px',
                display: 'flex',
                gap: '4px'
              }}>
                <button
                  onClick={() => setDossierTab('tests')}
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    borderRadius: '10px',
                    border: 'none',
                    background: dossierTab === 'tests' ? '#ffffff' : 'transparent',
                    color: dossierTab === 'tests' ? '#1d4ed8' : '#64748b',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: dossierTab === 'tests' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <BookOpen size={14} />
                  <span>Tests ({selectedStudent.testResultsList.length})</span>
                </button>

                <button
                  onClick={() => setDossierTab('attendance')}
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    borderRadius: '10px',
                    border: 'none',
                    background: dossierTab === 'attendance' ? '#ffffff' : 'transparent',
                    color: dossierTab === 'attendance' ? '#047857' : '#64748b',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: dossierTab === 'attendance' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Calendar size={14} />
                  <span>Attendance ({selectedStudent.attendanceList.length})</span>
                </button>
              </div>

              {/* 5. Tab Content Lists */}
              {/* 📑 TAB 1: ALL TESTS RESULTS HISTORY */}
              {dossierTab === 'tests' && (
                <div>
                  {selectedStudent.testResultsList.length === 0 ? (
                    <div style={{
                      background: '#ffffff',
                      borderRadius: '14px',
                      padding: '28px 16px',
                      textAlign: 'center',
                      color: '#64748b',
                      border: '1px solid #e2e8f0'
                    }}>
                      <BookOpen size={30} color="#94a3b8" style={{ margin: '0 auto 6px' }} />
                      <div style={{ fontWeight: 800, color: '#334155', fontSize: '0.90rem' }}>No test results recorded yet</div>
                      <div style={{ fontSize: '0.76rem', marginTop: '2px' }}>Tests graded via OMR Scanner or staff entry will show here.</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {selectedStudent.testResultsList.map((testItem, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: '#ffffff',
                            borderRadius: '12px',
                            padding: '10px 12px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                            <div>
                              <div style={{ fontSize: '0.90rem', fontWeight: 800, color: '#0f172a' }}>
                                {testItem.testName}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '1px' }}>
                                📅 {testItem.testDate} • {testItem.subject}
                              </div>
                            </div>

                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontSize: '0.76rem',
                              fontWeight: 800,
                              background: testItem.percentage >= 75 ? '#dcfce7' : testItem.percentage >= 50 ? '#eff6ff' : '#fee2e2',
                              color: testItem.percentage >= 75 ? '#15803d' : testItem.percentage >= 50 ? '#1d4ed8' : '#b91c1c'
                            }}>
                              {testItem.percentage}%
                            </span>
                          </div>

                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: '#f8fafc',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            fontSize: '0.78rem'
                          }}>
                            <div>
                              Marks: <strong style={{ color: '#0f172a' }}>{testItem.score}</strong> / {testItem.totalMarks}
                            </div>
                            {testItem.rank && (
                              <div style={{ color: '#7c3aed', fontWeight: 800 }}>
                                🏆 Rank #{testItem.rank}
                              </div>
                            )}
                          </div>

                          {/* Subject Breakdown if exists */}
                          {testItem.subjectBreakdown && typeof testItem.subjectBreakdown === 'object' && Object.keys(testItem.subjectBreakdown).length > 0 && (
                            <div style={{
                              display: 'flex',
                              gap: '5px',
                              flexWrap: 'wrap',
                              marginTop: '6px',
                              paddingTop: '6px',
                              borderTop: '1px dashed #e2e8f0',
                              fontSize: '0.72rem'
                            }}>
                              {Object.entries(testItem.subjectBreakdown).map(([subj, marks]) => (
                                <span key={subj} style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', color: '#334155', fontWeight: 600 }}>
                                  {subj}: <strong>{Array.isArray(marks) ? marks.length : marks}</strong>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 📅 TAB 2: FULL ATTENDANCE HISTORY */}
              {dossierTab === 'attendance' && (
                <div>
                  {selectedStudent.attendanceList.length === 0 ? (
                    <div style={{
                      background: '#ffffff',
                      borderRadius: '14px',
                      padding: '28px 16px',
                      textAlign: 'center',
                      color: '#64748b',
                      border: '1px solid #e2e8f0'
                    }}>
                      <Calendar size={30} color="#94a3b8" style={{ margin: '0 auto 6px' }} />
                      <div style={{ fontWeight: 800, color: '#334155', fontSize: '0.90rem' }}>No attendance records found</div>
                      <div style={{ fontSize: '0.76rem', marginTop: '2px' }}>Biometric punches or staff attendance logs will appear here.</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {selectedStudent.attendanceList.map((att, idx) => {
                        const isPresent = att.status === 'present' || att.entryTime;
                        const isLate = att.status === 'late';

                        return (
                          <div
                            key={idx}
                            style={{
                              background: '#ffffff',
                              borderRadius: '10px',
                              padding: '8px 10px',
                              border: '1px solid #e2e8f0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                background: isPresent ? '#dcfce7' : isLate ? '#fef3c7' : '#fee2e2',
                                color: isPresent ? '#15803d' : isLate ? '#b45309' : '#b91c1c',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                {isPresent ? <CheckCircle2 size={16} /> : isLate ? <Clock size={16} /> : <XCircle size={16} />}
                              </div>

                              <div>
                                <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>
                                  {att.date || 'Recent Date'}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '1px' }}>
                                  In: <strong style={{ color: '#0f172a' }}>{att.entryTime || 'N/A'}</strong> • Out: <strong style={{ color: '#0f172a' }}>{att.exitTime || 'N/A'}</strong>
                                </div>
                              </div>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: '5px',
                                fontSize: '0.70rem',
                                fontWeight: 800,
                                background: isPresent ? '#dcfce7' : isLate ? '#fef3c7' : '#fee2e2',
                                color: isPresent ? '#15803d' : isLate ? '#b45309' : '#b91c1c'
                              }}>
                                {isPresent ? 'PRESENT' : isLate ? 'LATE' : 'ABSENT'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
