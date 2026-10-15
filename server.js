// 秋秋音乐：零依赖 Node 后端
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const { seed, getSong, mediaUrl, proxyMediaUrl } = require('./src/store');
const views = require('./src/views');
const { ranking, sourcePage, MAX_PAGES } = require('./src/rankings');
const { search } = require('./src/search');

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
    send(res, 200, data, MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
  });
  return true;
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = u.pathname;

  if (p === '/healthz') {
    send(res, 200, 'ok', 'text/plain; charset=utf-8');
    return;
  }

  // 静态资源
  if (serveStatic(req, res, p)) return;

  // 音频代理：CDN 校验 Referer，浏览器直连 403，由服务器带 Referer 转发（支持 Range 拖动进度）
  if (p.startsWith('/media/') && p.endsWith('.m4a')) {
    const title = decodeURIComponent(p.slice('/media/'.length, -'.m4a'.length));
    const headers = {
      Referer: 'https://myfreemp3ku.com/',
      'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0',
    };
    if (req.headers.range) headers.Range = req.headers.range;
    const upstream = https.get(mediaUrl(title), { headers }, (up) => {
      const h = {
        'Content-Type': up.headers['content-type'] || 'audio/x-m4a',
        'Accept-Ranges': 'bytes',
      };
      if (up.headers['content-length']) h['Content-Length'] = up.headers['content-length'];
      if (up.headers['content-range']) h['Content-Range'] = up.headers['content-range'];
      res.writeHead(up.statusCode || 502, h);
      up.pipe(res);
    });
    upstream.on('error', () => {
      if (!res.headersSent) send(res, 502, 'Bad Gateway', 'text/plain; charset=utf-8');
      else res.end();
    });
    upstream.setTimeout(30000, () => upstream.destroy(new Error('upstream timeout')));
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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`秋秋音乐已启动: http://localhost:${PORT}`);
});
