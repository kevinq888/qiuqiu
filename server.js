// 秋秋音乐：零依赖 Node 后端
const http = require('node:http');
const { pipeline } = require('node:stream');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const { seed, getSong, mediaUrl, proxyMediaUrl } = require('./src/store');
const views = require('./src/views');
const { ranking, sourcePage, MAX_PAGES } = require('./src/rankings');
const { search } = require('./src/search');
const audioCache = require('./src/audio-cache');
const charts = require('./src/charts');
const { latestRelease } = require('./src/desktop-release');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function send(res, status, body, type = 'text/html; charset=utf-8') {
  if (status >= 400) res.setHeader('Cache-Control', 'no-store');
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

// 静态资源：/projects/source_code/* 映射到 public/；PWA 文件映射到根路径
function serveStatic(req, res, urlPath) {
  const prefix = '/projects/source_code/';
  let rel;
  if (urlPath.startsWith(prefix)) {
    rel = urlPath.slice(prefix.length);
  } else if (urlPath === '/favicon.ico') {
    rel = 'picture/logo.svg';
  } else if (urlPath === '/manifest.webmanifest') {
    rel = 'manifest.webmanifest';
  } else if (urlPath === '/sw.js') {
    rel = 'sw.js';
  } else if (urlPath.startsWith('/icons/')) {
    rel = urlPath.slice(1);
  } else {
    return false;
  }
  const filePath = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^([/\\])+/, ''));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
    return true;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, '<h3>404，您请求的文件不存在!</h3>', 'text/html; charset=utf-8');
      return;
    }
    if (server.desktopToken && path.extname(filePath) === '.css') {
      data = data.toString('utf8').replace(/@import\s+url\(['"]https:\/\/fonts\.googleapis\.com[^;]+;/g, '');
    }
    send(res, 200, data, MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
  });
  return true;
}

// 读取小型 JSON 请求体；超限或解析失败走 onError
function readJsonBody(req, limit, onBody, onError) {
  let body = '';
  req.on('data', chunk => {
    body += chunk;
    if (body.length > limit) req.destroy();
  });
  req.on('end', () => {
    try { onBody(JSON.parse(body || '{}')); } catch { onError(); }
  });
  req.on('error', () => {});
}

const server = http.createServer((req, res) => {
  if (server.desktopToken && req.headers['x-qiuqiu-token'] !== server.desktopToken) {
    return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
  }
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = u.pathname;

  if (p === '/api/desktop-release' || p.startsWith('/download/desktop/')) {
    latestRelease().then(release => {
      res.setHeader('Cache-Control', 'no-store');
      if (p === '/api/desktop-release') return send(res, 200, JSON.stringify(release), 'application/json; charset=utf-8');
      const target = p.slice('/download/desktop/'.length);
      if (!Object.hasOwn(release.downloads, target)) return send(res, 404, 'Installer not available', 'text/plain; charset=utf-8');
      res.writeHead(302, { Location: release.downloads[target] });
      res.end();
    }).catch(() => send(res, 503, 'Download temporarily unavailable', 'text/plain; charset=utf-8'));
    return;
  }

  if (p === '/healthz') {
    send(res, 200, 'ok', 'text/plain; charset=utf-8');
    return;
  }

  // 静态资源
  if (serveStatic(req, res, p)) return;

  // 音频：优先读本地磁盘缓存（一周未命中自动清理），未命中由服务器带 Referer 拉取上游全量落盘，
  // 之后第二次播放直接从磁盘读取，不再访问外网；Range 拖动进度由本地文件切片实现。
  if (p.startsWith('/media/') && p.endsWith('.m4a')) {
    const title = decodeURIComponent(p.slice('/media/'.length, -'.m4a'.length));
    serveAudio(req, res, title);
    return;
  }

  // 播放计数上报：驱动"本站点播榜"
  if (p === '/api/stats/play' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 4096) req.destroy(); });
    req.on('end', () => {
      let ok = false;
      try { const d = JSON.parse(body || '{}'); ok = charts.recordPlay(d.id, d.title); } catch {}
      send(res, ok ? 200 : 400, JSON.stringify({ ok }), 'application/json; charset=utf-8');
    });
    return;
  }

  // 播放清单缓存状态：只读查询，不刷新缓存命中时间
  if (p === '/api/cache/status' && req.method === 'POST') {
    readJsonBody(req, 64 * 1024, body => {
      const titles = Array.isArray(body.titles) ? body.titles.slice(0, 1000) : [];
      const cached = [];
      const downloading = [];
      for (const title of titles) {
        if (typeof title !== 'string' || !title) continue;
        if (audioCache.lookup(title)) cached.push(title);
        else if (inflightAudio.has(title)) downloading.push(title);
      }
      send(res, 200, JSON.stringify({ cached, downloading }), 'application/json; charset=utf-8');
    }, () => send(res, 400, JSON.stringify({ ok: false }), 'application/json; charset=utf-8'));
    return;
  }

  // 清单预缓存：下载完成才响应，前端据此逐首显示缓存进度
  if (p === '/api/cache/prefetch' && req.method === 'POST') {
    readJsonBody(req, 8 * 1024, body => {
      const title = typeof body.title === 'string' ? body.title : '';
      if (!title) {
        send(res, 400, JSON.stringify({ ok: false }), 'application/json; charset=utf-8');
        return;
      }
      prefetchTitle(title)
        .then(cached => send(res, 200, JSON.stringify({ ok: true, cached }), 'application/json; charset=utf-8'))
        .catch(() => send(res, 502, JSON.stringify({ ok: false, cached: false }), 'application/json; charset=utf-8'));
    }, () => send(res, 400, JSON.stringify({ ok: false }), 'application/json; charset=utf-8'));
    return;
  }

  // 排行榜中心：热门/新歌/推荐/本站点播 四张榜单
  if (p === '/charts' || p === '/charts/') {
    Promise.all(['hot', 'new', 'recommend', 'local'].map(kind => charts.chartTop(kind).catch(() => null)))
      .then(list => send(res, 200, views.chartsHubPage(list.filter(Boolean))))
      .catch(() => send(res, 502, '榜单暂时不可用', 'text/plain; charset=utf-8'));
    return;
  }

  // 完整榜单页
  const chartMatch = p.match(/^\/charts\/(hot|new|recommend|local)\/?$/);
  if (chartMatch) {
    const kind = chartMatch[1];
    const page = Number(u.searchParams.get('page') || '1') || 1;
    charts.chartPageData(kind, page)
      .then(data => send(res, 200, views.chartPage(kind, charts.CHARTS[kind], data)))
      .catch(() => send(res, 502, '榜单暂时不可用', 'text/plain; charset=utf-8'));
    return;
  }

  // 下载地址揭示（人机验证通过后调用）
  if (p.startsWith('/api/reveal/') && req.method === 'POST') {
    const id = decodeURIComponent(p.slice('/api/reveal/'.length));
    const song = getSong(id);
    if (!song) {
      send(res, 404, JSON.stringify({ ok: false }), 'application/json; charset=utf-8');
      return;
    }
    const url = proxyMediaUrl(song.title);
    send(res, 200, JSON.stringify({
      ok: true,
      links: [
        { label: `${song.title}.m4a（高品质外链）`, url },
        { label: `${song.title} MP3 下载地址`, url },
      ],
    }), 'application/json; charset=utf-8');
    return;
  }

  // 推荐榜与热门榜：按需抓取，磁盘缓存，最多展示 5000 首
  const rankMatch = p.match(/^\/ranking\/(recommend|hot)\/?$/);
  if (rankMatch || p === '/viewmor.html' || p === '/down.html') {
    const kind = rankMatch ? rankMatch[1] : 'hot';
    const page = Number(u.searchParams.get('page') || '1');
    ranking(kind, page).then(data => send(res, 200, views.rankingPage(data)))
      .catch(() => send(res, 502, '榜单暂时不可用', 'text/plain; charset=utf-8'));
    return;
  }

  // 搜索
  if (p === '/search.php') {
    const q = (u.searchParams.get('q') || '').trim();
    const page = Number(u.searchParams.get('page') || '1') || 1;
    if (!q) {
      res.writeHead(302, { Location: '/' });
      res.end();
      return;
    }
    search(q, page).then(results => send(res, 200, views.searchPage(q, results)))
      .catch(() => send(res, 502, '搜索暂时不可用', 'text/plain; charset=utf-8'));
    return;
  }

  // 歌曲详情
  const m = p.match(/^\/library\/(\d+)\.html$/);
  if (m) {
    const song = getSong(m[1]);
    if (!song) {
      send(res, 404, notFoundPage(), 'text/html; charset=utf-8');
      return;
    }
    send(res, 200, views.songPage(song));
    return;
  }

  if (p === '/' || p === '/index.html') {
    // Desktop starts immediately from the bundled catalogue, even offline.
    if (server.desktopToken) return send(res, 200, views.homePage());
    // 首页区块接入实时数据（6 小时缓存），失败回退本地种子
    Promise.all([
      sourcePage(1).catch(() => null),
      ranking('recommend', 1).catch(() => null),
      ranking('hot', 1).catch(() => null),
    ]).then(([latest, recommend, hot]) => {
      send(res, 200, views.homePage({
        latest: latest && latest.items,
        recommend: recommend && recommend.items,
        hot: hot && hot.items,
      }));
    });
    return;
  }
  if (p === '/navigation/1/' || p === '/navigation/1') {
    // 最近更新：每页 20 首 = 源站 2 页（各 10 首），分页与榜单一致
    const page = Math.max(1, Math.min(MAX_PAGES, Number(u.searchParams.get('page') || '1') || 1));
    const sourcePages = page === 1
      ? [sourcePage(1), Promise.resolve({ items: seed.nav1.slice(0, 10) })]
      : [sourcePage(2 * page - 2), sourcePage(2 * page - 1)];
    Promise.all(sourcePages.map(promise => promise.catch(() => ({ items: [] })))).then(results => {
      const items = [];
      const seen = new Set();
      for (const result of results) {
        for (const song of result.items) {
          if (!seen.has(String(song.id))) { items.push(song); seen.add(String(song.id)); }
        }
      }
      send(res, 200, views.recentPage(items, page, MAX_PAGES));
    });
    return;
  }
  if (p === '/navigation/2/' || p === '/navigation/2') {
    send(res, 200, views.collectionsPage());
    return;
  }
  if (p === '/my-music' || p === '/my-music/') {
    send(res, 200, views.myMusicPage());
    return;
  }
  if (p === '/hotsgr.html') {
    send(res, 200, views.artistsPage());
    return;
  }
  if (p === '/keyword.html') {
    send(res, 200, views.keywordsPage());
    return;
  }
  send(res, 404, notFoundPage(), 'text/html; charset=utf-8');
});

