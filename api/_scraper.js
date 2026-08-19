// api/_scraper.js - Pure ESM untuk Vercel

const BASE = 'https://donghub.vip';
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

export async function fetchPage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
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
export function absUrl(v) {
  if (!v) return null;
  v = v.trim();
  if (v.startsWith('http')) return v;
  if (v.startsWith('//')) return 'https:' + v;
  if (v.startsWith('/')) return BASE + v;
  return null;
}
export function isEpisodeUrl(url) {
  return /episode[-–]\d+/i.test(url) || /\-ep[-–]?\d+/i.test(url);
}
export function seriesUrlFromEpisode(url) {
  return url.replace(/-episode-\d+[-\w]*/i, '').replace(/\/+$/, '/');
}
export function parseCard(fragment) {
  const hrefMatch = /href\s*=\s*["']([^"']+)["']/i.exec(fragment);
  const url = absUrl(hrefMatch?.[1]);
  const imgMatch = /<img\b([^>]+)>/i.exec(fragment);
  const imgTag = imgMatch?.[1] || '';
  const image = absUrl(getAttr(imgTag, 'data-src') || getAttr(imgTag, 'data-lazy-src') || getAttr(imgTag, 'data-original') || getAttr(imgTag, 'src'));
  const h2 = /<h2\b[^>]*>([\s\S]*?)<\/h2>/i.exec(fragment)?.[1];
  const title = stripHtml(h2) || clean(getAttr(imgTag, 'alt') || '');
  const episode = stripHtml(/class="[^"]*\bepx\b[^"]*"[^>]*>([\s\S]*?)<\//i.exec(fragment)?.[1]);
  const type = stripHtml(/class="[^"]*\btypez\b[^"]*"[^>]*>([\s\S]*?)<\//i.exec(fragment)?.[1]);
  if (!url || !title) return null;
  return { url, image, title, episode, type };
}
export function parseCards(html) {
  const seen = new Set();
  const cards = [];
  for (const m of String(html || '').matchAll(/<article\b[\s\S]*?<\/article>/gi)) {
    const c = parseCard(m[0]);
    if (c && !seen.has(c.url)) { seen.add(c.url); cards.push(c); }
  }
  return cards;
}
export function parseEpisodeList(html) {
  const list = [];
  for (const m of String(html || '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const frag = m[1];
    if (!/epl-num|epl-title/i.test(frag)) continue;
    const href = absUrl(/href\s*=\s*["']([^"']+)["']/i.exec(frag)?.[1]);
    const numText = stripHtml(/class="[^"]*epl-num[^"]*"[^>]*>([\s\S]*?)<\//i.exec(frag)?.[1]);
    const titleText = stripHtml(/class="[^"]*epl-title[^"]*"[^>]*>([\s\S]*?)<\//i.exec(frag)?.[1]);
    if (!href) continue;
    list.push({ url: href, number: parseFloat(numText) || null, label: numText || titleText, title: titleText || numText });
  }
  if (list.length > 0) return list;
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
export function parseServers(html) {
  const servers = [];
  const src = String(html || '');
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
  if (servers.length === 0) {
    for (const m of src.matchAll(/<iframe\b[^>]*src\s*=\s*["']([^"']+)["']/gi)) {
      const u = absUrl(m[1]);
      if (!u || /pagead|google|doubleclick|ads|banner|tracker/i.test(u)) continue;
      let name = 'Player';
      try { name = new URL(u).hostname.replace('www.', '').split('.')[0]; } catch (_) {}
      servers.push({ name, iframeUrl: u });
    }
  }
  if (servers.length === 0) {
    const dmMatch = /dailymotion\.com\/embed\/video\/([a-zA-Z0-9]+)/i.exec(src);
    if (dmMatch) servers.push({ name: 'Dailymotion', iframeUrl: `https://www.dailymotion.com/embed/video/${dmMatch[1]}` });
  }
  return servers;
}
export function parseSeriesDetail(html, url) {
  const src = String(html || '');
  const title = stripHtml(/<h1\b[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i.exec(src)?.[1] || /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(src)?.[1]);
  let image = null;
  for (const re of [/class="[^"]*(?:thumb|poster|bigcover)[^"]*"[^>]*>[\s\S]{0,200}?<img\b([^>]+)>/i, /<img\b([^>]+)>/i]) {
    const imgTag = re.exec(src)?.[1];
    if (!imgTag) continue;
    image = absUrl(getAttr(imgTag, 'src') || getAttr(imgTag, 'data-src') || getAttr(imgTag, 'data-lazy-src'));
    if (image && !/data:|pixel|logo|icon/i.test(image)) break;
  }
  const desc = stripHtml(/class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(src)?.[1] || /class="[^"]*synopsis[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(src)?.[1]);
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
  const genres = [...new Set([...src.matchAll(/href="[^"]*\/genres?\/([^/"]+)\/?["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m => stripHtml(m[2])).filter(Boolean))];
  const episodes = parseEpisodeList(src);
  return { url, title, image, description: desc, status: meta.status || null, type: meta.type || null, studio: meta.studio || null, released: meta.released || null, genres, episodes };
}
export { BASE };
