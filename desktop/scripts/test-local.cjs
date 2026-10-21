const {app,BrowserWindow,session,ipcMain}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),http=require('node:http');
const repo=path.resolve(__dirname,'../..');
if (!process.versions.electron) {
 const profile=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'qiuqiu-local-test-'));
 try {
  for (const phase of ['seed','first','restart']) {
   const run=require('node:child_process').spawnSync(require('electron'),[__filename],{stdio:'inherit',env:{...process.env,TEST_PROFILE:profile,TEST_PHASE:phase}});
   if(run.status!==0) throw Error(`Local integration ${phase} failed: ${run.signal||run.status}`);
  }
 } finally { fs.rmSync(profile,{recursive:true,force:true}); }
 process.exit(0);
}
const profile=process.env.TEST_PROFILE;app.setPath('userData',profile);
if(process.env.TEST_PHASE==='seed') {
 app.whenReady().then(async()=>{
  session.defaultSession.protocol.handle('https',()=>new Response('<!doctype html>',{headers:{'content-type':'text/html'}}));
  const w=new BrowserWindow({show:false,webPreferences:{sandbox:true}});
  await w.loadURL('https://qiuqiumusic.onrender.com/api/desktop-migration');
  await w.webContents.executeJavaScript(`localStorage.setItem('qiuqiumusic.theme','dark');localStorage.setItem('qiuqiumusic.playmode','repeat-all')`);
  session.defaultSession.flushStorageData();await new Promise(r=>setTimeout(r,300));
  console.log('PASS legacy storage seeded locally');app.exit(0);
 }).catch(e=>{console.error(e);app.exit(1)});
 return;
}
let unexpectedRequests=0;let network=0;require('node:https').get=()=>{network++;throw Error('Offline test: all upstream networking disabled');};
let passed=false;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<120;i++){if(await fn())return;await sleep(100);}throw Error('Timeout');}
const guard=setTimeout(()=>{console.error('FAIL timeout');app.exit(1)},30000);
require(repo+'/desktop/main.js');
app.whenReady().then(async()=>{try{
 session.defaultSession.webRequest.onBeforeRequest({urls:['https://*/*','http://*/*']},(details,done)=>{if(!details.url.startsWith('http://127.0.0.1:') && details.url !== 'https://qiuqiumusic.onrender.com/api/desktop-migration'){unexpectedRequests++;console.error('UNEXPECTED EXTERNAL REQUEST',details.url);done({cancel:true});}else done({});});
 await until(()=>BrowserWindow.getAllWindows().some(w=>w.webContents.getURL()==='qiuqiu://app/'));
 const main=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()==='qiuqiu://app/');
 
 await until(()=>main.webContents.executeJavaScript(`!!document.querySelector('[data-play-id]') && !!document.querySelector('#player-play-pause')`));
 assert.equal(network,0,'Homepage must not wait for any upstream service');
 const localServer=process._getActiveHandles().find(handle=>handle instanceof http.Server);
 assert.equal(localServer.address().address,'127.0.0.1');
 const unauthorized=await new Promise((resolve,reject)=>http.get(`http://127.0.0.1:${localServer.address().port}/healthz`,res=>{res.resume();resolve(res.statusCode);}).on('error',reject));
 assert.equal(unauthorized,403,'Loopback service requires the per-launch token');
 assert.equal(await main.webContents.executeJavaScript('location.origin'),'qiuqiu://app');
 if(process.env.TEST_PHASE==='restart'){
  const state=await main.webContents.executeJavaScript(`({title:document.querySelector('#player-title').textContent,theme:localStorage.getItem('qiuqiumusic.theme'),last:JSON.parse(localStorage.getItem('qiuqiumusic.lastPlayback.v1'))})`);
  await until(()=>main.webContents.executeJavaScript(`document.querySelector('#player-audio').currentTime>=3`));assert.ok(state.last.position>=3);assert.equal(state.theme,'dark');assert.ok(!state.title.includes('选择一首歌'));
 }else{
  assert.equal(await main.webContents.executeJavaScript(`localStorage.getItem('qiuqiumusic.theme')`),'dark');
  assert.equal(await main.webContents.executeJavaScript(`localStorage.getItem('qiuqiumusic.playmode')`),'repeat-all');
  const title=await main.webContents.executeJavaScript(`document.querySelector('[data-play-id]').dataset.playTitle`);
  const cache=require(repo+'/src/audio-cache');cache.ensureDir();
  const samples=8000*30,wav=Buffer.alloc(44+samples*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*2,40);fs.writeFileSync(cache.filePathFor(title),wav);
  await main.webContents.executeJavaScript(`document.querySelector('[data-play-id]').click()`,true);
  await until(()=>main.webContents.executeJavaScript(`!document.querySelector('#player-audio').paused && document.querySelector('#player-audio').currentTime>.1`));
  await main.webContents.executeJavaScript(`document.querySelector('#player-audio').currentTime=3.5;localStorage.setItem('qiuqiumusic.theme','dark')`);
  const range=await main.webContents.executeJavaScript(`fetch(document.querySelector('#player-audio').src,{headers:{Range:'bytes=0-43'}}).then(async r=>({status:r.status,length:(await r.arrayBuffer()).byteLength}))`);
  assert.equal(range.status,206);assert.equal(range.length,44);
  const stats=await main.webContents.executeJavaScript(`fetch('/api/stats/play',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'123',title:'test'})}).then(r=>r.json())`);assert.equal(stats.ok,true);
  await main.webContents.executeJavaScript(`document.querySelector('a[href="/my-music"]')?.click()`);

  await until(()=>main.webContents.executeJavaScript(`location.pathname==='/my-music'`));assert.equal(network,0);
  const ball=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('floating.html'));
  main.close();await until(()=>ball.isVisible()&&!main.isVisible());
  ipcMain.emit('floating:control',{sender:ball.webContents},'toggle');await until(()=>main.webContents.executeJavaScript(`document.querySelector('#player-audio').paused`));
  ipcMain.emit('floating:control',{sender:ball.webContents},'toggle');await until(()=>main.webContents.executeJavaScript(`!document.querySelector('#player-audio').paused`));
  ipcMain.emit('floating:open',{sender:ball.webContents});await until(()=>main.isVisible()&&!ball.isVisible());
  await main.webContents.executeJavaScript(`document.querySelector('#player-audio').pause()`);await sleep(300);
  await session.defaultSession.flushStorageData();
  assert.ok(fs.existsSync(path.join(profile,'data','cache','audio')));
 }
 assert.equal(unexpectedRequests,0,'UI must not request remote resources');
 console.log('PASS local app, offline catalogue, stable origin, cached audio/range, POST, widget, storage; phase',process.env.TEST_PHASE);
 passed=true;ipcMain.emit('floating:quit');
}catch(e){console.error(e);app.exit(1)}});
app.on('will-quit',()=>{clearTimeout(guard);assert.ok(passed);console.log('PASS complete application exit');});
