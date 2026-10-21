const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
const { inspectInstallerZip } = require('./zip.cjs');
const APP_ID = 'com.qiuqiumusic.desktop';
function appBundle(exe) { return path.resolve(path.dirname(exe), '../..'); }
function psLiteral(value) { return "'" + value.replace(/'/g, "''") + "'"; }
async function powershell(code) {
  return run('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(code, 'utf16le').toString('base64')], { windowsHide: true, timeout: 120000 });
}
async function extractInstaller({ candidate, archive, workspace, runtime }) {
  const ext = runtime.platform === 'darwin' ? 'dmg' : 'exe';
  const filename = `秋秋音乐-${candidate.version}-${candidate.target}.${ext}`;
  const installer = path.join(workspace, filename);
  await inspectInstallerZip(archive, filename);
  if (runtime.platform === 'darwin') {
    await run('/usr/bin/ditto', ['-x', '-k', archive, workspace], { timeout: 120000 });
  } else {
    // Inspect before extracting; only the exact expected installer may be written.
    await powershell(`$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem;
$z=[IO.Compression.ZipFile]::OpenRead(${psLiteral(archive)}); try {
 if($z.Entries.Count -ne 1 -or $z.Entries[0].FullName -cne ${psLiteral(filename)}){throw 'Unexpected ZIP content'}
 [IO.Compression.ZipFileExtensions]::ExtractToFile($z.Entries[0],${psLiteral(installer)},$false)
}finally{$z.Dispose()}`);
  }
  const stat = await fs.lstat(installer);
  if (!stat.isFile() || stat.isSymbolicLink()) throw Error('安装文件无效');
  return installer;
}
async function prepareMac(input) {
  const { candidate, workspace, runtime } = input;
  const target = appBundle(runtime.exePath);
  if (!target.endsWith('.app') || target.includes('/AppTranslocation/') || target.startsWith('/Volumes/')) throw Error('请先将应用移到“应用程序”目录，再进行自动更新');
  try { await fs.access(path.dirname(target), require('node:fs').constants.W_OK); }
  catch { throw Error('安装目录不可写，请将应用移到个人“应用程序”目录后重试'); }
  const installer = await extractInstaller(input);
  const mount = path.join(workspace, 'mount');
  await fs.mkdir(mount);
  const suffix = crypto.randomBytes(8).toString('hex');
  const stage = path.join(path.dirname(target), `.qiuqiu-update-${suffix}.app`);
  const backup = path.join(path.dirname(target), `.qiuqiu-backup-${suffix}.app`);
  let mounted = false;
  try {
    await run('/usr/bin/hdiutil', ['attach', '-readonly', '-nobrowse', '-mountpoint', mount, installer], { timeout: 120000 });
    mounted = true;
    const source = path.join(mount, '秋秋音乐.app');
    const plist = path.join(source, 'Contents', 'Info.plist');
    const value = async key => (await run('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, plist])).stdout.trim();
    if (await value('CFBundleIdentifier') !== APP_ID || await value('CFBundleShortVersionString') !== candidate.version) throw Error('安装包版本或应用标识不匹配');
    const binary = await value('CFBundleExecutable');
    if (path.basename(binary) !== binary) throw Error('安装包程序名称无效');
    const executable = path.join(source, 'Contents', 'MacOS', binary);
    const architectures = (await run('/usr/bin/lipo', ['-archs', executable])).stdout.trim().split(/\s+/);
    if (!architectures.includes(runtime.arch === 'x64' ? 'x86_64' : 'arm64')) throw Error('安装包芯片架构不匹配');
    await run('/usr/bin/ditto', [source, stage], { timeout: 120000 });
    return { target, stage, backup, binary: path.join('Contents', 'MacOS', binary), cleanup: () => fs.rm(stage, { recursive: true, force: true }) };
  } catch (error) {
    await fs.rm(stage, { recursive: true, force: true }).catch(() => {});
    throw error;
  } finally {
    if (mounted) await run('/usr/bin/hdiutil', ['detach', mount], { timeout: 30000 });
  }
}
async function prepareWindows(input) {
  const installer = await extractInstaller(input);
  const target = path.dirname(input.runtime.exePath);
  if (path.relative(target, input.workspace).split(path.sep)[0] !== '..') throw Error('更新缓存不能位于安装目录内');
  return { installer, target, backup: path.join(input.workspace, 'previous-app'), exe: input.runtime.exePath, cleanup: async () => {} };
}
async function prepare(input) {
  return input.runtime.platform === 'darwin' ? prepareMac(input) : prepareWindows(input);
}
async function launch(input) {
  const { runtime, candidate, workspace, target, backup } = input;
  const healthy = path.join(workspace, 'healthy');
  const result = path.join(workspace, 'result.json');
  const journal = { version: candidate.version, workspace, target, healthy, result, startedAt: Date.now() };
  await fs.writeFile(path.join(runtime.userData, 'updates', 'pending.json'), JSON.stringify(journal), { mode: 0o600 });
  const success = { status: 'success', version: candidate.version };
  const failure = { status: 'error', version: candidate.version, error: '自动更新未完成，请重试；也可从官方发布页重新安装。' };
  let command, args;
  if (runtime.platform === 'darwin') {
    const helper = path.join(workspace, 'apply.sh');
    await fs.copyFile(path.join(__dirname, 'apply-mac.sh'), helper);
    command = '/bin/sh';
    args = [helper, target, input.stage, backup, String(process.pid), result, healthy, input.binary, JSON.stringify(success), JSON.stringify(failure), runtime.userData];
  } else {
    const helper = path.join(workspace, 'apply.ps1');
    const config = path.join(workspace, 'apply.json');
    await fs.copyFile(path.join(__dirname, 'apply-win.ps1'), helper);
    await fs.writeFile(config, JSON.stringify({ ...input, cleanup: undefined, runtime: undefined, candidate: undefined, pid: process.pid, userData: runtime.userData, healthy, result, success, failure, log: path.join(workspace, 'install.log') }), { mode: 0o600 });
    command = 'powershell.exe';
    const code = `& ([scriptblock]::Create([IO.File]::ReadAllText(${psLiteral(helper)}))) -ConfigPath ${psLiteral(config)}`;
    args = ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(code, 'utf16le').toString('base64')];
  }
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}
async function pendingResult(runtime) {
  const root = path.join(runtime.userData, 'updates');
  try {
    const journal = JSON.parse(await fs.readFile(path.join(root, 'pending.json'), 'utf8'));
    const relative = path.relative(root, journal.workspace);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || journal.healthy !== path.join(journal.workspace, 'healthy') || journal.result !== path.join(journal.workspace, 'result.json')) return null;
    return journal;
  } catch { return null; }
}
async function confirmHealthy(runtime) {
  const pending = await pendingResult(runtime);
  const target = runtime.platform === 'darwin' ? appBundle(runtime.exePath) : path.dirname(runtime.exePath);
  if (pending?.version === runtime.version && pending.target === target) await fs.writeFile(pending.healthy, 'ready', { mode: 0o600 });
}
module.exports = { prepare, launch, pendingResult, confirmHealthy, appBundle };
