import React from 'react';
import { motion } from 'framer-motion';
import { Download, Monitor, ShieldCheck, Zap } from 'lucide-react';

export default function WebLandingPage() {
  return (
    <div style={styles.container}>
      <div style={styles.blob}></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={styles.content}
      >
        <div style={styles.badge}>DESKTOP EXCLUSIVE SOFTWARE</div>
        
        <h1 style={styles.title}>Career Xone Pro</h1>
        
        <p style={styles.subtitle}>
          This software requires edge-computing for high-speed OMR processing and Local Biometric sync.
          <strong> Please download the Desktop Application to continue.</strong>
        </p>

        <motion.div 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <a href="https://drive.google.com/file/d/1zUJUDCCSyfvduGfNRmSN7Qi4iWRv6yve/view?usp=sharing" target="_blank" style={styles.downloadBtn}>
            <Download size={24} />
            Download for Windows (.exe)
          </a>
        </motion.div>

        <div style={styles.features}>
          <div style={styles.featureItem}>
            <Zap size={20} color="#3b82f6" />
            <span>High-Speed Local OMR Processing</span>
          </div>
          <div style={styles.featureItem}>
            <Monitor size={20} color="#10b981" />
            <span>Biometric ADMS Direct LAN Sync</span>
          </div>
          <div style={styles.featureItem}>
            <ShieldCheck size={20} color="#8b5cf6" />
            <span>Secure Edge-to-Cloud Architecture</span>
          </div>
        </div>
        
        <div style={styles.footer}>
          &copy; {new Date().getFullYear()} Career Xone. All rights reserved.
        </div>
      </motion.div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    width: '100vw',
    backgroundColor: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: "'Outfit', sans-serif",
    color: '#f8fafc'
  },
  blob: {
    position: 'absolute',
    width: '600px',
    height: '600px',
    background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(15,23,42,0) 70%)',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 0,
    borderRadius: '50%'
  },
  content: {
    zIndex: 10,
    textAlign: 'center',
    maxWidth: '800px',
    padding: '40px',
    background: 'rgba(30, 41, 59, 0.4)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '24px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  badge: {
    background: 'rgba(56, 189, 248, 0.1)',
    border: '1px solid rgba(56, 189, 248, 0.2)',
    color: '#38bdf8',
    padding: '8px 16px',
    borderRadius: '50px',
    fontSize: '0.9rem',
    fontWeight: '600',
    letterSpacing: '1px',
    marginBottom: '24px'
  },
  title: {
    fontSize: '4rem',
    fontWeight: '800',
    margin: '0 0 24px 0',
    background: 'linear-gradient(to right, #f8fafc, #94a3b8)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    lineHeight: 1.1
  },
  subtitle: {
    fontSize: '1.2rem',
    color: '#94a3b8',
    marginBottom: '40px',
    lineHeight: '1.6',
    maxWidth: '600px'
  },
  downloadBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 40px',
    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
    color: 'white',
    textDecoration: 'none',
    fontSize: '1.2rem',
    fontWeight: '600',
    borderRadius: '50px',
    boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    marginBottom: '40px'
  },
  features: {
    display: 'flex',
    gap: '32px',
    justifyContent: 'center',
    color: '#cbd5e1',
    flexWrap: 'wrap'
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '1rem',
    fontWeight: '300'
  },
  footer: {
    marginTop: '50px',
    fontSize: '0.9rem',
    color: '#64748b'
  }
};
