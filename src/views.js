const { seed, getSong, proxyMediaUrl } = require('./store');

const SITE = '秋秋音乐';
const ASSET_VERSION = '20261015-7';
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
    headphones: '<path d="M3 14v-3a9 9 0 0 1 18 0v3M3 14h3v6H4a1 1 0 0 1-1-1v-5Zm18 0h-3v6h2a1 1 0 0 0 1-1v-5Z"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
  };
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.note}</svg>`;
}
function songLink(song, label) {
  return `<a class="song-link" href="/library/${esc(song.id)}.html" data-play-id="${esc(song.id)}" data-play-title="${esc(song.title)}" title="播放 ${esc(song.title)}">${label || esc(song.title)}</a>`;
}
function pageHead(title, description = '听见喜欢的声音。秋秋音乐，发现与分享好音乐。') {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f7f5f0"><meta name="description" content="${esc(description)}"><meta name="keywords" content="秋秋音乐,qiuqiumusic,在线音乐,音乐播放"><title>${esc(title)} · ${SITE}</title><link rel="icon" href="/projects/source_code/picture/logo.svg" type="image/svg+xml"><script>try{document.documentElement.dataset.theme=localStorage.getItem('qiuqiumusic.theme')||'mint'}catch{}</script><link rel="stylesheet" href="/projects/source_code/css/site.css?v=${ASSET_VERSION}"><script src="/projects/source_code/js/app.js?v=${ASSET_VERSION}" defer></script></head><body>`;
}
function nav(active = '') {
  const links = [['/', '发现'], ['/ranking/recommend', '推荐榜'], ['/ranking/hot', '热门榜'], ['/navigation/1/', '最近更新'], ['/navigation/2/', '歌单'], ['/hotsgr.html', '歌手'], ['/keyword.html', '热搜'], ['/my-music', '我的音乐']];
  return `<header class="site-header"><div class="shell nav-shell"><a class="brand" href="/" aria-label="秋秋音乐首页"><img src="/projects/source_code/picture/logo.svg" alt="" width="44" height="44"><span><strong>秋秋音乐</strong><small>qiuqiumusic</small></span></a><nav class="main-nav" aria-label="主导航">${links.map(([url, text]) => `<a href="${url}" class="${active === url ? 'active' : ''}">${text}</a>`).join('')}</nav><div class="theme-picker"><label class="sr-only" for="theme-select">切换皮肤</label><span aria-hidden="true">◐</span><select id="theme-select" aria-label="切换皮肤"><option value="mint">薄荷绿</option><option value="sky">晴空蓝</option><option value="lilac">晨雾紫</option></select></div></div></header>`;
}
function searchForm(q = '') {
  return `<form class="search-form" action="/search.php" method="get" role="search"><label class="sr-only" for="song-search">搜索歌曲或歌手</label>${icon('search')}<input id="song-search" name="q" type="search" value="${esc(q)}" placeholder="搜索歌曲、歌手，开启好心情" required><button type="submit">搜索音乐 ${icon('arrow')}</button></form>`;
}
function footer() {
  return `<footer class="site-footer"><div class="shell footer-content"><div><strong>秋秋音乐</strong><span>听见喜欢的声音。</span></div><p>让每一次播放，都刚好合你心意。<br><small>© ${new Date().getFullYear()} qiuqiumusic</small></p></div></footer>`;
}
function player() {
  return `<aside class="player-host" id="site-player" aria-label="音乐播放器" hidden><button class="vinyl-toggle" id="player-toggle" type="button" aria-label="展开播放器" aria-expanded="false"><span class="vinyl-disc"><span class="vinyl-label">${icon('note')}</span></span><span class="vinyl-eq" aria-hidden="true"><i></i><i></i><i></i></span></button><section class="player-panel" id="player-panel" aria-label="当前播放" hidden><div class="player-panel-head"><div><small>正在播放 · 秋秋音乐</small><h2 id="player-title">选择一首歌</h2><span id="player-state">准备播放</span></div><button id="player-collapse" class="icon-button" type="button" aria-label="收起播放器">⌄</button></div><audio id="player-audio" controls preload="none"></audio><div class="player-actions"><button id="player-prev" type="button" aria-label="上一首">⏮</button><button id="player-play-pause" type="button" aria-label="播放或暂停">⏯</button><button id="player-next" type="button" aria-label="下一首">⏭</button><button id="player-favorite" type="button" aria-label="收藏当前歌曲">${icon('heart')}</button><button id="player-queue" type="button" aria-label="播放清单">${icon('note')} <span id="queue-count">0</span></button><a id="player-detail" href="#">歌曲详情 ${icon('arrow')}</a></div></section><section class="queue-panel" id="queue-panel" aria-label="播放清单" hidden><div class="queue-head"><div><small>我的歌单</small><h2>播放清单</h2></div><button id="queue-close" class="icon-button" type="button" aria-label="关闭播放清单">×</button></div><div id="queue-items" class="queue-items"></div></section></aside>`;
}
function layout(title, body, active = '', description) {
  return `${pageHead(title, description)}${nav(active)}<main class="shell main-content">${body}</main>${footer()}${player()}</body></html>`;
}
function section(title, eyebrow, content, more, iconName = 'spark', className = '', action = '') {
  return `<section class="panel ${className}"><div class="panel-heading"><div class="heading-icon">${icon(iconName)}</div><div><span class="eyebrow">${esc(eyebrow)}</span><h2>${esc(title)}</h2></div>${action}${more ? `<a class="more-link" href="${more}">查看更多 ${icon('arrow')}</a>` : ''}</div>${content}</section>`;
}
function songRows(items, start = 1, { date = false } = {}) {
  return `<div class="song-list">${items.map((song, index) => `<div class="song-row"><span class="song-rank ${index < 3 && start === 1 ? 'top-rank' : ''}">${String(start + index).padStart(2, '0')}</span><div class="song-main">${songLink(song)}<small>${esc(song.artist || song.title.split('-')[0] || '秋秋音乐')}</small></div>${date && song.date ? `<span class="song-date">${esc(song.date)}</span>` : ''}<button class="song-action favorite-button" type="button" data-favorite-id="${esc(song.id)}" data-song-title="${esc(song.title)}" aria-label="收藏 ${esc(song.title)}">${icon('heart')}</button><button class="song-action add-button" type="button" data-add-id="${esc(song.id)}" data-song-title="${esc(song.title)}" aria-label="加入播放清单 ${esc(song.title)}">${icon('plus')}</button><button class="play-button" type="button" data-play-id="${esc(song.id)}" data-play-title="${esc(song.title)}" aria-label="播放 ${esc(song.title)}">${icon('play')}</button></div>`).join('')}</div>`;
}
function bulkAction(items) {
  return items.length ? `<button class="add-all-button" type="button" data-add-page aria-live="polite" aria-label="一键将本页 ${items.length} 首歌曲加入播放清单"><span class="add-all-icon">${icon('plus')}</span><span class="add-all-text">一键加入歌单</span><span class="add-all-count">${items.length} 首</span></button>` : '';
}
function homePage() {
  const hot = seed.hot_tags.slice(0, 16).map(song => `<a href="/library/${esc(song.id)}.html" class="mood-tag" data-play-id="${esc(song.id)}" data-play-title="${esc(song.title)}">${esc(song.title)}</a>`).join('');
  const intro = `<section class="hero"><div class="hero-copy"><span class="hero-kicker">每日好音乐 <span>✦</span></span><h1>让喜欢的音乐，<br><em>刚好遇见你。</em></h1><p>从此刻的心情出发，听一首属于今天的歌。</p>${searchForm()}<div class="hero-notes"><span>${icon('headphones')} 随时在线聆听</span><span>${icon('spark')} 每日发现新声</span></div></div><div class="hero-graphic" aria-hidden="true"><div class="disc"><div class="disc-inner"><img src="/projects/source_code/picture/logo.svg" alt=""></div></div><span class="float-note note-one">♫</span><span class="float-note note-two">♪</span><span class="graphic-caption">听见此刻的喜欢。</span></div></section>`;
  const featured = section('此刻热门', '此刻流行', `<div class="mood-tags">${hot}</div>`, '/viewmor.html', 'flame', 'trending-panel');
  const latest = section('最近更新', '新歌上架', songRows(seed.latest.slice(0, 8), 1, { date: true }), '/navigation/1/', 'clock');
  const rec = section('推荐歌曲', '为你推荐', songRows(seed.rank_recommend.slice(0, 6)), '/ranking/recommend', 'spark');
  const popular = section('热门歌曲', '热门点播', songRows(seed.rank_hot.slice(0, 6)), '/ranking/hot', 'flame');
  return layout('发现好音乐', `${intro}<div class="home-grid">${featured}${latest}</div><div class="home-grid ranking-grid">${rec}${popular}</div>`, '/');
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
  return layout(`搜索 ${query}`, `<div class="page-intro"><span class="eyebrow">FIND YOUR MUSIC</span><h1>搜索结果</h1><p>${description}</p>${notice}${searchForm(query)}</div>${section('歌曲', '搜索结果', items.length ? songRows(items, (page - 1) * 20 + 1) : '<div class="empty-state">没有找到相关歌曲，换个关键词试试。</div>', null, 'search', 'bulk-panel', bulkAction(items))}${pageNav}`);
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
  return layout(title, `<div class="page-intro"><span class="eyebrow">${esc(eyebrow)}</span><h1>${esc(title)}</h1><p>喜欢的声音，就从这里开始。</p>${searchForm()}</div>${section(title, eyebrow, songRows(items), more, 'note', withBulk ? 'bulk-panel' : '', withBulk ? bulkAction(items) : '')}`);
}
function recentPage() { return listPage('最近更新', '最新收录', seed.nav1, null, true); }
function viewmorPage(data) { return data ? rankingPage(data) : listPage('此刻热门', '此刻流行', seed.viewmor, '/ranking/hot'); }
function downPage(data) { return data ? rankingPage(data) : listPage('热门歌曲', '热门点播', seed.down, '/ranking/hot'); }
function collectionsPage() {
  return layout('精选歌单', `<div class="page-intro"><span class="eyebrow">精选歌单</span><h1>精选歌单</h1><p>按心情收藏你的音乐灵感。</p></div><div class="collection-grid">${seed.collections.map((item, index) => `<article class="collection-card"><span>0${index + 1}</span><h2>${esc(item.title)}</h2><p>发现更多好音乐</p>${songLink(item, `打开歌单 ${icon('arrow')}`)}</article>`).join('')}</div>`, '/navigation/2/');
}
function artistsPage() {
  return layout('人气歌手', `<div class="page-intro"><span class="eyebrow">人气歌手</span><h1>人气歌手</h1><p>从熟悉的名字，找到下一首喜欢的歌。</p>${searchForm()}</div><div class="artist-grid">${seed.artists.map((artist, i) => `<a href="/search.php?q=${encodeURIComponent(artist)}" class="artist-card"><span>${String(i + 1).padStart(2, '0')}</span><strong>${esc(artist)}</strong>${icon('arrow')}</a>`).join('')}</div>`, '/hotsgr.html');
}
function keywordsPage() {
  return layout('热门搜索', `<div class="page-intro"><span class="eyebrow">热门搜索</span><h1>热门搜索</h1><p>大家正在听什么？</p>${searchForm()}</div><div class="keyword-grid">${seed.keywords.map((word, i) => `<a href="/search.php?q=${encodeURIComponent(word)}"><span>${String(i + 1).padStart(2, '0')}</span>${esc(word)}${icon('arrow')}</a>`).join('')}</div>`, '/keyword.html');
}
module.exports = { homePage, rankingPage, searchPage, songPage, myMusicPage, collectionsPage, artistsPage, keywordsPage, recentPage, viewmorPage, downPage };
