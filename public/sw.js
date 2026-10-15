// 秋秋音乐 Service Worker：静态资源缓存优先，页面网络优先，动态数据与音频直连。
const CACHE = 'qiuqiumusic.v1';
const ASSETS = [
  '/',
  '/projects/source_code/css/site.css',
  '/projects/source_code/js/app.js',
  '/projects/source_code/picture/logo.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.webmanifest',
];

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
  // 实时内容不走缓存：音频流、搜索、榜单、详情揭示接口
  if (url.pathname.startsWith('/media/') || url.pathname.startsWith('/api/') ||
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
