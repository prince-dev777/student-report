const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 1600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const previewPath = path.resolve(__dirname, '../id_card_preview.html');
  await win.loadFile(previewPath);
  await new Promise(r => setTimeout(r, 800));

  // Extract container and styles just like Attendance.jsx does
  const fullHTML = await win.webContents.executeJavaScript(`
    (() => {
      const printContainer = document.querySelector('.card-wrapper') || document.querySelector('.container') || document.body;
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
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
            \${stylesHTML}
            body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
            .a4-print-sheet { 
              page-break-after: always !important; 
              break-after: page !important;
              width: 210mm !important; 
              min-height: 297mm !important; 
              padding: 6mm 0 !important;
              box-sizing: border-box !important;
            }
          </style>
        </head>
        <body class="printing-id-cards">
          \${printContainer.outerHTML}
        </body>
        </html>
      \`;
    })()
  `);

  // Print using the exact same logic as main.cjs
  const printWin = new BrowserWindow({
    show: false,
    width: 1200,
    height: 1600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const tempHtml = path.join(app.getPath('temp'), `verify_test_cards_${Date.now()}.html`);
  fs.writeFileSync(tempHtml, fullHTML, 'utf8');
  await printWin.loadFile(tempHtml);
  await new Promise(r => setTimeout(r, 800));

  const pdfData = await printWin.webContents.printToPDF({
    margins: { marginType: 'none' },
    pageSize: 'A4',
    printBackground: true,
    preferCSSPageSize: true
  });

  try { printWin.close(); } catch(e) {}
  if (fs.existsSync(tempHtml)) fs.unlinkSync(tempHtml);

  const outPdf = path.resolve(__dirname, '../server/scratch/verify_native_id_card.pdf');
  fs.writeFileSync(outPdf, pdfData);

  console.log('✅ TEST PASSED: Generated PDF successfully at:', outPdf);
  console.log('File size:', pdfData.length, 'bytes');

  // Verify vector content
  const pdfStr = pdfData.toString('latin1');
  const hasTextFonts = pdfStr.includes('/Font') || pdfStr.includes('/Type /Font');
  console.log('Vector fonts present:', hasTextFonts);

  app.quit();
});
