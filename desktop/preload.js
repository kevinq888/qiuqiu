const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('qiuqiuUpdater', {
  state: () => ipcRenderer.invoke('desktop:update-state'),
  check: () => ipcRenderer.invoke('desktop:update-check'),
  install: () => ipcRenderer.invoke('desktop:update-install'),
  onState: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('desktop:update-state', listener);
    return () => ipcRenderer.removeListener('desktop:update-state', listener);
  },
});
