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
let floatingDragOrigin;

function setFloatingVisible(visible) {
  if (!floatingWindow || floatingWindow.isDestroyed()) return;
  if (visible) floatingWindow.showInactive();
  else floatingWindow.hide();
}

function expandWebPlayer() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.executeJavaScript(`(() => {
    const panel = document.querySelector('#player-panel');
    if (panel?.hidden) document.querySelector('#player-toggle')?.click();
  })()`).catch(() => {});
}

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
  setFloatingVisible(false);
  if (!mainWindow || mainWindow.isDestroyed()) {
    if (!quitting) createMainWindow();
    return;
  }
  app.focus({ steal: true });
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  if (mainWindow.webContents.isLoading()) mainWindow.webContents.once('did-finish-load', expandWebPlayer);
  else expandWebPlayer();
}

function sendPlaybackState() {
  if (!mainWindow || mainWindow.isDestroyed() || !floatingWindow || floatingWindow.isDestroyed()) return;
  mainWindow.webContents.executeJavaScript(`(() => {
    const audio = document.querySelector('#player-audio');
    const title = document.querySelector('#player-title');
    const host = document.querySelector('#site-player');
    const panel = document.querySelector('#player-panel');
    return { title: title?.textContent?.trim() || '', playing: !!audio && !audio.paused,
      currentTime: audio?.currentTime || 0, duration: audio?.duration || 0,
      hasTrack: !!host?.classList.contains('has-track'), progressVisible: !!panel && !panel.hidden };
  })()`, true).then(state => {
    if (!mainWindow || mainWindow.isDestroyed() || !floatingWindow || floatingWindow.isDestroyed()) return;
    setFloatingVisible(!mainWindow.isVisible() || !state.progressVisible);
    floatingWindow.webContents.send('playback-state', state);
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
  // Show the ball immediately so the app is visibly alive while the site loads
  // (Render free tier cold start can take 20s+). sendPlaybackState keeps it in
  // sync afterwards and hides it once the main window is up with a player panel.
  floatingWindow.once('ready-to-show', () => floatingWindow.showInactive());
  floatingWindow.on('move', () => {
    if (!floatingWindow.isDestroyed()) {
      try { fs.writeFileSync(BOUNDS_PATH, JSON.stringify(floatingWindow.getBounds())); } catch {}
    }
  });
  floatingWindow.on('closed', () => { floatingWindow = null; });
}

function isFloatingEvent(event) {
  return floatingWindow && !floatingWindow.isDestroyed() && event.sender === floatingWindow.webContents;
}

function registerFloatingDrag() {
  ipcMain.on('floating:drag-start', (event, point) => {
    if (!isFloatingEvent(event) || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return;
    const [x, y] = floatingWindow.getPosition();
    floatingDragOrigin = { x, y, pointerX: point.x, pointerY: point.y };
  });
  ipcMain.on('floating:drag-move', (event, point) => {
    if (!isFloatingEvent(event) || !floatingDragOrigin || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return;
    floatingWindow.setPosition(
      Math.round(floatingDragOrigin.x + point.x - floatingDragOrigin.pointerX),
      Math.round(floatingDragOrigin.y + point.y - floatingDragOrigin.pointerY),
    );
  });
  ipcMain.on('floating:drag-end', event => {
    if (isFloatingEvent(event)) floatingDragOrigin = null;
  });
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
  // Fallback: never leave the user staring at a blank screen. If the site is
  // slow or ready-to-show is delayed, reveal the main window after 20s.
  const showFallback = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible() && !quitting) {
      mainWindow.showInactive();
    }
  }, 20000);
  // The desktop app supplies its own always-on-top vinyl widget. Hide only
  // the website's in-page floating toggle so users never see two record icons.
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.insertCSS('.vinyl-toggle { display: none !important; }').catch(() => {});
  });
  mainWindow.once('ready-to-show', () => {
    clearTimeout(showFallback);
    app.focus({ steal: true });
    mainWindow.show();
    mainWindow.focus();
    expandWebPlayer();
    setFloatingVisible(false);
  });
  mainWindow.on('minimize', event => {
    event.preventDefault();
    mainWindow.hide();
    setFloatingVisible(true);
  });
  mainWindow.on('close', event => {
    if (quitting) return;
    event.preventDefault();
    mainWindow.hide();
    setFloatingVisible(true);
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
    if (!quitting) setFloatingVisible(true);
  });
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

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showMain);
  app.whenReady().then(() => {
    ipcMain.on('floating:open', showMain);
    ipcMain.on('floating:quit', quitApp);
    registerFloatingDrag();
    createFloatingWindow();
    createMainWindow();
    createTray();
    pollTimer = setInterval(sendPlaybackState, 800);
    app.on('activate', showMain);
  });
}

app.on('before-quit', () => { quitting = true; });
