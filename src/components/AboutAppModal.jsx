import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Info,
  X,
  WifiOff,
  Wifi,
  Cpu,
  Scan,
  Users,
  ClipboardList,
  Fingerprint,
  Printer,
  MessageSquare,
  Cloud,
  Smartphone,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  HardDrive
} from 'lucide-react';

export default function AboutAppModal({ isOpen, onClose, currentVersion = '1.0.41' }) {
  const [activeTab, setActiveTab] = useState('offline-online'); // 'offline-online' | 'architecture' | 'faqs'

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="modal-overlay"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.22 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: '#ffffff',
            border: '1.5px solid #bfdbfe',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '820px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.25)',
            overflow: 'hidden',
            fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif"
          }}
        >
          {/* Modal Header */}
          <div
            style={{
              padding: '18px 24px 16px',
              borderBottom: '1.5px solid #dbeafe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.28)'
                }}
              >
                <Info size={24} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#1e3a8a' }}>
                    About Career Xone Pro
                  </h2>
                  <span
                    style={{
                      background: '#dbeafe',
                      color: '#1d4ed8',
                      border: '1px solid #93c5fd',
                      padding: '2px 9px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 800
                    }}
                  >
                    v{currentVersion}
                  </span>
                </div>
                <p style={{ margin: '3px 0 0', fontSize: '0.84rem', color: '#475569', fontWeight: 500 }}>
                  Offline-First Institute Management &amp; AI OMR Evaluation Engine
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                background: '#ffffff',
                border: '1.5px solid #cbd5e1',
                borderRadius: '10px',
                color: '#475569',
                cursor: 'pointer',
                padding: '6px 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f1f5f9';
                e.currentTarget.style.color = '#0f172a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.color = '#475569';
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div
            style={{
              display: 'flex',
              padding: '10px 24px',
              gap: '10px',
              borderBottom: '1.5px solid #e2e8f0',
              background: '#f8fafc'
            }}
          >
            <button
              onClick={() => setActiveTab('offline-online')}
              style={{
                background: activeTab === 'offline-online' ? '#2563eb' : '#ffffff',
                color: activeTab === 'offline-online' ? '#ffffff' : '#475569',
                border: activeTab === 'offline-online' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                padding: '7px 16px',
                borderRadius: '9px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: activeTab === 'offline-online' ? '0 2px 8px rgba(37, 99, 235, 0.25)' : 'none',
                transition: 'all 0.15s'
              }}
            >
              <WifiOff size={15} />
              <span>Offline vs Online Guide</span>
            </button>

            <button
              onClick={() => setActiveTab('architecture')}
              style={{
                background: activeTab === 'architecture' ? '#2563eb' : '#ffffff',
                color: activeTab === 'architecture' ? '#ffffff' : '#475569',
                border: activeTab === 'architecture' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                padding: '7px 16px',
                borderRadius: '9px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: activeTab === 'architecture' ? '0 2px 8px rgba(37, 99, 235, 0.25)' : 'none',
                transition: 'all 0.15s'
              }}
            >
              <Cpu size={15} />
              <span>System Architecture</span>
            </button>

            <button
              onClick={() => setActiveTab('faqs')}
              style={{
                background: activeTab === 'faqs' ? '#2563eb' : '#ffffff',
                color: activeTab === 'faqs' ? '#ffffff' : '#475569',
                border: activeTab === 'faqs' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                padding: '7px 16px',
                borderRadius: '9px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: activeTab === 'faqs' ? '0 2px 8px rgba(37, 99, 235, 0.25)' : 'none',
                transition: 'all 0.15s'
              }}
            >
              <HelpCircle size={15} />
              <span>Frequently Asked Questions</span>
            </button>
          </div>

          {/* Modal Body */}
          <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
            {activeTab === 'offline-online' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* 100% Offline Section Card */}
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1.5px solid #86efac',
                    borderRadius: '14px',
                    padding: '18px 20px',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.05)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                    <div
                      style={{
                        padding: '8px',
                        borderRadius: '10px',
                        background: '#dcfce7',
                        color: '#15803d',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <WifiOff size={22} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800, color: '#14532d' }}>
                        🟢 100% Offline Features (Zero Internet Required)
                      </h3>
                      <p style={{ margin: '2px 0 0', fontSize: '0.80rem', color: '#166534', fontWeight: 500 }}>
                        These operations run completely on your PC's local CPU and disk with 0 KB internet used.
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '12px', background: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #bbf7d0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                      <Scan size={20} color="#15803d" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <strong style={{ fontSize: '0.86rem', color: '#0f172a' }}>⚡ High-Speed OMR Evaluation:</strong>
                        <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#334155', lineHeight: '1.4' }}>
                          Master Templates T1–T7, bubble grids, and numerical questions are evaluated locally via Python OpenCV in milliseconds.
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', background: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #bbf7d0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                      <Users size={20} color="#15803d" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <strong style={{ fontSize: '0.86rem', color: '#0f172a' }}>👥 Student &amp; Admission Records:</strong>
                        <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#334155', lineHeight: '1.4' }}>
                          Add/edit students, bulk Excel import, search across 1,300+ student profiles with instant responses.
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', background: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #bbf7d0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                      <ClipboardList size={20} color="#15803d" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <strong style={{ fontSize: '0.86rem', color: '#0f172a' }}>📝 Tests &amp; Marks Calculation:</strong>
                        <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#334155', lineHeight: '1.4' }}>
                          Create multi-batch tests, manual answer key input, copy/paste answer keys, ranking and leaderboard generation.
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', background: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #bbf7d0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                      <Fingerprint size={20} color="#15803d" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <strong style={{ fontSize: '0.86rem', color: '#0f172a' }}>⚡ Live QR Kiosk &amp; Biometrics:</strong>
                        <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#334155', lineHeight: '1.4' }}>
                          USB 2D scanner gun punches, instant IN/OUT time recording, attendance stream logs.
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', background: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #bbf7d0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                      <Printer size={20} color="#15803d" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <strong style={{ fontSize: '0.86rem', color: '#0f172a' }}>🪪 Student ID Card PDF &amp; Printing:</strong>
                        <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#334155', lineHeight: '1.4' }}>
                          Generate high-resolution A4 multi-page sheets with front/back duplex alignment and print directly.
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', background: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #bbf7d0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                      <HardDrive size={20} color="#15803d" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <strong style={{ fontSize: '0.86rem', color: '#0f172a' }}>💾 Local Embedded Database:</strong>
                        <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#334155', lineHeight: '1.4' }}>
                          Embedded MongoDB running locally on your computer with sub-millisecond query execution.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Online Section Card */}
                <div
                  style={{
                    background: '#eff6ff',
                    border: '1.5px solid #93c5fd',
                    borderRadius: '14px',
                    padding: '18px 20px',
                    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.05)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                    <div
                      style={{
                        padding: '8px',
                        borderRadius: '10px',
                        background: '#dbeafe',
                        color: '#1d4ed8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Wifi size={22} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800, color: '#1e3a8a' }}>
                        🌐 Online Features (Internet Required)
                      </h3>
                      <p style={{ margin: '2px 0 0', fontSize: '0.80rem', color: '#1e40af', fontWeight: 500 }}>
                        These services connect over the internet to notify parents, backup data, and synchronize portals.
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '12px', background: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #bfdbfe', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                      <MessageSquare size={20} color="#2563eb" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <strong style={{ fontSize: '0.86rem', color: '#0f172a' }}>📱 WhatsApp &amp; SMS Dispatch:</strong>
                        <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#334155', lineHeight: '1.4' }}>
                          Sending test marks, attendance IN/OUT arrival alerts, fee reminders, and welcome credentials to parents' phones.
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', background: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #bfdbfe', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                      <Cloud size={20} color="#2563eb" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <strong style={{ fontSize: '0.86rem', color: '#0f172a' }}>☁️ MongoDB Atlas Cloud Backup:</strong>
                        <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#334155', lineHeight: '1.4' }}>
                          Automatic background synchronization of all institute records to a cloud replica set for disaster recovery.
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', background: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #bfdbfe', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                      <Smartphone size={20} color="#2563eb" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <strong style={{ fontSize: '0.86rem', color: '#0f172a' }}>🌐 Parent &amp; Teacher Web Portals:</strong>
                        <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#334155', lineHeight: '1.4' }}>
                          Online mobile portal for parents to view student progress reports and for teachers to view marksheets remotely.
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', background: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #bfdbfe', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                      <Sparkles size={20} color="#2563eb" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <strong style={{ fontSize: '0.86rem', color: '#0f172a' }}>🔄 Desktop App Auto-Updates:</strong>
                        <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#334155', lineHeight: '1.4' }}>
                          Checking for new versions, feature updates, and performance patches over GitHub Releases.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'architecture' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div
                  style={{
                    background: '#ffffff',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '14px',
                    padding: '18px 20px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                  }}
                >
                  <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                    🏗️ Offline-First Hybrid Architecture
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.84rem', color: '#334155', lineHeight: '1.55' }}>
                    Career Xone Pro is built using a state-of-the-art <strong>Offline-First Architecture</strong>. All critical operational tasks—including scanning, evaluation, and database queries—execute on your PC with zero latency. Cloud connectivity acts as an automated backup and parent messaging gateway.
                  </p>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '14px'
                  }}
                >
                  <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1.5px solid #bfdbfe', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Frontend UI</div>
                    <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>React 19 + Vite + Electron</div>
                    <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '4px', lineHeight: 1.4 }}>Fast 60fps responsive desktop client with real-time UI components.</div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1.5px solid #bbf7d0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Local Backend</div>
                    <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>Express.js Engine</div>
                    <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '4px', lineHeight: 1.4 }}>Runs on localhost:5000 offline, handling API routes and sync events.</div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1.5px solid #fed7aa', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#c2410c', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vision Processor</div>
                    <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>Python OpenCV Engine</div>
                    <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '4px', lineHeight: 1.4 }}>Sub-100ms OMR bubble recognition and homography perspective calibration.</div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', border: '1.5px solid #ddd6fe', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                    <div style={{ fontSize: '0.75rem', color: '#6d28d9', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Database Engine</div>
                    <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>Embedded MongoDB</div>
                    <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '4px', lineHeight: 1.4 }}>Embedded local database on port 27018 with dual-sync to MongoDB Atlas.</div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'faqs' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: '#ffffff', padding: '16px 18px', borderRadius: '12px', border: '1.5px solid #cbd5e1', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                  <strong style={{ fontSize: '0.90rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={16} color="#2563eb" /> Q: Does OMR sheet scanning require internet?
                  </strong>
                  <p style={{ margin: '6px 0 0 22px', fontSize: '0.82rem', color: '#334155', lineHeight: '1.5' }}>
                    <strong>No!</strong> OMR scanning is 100% offline. The computer vision algorithms (bubble detection, homography, scoring) run locally on your PC's CPU. Zero bytes of data are sent to the internet during scanning.
                  </p>
                </div>

                <div style={{ background: '#ffffff', padding: '16px 18px', borderRadius: '12px', border: '1.5px solid #cbd5e1', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                  <strong style={{ fontSize: '0.90rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={16} color="#2563eb" /> Q: What happens if internet disconnects while working?
                  </strong>
                  <p style={{ margin: '6px 0 0 22px', fontSize: '0.82rem', color: '#334155', lineHeight: '1.5' }}>
                    You can continue adding admissions, scanning OMRs, creating tests, entering marks, and printing ID cards without interruption. Once internet reconnects, the app will automatically sync all newly saved data to Cloud Atlas in the background.
                  </p>
                </div>

                <div style={{ background: '#ffffff', padding: '16px 18px', borderRadius: '12px', border: '1.5px solid #cbd5e1', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                  <strong style={{ fontSize: '0.90rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={16} color="#2563eb" /> Q: When is internet connection strictly required?
                  </strong>
                  <p style={{ margin: '6px 0 0 22px', fontSize: '0.82rem', color: '#334155', lineHeight: '1.5' }}>
                    Internet is only needed when: (1) Sending WhatsApp / SMS messages to parents, (2) Backing up to MongoDB Atlas Cloud, and (3) Accessing the remote web app on mobile phones.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div
            style={{
              padding: '14px 24px',
              borderTop: '1.5px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc'
            }}
          >
            <div style={{ fontSize: '0.78rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              <ShieldCheck size={16} color="#16a34a" />
              <span>Career Xone Pro Enterprise • All Modules Verified &amp; Protected</span>
            </div>

            <button
              onClick={onClose}
              className="btn btn-primary btn-sm"
              style={{
                padding: '7px 20px',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: 700
              }}
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
