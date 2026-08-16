"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStatusStore, StatusItem } from '@/store/useStatusStore';
import { useAuth } from '@/context/AuthContext';
import { 
  X, 
  Trash2, 
  Volume2, 
  VolumeX, 
  Send, 
  Eye, 
  ChevronUp, 
  ChevronDown, 
  Flame, 
  Sparkles,
  Music,
  CheckCircle2,
  Share2
} from 'lucide-react';

const QUICK_EMOJIS = ['🔥', '❤️', '😂', '👏', '🚀', '💯'];

function formatTimeAgo(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return 'Expired';
  } catch (e) {
    return '';
  }
}

export default function StatusViewerModal() {
  const { mongooseUser } = useAuth();
  const {
    stories,
    isViewerOpen,
    activeGroupIndex,
    activeSlideIndex,
    isPaused,
    isAnalyticsOpen,
    floatingReactions,
    closeViewer,
    nextSlide,
    prevSlide,
    setPaused,
    openAnalytics,
    closeAnalytics,
    sendReaction,
    sendReply,
    deleteCurrentStatus
  } = useStatusStore();

  const [progress, setProgress] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [replyText, setReplyText] = useState<string>('');
  const [isSendingReply, setIsSendingReply] = useState<boolean>(false);
  const [replySuccess, setReplySuccess] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isHoldingRef = useRef<boolean>(false);

  const currentGroup = stories[activeGroupIndex];
  const currentStatus: StatusItem | undefined = currentGroup?.statuses[activeSlideIndex];
  const isAuthor = currentGroup?.isSelf || currentStatus?.user._id === mongooseUser?._id;

  // Total duration in seconds (default 5s for text/images, status.duration for videos)
  const durationSec = currentStatus?.duration || 5;

  // Slide advancement timer
  useEffect(() => {
    if (!isViewerOpen || !currentStatus || isPaused || isAnalyticsOpen) return;

    const intervalMs = 50;
    const step = (intervalMs / (durationSec * 1000)) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          nextSlide();
          return 0;
        }
        return prev + step;
      });
    }, intervalMs);

    return () => {
      clearInterval(timer);
      setProgress(0);
    };
  }, [isViewerOpen, activeGroupIndex, activeSlideIndex, isPaused, isAnalyticsOpen, durationSec, nextSlide, currentStatus]);

  // Handle Background Audio playback
  useEffect(() => {
    if (!isViewerOpen || !currentStatus) return;

    const audioEl = audioRef.current;
    if (currentStatus.audio?.audioUrl && !isMuted && audioEl) {
      audioEl.currentTime = currentStatus.audio.previewStart || 0;
      audioEl.play().catch((e) => console.warn('Audio autoplay blocked:', e));
    }

    return () => {
      audioEl?.pause();
    };
  }, [isViewerOpen, activeGroupIndex, activeSlideIndex, currentStatus, isMuted]);

  // Keyboard navigation
  useEffect(() => {
    if (!isViewerOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeViewer();
      if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isViewerOpen, closeViewer, nextSlide, prevSlide]);

  if (!isViewerOpen || !currentGroup || !currentStatus) return null;

  // Long press / Touch handlers
  const handleTouchStart = () => {
    holdTimeoutRef.current = setTimeout(() => {
      isHoldingRef.current = true;
      setPaused(true);
    }, 200);
  };

  const handleTouchEnd = () => {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    if (isHoldingRef.current) {
      isHoldingRef.current = false;
      setPaused(false);
    }
  };

  const handleZoneClick = (e: React.MouseEvent, zone: 'left' | 'right') => {
    if (isHoldingRef.current) return;
    if (zone === 'left') prevSlide();
    if (zone === 'right') nextSlide();
  };

  const handleSendReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || isSendingReply) return;

    try {
      setIsSendingReply(true);
      await sendReply(currentStatus._id, replyText);
      setReplyText('');
      setReplySuccess(true);
      setTimeout(() => setReplySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to send status reply:', err);
    } finally {
      setIsSendingReply(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center select-none overflow-hidden animate-in fade-in duration-200">
      
      {/* Background Audio Player if attached */}
      {currentStatus.audio?.audioUrl && (
        <audio
          ref={audioRef}
          src={currentStatus.audio.audioUrl}
          muted={isMuted}
          loop
        />
      )}

      {/* Main Story Stage Container (Strict 9:16 Aspect Ratio) */}
      <div 
        className="relative aspect-[9/16] h-[100dvh] max-h-[100dvh] md:h-[92vh] md:max-h-[92vh] w-auto max-w-[100vw] md:max-w-[calc(92vh*9/16)] md:rounded-3xl overflow-hidden bg-midnight-boma flex flex-col justify-between shadow-2xl md:border-4 md:border-neutral-800"
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >

        {/* --- Top Progress Bars --- */}
        <div className="absolute top-0 inset-x-0 z-40 p-3 pt-3 flex gap-1.5 bg-gradient-to-b from-black/80 via-black/30 to-transparent">
          {currentGroup.statuses.map((status, idx) => {
            let fillPercent = 0;
            if (idx < activeSlideIndex) fillPercent = 100;
            else if (idx === activeSlideIndex) fillPercent = progress;

            return (
              <div
                key={status._id || idx}
                className="h-1 flex-1 bg-white/25 rounded-full overflow-hidden backdrop-blur-sm"
              >
                <div
                  className="h-full bg-cloud-white transition-all duration-75 ease-linear rounded-full"
                  style={{ width: `${fillPercent}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* --- Top Header (Creator Info & Controls) --- */}
        <div className="absolute top-6 inset-x-0 z-40 px-3.5 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-toka-flare to-fintech-mint p-[2px] flex-shrink-0">
              <div className="w-full h-full rounded-full bg-midnight-boma overflow-hidden flex items-center justify-center font-bold text-xs text-cloud-white">
                {currentGroup.user.avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={currentGroup.user.avatarUrl}
                    alt={currentGroup.user.username}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  currentGroup.user.username.substring(0, 2).toUpperCase()
                )}
              </div>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm text-cloud-white tracking-tight drop-shadow-md">
                  {currentGroup.user.username}
                </span>
                {currentGroup.user.isBrandSafeVerified && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-fintech-mint fill-fintech-mint/20" />
                )}
              </div>
              <span className="text-[11px] text-cloud-white/70 drop-shadow">
                {formatTimeAgo(currentStatus.createdAt)}
              </span>
            </div>
          </div>

          {/* Controls: Audio Mute, Delete (if owner), Close */}
          <div className="flex items-center gap-2">
            {currentStatus.audio && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMuted(!isMuted);
                }}
                className="p-1.5 rounded-full bg-black/40 text-cloud-white hover:bg-black/60 transition-colors backdrop-blur-sm"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            )}

            {isAuthor && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Delete this 24h status update?')) {
                    deleteCurrentStatus(currentStatus._id);
                  }
                }}
                className="p-1.5 rounded-full bg-black/40 text-rose-400 hover:bg-rose-500/30 transition-colors backdrop-blur-sm"
                title="Delete status"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                closeViewer();
              }}
              className="p-1.5 rounded-full bg-black/40 text-cloud-white hover:bg-black/60 transition-colors backdrop-blur-sm"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* --- Attached Music Badge (if attached) --- */}
        {currentStatus.audio && (
          <div className="absolute top-18 left-3.5 z-40 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-[11px] text-cloud-white/90">
            <Music className="w-3 h-3 text-toka-flare animate-pulse" />
            <span className="font-medium truncate max-w-[200px]">
              {currentStatus.audio.title} • {currentStatus.audio.artist}
            </span>
          </div>
        )}

        {/* --- Content Area --- */}
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          
          {/* TEXT MODE */}
          {currentStatus.type === 'text' && (
            <div
              className={`w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br ${
                currentStatus.textStyle?.backgroundGradient || 'from-orange-600 via-amber-600 to-rose-700'
              } text-center relative overflow-hidden`}
            >
              <p
                className={`text-2xl md:text-3xl font-extrabold text-cloud-white leading-snug drop-shadow-lg break-words max-w-[90%] ${
                  currentStatus.textStyle?.fontFamily === 'serif' ? 'font-serif' :
                  currentStatus.textStyle?.fontFamily === 'mono' ? 'font-mono' : 'font-sans'
                }`}
                style={{ textAlign: currentStatus.textStyle?.alignment || 'center' }}
              >
                {currentStatus.textContent}
              </p>
            </div>
          )}

          {/* IMAGE MODE */}
          {currentStatus.type === 'image' && currentStatus.mediaUrl && (
            <div className="w-full h-full relative flex items-center justify-center bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentStatus.mediaUrl}
                alt="Status slide"
                className="w-full h-full object-cover"
              />
              {currentStatus.caption && (
                <div className="absolute bottom-20 inset-x-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent text-center">
                  <p className="text-cloud-white text-sm font-medium drop-shadow-md">
                    {currentStatus.caption}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* VIDEO MODE */}
          {currentStatus.type === 'video' && currentStatus.mediaUrl && (
            <div className="w-full h-full relative flex items-center justify-center bg-black">
              <video
                ref={videoRef}
                src={currentStatus.mediaUrl}
                autoPlay
                playsInline
                muted={isMuted}
                className="w-full h-full object-cover"
              />
              {currentStatus.caption && (
                <div className="absolute bottom-20 inset-x-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent text-center">
                  <p className="text-cloud-white text-sm font-medium drop-shadow-md">
                    {currentStatus.caption}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* --- Stickers Overlay --- */}
          {currentStatus.stickers && currentStatus.stickers.length > 0 && (
            <div className="absolute inset-0 pointer-events-none z-30">
              {currentStatus.stickers.map((sticker, sIdx) => {
                let badgeStyle = 'bg-gradient-to-r from-toka-flare to-amber-500 text-white shadow-lg';
                if (sticker.variant === 'mint') badgeStyle = 'bg-fintech-mint text-midnight-boma font-black shadow-md';
                if (sticker.variant === 'gold') badgeStyle = 'bg-gradient-to-r from-amber-400 to-yellow-600 text-black font-extrabold';
                if (sticker.variant === 'dark') badgeStyle = 'bg-midnight-boma/90 text-cloud-white border border-white/20';

                return (
                  <div
                    key={sIdx}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-transform select-none"
                    style={{
                      left: `${sticker.posX || 50}%`,
                      top: `${sticker.posY || 50}%`,
                      transform: `translate(-50%, -50%) scale(${sticker.scale || 1}) rotate(${sticker.rotation || 0}deg)`
                    }}
                  >
                    <div className={`px-4 py-2 rounded-2xl flex flex-col items-center justify-center text-center backdrop-blur-md ${badgeStyle}`}>
                      <span className="text-sm md:text-base font-extrabold tracking-wide drop-shadow-sm">
                        {sticker.text}
                      </span>
                      {sticker.subtext && (
                        <span className="text-[10px] opacity-90 font-medium">
                          {sticker.subtext}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* --- Floating Reaction Bubbles Animation --- */}
          <div className="absolute inset-0 pointer-events-none z-45 overflow-hidden">
            {floatingReactions.map((reaction) => (
              <div
                key={reaction.id}
                className="absolute bottom-20 text-4xl animate-float-reaction opacity-0"
                style={{ left: `${reaction.x}%` }}
              >
                {reaction.emoji}
              </div>
            ))}
          </div>

          {/* --- Left / Right Tap Zones --- */}
          <div
            className="absolute inset-y-0 left-0 w-1/3 z-20 cursor-pointer"
            onClick={(e) => handleZoneClick(e, 'left')}
          />
          <div
            className="absolute inset-y-0 right-0 w-2/3 z-20 cursor-pointer"
            onClick={(e) => handleZoneClick(e, 'right')}
          />
        </div>

        {/* --- Bottom Footer (Engagements & Reply or Creator Analytics) --- */}
        <div className="relative z-40 p-3 bg-gradient-to-t from-black/95 via-black/70 to-transparent">
          
          {/* VIEWER EXPERIENCE: Emojis + Reply */}
          {!isAuthor ? (
            <div className="flex flex-col gap-2">
              {/* Quick Reaction Bar */}
              <div className="flex items-center justify-around px-2 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
                {QUICK_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => sendReaction(currentStatus._id, emoji)}
                    className="text-xl hover:scale-130 active:scale-95 transition-transform p-1"
                    title={`React ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Direct Reply Input */}
              <form onSubmit={handleSendReplySubmit} className="flex items-center gap-2">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={replySuccess ? 'Reply sent! ✨' : `Reply to ${currentGroup.user.username}...`}
                  className="flex-1 bg-white/10 hover:bg-white/15 focus:bg-white/20 text-cloud-white placeholder-cloud-white/50 text-xs px-3.5 py-2.5 rounded-full outline-none border border-white/10 focus:border-toka-flare transition-all"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || isSendingReply}
                  className="w-8 h-8 rounded-full bg-toka-flare disabled:opacity-40 text-white flex items-center justify-center flex-shrink-0 transition-opacity shadow-md"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          ) : (
            /* CREATOR EXPERIENCE: Swipe-up Analytics trigger */
            <div className="flex items-center justify-between px-2 py-1.5 bg-black/40 backdrop-blur-md rounded-xl border border-white/10">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-fintech-mint" />
                <span className="text-xs font-semibold text-cloud-white">
                  {currentStatus.viewsCount || currentStatus.viewers?.length || 0} views
                </span>
                <span className="text-white/30">•</span>
                <span className="text-xs text-cloud-white/80">
                  {currentStatus.reactionsCount || currentStatus.reactions?.length || 0} reactions
                </span>
              </div>

              <button
                onClick={openAnalytics}
                className="flex items-center gap-1 text-xs font-medium text-toka-flare hover:underline"
              >
                <span>Viewers list</span>
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* --- Creator Analytics Swipe-up Drawer --- */}
        {isAuthor && isAnalyticsOpen && (
          <div className="absolute inset-0 z-50 bg-midnight-boma/98 backdrop-blur-xl flex flex-col justify-between p-4 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-fintech-mint" />
                <h3 className="font-bold text-sm text-cloud-white">Status Activity & Viewers</h3>
              </div>
              <button
                onClick={closeAnalytics}
                className="p-1 rounded-full bg-white/10 text-cloud-white hover:bg-white/20"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Viewers & Activity List */}
            <div className="flex-1 overflow-y-auto my-3 space-y-2 pr-1">
              {currentStatus.viewers && currentStatus.viewers.length > 0 ? (
                currentStatus.viewers.map((viewerItem, vIdx) => {
                  const userReactions = currentStatus.reactions?.filter(
                    (r) => r.user?._id === viewerItem.user?._id
                  );

                  return (
                    <div
                      key={vIdx}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-shaded-canopy/60 border border-white/5"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center font-bold text-xs text-cloud-white flex-shrink-0">
                          {viewerItem.user?.avatarUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={viewerItem.user.avatarUrl}
                              alt={viewerItem.user.username}
                              className="w-full h-full object-cover rounded-full"
                            />
                          ) : (
                            viewerItem.user?.username?.substring(0, 2).toUpperCase() || 'U'
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-cloud-white">
                            {viewerItem.user?.username || 'User'}
                          </span>
                          <span className="text-[10px] text-cloud-white/50">
                            {formatTimeAgo(viewerItem.viewedAt)}
                          </span>
                        </div>
                      </div>

                      {userReactions && userReactions.length > 0 && (
                        <div className="flex items-center gap-1 text-lg">
                          {userReactions.map((r, rIdx) => (
                            <span key={rIdx}>{r.emoji}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-cloud-white/50 text-xs text-center">
                  <Eye className="w-8 h-8 mb-2 opacity-40" />
                  <p>No views recorded yet.</p>
                  <p className="text-[10px] opacity-70">Followers will appear here once they watch.</p>
                </div>
              )}
            </div>

            <button
              onClick={closeAnalytics}
              className="w-full py-2.5 rounded-xl bg-shaded-canopy text-cloud-white text-xs font-semibold hover:bg-shaded-canopy/80"
            >
              Resume Story
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
