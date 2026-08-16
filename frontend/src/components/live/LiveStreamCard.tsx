"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { LiveStreamMeta } from '@/store/useLiveStore';

interface LiveStreamCardProps {
  stream: LiveStreamMeta;
}

export default function LiveStreamCard({ stream }: LiveStreamCardProps) {
  const [elapsed] = useState(() => {
    return Math.max(0, Math.floor((Date.now() - new Date(stream.startedAt).getTime()) / 60000));
  });

  return (
    <Link
      href={`/live/${stream._id}`}
      className="block group relative rounded-2xl overflow-hidden border border-white/10 hover:border-toka-flare/40 transition-all hover:shadow-lg hover:shadow-toka-flare/10 bg-shaded-canopy/60 backdrop-blur-sm"
    >
      {/* Thumbnail placeholder with gradient */}
      <div className="aspect-[9/16] w-full bg-gradient-to-br from-midnight-boma via-shaded-canopy to-toka-flare/20 flex items-center justify-center relative">
        {stream.hostId?.avatarUrl ? (
          <img src={stream.hostId.avatarUrl} alt="" className="w-full h-full object-cover opacity-40" />
        ) : (
          <span className="material-symbols-outlined text-toka-flare/40 text-[64px]">live_tv</span>
        )}

        {/* LIVE badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          LIVE
        </div>

        {/* Privacy badge */}
        {stream.privacy === 'private' && (
          <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <span className="material-symbols-outlined text-toka-flare text-[14px]">lock</span>
          </div>
        )}

        {/* Viewer count */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm text-cloud-white text-[11px] px-2 py-0.5 rounded-full">
          <span className="material-symbols-outlined text-[12px]">visibility</span>
          {stream.viewerCount}
        </div>

        {/* Duration */}
        <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-cloud-white/70 text-[10px] px-2 py-0.5 rounded-full">
          {elapsed}m
        </div>
      </div>

      {/* Info */}
      <div className="p-3 flex items-start gap-2">
        <div className="w-8 h-8 rounded-full bg-toka-flare/30 overflow-hidden shrink-0 border border-toka-flare/30">
          {stream.hostId?.avatarUrl ? (
            <img src={stream.hostId.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-toka-flare font-bold text-sm">
              {stream.hostId?.username?.[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-cloud-white font-bold text-sm truncate">{stream.title}</p>
          <p className="text-cloud-white/60 text-xs truncate">@{stream.hostId?.username}</p>
        </div>
      </div>
    </Link>
  );
}
