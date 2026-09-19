const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

app.disableHardwareAcceleration();

// ─── Font Loader (base64 embed) ─────────────────────────────
function loadFontBase64(filename) {
  try {
    const fp = path.join(__dirname, '../assets/fonts', filename);
    if (!fs.existsSync(fp)) {
      console.warn(`⚠️ Font not found: ${fp}`);
      return null;
    }
    return fs.readFileSync(fp).toString('base64');
  } catch (e) {
    console.warn(`⚠️ Font load error: ${e.message}`);
    return null;
  }
}

function buildFontCss() {
  const inter = loadFontBase64('Inter-ExtraBold.ttf');
  const noto = loadFontBase64('NotoSansDevanagari-Bold.ttf');
  let css = '';
  if (inter) {
    css += `@font-face{font-family:'Inter';src:url(data:font/ttf;base64,${inter}) format('truetype');font-weight:100 900;font-style:normal;}\n`;
  }
  if (noto) {
    css += `@font-face{font-family:'Noto Sans Devanagari';src:url(data:font/ttf;base64,${noto}) format('truetype');font-weight:100 900;font-style:normal;}\n`;
  }
  return css;
}

// ─── FRONT CARD ───────────────────────────────────────────────
function frontCardHTML(s, logoB64, qrSvg) {
  const name = (s.name || '—').toUpperCase();
  const roll = s.rollNo || s.id || '—';
  const sid = s.id || s.studentId || '—';
  const parent = s.parentName || s.guardianName || 'N/A';
  const contact = s.parentPhone || s.phone || 'N/A';
  const course = (s.className || s.batch || s.course || 'General').toUpperCase();

  const photoHTML = s.photo
    ? `<img src="${s.photo}" style="width:20mm;height:21mm;border-radius:3mm;object-fit:cover;border:0.6mm solid #f59e0b;display:block;" />`
    : `<div style="width:20mm;height:21mm;border-radius:3mm;background:linear-gradient(135deg,#1e3a8a,#2563eb);display:flex;align-items:center;justify-content:center;border:0.6mm solid #f59e0b;color:#fff;font-size:5mm;font-weight:800;">${getInitials(s.name)}</div>`;

  return `
  <div style="width:88mm;height:132mm;border:0.6mm solid #2563eb;border-radius:4mm;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;background:#fff;position:relative;box-sizing:border-box;">

    <!-- Header Logo -->
    <div style="width:100%;height:20mm;background:#fff;border-bottom:0.6mm solid #2563eb;display:flex;align-items:center;justify-content:center;padding:1mm 2mm;flex-shrink:0;">
      ${logoB64 ? `<img src="${logoB64}" style="max-height:100%;max-width:96%;object-fit:contain;" />` : '<span style="font-size:5mm;font-weight:900;color:#2563eb;">CAREER XONE</span>'}
    </div>

    <!-- Photo + Roll Tag -->
    <div style="display:flex;flex-direction:column;align-items:center;margin-top:1mm;flex-shrink:0;">
      ${photoHTML}
      <div style="background:#f59e0b;color:#0f172a;font-size:2.8mm;font-weight:900;padding:0.4mm 3mm 0.8mm;border-radius:99px;margin-top:-1.5mm;z-index:5;letter-spacing:0.4px;line-height:3.5mm;">ROLL: ${roll}</div>
    </div>

    <!-- Body Details -->
    <div style="padding:0 3mm;text-align:center;flex:1;display:flex;flex-direction:column;justify-content:space-evenly;">

      <div style="margin:0.5mm 0;font-size:4.2mm;color:#0f172a;font-weight:900;line-height:1.15;text-transform:uppercase;letter-spacing:0.2px;">${name}</div>

      <div style="text-align:center;margin:0.5mm 0;">
        <span style="display:inline-block;background:linear-gradient(90deg,#1e3a8a,#2563eb);color:#fff;font-size:2.8mm;font-weight:800;padding:0.5mm 4mm 1mm;border-radius:2mm;letter-spacing:0.3px;line-height:3.5mm;">${course}</span>
      </div>

      <!-- Info Table -->
      <div style="background:#f8fafc;border-radius:2mm;border:0.3mm solid #bfdbfe;padding:1mm 2mm 1.5mm;text-align:left;font-size:2.8mm;color:#0f172a;line-height:1.4;">
        <div style="display:flex;justify-content:space-between;gap:1mm;padding:0.5mm 0 1mm;border-bottom:0.3mm solid #e2e8f0;align-items:center;">
          <strong style="color:#475569;font-weight:700;min-width:16mm;flex-shrink:0;">Student ID:</strong>
          <span style="color:#2563eb;font-weight:900;font-size:2.6mm;text-align:right;flex:1;word-break:break-all;">${sid}</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:1mm;padding:0.5mm 0 1mm;border-bottom:0.3mm solid #e2e8f0;align-items:center;">
          <strong style="color:#475569;font-weight:700;min-width:16mm;flex-shrink:0;">Parent:</strong>
          <span style="font-weight:700;text-align:right;flex:1;">${parent}</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:1mm;padding:0.5mm 0;align-items:center;">
          <strong style="color:#475569;font-weight:700;min-width:16mm;flex-shrink:0;">Contact:</strong>
          <span style="font-weight:700;text-align:right;flex:1;">${contact}</span>
        </div>
      </div>

      <!-- QR Code -->
      <div style="display:flex;justify-content:center;align-items:center;margin:0.5mm 0;">
        <div style="background:#fff;padding:1mm;border-radius:2mm;border:0.4mm solid #93c5fd;display:inline-flex;">
          ${qrSvg}
        </div>
      </div>
    </div>

    <!-- Footer Ribbon -->
    <div style="height:7mm;width:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(90deg,#1e3a8a,#2563eb);border-top:0.4mm solid #f59e0b;color:#fff;font-size:3mm;font-weight:800;letter-spacing:0.4px;flex-shrink:0;font-family:'Noto Sans Devanagari',sans-serif;">
      CAREER XONE • सब संभव है
    </div>
  </div>`;
}