function notFoundPage() {
  return '<!doctype html><html><head><meta charset="utf-8"><title>404</title><style>body{background-color:#444;font-size:14px}h3{font-size:60px;color:#eee;text-align:center;padding-top:30px;font-weight:normal}</style></head><body><h3>404，您请求的文件不存在!</h3></body></html>';
}

// ---------- 音频缓存服务 ----------

const AUDIO_CACHE_CONTROL = 'public, max-age=2592000'; // 30 天 HTTP 缓存，配合 SW 离线可用
const inflightAudio = new Map(); // 同一首歌并发请求去重，只拉一次上游

// 解析 Range 头；非法时返回 'invalid'，无 Range 返回 null
function parseRange(header, size) {
  if (!header) return null;
  const m = String(header).match(/^bytes=(\d*)-(\d*)$/);
  if (!m || (m[1] === '' && m[2] === '')) return 'invalid';
  let start;
  let end;
  if (m[1] === '') {
    const suffix = Number(m[2]);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return 'invalid';
  return { start, end };
}

// 从磁盘文件响应（支持 Range 切片）
function serveAudioFromDisk(req, res, filePath, stat) {
  const size = stat.size;
  const base = {
    'Content-Type': 'audio/x-m4a',
    'Accept-Ranges': 'bytes',
    'Cache-Control': AUDIO_CACHE_CONTROL,
  };
  const parsed = parseRange(req.headers.range, size);
  if (parsed === 'invalid') {
    res.writeHead(416, { 'Content-Range': `bytes */${size}` });
    res.end();
    return;
  }
  if (parsed) {
    res.writeHead(206, {
      ...base,
      'Content-Range': `bytes ${parsed.start}-${parsed.end}/${size}`,
      'Content-Length': parsed.end - parsed.start + 1,
    });
    pipeAudioFile(filePath, res, { start: parsed.start, end: parsed.end });
  } else {
    res.writeHead(200, { ...base, 'Content-Length': size });
    pipeAudioFile(filePath, res);
  }
}

function pipeAudioFile(filePath, res, options) {
  const input = fs.createReadStream(filePath, options);
  input.on('error', () => res.destroy());
  res.once('close', () => input.destroy());
  input.pipe(res);
}

// A failed/aborted upstream response must never become an unhandled stream
// error in Electron's main process, or leave a pending download forever.
function fetchAudioToDisk(title) {
  return new Promise((resolve, reject) => {
    const finalPath = audioCache.filePathFor(title);
    const tmpPath = `${finalPath}.part`;
    let settled = false, responseStream, deadline;
    const finish = (error, ok = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      if (error) reject(error); else resolve(ok);
    };
    const upstream = https.get(mediaUrl(title), {
      headers: { Referer: 'https://myfreemp3ku.com/', 'User-Agent': 'Mozilla/5.0' },
      timeout: 30000,
    }, up => {
      const isFull = up.statusCode === 200
        || (up.statusCode === 206 && /^bytes 0-/.test(up.headers['content-range'] || ''));
      // Even error responses can emit a stream error after resume().
      up.on('error', error => { if (!isFull) finish(error); });
      if (!isFull) { up.resume(); finish(null, false); return; }
      responseStream = up;
      pipeline(up, fs.createWriteStream(tmpPath), error => {
        if (error) {
          fs.rm(tmpPath, { force: true }, () => finish(error));
          return;
        }
        fs.rename(tmpPath, finalPath, renameError => {
          if (renameError) fs.rm(tmpPath, { force: true }, () => finish(renameError));
          else { audioCache.cleanup(); finish(null, true); }
        });
      });
    });
    const abort = error => {
      if (responseStream) responseStream.destroy(error);
      else finish(error);
    };
    upstream.on('timeout', () => upstream.destroy(new Error('upstream timeout')));
    upstream.on('error', abort);
    deadline = setTimeout(() => upstream.destroy(new Error('upstream deadline exceeded')), 60000);
    deadline.unref();
  });
}

// 单首预缓存：命中直接返回；并发请求复用同一下载
function prefetchTitle(title) {
  if (audioCache.lookup(title)) return Promise.resolve(true);
  let pending = inflightAudio.get(title);
  if (!pending) {
    pending = fetchAudioToDisk(title).finally(() => inflightAudio.delete(title));
    inflightAudio.set(title, pending);
  }
  return pending;
}

function serveAudio(req, res, title) {
  audioCache.ensureDir();
  const cachedStat = audioCache.statFile(title);
  if (cachedStat) {
    serveAudioFromDisk(req, res, audioCache.filePathFor(title), cachedStat);
    return;
  }
  prefetchTitle(title).then(ok => {
    const stat = ok ? audioCache.statFile(title) : null;
    if (stat) serveAudioFromDisk(req, res, audioCache.filePathFor(title), stat);
    else send(res, 404, 'Not Found', 'text/plain; charset=utf-8'); // 上游没有这首，与原站行为一致
  }).catch(() => {
    if (!res.headersSent) send(res, 502, 'Bad Gateway', 'text/plain; charset=utf-8');
    else res.end();
  });
}

function startServer({ port = PORT, host = '0.0.0.0', token } = {}) {
  server.desktopToken = token;
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      resolve(server);
    });
  });
}

if (require.main === module) {
  startServer().then(() => console.log(`秋秋音乐已启动: http://localhost:${PORT}`))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { startServer };
