"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/PageHeader';

interface SearchVideo {
  _id: string;
  title: string;
  videoUrl: string;
  thumbnailUrl?: string;
  poster?: string;
  views?: number;
  likes?: string[] | number;
  creatorId?: { 
    _id: string; 
    username: string; 
    avatarUrl?: string;
    isBrandSafeVerified?: boolean;
  };
}

const FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'trending', label: 'Trending', icon: 'local_fire_department', color: 'text-toka-flare' },
  { id: 'afrobeats', label: 'Afrobeats', icon: 'music_note', color: 'text-amber-400' },
  { id: 'amapiano', label: 'Amapiano', icon: 'graphic_eq', color: 'text-emerald-400' },
  { id: 'dance', label: 'Dance', icon: 'directions_walk', color: 'text-rose-400' },
  { id: 'cuisine', label: 'Cuisine', icon: 'restaurant', color: 'text-orange-400' },
  { id: 'fashion', label: 'Fashion', icon: 'styler', color: 'text-purple-400' },
  { id: 'tech', label: 'Tech', icon: 'devices', color: 'text-cyan-400' },
  { id: 'comedy', label: 'Comedy', icon: 'theater_comedy', color: 'text-yellow-400' },
];

const CATEGORIES = [
  {
    id: 'afrobeats',
    title: 'Afrobeats & Sounds',
    tag: '#Afrobeats',
    count: '245k videos',
    image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&auto=format&fit=crop&q=80',
    icon: 'music_note'
  },
  {
    id: 'dance',
    title: 'Dance & Choreography',
    tag: '#DanceChallenge',
    count: '189k videos',
    image: 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=600&auto=format&fit=crop&q=80',
    icon: 'self_improvement'
  },
  {
    id: 'cuisine',
    title: 'African Cuisine & Flavors',
    tag: '#JollofNation',
    count: '98k videos',
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=80',
    icon: 'soup_kitchen'
  },
  {
    id: 'fashion',
    title: 'Fashion & Streetwear',
    tag: '#LagosFashion',
    count: '142k videos',
    image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&auto=format&fit=crop&q=80',
    icon: 'checkroom'
  },
  {
    id: 'tech',
    title: 'Tech & African Innovation',
    tag: '#TechToka',
    count: '76k videos',
    image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80',
    icon: 'devices'
  },
  {
    id: 'comedy',
    title: 'Comedy & Sketches',
    tag: '#TokaComedy',
    count: '310k videos',
    image: 'https://images.unsplash.com/photo-1514306191717-452ec28c7814?w=600&auto=format&fit=crop&q=80',
    icon: 'sentiment_very_satisfied'
  },
  {
    id: 'sports',
    title: 'Sports & Football',
    tag: '#AfricanFootball',
    count: '115k videos',
    image: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&auto=format&fit=crop&q=80',
    icon: 'sports_soccer'
  },
  {
    id: 'art',
    title: 'Digital Art & Culture',
    tag: '#BlackExcellence',
    count: '64k videos',
    image: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80',
    icon: 'palette'
  },
];

