// 秋秋音乐 Service Worker：静态资源缓存优先，页面网络优先；音频 Cache API 缓存（60 天过期），
// 第二次播放直接读本地缓存，不再发起网络请求。
const CACHE = 'qiuqiumusic.v10';
const ASSETS = [
  '/',
  '/projects/source_code/css/site.css?v=20261021-desktop-download',
  '/projects/source_code/js/app.js?v=20261021-desktop-download',
  '/projects/source_code/js/desktop-download.js?v=20261021-desktop-download',
  '/projects/source_code/picture/logo.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.webmanifest',
];
const AUDIO_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 音频缓存有效期：60 天
const AUDIO_MAX_ENTRIES = 300;                 // 音频缓存条目上限，超出按最旧淘汰

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  // 音频：缓存优先，60 天内第二次播放零网络
  if (url.pathname.startsWith('/media/') && url.pathname.endsWith('.m4a')) {
    event.respondWith(handleAudio(request));
    return;
  }
  // 其余实时内容不走缓存：搜索、榜单、详情揭示接口
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/download/desktop/') ||
      url.pathname.startsWith('/ranking/') || url.pathname.startsWith('/search.php')) return;
  // 静态资源：缓存优先
  if (url.pathname.startsWith('/projects/') || url.pathname.startsWith('/icons/') ||
      url.pathname === '/manifest.webmanifest' || url.pathname === '/sw.js') {
    event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy));
      return response;
    })));
    return;
  }
  // 页面导航：网络优先，离线时回退缓存的首页
  event.respondWith(fetch(request).catch(() => caches.match('/')));
});

// ---------- 音频缓存 ----------

async function handleAudio(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request.url);
  if (hit) {
    const cachedAt = Number(hit.headers.get('x-cached-at') || 0);
    if (Date.now() - cachedAt < AUDIO_TTL_MS) return serveAudioBody(request, hit);
    await cache.delete(request.url); // 60 天过期，重新走网络
  }
  let fresh;
  try {
    fresh = await fetch(request.url); // 全量拉取（不带 Range），便于整体缓存
  } catch {
    return new Response(null, { status: 504 });
  }
  if (!fresh || (fresh.status !== 200 && fresh.status !== 206)) return fresh;
  const headers = new Headers();
  headers.set('content-type', fresh.headers.get('content-type') || 'audio/x-m4a');
  headers.set('accept-ranges', 'bytes');
  headers.set('x-cached-at', String(Date.now()));
  const buffer = await fresh.arrayBuffer();
  await trimAudioCache(cache);
  try {
    await cache.put(request.url, new Response(buffer, { status: 200, headers }));
  } catch {} // 存储配额满时忽略，回退网络
  return serveBuffer(request, buffer, headers);
}

// 按缓存中的完整响应回答本次请求（含 Range 切片）
async function serveAudioBody(request, cached) {
  const buffer = await cached.arrayBuffer();
  return serveBuffer(request, buffer, cached.headers);
}

function serveBuffer(request, buffer, headers) {
  const total = buffer.byteLength;
  const out = new Headers();
  out.set('content-type', headers.get('content-type') || 'audio/x-m4a');
  out.set('accept-ranges', 'bytes');
  const range = request.headers.get('range');
  if (!range) {
    out.set('content-length', String(total));
    return new Response(buffer, { status: 200, headers: out });
  }
  const m = range.match(/bytes=(\d*)-(\d*)/);
  let start = 0;
  let end = total - 1;
  if (m && (m[1] !== '' || m[2] !== '')) {
    if (m[1] === '') start = Math.max(0, total - Number(m[2])); // 后缀区间
    else {
      start = Number(m[1]);
      if (m[2] !== '') end = Math.min(Number(m[2]), total - 1);
    }
  }
  if (!m || start > end || start >= total) {
    out.set('content-range', `bytes */${total}`);
    return new Response(null, { status: 416, headers: out });
  }
  const chunk = buffer.slice(start, end + 1);
  out.set('content-range', `bytes ${start}-${end}/${total}`);
  out.set('content-length', String(chunk.byteLength));
  return new Response(chunk, { status: 206, headers: out });
}

// 音频缓存条目超限时按最旧淘汰，避免无限占用设备存储
async function trimAudioCache(cache) {
  const keys = await cache.keys();
  const audioKeys = keys.filter(req => new URL(req.url).pathname.startsWith('/media/'));
  if (audioKeys.length < AUDIO_MAX_ENTRIES) return;
  const entries = await Promise.all(audioKeys.map(async req => {
    const resp = await cache.match(req.url);
    return { url: req.url, at: Number(resp && resp.headers.get('x-cached-at') || 0) };
  }));
  entries.sort((a, b) => a.at - b.at);
  const excess = entries.length - AUDIO_MAX_ENTRIES + 1;
  for (let i = 0; i < excess && i < entries.length; i++) await cache.delete(entries[i].url);
}
