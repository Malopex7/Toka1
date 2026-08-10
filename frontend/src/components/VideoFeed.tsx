"use client";
import React, { useRef, useState, useEffect } from 'react';
import { useFeedStore } from '@/store/useFeedStore';
import { getPerformanceInstance } from '@/lib/firebase';
import { trace } from 'firebase/performance';
import Link from 'next/link';
import { Volume2, VolumeX } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import TipModal from './TipModal';
import AuthModal from './AuthModal';
import UploadModal from './UploadModal';
import CommentsModal from './CommentsModal';
import { useAuth } from '@/context/AuthContext';

function generateHeartId(prefix = 'heart'): string {
  return `${prefix}-${Date.now()}-${Math.random()}`;
}

export default function VideoFeed() {
  const { videos, currentIndex, setCurrentIndex, isLoading, feedType, setFeedType, isMuted, toggleMute, notifications, markNotificationsAsRead, fetchNotifications } = useFeedStore();
  const { mongooseUser, isAuthenticated, logout, firebaseUser } = useAuth();
  const [activeTipVideoId, setActiveTipVideoId] = useState<string | null>(null);
  const [activeCommentsVideoId, setActiveCommentsVideoId] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // States for micro-interactions
  const [hearts, setHearts] = useState<{ id: string; x: number; y: number }[]>([]);
  const [followedCreators, setFollowedCreators] = useState<Set<string>>(new Set());
  const [activeOptionsVideoId, setActiveOptionsVideoId] = useState<string | null>(null);

  // Load saved volume preferences on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('toka_muted');
      if (saved === 'false') {
        useFeedStore.setState({ isMuted: false });
      }
    }
  }, []);

  // Inbox unread dot — persisted in localStorage so it survives page refreshes.
  // Cleared when the user clicks the Inbox link.
  const [hasUnreadInbox, setHasUnreadInbox] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('toka_inbox_unread');
    const timer = setTimeout(() => {
      setHasUnreadInbox(stored === 'true');
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const clearInboxDot = () => {
    localStorage.setItem('toka_inbox_unread', 'false');
    setHasUnreadInbox(false);
  };

  // Poll for notifications in the database (fallback for FCM issues or background/foreground actions)
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchNotifications();

    const interval = setInterval(() => {
      fetchNotifications();
    }, 10000); // Check every 10s

    return () => clearInterval(interval);
  }, [isAuthenticated, fetchNotifications]);

  const feedTraceRef = useRef<any>(null);

  // Tracing feed rendering latency
  useEffect(() => {
    const perf = getPerformanceInstance();
    if (!perf) return;
    try {
      const feedTrace = trace(perf, 'feed-render-latency');
      feedTrace.start();
      console.log('[Perf] Started feed-render-latency trace');
      feedTraceRef.current = feedTrace;
    } catch (e) {
      console.error('[Perf] Failed to start feed-render-latency trace:', e);
    }

    return () => {
      if (feedTraceRef.current) {
        try {
          feedTraceRef.current.stop();
        } catch (e) { }
      }
    };
  }, []);

  useEffect(() => {
    if (videos.length > 0 && feedTraceRef.current) {
      try {
        feedTraceRef.current.stop();
        console.log('[Perf] Stopped feed-render-latency trace');
        feedTraceRef.current = null;
      } catch (e) { }
    }
  }, [videos]);

  const requireAuth = (callback: () => void) => {
    if (isAuthenticated) {
      callback();
    } else {
      setIsAuthModalOpen(true);
    }
  };

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    const index = Math.round(container.scrollTop / container.clientHeight);
    if (index !== currentIndex && index >= 0 && index < videos.length) {
      setCurrentIndex(index);
    }
  };

  const handleDoubleTap = async (videoId: string, e: React.MouseEvent<HTMLDivElement>) => {
    const video = videos.find(v => v.id === videoId);
    if (video && !video.isLiked) {
      if (!isAuthenticated) {
        setIsAuthModalOpen(true);
        return;
      }
      try {
        await useFeedStore.getState().toggleLikeVideo(videoId);
      } catch (err) {
        console.error('[Feed] Double tap like failed:', err);
      }
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const heartId = generateHeartId('heart');
    const newHeart = { id: heartId, x, y };
    setHearts((prev) => [...prev, newHeart]);

    setTimeout(() => {
      setHearts((prev) => prev.filter((h) => h.id !== heartId));
    }, 800);
  };

  const handleLikeToggle = async (videoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      setIsAuthModalOpen(true);
      return;
    }

    const video = videos.find(v => v.id === videoId);
    if (!video) return;

    const isAdding = !video.isLiked;
    if (isAdding) {
      // Spawn a heart particle centered near the heart icon
      const rect = e.currentTarget.getBoundingClientRect();
      const cardContainer = e.currentTarget.parentElement?.parentElement;
      if (cardContainer) {
        const cardRect = cardContainer.getBoundingClientRect();
        const x = rect.left - cardRect.left + rect.width / 2;
        const y = rect.top - cardRect.top + rect.height / 2;
        const heartId = generateHeartId('heart-btn');
        setHearts((prev) => [...prev, { id: heartId, x, y }]);
        setTimeout(() => {
          setHearts((prev) => prev.filter((h) => h.id !== heartId));
        }, 800);
      }
    }

    try {
      await useFeedStore.getState().toggleLikeVideo(videoId);
    } catch (err) {
      console.error('[Feed] Like toggle failed:', err);
    }
  };

  // Tracing follow statuses on feed load
  useEffect(() => {
    const fetchFollowStatuses = async () => {
      if (!isAuthenticated || !firebaseUser || videos.length === 0) return;
      try {
        const token = await firebaseUser.getIdToken();
        const newFollowed = new Set<string>();
        const uniqueCreatorIds = Array.from(new Set(videos.map(v => v.creatorId).filter(Boolean)));

        for (const creatorId of uniqueCreatorIds) {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/follow/${creatorId}/status`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.status === 'success' && data.isFollowing) {
            newFollowed.add(creatorId);
          }
        }
        setFollowedCreators(newFollowed);
      } catch (e) {
        console.error('Error fetching follow statuses:', e);
      }
    };
    fetchFollowStatuses();
  }, [videos, isAuthenticated, firebaseUser]);

  const handleNotificationClick = (notif: any) => {
    setIsNotificationsOpen(false);
    const videoId = notif.metadata?.videoId;
    if (videoId) {
      const idx = videos.findIndex(v => String(v.id) === String(videoId));
      if (idx !== -1) {
        setCurrentIndex(idx);
        const container = containerRef.current;
        if (container) {
          const target = container.children[idx] as HTMLElement;
          if (target) {
            container.scrollTo({
              top: target.offsetTop,
              behavior: 'smooth'
            });
          }
        }
        if (notif.type === 'new_comment' || notif.type === 'comment_reply') {
          setTimeout(() => {
            setActiveCommentsVideoId(videoId);
          }, 600);
        }
      } else {
        setActiveCommentsVideoId(videoId);
      }
    }
  };

  const handleFollowToggle = async (creatorId: string) => {
    if (!creatorId) return;
    requireAuth(async () => {
      const newFollowed = new Set(followedCreators);
      const isCurrentlyFollowing = newFollowed.has(creatorId);
      if (isCurrentlyFollowing) {
        newFollowed.delete(creatorId);
      } else {
        newFollowed.add(creatorId);
      }
      setFollowedCreators(newFollowed);

      try {
        if (!firebaseUser) return;
        const token = await firebaseUser.getIdToken();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/follow/${creatorId}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        const data = await res.json();
        if (data.status === 'success') {
          const syncedFollowed = new Set(followedCreators);
          if (data.isFollowing) {
            syncedFollowed.add(creatorId);
          } else {
            syncedFollowed.delete(creatorId);
          }
          setFollowedCreators(syncedFollowed);
        }
      } catch (e) {
        console.error('Error toggling follow:', e);
        const reverted = new Set(followedCreators);
        if (isCurrentlyFollowing) {
          reverted.add(creatorId);
        } else {
          reverted.delete(creatorId);
        }
        setFollowedCreators(reverted);
      }
    });
  };

  const handleShare = async (video: any) => {
    const shareData = {
      title: `Watch ${video.creatorName || 'Creator'} on Toka`,
      text: video.title || 'Check out this awesome video on Toka!',
      url: video.videoUrl || (typeof window !== 'undefined' ? window.location.origin : '')
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        useFeedStore.getState().incrementShareCount(video.id);
      } catch (err) {
        console.log('[Share] Error sharing:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(video.videoUrl);
        useFeedStore.getState().incrementShareCount(video.id);
        alert('Video stream link copied to clipboard!');
      } catch (err) {
        console.error('[Share] Failed to copy link:', err);
        alert('Could not copy link to clipboard.');
      }
    }
  };

  // Loading Skeletons
  if (videos.length === 0 && isLoading) {
    return (
      <div className="relative w-full h-screen bg-midnight-boma text-cloud-white overflow-hidden flex font-sans">
        {/* Desktop Navigation Left Sidebar (Skeleton) */}
        <aside className="hidden md:flex flex-col h-full w-64 bg-shaded-canopy border-r border-white/10 py-6 px-4 shrink-0 select-none animate-pulse">
          <div className="h-8 bg-white/15 rounded-xl mb-12 w-28"></div>
          <div className="flex flex-col gap-4">
            <div className="h-10 bg-white/10 rounded-xl"></div>
            <div className="h-10 bg-white/10 rounded-xl"></div>
            <div className="h-10 bg-white/10 rounded-xl"></div>
          </div>
          <div className="mt-auto flex flex-col gap-4">
            <div className="h-10 bg-white/10 rounded-xl"></div>
            <div className="h-10 bg-white/10 rounded-xl"></div>
          </div>
        </aside>

        {/* Main Feed Container (Skeleton) */}
        <div className="flex-1 flex justify-center items-center h-full relative">
          <div className="relative w-full max-w-[450px] md:max-w-[400px] h-[100dvh] md:h-[92vh] md:rounded-[36px] md:border-8 md:border-neutral-800 overflow-hidden shadow-2xl bg-black flex flex-col justify-end p-6 gap-4">
            <div className="absolute right-4 bottom-24 flex flex-col gap-6 items-center">
              <div className="w-11 h-11 rounded-full bg-white/15 animate-pulse"></div>
              <div className="w-11 h-11 rounded-full bg-white/15 animate-pulse"></div>
              <div className="w-12 h-12 rounded-full bg-white/15 animate-pulse"></div>
              <div className="w-11 h-11 rounded-full bg-white/15 animate-pulse"></div>
            </div>
            <div className="w-24 h-5 bg-white/20 rounded animate-pulse"></div>
            <div className="w-3/4 h-3.5 bg-white/10 rounded animate-pulse"></div>
            <div className="w-1/2 h-3.5 bg-white/10 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-midnight-boma text-cloud-white overflow-hidden flex font-sans">

      {/* Desktop Navigation Left Sidebar (Hidden on Mobile) */}
      <aside className="hidden md:flex flex-col h-full w-64 bg-shaded-canopy border-r border-white/10 py-6 px-4 shrink-0 select-none">
        <div className="text-3xl font-black text-toka-flare tracking-tighter mb-12 px-4">Toka</div>
        <div className="flex flex-col gap-2">
          <button className="flex items-center gap-4 px-4 py-3 bg-white/10 rounded-xl text-cloud-white font-bold transition-all text-left">
            <span className="material-symbols-outlined text-toka-flare">home</span>
            Home
          </button>
          <Link href="/discover" className="flex items-center gap-4 px-4 py-3 rounded-xl text-cloud-white/70 hover:bg-white/5 hover:text-cloud-white transition-all text-left">
            <span className="material-symbols-outlined">explore</span>
            Discover
          </Link>
          <Link href="/inbox" className="flex items-center gap-4 px-4 py-3 rounded-xl text-cloud-white/70 hover:bg-white/5 hover:text-cloud-white transition-all text-left relative"
            onClick={clearInboxDot}
          >
            <span className="material-symbols-outlined">mail</span>
            Inbox
            {hasUnreadInbox && <span className="absolute top-4 right-4 w-2 h-2 bg-toka-flare rounded-full"></span>}
          </Link>
          {isAuthenticated ? (
            <div className="flex flex-col gap-1.5 px-4 py-3 bg-black/25 border border-white/10 rounded-xl mt-2 select-none">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-toka-flare text-[20px]">person</span>
                <span className="font-bold text-sm text-cloud-white truncate">@{mongooseUser?.username}</span>
              </div>
              <Link
                href="/deposit"
                className="flex justify-between items-center text-xs mt-1 text-cloud-white/60 hover:text-cloud-white font-mono cursor-pointer transition-colors group"
              >
                <span>Wallet:</span>
                <span className="font-bold text-fintech-mint group-hover:underline">ZAR {mongooseUser?.walletBalance.toFixed(2)}</span>
              </Link>
              <button
                onClick={logout}
                className="text-left text-xs font-bold text-red-500 hover:text-red-400 mt-2.5 flex items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center gap-4 px-4 py-3 rounded-xl text-cloud-white/70 hover:bg-white/5 hover:text-cloud-white transition-all text-left w-full"
            >
              <span className="material-symbols-outlined">login</span>
              Sign In
            </button>
          )}
        </div>

        <div className="mt-auto">
          <button
            onClick={() => {
              requireAuth(() => {
                if (mongooseUser?.role === 'moderator') {
                  window.location.href = '/moderation';
                } else {
                  alert('Access denied. Only moderators can access the Moderation queue.');
                }
              });
            }}
            className="w-full py-3 bg-shaded-canopy border border-white/10 text-cloud-white/70 rounded-xl font-bold hover:bg-white/5 transition-all flex justify-center items-center gap-2 mb-4 text-sm"
          >
            <span className="material-symbols-outlined text-toka-flare text-[20px]">shield</span>
            Moderator Panel
          </button>
          <button
            onClick={() => requireAuth(() => setIsUploadModalOpen(true))}
            className="w-full py-3 bg-toka-flare text-cloud-white rounded-xl font-bold hover:bg-toka-flare/90 transition-all shadow-lg flex justify-center items-center gap-2 text-sm"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            Create
          </button>
        </div>
      </aside>

      {/* Main Feed Container */}
      <div className="flex-1 flex justify-center items-center h-full relative">

        {/* Mobile Viewport Wrapper */}
        <div className="relative w-full max-w-[450px] md:max-w-[400px] h-[100dvh] md:h-[92vh] md:rounded-[36px] md:border-8 md:border-neutral-800 overflow-hidden shadow-2xl bg-black">

          {/* Top Translucent Navigation Bar Overlay */}
          <header className="absolute top-0 left-0 w-full z-40 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-center px-6 h-16 pointer-events-none">
            <Link href="/discover" className="pointer-events-auto flex items-center justify-center p-2 rounded-full hover:bg-white/10 transition-colors">
              <span className="material-symbols-outlined text-cloud-white">search</span>
            </Link>
            <div className="pointer-events-auto flex gap-6 items-center">
              <button
                onClick={() => requireAuth(() => setFeedType('following'))}
                className={`text-sm transition-colors ${feedType === 'following' ? 'text-cloud-white font-bold border-b-2 border-toka-flare pb-1' : 'text-cloud-white/60 font-semibold hover:text-cloud-white'
                  }`}
              >
                Following
              </button>
              <button
                onClick={() => setFeedType('foryou')}
                className={`text-sm transition-colors ${feedType === 'foryou' ? 'text-cloud-white font-bold border-b-2 border-toka-flare pb-1' : 'text-cloud-white/60 font-semibold hover:text-cloud-white'
                  }`}
              >
                For You
              </button>
            </div>
            <div className="pointer-events-auto flex items-center gap-3 select-none relative">
              {isAuthenticated ? (
                <>
                  <div className="relative">
                    <button
                      onClick={() => {
                        const next = !isNotificationsOpen;
                        setIsNotificationsOpen(next);
                        if (next) {
                          markNotificationsAsRead();
                        }
                      }}
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center text-cloud-white"
                      title="Notifications"
                    >
                      <span className="material-symbols-outlined text-[18px]">notifications</span>
                    </button>
                    
                    {/* Unread dot indicator */}
                    {notifications.some(n => !n.read) && (
                      <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-toka-flare rounded-full border border-midnight-boma animate-pulse"></span>
                    )}

                    {/* Notifications Dropdown Panel */}
                    {isNotificationsOpen && (
                      <div className="absolute right-0 top-10 w-72 bg-midnight-boma border border-white/10 rounded-2xl p-4 shadow-2xl z-50 flex flex-col gap-3 font-sans max-h-80 overflow-hidden">
                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                          <span className="text-xs font-bold text-cloud-white">Notifications</span>
                          <button 
                            onClick={() => setIsNotificationsOpen(false)}
                            className="text-[10px] font-bold text-cloud-white/40 hover:text-cloud-white transition-colors"
                          >
                            Close
                          </button>
                        </div>
                        <div className="flex flex-col gap-2 overflow-y-auto no-scrollbar max-h-56">
                          {notifications.length === 0 ? (
                            <div className="text-center py-6">
                              <span className="material-symbols-outlined text-cloud-white/10 text-3xl">notifications_off</span>
                              <p className="text-[10px] text-cloud-white/40 mt-1">No new notifications</p>
                            </div>
                          ) : (
                            notifications.map((notif) => (
                              <button
                                key={notif.id}
                                onClick={() => handleNotificationClick(notif)}
                                className="flex flex-col gap-0.5 border-b border-white/5 pb-2 last:border-0 last:pb-0 text-left hover:bg-white/5 p-1.5 rounded-lg transition-colors w-full cursor-pointer group"
                              >
                                <div className="flex items-center gap-1.5 justify-between flex-wrap w-full">
                                  <span className="text-[10px] font-bold text-cloud-white group-hover:text-toka-flare transition-colors">{notif.title}</span>
                                  {!notif.read && <span className="w-1.5 h-1.5 bg-toka-flare rounded-full"></span>}
                                </div>
                                <p className="text-[10px] text-cloud-white/70 leading-normal">{notif.body}</p>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <Link
                    href="/deposit"
                    className="flex flex-col items-end gap-0.5 max-w-[80px] cursor-pointer hover:opacity-85 transition-opacity"
                  >
                    <span className="text-[10px] font-black text-cloud-white truncate">@{mongooseUser?.username}</span>
                    <span className="text-[9px] font-mono text-fintech-mint font-bold hover:underline">Z{mongooseUser?.walletBalance}</span>
                  </Link>
                </>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-3 py-1 bg-toka-flare hover:bg-toka-flare/90 text-cloud-white rounded-full text-xs font-bold active:scale-95 transition-all shadow-md"
                >
                  Login
                </button>
              )}
            </div>
          </header>

          {/* Snapping Scroll Container */}
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="w-full h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar bg-black"
            style={{ scrollBehavior: 'smooth' }}
          >
            {videos.map((video, index) => {
              const isActive = index === currentIndex;
              return (
                <div
                  key={video.id}
                  onClick={(e) => {
                    if (e.detail === 2) {
                      handleDoubleTap(video.id, e);
                    }
                  }}
                  className="relative w-full h-full snap-start shrink-0 z-0 bg-black flex flex-col justify-end"
                >
                  <VideoPlayer src={video.videoUrl} isActive={isActive} poster={video.poster} />

                  {/* Floating hearts container */}
                  {hearts.map((heart) => (
                    <div
                      key={heart.id}
                      className="absolute z-40 pointer-events-none text-red-500 animate-heart-burst"
                      style={{ left: heart.x, top: heart.y }}
                    >
                      <span
                        className="material-symbols-outlined text-[48px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        favorite
                      </span>
                    </div>
                  ))}

                  {/* Right Action Sidebar Overlay */}
                  <aside className="absolute right-4 bottom-24 z-30 flex flex-col gap-5 items-center pointer-events-auto">

                    {/* Creator Avatar & Follow Button */}
                    <div className="relative mb-3 group select-none">
                      <Link href={`/profile?username=${video.creatorName.replace('@', '')}`} className="block cursor-pointer">
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-cloud-white p-[1px] shadow-lg hover:scale-105 transition-transform">
                          <img
                            src={video.creatorAvatar}
                            alt={video.creatorName}
                            className="w-full h-full object-cover rounded-full bg-shaded-canopy"
                          />
                        </div>
                      </Link>
                      {mongooseUser?._id !== video.creatorId && (
                        <button
                          onClick={() => handleFollowToggle(video.creatorId)}
                          className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full w-5 h-5 flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all border border-black ${followedCreators.has(video.creatorId) ? 'bg-fintech-mint text-midnight-boma' : 'bg-toka-flare text-cloud-white'
                            }`}
                        >
                          <span className="material-symbols-outlined text-[14px] font-bold">
                            {followedCreators.has(video.creatorId) ? 'check' : 'add'}
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Like Action */}
                    <button
                      onClick={(e) => handleLikeToggle(video.id, e)}
                      className="flex flex-col items-center gap-1 group active:scale-90 transition-transform select-none"
                    >
                      <div className="w-11 h-11 rounded-full bg-shaded-canopy/40 backdrop-blur-md flex items-center justify-center border border-white/10 group-hover:bg-white/20 transition-all">
                        <span
                          className={`material-symbols-outlined text-[24px] transition-all duration-200 ${video.isLiked ? 'text-red-500 scale-110' : 'text-cloud-white'
                            }`}
                          style={video.isLiked ? { fontVariationSettings: "'FILL' 1" } : undefined}
                        >
                          favorite
                        </span>
                      </div>
                      <span className="font-mono text-xs font-medium text-cloud-white drop-shadow-md">
                        {video.likes}
                      </span>
                    </button>

                    {/* Comment Action */}
                    <button
                      onClick={() => setActiveCommentsVideoId(video.id)}
                      className="flex flex-col items-center gap-1 group active:scale-90 transition-transform select-none"
                    >
                      <div className="w-11 h-11 rounded-full bg-shaded-canopy/40 backdrop-blur-md flex items-center justify-center border border-white/10 group-hover:bg-white/20 transition-all">
                        <span className="material-symbols-outlined text-cloud-white text-[24px]">forum</span>
                      </div>
                      <span className="font-mono text-xs font-medium text-cloud-white drop-shadow-md">
                        {video.commentsCount || 0}
                      </span>
                    </button>

                    {/* Tip Action (Prominent Toka Flare) */}
                    <button
                      onClick={() => requireAuth(() => setActiveTipVideoId(video.id))}
                      className="flex flex-col items-center gap-1 group active:scale-90 transition-transform select-none"
                    >
                      <div className="w-12 h-12 rounded-full bg-toka-flare flex items-center justify-center shadow-[0_0_15px_rgba(255,79,0,0.5)] hover:scale-105 transition-all">
                        <span className="material-symbols-outlined text-cloud-white text-[28px]">payments</span>
                      </div>
                      <span className="font-mono text-[10px] font-bold text-toka-flare drop-shadow-md uppercase tracking-wider">Tip ZAR</span>
                    </button>

                    {/* Share Action */}
                    <button
                      onClick={() => handleShare(video)}
                      className="flex flex-col items-center gap-1 group active:scale-90 transition-transform select-none"
                    >
                      <div className="w-11 h-11 rounded-full bg-shaded-canopy/40 backdrop-blur-md flex items-center justify-center border border-white/10 group-hover:bg-white/20 transition-all">
                        <span className="material-symbols-outlined text-cloud-white text-[24px]">share</span>
                      </div>
                      <span className="font-mono text-xs font-medium text-cloud-white drop-shadow-md">{video.shares}</span>
                    </button>

                    {/* More Action */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveOptionsVideoId(activeOptionsVideoId === video.id ? null : video.id);
                        }}
                        className="flex flex-col items-center gap-1 mt-1 group active:scale-90 transition-transform select-none"
                      >
                        <div className="w-9 h-9 rounded-full bg-shaded-canopy/60 backdrop-blur-md flex items-center justify-center border border-white/10 group-hover:bg-white/20 transition-all">
                          <span className="material-symbols-outlined text-cloud-white text-[20px]">more_horiz</span>
                        </div>
                      </button>

                      {activeOptionsVideoId === video.id && (
                        <div className="absolute right-12 bottom-0 z-50 w-44 bg-shaded-canopy/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-2 flex flex-col gap-1.5 animate-scale-up select-none pointer-events-auto">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await navigator.clipboard.writeText(video.videoUrl);
                                alert('Video stream URL copied to clipboard!');
                              } catch (err) {
                                alert('Failed to copy link.');
                              }
                              setActiveOptionsVideoId(null);
                            }}
                            className="flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 rounded-xl text-left text-xs font-semibold text-cloud-white/90 hover:text-cloud-white transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">content_copy</span>
                            Copy Link
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              alert('Thank you! This video has been flagged and queued for moderation review.');
                              setActiveOptionsVideoId(null);
                            }}
                            className="flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 rounded-xl text-left text-xs font-semibold text-red-500 hover:text-red-400 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px] text-red-500">flag</span>
                            Report Video
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              alert(`Creator blocked. You will no longer see content from @${video.creatorName}.`);
                              setActiveOptionsVideoId(null);
                            }}
                            className="flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 rounded-xl text-left text-xs font-semibold text-cloud-white/60 hover:text-cloud-white transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">block</span>
                            Block Creator
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Vinyl Audio Disk */}
                    {video.audioArt && (
                      <div className="w-10 h-10 rounded-full border border-white/20 p-1 mt-2 animate-[spin_6s_linear_infinite] overflow-hidden bg-black shadow-lg">
                        <img
                          src={video.audioArt}
                          alt="Audio art"
                          className="w-full h-full rounded-full object-cover"
                        />
                      </div>
                    )}
                  </aside>

                  {/* Bottom Left Info Overlay */}
                  <div className="absolute bottom-24 left-4 z-30 flex flex-col gap-2 max-w-[75%] pointer-events-auto select-none">

                    {/* Synced Mute / Unmute Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMute();
                      }}
                      className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center border border-white/10 text-white hover:bg-black/60 hover:scale-105 active:scale-95 transition-all mb-1 w-fit pointer-events-auto shadow-lg"
                      title={isMuted ? "Unmute" : "Mute"}
                    >
                      {isMuted ? (
                        <VolumeX className="w-4.5 h-4.5 text-white" />
                      ) : (
                        <Volume2 className="w-4.5 h-4.5 text-white animate-pulse" />
                      )}
                    </button>

                    {/* Brand Safe Badge */}
                    {video.vettingStatus === 'approved' && (
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-fintech-mint/10 border border-fintech-mint/30 w-fit backdrop-blur-sm shadow-sm">
                        <span className="material-symbols-outlined text-fintech-mint text-[14px]">verified_user</span>
                        <span className="font-mono text-[9px] uppercase font-bold tracking-wider text-fintech-mint">Brand Safe</span>
                      </div>
                    )}

                    {/* Username & Verification */}
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/profile?username=${video.creatorName.replace('@', '')}`}
                        className="font-bold text-base text-cloud-white drop-shadow-md hover:underline cursor-pointer"
                      >
                        {video.creatorName}
                      </Link>
                      {video.isVerified && (
                        <span className="material-symbols-outlined text-toka-flare text-[18px]">verified</span>
                      )}
                    </div>

                    {/* Description Caption */}
                    <p className="text-sm text-cloud-white/90 drop-shadow-md leading-snug line-clamp-2">
                      {video.description}
                    </p>

                    {/* Audio track info with marquee effect */}
                    {video.audioName && (
                      <div className="flex items-center gap-1.5 mt-1 text-cloud-white/80 w-[200px] overflow-hidden select-none shrink-0">
                        <span className="material-symbols-outlined text-toka-flare text-[16px] animate-pulse shrink-0">music_note</span>
                        <div className="overflow-hidden w-full relative h-4 flex items-center">
                          <div className="animate-marquee gap-8">
                            <span>{video.audioName}</span>
                            <span>{video.audioName}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile Bottom Navigation Bar */}
          <nav className="absolute bottom-0 left-0 w-full z-40 bg-midnight-boma/95 backdrop-blur-xl border-t border-white/10 flex justify-around items-center pt-2 pb-6 px-4">
            <button className="flex flex-col items-center justify-center text-toka-flare scale-105 transition-all w-14 select-none">
              <span className="material-symbols-outlined">home</span>
              <span className="text-[10px] font-medium font-mono">Home</span>
            </button>
            <Link href="/discover" className="flex flex-col items-center justify-center text-cloud-white/60 hover:text-cloud-white transition-all w-14 select-none">
              <span className="material-symbols-outlined">explore</span>
              <span className="text-[10px] font-mono">Discover</span>
            </Link>
            <button
              onClick={() => requireAuth(() => setIsUploadModalOpen(true))}
              className="flex flex-col items-center justify-center -mt-6 relative z-10 w-12 h-12 bg-cloud-white rounded-xl shadow-lg border-2 border-midnight-boma active:scale-95 transition-all select-none"
            >
              <span className="material-symbols-outlined text-midnight-boma font-bold text-[24px]">add</span>
            </button>
            <Link
              href="/inbox"
              onClick={clearInboxDot}
              className="flex flex-col items-center justify-center text-cloud-white/60 hover:text-cloud-white transition-all w-14 relative select-none"
            >
              <span className="material-symbols-outlined">mail</span>
              <span className="text-[10px] font-mono">Inbox</span>
              {hasUnreadInbox && <span className="absolute top-0 right-3.5 w-2 h-2 bg-toka-flare rounded-full"></span>}
            </Link>
            {isAuthenticated ? (
              <Link
                href="/profile"
                className="flex flex-col items-center justify-center text-cloud-white/60 hover:text-cloud-white transition-all w-14 select-none"
              >
                <span className="material-symbols-outlined">person</span>
                <span className="text-[10px] font-mono">Me</span>
              </Link>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="flex flex-col items-center justify-center text-cloud-white/60 hover:text-cloud-white transition-all w-14 select-none"
              >
                <span className="material-symbols-outlined">person</span>
                <span className="text-[10px] font-mono">Profile</span>
              </button>
            )}
          </nav>

        </div>
      </div>

      {/* Tip Popover Modal */}
      {activeTipVideoId && (
        <TipModal
          videoId={activeTipVideoId}
          isOpen={true}
          onClose={() => setActiveTipVideoId(null)}
        />
      )}

      {/* Auth Modal Overlay */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Upload Video Modal Overlay */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />

      {/* Comments Drawer/Modal Overlay */}
      {activeCommentsVideoId && (
        <CommentsModal
          videoId={activeCommentsVideoId}
          isOpen={true}
          onClose={() => setActiveCommentsVideoId(null)}
          creatorId={videos.find(v => v.id === activeCommentsVideoId)?.creatorId || ''}
        />
      )}

    </div>
  );
}
