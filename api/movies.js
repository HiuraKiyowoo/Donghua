const { fetchPage, parseCards, BASE } = require('./_scraper');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const url = page > 1 ? `${BASE}/anime/page/${page}/?order=update` : `${BASE}/anime/?order=update`;
    const html = await fetchPage(url);
    res.json(parseCards(html));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
