const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 1000,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const previewPath = path.resolve(__dirname, '../id_card_preview.html');
  await win.loadFile(previewPath);

  // Wait 1 second for fonts and QR codes to fully render
  await new Promise((r) => setTimeout(r, 1000));

  try {
    const pdfData = await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: {
        marginType: 'none'
      }
    });

    const outPath = path.resolve(__dirname, '../server/scratch/test_electron_print.pdf');
    fs.writeFileSync(outPath, pdfData);
    console.log('Successfully generated test_electron_print.pdf! Size:', pdfData.length);
  } catch (err) {
    console.error('printToPDF failed:', err);
  }

  app.quit();
});
