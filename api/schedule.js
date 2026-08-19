import { fetchPage, parseCards, BASE } from './_scraper.js';
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const html = await fetchPage(BASE + '/schedule/');
    const cards = parseCards(html);
    res.json({ data: [{ day: 'Ongoing', animeList: cards.map(c => ({ anime_name: c.title, cover: c.image, link: c.url })) }] });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
