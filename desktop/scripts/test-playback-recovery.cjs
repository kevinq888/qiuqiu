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
    // Reproduce a play() that never settles and never emits a MediaError, even
    // though the entire track is on disk. Speed up only the recovery deadlines.
    await main.webContents.executeJavaScript(`
      document.querySelector('#player-play-pause').click();
      window.realTimeout = window.setTimeout;
      window.setTimeout = (fn, ms, ...args) => realTimeout(fn, ms === 15000 || ms === 75000 ? 300 : ms, ...args);
      window.realPlay = HTMLMediaElement.prototype.play;
      window.playCalls = 0;
      HTMLMediaElement.prototype.play = function() {
        if (++window.playCalls === 1) return new Promise(() => {});
        return realPlay.call(this);
      };
      window.resumeAt = document.querySelector('#player-audio').currentTime;
      document.querySelector('#player-play-pause').click();
    `, true);
    await until(() => main.webContents.executeJavaScript(`window.playCalls >= 2 && !document.querySelector('#player-audio').paused && document.querySelector('#player-audio').currentTime > window.resumeAt`));
    assert.ok(await main.webContents.executeJavaScript(`document.querySelector('#player-audio').src.includes('retry=')`));
    // A permanently stuck source must stop retrying and leave a working retry
    // button. A manual pause must cancel its pending recovery.
    await main.webContents.executeJavaScript(`
      document.querySelector('#player-play-pause').click();
      window.playCalls = 0;
      HTMLMediaElement.prototype.play = function() { ++window.playCalls; return new Promise(() => {}); };
      document.querySelector('#player-play-pause').click();
    `, true);
    await until(() => main.webContents.executeJavaScript(`document.querySelector('#player-state').textContent.includes('播放加载超时')`));
    assert.equal(await main.webContents.executeJavaScript('window.playCalls'), 2);
    // Restore real playback and simulate a decoder waiting without progress.
    await main.webContents.executeJavaScript(`HTMLMediaElement.prototype.play = realPlay; document.querySelector('#player-play-pause').click()`, true);
    await until(() => main.webContents.executeJavaScript(`!document.querySelector('#player-audio').paused && document.querySelector('#player-state').textContent === '正在播放'`));
    await main.webContents.executeJavaScript(`
      window.stalledSource = document.querySelector('#player-audio').src;
      document.querySelector('#player-audio').pause();
      document.querySelector('#player-audio').dispatchEvent(new Event('waiting'));
    `, true);
    await until(() => main.webContents.executeJavaScript(`document.querySelector('#player-audio').src !== window.stalledSource && !document.querySelector('#player-audio').paused && document.querySelector('#player-state').textContent === '正在播放'`));
    await main.webContents.executeJavaScript(`document.querySelector('#player-audio').dispatchEvent(new Event('waiting')); document.querySelector('#player-play-pause').click()`, true);
    await sleep(700);
    assert.ok(await main.webContents.executeJavaScript(`document.querySelector('#player-audio').paused && !document.querySelector('#site-player').classList.contains('is-buffering')`));
    console.log('PASS source-error retry, cached hanging play recovery with position, bounded retries, mid-track stall recovery, manual retry and pause cancellation');
    ipcMain.emit('floating:quit');
  } catch (error) { console.error(error); app.exit(1); }
});
setTimeout(() => { console.error('Playback recovery test timed out'); app.exit(1); }, 45000).unref();
