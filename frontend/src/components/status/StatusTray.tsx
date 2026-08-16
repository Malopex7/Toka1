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
    <div className="w-full overflow-x-auto no-scrollbar py-2 px-3 z-30 transition-all select-none">
      <div className="flex items-center gap-3 min-w-max">
        
        {/* Current User Story Item (or Add Status Button) */}
        <div className="flex flex-col items-center gap-1.5 cursor-pointer group">
          <div className="relative">
            <button
              onClick={() => {
                if (hasSelfStory && selfStoryGroupIndex !== -1) {
                  openViewer(selfStoryGroupIndex, 0);
                } else {
                  openCreator();
                }
              }}
              className={`w-14 h-14 rounded-full p-[2.5px] transition-all transform group-active:scale-95 flex items-center justify-center ${
                hasSelfStory
                  ? 'bg-gradient-to-tr from-toka-flare via-amber-500 to-fintech-mint shadow-[0_0_12px_rgba(255,79,0,0.4)]'
                  : 'bg-shaded-canopy/80 border border-white/10 hover:border-toka-flare/40'
              }`}
              title={hasSelfStory ? 'View your status' : 'Add 24h status'}
            >
              <div className="w-full h-full rounded-full bg-midnight-boma overflow-hidden flex items-center justify-center font-bold text-base text-cloud-white">
                {mongooseUser?.username?.substring(0, 2).toUpperCase() || 'ME'}
              </div>
            </button>

            {/* Floating Plus (+) button if user wants to add new status directly */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                openCreator();
              }}
              className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-toka-flare text-white flex items-center justify-center shadow-lg border-2 border-midnight-boma transform hover:scale-110 active:scale-90 transition-transform"
              title="Add status update"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
            </button>
          </div>

          <span className="text-[11px] font-medium text-cloud-white/80 max-w-[62px] truncate">
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
              className="flex flex-col items-center gap-1.5 cursor-pointer group"
            >
              <div
                className={`w-14 h-14 rounded-full p-[2.5px] transition-all transform group-active:scale-95 flex items-center justify-center ${
                  group.hasUnseen
                    ? 'bg-gradient-to-tr from-toka-flare via-amber-500 to-fintech-mint shadow-[0_0_14px_rgba(255,79,0,0.45)] animate-pulse-slow'
                    : 'bg-white/20 hover:bg-white/35 opacity-75 hover:opacity-100'
                }`}
              >
                <div className="w-full h-full rounded-full bg-midnight-boma p-[2px] overflow-hidden flex items-center justify-center">
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center font-bold text-sm text-cloud-white">
                    {group.user.username.substring(0, 2).toUpperCase()}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-0.5 max-w-[64px]">
                <span className="text-[11px] font-medium text-cloud-white/90 truncate">
                  {group.user.username}
                </span>
                {group.user.isBrandSafeVerified && (
                  <span className="w-1.5 h-1.5 rounded-full bg-fintech-mint flex-shrink-0" />
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
