import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Search, Edit2, Trash2, SlidersHorizontal, Users, CheckCircle, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { calcAttendancePercent } from '../utils/helpers';
import { getAvatarClass, getInitials } from '../data/sampleData';
import AddStudentModal from '../components/AddStudentModal';
import StudentProfileModal from '../components/StudentProfileModal';

export default function Students() {
  const { students, batches, attendance, tests, testResults, smsHistory, addStudent, updateStudent, deleteStudent } = useApp();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [selectedStudentForProfile, setSelectedStudentForProfile] = useState(null);

  // Filters
  const filteredStudents = students.filter((student) => {
    const matchesSearch = 
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.rollNo.includes(searchQuery);
    
    const matchesBatch = selectedBatch === 'all' || student.batch === selectedBatch;
    
    return matchesSearch && matchesBatch;
  });

  // Stats
  const totalCount = students.length;
  const activeCount = students.filter((s) => s.status === 'active').length;
  const inactiveCount = totalCount - activeCount;

  const handleAddClick = () => {
    setEditingStudent(null);
    setModalOpen(true);
  };

  const handleEditClick = (student) => {
    setEditingStudent(student);
    setModalOpen(true);
  };

  const handleSave = (formData) => {
    if (editingStudent) {
      updateStudent(editingStudent.id, formData);
    } else {
      addStudent(formData);
    }
    setModalOpen(false);
    setEditingStudent(null);
  };

  const handleDelete = (id, name) => {
    if (window.confirm(`Are you sure you want to delete ${name}?`)) {
      deleteStudent(id);
    }
  };

  // Get batch name
  const getBatchName = (batchId) => {
    const batch = batches.find((b) => b.id === batchId);
    return batch ? batch.name : 'Unknown';
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
          <h1>Students Directory</h1>
          <p>Enrolled students details, batches, parents info, and attendance statistics.</p>
        </div>
        <button className="btn btn-primary" onClick={handleAddClick}>
          <UserPlus size={18} />
          Add Student
        </button>
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
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '300px' }}
            />
          </div>

          <div className="flex items-center gap-8">
            <SlidersHorizontal size={16} className="text-secondary" />
            <select
              className="form-select"
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              style={{ minWidth: '200px', padding: '8px 36px 8px 14px' }}
            >
              <option value="all">All Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
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
                <th>Batch</th>
                <th>Parent Name</th>
                <th>Parent Phone</th>
                <th>Attendance</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student, idx) => {
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
                    <td>{getBatchName(student.batch)}</td>
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
    </motion.div>
  );
}
