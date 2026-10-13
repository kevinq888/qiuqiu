const $ = id => document.getElementById(id);
const audio = $('audio');
const state = { view: 'discover', query: '', page: 1, tracks: [], local: [], queue: [], index: -1, current: null, likes: loadLikes(), shuffle: false, repeat: 'all', loading: false };
const commonsFile = name => `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(name)}`;
const commonsPage = name => `https://commons.wikimedia.org/wiki/${encodeURIComponent(`File:${name}`)}`;
const chineseLicensedSongs = [
  { file: '是你.ogg', title: '是你', artist: 'Czxttkl · 创作：陈正瑆', license: 'CC BY-SA 3.0', credit: 'Czxttkl（作品描述注明创作：陈正瑆）' },
  { file: 'Catherine.ogg', title: 'Catherine', artist: 'Czxttkl · 陈正瑆', license: 'CC BY-SA 3.0', credit: 'Czxttkl（作品描述注明陈正瑆创作）' },
  { file: 'For you.ogg', title: 'For you', artist: 'Czxttkl · 陈正瑆', license: 'CC BY-SA 3.0', credit: 'Czxttkl（作品描述注明陈正瑆创作）' },
  { file: '二泉映月.ogg', title: '二泉映月（二胡）', artist: '阿炳作曲 · 张沛坚演奏', license: 'CC BY-SA 4.0', credit: '张沛坚（演奏）；原曲：阿炳' },
].map(song => ({ ...song, id: `commons:${song.file}`, album: 'Wikimedia Commons · 授权中文音乐', format: `OGG · ${song.license}`, url: commonsFile(song.file), source: commonsPage(song.file), provider: 'Wikimedia Commons' }));
const chineseBatchKey = 'shenghai-openverse-chinese-v1';
let chineseBatchSongs = loadChineseBatch();
let chineseBatchBusy = false;
function loadChineseBatch() {
  try { const rows = JSON.parse(localStorage.getItem(chineseBatchKey) || '[]'); return Array.isArray(rows) ? rows : []; }
  catch { return []; }
}
const freeFiles = [
  ['The Entertainer', 'Scott Joplin', 'The Entertainer - Scott Joplin.ogg', '公有领域'],
  ['Maple Leaf Rag (1916 piano roll)', 'Scott Joplin', 'Maple Leaf Rag - played by Scott Joplin 1916 sample.ogg', '公有领域'],
  ['Palm Leaf Rag', 'Scott Joplin · Gnissah', 'Scott Joplin - Palm Leaf Rag (1903).ogg', 'CC BY-SA 3.0'],
  ['Original Rags', 'Scott Joplin · Gnissah', 'Scott Joplin - Original Rags (1899).ogg', 'CC BY-SA 3.0'],
  ['Paragon Rag', 'Scott Joplin · James Brigham', 'Paragon Rag - Scott Joplin - 1909.ogg', '公有领域'],
  ['Searchlight Rag', 'Scott Joplin · Elektrik Shoos', 'Searchlight Rag.ogg', '公有领域'],
  ['Maple Leaf Rag', 'Scott Joplin · Pracchia-78', 'Scott Joplin - Maple Leaf Rag.ogg', '公有领域'],
  ['Maple Leaf Rag (1916)', 'Scott Joplin', 'Maple leaf rag - played by Scott Joplin 1916 V2.ogg', '公有领域'],
  ['Wall Street Rag', 'Scott Joplin', '"Wall Street Rag", by Scott Joplin (1909).oga', '公有领域'],
  ['Magnetic Rag', 'Scott Joplin', 'Magnetic Rag.ogg', '公有领域'],
  ['Severe Tire Damage', 'Kevin MacLeod', 'Kevin MacLeod - Severe Tire Damage (cc-by) (incompetech).ogg', 'CC BY 4.0'],
  ['Dream Catcher', 'Kevin MacLeod', 'Kevin MacLeod - Dream Catcher (cc-by) (incompetech).ogg', 'CC BY 3.0'],
  ['Parisian', 'Kevin MacLeod', 'Kevin MacLeod - Parisian.ogg', 'CC BY 3.0'],
  ['Canon in D Major', 'Kevin MacLeod · J. Pachelbel', 'Kevin MacLeod - Canon in D Major.ogg', 'CC BY 3.0'],
  ['Wholesome', 'Kevin MacLeod', 'Wholesome by Kevin MacLeod.ogg', 'CC BY 4.0'],
  ['Monkeys Spinning Monkeys', 'Kevin MacLeod', 'Monkeys Spinning Monkeys by Kevin MacLeod.ogg', 'CC BY 4.0'],
  ['Hitman', 'Kevin MacLeod', 'Hitman_by_Kevin_MacLeod.ogg', 'CC BY 4.0'],
  ['The Ice Giants', 'Kevin MacLeod', 'Kevin MacLeod - The Ice Giants.ogg', 'CC BY 4.0'],
  ['Solfeggietto', 'Carl Philipp Emanuel Bach · Nieb', 'Carl Philipp Emanuel Bach - Solfeggietto.ogg', '公有领域'],
  ['Egmont Overture, Op. 84', 'Beethoven · Musopen Symphony Orchestra', 'Beethoven EgmontOvertureOp.84 LudwigVanBeethoven-EgmontOvertureOp.84.ogg', 'CC0'],
  ['Goldberg Variations: Aria', 'J. S. Bach · Kimiko Ishizaka', 'Goldberg Variations 01 Aria.ogg', 'CC0'],
  ['Don Juan’s Serenade', 'Tchaikovsky · Mario Ancona', 'Tchaïkovski - Sérénade de Don Juan par Mario Ancona - 1904.ogg', '公有领域'],
  ['A Certain Party Rag', 'Tom Kelley', '"A Certain Party Rag", by Tom Kelley (1910, Ragtime piano).oga', '公有领域'],
  ['Symphony No. 9: Movement II', 'Ludwig van Beethoven', 'Sym 9 Second Movement.ogg', 'CC0'],
  ['Auld Lang Syne', 'U.S. Army Band', 'Auld Lang Syne - U.S. Army Band.ogg', '公有领域'],
  ['The Star-Spangled Banner', 'U.S. Army Band', 'The Star-Spangled Banner - U.S. Army Band.ogg', '公有领域'],
  ['O Tannenbaum', 'U.S. Army Band', 'U.S. Army Band - O Tannenbaum.ogg', '公有领域'],
  ['The Army Goes Rolling Along', 'U.S. Army Band', 'The Army Goes Rolling Along - U.S. Army Band.ogg', '公有领域'],
  ['Good King Wenceslaus', 'U.S. Army Band', 'U.S. Army Band - Good King Wenceslaus.ogg', '公有领域'],
  ['Hark! The Herald Angels Sing', 'U.S. Army Band', 'U.S. Army Band - Hark! The Herald Angels Sing.ogg', '公有领域'],
].map(([title, artist, file, license]) => ({ id: `commons:${file}`, title, artist, album: 'Wikimedia Commons · 开放音乐', format: `OGG · ${license === '公有领域' ? 'PD' : license.replace('CC ', '')}`, url: commonsFile(file), source: commonsPage(file), license, provider: 'Wikimedia Commons' }));
const radioStations = [
  { title: 'Radio Paradise', detail: '人工编排的摇滚、世界音乐、电子、古典与爵士混播。', quality: 'FLAC · 官方网页播放器', url: 'https://new.radioparadise.com/', mark: 'RP' },
  { title: 'SomaFM · Groove Salad', detail: '氛围电子与 chillout；可直接播放 SomaFM 官方直播流。', quality: 'MP3 256 kbps · 免费直播', url: 'https://somafm.com/groovesalad/', stream: 'https://ice5.somafm.com/groovesalad-256-mp3', format: 'MP3 256', mark: 'GS' },
  { title: 'SomaFM · Drone Zone', detail: '舒缓的氛围音乐与长音景，适合专注和放松。', quality: 'MP3 256 kbps · 免费直播', url: 'https://somafm.com/dronezone/', stream: 'https://ice5.somafm.com/dronezone-256-mp3', format: 'MP3 256', mark: 'DZ' },
  { title: 'SomaFM · Secret Agent', detail: '电影配乐感的间谍、复古与电子音乐选曲。', quality: 'MP3 128 kbps · 免费直播', url: 'https://somafm.com/secretagent/', stream: 'https://ice5.somafm.com/secretagent-128-mp3', format: 'MP3 128', mark: 'SA' },
];
audio.volume = .75;

