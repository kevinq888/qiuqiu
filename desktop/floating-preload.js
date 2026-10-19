const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('qiuqiuDesktop', {
  openMain: () => ipcRenderer.send('floating:open'),
  quit: () => ipcRenderer.send('floating:quit'),
  onPlaybackState: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('playback-state', listener);
    return () => ipcRenderer.removeListener('playback-state', listener);
  },
});
