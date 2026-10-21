const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { UpdateManager, candidateFrom, newer, targetFor, downloadVerified, RELEASE_API, RELEASE_MANIFEST } = require('../update/manager.cjs');
const runtime = { version: '1.1.0', platform: 'darwin', arch: 'arm64', packaged: true };
const bytes = Buffer.from('test installer payload');
function release(version = '1.2.0') {
  const name = `${version}-macos-arm64.zip`;
  return { tag_name: `v${version}`, assets: [{ name, state: 'uploaded', size: bytes.length, digest: 'sha256:' + crypto.createHash('sha256').update(bytes).digest('hex'), browser_download_url: `https://github.com/kevinq888/qiuqiumusic/releases/download/v${version}/${name}` }] };
}
test('matching platform and numeric version comparison', () => {
  assert.equal(targetFor('darwin', 'arm64'), 'macos-arm64');
  assert.equal(targetFor('darwin', 'x64'), 'macos-x64');
  assert.equal(targetFor('win32', 'x64'), 'windows-x64');
  assert.equal(targetFor('linux', 'x64'), null);
  assert.ok(newer('1.10.0', '1.9.9'));
  assert.ok(!newer('1.1.0', '1.2.0'));
  assert.equal(candidateFrom(release('1.1.0'), runtime), null);
  assert.equal(candidateFrom({ ...release(), draft: true }, runtime), null);
  assert.equal(candidateFrom({ ...release(), prerelease: true }, runtime), null);
  assert.equal(candidateFrom(release(), runtime).target, 'macos-arm64');
});
test('rejects missing checksums, foreign URLs, and incomplete packages', () => {
  for (const mutate of [a => { a.digest = null; }, a => { a.browser_download_url = 'https://evil.example/installer.zip'; }, a => { a.size = 0; }, a => { a.name = 'other.zip'; }]) {
    const r = release(); mutate(r.assets[0]); assert.throws(() => candidateFrom(r, runtime));
  }
});
test('download validates exact size and digest, removes corrupt bytes', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qiuqiu-update-unit-'));
  try {
    const candidate = candidateFrom(release(), runtime), destination = path.join(root, 'verified.zip');
    await downloadVerified(candidate, destination, async () => new Response(bytes), () => {});
    assert.deepEqual(await fs.readFile(destination), bytes);
    const corrupt = path.join(root, 'corrupt.zip');
    await assert.rejects(downloadVerified(candidate, corrupt, async () => new Response(Buffer.alloc(bytes.length)), () => {}), /校验/);
    await assert.rejects(fs.stat(corrupt));
    await assert.rejects(downloadVerified(candidate, path.join(root, 'oversize.zip'), async () => new Response(Buffer.alloc(bytes.length + 1)), () => {}), /大小/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
test('one-click updates serialize, save playback before helper launch, quit last', async () => {
  const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'qiuqiu-update-flow-'));
  const order = [], states = [];
  try {
    const manager = new UpdateManager({ ...runtime, userData }, {
      fetch: async url => url === RELEASE_API ? Response.json(release()) : new Response(bytes),
      prepare: async () => { order.push('prepare'); return {}; },
      beforeInstall: async () => { order.push('save'); },
      launch: async () => { order.push('launch'); },
      quit: async () => { order.push('quit'); },
    });
    manager.on('state', s => states.push(s.status));
    await Promise.all([manager.install(), manager.install()]);
    assert.deepEqual(order, ['prepare', 'save', 'launch', 'quit']);
    assert.ok(states.includes('available') && states.includes('downloading') && states.includes('preparing'));
    assert.equal(manager.snapshot().status, 'restarting');
  } finally { await fs.rm(userData, { recursive: true, force: true }); }
});
test('offline check stays quiet; corrupt download never prepares or quits and can retry', async () => {
  const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'qiuqiu-update-failure-'));
  let good = false, quit = false;
  try {
    const offline = new UpdateManager({ ...runtime, userData }, { fetch: async () => { throw Error('offline'); } });
    await offline.check(); assert.equal(offline.snapshot().status, 'idle');
    const manager = new UpdateManager({ ...runtime, userData }, {
      fetch: async url => url === RELEASE_API ? Response.json(release()) : new Response(good ? bytes : Buffer.alloc(bytes.length)),
      prepare: async () => { assert.ok(good); return {}; }, beforeInstall: async () => {}, launch: async () => {}, quit: async () => { quit = true; },
    });
    await manager.check(); await manager.install();
    assert.equal(manager.snapshot().status, 'error'); assert.equal(quit, false);
    assert.deepEqual(await fs.readdir(path.join(userData, 'updates')), []);
    good = true; await manager.install(); assert.ok(quit);
  } finally { await fs.rm(userData, { recursive: true, force: true }); }
});
test('ZIP inspection reads Chinese UTF-8 names and rejects traversal or conflicting local names', async () => {
  const { inspectInstallerZip } = require('../update/zip.cjs');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qiuqiu-zip-validation-'));
  function zip(name, localName = name, count = 1) {
    const centralName = Buffer.from(name), localBytes = Buffer.from(localName);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(0x800, 6); local.writeUInt32LE(1, 18); local.writeUInt32LE(1, 22); local.writeUInt16LE(localBytes.length, 26);
    const directory = Buffer.alloc(46); directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(0x800, 8); directory.writeUInt32LE(1, 20); directory.writeUInt32LE(1, 24); directory.writeUInt16LE(centralName.length, 28);
    const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10); end.writeUInt32LE(directory.length + centralName.length, 12); end.writeUInt32LE(local.length + localBytes.length + 1, 16);
    return Buffer.concat([local, localBytes, Buffer.from('x'), directory, centralName, end]);
  }
  try {
    const expected = '秋秋音乐-1.2.0-macos-x64.dmg', file = path.join(root, 'fixture.zip');
    await fs.writeFile(file, zip(expected)); await inspectInstallerZip(file, expected);
    for (const data of [zip('../' + expected), zip(expected, '../' + expected), zip(expected, expected, 2), Buffer.from('not a zip')]) {
      await fs.writeFile(file, data); await assert.rejects(inspectInstallerZip(file, expected), /内容异常/);
    }
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('GitHub API quota exhaustion falls back to official manifest with identical verification', async () => {
  const seen = [];
  const manager = new UpdateManager(runtime, { fetch: async url => {
    seen.push(url);
    return url === RELEASE_API ? new Response('quota exhausted', {status:403}) : Response.json(release());
  } });
  assert.equal((await manager.check()).status, 'available');
  assert.deepEqual(seen, [RELEASE_API, RELEASE_MANIFEST]);
  const invalid = release(); invalid.assets[0].browser_download_url='https://example.com/foreign.zip';
  const unsafe = new UpdateManager(runtime, {fetch:async url=>url===RELEASE_API?new Response('',{status:403}):Response.json(invalid)});
  assert.equal((await unsafe.check()).status,'idle');
  assert.equal(unsafe.candidate,null);
});