function loadLikes() { try { return JSON.parse(localStorage.getItem('openwave-likes') || '{}'); } catch { return {}; } }
function saveLikes() { localStorage.setItem('openwave-likes', JSON.stringify(Object.fromEntries(Object.entries(state.likes).filter(([, track]) => !track.local)))); }
function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])); }
function hasHan(value) { return /\p{Script=Han}/u.test(String(value || '')); }
function time(seconds) { if (!Number.isFinite(seconds)) return '0:00'; const s = Math.floor(seconds); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function artStyle(track) { return track.artwork ? `style="background-image:url('${escapeHTML(track.artwork).replace(/'/g, '%27')}')"` : ''; }
function isLoved(track) { return Boolean(state.likes[track.id]); }

function renderTracks() {
  $('chineseGrid').hidden = true;
  if (state.view === 'radio') return renderRadio();
  $('radioGrid').hidden = true;
  document.querySelector('.table-head').hidden = false;
  const tracks = state.view === 'likes' ? Object.values(state.likes) : state.view === 'local' ? state.local : state.tracks;
  $('trackList').innerHTML = tracks.map((track, i) => `<div class="track-row" data-index="${i}"><div class="track-main"><div class="track-art" ${artStyle(track)}>${track.artwork ? '' : '♫'}</div><div class="track-meta"><strong title="${escapeHTML(track.title)}">${escapeHTML(track.title)}</strong><span>${escapeHTML(track.artist)}</span></div></div><div class="track-album" title="${escapeHTML(track.album)}">${escapeHTML(track.album)}</div><div><span class="track-format">${escapeHTML(track.format)}</span></div><div class="track-actions"><button data-action="like" title="收藏" class="${isLoved(track) ? 'loved' : ''}">${isLoved(track) ? '♥' : '♡'}</button>${track.source ? '<button data-action="source" title="查看来源与授权">↗</button>' : ''}</div></div>`).join('');
  if (state.view === 'likes') $('status').textContent = tracks.length ? '' : '你还没有收藏歌曲。';
  if (state.view === 'local') $('status').textContent = tracks.length ? '' : '点击右上角「导入本地音乐」添加文件。';
  if (state.view === 'discover' || state.view === 'search') $('status').textContent = tracks.length ? '' : state.loading ? '正在查找开放音乐…' : '没有找到带开放授权标记的可播放音乐。换个关键词试试。';
  $('moreButton').hidden = !['discover','search'].includes(state.view) || !tracks.length;
}

function renderRadio() {
  $('chineseGrid').hidden = true;
  document.querySelector('.table-head').hidden = true;
  $('radioGrid').hidden = false;
  $('radioGrid').innerHTML = `${radioStations.map((station, i) => `<article class="radio-card"><div class="radio-mark">${escapeHTML(station.mark)}</div><h3>${escapeHTML(station.title)}</h3><p>${escapeHTML(station.detail)}</p><p class="radio-quality">${escapeHTML(station.quality)}</p>${station.stream ? `<button class="radio-play" data-radio-index="${i}">▶ 在声海音乐播放</button>` : ''}<a href="${escapeHTML(station.url)}" target="_blank" rel="noopener noreferrer">官方电台页面 ↗</a></article>`).join('')}<p class="radio-note">这些是授权电台的实时节目，并非点播曲库。SomaFM 直播面向个人收听；选择「在声海音乐播放」会直接连接其官方 MP3 流。如无法播放，可点官方电台页面测试网络访问。</p>`;
  $('status').textContent = '';
  $('moreButton').hidden = true;
}

function renderChinese() {
  document.querySelector('.table-head').hidden = true;
  $('trackList').innerHTML = '';
  $('radioGrid').hidden = true;
  $('chineseGrid').hidden = false;
  const playlistUrl = 'https://music.douyin.com/qishui/share/playlist?playlist_id=7200303561195061287';
  const officialSongs = [
    ['梦的翅膀受了伤（SouMix Remix）', '蒋雪儿Snow.J'], ['枪火', '宝石Gem'], ['思念像一条鱼', '彭星越'],
    ['玻璃', 'Gareth.T'], ['恋人', '李荣浩'], ['回忆起了风', '橘鳥与魚餠'],
    ['雀跃', '任然、小来'], ['失眠了', '吴琳珂 Moske'], ['来不及爱你', 'h3R3'],
    ['茶花开了，该回家了', '王睿卓、加木'], ['小半', '陈粒'], ['咏春', '七朵组合'], ['红色高跟鞋', '蔡健雅'], ['唯一', 'G.E.M. 邓紫棋'],
  ];
  const licenseLink = song => `<a href="https://creativecommons.org/licenses/${song.license.toLowerCase().replaceAll(' ', '-')}/" target="_blank" rel="noopener noreferrer">${escapeHTML(song.license)}</a>`;
  const allLicensedSongs = [...chineseLicensedSongs, ...chineseBatchSongs];
  const openRows = allLicensedSongs.map((song, i) => `<div class="chinese-song-row"><button class="chinese-song chinese-local-play" data-chinese-track="${i}"><span class="chinese-song-index">▶</span><span class="chinese-song-meta"><strong>${escapeHTML(song.title)}</strong><small>${escapeHTML(song.artist)} · ${escapeHTML(song.format || 'Audio')}</small></span><span class="chinese-official-tag">声海内播放</span></button><div class="chinese-license-link">${song.license?.startsWith('http') ? `<a href="${escapeHTML(song.license)}" target="_blank" rel="noopener noreferrer">许可</a>` : licenseLink(song)} · <a href="${escapeHTML(song.source || '#')}" target="_blank" rel="noopener noreferrer">来源 ↗</a></div></div>`).join('');
  $('chineseGrid').innerHTML = `<div class="chinese-playlist"><div class="chinese-list-head"><div><div class="radio-mark">华</div><h3>授权中文歌曲 · 站内播放</h3><p>从开放曲库搜集中文标题/作者且带许可标记的音源。</p></div><div class="chinese-batch-actions"><strong>${allLicensedSongs.length} 首</strong><button id="gatherChineseButton" class="more-button" ${chineseBatchBusy ? 'disabled' : ''}>${chineseBatchBusy ? '正在搜集…' : chineseBatchSongs.length ? '继续搜集至 1000 首' : '批量搜集中文授权歌曲'}</button></div></div><div class="chinese-song-list">${openRows}</div><p id="chineseBatchStatus" class="radio-note">已收录 ${allLicensedSongs.length} 首（其中 ${chineseBatchSongs.length} 首来自 Openverse 搜索结果）。Openverse 的许可字段是来源标注，逐首点“授权信息/来源”核验原始页面；搜索结果可能包含器乐、重复版本或误标。批量搜集会去重，并只保留标题或作者含中文字符、且同时有音频链接与许可链接的结果。</p><div class="chinese-list-head official-chart-head"><div><div class="radio-mark">榜</div><h3>抖音热歌 · 中文流行</h3><p>官方公开歌单；歌曲需前往汽水音乐播放。</p></div><a href="${playlistUrl}" target="_blank" rel="noopener noreferrer">打开完整歌单 ↗</a></div><div class="chinese-song-list">${officialSongs.map(([title, artist], i) => `<a class="chinese-song" href="${playlistUrl}" target="_blank" rel="noopener noreferrer"><span class="chinese-song-index">${String(i + 1).padStart(2, '0')}</span><span class="chinese-song-meta"><strong>${escapeHTML(title)}</strong><small>${escapeHTML(artist)}</small></span><span class="chinese-official-tag">去汽水音乐 ↗</span></a>`).join('')}</div><p class="radio-note">抖音 / 汽水音乐歌曲是否免费、完整可播或需要登录/会员，以平台提示为准。</p></div>`;
  $('gatherChineseButton').addEventListener('click', gatherChineseSongs);
  $('status').textContent = '';
  $('moreButton').hidden = true;
}

function playRadioStation(station) {
  const track = { id: `radio:${station.mark}`, title: station.title, artist: 'SomaFM · 正版直播', album: 'Live Radio', format: station.format, url: station.stream, source: station.url };
  state.queue = [track]; state.index = 0; state.current = track;
  audio.src = track.url;
  audio.play().then(() => { $('playerArtist').textContent = '正在直播 · SomaFM'; }).catch(() => { $('playerArtist').textContent = '流连接失败：请检查是否能访问 somafm.com'; });
  $('playerTitle').textContent = track.title;
  $('playerArtist').textContent = '正在连接 SomaFM…';
  $('playerArt').style.backgroundImage = '';
  $('playerArt').textContent = '◖))';
  $('formatBadge').textContent = track.format;
  $('likeCurrent').classList.remove('loved'); $('likeCurrent').textContent = '♡';
  renderQueue();
}

function setView(view) {
  state.view = view;
  document.querySelectorAll('.nav').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  $('hero').hidden = view !== 'discover';
  $('chips').hidden = ['likes','local','radio','chinese'].includes(view);
  $('searchInput').closest('.searchbox').hidden = ['radio','chinese'].includes(view);
  $('sectionKicker').textContent = ({discover:'CURATED FOR YOU',search:'SEARCH RESULTS',likes:'YOUR COLLECTION',local:'ON THIS DEVICE',radio:'LIVE · LICENSED RADIO',chinese:'OPEN CHINESE MUSIC'})[view];
  $('sectionTitle').textContent = ({discover:'发现好音乐',search:'搜索结果',likes:'我喜欢',local:'本地音乐',radio:'高音质正版电台',chinese:'授权中文歌曲与热门榜'})[view];
  $('sectionNote').textContent = ({discover:'收录 Wikimedia Commons 开放音乐；网络可用时继续补充',search:state.query ? `关键词：${state.query}` : '浏览开放曲库',likes:'你的私人收藏',local:'仅在本次打开期间保留',radio:'直播收听 · 部分电台支持 FLAC',chinese:'站内播放已授权音源 · 官方热歌榜单'})[view];
  if (view === 'search') $('searchInput').focus();
  if (view === 'chinese') renderChinese();
  else if (view === 'radio') renderRadio();
  else renderTracks();
}

async function searchOpenverseInBrowser(query, page) {
  const url = new URL('https://api.openverse.org/v1/audio/');
  url.searchParams.set('q', query || 'music');
  url.searchParams.set('page', String(page));
  url.searchParams.set('page_size', '20');
  url.searchParams.set('categories', 'music');
  url.searchParams.set('license', 'by,by-sa,by-nd,by-nc,by-nc-sa,by-nc-nd,cc0,pdm');
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Openverse 返回 ${response.status}`);
  const data = await response.json();
  return (data.results || []).filter(t => t.url && t.license_url).map(t => ({
    id: `openverse:${t.id}`, title: t.title || 'Untitled recording', artist: t.creator || 'Unknown creator',
    album: t.provider || t.source || 'Openverse', format: String(t.filetype || 'AUDIO').toUpperCase(),
    size: Number(t.filesize || 0), duration: Number(t.duration || 0), url: t.url,
    artwork: t.thumbnail || null, source: t.foreign_landing_url || t.detail_url,
    license: t.license_url, provider: `Openverse · ${t.license || 'licensed'}`,
  }));
}

async function gatherChineseSongs() {
  if (chineseBatchBusy) return;
  chineseBatchBusy = true;
  renderChinese();
  const status = $('chineseBatchStatus');
  const btn = $('gatherChineseButton');
  const queries = ['中文歌曲', '华语歌曲', '中国歌曲', 'Chinese song', 'Mandarin song', 'Cantonese song', 'Chinese folk song', '中国民歌', '台湾歌曲', '粤语歌曲'];
  const existing = new Set([...chineseLicensedSongs, ...chineseBatchSongs].map(t => t.id));
  let added = 0, pagesDone = 0;
  try {
    for (const query of queries) {
      let page = 1;
      while (page <= 50 && chineseBatchSongs.length + chineseLicensedSongs.length < 1000) {
        const url = new URL('https://api.openverse.org/v1/audio/');
        url.searchParams.set('q', query);
        url.searchParams.set('page', String(page));
        url.searchParams.set('page_size', '50');
        url.searchParams.set('categories', 'music');
        url.searchParams.set('license', 'by,by-sa,by-nd,by-nc,by-nc-sa,by-nc-nd,cc0,pdm');
        url.searchParams.set('filter_dead', 'true');
        const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error(`Openverse 返回 ${response.status}`);
        const data = await response.json();
        const rows = data.results || [];
        for (const t of rows) {
          const text = `${t.title || ''} ${t.creator || ''} ${(t.tags || []).map(tag => typeof tag === 'string' ? tag : tag.name || '').join(' ')}`;
          if (!hasHan(text) || !t.url || !t.license_url || !t.id || existing.has(`openverse:${t.id}`)) continue;
          const track = { id: `openverse:${t.id}`, title: t.title || '未命名音源', artist: t.creator || '作者未标注', album: t.provider || t.source || 'Openverse', format: String(t.filetype || 'AUDIO').toUpperCase(), size: Number(t.filesize || 0), duration: Number(t.duration || 0), url: t.url, artwork: t.thumbnail || null, source: t.foreign_landing_url || t.detail_url, license: t.license_url, provider: `Openverse · ${t.license || 'licensed'}` };
          existing.add(track.id); chineseBatchSongs.push(track); added++;
        }
        pagesDone++;
        localStorage.setItem(chineseBatchKey, JSON.stringify(chineseBatchSongs));
        status.textContent = `已查 ${pagesDone} 页，新增 ${added} 首中文元数据匹配音源；累计 ${chineseBatchSongs.length + chineseLicensedSongs.length} 首。`;
        document.querySelector('.chinese-batch-actions strong').textContent = `${chineseBatchSongs.length + chineseLicensedSongs.length} 首`;
        if (!rows.length || page >= Number(data.page_count || 1)) break;
        page++;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      if (chineseBatchSongs.length + chineseLicensedSongs.length >= 1000) break;
    }
    status.textContent = added
      ? `本次新增 ${added} 首；累计 ${chineseBatchSongs.length + chineseLicensedSongs.length} 首。若不足 1000，表示当前可访问的开放曲库搜索结果不足或需继续尝试。`
      : `本次没有新增结果；累计 ${chineseBatchSongs.length + chineseLicensedSongs.length} 首。检查网络/API 访问，或当前开放曲库没有更多匹配结果。`;
    document.querySelector('.chinese-batch-actions strong').textContent = `${chineseBatchSongs.length + chineseLicensedSongs.length} 首`;
  } catch (error) {
    status.textContent = `搜集在第 ${pagesDone + 1} 页中断：${error.message}。已保存并去重 ${chineseBatchSongs.length} 首，可稍后继续。`;
    document.querySelector('.chinese-batch-actions strong').textContent = `${chineseBatchSongs.length + chineseLicensedSongs.length} 首`;
  } finally {
    chineseBatchBusy = false;
    btn.disabled = false;
    btn.textContent = chineseBatchSongs.length + chineseLicensedSongs.length >= 1000 ? '已达到 1000 首' : '继续搜集至 1000 首';
  }
}

async function search(query = '', append = false) {
  if (state.loading) return;
  state.loading = true;
  if (!append) {
    state.page = 1;
    const needle = query.toLocaleLowerCase();
    state.tracks = freeFiles.filter(track => {
      const artist = track.artist.toLowerCase();
      const genre = artist.includes('scott joplin') || /rag/i.test(track.title) ? 'jazz piano ragtime'
        : artist.includes('kevin macleod') ? 'electronic instrumental cinematic'
        : artist.includes('army band') ? 'march band traditional'
        : 'classical piano orchestra';
      return !needle || `${track.title} ${track.artist} ${genre}`.toLocaleLowerCase().includes(needle);
    });
  }
  state.query = query;
  setView(query ? 'search' : 'discover');
  $('status').textContent = '正在查找开放音乐…';
  try {
    let directError;
    let results;
    try {
      results = await searchOpenverseInBrowser(query, append ? state.page : 1);
    } catch (error) {
      directError = error;
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&page=${append ? state.page : 1}`);
      const data = await response.json();
      if (!response.ok) throw new Error(`${directError.message}；备用曲库：${data.error || '暂不可用'}`);
      results = data.tracks || [];
    }
    if (hasHan(query)) results = results.filter(track => hasHan(`${track.title} ${track.artist}`));
    const seen = new Set(state.tracks.map(x => x.id));
    state.tracks.push(...results.filter(x => !seen.has(x.id)));
    if (append) state.page += 1;
    else state.page = 2;
    $('status').textContent = '';
  } catch (error) {
    $('moreButton').hidden = true;
    if (state.view === 'discover' || state.view === 'search') $('status').textContent = state.tracks.length
      ? `在线曲库暂不可用，先为你显示 ${state.tracks.length} 首已收录开放音乐。`
      : `曲库搜索暂不可用：${error.message}。正版电台和本地音乐仍可播放。`;
  } finally {
    state.loading = false;
    if (state.tracks.length) renderTracks();
  }
}

