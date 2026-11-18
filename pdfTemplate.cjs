// pdfTemplate.cjs - Career Xone ID Card PDF Generator (Supports Custom Sizes, 4 Cards & 6 Cards / Sheet)
const QRCode = require('qrcode');

const FONT = "'Arial','Noto Sans Devanagari',-apple-system,'Segoe UI',Roboto,sans-serif";

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// ─── SOLID FILLED VECTOR QR SVG FOR CORELDRAW COMPATIBILITY ───
// Generates solid filled rectangles (<rect fill="#000000"/>) instead of hairline stroke paths.
// CorelDRAW imports standard filled <rect> elements with 100% vector accuracy without cracking.
function generateSolidQrSvg(text, size = 64) {
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const modCount = qr.modules.size;
    const margin = 1;
    const totalDim = modCount + margin * 2;
    const rects = [];

    for (let r = 0; r < modCount; r++) {
      let startCol = -1;
      for (let c = 0; c < modCount; c++) {
        const isDark = qr.modules.get(r, c);
        if (isDark && startCol === -1) {
          startCol = c;
        } else if (!isDark && startCol !== -1) {
          const w = c - startCol;
          rects.push(`<rect x="${startCol + margin}" y="${r + margin}" width="${w}" height="1" fill="#000000"/>`);
          startCol = -1;
        }
      }
      if (startCol !== -1) {
        const w = modCount - startCol;
        rects.push(`<rect x="${startCol + margin}" y="${r + margin}" width="${w}" height="1" fill="#000000"/>`);
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalDim} ${totalDim}" width="${size}px" height="${size}px" style="display:block;width:${size}px;height:${size}px;shape-rendering:crispEdges;" shape-rendering="crispEdges"><rect width="${totalDim}" height="${totalDim}" fill="#ffffff"/>${rects.join('')}</svg>`;
  } catch (err) {
    return `<div style="width:${size}px;height:${size}px;border:1px solid #ccc;display:flex;align-items:center;justify-content:center;font-size:8px;">QR</div>`;
  }
}

