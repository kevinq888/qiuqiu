const { app, BrowserWindow, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const profile = fs.mkdtempSync(require('node:os').tmpdir() + '/qiuqiu-update-ui-');
app.setPath('userData', profile);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn) { for (let i = 0; i < 100; i++) { if (await fn()) return; await sleep(100); } throw Error('UI timeout'); }
let passed = false;
require('../main.js');
app.whenReady().then(async () => {
  try {
    await until(() => BrowserWindow.getAllWindows().some(w => w.webContents.getURL() === 'qiuqiu://app/'));
    const main = BrowserWindow.getAllWindows().find(w => w.webContents.getURL() === 'qiuqiu://app/');
    await until(() => main.webContents.executeJavaScript(`!!window.qiuqiuUpdater && !!document.querySelector('#desktop-update')`));
    assert.ok(await main.webContents.executeJavaScript(`document.querySelector('#desktop-update').hidden`));
    let installs = 0;
    ipcMain.removeHandler('desktop:update-install');
    ipcMain.handle('desktop:update-install', () => { installs++; return { status: 'downloading', currentVersion: '1.2.0', version: '1.3.0', progress: 0 }; });
    const send = patch => main.webContents.send('desktop:update-state', { currentVersion: '1.2.0', version: '1.3.0', ...patch });
    send({ status: 'available' });
    await until(() => main.webContents.executeJavaScript(`document.querySelector('#desktop-update').textContent === '更新 v1.3.0'`));
    fs.writeFileSync('/private/tmp/qiuqiu-update-banner.png', (await main.webContents.capturePage()).toPNG());
    await main.webContents.executeJavaScript(`document.querySelector('#desktop-update').click();document.querySelector('#desktop-update').click()`);
    await until(() => installs === 1);
    send({ status: 'downloading', progress: 55 });
    await main.webContents.executeJavaScript(`document.querySelector('a[href="/my-music"]').click()`);
    await until(() => main.webContents.executeJavaScript(`location.pathname === '/my-music' && document.querySelector('#desktop-update').textContent === '下载 55%'`));
    assert.ok(await main.webContents.executeJavaScript(`document.querySelector('#desktop-update').disabled`));
    send({ status: 'error', error: '测试：网络中断，点击重试' });
    await until(() => main.webContents.executeJavaScript(`document.querySelector('#desktop-update').textContent === '更新重试' && !document.querySelector('#desktop-update').disabled`));
    send({ status: 'available' });
    main.setSize(900, 760);
    await sleep(200);
    assert.ok(await main.webContents.executeJavaScript(`document.documentElement.scrollWidth <= innerWidth`));
    passed = true;
    console.log('PASS native bridge, update notice, one-click deduplication, download progress, SPA persistence, retry and header layout');
    ipcMain.emit('floating:quit');
  } catch (error) { console.error(error); app.exit(1); }
});
app.on('will-quit', () => { if (passed) setTimeout(() => fs.rmSync(profile, { recursive: true, force: true }), 100).unref(); });
setTimeout(() => { console.error('UI test timed out'); app.exit(1); }, 25000).unref();
