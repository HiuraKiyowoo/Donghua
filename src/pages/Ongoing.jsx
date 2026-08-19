import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

const Shimmer = () => (
  <div
    className="absolute top-0 bottom-0 left-0 w-[150%] animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent z-10"
    style={{ transform: 'translate3d(-100%, 0, 0) skewX(-20deg)' }}
  />
);

const CardSkeleton = () => (
  <div className="w-full flex flex-col gap-2 relative">
    <div className="aspect-[3/4.5] bg-[#16161a] rounded-sm relative overflow-hidden shadow-xl">
      <Shimmer />
    </div>
    <div className="w-3/4 h-2.5 bg-[#16161a] rounded-sm relative overflow-hidden">
      <Shimmer />
    </div>
  </div>
);

const AnimeCard = ({ a, onClick, index }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), (index % 15) * 40);
    return () => clearTimeout(timer);
  }, [index]);

  return (
    <div
      onClick={onClick}
      className={`w-full flex flex-col gap-2 group cursor-pointer active:scale-95 transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 blur-none translate-y-0' : 'opacity-0 blur-xl translate-y-4'
      }`}
    >
      <div className="relative aspect-[3/4.5] w-full overflow-hidden bg-[#16161a] rounded-sm shadow-xl">
        <img
          src={a.image_poster}
          referrerPolicy="no-referrer"
          alt={a.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          loading="lazy"
        />
      </div>
      <h3 className="text-[9px] font-bold text-white/60 line-clamp-1 capitalize group-hover:text-[#F6CF80] transition-colors">
        {a.title.toLowerCase()}
      </h3>
    </div>
  );
};

const Ongoing = () => {
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef(null);
  const isMountedRef = useRef(true);

  const fetchPage = useCallback(async (pageNum, isInitial = false) => {
    if (isInitial) setIsLoading(true);
    else setIsLoadingMore(true);

    try {
      const res = await fetch(`/api/latest?page=${pageNum}`);
      const data = await res.json();

      if (!isMountedRef.current) return;

      if (!Array.isArray(data) || data.length === 0) {
        setHasMore(false);
        return;
      }

      const mapped = data.map((a) => ({
        id: a.url,
        title: a.title,
        image_poster: a.image,
      }));

      setResults((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        const newItems = mapped.filter((item) => !existingIds.has(item.id));
        return [...prev, ...newItems];
      });

      // Kalau page terakhir kurang dari 30 item, anggap udah habis
      if (data.length < 30) setHasMore(false);
    } catch (e) {
      console.error('Fetch error:', e);
      setHasMore(false);
    } finally {
      if (isMountedRef.current) {
        if (isInitial) setIsLoading(false);
        else setIsLoadingMore(false);
      }
    }
  }, []);

  // Initial load
  useEffect(() => {
    window.scrollTo(0, 0);
    isMountedRef.current = true;
    fetchPage(1, true);

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchPage]);

  // Infinite scroll observer
  useEffect(() => {
    if (isLoading || isLoadingMore || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setPage((prev) => prev + 1);
        }
      },
      { rootMargin: '200px' }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [isLoading, isLoadingMore, hasMore]);

  // Fetch next page when page changes
  useEffect(() => {
    if (page > 1) {
      fetchPage(page, false);
    }
  }, [page, fetchPage]);

  return (
    <div className="min-h-screen bg-[#0a0a0c] font-nunito selection:bg-[#F6CF80] selection:text-black pb-24">
      <style>{`
        @keyframes shimmer {
          0% { transform: translate3d(-100%, 0, 0) skewX(-20deg); }
          100% { transform: translate3d(200%, 0, 0) skewX(-20deg); }
        }
        body, html {
          background-color: #0a0a0c !important;
          color: white;
          margin: 0;
          padding: 0;
          overscroll-behavior-y: none;
        }
        body { font-family: 'Nunito', sans-serif; }
      `}</style>
      <Navbar />

      <div className="pt-24 max-w-7xl mx-auto px-6">
        <div className="mb-8 flex flex-col">
          <h2 className="text-white font-black uppercase text-lg tracking-tight">
            Ongoing Anime
          </h2>
          <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest mt-1">
            Anime yang sedang tayang saat ini
          </span>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(95px,1fr))] gap-3 px-2 mb-10">
          {isLoading
            ? [...Array(18)].map((_, i) => <CardSkeleton key={`shimmer-${i}`} />)
            : results.map((a, index) => (
                <AnimeCard
                  key={`${a.id}-${index}`}
                  a={a}
                  index={index}
                  onClick={() =>
                    navigate(`/anime/${encodeURIComponent(a.url || a.id)}`)
                  }
                />
              ))}

          {/* Skeleton untuk load more */}
          {isLoadingMore &&
            [...Array(12)].map((_, i) => (
              <CardSkeleton key={`loadmore-${i}`} />
            ))}
        </div>

        {/* Observer target */}
        {hasMore && !isLoading && (
          <div
            ref={observerRef}
            className="w-full h-10 flex items-center justify-center"
          >
            <div className="w-6 h-6 border-2 border-[#F6CF80] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* End of list */}
        {!hasMore && results.length > 0 && (
          <div className="w-full text-center py-8">
            <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold">
              — Semua anime sudah ditampilkan —
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Ongoing;
