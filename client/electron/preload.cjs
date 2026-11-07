const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
  setBackgroundMode: (enabled) => ipcRenderer.send('set-background-mode', !!enabled),
  showNotification: (payload) => ipcRenderer.send('show-notification', payload),
  onNotificationClick: (callback) => {
    const handler = (_event, chatId) => callback(chatId);
    ipcRenderer.on('notification-clicked', handler);
    return () => ipcRenderer.removeListener('notification-clicked', handler);
  },
  downloadAndInstallUpdate: (exeUrl) => ipcRenderer.invoke('download-and-install-update', exeUrl),
  onUpdateProgress: (callback) => {
    const handler = (_event, pct) => callback(pct);
    ipcRenderer.on('update-download-progress', handler);
    return () => ipcRenderer.removeListener('update-download-progress', handler);
  },
  isElectron: true,
});