// ─── FRONT CARD (exact px copy of StudentIdCard.jsx / StaffIdCard.jsx) ───
function frontCardHTML(s, logoB64, qrSvg, isCompact = false, customW = null, customH = null) {
  const isStaff = !!s.isStaff;
  const name = (s.name || '—').toUpperCase();
  const rawRoll = s.staffId || s.rollNo || s.id || (isStaff ? 'STAFF' : '—');
  const cleanStaffId = isStaff ? String(rawRoll).replace(/^#+/, '').replace(/^STAFF_/i, '').trim() : '';
  const roll = isStaff ? (cleanStaffId || 'STAFF') : (s.rollNo || s.id || '—');
  const sid = s.id || s.studentId || (isStaff ? roll : '—');
  const parent = s.parentName || s.guardianName || 'N/A';
  const contact = s.phone || s.parentPhone || 'N/A';
  const course = (s.className || s.batch || s.course || (isStaff ? 'Staff / Faculty' : 'General')).toUpperCase();
  const department = s.department || s.batch || 'General';
  const designation = s.designation || s.className || 'Staff / Faculty';

  const cardHNum = customH ? (typeof customH === 'number' ? customH : parseInt(customH, 10)) : (isCompact ? 320 : 390);
  const cardWNum = customW ? (typeof customW === 'number' ? customW : parseInt(customW, 10)) : (isCompact ? 210 : 260);
  const isSmall = cardHNum < 345 || isCompact;
  const isMini = cardHNum < 295;

  const cardWidth = `${cardWNum}px`;
  const cardHeight = `${cardHNum}px`;
  const headerHeight = isMini ? '36px' : (isSmall ? (cardHNum < 325 ? '42px' : '48px') : '62px');
  const photoSize = isMini ? 46 : (isSmall ? (cardHNum < 325 ? 56 : 64) : 85);
  const photoW = `${photoSize}px`;
  const photoH = `${Math.round(photoSize * 1.08)}px`;
  const photoInitialsSize = isMini ? '15px' : (isSmall ? '19px' : '26px');
  const rollFontSize = isMini ? '5.5px' : (isSmall ? '6.5px' : '7.6px');
  const nameFontSize = isMini ? '9.2px' : (isSmall ? (cardHNum < 325 ? '10px' : '11px') : '13.2px');
  const courseFontSize = isMini ? '6px' : (isSmall ? '6.8px' : '8px');
  const tablePadding = isMini ? '1px 4px 1.5px' : (isSmall ? (cardHNum < 325 ? '1.5px 5px 2px' : '2px 6px 3px') : '2.5px 8px 4px');
  const tableFontSize = isMini ? '6px' : (isSmall ? (cardHNum < 325 ? '6.8px' : '7.5px') : '8.8px');
  const idColWidth = isMini ? '38px' : (isSmall ? (cardHNum < 325 ? '44px' : '48px') : '56px');
  const idValueSize = isMini ? '6.2px' : (isSmall ? (cardHNum < 325 ? '7px' : '7.8px') : '9px');
  const footerHeight = isMini ? '15px' : (isSmall ? (cardHNum < 325 ? '17px' : '19px') : '23px');
  const footerFontSize = isMini ? '6.5px' : (isSmall ? '7.5px' : '8.8px');

  // Theme & Color Palette: Blue & White theme across all cards, with Staff Name & Designation in Red
  const themeColor = '#2563eb';
  const themeGradient = 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)';
  const badgeGradient = isStaff ? 'linear-gradient(90deg, #dc2626 0%, #ef4444 100%)' : 'linear-gradient(90deg, #1e3a8a, #2563eb)';
  const borderPill = '#f59e0b';
  const tagBg = '#f59e0b';
  const tagColor = '#0f172a';
  const tagLabel = isStaff ? `STAFF ID: ${roll}` : `ROLL: ${roll}`;
  const tableBg = '#f8fafc';
  const tableBorder = '#bfdbfe';

  const photoHTML = s.photo
    ? `<img src="${s.photo}" style="width:${photoW};height:${photoH};border-radius:9px;object-fit:cover;border:2px solid ${borderPill};background:#fff;display:block;" />`
    : `<div style="width:${photoW};height:${photoH};border-radius:9px;background:${themeGradient};display:flex;align-items:center;justify-content:center;text-align:center;border:2px solid ${borderPill};color:#fff;font-size:${photoInitialsSize};font-weight:800;letter-spacing:2px;text-indent:2px;line-height:1;">${getInitials(s.name)}</div>`;

  // Staff Table: Black labels and values (#0f172a), clean slate borders
  const infoTableContent = isStaff
    ? `
      <div style="display:flex;justify-content:space-between;gap:4px;padding:0.5px 0 2px;border-bottom:1px solid #e2e8f0;align-items:center;">
        <strong style="color:#0f172a;font-weight:800;min-width:${idColWidth};flex-shrink:0;">Staff ID:</strong>
        <span style="font-weight:900;color:#0f172a;text-align:right;flex:1;word-break:break-word;font-size:${idValueSize};letter-spacing:0.4px;">${roll}</span>
      </div>
      <div style="display:flex;justify-content:space-between;gap:4px;padding:0.5px 0 2px;border-bottom:1px solid #e2e8f0;align-items:center;">
        <strong style="color:#0f172a;font-weight:800;min-width:${idColWidth};flex-shrink:0;">Department:</strong>
        <span style="font-weight:700;color:#0f172a;text-align:right;flex:1;word-break:break-word;">${department}</span>
      </div>
      <div style="display:flex;justify-content:space-between;gap:4px;padding:0.5px 0 1px;align-items:center;">
        <strong style="color:#0f172a;font-weight:800;min-width:${idColWidth};flex-shrink:0;">Contact:</strong>
        <span style="font-weight:700;color:#0f172a;text-align:right;flex:1;">${contact}</span>
      </div>
    `
    : `
      <div style="display:flex;justify-content:space-between;gap:4px;padding:0.5px 0 2px;border-bottom:1px solid #e2e8f0;align-items:center;">
        <strong style="color:#475569;font-weight:700;min-width:${idColWidth};flex-shrink:0;">Student ID:</strong>
        <span style="color:#2563eb;font-weight:900;font-size:${idValueSize};letter-spacing:0.4px;text-align:right;flex:1;word-break:break-word;">${sid}</span>
      </div>
      <div style="display:flex;justify-content:space-between;gap:4px;padding:0.5px 0 2px;border-bottom:1px solid #e2e8f0;align-items:center;">
        <strong style="color:#475569;font-weight:700;min-width:${idColWidth};flex-shrink:0;">Parent:</strong>
        <span style="font-weight:700;text-align:right;flex:1;word-break:break-word;">${parent}</span>
      </div>
      <div style="display:flex;justify-content:space-between;gap:4px;padding:0.5px 0 1px;align-items:center;">
        <strong style="color:#475569;font-weight:700;min-width:${idColWidth};flex-shrink:0;">Contact:</strong>
        <span style="font-weight:700;text-align:right;flex:1;">${contact}</span>
      </div>
    `;

  const footerText = 'CAREER XONE • सब संभव है';
  const footerBg = 'linear-gradient(90deg, #1e3a8a 0%, #2563eb 100%)';

  // Name color: Bold Red for staff (#dc2626) as requested
  const nameColor = isStaff ? '#dc2626' : '#0f172a';

  return `
  <div style="width:${cardWidth};height:${cardHeight};box-sizing:border-box;background:#ffffff;border-radius:14px;display:flex;flex-direction:column;justify-content:space-between;border:2px solid ${themeColor};position:relative;font-family:${FONT};">

    <!-- Top Banner + Logo -->
    <div style="width:100%;height:${headerHeight};background:#ffffff;border-radius:12px 12px 0 0;border-bottom:2px solid ${themeColor};display:flex;align-items:center;justify-content:center;padding:4px 8px;position:relative;flex-shrink:0;">
      ${logoB64 ? `<img src="${logoB64}" alt="Career Xone" style="max-height:100%;max-width:96%;width:auto;object-fit:contain;display:block;" />` : `<span style="font-size:18px;font-weight:900;color:${themeColor};">CAREER XONE</span>`}
    </div>

    <!-- Photo/Avatar + Roll/Staff Tag -->
    <div style="display:flex;flex-direction:column;align-items:center;margin-top:${isMini ? '2px' : (isSmall ? '3px' : '5px')};position:relative;flex-shrink:0;">
      ${photoHTML}
      <div style="background:${tagBg};color:${tagColor};font-size:${rollFontSize};font-weight:900;padding:1px 8px 1.5px;border-radius:99px;border:1px solid rgba(0,0,0,0.15);margin-top:-5px;z-index:5;letter-spacing:0.5px;white-space:nowrap;line-height:11px;">${tagLabel}</div>
    </div>

    <!-- Body Details -->
    <div style="padding:0 ${isCompact ? '8px' : '10px'};text-align:center;flex:1;display:flex;flex-direction:column;justify-content:space-evenly;">

      <div style="margin:1px 0;">
        <h3 style="margin:0 0 2px 0;font-size:${nameFontSize};color:${nameColor};font-weight:900;line-height:1.15;text-transform:uppercase;letter-spacing:0.2px;">${name}</h3>

        <div style="text-align:center;margin:2px 0 0;">
          <span style="display:inline-block;background:${badgeGradient};color:#ffffff;font-size:${courseFontSize};font-weight:800;padding:1px 9px 2.5px;border-radius:4px;letter-spacing:0.4px;line-height:11px;border:1px solid rgba(0,0,0,0.12);">${isStaff ? designation.toUpperCase() : course}</span>
        </div>
      </div>

      <!-- Info Table -->
      <div style="background:${tableBg};border-radius:6px;border:1px solid ${tableBorder};padding:${tablePadding};text-align:left;font-size:${tableFontSize};color:#0f172a;line-height:1.32;">
        ${infoTableContent}
      </div>

      <!-- QR Code -->
      <div style="display:flex;justify-content:center;align-items:center;margin:1px 0;">
        <div style="background:#ffffff;padding:2px;border-radius:5px;border:1.5px solid #93c5fd;display:inline-flex;">${qrSvg}</div>
      </div>
    </div>

    <!-- Footer Ribbon -->
    <div style="box-sizing:border-box;height:${footerHeight};width:100%;border-radius:0 0 12px 12px;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 8px 1px;font-size:${footerFontSize};line-height:1;color:#ffffff;font-weight:800;letter-spacing:0.5px;flex-shrink:0;background:${footerBg};border-top:1.5px solid ${borderPill};">${footerText}</div>
  </div>`;
}