function currentList() { return state.view === 'likes' ? Object.values(state.likes) : state.view === 'local' ? state.local : state.tracks; }
function playFromList(index) { state.queue = [...currentList()]; state.index = index; playIndex(index); }
function playIndex(index) {
  if (!state.queue.length || index < 0 || index >= state.queue.length) return;
  state.index = index;
  const track = state.queue[index];
  state.current = track;
  audio.src = track.url;
  audio.play().catch(() => { $('playerArtist').textContent = '无法播放此音源，请尝试下一首'; });
  $('playerTitle').textContent = track.title;
  $('playerArtist').textContent = track.artist;
  $('playerArt').style.backgroundImage = track.artwork ? `url("${track.artwork.replace(/"/g, '%22')}")` : '';
  $('playerArt').textContent = track.artwork ? '' : '♫';
  $('formatBadge').textContent = track.format || 'SOURCE';
  $('likeCurrent').classList.toggle('loved', isLoved(track));
  $('likeCurrent').textContent = isLoved(track) ? '♥' : '♡';
  renderQueue();
}
function next() {
  if (!state.queue.length) return;
  if (state.shuffle && state.queue.length > 1) { let i; do { i = Math.floor(Math.random() * state.queue.length); } while (i === state.index); playIndex(i); }
  else if (state.index + 1 < state.queue.length) playIndex(state.index + 1);
  else if (state.repeat === 'all') playIndex(0);
}
function previous() { if (audio.currentTime > 3) audio.currentTime = 0; else playIndex(Math.max(0, state.index - 1)); }
function toggleLike(track) {
  if (!track) return;
  if (isLoved(track)) delete state.likes[track.id];
  else state.likes[track.id] = track;
  saveLikes(); renderTracks();
  if (state.current?.id === track.id) { $('likeCurrent').classList.toggle('loved', isLoved(track)); $('likeCurrent').textContent = isLoved(track) ? '♥' : '♡'; }
}
function renderQueue() {
  $('queueList').innerHTML = state.queue.map((t, i) => `<div class="queue-item ${i === state.index ? 'active' : ''}" data-index="${i}"><strong>${escapeHTML(t.title)}</strong><span>${escapeHTML(t.artist)}</span></div>`).join('') || '<div class="status">队列是空的</div>';
}

