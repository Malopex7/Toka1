"use client";
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFeedStore } from '@/store/useFeedStore';

const CATEGORIES = [
  { id: 'afrobeats', label: 'Afrobeats', icon: 'music_note', color: 'from-orange-600 to-yellow-500' },
  { id: 'dance', label: 'Dance', icon: 'self_improvement', color: 'from-pink-600 to-rose-400' },
  { id: 'cooking', label: 'Cooking', icon: 'soup_kitchen', color: 'from-green-600 to-lime-400' },
  { id: 'tech', label: 'Tech', icon: 'developer_mode', color: 'from-blue-600 to-cyan-400' },
  { id: 'fashion', label: 'Fashion', icon: 'checkroom', color: 'from-purple-600 to-violet-400' },
  { id: 'fitness', label: 'Fitness', icon: 'fitness_center', color: 'from-red-600 to-orange-400' },
  { id: 'comedy', label: 'Comedy', icon: 'sentiment_very_satisfied', color: 'from-amber-600 to-yellow-400' },
  { id: 'beauty', label: 'Beauty', icon: 'face_retouching_natural', color: 'from-fuchsia-600 to-pink-400' },
];

const TRENDING_HASHTAGS = [
  '#TokaVibes', '#AfrobeatChallenge', '#CookingWithToka', '#JollofNation',
  '#DanceKingZA', '#TechToka', '#StyleCheck', '#FitnessFriday',
  '#TokaCreators', '#SouthAfricaVibes', '#AmapiaноMix', '#BlackExcellence'
];

interface SearchVideo {
  _id: string;
  title: string;
  videoUrl: string;
  poster?: string;
  vettingStatus: string;
  creatorId?: { username: string; _id: string };
}

export default function DiscoverPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchVideo[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 450);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Fetch search results when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }

    const doSearch = async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/feed?search=${encodeURIComponent(debouncedQuery)}&limit=12`
        );
        const data = await res.json();
        if (data.status === 'success') {
          setResults(data.data.videos || []);
        }
      } catch (e) {
        console.error('Search error:', e);
      } finally {
        setSearching(false);
      }
    };
    doSearch();
  }, [debouncedQuery]);

  return (
    <div className="bg-midnight-boma text-cloud-white min-h-screen antialiased font-sans">

      {/* Header */}
      <header className="sticky top-0 w-full border-b border-white/10 bg-shaded-canopy flex justify-between items-center px-5 h-16 z-50 select-none">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-cloud-white/70 hover:text-cloud-white transition-colors flex items-center gap-1 text-sm font-semibold">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back
          </Link>
          <h1 className="text-base font-bold text-toka-flare tracking-tight border-l border-white/15 pl-4">Discover</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-8">

        {/* Search Input */}
        <div className="relative group">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-cloud-white/40 text-[20px] pointer-events-none transition-colors group-focus-within:text-toka-flare">
            search
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search videos, creators, hashtags…"
            className="w-full bg-shaded-canopy border border-white/10 focus:border-toka-flare/60 rounded-2xl pl-12 pr-5 py-3.5 text-sm text-cloud-white placeholder:text-cloud-white/30 outline-none transition-all shadow-lg"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-cloud-white/40 hover:text-cloud-white transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>

        {/* Search Results */}
        {query.trim() && (
          <div>
            <h2 className="text-xs font-bold text-cloud-white/50 uppercase tracking-wider mb-3">Results</h2>
            {searching ? (
              <div className="grid grid-cols-2 gap-3 animate-pulse">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="aspect-[9/16] bg-shaded-canopy rounded-2xl border border-white/10"></div>
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 bg-shaded-canopy border border-white/10 rounded-2xl gap-3">
                <span className="material-symbols-outlined text-cloud-white/20 text-[48px]">search_off</span>
                <p className="text-xs text-cloud-white/40">No results for &quot;{debouncedQuery}&quot;</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {results.map((video) => (
                  <Link key={video._id} href="/" className="relative aspect-[9/16] bg-shaded-canopy border border-white/10 rounded-2xl overflow-hidden group cursor-pointer">
                    <video
                      src={video.videoUrl}
                      className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
                      muted
                      playsInline
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent p-3 flex flex-col justify-end">
                      <p className="text-xs font-bold text-cloud-white line-clamp-2">{video.title}</p>
                      {video.creatorId?.username && (
                        <p className="text-[10px] text-cloud-white/50 mt-0.5">@{video.creatorId.username}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Categories (shown when not searching) */}
        {!query.trim() && (
          <>
            <div>
              <h2 className="text-xs font-bold text-cloud-white/50 uppercase tracking-wider mb-4">Browse Categories</h2>
              <div className="grid grid-cols-2 gap-3">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setQuery(cat.label)}
                    className={`flex items-center gap-3 rounded-2xl p-4 bg-gradient-to-r ${cat.color} hover:opacity-90 active:scale-95 transition-all text-left shadow-lg font-bold text-cloud-white`}
                  >
                    <span className="material-symbols-outlined text-[28px] opacity-90">{cat.icon}</span>
                    <span className="text-sm font-bold">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Trending Hashtags */}
            <div>
              <h2 className="text-xs font-bold text-cloud-white/50 uppercase tracking-wider mb-4">
                <span className="material-symbols-outlined text-[14px] text-toka-flare align-middle mr-1">trending_up</span>
                Trending
              </h2>
              <div className="flex flex-wrap gap-2">
                {TRENDING_HASHTAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setQuery(tag)}
                    className="bg-shaded-canopy border border-white/10 hover:border-toka-flare/40 hover:bg-toka-flare/10 text-cloud-white/70 hover:text-toka-flare text-xs font-bold px-3 py-1.5 rounded-full transition-all active:scale-95"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
