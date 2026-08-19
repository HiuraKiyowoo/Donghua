import { fetchPage, parseCards, BASE } from './_scraper.js';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const slug = req.query.slug || 'action';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const url = page > 1 ? `${BASE}/genres/${slug}/page/${page}/` : `${BASE}/genres/${slug}/`;
    const html = await fetchPage(url);
    res.json(parseCards(html));
  } catch (e) { res.status(500).json({ error: e.message }); }
}
