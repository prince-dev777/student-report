const { app, BrowserWindow, dialog, Tray, Menu, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');

let mainWindow;
let serverProcess;
let mongoProcess;

// Disable disk caching to prevent "Access is denied" and "Gpu Cache Creation failed" errors
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-gpu-disk-cache');
app.commandLine.appendSwitch('disable-disk-cache');

// Helper: kill any process using port 5000 (cleanup leftover from previous run)
function killPort(port) {
  return new Promise((resolve) => {
    exec(`netstat -ano | findstr :${port} | findstr LISTENING`, (err, stdout) => {
      if (err || !stdout.trim()) return resolve();
      const lines = stdout.trim().split('\n');
      const pids = new Set();
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') pids.add(pid);
      }
      if (pids.size === 0) return resolve();
      let done = 0;
      for (const pid of pids) {
        exec(`taskkill /PID ${pid} /F`, () => {
          done++;
          if (done === pids.size) {
            // Give OS time to release the port
            setTimeout(resolve, 1000);
          }
        });
      }
    });
  });
}

function killMongo() {
  return new Promise((resolve) => {
    exec(`taskkill /F /IM mongod.exe`, (err) => {
      resolve();
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.cjs')
    },
    autoHideMenuBar: true,
    title: "Career Xone Pro",
    icon: path.join(__dirname, app.isPackaged ? 'dist' : 'public', 'logo.jpg'),
  });

  // Send app version to renderer
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(
      `window.__APP_VERSION__ = '${app.getVersion()}'`
    );
  });

  // Check if we are in development mode
  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // Load from local Express server to avoid file:// cross-origin issues
    mainWindow.loadURL('http://localhost:5000');
  }
  // Prevent window from closing, hide it instead
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

let tray = null;

function createTray() {
  const iconPath = path.join(__dirname, app.isPackaged ? 'dist' : 'public', 'logo.jpg');
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Open Career Xone Pro', 
      click: () => {
        mainWindow.show();
      } 
    },
    { type: 'separator' },
    {
      label: 'Check for Updates',
      click: () => {
        if (app.isPackaged) {
          autoUpdater.checkForUpdates().then((result) => {
            if (!result || !result.updateInfo || result.updateInfo.version === app.getVersion()) {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'No Updates',
                message: 'You are already on the latest version!',
                detail: `Current Version: v${app.getVersion()}`,
                buttons: ['OK']
              }).catch(() => {});
            }
          }).catch((err) => {
            dialog.showMessageBox(mainWindow, {
              type: 'error',
              title: 'Update Check Failed',
              message: 'Could not check for updates.',
              detail: `Error: ${err.message}`,
              buttons: ['OK']
            }).catch(() => {});
          });
        } else {
          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Development Mode',
            message: 'Auto-update is disabled in development mode.',
            buttons: ['OK']
          }).catch(() => {});
        }
      }
    },
    { type: 'separator' },
    {
      label: `Version: v${app.getVersion()}`,
      enabled: false
    },
    { type: 'separator' },
    { 
      label: 'Quit', 
      click: () => {
        app.isQuiting = true;
        app.quit();
      } 
    }
  ]);
  
  tray.setToolTip('Career Xone Pro - Background Server Running');
  tray.setContextMenu(contextMenu);
  
  tray.on('double-click', () => {
    mainWindow.show();
  });
}

