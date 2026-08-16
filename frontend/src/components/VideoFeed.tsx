"use client";
import React, { useRef, useState, useEffect } from 'react';
import { useFeedStore } from '@/store/useFeedStore';
import { getPerformanceInstance } from '@/lib/firebase';
import { trace } from 'firebase/performance';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useModalStore } from '@/store/useModalStore';
import { Volume2, VolumeX } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import TipModal from './TipModal';
import AuthModal from './AuthModal';
import UploadModal from './UploadModal';
import CommentsModal from './CommentsModal';
import MentionText from './MentionText';
import StatusTray from './status/StatusTray';
import StatusViewerModal from './status/StatusViewerModal';
import StatusCreatorModal from './status/StatusCreatorModal';
import { useAuth } from '@/context/AuthContext';
import { 
  TokaHeartIcon, 
  TokaCommentIcon, 
  TokaTipIcon, 
  TokaShareIcon, 
  TokaRepostIcon 
} from './icons/TokaIcons';

function generateHeartId(prefix = 'heart'): string {
  return `${prefix}-${Date.now()}-${Math.random()}`;
}

function formatNotificationTime(isoString?: string): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short'
    });
  } catch (e) {
    return '';
  }
}

interface SwipeableRepostBadgeProps {
  videoId: string;
  onDismiss: (videoId: string) => void;
}

function SwipeableRepostBadge({ videoId, onDismiss }: SwipeableRepostBadgeProps) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDismissing, setIsDismissing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);

  const handleStart = (clientX: number, clientY: number) => {
    touchStartXRef.current = clientX;
    touchStartYRef.current = clientY;
    setIsDragging(true);
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    const diffX = clientX - touchStartXRef.current;
    const diffY = clientY - touchStartYRef.current;

    // Favor horizontal drag
    if (Math.abs(diffX) > Math.abs(diffY)) {
      setDragOffset(diffX);
    }
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (Math.abs(dragOffset) > 35) {
      setIsDismissing(true);
      setTimeout(() => {
        onDismiss(videoId);
      }, 220);
    } else {
      setDragOffset(0);
    }
  };

  const opacity = isDismissing ? 0 : Math.max(0, 1 - Math.abs(dragOffset) / 80);
  const transform = isDismissing
    ? `translateX(${dragOffset >= 0 ? '120%' : '-120%'})`
    : `translateX(${dragOffset}px)`;

  return (
    <div
      onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchEnd={handleEnd}
      onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
      onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      style={{
        transform,
        opacity,
        transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease',
        touchAction: 'pan-y'
      }}
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 w-fit backdrop-blur-md shadow-sm select-none cursor-grab active:cursor-grabbing group hover:bg-amber-500/30 transition-colors animate-fade-in"
      title="Swipe left or right to dismiss"
    >
      <span className="material-symbols-outlined text-amber-400 text-[13px] pointer-events-none">repeat</span>
      <span className="font-mono text-[9px] uppercase font-bold tracking-wider text-amber-300 pointer-events-none">
        You Reposted
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsDismissing(true);
          setTimeout(() => onDismiss(videoId), 200);
        }}
        className="opacity-40 group-hover:opacity-100 hover:text-amber-200 ml-0.5 p-0.5 rounded-full transition-opacity cursor-pointer flex items-center justify-center"
        title="Dismiss"
      >
        <span className="material-symbols-outlined text-[11px] text-amber-400">close</span>
      </button>
    </div>
  );
}

