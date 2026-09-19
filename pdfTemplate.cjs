// pdfTemplate.cjs - Career Xone ID Card PDF (PREVIEW-EXACT px parity)
const QRCode = require('qrcode');

const FONT = "'Inter','Noto Sans Devanagari',-apple-system,'Segoe UI',Roboto,sans-serif";

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// ─── FRONT CARD (exact px copy of StudentIdCard.jsx) ─────────
function frontCardHTML(s, logoB64, qrSvg) {
  const name = (s.name || '—').toUpperCase();
  const roll = s.rollNo || s.id || '—';
  const sid = s.id || s.studentId || '—';
  const parent = s.parentName || s.guardianName || 'N/A';
  const contact = s.parentPhone || s.phone || 'N/A';
  const course = (s.className || s.batch || s.course || 'General').toUpperCase();

  const photoHTML = s.photo
    ? `<img src="${s.photo}" style="width:76px;height:80px;border-radius:10px;object-fit:cover;border:2px solid #f59e0b;box-shadow:0 4px 12px rgba(37,99,235,0.25);background:#fff;display:block;" />`
    : `<div style="width:76px;height:80px;border-radius:10px;background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%);display:flex;align-items:center;justify-content:center;text-align:center;border:2px solid #f59e0b;box-shadow:0 4px 12px rgba(37,99,235,0.25);color:#fff;font-size:24px;font-weight:800;letter-spacing:2px;text-indent:2px;line-height:1;">${getInitials(s.name)}</div>`;

  return `
  <div style="width:260px;height:390px;box-sizing:border-box;background:#ffffff;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;border:2px solid #2563eb;position:relative;font-family:${FONT};">

    <!-- Top Banner + Logo (68px, same as preview) -->
    <div style="width:100%;height:68px;background:#ffffff;border-bottom:2px solid #2563eb;display:flex;align-items:center;justify-content:center;padding:4px 8px;position:relative;flex-shrink:0;">
      ${logoB64 ? `<img src="${logoB64}" alt="Career Xone" style="max-height:100%;max-width:96%;width:auto;object-fit:contain;display:block;" />` : `<span style="font-size:20px;font-weight:900;color:#2563eb;">CAREER XONE</span>`}
    </div>

    <!-- Photo/Avatar + Gold Roll Tag -->
    <div style="display:flex;flex-direction:column;align-items:center;margin-top:2px;position:relative;flex-shrink:0;">
      ${photoHTML}
      <div style="background:#f59e0b;color:#0f172a;font-size:7.7px;font-weight:900;padding:0.5px 8px 2px;border-radius:99px;box-shadow:0 2px 6px rgba(0,0,0,0.20);margin-top:-6px;z-index:5;letter-spacing:0.5px;white-space:nowrap;line-height:12px;">ROLL: ${roll}</div>
    </div>

    <!-- Body Details (space-evenly, same as preview) -->
    <div style="padding:0 10px;text-align:center;flex:1;display:flex;flex-direction:column;justify-content:space-evenly;">

      <h3 style="margin:1px 0;font-size:13.4px;color:#0f172a;font-weight:900;line-height:1.15;text-transform:uppercase;letter-spacing:0.2px;">${name}</h3>

      <div style="text-align:center;margin:1px 0;">
        <span style="display:inline-block;background:linear-gradient(90deg,#1e3a8a,#2563eb);color:#ffffff;font-size:8.3px;font-weight:800;padding:1px 10px 3px;border-radius:4px;letter-spacing:0.4px;line-height:12px;box-shadow:0 2px 6px rgba(37,99,235,0.2);">${course}</span>
      </div>

      <!-- Info Table -->
      <div style="background:#f8fafc;border-radius:6px;border:1px solid #bfdbfe;padding:2.5px 8px 5px;text-align:left;font-size:9.3px;color:#0f172a;line-height:1.34;box-shadow:0 1px 4px rgba(37,99,235,0.06);">
        <div style="display:flex;justify-content:space-between;gap:4px;padding:0.5px 0 2.5px;border-bottom:1px solid #e2e8f0;align-items:center;">
          <strong style="color:#475569;font-weight:700;min-width:58px;flex-shrink:0;">Student ID:</strong>
          <span style="color:#2563eb;font-weight:900;font-size:9px;letter-spacing:0.4px;text-align:right;flex:1;word-break:break-word;">${sid}</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:4px;padding:0.5px 0 2.5px;border-bottom:1px solid #e2e8f0;align-items:center;">
          <strong style="color:#475569;font-weight:700;min-width:58px;flex-shrink:0;">Parent:</strong>
          <span style="font-weight:700;text-align:right;flex:1;word-break:break-word;">${parent}</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:4px;padding:0.5px 0 1.5px;align-items:center;">
          <strong style="color:#475569;font-weight:700;min-width:58px;flex-shrink:0;">Contact:</strong>
          <span style="font-weight:700;text-align:right;flex:1;">${contact}</span>
        </div>
      </div>

      <!-- QR Code (74px, same as preview) -->
      <div style="display:flex;justify-content:center;align-items:center;margin:1px 0;">
        <div style="background:#ffffff;padding:2.5px;border-radius:6px;border:1.5px solid #93c5fd;box-shadow:0 2px 6px rgba(37,99,235,0.12);display:inline-flex;">${qrSvg}</div>
      </div>
    </div>

    <!-- Footer Ribbon (24px) -->
    <div style="box-sizing:border-box;height:24px;width:100%;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 8px 1px;font-size:9.6px;line-height:1;color:#ffffff;font-weight:800;letter-spacing:0.5px;flex-shrink:0;background:linear-gradient(90deg,#1e3a8a 0%,#2563eb 100%);border-top:1.5px solid #f59e0b;">CAREER XONE • सब संभव है</div>
  </div>`;
}

