(() => {
  const KEY = 'qiuqiumusic.guest.v1';
  const LAST_PLAYBACK_KEY = 'qiuqiumusic.lastPlayback.v1';
  const THEME_KEY = 'qiuqiumusic.theme';
  const THEMES = ['mint', 'sky', 'lilac', 'sunset', 'sakura', 'dark'];
  const THEME_NAMES = { mint: '薄荷绿', sky: '晴空蓝', lilac: '晨雾紫', sunset: '日落橙', sakura: '樱花粉', dark: '暗夜黑' };
  const PLAY_MODE_KEY = 'qiuqiumusic.playmode';
  const PLAY_MODES = ['sequence', 'repeat-all', 'repeat-one'];
  const PLAY_MODE_NAMES = { sequence: '顺序播放', 'repeat-all': '列表循环', 'repeat-one': '单曲循环' };
  const THEME_COLORS = { mint: '#f1f8f5', sky: '#f2f8fc', lilac: '#f8f5fb', sunset: '#fdf6ef', sakura: '#fdf3f6', dark: '#0f1a17' };
  const tabId = Math.random().toString(36).slice(2);
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('qiuqiumusic.playback.v1') : null;
  const host = document.getElementById('site-player');
  const panel = document.getElementById('player-panel');
  const queuePanel = document.getElementById('queue-panel');
  const audio = document.getElementById('player-audio');
  const seek = document.getElementById('player-seek');
  const currentTimeNode = document.getElementById('player-current-time');
  const durationNode = document.getElementById('player-duration');
  const titleNode = document.getElementById('player-title');
  const stateNode = document.getElementById('player-state');
  const toggle = document.getElementById('player-toggle');
  const queueButton = document.getElementById('player-queue');
  const remoteProgress = document.getElementById('player-remote-progress');
  const remoteTime = document.getElementById('player-remote-time');
  const remoteBar = document.getElementById('player-remote-bar');
  const loading = document.getElementById('route-loading');
  const installDialog = document.getElementById('install-dialog');
  const themeSheet = document.getElementById('theme-sheet');
  let installPrompt = null;
  let installReturnFocus = null;
  let queue = [];
  let favorites = [];
  let current = null;
  let owner = null;
  let isPlaying = false;
  let playbackError = '';
  let playRequestId = 0;
  let minimizedByUser = false;
  let remotePosition = { currentTime: 0, duration: 0 };
  let lastProgressSent = 0;
  let lastPlaybackSave = 0;
  let pendingRestorePosition = 0;
  let trackLoadPending = false;
  let navigationId = 0;
  let loadingStartedAt = 0;
  let playMode = (() => { try { const value = localStorage.getItem(PLAY_MODE_KEY); return PLAY_MODES.includes(value) ? value : 'sequence'; } catch { return 'sequence'; } })();
  let themeReturnFocus = null;
  let cacheCached = new Set();
  let cacheDownloading = new Set();
  let cacheFailed = new Set();
  let cachePrefetchId = 0;
  let cacheLoopRunning = false;
  let cacheStatusTimer;

  function showLoading(label) {
    loading.querySelector('.route-loading-text').textContent = label;
    loading.classList.remove('is-error');
    loading.hidden = false;
    loadingStartedAt = performance.now();
  }
  async function hideLoading(id) {
    if (id !== navigationId) return;
    const remaining = Math.max(0, 320 - (performance.now() - loadingStartedAt));
    if (remaining) await new Promise(resolve => setTimeout(resolve, remaining));
    if (id === navigationId) loading.hidden = true;
  }
  function setBuffering(value) { host.classList.toggle('is-buffering', value); }

  function installedApp() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }
  function installEnvironment() {
    const ua = navigator.userAgent;
    return {
      ios: /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
      android: /Android/.test(ua),
      inApp: /MicroMessenger|WeChat|QQ\/|AlipayClient|DingTalk|Weibo/i.test(ua),
      safari: /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|Chrome|Chromium|Edg\//.test(ua),
    };
  }
  function updateInstallButton() {
    const button = document.getElementById('install-app');
    if (!button) return;
    // 桌面客户端（Electron）内不提供"保存链接"，网页里也统一叫"保存链接"
    const desktop = /Electron\//.test(navigator.userAgent);
    button.hidden = installedApp() || desktop;
    button.querySelector('span').textContent = '保存链接';
  }
  function closeInstallDialog() {
    installDialog.hidden = true;
    installReturnFocus?.focus();
    installReturnFocus = null;
  }
  function showInstallInstructions() {
    const env = installEnvironment();
    let instructions;
    if (env.inApp && env.ios) {
      instructions = '当前在微信等应用内打开，无法由网页直接安装。\n1. 点右上角“···”，选择“在 Safari 中打开”。\n2. 在 Safari 点“分享”→“添加到主屏幕”→“添加”。\n如果没有“在 Safari 中打开”，请复制链接并粘贴到 Safari。';
    } else if (env.inApp && env.android) {
      instructions = '当前在微信等应用内打开，系统安装按钮不会出现。\n1. 点右上角“···”，选择“在浏览器打开”。\n2. 在 Chrome 中点本站“安装”，确认安装。\n如果没有“在浏览器打开”，请复制链接并粘贴到 Chrome。';
    } else if (env.ios) {
      instructions = env.safari
        ? 'iPhone 需要通过 Safari 添加网页 App：点“分享”→“添加到主屏幕”→“添加”。如果看到“作为网页 App 打开”，请开启。'
        : '请用 Safari 打开本站，再点“分享”→“添加到主屏幕”→“添加”。';
    } else if (env.android) {
      instructions = '请在 Chrome 菜单中选择“安装应用”或“添加到主屏幕”。如果没有安装选项，请稍后刷新页面再试。';
    } else if (env.safari) {
      instructions = '在 Safari 菜单中选择“文件”→“添加到程序坞”，或点工具栏的“分享”→“添加到程序坞”。';
    } else {
      instructions = '在浏览器地址栏右侧或菜单中选择“安装秋秋音乐”。如果暂时没有安装选项，请稍后刷新再试。';
    }
    installReturnFocus = document.activeElement;
    document.getElementById('install-title').textContent = '保存秋秋音乐链接';
    document.getElementById('install-instructions').textContent = instructions;
    const copy = document.getElementById('install-copy-link');
    copy.hidden = false;
    copy.textContent = '复制网站链接';
    installDialog.hidden = false;
    copy.focus();
  }
  // 复制站点首页链接（"保存链接"入口用）
  async function copySiteLink() {
    const url = new URL('/', location.href).href;
    try { await navigator.clipboard.writeText(url); return true; } catch {}
    const field = document.createElement('textarea');
    field.value = url;
    field.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.append(field);
    field.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch {}
    field.remove();
    if (!copied) window.prompt('请复制链接，在手机浏览器中打开：', url);
    return copied;
  }
  async function copyInstallLink() {
    if (await copySiteLink()) document.getElementById('install-copy-link').textContent = '链接已复制';
  }
  function startInstall() {
    if (installedApp()) return;
    const button = document.getElementById('install-app');
    const span = button?.querySelector('span');
    copySiteLink().then(copied => {
      if (!copied) { showInstallInstructions(); return; }
      if (!span) return;
      span.textContent = '链接已复制';
      setTimeout(() => { if (span.textContent === '链接已复制') span.textContent = '保存链接'; }, 1800);
    });
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    updateInstallButton();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    updateInstallButton();
    closeInstallDialog();
  });
  window.matchMedia('(display-mode: standalone)').addEventListener?.('change', updateInstallButton);
  if (location.protocol !== 'qiuqiu:' && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

  function readSaved(restorePlayback = false) {
    let data = {};
    let playback = {};
    try {
      data = JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch {}
    queue = Array.isArray(data.queue) ? data.queue.filter(validSong).slice(0, 1000) : [];
    favorites = Array.isArray(data.favorites) ? data.favorites.filter(validSong).slice(0, 1000) : [];
    if (!restorePlayback) return;
    try { playback = JSON.parse(localStorage.getItem(LAST_PLAYBACK_KEY) || '{}'); } catch {}
    // Prefer the dedicated playback snapshot, but retain an older queue when
    // that snapshot was written by an empty/stale tab. Older app builds saved
    // the queue before they saved the current track, so its last item is the
    // best available migration candidate.
    const playbackQueue = Array.isArray(playback.queue) ? playback.queue.filter(validSong) : [];
    const legacyQueue = Array.isArray(data.queue) ? data.queue.filter(validSong) : [];
    queue = playbackQueue.length ? playbackQueue.slice(0, 1000) : legacyQueue.slice(0, 1000);
    const savedSong = validSong(playback.current) ? playback.current
      : validSong(data.current) ? data.current
        : [...playbackQueue, ...legacyQueue].at(-1);
    if (!validSong(savedSong)) return;
    current = savedSong;
    if (!queue.some(song => song.id === current.id)) queue.unshift(current);
    const savedPosition = playback.current?.id === savedSong.id ? playback.position : data.position;
    owner = tabId;
    isPlaying = false;
    pendingRestorePosition = Number.isFinite(savedPosition) ? Math.max(0, savedPosition) : 0;
    trackLoadPending = true;
    audio.src = `/media/${encodeURIComponent(current.title)}.m4a`;
    audio.load();
    persistPlayback();
  }
  // 切换皮肤并同步浏览器状态栏颜色（PWA 与移动端浏览体验）
  function applyTheme(theme) {
    document.documentElement.dataset.theme = THEMES.includes(theme) ? theme : 'mint';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = THEME_COLORS[theme] || THEME_COLORS.mint;
    updateThemeControls();
  }
  function updateThemeControls() {
    const theme = document.documentElement.dataset.theme || 'mint';
    const label = document.getElementById('theme-mobile-label');
    if (label) label.textContent = THEME_NAMES[theme];
    themeSheet.querySelectorAll('[data-theme-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme)));
  }
  function setTheme(theme) {
    if (!THEMES.includes(theme)) return;
    applyTheme(theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
  }
  function openThemeSheet() {
    themeReturnFocus = document.activeElement;
    themeSheet.hidden = false;
    document.body.classList.add('theme-sheet-open');
    document.getElementById('theme-mobile-trigger')?.setAttribute('aria-expanded', 'true');
    themeSheet.querySelector('[aria-pressed="true"]')?.focus();
  }
  function closeThemeSheet() {
    themeSheet.hidden = true;
    document.body.classList.remove('theme-sheet-open');
    document.getElementById('theme-mobile-trigger')?.setAttribute('aria-expanded', 'false');
    themeReturnFocus?.focus();
    themeReturnFocus = null;
  }
  function updateModeButton() {
    const button = document.getElementById('player-mode');
    button.dataset.mode = playMode;
    button.title = PLAY_MODE_NAMES[playMode];
    button.setAttribute('aria-label', `播放模式：${PLAY_MODE_NAMES[playMode]}，点击切换`);
    button.querySelector('.mode-label').textContent = PLAY_MODE_NAMES[playMode];
  }
  function setPlayMode(mode, persist = true) {
    if (!PLAY_MODES.includes(mode)) return;
    playMode = mode;
    updateModeButton();
    if (persist) {
      try { localStorage.setItem(PLAY_MODE_KEY, mode); } catch {}
      message('mode', { mode });
    }
  }
  function validSong(song) { return song && /^\d+$/.test(String(song.id)) && typeof song.title === 'string'; }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ version: 1, queue, favorites, current, position: savedPosition() })); } catch {}
    persistPlayback();
    renderCollections();
  }
  function savedPosition() {
    if (!current) return 0;
    if (owner !== tabId) return remotePosition.currentTime || 0;
    if (trackLoadPending) return pendingRestorePosition;
    if (pendingRestorePosition > 0 && audio.readyState === 0) return pendingRestorePosition;
    return Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
  }
  function persistPlayback() {
    try {
      const previous = JSON.parse(localStorage.getItem(LAST_PLAYBACK_KEY) || '{}');
      const savedSong = current || (validSong(previous.current) ? previous.current : null);
      const position = current ? savedPosition() : (Number.isFinite(previous.position) ? previous.position : 0);
      localStorage.setItem(LAST_PLAYBACK_KEY, JSON.stringify({ version: 1, queue, current: savedSong, position, savedAt: Date.now() }));
    } catch {}
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
    autoStartQueue();
    scheduleCacheStatusRefresh();
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
    if (added) {
      save();
      autoStartQueue();
      scheduleCacheStatusRefresh();
    }
    setBulkButton(button, added ? `已加入 ${added} 首` : '本页已加入', true);
  }
  // 清单为空闲状态时，加入即从第一首开始播放
  function autoStartQueue() {
    if (!current && queue.length) playSong(queue[0]);
  }
  function queueTitles() {
    return [...new Set(queue.map(song => song.title).filter(Boolean))];
  }
  function cacheStateFor(title) {
    if (cacheCached.has(title)) return 'cached';
    if (cacheDownloading.has(title)) return 'downloading';
    return 'pending';
  }
  function updateCacheMeters() {
    for (const node of document.querySelectorAll('[data-cache-title]')) {
      const state = cacheStateFor(node.dataset.cacheTitle);
      if (node.dataset.cacheState !== state) node.dataset.cacheState = state;
      const label = state === 'cached' ? '已缓存' : state === 'downloading' ? '缓存中' : '待缓存';
      if (node.getAttribute('aria-label') !== label) node.setAttribute('aria-label', label);
    }
    const summary = document.getElementById('queue-cache-summary');
    if (summary) {
      const cached = queue.filter(song => cacheCached.has(song.title)).length;
      summary.textContent = `已缓存 ${cached}/${queue.length}`;
      summary.hidden = queue.length === 0;
    }
  }
  function scheduleCacheStatusRefresh() {
    clearTimeout(cacheStatusTimer);
    cacheStatusTimer = setTimeout(refreshCacheStatus, 150);
  }
  async function refreshCacheStatus() {
    const titles = queueTitles();
    if (!titles.length) {
      cacheCached = new Set();
      cacheDownloading = new Set();
      updateCacheMeters();
      return;
    }
    try {
      const res = await fetch('/api/cache/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titles }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      cacheCached = new Set(Array.isArray(data.cached) ? data.cached : []);
      cacheDownloading = new Set(Array.isArray(data.downloading) ? data.downloading : []);
    } catch {}
    updateCacheMeters();
    startPrefetchLoop();
  }
  // 逐首预缓存：一次只下载一首，下载完成再处理下一首
  async function startPrefetchLoop() {
    if (cacheLoopRunning || !queue.length) return;
    cacheLoopRunning = true;
    const runId = ++cachePrefetchId;
    try {
      for (const song of queue) {
        if (runId !== cachePrefetchId) return;
        const title = song.title;
        if (!title || cacheCached.has(title) || cacheFailed.has(title)) continue;
        cacheDownloading.add(title);
        updateCacheMeters();
        try {
          const res = await fetch('/api/cache/prefetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
          });
          const data = await res.json().catch(() => ({}));
          cacheDownloading.delete(title);
          if (res.ok && data.cached) cacheCached.add(title);
          else cacheFailed.add(title);
        } catch {
          cacheDownloading.delete(title);
          cacheFailed.add(title);
        }
        if (runId !== cachePrefetchId) return;
        updateCacheMeters();
      }
    } finally {
      if (runId === cachePrefetchId) cacheLoopRunning = false;
    }
  }
  function toggleFavorite(song) {
    if (!validSong(song)) return;
    favorites = contains(favorites, song) ? favorites.filter(item => item.id !== song.id) : [...favorites, song];
    save();
  }
  function message(type, extra = {}) { channel?.postMessage({ type, tabId, ...extra }); }
  function playbackPosition() {
    return { currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0, duration: Number.isFinite(audio.duration) ? audio.duration : 0 };
  }
  function formatTime(seconds) {
    const value = Math.max(0, Math.floor(seconds));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
  }
  function updateTimeline() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    seek.max = String(duration || 0);
    seek.value = String(Math.min(currentTime, duration || 0));
    seek.disabled = duration <= 0 || owner !== tabId;
    seek.style.setProperty('--played', `${duration ? Math.min(100, currentTime / duration * 100) : 0}%`);
    seek.setAttribute('aria-valuetext', `${formatTime(currentTime)} / ${duration ? formatTime(duration) : '--:--'}`);
    currentTimeNode.textContent = formatTime(currentTime);
    durationNode.textContent = duration ? formatTime(duration) : '--:--';
  }
  function renderRemoteProgress() {
    const { currentTime, duration } = remotePosition;
    remoteTime.textContent = `${formatTime(currentTime)} / ${duration ? formatTime(duration) : '--:--'}`;
    remoteBar.max = duration || 1;
    remoteBar.value = Math.min(currentTime, duration || 1);
    remoteBar.style.setProperty('--played', `${duration ? Math.min(100, currentTime / duration * 100) : 0}%`);
  }
  function announce() { if (owner === tabId && current) message('state', { current, playing: isPlaying, ...playbackPosition() }); }
  // 清单里高亮当前曲目（颜色跟随皮肤变量，见 site.css）
  function syncQueueHighlight() {
    const items = document.getElementById('queue-items');
    if (!items) return null;
    let active = null;
    for (const row of items.querySelectorAll('.personal-song')) {
      const on = !!current && row.dataset.songId === current.id;
      row.classList.toggle('is-current', on);
      if (on) { row.setAttribute('aria-current', 'true'); active = row; }
      else row.removeAttribute('aria-current');
    }
    return active;
  }
  // 打开清单时把当前曲目滚动到可视区域中间
  function focusQueueCurrent(active) {
    const items = document.getElementById('queue-items');
    if (!active || !items || queuePanel.hidden) return;
    const top = active.offsetTop - items.clientHeight / 2 + active.offsetHeight / 2;
    items.scrollTop = Math.max(0, top);
  }
  function updatePlayer() {
    host.hidden = false;
    host.classList.toggle('has-track', !!current);
    for (const id of ['player-prev', 'player-next', 'player-favorite']) {
      document.getElementById(id).disabled = !current;
    }
    // 计数徽标无条件刷新；清单有歌时播放键保持可用，解决"清单有歌却显示 0 首且无法播放"
    document.getElementById('player-play-pause').disabled = !current && !queue.length;
    const index = current ? queue.findIndex(song => song.id === current.id) + 1 : 0;
    document.getElementById('queue-count').textContent = queue.length ? `${index}/${queue.length}` : '0';
    queueButton.setAttribute('aria-label', queue.length
      ? `播放清单，当前第 ${index || 1} 首，共 ${queue.length} 首`
      : '播放清单，暂无曲目');
    syncQueueHighlight();
    updateCacheMeters();
    if (!current) { stateNode.textContent = queue.length ? '按播放键开始' : '待命中'; return; }
    if (!minimizedByUser && !host.classList.contains('is-expanded')) expand();
    titleNode.textContent = current.title;
    document.getElementById('player-favorite').classList.toggle('selected', contains(favorites, current));
    host.classList.toggle('is-playing', isPlaying);
    host.classList.toggle('is-remote', owner !== tabId);
    remoteProgress.hidden = owner === tabId;
    if (owner !== tabId) renderRemoteProgress();
    updateTimeline();
    if (owner !== tabId) stateNode.textContent = isPlaying ? '正在另一标签页播放' : '另一标签页已暂停';
    else if (playbackError) stateNode.textContent = playbackError;
    else if (host.classList.contains('is-buffering')) stateNode.textContent = '正在加载…';
    else if (!isPlaying && audio.paused) stateNode.textContent = '已暂停';
  }
  function syncPlayerSpace() {
    if (!host.classList.contains('is-expanded')) return;
    document.documentElement.style.setProperty('--player-dock-height', `${Math.ceil(panel.getBoundingClientRect().height)}px`);
  }
  let restoreVinylPos = null;
  function expand() {
    minimizedByUser = false;
    panel.hidden = false;
    // 展开为底部播放条：清除悬浮球拖动留下的内联定位，让 is-expanded 吸底规则生效
    host.style.left = host.style.top = host.style.right = host.style.bottom = '';
    host.classList.add('is-expanded');
    document.body.classList.add('player-docked');
    toggle.setAttribute('aria-expanded', 'true');
    queuePanel.hidden = true;
    queueButton.setAttribute('aria-expanded', 'false');
    syncPlayerSpace();
  }
  function collapse() {
    minimizedByUser = true;
    panel.hidden = true;
    queuePanel.hidden = true;
    queueButton.setAttribute('aria-expanded', 'false');
    host.classList.remove('is-expanded');
    document.body.classList.remove('player-docked');
    document.documentElement.style.removeProperty('--player-dock-height');
    toggle.setAttribute('aria-expanded', 'false');
    if (restoreVinylPos) restoreVinylPos(); // 恢复悬浮球拖动记忆位置
  }
  // 播放计数上报：每首歌每个会话只计一次，驱动本站"本站点播榜"。
  audio.addEventListener('play', () => {
    if (!current || owner !== tabId) return;
    // Save on the actual start event as a second checkpoint. This covers
    // browsers that suspend or kill an installed PWA before its next timer.
    persistPlayback();
    const key = `qiuqiumusic.played.${current.id}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch {}
    fetch('/api/stats/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: String(current.id), title: current.title }),
    }).catch(() => {});
  });
  function pausePlayback() {
    playRequestId++;
    audio.pause();
    setBuffering(false);
  }
  function requestPlayback() {
    if (!current) return;
    const requestId = ++playRequestId;
    if (audio.error || audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE || !audio.getAttribute('src')) {
      pendingRestorePosition = savedPosition();
      trackLoadPending = true;
      // A rejected play() keeps the old MediaError until load() is called.
      // A retry query also prevents reusing a cached failed HTTP response.
      audio.src = `/media/${encodeURIComponent(current.title)}.m4a?retry=${Date.now()}`;
      audio.load();
    }
    playbackError = '';
    setBuffering(true);
    stateNode.textContent = '正在加载…';
    audio.play().catch(error => {
      if (requestId !== playRequestId) return;
      setBuffering(false);
      isPlaying = false;
      if (error.name !== 'AbortError') playbackError = '音源暂时不可用，点击播放重试或切换下一首';
      updatePlayer();
      announce();
    });
    updatePlayer();
  }
  function playSong(song, expandPanel = true) {
    if (!validSong(song)) return;
    if (owner === tabId && current?.id === song.id) {
      if (audio.paused) requestPlayback();
      else pausePlayback();
      if (expandPanel) expand();
      return;
    }
    message('takeover');
    owner = tabId;
    current = song;
    playbackError = '';
    if (expandPanel) minimizedByUser = false;
    pendingRestorePosition = 0;
    trackLoadPending = true;
    audio.src = `/media/${encodeURIComponent(song.title)}.m4a`;
    addToQueue(song);
    persistPlayback();
    stateNode.textContent = '正在加载…';
    setBuffering(true);
    isPlaying = true;
    updatePlayer();
    if (expandPanel) expand();
    requestPlayback();
    announce();
  }
  function shiftSong(step, automatic = false) {
    if (owner !== tabId || !queue.length) return false;
    if (automatic && playMode === 'repeat-one') {
      audio.currentTime = 0;
      requestPlayback();
      return true;
    }
    const index = queue.findIndex(song => song.id === current?.id);
    const target = (index < 0 ? (step > 0 ? -1 : 0) : index) + step;
    const wrap = playMode === 'repeat-all' || (!automatic && playMode === 'repeat-one');
    if (!wrap && (target < 0 || target >= queue.length)) return false;
    const next = queue[(target + queue.length) % queue.length];
    if (next.id === current?.id) {
      audio.currentTime = 0;
      requestPlayback();
    } else playSong(next, false);
    return true;
  }
  function playbackCommand(action) {
    // owner 为 null 说明没有任何标签页在播，本页直接接管；只有其他标签页在播时才转发遥控
    if (owner !== tabId) {
      if (owner !== null) { message('command', { action, owner }); return; }
      owner = tabId;
    }
    if (action === 'next') shiftSong(1);
    if (action === 'prev') shiftSong(-1);
    if (action === 'toggle') {
      // 清单有歌但尚未加载曲目时，播放键直接开播第一首
      if (!current && queue.length) { playSong(queue[0]); return; }
      audio.paused ? requestPlayback() : pausePlayback();
    }
  }
  function listMarkup(items, kind) {
    if (!items.length) return `<p class="empty-personal">${kind === 'favorites' ? '还没有收藏歌曲，点击歌曲旁的爱心开始收藏。' : '播放清单还是空的，点击歌曲旁的加号添加。'}</p>`;
    return items.map((song, index) => {
      const isCurrent = kind === 'queue' && !!current && current.id === song.id;
      const meter = kind === 'queue'
        ? `<span class="cache-meter" data-cache-title="${escapeHtml(song.title)}" data-cache-state="${cacheStateFor(song.title)}" role="img" aria-label="${cacheStateFor(song.title) === 'cached' ? '已缓存' : cacheStateFor(song.title) === 'downloading' ? '缓存中' : '待缓存'}"><i></i></span>`
        : '';
      return `<div class="personal-song${isCurrent ? ' is-current' : ''}" data-song-id="${escapeHtml(song.id)}"${isCurrent ? ' aria-current="true"' : ''}><span class="personal-index">${String(index + 1).padStart(2, '0')}</span><div class="personal-main"><button type="button" data-play-id="${escapeHtml(song.id)}" data-play-title="${escapeHtml(song.title)}">${escapeHtml(song.title)}</button>${meter}</div><button type="button" data-${kind === 'favorites' ? 'favorite' : 'remove'}-id="${escapeHtml(song.id)}" data-song-title="${escapeHtml(song.title)}" aria-label="${kind === 'favorites' ? '取消收藏' : '从播放清单移除'} ${escapeHtml(song.title)}">×</button></div>`;
    }).join('');
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
    updateCacheMeters();
  }
  async function navigate(url, { replace = false, pop = false } = {}) {
    const target = new URL(url, location.href);
    if (target.origin !== location.origin) { location.href = target.href; return; }
    const id = ++navigationId;
    showLoading(target.pathname === '/search.php' ? '正在搜索音乐…' : target.searchParams.has('page') ? '正在加载歌曲列表…' : '正在打开页面…');
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
      updateThemeControls();
      updateNavScrollHint();
      updateInstallButton();
      window.qiuqiuDownloads?.refresh();
      window.qiuqiuUpdateUI?.refresh();
      renderCollections();
    } catch {
      if (id === navigationId) {
        loading.classList.add('is-error');
        loading.querySelector('.route-loading-text').textContent = '页面暂时无法打开，请稍后重试';
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
    } finally {
      await hideLoading(id);
    }
  }
  function internalLink(link) {
    if (!link || !link.href || link.hasAttribute('download') || link.target === '_blank') return false;
    const url = new URL(link.href, location.href);
    return url.origin === location.origin && /^(https?|qiuqiu):$/.test(url.protocol) && !url.pathname.startsWith('/media/') && !url.pathname.startsWith('/projects/');
  }
  function updateNavScrollHint() {
    const nav = document.querySelector('.main-nav');
    const button = document.getElementById('nav-scroll-next');
    if (!nav || !button) return;
    button.hidden = nav.scrollWidth - nav.scrollLeft - nav.clientWidth < 8;
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-desktop-package]')) return;
    if (event.target.closest('#install-app')) { startInstall(); return; }
    if (event.target.closest('#install-copy-link')) { copyInstallLink(); return; }
    if (event.target.closest('[data-install-close]')) { closeInstallDialog(); return; }
    if (event.target.closest('#theme-mobile-trigger')) { openThemeSheet(); return; }
    if (event.target.closest('[data-theme-close]')) { closeThemeSheet(); return; }
    const themeChoice = event.target.closest('[data-theme-choice]');
    if (themeChoice) { setTheme(themeChoice.dataset.themeChoice); closeThemeSheet(); return; }
    if (event.target.closest('#nav-scroll-next')) { document.querySelector('.main-nav')?.scrollBy({ left: 180, behavior: 'smooth' }); return; }
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
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !installDialog.hidden) closeInstallDialog();
    if (event.key === 'Escape' && !themeSheet.hidden) closeThemeSheet();
  });
  document.addEventListener('submit', event => {
    const form = event.target.closest('form.search-form');
    if (!form) return;
    event.preventDefault();
    const query = new FormData(form).get('q')?.toString().trim();
    if (query) navigate(`/search.php?q=${encodeURIComponent(query)}`);
  });
  window.addEventListener('popstate', () => navigate(location.href, { pop: true }));
  window.addEventListener('pagehide', persistPlayback);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persistPlayback(); });
  document.addEventListener('scroll', event => { if (event.target.classList?.contains('main-nav')) updateNavScrollHint(); }, true);
  window.addEventListener('resize', updateNavScrollHint);
  window.addEventListener('storage', event => {
    if (event.key === KEY) { readSaved(); renderCollections(); }
    if (event.key === THEME_KEY) {
      applyTheme(event.newValue || 'mint');
    }
    if (event.key === PLAY_MODE_KEY) setPlayMode(event.newValue || 'sequence', false);
  });
  // 悬浮黑胶球支持拖动换位（电脑鼠标与手机触摸统一用 Pointer Events），位置记忆在本地；
  // 按下后位移超过 6px 视为拖动，否则仍点击展开。触屏滚动冲突由 touch-action:none 规避。
  function enableVinylDrag() {
    const POS_KEY = 'qiuqiumusic.vinylpos';
    let left = 0, top = 0, suppressClick = false;
    function clamp(x, y) {
      const w = host.offsetWidth || 74, h = host.offsetHeight || 74;
      return [
        Math.min(Math.max(8, x), Math.max(8, window.innerWidth - w - 8)),
        Math.min(Math.max(8, y), Math.max(8, window.innerHeight - h - 8)),
      ];
    }
    function place(x, y) {
      [left, top] = clamp(x, y);
      host.style.left = left + 'px';
      host.style.top = top + 'px';
      host.style.right = 'auto';
      host.style.bottom = 'auto';
    }
    restoreVinylPos = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
        if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) place(saved.left, saved.top);
      } catch {}
    };
    restoreVinylPos();
    toggle.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (host.classList.contains('is-expanded')) return;
      const rect = host.getBoundingClientRect();
      const offX = event.clientX - rect.left, offY = event.clientY - rect.top;
      const startX = event.clientX, startY = event.clientY;
      let moved = false;
      if (toggle.setPointerCapture) { try { toggle.setPointerCapture(event.pointerId); } catch {} }
      const onMove = move => {
        const dx = move.clientX - startX, dy = move.clientY - startY;
        if (!moved && Math.hypot(dx, dy) > 6) { moved = true; document.body.classList.add('vinyl-dragging'); }
        if (moved) place(move.clientX - offX, move.clientY - offY);
      };
      const onEnd = () => {
        toggle.removeEventListener('pointermove', onMove);
        toggle.removeEventListener('pointerup', onEnd);
        toggle.removeEventListener('pointercancel', onEnd);
        document.body.classList.remove('vinyl-dragging');
        if (moved) {
          suppressClick = true;
          try { localStorage.setItem(POS_KEY, JSON.stringify({ left, top })); } catch {}
        }
      };
      toggle.addEventListener('pointermove', onMove);
      toggle.addEventListener('pointerup', onEnd);
      toggle.addEventListener('pointercancel', onEnd);
    });
    toggle.addEventListener('click', event => {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    }, true);
    window.addEventListener('resize', () => { if (host.style.left) place(left, top); });
  }
  toggle.addEventListener('click', expand);
  if ('ResizeObserver' in window) new ResizeObserver(syncPlayerSpace).observe(panel);
  window.addEventListener('resize', syncPlayerSpace);
  document.getElementById('player-collapse').addEventListener('click', collapse);
  document.getElementById('player-collapse-desktop').addEventListener('click', collapse);
  document.getElementById('player-prev').addEventListener('click', () => playbackCommand('prev'));
  document.getElementById('player-next').addEventListener('click', () => playbackCommand('next'));
  document.getElementById('player-mode').addEventListener('click', () => setPlayMode(PLAY_MODES[(PLAY_MODES.indexOf(playMode) + 1) % PLAY_MODES.length]));
  document.getElementById('player-play-pause').addEventListener('click', () => playbackCommand('toggle'));
  seek.addEventListener('input', () => {
    if (owner !== tabId || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Number(seek.value);
    updateTimeline();
  });
  document.getElementById('player-favorite').addEventListener('click', () => { if (current) toggleFavorite(current); });
  queueButton.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    queuePanel.hidden = !queuePanel.hidden;
    queueButton.setAttribute('aria-expanded', String(!queuePanel.hidden));
    if (!queuePanel.hidden) {
      renderCollections();
      focusQueueCurrent(syncQueueHighlight());
      refreshCacheStatus();
    }
  });
  document.getElementById('queue-close').addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    queuePanel.hidden = true;
    queueButton.setAttribute('aria-expanded', 'false');
  });
  audio.addEventListener('playing', () => {
    playbackError = ''; setBuffering(false); isPlaying = true; stateNode.textContent = '正在播放';
    if (current?.title) { cacheCached.add(current.title); cacheFailed.delete(current.title); }
    updatePlayer(); announce();
  });
  audio.addEventListener('canplay', () => setBuffering(false));
  audio.addEventListener('pause', () => { setBuffering(false); if (owner === tabId) { isPlaying = false; stateNode.textContent = audio.ended ? '播放完毕' : '已暂停'; persistPlayback(); updatePlayer(); announce(); } });
  audio.addEventListener('waiting', () => { if (owner === tabId) { setBuffering(true); stateNode.textContent = '缓冲中…'; } });
  audio.addEventListener('error', () => { setBuffering(false); if (owner === tabId) { isPlaying = false; playbackError = '音源暂时不可用，点击播放重试或切换下一首'; updatePlayer(); announce(); } });
  audio.addEventListener('ended', () => {
    if (owner !== tabId) return;
    if (!shiftSong(1, true)) { isPlaying = false; stateNode.textContent = '播放完毕'; updatePlayer(); announce(); }
  });
  audio.addEventListener('timeupdate', () => {
    updateTimeline();
    if (owner === tabId && current && performance.now() - lastPlaybackSave >= 4000) {
      lastPlaybackSave = performance.now();
      persistPlayback();
    }
    if (owner !== tabId || !current || performance.now() - lastProgressSent < 500) return;
    lastProgressSent = performance.now();
    message('progress', playbackPosition());
  });
  audio.addEventListener('loadedmetadata', () => {
    if (owner === tabId && current && pendingRestorePosition > 0) {
      audio.currentTime = Math.min(pendingRestorePosition, Number.isFinite(audio.duration) ? audio.duration : pendingRestorePosition);
      pendingRestorePosition = 0;
    }
    trackLoadPending = false;
    persistPlayback();
    updateTimeline();
  });
  audio.addEventListener('seeked', () => { updateTimeline(); if (owner === tabId) message('progress', playbackPosition()); });
  audio.addEventListener('durationchange', () => { updateTimeline(); if (owner === tabId) message('progress', playbackPosition()); });
  if (channel) channel.addEventListener('message', event => {
    const data = event.data;
    if (!data || data.tabId === tabId) return;
    if (data.type === 'takeover' && owner === tabId) { audio.pause(); owner = data.tabId; }
    if (data.type === 'state') {
      if (owner === tabId && !audio.paused) return;
      owner = data.tabId; current = data.current; isPlaying = !!data.playing;
      remotePosition = { currentTime: data.currentTime || 0, duration: data.duration || 0 };
      updatePlayer();
    }
    if (data.type === 'progress' && owner === data.tabId) {
      remotePosition = { currentTime: data.currentTime || 0, duration: data.duration || 0 };
      renderRemoteProgress();
      updateTimeline();
    }
    if (data.type === 'command' && data.owner === tabId) playbackCommand(data.action);
    if (data.type === 'mode') setPlayMode(data.mode, false);
    if (data.type === 'hello') announce();
  });
  enableVinylDrag();
  readSaved(true);
  renderCollections();
  applyTheme(document.documentElement.dataset.theme || 'mint');
  updateModeButton();
  updateInstallButton();
  updateNavScrollHint();
  message('hello');
  // 已保存的清单在后台逐首补缓存
  if (queue.length) scheduleCacheStatusRefresh();
  document.documentElement.dataset.playerReady = 'true';
})();
