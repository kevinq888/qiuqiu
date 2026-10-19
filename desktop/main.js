const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const SITE_URL = process.env.QIUQIU_URL || 'https://qiuqiumusic.onrender.com/';
const ICON_PATH = path.join(__dirname, 'icon.png');
const BOUNDS_PATH = path.join(app.getPath('userData'), 'floating-window.json');
let mainWindow;
let floatingWindow;
let tray;
let quitting = false;
let pollTimer;

function readBounds() {
  try {
    const bounds = JSON.parse(fs.readFileSync(BOUNDS_PATH, 'utf8'));
    const display = screen.getDisplayMatching(bounds);
    const area = display.workArea;
    return {
      x: Math.max(area.x, Math.min(bounds.x, area.x + area.width - 92)),
      y: Math.max(area.y, Math.min(bounds.y, area.y + area.height - 92)),
      width: 92,
      height: 92,
    };
  } catch {
    const { workArea } = screen.getPrimaryDisplay();
    return { x: workArea.x + workArea.width - 112, y: workArea.y + 100, width: 92, height: 92 };
  }
}

function showMain() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function sendPlaybackState() {
  if (!mainWindow || mainWindow.isDestroyed() || !floatingWindow || floatingWindow.isDestroyed()) return;
  mainWindow.webContents.executeJavaScript(`(() => {
    const audio = document.querySelector('#player-audio');
    const title = document.querySelector('#player-title');
    const host = document.querySelector('#site-player');
    return { title: title?.textContent?.trim() || '', playing: !!audio && !audio.paused,
      currentTime: audio?.currentTime || 0, duration: audio?.duration || 0,
      hasTrack: !!host?.classList.contains('has-track') };
  })()`, true).then(state => {
    if (!floatingWindow.isDestroyed()) floatingWindow.webContents.send('playback-state', state);
  }).catch(() => {});
}

function createFloatingWindow() {
  floatingWindow = new BrowserWindow({
    ...readBounds(),
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'floating-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  floatingWindow.setAlwaysOnTop(true, 'floating');
  floatingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  floatingWindow.loadFile(path.join(__dirname, 'floating.html'));
  floatingWindow.once('ready-to-show', () => floatingWindow.showInactive());
  floatingWindow.on('move', () => {
    if (!floatingWindow.isDestroyed()) {
      try { fs.writeFileSync(BOUNDS_PATH, JSON.stringify(floatingWindow.getBounds())); } catch {}
    }
  });
  floatingWindow.on('closed', () => { floatingWindow = null; });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 375,
    minHeight: 620,
    title: '秋秋音乐',
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f1a17',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.loadURL(SITE_URL);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('minimize', event => {
    event.preventDefault();
    mainWindow.hide();
    floatingWindow?.showInactive();
  });
  mainWindow.on('close', event => {
    if (quitting) return;
    event.preventDefault();
    mainWindow.hide();
    floatingWindow?.showInactive();
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (new URL(url).origin !== new URL(SITE_URL).origin) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== new URL(SITE_URL).origin) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

function createTray() {
  let icon = nativeImage.createFromPath(ICON_PATH);
  if (icon.isEmpty()) icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('秋秋音乐仍在运行');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开秋秋音乐', click: showMain },
    { type: 'separator' },
    { label: '退出秋秋音乐', click: () => quitApp() },
  ]));
  tray.on('click', showMain);
}

function quitApp() {
  quitting = true;
  if (pollTimer) clearInterval(pollTimer);
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.executeJavaScript("document.querySelector('#player-audio')?.pause()").catch(() => {});
  app.quit();
}

app.whenReady().then(() => {
  ipcMain.on('floating:open', showMain);
  ipcMain.on('floating:quit', quitApp);
  createFloatingWindow();
  createMainWindow();
  createTray();
  pollTimer = setInterval(sendPlaybackState, 800);
  app.on('activate', showMain);
});

app.on('before-quit', () => { quitting = true; });
