import http from 'node:http';
import https from 'node:https';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const cache = new Map();
const jamendoClientId = process.env.JAMENDO_CLIENT_ID || '';
let jamendoSuspended = false;
const formats = ['flac', 'wav', 'aiff', 'alac', 'm4a', 'mp3', 'ogg', 'opus'];
const allowedLicense = /creativecommons\.org\/licenses\/|creativecommons\.org\/publicdomain\/|creativecommons\.org\/publicdomain\/zero\/|publicdomain/i;

function asText(value, fallback = '') {
  return Array.isArray(value) ? String(value[0] ?? fallback) : String(value ?? fallback);
}

const USER_AGENT = 'ShenghaiMusic/1.0 (personal free music player)';

function httpsGet(urlString, { headers = {}, timeout = 30000, json = false } = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(urlString); } catch { return reject(new Error('bad url')); }
    if (parsed.protocol !== 'https:') return reject(new Error('仅支持 https 上游'));
    const req = https.request(parsed, { method: 'GET', headers, maxHeaderSize: 256 * 1024, timeout }, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        resolve(httpsGet(new URL(res.headers.location, parsed).href, { headers, timeout, json }));
        return;
      }
      if (res.statusCode !== 200 && res.statusCode !== 206) { res.resume(); reject(new Error(`上游服务返回 ${res.statusCode}`)); return; }
      if (!json) { resolve(res); return; }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new Error('上游返回无法解析')); } });
    });
    req.on('timeout', () => req.destroy(new Error('连接上游超时')));
    req.on('error', error => reject(error.message === '连接上游超时' || error.name === 'AbortError' ? new Error('连接上游超时') : new Error('网络不可达或 DNS 解析失败')));
    req.end();
  });
}

async function getJSON(url, timeout = 12000) {
  return httpsGet(url, { headers: { 'User-Agent': USER_AGENT }, timeout, json: true });
}

function audioFiles(files) {
  return (files || []).filter(f => {
    const ext = String(f.name || '').split('.').pop().toLowerCase();
    return formats.includes(ext) && !/sample|preview/i.test(f.name || '');
  }).sort((a, b) => {
    const ea = String(a.name).split('.').pop().toLowerCase();
    const eb = String(b.name).split('.').pop().toLowerCase();
    return formats.indexOf(ea) - formats.indexOf(eb);
  }).slice(0, 30);
}

