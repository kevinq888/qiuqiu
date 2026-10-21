// Runs with ELECTRON_RUN_AS_NODE from a private copy of the current app runtime.
// It never loads renderer code and remains alive after the original app quits.
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const config = require(process.argv[2]);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function alive(pid) { try { process.kill(pid, 0); return true; } catch { return false; } }
async function log(message) { await fs.appendFile(config.log, `${new Date().toISOString()} ${message}\n`).catch(() => {}); }
async function result(value) { await fs.writeFile(config.result, JSON.stringify(value)); }
function launchPlayer(flag) {
  const child = spawn(config.exe, [flag, `--user-data-dir=${config.userData}`], {
    detached: true, stdio: 'ignore', windowsHide: false,
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toUpperCase() !== 'ELECTRON_RUN_AS_NODE')),
  });
  child.on('error', error => log(error.message));
  child.unref();
  return child;
}
async function installer() {
  await new Promise((resolve, reject) => {
    const child = spawn(config.installer, ['/S', '--updated', `/D=${config.target}`], {
      windowsHide: true, windowsVerbatimArguments: true, stdio: 'ignore',
      env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toUpperCase() !== 'ELECTRON_RUN_AS_NODE')),
    });
    const timeout = setTimeout(() => { child.kill(); reject(Error('Installer timed out')); }, 180000);
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); code === 0 ? resolve() : reject(Error(`Installer exited ${code}`)); });
  });
}
(async () => {
  await fs.writeFile(path.join(path.dirname(config.result), 'helper-ready'), 'ready');
  let newPlayer;
  try {
    await log('Waiting for old player to exit');
    for (let i = 0; alive(config.pid); i++) {
      if (i >= 1200) throw Error('Old player did not exit');
      await sleep(100);
    }
    await log('Starting silent installer');
    await installer();
    await log('Starting updated player');
    newPlayer = launchPlayer('--updated');
    for (let i = 0; i < 900; i++) {
      if (await fs.stat(config.healthy).then(() => true, () => false)) {
        await log('Updated player confirmed healthy');
        await result(config.success);
        return;
      }
      if (newPlayer.exitCode !== null && newPlayer.exitCode !== 0) break;
      await sleep(100);
    }
    throw Error('Updated player did not confirm startup');
  } catch (error) {
    await log(error.stack || error.message);
    if (newPlayer && alive(newPlayer.pid)) { newPlayer.kill(); await sleep(500); }
    // Parent exit is a prerequisite for any replacement or rollback.
    if (alive(config.pid)) { await result(config.failure); return; }
    try {
      await fs.cp(config.backup, config.target, { recursive: true, force: true });
      await result(config.failure);
      launchPlayer('--update-rollback');
    } catch (restoreError) { await log(`Rollback failed: ${restoreError.message}`); await result(config.failure); }
  }
})().catch(async error => { await log(error.stack || error.message); process.exitCode = 1; });
