const { contextBridge, ipcRenderer } = require('electron');

// Ponte segura entre a janela e o programa (só o que é preciso para as atualizações).
contextBridge.exposeInMainWorld('readflowApp', {
  getVersion: () => ipcRenderer.invoke('app:version'),
  checkUpdates: () => ipcRenderer.invoke('app:check-updates'),
  onUpdateStatus: (callback) => { ipcRenderer.on('updater:status', (_event, payload) => callback(payload)); }
});
