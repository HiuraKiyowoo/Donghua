'use strict';

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE = 'https://donghub.vip';
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

async function fetchPage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Referer': BASE + '/',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function clean(v) {
  return String(v ?? '').replace(/\s+/g, ' ').trim() || null;
}
function stripHtml(v) {
  return clean(String(v ?? '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, ''));
}
function getAttr(tag, name) {
  const m = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i').exec(tag || '');
  return m ? m[1].trim() : null;
}
function absUrl(v) {
  if (!v) return null;
  v = v.trim();
  if (v.startsWith('http')) return v;
  if (v.startsWith('//')) return 'https:' + v;
  if (v.startsWith('/')) return BASE + v;
  return null;
}

// Deteksi apakah URL adalah halaman episode (bukan series)
function isEpisodeUrl(url) {
  return /episode[-–]\d+/i.test(url) || /\-ep[-–]?\d+/i.test(url);
}

// Dari URL episode, ambil URL series-nya
function seriesUrlFromEpisode(url) {
  // https://donghub.vip/slay-the-gods-season-2-episode-15-subtitle-indonesia/
  // → https://donghub.vip/slay-the-gods-season-2/
  return url.replace(/-episode-\d+[-\w]*/i, '').replace(/\/+$/, '/');
}

function parseCard(fragment) {
  const hrefMatch = /href\s*=\s*["']([^"']+)["']/i.exec(fragment);
  const url = absUrl(hrefMatch?.[1]);
  const imgMatch = /<img\b([^>]+)>/i.exec(fragment);
  const imgTag = imgMatch?.[1] || '';
  const image = absUrl(getAttr(imgTag, 'data-src') || getAttr(imgTag, 'data-lazy-src') || getAttr(imgTag, 'data-original') || getAttr(imgTag, 'src'));
  const h2 = /<h2\b[^>]*>([\s\S]*?)<\/h2>/i.exec(fragment)?.[1];
  const title = stripHtml(h2) || clean(getAttr(imgTag, 'alt') || '');
  const epMatch = /class="[^"]*\bepx\b[^"]*"[^>]*>([\s\S]*?)<\//i.exec(fragment);
  const typeMatch = /class="[^"]*\btypez\b[^"]*"[^>]*>([\s\S]*?)<\//i.exec(fragment);
  const episode = stripHtml(epMatch?.[1]);
  const type = stripHtml(typeMatch?.[1]);
  if (!url || !title) return null;
  return { url, image, title, episode, type };
}

function parseCards(html) {
  const seen = new Set();
  const cards = [];
  for (const m of String(html || '').matchAll(/<article\b[\s\S]*?<\/article>/gi)) {
    const c = parseCard(m[0]);
    if (c && !seen.has(c.url)) { seen.add(c.url); cards.push(c); }
  }
  return cards;
}

function parseEpisodeList(html) {
  const list = [];
  for (const m of String(html || '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const frag = m[1];
    if (!/epl-num|epl-title/i.test(frag)) continue;
    const href = absUrl(/href\s*=\s*["']([^"']+)["']/i.exec(frag)?.[1]);
    const numText = stripHtml(/class="[^"]*epl-num[^"]*"[^>]*>([\s\S]*?)<\//i.exec(frag)?.[1]);
    const titleText = stripHtml(/class="[^"]*epl-title[^"]*"[^>]*>([\s\S]*?)<\//i.exec(frag)?.[1]);
    const date = stripHtml(/class="[^"]*epl-date[^"]*"[^>]*>([\s\S]*?)<\//i.exec(frag)?.[1]);
    if (!href) continue;
    list.push({ url: href, number: parseFloat(numText) || null, label: numText || titleText, title: titleText || numText, date });
  }

  if (list.length > 0) return list;

  // Fallback: cari dari .eplister
  const epSection = /class="[^"]*eplister[^"]*"[^>]*>([\s\S]*?)<\/ul>/i.exec(html)?.[1] || '';
  for (const m of epSection.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = absUrl(m[1]);
    const title = stripHtml(m[2]);
    if (!href || !title) continue;
    const numMatch = title.match(/[\d.]+/);
    list.push({ url: href, number: numMatch ? parseFloat(numMatch[0]) : null, label: title, title });
  }
  return list;
}

function parseServers(html) {
  const servers = [];
  const src = String(html || '');

  // 1. Select mirror dengan option value base64
  const selectMatch = /<select\b[^>]*class="[^"]*mirror[^"]*"[^>]*>([\s\S]*?)<\/select>/i.exec(src);
  if (selectMatch) {
    for (const m of selectMatch[1].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)) {
      const val = getAttr(m[1], 'value');
      const name = stripHtml(m[2]);
      if (!val || !name || name === '─') continue;
      let iframeUrl = null;
      try {
        const decoded = Buffer.from(val, 'base64').toString('utf8');
        const iframeM = /src\s*=\s*["']([^"']+)["']/i.exec(decoded);
        if (iframeM) iframeUrl = absUrl(iframeM[1]);
      } catch (_) {
        if (val.startsWith('http') || val.startsWith('//')) iframeUrl = absUrl(val);
      }
      if (iframeUrl) servers.push({ name, iframeUrl });
    }
  }

  // 2. Iframe langsung di halaman
  if (servers.length === 0) {
    for (const m of src.matchAll(/<iframe\b[^>]*src\s*=\s*["']([^"']+)["']/gi)) {
      const u = absUrl(m[1]);
      if (!u || /pagead|google|doubleclick|ads|banner|tracker/i.test(u)) continue;
      let name = 'Player';
      try { name = new URL(u).hostname.replace('www.', '').split('.')[0]; } catch (_) {}
      servers.push({ name, iframeUrl: u });
    }
  }

  // 3. Dailymotion dari script/text
  if (servers.length === 0) {
    const dmMatch = /dailymotion\.com\/embed\/video\/([a-zA-Z0-9]+)/i.exec(src);
    if (dmMatch) servers.push({ name: 'Dailymotion', iframeUrl: `https://www.dailymotion.com/embed/video/${dmMatch[1]}` });
  }

  return servers;
}

function parseSeriesDetail(html, url) {
  const src = String(html || '');
  const title = stripHtml(/<h1\b[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i.exec(src)?.[1] || /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(src)?.[1]);
  let image = null;
  for (const re of [
    /class="[^"]*(?:thumb|poster|bigcover)[^"]*"[^>]*>[\s\S]{0,200}?<img\b([^>]+)>/i,
    /<img\b([^>]+)class="[^"]*(?:poster|cover|thumb)[^"]*"[^>]*/i,
    /<img\b([^>]+)>/i,
  ]) {
    const imgTag = re.exec(src)?.[1];
    if (!imgTag) continue;
    image = absUrl(getAttr(imgTag, 'src') || getAttr(imgTag, 'data-src') || getAttr(imgTag, 'data-lazy-src'));
    if (image && !/data:|pixel|logo|icon/i.test(image)) break;
  }
  const desc = stripHtml(
    /class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(src)?.[1] ||
    /class="[^"]*synopsis[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(src)?.[1]
  );
  const meta = {};
  for (const m of src.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)) {
    const bMatch = /<b\b[^>]*>([\s\S]*?)<\/b>/i.exec(m[1]);
    if (!bMatch) continue;
    const rawKey = stripHtml(bMatch[1]);
    if (!rawKey?.endsWith(':')) continue;
    const key = rawKey.replace(/:$/, '').toLowerCase().replace(/\s+/g, '_');
    const links = [...m[1].matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map(x => stripHtml(x[1])).filter(Boolean);
    meta[key] = links.length ? (links.length === 1 ? links[0] : links) : stripHtml(m[1].replace(/<b\b[^>]*>[\s\S]*?<\/b>/i, ''));
  }
  const genres = [...src.matchAll(/href="[^"]*\/genres?\/([^/"]+)\/?["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m => ({ slug: m[1], name: stripHtml(m[2]) })).filter(g => g.name);
  const episodes = parseEpisodeList(src);
  return { url, title, image, description: desc, status: meta.status || null, type: meta.type || null, studio: meta.studio || null, released: meta.released || null, genres, episodes, latestEpisode: episodes[0] || null };
}

// ─── Cache ────────────────────────────────────────────────────────────────────
const cache = new Map();
function cacheGet(key) {
  const v = cache.get(key);
  if (!v) return null;
  if (Date.now() > v.exp) { cache.delete(key); return null; }
  return v.data;
}
function cacheSet(key, data, ttlMs = 5 * 60 * 1000) {
  cache.set(key, { data, exp: Date.now() + ttlMs });
}

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ─── API ──────────────────────────────────────────────────────────────────────

app.get('/api/home', async (req, res) => {
  try {
    const cached = cacheGet('home');
    if (cached) return res.json(cached);
    const html = await fetchPage(BASE + '/');
    const cards = parseCards(html);
    console.log(`[home] ${cards.length} cards`);
    const result = { latest: cards, popular: cards.slice(0, 12) };
    cacheSet('home', result, 3 * 60 * 1000);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/latest', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const ck = `latest_${page}`;
    const cached = cacheGet(ck);
    if (cached) return res.json(cached);
    const url = page > 1 ? `${BASE}/anime/page/${page}/` : `${BASE}/anime/`;
    const html = await fetchPage(url);
    const cards = parseCards(html);
    console.log(`[latest p=${page}] ${cards.length} cards`);
    cacheSet(ck, cards, 5 * 60 * 1000);
    res.json(cards);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/schedule', async (req, res) => {
  try {
    const cached = cacheGet('schedule');
    if (cached) return res.json(cached);
    const html = await fetchPage(BASE + '/schedule/');
    const cards = parseCards(html);
    const result = { data: [{ day: 'Ongoing', animeList: cards.map(c => ({ anime_name: c.title, cover: c.image, link: c.url })) }] };
    cacheSet('schedule', result, 10 * 60 * 1000);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/movies', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const ck = `movies_${page}`;
    const cached = cacheGet(ck);
    if (cached) return res.json(cached);
    const url = page > 1 ? `${BASE}/anime/page/${page}/?order=update` : `${BASE}/anime/?order=update`;
    const html = await fetchPage(url);
    const cards = parseCards(html);
    cacheSet(ck, cards, 5 * 60 * 1000);
    res.json(cards);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/search', async (req, res) => {
  try {
    const q = req.query.q || '';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    if (!q) return res.json({ data: [{ result: [], pagination: { has_next: false } }] });
    const ck = `search_${q}_${page}`;
    const cached = cacheGet(ck);
    if (cached) return res.json(cached);
    const url = page > 1 ? `${BASE}/page/${page}/?s=${encodeURIComponent(q)}` : `${BASE}/?s=${encodeURIComponent(q)}`;
    const html = await fetchPage(url);
    const cards = parseCards(html);
    const hasNext = /class="[^"]*next[^"]*"/i.test(html) && cards.length >= 10;
    const result = { data: [{ result: cards.map(c => ({ url: c.url, judul: c.title, cover: c.image, status: c.episode || c.type || '' })), pagination: { has_next: hasNext, page } }] };
    cacheSet(ck, result, 5 * 60 * 1000);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/genre', async (req, res) => {
  try {
    const slug = req.query.slug || 'action';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const url = page > 1 ? `${BASE}/genres/${slug}/page/${page}/` : `${BASE}/genres/${slug}/`;
    const html = await fetchPage(url);
    res.json(parseCards(html));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/detail?url=... — auto redirect episode URL ke series
app.get('/api/detail', async (req, res) => {
  try {
    let url = req.query.url || '';
    if (!url) return res.status(400).json({ error: 'url required' });
    if (!url.startsWith('http')) url = `${BASE}/${url.replace(/^\/+|\/+$/g, '')}/`;

    // Kalau URL adalah episode, ambil series-nya dulu
    if (isEpisodeUrl(url)) {
      const seriesUrl = seriesUrlFromEpisode(url);
      console.log(`[detail] episode URL detected, redirecting to series: ${seriesUrl}`);
      url = seriesUrl;
    }

    const ck = `detail_${url}`;
    const cached = cacheGet(ck);
    if (cached) return res.json(cached);

    const html = await fetchPage(url);
    const detail = parseSeriesDetail(html, url);
    console.log(`[detail] title=${detail.title}, eps=${detail.episodes.length}, image=${detail.image ? 'ok' : 'null'}`);

    const result = {
      data: [{
        judul: detail.title,
        cover: detail.image,
        sinopsis: detail.description,
        status: detail.status,
        type: detail.type,
        author: detail.studio,
        published: detail.released,
        rating: null,
        genre: detail.genres.map(g => g.name),
        chapter: detail.episodes.map(ep => ({ url: ep.url, ch: ep.number?.toString() || ep.label || '?', title: ep.title })),
        url,
      }]
    };
    cacheSet(ck, result, 10 * 60 * 1000);
    res.json(result);
  } catch (e) {
    console.error('[detail] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/episode?url=...
app.get('/api/episode', async (req, res) => {
  try {
    let url = req.query.url || '';
    if (!url) return res.status(400).json({ error: 'url required' });
    if (!url.startsWith('http')) url = `${BASE}/${url.replace(/^\/+|\/+$/g, '')}/`;
    const ck = `ep_${url}`;
    const cached = cacheGet(ck);
    if (cached) return res.json(cached);
    const html = await fetchPage(url);
    const servers = parseServers(html);
    console.log(`[episode] ${servers.length} servers:`, servers.map(s => s.name));
    const result = { data: [{ stream: servers.map((s, i) => ({ id: i, link: s.iframeUrl, reso: s.name, type: 'embed', name: s.name })) }] };
    cacheSet(ck, result, 10 * 60 * 1000);
    res.json(result);
  } catch (e) {
    console.error('[episode] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Debug
app.get('/api/debug', async (req, res) => {
  try {
    let url = req.query.url || '';
    if (!url.startsWith('http')) url = `${BASE}/${url.replace(/^\/+|\/+$/g, '')}/`;
    const html = await fetchPage(url);
    const detail = parseSeriesDetail(html, url);
    const servers = parseServers(html);
    res.json({ url, htmlLength: html.length, detail: { title: detail.title, image: detail.image, episodeCount: detail.episodes.length, episodes: detail.episodes.slice(0, 5), genres: detail.genres }, servers });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => console.log(`✅ http://localhost:${PORT}`));