const TRENDING_CHALLENGES = [
  {
    id: 'amapiano',
    hashtag: '#AmapianoMix',
    views: '2.4M',
    videoCount: '18.2k',
    description: 'The hottest underground basslines and viral dance routines from Pretoria to the world.',
    previews: [
      { id: '1', title: 'Tshwala Bam step by step', views: '450K', image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&auto=format&fit=crop&q=80', creator: 'zola_beats' },
      { id: '2', title: 'Studio session with log drum magic', views: '290K', image: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=400&auto=format&fit=crop&q=80', creator: 'toka_sound' },
      { id: '3', title: 'Late night groove in Jozi', views: '810K', image: 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=400&auto=format&fit=crop&q=80', creator: 'nandi_za' },
    ]
  },
  {
    id: 'jollof',
    hashtag: '#JollofNation',
    views: '1.1M',
    videoCount: '9.4k',
    description: 'The eternal firewood smoke debate: Ghana vs Nigeria vs Senegal recipes tested live.',
    previews: [
      { id: '4', title: 'Secret smoky pepper blend', views: '320K', image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&auto=format&fit=crop&q=80', creator: 'amina_cooks' },
      { id: '5', title: 'Grandma’s 50-year-old pot secret', views: '540K', image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&auto=format&fit=crop&q=80', creator: 'cheftunde' },
      { id: '6', title: 'Street style suya pairing', views: '210K', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&auto=format&fit=crop&q=80', creator: 'taste_lagos' },
    ]
  },
  {
    id: 'lagosfashion',
    hashtag: '#LagosFashionWeek',
    views: '1.8M',
    videoCount: '14.5k',
    description: 'Avant-garde streetwear, runway drops, and bold African silhouettes taking over.',
    previews: [
      { id: '7', title: 'Upcycled Ankara trench coats', views: '670K', image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&auto=format&fit=crop&q=80', creator: 'kemi_style' },
      { id: '8', title: 'Behind the scenes runway fits', views: '490K', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&auto=format&fit=crop&q=80', creator: 'african_vogue' },
      { id: '9', title: 'Thrifting gems in Yaba market', views: '730K', image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&auto=format&fit=crop&q=80', creator: 'street_lagos' },
    ]
  }
];

const TOP_CREATORS = [
  {
    id: '1',
    username: 'nandi_za',
    name: 'Nandi Mthembu',
    niche: 'Amapiano Dance & Vibes',
    followers: '1.2M',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
    verified: true
  },
  {
    id: '2',
    username: 'kwame_tech',
    name: 'Kwame Mensah',
    niche: 'AI & African Tech Innovation',
    followers: '840K',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
    verified: true
  },
  {
    id: '3',
    username: 'amina_cooks',
    name: 'Amina Bello',
    niche: 'West African Gourmet',
    followers: '620K',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80',
    verified: true
  },
  {
    id: '4',
    username: 'tunde_v',
    name: 'Tunde Adeleke',
    niche: 'Comedy & Street Sketches',
    followers: '1.8M',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
    verified: true
  },
  {
    id: '5',
    username: 'zola_beats',
    name: 'Zola Dlamini',
    niche: 'Music Producer & DJ',
    followers: '950K',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80',
    verified: true
  },
  {
    id: '6',
    username: 'kemi_style',
    name: 'Kemi Balogun',
    niche: 'African Streetwear',
    followers: '510K',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&auto=format&fit=crop&q=80',
    verified: false
  }
];

export default function DiscoverPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [results, setResults] = useState<SearchVideo[]>([]);
  const [searching, setSearching] = useState(false);
  const [feedVideos, setFeedVideos] = useState<SearchVideo[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // Load sample videos from live feed API for dynamic previews
  useEffect(() => {
    const fetchRecentVideos = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/feed?limit=12`);
        const data = await res.json();
        if (data.status === 'success' && data.data?.videos) {
          setFeedVideos(data.data.videos);
        }
      } catch (err) {
        console.warn('Could not fetch feed for discovery:', err);
      }
    };
    fetchRecentVideos();
  }, []);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Execute Search API query
  useEffect(() => {
    let isMounted = true;
    if (!debouncedQuery.trim()) {
      return;
    }

    const doSearch = async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/feed?search=${encodeURIComponent(debouncedQuery)}&limit=18`
        );
        const data = await res.json();
        if (isMounted && data.status === 'success') {
          setResults(data.data?.videos || []);
        }
      } catch (e) {
        console.error('Search error:', e);
      } finally {
        if (isMounted) setSearching(false);
      }
    };
    doSearch();

    return () => {
      isMounted = false;
    };
  }, [debouncedQuery]);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === 'all') {
      setQuery('');
      setResults([]);
    } else {
      const selected = FILTER_TABS.find(t => t.id === tabId);
      if (selected && selected.id !== 'trending') {
        setQuery(selected.label);
      } else {
        setQuery('');
      }
    }
  };

  return (
    <div className="bg-midnight-boma text-cloud-white min-h-screen antialiased font-sans pb-24">
      {/* Standardized Header */}
      <PageHeader title="Discover" />

      {/* Main Discover Hub Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-8">
        
        {/* Top Search & Filter Bar */}
        <section className="flex flex-col gap-4">
          {/* Search Input Bar */}
          <div className="relative group max-w-3xl">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-cloud-white/40 text-[22px] pointer-events-none transition-colors group-focus-within:text-toka-flare">
              search
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search creators, sounds, hashtags..."
              className="w-full bg-[#18181B] border border-white/10 focus:border-toka-flare/70 rounded-2xl pl-12 pr-10 py-3.5 text-sm text-cloud-white placeholder:text-cloud-white/40 outline-none transition-all shadow-xl backdrop-blur-md"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-cloud-white/70 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          {/* Horizontal Sticky Filter Ribbon */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
            {FILTER_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-toka-flare text-white shadow-lg shadow-toka-flare/25 scale-[1.02]'
                      : 'bg-[#18181B] hover:bg-white/10 text-cloud-white/70 hover:text-cloud-white border border-white/10'
                  }`}
                >
                  {tab.icon && (
                    <span className={`material-symbols-outlined text-[16px] ${isActive ? 'text-white' : tab.color || ''}`}>
                      {tab.icon}
                    </span>
                  )}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 1. Live Search Results View (When Query Active) */}
        {query.trim() && (
          <section className="flex flex-col gap-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-cloud-white/70 flex items-center gap-2">
                <span>Search results for</span>
                <span className="text-toka-flare font-black">&ldquo;{debouncedQuery}&rdquo;</span>
              </h2>
              <span className="text-xs text-cloud-white/40">{results.length} videos found</span>
            </div>

            {searching ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-[9/16] bg-[#18181B] rounded-2xl border border-white/10 animate-pulse" />
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 bg-[#18181B] border border-white/10 rounded-3xl gap-3 text-center px-4">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-cloud-white/30">
                  <span className="material-symbols-outlined text-[32px]">search_off</span>
                </div>
                <h3 className="text-base font-bold text-cloud-white">No matches found</h3>
                <p className="text-xs text-cloud-white/50 max-w-sm">
                  We couldn&apos;t find any videos or creators for &quot;{debouncedQuery}&quot;. Try searching another creator handle, sound, or hashtag.
                </p>
                <button
                  onClick={() => setQuery('')}
                  className="mt-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold transition-all text-cloud-white cursor-pointer"
                >
                  Clear Search
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {results.map((video) => (
                  <Link
                    key={video._id}
                    href={`/?v=${video._id}`}
                    className="relative aspect-[9/16] bg-[#18181B] border border-white/10 hover:border-toka-flare/50 rounded-2xl overflow-hidden group cursor-pointer shadow-lg transition-all duration-300 hover:scale-[1.02]"
                  >
                    <video
                      src={video.videoUrl}
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                      muted
                      playsInline
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-3 flex flex-col justify-end">
                      <p className="text-xs font-bold text-cloud-white line-clamp-2 leading-snug group-hover:text-toka-flare transition-colors">
                        {video.title}
                      </p>
                      {video.creatorId?.username && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[11px] text-cloud-white/60 truncate font-medium">
                            @{video.creatorId.username}
                          </span>
                          {video.creatorId.isBrandSafeVerified && (
                            <span className="material-symbols-outlined text-[12px] text-fintech-mint">
                              verified
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 2. Default Discovery Feed (When No Query Active) */}
        {!query.trim() && (
          <>
            {/* Section A: Trending Sound & Challenge Cards */}
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-toka-flare text-[20px]">
                    local_fire_department
                  </span>
                  <h2 className="text-lg font-black tracking-tight text-cloud-white">
                    Trending Now
                  </h2>
                </div>
                <span className="text-xs text-cloud-white/40 font-medium">Real-time viral topics</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {TRENDING_CHALLENGES.map((challenge) => (
                  <div
                    key={challenge.id}
                    className="bg-[#18181B] border border-white/10 hover:border-toka-flare/30 rounded-3xl p-5 shadow-xl flex flex-col justify-between gap-4 transition-all duration-300 hover:shadow-2xl group"
                  >
                    {/* Card Header */}
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => setQuery(challenge.hashtag)}
                          className="text-base font-black text-cloud-white hover:text-toka-flare transition-colors text-left truncate cursor-pointer"
                        >
                          {challenge.hashtag}
                        </button>
                        <span className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono font-bold text-toka-flare shrink-0">
                          {challenge.views} Views
                        </span>
                      </div>
                      <p className="text-xs text-cloud-white/50 mt-1 line-clamp-2 leading-relaxed">
                        {challenge.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-[11px] text-cloud-white/40">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px] text-fintech-mint">video_library</span>
                          {challenge.videoCount} Videos
                        </span>
                      </div>
                    </div>

                    {/* Mini Video Thumbnails Reel */}
                    <div className="grid grid-cols-3 gap-2">
                      {challenge.previews.map((prev, idx) => (
                        <div
                          key={idx}
                          onClick={() => setQuery(challenge.hashtag)}
                          className="relative aspect-[3/4] rounded-xl overflow-hidden bg-black/50 border border-white/10 group/thumb cursor-pointer"
                        >
                          <img
                            src={prev.image}
                            alt={prev.title}
                            className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-300 opacity-75 group-hover/thumb:opacity-95"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-1.5">
                            <span className="text-[9px] font-bold text-cloud-white flex items-center gap-0.5 font-mono">
                              <span className="material-symbols-outlined text-[10px] text-toka-flare">play_arrow</span>
                              {prev.views}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Section B: Explore Categories (Rich Image Overlays, Not Neon Solids) */}
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-400 text-[20px]">
                    category
                  </span>
                  <h2 className="text-lg font-black tracking-tight text-cloud-white">
                    Explore Categories
                  </h2>
                </div>
                <span className="text-xs text-cloud-white/40 font-medium">Curated African culture</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {CATEGORIES.map((cat) => (
                  <div
                    key={cat.id}
                    onClick={() => setQuery(cat.tag)}
                    className="relative h-44 rounded-2xl overflow-hidden border border-white/10 hover:border-toka-flare/60 group cursor-pointer transition-all duration-300 shadow-lg hover:shadow-2xl hover:scale-[1.02]"
                  >
                    {/* Background Photographic Image with Dark Subtle Tint */}
                    <img
                      src={cat.image}
                      alt={cat.title}
                      className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-75 group-hover:scale-105 transition-all duration-500"
                    />

                    {/* Gradient Overlay: #09090B to transparent */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/60 to-transparent p-4 flex flex-col justify-between" />

                    {/* Top Category Icon Badge */}
                    <div className="relative z-10 flex items-center justify-between">
                      <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/15 flex items-center justify-center text-toka-flare shadow-md">
                        <span className="material-symbols-outlined text-[18px]">{cat.icon}</span>
                      </div>
                      <span className="text-[10px] font-mono text-cloud-white/60 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10">
                        {cat.count}
                      </span>
                    </div>

                    {/* Bottom Category Title & Tag */}
                    <div className="relative z-10">
                      <h3 className="text-sm font-black text-cloud-white group-hover:text-toka-flare transition-colors leading-tight">
                        {cat.title}
                      </h3>
                      <span className="text-[11px] font-bold text-toka-flare/90 mt-0.5 block">
                        {cat.tag}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Section C: Top Creators to Watch (Creator Spotlight Row) */}
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-fintech-mint text-[20px]">
                    stars
                  </span>
                  <h2 className="text-lg font-black tracking-tight text-cloud-white">
                    Top Creators to Watch
                  </h2>
                </div>
                <span className="text-xs text-cloud-white/40 font-medium">Leading voices in Africa</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                {TOP_CREATORS.map((creator) => (
                  <Link
                    key={creator.id}
                    href={`/profile?u=${creator.username}`}
                    className="bg-[#18181B] border border-white/10 hover:border-toka-flare/40 rounded-2xl p-3.5 flex flex-col items-center text-center gap-2.5 group transition-all duration-200 hover:shadow-xl hover:scale-[1.02]"
                  >
                    {/* Creator Avatar with Gradient Ring */}
                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-toka-flare via-amber-500 to-fintech-mint p-[2px] shadow-md group-hover:scale-105 transition-transform">
                      <img
                        src={creator.avatar}
                        alt={creator.username}
                        className="w-full h-full rounded-full object-cover"
                      />
                    </div>

                    {/* Creator Info */}
                    <div className="flex flex-col items-center w-full min-w-0">
                      <div className="flex items-center gap-1 max-w-full">
                        <span className="text-xs font-bold text-cloud-white truncate group-hover:text-toka-flare transition-colors">
                          @{creator.username}
                        </span>
                        {creator.verified && (
                          <span className="material-symbols-outlined text-[13px] text-fintech-mint shrink-0">
                            verified
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-cloud-white/50 truncate w-full mt-0.5">
                        {creator.niche}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-fintech-mint mt-1">
                        {creator.followers} Fans
                      </span>
                    </div>

                    {/* View Button */}
                    <span className="w-full py-1.5 bg-white/5 hover:bg-toka-flare hover:text-white rounded-xl text-[11px] font-bold text-cloud-white/70 transition-colors mt-0.5">
                      View
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
