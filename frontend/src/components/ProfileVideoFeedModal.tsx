"use client";
import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { Volume2, VolumeX, ArrowLeft } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import TipModal from './TipModal';
import CommentsModal from './CommentsModal';
import MentionText from './MentionText';
import { useAuth } from '@/context/AuthContext';
import { useModalStore } from '@/store/useModalStore';
import { useFeedStore } from '@/store/useFeedStore';

export interface ProfileFeedVideo {
  _id: string;
  title: string;
  videoUrl: string;
  vettingStatus: string;
  aiConfidenceScore: number;
  tips: number;
  createdAt: string;
  creatorId?: any;
  coAuthors?: Array<{
    user: any;
    status: 'pending' | 'accepted' | 'declined' | 'removed';
    splitPercentage?: number;
  }>;
  likesCount?: number;
  commentsCount?: number;
  isLiked?: boolean;
}

function generateHeartId(prefix = 'heart'): string {
  return `${prefix}-${Date.now()}-${Math.random()}`;
}

interface ProfileVideoFeedModalProps {
  videos: ProfileFeedVideo[];
  initialIndex: number;
  creatorUsername: string;
  onClose: () => void;
}

export default function ProfileVideoFeedModal({
  videos,
  initialIndex,
  creatorUsername,
  onClose
}: ProfileVideoFeedModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [activeTipVideoId, setActiveTipVideoId] = useState<string | null>(null);
  const [activeCommentsVideoId, setActiveCommentsVideoId] = useState<string | null>(null);
  const [highlightCommentId, setHighlightCommentId] = useState<string | null>(null);
  const { firebaseUser } = useAuth();
  const { showAlert } = useModalStore();
  const { isMuted, toggleMute } = useFeedStore();

  // Local likes tracking
  const [likesState, setLikesState] = useState<Record<string, { count: number; isLiked: boolean }>>({});
  const [hearts, setHearts] = useState<{ id: string; x: number; y: number }[]>([]);

  // Scroll to initial index on mount
  useEffect(() => {
    if (containerRef.current && initialIndex >= 0 && initialIndex < videos.length) {
      const targetElement = containerRef.current.children[initialIndex] as HTMLElement;
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
    }
  }, [initialIndex, videos.length]);

  // Set up IntersectionObserver for snap-scrolling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index'));
            if (!isNaN(index)) {
              setCurrentIndex(index);
            }
          }
        });
      },
      {
        root: container,
        threshold: 0.6
      }
    );

    const children = Array.from(container.children);
    children.forEach((child) => observer.observe(child));

    return () => {
      children.forEach((child) => observer.unobserve(child));
      observer.disconnect();
    };
  }, [videos]);

  // Like Toggle Handler
  const handleToggleLike = async (videoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!firebaseUser) {
      showAlert('Sign In Required', 'Please sign in to like videos.');
      return;
    }

    const currentLike = likesState[videoId] || { count: 0, isLiked: false };
    const newIsLiked = !currentLike.isLiked;
    const newCount = newIsLiked ? currentLike.count + 1 : Math.max(0, currentLike.count - 1);

    // Optimistic UI update
    setLikesState(prev => ({
      ...prev,
      [videoId]: { count: newCount, isLiked: newIsLiked }
    }));

    if (newIsLiked && e) {
      const rect = e.currentTarget.getBoundingClientRect();
      const heartId = generateHeartId();
      setHearts(prev => [...prev, { id: heartId, x: rect.left + rect.width / 2, y: rect.top }]);
      setTimeout(() => {
        setHearts(prev => prev.filter(h => h.id !== heartId));
      }, 800);
    }

    try {
      const token = await firebaseUser.getIdToken();
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/${videoId}/like`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
    } catch (err) {
      console.error('[Like Error]:', err);
    }
  };

  // Share Handler
  const handleShare = async (video: ProfileFeedVideo) => {
    const shareUrl = `${window.location.origin}/profile?username=${creatorUsername}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: video.title,
          text: `Check out "${video.title}" by @${creatorUsername} on Toka!`,
          url: shareUrl
        });
      } catch (err) {}
    } else {
      navigator.clipboard.writeText(shareUrl);
      showAlert('Link Copied', 'Video link copied to clipboard!');
    }
  };

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-center items-center select-none animate-fade-in">
      {/* Top Floating Control Bar */}
      <header className="absolute top-0 left-0 right-0 z-40 p-4 flex items-center justify-between pointer-events-none bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <button
          onClick={onClose}
          className="pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/50 backdrop-blur-md border border-white/15 text-cloud-white hover:bg-black/70 hover:scale-105 active:scale-95 transition-all text-xs font-bold shadow-lg"
        >
          <ArrowLeft className="w-4 h-4 text-toka-flare" />
          <span>@{creatorUsername}&apos;s Feed</span>
        </button>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={toggleMute}
            className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center text-cloud-white hover:bg-black/70 hover:scale-105 active:scale-95 transition-all shadow-lg"
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-fintech-mint" />}
          </button>
        </div>
      </header>

      {/* Snap-Scrolling Video Container */}
      <div
        ref={containerRef}
        className="w-full h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar bg-black"
      >
        {videos.map((video, index) => {
          const isActive = index === currentIndex;
          const likeInfo = likesState[video._id] || { count: video.likesCount || 0, isLiked: video.isLiked || false };
          const acceptedCoAuthor = video.coAuthors?.find(ca => ca.status === 'accepted');

          const primaryUsername = typeof video.creatorId === 'object' && video.creatorId?.username
            ? video.creatorId.username
            : creatorUsername;

          const coAuthorUsername = acceptedCoAuthor?.user?.username || (typeof acceptedCoAuthor?.user === 'string' ? '' : '');

          return (
            <div
              key={video._id}
              data-index={index}
              className="w-full h-screen snap-start snap-always relative flex items-center justify-center bg-black overflow-hidden"
            >
              {/* Fullscreen Video Player */}
              <div className="w-full h-full flex items-center justify-center">
                <VideoPlayer
                  src={video.videoUrl}
                  isActive={isActive}
                />
              </div>

              {/* Action Sidebar (Right Side) */}
              <div className="absolute right-3 bottom-24 z-30 flex flex-col items-center gap-4">
                {/* Creator Avatar */}
                <Link
                  href={`/profile?username=${primaryUsername}`}
                  className="w-11 h-11 rounded-full bg-gradient-to-br from-toka-flare to-orange-700 p-0.5 shadow-xl hover:scale-105 transition-transform relative group"
                >
                  <div className="w-full h-full rounded-full bg-midnight-boma flex items-center justify-center font-bold text-xs text-cloud-white">
                    {primaryUsername.charAt(0).toUpperCase()}
                  </div>
                </Link>

                {/* Like / Heart Action */}
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={(e) => handleToggleLike(video._id, e)}
                    className={`w-11 h-11 rounded-full backdrop-blur-md border flex items-center justify-center transition-all active:scale-75 shadow-lg ${
                      likeInfo.isLiked
                        ? 'bg-red-500/20 border-red-500/40 text-red-500'
                        : 'bg-black/40 border-white/10 text-cloud-white hover:bg-black/60'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-[24px] ${likeInfo.isLiked ? 'fill-current' : ''}`}>
                      favorite
                    </span>
                  </button>
                  <span className="text-[10px] font-bold font-mono text-cloud-white shadow-sm">
                    {likeInfo.count}
                  </span>
                </div>

                {/* Comments Action */}
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => setActiveCommentsVideoId(video._id)}
                    className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-cloud-white hover:bg-black/60 transition-all active:scale-75 shadow-lg"
                  >
                    <span className="material-symbols-outlined text-[24px]">chat_bubble</span>
                  </button>
                  <span className="text-[10px] font-bold font-mono text-cloud-white shadow-sm">
                    {video.commentsCount || 0}
                  </span>
                </div>

                {/* Tip Creator Action */}
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => setActiveTipVideoId(video._id)}
                    className="w-11 h-11 rounded-full bg-toka-flare/20 backdrop-blur-md border border-toka-flare/40 flex items-center justify-center text-toka-flare hover:bg-toka-flare/30 hover:scale-105 active:scale-75 transition-all shadow-lg"
                  >
                    <span className="material-symbols-outlined text-[24px]">savings</span>
                  </button>
                  <span className="text-[10px] font-bold font-mono text-toka-flare shadow-sm">Tip</span>
                </div>

                {/* Share Action */}
                <button
                  onClick={() => handleShare(video)}
                  className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-cloud-white hover:bg-black/60 transition-all active:scale-75 shadow-lg"
                >
                  <span className="material-symbols-outlined text-[22px]">share</span>
                </button>
              </div>

              {/* Bottom Video Metadata & Captions */}
              <div className="absolute left-0 bottom-0 right-16 z-20 p-4 pb-8 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col gap-2 pointer-events-none">
                {/* Creator Handles & Dual Authorship */}
                <div className="flex items-center gap-1.5 flex-wrap pointer-events-auto">
                  <Link
                    href={`/profile?username=${primaryUsername}`}
                    className="font-bold text-sm text-cloud-white hover:underline flex items-center gap-1 drop-shadow-md"
                  >
                    <span>@{primaryUsername}</span>
                  </Link>

                  {acceptedCoAuthor && coAuthorUsername && (
                    <>
                      <span className="text-cloud-white/60 text-xs">&amp;</span>
                      <Link
                        href={`/profile?username=${coAuthorUsername}`}
                        className="font-bold text-sm text-toka-flare hover:underline flex items-center gap-1 drop-shadow-md"
                      >
                        <span>@{coAuthorUsername}</span>
                        {acceptedCoAuthor.user?.isBrandSafeVerified && (
                          <span className="material-symbols-outlined text-fintech-mint text-[14px]">verified</span>
                        )}
                      </Link>
                      <span className="bg-toka-flare/20 border border-toka-flare/40 text-toka-flare text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full">
                        🤝 Collab
                      </span>
                    </>
                  )}
                </div>

                {/* Video Caption / Mentions */}
                <div className="text-xs font-medium text-cloud-white/90 leading-relaxed drop-shadow-md pointer-events-auto line-clamp-3">
                  <MentionText text={video.title} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Heart Animations Overlay */}
      {hearts.map((h) => (
        <span
          key={h.id}
          style={{ left: `${h.x}px`, top: `${h.y}px` }}
          className="fixed pointer-events-none material-symbols-outlined text-red-500 text-3xl animate-heart-burst z-50 fill-current drop-shadow-lg"
        >
          favorite
        </span>
      ))}

      {/* Tip Modal */}
      {activeTipVideoId && (
        <TipModal
          videoId={activeTipVideoId}
          isOpen={Boolean(activeTipVideoId)}
          onClose={() => setActiveTipVideoId(null)}
        />
      )}

      {/* Comments Drawer Modal */}
      {activeCommentsVideoId && (
        <CommentsModal
          isOpen={Boolean(activeCommentsVideoId)}
          videoId={activeCommentsVideoId}
          creatorId={
            (() => {
              const activeVid = videos.find(v => v._id === activeCommentsVideoId);
              return typeof activeVid?.creatorId === 'object'
                ? activeVid?.creatorId?._id || ''
                : activeVid?.creatorId || '';
            })()
          }
          highlightCommentId={highlightCommentId || undefined}
          onClose={() => {
            setActiveCommentsVideoId(null);
            setHighlightCommentId(null);
          }}
        />
      )}
    </div>
  );
}
