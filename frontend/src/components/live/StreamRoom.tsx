"use client";
import React, { useEffect, useState } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  VideoTrack,
  useLocalParticipant,
  useRoomContext,
  useRemoteParticipants,
  isTrackReference,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
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
        setLivekitConnection(data.data.token, data.data.livekitUrl);
        setCurrentRoom(data.data.stream);
        if (data.data?.stream?.viewerCount !== undefined) {
          useLiveStore.getState().setViewerCount(data.data.stream.viewerCount);
        }
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
      setCurrentRoom(null);
      setLivekitConnection('', '');
      router.push('/');
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

  const effectiveLivekitUrl = (typeof window !== 'undefined' && window.location.protocol === 'https:' && livekitUrl?.includes('localhost'))
    ? (process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://toka-qbo14kfo.livekit.cloud')
    : (livekitUrl || process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://toka-qbo14kfo.livekit.cloud');

  return (
    <LiveKitRoom
      token={livekitToken}
      serverUrl={effectiveLivekitUrl}
      connect={true}
      video={isHost}
      audio={isHost}
    >
      <RoomAudioRenderer />
      <MediaRecorderManager isHost={isHost} />

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
              <LiveViewerBadge isHost={isHost} fallbackCount={currentRoom?.viewerCount || 0} />
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

          {/* Dedicated Full-Screen Live Broadcast Stage with Unified Controls */}
          <div className="w-full h-full flex-1 relative overflow-hidden bg-black">
            <LiveBroadcastStage
              isHost={isHost}
              hostUsername={currentRoom?.hostId?.username}
              hostAvatarUrl={currentRoom?.hostId?.avatarUrl}
              showCohostPanel={showCohostPanel}
              onToggleCohostPanel={() => setShowCohostPanel((v) => !v)}
              onShare={async () => {
                if (currentRoom) {
                  try {
                    await navigator.share({ title: currentRoom.title, url: window.location.href });
                  } catch {
                    navigator.clipboard.writeText(window.location.href);
                  }
                }
              }}
            />
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

          {/* Host Co-Host Invite Panel Popup */}
          {isHost && showCohostPanel && (
            <div className="absolute bottom-20 left-4 right-4 md:left-auto md:right-8 md:w-96 z-30 animate-scale-up">
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
  const room = useRoomContext();
  const [input, setInput] = useState('');
  const addMessage = useLiveStore((s) => s.addMessage);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    const msg = {
      id: `${Date.now()}-${Math.random()}`,
      user: { username, avatarUrl },
      message: text,
      timestamp: Date.now(),
    };
    addMessage(msg);
    setInput('');

    if (room && room.localParticipant) {
      try {
        const payload = new TextEncoder().encode(JSON.stringify({ type: 'chat', ...msg }));
        await room.localParticipant.publishData(payload, { reliable: true });
      } catch (_) {}
    }

    try {
      const sock = getSocket();
      sock.emit('live_chat', { roomName, ...msg });
    } catch (_) {}
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

function LiveBroadcastStage({
  isHost,
  hostUsername,
  hostAvatarUrl,
  showCohostPanel,
  onToggleCohostPanel,
  onShare,
}: {
  isHost: boolean;
  hostUsername?: string;
  hostAvatarUrl?: string;
  showCohostPanel?: boolean;
  onToggleCohostPanel?: () => void;
  onShare?: () => void;
}) {
  const room = useRoomContext();
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled, isScreenShareEnabled } = useLocalParticipant();
  const [audioPlaybackAllowed, setAudioPlaybackAllowed] = useState(true);

  // Subscribe to all active camera and screen-share tracks in the room
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: false },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  // Check if audio playback is permitted by the browser
  useEffect(() => {
    if (!room) return;
    const checkAudio = () => {
      setAudioPlaybackAllowed(room.canPlaybackAudio);
    };
    checkAudio();
    room.on('audioPlaybackChanged', checkAudio);
    return () => {
      room.off('audioPlaybackChanged', checkAudio);
    };
  }, [room]);

  const handleStartAudio = async () => {
    if (room) {
      await room.startAudio();
      setAudioPlaybackAllowed(true);
    }
  };

  const toggleCamera = async () => {
    if (localParticipant) {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    }
  };

  const toggleMic = async () => {
    if (localParticipant) {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    }
  };

  const toggleScreenShare = async () => {
    if (localParticipant) {
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
    }
  };

  // Find host or active presenter tracks
  const mainTrack = tracks.find(isTrackReference);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
      {mainTrack ? (
        <div className="w-full h-full relative">
          <VideoTrack
            trackRef={mainTrack}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 text-center px-4">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-toka-flare/20 border-2 border-toka-flare/40 flex items-center justify-center animate-pulse">
            {hostAvatarUrl ? (
              <img src={hostAvatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-toka-flare text-2xl font-bold">
                {hostUsername?.[0]?.toUpperCase() || 'L'}
              </span>
            )}
          </div>
          <div>
            <h3 className="text-cloud-white font-bold text-base">
              {isHost ? 'Starting your camera stream...' : `Waiting for @${hostUsername || 'creator'}...`}
            </h3>
            <p className="text-cloud-white/50 text-xs mt-1">
              {isHost ? 'Ensure camera and mic permissions are enabled' : 'The broadcast will begin shortly'}
            </p>
          </div>
        </div>
      )}

      {/* Tap to Unmute Overlay for Audience */}
      {!isHost && !audioPlaybackAllowed && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 animate-bounce">
          <button
            onClick={handleStartAudio}
            className="flex items-center gap-2 bg-toka-flare text-white text-xs font-bold px-4 py-2 rounded-full shadow-2xl hover:scale-105 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">volume_up</span>
            Tap to Unmute Audio
          </button>
        </div>
      )}

      {/* Unified Host Floating Controls Dock */}
      {isHost && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-black/75 backdrop-blur-lg px-3 py-2 rounded-2xl border border-white/15 shadow-2xl">
          {/* Camera Toggle */}
          <button
            onClick={toggleCamera}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              isCameraEnabled ? 'bg-white/10 text-cloud-white hover:bg-white/20' : 'bg-red-600 text-white shadow-lg'
            }`}
            title={isCameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            <span className="material-symbols-outlined text-[20px]">
              {isCameraEnabled ? 'videocam' : 'videocam_off'}
            </span>
          </button>

          {/* Mic Toggle */}
          <button
            onClick={toggleMic}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              isMicrophoneEnabled ? 'bg-white/10 text-cloud-white hover:bg-white/20' : 'bg-red-600 text-white shadow-lg'
            }`}
            title={isMicrophoneEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            <span className="material-symbols-outlined text-[20px]">
              {isMicrophoneEnabled ? 'mic' : 'mic_off'}
            </span>
          </button>

          {/* Screen Share Toggle */}
          <button
            onClick={toggleScreenShare}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              isScreenShareEnabled ? 'bg-toka-flare text-white shadow-lg' : 'bg-white/10 text-cloud-white hover:bg-white/20'
            }`}
            title={isScreenShareEnabled ? 'Stop Screen Share' : 'Share Screen'}
          >
            <span className="material-symbols-outlined text-[20px]">
              {isScreenShareEnabled ? 'stop_screen_share' : 'screen_share'}
            </span>
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-white/20 mx-1" />

          {/* Invite Co-Host */}
          {onToggleCohostPanel && (
            <button
              onClick={onToggleCohostPanel}
              className={`flex items-center gap-1.5 px-3.5 h-10 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-md active:scale-95 ${
                showCohostPanel
                  ? 'bg-toka-flare text-white'
                  : 'bg-white/10 text-cloud-white hover:bg-white/20'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">group_add</span>
              <span>Invite Co-Host</span>
            </button>
          )}

          {/* Share Stream */}
          {onShare && (
            <button
              onClick={onShare}
              className="w-10 h-10 rounded-xl bg-white/10 text-cloud-white hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer"
              title="Share Stream Link"
            >
              <span className="material-symbols-outlined text-[18px]">share</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function LiveViewerBadge({ isHost, fallbackCount }: { isHost: boolean; fallbackCount: number }) {
  const remoteParticipants = useRemoteParticipants();
  const storeCount = useLiveStore((s) => s.viewerCount);

  // Exact real-time connected audience count from LiveKit WebRTC
  const livekitCount = isHost ? remoteParticipants.length : remoteParticipants.length + 1;
  const count = Math.max(livekitCount, storeCount, fallbackCount);

  return (
    <span className="flex items-center gap-1 text-cloud-white/90 text-xs bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 shadow-sm font-mono">
      <span className="material-symbols-outlined text-[14px] text-red-400">visibility</span>
      {count}
    </span>
  );
}
