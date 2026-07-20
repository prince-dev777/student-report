const { app, BrowserWindow, dialog, Tray, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');

let mainWindow;
let serverProcess;

// Disable disk caching to prevent "Access is denied" and "Gpu Cache Creation failed" errors
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-gpu-disk-cache');
app.commandLine.appendSwitch('disable-disk-cache');

// Helper: kill any process using port 5001 (cleanup leftover from previous run)
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    },
    autoHideMenuBar: true,
    title: "Career Xone Pro",
    icon: path.join(__dirname, app.isPackaged ? 'dist' : 'public', 'logo.jpg'),
  });

  // Check if we are in development mode
  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // Load from local Express server to avoid file:// cross-origin issues
    mainWindow.loadURL('http://localhost:5001');
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
  // Kill any leftover process on port 5001 from a previous session
  await killPort(5001);

  // Path to local OMR server
  const serverPath = path.join(__dirname, 'server', 'local-omr-server.js');
  
  const logFile = path.join(app.getPath('userData'), 'electron_debug.log');
  try {
    fs.appendFileSync(logFile, `Starting server at: ${serverPath}\n`);
  } catch (e) {
    console.error('Failed to write log', e);
  }

  // Use fork which natively supports running scripts inside app.asar
  const { fork } = require('child_process');
  
  const env = { 
    ...process.env, 
    ELECTRON_RUN_AS_NODE: '1',
    USER_DATA_PATH: app.getPath('userData'),
    ELECTRON_EXEC_PATH: process.execPath // Pass the Electron binary path for Puppeteer
  };
  
  serverProcess = fork(serverPath, [], {
    env: env,
    silent: true // Required to access stdout/stderr
  });

  serverProcess.stdout?.on('data', (data) => {
    try { fs.appendFileSync(logFile, `Server: ${data}\n`); } catch(e) {}
  });

  serverProcess.stderr?.on('data', (data) => {
    try { fs.appendFileSync(logFile, `Server Error: ${data}\n`); } catch(e) {}
  });

  serverProcess.on('close', (code) => {
    try { fs.appendFileSync(logFile, `Server exited with code ${code}\n`); } catch(e) {}
  });
}

app.whenReady().then(async () => {
  await startServer();
  // Wait a moment for server to start before creating window
  setTimeout(() => {
    createWindow();
    createTray();
  }, 3000);

  // Auto Updater Logic
  if (app.isPackaged) {
    // Suppress noisy auto-updater errors (e.g., private repo 404)
    autoUpdater.logger = null;

    autoUpdater.checkForUpdatesAndNotify().catch(() => {
      // Silently ignore update check failures (private repo, no internet, etc.)
    });
    
    autoUpdater.on('update-downloaded', (info) => {
      dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: 'A new version of Career Xone Pro has been downloaded. The application will restart to install the update.',
        buttons: ['Restart Now', 'Later']
      }).then((result) => {
        if (result.response === 0) {
          app.isQuiting = true;
          autoUpdater.quitAndInstall();
        }
      });
    });

    autoUpdater.on('error', (err) => {
      // Only log critical errors, not 404s from private repos
      if (err && err.message && !err.message.includes('404')) {
        const logFile = path.join(app.getPath('userData'), 'electron_debug.log');
        try { fs.appendFileSync(logFile, `Updater Error: ${err.message}\n`); } catch(e) {}
      }
    });
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
      serverProcess.send('shutdown');
    } catch (e) {
      // IPC channel might be closed already
    }
    setTimeout(() => {
      try {
        serverProcess.kill();
      } catch (e) {}
    }, 3000);
  }
});
