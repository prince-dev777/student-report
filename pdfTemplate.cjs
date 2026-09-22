// pdfTemplate.cjs - Career Xone ID Card PDF Generator (Supports 4 Cards & 6 Cards / Sheet)
const QRCode = require('qrcode');

const FONT = "'Inter','Noto Sans Devanagari',-apple-system,'Segoe UI',Roboto,sans-serif";

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// ─── FRONT CARD (exact px copy of StudentIdCard.jsx / StaffIdCard.jsx) ───
function frontCardHTML(s, logoB64, qrSvg, isCompact = false) {
  const isStaff = !!s.isStaff;
  const name = (s.name || '—').toUpperCase();
  const roll = s.rollNo || s.id || (isStaff ? 'STAFF' : '—');
  const sid = s.id || s.studentId || (isStaff ? roll : '—');
  const parent = s.parentName || s.guardianName || 'N/A';
  const contact = s.phone || s.parentPhone || 'N/A';
  const course = (s.className || s.batch || s.course || (isStaff ? 'Staff / Faculty' : 'General')).toUpperCase();
  const department = s.department || s.batch || 'General';
  const designation = s.designation || s.className || 'Staff / Faculty';

  const cardWidth = isCompact ? '230px' : '260px';
  const cardHeight = isCompact ? '350px' : '390px';
  const headerHeight = isCompact ? '58px' : '68px';
  const photoW = isCompact ? '68px' : '76px';
  const photoH = isCompact ? '72px' : '80px';
  const photoInitialsSize = isCompact ? '20px' : '24px';
  const rollFontSize = isCompact ? '7px' : '7.7px';
  const nameFontSize = isCompact ? '12px' : '13.4px';
  const courseFontSize = isCompact ? '7.4px' : '8.3px';
  const tablePadding = isCompact ? '2px 6px 3.5px' : '2.5px 8px 5px';
  const tableFontSize = isCompact ? '8.3px' : '9.3px';
  const idColWidth = isCompact ? '50px' : '58px';
  const idValueSize = isCompact ? '8.2px' : '9px';
  const footerHeight = isCompact ? '21px' : '24px';
  const footerFontSize = isCompact ? '8.8px' : '9.6px';

  const themeColor = isStaff ? '#0f766e' : '#2563eb';
  const themeGradient = isStaff ? 'linear-gradient(135deg, #134e4a 0%, #0f766e 100%)' : 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)';
  const badgeGradient = isStaff ? 'linear-gradient(90deg, #115e59, #0f766e)' : 'linear-gradient(90deg, #1e3a8a, #2563eb)';
  const borderPill = isStaff ? '#0d9488' : '#f59e0b';
  const tagBg = isStaff ? '#0d9488' : '#f59e0b';
  const tagColor = isStaff ? '#ffffff' : '#0f172a';
  const tagLabel = isStaff ? `STAFF ID: ${roll}` : `ROLL: ${roll}`;
  const tableBg = isStaff ? '#f0fdfa' : '#f8fafc';
  const tableBorder = isStaff ? '#99f6e4' : '#bfdbfe';

  const photoHTML = s.photo
    ? `<img src="${s.photo}" style="width:${photoW};height:${photoH};border-radius:9px;object-fit:cover;border:2px solid ${borderPill};box-shadow:0 4px 12px rgba(15,118,110,0.25);background:#fff;display:block;" />`
    : `<div style="width:${photoW};height:${photoH};border-radius:9px;background:${themeGradient};display:flex;align-items:center;justify-content:center;text-align:center;border:2px solid ${borderPill};box-shadow:0 4px 12px rgba(15,118,110,0.25);color:#fff;font-size:${photoInitialsSize};font-weight:800;letter-spacing:2px;text-indent:2px;line-height:1;">${getInitials(s.name)}</div>`;

  const infoTableContent = isStaff
    ? `
      <div style="display:flex;justify-content:space-between;gap:4px;padding:0.5px 0 2px;border-bottom:1px solid #ccfbf1;align-items:center;">
        <strong style="color:#0f766e;font-weight:700;min-width:${idColWidth};flex-shrink:0;">Department:</strong>
        <span style="font-weight:800;color:#134e4a;text-align:right;flex:1;word-break:break-word;">${department}</span>
      </div>
      <div style="display:flex;justify-content:space-between;gap:4px;padding:0.5px 0 2px;border-bottom:1px solid #ccfbf1;align-items:center;">
        <strong style="color:#0f766e;font-weight:700;min-width:${idColWidth};flex-shrink:0;">Contact:</strong>
        <span style="font-weight:700;text-align:right;flex:1;word-break:break-word;">${contact}</span>
      </div>
      <div style="display:flex;justify-content:space-between;gap:4px;padding:0.5px 0 1px;align-items:center;">
        <strong style="color:#0f766e;font-weight:700;min-width:${idColWidth};flex-shrink:0;">Access:</strong>
        <span style="font-weight:800;color:#0d9488;text-align:right;flex:1;text-transform:uppercase;">${s.role || 'Staff'}</span>
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

  const footerText = isStaff ? 'OFFICIAL EMPLOYEE • CAREER XONE' : 'CAREER XONE • सब संभव है';

  return `
  <div style="width:${cardWidth};height:${cardHeight};box-sizing:border-box;background:#ffffff;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;border:2px solid ${themeColor};position:relative;font-family:${FONT};">

    <!-- Top Banner + Logo -->
    <div style="width:100%;height:${headerHeight};background:#ffffff;border-bottom:2px solid ${themeColor};display:flex;align-items:center;justify-content:center;padding:4px 8px;position:relative;flex-shrink:0;">
      ${logoB64 ? `<img src="${logoB64}" alt="Career Xone" style="max-height:100%;max-width:96%;width:auto;object-fit:contain;display:block;" />` : `<span style="font-size:18px;font-weight:900;color:${themeColor};">CAREER XONE</span>`}
    </div>

    <!-- Photo/Avatar + Roll/Staff Tag -->
    <div style="display:flex;flex-direction:column;align-items:center;margin-top:1px;position:relative;flex-shrink:0;">
      ${photoHTML}
      <div style="background:${tagBg};color:${tagColor};font-size:${rollFontSize};font-weight:900;padding:0.5px 8px 1.5px;border-radius:99px;box-shadow:0 2px 6px rgba(0,0,0,0.20);margin-top:-5px;z-index:5;letter-spacing:0.5px;white-space:nowrap;line-height:11px;">${tagLabel}</div>
    </div>

    <!-- Body Details -->
    <div style="padding:0 ${isCompact ? '8px' : '10px'};text-align:center;flex:1;display:flex;flex-direction:column;justify-content:space-evenly;">

      <h3 style="margin:1px 0;font-size:${nameFontSize};color:#0f172a;font-weight:900;line-height:1.15;text-transform:uppercase;letter-spacing:0.2px;">${name}</h3>

      <div style="text-align:center;margin:1px 0;">
        <span style="display:inline-block;background:${badgeGradient};color:#ffffff;font-size:${courseFontSize};font-weight:800;padding:1px 9px 2.5px;border-radius:4px;letter-spacing:0.4px;line-height:11px;box-shadow:0 2px 6px rgba(15,118,110,0.2);">${isStaff ? designation.toUpperCase() : course}</span>
      </div>

      <!-- Info Table -->
      <div style="background:${tableBg};border-radius:6px;border:1px solid ${tableBorder};padding:${tablePadding};text-align:left;font-size:${tableFontSize};color:#0f172a;line-height:1.32;box-shadow:0 1px 4px rgba(15,118,110,0.06);">
        ${infoTableContent}
      </div>

      <!-- QR Code -->
      <div style="display:flex;justify-content:center;align-items:center;margin:1px 0;">
        <div style="background:#ffffff;padding:2px;border-radius:5px;border:1.5px solid ${isStaff ? '#5eead4' : '#93c5fd'};box-shadow:0 2px 6px rgba(15,118,110,0.12);display:inline-flex;">${qrSvg}</div>
      </div>
    </div>

    <!-- Footer Ribbon -->
    <div style="box-sizing:border-box;height:${footerHeight};width:100%;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 8px 1px;font-size:${footerFontSize};line-height:1;color:#ffffff;font-weight:800;letter-spacing:0.5px;flex-shrink:0;background:${isStaff ? '#0f766e' : 'linear-gradient(90deg,#1e3a8a 0%,#2563eb 100%)'};border-top:1.5px solid ${borderPill};">${footerText}</div>
  </div>`;
}

// ─── BACK CARD (exact px copy with compact toggle) ───────────
function backCardHTML(isCompact = false, isStaff = false) {
  const cardWidth = isCompact ? '230px' : '260px';
  const cardHeight = isCompact ? '350px' : '390px';
  const headerPadding = isCompact ? '5px 8px' : '7px 10px';
  const titleSize = isCompact ? '11.5px' : '13.1px';
  const subtitleSize = isCompact ? '7px' : '8px';
  const bodyPadding = isCompact ? '6px 8px' : '8px 10px';
  const rulesFontSize = isCompact ? '7.3px' : '8.3px';
  const rulesGap = isCompact ? '2px' : '3px';
  const addressFontSize = isCompact ? '7.2px' : '8.2px';
  const addressPaddingTop = isCompact ? '4px' : '6px';
  const footerHeight = isCompact ? '21px' : '25px';
  const footerFontSize = isCompact ? '8.8px' : '9.9px';

  const themeColor = isStaff ? '#0f766e' : '#2563eb';
  const themeHeader = isStaff ? 'linear-gradient(135deg,#115e59 0%,#0f766e 100%)' : 'linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%)';
  const borderPill = isStaff ? '#0d9488' : '#f59e0b';
  const bulletColor = isStaff ? '#0d9488' : '#2563eb';

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

  const footerText = isStaff ? 'OFFICIAL EMPLOYEE • CAREER XONE' : 'CAREER XONE • सब संभव है';

  return `
  <div style="width:${cardWidth};height:${cardHeight};box-sizing:border-box;background:#ffffff;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;border:2px solid ${themeColor};position:relative;font-family:${FONT};">

    <div style="background:${themeHeader};padding:${headerPadding};text-align:center;color:#ffffff;border-bottom:2px solid ${borderPill};flex-shrink:0;">
      <h4 style="margin:0;font-size:${titleSize};font-weight:900;letter-spacing:0.5px;color:#ffffff;">${isStaff ? 'STAFF IDENTITY CARD' : 'TERMS &amp; CONDITIONS'}</h4>
      <p style="margin:1px 0 0;font-size:${subtitleSize};opacity:0.9;">${isStaff ? 'Career Xone Employee Code of Conduct' : 'Career Xone Rules &amp; Regulations'}</p>
    </div>

    <div style="padding:${bodyPadding};flex:1;display:flex;flex-direction:column;justify-content:space-between;">
      <ul style="list-style:none;margin:0;padding:0;font-size:${rulesFontSize};color:#1e293b;line-height:1.30;display:flex;flex-direction:column;gap:${rulesGap};text-align:left;">
        ${rulesHtml}
      </ul>
      <div style="border-top:1px dashed #cbd5e1;padding-top:${addressPaddingTop};margin-top:2px;text-align:center;font-size:${addressFontSize};color:#334155;font-weight:600;line-height:1.35;width:100%;">
        Near Z.P. High School Ground, Main Road, Gondia - 441614<br/>
        Mob: +91 8538949912 / 96733 83561 • Email: cxjeeneet@gmail.com
      </div>
    </div>

    <div style="box-sizing:border-box;height:${footerHeight};width:100%;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 8px;font-size:${footerFontSize};line-height:1;color:#ffffff;font-weight:800;letter-spacing:0.5px;flex-shrink:0;background:${isStaff ? '#0f766e' : 'linear-gradient(90deg,#1e3a8a 0%,#2563eb 100%)'};border-top:1.5px solid ${borderPill};">${footerText}</div>
  </div>`;
}

// ─── MAIN GENERATOR (Supports both 4-cards and 6-cards per A4 sheet) ─────────
async function generateIdCardPdfHtml(students, logoBase64, fontCss, mode = 'duplex', cardsPerPage = 4) {
  const CARDS_PER_PAGE = Number(cardsPerPage) === 6 ? 6 : 4;
  const isCompact = CARDS_PER_PAGE === 6;
  const totalPages = Math.ceil(students.length / CARDS_PER_PAGE);
  const allPages = [];

  // Layout Styles:
  // 4 Cards: 2 cols x 260px, gap 24px 36px, centered
  // 6 Cards: 2 cols x 230px, gap 8px 30px, centered on 297mm height
  const sheetStyle = isCompact
    ? `page-break-after:always;break-after:page;width:210mm;height:297mm;max-height:297mm;box-sizing:border-box;display:grid;grid-template-columns:repeat(2,230px);gap:8px 30px;justify-content:center;align-content:center;padding:4mm 6mm;overflow:hidden;`
    : `page-break-after:always;break-after:page;width:210mm;height:297mm;max-height:297mm;box-sizing:border-box;display:grid;grid-template-columns:repeat(2,260px);gap:24px 36px;justify-content:center;align-content:center;padding:10mm 8mm;overflow:hidden;`;

  const cardWidth = isCompact ? '230px' : '260px';
  const cardHeight = isCompact ? '350px' : '390px';
  const qrSize = isCompact ? 60 : 74;

  // Cache generated QR codes to avoid redundant SVG generation for large sets
  const qrCache = new Map();

  for (let p = 0; p < totalPages; p++) {
    const batch = students.slice(p * CARDS_PER_PAGE, (p + 1) * CARDS_PER_PAGE);

    // ── FRONT PAGE ──
    const frontCardList = [];
    for (let i = 0; i < CARDS_PER_PAGE; i++) {
      const s = batch[i];
      if (s) {
        const qrKey = String(s.rollNo || s.id || '');
        let qrSvg = qrCache.get(qrKey);
        if (!qrSvg) {
          try {
            qrSvg = await QRCode.toString(qrKey, {
              type: 'svg', width: qrSize, margin: 1,
              color: { dark: '#000000', light: '#ffffff' }
            });
            qrSvg = qrSvg.replace('<svg', `<svg style="display:block;width:${qrSize}px;height:${qrSize}px;"`);
            qrCache.set(qrKey, qrSvg);
          } catch (e) {
            qrSvg = `<div style="width:${qrSize}px;height:${qrSize}px;border:1px solid #ccc;display:flex;align-items:center;justify-content:center;font-size:8px;">QR</div>`;
          }
        }
        frontCardList.push(frontCardHTML(s, logoBase64, qrSvg, isCompact));
      } else {
        frontCardList.push(`<div style="width:${cardWidth};height:${cardHeight};visibility:hidden;"></div>`);
      }
    }

    if (mode !== 'back') {
      allPages.push(`<div style="${sheetStyle}">${frontCardList.join('')}</div>`);
    }

    // ── BACK PAGE (mirrored for duplex) ──
    if (mode === 'duplex' || mode === 'back') {
      const backCardList = [];
      for (let i = 0; i < CARDS_PER_PAGE; i++) {
        const s = batch[i];
        if (s) {
          backCardList.push(`<div style="transform:scaleX(-1);">${backCardHTML(isCompact, !!s.isStaff)}</div>`);
        } else {
          backCardList.push(`<div style="width:${cardWidth};height:${cardHeight};visibility:hidden;"></div>`);
        }
      }
      allPages.push(`<div style="${sheetStyle}transform:scaleX(-1);">${backCardList.join('')}</div>`);
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
body{font-family:'Inter','Noto Sans Devanagari',sans-serif;}
</style>
</head>
<body>${allPages.join('')}</body>
</html>`;
}

module.exports = { generateIdCardPdfHtml, frontCardHTML, backCardHTML };