document.querySelectorAll('.nav').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
document.querySelectorAll('.chip').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.chip').forEach(x => x.classList.toggle('selected', x === button));
  $('searchInput').value = button.dataset.query;
  search(button.dataset.query);
}));
$('searchInput').addEventListener('keydown', event => { if (event.key === 'Enter') search(event.target.value.trim()); });
$('exploreButton').addEventListener('click', () => { document.querySelector('.content').scrollIntoView({ behavior: 'smooth' }); });
$('moreButton').addEventListener('click', () => search(state.query, true));
$('radioGrid').addEventListener('click', event => {
  const button = event.target.closest('[data-radio-index]');
  if (button) playRadioStation(radioStations[Number(button.dataset.radioIndex)]);
});
$('chineseGrid').addEventListener('click', event => {
  const button = event.target.closest('[data-chinese-track]');
  if (!button) return;
  const all = [...chineseLicensedSongs, ...chineseBatchSongs];
  const track = all[Number(button.dataset.chineseTrack)];
  if (!track) return;
  state.queue = all; state.index = Number(button.dataset.chineseTrack); playIndex(state.index);
});
$('trackList').addEventListener('click', event => {
  const row = event.target.closest('.track-row'); if (!row) return;
  const track = currentList()[Number(row.dataset.index)]; if (!track) return;
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'like') toggleLike(track);
  else if (action === 'source') { if (track.source) window.open(track.source, '_blank', 'noopener,noreferrer'); }
  else playFromList(Number(row.dataset.index));
});
$('importButton').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', event => {
  const files = Array.from(event.target.files || []);
  state.local.push(...files.map(file => ({ id: `local:${Date.now()}:${Math.random()}`, title: file.name.replace(/\.[^.]+$/, ''), artist: '本地文件', album: '我的音乐', format: (file.name.split('.').pop() || 'AUDIO').toUpperCase(), url: URL.createObjectURL(file), local: true, source: null })));
  setView('local'); event.target.value = '';
});
$('playButton').addEventListener('click', () => { if (!audio.src && currentList().length) playFromList(0); else if (audio.paused) audio.play().catch(() => {}); else audio.pause(); });
$('nextButton').addEventListener('click', next); $('prevButton').addEventListener('click', previous);
$('shuffleButton').addEventListener('click', () => { state.shuffle = !state.shuffle; $('shuffleButton').classList.toggle('active', state.shuffle); });
$('repeatButton').addEventListener('click', () => { state.repeat = state.repeat === 'all' ? 'one' : state.repeat === 'one' ? 'off' : 'all'; $('repeatButton').textContent = state.repeat === 'one' ? '↺¹' : '↻'; $('repeatButton').classList.toggle('active', state.repeat !== 'off'); $('repeatButton').title = `循环模式：${state.repeat}`; });
$('likeCurrent').addEventListener('click', () => toggleLike(state.current));
$('queueButton').addEventListener('click', () => { $('queuePanel').hidden = !$('queuePanel').hidden; renderQueue(); });
$('closeQueue').addEventListener('click', () => { $('queuePanel').hidden = true; });
$('queueList').addEventListener('click', event => { const row = event.target.closest('.queue-item'); if (row) playIndex(Number(row.dataset.index)); });
$('volume').addEventListener('input', event => { audio.volume = Number(event.target.value) / 100; });
$('seek').addEventListener('input', event => { if (Number.isFinite(audio.duration)) audio.currentTime = Number(event.target.value) / 1000 * audio.duration; });
audio.addEventListener('timeupdate', () => { $('currentTime').textContent = time(audio.currentTime); $('duration').textContent = time(audio.duration); $('seek').value = Number.isFinite(audio.duration) && audio.duration ? Math.round(audio.currentTime / audio.duration * 1000) : 0; });
audio.addEventListener('play', () => { $('playButton').textContent = 'Ⅱ'; });
audio.addEventListener('pause', () => { $('playButton').textContent = '▶'; });
audio.addEventListener('ended', () => { if (state.repeat === 'one') { audio.currentTime = 0; audio.play().catch(() => {}); } else next(); });
audio.addEventListener('error', () => { if (state.current?.id?.startsWith('radio:')) $('playerArtist').textContent = '电台流连接失败：检查 somafm.com 网络访问'; });
document.addEventListener('keydown', event => { if (event.code === 'Space' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); $('playButton').click(); } });
if (new URLSearchParams(location.search).get('view') === 'chinese') setView('chinese');
else search();
