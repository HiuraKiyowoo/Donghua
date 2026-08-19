import { fetchPage, parseCards, BASE } from './_scraper.js';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const q = req.query.q || '';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    if (!q) return res.json({ data: [{ result: [], pagination: { has_next: false } }] });
    const url = page > 1 ? `${BASE}/page/${page}/?s=${encodeURIComponent(q)}` : `${BASE}/?s=${encodeURIComponent(q)}`;
    const html = await fetchPage(url);
    const cards = parseCards(html);
    const hasNext = /class="[^"]*next[^"]*"/i.test(html) && cards.length >= 10;
    res.json({ data: [{ result: cards.map(c => ({ url: c.url, judul: c.title, cover: c.image, status: c.episode || c.type || '' })), pagination: { has_next: hasNext, page } }] });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
