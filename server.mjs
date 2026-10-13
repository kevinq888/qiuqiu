import http from 'node:http';
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

async function getJSON(url) {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'ShenghaiMusic/1.0 (personal free music player)' } });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') throw new Error('连接上游超时');
    throw new Error('网络不可达或 DNS 解析失败');
  }
  if (!response.ok) throw new Error(`上游服务返回 ${response.status}`);
  return response.json();
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

async function searchCatalogs(term, page) {
  const providers = [
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
