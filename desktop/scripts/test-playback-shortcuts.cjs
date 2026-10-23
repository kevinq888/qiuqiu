const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'qiuqiu-shortcuts-'));
app.setPath('userData', profile);
require('node:https').get = (_url, _options, cb) => {
  const request = new EventEmitter();
  request.setTimeout = () => request;
  request.destroy = error => request.emit('error', error);
  process.nextTick(() => { const response = Readable.from('Not Found'); response.statusCode = 404; response.headers = {}; cb(response); });
  return request;
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn) { for (let i = 0; i < 100; i++) { if (await fn()) return; await sleep(100); } throw Error('Shortcut test timed out'); }
require('../main.js');
app.whenReady().then(async () => {
  try {
    await until(() => BrowserWindow.getAllWindows().some(w => w.webContents.getURL() === 'qiuqiu://app/'));
    const main = BrowserWindow.getAllWindows().find(w => w.webContents.getURL() === 'qiuqiu://app/');
    const run = js => main.webContents.executeJavaScript(js, true);
    await until(() => run(`document.documentElement.dataset.playerReady === 'true'`));
    main.show(); main.focus();
    await until(() => run('document.hasFocus()'));
    const songs = await run(`Array.from(document.querySelectorAll('[data-play-id]')).slice(0,2).map(b=>({id:b.dataset.playId,title:b.dataset.playTitle}))`);
    const wav = Buffer.alloc(44 + 8000 * 60);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
    const cache = require('../../src/audio-cache'); cache.ensureDir();
    for (const song of songs) fs.writeFileSync(cache.filePathFor(song.title), wav);
    await run(`localStorage.setItem('qiuqiumusic.guest.v1',JSON.stringify({queue:${JSON.stringify(songs)}})); localStorage.setItem('qiuqiumusic.lastPlayback.v1',JSON.stringify({queue:${JSON.stringify(songs)},current:${JSON.stringify(songs[0])},position:0}))`);
    await new Promise(resolve => { main.webContents.once('did-finish-load', resolve); main.reload(); });
    await until(() => run(`document.documentElement.dataset.playerReady === 'true' && document.hasFocus()`));
    const key = (value, options = {}) => run(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(value)},bubbles:true,cancelable:true,...${JSON.stringify(options)}}))`);
    const chord = async value => { await key('q'); await key(value); };
    const paused = () => run(`document.querySelector('#player-audio').paused`);
    const playing = () => run(`!document.querySelector('#player-audio').paused && document.querySelector('#player-audio').currentTime > 0`);
    await chord('p'); await until(playing);
    await chord('p'); assert.equal(await paused(), false, 'play is idempotent');
    await chord('s'); await until(paused);
    await chord('s'); assert.equal(await paused(), true, 'pause is idempotent');
    await chord(' '); await until(playing);
    await chord('ArrowRight'); await until(() => run(`document.querySelector('#player-title').textContent === ${JSON.stringify(songs[1].title)}`));
    await chord('ArrowLeft'); await until(() => run(`document.querySelector('#player-title').textContent === ${JSON.stringify(songs[0].title)}`));
    await chord('s'); await until(paused);
    await run(`document.querySelector('input').focus()`);
    await chord('p'); assert.equal(await paused(), true, 'typing is ignored');
    await run(`document.activeElement.blur()`);
    await key('q', { ctrlKey: true }); await key('p'); assert.equal(await paused(), true, 'modifier chords pass through');
    await key('q', { isComposing: true }); await key('p'); assert.equal(await paused(), true, 'IME input is ignored');
    await key('q'); await key('p', { repeat: true }); assert.equal(await paused(), true, 'key repeat cannot trigger');
    await key('q'); await key('Escape'); await key('p'); assert.equal(await paused(), true, 'Escape cancels');
    await key('q'); await sleep(2150); await key('p'); assert.equal(await paused(), true, 'expired sequence cannot trigger');
    await key('q'); await run(`window.dispatchEvent(new Event('blur'))`); await key('p'); assert.equal(await paused(), true, 'blur cancels');
    await run(`document.querySelector('#player-shortcuts').click()`);
    assert.ok(await run(`document.querySelector('#playback-shortcuts').open`));
    await chord('p'); assert.equal(await paused(), true, 'modal suppresses shortcuts');
    await run(`document.querySelector('#playback-shortcuts button').click()`);
    assert.equal(await run(`document.querySelector('#playback-shortcuts').open`), false);
    // Also send real Chromium input events to verify event dispatch outside JS.
    app.focus({ steal: true }); main.focus(); main.webContents.focus();
    await until(() => run('document.hasFocus()'));
    for (const value of ['Q', 'Space']) {
      main.webContents.sendInputEvent({ type: 'keyDown', keyCode: value });
      main.webContents.sendInputEvent({ type: 'keyUp', keyCode: value });
      await sleep(50);
    }
    await until(playing);
    console.log('PASS all playback commands, idempotence, typing, modifiers, IME, repeat, timeout, Escape, blur, help dialog and native keyboard input');
    ipcMain.emit('floating:quit');
  } catch (error) { console.error(error); app.exit(1); }
});
setTimeout(() => { console.error('Shortcut test timeout'); app.exit(1); }, 45000).unref();
