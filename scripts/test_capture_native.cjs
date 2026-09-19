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

  await new Promise((r) => setTimeout(r, 800));

  // Find the exact bounding rect of the first card and capture it
  const rect = await win.webContents.executeJavaScript(`
    (() => {
      const card = document.querySelector('.id-card-wrapper');
      const r = card.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    })()
  `);

  console.log('Card rect:', rect);
  const image = await win.webContents.capturePage(rect);
  const pngBuffer = image.toPNG();
  fs.writeFileSync(path.resolve(__dirname, '../server/scratch/native_chromium_card.png'), pngBuffer);
  console.log('Saved native_chromium_card.png successfully!');

  app.quit();
});
