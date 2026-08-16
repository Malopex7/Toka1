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

  const [pendingCohostInvite, setPendingCohostInvite] = useState<{
    host: { username: string; avatarUrl?: string };
    roomId: string;
    title?: string;
  } | null>(null);
  const [acceptingCohost, setAcceptingCohost] = useState(false);

  const isHost = currentRoom?.hostId?._id === mongooseUser?._id?.toString() ||
    (currentRoom?.hostId as unknown as string) === mongooseUser?._id?.toString();
  const isCohost = Boolean(
    currentRoom?.cohosts?.some(
      (id: any) => (id?._id || id)?.toString() === mongooseUser?._id?.toString()
    )
  );
  const canPublish = isHost || isCohost;

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
        if (data.data?.isInvitedCohost && data.data?.stream?.hostId) {
          setPendingCohostInvite({
            host: {
              username: data.data.stream.hostId.username || 'creator',
              avatarUrl: data.data.stream.hostId.avatarUrl,
            },
            roomId: data.data.stream._id,
            title: data.data.stream.title,
          });
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

  // Socket.io: listen for stream_ended and cohost invitations
  useEffect(() => {
    const sock = getSocket();
    if (!sock.connected) sock.connect();

    const handleEnded = ({ roomId: endedRoomId }: { roomId: string }) => {
      if (endedRoomId === roomId) router.push('/');
    };

    const handleCohostInvite = (data: {
      roomId: string;
      targetUsername?: string;
      targetUserId?: string;
      host: { username: string; avatarUrl?: string };
      title?: string;
    }) => {
      const myUsername = mongooseUser?.username?.toLowerCase();
      const myId = mongooseUser?._id?.toString();
      const targetUser = data.targetUsername?.toLowerCase();
      const targetId = data.targetUserId;

      if ((targetUser && targetUser === myUsername) || (targetId && targetId === myId)) {
        setPendingCohostInvite({
          host: data.host,
          roomId: data.roomId,
          title: data.title,
        });
      }
    };

    sock.on('stream_ended', handleEnded);
    sock.on('cohost_invited', handleCohostInvite);
    if (mongooseUser?._id) {
      sock.on(`cohost_invited:${mongooseUser._id}`, handleCohostInvite);
    }
    if (mongooseUser?.username) {
      sock.on(`cohost_invited:${mongooseUser.username.toLowerCase()}`, handleCohostInvite);
    }

    return () => {
      sock.off('stream_ended', handleEnded);
      sock.off('cohost_invited', handleCohostInvite);
      if (mongooseUser?._id) {
        sock.off(`cohost_invited:${mongooseUser._id}`, handleCohostInvite);
      }
      if (mongooseUser?.username) {
        sock.off(`cohost_invited:${mongooseUser.username.toLowerCase()}`, handleCohostInvite);
      }
    };
  }, [roomId, router, mongooseUser]);

  const handleAcceptCohost = async () => {
    if (!pendingCohostInvite) return;
    setAcceptingCohost(true);
    try {
      const token = await getIdToken();
      const res = await fetch(`${BACKEND_URL}/api/live/${pendingCohostInvite.roomId}/cohost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to accept co-host invite');

      // Update room state with new stream and publisher token
      if (data.data?.stream) {
        setCurrentRoom(data.data.stream);
      } else if (currentRoom && mongooseUser?._id) {
        setCurrentRoom({
          ...currentRoom,
          cohosts: [...(currentRoom.cohosts || []), mongooseUser._id],
        });
      }
      setLivekitConnection(data.data.token, data.data.livekitUrl);
      setPendingCohostInvite(null);
    } catch (err) {
      console.error('[StreamRoom] accept cohost error:', err);
    } finally {
      setAcceptingCohost(false);
    }
  };

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
      video={canPublish}
      audio={canPublish}
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

          {/* Mobile Floating Action Sidebar (Right side, for audience only) */}
          {!isHost && currentRoom && (
            <div className="md:hidden absolute right-3 bottom-28 z-20 flex flex-col items-center gap-4">
              <LiveTipButton roomId={roomId} hostUsername={currentRoom.hostId?.username || ''} />
              <button
                onClick={async () => {
                  try {
                    await navigator.share({ title: currentRoom.title, url: window.location.href });
                  } catch {
                    navigator.clipboard.writeText(window.location.href);
                  }
                }}
                className="flex flex-col items-center gap-1 cursor-pointer select-none"
              >
                <span className="material-symbols-outlined text-cloud-white text-[24px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  share
                </span>
                <span className="text-[10px] text-cloud-white/80 font-bold drop-shadow">Share</span>
              </button>
            </div>
          )}

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
            <div className="md:hidden absolute bottom-3 left-3 right-3 z-30">
              <MobileChatInput
                roomName={currentRoom.livekitRoomName}
                username={mongooseUser.username}
                avatarUrl={mongooseUser.avatarUrl}
              />
            </div>
          )}

          {/* Host Co-Host Invite Panel Popup */}
          {isHost && showCohostPanel && (
            <div className="absolute bottom-32 left-3 right-3 md:left-auto md:right-8 md:bottom-20 md:w-96 z-40 animate-scale-up">
              <CohostInvitePanel roomId={roomId} />
            </div>
          )}

          {/* Cohost Invitation Popup Alert for the invited viewer */}
          {pendingCohostInvite && (
            <div className="absolute top-20 left-4 right-4 md:left-auto md:right-8 md:w-96 z-50 animate-scale-up">
              <div className="bg-shaded-canopy/95 backdrop-blur-xl border-2 border-toka-flare rounded-2xl p-4 shadow-2xl flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-toka-flare/30 border border-toka-flare/50 flex items-center justify-center shrink-0 overflow-hidden font-bold text-toka-flare text-sm">
                    {pendingCohostInvite.host.avatarUrl ? (
                      <img src={pendingCohostInvite.host.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      pendingCohostInvite.host.username[0]?.toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-cloud-white font-bold text-sm">Co-Host Invitation</h4>
                    <p className="text-cloud-white/70 text-xs truncate">
                      <span className="text-toka-flare font-semibold">@{pendingCohostInvite.host.username}</span> invited you to co-host!
                    </p>
                  </div>
                </div>

                <p className="text-cloud-white/60 text-xs">
                  Join the broadcast on live video & audio to stream together in split-screen.
                </p>

                <div className="flex gap-2 mt-1">
                  <button
                    onClick={handleAcceptCohost}
                    disabled={acceptingCohost}
                    className="flex-1 bg-toka-flare hover:bg-toka-flare/80 text-white rounded-xl py-2 text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {acceptingCohost ? (
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">videocam</span>
                        <span>Accept & Go Live</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setPendingCohostInvite(null)}
                    disabled={acceptingCohost}
                    className="bg-white/10 hover:bg-white/20 text-cloud-white rounded-xl px-4 py-2 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                  >
                    Decline
                  </button>
                </div>
              </div>
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

  const canPublish = isHost || Boolean(localParticipant?.permissions?.canPublish);

  // Subscribe to all active camera and screen-share tracks in the room
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: false },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  // Auto-enable camera and mic for publishing presenters upon entering
  useEffect(() => {
    if (canPublish && localParticipant) {
      if (!localParticipant.isCameraEnabled) {
        localParticipant.setCameraEnabled(true).catch(console.error);
      }
      if (!localParticipant.isMicrophoneEnabled) {
        localParticipant.setMicrophoneEnabled(true).catch(console.error);
      }
    }
  }, [canPublish, localParticipant]);

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

  // Find valid presenter tracks
  const validTracks = tracks.filter(isTrackReference);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
      {validTracks.length > 0 ? (
        <div className={`w-full h-full ${validTracks.length > 1 ? 'grid grid-cols-1 md:grid-cols-2 gap-2 p-2' : 'relative'}`}>
          {validTracks.map((trackRef, idx) => (
            <div key={trackRef.publication?.trackSid || idx} className="relative w-full h-full rounded-2xl overflow-hidden bg-black flex items-center justify-center">
              <VideoTrack
                trackRef={trackRef}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 text-cloud-white text-[11px] font-bold">
                @{trackRef.participant.identity || 'Presenter'}
              </div>
            </div>
          ))}
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
              {canPublish ? 'Starting your camera stream...' : `Waiting for @${hostUsername || 'creator'}...`}
            </h3>
            <p className="text-cloud-white/50 text-xs mt-1">
              {canPublish ? 'Ensure camera and mic permissions are enabled' : 'The broadcast will begin shortly'}
            </p>
          </div>
        </div>
      )}

      {/* Tap to Unmute Overlay for Audience */}
      {!canPublish && !audioPlaybackAllowed && (
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

      {/* Unified Presenter Floating Controls Dock */}
      {canPublish && (
        <div className="absolute bottom-16 md:bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 md:gap-2 bg-black/80 backdrop-blur-xl px-2.5 md:px-3 py-1.5 md:py-2 rounded-2xl border border-white/15 shadow-2xl max-w-[calc(100vw-1.5rem)] overflow-x-auto no-scrollbar">
          {/* Camera Toggle */}
          <button
            onClick={toggleCamera}
            className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer ${
              isCameraEnabled ? 'bg-white/10 text-cloud-white hover:bg-white/20' : 'bg-red-600 text-white shadow-lg'
            }`}
            title={isCameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            <span className="material-symbols-outlined text-[18px] md:text-[20px]">
              {isCameraEnabled ? 'videocam' : 'videocam_off'}
            </span>
          </button>

          {/* Mic Toggle */}
          <button
            onClick={toggleMic}
            className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer ${
              isMicrophoneEnabled ? 'bg-white/10 text-cloud-white hover:bg-white/20' : 'bg-red-600 text-white shadow-lg'
            }`}
            title={isMicrophoneEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            <span className="material-symbols-outlined text-[18px] md:text-[20px]">
              {isMicrophoneEnabled ? 'mic' : 'mic_off'}
            </span>
          </button>

          {/* Screen Share Toggle */}
          <button
            onClick={toggleScreenShare}
            className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer ${
              isScreenShareEnabled ? 'bg-toka-flare text-white shadow-lg' : 'bg-white/10 text-cloud-white hover:bg-white/20'
            }`}
            title={isScreenShareEnabled ? 'Stop Screen Share' : 'Share Screen'}
          >
            <span className="material-symbols-outlined text-[18px] md:text-[20px]">
              {isScreenShareEnabled ? 'stop_screen_share' : 'screen_share'}
            </span>
          </button>

          {/* Divider */}
          <div className="w-px h-5 md:h-6 bg-white/20 mx-0.5 md:mx-1 shrink-0" />

          {/* Invite Co-Host (Host only) */}
          {isHost && onToggleCohostPanel && (
            <button
              onClick={onToggleCohostPanel}
              className={`flex items-center gap-1.5 px-3 md:px-3.5 h-9 md:h-10 rounded-xl font-bold text-[11px] md:text-xs shrink-0 whitespace-nowrap transition-all cursor-pointer shadow-md active:scale-95 ${
                showCohostPanel
                  ? 'bg-toka-flare text-white'
                  : 'bg-white/10 text-cloud-white hover:bg-white/20'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] md:text-[18px]">group_add</span>
              <span>Invite Co-Host</span>
            </button>
          )}

          {/* Share Stream */}
          {onShare && (
            <button
              onClick={onShare}
              className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-white/10 text-cloud-white hover:bg-white/20 shrink-0 flex items-center justify-center transition-all cursor-pointer"
              title="Share Stream Link"
            >
              <span className="material-symbols-outlined text-[16px] md:text-[18px]">share</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function LiveViewerBadge({ isHost }: { isHost: boolean; fallbackCount?: number }) {
  const remoteParticipants = useRemoteParticipants();
  const [isOpen, setIsOpen] = useState(false);

  // Exact real-time connected audience count
  const audienceCount = remoteParticipants.length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-1.5 text-cloud-white/90 text-xs bg-black/60 hover:bg-black/80 active:scale-95 transition-all backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 shadow-sm font-mono cursor-pointer"
        title="View live audience"
      >
        <span className="material-symbols-outlined text-[14px] text-red-400">visibility</span>
        <span>{audienceCount}</span>
      </button>

      {/* Viewers Popup Dropdown */}
      {isOpen && (
        <div className="absolute top-10 right-0 w-64 bg-shaded-canopy/95 backdrop-blur-xl border border-white/15 rounded-2xl p-3 shadow-2xl z-50 animate-scale-up">
          <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <h4 className="text-cloud-white font-bold text-xs">Live Viewers ({audienceCount})</h4>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-cloud-white/40 hover:text-white text-xs cursor-pointer p-0.5"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            {remoteParticipants.length === 0 ? (
              <p className="text-cloud-white/40 text-xs py-2 text-center italic">
                {isHost ? 'Waiting for viewers to join...' : 'You are the only viewer'}
              </p>
            ) : (
              remoteParticipants.map((p) => {
                const name = p.name || p.identity || 'Viewer';
                return (
                  <div
                    key={p.sid || p.identity}
                    className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-toka-flare/30 border border-toka-flare/40 flex items-center justify-center text-[10px] font-bold text-toka-flare shrink-0">
                        {name[0]?.toUpperCase()}
                      </div>
                      <span className="text-cloud-white text-xs font-semibold truncate">
                        @{name}
                      </span>
                    </div>
                    <span className="text-[10px] text-cloud-white/40 bg-white/5 px-2 py-0.5 rounded-md">
                      Watching
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
