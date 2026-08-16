"use client";
import React, { useEffect, useState, useCallback } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  useLocalParticipant,
  RoomAudioRenderer,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { useAuth } from '@/context/AuthContext';
import { useLiveStore } from '@/store/useLiveStore';
import LiveChat from './LiveChat';
import LiveTipButton from './LiveTipButton';
import CohostInvitePanel from './CohostInvitePanel';
import PrivateRoomModal from './PrivateRoomModal';
import MediaRecorderManager from './MediaRecorderManager';
import { getSocket } from './LiveChat';
import { useRouter } from 'next/navigation';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface StreamRoomProps {
  roomId: string;
}

function LiveDurationTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);
  const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const s = (elapsed % 60).toString().padStart(2, '0');
  return <span className="font-mono text-[11px] text-cloud-white/80">{m}:{s}</span>;
}

function HostMediaTracker({
  isHost,
  onStreamReady,
}: {
  isHost: boolean;
  onStreamReady: (stream: MediaStream) => void;
}) {
  const { localParticipant } = useLocalParticipant();

  useEffect(() => {
    if (!isHost || !localParticipant) return;

    const captureStream = () => {
      const ms = new MediaStream();
      localParticipant.videoTrackPublications.forEach((pub) => {
        if (pub.track?.mediaStreamTrack) {
          ms.addTrack(pub.track.mediaStreamTrack);
        }
      });
      localParticipant.audioTrackPublications.forEach((pub) => {
        if (pub.track?.mediaStreamTrack) {
          ms.addTrack(pub.track.mediaStreamTrack);
        }
      });
      if (ms.getTracks().length > 0) {
        onStreamReady(ms);
      }
    };

    captureStream();
    localParticipant.on('trackPublished', captureStream);
    localParticipant.on('trackUnpublished', captureStream);

    return () => {
      localParticipant.off('trackPublished', captureStream);
      localParticipant.off('trackUnpublished', captureStream);
    };
  }, [isHost, localParticipant, onStreamReady]);

  return null;
}

