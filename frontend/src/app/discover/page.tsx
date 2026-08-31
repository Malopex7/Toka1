"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';

interface DiscoverVideo {
  _id: string;
  title: string;
  videoUrl: string;
  thumbnailUrl?: string;
  creatorId?: {
    _id: string;
    username: string;
    avatarUrl?: string;
    isBrandSafeVerified?: boolean;
  };
}

interface FilterTab {
  id: string;
  label: string;
  icon?: string;
  color?: string;
}

interface DiscoverCategory {
  id: string;
  title: string;
  tag: string;
  countLabel: string;
  count: number;
  image: string;
  icon: string;
}

interface TrendingPreview {
  id: string;
  title: string;
  views: string;
  image: string | null;
  videoUrl?: string;
  creator: string;
}

interface TrendingChallenge {
  id: string;
  hashtag: string;
  views: string;
  videoCount: string;
  description: string;
  previews: TrendingPreview[];
}

interface TopCreator {
  id: string;
  username: string;
  name: string;
  niche: string;
  followers: string;
  avatar: string;
  verified: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function DiscoverPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [results, setResults] = useState<DiscoverVideo[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingHub, setLoadingHub] = useState(true);
  const [hubError, setHubError] = useState<string | null>(null);

  const [filterTabs, setFilterTabs] = useState<FilterTab[]>([]);
  const [categories, setCategories] = useState<DiscoverCategory[]>([]);
  const [trending, setTrending] = useState<TrendingChallenge[]>([]);
  const [topCreators, setTopCreators] = useState<TopCreator[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load discover hub (categories, trending, top creators)
  useEffect(() => {
    let isMounted = true;

    const fetchHub = async () => {
      setLoadingHub(true);
      setHubError(null);
      try {
        const res = await fetch(`${API_URL}/api/discover/hub`);
        const data = await res.json();
        if (!isMounted) return;

        if (data.status === 'success' && data.data) {
          setFilterTabs(data.data.filterTabs || []);
          setCategories(data.data.categories || []);
          setTrending(data.data.trending || []);
          setTopCreators(data.data.topCreators || []);
        } else {
          setHubError('Could not load discover content.');
        }
      } catch (err) {
        console.error('Discover hub fetch error:', err);
        if (isMounted) setHubError('Could not load discover content.');
      } finally {
        if (isMounted) setLoadingHub(false);
      }
    };

    fetchHub();
    return () => {
      isMounted = false;
    };
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

  // Run search when query or active tab changes
  useEffect(() => {
    if (!debouncedQuery.trim() && activeTab === 'all') {
      return;
    }

    let isMounted = true;

    const executeSearch = async () => {
      try {
        const searchParams = new URLSearchParams({ limit: '18' });
        if (debouncedQuery.trim()) searchParams.set('q', debouncedQuery.trim());
        if (activeTab && activeTab !== 'all') {
          searchParams.set('category', activeTab);
        }

        setSearching(true);
        const res = await fetch(`${API_URL}/api/discover/videos?${searchParams.toString()}`);
        const data = await res.json();
        if (!isMounted) return;

        if (data.status === 'success') {
          setResults(data.data?.videos || []);
        } else {
          setResults([]);
        }
      } catch (e) {
        console.error('Discover search error:', e);
        if (isMounted) setResults([]);
      } finally {
        if (isMounted) setSearching(false);
      }
    };

    executeSearch();

    return () => {
      isMounted = false;
    };
  }, [debouncedQuery, activeTab]);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === 'all') {
      setQuery('');
      setResults([]);
    } else {
      const selected = filterTabs.find((t) => t.id === tabId);
      if (selected && tabId !== 'trending') {
        setQuery(selected.label);
      } else {
        setQuery('');
      }
    }
  };

  const showSearchResults = query.trim() || activeTab !== 'all';

  return (
    <div className="bg-midnight-boma text-cloud-white min-h-screen antialiased font-sans pb-24">
      <PageHeader title="Discover" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-8">
        {/* Search & filter bar */}
        <section className="flex flex-col gap-4">
          <div className="relative group max-w-3xl">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-cloud-white/40 text-[22px] pointer-events-none transition-colors group-focus-within:text-toka-flare">
              search
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (activeTab !== 'all' && !e.target.value.trim()) {
                  setActiveTab('all');
                }
              }}
              placeholder="Search creators, sounds, hashtags..."
              className="w-full bg-[#18181B] border border-white/10 focus:border-toka-flare/70 rounded-2xl pl-12 pr-10 py-3.5 text-sm text-cloud-white placeholder:text-cloud-white/40 outline-none transition-all shadow-xl backdrop-blur-md"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setActiveTab('all');
                  setResults([]);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-cloud-white/70 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
            {(filterTabs.length > 0 ? filterTabs : [{ id: 'all', label: 'All' }]).map((tab) => {
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

        {/* Search / filter results */}
        {showSearchResults && (
          <section className="flex flex-col gap-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-cloud-white/70 flex items-center gap-2">
                {debouncedQuery.trim() ? (
                  <>
                    <span>Search results for</span>
                    <span className="text-toka-flare font-black">&ldquo;{debouncedQuery}&rdquo;</span>
                  </>
                ) : (
                  <span>
                    {filterTabs.find((t) => t.id === activeTab)?.label || 'Filtered'} videos
                  </span>
                )}
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
                  {debouncedQuery.trim()
                    ? `We couldn't find any videos or creators for "${debouncedQuery}". Try another creator handle, sound, or hashtag.`
                    : 'No videos in this category yet. Be the first to upload!'}
                </p>
                <button
                  onClick={() => {
                    setQuery('');
                    setActiveTab('all');
                    setResults([]);
                  }}
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
                    href={`/?videoId=${video._id}`}
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

        {/* Default discover hub */}
        {!showSearchResults && (
          <>
            {loadingHub ? (
              <div className="flex flex-col gap-8">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-48 bg-[#18181B] rounded-3xl border border-white/10 animate-pulse" />
                ))}
              </div>
            ) : hubError ? (
              <div className="flex flex-col items-center justify-center py-16 bg-[#18181B] border border-white/10 rounded-3xl gap-3 text-center px-4">
                <span className="material-symbols-outlined text-[32px] text-cloud-white/30">cloud_off</span>
                <p className="text-sm text-cloud-white/60">{hubError}</p>
              </div>
            ) : (
              <>
                {/* Trending */}
                <section className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-toka-flare text-[20px]">
                        local_fire_department
                      </span>
                      <h2 className="text-lg font-black tracking-tight text-cloud-white">Trending Now</h2>
                    </div>
                    <span className="text-xs text-cloud-white/40 font-medium">Live from Toka</span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {trending.map((challenge) => (
                      <div
                        key={challenge.id}
                        className="bg-[#18181B] border border-white/10 hover:border-toka-flare/30 rounded-3xl p-5 shadow-xl flex flex-col justify-between gap-4 transition-all duration-300 hover:shadow-2xl group"
                      >
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

                        <div className="grid grid-cols-3 gap-2">
                          {challenge.previews.length > 0 ? (
                            challenge.previews.map((prev) => (
                              <Link
                                key={prev.id}
                                href={`/?videoId=${prev.id}`}
                                className="relative aspect-[3/4] rounded-xl overflow-hidden bg-black/50 border border-white/10 group/thumb cursor-pointer"
                              >
                                {prev.image ? (
                                  <img
                                    src={prev.image}
                                    alt={prev.title}
                                    className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-300 opacity-75 group-hover/thumb:opacity-95"
                                  />
                                ) : (
                                  <video
                                    src={prev.videoUrl}
                                    className="w-full h-full object-cover opacity-75 group-hover/thumb:opacity-95"
                                    muted
                                    playsInline
                                  />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-1.5">
                                  <span className="text-[9px] font-bold text-cloud-white flex items-center gap-0.5 font-mono">
                                    <span className="material-symbols-outlined text-[10px] text-toka-flare">play_arrow</span>
                                    {prev.views}
                                  </span>
                                </div>
                              </Link>
                            ))
                          ) : (
                            Array.from({ length: 3 }).map((_, idx) => (
                              <div
                                key={idx}
                                className="aspect-[3/4] rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"
                              >
                                <span className="material-symbols-outlined text-cloud-white/20 text-[20px]">videocam_off</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Categories */}
                <section className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-amber-400 text-[20px]">category</span>
                      <h2 className="text-lg font-black tracking-tight text-cloud-white">Explore Categories</h2>
                    </div>
                    <span className="text-xs text-cloud-white/40 font-medium">Curated African culture</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {categories.map((cat) => (
                      <div
                        key={cat.id}
                        onClick={() => {
                          setActiveTab(cat.id);
                          setQuery(cat.tag);
                        }}
                        className="relative h-44 rounded-2xl overflow-hidden border border-white/10 hover:border-toka-flare/60 group cursor-pointer transition-all duration-300 shadow-lg hover:shadow-2xl hover:scale-[1.02]"
                      >
                        <img
                          src={cat.image}
                          alt={cat.title}
                          className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-75 group-hover:scale-105 transition-all duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/60 to-transparent p-4 flex flex-col justify-between" />
                        <div className="relative z-10 flex items-center justify-between">
                          <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/15 flex items-center justify-center text-toka-flare shadow-md">
                            <span className="material-symbols-outlined text-[18px]">{cat.icon}</span>
                          </div>
                          <span className="text-[10px] font-mono text-cloud-white/60 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10">
                            {cat.countLabel}
                          </span>
                        </div>
                        <div className="relative z-10">
                          <h3 className="text-sm font-black text-cloud-white group-hover:text-toka-flare transition-colors leading-tight">
                            {cat.title}
                          </h3>
                          <span className="text-[11px] font-bold text-toka-flare/90 mt-0.5 block">{cat.tag}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Top creators */}
                <section className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-fintech-mint text-[20px]">stars</span>
                      <h2 className="text-lg font-black tracking-tight text-cloud-white">Top Creators to Watch</h2>
                    </div>
                    <span className="text-xs text-cloud-white/40 font-medium">Ranked by followers</span>
                  </div>

                  {topCreators.length === 0 ? (
                    <div className="py-12 text-center text-cloud-white/50 text-sm bg-[#18181B] rounded-2xl border border-white/10">
                      No creators yet. Sign up and start creating!
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                      {topCreators.map((creator) => (
                        <Link
                          key={creator.id}
                          href={`/profile?username=${creator.username}`}
                          className="bg-[#18181B] border border-white/10 hover:border-toka-flare/40 rounded-2xl p-3.5 flex flex-col items-center text-center gap-2.5 group transition-all duration-200 hover:shadow-xl hover:scale-[1.02]"
                        >
                          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-toka-flare via-amber-500 to-fintech-mint p-[2px] shadow-md group-hover:scale-105 transition-transform">
                            {creator.avatar ? (
                              <img
                                src={creator.avatar}
                                alt={creator.username}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full rounded-full bg-shaded-canopy flex items-center justify-center text-lg font-bold">
                                {creator.username.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
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
                            <span className="text-[10px] text-cloud-white/50 truncate w-full mt-0.5">{creator.niche}</span>
                            <span className="text-[10px] font-mono font-bold text-fintech-mint mt-1">
                              {creator.followers} Fans
                            </span>
                          </div>
                          <span className="w-full py-1.5 bg-white/5 hover:bg-toka-flare hover:text-white rounded-xl text-[11px] font-bold text-cloud-white/70 transition-colors mt-0.5">
                            View
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
