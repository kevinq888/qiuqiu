// 排行榜中心：四张榜单（热门/新歌/推荐/本站点播）、每日快照走势对比、全站播放计数。
const fs = require('node:fs');
const path = require('node:path');
const { ranking, sourcePage, MAX_PAGES } = require('./rankings');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STATS_FILE = path.join(DATA_DIR, 'play-stats.json');
const SNAPSHOT_FILE = path.join(DATA_DIR, 'chart-snapshots.json');
const KEEP_DAYS = 60;          // 播放计数保留 60 天，与音频缓存策略一致
const LOCAL_WINDOW_DAYS = 7;   // 本站点播榜统计最近 7 天
const TREND_DEPTH = 40;        // 走势对比只跟踪各榜前 40 名

const CHARTS = {
  hot: { name: '热门榜', eyebrow: 'THE HOT LIST', icon: 'flame', description: '全站热播曲目实时排行，跟着大家一起听。' },
  new: { name: '新歌榜', eyebrow: 'NEW RELEASES', icon: 'clock', description: '最新上架歌曲速报，先听为快。' },
  recommend: { name: '推荐榜', eyebrow: "EDITOR'S PICK", icon: 'spark', description: '编辑精选好歌，每一首都值得一听。' },
  local: { name: '本站点播榜', eyebrow: 'QIUQIU TOP', icon: 'headphones', description: '根据本站听众最近 7 天的真实点播生成，越听越靠前。' },
};

function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function load(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function persist(file, data) {
  const temp = `${file}.${process.pid}.tmp`;
  fs.promises.mkdir(DATA_DIR, { recursive: true })
    .then(() => fs.promises.writeFile(temp, JSON.stringify(data)))
    .then(() => fs.promises.rename(temp, file))
    .catch(() => {});
}

// ---------- 播放计数（本站点播榜数据源） ----------

const stats = load(STATS_FILE, { songs: {} });
let statsTimer = null;

function recordPlay(id, title) {
  id = String(id || '').trim();
  title = String(title || '').trim();
  if (!/^\d+$/.test(id) || !title || title.length > 200) return false;
  const entry = stats.songs[id] || (stats.songs[id] = { title, days: {} });
  entry.title = title;
  const today = dayKey();
  entry.days[today] = (entry.days[today] || 0) + 1;
  // 保留最近 KEEP_DAYS 天，过期数据直接清除
  const cutoff = dayKey(new Date(Date.now() - KEEP_DAYS * 86400000));
  for (const day of Object.keys(entry.days)) if (day < cutoff) delete entry.days[day];
  if (!Object.keys(entry.days).length) delete stats.songs[id];
  if (!statsTimer) {
    statsTimer = setTimeout(() => { statsTimer = null; persist(STATS_FILE, stats); }, 3000);
  }
  return true;
}

function localChart(limit = 50) {
  const since = dayKey(new Date(Date.now() - LOCAL_WINDOW_DAYS * 86400000));
  return Object.entries(stats.songs)
    .map(([id, entry]) => ({
      id,
      title: entry.title,
      plays: Object.entries(entry.days).reduce((sum, [day, n]) => (day >= since ? sum + n : sum), 0),
    }))
    .filter(song => song.plays > 0)
    .sort((a, b) => b.plays - a.plays)
    .slice(0, limit);
}

// ---------- 每日快照与走势 ----------

const snapshots = load(SNAPSHOT_FILE, {});

// 返回 Map(id -> 上升名次 | 负数下降 | 0 持平 | 'new')
function trendFor(kind, ids) {
  const today = dayKey();
  let snap = snapshots[kind];
  if (!snap || snap.date !== today) {
    snap = {
      date: today,
      order: ids.slice(0, TREND_DEPTH),
      prev: snap && Array.isArray(snap.order) ? { date: snap.date, order: snap.order } : null,
    };
    snapshots[kind] = snap;
    persist(SNAPSHOT_FILE, snapshots);
  }
  const prevRank = new Map((snap.prev ? snap.prev.order : []).map((id, i) => [String(id), i + 1]));
  const trend = new Map();
  ids.forEach((id, i) => {
    const before = prevRank.get(String(id));
    trend.set(String(id), before === undefined ? 'new' : before - (i + 1));
  });
  return trend;
}

// ---------- 榜单数据 ----------

async function chartItems(kind) {
  if (kind === 'local') return { items: localChart(), plays: true };
  if (kind === 'new') {
    const results = await Promise.all([sourcePage(1), sourcePage(2)]);
    const seen = new Set();
    const items = [];
    for (const result of results) {
      for (const song of result.items) {
        if (!seen.has(String(song.id))) { items.push(song); seen.add(String(song.id)); }
      }
    }
    return { items, stale: results.some(r => r.stale) };
  }
  const data = await ranking(kind === 'recommend' ? 'recommend' : 'hot', 1);
  return { items: data.items, stale: data.stale };
}

// 榜单中心卡片用：各榜 Top 20 + 走势
async function chartTop(kind) {
  const { items, stale, plays } = await chartItems(kind);
  const top = items.slice(0, 20);
  return { kind, def: CHARTS[kind], items: top, trend: trendFor(kind, top.map(s => String(s.id))), stale: !!stale, plays: !!plays };
}

// 完整榜单页用：分页数据，首页带走势
async function chartPageData(kind, requestedPage) {
  if (kind === 'local') {
    const all = localChart(50);
    const pages = Math.max(1, Math.ceil(all.length / 20));
    const page = Math.max(1, Math.min(pages, Number.isSafeInteger(requestedPage) ? requestedPage : 1));
    return {
      items: all.slice((page - 1) * 20, page * 20),
      page, pages, plays: true,
      trend: trendFor('local', all.map(s => String(s.id))),
    };
  }
  if (kind === 'new') {
    const page = Math.max(1, Math.min(MAX_PAGES, Number.isSafeInteger(requestedPage) ? requestedPage : 1));
    const results = await Promise.all([sourcePage(2 * page - 1), sourcePage(2 * page)]);
    const seen = new Set();
    const items = [];
    for (const result of results) {
      for (const song of result.items) {
        if (!seen.has(String(song.id))) { items.push(song); seen.add(String(song.id)); }
      }
    }
    return {
      items: items.slice(0, 20), page, pages: MAX_PAGES,
      stale: results.some(r => r.stale),
      trend: page === 1 ? trendFor('new', items.map(s => String(s.id))) : null,
    };
  }
  const data = await ranking(kind, requestedPage);
  return { ...data, trend: data.page === 1 ? trendFor(kind, data.items.map(s => String(s.id))) : null };
}

module.exports = { CHARTS, chartTop, chartPageData, recordPlay, localChart };
