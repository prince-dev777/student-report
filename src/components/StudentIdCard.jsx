import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import idLogo from '../assets/id-logo.png';
import { getInitials } from '../data/sampleData';
import { formatBatchName } from '../utils/helpers';

/**
 * Career Xone - Official Student ID Card Component (PRO REFINED v3)
 * Standard PVC Card Size (260px x 390px) or Compact A4 Slot (230px x 355px)
 * 
 * @param {Object} props
 * @param {Object} props.student - Student data object
 * @param {'front'|'back'} [props.side='front'] - Front or Back of ID Card
 * @param {boolean} [props.isCompact=false] - Compact mode for 8-card A4 sheets
 * @param {Array} [props.batches=[]] - List of batches for resolving course name
 */
export default function StudentIdCard({
  student,
  side = 'front',
  isCompact = false,
  batches = []
}) {
  if (!student) return null;

  const cardWidth = isCompact ? '230px' : '260px';
  const cardHeight = isCompact ? '355px' : '390px';
  const courseName = student.class || formatBatchName(student.batch || student.targetClass || student.course, batches) || 'General';
  const roll = student.rollNo || student.id || '—';
  const studentId = student.id || student.studentId || '—';
  const parentName = student.parentName || student.guardianName || 'N/A';
  const contact = student.parentPhone || student.phone || 'N/A';

  // ============================================================================
  // SIDE 1: FRONT SIDE
  // ============================================================================
  if (side === 'front') {
    return (
      <div
        className="print-id-card"
        style={{
          width: cardWidth,
          height: cardHeight,
          boxSizing: 'border-box',
          background: '#ffffff',
          borderRadius: '14px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          border: '2px solid #2563eb',
          position: 'relative',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        }}
      >
        {/* Top Banner with Brand Logo */}
        <div
          style={{
            width: '100%',
            height: isCompact ? '68px' : '78px',
            background: '#ffffff',
            borderBottom: '2px solid #2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px 10px',
            position: 'relative',
            flexShrink: 0
          }}
        >
          <img
            src={idLogo}
            alt="Career Xone"
            style={{
              maxHeight: '100%',
              maxWidth: '96%',
              width: 'auto',
              objectFit: 'contain'
            }}
          />
        </div>

        {/* Photo / Avatar with Centered Initials & Gold Roll Pill */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginTop: isCompact ? '1px' : '2px',
            position: 'relative',
            flexShrink: 0
          }}
        >
          {student.photo ? (
            <img
              src={student.photo}
              alt={student.name}
              style={{
                width: isCompact ? '70px' : '78px',
                height: isCompact ? '74px' : '82px',
                borderRadius: '10px',
                objectFit: 'cover',
                border: '2px solid #f59e0b',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                background: '#ffffff'
              }}
            />
          ) : (
            <div
              style={{
                width: isCompact ? '70px' : '78px',
                height: isCompact ? '74px' : '82px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                border: '2px solid #f59e0b',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                color: '#ffffff',
                fontSize: isCompact ? '1.35rem' : '1.55rem',
                fontWeight: 800,
                letterSpacing: '2px',
                textIndent: '2px',
                lineHeight: 1
              }}
            >
              {getInitials(student.name)}
            </div>
          )}

          {/* Gold Roll Tag */}
          <div
            style={{
              background: '#f59e0b',
              color: '#0f172a',
              fontSize: isCompact ? '0.44rem' : '0.48rem',
              fontWeight: 900,
              padding: '1.5px 9px',
              borderRadius: '99px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.20)',
              marginTop: '-7px',
              zIndex: 5,
              letterSpacing: '0.5px',
              whiteSpace: 'nowrap'
            }}
          >
            ROLL: {roll}
          </div>
        </div>

        {/* Card Body Details */}
        <div
          style={{
            padding: `0 ${isCompact ? '8px' : '10px'}`,
            textAlign: 'center',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            {/* Student Name */}
            <h3
              style={{
                margin: '2px 0 1px',
                fontSize: isCompact ? '0.80rem' : '0.88rem',
                color: '#0f172a',
                fontWeight: 900,
                lineHeight: 1.15,
                textTransform: 'uppercase',
                letterSpacing: '0.2px'
              }}
            >
              {student.name}
            </h3>

            {/* Clean Batch Badge */}
            <div
              style={{
                display: 'inline-block',
                background: 'linear-gradient(90deg, #1e3a8a, #2563eb)',
                color: '#ffffff',
                fontSize: isCompact ? '0.48rem' : '0.54rem',
                fontWeight: 800,
                padding: '2px 10px',
                borderRadius: '4px',
                margin: '1px 0 2px',
                letterSpacing: '0.4px',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.2)'
              }}
            >
              {courseName.toUpperCase()}
            </div>

            {/* Info Table (3 Essential Rows Only) */}
            <div
              style={{
                background: '#f8fafc',
                borderRadius: '6px',
                border: '1px solid #bfdbfe',
                padding: isCompact ? '2.5px 5px' : '3px 6px',
                textAlign: 'left',
                fontSize: isCompact ? '0.54rem' : '0.60rem',
                color: '#0f172a',
                lineHeight: 1.34,
                boxShadow: '0 1px 4px rgba(37, 99, 235, 0.06)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', padding: '1.5px 0', borderBottom: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#475569', fontWeight: 700, minWidth: isCompact ? '50px' : '60px', flexShrink: 0 }}>Student ID:</strong>
                <span style={{ color: '#2563eb', fontWeight: 900, fontFamily: 'monospace', fontSize: isCompact ? '0.52rem' : '0.58rem', letterSpacing: '0.5px', textAlign: 'right', flex: 1, wordBreak: 'break-word' }}>
                  {studentId}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', padding: '1.5px 0', borderBottom: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#475569', fontWeight: 700, minWidth: isCompact ? '50px' : '60px', flexShrink: 0 }}>Parent:</strong>
                <span style={{ fontWeight: 700, textAlign: 'right', flex: 1, wordBreak: 'break-word' }}>{parentName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', padding: '1.5px 0' }}>
                <strong style={{ color: '#475569', fontWeight: 700, minWidth: isCompact ? '50px' : '60px', flexShrink: 0 }}>Contact:</strong>
                <span style={{ fontWeight: 700, textAlign: 'right', flex: 1 }}>{contact}</span>
              </div>
            </div>
          </div>

          {/* Huge Scannable QR Code */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '1px 0 2px' }}>
            <div
              style={{
                background: '#ffffff',
                padding: '2.5px',
                borderRadius: '6px',
                border: '1.5px solid #93c5fd',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.12)',
                display: 'inline-flex'
              }}
            >
              <QRCodeSVG value={String(roll || studentId)} size={isCompact ? 68 : 80} level="M" />
            </div>
          </div>
        </div>

        {/* Footer Ribbon (100% Dead Centered) */}
        <div
          style={{
            boxSizing: 'border-box',
            height: isCompact ? '23px' : '25px',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '0 8px',
            fontSize: isCompact ? '0.55rem' : '0.62rem',
            lineHeight: 1,
            color: '#ffffff',
            fontWeight: 800,
            letterSpacing: '0.5px',
            flexShrink: 0,
            background: 'linear-gradient(90deg, #1e3a8a 0%, #2563eb 100%)',
            borderTop: '1.5px solid #f59e0b'
          }}
        >
          CAREER XONE • से सब संभव है
        </div>
      </div>
    );
  }

  // ============================================================================
  // SIDE 2: BACK SIDE (TERMS & CONDITIONS + ADDRESS + TAGLINE)
  // ============================================================================
  return (
    <div
      className="print-id-card card-back"
      style={{
        width: cardWidth,
        height: cardHeight,
        boxSizing: 'border-box',
        background: '#ffffff',
        borderRadius: '14px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        border: '2px solid #2563eb',
        position: 'relative',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}
    >
      {/* Back Header Strip */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
          padding: isCompact ? '5px 8px' : '7px 10px',
          textAlign: 'center',
          color: '#ffffff',
          borderBottom: '2px solid #f59e0b',
          flexShrink: 0
        }}
      >
        <h4 style={{ margin: 0, fontSize: isCompact ? '0.74rem' : '0.82rem', fontWeight: 900, letterSpacing: '0.5px', color: '#ffffff' }}>
          TERMS &amp; CONDITIONS
        </h4>
        <p style={{ margin: '1px 0 0', fontSize: isCompact ? '0.45rem' : '0.50rem', opacity: 0.9 }}>
          Career Xone Rules &amp; Regulations
        </p>
      </div>

      {/* Rules Body */}
      <div
        style={{
          padding: isCompact ? '6px 8px' : '8px 10px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}
      >
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            fontSize: isCompact ? '0.46rem' : '0.52rem',
            color: '#1e293b',
            lineHeight: isCompact ? 1.25 : 1.34,
            display: 'flex',
            flexDirection: 'column',
            gap: isCompact ? '2px' : '3px',
            textAlign: 'left'
          }}
        >
          <li style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
            <span style={{ color: '#2563eb', fontSize: '0.45rem', marginTop: '1px' }}>◆</span>
            <span>Students must carry their ID card daily and produce it upon demand.</span>
          </li>
          <li style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
            <span style={{ color: '#2563eb', fontSize: '0.45rem', marginTop: '1px' }}>◆</span>
            <span>Students must ensure their ID card is renewed before its expiry date.</span>
          </li>
          <li style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
            <span style={{ color: '#2563eb', fontSize: '0.45rem', marginTop: '1px' }}>◆</span>
            <span>Students must arrive on time; prior parental permission is required for early departure.</span>
          </li>
          <li style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
            <span style={{ color: '#2563eb', fontSize: '0.45rem', marginTop: '1px' }}>◆</span>
            <span>All students must wear the prescribed uniform.</span>
          </li>
          <li style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
            <span style={{ color: '#2563eb', fontSize: '0.45rem', marginTop: '1px' }}>◆</span>
            <span>Students must maintain discipline, decency, and decorum on campus.</span>
          </li>
          <li style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
            <span style={{ color: '#2563eb', fontSize: '0.45rem', marginTop: '1px' }}>◆</span>
            <span>Misconduct or indiscipline may result in immediate rustication.</span>
          </li>
          <li style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
            <span style={{ color: '#2563eb', fontSize: '0.45rem', marginTop: '1px' }}>◆</span>
            <span>The use or possession of mobile phones is strictly prohibited on campus.</span>
          </li>
          <li style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
            <span style={{ color: '#2563eb', fontSize: '0.45rem', marginTop: '1px' }}>◆</span>
            <span>A fee of ₹200 will be charged for issuing a duplicate ID card in case of loss.</span>
          </li>
          <li style={{ display: 'flex', gap: '4px', alignItems: 'flex-start' }}>
            <span style={{ color: '#2563eb', fontSize: '0.45rem', marginTop: '1px' }}>◆</span>
            <span>If found, please return this ID card to Career Xone reception.</span>
          </li>
        </ul>

        {/* Clean Address & Contact Details */}
        <div
          style={{
            borderTop: '1px dashed #cbd5e1',
            paddingTop: isCompact ? '4px' : '6px',
            marginTop: '3px',
            textAlign: 'center',
            fontSize: isCompact ? '0.46rem' : '0.51rem',
            color: '#334155',
            fontWeight: 600,
            lineHeight: 1.4,
            width: '100%'
          }}
        >
          Hadditoli Road, Near Ananya Hospital, Gondia, MH - 441601<br />
          Mob: +91 96733 83561 / 91454 81323 • Email: cxjeeneet@gmail.com
        </div>
      </div>

      {/* Back Footer Ribbon (100% Dead Centered) */}
      <div
        style={{
          boxSizing: 'border-box',
          height: isCompact ? '23px' : '25px',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 8px',
          fontSize: isCompact ? '0.55rem' : '0.62rem',
          lineHeight: 1,
          color: '#ffffff',
          fontWeight: 800,
          letterSpacing: '0.5px',
          flexShrink: 0,
          background: 'linear-gradient(90deg, #1e3a8a 0%, #2563eb 100%)',
          borderTop: '1.5px solid #f59e0b'
        }}
      >
        CAREER XONE • से सब संभव है
      </div>
    </div>
  );
}
