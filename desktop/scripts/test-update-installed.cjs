// End-to-end installer test. Only run against a disposable copy under the system temp directory.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
const crypto = require('node:crypto');
const [application, archive, version = '1.2.0'] = process.argv.slice(2);
const temporary = path.resolve(os.tmpdir());
const allowedTempRoots = [temporary, ...(process.platform === 'darwin' ? ['/private/tmp', '/tmp'] : [])];
if (!application || !archive || !allowedTempRoots.some(root => { const normalized = value => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value); return normalized(application).startsWith(normalized(root) + path.sep); })) throw Error('Use a disposable application copy under the system temp directory');
const exe = process.platform === 'darwin' ? path.join(application, 'Contents', 'MacOS', '秋秋音乐') : path.join(application, '秋秋音乐.exe');
const profile = awaitProfile();
function awaitProfile() { return fs.mkdtemp(path.join(temporary, 'qiuqiu-update-profile-')); }
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const rollback = process.env.QIUQIU_TEST_ROLLBACK === '1';
let socket, nextId = 0, child;
const requests = new Map();
function call(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => { requests.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
}
async function evaluate(expression) {
  const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function stopTestApp() {
  if (process.platform === 'darwin') {
    const { stdout } = await run('ps', ['-axww', '-o', 'pid=,command=']);
    for (const line of stdout.split('\n')) {
      const match = line.trim().match(/^(\d+) (.*)$/);
      if (match && match[2].startsWith(exe + ' ')) { try { process.kill(Number(match[1]), 'SIGTERM'); } catch {} }
    }
  } else {
    const quote = value => "'" + value.replace(/'/g, "''") + "'";
    const actual = await fs.realpath(exe).catch(() => exe);
    await run('powershell.exe', ['-NoProfile', '-Command', `Get-Process | Where-Object {$_.Path -eq ${quote(actual)}} | Stop-Process -Force`], { timeout: 15000 });
  }
}
(async () => {
  const userData = await profile;
  console.log('Disposable profile:', userData);
  try {
    await fs.access(exe);
    child = spawn(exe, ['--inspect=127.0.0.1:9349', `--user-data-dir=${userData}`], { stdio: ['ignore', 'pipe', 'pipe'] });
    child.on('error',error=>console.error('Disposable application launch failed:',error));
    child.stderr.on('data', bytes => process.stderr.write(bytes));
    let endpoints;
    for (let i = 0; i < 100; i++) {
      try { endpoints = await fetch('http://127.0.0.1:9349/json/list').then(r => r.json()); break; } catch { await sleep(100); }
    }
    assert.ok(endpoints?.[0]);
    socket = new WebSocket(endpoints[0].webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });
    socket.addEventListener('message', event => {
      const value = JSON.parse(event.data);
      const request = requests.get(value.id);
      if (request) { requests.delete(value.id); value.error ? request.reject(value.error) : request.resolve(value.result); }
    });
    await sleep(1500);
    await evaluate(`globalThis.e = process.getBuiltinModule('module').createRequire(process.execPath)('electron');true`);
    assert.equal(await fs.realpath(await evaluate(`e.app.getPath('userData')`)),await fs.realpath(userData),'The installer test must never use a real user profile');
    let mainId;
    for (let i = 0; i < 120; i++) {
      mainId = await evaluate(`e.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()==='qiuqiu://app/')?.id`);
      if (mainId && await evaluate(`e.BrowserWindow.fromId(${mainId}).webContents.executeJavaScript("!!document.querySelector('[data-play-id]')")`)) break;
      await sleep(100);
    }
    assert.ok(mainId);
    const metadata = await fs.stat(archive);
    const hash = crypto.createHash('sha256');
    for await (const chunk of require('node:fs').createReadStream(archive)) hash.update(chunk);
    const target = process.platform === 'darwin' ? `macos-${process.arch}` : 'windows-x64';
    const asset = { name: `${version}-${target}.zip`, size: metadata.size, state: 'uploaded', digest: 'sha256:' + hash.digest('hex'), browser_download_url: `https://github.com/kevinq888/qiuqiumusic/releases/download/v${version}/${version}-${target}.zip` };
    const modulePath = path.resolve(__dirname, '../update/electron.cjs');
    const packagedUpdater = process.env.QIUQIU_USE_PACKAGED_UPDATER === '1';
    const saved = await evaluate(`(async()=>{
      const w=e.BrowserWindow.fromId(${mainId});
      const title=await w.webContents.executeJavaScript("document.querySelector('[data-play-id]').dataset.playTitle");
      const fs=process.getBuiltinModule('fs'),path=process.getBuiltinModule('path'),crypto=process.getBuiltinModule('crypto');
      const samples=8000*45,b=Buffer.alloc(44+samples*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples*2,40);
      const cache=path.join(e.app.getPath('userData'),'data/cache/audio');fs.mkdirSync(cache,{recursive:true});fs.writeFileSync(path.join(cache,crypto.createHash('md5').update(title).digest('hex')+'.m4a'),b);
      await w.webContents.executeJavaScript("document.querySelector('[data-play-id]').click()",true);
      return {title,version:e.app.getVersion()};
    })()`);
    for (let i = 0; i < 100; i++) {
      if (await evaluate(`e.BrowserWindow.fromId(${mainId}).webContents.executeJavaScript("!document.querySelector('#player-audio').paused && document.querySelector('#player-audio').readyState>=2")`)) break;
      await sleep(100);
    }
    await evaluate(`e.BrowserWindow.fromId(${mainId}).webContents.executeJavaScript("document.querySelector('#player-audio').currentTime=7.5;localStorage.setItem('qiuqiumusic.theme','dark')")`);
    if (packagedUpdater) await evaluate(`for(const channel of ['desktop:update-state','desktop:update-check','desktop:update-install'])e.ipcMain.removeHandler(channel);true`);
    await evaluate(`globalThis.testUpdater=process.getBuiltinModule('module').createRequire(process.execPath)(${packagedUpdater ? "process.getBuiltinModule('path').join(process.resourcesPath,'app.asar/update/electron.cjs')" : JSON.stringify(modulePath)}).createUpdater({getMainWindow:()=>e.BrowserWindow.fromId(${mainId}),quit:()=>e.app.quit()});true`);
    // A same-version reinstall fixture exercises the updater shipped inside ASAR.
    if (packagedUpdater) await evaluate(`testUpdater.manager.runtime.version='1.1.0';true`);
    // Only replace network transport. Preparation, digest verification, helper,
    // real installer, saved playback and new app health confirmation remain real.
    await evaluate(`testUpdater.manager.dependencies.fetch=async url=>url.endsWith('/latest')?Response.json({tag_name:'v${version}',assets:[${JSON.stringify(asset)}]}):new Response(process.getBuiltinModule('fs').createReadStream(${JSON.stringify(archive)}),{headers:{'content-length':'${metadata.size}'}});true`);
    if (rollback) await evaluate(`{const prepare=testUpdater.manager.dependencies.prepare;testUpdater.manager.dependencies.prepare=async input=>{const result=await prepare(input);process.getBuiltinModule('fs').writeFileSync(process.getBuiltinModule('path').join(result.stage,result.binary),'#!/bin/sh\\nexit 1\\n',{mode:0o755});return result;};}true`);
    assert.equal((await evaluate('testUpdater.manager.check()')).status, 'available');
    await evaluate(`testUpdater.manager.install();true`);
    let result, journal;
    for (let i = 0; i < 360; i++) {
      try {
        journal = JSON.parse(await fs.readFile(path.join(userData, 'updates', 'pending.json'), 'utf8'));
        // A debugger connection can delay Electron's final process exit.
        if (socket.readyState === WebSocket.OPEN) socket.close();
        result = JSON.parse(await fs.readFile(journal.result, 'utf8')); break;
      } catch {
        if (!journal && socket.readyState === WebSocket.OPEN) {
          const state = await evaluate('testUpdater.manager.snapshot()').catch(() => null);
          if (state?.status === 'error') throw Error(state.error);
        }
        await sleep(1000);
      }
    }
    assert.ok(result, 'Installer helper must finish and report health or rollback');
    assert.equal(result.status, rollback ? 'error' : 'success');
    if (!rollback) {
      assert.equal(await fs.readFile(journal.healthy, 'utf8'), 'ready');
      for (let i = 0; i < 50; i++) {
        try { await fs.stat(path.join(userData, 'resume-after-update.json')); await sleep(100); } catch { break; }
      }
      await assert.rejects(fs.stat(path.join(userData, 'resume-after-update.json')));
    }
    console.log('PASS real installer update', { from: saved.version, to: version, target, mode: rollback ? 'startup failure rollback' : 'successful replacement, health and playback resume' });
    socket.close();
    await stopTestApp();
    if (process.platform === 'darwin') await run('/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister',['-u',application]).catch(()=>{});
    await sleep(1000);
    await fs.rm(userData, { recursive: true, force: true });
  } catch (error) {
    console.error(error);
    console.error('Diagnostics retained:', userData);
    try { for (const name of await fs.readdir(path.join(userData,'updates'))) {
      for (const log of ['install.log','helper.log']) { try { console.error(await fs.readFile(path.join(userData,'updates',name,log),'utf8')); } catch {} }
    }} catch {}
    socket?.close();
    await stopTestApp().catch(() => {});
    if (child && child.exitCode === null) child.kill();
    process.exitCode = 1;
  }
})();
