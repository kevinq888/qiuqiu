const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const SITE_URL = process.env.QIUQIU_URL || 'https://qiuqiumusic.onrender.com/';
const ICON_PATH = path.join(__dirname, 'tray-icon.png');
const APP_ICON_PATH = path.join(__dirname, 'app-icon.png');
const BOUNDS_PATH = path.join(app.getPath('userData'), 'floating-window.json');
const FLOATING_SIZE = 92;
const FLOATING_WIDTH = 360;
const FLOATING_HEIGHT = 180;
let mainWindow;
let floatingWindow;
let tray;
let quitting = false;
let pollTimer;
let floatingDragOrigin;
let floatingIgnoresMouse = true;

function setFloatingVisible(visible) {
  if (!floatingWindow || floatingWindow.isDestroyed()) return;
  if (visible && !floatingWindow.isVisible()) floatingWindow.showInactive();
  else if (!visible && floatingWindow.isVisible()) floatingWindow.hide();
}

function setFloatingMouseEvents(ignore) {
  if (!floatingWindow || floatingWindow.isDestroyed() || typeof ignore !== 'boolean' || ignore === floatingIgnoresMouse) return;
  floatingIgnoresMouse = ignore;
  floatingWindow.setIgnoreMouseEvents(ignore, { forward: true });
}

function controlPlayback(command) {
  const selectors = { prev: '#player-prev', toggle: '#player-play-pause', next: '#player-next' };
  if (!Object.hasOwn(selectors, command) || !mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.executeJavaScript(`document.querySelector(${JSON.stringify(selectors[command])})?.click()`, true)
    .then(sendPlaybackState).catch(() => {});
}

function expandWebPlayer() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.executeJavaScript(`(() => {
    const panel = document.querySelector('#player-panel');
    if (panel?.hidden) document.querySelector('#player-toggle')?.click();
  })()`).catch(() => {});
}

function readBounds() {
  const fallback = () => {
    const { workArea } = screen.getPrimaryDisplay();
    return {
      x: workArea.x + workArea.width - FLOATING_WIDTH - 24,
      y: workArea.y + 80,
      width: FLOATING_WIDTH,
      height: FLOATING_HEIGHT,
    };
  };
  try {
    const raw = JSON.parse(fs.readFileSync(BOUNDS_PATH, 'utf8'));
    const src = raw.version === 2 ? raw : { ...raw, x: raw.x + (raw.width || FLOATING_SIZE) / 2 - FLOATING_WIDTH / 2 };
    // getDisplayMatching rejects objects with missing/NaN fields; guard before use
    if (!Number.isFinite(src.x) || !Number.isFinite(src.y)) return fallback();
    const area = screen.getDisplayMatching({
      x: src.x,
      y: src.y,
      width: Number.isFinite(raw.width) ? raw.width : FLOATING_WIDTH,
      height: Number.isFinite(raw.height) ? raw.height : FLOATING_HEIGHT,
    }).workArea;
    const edge = 16;
    return {
      x: Math.max(area.x + edge, Math.min(src.x, area.x + area.width - FLOATING_WIDTH - edge)),
      y: Math.max(area.y + edge, Math.min(src.y, area.y + area.height - FLOATING_HEIGHT - edge)),
      width: FLOATING_WIDTH,
      height: FLOATING_HEIGHT,
    };
  } catch {
    return fallback();
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
    ...(process.platform === 'darwin' ? { type: 'panel' } : {}),
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    minimizable: false,
    maximizable: false,
    closable: false,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    ...(process.platform === 'darwin' ? { roundedCorners: false } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'floating-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  floatingWindow.setAlwaysOnTop(true, 'floating');
  floatingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  floatingIgnoresMouse = true;
  floatingWindow.setIgnoreMouseEvents(true, { forward: true });
  floatingWindow.loadFile(path.join(__dirname, 'floating.html'));
  // Show the ball immediately so the app is visibly alive while the site loads
  // (Render free tier cold start can take 20s+). sendPlaybackState keeps it in
  // sync afterwards and hides it once the main window is up with a player panel.
  floatingWindow.once('ready-to-show', () => floatingWindow.showInactive());
  floatingWindow.on('move', () => {
    if (!floatingWindow.isDestroyed()) {
      try { fs.writeFileSync(BOUNDS_PATH, JSON.stringify({ ...floatingWindow.getBounds(), version: 2 })); } catch {}
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
    const x = Math.round(floatingDragOrigin.x + point.x - floatingDragOrigin.pointerX);
    const y = Math.round(floatingDragOrigin.y + point.y - floatingDragOrigin.pointerY);
    floatingWindow.setPosition(x, y);
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
    icon: APP_ICON_PATH,
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
  const isMac = process.platform === 'darwin';
  const size = isMac ? 18 : 16;
  const source = nativeImage.createFromPath(isMac ? ICON_PATH : APP_ICON_PATH);
  let icon = source.resize({ width: size, height: size, quality: 'best' });
  if (!source.isEmpty()) icon.addRepresentation({ scaleFactor: 2, buffer: source.resize({ width: size * 2, height: size * 2, quality: 'best' }).toPNG() });
  if (isMac) icon.setTemplateImage(true);
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
    if (process.platform === 'darwin') app.dock.setIcon(APP_ICON_PATH);
    ipcMain.on('floating:open', showMain);
    ipcMain.on('floating:quit', quitApp);
    ipcMain.on('floating:ignore-mouse', (event, ignore) => {
      if (isFloatingEvent(event)) setFloatingMouseEvents(ignore);
    });
    ipcMain.on('floating:control', (event, command) => {
      if (isFloatingEvent(event)) controlPlayback(command);
    });
    registerFloatingDrag();
    // Main window must be created before the floating panel: on macOS,
    // launching with a non-activating NSPanel as the first window leaves the
    // activation policy at "accessory" and the Dock icon never appears.
    createMainWindow();
    createFloatingWindow();
    createTray();
    if (process.platform === 'darwin') app.dock.show();
    pollTimer = setInterval(sendPlaybackState, 800);
    app.on('activate', showMain);
  });
}

app.on('before-quit', () => { quitting = true; });
