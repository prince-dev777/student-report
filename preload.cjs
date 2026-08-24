const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: (options) => ipcRenderer.invoke('dialog:showOpenDialog', options),
  openPath: (folderPath) => ipcRenderer.invoke('shell:openPath', folderPath),
  showItemInFolder: (filePath) => ipcRenderer.invoke('shell:showItemInFolder', filePath),
  printToPDF: (htmlContent, defaultName) => ipcRenderer.invoke('print:toPDF', htmlContent, defaultName),
  getPathForFile: (file) => {
    try {
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        return webUtils.getPathForFile(file);
      }
    } catch (e) {}
    return file ? (file.path || '') : '';
  }
});
