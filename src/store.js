// 数据层：加载种子数据，构建歌曲索引与搜索
const fs = require('node:fs');
const path = require('node:path');

const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'seed.json'), 'utf8'));

// 解码抓取数据中残留的 HTML 实体
function decodeEntities(s) {
  return String(s ?? '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// 就地清洗所有种子列表的标题
for (const list of Object.values(seed)) {
  if (!Array.isArray(list)) continue;
  for (const item of list) {
    if (item && typeof item.title === 'string') {
      item.title = decodeEntities(item.title).replace(/\s+/g, ' ').trim();
    }
  }
}

// 播放/下载外链规则（与原站一致：按标题拼接 CDN 地址）
const CDN_BASE = 'https://cdn.m3u8.liyuncss.guoguo.org.cn/links/hiresmp3/news';

// 部分歌曲的详情补充（专辑封面、歌词等，来自原站抓取）
const detailOverrides = {
  '1292': {
    cover: 'https://img3.kuwo.cn/star/albumcover/500/95/98/377962709.jpg',
    lyrics: '凭什么要失望藏眼泪到心脏往事不会说谎别跟它为难我们两人之间不需要这样我想修炼爱情的心酸学会放好以前的渴望我们那些信仰要忘记多难远距离的欣赏近距离的迷惘谁说太阳会找到月亮别人有的爱我们不可能模仿修炼爱情的悲欢我们这些努力不简单快乐炼成泪水是一种勇敢几年前的幻想几年后的原谅为一张脸去养一身伤别讲想念我我会受不了这样记忆它真嚣张路灯把痛点亮情人一起看过多少次月亮它在天空看过多少次遗忘多少心慌修炼爱情的心酸学会放好以前的渴望我们那些信仰要忘记多难远距离的欣赏近距离的迷惘谁说太阳会找到月亮别人有的爱我们不可能模仿修炼爱情的悲欢我们这些努力不简单快乐炼成泪水是一种勇敢几年前的幻想几年后的原谅为一张脸去养一身伤别讲想念我我会受不了这样笑着说爱让人疯狂哭着说爱让人紧张忘不了那个人就投降修炼爱情的悲欢我们这些努力不简单快乐炼成泪水是一种勇敢几年前的幻想几年后的原谅为一张脸去养一身伤别讲想念我我会受不了这样几年前的幻想几年后的原谅为一张脸去养一身伤别讲想念我我会受不了这样',
  },
};

function parseTitle(title) {
  const idx = title.indexOf('-');
  if (idx > 0) {
    return { artist: title.slice(0, idx).trim(), song: title.slice(idx + 1).trim() };
  }
  return { artist: '', song: title.trim() };
}

const songs = new Map();
function addSong(id, title, extra = {}) {
  id = String(id);
  title = decodeEntities(title).replace(/\s+/g, ' ').trim();
  if (!title) return;
  const prev = songs.get(id) || {};
  const { artist, song } = parseTitle(title);
  songs.set(id, {
    id,
    title,
    artist: prev.artist || artist,
    song: prev.song || song,
    date: prev.date || extra.date || '',
    quality: prev.quality || extra.quality || '高品质',
    ...(detailOverrides[id] || {}),
  });
}

for (const x of seed.hot_tags) addSong(x.id, x.title);
for (const x of seed.latest) addSong(x.id, x.title, { date: x.date });
for (const x of seed.rank_recommend) addSong(x.id, x.title);
for (const x of seed.rank_hot) addSong(x.id, x.title);
for (const x of seed.jay_results) addSong(x.id, x.title);
for (const x of seed.collections) addSong(x.id, x.title);
for (const x of seed.viewmor) addSong(x.id, x.title);
for (const x of seed.down) addSong(x.id, x.title);
for (const x of seed.nav1) addSong(x.id, x.title, { date: x.date, quality: x.quality });

function getSong(id) {
  return songs.get(String(id)) || null;
}

function mediaUrl(title) {
  return `${CDN_BASE}/${encodeURIComponent(title)}.m4a`;
}

function searchSongs(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const out = [];
  for (const s of songs.values()) {
    if (s.title.toLowerCase().includes(q) || (s.artist && s.artist.toLowerCase().includes(q))) {
      out.push(s);
    }
  }
  // 标题开头匹配的排前面，其余按 id 倒序（新→旧）
  out.sort((a, b) => {
    const ah = a.title.toLowerCase().startsWith(q) ? 0 : 1;
    const bh = b.title.toLowerCase().startsWith(q) ? 0 : 1;
    if (ah !== bh) return ah - bh;
    return Number(b.id) - Number(a.id);
  });
  return out;
}

module.exports = {
  seed,
  songs,
  getSong,
  mediaUrl,
  searchSongs,
};