export default function StreamRoom({ roomId }: StreamRoomProps) {
  const { mongooseUser, getIdToken, isAuthenticated } = useAuth();
  const router = useRouter();
  const { livekitToken, livekitUrl, currentRoom, setCurrentRoom, setLivekitConnection, viewerCount } = useLiveStore();

  const hasInitialToken = Boolean(livekitToken && currentRoom);
  const [loading, setLoading] = useState(!hasInitialToken && isAuthenticated);
  const [lockedData, setLockedData] = useState<{
    privateMode: 'entry_fee' | 'subscription' | 'tip_invite';
    entryFeeZAR: number; subscriberPriceZAR: number; tipInviteMinZAR: number;
  } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [showCohostPanel, setShowCohostPanel] = useState(false);

  const isHost = currentRoom?.hostId?._id === mongooseUser?._id?.toString() ||
    (currentRoom?.hostId as unknown as string) === mongooseUser?._id?.toString();

  // Join stream if we don't already have a token
  useEffect(() => {
    if (livekitToken && currentRoom) return;
    if (!isAuthenticated) return;

    let isMounted = true;
    const fetchJoin = async () => {
      try {
        const token = await getIdToken();
        const res = await fetch(`${BACKEND_URL}/api/live/${roomId}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!isMounted) return;

        if (res.status === 403 && data.status === 'locked') {
          setLockedData({
            privateMode: data.privateMode,
            entryFeeZAR: data.entryFeeZAR,
            subscriberPriceZAR: data.subscriberPriceZAR,
            tipInviteMinZAR: data.tipInviteMinZAR,
          });
          return;
        }
        if (!res.ok) throw new Error(data.message);
        setLivekitConnection(data.data.token, data.data.livekitUrl);
        setCurrentRoom(data.data.stream);
      } catch (err) {
        console.error('[StreamRoom] join error:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    fetchJoin();

    return () => {
      isMounted = false;
    };
  }, [roomId, isAuthenticated, livekitToken, currentRoom, getIdToken, setLivekitConnection, setCurrentRoom]);

  // Socket.io: listen for stream_ended
  useEffect(() => {
    const sock = getSocket();
    sock.on('stream_ended', ({ roomId: endedRoomId }: { roomId: string }) => {
      if (endedRoomId === roomId) router.push('/');
    });
    return () => { sock.off('stream_ended'); };
  }, [roomId, router]);

  const handleEndStream = async () => {
    try {
      const token = await getIdToken();
      await fetch(`${BACKEND_URL}/api/live/${roomId}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setIsRecording(false);
    } catch (err) {
      console.error('[StreamRoom] end error:', err);
    }
  };

  const handleUnlocked = (token: string, url: string) => {
    setLockedData(null);
    setLivekitConnection(token, url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-midnight-boma flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <p className="text-cloud-white/60 text-sm">Joining stream...</p>
        </div>
      </div>
    );
  }

  if (lockedData) {
    return (
      <div className="min-h-screen bg-midnight-boma">
        <PrivateRoomModal
          roomId={roomId}
          privateMode={lockedData.privateMode}
          entryFeeZAR={lockedData.entryFeeZAR}
          subscriberPriceZAR={lockedData.subscriberPriceZAR}
          tipInviteMinZAR={lockedData.tipInviteMinZAR}
          hostUsername={currentRoom?.hostId?.username || 'creator'}
          onUnlocked={handleUnlocked}
          onClose={() => router.back()}
        />
      </div>
    );
  }

  if (!livekitToken) {
    return (
      <div className="min-h-screen bg-midnight-boma flex items-center justify-center">
        <p className="text-cloud-white/60 text-sm">Stream unavailable. Please try again.</p>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={livekitToken}
      serverUrl={livekitUrl}
      connect={true}
      video={isHost}
      audio={isHost}
    >
      <RoomAudioRenderer />
      <HostMediaTracker
        isHost={isHost}
        onStreamReady={(stream) => {
          setLocalStream(stream);
          setIsRecording(true);
        }}
      />
      <MediaRecorderManager stream={localStream} isRecording={isRecording} />

      {/* ---- UNIFIED RESPONSIVE STREAM ROOM LAYOUT ---- */}
      <div className="relative h-screen w-full bg-midnight-boma overflow-hidden flex flex-col md:flex-row select-none">
        
        {/* Main Video Area (Full viewport on mobile, flex-1 left pane on desktop) */}
        <div className="relative flex-1 h-full min-w-0 bg-black flex flex-col">
          
          {/* Top Floating HUD Bar */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 bg-red-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-lg">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
              </span>
              {currentRoom?.startedAt && <LiveDurationTimer startedAt={currentRoom.startedAt} />}
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-cloud-white/90 text-xs bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 shadow-sm font-mono">
                <span className="material-symbols-outlined text-[14px] text-red-400">visibility</span>
                {viewerCount}
              </span>
              {isHost && (
                <button
                  onClick={handleEndStream}
                  className="bg-red-700 hover:bg-red-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-full transition-all active:scale-95 shadow-md cursor-pointer"
                >
                  End Stream
                </button>
              )}
            </div>
          </div>

          {/* SINGLE VideoConference Instance */}
          <div className="w-full h-full flex-1 relative overflow-hidden bg-black">
            <VideoConference className="h-full w-full" />
          </div>

          {/* Mobile Floating Action Sidebar (Right side) */}
          <div className="md:hidden absolute right-3 bottom-28 z-20 flex flex-col items-center gap-5">
            {currentRoom && (
              <LiveTipButton roomId={roomId} hostUsername={currentRoom.hostId?.username || ''} />
            )}
            <button
              onClick={async () => {
                if (currentRoom) {
                  try {
                    await navigator.share({ title: currentRoom.title, url: window.location.href });
                  } catch {
                    navigator.clipboard.writeText(window.location.href);
                  }
                }
              }}
              className="flex flex-col items-center gap-1 cursor-pointer select-none"
            >
              <span className="material-symbols-outlined text-cloud-white text-[26px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                share
              </span>
              <span className="text-[10px] text-cloud-white/80 font-bold drop-shadow">Share</span>
            </button>
          </div>

          {/* Mobile Floating Chat Overlay */}
          <div className="md:hidden pointer-events-none">
            {mongooseUser && currentRoom && (
              <LiveChat
                roomName={currentRoom.livekitRoomName}
                currentUser={{ username: mongooseUser.username, avatarUrl: mongooseUser.avatarUrl }}
                isMobile
              />
            )}
          </div>

          {/* Mobile Chat Input Bar */}
          {mongooseUser && currentRoom && (
            <div className="md:hidden absolute bottom-4 left-4 right-20 z-30">
              <MobileChatInput
                roomName={currentRoom.livekitRoomName}
                username={mongooseUser.username}
                avatarUrl={mongooseUser.avatarUrl}
              />
            </div>
          )}

          {/* Host Co-Host Controls Bottom Bar (Desktop) */}
          {isHost && (
            <div className="hidden md:flex absolute bottom-4 left-4 right-4 z-20 items-center justify-center gap-3">
              <button
                onClick={() => setShowCohostPanel((v) => !v)}
                className="flex items-center gap-1.5 bg-black/70 backdrop-blur-md border border-white/20 text-cloud-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-white/15 transition-all cursor-pointer shadow-lg active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px] text-toka-flare">group_add</span>
                Invite Co-Host
              </button>
            </div>
          )}

          {/* Host Co-Host Invite Panel Popup */}
          {isHost && showCohostPanel && (
            <div className="absolute bottom-16 left-4 right-4 md:left-auto md:right-8 md:w-96 z-30 animate-scale-up">
              <CohostInvitePanel roomId={roomId} />
            </div>
          )}
        </div>

        {/* Desktop Sidebar (Chat + Host Metadata) */}
        <div className="hidden md:flex w-80 flex-col shrink-0 bg-shaded-canopy/95 backdrop-blur-md border-l border-white/10 h-full">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-toka-flare/30 border border-toka-flare/40 flex items-center justify-center shrink-0">
                {currentRoom?.hostId?.avatarUrl ? (
                  <img src={currentRoom.hostId.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-toka-flare text-xs font-bold">
                    {currentRoom?.hostId?.username?.[0]?.toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-cloud-white font-bold text-xs truncate">@{currentRoom?.hostId?.username}</p>
                <p className="text-cloud-white/50 text-[11px] truncate max-w-[130px]">{currentRoom?.title}</p>
              </div>
            </div>
            {currentRoom && (
              <LiveTipButton roomId={roomId} hostUsername={currentRoom.hostId?.username || ''} />
            )}
          </div>

          <div className="flex-1 min-h-0">
            {mongooseUser && currentRoom && (
              <LiveChat
                roomName={currentRoom.livekitRoomName}
                currentUser={{ username: mongooseUser.username, avatarUrl: mongooseUser.avatarUrl }}
              />
            )}
          </div>
        </div>

      </div>
    </LiveKitRoom>
  );
}

function MobileChatInput({ roomName, username, avatarUrl }: { roomName: string; username: string; avatarUrl?: string }) {
  const [input, setInput] = useState('');
  const addMessage = useLiveStore((s) => s.addMessage);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const sock = getSocket();
    const msg = { user: { username, avatarUrl }, message: input.trim(), timestamp: Date.now() };
    sock.emit('live_chat', { roomName, ...msg });
    addMessage({ ...msg, id: `${Date.now()}` });
    setInput('');
  };

  return (
    <form onSubmit={send} className="flex gap-2">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Say something..."
        maxLength={200}
        className="flex-1 bg-black/60 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-2.5 text-sm text-cloud-white placeholder-cloud-white/40 focus:outline-none focus:border-toka-flare/50"
      />
      <button type="submit" className="w-10 h-10 bg-toka-flare rounded-2xl flex items-center justify-center active:scale-95">
        <span className="material-symbols-outlined text-white text-[18px]">send</span>
      </button>
    </form>
  );
}
