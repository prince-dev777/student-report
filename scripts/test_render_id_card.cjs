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

  // Inject html2canvas CDN if not already in preview
  await win.webContents.executeJavaScript(`
    new Promise((resolve) => {
      if (window.html2canvas) return resolve();
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      s.onload = resolve;
      document.head.appendChild(s);
    });
  `);

  const codeToRun = `
    (async () => {
      const card = document.querySelector('.id-card-wrapper');
      if (!card) return { error: 'No .id-card-wrapper found' };

      const canvas1 = await html2canvas(card, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          // Helper to shift text upwards
          const shiftTextUp = (el, amountPx) => {
            if (!el) return;
            const spans = el.querySelectorAll('span, strong');
            if (spans.length > 0) {
              spans.forEach(s => {
                s.style.display = 'inline-block';
                s.style.transform = 'translateY(' + amountPx + 'px)';
              });
            } else {
              const text = el.textContent;
              el.innerHTML = '<span style="display:inline-block;transform:translateY(' + amountPx + 'px);">' + text + '</span>';
            }
          };

          // 1. Roll tag inner text
          const roll = clonedDoc.querySelector('.roll-tag-pro');
          shiftTextUp(roll, -2.5);

          // 2. Batch badge inner text
          const batch = clonedDoc.querySelector('.course-badge-pro');
          shiftTextUp(batch, -2.5);

          // 3. Info table: shift each label and value inside every row
          const tableRows = clonedDoc.querySelectorAll('.info-table-pro > div');
          tableRows.forEach(row => {
            const items = row.querySelectorAll('strong, span');
            items.forEach(item => {
              item.style.display = 'inline-block';
              item.style.transform = 'translateY(-2.5px)';
            });
          });

          // 4. Footer ribbon inner text
          const ribbon = clonedDoc.querySelector('.bottom-ribbon-pro span') || clonedDoc.querySelector('.bottom-ribbon-pro');
          shiftTextUp(ribbon, -2.5);
        }
      });
      return { data1: canvas1.toDataURL('image/png').replace(/^data:image\\/png;base64,/, '') };
    })()
  `;

  const result = await win.webContents.executeJavaScript(codeToRun);

  if (result.error) {
    console.error('Error:', result.error);
  } else {
    fs.writeFileSync(path.resolve(__dirname, '../server/scratch/test_card_shifted.png'), Buffer.from(result.data1, 'base64'));
    console.log('Saved test_card_shifted.png successfully!');
  }

  app.quit();
});