// ─── BACK CARD (exact px copy) ───────────────────────────────
function backCardHTML() {
  const rules = [
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
    `<li style="display:flex;gap:4px;align-items:flex-start;">
      <span style="color:#2563eb;font-size:7.2px;margin-top:1px;">◆</span>
      <span>${r}</span>
    </li>`
  ).join('');

  return `
  <div style="width:260px;height:390px;box-sizing:border-box;background:#ffffff;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;border:2px solid #2563eb;position:relative;font-family:${FONT};">

    <div style="background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%);padding:7px 10px;text-align:center;color:#ffffff;border-bottom:2px solid #f59e0b;flex-shrink:0;">
      <h4 style="margin:0;font-size:13.1px;font-weight:900;letter-spacing:0.5px;color:#ffffff;">TERMS &amp; CONDITIONS</h4>
      <p style="margin:1px 0 0;font-size:8px;opacity:0.9;">Career Xone Rules &amp; Regulations</p>
    </div>

    <div style="padding:8px 10px;flex:1;display:flex;flex-direction:column;justify-content:space-between;">
      <ul style="list-style:none;margin:0;padding:0;font-size:8.3px;color:#1e293b;line-height:1.34;display:flex;flex-direction:column;gap:3px;text-align:left;">
        ${rulesHtml}
      </ul>
      <div style="border-top:1px dashed #cbd5e1;padding-top:6px;margin-top:3px;text-align:center;font-size:8.2px;color:#334155;font-weight:600;line-height:1.4;width:100%;">
        Hadditoli Road, Near Ananya Hospital, Gondia, MH - 441601<br/>
        Mob: +91 96733 83561 / 91454 81323 • Email: cxjeeneet@gmail.com
      </div>
    </div>

    <div style="box-sizing:border-box;height:25px;width:100%;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 8px;font-size:9.9px;line-height:1;color:#ffffff;font-weight:800;letter-spacing:0.5px;flex-shrink:0;background:linear-gradient(90deg,#1e3a8a 0%,#2563eb 100%);border-top:1.5px solid #f59e0b;">CAREER XONE • सब संभव है</div>
  </div>`;
}

// ─── MAIN GENERATOR ──────────────────────────────────────────
async function generateIdCardPdfHtml(students, logoBase64, fontCss, mode = 'duplex') {
  const CARDS_PER_PAGE = 4; // 2 x 2 grid
  const totalPages = Math.ceil(students.length / CARDS_PER_PAGE);
  let allPages = '';

  const sheetStyle = `page-break-after:always;break-after:page;width:210mm;min-height:297mm;padding:10mm 8mm;box-sizing:border-box;display:grid;grid-template-columns:repeat(2,260px);gap:24px 36px;justify-content:center;align-content:center;`;

  for (let p = 0; p < totalPages; p++) {
    const batch = students.slice(p * CARDS_PER_PAGE, (p + 1) * CARDS_PER_PAGE);

    // ── FRONT PAGE ──
    let frontCards = '';
    for (let i = 0; i < CARDS_PER_PAGE; i++) {
      const s = batch[i];
      if (s) {
        let qrSvg = '';
        try {
          qrSvg = await QRCode.toString(String(s.rollNo || s.id || ''), {
            type: 'svg', width: 74, margin: 1,
            color: { dark: '#000000', light: '#ffffff' }
          });
          qrSvg = qrSvg.replace('<svg', '<svg style="display:block;width:74px;height:74px;"');
        } catch (e) {
          qrSvg = '<div style="width:74px;height:74px;border:1px solid #ccc;display:flex;align-items:center;justify-content:center;font-size:8px;">QR</div>';
        }
        frontCards += frontCardHTML(s, logoBase64, qrSvg);
      } else {
        frontCards += '<div style="width:260px;height:390px;visibility:hidden;"></div>';
      }
    }

    if (mode !== 'back') {
      allPages += `<div style="${sheetStyle}">${frontCards}</div>`;
    }

    // ── BACK PAGE (mirrored for duplex) ──
    if (mode === 'duplex' || mode === 'back') {
      let backCards = '';
      for (let i = 0; i < CARDS_PER_PAGE; i++) {
        const s = batch[i];
        if (s) {
          backCards += `<div style="transform:scaleX(-1);">${backCardHTML()}</div>`;
        } else {
          backCards += '<div style="width:260px;height:390px;visibility:hidden;"></div>';
        }
      }
      allPages += `<div style="${sheetStyle}transform:scaleX(-1);">${backCards}</div>`;
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
<body>${allPages}</body>
</html>`;
}

module.exports = { generateIdCardPdfHtml, frontCardHTML, backCardHTML };
