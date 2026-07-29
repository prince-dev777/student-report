import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Plus, LogOut, Building, User, Calendar, Trash2, Key, Save, X, Edit3, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SuperAdminDashboard() {
  const [institutes, setInstitutes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInst, setSelectedInst] = useState(null); 
  
  // New Institute Form
  const [newInst, setNewInst] = useState({
    instituteName: '',
    adminName: '',
    username: '',
    password: ''
  });
  const [isCreating, setIsCreating] = useState(false);

  // Detail View States
  const [newPassword, setNewPassword] = useState('');
  const [notes, setNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('superadminToken');
    if (!token) {
      navigate('/superadmin');
      return;
    }
    fetchInstitutes();

    // Mouse movement for background texture parallax
    const handleMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 30; // 30px movement
      const y = (e.clientY / window.innerHeight - 0.5) * 30;
      document.documentElement.style.setProperty('--bg-x', `${x}px`);
      document.documentElement.style.setProperty('--bg-y', `${y}px`);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [navigate]);

  const fetchInstitutes = async () => {
    try {
      const token = localStorage.getItem('superadminToken');
      const res = await fetch('http://localhost:5000/api/superadmin/institutes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInstitutes(data);
      } else if (res.status === 401) {
        handleLogout();
      } else {
        toast.error('Failed to fetch institutes');
      }
    } catch (err) {
      toast.error('Network error fetching institutes');
    }
    setIsLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('superadminToken');
    navigate('/superadmin');
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    
    try {
      const token = localStorage.getItem('superadminToken');
      const res = await fetch('http://localhost:5000/api/superadmin/create-institute', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newInst)
      });
      
      const data = await res.json();
      if (res.ok) {
        toast.success('Institute created successfully!');
        setShowCreateModal(false);
        setNewInst({ instituteName: '', adminName: '', username: '', password: '' });
        fetchInstitutes(); // refresh list
      } else {
        toast.error(data.error || 'Failed to create institute');
      }
    } catch (err) {
      toast.error('Network error during creation');
    }
    
    setIsCreating(false);
  };

  const openDetails = (inst) => {
    setSelectedInst(inst);
    setNotes(inst.notes || '');
    setNewPassword('');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you absolutely sure you want to permanently delete this institute and its owner account? This cannot be undone.')) return;
    
    try {
      const token = localStorage.getItem('superadminToken');
      const res = await fetch(`http://localhost:5000/api/superadmin/institutes/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        toast.success('Institute deleted');
        setSelectedInst(null);
        fetchInstitutes();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete');
      }
    } catch (err) {
      toast.error('Network error');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      const token = localStorage.getItem('superadminToken');
      const res = await fetch(`http://localhost:5000/api/superadmin/institutes/${selectedInst._id}/reset-password`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword })
      });
      
      if (res.ok) {
        toast.success('Password reset successfully');
        setNewPassword('');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to reset password');
      }
    } catch (err) {
      toast.error('Network error');
    }
  };

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      const token = localStorage.getItem('superadminToken');
      const res = await fetch(`http://localhost:5000/api/superadmin/institutes/${selectedInst._id}/notes`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ notes })
      });
      
      if (res.ok) {
        toast.success('Notes saved');
        fetchInstitutes(); // To update the local list state silently
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save notes');
      }
    } catch (err) {
      toast.error('Network error');
    }
    setIsSavingNotes(false);
  };

  if (isLoading) {
    return (
      <div className="superadmin-container loading-state">
        <div className="loader"></div>
        <p>Initializing Super Admin Secure Portal...</p>
      </div>
    );
  }

  return (
    <div className="superadmin-container">
      {/* Light Blue Texture Background */}
      <div className="bg-texture"></div>
      <div className="bg-shape shape1"></div>
      <div className="bg-shape shape2"></div>
      
      <div className="superadmin-topbar">
        <div className="brand">
          <div className="brand-icon">
            <ShieldAlert size={28} color="#2563eb" />
          </div>
          <div>
            <h2>Super Admin Portal</h2>
            <span className="badge">Global Access</span>
          </div>
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          <LogOut size={18} /> Disconnect
        </button>
      </div>

      <div className="superadmin-content">
        <div className="content-header">
          <div className="header-text">
            <h3>Registered Institutes</h3>
            <p>Manage, monitor, and provision all coaching institutes on the SaaS platform.</p>
          </div>
          <button className="create-btn" onClick={() => setShowCreateModal(true)}>
            <Plus size={20} /> Add New Institute
          </button>
        </div>

        <div className="institutes-grid">
          {institutes.length === 0 ? (
            <div className="empty-state">
              <Building size={48} opacity={0.3} color="#475569" />
              <p>No institutes registered yet. Click 'Add New Institute' to provision your first client.</p>
            </div>
          ) : (
            institutes.map(inst => (
              <div key={inst._id} className="institute-card" onClick={() => openDetails(inst)}>
                <div className="inst-card-top">
                  {inst.logo ? (
                    <img src={inst.logo} alt="Logo" className="inst-logo" />
                  ) : (
                    <div className="inst-logo-placeholder">
                      {inst.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="status-dot"></div>
                </div>
                <h4 className="inst-name">{inst.name}</h4>
                <div className="inst-details-compact">
                  <div><User size={14} /> {inst.adminName}</div>
                  <div><Calendar size={14} /> {new Date(inst.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="inst-card-footer">
                  <span>Manage Details</span>
                  <ChevronRight size={16} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* --- CREATE INSTITUTE MODAL --- */}
      {showCreateModal && (
        <div className="modal-overlay glass" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content create-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Provision New Institute</h3>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}><X size={24}/></button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="form-group">
                <label>Institute Name</label>
                <input type="text" required value={newInst.instituteName} onChange={(e) => setNewInst({...newInst, instituteName: e.target.value})} placeholder="e.g. Apex Classes" />
              </div>
              <div className="form-group">
                <label>Owner Full Name</label>
                <input type="text" required value={newInst.adminName} onChange={(e) => setNewInst({...newInst, adminName: e.target.value})} placeholder="e.g. Rahul Sharma" />
              </div>
              <div className="form-group">
                <label>Master Login Username</label>
                <input type="text" required value={newInst.username} onChange={(e) => setNewInst({...newInst, username: e.target.value})} placeholder="e.g. apexadmin" />
              </div>
              <div className="form-group">
                <label>Temporary Password</label>
                <input type="text" required value={newInst.password} onChange={(e) => setNewInst({...newInst, password: e.target.value})} placeholder="Provide a strong password" />
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="save-btn" disabled={isCreating}>
                  {isCreating ? 'Provisioning...' : 'Provision Institute'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DETAILED VIEW MODAL --- */}
      {selectedInst && (
        <div className="modal-overlay glass" onClick={() => setSelectedInst(null)}>
          <div className="modal-content detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="detail-title">
                {selectedInst.logo ? (
                  <img src={selectedInst.logo} alt="Logo" className="detail-logo" />
                ) : (
                  <div className="detail-logo-placeholder"><Building size={20}/></div>
                )}
                <div>
                  <h3>{selectedInst.name}</h3>
                  <span className="inst-id">ID: {selectedInst._id}</span>
                </div>
              </div>
              <button className="close-btn" onClick={() => setSelectedInst(null)}><X size={24}/></button>
            </div>

            <div className="detail-body">
              {/* Info Grid */}
              <div className="info-grid">
                <div className="info-box">
                  <span className="label">Owner Name</span>
                  <span className="value">{selectedInst.adminName}</span>
                </div>
                <div className="info-box">
                  <span className="label">Username</span>
                  <span className="value highlight">{selectedInst.username}</span>
                </div>
                <div className="info-box">
                  <span className="label">Joined Date</span>
                  <span className="value">{new Date(selectedInst.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="info-box">
                  <span className="label">Status</span>
                  <span className="value status-active">Active</span>
                </div>
              </div>

              {/* Password Reset Section */}
              <div className="section-box password-section">
                <h4><Key size={18}/> Reset Owner Password</h4>
                <p>Generate a new password for the institute owner if they lose access.</p>
                <form onSubmit={handleResetPassword} className="reset-form">
                  <input 
                    type="text" 
                    placeholder="Enter new password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button type="submit" className="reset-btn">Update Password</button>
                </form>
              </div>

              {/* Private Notes Section */}
              <div className="section-box notes-section">
                <div className="section-header">
                  <h4><Edit3 size={18}/> Admin Private Notes</h4>
                  <button onClick={handleSaveNotes} disabled={isSavingNotes} className="save-notes-btn">
                    <Save size={16}/> {isSavingNotes ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>
                <p>Keep track of payments, renewals, and custom agreements here. (Not visible to the client)</p>
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Paid Rs 5000 for 1 year plan on 25 July 2026. Next renewal due in 2027."
                  rows="4"
                ></textarea>
              </div>

              {/* Danger Zone */}
              <div className="section-box danger-zone">
                <h4>Danger Zone</h4>
                <p>Permanently remove this institute and revoke all access. This action cannot be reversed.</p>
                <button onClick={() => handleDelete(selectedInst._id)} className="delete-btn">
                  <Trash2 size={18}/> Delete Institute
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- STYLES --- */}
      <style>{`
        :root {
          --bg-x: 0px;
          --bg-y: 0px;
        }
        
        .superadmin-container {
          min-height: 100vh;
          background-color: #f0f9ff; /* Light Sky Blue */
          background-image: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
          color: #0f172a; /* Dark text for high contrast */
          font-family: 'Inter', system-ui, sans-serif;
          position: relative;
          overflow-x: hidden;
        }

        /* Interactive Texture Background */
        .bg-texture {
          position: fixed;
          top: -50px; left: -50px; right: -50px; bottom: -50px;
          background-image: radial-gradient(#94a3b8 1px, transparent 1px);
          background-size: 24px 24px;
          opacity: 0.4;
          z-index: 0;
          transform: translate(var(--bg-x), var(--bg-y));
          transition: transform 0.1s ease-out;
          pointer-events: none;
        }
        
        /* Loading */
        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #0f172a;
        }
        .loader {
          border: 4px solid rgba(15, 23, 42, 0.1);
          border-left-color: #2563eb;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        /* Dynamic Background Shapes */
        .bg-shape {
          position: fixed;
          border-radius: 50%;
          filter: blur(120px);
          z-index: 0;
          opacity: 0.6;
        }
        .shape1 {
          width: 500px;
          height: 500px;
          background: #7dd3fc;
          top: -100px;
          right: -100px;
        }
        .shape2 {
          width: 600px;
          height: 600px;
          background: #bfdbfe;
          bottom: -200px;
          left: -100px;
        }

        /* Topbar */
        .superadmin-topbar {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 40px;
          background: rgba(255, 255, 255, 0.6);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255,255,255,0.4);
          box-shadow: 0 4px 20px rgba(0,0,0,0.02);
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .brand-icon {
          background: rgba(37, 99, 235, 0.1);
          padding: 10px;
          border-radius: 12px;
          display: flex;
        }
        .brand h2 {
          margin: 0;
          font-size: 1.4rem;
          font-weight: 800;
          letter-spacing: -0.5px;
          color: #0f172a;
        }
        .badge {
          font-size: 0.7rem;
          background: #2563eb;
          color: white;
          padding: 3px 10px;
          border-radius: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .logout-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: white;
          border: 1px solid #cbd5e1;
          color: #334155;
          padding: 10px 20px;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }
        .logout-btn:hover {
          background: #f1f5f9;
          color: #ef4444;
          border-color: #ef4444;
        }

        /* Content */
        .superadmin-content {
          position: relative;
          z-index: 10;
          padding: 40px;
          max-width: 1400px;
          margin: 0 auto;
        }
        .content-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 40px;
        }
        .header-text h3 {
          margin: 0 0 8px 0;
          font-size: 2.2rem;
          font-weight: 800;
          color: #0f172a;
        }
        .header-text p {
          margin: 0;
          color: #475569;
          font-size: 1.1rem;
          font-weight: 500;
        }
        .create-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          border: none;
          color: white;
          padding: 14px 28px;
          border-radius: 12px;
          font-size: 1.05rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 10px 20px -5px rgba(37, 99, 235, 0.4);
        }
        .create-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 25px -5px rgba(37, 99, 235, 0.5);
        }

        /* Grid */
        .institutes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }
        .empty-state {
          grid-column: 1 / -1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px;
          background: rgba(255, 255, 255, 0.5);
          backdrop-filter: blur(10px);
          border: 1px dashed #94a3b8;
          border-radius: 24px;
          color: #475569;
          gap: 16px;
          font-weight: 500;
        }
        
        /* Card */
        .institute-card {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(20px);
          border-radius: 20px;
          padding: 20px;
          border: 1px solid rgba(255,255,255,0.6);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          box-shadow: 0 10px 30px -10px rgba(0,0,0,0.05);
        }
        .institute-card:hover {
          transform: translateY(-8px);
          background: rgba(255, 255, 255, 0.95);
          border-color: rgba(255,255,255,1);
          box-shadow: 0 25px 50px -15px rgba(37, 99, 235, 0.2);
        }
        .inst-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }
        .inst-logo {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          object-fit: cover;
          background: white;
          box-shadow: 0 4px 10px rgba(0,0,0,0.05);
        }
        .inst-logo-placeholder {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 1.4rem;
          font-weight: 800;
          box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2);
        }
        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.6);
        }
        .inst-name {
          margin: 0 0 12px 0;
          font-size: 1.2rem;
          font-weight: 700;
          color: #0f172a;
        }
        .inst-details-compact {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 20px;
          flex-grow: 1;
        }
        .inst-details-compact div {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #475569;
          font-size: 0.85rem;
          font-weight: 500;
        }
        .inst-details-compact svg {
          color: #94a3b8;
        }
        .inst-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 16px;
          border-top: 1px solid rgba(0,0,0,0.05);
          color: #2563eb;
          font-size: 0.95rem;
          font-weight: 600;
          transition: 0.2s;
        }
        .institute-card:hover .inst-card-footer {
          color: #1d4ed8;
          padding-right: 5px; /* slight animation */
        }

        /* Modals */
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.4); /* Dark semi-transparent */
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        .modal-overlay.glass {
          backdrop-filter: blur(12px);
        }
        .modal-content {
          background: white;
          border-radius: 28px;
          border: 1px solid rgba(255,255,255,0.8);
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25), 0 0 40px rgba(0,0,0,0.1);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          max-height: 90vh;
        }
        .create-modal {
          width: 100%;
          max-width: 500px;
          padding: 32px;
        }
        .detail-modal {
          width: 100%;
          max-width: 750px;
        }
        
        /* Modal Header */
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
        }
        .modal-header h3 {
          margin: 0;
          font-size: 1.6rem;
          font-weight: 700;
          color: #0f172a;
        }
        .close-btn {
          background: white;
          border: 1px solid #cbd5e1;
          color: #64748b;
          width: 40px; height: 40px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: 0.2s;
          box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }
        .close-btn:hover {
          background: #fee2e2;
          color: #ef4444;
          border-color: #fca5a5;
        }

        /* Detail Modal specific */
        .detail-title {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .detail-logo, .detail-logo-placeholder {
          width: 48px; height: 48px;
          border-radius: 12px;
        }
        .detail-logo-placeholder {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          display: flex; align-items: center; justify-content: center;
          color: white;
        }
        .inst-id {
          font-size: 0.85rem;
          color: #64748b;
          font-family: monospace;
          background: #f1f5f9;
          padding: 4px 8px;
          border-radius: 6px;
          margin-top: 4px;
          display: inline-block;
        }

        .detail-body {
          padding: 24px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
          background: white;
        }

        /* Info Grid */
        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }
        .info-box {
          background: #f8fafc;
          padding: 16px;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .info-box .label {
          color: #64748b;
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }
        .info-box .value {
          font-size: 1rem;
          font-weight: 700;
          color: #0f172a;
        }
        .info-box .value.highlight {
          color: #2563eb;
        }
        .status-active {
          color: #059669 !important;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .status-active::before {
          content: '';
          display: block;
          width: 10px; height: 10px;
          background: #10b981;
          border-radius: 50%;
        }

        /* Sections */
        .section-box {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.02);
        }
        .section-box h4 {
          margin: 0 0 8px 0;
          font-size: 1.1rem;
          font-weight: 700;
          color: #0f172a;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .section-box p {
          margin: 0 0 16px 0;
          color: #64748b;
          font-size: 0.85rem;
          line-height: 1.5;
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .section-header h4 { margin: 0; }

        /* Forms inside modals */
        .reset-form {
          display: flex;
          gap: 16px;
        }
        .reset-form input {
          flex-grow: 1;
          padding: 12px 16px;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          font-size: 1rem;
          color: #0f172a;
          transition: 0.2s;
        }
        .reset-form input:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
          background: white;
        }
        .reset-btn {
          background: #f8fafc;
          color: #0f172a;
          border: 1px solid #cbd5e1;
          padding: 0 24px;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.2s;
          white-space: nowrap;
        }
        .reset-btn:hover {
          background: #0f172a;
          color: white;
          border-color: #0f172a;
        }

        .save-notes-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #ecfdf5;
          color: #059669;
          border: 1px solid #a7f3d0;
          padding: 10px 20px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 0.95rem;
          font-weight: 600;
          transition: 0.2s;
        }
        .save-notes-btn:hover {
          background: #d1fae5;
        }

        textarea {
          width: 100%;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 16px;
          padding: 20px;
          color: #0f172a;
          resize: vertical;
          font-family: inherit;
          font-size: 1rem;
          line-height: 1.5;
          transition: 0.2s;
        }
        textarea:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
          background: white;
        }

        /* Danger Zone */
        .danger-zone {
          border-color: #fecaca;
          background: #fef2f2;
        }
        .danger-zone h4 {
          color: #dc2626;
        }
        .delete-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: white;
          color: #dc2626;
          border: 1px solid #fecaca;
          padding: 12px 24px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
          font-size: 1rem;
          transition: 0.2s;
          box-shadow: 0 2px 5px rgba(220, 38, 38, 0.05);
        }
        .delete-btn:hover {
          background: #dc2626;
          color: white;
          border-color: #dc2626;
        }

        /* Create Form */
        .form-group { margin-bottom: 24px; }
        .form-group label {
          display: block; margin-bottom: 10px;
          color: #475569; font-size: 0.95rem; font-weight: 600;
        }
        .form-group input {
          width: 100%;
          padding: 14px 18px;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          color: #0f172a;
          font-size: 1rem;
          transition: 0.2s;
        }
        .form-group input:focus {
          outline: none;
          border-color: #2563eb;
          background: white;
          box-shadow: 0 0 0 4px rgba(37,99,235,0.1);
        }
        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 16px;
          margin-top: 40px;
        }
        .cancel-btn, .save-btn {
          padding: 14px 28px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 1.05rem;
          cursor: pointer;
          transition: 0.2s;
        }
        .cancel-btn {
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          color: #475569;
        }
        .cancel-btn:hover {
          background: #e2e8f0;
          color: #0f172a;
        }
        .save-btn {
          background: #2563eb;
          border: none;
          color: white;
          box-shadow: 0 4px 12px rgba(37,99,235,0.2);
        }
        .save-btn:hover {
          background: #1d4ed8;
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
}
