import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, animate } from 'framer-motion';
import { UserPlus, Search, Edit2, Trash2, SlidersHorizontal, Users, CheckCircle, AlertTriangle, X, FileSpreadsheet, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';
import { calcAttendancePercent, formatBatchName } from '../utils/helpers';
import { getAvatarClass, getInitials } from '../data/sampleData';
import AddStudentModal from '../components/AddStudentModal';
import StudentProfileModal from '../components/StudentProfileModal';
import BulkUploadModal from '../components/BulkUploadModal';
import * as XLSX from 'xlsx';

const AnimatedCounter = ({ to }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const controls = animate(0, to, {
      duration: 1.2,
      ease: "easeOut",
      onUpdate(value) {
        setCount(Math.round(value));
      }
    });
    return () => controls.stop();
  }, [to]);

  return <>{count}</>;
};

export default function Students() {
  const { students, batches, attendance, tests, testResults, smsHistory, addStudent, updateStudent, deleteStudent, deleteStudentsBulk } = useApp();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedClass, setSelectedClass] = useState('all');
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Pagination State
  const [paginatedStudents, setPaginatedStudents] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isFetching, setIsFetching] = useState(true);

  // Debounced Search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchData(currentPage, searchQuery);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, currentPage]);

  const fetchData = async (page, search) => {
    setIsFetching(true);
    try {
      const res = await api.getStudents(page, 50, search);
      setPaginatedStudents(res.students || []);
      setTotalCount(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error('Failed to fetch students:', err);
    } finally {
      setIsFetching(false);
    }
  };

  const allStudentsList = useMemo(() => {
    if (Array.isArray(students) && students.length > 0) return students;
    return paginatedStudents || [];
  }, [students, paginatedStudents]);

  const uniqueClasses = useMemo(() => {
    const classSet = new Set();
    allStudentsList.forEach(s => {
      const cls = String(s.class || '').trim();
      if (cls) classSet.add(cls);
    });
    return Array.from(classSet).filter(Boolean).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [allStudentsList]);

  const dynamicBatches = useMemo(() => {
    const map = new Map();
    allStudentsList.forEach(s => {
      const bVal = s.batch || s.targetClass;
      if (bVal && !map.has(bVal)) {
        const formatted = formatBatchName(bVal, batches);
        map.set(bVal, { id: bVal, name: formatted || bVal });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allStudentsList, batches]);

  const normalizeKey = useCallback((val) => {
    if (!val) return '';
    return String(val).toLowerCase().replace(/[\s\-_]/g, '');
  }, []);

  const isCourseMatch = useCallback((studentBatch, filterVal) => {
    if (!filterVal || filterVal === 'all') return true;
    if (!studentBatch) return false;
    if (studentBatch === filterVal) return true;
    const normStudent = normalizeKey(studentBatch);
    const normFilter = normalizeKey(filterVal);
    if (normStudent === normFilter) return true;
    if (normStudent.includes(normFilter) || normFilter.includes(normStudent)) return true;
    const batchObj = batches.find(b => b.id === filterVal || b.name === filterVal);
    if (batchObj) {
      const normObjName = normalizeKey(batchObj.name);
      if (normStudent === normObjName || normStudent.includes(normObjName) || normObjName.includes(normStudent)) return true;
    }
    return false;
  }, [batches, normalizeKey]);

  const isClassMatch = useCallback((studentClass, filterVal) => {
    if (!filterVal || filterVal === 'all') return true;
    if (!studentClass) return false;
    return String(studentClass).trim().toLowerCase() === String(filterVal).trim().toLowerCase();
  }, []);

  const filteredStudents = useMemo(() => {
    const source = (allStudentsList && allStudentsList.length > 0) ? allStudentsList : paginatedStudents;
    return source
      .filter(student => {
        const matchesCourse = isCourseMatch(student.batch || student.targetClass, selectedCourse);
        const matchesClass = isClassMatch(student.class, selectedClass);
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const nameMatch = (student.name || '').toLowerCase().includes(q);
          const rollMatch = String(student.rollNo || '').toLowerCase().includes(q);
          const phoneMatch = String(student.parentPhone || student.phone || '').includes(q);
          const idMatch = String(student.id || '').toLowerCase().includes(q);
          return matchesCourse && matchesClass && (nameMatch || rollMatch || phoneMatch || idMatch);
        }
        return matchesCourse && matchesClass;
      })
      .sort((a, b) => {
        const rollA = a.rollNo ? String(a.rollNo) : '';
        const rollB = b.rollNo ? String(b.rollNo) : '';
        return rollA.localeCompare(rollB, undefined, { numeric: true });
      });
  }, [allStudentsList, paginatedStudents, selectedCourse, selectedClass, searchQuery, isCourseMatch, isClassMatch]);

  const activeCount = (allStudentsList && allStudentsList.length > 0)
    ? allStudentsList.filter(s => s.status === 'active').length
    : paginatedStudents.filter(s => s.status === 'active').length;
  const inactiveCount = Math.max(0, (allStudentsList && allStudentsList.length > 0 ? allStudentsList.length : totalCount) - activeCount);

  const pageSize = 50;
  const activeTotalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const displayedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage]);

  const [modalOpen, setModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [createdStudentCreds, setCreatedStudentCreds] = useState(null);
  const [selectedStudentForProfile, setSelectedStudentForProfile] = useState(null);

  const handleAddClick = () => {
    setEditingStudent(null);
    setModalOpen(true);
  };

  const handleBulkAddClick = () => {
    setBulkModalOpen(true);
  };

  const handleBulkSuccess = () => {
    setBulkModalOpen(false);
    fetchData(1, searchQuery);
  };

  const handleToggleSelectAll = () => {
    const allInViewSelected = displayedStudents.length > 0 && displayedStudents.every(s => selectedStudentIds.has(s.id));
    const next = new Set(selectedStudentIds);
    if (allInViewSelected) {
      displayedStudents.forEach(s => next.delete(s.id));
    } else {
      displayedStudents.forEach(s => next.add(s.id));
    }
    setSelectedStudentIds(next);
  };

  const handleToggleSelectOne = (id) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedStudentIds(next);
  };

  const handleSelectAllFiltered = () => {
    const next = new Set(selectedStudentIds);
    filteredStudents.forEach(s => next.add(s.id));
    setSelectedStudentIds(next);
  };

  const handleExecuteBulkDelete = async () => {
    if (selectedStudentIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      const idsArray = Array.from(selectedStudentIds);
      await deleteStudentsBulk(idsArray);
      setSelectedStudentIds(new Set());
      setShowBulkDeleteModal(false);
      fetchData(currentPage, searchQuery);
    } catch (e) {
      console.error(e);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleDownloadExcel = () => {
    if (!filteredStudents || filteredStudents.length === 0) {
      alert('No students found matching current filters to export');
      return;
    }
    const worksheetData = filteredStudents.map((s, index) => ({
      'S.No': index + 1,
      'Roll No': s.rollNo || '',
      'Student Name': s.name,
      'Parent Name': s.parentName || '',
      'Mobile No': s.parentPhone || s.phone || '',
      'Class': s.class || '',
      'Batch/Course': formatBatchName(s.batch || s.targetClass, batches),
      'Status': s.status === 'active' ? 'Active' : (s.status || 'Active')
    }));
    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
    XLSX.writeFile(workbook, `Students_Export_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const handleEditClick = (student) => {
    setEditingStudent(student);
    setModalOpen(true);
  };

  const handleSave = async (formData) => {
    try {
      if (editingStudent) {
        await updateStudent(editingStudent.id, formData);
      } else {
        const res = await addStudent(formData);
        if (res && res.parentUserId && res.parentPlainPassword) {
          setCreatedStudentCreds({
            name: res.name,
            parentUserId: res.parentUserId,
            parentPlainPassword: res.parentPlainPassword
          });
        }
      }
      setModalOpen(false);
      setEditingStudent(null);
      fetchData(currentPage, searchQuery);
    } catch (err) {
      console.error('Error saving student:', err);
    }
  };

  const handleDelete = (id, name) => {
    setStudentToDelete({ id, name });
  };

  const getCourseName = (batchId) => {
    const course = batches.find((b) => b.id === batchId);
    return course ? course.name : 'Unknown';
  };

  return (
    <motion.div 
      className="page-container animate-fade"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="page-header flex justify-between items-center flex-wrap gap-12">
        <div>
          <h1 className="page-title">Students Directory</h1>
          <p>Enrolled students details, courses, classes, parents info, and attendance statistics.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }} onClick={handleDownloadExcel} disabled={filteredStudents.length === 0}>
              <Download size={16} />
              Export
            </button>
            <button className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }} onClick={handleBulkAddClick}>
              <FileSpreadsheet size={16} />
              Bulk Import
            </button>
          <button className="btn btn-primary" onClick={handleAddClick}>
            <UserPlus size={18} />
            Add Student
          </button>
        </div>
      </div>

      <div className="stat-cards-grid">
        <div className="stat-card blue">
          <div className="stat-card-top">
            <div className="stat-card-icon blue">
              <Users size={20} />
            </div>
          </div>
          <div className="stat-card-value"><AnimatedCounter to={totalCount} /></div>
          <div className="stat-card-label">Total Enrolled</div>
        </div>

        <div className="stat-card green">
          <div className="stat-card-top">
            <div className="stat-card-icon green">
              <CheckCircle size={20} />
            </div>
          </div>
          <div className="stat-card-value"><AnimatedCounter to={activeCount} /></div>
          <div className="stat-card-label">Active Students</div>
        </div>

        <div className="stat-card orange">
          <div className="stat-card-top">
            <div className="stat-card-icon orange">
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="stat-card-value"><AnimatedCounter to={inactiveCount} /></div>
          <div className="stat-card-label">Inactive Students</div>
        </div>
      </div>

      <div className="card mb-24">
        <div className="flex justify-between items-center flex-wrap gap-12">
          <div className="topbar-search" style={{ position: 'relative', flex: '1 1 240px', maxWidth: '360px' }}>
            <Search className="topbar-search-icon" size={16} />
            <input
              type="text"
              placeholder="Search by name, roll no, or ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{ width: '100%' }}
            />
          </div>

          <div className="flex items-center gap-8 flex-wrap">
            <SlidersHorizontal size={16} className="text-secondary" />
            <select 
              className="form-select"
              value={selectedCourse}
              onChange={(e) => {
                setSelectedCourse(e.target.value);
                setCurrentPage(1);
              }}
              style={{ minWidth: '150px' }}
            >
              <option value="all">All Courses / Batches</option>
              {dynamicBatches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            
            <select 
              className="form-select"
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setCurrentPage(1);
              }}
              style={{ minWidth: '130px' }}
            >
              <option value="all">All Classes</option>
              {uniqueClasses.map((c, i) => (
                <option key={i} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedStudentIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -10 }}
            style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              border: '2px solid #ef4444',
              borderRadius: '16px',
              padding: '14px 22px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '14px',
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.45), 0 0 20px rgba(239, 68, 68, 0.25)',
              color: '#ffffff'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <span style={{
                background: '#ef4444',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '0.85rem',
                padding: '6px 14px',
                borderRadius: '24px',
                letterSpacing: '0.8px',
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)'
              }}>
                {selectedStudentIds.size} SELECTED
              </span>
              
              <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f8fafc' }}>
                Students selected for batch action
              </span>

              {filteredStudents.length > selectedStudentIds.size && (
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  style={{
                    background: '#2563eb',
                    border: '1px solid #60a5fa',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    padding: '6px 14px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(37, 99, 235, 0.35)'
                  }}
                >
                  ⚡ Select All {filteredStudents.length} Students
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setSelectedStudentIds(new Set())}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: '#ffffff',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  padding: '7px 16px',
                  borderRadius: '10px',
                  cursor: 'pointer'
                }}
              >
                ✕ Deselect All
              </button>
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(true)}
                style={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 20px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(239, 68, 68, 0.5)'
                }}
              >
                <Trash2 size={17} />
                Delete Selected ({selectedStudentIds.size})
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="table-container card">
        {displayedStudents.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input 
                    type="checkbox"
                    checked={displayedStudents.length > 0 && displayedStudents.every(s => selectedStudentIds.has(s.id))}
                    onChange={handleToggleSelectAll}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#ef4444' }}
                    title="Select / Deselect all students on this page"
                  />
                </th>
                <th>Roll No</th>
                <th>Student</th>
                <th>Course</th>
                <th>Class</th>
                <th>Parent Name</th>
                <th>Parent Phone</th>
                <th>Attendance</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody style={{ opacity: isFetching ? 0.4 : 1, transition: 'opacity 0.3s ease', pointerEvents: isFetching ? 'none' : 'auto' }}>
              {(isFetching && displayedStudents.length === 0) ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`skel-${idx}`}>
                    <td colSpan="10">
                      <div style={{ height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', animation: 'pulse 1.5s infinite ease-in-out' }}></div>
                    </td>
                  </tr>
                ))
              ) : displayedStudents.map((student, idx) => {
                const attPercent = calcAttendancePercent(attendance, student.id);
                let attColor = 'badge-success';
                if (attPercent < 60) attColor = 'badge-danger';
                else if (attPercent < 80) attColor = 'badge-late';
                const isSelected = selectedStudentIds.has(student.id);

                return (
                  <motion.tr 
                    key={student.id} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.5) }}
                    style={{ cursor: 'pointer', background: isSelected ? 'rgba(239, 68, 68, 0.08)' : undefined }}
                    onClick={() => setSelectedStudentForProfile(student)}
                    title="Click to view student profile history"
                  >
                    <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectOne(student.id)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#ef4444' }}
                      />
                    </td>
                    <td><strong style={{ fontFamily: 'monospace', letterSpacing: '0.5px' }}>{student.rollNo}</strong></td>
                    <td>
                      <div className="flex items-center gap-12">
                        {student.photo ? (
                          <img 
                            src={student.photo} 
                            alt={student.name} 
                            className="student-avatar" 
                            style={{ objectFit: 'cover', border: '1px solid var(--border-color)' }} 
                          />
                        ) : (
                          <div className={`student-avatar ${getAvatarClass(idx)}`}>
                            {getInitials(student.name)}
                          </div>
                        )}
                        <div>
                          <strong className="text-primary">{student.name}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                            ID: {student.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{formatBatchName(student.batch || student.targetClass, batches)}</td>
                    <td>{student.class || '-'}</td>
                    <td>{student.parentName}</td>
                    <td>{student.parentPhone}</td>
                    <td>
                      <span className={`badge ${attColor}`}>{attPercent}%</span>
                    </td>
                    <td>
                      <span className={`badge ${student.status === 'active' ? 'badge-present' : 'badge-absent'}`}>
                        {student.status}
                      </span>
                    </td>
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-8">
                        <button 
                          className="btn btn-icon btn-ghost" 
                          onClick={() => handleEditClick(student)}
                          title="Edit Student"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          className="btn btn-icon btn-ghost text-danger" 
                          onClick={() => handleDelete(student.id, student.name)}
                          title="Delete Student"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Users size={32} />
            </div>
            <h3>No Students Found</h3>
            <p>Try resetting the filters or search query to find your student.</p>
          </div>
        )}
      </div>

      {activeTotalPages > 1 && (
        <div className="flex justify-between items-center mt-16" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px 24px', borderRadius: '12px' }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
            Showing page {currentPage} of {activeTotalPages} (Total {filteredStudents.length} students)
          </div>
          <div className="flex gap-8">
            <button 
              className="btn btn-secondary" 
              disabled={currentPage === 1 || isFetching}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <button 
              className="btn btn-secondary" 
              disabled={currentPage === activeTotalPages || isFetching}
              onClick={() => setCurrentPage(prev => Math.min(activeTotalPages, prev + 1))}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {modalOpen && (
        <AddStudentModal
          isEdit={!!editingStudent}
          studentData={editingStudent}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}

      {selectedStudentForProfile && (
        <StudentProfileModal
          student={selectedStudentForProfile}
          onClose={() => setSelectedStudentForProfile(null)}
          attendance={attendance}
          testResults={testResults}
          tests={tests}
          smsHistory={smsHistory}
        />
      )}

      {createdStudentCreds && createPortal(
        <div className="modal-overlay" onClick={() => setCreatedStudentCreds(null)}>
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Parent App Credentials</h3>
              <button className="modal-close" onClick={() => setCreatedStudentCreds(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '20px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Please save these login credentials for <strong>{createdStudentCreds.name}</strong>'s parent. They will not be shown again.
              </p>
              <div className="card" style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '12px', textAlign: 'left', marginBottom: '20px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', display: 'block' }}>Parent User ID</span>
                  <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{createdStudentCreds.parentUserId}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', display: 'block' }}>Parent Password</span>
                  <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{createdStudentCreds.parentPlainPassword}</strong>
                </div>
              </div>
              <button 
                className="btn btn-primary w-full justify-center" 
                onClick={() => {
                  navigator.clipboard.writeText(`User ID: ${createdStudentCreds.parentUserId}\nPassword: ${createdStudentCreds.parentPlainPassword}`);
                  alert('Credentials copied to clipboard!');
                }}
              >
                Copy to Clipboard
              </button>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost w-full justify-center" onClick={() => setCreatedStudentCreds(null)}>
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {studentToDelete && createPortal(
        <div className="modal-overlay" onClick={() => setStudentToDelete(null)} style={{ zIndex: 99999 }}>
          <div className="modal-content" style={{ maxWidth: '420px', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '10px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Delete Student</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Are you sure you want to delete <strong>{studentToDelete.name}</strong>?
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button"
                className="btn btn-secondary btn-sm" 
                onClick={() => setStudentToDelete(null)}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="btn btn-sm" 
                style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 14px' }}
                onClick={async () => {
                  const id = studentToDelete.id;
                  setStudentToDelete(null);
                  await deleteStudent(id);
                  fetchData(currentPage, searchQuery);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showBulkDeleteModal && createPortal(
        <div className="modal-overlay" onClick={() => !isBulkDeleting && setShowBulkDeleteModal(false)} style={{ zIndex: 99999 }}>
          <div className="modal-content" style={{ maxWidth: '460px', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '12px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={28} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ef4444' }}>
                  Bulk Delete Confirmation
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  Permanently delete <strong>{selectedStudentIds.size}</strong> selected students from database?
                </p>
              </div>
            </div>

            <div style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '12px',
              padding: '12px 16px',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              marginBottom: '20px',
              lineHeight: 1.5
            }}>
              ⚠️ This will remove these {selectedStudentIds.size} student records, their parent credentials, and sync to Cloud Atlas.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button"
                className="btn btn-secondary btn-sm" 
                disabled={isBulkDeleting}
                onClick={() => setShowBulkDeleteModal(false)}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="btn btn-sm" 
                disabled={isBulkDeleting}
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 18px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onClick={handleExecuteBulkDelete}
              >
                <Trash2 size={16} />
                {isBulkDeleting ? 'Deleting...' : `Confirm Delete (${selectedStudentIds.size})`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <BulkUploadModal 
        isOpen={bulkModalOpen} 
        onClose={() => setBulkModalOpen(false)} 
        onSuccess={handleBulkSuccess} 
      />
    </motion.div>
  );
}
