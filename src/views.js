const { seed, getSong, proxyMediaUrl } = require('./store');

const SITE = '秋秋音乐';
const ASSET_VERSION = '20261021-install-restore';
function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function icon(name) {
  const paths = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/>',
    play: '<path d="m8 5 11 7-11 7z"/>',
    flame: '<path d="M12 22c4.4 0 7-3.3 7-7.3 0-3-1.7-5.4-4.5-7.8.2 3-1.3 4-2.3 4.3.7-3.7-.6-6.5-3.7-9.2.3 3.8-1.5 5.8-3.1 8C4.5 11.3 5 12.7 5 14.7 5 18.7 7.7 22 12 22z"/>',
    spark: '<path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8zM19 17l.6 1.4L21 19l-1.4.6L19 21l-.6-1.4L17 19l1.4-.6z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    arrow: '<path d="m9 5 7 7-7 7"/>',
    note: '<path d="M9 18V5l10-2v13M9 8l10-2"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
    music: '<path fill="currentColor" stroke="none" d="M18 3.2a1 1 0 0 1 1.2 1v11.2a3.6 3.6 0 1 1-2-3.2V7.1l-6 1.3v9a3.6 3.6 0 1 1-2-3.2V6.8a1 1 0 0 1 .8-1z"/>',
    vinylNote: '<path fill="currentColor" stroke="none" d="M12 3v12.55A4 4 0 1 0 14 19V7h6V3h-8z"/>',
    minimize: '<path d="m6 10 6 6 6-6"/><path d="M5 20h14"/>',
    headphones: '<path d="M3 14v-3a9 9 0 0 1 18 0v3M3 14h3v6H4a1 1 0 0 1-1-1v-5Zm18 0h-3v6h2a1 1 0 0 0 1-1v-5Z"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    download: '<path d="M12 3v12m-4-4 4 4 4-4M5 17v3h14v-3"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    sequence: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    repeat: '<path d="m17 2 3 3-3 3M20 5H7a4 4 0 0 0-4 4v2m4 11-3-3 3-3m-3 3h13a4 4 0 0 0 4-4v-2"/>',
  };
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.note}</svg>`;
}
function songLink(song, label) {
  return `<a class="song-link" href="/library/${esc(song.id)}.html" data-play-id="${esc(song.id)}" data-play-title="${esc(song.title)}" title="播放 ${esc(song.title)}">${label || esc(song.title)}</a>`;
}
function pageHead(title, description = '听见喜欢的声音。秋秋音乐，发现与分享好音乐。') {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#f1f8f5"><meta name="description" content="${esc(description)}"><meta name="keywords" content="秋秋音乐,qiuqiumusic,在线音乐,音乐播放"><title>${esc(title)} · ${SITE}</title><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="秋秋音乐"><meta name="apple-mobile-web-app-status-bar-style" content="default"><link rel="icon" href="/projects/source_code/picture/logo.svg" type="image/svg+xml"><script>try{document.documentElement.dataset.theme=localStorage.getItem('qiuqiumusic.theme')||'mint'}catch{}</script><link rel="stylesheet" href="/projects/source_code/css/site.css?v=${ASSET_VERSION}"><script src="/projects/source_code/js/desktop-download.js?v=${ASSET_VERSION}" defer></script><script src="/projects/source_code/js/desktop-update.js?v=${ASSET_VERSION}" defer></script><script src="/projects/source_code/js/app.js?v=${ASSET_VERSION}" defer></script></head><body>`;
}
function nav(active = '') {
  const links = [['/', '发现'], ['/charts', '排行榜'], ['/navigation/1/', '最近更新'], ['/navigation/2/', '歌单'], ['/hotsgr.html', '歌手'], ['/keyword.html', '热搜'], ['/my-music', '我的音乐']];
  return `<header class="site-header"><div class="shell nav-shell"><a class="brand" href="/" aria-label="秋秋音乐首页"><img src="/projects/source_code/picture/logo.svg" alt="" width="44" height="44"><span><strong>秋秋音乐</strong><small>qiuqiumusic</small></span></a><nav class="main-nav" aria-label="主导航">${links.map(([url, text]) => `<a href="${url}" class="${active === url ? 'active' : ''}">${text}</a>`).join('')}</nav><button id="nav-scroll-next" class="nav-scroll-next" type="button" aria-label="向右查看更多导航">${icon('arrow')}</button><div class="header-actions"><div class="desktop-download-wrap" hidden><a id="desktop-download" aria-label="下载桌面版" class="desktop-download-button" href="https://github.com/kevinq888/qiuqiumusic/releases/latest" data-desktop-package hidden aria-controls="desktop-download-choices" aria-expanded="false">${icon('download')}<span class="download-label">下载桌面版</span></a><div id="desktop-download-choices" class="desktop-download-choices" hidden><strong>选择你的 Mac 芯片</strong><a href="/download/desktop/macos-arm64" data-desktop-package>Apple 芯片 <small>M1 / M2 / M3 / M4 / M5</small></a><a href="/download/desktop/macos-x64" data-desktop-package>Intel 芯片 <small>Intel Mac</small></a><p>下载后双击打开安装包，按提示完成安装。</p></div></div><button class="install-button" id="install-app" type="button" aria-label="保存秋秋音乐链接">${icon('save')}<span>保存链接</span></button><div class="theme-picker"><button class="theme-trigger" id="theme-mobile-trigger" type="button" aria-label="切换皮肤" aria-haspopup="dialog" aria-expanded="false"><span class="theme-trigger-mark" aria-hidden="true">◐</span><span id="theme-mobile-label">薄荷绿</span></button></div></div></div></header>`;
}
function searchForm(q = '') {
  return `<form class="search-form" action="/search.php" method="get" role="search"><label class="sr-only" for="song-search">搜索歌曲或歌手</label>${icon('search')}<input id="song-search" name="q" type="search" value="${esc(q)}" placeholder="搜索歌曲、歌手，开启好心情" required><button type="submit">搜索音乐 ${icon('arrow')}</button></form>`;
}
function searchIntro(title, description, query = '', notice = '') {
  return `<div class="page-intro search-intro"><div class="search-intro-form">${searchForm(query)}</div><h1>${title}</h1><p>${description}</p>${notice}</div>`;
}
function footer() {
  return `<footer class="site-footer"><div class="shell footer-content footer-simple"><span class="footer-copy">© ${new Date().getFullYear()} qiuqiumusic</span><span class="footer-tagline">秋秋音乐，让每一次播放，都刚好合你心意。</span></div></footer>`;
}
function player() {
  return `<aside class="player-host" id="site-player" aria-label="音乐播放器"><button class="vinyl-toggle" id="player-toggle" type="button" aria-label="展开播放器" aria-expanded="false"><span class="vinyl-disc"><span class="vinyl-label">${icon('vinylNote')}</span></span></button><section class="player-panel" id="player-panel" aria-label="当前播放" hidden><div class="player-panel-head"><div><small>秋秋音乐 · <span id="player-state">待命中</span></small><h2 id="player-title">选择一首歌</h2></div><button id="player-collapse" class="icon-button" type="button" aria-label="收起播放器">${icon('minimize')}</button></div><audio id="player-audio" preload="none" aria-hidden="true" tabindex="-1"></audio><div class="player-timeline" id="player-timeline"><span id="player-current-time">0:00</span><input id="player-seek" type="range" min="0" max="0" step="0.1" value="0" aria-label="播放进度" disabled><span id="player-duration">--:--</span></div><div class="player-remote-progress" id="player-remote-progress" hidden><span id="player-remote-time">0:00 / --:--</span><progress id="player-remote-bar" max="1" value="0" aria-label="另一标签页的播放进度"></progress></div><div class="player-actions"><div class="player-transport"><button id="player-prev" type="button" aria-label="上一首" disabled>⏮</button><button id="player-play-pause" type="button" aria-label="播放或暂停" disabled>⏯</button><button id="player-next" type="button" aria-label="下一首" disabled>⏭</button></div><div class="player-options"><button id="player-mode" class="mode-button" type="button" data-mode="sequence" aria-label="播放模式：顺序播放，点击切换" title="顺序播放"><span class="mode-icon mode-sequence">${icon('sequence')}</span><span class="mode-icon mode-repeat">${icon('repeat')}</span><span class="mode-icon mode-one">${icon('repeat')}<b>1</b></span><span class="mode-label">顺序播放</span></button><button id="player-favorite" type="button" aria-label="收藏当前歌曲" disabled>${icon('heart')}</button><button id="player-queue" type="button" aria-label="播放清单" aria-controls="queue-panel" aria-expanded="false">${icon('note')} <span id="queue-count">0</span></button></div></div></section><button id="player-collapse-desktop" class="player-collapse-desktop" type="button" aria-label="最小化播放器">${icon('minimize')}</button><section class="queue-panel" id="queue-panel" aria-label="播放清单" hidden><div class="queue-head"><div><small>我的歌单 <b id="queue-cache-summary" class="queue-cache-summary" hidden>已缓存 0/0</b></small><h2>播放清单</h2></div><button id="queue-close" class="icon-button" type="button" aria-label="关闭播放清单">×</button></div><div id="queue-items" class="queue-items"></div><p class="queue-note">加入清单后自动逐首缓存，一周未播放的曲目会自动清理。</p></section></aside>`;
}
function loadingOverlay() {
  return `<div class="route-loading" id="route-loading" role="status" aria-live="polite" aria-label="正在加载" hidden><div class="route-loading-card"><span class="route-loading-record" aria-hidden="true"><span>${icon('music')}</span></span><strong class="route-loading-text">正在加载，请稍候…</strong><small>好音乐，马上就来</small></div></div>`;
}
function installDialog() {
  return `<div class="install-dialog" id="install-dialog" hidden><div class="install-backdrop" data-install-close></div><section class="install-card" role="dialog" aria-modal="true" aria-labelledby="install-title" aria-describedby="install-instructions"><button class="install-close" type="button" data-install-close aria-label="关闭">×</button><div class="install-card-icon"><img src="/icons/icon-192.png" alt=""></div><span class="eyebrow">随时打开秋秋音乐</span><h2 id="install-title">保存秋秋音乐链接</h2><p id="install-instructions"></p><div class="install-actions"><button class="install-copy-link" id="install-copy-link" type="button" hidden>复制网站链接</button><button class="install-done" type="button" data-install-close>知道了</button></div></section></div>`;
}
function themeSheet() {
  const choices = [['mint', '薄荷绿', '#58b79d'], ['sky', '晴空蓝', '#70b1df'], ['lilac', '晨雾紫', '#a890ce'], ['sunset', '日落橙', '#e99b69'], ['sakura', '樱花粉', '#e796ae'], ['dark', '暗夜黑', '#19352d']];
  return `<div class="theme-sheet" id="theme-sheet" hidden><button class="theme-sheet-backdrop" type="button" data-theme-close aria-label="关闭皮肤选择"></button><section class="theme-sheet-card" role="dialog" aria-modal="true" aria-labelledby="theme-sheet-title"><div class="theme-sheet-head"><div><small>挑选喜欢的色彩</small><h2 id="theme-sheet-title">切换皮肤</h2></div><button class="theme-sheet-close" type="button" data-theme-close aria-label="关闭">×</button></div><div class="theme-choices">${choices.map(([value, label, color]) => `<button class="theme-choice" type="button" data-theme-choice="${value}" style="--theme-swatch:${color}" aria-pressed="false"><span class="theme-swatch" aria-hidden="true"></span><span>${label}</span><span class="theme-check" aria-hidden="true">✓</span></button>`).join('')}</div></section></div>`;
}
function layout(title, body, active = '', description) {
  return `${pageHead(title, description)}${nav(active)}<main class="shell main-content">${body}</main>${footer()}${player()}${loadingOverlay()}${installDialog()}${themeSheet()}</body></html>`;
}
function section(title, eyebrow, content, more, iconName = 'spark', className = '', action = '') {
  return `<section class="panel ${className}"><div class="panel-heading"><div class="heading-icon">${icon(iconName)}</div><div><span class="eyebrow">${esc(eyebrow)}</span><h2>${esc(title)}</h2></div>${action}${more ? `<a class="more-link" href="${more}">查看更多 ${icon('arrow')}</a>` : ''}</div>${content}</section>`;
}
function trendBadge(value) {
  if (value === 'new' || value === undefined) return '<span class="trend-badge trend-new">NEW</span>';
  if (value > 0) return `<span class="trend-badge trend-up">▲${value}</span>`;
  if (value < 0) return `<span class="trend-badge trend-down">▼${-value}</span>`;
  return '<span class="trend-badge trend-same">—</span>';
}
function rankClass(n) {
  return n === 1 ? 'rank-gold' : n === 2 ? 'rank-silver' : n === 3 ? 'rank-bronze' : '';
}
function songRows(items, start = 1, { date = false, trend = null, plays = false } = {}) {
  return `<div class="song-list">${items.map((song, index) => {
    const n = start + index;
    const medal = trend ? rankClass(n) : (index < 3 && start === 1 ? 'top-rank' : '');
    return `<div class="song-row"><span class="song-rank ${medal}">${String(n).padStart(2, '0')}</span>${trend ? trendBadge(trend.get(String(song.id))) : ''}<div class="song-main">${songLink(song)}<small>${esc(song.artist || song.title.split('-')[0] || '秋秋音乐')}</small></div>${plays && song.plays ? `<span class="song-plays">${song.plays} 次点播</span>` : ''}${date && song.date ? `<span class="song-date">${esc(song.date)}</span>` : ''}<button class="song-action favorite-button" type="button" data-favorite-id="${esc(song.id)}" data-song-title="${esc(song.title)}" aria-label="收藏 ${esc(song.title)}">${icon('heart')}</button><button class="song-action add-button" type="button" data-add-id="${esc(song.id)}" data-song-title="${esc(song.title)}" aria-label="加入播放清单 ${esc(song.title)}">${icon('plus')}</button><button class="play-button" type="button" data-play-id="${esc(song.id)}" data-play-title="${esc(song.title)}" aria-label="播放 ${esc(song.title)}">${icon('play')}</button></div>`;
  }).join('')}</div>`;
}
function bulkAction(items) {
  return items.length ? `<button class="add-all-button" type="button" data-add-page aria-live="polite" aria-label="一键将本页 ${items.length} 首歌曲加入播放清单"><span class="add-all-icon">${icon('plus')}</span><span class="add-all-text">一键加入歌单</span><span class="add-all-count">${items.length} 首</span></button>` : '';
}
function homePage(live = {}) {
  const hot = seed.hot_tags.slice(0, 16).map(song => `<a href="/library/${esc(song.id)}.html" class="mood-tag" data-play-id="${esc(song.id)}" data-play-title="${esc(song.title)}">${esc(song.title)}</a>`).join('');
  const intro = `<section class="hero"><div class="hero-copy"><span class="hero-kicker">每日好音乐 <span>✦</span></span><h1>让喜欢的音乐，<br><em>刚好遇见你。</em></h1><p>从此刻的心情出发，听一首属于今天的歌。</p>${searchForm()}<div class="hero-notes"><span>${icon('headphones')} 随时在线聆听</span><span>${icon('spark')} 每日发现新声</span></div></div><div class="hero-graphic" aria-hidden="true"><div class="disc"><div class="disc-inner"><img src="/projects/source_code/picture/logo.svg" alt=""></div></div><span class="float-note note-one">♫</span><span class="float-note note-two">♪</span><span class="graphic-caption">听见此刻的喜欢。</span></div></section>`;
  const featured = section('此刻热门', '此刻流行', `<div class="mood-tags">${hot}</div>`, '/viewmor.html', 'flame', 'trending-panel');
  const latestItems = live.latest?.length ? live.latest : seed.nav1;
  const recItems = live.recommend?.length ? live.recommend : seed.rank_recommend;
  const hotItems = live.hot?.length ? live.hot : seed.rank_hot;
  // 各区块之间去重：源站同一首歌可能存在多个条目，按标题去重更符合浏览观感
  const seen = new Set();
  const dedup = list => list.filter(song => !seen.has(song.title) && seen.add(song.title));
  const latest = section('最近更新', '新歌上架', songRows(dedup(latestItems).slice(0, 8), 1, { date: true }), '/navigation/1/', 'clock');
  const rec = section('推荐歌曲', '为你推荐', songRows(dedup(recItems).slice(0, 6)), '/ranking/recommend', 'spark');
  const popular = section('热门歌曲', '热门点播', songRows(dedup(hotItems).slice(0, 6)), '/ranking/hot', 'flame');
  // 热歌与新歌板块靠前，方便打开首页先看到；标签云与推荐随后。
  return layout('发现好音乐', `${intro}<div class="home-grid">${popular}${latest}</div><div class="home-grid ranking-grid">${featured}${rec}</div>`, '/');
}
function pager(base, page, pages) {
  if (pages <= 1) return '';
  const window = new Set([1, pages]);
  for (let n = Math.max(1, page - 2); n <= Math.min(pages, page + 2); n++) window.add(n);
  const numbers = [...window].sort((a, b) => a - b);
  let previous = 0;
  const items = [];
  for (const n of numbers) {
    if (n - previous > 1) items.push('<span class="pager-ellipsis">…</span>');
    items.push(n === page ? `<span class="current" aria-current="page">${n}</span>` : `<a href="${base}${base.includes('?') ? '&' : '?'}page=${n}">${n}</a>`);
    previous = n;
  }
  return `<nav class="pager" aria-label="分页"><a class="${page <= 1 ? 'disabled' : ''}" href="${base}${base.includes('?') ? '&' : '?'}page=${Math.max(1, page - 1)}">上一页</a>${items.join('')}<a class="${page >= pages ? 'disabled' : ''}" href="${base}${base.includes('?') ? '&' : '?'}page=${Math.min(pages, page + 1)}">下一页</a></nav>`;
}
function rankingPage(data) {
  const recommend = data.kind === 'recommend';
  const title = recommend ? '推荐歌曲 · 5000 首' : '热门歌曲 · 5000 首';
  const note = data.stale ? '当前展示本地缓存；源站暂时不可用或更新中。' : '访问时检查本地缓存，缓存有效期为 6 小时。';
  const description = `前 10 首沿用${recommend ? '推荐' : '热门'}榜单，后续曲目取自实时更新的歌曲列表。${note}`;
  const content = `<div class="page-intro"><span class="eyebrow">精选曲库</span><h1>${title}</h1><p>${description}</p></div>${section(`第 ${data.page} / ${data.pages} 页`, '每页 20 首', data.items.length ? songRows(data.items, (data.page - 1) * 20 + 1) : `<div class="empty-state">这页暂时无法从源站获取曲目，请稍后重试。</div>`, null, recommend ? 'spark' : 'flame', 'bulk-panel', bulkAction(data.items))}${pager(recommend ? '/ranking/recommend' : '/ranking/hot', data.page, data.pages)}`;
  return layout(title, content, recommend ? '/ranking/recommend' : '/ranking/hot');
}
function searchPage(query, results) {
  const { items, page, hasNext, source, stale } = results;
  const notice = stale ? `<p class="search-notice">${source === 'cached' ? '在线搜索暂时不可用，当前展示上次缓存的搜索结果。' : '在线搜索暂时不可用，当前仅显示本地已有歌曲。'}</p>` : '';
  const base = `/search.php?q=${encodeURIComponent(query)}`;
  const pageNav = page > 1 || hasNext ? `<nav class="pager" aria-label="搜索分页">${page > 1 ? `<a href="${base}&page=${page - 1}">上一页</a>` : ''}<span class="current" aria-current="page">第 ${page} 页</span>${hasNext ? `<a href="${base}&page=${page + 1}">下一页</a>` : ''}</nav>` : '';
  const description = source === 'local' && !items.length ? `“${esc(query)}”暂未找到歌曲` : `“${esc(query)}”本页找到 ${items.length} 首歌曲`;
  return layout(`搜索 ${query}`, `${searchIntro('搜索结果', description, query, notice)}${section('歌曲', '搜索结果', items.length ? songRows(items, (page - 1) * 20 + 1) : '<div class="empty-state">没有找到相关歌曲，换个关键词试试。</div>', null, 'search', 'bulk-panel', bulkAction(items))}${pageNav}`);
}
function songPage(song) {
  const { title, artist, cover, lyrics } = song;
  const coverHtml = cover ? `<img class="detail-cover" src="${esc(cover)}" alt="${esc(title)} 封面" loading="lazy">` : `<div class="detail-cover placeholder">${icon('note')}</div>`;
  return layout(title, `<div class="page-intro"><span class="eyebrow">歌曲详情</span><h1>${esc(title)}</h1><p>${esc(artist || '秋秋音乐')}</p></div><section class="panel song-detail"><div class="detail-top">${coverHtml}<div class="detail-copy"><span class="eyebrow">好歌分享</span><h2>${esc(title)}</h2><p>${esc(artist || '音乐让此刻更动听')}</p><div class="detail-actions"><button class="primary-action" type="button" data-play-id="${esc(song.id)}" data-play-title="${esc(title)}">${icon('play')} 立即播放</button><button class="secondary-action favorite-button" type="button" data-favorite-id="${esc(song.id)}" data-song-title="${esc(title)}">${icon('heart')} 收藏</button><button class="secondary-action" type="button" data-add-id="${esc(song.id)}" data-song-title="${esc(title)}">${icon('plus')} 加入播放清单</button></div></div></div>${lyrics ? `<details class="lyrics"><summary>查看歌词</summary><p>${esc(lyrics)}</p></details>` : ''}<a class="detail-download" href="${esc(proxyMediaUrl(title))}" download>下载音频文件</a></section>${section('继续听', '听完再听', songRows(seed.rank_hot.slice(0, 6)), '/ranking/hot', 'spark')}`);
}
function myMusicPage() {
  return layout('我的音乐', `<div class="page-intro"><span class="eyebrow">专属音乐空间</span><h1>我的音乐</h1><p>收藏与播放清单保存在当前浏览器，未来可与微信账号同步。</p></div><div class="home-grid personal-grid">${section('我的收藏', '我的收藏', '<div id="favorites-list" class="personal-list"></div>', null, 'heart')}${section('播放清单', '我的播放清单', '<div id="playlist-list" class="personal-list"></div>', null, 'note')}</div>`, '/my-music');
}
function listPage(title, eyebrow, items, more = null, withBulk = false) {
  return layout(title, `${searchIntro(esc(title), '喜欢的声音，就从这里开始。')}${section(title, eyebrow, songRows(items), more, 'note', withBulk ? 'bulk-panel' : '', withBulk ? bulkAction(items) : '')}`);
}
function recentPage(items, page = 1, pages = 1) {
  const content = `${section(`第 ${page} / ${pages} 页`, '最新收录', items.length ? songRows(items, (page - 1) * 20 + 1, { date: true }) : '<div class="empty-state">这页暂时无法获取，请稍后重试。</div>', null, 'clock', 'bulk-panel', bulkAction(items))}${pager('/navigation/1/', page, pages)}`;
  return layout('最近更新', `${searchIntro('最近更新', '实时同步最新上架的歌曲，每 6 小时刷新缓存。')}${content}`, '/navigation/1/');
}
function viewmorPage(data) { return data ? rankingPage(data) : listPage('此刻热门', '此刻流行', seed.viewmor, '/ranking/hot'); }
function downPage(data) { return data ? rankingPage(data) : listPage('热门歌曲', '热门点播', seed.down, '/ranking/hot'); }
// 排行榜中心：四张榜单卡片，榜首大卡片 + Top 5 预览 + 走势徽章
function chartsHubPage(charts) {
  const cards = charts.map(chart => {
    const top5 = chart.items.slice(0, 5);
    const list = top5.length ? `<div class="chart-card-list">${top5.map((song, i) => {
      const n = i + 1;
      const badge = trendBadge(chart.trend && chart.trend.get(String(song.id)));
      if (n === 1) {
        return `<a class="chart-top1" href="/library/${esc(song.id)}.html" data-play-id="${esc(song.id)}" data-play-title="${esc(song.title)}" title="播放 ${esc(song.title)}"><span class="rank-badge rank-gold">1</span><span class="chart-top1-info"><strong>${esc(song.title)}</strong><small>${esc(song.artist || song.title.split('-')[0] || '秋秋音乐')}${chart.plays && song.plays ? ` · ${song.plays} 次点播` : ''}</small></span>${badge}${icon('play')}</a>`;
      }
      return `<div class="chart-mini-row"><span class="rank-badge ${rankClass(n)}">${n}</span><div class="song-main">${songLink(song)}</div>${badge}<button class="play-button" type="button" data-play-id="${esc(song.id)}" data-play-title="${esc(song.title)}" aria-label="播放 ${esc(song.title)}">${icon('play')}</button></div>`;
    }).join('')}</div>` : '<div class="empty-state">榜单数据暂时不可用，稍后刷新试试。</div>';
    return `<section class="panel chart-card chart-${chart.kind}"><div class="panel-heading"><div class="heading-icon">${icon(chart.def.icon)}</div><div><span class="eyebrow">${esc(chart.def.eyebrow)}</span><h2>${esc(chart.def.name)}</h2></div><a class="more-link" href="/charts/${chart.kind}">完整榜单 ${icon('arrow')}</a></div><p class="chart-desc">${esc(chart.def.description)}</p>${list}</section>`;
  }).join('');
  return layout('排行榜', `${searchIntro('排行榜', '热门、新歌、编辑推荐与本站真实点播，走势每日更新。')}<div class="charts-grid">${cards}</div>`, '/charts');
}
// 完整榜单页：金银铜徽章 + 走势列 + 点播数（本站榜）+ 分页
function chartPage(kind, def, data) {
  const note = data.stale ? ' 源站暂时不可用，当前展示缓存数据。' : '';
  const list = data.items.length
    ? songRows(data.items, (data.page - 1) * 20 + 1, { trend: data.trend, plays: data.plays })
    : `<div class="empty-state">${kind === 'local' ? '还没有点播记录，播放过的歌曲会自动上榜。' : '榜单数据暂时不可用，稍后刷新试试。'}</div>`;
  const content = `${searchIntro(esc(def.name), `${esc(def.description)}${note}`)}${section(`第 ${data.page} / ${data.pages} 页`, def.name, list, '/charts', def.icon, 'bulk-panel', bulkAction(data.items))}${data.pages > 1 ? pager(`/charts/${kind}`, data.page, data.pages) : ''}`;
  return layout(def.name, content, '/charts');
}
function collectionsPage() {
  return layout('精选歌单', `<div class="page-intro"><span class="eyebrow">精选歌单</span><h1>精选歌单</h1><p>按心情收藏你的音乐灵感。</p></div><div class="collection-grid">${seed.collections.map((item, index) => `<article class="collection-card"><span>0${index + 1}</span><h2>${esc(item.title)}</h2><p>发现更多好音乐</p>${songLink(item, `打开歌单 ${icon('arrow')}`)}</article>`).join('')}</div>`, '/navigation/2/');
}
function artistsPage() {
  return layout('人气歌手', `${searchIntro('人气歌手', '从熟悉的名字，找到下一首喜欢的歌。')}<div class="artist-grid">${seed.artists.map((artist, i) => `<a href="/search.php?q=${encodeURIComponent(artist)}" class="artist-card"><span>${String(i + 1).padStart(2, '0')}</span><strong>${esc(artist)}</strong>${icon('arrow')}</a>`).join('')}</div>`, '/hotsgr.html');
}
function keywordsPage() {
  return layout('热门搜索', `${searchIntro('热门搜索', '大家正在听什么？')}<div class="keyword-grid">${seed.keywords.map((word, i) => `<a href="/search.php?q=${encodeURIComponent(word)}"><span>${String(i + 1).padStart(2, '0')}</span>${esc(word)}${icon('arrow')}</a>`).join('')}</div>`, '/keyword.html');
}
module.exports = { homePage, rankingPage, searchPage, songPage, myMusicPage, collectionsPage, artistsPage, keywordsPage, recentPage, viewmorPage, downPage, chartsHubPage, chartPage };
