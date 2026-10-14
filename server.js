// MyFreeMp3 复刻站：零依赖 Node 后端
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { getSong, mediaUrl, searchSongs } = require('./src/store');
const views = require('./src/views');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

function send(res, status, body, type = 'text/html; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

// 静态资源：/projects/source_code/* 映射到 public/
function serveStatic(req, res, urlPath) {
  const prefix = '/projects/source_code/';
  let rel;
  if (urlPath.startsWith(prefix)) {
    rel = urlPath.slice(prefix.length);
  } else if (urlPath === '/favicon.ico') {
    rel = 'picture/logo.png';
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

  // 静态资源
  if (serveStatic(req, res, p)) return;

  // 下载地址揭示（人机验证通过后调用）
  if (p.startsWith('/api/reveal/') && req.method === 'POST') {
    const id = decodeURIComponent(p.slice('/api/reveal/'.length));
    const song = getSong(id);
    if (!song) {
      send(res, 404, JSON.stringify({ ok: false }), 'application/json; charset=utf-8');
      return;
    }
    const url = mediaUrl(song.title);
    send(res, 200, JSON.stringify({
      ok: true,
      links: [
        { label: `${song.title}.m4a（高品质外链）`, url },
        { label: `${song.title} MP3 下载地址`, url },
      ],
    }), 'application/json; charset=utf-8');
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
    send(res, 200, views.searchPage(q, searchSongs(q), page));
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
    send(res, 200, views.homePage());
    return;
  }
  if (p === '/navigation/1/' || p === '/navigation/1') {
    send(res, 200, views.recentPage());
    return;
  }
  if (p === '/navigation/2/' || p === '/navigation/2') {
    send(res, 200, views.collectionsPage());
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
  if (p === '/viewmor.html') {
    send(res, 200, views.viewmorPage());
    return;
  }
  if (p === '/down.html') {
    send(res, 200, views.downPage());
    return;
  }

  send(res, 404, notFoundPage(), 'text/html; charset=utf-8');
});

function notFoundPage() {
  return '<!doctype html><html><head><meta charset="utf-8"><title>404</title><style>body{background-color:#444;font-size:14px}h3{font-size:60px;color:#eee;text-align:center;padding-top:30px;font-weight:normal}</style></head><body><h3>404，您请求的文件不存在!</h3></body></html>';
}

server.listen(PORT, () => {
  console.log(`MyFreeMp3 复刻站已启动: http://localhost:${PORT}`);
});
