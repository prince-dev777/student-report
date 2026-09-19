const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 1600,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  const previewPath = path.resolve(__dirname, '../id_card_preview.html');
  await win.loadFile(previewPath);
  await new Promise(r => setTimeout(r, 600));

  // Build the full HTML exactly as Attendance.jsx does
  const fullHTML = await win.webContents.executeJavaScript(`
    (() => {
      const cardWrap = document.querySelector('.card-wrapper') || document.querySelector('.container') || document.body;
      let stylesHTML = '';
      Array.from(document.styleSheets).forEach(sheet => {
        try {
          if (sheet.cssRules) {
            Array.from(sheet.cssRules).forEach(rule => {
              stylesHTML += rule.cssText + '\\n';
            });
          }
        } catch (e) {}
      });

      return \`
        <!DOCTYPE html>
        <html lang="hi">
        <head>
          <meta charset="UTF-8">
          <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Sans+Devanagari:wght@400;600;700;800;900&display=swap" rel="stylesheet">
          <style>
            @page { size: A4 portrait; margin: 0; }
            *, *::before, *::after { box-sizing: border-box !important; margin: 0; padding: 0; }
            html, body {
              width: 210mm !important;
              height: auto !important;
              background: #ffffff !important;
              color: #0f172a !important;
              font-family: 'Inter', 'Noto Sans Devanagari', 'Nirmala UI', sans-serif !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .a4-print-sheet {
              width: 210mm !important;
              max-width: 210mm !important;
              min-height: 297mm !important;
              margin: 0 auto !important;
              padding: 8mm 6mm !important;
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              justify-content: flex-start !important;
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              box-sizing: border-box !important;
              background: #ffffff !important;
            }
            .a4-print-grid {
              display: grid !important;
              grid-template-columns: repeat(2, 260px) !important;
              gap: 16px 36px !important;
              justify-content: center !important;
              align-content: start !important;
              width: 100% !important;
            }
            .print-id-card-pair {
              display: flex !important;
              flex-direction: row !important;
              gap: 24px !important;
              margin-bottom: 24px !important;
              justify-content: center !important;
              align-items: center !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .print-id-card {
              box-shadow: none !important;
              border: 2px solid #2563eb !important;
              border-radius: 14px !important;
              overflow: hidden !important;
              background: #ffffff !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              flex-shrink: 0 !important;
            }
            .id-card-footer-ribbon {
              font-family: 'Noto Sans Devanagari', 'Nirmala UI', 'Inter', sans-serif !important;
            }
            \${stylesHTML}
          </style>
        </head>
        <body class="printing-id-cards">
          \${cardWrap.outerHTML}
        </body>
        </html>
      \`;
    })()
  `);

  const printWin = new BrowserWindow({
    show: false,
    width: 1200,
    height: 1600,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  const tempHtml = path.join(app.getPath('temp'), `test_full_id_card_${Date.now()}.html`);
  fs.writeFileSync(tempHtml, '\uFEFF' + fullHTML, 'utf8');
  await printWin.loadFile(tempHtml);
  await new Promise(r => setTimeout(r, 1500));

  const pdfData = await printWin.webContents.printToPDF({
    margins: { marginType: 'none' },
    pageSize: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    generateTaggedPDF: false,
    displayHeaderFooter: false
  });

  try { printWin.close(); } catch(e) {}
  if (fs.existsSync(tempHtml)) fs.unlinkSync(tempHtml);

  const out = path.resolve(__dirname, '../server/scratch/final_verified_cards.pdf');
  fs.writeFileSync(out, pdfData);
  console.log('✅ Final Verified PDF successfully created:', out, `(${pdfData.length} bytes)`);

  app.quit();
});