// ─── BACK CARD (exact px copy with compact toggle) ───────────
function backCardHTML(isCompact = false, isStaff = false, customW = null, customH = null) {
  const cardWNum = customW ? (typeof customW === 'number' ? customW : parseInt(customW, 10)) : (isCompact ? 210 : 260);
  const cardHNum = customH ? (typeof customH === 'number' ? customH : parseInt(customH, 10)) : (isCompact ? 320 : 390);
  const isSmall = cardHNum < 345 || isCompact;
  const isMini = cardHNum < 295;

  const cardWidth = `${cardWNum}px`;
  const cardHeight = `${cardHNum}px`;
  const headerPadding = isMini ? '3px 4px' : (isSmall ? '4px 6px' : '7px 10px');
  const titleSize = isMini ? '8.8px' : (isSmall ? '10px' : '12.5px');
  const subtitleSize = isMini ? '5.5px' : (isSmall ? '6.5px' : '7.8px');
  const bodyPadding = isMini ? '3px 4px' : (isSmall ? '4px 6px' : '8px 10px');
  const rulesFontSize = isMini ? '5.8px' : (isSmall ? (cardHNum < 325 ? '6.4px' : '7px') : '8px');
  const rulesGap = isMini ? '1px' : (isSmall ? '1.5px' : '3px');
  const addressFontSize = isMini ? '5.6px' : (isSmall ? (cardHNum < 325 ? '6.2px' : '6.8px') : '8px');
  const addressPaddingTop = isMini ? '2px' : (isSmall ? '3px' : '5px');
  const footerHeight = isMini ? '15px' : (isSmall ? (cardHNum < 325 ? '17px' : '19px') : '23px');
  const footerFontSize = isMini ? '6.5px' : (isSmall ? '7.5px' : '8.8px');

  const themeColor = '#2563eb';
  const themeHeader = 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)';
  const borderPill = '#f59e0b';
  const bulletColor = '#2563eb';
  const footerBg = 'linear-gradient(90deg, #1e3a8a 0%, #2563eb 100%)';

  const rules = isStaff ? [
    'Employees must carry their ID card daily on campus premises.',
    'Daily check-in and check-out attendance must be recorded via scanner/biometric.',
    'This identity card is non-transferable and remains property of Career Xone.',
    'Loss or damage of this card must be reported immediately to Admin Office.',
    'If found, please return this card to Career Xone Reception.'
  ] : [
    'Students must carry their ID card daily and produce it upon demand.',
    'Students must ensure their ID card is renewed before its expiry date.',
    'Students must arrive on time; prior parental permission is required for early departure.',
    'All students must wear the prescribed uniform.',
    'Students must maintain discipline, decency, and decorum on campus.',
    'Misconduct or indiscipline may result in immediate rustication.',
    'The use or possession of mobile phones is strictly prohibited on campus.',
    'A fee of ₹200 will be charged for issuing a duplicate ID card in case of loss.',
    'If found, please return this ID card to Career Xone reception.'
  ];

  const rulesHtml = rules.map(r =>
    `<li style="display:flex;gap:3px;align-items:flex-start;">
      <span style="color:${bulletColor};font-size:6.8px;margin-top:1px;">◆</span>
      <span>${r}</span>
    </li>`
  ).join('');

  const footerText = 'CAREER XONE • सब संभव है';

  return `
  <div style="width:${cardWidth};height:${cardHeight};box-sizing:border-box;background:#ffffff;border-radius:14px;display:flex;flex-direction:column;justify-content:space-between;border:2px solid ${themeColor};position:relative;font-family:${FONT};">

    <div style="background:${themeHeader};border-radius:12px 12px 0 0;padding:${headerPadding};text-align:center;color:#ffffff;border-bottom:2px solid ${borderPill};flex-shrink:0;">
      <h4 style="margin:0;font-size:${titleSize};font-weight:900;letter-spacing:0.5px;color:#ffffff;">${isStaff ? 'STAFF IDENTITY CARD' : 'TERMS &amp; CONDITIONS'}</h4>
      <p style="margin:1px 0 0;font-size:${subtitleSize};opacity:0.9;">${isStaff ? 'Career Xone Employee Code of Conduct' : 'Career Xone Rules &amp; Regulations'}</p>
    </div>

    <div style="padding:${bodyPadding};flex:1;display:flex;flex-direction:column;justify-content:space-between;">
      <ul style="list-style:none;margin:0;padding:0;font-size:${rulesFontSize};color:#1e293b;line-height:1.30;display:flex;flex-direction:column;gap:${rulesGap};text-align:left;">
        ${rulesHtml}
      </ul>
      <div style="border-top:1px dashed #cbd5e1;padding-top:${addressPaddingTop};margin-top:2px;text-align:center;font-size:${addressFontSize};color:#334155;font-weight:600;line-height:1.35;width:100%;">
        Hadditoli Road, Near Ananya Hospital, Gondia, Maharashtra 441601<br/>
        Mob: +91 96733 83561 / +91 91454 81323 • Email: cxjeeneet@gmail.com
      </div>
    </div>

    <div style="box-sizing:border-box;height:${footerHeight};width:100%;border-radius:0 0 12px 12px;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 8px;font-size:${footerFontSize};line-height:1;color:#ffffff;font-weight:800;letter-spacing:0.5px;flex-shrink:0;background:${footerBg};border-top:1.5px solid ${borderPill};">${footerText}</div>
  </div>`;
}

