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
  const { students, batches, attendance, tests, testResults, smsHistory, addStudent, updateStudent, deleteStudent } = useApp();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedClass, setSelectedClass] = useState('all');
  const [studentToDelete, setStudentToDelete] = useState(null);

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

  // Consolidated full student list for instantaneous filters & full dataset exports
  const allStudentsList = useMemo(() => {
    if (Array.isArray(students) && students.length > 0) return students;
    return paginatedStudents || [];
  }, [students, paginatedStudents]);

  // Dynamic unique classes from all students in database (only classes where students actually exist)
  const uniqueClasses = useMemo(() => {
    const classSet = new Set();
    allStudentsList.forEach(s => {
      const cls = String(s.class || '').trim();
      if (cls) {
        classSet.add(cls);
      }
    });
    return Array.from(classSet).filter(Boolean).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [allStudentsList]);

  // Dynamic courses / batches from student records (only batches where students actually exist)
  const dynamicBatches = useMemo(() => {
    const map = new Map();
    allStudentsList.forEach(s => {
      const bVal = s.batch || s.targetClass;
      if (bVal && !map.has(bVal)) {
        const formatted = formatBatchName(bVal, batches);
        map.set(bVal, { id: bVal, name: formatted || bVal });
      }
    });
    return Array.from(map.values());
  }, [allStudentsList, batches]);

  const [modalOpen, setModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [selectedStudentForProfile, setSelectedStudentForProfile] = useState(null);
  const [createdStudentCreds, setCreatedStudentCreds] = useState(null);

  // Helper matching functions for courses and classes
  const isCourseMatch = useCallback((studentBatch, filterVal) => {
    if (filterVal === 'all') return true;
    if (!studentBatch) return false;
    const sRaw = String(studentBatch).trim().toLowerCase();
    const fRaw = String(filterVal).trim().toLowerCase();
    if (sRaw === fRaw) return true;
    const formattedStudent = formatBatchName(studentBatch, batches).toLowerCase();
    const formattedFilter = formatBatchName(filterVal, batches).toLowerCase();
    return formattedStudent === fRaw || formattedStudent === formattedFilter;
  }, [batches]);

  const isClassMatch = useCallback((studentClass, filterVal) => {
    if (filterVal === 'all') return true;
    if (!studentClass) return false;
    return String(studentClass).trim().toLowerCase() === String(filterVal).trim().toLowerCase();
  }, []);

  // Filtered students for full export & pagination
  const filteredStudents = useMemo(() => {
    // If we have full student directory in AppContext, filter from allStudentsList
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

  // Accurate Active / Inactive stats from real database
  const activeCount = (allStudentsList && allStudentsList.length > 0)
    ? allStudentsList.filter(s => s.status === 'active').length
    : paginatedStudents.filter(s => s.status === 'active').length;
  const inactiveCount = Math.max(0, (allStudentsList && allStudentsList.length > 0 ? allStudentsList.length : totalCount) - activeCount);

  // Pagination for display table
  const pageSize = 50;
  const activeTotalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const displayedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage]);

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

  const handleDownloadExcel = () => {
    if (!filteredStudents || filteredStudents.length === 0) {
      alert('No students found matching current filters to export');
      return;
    }
    
    // Export ALL students matching the current filters across the whole institute
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
    const colWidths = [
      { wch: 6 },
      { wch: 15 },
      { wch: 25 },
      { wch: 25 },
      { wch: 15 },
      { wch: 12 },
      { wch: 20 },
      { wch: 10 }
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
    
    const courseSuffix = selectedCourse !== 'all' ? `_${formatBatchName(selectedCourse, batches).replace(/[\s/\\?%*:|"<>]/g, '_')}` : '';
    const classSuffix = selectedClass !== 'all' ? `_Class_${selectedClass}` : '';
    XLSX.writeFile(workbook, `Students_Export${courseSuffix}${classSuffix}_${new Date().toISOString().slice(0,10)}.xlsx`);
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

  const exportStudents = () => {
    if (filteredStudents.length === 0) {
      alert('No students to export');
      return;
    }
    const headers = ['Roll No,Name,Course,Class,Parent Name,Parent Phone,Attendance,Status'];
    const rows = filteredStudents.map(s => {
      const att = calcAttendancePercent(s.id, attendance);
      const courseName = getCourseName(s.batch);
      const status = s.status || 'Active';
      return `${s.rollNo || ''},"${s.name}","${courseName}","${s.class || ''}","${s.parentName || ''}","${s.parentPhone || ''}",${att}%,${status}`;
    });
    const csvContent = "data:text/csv;charset=utf-8," + headers.concat(rows).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "students_directory.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div 
      className="page-container animate-fade"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="page-header flex justify-between items-center flex-wrap gap-16">
        <div>
          <h1 className="page-title">Students Directory</h1>
          <p>Enrolled students details, courses, classes, parents info, and attendance statistics.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }} onClick={handleDownloadExcel} disabled={filteredStudents.length === 0}>
              <Download size={16} />
              Export Excel
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

      {/* Stats row */}
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

      {/* Filter panel */}
      <div className="card mb-24">
        <div className="flex justify-between items-center flex-wrap gap-16">
          <div className="topbar-search" style={{ position: 'relative' }}>
            <Search className="topbar-search-icon" size={16} />
            <input
              type="text"
              placeholder="Search by name, roll no, or ID..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{ width: '300px' }}
            />
          </div>

          <div className="flex items-center gap-8">
            <button 
              onClick={handleDownloadExcel}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '38px', padding: '0 12px', border: '1px solid #cbd5e1' }}
              disabled={filteredStudents.length === 0}
            >
              <Download size={16} /> Export Excel
            </button>
            <SlidersHorizontal size={16} className="text-secondary" />
            <select 
              className="form-select"
              value={selectedCourse}
              onChange={(e) => {
                setSelectedCourse(e.target.value);
                setCurrentPage(1);
              }}
              style={{ minWidth: '160px' }}
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
              style={{ minWidth: '140px' }}
            >
              <option value="all">All Classes</option>
              {uniqueClasses.map((c, i) => (
                <option key={i} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Student List Table */}
      <div className="table-container card">
        {displayedStudents.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
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
                    <td colSpan="9">
                      <div style={{ height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', animation: 'pulse 1.5s infinite ease-in-out' }}></div>
                    </td>
                  </tr>
                ))
              ) : displayedStudents.map((student, idx) => {
                const attPercent = calcAttendancePercent(attendance, student.id);
                let attColor = 'badge-success';
                if (attPercent < 60) attColor = 'badge-danger';
                else if (attPercent < 80) attColor = 'badge-late';

                return (
                  <motion.tr 
                    key={student.id} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.5) }}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedStudentForProfile(student)}
                    title="Click to view student profile history"
                  >
                    <td>{student.rollNo}</td>
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

      {/* Pagination Controls */}
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

      {/* Add/Edit Modal */}
      {modalOpen && (
        <AddStudentModal
          isEdit={!!editingStudent}
          studentData={editingStudent}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}

      {/* Student Profile Details Modal */}
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

      {/* Parent Credentials Modal */}
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
      {/* Delete Student Confirmation Modal */}
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

      {/* Bulk Upload Modal */}
      <BulkUploadModal 
        isOpen={bulkModalOpen} 
        onClose={() => setBulkModalOpen(false)} 
        onSuccess={handleBulkSuccess} 
      />
    </motion.div>
  );
}
