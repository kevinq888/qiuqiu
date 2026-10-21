const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const crypto = require('node:crypto');
const { addSongs, searchSongs } = require('./store');

const CACHE_DIR = path.join(require('./runtime-paths').dataDir, 'cache');
const TTL = 6 * 60 * 60 * 1000;
const inFlight = new Map();

// 搜索缓存中的歌曲在重启后仍可打开详情页。
try {
  for (const name of fs.readdirSync(CACHE_DIR)) {
    if (!/^search-[a-f0-9]{24}-\d+\.json$/.test(name)) continue;
    try {
      const cache = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, name), 'utf8'));
      if (cache.parserVersion === 2 && Array.isArray(cache.items)) addSongs(cache.items);
    } catch {}
  }
} catch {}

function decode(text) {
  return String(text).replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
    .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_, hex, dec) => {
      const value = parseInt(hex || dec, hex ? 16 : 10);
      return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : '';
    }).replace(/\s+/g, ' ').trim();
}

function parseSearch(html, query, page) {
  const clean = html.replace(/<!--[\s\S]*?-->/g, '');
  const matches = [];
  const row = /<div class="col-35 col-content">/g;
  let found;
  while ((found = row.exec(clean))) {
    const start = clean.indexOf('<a ', found.index);
    if (start < 0 || start - found.index > 250) continue;
    let end = start + 2;
    let quote = '';
    for (; end < clean.length; end++) {
      const ch = clean[end];
      if (quote) { if (ch === quote) quote = ''; }
      else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '>') break;
    }
    const openTag = clean.slice(start, end + 1);
    const id = openTag.match(/\/library\/(\d+)\.html/);
    const close = clean.indexOf('</a>', end);
    if (id && close > end && close - end < 500) matches.push([id[1], clean.slice(end + 1, close)]);
  }
  const seen = new Set();
  const items = [];
  for (const match of matches) {
    const title = decode(match[1]);
    if (!title.toLowerCase().includes(query.toLowerCase()) || seen.has(match[0])) continue;
    seen.add(match[0]);
    items.push({ id: match[0], title });
  }
  const pageLinks = [...clean.matchAll(/(?:&amp;|&)page=(\d+)/g)].map(x => Number(x[1]));
  return { items, hasNext: pageLinks.some(x => x > page) || matches.length >= 20 && pageLinks.length === 0 };
}

function fetchHtml(query, page) {
  const url = `https://myfreemp3ku.com/search.php?q=${encodeURIComponent(query)}${page > 1 ? `&page=${page}` : ''}`;
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 qiuqiumusic' } }, response => {
      response.on('error', reject);
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`source HTTP ${response.statusCode}`));
        return;
      }
      let html = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        html += chunk;
        if (html.length > 2_000_000) request.destroy(new Error('search page too large'));
      });
      response.on('end', () => resolve(html));
    });
    request.setTimeout(20000, () => request.destroy(new Error('search timeout')));
    request.on('error', reject);
  });
}

async function search(query, requestedPage) {
  query = String(query).trim().slice(0, 100);
  const page = Number.isSafeInteger(requestedPage) ? Math.min(250, Math.max(1, requestedPage)) : 1;
  const hash = crypto.createHash('sha256').update(query.toLowerCase()).digest('hex').slice(0, 24);
  const file = path.join(CACHE_DIR, `search-${hash}-${page}.json`);
  let cached;
  try { cached = JSON.parse(await fs.promises.readFile(file, 'utf8')); } catch {}
  if (cached && cached.parserVersion !== 2) cached = null;
  if (cached && Date.now() - cached.savedAt < TTL) {
    addSongs(cached.items);
    return { ...cached, page, source: 'remote' };
  }
  if (!inFlight.has(file)) {
    inFlight.set(file, (async () => {
      try {
        const html = await fetchHtml(query, page);
        if (!html.includes('搜索结果')) throw new Error('unexpected source search page');
        const parsed = parseSearch(html, query, page);
        const data = { ...parsed, parserVersion: 2, savedAt: Date.now() };
        await fs.promises.mkdir(CACHE_DIR, { recursive: true });
        const temp = `${file}.${process.pid}.tmp`;
        await fs.promises.writeFile(temp, JSON.stringify(data));
        await fs.promises.rename(temp, file);
        addSongs(parsed.items);
        return { ...data, page, source: 'remote' };
      } catch {
        if (cached) { addSongs(cached.items); return { ...cached, page, source: 'cached', stale: true }; }
        const local = searchSongs(query);
        return { items: local.slice((page - 1) * 20, page * 20), page, total: local.length,
          hasNext: page * 20 < local.length, source: 'local', stale: true };
      } finally { inFlight.delete(file); }
    })());
  }
  return inFlight.get(file);
}

module.exports = { search, parseSearch };
