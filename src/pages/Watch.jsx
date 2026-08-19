import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const ShimmerEffect = () => (
  <div className="absolute top-0 bottom-0 left-0 w-[150%] animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent z-10"
    style={{ transform: 'translate3d(-100%, 0, 0) skewX(-20deg)' }} />
);

const Watch = () => {
  const { '*': rawSlug } = useParams();
  const navigate = useNavigate();

  const [anime, setAnime] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [currentEpUrl, setCurrentEpUrl] = useState(null);
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEpLoading, setIsEpLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [autoNext, setAutoNext] = useState(() => localStorage.getItem('nefusoft_autonext') === 'true');

  const fetchedDetailRef = useRef(null);
  const fetchedEpRef = useRef(null);

  // Decode URL dari param
  const getTargetUrl = () => {
    if (!rawSlug) return null;
    try {
      const decoded = decodeURIComponent(rawSlug);
      if (decoded.startsWith('http')) return decoded;
      return `https://donghub.vip/${decoded}/`;
    } catch {
      return `https://donghub.vip/${rawSlug}/`;
    }
  };

  const encodeForNav = (url) => encodeURIComponent(url);

  useEffect(() => { window.scrollTo(0, 0); }, [rawSlug]);

  // Fetch detail series — server sudah auto-handle episode URL
  useEffect(() => {
    const targetUrl = getTargetUrl();
    if (!targetUrl || fetchedDetailRef.current === targetUrl) return;
    fetchedDetailRef.current = targetUrl;

    const ctrl = new AbortController();
    setIsLoading(true);
    setAnime(null);
    setEpisodes([]);
    setCurrentEpUrl(null);
    setServers([]);
    setSelectedServer(null);

    const run = async () => {
      try {
        const [detailRes, recRes] = await Promise.all([
          fetch(`/api/detail?url=${encodeURIComponent(targetUrl)}`, { signal: ctrl.signal }).then(r => r.json()),
          fetch('/api/latest?page=1', { signal: ctrl.signal }).then(r => r.json()),
        ]);

        if (ctrl.signal.aborted) return;

        if (detailRes.data?.[0]) {
          const d = detailRes.data[0];
          const epList = (d.chapter || []).map(c => ({ id: c.url, url: c.url, index: c.ch, title: c.title }));
          setAnime({
            title: d.judul,
            image_poster: d.cover,
            image_cover: d.cover,
            synopsis: d.sinopsis,
            status: d.status,
            type: d.type,
            studio: d.author,
            aired_start: d.published,
            genre: d.genre,
            episode_list: epList,
            seriesUrl: d.url, // URL series yang sudah benar dari server
          });
          setEpisodes(epList);
          document.title = `${d.judul} - NefuSoft`;

          // Set episode awal: kalau URL asli adalah episode, cari yang matching
          const targetIsEpisode = /episode[-–]\d+/i.test(targetUrl);
          if (targetIsEpisode && epList.length > 0) {
            // Cari episode yang URLnya paling mirip dengan targetUrl
            const match = epList.find(ep => ep.url === targetUrl) || epList.find(ep => targetUrl.includes(ep.url)) || epList[0];
            setCurrentEpUrl(match.url);
          } else if (epList.length > 0) {
            setCurrentEpUrl(epList[0].url);
          }
        }

        if (Array.isArray(recRes)) {
          setRecommendations(recRes.slice(0, 5).map(a => ({ id: a.url, url: a.url, title: a.title, image_poster: a.image, type: a.type || 'ONA', status: a.episode || 'Ongoing' })));
        }
      } catch (e) {
        if (!ctrl.signal.aborted) console.error(e);
      } finally {
        if (!ctrl.signal.aborted) setIsLoading(false);
      }
    };
    run();
    return () => ctrl.abort();
  }, [rawSlug]);

  // Fetch stream servers saat episode berubah
  useEffect(() => {
    if (!currentEpUrl || fetchedEpRef.current === currentEpUrl) return;
    fetchedEpRef.current = currentEpUrl;

    const ctrl = new AbortController();
    setIsEpLoading(true);
    setServers([]);
    setSelectedServer(null);

    fetch(`/api/episode?url=${encodeURIComponent(currentEpUrl)}`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(res => {
        if (ctrl.signal.aborted) return;
        const stream = (res.data?.[0]?.stream?.filter(s => s.link) || [])
        .map(s => ({ ...s, link: s.link.replace(/&amp;/g, '&') }));
        setServers(stream);
        if (stream.length > 0) setSelectedServer(stream[0]);
      })
      .catch(e => { if (!ctrl.signal.aborted) console.error(e); })
      .finally(() => { if (!ctrl.signal.aborted) setIsEpLoading(false); });

    return () => ctrl.abort();
  }, [currentEpUrl]);

  const epIndex = episodes.findIndex(e => e.url === currentEpUrl);

  const changeEpisode = (ep) => {
    fetchedEpRef.current = null; // reset biar fetch ulang
    setCurrentEpUrl(ep.url);
  };

  const handlePrev = () => { if (epIndex < episodes.length - 1) changeEpisode(episodes[epIndex + 1]); };
  const handleNext = () => { if (epIndex > 0) changeEpisode(episodes[epIndex - 1]); };

  const toggleAutoNext = () => {
    setAutoNext(prev => { const v = !prev; localStorage.setItem('nefusoft_autonext', v); return v; });
  };

  const handleShare = async (platform) => {
    const url = window.location.href;
    const text = `Tonton ${anime?.title || 'Anime'} di NefuSoft!`;
    if (platform === 'copy') {
      await navigator.clipboard.writeText(`${text}\n${url}`).catch(() => {});
      setToast('Tautan berhasil disalin!');
      setTimeout(() => setToast(''), 3000);
    } else if (platform === 'tg') window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
    else if (platform === 'x') window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
    else if (platform === 'api' && navigator.share) await navigator.share({ title: 'NefuSoft', text, url }).catch(() => {});
  };

  if (isLoading) return (
    <div className="min-h-screen bg-[#0a0a0c] text-white font-nunito">
      <style>{`@keyframes shimmer{0%{transform:translate3d(-100%,0,0) skewX(-20deg)}100%{transform:translate3d(200%,0,0) skewX(-20deg)}}body,html{background-color:#0a0a0c!important}`}</style>
      <Navbar />
      <div className="pt-20 max-w-7xl mx-auto px-4">
        <div className="w-full bg-[#16161a] rounded-sm relative overflow-hidden border border-white/5 flex items-center justify-center" style={{aspectRatio:'16/9'}}>
          <ShimmerEffect />
          <p className="text-[#F6CF80] text-sm font-bold z-10">Memuat...</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0c] font-nunito selection:bg-[#F6CF80] selection:text-black pb-24 text-white">
      <style>{`@keyframes shimmer{0%{transform:translate3d(-100%,0,0) skewX(-20deg)}100%{transform:translate3d(200%,0,0) skewX(-20deg)}}body,html{background-color:#0a0a0c!important;color:white;margin:0;padding:0}.no-scrollbar::-webkit-scrollbar{display:none}`}</style>

      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-[#F6CF80] text-black font-black text-xs px-6 py-3 rounded-full shadow-lg z-[999] whitespace-nowrap">
          {toast}
        </div>
      )}

      <Navbar />

      <div className="pt-20 max-w-7xl mx-auto px-4 md:px-6">

        {/* Player */}
        <div className="bg-[#16161a] rounded-sm border border-white/5 mb-4 shadow-2xl overflow-hidden">
          <div className="relative w-full bg-black" style={{aspectRatio:'16/9'}}>
            {isEpLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-20">
                <div className="w-10 h-10 border-2 border-[#F6CF80] border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-[#F6CF80] text-xs font-bold">Memuat server...</p>
              </div>
            ) : selectedServer?.link ? (
              <iframe
                key={selectedServer.link}
                src={selectedServer.link}
                className="w-full h-full border-0"
                allowFullScreen
                allow="autoplay; fullscreen; picture-in-picture"
                referrerPolicy="origin"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-20 text-white/40">
                <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.899L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
                </svg>
                <p className="text-xs font-bold uppercase tracking-widest">Video tidak tersedia</p>
              </div>
            )}
          </div>
        </div>

        {/* Server selector */}
        {servers.length > 1 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {servers.map((s, i) => (
              <button key={i} onClick={() => setSelectedServer(s)}
                className={`px-4 py-2 text-xs font-black rounded-lg border transition-all ${selectedServer?.link === s.link ? 'bg-[#F6CF80] text-black border-[#F6CF80]' : 'bg-white/5 text-white/60 border-white/10 hover:border-white/30 hover:text-white'}`}>
                {s.name || `Server ${i + 1}`}
              </button>
            ))}
          </div>
        )}

        {/* Nav prev/next */}
        <div className="flex flex-col gap-3 w-full mb-6">
          <div className="flex gap-3">
            <button onClick={handlePrev} disabled={epIndex >= episodes.length - 1}
              className="flex-1 flex items-center justify-center gap-2 bg-transparent hover:bg-white/5 border border-white/20 py-3 rounded-lg transition-all disabled:opacity-30 text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
              <span className="text-sm font-black">Sebelumnya</span>
            </button>
            <button onClick={handleNext} disabled={epIndex <= 0}
              className="flex-1 flex items-center justify-center gap-2 bg-transparent hover:bg-[#F6CF80]/10 border border-[#F6CF80]/40 py-3 rounded-lg transition-all disabled:opacity-30 text-[#F6CF80]">
              <span className="text-sm font-black">Selanjutnya</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
          <button onClick={toggleAutoNext}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg border transition-all ${autoNext ? 'border-[#F6CF80]/40 text-[#F6CF80]' : 'border-white/20 text-white/60 hover:bg-white/5'}`}>
            <span className="text-xs font-black uppercase tracking-wider">AutoNext {autoNext ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Share */}
        <div className="bg-[#16161a] p-5 rounded-xl border border-white/5 mb-6 shadow-xl">
          <h3 className="text-white font-black uppercase text-xs mb-3 tracking-wider">Bagikan</h3>
          <div className="flex gap-2 flex-wrap">
            {[{ id: 'copy', label: 'Salin Link' }, { id: 'tg', label: 'Telegram' }, { id: 'x', label: 'X' }, { id: 'api', label: 'Lainnya' }].map(p => (
              <button key={p.id} onClick={() => handleShare(p.id)}
                className="bg-white/5 hover:bg-[#F6CF80] hover:text-black border border-white/10 hover:border-[#F6CF80] px-4 py-2 rounded-lg text-xs font-black text-white transition-all">
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Episode list */}
        {episodes.length > 0 && (
          <div className="mb-6 bg-[#16161a] rounded-sm border border-white/5 p-4 shadow-xl">
            <h3 className="text-white font-black uppercase text-xs mb-4 tracking-wider">Daftar Episode ({episodes.length})</h3>
            <div className="grid gap-2 max-h-56 overflow-y-auto no-scrollbar" style={{gridTemplateColumns:'repeat(auto-fill,minmax(45px,1fr))'}}>
              {episodes.map(ep => (
                <button key={ep.url} onClick={() => changeEpisode(ep)}
                  className={`aspect-square flex items-center justify-center rounded-sm text-xs font-black transition-all ${
                    currentEpUrl === ep.url
                      ? 'bg-[#F6CF80] text-black'
                      : 'bg-[#0a0a0c] border border-white/5 text-white/60 hover:border-white/20 hover:text-white'
                  }`}>
                  {ep.index}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Anime info */}
        {anime && (
          <div className="mb-6 bg-[#16161a] rounded-sm border border-white/5 overflow-hidden shadow-xl">
            <div className="p-5 flex gap-4 items-start">
              {anime.image_poster && (
                <img src={anime.image_poster} referrerPolicy="no-referrer" alt={anime.title}
                  className="w-24 md:w-32 shrink-0 rounded-sm shadow-2xl object-cover" style={{aspectRatio:'3/4.2'}} />
              )}
              <div className="flex flex-col flex-1 min-w-0">
                <h2 className="text-base md:text-xl font-black text-white mb-2 leading-tight">{anime.title}</h2>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {anime.type && <span className="bg-[#F6CF80] text-black text-[9px] px-2 py-0.5 rounded-sm font-black uppercase">{anime.type}</span>}
                  {anime.status && <span className="bg-white/10 text-white/70 text-[9px] px-2 py-0.5 rounded-sm font-bold uppercase border border-white/5">{anime.status}</span>}
                </div>
                {anime.synopsis && <p className="text-white/60 text-xs leading-relaxed line-clamp-4">{anime.synopsis}</p>}
                {anime.genre?.length > 0 && (
                  <p className="text-[#F6CF80] text-[10px] font-bold mt-2">{Array.isArray(anime.genre) ? anime.genre.join(', ') : anime.genre}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Rekomendasi */}
        {recommendations.length > 0 && (
          <div className="mb-12">
            <h3 className="text-white font-black uppercase text-xs mb-4 tracking-wider">Rekomendasi</h3>
            <div className="flex flex-col gap-3">
              {recommendations.map(a => (
                <div key={a.id} onClick={() => navigate(`/anime/${encodeForNav(a.url)}`)}
                  className="group cursor-pointer relative rounded-sm bg-[#16161a] border border-white/5 flex items-center px-4 overflow-hidden transition-transform active:scale-[0.98]"
                  style={{height:'80px'}}>
                  <div className="absolute right-0 top-0 bottom-0 w-1/2 z-0">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#16161a] to-transparent z-10" />
                    {a.image_poster && <img src={a.image_poster} referrerPolicy="no-referrer" className="w-full h-full object-cover opacity-30 group-hover:opacity-60 transition-opacity" />}
                  </div>
                  <div className="relative z-20 flex items-center gap-3">
                    {a.image_poster && <img src={a.image_poster} referrerPolicy="no-referrer" className="w-12 shrink-0 rounded-sm shadow-lg object-cover" style={{aspectRatio:'3/4.2'}} />}
                    <div>
                      <h3 className="text-white font-bold text-xs line-clamp-1 group-hover:text-[#F6CF80] transition-colors">{a.title}</h3>
                      <span className="bg-[#F6CF80] text-black text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase mt-1 inline-block">{a.type}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Watch;
