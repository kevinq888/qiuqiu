const { app, ipcMain, net, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { execFileSync } = require('node:child_process');
const { UpdateManager } = require('./manager.cjs');
const platform = require('./platform.cjs');
function nativeArch() {
  if (process.platform === 'darwin' && process.arch === 'x64') {
    try { if (execFileSync('/usr/sbin/sysctl', ['-n', 'hw.optional.arm64'], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).trim() === '1') return 'arm64'; } catch {}
  }
  return process.arch;
}
function createUpdater({ getMainWindow, quit }) {
  const runtime = { version: app.getVersion(), platform: process.platform, arch: nativeArch(), packaged: app.isPackaged, userData: app.getPath('userData'), exePath: process.execPath };
  const resumeFile = path.join(runtime.userData, 'resume-after-update.json');
  const manager = new UpdateManager(runtime, {
    fetch: (url, options) => net.fetch(url, { ...options, bypassCustomProtocolHandlers: true }),
    prepare: platform.prepare,
    launch: platform.launch,
    beforeInstall: async version => {
      const main = getMainWindow();
      let playing = false;
      if (main && !main.isDestroyed()) playing = await main.webContents.executeJavaScript(`(() => {
        const audio = document.querySelector('#player-audio');
        const playing = !!audio && !audio.paused;
        window.dispatchEvent(new Event('pagehide'));
        return playing;
      })()`);
      session.defaultSession.flushStorageData();
      await fs.writeFile(resumeFile, JSON.stringify({ version, playing, savedAt: Date.now() }), { mode: 0o600 });
    },
    quit,
  });
  const trusted = event => {
    const main = getMainWindow();
    if (!main || main.isDestroyed() || event.sender !== main.webContents || event.senderFrame !== main.webContents.mainFrame) return false;
    try { const url = new URL(event.senderFrame.url); return url.protocol === 'qiuqiu:' && url.hostname === 'app'; } catch { return false; }
  };
  for (const [channel, action] of Object.entries({
    'desktop:update-state': () => manager.snapshot(),
    'desktop:update-check': () => manager.check(),
    'desktop:update-install': () => manager.install(),
  })) ipcMain.handle(channel, event => {
    if (!trusted(event)) throw Error('Update requests are only allowed from the local player');
    return action();
  });
  manager.on('state', state => {
    const main = getMainWindow();
    if (main && !main.isDestroyed()) main.webContents.send('desktop:update-state', state);
  });
  let firstCheck, interval;
  async function loaded() {
    const main = getMainWindow();
    if (!main || main.isDestroyed()) return;
    const ready = await main.webContents.executeJavaScript(`document.documentElement.dataset.playerReady === 'true'`);
    if (!ready) return;
    await platform.confirmHealthy(runtime).catch(console.error);
    try {
      const resume = JSON.parse(await fs.readFile(resumeFile, 'utf8'));
      await fs.rm(resumeFile, { force: true });
      if (resume.version === runtime.version && resume.playing && Date.now() - resume.savedAt < 10 * 60 * 1000) {
        await getMainWindow()?.webContents.executeJavaScript(`document.querySelector('#player-play-pause')?.click()`, true);
      }
    } catch {}
    const pending = await platform.pendingResult(runtime);
    if (pending) {
      try {
        const result = JSON.parse(await fs.readFile(pending.result, 'utf8'));
        if (result.status === 'error') manager.setState({ status: 'error', version: pending.version, error: result.error });
      } catch {}
    }
    if (!firstCheck && runtime.packaged) {
      firstCheck = setTimeout(() => manager.check(), 5000); firstCheck.unref();
      interval = setInterval(() => manager.check(), 6 * 60 * 60 * 1000); interval.unref();
    }
  }
  function dispose() {
    clearTimeout(firstCheck); clearInterval(interval);
  }
  return { manager, loaded, dispose };
}
module.exports = { createUpdater };
