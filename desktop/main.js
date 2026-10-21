const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen, shell, protocol, net, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

// Stable local origin keeps browser storage intact across launches and upgrades.
const SITE_URL = 'qiuqiu://app/';
protocol.registerSchemesAsPrivileged([{ scheme: 'qiuqiu', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true,
} }]);
let localServer;
let updater;

async function startLocalApp() {
  const crypto = require('node:crypto');
  process.env.QIUQIU_DATA_DIR = path.join(app.getPath('userData'), 'data');
  const backend = app.isPackaged ? path.join(process.resourcesPath, 'backend') : path.resolve(__dirname, '..');
  const token = crypto.randomBytes(32).toString('hex');
  localServer = await require(path.join(backend, 'server.js')).startServer({ port: 0, host: '127.0.0.1', token });
  const base = `http://127.0.0.1:${localServer.address().port}`;
  protocol.handle('qiuqiu', async request => {
    const url = new URL(request.url);
    if (url.hostname === 'app' && url.pathname === '/__storage-migration') return new Response('<!doctype html><title>秋秋音乐</title>', { headers: { 'content-type': 'text/html; charset=utf-8' } });
    if (url.hostname !== 'app') return new Response('Not Found', { status: 404 });
    const headers = new Headers(request.headers);
    headers.set('x-qiuqiu-token', token);
    const options = { method: request.method, headers, redirect: 'manual', bypassCustomProtocolHandlers: true };
    if (request.method !== 'GET' && request.method !== 'HEAD') options.body = await request.arrayBuffer();
    return net.fetch(base + url.pathname + url.search, options);
  });
}

// Read the previous desktop origin without contacting Render: HTTPS is temporarily
// intercepted with an inert local document. Existing browser data is never deleted.
async function migrateLegacyStorage() {
  const { session } = require('electron');
  const migration = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  let intercepted = false;
  try {
    await migration.loadURL('qiuqiu://app/__storage-migration');
    if (await migration.webContents.executeJavaScript("localStorage.getItem('qiuqiumusic.localMigration.v1') === 'done'")) return;
    session.defaultSession.protocol.handle('https', request => {
      const url = new URL(request.url);
      return new Response(url.hostname === 'qiuqiumusic.onrender.com' && url.pathname === '/api/desktop-migration' ? '<!doctype html><title>秋秋音乐</title>' : 'Blocked', {
        status: url.hostname === 'qiuqiumusic.onrender.com' && url.pathname === '/api/desktop-migration' ? 200 : 403,
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
      });
    });
    intercepted = true;
    await migration.loadURL('https://qiuqiumusic.onrender.com/api/desktop-migration');
    const saved = await migration.webContents.executeJavaScript("Object.fromEntries(Object.keys(localStorage).filter(key => key.startsWith('qiuqiumusic.')).map(key => [key, localStorage.getItem(key)]))");
    await migration.loadURL('qiuqiu://app/__storage-migration');
    await migration.webContents.executeJavaScript(`(() => {
      const saved = ${JSON.stringify(saved)};
      for (const [key, value] of Object.entries(saved)) if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
      localStorage.setItem('qiuqiumusic.localMigration.v1', 'done');
    })()`);
    session.defaultSession.flushStorageData();
  } catch (error) {
    console.error('Playback storage migration will retry next launch:', error.message);
  } finally {
    if (intercepted) session.defaultSession.protocol.unhandle('https');
    migration.destroy();
  }
}

function isLocalURL(url) {
  try { const parsed = new URL(url); return parsed.protocol === 'qiuqiu:' && parsed.hostname === 'app'; } catch { return false; }
}
function openExternal(url) {
  if (/^https?:/.test(url)) shell.openExternal(url);
}
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
    // Keep transparent popup controls from activating the native window.
    focusable: false,
    skipTaskbar: true,
    minimizable: false,
    maximizable: false,
    // A frameless window has no system close button, but it must remain
    // closable: macOS otherwise cancels app.quit(), leaving an orphaned
    // floating window after the main player and polling have stopped.
    closable: true,
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
  // Show the ball while the local main window initializes. sendPlaybackState keeps it in
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
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  migrateLegacyStorage().then(() => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(SITE_URL);
  });
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
    mainWindow.webContents.insertCSS('.vinyl-toggle, #install-app { display: none !important; }').catch(() => {});
    updater?.loaded().catch(console.error);
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
    if (!isLocalURL(url)) openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isLocalURL(url)) {
      event.preventDefault();
      openExternal(url);
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
  app.whenReady().then(async () => {
    await startLocalApp();
    updater = require('./update/electron.cjs').createUpdater({ getMainWindow: () => mainWindow, quit: quitApp });
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
  }).catch(error => {
    dialog.showErrorBox('秋秋音乐启动失败', `本地播放器无法启动：${error.message}`);
    quitApp();
  });
}

app.on('before-quit', () => {
  quitting = true;
  if (pollTimer) clearInterval(pollTimer);
  updater?.dispose();
  localServer?.close();
  localServer?.closeAllConnections();
});
