"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { getSocket } from './LiveChat';

interface CohostInviteData {
  roomId: string;
  roomName: string;
  title: string;
  host: {
    username: string;
    avatarUrl?: string;
  };
  targetUsername?: string;
  targetUserId?: string;
}

export default function GlobalCohostInviteListener() {
  const { mongooseUser, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [invite, setInvite] = useState<CohostInviteData | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !mongooseUser) return;

    const sock = getSocket();
    if (!sock.connected) {
      sock.connect();
    }

    const handleInvite = (data: CohostInviteData) => {
      const myUsername = mongooseUser.username?.toLowerCase();
      const myId = mongooseUser._id?.toString();
      const targetUser = data.targetUsername?.toLowerCase();
      const targetId = data.targetUserId;

      const isForMe =
        (targetUser && targetUser === myUsername) ||
        (targetId && targetId === myId);

      if (isForMe) {
        // If already inside this stream room, StreamRoom handles it internally
        if (pathname === `/live/${data.roomId}`) return;
        setInvite(data);
      }
    };

    sock.on('global_cohost_invite', handleInvite);
    if (mongooseUser._id) {
      sock.on(`cohost_invited:${mongooseUser._id}`, handleInvite);
    }
    if (mongooseUser.username) {
      sock.on(`cohost_invited:${mongooseUser.username.toLowerCase()}`, handleInvite);
    }

    return () => {
      sock.off('global_cohost_invite', handleInvite);
      if (mongooseUser._id) {
        sock.off(`cohost_invited:${mongooseUser._id}`, handleInvite);
      }
      if (mongooseUser.username) {
        sock.off(`cohost_invited:${mongooseUser.username.toLowerCase()}`, handleInvite);
      }
    };
  }, [isAuthenticated, mongooseUser, pathname]);

  if (!invite) return null;

  const handleAccept = () => {
    const streamRoomId = invite.roomId;
    setInvite(null);
    router.push(`/live/${streamRoomId}`);
  };

  const handleDismiss = () => {
    setInvite(null);
  };

  return (
    <div className="fixed top-4 left-4 right-4 md:left-auto md:right-6 md:w-96 z-[9999] animate-bounce-short select-none">
      <div className="bg-shaded-canopy/95 backdrop-blur-xl border-2 border-toka-flare rounded-3xl p-4 shadow-2xl shadow-toka-flare/20 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-toka-flare/20 border-2 border-toka-flare/60 flex items-center justify-center shrink-0 overflow-hidden text-toka-flare font-bold text-base">
            {invite.host.avatarUrl ? (
              <img src={invite.host.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              invite.host.username[0]?.toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <h4 className="text-cloud-white font-bold text-xs">Live Co-Host Invitation</h4>
            </div>
            <p className="text-cloud-white/80 text-xs truncate mt-0.5">
              <span className="text-toka-flare font-bold">@{invite.host.username}</span> invited you to co-host!
            </p>
          </div>
        </div>

        {invite.title && (
          <div className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-[11px] text-cloud-white/70 italic truncate">
            &ldquo;{invite.title}&rdquo;
          </div>
        )}

        <p className="text-cloud-white/60 text-[11px] leading-relaxed">
          Broadcast on live split-screen video & audio with the creator.
        </p>

        <div className="flex gap-2 mt-0.5">
          <button
            onClick={handleAccept}
            className="flex-1 bg-toka-flare hover:bg-toka-flare/80 text-white rounded-xl py-2 text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-toka-flare/20"
          >
            <span className="material-symbols-outlined text-[16px]">videocam</span>
            <span>Join as Co-Host</span>
          </button>
          <button
            onClick={handleDismiss}
            className="bg-white/10 hover:bg-white/20 text-cloud-white rounded-xl px-4 py-2 text-xs font-bold transition-all active:scale-95 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
