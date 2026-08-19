const { fetchPage, parseSeriesDetail, isEpisodeUrl, seriesUrlFromEpisode, BASE } = require('./_scraper');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    let url = req.query.url || '';
    if (!url) return res.status(400).json({ error: 'url required' });
    if (!url.startsWith('http')) url = `${BASE}/${url.replace(/^\/+|\/+$/g, '')}/`;
    if (isEpisodeUrl(url)) url = seriesUrlFromEpisode(url);

    const html = await fetchPage(url);
    const detail = parseSeriesDetail(html, url);
    res.json({
      data: [{
        judul: detail.title,
        cover: detail.image,
        sinopsis: detail.description,
        status: detail.status,
        type: detail.type,
        author: detail.studio,
        published: detail.released,
        rating: null,
        genre: detail.genres,
        chapter: detail.episodes.map(ep => ({ url: ep.url, ch: ep.number?.toString() || ep.label || '?', title: ep.title })),
        url,
      }]
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
