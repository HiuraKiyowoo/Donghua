const { fetchPage, parseServers, BASE } = require('./_scraper');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    let url = req.query.url || '';
    if (!url) return res.status(400).json({ error: 'url required' });
    if (!url.startsWith('http')) url = `${BASE}/${url.replace(/^\/+|\/+$/g, '')}/`;

    const html = await fetchPage(url);
    const servers = parseServers(html);
    res.json({ data: [{ stream: servers.map((s, i) => ({ id: i, link: s.iframeUrl, reso: s.name, type: 'embed', name: s.name })) }] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
