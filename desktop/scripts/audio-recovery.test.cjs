const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { Readable } = require('node:stream');
const { EventEmitter } = require('node:events');
test('upstream resets return errors without exiting, then the same song can retry successfully', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'qiuqiu-audio-recovery-'));
  process.env.QIUQIU_DATA_DIR = directory;
  let failing = true;
  const https = require('node:https'), original = https.get;
  const audio = Buffer.alloc(44 + 8000 * 2);
  audio.write('RIFF'); audio.writeUInt32LE(audio.length - 8, 4); audio.write('WAVEfmt ', 8); audio.writeUInt32LE(16, 16); audio.writeUInt16LE(1, 20); audio.writeUInt16LE(1, 22); audio.writeUInt32LE(8000, 24); audio.writeUInt32LE(16000, 28); audio.writeUInt16LE(2, 32); audio.writeUInt16LE(16, 34); audio.write('data', 36); audio.writeUInt32LE(audio.length - 44, 40);
  https.get = (_url, _options, callback) => {
    const request = new EventEmitter();
    request.setTimeout = () => request;
    request.destroy = error => request.emit('error', error);
    process.nextTick(() => {
      const response = failing ? new Readable({ read() {} }) : Readable.from(audio);
      response.statusCode = 200; response.headers = {};
      callback(response);
      if (failing) setTimeout(() => response.destroy(Error('simulated upstream reset')), 10);
    });
    return request;
  };
  let server;
  try {
    server = await require('../../server').startServer({ port: 0, host: '127.0.0.1', token: 'test' });
    const base = `http://127.0.0.1:${server.address().port}`;
    const get = url => fetch(base + url, { headers: { 'x-qiuqiu-token': 'test' } });
    assert.equal((await get('/media/recovery.m4a')).status, 502);
    assert.ok(!(await fs.readdir(path.join(directory, 'cache/audio'))).some(file => file.endsWith('.part')));
    assert.equal((await get('/search.php?q=周杰伦')).status, 200);
    assert.equal(await get('/healthz').then(r => r.text()), 'ok');
    failing = false;
    const recovered = await get('/media/recovery.m4a?retry=1');
    assert.equal(recovered.status, 200);
    assert.deepEqual(Buffer.from(await recovered.arrayBuffer()), audio);
  } finally {
    https.get = original;
    server?.close(); server?.closeAllConnections();
    await fs.rm(directory, { recursive: true, force: true });
  }
});
