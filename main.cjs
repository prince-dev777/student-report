const { app, BrowserWindow, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let serverProcess;

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
}

function startServer() {
  const isDev = !app.isPackaged;
  
  // Path to local OMR server
  const serverPath = path.join(__dirname, 'server', 'local-omr-server.js');
  
  const fs = require('fs');
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
  setTimeout(createWindow, 3000);

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
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
