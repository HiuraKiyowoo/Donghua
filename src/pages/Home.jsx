import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const Shimmer = () => (
  <div className="absolute top-0 bottom-0 left-0 w-[150%] animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent z-10"
    style={{ transform: 'translate3d(-100%, 0, 0) skewX(-20deg)' }} />
);

const CardSkeleton = () => (
  <div className="flex flex-col gap-2 relative">
    <div className="bg-[#16161a] rounded-sm relative overflow-hidden shadow-xl" style={{aspectRatio:'3/4.5'}}><Shimmer /></div>
    <div className="w-3/4 h-2.5 bg-[#16161a] rounded-sm relative overflow-hidden"><Shimmer /></div>
  </div>
);

const encodeUrl = (url) => encodeURIComponent(url);

const Home = () => {
  const navigate = useNavigate();
  const [ongoing, setOngoing] = useState([]);
  const [popular, setPopular] = useState([]);
  const [popularToday, setPopularToday] = useState([]);
  const [recommendation, setRecommendation] = useState([]);
  const [activeGenre, setActiveGenre] = useState(0);
  const [populerRanking, setPopulerRanking] = useState({});
  const [activeRankTab, setActiveRankTab] = useState('');
  const [heroIndex, setHeroIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const heroRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/home').then(r => r.json());
        setOngoing(res.latest || []);
        setPopular(res.popular || []);
        setPopularToday(res.popularToday || []);
        setRecommendation(res.recommendation || []);
        setPopulerRanking(res.populerRanking || {});
        const firstTab = Object.keys(res.populerRanking || {})[0];
        if (firstTab) setActiveRankTab(firstTab);
      } catch (e) {
        console.error(e);
      }
      setIsLoading(false);
    };
    fetchData();
  }, []);

  // Hero auto-rotate
  useEffect(() => {
    if (popular.length === 0) return;
    const timer = setInterval(() => {
      setIsTransitioning(false);
      setTimeout(() => {
        setHeroIndex(prev => (prev + 1) % Math.min(popular.length, 7));
        setIsTransitioning(true);
      }, 300);
    }, 5000);
    return () => clearInterval(timer);
  }, [popular]);

  const hero = popular[heroIndex];

  const goToAnime = (url) => {
    navigate(`/anime/${encodeUrl(url)}`);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] font-nunito selection:bg-[#F6CF80] selection:text-black pb-24 text-white">
      <style>{`
        @keyframes shimmer { 0% { transform: translate3d(-100%, 0, 0) skewX(-20deg); } 100% { transform: translate3d(200%, 0, 0) skewX(-20deg); } }
        body, html { background-color: #0a0a0c !important; color: white; margin: 0; padding: 0; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      <Navbar />

      {/* ── Hero ── */}
      <div className="relative w-full h-[50vh] md:h-[60vh] overflow-hidden">
        {isLoading ? (
          <div className="w-full h-full bg-[#16161a] relative overflow-hidden"><Shimmer /></div>
        ) : hero ? (
          <div className={`absolute inset-0 transition-opacity duration-300 ${isTransitioning ? 'opacity-100' : 'opacity-0'}`}>
            <img src={hero.image} referrerPolicy="no-referrer" alt={hero.title}
              className="w-full h-full object-cover opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/50 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-12">
              <div className="flex items-end gap-5 max-w-7xl mx-auto">
                <img src={hero.image} referrerPolicy="no-referrer" alt={hero.title}
                  className="w-24 md:w-36 aspect-[3/4.2] object-cover rounded-sm shadow-2xl shrink-0 hidden md:block" />
                <div className="flex flex-col gap-2">
                  {hero.type && <span className="bg-[#F6CF80] text-black text-[9px] font-black px-2.5 py-1 uppercase tracking-widest w-fit rounded-sm">{hero.type}</span>}
                  <h1 className="text-2xl md:text-4xl font-black text-white leading-tight line-clamp-2 tracking-tight">{hero.title}</h1>
                  {hero.episode && <p className="text-white/60 text-xs font-bold">{hero.episode}</p>}
                  <button onClick={() => goToAnime(hero.url)}
                    className="mt-3 w-fit flex items-center gap-2 bg-[#F6CF80] text-black px-6 py-2.5 rounded-lg font-black text-sm hover:bg-white transition-colors">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    Tonton Sekarang
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Hero dots */}
        {popular.length > 1 && (
          <div className="absolute bottom-4 right-6 flex gap-1.5 z-10">
            {popular.slice(0, 7).map((_, i) => (
              <div key={i} onClick={() => setHeroIndex(i)}
                className={`h-1 rounded-full cursor-pointer transition-all ${i === heroIndex ? 'w-6 bg-[#F6CF80]' : 'w-1.5 bg-white/30'}`} />
            ))}
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6">

        {/* ── Ongoing / Latest ── */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-black uppercase text-sm md:text-base tracking-tight">Update Terbaru</h2>
            <button onClick={() => navigate('/ongoing')} className="text-[#F6CF80] text-[10px] font-black uppercase tracking-widest hover:underline">Lihat Semua</button>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2" style={{flexWrap:'nowrap'}}>
            {isLoading
              ? [...Array(8)].map((_, i) => (
                  <div key={i} className="flex-none" style={{width:'105px'}}><CardSkeleton /></div>
                ))
              : ongoing.map((a, i) => (
                <div key={i} onClick={() => goToAnime(a.url)}
                  className="flex-none flex flex-col gap-2 group cursor-pointer active:scale-95 transition-transform"
                  style={{width:'105px'}}>
                  <div className="relative bg-[#16161a] rounded-sm shadow-xl overflow-hidden" style={{aspectRatio:'3/4.5'}}>
                    <img src={a.image} referrerPolicy="no-referrer" alt={a.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    {a.episode && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 py-1 px-2">
                        <span className="text-[#F6CF80] text-[9px] font-black">{a.episode}</span>
                      </div>
                    )}
                  </div>
                  <h3 className="text-[9px] font-bold text-white/60 line-clamp-1 group-hover:text-[#F6CF80] transition-colors">
                    {a.title?.toLowerCase()}
                  </h3>
                </div>
              ))}
          </div>
        </section>

        {/* ── Popular ── */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-white font-black uppercase text-sm md:text-base tracking-tight">Populer</h2>
            <button onClick={() => navigate('/explore')} className="text-[#F6CF80] text-[10px] font-black uppercase tracking-widest hover:underline">Explore</button>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(95px,1fr))] gap-3">
            {isLoading
              ? [...Array(12)].map((_, i) => <CardSkeleton key={i} />)
              : popular.slice(0, 12).map((a, i) => (
                <div key={i} onClick={() => goToAnime(a.url)}
                  className="flex flex-col gap-2 group cursor-pointer active:scale-95 transition-transform">
                  <div className="relative aspect-[3/4.5] w-full overflow-hidden bg-[#16161a] rounded-sm shadow-xl">
                    <img src={a.image} referrerPolicy="no-referrer" alt={a.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    {a.type && (
                      <div className="absolute top-1 left-1">
                        <span className="bg-[#F6CF80] text-black text-[7px] font-black px-1.5 py-0.5 rounded-sm uppercase">{a.type}</span>
                      </div>
                    )}
                  </div>
                  <h3 className="text-[9px] font-bold text-white/60 line-clamp-1 group-hover:text-[#F6CF80] transition-colors">
                    {a.title?.toLowerCase()}
                  </h3>
                </div>
              ))}
          </div>
        </section>

        {/* ── Popular Today ── */}
        {(isLoading || popularToday.length > 0) && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-black uppercase text-sm md:text-base tracking-tight">Popular Today</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2" style={{flexWrap:'nowrap'}}>
              {isLoading
                ? [...Array(5)].map((_, i) => (
                    <div key={i} className="flex-none" style={{width:'105px'}}><CardSkeleton /></div>
                  ))
                : popularToday.map((a, i) => (
                  <div key={i} onClick={() => goToAnime(a.url)}
                    className="flex-none flex flex-col gap-2 group cursor-pointer active:scale-95 transition-transform"
                    style={{width:'105px'}}>
                    <div className="relative bg-[#16161a] rounded-sm shadow-xl overflow-hidden" style={{aspectRatio:'3/4.5'}}>
                      <img src={a.image} referrerPolicy="no-referrer" alt={a.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute top-1 left-1 bg-[#F6CF80] text-black text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-sm">
                        {i + 1}
                      </div>
                      {a.episode && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 py-1 px-2">
                          <span className="text-[#F6CF80] text-[9px] font-black">{a.episode}</span>
                        </div>
                      )}
                    </div>
                    <h3 className="text-[9px] font-bold text-white/60 line-clamp-1 group-hover:text-[#F6CF80] transition-colors">
                      {a.title?.toLowerCase()}
                    </h3>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* ── Recommendation (tab genre) ── */}
        {(isLoading || recommendation.length > 0) && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-black uppercase text-sm md:text-base tracking-tight">Recommendation</h2>
            </div>
            {!isLoading && recommendation.length > 0 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3" style={{flexWrap:'nowrap'}}>
                {recommendation.map((g, i) => (
                  <button key={g.id} onClick={() => setActiveGenre(i)}
                    className={`flex-none px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide transition-colors ${
                      i === activeGenre ? 'bg-[#F6CF80] text-black' : 'bg-[#16161a] text-white/60'
                    }`}>
                    {g.label}
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(95px,1fr))] gap-3">
              {isLoading
                ? [...Array(5)].map((_, i) => <CardSkeleton key={i} />)
                : (recommendation[activeGenre]?.items || []).map((a, i) => (
                  <div key={i} onClick={() => goToAnime(a.url)}
                    className="flex flex-col gap-2 group cursor-pointer active:scale-95 transition-transform">
                    <div className="relative aspect-[3/4.5] w-full overflow-hidden bg-[#16161a] rounded-sm shadow-xl">
                      <img src={a.image} referrerPolicy="no-referrer" alt={a.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      {a.type && (
                        <div className="absolute top-1 left-1">
                          <span className="bg-[#F6CF80] text-black text-[7px] font-black px-1.5 py-0.5 rounded-sm uppercase">{a.type}</span>
                        </div>
                      )}
                    </div>
                    <h3 className="text-[9px] font-bold text-white/60 line-clamp-1 group-hover:text-[#F6CF80] transition-colors">
                      {a.title?.toLowerCase()}
                    </h3>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* ── Donghua Populer (tab ranking) ── */}
        {(isLoading || Object.keys(populerRanking).length > 0) && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white font-black uppercase text-sm md:text-base tracking-tight">Donghua Populer</h2>
            </div>
            {!isLoading && Object.keys(populerRanking).length > 0 && (
              <div className="flex gap-2 mb-4">
                {Object.keys(populerRanking).map((tab) => (
                  <button key={tab} onClick={() => setActiveRankTab(tab)}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wide transition-colors capitalize ${
                      tab === activeRankTab ? 'bg-[#F6CF80] text-black' : 'bg-[#16161a] text-white/60'
                    }`}>
                    {tab}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-col divide-y divide-white/5">
              {isLoading
                ? [...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 py-3">
                      <div className="w-6 h-6 bg-[#16161a] rounded-sm relative overflow-hidden shrink-0"><Shimmer /></div>
                      <div className="w-14 bg-[#16161a] rounded-sm relative overflow-hidden shrink-0" style={{aspectRatio:'3/4.5'}}><Shimmer /></div>
                      <div className="flex-1 h-3 bg-[#16161a] rounded-sm relative overflow-hidden"><Shimmer /></div>
                    </div>
                  ))
                : (populerRanking[activeRankTab] || []).map((a, i) => (
                  <div key={i} onClick={() => goToAnime(a.url)}
                    className="flex items-center gap-3 py-3 group cursor-pointer active:opacity-70 transition-opacity">
                    <span className="w-6 text-center text-lg font-black text-white/30 group-hover:text-[#F6CF80] transition-colors shrink-0">
                      {a.rank ?? i + 1}
                    </span>
                    <div className="w-14 relative overflow-hidden bg-[#16161a] rounded-sm shadow-lg shrink-0" style={{aspectRatio:'3/4.5'}}>
                      <img src={a.image} referrerPolicy="no-referrer" alt={a.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                      <h3 className="text-xs font-bold text-white line-clamp-1 group-hover:text-[#F6CF80] transition-colors">
                        {a.title}
                      </h3>
                      {a.genres?.length > 0 && (
                        <p className="text-[10px] text-white/40 line-clamp-1">{a.genres.join(', ')}</p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Home;
