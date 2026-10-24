import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import idLogo from '../assets/id-logo.png';
import { formatBatchName } from '../utils/helpers';
import { getInitials } from '../data/sampleData';

/**
 * Career Xone - Official Student ID Card Component
 * Fully Responsive: Dynamically scales all inner elements (Logo, Photo, Table, QR, Footer)
 * so content NEVER clips, overflows, or cuts off regardless of custom width/height.
 */
export default function StudentIdCard({
  student,
  side = 'front',
  isCompact = false,
  batches = [],
  customWidth,
  customHeight,
  scale = 1
}) {
  if (!student) return null;

  const defaultW = isCompact ? 210 : 260;
  const defaultH = isCompact ? 320 : 390;

  const targetWidthNum = customWidth ? parseFloat(customWidth) : Math.round(defaultW * (scale || 1));
  const targetHeightNum = customHeight ? parseFloat(customHeight) : Math.round(defaultH * (scale || 1));

  const cardWidth = `${targetWidthNum}px`;
  const cardHeight = `${targetHeightNum}px`;

  const h = targetHeightNum;
  const isSmall = h < 345 || isCompact;
  const isMini = h < 295;

  // Responsive scaling calculations based on height
  const headerHeight = isMini ? 36 : (isSmall ? (h < 325 ? 42 : 48) : 62);
  const photoSize = isMini ? 46 : (isSmall ? (h < 325 ? 56 : 64) : 85);
  const photoW = photoSize;
  const photoH = Math.round(photoSize * 1.08);
  const initialsFontSize = isMini ? '0.95rem' : (isSmall ? '1.15rem' : '1.55rem');
  const rollTagFontSize = isMini ? '0.36rem' : (isSmall ? '0.40rem' : '0.48rem');
  const nameFontSize = isMini ? '0.62rem' : (isSmall ? (h < 325 ? '0.68rem' : '0.74rem') : '0.86rem');
  const badgeFontSize = isMini ? '0.38rem' : (isSmall ? '0.42rem' : '0.50rem');
  const tableFontSize = isMini ? '0.40rem' : (isSmall ? (h < 325 ? '0.46rem' : '0.50rem') : '0.56rem');
  const idValueSize = isMini ? '0.40rem' : (isSmall ? (h < 325 ? '0.46rem' : '0.50rem') : '0.54rem');
  const tablePadding = isMini ? '1px 4px 1.5px' : (isSmall ? (h < 325 ? '1.5px 5px 2px' : '2px 6px 3px') : '2.5px 8px 4px');
  const qrBoxSize = isMini ? 32 : (isSmall ? (h < 325 ? 40 : 48) : 66);
  const footerHeight = isMini ? 15 : (isSmall ? (h < 325 ? 17 : 19) : 23);
  const footerFontSize = isMini ? '0.42rem' : (isSmall ? '0.48rem' : '0.58rem');

  const courseName = student.class || formatBatchName(student.batch || student.targetClass || student.course, batches) || 'General';
  const roll = student.rollNo || student.id || '—';
  const studentId = student.id || student.studentId || '—';
  const parentName = student.parentName || student.guardianName || 'N/A';
  const contact = student.parentPhone || student.phone || 'N/A';

  const photoSrc = (typeof student.photo === 'string' && student.photo.trim().length > 10)
    ? student.photo
    : ((typeof student.photoUrl === 'string' && student.photoUrl.trim().length > 10) ? student.photoUrl : null);

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
          borderRadius: isSmall ? '10px' : '14px',
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
            height: `${headerHeight}px`,
            background: '#ffffff',
            borderBottom: '2px solid #2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2px 6px',
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
              objectFit: 'contain',
              display: 'block'
            }}
          />
        </div>

        {/* Photo / Avatar with Centered Initials & Gold Roll Pill */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginTop: isMini ? '2px' : (isSmall ? '3px' : '5px'),
            position: 'relative',
            flexShrink: 0
          }}
        >
          {photoSrc ? (
            <img
              src={photoSrc}
              alt={student.name}
              style={{
                width: `${photoW}px`,
                height: `${photoH}px`,
                borderRadius: '8px',
                objectFit: 'cover',
                border: '1.5px solid #f59e0b',
                boxShadow: '0 3px 8px rgba(37, 99, 235, 0.20)',
                background: '#ffffff',
                display: 'block'
              }}
            />
          ) : (
            <div
              style={{
                width: `${photoW}px`,
                height: `${photoH}px`,
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                border: '1.5px solid #f59e0b',
                boxShadow: '0 3px 8px rgba(37, 99, 235, 0.20)',
                color: '#ffffff',
                fontSize: initialsFontSize,
                fontWeight: 800,
                letterSpacing: '1px',
                lineHeight: 1
              }}
            >
              {getInitials(student.name)}
            </div>
          )}

          {/* Gold Roll Tag */}
          <div
            className="id-card-roll-tag"
            style={{
              background: '#f59e0b',
              color: '#0f172a',
              fontSize: rollTagFontSize,
              fontWeight: 900,
              padding: '0.5px 6px 1px',
              borderRadius: '99px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.18)',
              marginTop: '-5px',
              zIndex: 5,
              letterSpacing: '0.4px',
              whiteSpace: 'nowrap',
              lineHeight: '10px'
            }}
          >
            ROLL: {roll}
          </div>
        </div>

        {/* Card Body Details */}
        <div
          style={{
            padding: `0 ${isSmall ? '6px' : '10px'}`,
            textAlign: 'center',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-evenly',
            minHeight: 0
          }}
        >
          {/* Student Name & Batch Badge in a tight cohesive block */}
          <div style={{ margin: '1px 0' }}>
            <h3
              className="id-card-name"
              style={{
                margin: '0 0 2px 0',
                fontSize: nameFontSize,
                color: '#0f172a',
                fontWeight: 900,
                lineHeight: 1.15,
                textTransform: 'uppercase',
                letterSpacing: '0.2px'
              }}
            >
              {student.name}
            </h3>

            <div style={{ textAlign: 'center', margin: '2px 0 0' }}>
              <span
                className="id-card-batch-badge"
                style={{
                  display: 'inline-block',
                  background: 'linear-gradient(90deg, #1e3a8a, #2563eb)',
                  color: '#ffffff',
                  fontSize: badgeFontSize,
                  fontWeight: 800,
                  padding: '0.5px 8px 1.5px',
                  borderRadius: '3px',
                  letterSpacing: '0.3px',
                  lineHeight: '11px',
                  boxShadow: '0 2px 4px rgba(37, 99, 235, 0.20)'
                }}
              >
                {courseName.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Info Table (3 Essential Rows Only) */}
          <div
            className="id-card-info-table"
            style={{
              background: '#f8fafc',
              borderRadius: '5px',
              border: '1px solid #bfdbfe',
              padding: tablePadding,
              textAlign: 'left',
              fontSize: tableFontSize,
              color: '#0f172a',
              lineHeight: 1.25,
              boxShadow: '0 1px 2px rgba(37, 99, 235, 0.04)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '3px', padding: '0.5px 0 1.5px', borderBottom: '1px solid #e2e8f0', alignItems: 'center' }}>
              <strong style={{ color: '#475569', fontWeight: 700, minWidth: isSmall ? '44px' : '56px', flexShrink: 0 }}>Student ID:</strong>
              <span style={{ color: '#2563eb', fontWeight: 900, fontSize: idValueSize, letterSpacing: '0.3px', textAlign: 'right', flex: 1, wordBreak: 'break-word' }}>
                {studentId}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '3px', padding: '0.5px 0 1.5px', borderBottom: '1px solid #e2e8f0', alignItems: 'center' }}>
              <strong style={{ color: '#475569', fontWeight: 700, minWidth: isSmall ? '44px' : '56px', flexShrink: 0 }}>Parent:</strong>
              <span style={{ fontWeight: 700, textAlign: 'right', flex: 1, wordBreak: 'break-word' }}>{parentName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '3px', padding: '0.5px 0 1px', alignItems: 'center' }}>
              <strong style={{ color: '#475569', fontWeight: 700, minWidth: isSmall ? '44px' : '56px', flexShrink: 0 }}>Contact:</strong>
              <span style={{ fontWeight: 700, textAlign: 'right', flex: 1 }}>{contact}</span>
            </div>
          </div>

          {/* Scannable QR Code */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0.5px 0' }}>
            <div
              style={{
                background: '#ffffff',
                padding: '1.5px',
                borderRadius: '5px',
                border: '1.5px solid #93c5fd',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.12)',
                display: 'inline-flex'
              }}
            >
              <QRCodeSVG value={String(roll || studentId)} size={qrBoxSize} level="M" />
            </div>
          </div>
        </div>

        {/* Footer Ribbon (Always Fully Visible & Anchored to Bottom) */}
        <div
          className="id-card-footer-ribbon"
          style={{
            boxSizing: 'border-box',
            height: `${footerHeight}px`,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '0 6px',
            fontSize: footerFontSize,
            lineHeight: 1,
            color: '#ffffff',
            fontWeight: 800,
            letterSpacing: '0.4px',
            flexShrink: 0,
            background: 'linear-gradient(90deg, #1e3a8a 0%, #2563eb 100%)',
            borderTop: '1.5px solid #f59e0b',
            fontFamily: "'Inter', 'Noto Sans Devanagari', 'Nirmala UI', sans-serif"
          }}
        >
          <span>CAREER XONE • सब संभव है</span>
        </div>
      </div>
    );
  }

  // ============================================================================
  // SIDE 2: BACK SIDE
  // ============================================================================
  return (
    <div
      className="print-id-card print-id-card-back"
      style={{
        width: cardWidth,
        height: cardHeight,
        boxSizing: 'border-box',
        background: '#ffffff',
        borderRadius: isSmall ? '10px' : '14px',
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
          padding: isSmall ? '4px 6px' : '7px 10px',
          textAlign: 'center',
          color: '#ffffff',
          borderBottom: '2px solid #f59e0b',
          flexShrink: 0
        }}
      >
        <h4 style={{ margin: 0, fontSize: isSmall ? '0.68rem' : '0.82rem', fontWeight: 900, letterSpacing: '0.4px', color: '#ffffff' }}>
          TERMS &amp; CONDITIONS
        </h4>
        <p style={{ margin: '1px 0 0', fontSize: isSmall ? '0.42rem' : '0.50rem', opacity: 0.9 }}>
          Career Xone Rules &amp; Regulations
        </p>
      </div>

      {/* Rules Body */}
      <div
        style={{
          padding: isSmall ? '4px 6px' : '8px 10px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 0
        }}
      >
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            fontSize: isSmall ? '0.42rem' : '0.50rem',
            color: '#1e293b',
            lineHeight: isSmall ? 1.20 : 1.34,
            display: 'flex',
            flexDirection: 'column',
            gap: isSmall ? '1.5px' : '3px',
            textAlign: 'left'
          }}
        >
          <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
            <span style={{ color: '#2563eb', fontSize: '0.40rem', marginTop: '1px' }}>◆</span>
            <span>Students must carry their ID card daily and produce it upon demand.</span>
          </li>
          <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
            <span style={{ color: '#2563eb', fontSize: '0.40rem', marginTop: '1px' }}>◆</span>
            <span>Students must ensure their ID card is renewed before its expiry date.</span>
          </li>
          <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
            <span style={{ color: '#2563eb', fontSize: '0.40rem', marginTop: '1px' }}>◆</span>
            <span>Students must arrive on time; prior parental permission is required for early departure.</span>
          </li>
          <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
            <span style={{ color: '#2563eb', fontSize: '0.40rem', marginTop: '1px' }}>◆</span>
            <span>All students must wear the prescribed uniform.</span>
          </li>
          <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
            <span style={{ color: '#2563eb', fontSize: '0.40rem', marginTop: '1px' }}>◆</span>
            <span>Students must maintain discipline, decency, and decorum on campus.</span>
          </li>
          <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
            <span style={{ color: '#2563eb', fontSize: '0.40rem', marginTop: '1px' }}>◆</span>
            <span>Misconduct or indiscipline may result in immediate rustication.</span>
          </li>
          <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
            <span style={{ color: '#2563eb', fontSize: '0.40rem', marginTop: '1px' }}>◆</span>
            <span>The use or possession of mobile phones is strictly prohibited on campus.</span>
          </li>
          <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
            <span style={{ color: '#2563eb', fontSize: '0.40rem', marginTop: '1px' }}>◆</span>
            <span>A fee of ₹200 will be charged for issuing a duplicate ID card in case of loss.</span>
          </li>
          <li style={{ display: 'flex', gap: '3px', alignItems: 'flex-start' }}>
            <span style={{ color: '#2563eb', fontSize: '0.40rem', marginTop: '1px' }}>◆</span>
            <span>If found, please return this ID card to Career Xone reception.</span>
          </li>
        </ul>

        {/* Clean Address & Contact Details */}
        <div
          style={{
            borderTop: '1px dashed #cbd5e1',
            paddingTop: isSmall ? '3px' : '6px',
            marginTop: '2px',
            textAlign: 'center',
            fontSize: isSmall ? '0.42rem' : '0.50rem',
            color: '#334155',
            fontWeight: 600,
            lineHeight: 1.35,
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
          height: `${footerHeight}px`,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 6px',
          fontSize: footerFontSize,
          lineHeight: 1,
          color: '#ffffff',
          fontWeight: 800,
          letterSpacing: '0.4px',
          flexShrink: 0,
          background: 'linear-gradient(90deg, #1e3a8a 0%, #2563eb 100%)',
          borderTop: '1.5px solid #f59e0b',
          fontFamily: "'Inter', 'Noto Sans Devanagari', 'Nirmala UI', sans-serif"
        }}
      >
        CAREER XONE • सब संभव है
      </div>
    </div>
  );
}
