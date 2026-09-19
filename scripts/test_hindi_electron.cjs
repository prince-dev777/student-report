const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 800,
    height: 600,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  const html = `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <style>
    body { font-family: 'Nirmala UI', 'Noto Sans Devanagari', sans-serif; font-size: 24px; }
  </style>
</head>
<body>
  <div>CAREER XONE • सब संभव है</div>
</body>
</html>`;

  const tempFile = path.join(app.getPath('temp'), `test_hindi_${Date.now()}.html`);
  // Write WITH UTF-8 BOM
  fs.writeFileSync(tempFile, '\uFEFF' + html, 'utf8');
  await win.loadFile(tempFile);
  await new Promise(r => setTimeout(r, 400));

  const pdfData = await win.webContents.printToPDF({ pageSize: 'A4' });
  const outPdf = path.resolve(__dirname, '../server/scratch/test_hindi_render.pdf');
  fs.writeFileSync(outPdf, pdfData);
  fs.unlinkSync(tempFile);

  // Capture page to image to visually inspect
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.resolve(__dirname, '../server/scratch/test_hindi_render.png'), img.toPNG());

  console.log('Saved test_hindi_render.pdf and test_hindi_render.png!');
  app.quit();
});
