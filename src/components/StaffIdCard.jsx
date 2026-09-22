import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import idLogo from '../assets/id-logo.png';
import { getInitials } from '../data/sampleData';

/**
 * Career Xone - Official Staff & Employee ID Card Component
 * Standard PVC Card Size (260px x 390px) or Compact A4 Slot (230px x 355px)
 * 
 * @param {Object} props
 * @param {Object} props.staff - Employee / Staff data object
 * @param {'front'|'back'} [props.side='front'] - Front or Back of ID Card
 * @param {boolean} [props.isCompact=false] - Compact mode for 8-card A4 sheets
 */
export default function StaffIdCard({
  staff,
  side = 'front',
  isCompact = false
}) {
  if (!staff) return null;

  const cardWidth = isCompact ? '230px' : '260px';
  const cardHeight = isCompact ? '355px' : '390px';
  const staffId = staff.staffId || staff.id || 'STAFF';
  const designation = staff.designation || 'Staff / Faculty';
  const department = staff.department || 'General';
  const contact = staff.phone || 'N/A';
  const email = staff.email || '';

  // ============================================================================
  // SIDE 1: FRONT SIDE
  // ============================================================================
  if (side === 'front') {
    return (
      <div
        className="print-id-card print-staff-id-card"
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
          border: '2px solid #0f766e',
          position: 'relative',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        }}
      >
        {/* Top Banner with Brand Logo */}
        <div
          style={{
            width: '100%',
            height: isCompact ? '60px' : '68px',
            background: '#ffffff',
            borderBottom: '2px solid #0f766e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px 8px',
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

        {/* Photo / Avatar with Centered Initials & Gold Staff ID Pill */}
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
          {staff.photo ? (
            <img
              src={staff.photo}
              alt={staff.name}
              style={{
                width: isCompact ? '68px' : '76px',
                height: isCompact ? '72px' : '80px',
                borderRadius: '10px',
                objectFit: 'cover',
                border: '2px solid #0d9488',
                boxShadow: '0 4px 12px rgba(13, 148, 136, 0.25)',
                background: '#ffffff',
                display: 'block'
              }}
            />
          ) : (
            <div
              style={{
                width: isCompact ? '68px' : '76px',
                height: isCompact ? '72px' : '80px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #134e4a 0%, #0f766e 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                border: '2px solid #14b8a6',
                boxShadow: '0 4px 12px rgba(15, 118, 110, 0.25)',
                color: '#ffffff',
                fontSize: isCompact ? '1.30rem' : '1.50rem',
                fontWeight: 800,
                letterSpacing: '2px',
                textIndent: '2px',
                lineHeight: 1
              }}
            >
              {getInitials(staff.name)}
            </div>
          )}

          {/* Teal / Emerald Staff Pill */}
          <div
            className="id-card-roll-tag"
            style={{
              background: '#0d9488',
              color: '#ffffff',
              fontSize: isCompact ? '0.44rem' : '0.48rem',
              fontWeight: 900,
              padding: '0.5px 8px 2px',
              borderRadius: '99px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.20)',
              marginTop: '-6px',
              zIndex: 5,
              letterSpacing: '0.5px',
              whiteSpace: 'nowrap',
              lineHeight: '12px'
            }}
          >
            STAFF ID: {staffId}
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
            justifyContent: 'space-evenly'
          }}
        >
          {/* Employee Name */}
          <h3
            className="id-card-name"
            style={{
              margin: '1px 0',
              fontSize: isCompact ? '0.76rem' : '0.84rem',
              color: '#0f172a',
              fontWeight: 900,
              lineHeight: 1.15,
              textTransform: 'uppercase',
              letterSpacing: '0.2px'
            }}
          >
            {staff.name}
          </h3>

          {/* Designation Badge */}
          <div style={{ textAlign: 'center', margin: '1px 0' }}>
            <span
              className="id-card-batch-badge"
              style={{
                display: 'inline-block',
                background: 'linear-gradient(90deg, #115e59, #0f766e)',
                color: '#ffffff',
                fontSize: isCompact ? '0.46rem' : '0.52rem',
                fontWeight: 800,
                padding: '1px 10px 3px',
                borderRadius: '4px',
                letterSpacing: '0.4px',
                lineHeight: '12px',
                boxShadow: '0 2px 6px rgba(15, 118, 110, 0.2)'
              }}
            >
              {designation.toUpperCase()}
            </span>
          </div>

          {/* Info Table */}
          <div
            className="id-card-info-table"
            style={{
              background: '#f0fdfa',
              borderRadius: '6px',
              border: '1px solid #99f6e4',
              padding: isCompact ? '2px 6px 4px' : '2.5px 8px 5px',
              textAlign: 'left',
              fontSize: isCompact ? '0.52rem' : '0.58rem',
              color: '#0f172a',
              lineHeight: 1.34,
              boxShadow: '0 1px 4px rgba(15, 118, 110, 0.06)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', padding: '0.5px 0 2.5px', borderBottom: '1px solid #ccfbf1', alignItems: 'center' }}>
              <strong style={{ color: '#0f766e', fontWeight: 700, minWidth: isCompact ? '50px' : '58px', flexShrink: 0 }}>Department:</strong>
              <span style={{ fontWeight: 800, textAlign: 'right', flex: 1, wordBreak: 'break-word', color: '#134e4a' }}>
                {department}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', padding: '0.5px 0 2.5px', borderBottom: '1px solid #ccfbf1', alignItems: 'center' }}>
              <strong style={{ color: '#0f766e', fontWeight: 700, minWidth: isCompact ? '50px' : '58px', flexShrink: 0 }}>Contact:</strong>
              <span style={{ fontWeight: 700, textAlign: 'right', flex: 1, wordBreak: 'break-word' }}>{contact}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px', padding: '0.5px 0 1.5px', alignItems: 'center' }}>
              <strong style={{ color: '#0f766e', fontWeight: 700, minWidth: isCompact ? '50px' : '58px', flexShrink: 0 }}>Access Role:</strong>
              <span style={{ fontWeight: 800, textAlign: 'right', flex: 1, color: '#0d9488', textTransform: 'uppercase' }}>
                {staff.role || 'Staff Member'}
              </span>
            </div>
          </div>

          {/* Scannable QR Code */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '1px 0' }}>
            <div
              style={{
                background: '#ffffff',
                padding: '2.5px',
                borderRadius: '6px',
                border: '1.5px solid #5eead4',
                boxShadow: '0 2px 6px rgba(15, 118, 110, 0.12)',
                display: 'inline-flex'
              }}
            >
              <QRCodeSVG value={String(staffId)} size={isCompact ? 64 : 74} level="M" />
            </div>
          </div>
        </div>

        {/* Bottom Banner */}
        <div
          style={{
            width: '100%',
            height: isCompact ? '20px' : '22px',
            background: '#0f766e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontSize: isCompact ? '0.40rem' : '0.44rem',
            fontWeight: 800,
            letterSpacing: '0.5px',
            flexShrink: 0,
            textTransform: 'uppercase'
          }}
        >
          OFFICIAL EMPLOYEE &bull; CAREER XONE
        </div>
      </div>
    );
  }

  // ============================================================================
  // SIDE 2: BACK SIDE (TERMS & CONDITIONS, CAMPUS ADDRESS, SIGNATURE)
  // ============================================================================
  return (
    <div
      className="print-id-card print-staff-id-card-back"
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
        border: '2px solid #0f766e',
        position: 'relative',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}
    >
      {/* Top Header */}
      <div
        style={{
          width: '100%',
          height: isCompact ? '26px' : '30px',
          background: 'linear-gradient(135deg, #115e59 0%, #0f766e 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontSize: isCompact ? '0.52rem' : '0.58rem',
          fontWeight: 900,
          letterSpacing: '0.8px',
          textTransform: 'uppercase',
          flexShrink: 0
        }}
      >
        STAFF IDENTITY CARD &bull; TERMS
      </div>

      {/* Back Content */}
      <div
        style={{
          padding: isCompact ? '8px 10px' : '10px 14px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}
      >
        {/* Guidelines List */}
        <div>
          <h4
            style={{
              margin: '0 0 4px 0',
              fontSize: isCompact ? '0.54rem' : '0.60rem',
              color: '#0f766e',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.4px'
            }}
          >
            Employee Guidelines:
          </h4>
          <ol
            style={{
              margin: 0,
              paddingLeft: '14px',
              fontSize: isCompact ? '0.44rem' : '0.48rem',
              color: '#334155',
              lineHeight: 1.35,
              fontWeight: 600
            }}
          >
            <li style={{ marginBottom: '2px' }}>This card must be worn at all times while on the institute premises.</li>
            <li style={{ marginBottom: '2px' }}>Check-in &amp; Check-out attendance must be scanned daily via biometric/scanner.</li>
            <li style={{ marginBottom: '2px' }}>This card is non-transferable and remains property of Career Xone.</li>
            <li>Loss of this card must be reported immediately to Admin Office.</li>
          </ol>
        </div>

        {/* Institute Info Box */}
        <div
          style={{
            background: '#f0fdfa',
            border: '1px solid #99f6e4',
            borderRadius: '6px',
            padding: isCompact ? '4px 6px' : '6px 8px',
            fontSize: isCompact ? '0.44rem' : '0.48rem',
            color: '#0f172a',
            lineHeight: 1.3
          }}
        >
          <div style={{ fontWeight: 800, color: '#0f766e', marginBottom: '2px' }}>
            CAREER XONE ACADEMY
          </div>
          <div>Near Z.P. High School Ground, Main Road, Gondia - 441614</div>
          <div style={{ marginTop: '2px', fontWeight: 700, color: '#047857' }}>
            Support &amp; Helpline: +91 8538949912
          </div>
        </div>

        {/* Authorized Signatory & Seal */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            paddingTop: '6px',
            borderTop: '1px dashed #cbd5e1'
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: isCompact ? '54px' : '62px',
                height: isCompact ? '20px' : '24px',
                border: '1px dashed #0d9488',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isCompact ? '0.36rem' : '0.40rem',
                color: '#0d9488',
                fontWeight: 800
              }}
            >
              CX SEAL
            </div>
            <div style={{ fontSize: isCompact ? '0.38rem' : '0.42rem', color: '#64748b', marginTop: '2px', fontWeight: 700 }}>
              Office Seal
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: "'Brush Script MT', cursive, sans-serif",
                fontSize: isCompact ? '0.85rem' : '0.95rem',
                color: '#0f766e',
                lineHeight: 1,
                marginBottom: '2px'
              }}
            >
              Authorized
            </div>
            <div style={{ fontSize: isCompact ? '0.38rem' : '0.42rem', color: '#334155', fontWeight: 800 }}>
              Authorized Signatory
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer Banner */}
      <div
        style={{
          width: '100%',
          height: isCompact ? '18px' : '20px',
          background: '#0f766e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontSize: isCompact ? '0.38rem' : '0.42rem',
          fontWeight: 800,
          letterSpacing: '0.4px',
          flexShrink: 0
        }}
      >
        IF FOUND, PLEASE RETURN TO INSTITUTE OFFICE
      </div>
    </div>
  );
}
