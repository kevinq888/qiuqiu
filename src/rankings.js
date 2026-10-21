// 按需抓取最近更新，补齐站内推荐和热门榜单；每个源站分页独立落盘缓存。
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const { seed, addSongs } = require('./store');

const CACHE_DIR = path.join(require('./runtime-paths').dataDir, 'cache');
const TTL = 6 * 60 * 60 * 1000;
const MAX_PAGES = 250;
const pending = new Map();

// 重启后恢复已缓存歌曲的详情和搜索索引。
try {
  for (const name of fs.readdirSync(CACHE_DIR)) {
    if (!/^recent-\d+\.json$/.test(name)) continue;
    try {
      const cached = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, name), 'utf8'));
      if (Array.isArray(cached.items)) addSongs(cached.items);
    } catch {}
  }
} catch {}

function decode(s) {
  return String(s || '').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
    .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_, hex, dec) => {
      const n = parseInt(hex || dec, hex ? 16 : 10);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
    }).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function parseSongs(html) {
  const clean = html.replace(/<!--[\s\S]*?-->/g, '');
  const items = [];
  const re = /<a\b[^>]*href=["'][^"']*\/library\/(\d+)\.html["'][^>]*>[\s\S]*?<div class="col-25 col-content">([\s\S]*?)<\/div>/g;
  for (const match of clean.matchAll(re)) {
    const title = decode(match[2]);
    if (title) items.push({ id: match[1], title });
  }
  return items.slice(0, 10);
}

function download(page) {
  const url = `https://myfreemp3ku.com/navigation/1/${page}/`;
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'qiuqiumusic/1.0' } }, res => {
      res.on('error', reject);
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`source HTTP ${res.statusCode}`));
        return;
      }
      let html = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        html += chunk;
        if (html.length > 2_000_000) req.destroy(new Error('source page too large'));
      });
      res.on('end', () => resolve(html));
    });
    req.setTimeout(9000, () => req.destroy(new Error('source timeout')));
    req.on('error', reject);
  });
}

async function sourcePage(page) {
  const file = path.join(CACHE_DIR, `recent-${page}.json`);
  let cached;
  try { cached = JSON.parse(await fs.promises.readFile(file, 'utf8')); } catch {}
  if (cached && Date.now() - cached.savedAt < TTL && cached.items.length) {
    addSongs(cached.items);
    return { items: cached.items, stale: false };
  }
  if (!pending.has(page)) {
    pending.set(page, (async () => {
      try {
        const items = parseSongs(await download(page));
        if (!items.length) throw new Error('source page has no songs');
        await fs.promises.mkdir(CACHE_DIR, { recursive: true });
        const temp = `${file}.${process.pid}.tmp`;
        await fs.promises.writeFile(temp, JSON.stringify({ savedAt: Date.now(), items }));
        await fs.promises.rename(temp, file);
        addSongs(items);
        return { items, stale: false };
      } catch (error) {
        if (cached && cached.items.length) {
          addSongs(cached.items);
          return { items: cached.items, stale: true };
        }
        return { items: [], stale: true, error: error.message };
      } finally {
        pending.delete(page);
      }
    })());
  }
  return pending.get(page);
}

async function ranking(kind, requestedPage) {
  const page = Math.max(1, Math.min(MAX_PAGES, Number.isSafeInteger(requestedPage) ? requestedPage : 1));
  const featured = kind === 'recommend' ? seed.rank_recommend : seed.rank_hot;
  const sourcePages = page === 1 ? [1] : [2 * page - 2, 2 * page - 1];
  const results = await Promise.all(sourcePages.map(sourcePage));
  const items = page === 1 ? [...featured] : [];
  const seen = new Set(items.map(x => String(x.id)));
  for (const result of results) {
    for (const song of result.items) {
      if (!seen.has(song.id)) { items.push(song); seen.add(song.id); }
    }
  }
  return { kind, page, pages: MAX_PAGES, items: items.slice(0, 20), stale: results.some(x => x.stale), unavailable: results.some(x => x.error) };
}

module.exports = { ranking, sourcePage, MAX_PAGES, parseSongs };