async function startServer() {
  // Kill any leftover process on port 5000 from a previous session
  await killPort(5000);

  // Path to local main server
  const localOmrPath = path.join(__dirname, 'server', 'server.js');
  
  const logFile = path.join(app.getPath('userData'), 'electron_debug.log');
  try {
    fs.appendFileSync(logFile, `Starting servers...\n`);
  } catch (e) {
    console.error('Failed to write log', e);
  }

  const { fork } = require('child_process');
  
  // Start local MongoDB first
  const dbPath = path.join(app.getPath('userData'), 'mongodb_data');
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
  }

  const mongodExePath = app.isPackaged 
    ? path.join(process.resourcesPath, 'bin', 'mongod.exe')
    : path.join(__dirname, 'server', 'bin', 'mongod.exe');

  if (fs.existsSync(mongodExePath)) {
    fs.appendFileSync(logFile, `Starting MongoDB from: ${mongodExePath}\n`);
    const mongoPort = 27018; // Use custom port to avoid conflict with existing installations
    mongoProcess = spawn(mongodExePath, [
      '--dbpath', dbPath,
      '--port', mongoPort.toString(),
      '--bind_ip', '127.0.0.1'
    ], { detached: true });

    mongoProcess.unref(); // Allow node to exit independently if needed

    // Pass this local URI to the express server
    process.env.MONGODB_URI = `mongodb://127.0.0.1:${mongoPort}/student-report`;
    fs.appendFileSync(logFile, `Set local MONGODB_URI: ${process.env.MONGODB_URI}\n`);
  } else {
    fs.appendFileSync(logFile, `MongoDB binary NOT FOUND at: ${mongodExePath}\n`);
  }
  
  const env = { 
    ...process.env, 
    ELECTRON_RUN_AS_NODE: '1',
    USER_DATA_PATH: app.getPath('userData'),
    ELECTRON_EXEC_PATH: process.execPath // Pass the Electron binary path for Puppeteer
  };

  // Give Mongo a tiny bit of time to bind the port
  await new Promise(r => setTimeout(r, 2000));

  // 2. Start Local Server (Port 5000)
  serverProcess = fork(localOmrPath, [], { env: env, silent: true });
  serverProcess.stdout?.on('data', (data) => {
    try { fs.appendFileSync(logFile, `Local Server: ${data}\n`); } catch(e) {}
  });
  serverProcess.stderr?.on('data', (data) => {
    try { fs.appendFileSync(logFile, `Local Server Error: ${data}\n`); } catch(e) {}
  });

  // Send app info on start
  setTimeout(() => {
    if (serverProcess) {
      try { serverProcess.send({ type: 'APP_INFO', version: app.getVersion() }); } catch(e) {}
    }
  }, 2000);

  // Prevent uncaught IPC errors when server process exits
  serverProcess.on('error', () => {});

  serverProcess.on('message', (msg) => {
    if (msg && msg.type === 'QUIT_AND_INSTALL') {
      app.isQuiting = true;
      autoUpdater.quitAndInstall();
    } else if (msg && msg.type === 'START_DOWNLOAD') {
      autoUpdater.downloadUpdate();
    }
  });
}

app.whenReady().then(async () => {
  ipcMain.handle('dialog:showOpenDialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    return result;
  });

  await startServer();
  // Wait a moment for server to start before creating window
  setTimeout(() => {
    createWindow();
    createTray();
  }, 3000);

  // Auto Updater Logic
  if (app.isPackaged) {
    const log = require('electron-log');
    autoUpdater.logger = log;
    autoUpdater.logger.transports.file.level = 'info';

    autoUpdater.autoDownload = false;

    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'prince-dev777',
      repo: 'student-report'
    });

    autoUpdater.on('checking-for-update', () => {
      log.info('[AutoUpdater] Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      log.info('[AutoUpdater] Update available:', info.version);
      if (serverProcess) {
        try { serverProcess.send({ 
          type: 'UPDATE_AVAILABLE', 
          version: info.version, 
          releaseDate: info.releaseDate 
        }); } catch(e) {}
      }
    });

    autoUpdater.on('update-not-available', (info) => {
      log.info('[AutoUpdater] Already on latest version:', info.version);
    });

    autoUpdater.on('download-progress', (progress) => {
      log.info(`[AutoUpdater] Download: ${Math.round(progress.percent)}%`);
      if (serverProcess) {
        try { serverProcess.send({ type: 'UPDATE_PROGRESS', percent: progress.percent }); } catch(e) {}
      }
    });

    autoUpdater.on('update-downloaded', (info) => {
      const ver = info ? (info.version || 'new version') : 'new version';
      log.info(`[AutoUpdater] Update v${ver} downloaded! Showing install dialog.`);

      // Notify local server
      if (serverProcess) {
        try { serverProcess.send({ type: 'UPDATE_DOWNLOADED', version: ver }); } catch(e) {}
      }

      // UI will now handle the restart button

    });

    autoUpdater.on('error', (err) => {
      log.error('[AutoUpdater] Error:', err.message);
      // Also write to our debug log
      const logFile = path.join(app.getPath('userData'), 'electron_debug.log');
      try { fs.appendFileSync(logFile, `[${new Date().toISOString()}] Updater Error: ${err.message}\n`); } catch(e) {}
    });

    // Check for updates after a short delay, then every 30 minutes
    const checkForUpdates = () => {
      autoUpdater.checkForUpdates().catch((err) => {
        log.error('[AutoUpdater] Check failed:', err.message);
      });
    };

    setTimeout(checkForUpdates, 5000);
    setInterval(checkForUpdates, 15 * 60 * 1000); // Check every 15 minutes
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', function () {
  // Overridden: Do nothing here so the app stays running in background
});

app.on('before-quit', () => {
  if (serverProcess) {
    // Send clean shutdown signal first, then force kill after timeout
    try {
      if (serverProcess.connected) {
        serverProcess.send('shutdown');
      }
    } catch (e) {
      // IPC channel might be closed already
    }
    setTimeout(() => {
      try {
        serverProcess.kill();
      } catch (e) {}
    }, 1000);
  }

  if (mongoProcess) {
    try {
      mongoProcess.kill();
    } catch (e) {}
  }
  
  // Failsafe
  killMongo();
});