// ─── MAIN GENERATOR (Supports custom sizes, 4-cards & 6-cards per A4 sheet) ─────────
async function generateIdCardPdfHtml(students, logoBase64, fontCss, mode = 'duplex', cardsPerPage = 4, customWidth = null, customHeight = null) {
  const CARDS_PER_PAGE = Number(cardsPerPage) === 6 ? 6 : 4;
  const isCompact = CARDS_PER_PAGE === 6;

  // Auto-fill slots if list has fewer items than cardsPerPage so sheet is fully filled
  let printStudents = Array.isArray(students) ? [...students] : [];
  if (printStudents.length > 0 && printStudents.length < CARDS_PER_PAGE) {
    let repIdx = 0;
    while (printStudents.length < CARDS_PER_PAGE) {
      printStudents.push(students[repIdx % students.length]);
      repIdx++;
    }
  }

  // Determine effective card width and height (respecting user custom setting)
  let cardW = customWidth ? (typeof customWidth === 'number' ? customWidth : parseInt(customWidth, 10)) : (isCompact ? 210 : 260);
  let cardH = customHeight ? (typeof customHeight === 'number' ? customHeight : parseInt(customHeight, 10)) : (isCompact ? 320 : 390);

  // Bounds check for A4 page fit (210mm x 297mm ≈ 794px x 1123px)
  if (isCompact) {
    cardW = Math.min(235, Math.max(150, cardW));
    cardH = Math.min(340, Math.max(220, cardH));
  } else {
    cardW = Math.min(320, Math.max(150, cardW));
    cardH = Math.min(450, Math.max(240, cardH));
  }

  const cardWidthStr = `${cardW}px`;
  const cardHeightStr = `${cardH}px`;
  const qrSize = cardH < 295 ? 34 : (cardH < 325 ? 40 : (cardH < 345 || isCompact ? 46 : 64));

  // Horizontal and vertical grid gap
  const horizGap = Math.max(8, Math.min(60, Math.round((734 - cardW * 2) / 2)));
  const vertGap = isCompact ? Math.max(6, Math.min(18, Math.round(cardH * 0.032))) : Math.max(12, Math.min(30, Math.round(cardH * 0.045)));

  const sheetStyle = `page-break-after:always;break-after:page;width:210mm;height:297mm;max-height:297mm;box-sizing:border-box;display:grid;grid-template-columns:repeat(2, ${cardWidthStr});gap:${vertGap}px ${horizGap}px;justify-content:center;align-content:center;padding:4mm 4mm;`;

  const totalPages = Math.ceil(printStudents.length / CARDS_PER_PAGE) || 1;
  const allPages = [];

  // Cache generated QR codes
  const qrCache = new Map();

  for (let p = 0; p < totalPages; p++) {
    const batch = printStudents.slice(p * CARDS_PER_PAGE, (p + 1) * CARDS_PER_PAGE);

    // ── FRONT PAGE ──
    const frontCardList = [];
    for (let i = 0; i < CARDS_PER_PAGE; i++) {
      let s = batch[i];
      // If still missing, fill from available students
      if (!s && printStudents.length > 0) {
        s = printStudents[i % printStudents.length];
      }
      if (s) {
        const isStaffMember = !!s.isStaff || s.role === 'staff' || (!!s.staffId && !s.rollNo);
        const cleanId = String(s.staffId || s.rollNo || s.id || '').replace(/^#+/, '').replace(/^STAFF_/i, '').trim();
        const qrKey = isStaffMember ? `STAFF_${cleanId}` : String(s.rollNo || s.id || '');
        let qrSvg = qrCache.get(qrKey);
        if (!qrSvg) {
          qrSvg = generateSolidQrSvg(qrKey, qrSize);
          qrCache.set(qrKey, qrSvg);
        }
        frontCardList.push(frontCardHTML(s, logoBase64, qrSvg, isCompact, cardW, cardH));
      } else {
        frontCardList.push(`<div style="width:${cardWidthStr};height:${cardHeightStr};visibility:hidden;"></div>`);
      }
    }

    if (mode !== 'back') {
      allPages.push(`<div style="${sheetStyle}">${frontCardList.join('')}</div>`);
    }

    // ── BACK PAGE (mirrored for duplex, or 1 master back on page 2 when single_back) ──
    const shouldAddBackPage = (mode === 'duplex' || mode === 'back') || (mode === 'single_back' && p === 0);
    if (shouldAddBackPage) {
      const backCardList = [];
      const numRows = CARDS_PER_PAGE / 2;

      // In duplex or single_back mode, swap columns so back aligns with front when printed double-sided
      // E.g. for 4 cards (2x2): [1, 0, 3, 2]; for 6 cards (2x3): [1, 0, 3, 2, 5, 4]
      const cardIndices = [];
      for (let r = 0; r < numRows; r++) {
        if (mode === 'duplex' || mode === 'single_back') {
          cardIndices.push(r * 2 + 1); // Right column moves to Left on back
          cardIndices.push(r * 2);     // Left column moves to Right on back
        } else {
          cardIndices.push(r * 2);
          cardIndices.push(r * 2 + 1);
        }
      }

      for (const idx of cardIndices) {
        let s = batch[idx];
        if (!s && printStudents.length > 0) {
          s = printStudents[idx % printStudents.length];
        }
        if (s) {
          backCardList.push(backCardHTML(isCompact, !!s.isStaff, cardW, cardH));
        } else {
          backCardList.push(`<div style="width:${cardWidthStr};height:${cardHeightStr};visibility:hidden;"></div>`);
        }
      }
      allPages.push(`<div style="${sheetStyle}">${backCardList.join('')}</div>`);
    }
  }

  return `<!DOCTYPE html>
<html lang="hi">
<head>
<meta charset="UTF-8">
<style>
${fontCss}
@page{size:A4 portrait;margin:0;}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{font-size:16px;}
html,body{width:210mm;background:#ffffff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
body{font-family:'Arial','Noto Sans Devanagari',sans-serif;}
</style>
</head>
<body>${allPages.join('')}</body>
</html>`;
}

// ─── PURE SVG SHEET EXPORTER FOR DIRECT CORELDRAW IMPORT ───
// CorelDRAW opens SVG files directly with 100% native vector paths, editable text, and solid rects.
function generateFrontCardSvg(s, logoB64, cardW, cardH, isCompact, cardIdx) {
  const isStaff = !!s.isStaff;
  const name = (s.name || '—').toUpperCase();
  const rawRoll = s.staffId || s.rollNo || s.id || (isStaff ? 'STAFF' : '—');
  const cleanStaffId = isStaff ? String(rawRoll).replace(/^#+/, '').replace(/^STAFF_/i, '').trim() : '';
  const roll = isStaff ? (cleanStaffId || 'STAFF') : (s.rollNo || s.id || '—');
  const sid = s.id || s.studentId || (isStaff ? roll : '—');
  const parent = s.parentName || s.guardianName || 'N/A';
  const contact = s.phone || s.parentPhone || 'N/A';
  const course = (s.className || s.batch || s.course || (isStaff ? 'Staff / Faculty' : 'General')).toUpperCase();
  const department = s.department || s.batch || 'General';
  const designation = (s.designation || s.className || 'Staff / Faculty').toUpperCase();

  const themeColor = '#2563eb';
  const nameColor = isStaff ? '#dc2626' : '#0f172a';
  const badgeColor = isStaff ? '#dc2626' : '#2563eb';
  const borderPill = '#f59e0b';
  const headerH = isCompact ? 44 : 56;
  const footerH = isCompact ? 18 : 22;

  // Photo dimensions & coordinates
  const photoSize = isCompact ? 56 : 74;
  const photoW = photoSize;
  const photoH = Math.round(photoSize * 1.08);
  const photoX = Math.round((cardW - photoW) / 2);
  const photoY = headerH + (isCompact ? 5 : 7);

  // Roll pill tag
  const tagW = isCompact ? 80 : 94;
  const tagH = isCompact ? 13 : 15;
  const tagX = Math.round((cardW - tagW) / 2);
  const tagY = photoY + photoH - (isCompact ? 6 : 7);

  // Proportional vertical positioning
  const contentTop = tagY + tagH;
  const contentBottom = cardH - footerH;
  const availableContentH = contentBottom - contentTop;

  // Name & Badge block
  const nameFontSize = isCompact ? 10.5 : 12.5;
  const badgeFontSize = isCompact ? 7.5 : 8.5;
  const badgeH = isCompact ? 13 : 15;
  const badgeLabel = isStaff ? designation : course;
  const badgeW = Math.min(cardW - 24, Math.max(80, badgeLabel.length * 6.5 + 14));
  const badgeX = Math.round((cardW - badgeW) / 2);

  // Info Table
  const tblW = cardW - 20;
  const tblH = isCompact ? 48 : 56;
  const tblX = 10;

  // QR size & position
  const qrKey = isStaff ? `STAFF_${roll}` : String(roll);
  const qrDisplaySize = isCompact ? 40 : 48;
  const qrX = Math.round((cardW - qrDisplaySize) / 2);

  // Calculate balanced, proportional vertical gaps
  const totalElemH = 28 + tblH + qrDisplaySize;
  const spacing = Math.max(5, Math.min(16, Math.round((availableContentH - totalElemH) / 4)));

  const nameY = contentTop + spacing + 5;
  const badgeY = nameY + 6;
  const tblY = badgeY + badgeH + spacing;
  const qrY = tblY + tblH + spacing;

  let g = '';
  // Card outer rounded rectangle
  g += `    <rect width="${cardW}" height="${cardH}" rx="14" ry="14" fill="#ffffff" stroke="${themeColor}" stroke-width="2"/>\n`;

  // Header background & line
  g += `    <path d="M 0 14 Q 0 0 14 0 L ${cardW - 14} 0 Q ${cardW} 0 ${cardW} 14 L ${cardW} ${headerH} L 0 ${headerH} Z" fill="#ffffff"/>\n`;
  g += `    <line x1="0" y1="${headerH}" x2="${cardW}" y2="${headerH}" stroke="${themeColor}" stroke-width="2"/>\n`;

  if (logoB64 && logoB64.startsWith('data:image')) {
    g += `    <image href="${logoB64}" x="10" y="4" width="${cardW - 20}" height="${headerH - 8}" preserveAspectRatio="xMidYMid meet"/>\n`;
  } else {
    g += `    <text x="${cardW / 2}" y="${headerH / 2}" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-weight="900" font-size="15" fill="${themeColor}">CAREER XONE</text>\n`;
  }

  // Photo / Avatar with dedicated clip-path
  const clipId = `card-photo-clip-${cardIdx}`;
  g += `    <defs>\n      <clipPath id="${clipId}">\n        <rect x="${photoX}" y="${photoY}" width="${photoW}" height="${photoH}" rx="8" ry="8"/>\n      </clipPath>\n    </defs>\n`;

  if (s.photo && typeof s.photo === 'string' && s.photo.startsWith('data:image')) {
    g += `    <image href="${s.photo}" x="${photoX}" y="${photoY}" width="${photoW}" height="${photoH}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>\n`;
    g += `    <rect x="${photoX}" y="${photoY}" width="${photoW}" height="${photoH}" rx="8" ry="8" fill="none" stroke="${borderPill}" stroke-width="2"/>\n`;
  } else {
    const initials = getInitials(name);
    g += `    <rect x="${photoX}" y="${photoY}" width="${photoW}" height="${photoH}" rx="8" ry="8" fill="#1e3a8a" stroke="${borderPill}" stroke-width="2"/>\n`;
    g += `    <text x="${photoX + photoW / 2}" y="${photoY + photoH / 2}" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-weight="800" font-size="20" fill="#ffffff">${initials}</text>\n`;
  }

  // Tag
  g += `    <rect x="${tagX}" y="${tagY}" width="${tagW}" height="${tagH}" rx="${tagH / 2}" ry="${tagH / 2}" fill="#f59e0b" stroke="#ffffff" stroke-width="1"/>\n`;
  g += `    <text x="${cardW / 2}" y="${tagY + tagH / 2}" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-weight="900" font-size="7" fill="#0f172a">${isStaff ? 'STAFF ID: ' + roll : 'ROLL: ' + roll}</text>\n`;

  // Name
  g += `    <text x="${cardW / 2}" y="${nameY}" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-weight="900" font-size="${nameFontSize}" fill="${nameColor}">${name}</text>\n`;

  // Badge
  g += `    <rect x="${badgeX}" y="${badgeY}" width="${badgeW}" height="${badgeH}" rx="4" ry="4" fill="${badgeColor}"/>\n`;
  g += `    <text x="${cardW / 2}" y="${badgeY + badgeH / 2}" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-weight="800" font-size="${badgeFontSize}" fill="#ffffff">${badgeLabel}</text>\n`;

  // Info Table
  g += `    <rect x="${tblX}" y="${tblY}" width="${tblW}" height="${tblH}" rx="6" ry="6" fill="#f8fafc" stroke="#bfdbfe" stroke-width="1"/>\n`;
  const rowH = tblH / 3;
  // Row 1
  g += `    <line x1="${tblX}" y1="${tblY + rowH}" x2="${tblX + tblW}" y2="${tblY + rowH}" stroke="#e2e8f0" stroke-width="1"/>\n`;
  g += `    <text x="${tblX + 8}" y="${tblY + rowH * 0.5}" dominant-baseline="central" font-family="Arial, sans-serif" font-weight="800" font-size="7.5" fill="#0f172a">${isStaff ? 'Staff ID:' : 'Student ID:'}</text>\n`;
  g += `    <text x="${tblX + tblW - 8}" y="${tblY + rowH * 0.5}" text-anchor="end" dominant-baseline="central" font-family="Arial, sans-serif" font-weight="900" font-size="7.5" fill="${isStaff ? '#0f172a' : '#2563eb'}">${isStaff ? roll : sid}</text>\n`;
  // Row 2
  g += `    <line x1="${tblX}" y1="${tblY + rowH * 2}" x2="${tblX + tblW}" y2="${tblY + rowH * 2}" stroke="#e2e8f0" stroke-width="1"/>\n`;
  g += `    <text x="${tblX + 8}" y="${tblY + rowH * 1.5}" dominant-baseline="central" font-family="Arial, sans-serif" font-weight="800" font-size="7.5" fill="#0f172a">${isStaff ? 'Department:' : 'Parent:'}</text>\n`;
  g += `    <text x="${tblX + tblW - 8}" y="${tblY + rowH * 1.5}" text-anchor="end" dominant-baseline="central" font-family="Arial, sans-serif" font-weight="700" font-size="7.5" fill="#0f172a">${isStaff ? department : parent}</text>\n`;
  // Row 3
  g += `    <text x="${tblX + 8}" y="${tblY + rowH * 2.5}" dominant-baseline="central" font-family="Arial, sans-serif" font-weight="800" font-size="7.5" fill="#0f172a">Contact:</text>\n`;
  g += `    <text x="${tblX + tblW - 8}" y="${tblY + rowH * 2.5}" text-anchor="end" dominant-baseline="central" font-family="Arial, sans-serif" font-weight="700" font-size="7.5" fill="#0f172a">${contact}</text>\n`;

  // QR Container & Solid Vector Rectangles (Direct scale without nested <svg> for 100% CorelDRAW compatibility)
  const qr = QRCode.create(qrKey, { errorCorrectionLevel: 'M' });
  const modCount = qr.modules.size;
  const margin = 1;
  const totalDim = modCount + margin * 2;
  const qrRects = [];
  for (let r = 0; r < modCount; r++) {
    let startCol = -1;
    for (let c = 0; c < modCount; c++) {
      const isDark = qr.modules.get(r, c);
      if (isDark && startCol === -1) {
        startCol = c;
      } else if (!isDark && startCol !== -1) {
        const w = c - startCol;
        qrRects.push(`<rect x="${startCol + margin}" y="${r + margin}" width="${w}" height="1" fill="#000000"/>`);
        startCol = -1;
      }
    }
    if (startCol !== -1) {
      const w = modCount - startCol;
      qrRects.push(`<rect x="${startCol + margin}" y="${r + margin}" width="${w}" height="1" fill="#000000"/>`);
    }
  }
  const scale = qrDisplaySize / totalDim;
  g += `    <rect x="${qrX - 2}" y="${qrY - 2}" width="${qrDisplaySize + 4}" height="${qrDisplaySize + 4}" rx="5" ry="5" fill="#ffffff" stroke="#93c5fd" stroke-width="1.5"/>\n`;
  g += `    <g transform="translate(${qrX}, ${qrY}) scale(${scale})">\n`;
  g += `      <rect width="${totalDim}" height="${totalDim}" fill="#ffffff"/>\n`;
  g += `      ${qrRects.join('')}\n`;
  g += `    </g>\n`;

  // Footer Ribbon
  g += `    <path d="M 0 ${cardH - footerH} L ${cardW} ${cardH - footerH} L ${cardW} ${cardH - 14} Q ${cardW} ${cardH} ${cardW - 14} ${cardH} L 14 ${cardH} Q 0 ${cardH} 0 ${cardH - 14} Z" fill="#1e3a8a"/>\n`;
  g += `    <line x1="0" y1="${cardH - footerH}" x2="${cardW}" y2="${cardH - footerH}" stroke="${borderPill}" stroke-width="1.5"/>\n`;
  g += `    <text x="${cardW / 2}" y="${cardH - footerH / 2}" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-weight="800" font-size="7.5" fill="#ffffff">CAREER XONE • सब संभव है</text>\n`;

  return g;
}

function generateBackCardSvg(isStaff, cardW, cardH, isCompact) {
  const themeColor = '#2563eb';
  const borderPill = '#f59e0b';
  const headerH = isCompact ? 40 : 50;
  const footerH = isCompact ? 18 : 22;

  const rules = isStaff ? [
    'Employees must carry their ID card daily on campus premises.',
    'Daily check-in/out attendance must be recorded via scanner/biometric.',
    'This identity card is non-transferable and remains property of Career Xone.',
    'Loss or damage must be reported immediately to Admin Office.',
    'If found, please return this card to Career Xone Reception.'
  ] : [
    'Students must carry their ID card daily and produce upon demand.',
    'Students must ensure ID card is renewed before expiry date.',
    'Students must arrive on time; prior parental permission needed for early leave.',
    'All students must wear the prescribed uniform.',
    'Students must maintain discipline, decency, and decorum on campus.',
    'Misconduct or indiscipline may result in immediate rustication.',
    'Use or possession of mobile phones is strictly prohibited.',
    'A fee of ₹200 will be charged for issuing a duplicate ID card.',
    'If found, please return this ID card to Career Xone reception.'
  ];

  let g = '';
  // Outer rect
  g += `    <rect width="${cardW}" height="${cardH}" rx="14" ry="14" fill="#ffffff" stroke="${themeColor}" stroke-width="2"/>\n`;

  // Header
  g += `    <path d="M 0 14 Q 0 0 14 0 L ${cardW - 14} 0 Q ${cardW} 0 ${cardW} 14 L ${cardW} ${headerH} L 0 ${headerH} Z" fill="#1e3a8a"/>\n`;
  g += `    <line x1="0" y1="${headerH}" x2="${cardW}" y2="${headerH}" stroke="${borderPill}" stroke-width="2"/>\n`;
  g += `    <text x="${cardW / 2}" y="${headerH / 2 - 4}" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-weight="900" font-size="${isCompact ? 9 : 11}" fill="#ffffff">${isStaff ? 'STAFF IDENTITY CARD' : 'TERMS &amp; CONDITIONS'}</text>\n`;
  g += `    <text x="${cardW / 2}" y="${headerH / 2 + 8}" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-weight="600" font-size="${isCompact ? 5.5 : 7}" fill="#ffffff" opacity="0.9">${isStaff ? 'Career Xone Employee Code of Conduct' : 'Career Xone Rules &amp; Regulations'}</text>\n`;

  // Rules list
  const rulesTop = headerH + 10;
  const rulesBottom = cardH - footerH - (isCompact ? 32 : 40);
  const rulesGap = (rulesBottom - rulesTop) / (rules.length - 1);
  const ruleFontSize = isCompact ? 6.2 : 7.4;

  rules.forEach((r, idx) => {
    const yPos = rulesTop + idx * rulesGap;
    g += `    <text x="12" y="${yPos}" dominant-baseline="central" font-family="Arial, sans-serif" font-weight="800" font-size="${ruleFontSize}" fill="${themeColor}">◆</text>\n`;
    g += `    <text x="22" y="${yPos}" dominant-baseline="central" font-family="Arial, sans-serif" font-weight="600" font-size="${ruleFontSize}" fill="#1e293b">${r}</text>\n`;
  });

  // Address
  const addrY = cardH - footerH - (isCompact ? 22 : 28);
  g += `    <line x1="12" y1="${addrY}" x2="${cardW - 12}" y2="${addrY}" stroke="#cbd5e1" stroke-dasharray="3,3" stroke-width="1"/>\n`;
  g += `    <text x="${cardW / 2}" y="${addrY + 8}" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-weight="600" font-size="${isCompact ? 5.5 : 6.8}" fill="#334155">Hadditoli Road, Near Ananya Hospital, Gondia 441601</text>\n`;
  g += `    <text x="${cardW / 2}" y="${addrY + 16}" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-weight="600" font-size="${isCompact ? 5.5 : 6.8}" fill="#334155">Mob: +91 96733 83561 • cxjeeneet@gmail.com</text>\n`;

  // Footer Ribbon
  g += `    <path d="M 0 ${cardH - footerH} L ${cardW} ${cardH - footerH} L ${cardW} ${cardH - 14} Q ${cardW} ${cardH} ${cardW - 14} ${cardH} L 14 ${cardH} Q 0 ${cardH} 0 ${cardH - 14} Z" fill="#1e3a8a"/>\n`;
  g += `    <line x1="0" y1="${cardH - footerH}" x2="${cardW}" y2="${cardH - footerH}" stroke="${borderPill}" stroke-width="1.5"/>\n`;
  g += `    <text x="${cardW / 2}" y="${cardH - footerH / 2}" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-weight="800" font-size="7.5" fill="#ffffff">CAREER XONE • सब संभव है</text>\n`;

  return g;
}

function generateIdCardSheetSvg(students, logoBase64 = '', side = 'front', cardsPerPage = 4, customWidth = null, customHeight = null) {
  const CARDS_PER_PAGE = Number(cardsPerPage) === 6 ? 6 : 4;
  const isCompact = CARDS_PER_PAGE === 6;

  let printStudents = Array.isArray(students) ? [...students] : [];
  if (printStudents.length > 0 && printStudents.length < CARDS_PER_PAGE) {
    let repIdx = 0;
    while (printStudents.length < CARDS_PER_PAGE) {
      printStudents.push(students[repIdx % students.length]);
      repIdx++;
    }
  }

  let cardW = customWidth ? (typeof customWidth === 'number' ? customWidth : parseInt(customWidth, 10)) : (isCompact ? 210 : 260);
  let cardH = customHeight ? (typeof customHeight === 'number' ? customHeight : parseInt(customHeight, 10)) : (isCompact ? 320 : 390);

  if (isCompact) {
    cardW = Math.min(235, Math.max(150, cardW));
    cardH = Math.min(340, Math.max(220, cardH));
  } else {
    cardW = Math.min(320, Math.max(150, cardW));
    cardH = Math.min(450, Math.max(240, cardH));
  }

  const horizGap = Math.max(8, Math.min(60, Math.round((734 - cardW * 2) / 2)));
  const vertGap = isCompact ? Math.max(6, Math.min(18, Math.round(cardH * 0.032))) : Math.max(12, Math.min(30, Math.round(cardH * 0.045)));
  const leftPad = Math.round((794 - (cardW * 2 + horizGap)) / 2);
  const totalGridHeight = (CARDS_PER_PAGE / 2) * cardH + ((CARDS_PER_PAGE / 2) - 1) * vertGap;
  const topPad = Math.max(20, Math.round((1123 - totalGridHeight) / 2));

  const totalPages = Math.max(1, Math.ceil(printStudents.length / CARDS_PER_PAGE));
  const sheetList = [];

  if (side === 'back') {
    for (let p = 0; p < totalPages; p++) {
      const batch = printStudents.slice(p * CARDS_PER_PAGE, (p + 1) * CARDS_PER_PAGE);
      sheetList.push({
        type: 'back',
        title: `SHEET ${p + 1}: BACK FACES (Page ${p + 1} of ${totalPages})`,
        batch,
        isDuplexBack: false
      });
    }
  } else if (side === 'duplex' || side === 'both') {
    for (let p = 0; p < totalPages; p++) {
      const batch = printStudents.slice(p * CARDS_PER_PAGE, (p + 1) * CARDS_PER_PAGE);
      sheetList.push({
        type: 'front',
        title: `SHEET ${sheetList.length + 1}: FRONT FACES (Page ${p + 1} of ${totalPages})`,
        batch,
        isDuplexBack: false
      });
      sheetList.push({
        type: 'back',
        title: `SHEET ${sheetList.length + 1}: DUPLEX BACK FACES (Reverse of Page ${p + 1})`,
        batch,
        isDuplexBack: true
      });
    }
  } else if (side === 'single_back') {
    for (let p = 0; p < totalPages; p++) {
      const batch = printStudents.slice(p * CARDS_PER_PAGE, (p + 1) * CARDS_PER_PAGE);
      sheetList.push({
        type: 'front',
        title: `SHEET ${p + 1}: FRONT FACES (Page ${p + 1} of ${totalPages})`,
        batch,
        isDuplexBack: false
      });
    }
    const masterBatch = printStudents.slice(0, CARDS_PER_PAGE);
    sheetList.push({
      type: 'back',
      title: `SHEET ${sheetList.length + 1}: 1 MASTER BACK TEMPLATE SHEET`,
      batch: masterBatch,
      isDuplexBack: true
    });
  } else {
    // Default: 'front'
    for (let p = 0; p < totalPages; p++) {
      const batch = printStudents.slice(p * CARDS_PER_PAGE, (p + 1) * CARDS_PER_PAGE);
      sheetList.push({
        type: 'front',
        title: `SHEET ${p + 1}: FRONT FACES (Page ${p + 1} of ${totalPages})`,
        batch,
        isDuplexBack: false
      });
    }
  }

  const sheetW = 794;
  const sheetH = 1123;
  const sheetGap = 40;
  const totalSheets = sheetList.length;
  const canvasH = totalSheets * sheetH + (totalSheets - 1) * sheetGap;

  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${sheetW}px" height="${canvasH}px" viewBox="0 0 ${sheetW} ${canvasH}">\n`;

  let globalCardIdx = 0;

  sheetList.forEach((sheet, sheetIdx) => {
    const sheetY = sheetIdx * (sheetH + sheetGap);
    svgContent += `  <!-- ========================================== -->\n`;
    svgContent += `  <!-- ${sheet.title} (A4: 794x1123) -->\n`;
    svgContent += `  <!-- ========================================== -->\n`;
    svgContent += `  <g id="sheet-${sheetIdx + 1}" transform="translate(0, ${sheetY})">\n`;
    svgContent += `    <rect width="${sheetW}" height="${sheetH}" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>\n`;

    for (let slot = 0; slot < CARDS_PER_PAGE; slot++) {
      const row = Math.floor(slot / 2);
      const col = slot % 2;
      const posX = leftPad + col * (cardW + horizGap);
      const posY = topPad + row * (cardH + vertGap);

      let stIdx = slot;
      if (sheet.isDuplexBack) {
        stIdx = row * 2 + (col === 0 ? 1 : 0);
      }

      let s = sheet.batch[stIdx];
      if (!s && printStudents.length > 0 && sheet.type === 'back') {
        s = printStudents[stIdx % printStudents.length];
      }
      if (!s) continue;

      globalCardIdx++;
      svgContent += `    <!-- Card Slot ${slot + 1}: ${s.name || 'Card'} -->\n`;
      svgContent += `    <g transform="translate(${posX}, ${posY})">\n`;
      if (sheet.type === 'back') {
        svgContent += generateBackCardSvg(!!s.isStaff, cardW, cardH, isCompact);
      } else {
        svgContent += generateFrontCardSvg(s, logoBase64, cardW, cardH, isCompact, globalCardIdx);
      }
      svgContent += `    </g>\n`;
    }

    svgContent += `  </g>\n`;
  });

  svgContent += `</svg>`;
  return svgContent;
}

module.exports = { generateIdCardPdfHtml, generateIdCardSheetSvg, generateSolidQrSvg, frontCardHTML, backCardHTML };


