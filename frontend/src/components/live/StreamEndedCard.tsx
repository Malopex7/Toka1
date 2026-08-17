"use client";
import React from "react";
import { useRouter } from "next/navigation";

interface Props {
  hostUsername?: string;
  hostAvatarUrl?: string;
  streamTitle?: string;
  onFollowHost?: () => void;
}

export default function StreamEndedCard({ hostUsername, hostAvatarUrl, streamTitle, onFollowHost }: Props) {
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#09090B]">
      <div className="flex flex-col items-center gap-6 px-8 text-center max-w-xs mx-auto">
        {/* Host avatar */}
        <div className="w-20 h-20 rounded-full overflow-hidden bg-[#18181B] border-2 border-white/10 flex items-center justify-center shrink-0">
          {hostAvatarUrl ? (
            <img src={hostAvatarUrl} alt={hostUsername} className="w-full h-full object-cover" />
          ) : (
            <span className="text-cloud-white font-bold text-2xl">
              {hostUsername?.[0]?.toUpperCase() || "T"}
            </span>
          )}
        </div>

        {/* Message */}
        <div>
          <h2 className="text-cloud-white font-bold text-xl">Broadcast Ended</h2>
          {hostUsername && (
            <p className="text-cloud-white/50 text-sm mt-1">
              <span className="text-cloud-white font-semibold">@{hostUsername}</span>&apos;s stream has ended.
            </p>
          )}
          {streamTitle && (
            <p className="text-cloud-white/30 text-xs mt-1 line-clamp-2">{streamTitle}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 w-full">
          {onFollowHost && (
            <button
              onClick={onFollowHost}
              className="w-full bg-[#FF4F00] hover:bg-[#E63E00] text-white font-bold py-3 rounded-[0.625rem] text-sm transition-all active:scale-95"
            >
              Follow @{hostUsername}
            </button>
          )}
          <button
            onClick={() => router.push("/")}
            className="w-full bg-[#18181B] hover:bg-white/10 text-cloud-white font-bold py-3 rounded-[0.625rem] text-sm transition-all active:scale-95 border border-white/10"
          >
            Explore More Streams
          </button>
        </div>
      </div>
    </div>
  );
}
