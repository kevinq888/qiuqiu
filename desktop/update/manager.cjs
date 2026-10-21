const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const disk = require('./disk.cjs').promises;
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');

const RELEASE_API = 'https://api.github.com/repos/kevinq888/qiuqiumusic/releases/latest';
const RELEASE_BASE = 'https://github.com/kevinq888/qiuqiumusic/releases/download/';
const MAX_BYTES = 1024 * 1024 * 1024;
function versionParts(version) {
  if (!/^\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(version)) throw Error('版本格式不正确');
  return version.split('.').map(Number);
}
function newer(next, current) {
  const a = versionParts(next), b = versionParts(current);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}
function targetFor(platform, arch) {
  if (platform === 'darwin' && ['arm64', 'x64'].includes(arch)) return `macos-${arch}`;
  if (platform === 'win32' && arch === 'x64') return 'windows-x64';
  return null;
}
function candidateFrom(release, runtime) {
  if (!release || release.draft || release.prerelease) return null;
  const version = String(release.tag_name || '').replace(/^v/, '');
  if (!newer(version, runtime.version)) return null;
  const target = targetFor(runtime.platform, runtime.arch);
  if (!target) return null;
  const name = `${version}-${target}.zip`;
  const asset = (release.assets || []).find(item => item.name === name);
  if (!asset || asset.state !== 'uploaded' || !Number.isSafeInteger(asset.size) || asset.size < 1 || asset.size > MAX_BYTES) throw Error('新版本安装包尚未准备完整');
  if (!/^sha256:[a-f0-9]{64}$/.test(asset.digest || '')) throw Error('新版本缺少文件校验信息，请稍后重试');
  if (asset.browser_download_url !== `${RELEASE_BASE}v${version}/${name}`) throw Error('安装包地址不是官方发布地址');
  return { version, target, name, url: asset.browser_download_url, size: asset.size, sha256: asset.digest.slice(7) };
}
function trustedDownloadURL(url) {
  const parsed = new URL(url);
  return parsed.protocol === 'https:' && !parsed.username && !parsed.password && (!parsed.port || parsed.port === '443') &&
    (parsed.hostname === 'github.com' || parsed.hostname === 'release-assets.githubusercontent.com' || parsed.hostname === 'objects.githubusercontent.com');
}
async function downloadVerified(candidate, destination, fetch, onProgress) {
  const response = await fetch(candidate.url, { signal: AbortSignal.timeout(10 * 60 * 1000), cache: 'no-store' });
  if (!response.ok || !response.body || !trustedDownloadURL(response.url || candidate.url)) throw Error('安装包下载失败，请检查网络后重试');
  const advertised = response.headers.get('content-length');
  if (advertised && Number(advertised) !== candidate.size) throw Error('安装包大小与发布信息不一致');
  let bytes = 0, percent = -1;
  const hash = crypto.createHash('sha256');
  const verifier = new Transform({ transform(chunk, _encoding, done) {
    bytes += chunk.length;
    if (bytes > candidate.size) return done(Error('下载文件超过预期大小'));
    hash.update(chunk);
    const next = Math.floor(bytes * 100 / candidate.size);
    if (next !== percent) { percent = next; onProgress(next); }
    done(null, chunk);
  } });
  try {
    await pipeline(Readable.fromWeb(response.body), verifier, fs.createWriteStream(destination, { flags: 'wx', mode: 0o600 }));
    if (bytes !== candidate.size || hash.digest('hex') !== candidate.sha256) throw Error('安装包校验失败，原应用未作更改，请重试');
  } catch (error) {
    await fs.promises.rm(destination, { force: true });
    throw error;
  }
}

class UpdateManager extends EventEmitter {
  constructor(runtime, dependencies) {
    super();
    this.runtime = runtime;
    this.dependencies = dependencies;
    this.state = { status: 'idle', currentVersion: runtime.version, version: '', progress: 0, error: '' };
    this.candidate = null;
    this.checking = null;
    this.installing = null;
  }
  snapshot() { return { ...this.state }; }
  setState(patch) { Object.assign(this.state, patch); this.emit('state', this.snapshot()); }
  async check() {
    if (this.installing || !this.runtime.packaged || !targetFor(this.runtime.platform, this.runtime.arch)) return this.snapshot();
    if (this.checking) return this.checking;
    this.checking = (async () => {
      try {
        const response = await this.dependencies.fetch(RELEASE_API, {
          headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'qiuqiumusic-updater' },
          signal: AbortSignal.timeout(10000), cache: 'no-store',
        });
        if (!response.ok) throw Error('暂时无法连接更新服务');
        const candidate = candidateFrom(await response.json(), this.runtime);
        this.candidate = candidate;
        this.setState({ status: candidate ? 'available' : 'idle', version: candidate?.version || '', error: '', progress: 0 });
      } catch (error) {
        // Background check failures must not interrupt music or display a false update.
        if (!this.candidate) this.setState({ status: 'idle', error: '' });
        this.emit('check-error', error);
      }
      return this.snapshot();
    })().finally(() => { this.checking = null; });
    return this.checking;
  }
  async install() {
    if (this.installing) return this.installing;
    if (!this.candidate) await this.check();
    if (this.installing) return this.installing;
    if (!this.candidate) return this.snapshot();
    const candidate = this.candidate;
    this.installing = (async () => {
      let workspace, prepared;
      try {
        const root = path.join(this.runtime.userData, 'updates');
        await fs.promises.mkdir(root, { recursive: true, mode: 0o700 });
        workspace = await fs.promises.mkdtemp(path.join(root, `v${candidate.version}-`));
        this.setState({ status: 'downloading', version: candidate.version, progress: 0, error: '' });
        const archive = path.join(workspace, candidate.name);
        await downloadVerified(candidate, archive, this.dependencies.fetch, progress => this.setState({ progress }));
        this.setState({ status: 'preparing', progress: 100 });
        prepared = await this.dependencies.prepare({ candidate, archive, workspace, runtime: this.runtime });
        await this.dependencies.beforeInstall(candidate.version);
        // Helper must be running before the application exits.
        await this.dependencies.launch({ ...prepared, workspace, candidate, runtime: this.runtime });
        this.setState({ status: 'restarting' });
        await this.dependencies.quit();
      } catch (error) {
        await prepared?.cleanup?.().catch(() => {});
        if (workspace) await disk.rm(workspace, { recursive: true, force: true }).catch(() => {});
        console.error('Desktop update failed:', error);
        const message = ['EACCES', 'EPERM'].includes(error.code) ? '没有更新权限，请将应用移到可写目录后重试'
          : error.code === 'ENOSPC' ? '磁盘空间不足，请清理后重试'
          : error.cmd ? '准备更新失败，原应用未作更改。请检查安装目录权限后重试'
          : ['AbortError', 'TimeoutError'].includes(error.name) ? '更新连接超时，请检查网络后重试'
          : error.message || '更新失败，请重试';
        this.setState({ status: 'error', error: message });
      }
      return this.snapshot();
    })().finally(() => { this.installing = null; });
    return this.installing;
  }
}
module.exports = { UpdateManager, candidateFrom, newer, targetFor, downloadVerified, RELEASE_API };