// ─── BACK CARD ────────────────────────────────────────────────
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
    `<div style="display:flex;gap:1.2mm;align-items:flex-start;">
      <span style="color:#2563eb;font-size:2.5mm;margin-top:0.3mm;flex-shrink:0;">◆</span>
      <span>${r}</span>
    </div>`
  ).join('');

  return `
  <div style="width:88mm;height:132mm;border:0.6mm solid #2563eb;border-radius:4mm;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;background:#fff;box-sizing:border-box;">

    <!-- Back Header -->
    <div style="background:linear-gradient(135deg,#1e3a8a,#2563eb);padding:2mm 3mm;text-align:center;color:#fff;border-bottom:0.6mm solid #f59e0b;flex-shrink:0;">
      <div style="font-size:4mm;font-weight:900;letter-spacing:0.4px;">TERMS &amp; CONDITIONS</div>
      <div style="font-size:2.5mm;opacity:0.9;margin-top:0.5mm;">Career Xone Rules &amp; Regulations</div>
    </div>

    <!-- Rules -->
    <div style="padding:2mm 3mm;flex:1;display:flex;flex-direction:column;justify-content:space-between;">
      <div style="font-size:2.6mm;color:#1e293b;line-height:1.3;display:flex;flex-direction:column;gap:1mm;text-align:left;">
        ${rulesHtml}
      </div>
      <div style="border-top:0.3mm dashed #cbd5e1;padding-top:1.5mm;margin-top:1mm;text-align:center;font-size:2.5mm;color:#334155;font-weight:600;line-height:1.4;">
        Hadditoli Road, Near Ananya Hospital, Gondia, MH - 441601<br/>
        Mob: +91 96733 83561 / 91454 81323 • Email: cxjeeneet@gmail.com
      </div>
    </div>

    <!-- Back Footer -->
    <div style="height:7mm;width:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(90deg,#1e3a8a,#2563eb);border-top:0.4mm solid #f59e0b;color:#fff;font-size:3mm;font-weight:800;letter-spacing:0.4px;flex-shrink:0;font-family:'Noto Sans Devanagari',sans-serif;">
      CAREER XONE • सब संभव है
    </div>
  </div>`;
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

