import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Edit, Trash2, Phone, Calendar } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';
import { generateId, getTodayStr } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function Inquiries() {
  const { inquiries, setInquiries, backendOnline } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(null);

  const [formData, setFormData] = useState({
    visitorName: '',
    studentName: '',
    contactNumber: '',
    discussionDetails: '',
    status: 'Pending',
    date: getTodayStr()
  });

  const filteredInquiries = inquiries.filter(
    (iq) =>
      (iq.visitorName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (iq.studentName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (iq.contactNumber || '').includes(searchTerm)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!backendOnline) return toast.error('Offline mode: Cannot save inquiries');

    try {
      if (isEditing) {
        const updated = await api.updateInquiry(isEditing.id, formData);
        setInquiries(prev => prev.map(iq => iq.id === updated.id ? updated : iq));
        toast.success('Inquiry updated successfully!');
      } else {
        const newInquiry = { ...formData, id: generateId('INQ') };
        const saved = await api.createInquiry(newInquiry);
        setInquiries(prev => [saved, ...prev]);
        toast.success('New inquiry added!');
      }
      closeModal();
    } catch (err) {
      toast.error('Failed to save inquiry');
    }
  };

  const handleDelete = async (id) => {
    if (!backendOnline) return toast.error('Offline mode');
    if (!window.confirm('Delete this inquiry?')) return;

    try {
      await api.deleteInquiry(id);
      setInquiries(prev => prev.filter(iq => iq.id !== id));
      toast.success('Inquiry deleted');
    } catch (err) {
      toast.error('Failed to delete inquiry');
    }
  };

  const openEditModal = (iq) => {
    setIsEditing(iq);
    setFormData({
      visitorName: iq.visitorName,
      studentName: iq.studentName,
      contactNumber: iq.contactNumber,
      discussionDetails: iq.discussionDetails || '',
      status: iq.status,
      date: iq.date
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsEditing(null);
    setFormData({
      visitorName: '',
      studentName: '',
      contactNumber: '',
      discussionDetails: '',
      status: 'Pending',
      date: getTodayStr()
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Pending': return <span className="badge badge-warning">Pending</span>;
      case 'Resolved': return <span className="badge badge-success">Resolved</span>;
      case 'Admitted': return <span className="badge badge-primary">Admitted</span>;
      case 'Rejected': return <span className="badge badge-danger">Rejected</span>;
      default: return null;
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="page-container">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Inquiry Management</h1>
          <p className="page-subtitle">Track prospective admissions and visitor discussions.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={20} /> Add Inquiry
        </button>
      </div>

      <div className="card mb-6">
        <div className="search-bar">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by visitor, student name, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="table-container card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Visitor Name</th>
              <th>Student Name</th>
              <th>Contact Number</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInquiries.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-4 text-muted">No inquiries found.</td>
              </tr>
            ) : (
              filteredInquiries.map((iq) => (
                <tr key={iq.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-muted" />
                      {iq.date}
                    </div>
                  </td>
                  <td className="font-medium">{iq.visitorName}</td>
                  <td>{iq.studentName}</td>
                  <td>
                    <div className="flex items-center gap-2 text-primary">
                      <Phone size={14} />
                      <a href={`tel:${iq.contactNumber}`}>{iq.contactNumber}</a>
                    </div>
                  </td>
                  <td>{getStatusBadge(iq.status)}</td>
                  <td className="text-right">
                    <button className="btn btn-icon mr-2" onClick={() => openEditModal(iq)}>
                      <Edit size={18} className="text-primary" />
                    </button>
                    <button className="btn btn-icon text-danger" onClick={() => handleDelete(iq.id)}>
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{isEditing ? 'Edit Inquiry' : 'New Inquiry'}</h2>
              <button className="modal-close" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Visitor / Parent Name</label>
                  <input type="text" className="form-input" required value={formData.visitorName} onChange={e => setFormData({...formData, visitorName: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Prospective Student Name</label>
                  <input type="text" className="form-input" required value={formData.studentName} onChange={e => setFormData({...formData, studentName: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label">Contact Number</label>
                    <input type="text" className="form-input" required value={formData.contactNumber} onChange={e => setFormData({...formData, contactNumber: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input type="date" className="form-input" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Discussion Details / Notes</label>
                  <textarea className="form-input" rows="3" value={formData.discussionDetails} onChange={e => setFormData({...formData, discussionDetails: e.target.value})}></textarea>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                    <option value="Pending">Pending</option>
                    <option value="Resolved">Resolved (Interested)</option>
                    <option value="Admitted">Admitted</option>
                    <option value="Rejected">Rejected (Not Interested)</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline mr-2" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">{isEditing ? 'Update Inquiry' : 'Save Inquiry'}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
