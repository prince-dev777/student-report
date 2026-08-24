import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UploadCloud, Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

import { useApp } from '../context/AppContext';

export default function BulkUploadModal({ isOpen, onClose, onSuccess }) {
  const { batches = [] } = useApp();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        rollNo: '1001',
        name: 'Prince Sharma',
        course: 'JEE Mains',
        class: '12th',
        parentName: 'Mukesh Sharma',
        parentPhone: '8538949912',
        parentPhone2: '', // Optional secondary number
        parentUserId: 'prince_parent',
        parentPassword: 'password123',
        schoolName: 'Delhi Public School',
        address: 'New Delhi'
      }
    ]);
    const wb = XLSX.utils.book_new();
    
    // Set column widths for a professional look
    ws['!cols'] = [
      { wch: 15 }, // rollNo
      { wch: 25 }, // name
      { wch: 15 }, // batch
      { wch: 10 }, // class
      { wch: 25 }, // parentName
      { wch: 15 }, // parentPhone
      { wch: 15 }, // parentPhone2
      { wch: 20 }, // parentUserId
      { wch: 20 }, // parentPassword
      { wch: 30 }, // schoolName
      { wch: 40 }  // address
    ];

    // Make header bold
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + '1';
      if (!ws[address]) continue;
      ws[address].s = { font: { bold: true } };
    }

    XLSX.utils.book_append_sheet(wb, ws, 'Student_Bulk_Upload_Template');
    XLSX.writeFile(wb, 'Student_Bulk_Upload_Template.xlsx');
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        toast.error('The Excel file is empty.');
        setIsUploading(false);
        return;
      }

      // Format data and validate mandatory fields
      const payload = [];
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        
        const rollNo = String(row.rollNo || '').trim();
        const name = String(row.name || '').trim();
        const parentPhone = String(row.parentPhone || '').trim();
        const parentPhone2 = String(row.parentPhone2 || '').trim();

        // Check mandatory fields
        if (!rollNo || !name || !parentPhone) {
          toast.error(`Row ${i + 2} is missing mandatory fields (Roll No, Name, or Parent Phone). Upload aborted.`);
          setIsUploading(false);
          return;
        }

        // Smart Course Mapping Logic
        const rawBatch = String(row.course || row.batch || '').trim();
        const batchString = rawBatch.toLowerCase().replace(/[\s-]/g, '');
        let batchId = rawBatch || batches[0]?.id || 'General';

        if (batchString.includes('jeemain')) {
          const matched = batches.find(b => b.name.toLowerCase().replace(/[\s-]/g, '').includes('jeemain'));
          if (matched) batchId = matched.id;
        } else if (batchString.includes('jeeadv') || batchString.includes('advanced')) {
          const matched = batches.find(b => b.name.toLowerCase().replace(/[\s-]/g, '').includes('jeeadv'));
          if (matched) batchId = matched.id;
        } else if (batchString.includes('neet')) {
          const matched = batches.find(b => b.name.toLowerCase().replace(/[\s-]/g, '').includes('neet'));
          if (matched) batchId = matched.id;
        } else if (batchString.includes('mhcet') || batchString.includes('cet')) {
          const matched = batches.find(b => b.name.toLowerCase().replace(/[\s-]/g, '').includes('cet'));
          if (matched) batchId = matched.id;
        } else if (batchString) {
          const matched = batches.find(b => b.name.toLowerCase().replace(/[\s-]/g, '') === batchString || b.id.toLowerCase() === batchString);
          if (matched) {
            batchId = matched.id;
          } else {
            batchId = rawBatch;
          }
        }

        payload.push({
          rollNo,
          name,
          batch: batchId,
          class: String(row.class || '').trim(),
          parentName: String(row.parentName || '').trim(),
          parentPhone,
          parentPhone2,
          parentUserId: String(row.parentUserId || '').trim(),
          parentPassword: String(row.parentPassword || '').trim(),
          schoolName: String(row.schoolName || '').trim(),
          address: String(row.address || '').trim()
        });
      }

      if (payload.length === 0) {
        toast.error('No valid records found. Make sure "rollNo" and "name" columns exist.');
        setIsUploading(false);
        return;
      }

      const res = await api.addStudentsBulk(payload);
      if (res.success) {
        toast.success(`Successfully added ${res.added} and updated ${res.updated} students!`);
        onSuccess(); // Trigger reload
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to process Excel file.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return createPortal(
    <AnimatePresence>
      <div className="modal-overlay" onClick={onClose}>
        <motion.div 
          className="modal-content"
          onClick={e => e.stopPropagation()}
          style={{ maxWidth: '500px' }}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
        >
            <div className="modal-header">
              <h3>Bulk Add Students</h3>
              <button className="modal-close" onClick={onClose}><X size={18} /></button>
            </div>
            
            <div className="modal-body" style={{ padding: '24px' }}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '16px',
                  background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px'
                }}>
                  <FileSpreadsheet size={32} />
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                  Upload an Excel sheet to add or update multiple students at once. Duplicate roll numbers will be merged automatically.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <button 
                  onClick={handleDownloadTemplate}
                  className="btn btn-secondary w-full justify-center"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px' }}
                >
                  <Download size={18} />
                  Download Excel Template
                </button>

                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  style={{ display: 'none' }}
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />

                <button 
                  onClick={() => fileInputRef.current.click()}
                  disabled={isUploading}
                  className="btn btn-primary w-full justify-center"
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '14px',
                    opacity: isUploading ? 0.7 : 1,
                    cursor: isUploading ? 'not-allowed' : 'pointer'
                  }}
                >
                  <UploadCloud size={20} />
                  {isUploading ? 'Uploading & Processing...' : 'Upload Excel File'}
                </button>
              </div>
            </div>
          </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