export default function VideoFeed() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const creatorParam = searchParams?.get('creator');
  const videoIdParam = searchParams?.get('videoId');

  const { videos, currentIndex, setCurrentIndex, isLoading, feedType, setFeedType, setCreatorFilter, isMuted, toggleMute, notifications, markNotificationsAsRead, fetchNotifications } = useFeedStore();
  const { mongooseUser, isAuthenticated, logout, firebaseUser } = useAuth();
  const { showAlert } = useModalStore();
  const [activeTipVideoId, setActiveTipVideoId] = useState<string | null>(null);
  const [activeCommentsVideoId, setActiveCommentsVideoId] = useState<string | null>(null);
  const [highlightCommentId, setHighlightCommentId] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  // States for micro-interactions
  const [hearts, setHearts] = useState<{ id: string; x: number; y: number }[]>([]);
  const [followedCreators, setFollowedCreators] = useState<Set<string>>(new Set());
  const [activeOptionsVideoId, setActiveOptionsVideoId] = useState<string | null>(null);
  const [dismissedRepostBadges, setDismissedRepostBadges] = useState<Set<string>>(new Set());

  // Clean / Fullscreen View Mode state
  const [isCleanMode, setIsCleanMode] = useState(false);
  const [showCleanHint, setShowCleanHint] = useState(false);
  const singleTapTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cleanHintTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleDismissRepostBadge = (videoId: string) => {
    setDismissedRepostBadges((prev) => {
      const next = new Set(prev);
      next.add(videoId);
      return next;
    });
  };

  // Sync creator filter from URL params
  useEffect(() => {
    if (creatorParam) {
      setCreatorFilter(creatorParam);
    } else {
      setCreatorFilter(null);
    }
  }, [creatorParam, setCreatorFilter]);

  // Auto-scroll to videoId if provided in query params
  const hasScrolledToInitialVideoRef = useRef(false);
  useEffect(() => {
    if (videoIdParam && videos.length > 0 && !hasScrolledToInitialVideoRef.current) {
      const targetIndex = videos.findIndex(v => v.id === videoIdParam);
      if (targetIndex !== -1 && containerRef.current) {
        hasScrolledToInitialVideoRef.current = true;
        setCurrentIndex(targetIndex);
        const targetElement = containerRef.current.children[targetIndex] as HTMLElement;
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
      }
    }
  }, [videoIdParam, videos, setCurrentIndex]);

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

  // Close notifications dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target as Node)
      ) {
        setIsNotificationsOpen(false);
      }
    }

    if (isNotificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotificationsOpen]);

  // Mark notifications as read when the dropdown is closed
  useEffect(() => {
    if (isNotificationsOpen) {
      wasOpenRef.current = true;
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      if (notifications.some(n => !n.read)) {
        markNotificationsAsRead();
      }
    }
  }, [isNotificationsOpen, notifications, markNotificationsAsRead]);

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

  const handleVideoCardClick = (videoId: string, e: React.MouseEvent<HTMLDivElement>) => {
    if (e.detail === 2) {
      // Double tap: Cancel single tap timer & trigger heart like
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      handleDoubleTap(videoId, e);
    } else if (e.detail === 1) {
      // Single tap: Wait 240ms before toggling clean mode to allow double-tap
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
      singleTapTimerRef.current = setTimeout(() => {
        setIsCleanMode((prev) => {
          const next = !prev;
          if (next) {
            setShowCleanHint(true);
            if (cleanHintTimerRef.current) clearTimeout(cleanHintTimerRef.current);
            cleanHintTimerRef.current = setTimeout(() => {
              setShowCleanHint(false);
            }, 1600);
          } else {
            setShowCleanHint(false);
          }
          return next;
        });
        singleTapTimerRef.current = null;
      }, 240);
    }
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
    const commentId = notif.metadata?.commentId;
    const type = notif.type;

    // 1) Sponsorship-related notifications: navigate directly to /sponsorships
    if (
      type === 'sponsorship_requested' || 
      type?.startsWith('sponsorship_') ||
      notif.title?.toLowerCase().includes('sponsorship') ||
      notif.body?.toLowerCase().includes('sponsorship')
    ) {
      router.push('/sponsorships');
      return;
    }

    // 2) Verification-related notifications: navigate to /moderation (moderator) or /profile
    if (type?.includes('verification') || notif.title?.toLowerCase().includes('verification')) {
      if (mongooseUser?.role === 'moderator') {
        router.push('/moderation');
      } else {
        router.push('/profile');
      }
      return;
    }

    // 3) Co-Author invitation & response notifications: navigate to /inbox
    if (
      type?.startsWith('coauthor_') ||
      notif.title?.toLowerCase().includes('co-author') ||
      notif.body?.toLowerCase().includes('co-author')
    ) {
      router.push('/inbox');
      return;
    }

    // Helper: scroll to a video in the feed by its ID
    const scrollToVideo = (targetVideoId: string): boolean => {
      const idx = videos.findIndex(v => String(v.id) === String(targetVideoId));
      if (idx === -1) return false;
      setCurrentIndex(idx);
      const container = containerRef.current;
      if (container) {
        const target = container.children[idx] as HTMLElement;
        if (target) {
          container.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
        }
      }
      return true;
    };

    // Helper: open comments modal for a video, optionally highlighting a comment
    const openComments = (targetVideoId: string, targetCommentId?: string) => {
      setHighlightCommentId(targetCommentId || null);
      setTimeout(() => {
        setActiveCommentsVideoId(targetVideoId);
      }, 500);
    };

    if (!videoId) return;

    const foundInFeed = scrollToVideo(videoId);

    // For comment-related types, open the comments modal
    if (type === 'new_comment' || type === 'comment_reply' || type === 'comment_like' || type === 'comment_mention') {
      openComments(videoId, commentId);
    }
    // For video_like, tip_received, vetting_update — scrolling to the video is sufficient
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
        showAlert('Link Copied', 'Video stream link copied to clipboard!');
      } catch (err) {
        console.error('[Share] Failed to copy link:', err);
        showAlert('Error', 'Could not copy link to clipboard.');
      }
    }
  };

  // Loading Skeletons
  if (videos.length === 0 && isLoading) {
    return (
      <div className="relative w-full h-full bg-midnight-boma text-cloud-white overflow-hidden flex justify-center items-center font-sans">
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
    <div className="relative w-full h-full bg-midnight-boma text-cloud-white overflow-hidden flex justify-center items-center font-sans">
      {/* Main Feed Container */}
      <div className="flex-1 flex justify-center items-center h-full relative">
        {/* Mobile Viewport Wrapper */}
        <div className="relative w-full max-w-[450px] md:max-w-[400px] h-[100dvh] md:h-[92vh] md:rounded-[36px] md:border-8 md:border-neutral-800 overflow-hidden shadow-2xl bg-black">

          {/* Top Translucent Navigation Bar Overlay */}
          <header className={`absolute top-0 left-0 w-full z-40 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-center px-6 h-16 pointer-events-none transition-all duration-300 ease-out ${
            isCleanMode ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'
          }`}>
            {creatorParam ? (
              <Link
                href={`/profile?username=${creatorParam}`}
                className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-xs font-bold text-cloud-white hover:bg-black/80 transition-all shadow-md active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px] text-toka-flare">arrow_back</span>
                <span>@{creatorParam}&apos;s Videos</span>
              </Link>
            ) : (
              <Link href="/discover" className="pointer-events-auto flex items-center justify-center p-2 rounded-full hover:bg-white/10 transition-colors">
                <span className="material-symbols-outlined text-cloud-white">search</span>
              </Link>
            )}

            {!creatorParam && (
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
            )}
            <div className="pointer-events-auto flex items-center gap-3 select-none relative">
              {isAuthenticated ? (
                <>
                  <div className="relative" ref={notificationsRef}>
                    <button
                      onClick={() => {
                        setIsNotificationsOpen(prev => !prev);
                      }}
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center text-cloud-white"
                      title="Notifications"
                    >
                      <span className="material-symbols-outlined text-[18px]">notifications</span>
                    </button>

                    {/* Unread dot indicator */}
                    {notifications.some(n => !n.read) && !isNotificationsOpen && (
                      <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-toka-flare rounded-full border border-midnight-boma animate-pulse"></span>
                    )}

                    {/* Notifications Dropdown Panel */}
                    {isNotificationsOpen && (
                      <div className="fixed md:absolute top-16 md:top-10 left-4 right-4 md:left-auto md:right-0 w-auto md:w-80 bg-midnight-boma border border-white/10 rounded-2xl p-4 shadow-2xl z-50 flex flex-col gap-3 font-sans max-h-80 overflow-hidden">
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
                                className={`flex flex-col gap-0.5 border-b border-white/5 pb-2 last:border-0 last:pb-0 text-left p-1.5 rounded-lg transition-all w-full cursor-pointer group ${!notif.read
                                    ? 'bg-toka-flare/8 border-l-[3px] border-toka-flare pl-2 shadow-sm'
                                    : 'hover:bg-white/5 border-l-[3px] border-transparent pl-2'
                                  }`}
                              >
                                <div className="flex items-center justify-between gap-2 w-full">
                                  <span className={`text-[10px] font-bold transition-colors ${!notif.read ? 'text-cloud-white group-hover:text-toka-flare' : 'text-cloud-white/60 group-hover:text-cloud-white'
                                    }`}>
                                    {notif.title}
                                  </span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[8px] text-cloud-white/30 font-mono">{formatNotificationTime(notif.createdAt)}</span>
                                    {!notif.read && (
                                      <span className="w-1.5 h-1.5 bg-toka-flare rounded-full shadow-[0_0_6px_rgba(255,79,0,0.8)] animate-pulse"></span>
                                    )}
                                  </div>
                                </div>
                                <p className={`text-[10px] leading-normal transition-colors ${!notif.read ? 'text-cloud-white/90' : 'text-cloud-white/50'
                                  }`}>
                                  {notif.body}
                                </p>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <Link
                    href="/profile"
                    className="cursor-pointer hover:opacity-90 transition-opacity select-none relative block"
                    title={`@${mongooseUser?.username} Profile`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-toka-flare to-orange-700 flex items-center justify-center shadow-md text-lg font-black text-cloud-white overflow-hidden border border-white/10">
                      {mongooseUser?.avatarUrl ? (
                        <img src={mongooseUser.avatarUrl} alt={mongooseUser.username} className="w-full h-full object-cover" />
                      ) : (
                        mongooseUser?.username ? mongooseUser.username.charAt(0).toUpperCase() : ''
                      )}
                    </div>
                    {mongooseUser?.isBrandSafeVerified && (
                      <div className="absolute -bottom-1 -right-1 bg-midnight-boma rounded-full p-[2px] flex items-center justify-center z-20 shadow-md">
                        <span 
                          className="material-symbols-outlined text-fintech-mint block select-none" 
                          style={{ fontSize: '13px', width: '13px', height: '13px', lineHeight: '1' }}
                        >
                          verified
                        </span>
                      </div>
                    )}
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

          {/* Top Status Updates Carousel (Followers-Only Ephemeral Tray) */}
          <div className={`absolute top-16 left-0 right-0 z-35 pointer-events-auto transition-all duration-300 ${
            isCleanMode ? '-translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
          }`}>
            <StatusTray />
          </div>

          {/* Snapping Scroll Container */}
          {videos.length === 0 && !isLoading ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 bg-black">
              <span className="material-symbols-outlined text-[56px] text-cloud-white/20 mb-3">videocam_off</span>
              <p className="text-sm font-bold text-cloud-white/80">No videos found</p>
              <p className="text-xs text-cloud-white/40 mt-1 max-w-[240px]">
                {creatorParam
                  ? `@${creatorParam} hasn't posted any videos yet.`
                  : 'No videos available on the feed.'}
              </p>
              {creatorParam ? (
                <Link
                  href={`/profile?username=${creatorParam}`}
                  className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-cloud-white text-xs font-bold rounded-xl transition-all"
                >
                  Return to @{creatorParam}&apos;s Profile
                </Link>
              ) : (
                <button
                  onClick={() => requireAuth(() => setIsUploadModalOpen(true))}
                  className="mt-4 px-4 py-2 bg-toka-flare hover:bg-toka-flare/90 text-cloud-white text-xs font-bold rounded-xl transition-all shadow-lg"
                >
                  Upload a Video
                </button>
              )}
            </div>
          ) : (
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
                  onClick={(e) => handleVideoCardClick(video.id, e)}
                  className="relative w-full h-full snap-start shrink-0 z-0 bg-black flex flex-col justify-end cursor-pointer"
                >
                  <VideoPlayer src={video.videoUrl} isActive={isActive} poster={video.poster} isCleanMode={isCleanMode} />

                  {/* Clean Mode Floating Toast Hint */}
                  {showCleanHint && (
                    <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-fade-in">
                      <div className="px-3.5 py-1.5 rounded-full bg-black/75 backdrop-blur-xl border border-white/20 text-[11px] font-mono font-medium text-cloud-white shadow-2xl flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[15px] text-toka-flare">fullscreen</span>
                        <span>Clean View • Tap to restore</span>
                      </div>
                    </div>
                  )}

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
                  <aside className={`video-actions-sidebar absolute right-4 bottom-24 z-30 flex flex-col gap-5 items-center pointer-events-auto transition-all duration-300 ease-out ${
                    isCleanMode ? 'translate-x-20 opacity-0 pointer-events-none' : 'translate-x-0 opacity-100'
                  }`}>

                    {/* Creator Avatar & Follow Button */}
                    <div className="relative mb-3 group select-none">
                      <Link href={`/profile?username=${video.creatorName.replace('@', '')}`} className="block cursor-pointer">
                        <div className="sidebar-creator-avatar w-12 h-12 rounded-full overflow-hidden border-2 border-cloud-white p-[1px] shadow-lg hover:scale-105 transition-transform flex items-center justify-center bg-gradient-to-br from-toka-flare to-orange-700">
                          {video.creatorAvatar ? (
                            <img
                              src={video.creatorAvatar}
                              alt={video.creatorName}
                              className="w-full h-full object-cover rounded-full bg-shaded-canopy"
                            />
                          ) : (
                            <span className="font-black text-sm text-cloud-white">
                              {video.creatorName.replace('@', '').charAt(0).toUpperCase()}
                            </span>
                          )}
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
                      <div className="sidebar-action-btn w-11 h-11 rounded-full bg-shaded-canopy/40 backdrop-blur-md flex items-center justify-center border border-white/10 group-hover:bg-white/20 transition-all">
                        <TokaHeartIcon
                          size={24}
                          filled={video.isLiked}
                          className={`transition-all duration-200 ${
                            video.isLiked ? 'text-red-500 scale-110' : 'text-cloud-white'
                          }`}
                        />
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
                      <div className="sidebar-action-btn w-11 h-11 rounded-full bg-shaded-canopy/40 backdrop-blur-md flex items-center justify-center border border-white/10 group-hover:bg-white/20 transition-all">
                        <TokaCommentIcon size={24} className="text-cloud-white" />
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
                      <div className="sidebar-tip-btn w-12 h-12 rounded-full bg-toka-flare flex items-center justify-center shadow-[0_0_15px_rgba(255,79,0,0.5)] hover:scale-105 transition-all">
                        <TokaTipIcon size={26} className="text-cloud-white" />
                      </div>
                      <span className="font-mono text-[10px] font-bold text-toka-flare drop-shadow-md uppercase tracking-wider">Tip ZAR</span>
                    </button>

                    {/* Share Action */}
                    <button
                      onClick={() => handleShare(video)}
                      className="flex flex-col items-center gap-1 group active:scale-90 transition-transform select-none"
                    >
                      <div className="sidebar-action-btn w-11 h-11 rounded-full bg-shaded-canopy/40 backdrop-blur-md flex items-center justify-center border border-white/10 group-hover:bg-white/20 transition-all">
                        <TokaShareIcon size={20} className="text-cloud-white" />
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
                              requireAuth(async () => {
                                try {
                                  const wasReposted = video.isReposted;
                                  await useFeedStore.getState().toggleRepost(video.id);
                                  showAlert(
                                    wasReposted ? 'Repost Removed' : 'Video Reposted! 🔁',
                                    wasReposted
                                      ? 'This video was removed from your profile reposts.'
                                      : 'Video reposted! It now appears on your profile Reposts tab.'
                                  );
                                } catch (err) {
                                  showAlert('Error', 'Failed to update repost.');
                                }
                              });
                              setActiveOptionsVideoId(null);
                            }}
                            className={`flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 rounded-xl text-left text-xs font-semibold transition-colors cursor-pointer ${
                              video.isReposted ? 'text-amber-400 hover:text-amber-300' : 'text-cloud-white/90 hover:text-cloud-white'
                            }`}
                          >
                            <TokaRepostIcon size={18} className="shrink-0" />
                            <span>{video.isReposted ? 'Remove Repost' : 'Repost Video'}</span>
                          </button>

                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await navigator.clipboard.writeText(video.videoUrl);
                                showAlert('Link Copied', 'Video stream URL copied to clipboard!');
                              } catch (err) {
                                showAlert('Error', 'Failed to copy link.');
                              }
                              setActiveOptionsVideoId(null);
                            }}
                            className="flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 rounded-xl text-left text-xs font-semibold text-cloud-white/90 hover:text-cloud-white transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">content_copy</span>
                            Copy Link
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              showAlert('Report Submitted', 'Thank you! This video has been flagged and queued for moderation review.');
                              setActiveOptionsVideoId(null);
                            }}
                            className="flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 rounded-xl text-left text-xs font-semibold text-red-500 hover:text-red-400 transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px] text-red-500">flag</span>
                            Report Video
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              showAlert('Creator Blocked', `Creator blocked. You will no longer see content from @${video.creatorName}.`);
                              setActiveOptionsVideoId(null);
                            }}
                            className="flex items-center gap-2.5 px-3 py-2 hover:bg-white/10 rounded-xl text-left text-xs font-semibold text-cloud-white/60 hover:text-cloud-white transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">block</span>
                            Block Creator
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Vinyl Audio Disk */}
                    <div className="w-10 h-10 rounded-full border border-white/20 p-1 mt-2 animate-[spin_6s_linear_infinite] overflow-hidden bg-black shadow-lg">
                      <img
                        src={video.audioArt || '/images/audio-album.jpg'}
                        alt="Audio art"
                        className="w-full h-full rounded-full object-cover"
                      />
                    </div>
                  </aside>

                  {/* Bottom Left Info Overlay */}
                  <div className={`absolute bottom-24 left-4 z-30 flex flex-col gap-2 max-w-[75%] pointer-events-auto select-none transition-all duration-300 ease-out ${
                    isCleanMode ? 'translate-y-12 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
                  }`}>

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

                    {/* Repost Badge with Swipe-to-Dismiss */}
                    {video.isReposted && !dismissedRepostBadges.has(video.id) && (
                      <SwipeableRepostBadge
                        videoId={video.id}
                        onDismiss={handleDismissRepostBadge}
                      />
                    )}

                    {/* Brand Safe Badge */}
                    {video.vettingStatus === 'approved' && (
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-fintech-mint/10 border border-fintech-mint/30 w-fit backdrop-blur-sm shadow-sm">
                        <span className="material-symbols-outlined text-fintech-mint text-[14px]">verified_user</span>
                        <span className="font-mono text-[9px] uppercase font-bold tracking-wider text-fintech-mint">Brand Safe</span>
                      </div>
                    )}

                    {/* Username & Verification (Supports Dual Authorship / Co-Authors) */}
                    {(() => {
                      const acceptedCoAuthor = video.coAuthors?.find(ca => ca.status === 'accepted')?.user;
                      if (acceptedCoAuthor) {
                        return (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Link
                              href={`/profile?username=${video.creatorName.replace('@', '')}`}
                              className="font-bold text-base text-cloud-white drop-shadow-md hover:underline cursor-pointer flex items-center gap-1"
                            >
                              {video.creatorName}
                              {video.isVerified && (
                                <span className="material-symbols-outlined text-toka-flare text-[18px]">verified</span>
                              )}
                            </Link>
                            <span className="text-cloud-white/60 font-black text-xs uppercase bg-black/40 px-1.5 py-0.5 rounded border border-white/10">
                              &amp;
                            </span>
                            <Link
                              href={`/profile?username=${acceptedCoAuthor.username}`}
                              className="font-bold text-base text-cloud-white drop-shadow-md hover:underline cursor-pointer flex items-center gap-1"
                            >
                              @{acceptedCoAuthor.username}
                              {acceptedCoAuthor.isBrandSafeVerified && (
                                <span className="material-symbols-outlined text-toka-flare text-[18px]">verified</span>
                              )}
                            </Link>
                          </div>
                        );
                      }

                      return (
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
                      );
                    })()}

                    {/* Description Caption */}
                    <p className="text-sm text-cloud-white/90 drop-shadow-md leading-snug line-clamp-2">
                      <MentionText text={video.description} />
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
          )}

          {/* Mobile Bottom Navigation Bar */}
          <nav className={`absolute bottom-0 left-0 w-full z-40 bg-midnight-boma/95 backdrop-blur-xl border-t border-white/10 flex justify-around items-center pt-2 pb-6 px-4 transition-all duration-300 ease-out ${
            isCleanMode ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
          }`}>
            <button className="flex flex-col items-center justify-center text-toka-flare scale-105 transition-all w-14 select-none">
              <span className="material-symbols-outlined material-symbols-filled">home</span>
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
          onClose={() => { setActiveCommentsVideoId(null); setHighlightCommentId(null); }}
          creatorId={videos.find(v => v.id === activeCommentsVideoId)?.creatorId || ''}
          highlightCommentId={highlightCommentId ?? undefined}
        />
      )}

      {/* 24-Hour Ephemeral Status Story Viewer Modal */}
      <StatusViewerModal />

      {/* 24-Hour Status Creator Modal */}
      <StatusCreatorModal />

    </div>
  );
}
