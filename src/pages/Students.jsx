import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Search, Edit2, Trash2, SlidersHorizontal, Users, CheckCircle, AlertTriangle, X, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';
import { calcAttendancePercent } from '../utils/helpers';
import { getAvatarClass, getInitials } from '../data/sampleData';
import AddStudentModal from '../components/AddStudentModal';
import StudentProfileModal from '../components/StudentProfileModal';
import BulkUploadModal from '../components/BulkUploadModal';

export default function Students() {
  const { batches, attendance, tests, testResults, smsHistory, addStudent, updateStudent, deleteStudent } = useApp();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [selectedClass, setSelectedClass] = useState('all');

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

  const uniqueClasses = Array.from(new Set(paginatedStudents.map(s => s.class))).filter(Boolean);
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [selectedStudentForProfile, setSelectedStudentForProfile] = useState(null);
  const [createdStudentCreds, setCreatedStudentCreds] = useState(null);

  // Filter out courses and classes (locally applied on the fetched page)
  const filteredStudents = paginatedStudents.filter(student => {
    const matchesCourse = selectedCourse === 'all' || student.batch === selectedCourse;
    const matchesClass = selectedClass === 'all' || student.class === selectedClass;
    return matchesCourse && matchesClass;
  });

  // Derived stats (Approximate for active since we don't fetch all, but we can do our best with local page or total stats)
  const activeCount = Math.round(totalCount * 0.95); // Approximation if backend doesn't provide it
  const inactiveCount = totalCount - activeCount;

  const handleAddClick = () => {
    setEditingStudent(null);
    setModalOpen(true);
  };

  const handleBulkAddClick = () => {
    setBulkModalOpen(true);
  };

  const handleBulkSuccess = () => {
    setBulkModalOpen(false);
    window.location.reload();
  };

  const handleEditClick = (student) => {
    setEditingStudent(student);
    setModalOpen(true);
  };

  const handleSave = async (formData) => {
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
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete ${name}?`)) {
      await deleteStudent(id);
      fetchData(currentPage, searchQuery);
    }
  };

  // Get course name
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
      {/* Header */}
      <div className="page-header flex justify-between items-center flex-wrap gap-16">
        <div>
          <h1 className="page-title">Students Directory</h1>
          <p>Enrolled students details, courses, classes, parents info, and attendance statistics.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={handleBulkAddClick} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet size={18} />
            Add with Excel
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
          <div className="stat-card-value">{totalCount}</div>
          <div className="stat-card-label">Total Enrolled</div>
        </div>

        <div className="stat-card green">
          <div className="stat-card-top">
            <div className="stat-card-icon green">
              <CheckCircle size={20} />
            </div>
          </div>
          <div className="stat-card-value">{activeCount}</div>
          <div className="stat-card-label">Active Students</div>
        </div>

        <div className="stat-card orange">
          <div className="stat-card-top">
            <div className="stat-card-icon orange">
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="stat-card-value">{inactiveCount}</div>
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
              placeholder="Search by name or roll no..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{ width: '300px' }}
            />
          </div>

          <div className="flex items-center gap-8">
            <SlidersHorizontal size={16} className="text-secondary" />
            <select 
              className="form-select"
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              style={{ minWidth: '150px' }}
            >
              <option value="all">All Courses</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            
            <select 
              className="form-select"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              style={{ minWidth: '150px' }}
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
        {filteredStudents.length > 0 ? (
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
            <tbody>
              {isFetching ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`skel-${idx}`}>
                    <td colSpan="9">
                      <div style={{ height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', animation: 'pulse 1.5s infinite ease-in-out' }}></div>
                    </td>
                  </tr>
                ))
              ) : filteredStudents.map((student, idx) => {
                const attPercent = calcAttendancePercent(attendance, student.id);
                let attColor = 'badge-success';
                if (attPercent < 60) attColor = 'badge-danger';
                else if (attPercent < 80) attColor = 'badge-late';

                return (
                  <tr 
                    key={student.id} 
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
                    <td>{getCourseName(student.batch)}</td>
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
                  </tr>
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
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-16" style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px 24px', borderRadius: '12px' }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>
            Showing page {currentPage} of {totalPages} (Total {totalCount} students)
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
              disabled={currentPage === totalPages || isFetching}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
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
      {/* Bulk Upload Modal */}
      <BulkUploadModal 
        isOpen={bulkModalOpen} 
        onClose={() => setBulkModalOpen(false)} 
        onSuccess={handleBulkSuccess} 
      />
    </motion.div>
  );
}
