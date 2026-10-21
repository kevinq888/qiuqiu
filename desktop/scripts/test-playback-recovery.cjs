const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');
app.setPath('userData', fs.mkdtempSync(require('node:os').tmpdir() + '/qiuqiu-playback-recovery-'));
require('node:https').get = (_url, _options, cb) => {
  const req = new EventEmitter(); req.setTimeout = () => req; req.destroy = err => req.emit('error', err);
  process.nextTick(() => { const res = Readable.from('Not Found'); res.statusCode = 404; res.headers = {}; cb(res); });
  return req;
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn) { for (let i = 0; i < 100; i++) { if (await fn()) return; await sleep(100); } throw Error('Playback recovery timeout'); }
require('../main.js');
app.whenReady().then(async () => {
  try {
    await until(() => BrowserWindow.getAllWindows().some(w => w.webContents.getURL() === 'qiuqiu://app/'));
    const main = BrowserWindow.getAllWindows().find(w => w.webContents.getURL() === 'qiuqiu://app/');
    await until(() => main.webContents.executeJavaScript(`document.documentElement.dataset.playerReady === 'true'`));
    const title = await main.webContents.executeJavaScript(`document.querySelector('[data-play-id]').dataset.playTitle`);
    await main.webContents.executeJavaScript(`document.querySelector('[data-play-id]').click()`, true);
    await until(() => main.webContents.executeJavaScript(`!!document.querySelector('#player-audio').error && document.querySelector('#player-state').textContent.includes('音源暂时不可用')`));
    await main.webContents.executeJavaScript(`document.querySelector('#player-play-pause').click()`, true);
    await until(() => main.webContents.executeJavaScript(`document.querySelector('#player-state').textContent.includes('音源暂时不可用')`));
    const samples = 8000 * 30, wav = Buffer.alloc(44 + samples * 2);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
    const cache = require('../../src/audio-cache'); cache.ensureDir(); fs.writeFileSync(cache.filePathFor(title), wav);
    await main.webContents.executeJavaScript(`document.querySelector('#player-play-pause').click()`, true);
    await until(() => main.webContents.executeJavaScript(`!document.querySelector('#player-audio').paused && document.querySelector('#player-audio').currentTime>.1`));
    for (let i = 0; i < 2; i++) {
      await main.webContents.executeJavaScript(`document.querySelector('#player-play-pause').click()`, true);
      assert.ok(await main.webContents.executeJavaScript(`document.querySelector('#player-audio').paused`));
      await main.webContents.executeJavaScript(`document.querySelector('#player-play-pause').click()`, true);
      await until(() => main.webContents.executeJavaScript(`!document.querySelector('#player-audio').paused`));
    }
    console.log('PASS 404 remains visible, same-song retry reloads recovered source, two pause/resume cycles');
    ipcMain.emit('floating:quit');
  } catch (error) { console.error(error); app.exit(1); }
});
setTimeout(() => { console.error('Playback recovery test timed out'); app.exit(1); }, 45000).unref();