async function generateIdCardPdfHtml(students, logoBase64, fontCss, mode = 'duplex') {
  const CARDS_PER_PAGE = 4;
  const totalPages = Math.ceil(students.length / CARDS_PER_PAGE);
  let allPages = '';

  for (let p = 0; p < totalPages; p++) {
    const batch = students.slice(p * CARDS_PER_PAGE, (p + 1) * CARDS_PER_PAGE);

    // ── FRONT PAGE ──
    let frontCards = '';
    for (const s of batch) {
      let qrSvg = '';
      try {
        qrSvg = await QRCode.toString(String(s.rollNo || s.id || ''), {
          type: 'svg', width: 150, margin: 1,
          color: { dark: '#000000', light: '#ffffff' }
        });
        qrSvg = qrSvg.replace(/width="\d+"/, 'width="18mm"').replace(/height="\d+"/, 'height="18mm"');
      } catch (e) {
        qrSvg = '<div style="width:18mm;height:18mm;border:1px solid #ccc;display:flex;align-items:center;justify-content:center;font-size:2mm;">QR</div>';
      }
      frontCards += frontCardHTML(s, logoBase64, qrSvg);
    }

    allPages += `
    <div style="page-break-after:always;break-after:page;width:210mm;min-height:297mm;padding:10mm 11mm;display:grid;grid-template-columns:repeat(2,88mm);gap:6mm 8mm;justify-content:center;align-content:start;box-sizing:border-box;">
      ${frontCards}
    </div>`;

    // ── BACK PAGE (Mirrored for duplex) ──
    if (mode === 'duplex') {
      const mirroredBatch = [];
      const rows = 2;
      for (let r = 0; r < rows; r++) {
        const c1 = batch[r * 2] || null;
        const c2 = batch[r * 2 + 1] || null;
        mirroredBatch.push(c2);
        mirroredBatch.push(c1);
      }
      let backCards = '';
      for (const item of mirroredBatch) {
        if (item) {
          backCards += backCardHTML();
        } else {
          backCards += '<div style="width:88mm;height:132mm;visibility:hidden;"></div>';
        }
      }

      allPages += `
      <div style="page-break-after:always;break-after:page;width:210mm;min-height:297mm;padding:10mm 11mm;display:grid;grid-template-columns:repeat(2,88mm);gap:6mm 8mm;justify-content:center;align-content:start;box-sizing:border-box;">
        ${backCards}
      </div>`;
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
html,body{width:210mm;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
body{font-family:'Inter','Noto Sans Devanagari',sans-serif;}
</style>
</head>
<body>${allPages}</body>
</html>`;
}

app.whenReady().then(async () => {
  const fontCss = buildFontCss();
  console.log('Font CSS length:', fontCss.length);

  const mockStudents = [
    { name: 'Aman Kumar Sharma', rollNo: '101', id: 'CX-001', className: '12th PCM', parentName: 'Mr. R. Sharma', parentPhone: '9876543210' },
    { name: 'Priya Singh', rollNo: '102', id: 'CX-002', className: '12th PCB', parentName: 'Mr. V. Singh', parentPhone: '9123456780' },
    { name: 'Rahul Verma', rollNo: '103', id: 'CX-003', className: '11th JEE', parentName: 'Mr. K. Verma', parentPhone: '9988776655' },
    { name: 'Sneha Patel', rollNo: '104', id: 'CX-004', className: 'NEET Dropper', parentName: 'Mr. D. Patel', parentPhone: '9443322110' }
  ];

  const html = await generateIdCardPdfHtml(mockStudents, '', fontCss, 'duplex');

  const printWin = new BrowserWindow({
    show: false,
    width: 794,
    height: 1123,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  const tempHtml = path.join(app.getPath('temp'), `test_master_template_${Date.now()}.html`);
  fs.writeFileSync(tempHtml, '\uFEFF' + html, 'utf8');
  await printWin.loadFile(tempHtml);

  await new Promise(r => setTimeout(r, 2000));

  const pdfData = await printWin.webContents.printToPDF({
    margins: { marginType: 'none' },
    pageSize: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: false
  });

  const outPdf = path.resolve(__dirname, '../server/scratch/master_vector_test.pdf');
  fs.writeFileSync(outPdf, pdfData);
  console.log('✅ MASTER VECTOR PDF CREATED:', outPdf, `(${pdfData.length} bytes)`);

  printWin.close();
  if (fs.existsSync(tempHtml)) fs.unlinkSync(tempHtml);
  app.quit();
});
