const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 1200,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const previewPath = path.resolve(__dirname, '../id_card_preview.html');
  await win.loadFile(previewPath);
  await new Promise((r) => setTimeout(r, 600));

  // Call printToPDF directly on this window
  const pdfData = await win.webContents.printToPDF({
    pageSize: 'A4',
    printBackground: true,
    margins: {
      marginType: 'none'
    }
  });

  const out = path.resolve(__dirname, '../server/scratch/direct_window_print.pdf');
  fs.writeFileSync(out, pdfData);
  console.log('Saved direct_window_print.pdf! Size:', pdfData.length);

  app.quit();
});
