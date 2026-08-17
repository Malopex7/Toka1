"use client";
import React, { useEffect } from 'react';
import { useStatusStore, UserStoryGroup } from '@/store/useStatusStore';
import { useAuth } from '@/context/AuthContext';
import { Plus, Sparkles, Flame } from 'lucide-react';

interface StatusTrayProps {
  onOpenProfileStory?: () => void;
}

export default function StatusTray({ onOpenProfileStory }: StatusTrayProps) {
  const { mongooseUser, isAuthenticated } = useAuth();
  const {
    stories,
    hasSelfStory,
    isLoading,
    fetchStatusFeed,
    openViewer,
    openCreator
  } = useStatusStore();

  useEffect(() => {
    if (isAuthenticated) {
      fetchStatusFeed();
    }
  }, [isAuthenticated, fetchStatusFeed]);

  if (!isAuthenticated) return null;

  // Find self story group if exists
  const selfStoryGroupIndex = stories.findIndex((s) => s.isSelf);
  const otherStories = stories.filter((s) => !s.isSelf);

  return (
    <div className="w-full overflow-x-auto no-scrollbar py-1 px-2.5 z-30 transition-all select-none">
      <div className="flex items-center gap-2.5 min-w-max">
        
        {/* Current User Story Item (or Add Status Button) */}
        <div className="flex flex-col items-center gap-1 cursor-pointer group">
          <div className="relative">
            <button
              onClick={() => {
                if (hasSelfStory && selfStoryGroupIndex !== -1) {
                  openViewer(selfStoryGroupIndex, 0);
                } else {
                  openCreator();
                }
              }}
              className={`w-11 h-11 toka-rainbow-halo p-[2px] transition-all transform group-active:scale-95 flex items-center justify-center ${
                hasSelfStory
                  ? 'shadow-[0_0_12px_rgba(255,79,0,0.55)] scale-105'
                  : 'opacity-90 hover:opacity-100'
              }`}
              title={hasSelfStory ? 'View your status' : 'Add 24h status'}
            >
              <div className="toka-rainbow-halo-inner font-bold text-xs text-cloud-white">
                {mongooseUser?.avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={mongooseUser.avatarUrl}
                    alt={mongooseUser.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  mongooseUser?.username?.substring(0, 2).toUpperCase() || 'ME'
                )}
              </div>
            </button>

            {/* Floating Plus (+) button if user wants to add new status directly */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                openCreator();
              }}
              className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-toka-flare text-white flex items-center justify-center shadow-lg border border-midnight-boma transform hover:scale-110 active:scale-90 transition-transform"
              title="Add status update"
            >
              <Plus className="w-2.5 h-2.5 stroke-[3]" />
            </button>
          </div>

          <span className="text-[10px] font-medium text-cloud-white/80 max-w-[50px] truncate">
            {hasSelfStory ? 'Your Story' : 'Add Status'}
          </span>
        </div>

        {/* Followed Creators Statuses */}
        {otherStories.map((group, idx) => {
          // Calculate true index in global stories array for openViewer
          const realIndex = stories.findIndex((s) => s.user._id === group.user._id);

          return (
            <div
              key={group.user._id}
              onClick={() => openViewer(realIndex !== -1 ? realIndex : idx, 0)}
              className="flex flex-col items-center gap-1 cursor-pointer group"
            >
              <div
                className={`w-11 h-11 toka-rainbow-halo p-[2px] transition-all transform group-active:scale-95 flex items-center justify-center ${
                  group.hasUnseen
                    ? 'shadow-[0_0_14px_rgba(255,79,0,0.6)] animate-pulse-slow scale-105'
                    : 'opacity-85 hover:opacity-100'
                }`}
              >
                <div className="toka-rainbow-halo-inner">
                  {group.user.avatarUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={group.user.avatarUrl}
                      alt={group.user.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center font-bold text-xs text-cloud-white">
                      {group.user.username.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-0.5 max-w-[52px]">
                <span className="text-[10px] font-medium text-cloud-white/90 truncate">
                  {group.user.username}
                </span>
                {group.user.isBrandSafeVerified && (
                  <span className="w-1 h-1 rounded-full bg-fintech-mint flex-shrink-0" />
                )}
              </div>
            </div>
          );
        })}

        {/* Empty placeholder guide when no followed statuses exist */}
        {!isLoading && otherStories.length === 0 && !hasSelfStory && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-cloud-white/60 text-xs">
            <Sparkles className="w-3.5 h-3.5 text-toka-flare" />
            <span>Follow creators to see their 24h stories</span>
          </div>
        )}
      </div>
    </div>
  );
}