async function searchMusic(term, page) {
  const safe = term.replace(/[+\-!(){}\[\]^"~*?:\\/]/g, ' ').trim().slice(0, 80);
  const query = `collection:netlabels AND mediatype:audio${safe ? ` AND (${safe.split(/\s+/).map(x => `title:${x} OR creator:${x}`).join(' OR ')})` : ''}`;
  const url = new URL('https://archive.org/advancedsearch.php');
  url.searchParams.set('q', query);
  for (const field of ['identifier', 'title', 'creator', 'date']) url.searchParams.append('fl[]', field);
  url.searchParams.set('rows', '15');
  url.searchParams.set('page', String(page));
  url.searchParams.set('output', 'json');
  if (!safe) url.searchParams.append('sort[]', 'downloads desc');
  const data = await getJSON(url);
  const docs = data.response?.docs || [];
  const items = await Promise.allSettled(docs.map(async doc => {
    const id = asText(doc.identifier);
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(id)) return [];
    const item = await getJSON(`https://archive.org/metadata/${encodeURIComponent(id)}`);
    const metadata = item.metadata || {};
    const license = asText(metadata.licenseurl || metadata.license);
    if (!allowedLicense.test(license)) return [];
    const artist = asText(metadata.creator || doc.creator, 'Unknown artist');
    const album = asText(metadata.title || doc.title, id);
    const cover = (item.files || []).find(f => /\.(jpg|jpeg|png|webp)$/i.test(f.name || '') && /cover|folder|front/i.test(f.name || ''));
    const artwork = cover ? `https://archive.org/download/${encodeURIComponent(id)}/${cover.name.split('/').map(encodeURIComponent).join('/')}` : null;
    return audioFiles(item.files).map((file, index) => {
      const ext = String(file.name).split('.').pop().toUpperCase();
      return {
        id: `${id}:${index}`,
        title: asText(file.title, file.name.replace(/\.[^.]+$/, '').replace(/^\d+[.\s_-]+/, '')),
        artist,
        album,
        format: ext,
        size: Number(file.size || 0),
        duration: Number(file.length || 0),
        url: `https://archive.org/download/${encodeURIComponent(id)}/${file.name.split('/').map(encodeURIComponent).join('/')}`,
        artwork,
        source: `https://archive.org/details/${encodeURIComponent(id)}`,
        license,
      };
    });
  }));
  const tracks = items.flatMap(x => x.status === 'fulfilled' ? x.value : []);
  return { tracks, totalItems: Number(data.response?.numFound || 0), page };
}

async function searchJamendo(term, page) {
  if (!jamendoClientId) throw new Error('未设置 JAMENDO_CLIENT_ID');
  const url = new URL('https://api.jamendo.com/v3.0/tracks/');
  const params = {
    client_id: jamendoClientId,
    format: 'json',
    limit: '25',
    offset: String((page - 1) * 25),
    audioformat: 'flac',
    include: 'licenses,stats,musicinfo',
    ccnc: 'true',
    boost: 'popularity_month',
  };
  if (term) params.search = term.slice(0, 80);
  else params.featured = '1';
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const data = await getJSON(url);
  if (data.headers?.status !== 'success') throw new Error(data.headers?.error_message || 'Jamendo API 请求失败');
  const results = data.results || [];
  return results.filter(track => track.audio && track.license_ccurl).map(track => ({
    id: `jamendo:${track.id}`,
    title: track.name || 'Untitled',
    artist: track.artist_name || 'Unknown artist',
    album: track.album_name || 'Single',
    format: 'FLAC',
    duration: Number(track.duration || 0),
    url: track.audio,
    artwork: track.album_image || track.image || null,
    source: track.shareurl || `https://www.jamendo.com/track/${encodeURIComponent(track.id)}`,
    license: track.license_ccurl,
    provider: 'Jamendo',
  }));
}

async function searchOpenverse(term, page) {
  const url = new URL('https://api.openverse.org/v1/audio/');
  url.searchParams.set('q', term || 'music');
  url.searchParams.set('page', String(page));
  url.searchParams.set('page_size', '25');
  url.searchParams.set('categories', 'music');
  url.searchParams.set('license', 'by,by-sa,by-nd,by-nc,by-nc-sa,by-nc-nd,cc0,pdm');
  const data = await getJSON(url);
  const tracks = (data.results || []).filter(track => track.url && track.license_url).map(track => ({
    id: `openverse:${track.id}`,
    title: track.title || 'Untitled recording',
    artist: track.creator || 'Unknown creator',
    album: track.provider || track.source || 'Openverse',
    format: String(track.filetype || 'AUDIO').toUpperCase(),
    size: Number(track.filesize || 0),
    duration: Number(track.duration || 0),
    url: track.url,
    artwork: track.thumbnail || null,
    source: track.foreign_landing_url || track.detail_url,
    license: track.license_url,
    provider: `Openverse · ${track.license || 'licensed'}`,
  }));
  return { tracks, totalItems: Number(data.result_count || 0), page };
}

function ccmixterLicense(systags) {
  const tags = String(systags || '').split(',');
  const nc = tags.includes('non_commercial') || tags.includes('nc_sampling_plus');
  const sa = tags.includes('share_alike');
  const sp = tags.includes('sampling_plus') || tags.includes('nc_sampling_plus');
  if (sp) return nc ? 'Sampling Plus NC' : 'Sampling Plus';
  return nc ? (sa ? 'CC BY-NC-SA' : 'CC BY-NC') : (sa ? 'CC BY-SA' : 'CC BY');
}

function durationSeconds(value) {
  const parts = String(value || '').split(':').map(Number);
  if (!parts.length || parts.some(Number.isNaN)) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

async function ccmixterQuery(params) {
  const url = new URL('https://ccmixter.org/api/query');
  url.searchParams.set('f', 'json');
  url.searchParams.set('dataview', 'files');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const data = await getJSON(url);
  if (!Array.isArray(data)) throw new Error('ccMixter 返回格式异常');
  return data.flatMap(item => (item.files || []).filter(file => {
    const type = file.file_format_info?.['media-type'];
    const ext = String(file.file_name || '').split('.').pop().toLowerCase();
    return type === 'audio' && ['mp3', 'ogg', 'm4a'].includes(ext) && !/preview/i.test(file.file_extra?.type || '');
  }).map(file => {
    const uploadId = Number(item.upload_id || 0);
    const ext = String(file.file_name || '').split('.').pop().toUpperCase();
    return {
      id: `ccmixter:${uploadId}:${file.file_id}`,
      title: String(item.upload_name || '未命名作品'),
      artist: String(item.user_name || 'Unknown artist'),
      album: String(item.upload_extra?.relative_dir || '').replace(/^content\//, '') || 'ccMixter',
      format: ext,
      duration: durationSeconds(file.file_format_info?.ps),
      size: Number(file.file_rawsize || 0),
      url: `/api/stream?url=${encodeURIComponent(file.download_url || '')}`,
      source: uploadId ? `https://ccmixter.org/files/${encodeURIComponent(item.user_name)}/${uploadId}` : 'https://ccmixter.org/',
      license: `https://ccmixter.org/`,
      licenseName: ccmixterLicense(item.upload_extra?.systags),
      provider: `ccMixter · ${ccmixterLicense(item.upload_extra?.systags)}`,
    };
  }));
}

async function searchCcmixter(term, page) {
  const params = { limit: 60 };
  if (term) params.search = term.slice(0, 60);
  else params.ord = 'rank_desc';
  const tracks = await ccmixterQuery(params);
  const perPage = 25;
  const start = (page - 1) * perPage;
  return { tracks: tracks.slice(start, start + perPage), totalItems: tracks.length, page };
}

const incompetechCatalog = { at: 0, tracks: [] };
async function incompetechTracks() {
  if (incompetechCatalog.tracks.length && Date.now() - incompetechCatalog.at < 1800000) return incompetechCatalog.tracks;
  const pieces = await getJSON('https://incompetech.com/music/royalty-free/pieces.json', 90000);
  const tracks = (Array.isArray(pieces) ? pieces : []).filter(piece => piece?.filename && /\.mp3$/i.test(piece.filename)).map(piece => {
    const uploaded = String(piece.uploaded || '').slice(0, 10);
    return {
      id: `incompetech:${piece.filename}`,
      title: String(piece.title || piece.filename.replace(/\.mp3$/i, '')),
      artist: 'Kevin MacLeod',
      album: [uploaded, String(piece.feel || piece.genre || '')].filter(Boolean).join(' · ') || 'incompetech',
      format: 'MP3',
      duration: durationSeconds(piece.length),
      uploaded,
      url: `https://incompetech.com/music/royalty-free/mp3-royaltyfree/${encodeURIComponent(piece.filename)}`,
      artwork: null,
      source: 'https://incompetech.com/music/royalty-free/music.html',
      license: 'https://creativecommons.org/licenses/by/4.0/',
      licenseName: 'CC BY 4.0',
      provider: 'incompetech · CC BY 4.0',
    };
  });
  if (!tracks.length) throw new Error('incompetech 曲库为空');
  incompetechCatalog.at = Date.now();
  incompetechCatalog.tracks = tracks;
  return tracks;
}

const streamReferer = { 'ccmixter.org': 'https://ccmixter.org/', 'www.ccmixter.org': 'https://ccmixter.org/' };

function proxyStream(target, req, res) {
  let parsed;
  try { parsed = new URL(target); } catch { res.writeHead(400); return res.end('bad url'); }
  if (parsed.protocol !== 'https:' || !streamReferer[parsed.hostname]) { res.writeHead(403); return res.end('host not allowed'); }
  const headers = { Referer: streamReferer[parsed.hostname], 'User-Agent': USER_AGENT };
  if (req.headers.range) headers.Range = req.headers.range;
  const upstream = https.request(parsed, { method: 'GET', headers, maxHeaderSize: 256 * 1024, timeout: 30000 }, response => {
    if (response.statusCode !== 200 && response.statusCode !== 206) { response.resume(); res.writeHead(502); res.end('upstream error'); return; }
    const out = { 'Content-Type': response.headers['content-type'] || 'audio/mpeg', 'Cache-Control': 'no-store' };
    for (const key of ['content-length', 'content-range', 'accept-ranges']) {
      const value = response.headers[key];
      if (value) out[key] = value;
    }
    res.writeHead(response.statusCode, out);
    response.pipe(res);
  });
  upstream.on('timeout', () => upstream.destroy(new Error('timeout')));
  upstream.on('error', () => { if (!res.headersSent) { res.writeHead(502); res.end('stream unavailable'); } else res.destroy(); });
  req.on('close', () => upstream.destroy());
  upstream.end();
}

async function catalogTracks(kind) {
  if (kind === 'recent') {
    const tracks = (await incompetechTracks()).filter(t => t.uploaded).sort((a, b) => b.uploaded.localeCompare(a.uploaded));
    return tracks.slice(0, 40).map((t, i) => ({ ...t, rank: i + 1 }));
  }
  const tracks = await ccmixterQuery({ limit: 40, ord: 'rank_desc' });
  return tracks.map((t, i) => ({ ...t, rank: i + 1 }));
}

async function searchCatalogs(term, page) {
  const providers = [
    ['ccMixter', () => searchCcmixter(term, page)],
    ['Openverse', () => searchOpenverse(term, page)],
    ['Internet Archive', () => searchMusic(term, page)],
  ];
  if (jamendoClientId && !jamendoSuspended) providers.push(['Jamendo', () => searchJamendo(term, page)]);
  const results = await Promise.allSettled(providers.map(([, search]) => search()));
  const tracks = results.flatMap(r => r.status === 'fulfilled' ? r.value.tracks || r.value : []);
  const errors = results.flatMap((r, i) => {
    if (r.status !== 'rejected') return [];
    const message = r.reason?.message || '连接失败';
    if (providers[i][0] === 'Jamendo' && /application has been suspended/i.test(message)) {
      jamendoSuspended = true;
      return [];
    }
    return [`${providers[i][0]}：${message}`];
  });
  if (!tracks.length && errors.length) throw new Error(`当前无法连接开放曲库，请检查网络/DNS 或稍后重试（${errors.join('；')}）`);
  return { tracks, totalItems: tracks.length, page, providers: results.map((r, i) => ({ name: providers[i][0], available: r.status === 'fulfilled' })) };
}

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (url.pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ ok: true }));
    }
    if (url.pathname === '/api/search') {
      const term = (url.searchParams.get('q') || '').trim().slice(0, 80);
      const page = Math.min(100, Math.max(1, Number(url.searchParams.get('page') || 1) || 1));
      const key = `${term}\n${page}`;
      let entry = cache.get(key);
      if (!entry || Date.now() - entry.at > 300000) {
        entry = { at: Date.now(), promise: searchCatalogs(term, page) };
        cache.set(key, entry);
      }
      try {
        const result = await entry.promise;
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify(result));
      } catch (error) {
        cache.delete(key);
        throw error;
      }
    }
    if (url.pathname === '/api/catalog') {
      const kind = url.searchParams.get('kind') === 'recent' ? 'recent' : 'charts';
      const key = `catalog:${kind}`;
      let entry = cache.get(key);
      if (!entry || Date.now() - entry.at > 600000) {
        entry = { at: Date.now(), promise: catalogTracks(kind) };
        cache.set(key, entry);
      }
      try {
        const tracks = await entry.promise;
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify({ tracks, kind }));
      } catch (error) {
        cache.delete(key);
        throw error;
      }
    }
    if (url.pathname === '/api/stream') {
      return proxyStream(url.searchParams.get('url') || '', req, res);
    }
    const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
    if (!['/index.html', '/app.js', '/styles.css'].includes(pathname)) {
      res.writeHead(404); return res.end('Not found');
    }
    const data = await readFile(path.join(root, pathname));
    res.writeHead(200, { 'Content-Type': mime[path.extname(pathname)], 'Cache-Control': 'no-store' });
    res.end(data);
  } catch (error) {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: error.message || '请求失败' }));
  }
});
server.listen(port, '127.0.0.1', () => console.log(`声海音乐: http://127.0.0.1:${port}`));
