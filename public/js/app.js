(() => {
  const KEY = 'qiuqiumusic.guest.v1';
  const THEME_KEY = 'qiuqiumusic.theme';
  const tabId = Math.random().toString(36).slice(2);
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('qiuqiumusic.playback.v1') : null;
  const host = document.getElementById('site-player');
  const panel = document.getElementById('player-panel');
  const queuePanel = document.getElementById('queue-panel');
  const audio = document.getElementById('player-audio');
  const titleNode = document.getElementById('player-title');
  const stateNode = document.getElementById('player-state');
  const detail = document.getElementById('player-detail');
  const toggle = document.getElementById('player-toggle');
  let queue = [];
  let favorites = [];
  let current = null;
  let owner = null;
  let isPlaying = false;
  let navigationId = 0;

  function readSaved() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || '{}');
      queue = Array.isArray(data.queue) ? data.queue.filter(validSong).slice(0, 1000) : [];
      favorites = Array.isArray(data.favorites) ? data.favorites.filter(validSong).slice(0, 1000) : [];
    } catch { queue = []; favorites = []; }
  }
  function validSong(song) { return song && /^\d+$/.test(String(song.id)) && typeof song.title === 'string'; }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ version: 1, queue, favorites })); } catch {}
    renderCollections();
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  function songFrom(button, idKey, titleKey) { return { id: String(button.dataset[idKey]), title: button.dataset[titleKey] }; }
  function contains(list, song) { return list.some(item => item.id === song.id); }
  function setBulkButton(button, label, completed) {
    const text = button.querySelector('.add-all-text');
    if (text) text.textContent = label;
    else button.textContent = label;
    button.classList.toggle('completed', completed);
  }
  function addToQueue(song) {
    if (!validSong(song) || contains(queue, song)) return;
    queue.push(song);
    save();
  }
  function addPageToQueue(button) {
    const rows = button.closest('.panel')?.querySelectorAll('.song-row [data-add-id]') || [];
    let added = 0;
    for (const row of rows) {
      const song = songFrom(row, 'addId', 'songTitle');
      if (!validSong(song) || contains(queue, song)) continue;
      queue.push(song);
      added++;
    }
    if (added) save();
    setBulkButton(button, added ? `已加入 ${added} 首` : '本页已加入', true);
  }
  function toggleFavorite(song) {
    if (!validSong(song)) return;
    favorites = contains(favorites, song) ? favorites.filter(item => item.id !== song.id) : [...favorites, song];
    save();
  }
  function message(type, extra = {}) { channel?.postMessage({ type, tabId, ...extra }); }
  function announce() { if (owner === tabId && current) message('state', { current, playing: isPlaying }); }
  function updatePlayer() {
    if (!current) return;
    host.hidden = false;
    titleNode.textContent = current.title;
    detail.href = `/library/${encodeURIComponent(current.id)}.html`;
    document.getElementById('player-favorite').classList.toggle('selected', contains(favorites, current));
    document.getElementById('queue-count').textContent = String(queue.length);
    host.classList.toggle('is-playing', isPlaying);
    host.classList.toggle('is-remote', owner !== tabId);
    if (owner !== tabId) stateNode.textContent = isPlaying ? '正在另一标签页播放' : '另一标签页已暂停';
    else if (!isPlaying && audio.paused) stateNode.textContent = '已暂停';
  }
  function syncPlayerSpace() {
    if (!host.classList.contains('is-expanded')) return;
    document.documentElement.style.setProperty('--player-dock-height', `${Math.ceil(panel.getBoundingClientRect().height)}px`);
  }
  function expand() {
    panel.hidden = false;
    host.classList.add('is-expanded');
    document.body.classList.add('player-docked');
    toggle.setAttribute('aria-expanded', 'true');
    queuePanel.hidden = true;
    syncPlayerSpace();
  }
  function collapse() {
    panel.hidden = true;
    queuePanel.hidden = true;
    host.classList.remove('is-expanded');
    document.body.classList.remove('player-docked');
    document.documentElement.style.removeProperty('--player-dock-height');
    toggle.setAttribute('aria-expanded', 'false');
  }
  function playSong(song, expandPanel = true) {
    if (!validSong(song)) return;
    if (owner === tabId && current?.id === song.id) {
      if (audio.paused) audio.play().catch(() => { stateNode.textContent = '点击播放按钮重试'; });
      else audio.pause();
      if (expandPanel) expand();
      return;
    }
    message('takeover');
    owner = tabId;
    current = song;
    addToQueue(song);
    audio.src = `/media/${encodeURIComponent(song.title)}.m4a`;
    stateNode.textContent = '正在加载…';
    isPlaying = true;
    updatePlayer();
    if (expandPanel) expand();
    audio.play().catch(() => { isPlaying = false; stateNode.textContent = '点击播放按钮重试'; updatePlayer(); announce(); });
    announce();
  }
  function shiftSong(step) {
    if (!queue.length) return;
    const index = Math.max(0, queue.findIndex(song => song.id === current?.id));
    const next = queue[(index + step + queue.length) % queue.length];
    playSong(next, false);
  }
  function playbackCommand(action) {
    if (owner !== tabId) { message('command', { action, owner }); return; }
    if (action === 'next') shiftSong(1);
    if (action === 'prev') shiftSong(-1);
    if (action === 'toggle') audio.paused ? audio.play().catch(() => {}) : audio.pause();
  }
  function listMarkup(items, kind) {
    if (!items.length) return `<p class="empty-personal">${kind === 'favorites' ? '还没有收藏歌曲，点击歌曲旁的爱心开始收藏。' : '播放清单还是空的，点击歌曲旁的加号添加。'}</p>`;
    return items.map((song, index) => `<div class="personal-song"><span>${String(index + 1).padStart(2, '0')}</span><button type="button" data-play-id="${escapeHtml(song.id)}" data-play-title="${escapeHtml(song.title)}">${escapeHtml(song.title)}</button><button type="button" data-${kind === 'favorites' ? 'favorite' : 'remove'}-id="${escapeHtml(song.id)}" data-song-title="${escapeHtml(song.title)}" aria-label="${kind === 'favorites' ? '取消收藏' : '从播放清单移除'} ${escapeHtml(song.title)}">×</button></div>`).join('');
  }
  function renderCollections() {
    document.querySelectorAll('[data-favorite-id]').forEach(button => {
      const selected = favorites.some(song => song.id === button.dataset.favoriteId);
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    const fav = document.getElementById('favorites-list');
    if (fav) fav.innerHTML = listMarkup(favorites, 'favorites');
    const playlist = document.getElementById('playlist-list');
    if (playlist) playlist.innerHTML = listMarkup(queue, 'queue');
    document.getElementById('queue-items').innerHTML = listMarkup(queue, 'queue');
    document.querySelectorAll('[data-add-page]').forEach(button => {
      const songs = [...(button.closest('.panel')?.querySelectorAll('.song-row [data-add-id]') || [])];
      const allAdded = songs.length > 0 && songs.every(row => queue.some(song => song.id === row.dataset.addId));
      setBulkButton(button, allAdded ? '本页已加入' : '一键加入歌单', allAdded);
    });
    updatePlayer();
  }
  async function navigate(url, { replace = false, pop = false } = {}) {
    const target = new URL(url, location.href);
    if (target.origin !== location.origin) { location.href = target.href; return; }
    const id = ++navigationId;
    try {
      const response = await fetch(target.href, { headers: { 'X-Requested-With': 'qiuqiumusic' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const page = new DOMParser().parseFromString(await response.text(), 'text/html');
      if (id !== navigationId || !page.querySelector('main.main-content')) return;
      const newScript = page.querySelector('script[src*="/projects/source_code/js/app.js"]')?.getAttribute('src');
      const oldScript = document.querySelector('script[src*="/projects/source_code/js/app.js"]')?.getAttribute('src');
      if (newScript && oldScript && newScript !== oldScript) { location.assign(target.href); return; }
      const newCss = page.querySelector('link[href*="/projects/source_code/css/site.css"]')?.getAttribute('href');
      const css = document.querySelector('link[href*="/projects/source_code/css/site.css"]');
      if (newCss && css && css.getAttribute('href') !== newCss) css.setAttribute('href', newCss);
      document.querySelector('main.main-content').innerHTML = page.querySelector('main.main-content').innerHTML;
      document.querySelector('.site-header').innerHTML = page.querySelector('.site-header').innerHTML;
      document.title = page.title;
      if (!pop) history[replace ? 'replaceState' : 'pushState']({}, '', target.href);
      window.scrollTo({ top: 0, behavior: 'instant' });
      const themeSelect = document.getElementById('theme-select');
      themeSelect.value = document.documentElement.dataset.theme || 'mint';
      collapse();
      renderCollections();
    } catch {
      stateNode.textContent = '页面暂时无法打开，请稍后重试';
    }
  }
  function internalLink(link) {
    if (!link || !link.href || link.hasAttribute('download') || link.target === '_blank') return false;
    const url = new URL(link.href, location.href);
    return url.origin === location.origin && /^https?:$/.test(url.protocol) && !url.pathname.startsWith('/media/') && !url.pathname.startsWith('/projects/');
  }

  document.addEventListener('click', event => {
    const addPage = event.target.closest('[data-add-page]');
    if (addPage) { event.preventDefault(); addPageToQueue(addPage); return; }
    const favorite = event.target.closest('[data-favorite-id]');
    if (favorite) { event.preventDefault(); toggleFavorite(songFrom(favorite, 'favoriteId', 'songTitle')); return; }
    const add = event.target.closest('[data-add-id]');
    if (add) { event.preventDefault(); addToQueue(songFrom(add, 'addId', 'songTitle')); add.classList.add('added'); return; }
    const remove = event.target.closest('[data-remove-id]');
    if (remove) { event.preventDefault(); queue = queue.filter(song => song.id !== remove.dataset.removeId); save(); return; }
    const trigger = event.target.closest('[data-play-id]');
    if (trigger) { event.preventDefault(); playSong(songFrom(trigger, 'playId', 'playTitle')); return; }
    const link = event.target.closest('a[href]');
    if (link && internalLink(link) && !event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {
      event.preventDefault(); navigate(link.href);
    }
  });
  document.addEventListener('submit', event => {
    const form = event.target.closest('form.search-form');
    if (!form) return;
    event.preventDefault();
    const query = new FormData(form).get('q')?.toString().trim();
    if (query) navigate(`/search.php?q=${encodeURIComponent(query)}`);
  });
  document.addEventListener('change', event => {
    if (event.target.id !== 'theme-select') return;
    const theme = event.target.value;
    if (!['mint', 'sky', 'lilac'].includes(theme)) return;
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
  });
  window.addEventListener('popstate', () => navigate(location.href, { pop: true }));
  window.addEventListener('storage', event => {
    if (event.key === KEY) { readSaved(); renderCollections(); }
    if (event.key === THEME_KEY) {
      document.documentElement.dataset.theme = event.newValue || 'mint';
      const select = document.getElementById('theme-select');
      if (select) select.value = document.documentElement.dataset.theme;
    }
  });
  toggle.addEventListener('click', expand);
  if ('ResizeObserver' in window) new ResizeObserver(syncPlayerSpace).observe(panel);
  window.addEventListener('resize', syncPlayerSpace);
  document.getElementById('player-collapse').addEventListener('click', collapse);
  document.getElementById('player-prev').addEventListener('click', () => playbackCommand('prev'));
  document.getElementById('player-next').addEventListener('click', () => playbackCommand('next'));
  document.getElementById('player-play-pause').addEventListener('click', () => playbackCommand('toggle'));
  document.getElementById('player-favorite').addEventListener('click', () => { if (current) toggleFavorite(current); });
  document.getElementById('player-queue').addEventListener('click', () => { queuePanel.hidden = !queuePanel.hidden; renderCollections(); });
  document.getElementById('queue-close').addEventListener('click', () => { queuePanel.hidden = true; });
  audio.addEventListener('playing', () => { isPlaying = true; stateNode.textContent = '正在播放'; updatePlayer(); announce(); });
  audio.addEventListener('pause', () => { if (owner === tabId) { isPlaying = false; stateNode.textContent = audio.ended ? '播放完毕' : '已暂停'; updatePlayer(); announce(); } });
  audio.addEventListener('waiting', () => { if (owner === tabId) stateNode.textContent = '缓冲中…'; });
  audio.addEventListener('error', () => { if (owner === tabId) { isPlaying = false; stateNode.textContent = '音频暂时不可用'; updatePlayer(); announce(); } });
  audio.addEventListener('ended', () => shiftSong(1));
  if (channel) channel.addEventListener('message', event => {
    const data = event.data;
    if (!data || data.tabId === tabId) return;
    if (data.type === 'takeover' && owner === tabId) { audio.pause(); owner = data.tabId; }
    if (data.type === 'state') {
      if (owner === tabId && !audio.paused) return;
      owner = data.tabId; current = data.current; isPlaying = !!data.playing; updatePlayer();
    }
    if (data.type === 'command' && data.owner === tabId) playbackCommand(data.action);
    if (data.type === 'hello') announce();
  });
  readSaved();
  renderCollections();
  const select = document.getElementById('theme-select');
  if (select) select.value = document.documentElement.dataset.theme || 'mint';
  message('hello');
})();
