const { app, BrowserWindow, dialog, Tray, Menu } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let serverProcess;

// Disable disk caching to prevent "Access is denied" and "Gpu Cache Creation failed" errors
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-gpu-disk-cache');
app.commandLine.appendSwitch('disable-disk-cache');

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
      // Optional: Show notification to user that it's in the tray
      // mainWindow.webContents.send('show-notification', 'App running in background');
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

function startServer() {
  const isDev = !app.isPackaged;
  
  // Path to local OMR server
  const serverPath = path.join(__dirname, 'server', 'local-omr-server.js');
  
  const logFile = 'C:\\Users\\sawar\\MyProjects\\student-report\\electron_debug.log';
  fs.appendFileSync(logFile, `Starting server at: ${serverPath}\n`);

  // Use fork which natively supports running scripts inside app.asar
  const { fork } = require('child_process');
  
  const env = { 
    ...process.env, 
    ELECTRON_RUN_AS_NODE: '1',
    USER_DATA_PATH: app.getPath('userData')
  };
  
  serverProcess = fork(serverPath, [], {
    env: env,
    silent: true // Required to access stdout/stderr
  });

  serverProcess.stdout?.on('data', (data) => {
    fs.appendFileSync(logFile, `Server: ${data}\n`);
  });

  serverProcess.stderr.on('data', (data) => {
    fs.appendFileSync(logFile, `Server Error: ${data}\n`);
  });

  serverProcess.on('close', (code) => {
    fs.appendFileSync(logFile, `Server exited with code ${code}\n`);
  });
}

app.whenReady().then(() => {
  startServer();
  // Wait a moment for server to start before creating window
  setTimeout(() => {
    createWindow();
    createTray();
  }, 3000);

  // Auto Updater Logic
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
    
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
      const logFile = 'C:\\Users\\sawar\\MyProjects\\student-report\\electron_debug.log';
      fs.appendFileSync(logFile, `Updater Error: ${err.message}\n`);
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
    serverProcess.kill();
  }
});
