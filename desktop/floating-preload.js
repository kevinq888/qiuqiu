const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('qiuqiuDesktop', {
  openMain: () => ipcRenderer.send('floating:open'),
  quit: () => ipcRenderer.send('floating:quit'),
  startDrag: point => ipcRenderer.send('floating:drag-start', point),
  moveDrag: point => ipcRenderer.send('floating:drag-move', point),
  endDrag: () => ipcRenderer.send('floating:drag-end'),
  onPlaybackState: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('playback-state', listener);
    return () => ipcRenderer.removeListener('playback-state', listener);
  },
});
