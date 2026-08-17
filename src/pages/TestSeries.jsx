import React from 'react';
import { motion } from 'framer-motion';

export default function TestSeries() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="page-container"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center' }}
    >
      <div className="page-header" style={{ border: 'none', background: 'transparent', boxShadow: 'none' }}>
        <h1 className="page-title text-primary" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Test Series</h1>
        <h2 className="page-subtitle" style={{ fontSize: '1.5rem', marginBottom: '2rem', color: '#666' }}>Coming Soon...</h2>
        <p className="text-muted" style={{ maxWidth: '600px', lineHeight: '1.6' }}>
          We are currently working on a new module where you will be able to generate and manage Test Series PDFs, question papers, and OMR templates seamlessly. Stay tuned!
        </p>
      </div>
    </motion.div>
  );
}
