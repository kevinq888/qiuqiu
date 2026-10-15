// 音频磁盘缓存：命中直接回源磁盘文件，60 天未被命中自动清理，容量超限时按最旧淘汰。
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const CACHE_DIR = path.join(__dirname, '..', 'data', 'cache', 'audio');
const MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;   // 缓存有效期：60 天
const MAX_BYTES = 512 * 1024 * 1024;           // 磁盘软上限 512MB
const PART_MAX_AGE_MS = 60 * 60 * 1000;        // 下载中断残留 .part 文件 1 小时后清理

function fileNameFor(title) {
  const hash = crypto.createHash('md5').update(String(title)).digest('hex');
  return `${hash}.m4a`;
}

function filePathFor(title) {
  return path.join(CACHE_DIR, fileNameFor(title));
}

function ensureDir() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// 命中检查：文件存在且非空则刷新访问时间（mtime 即最后命中时间），返回 stat。
function statFile(title) {
  const filePath = filePathFor(title);
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > 0) {
      const now = new Date();
      fs.utimesSync(filePath, now, now);
      return stat;
    }
  } catch {}
  return null;
}

// 清理：TTL 过期、超容量 LRU、残留 .part。异步尽力而为，不阻塞请求。
function cleanup() {
  fs.readdir(CACHE_DIR, (err, files) => {
    if (err || !files.length) return;
    const now = Date.now();
    let pending = files.length;
    const entries = [];
    for (const file of files) {
      const full = path.join(CACHE_DIR, file);
      fs.stat(full, (statErr, stat) => {
        if (!statErr && stat.isFile()) {
          entries.push({ full, file, mtime: stat.mtimeMs, size: stat.size });
        }
        if (--pending) return;
        // TTL 过期 + 残留分片
        const toDelete = [];
        const alive = [];
        for (const entry of entries) {
          const isPart = entry.file.endsWith('.part');
          const age = now - entry.mtime;
          if ((isPart && age > PART_MAX_AGE_MS) || (!isPart && age > MAX_AGE_MS)) toDelete.push(entry);
          else if (!isPart) alive.push(entry);
        }
        // 容量 LRU：从最旧开始淘汰
        let total = alive.reduce((sum, entry) => sum + entry.size, 0);
        alive.sort((a, b) => a.mtime - b.mtime);
        while (total > MAX_BYTES && alive.length) {
          const oldest = alive.shift();
          total -= oldest.size;
          toDelete.push(oldest);
        }
        for (const entry of toDelete) fs.unlink(entry.full, () => {});
      });
    }
  });
}

module.exports = { CACHE_DIR, MAX_AGE_MS, fileNameFor, filePathFor, ensureDir, statFile, cleanup };
