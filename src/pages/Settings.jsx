import React, { useState, useEffect } from 'react';
import { 
  Database, HardDrive, Trash2, RefreshCw, FolderSearch, 
  Image, FileText, Users, Calendar, MessageSquare, 
  CheckCircle2, AlertTriangle, Search, Eye, X, ShieldAlert,
  Download, Sparkles, Filter, ChevronRight, Layers, UserCheck, Cloud, Terminal
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api, API_BASE } from '../utils/api';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('collections'); // 'collections' | 'media' | 'maintenance'
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);

  // Collection Inspection Modal State
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [collectionItems, setCollectionItems] = useState([]);
  const [collectionFilter, setCollectionFilter] = useState('all'); // 'all' | 'active' | 'deleted'
  const [collectionSearch, setCollectionSearch] = useState('');
  const [itemsLoading, setItemsLoading] = useState(false);

  // Wipe Collection Modal State
  const [wipeModalOpen, setWipeModalOpen] = useState(false);
  const [wipeTarget, setWipeTarget] = useState(null);
  const [wipeConfirmText, setWipeConfirmText] = useState('');
  const [isWiping, setIsWiping] = useState(false);

  // Media Inspection Modal State
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState(null);
  const [mediaFilter, setMediaFilter] = useState('all'); // 'all' | 'omr' | 'photos' | 'avatars'
  const [mediaSearch, setMediaSearch] = useState('');
  const [isPurgingFiles, setIsPurgingFiles] = useState(false);
  const [cloudinaryStats, setCloudinaryStats] = useState(null);
  const [isPurgingCloudinary, setIsPurgingCloudinary] = useState(false);

  // Debug Logs State
  const [systemLogs, setSystemLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Fetch Database Overview & Cloudinary Stats & Logs
  const fetchOverview = async () => {
    try {
      setLoading(true);
      const [data, cStats, logData] = await Promise.all([
        api.getDatabaseOverview(),
        api.getCloudinaryStats().catch(() => null),
        api.getSystemLogs().catch(() => ({ logs: [] }))
      ]);
      setOverview(data);
      if (cStats) setCloudinaryStats(cStats);
      if (logData?.logs) setSystemLogs(logData.logs);
    } catch (err) {
      console.error('Failed to fetch database overview:', err);
      toast.error('Failed to load database overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  // Open Collection Inspection Drawer/Modal
  const handleInspectCollection = async (collKey, collName) => {
    setSelectedCollection({ key: collKey, name: collName });
    setInspectModalOpen(true);
    setCollectionFilter('all');
    setCollectionSearch('');
    await fetchCollectionItems(collKey, 'all', '');
  };

  const fetchCollectionItems = async (collKey, filter, search) => {
    try {
      setItemsLoading(true);
      const data = await api.getDatabaseItems(collKey, filter, search);
      setCollectionItems(data.items || []);
    } catch (err) {
      toast.error('Failed to fetch collection items');
    } finally {
      setItemsLoading(false);
    }
  };

  // Delete Individual Document Permanently
  const handleDeleteItem = async (id, name = 'Record') => {
    if (!window.confirm(`⚠️ Are you sure you want to permanently delete this ${name} from local DB? This cannot be undone.`)) {
      return;
    }
    try {
      await api.deleteDatabaseItem(selectedCollection.key, id);
      toast.success('Record permanently deleted from local DB!');
      await fetchCollectionItems(selectedCollection.key, collectionFilter, collectionSearch);
      fetchOverview();
    } catch (err) {
      toast.error(err.message || 'Failed to delete record');
    }
  };

  // Purge Soft-Deleted Records
  const handlePurgeDeleted = async (collKey = 'all') => {
    const targetLabel = collKey === 'all' ? 'ALL collections across the database' : `'${collKey}'`;
    if (!window.confirm(`⚠️ Permanently purge all soft-deleted trash records from ${targetLabel}?`)) {
      return;
    }
    try {
      const res = await api.purgeDeletedRecords(collKey);
      toast.success(res.message || 'Trash purged successfully!');
      fetchOverview();
      if (inspectModalOpen && selectedCollection) {
        fetchCollectionItems(selectedCollection.key, collectionFilter, collectionSearch);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to purge deleted records');
    }
  };

  // Wipe Entire Collection
  const handleExecuteWipe = async () => {
    if (wipeConfirmText !== 'WIPE') {
      toast.error('Please type WIPE to confirm');
      return;
    }
    try {
      setIsWiping(true);
      const res = await api.wipeCollection(wipeTarget.key, 'WIPE');
      toast.success(res.message || 'Collection wiped successfully!');
      setWipeModalOpen(false);
      setWipeConfirmText('');
      setWipeTarget(null);
      fetchOverview();
    } catch (err) {
      toast.error(err.message || 'Failed to wipe collection');
    } finally {
      setIsWiping(false);
    }
  };

  // Purge Orphaned Files (Files not linked to active DB records)
  const handlePurgeOrphanedFiles = async () => {
    if (!window.confirm('🔍 Scan and permanently delete unlinked / orphaned OMR scans and student photos from local disk?')) {
      return;
    }
    try {
      setIsPurgingFiles(true);
      const res = await api.purgeOrphanedFiles();
      toast.success(`🎉 ${res.message}`);
      fetchOverview();
    } catch (err) {
      toast.error(err.message || 'Failed to purge orphaned files');
    } finally {
      setIsPurgingFiles(false);
    }
  };

  // Purge Unwanted / Unpublished OMR Images from Cloudinary
  const handlePurgeCloudinaryUnwanted = async () => {
    if (!window.confirm('☁️ Purge all unpublished and orphaned OMR scans from Cloudinary storage?')) {
      return;
    }
    try {
      setIsPurgingCloudinary(true);
      const res = await api.purgeCloudinaryUnwanted();
      toast.success(`🎉 ${res.message}`);
      fetchOverview();
    } catch (err) {
      toast.error(err.message || 'Failed to purge Cloudinary images');
    } finally {
      setIsPurgingCloudinary(false);
    }
  };

  // Fetch / Refresh System Logs
  const fetchLogs = async () => {
    try {
      setLogsLoading(true);
      const res = await api.getSystemLogs();
      if (res?.logs) setSystemLogs(res.logs);
      toast.success('Logs refreshed!');
    } catch (e) {
      toast.error('Failed to fetch logs');
    } finally {
      setLogsLoading(false);
    }
  };

  // Download Debug Logs as text file
  const handleDownloadLogs = async () => {
    try {
      const response = await fetch(`${API_BASE}/system/download-logs`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('Failed to download logs');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CareerXone_Debug_Logs_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Logs downloaded successfully!');
    } catch (err) {
      toast.error(err.message || 'Failed to download logs');
    }
  };

  // Delete Individual Media File
  const handleDeleteMediaFile = async (folder, filename) => {
    if (!window.confirm(`⚠️ Delete local media file '${filename}'?`)) return;
    try {
      await api.deleteMediaFile(folder, filename);
      toast.success('File deleted from local disk!');
      fetchOverview();
    } catch (err) {
      toast.error(err.message || 'Failed to delete media file');
    }
  };

  // Compute combined media list for gallery
  const allMediaList = [];
  if (overview?.media) {
    if (overview.media.omr?.files) {
      overview.media.omr.files.forEach(f => allMediaList.push({ ...f, folder: 'omr', tag: 'OMR Scan' }));
    }
    if (overview.media.photos?.files) {
      overview.media.photos.files.forEach(f => allMediaList.push({ ...f, folder: 'photos', tag: 'Student Photo' }));
    }
    if (overview.media.avatars?.files) {
      overview.media.avatars.files.forEach(f => allMediaList.push({ ...f, folder: 'avatars', tag: 'Avatar' }));
    }
  }

  const filteredMedia = allMediaList.filter(m => {
    if (mediaFilter !== 'all' && m.folder !== mediaFilter) return false;
    if (mediaSearch && !m.name.toLowerCase().includes(mediaSearch.toLowerCase())) return false;
    return true;
  });

  const totalDbRecords = overview?.collections?.reduce((acc, c) => acc + c.total, 0) || 0;
  const totalTrashRecords = overview?.collections?.reduce((acc, c) => acc + c.deleted, 0) || 0;

  return (
    <div className="page-container" style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '60px' }}>
      
      {/* Header Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(59, 130, 246, 0.3)'
            }}>
              <Database size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--text-main, #0f172a)' }}>
                Local Database & Storage Settings
              </h1>
              <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-muted, #64748b)' }}>
                Inspect local MongoDB tables, purge soft-deleted trash, and manage stored OMR scans & student photos.
              </p>
            </div>
          </div>
        </div>

        {/* Global Quick Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={fetchOverview}
            disabled={loading}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Refresh Stats</span>
          </button>

          <button
            onClick={() => handlePurgeDeleted('all')}
            className="btn btn-danger"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 14px',
              cursor: 'pointer'
            }}
          >
            <Trash2 size={15} />
            <span>Empty All Trash ({totalTrashRecords})</span>
          </button>
        </div>
      </div>

      {/* Top 4 Storage Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px',
        marginBottom: '28px'
      }}>
        {/* Card 1: Total Local Records */}
        <div className="card" style={{ padding: '20px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' }}>
              Database Documents
            </span>
            <div style={{ background: '#3b82f615', color: '#3b82f6', padding: '8px', borderRadius: '10px' }}>
              <Layers size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-main, #0f172a)' }}>
            {loading ? '...' : totalDbRecords}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
            <strong style={{ color: '#10b981' }}>{totalDbRecords - totalTrashRecords} Active</strong> · <span style={{ color: '#ef4444' }}>{totalTrashRecords} In Trash</span>
          </div>
        </div>

        {/* Card 2: OMR Scans on Disk */}
        <div className="card" style={{ padding: '20px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' }}>
              OMR Scans on Disk
            </span>
            <div style={{ background: '#8b5cf615', color: '#8b5cf6', padding: '8px', borderRadius: '10px' }}>
              <FileText size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-main, #0f172a)' }}>
            {loading ? '...' : overview?.media?.omr?.count || 0}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#8b5cf6', marginTop: '4px', fontWeight: 600 }}>
            Disk Size: {overview?.media?.omr?.sizeFormatted || '0 KB'}
          </div>
        </div>

        {/* Card 3: Student Photos */}
        <div className="card" style={{ padding: '20px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' }}>
              Student Photos
            </span>
            <div style={{ background: '#10b98115', color: '#10b981', padding: '8px', borderRadius: '10px' }}>
              <Image size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-main, #0f172a)' }}>
            {loading ? '...' : (overview?.media?.photos?.count || 0) + (overview?.media?.avatars?.count || 0)}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#10b981', marginTop: '4px', fontWeight: 600 }}>
            Disk Size: {overview?.media?.photos?.sizeFormatted || '0 KB'}
          </div>
        </div>

        {/* Card 4: Total Storage Used */}
        <div className="card" style={{ padding: '20px', borderRadius: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted, #64748b)', textTransform: 'uppercase' }}>
              Total Media Storage
            </span>
            <div style={{ background: '#f59e0b15', color: '#f59e0b', padding: '8px', borderRadius: '10px' }}>
              <HardDrive size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-main, #0f172a)' }}>
            {loading ? '...' : overview?.media?.totalSizeFormatted || '0 KB'}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
            Across {overview?.media?.totalFiles || 0} physical image files
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        borderBottom: '2px solid var(--border-color, #e2e8f0)',
        marginBottom: '24px'
      }}>
        <button
          onClick={() => setActiveTab('collections')}
          style={{
            padding: '12px 20px',
            fontSize: '0.92rem',
            fontWeight: 700,
            border: 'none',
            background: 'transparent',
            color: activeTab === 'collections' ? '#3b82f6' : 'var(--text-muted, #64748b)',
            borderBottom: activeTab === 'collections' ? '3px solid #3b82f6' : '3px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <Database size={17} />
          <span>Database Collections ({overview?.collections?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('media')}
          style={{
            padding: '12px 20px',
            fontSize: '0.92rem',
            fontWeight: 700,
            border: 'none',
            background: 'transparent',
            color: activeTab === 'media' ? '#3b82f6' : 'var(--text-muted, #64748b)',
            borderBottom: activeTab === 'media' ? '3px solid #3b82f6' : '3px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <Image size={17} />
          <span>Media & OMR Scans Explorer ({overview?.media?.totalFiles || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('maintenance')}
          style={{
            padding: '12px 20px',
            fontSize: '0.92rem',
            fontWeight: 700,
            border: 'none',
            background: 'transparent',
            color: activeTab === 'maintenance' ? '#3b82f6' : 'var(--text-muted, #64748b)',
            borderBottom: activeTab === 'maintenance' ? '3px solid #3b82f6' : '3px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <ShieldAlert size={17} />
          <span>Advanced Maintenance & Factory Reset</span>
        </button>
      </div>

      {/* TAB 1: Database Collections Explorer */}
      {activeTab === 'collections' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {overview?.collections?.map((coll) => (
            <div key={coll.key} className="card" style={{
              padding: '20px',
              borderRadius: '16px',
              border: coll.deleted > 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-color, #e2e8f0)',
              background: 'var(--card-bg, #ffffff)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '16px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                    {coll.name}
                  </h3>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: '#f1f5f9',
                    color: '#475569'
                  }}>
                    {coll.key}
                  </span>
                </div>

                {/* Record Counts */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '14px 0 8px' }}>
                  <div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#10b981' }}>{coll.active}</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Active Records</div>
                  </div>
                  <div style={{ height: '28px', width: '1px', background: '#e2e8f0' }} />
                  <div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: coll.deleted > 0 ? '#ef4444' : '#94a3b8' }}>
                      {coll.deleted}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>In Trash</div>
                  </div>
                  <div style={{ height: '28px', width: '1px', background: '#e2e8f0' }} />
                  <div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a' }}>{coll.total}</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Total in DB</div>
                  </div>
                </div>

                {coll.extra && (
                  <div style={{ fontSize: '0.76rem', color: '#3b82f6', fontWeight: 600, marginTop: '6px' }}>
                    ℹ️ {coll.extra}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                <button
                  onClick={() => handleInspectCollection(coll.key, coll.name)}
                  className="btn btn-secondary"
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontSize: '0.8rem',
                    padding: '7px 10px'
                  }}
                >
                  <FolderSearch size={14} />
                  <span>Inspect Data</span>
                </button>

                {coll.deleted > 0 && (
                  <button
                    onClick={() => handlePurgeDeleted(coll.key)}
                    className="btn btn-danger"
                    title="Purge only soft-deleted trash records"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.8rem',
                      background: '#fee2e2',
                      color: '#b91c1c',
                      border: '1px solid #fca5a5',
                      borderRadius: '8px',
                      padding: '7px 10px',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={14} />
                    <span>Empty Trash</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setWipeTarget(coll);
                    setWipeConfirmText('');
                    setWipeModalOpen(true);
                  }}
                  title="Wipe entire collection permanently"
                  style={{
                    background: 'transparent',
                    border: '1px solid #e2e8f0',
                    color: '#ef4444',
                    padding: '7px',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <AlertTriangle size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: Media & OMR Scans Explorer */}
      {activeTab === 'media' && (
        <div>
          {/* Action Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '20px'
          }}>
            {/* Folder Filters */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setMediaFilter('all')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  border: 'none',
                  background: mediaFilter === 'all' ? '#3b82f6' : '#f1f5f9',
                  color: mediaFilter === 'all' ? '#ffffff' : '#475569',
                  cursor: 'pointer'
                }}
              >
                All Files ({allMediaList.length})
              </button>

              <button
                onClick={() => setMediaFilter('omr')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  border: 'none',
                  background: mediaFilter === 'omr' ? '#8b5cf6' : '#f1f5f9',
                  color: mediaFilter === 'omr' ? '#ffffff' : '#475569',
                  cursor: 'pointer'
                }}
              >
                OMR Scans ({overview?.media?.omr?.count || 0})
              </button>

              <button
                onClick={() => setMediaFilter('photos')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  border: 'none',
                  background: mediaFilter === 'photos' ? '#10b981' : '#f1f5f9',
                  color: mediaFilter === 'photos' ? '#ffffff' : '#475569',
                  cursor: 'pointer'
                }}
              >
                Student Photos ({overview?.media?.photos?.count || 0})
              </button>
            </div>

            {/* Search & Clean Orphaned Files */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ position: 'relative', width: '220px' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search file name..."
                  value={mediaSearch}
                  onChange={(e) => setMediaSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px 7px 32px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem'
                  }}
                />
              </div>

              <button
                onClick={handlePurgeOrphanedFiles}
                disabled={isPurgingFiles}
                style={{
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: isPurgingFiles ? 'not-allowed' : 'pointer'
                }}
              >
                <Sparkles size={15} />
                <span>{isPurgingFiles ? 'Cleaning...' : 'Clean Orphaned Files'}</span>
              </button>
            </div>
          </div>

          {/* Media Grid Gallery */}
          {filteredMedia.length === 0 ? (
            <div className="card" style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
              <Image size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <h3>No Media Files Found</h3>
              <p style={{ fontSize: '0.86rem' }}>Local uploads directory is currently clean.</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '16px'
            }}>
              {filteredMedia.map((m, idx) => (
                <div key={idx} className="card" style={{
                  padding: '12px',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  position: 'relative'
                }}>
                  {/* Thumbnail */}
                  <div
                    onClick={() => setMediaPreviewUrl(m.url)}
                    style={{
                      height: '140px',
                      borderRadius: '8px',
                      background: '#f8fafc',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <img
                      src={m.url}
                      alt={m.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => { e.target.src = '/logo.png'; }}
                    />
                  </div>

                  {/* Info */}
                  <div>
                    <div style={{
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: '#0f172a',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }} title={m.name}>
                      {m.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: m.folder === 'omr' ? '#8b5cf615' : '#10b98115',
                        color: m.folder === 'omr' ? '#8b5cf6' : '#10b981'
                      }}>
                        {m.tag}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{m.sizeFormatted}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                    <button
                      onClick={() => setMediaPreviewUrl(m.url)}
                      className="btn btn-secondary"
                      style={{ flex: 1, padding: '5px', fontSize: '0.74rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    >
                      <Eye size={13} /> View
                    </button>
                    <button
                      onClick={() => handleDeleteMediaFile(m.folder, m.name)}
                      style={{
                        background: '#fee2e2',
                        color: '#ef4444',
                        border: '1px solid #fca5a5',
                        borderRadius: '6px',
                        padding: '5px 8px',
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Advanced Maintenance & Factory Reset */}
      {activeTab === 'maintenance' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
          
          {/* Card 1: 1-Click Complete Trash Purge */}
          <div className="card" style={{ padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ background: '#3b82f615', color: '#3b82f6', padding: '10px', borderRadius: '12px' }}>
                <Trash2 size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Permanent Trash Purge</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Hard-delete all soft-deleted records across MongoDB</p>
              </div>
            </div>
            <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5 }}>
              When you delete a student, test, or attendance record, it is marked as deleted (soft-delete) to allow recovery. Purging permanently destroys all {totalTrashRecords} soft-deleted records from disk and cloud.
            </p>
            <button
              onClick={() => handlePurgeDeleted('all')}
              className="btn btn-danger"
              style={{
                width: '100%',
                background: '#ef4444',
                color: '#ffffff',
                border: 'none',
                padding: '12px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '12px'
              }}
            >
              <Trash2 size={16} />
              <span>Purge All Soft-Deleted Trash Now ({totalTrashRecords})</span>
            </button>
          </div>

          {/* Card 2: Clean Orphaned Media */}
          <div className="card" style={{ padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ background: '#f59e0b15', color: '#f59e0b', padding: '10px', borderRadius: '12px' }}>
                <Sparkles size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Orphaned Media Cleanup</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Remove physical files with no database link</p>
              </div>
            </div>
            <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5 }}>
              If OMR test results or students were previously deleted, their scanned JPG/PNG images might still remain on your hard drive taking up storage space. This scans and wipes unused files automatically.
            </p>
            <button
              onClick={handlePurgeOrphanedFiles}
              disabled={isPurgingFiles}
              style={{
                width: '100%',
                background: '#f59e0b',
                color: '#ffffff',
                border: 'none',
                padding: '12px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: isPurgingFiles ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '12px'
              }}
            >
              <Sparkles size={16} />
              <span>{isPurgingFiles ? 'Scanning & Purging...' : 'Clean Orphaned Media Files'}</span>
            </button>
          </div>

          {/* Card 3: Cloudinary Cloud OMR Optimization */}
          <div className="card" style={{ padding: '24px', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ background: '#3b82f615', color: '#3b82f6', padding: '10px', borderRadius: '12px' }}>
                <Cloud size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Cloudinary OMR Cloud Storage</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Only published test results are stored on Cloudinary</p>
              </div>
            </div>
            <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5 }}>
              Total Cloudinary Images: <strong>{cloudinaryStats?.totalCloudinaryImages || 0}</strong> ({cloudinaryStats?.publishedImages || 0} Published, <span style={{ color: '#ef4444' }}>{cloudinaryStats?.unwantedOrphanImages || 0} Unpublished/Unwanted</span>).
              Purging removes unpublished draft test images to keep your Cloudinary account quota free.
            </p>
            <button
              onClick={handlePurgeCloudinaryUnwanted}
              disabled={isPurgingCloudinary}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                color: '#ffffff',
                border: 'none',
                padding: '12px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: isPurgingCloudinary ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '12px'
              }}
            >
              <Cloud size={16} />
              <span>{isPurgingCloudinary ? 'Cleaning Cloudinary...' : 'Purge Unpublished Cloudinary Images'}</span>
            </button>
          </div>

          {/* Card 4: System & Sync Debug Logs */}
          <div className="card" style={{ padding: '24px', borderRadius: '16px', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: '#10b98115', color: '#10b981', padding: '10px', borderRadius: '12px' }}>
                  <Terminal size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Local System & Sync Activity Logs</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Every cloud sync, restore, and system error is saved to local disk for debugging</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={fetchLogs}
                  disabled={logsLoading}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '8px 12px' }}
                >
                  <RefreshCw size={14} className={logsLoading ? 'spin' : ''} />
                  <span>{logsLoading ? 'Refreshing...' : 'Refresh Logs'}</span>
                </button>
                <button
                  onClick={handleDownloadLogs}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '8px 12px' }}
                >
                  <Download size={14} />
                  <span>Download Logs (TXT)</span>
                </button>
              </div>
            </div>

            {/* Terminal Window Output */}
            <div style={{
              background: '#090d16',
              color: '#e2e8f0',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              fontSize: '0.78rem',
              padding: '16px',
              borderRadius: '12px',
              maxHeight: '260px',
              overflowY: 'auto',
              border: '1px solid #1e293b',
              lineHeight: 1.6
            }}>
              {systemLogs.length === 0 ? (
                <div style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>No system logs recorded yet.</div>
              ) : (
                systemLogs.map((line, idx) => {
                  const isErr = line.includes('ERROR') || line.includes('Failed') || line.includes('❌');
                  const isWarn = line.includes('WARN') || line.includes('⚠️');
                  const isSuccess = line.includes('✅') || line.includes('Successfully');
                  return (
                    <div 
                      key={idx} 
                      style={{ 
                        color: isErr ? '#f87171' : (isWarn ? '#fbbf24' : (isSuccess ? '#4ade80' : '#cbd5e1')),
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}
                    >
                      {line}
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      )}

      {/* MODAL 1: Inspect Collection Documents */}
      {inspectModalOpen && selectedCollection && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'var(--card-bg, #ffffff)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '1000px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                  🔍 Inspecting: {selectedCollection.name}
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Explore raw local records, filter active/deleted, and delete permanently.
                </span>
              </div>
              <button
                onClick={() => setInspectModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div style={{
              padding: '14px 24px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['all', 'active', 'deleted'].map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      setCollectionFilter(f);
                      fetchCollectionItems(selectedCollection.key, f, collectionSearch);
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      border: 'none',
                      background: collectionFilter === f ? '#3b82f6' : '#e2e8f0',
                      color: collectionFilter === f ? '#ffffff' : '#475569',
                      cursor: 'pointer',
                      textTransform: 'capitalize'
                    }}
                  >
                    {f === 'deleted' ? 'In Trash' : f}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative', width: '280px' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search records..."
                  value={collectionSearch}
                  onChange={(e) => {
                    setCollectionSearch(e.target.value);
                    fetchCollectionItems(selectedCollection.key, collectionFilter, e.target.value);
                  }}
                  style={{
                    width: '100%',
                    padding: '7px 10px 7px 32px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem'
                  }}
                />
              </div>
            </div>

            {/* Documents Table */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {itemsLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px' }} />
                  <div>Loading records...</div>
                </div>
              ) : collectionItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  No records matching current filter.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                      <th style={{ padding: '8px 12px' }}>Identifier / Name</th>
                      <th style={{ padding: '8px 12px' }}>Key Details</th>
                      <th style={{ padding: '8px 12px' }}>Status</th>
                      <th style={{ padding: '8px 12px' }}>Created / Date</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collectionItems.map((item) => (
                      <tr key={item._id || item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a' }}>
                          {item.name || item.studentName || item.testName || item.sessionName || item.recipient || item.title || item.id || item._id}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#64748b' }}>
                          {item.rollNo && `Roll: ${item.rollNo} `}
                          {item.score !== undefined && `Score: ${item.score}/${item.totalMarks || '--'} `}
                          {item.phone && `📞 ${item.phone} `}
                          {item.message && `💬 ${item.message.slice(0, 30)}...`}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {item.isDeleted ? (
                            <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
                              🗑️ In Trash
                            </span>
                          ) : (
                            <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
                              ✅ Active
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '0.78rem' }}>
                          {item.date || (item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '--')}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <button
                            onClick={() => handleDeleteItem(item._id || item.id, item.name || 'Record')}
                            style={{
                              background: '#fee2e2',
                              color: '#ef4444',
                              border: '1px solid #fca5a5',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Trash2 size={13} />
                            <span>Delete Permanently</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Showing {collectionItems.length} records
              </span>
              <button
                onClick={() => setInspectModalOpen(false)}
                className="btn btn-secondary"
                style={{ padding: '7px 16px', fontSize: '0.84rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Wipe Entire Collection Confirmation */}
      {wipeModalOpen && wipeTarget && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '480px',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#ef4444', marginBottom: '14px' }}>
              <div style={{ background: '#fee2e2', padding: '10px', borderRadius: '12px' }}>
                <AlertTriangle size={24} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#991b1b' }}>
                Wipe Collection: {wipeTarget.name}?
              </h3>
            </div>

            <p style={{ fontSize: '0.86rem', color: '#475569', lineHeight: 1.5 }}>
              This will <strong>permanently delete all {wipeTarget.total} records</strong> from the local database for <code>{wipeTarget.key}</code>. This action cannot be undone.
            </p>

            <div style={{ margin: '16px 0' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                Type <strong>WIPE</strong> below to confirm:
              </label>
              <input
                type="text"
                value={wipeConfirmText}
                onChange={(e) => setWipeConfirmText(e.target.value.toUpperCase())}
                placeholder="WIPE"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '2px solid #ef4444',
                  fontSize: '1rem',
                  fontWeight: 800,
                  letterSpacing: '2px'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => { setWipeModalOpen(false); setWipeTarget(null); }}
                className="btn btn-secondary"
                style={{ flex: 1, padding: '10px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteWipe}
                disabled={wipeConfirmText !== 'WIPE' || isWiping}
                style={{
                  flex: 1,
                  background: wipeConfirmText === 'WIPE' ? '#ef4444' : '#cbd5e1',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px',
                  fontWeight: 800,
                  cursor: wipeConfirmText === 'WIPE' ? 'pointer' : 'not-allowed'
                }}
              >
                {isWiping ? 'Wiping...' : 'Permanently Wipe'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Media Full Preview */}
      {mediaPreviewUrl && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          backdropFilter: 'blur(6px)'
        }}>
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <button
              onClick={() => setMediaPreviewUrl(null)}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                background: 'rgba(255,255,255,0.2)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={20} />
            </button>
            <img
              src={mediaPreviewUrl}
              alt="Full Preview"
              style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}
            />
          </div>
        </div>
      )}

    </div>
  );
}
