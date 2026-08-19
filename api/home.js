import { fetchPage, parseCards, BASE } from './_scraper.js';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const html = await fetchPage(BASE + '/');
    const cards = parseCards(html);
    res.json({ latest: cards, popular: cards.slice(0, 12) });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
