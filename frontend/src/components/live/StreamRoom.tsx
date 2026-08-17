"use client";
import React, { useEffect, useRef, useState } from 'react';
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
import StreamSummaryModal from './StreamSummaryModal';
import StreamEndedCard from './StreamEndedCard';
import FloatingReactions from './FloatingReactions';
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

  // Host reconnection grace period state (60s countdown for audience)
  const [reconnectingInfo, setReconnectingInfo] = useState<{
    since: string; graceSeconds: number;
  } | null>(null);
  const [reconnectCountdown, setReconnectCountdown] = useState(0);

  // Stream ended card (for viewers)
  const [streamEndedData, setStreamEndedData] = useState<{
    hostUsername?: string; hostAvatarUrl?: string; streamTitle?: string;
  } | null>(null);

  // Post-stream summary modal (for host only)
  const [streamSummary, setStreamSummary] = useState<{
    durationSeconds: number; peakViewerCount: number;
    totalTipsZAR: number; totalParticipants: number; title: string;
  } | null>(null);

  // Live tip alert banner
  const [tipAlert, setTipAlert] = useState<{ username: string; amount: number } | null>(null);
  const tipAlertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // FloatingReactions trigger ref (for socket-triggered reactions)
  const reactionsRef = useRef<(() => void) | null>(null);

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

  // Socket.io: listen for stream_ended, cohost invitations, cohost join/leave events
  useEffect(() => {
    const sock = getSocket();
    if (!sock.connected) sock.connect();

    const handleEnded = ({ roomId: endedRoomId }: { roomId: string }) => {
      if (endedRoomId !== roomId) return;
      if (isHost) {
        // Host summary is shown via handleEndStream; nothing extra needed on socket
        return;
      }
      // Viewers see the StreamEndedCard
      setStreamEndedData({
        hostUsername: currentRoom?.hostId?.username,
        hostAvatarUrl: currentRoom?.hostId?.avatarUrl,
        streamTitle: currentRoom?.title,
      });
    };

    const handleReconnecting = (data: { roomId: string; reconnectingSince: string; graceSeconds: number }) => {
      if (data.roomId !== roomId) return;
      setReconnectingInfo({ since: data.reconnectingSince, graceSeconds: data.graceSeconds });
    };

    const handleResumed = ({ roomId: resumedId }: { roomId: string }) => {
      if (resumedId !== roomId) return;
      setReconnectingInfo(null);
    };

    const handleTipAlert = (data: { tipper: { username: string }; amount: number }) => {
      setTipAlert({ username: data.tipper.username, amount: data.amount });
      if (tipAlertTimer.current) clearTimeout(tipAlertTimer.current);
      tipAlertTimer.current = setTimeout(() => setTipAlert(null), 4000);
      // Also trigger a floating reaction on tip
      reactionsRef.current?.();
    };

    const handleCohostMuted = (data: { cohostUsername: string }) => {
      const myUsername = mongooseUser?.username?.toLowerCase();
      if (data.cohostUsername?.toLowerCase() === myUsername) {
        // Force-mute our own mic via LiveKit
        // The actual mute happens in LiveBroadcastStage via the room ref
        // We use a custom event that LiveBroadcastStage listens to
        window.dispatchEvent(new CustomEvent('toka:force_mute'));
      }
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

    const handleCohostJoined = (data: { cohost: { id: string; username: string; avatarUrl?: string } }) => {
      if (currentRoom) {
        const cohostId = data.cohost?.id;
        if (cohostId && !currentRoom.cohosts?.some((c: any) => (c?._id || c)?.toString() === cohostId)) {
          setCurrentRoom({
            ...currentRoom,
            cohosts: [...(currentRoom.cohosts || []), cohostId],
          });
        }
      }
    };

    const handleCohostLeft = (data: { cohost?: { id: string; username: string }; cohostId?: string; roomId?: string }) => {
      const targetCohostId = data.cohost?.id || data.cohostId;
      const myId = mongooseUser?._id?.toString();

      if (targetCohostId && targetCohostId === myId) {
        // Current user is no longer a co-host, downgrade to viewer
        if (currentRoom) {
          setCurrentRoom({
            ...currentRoom,
            cohosts: (currentRoom.cohosts || []).filter((c: any) => (c?._id || c)?.toString() !== myId),
          });
        }
      } else if (currentRoom && targetCohostId) {
        setCurrentRoom({
          ...currentRoom,
          cohosts: (currentRoom.cohosts || []).filter((c: any) => (c?._id || c)?.toString() !== targetCohostId),
        });
      }
    };

    sock.on('stream_ended', handleEnded);
    sock.on('stream_reconnecting', handleReconnecting);
    sock.on('stream_resumed', handleResumed);
    sock.on('live_tip', handleTipAlert);
    sock.on('cohost_muted', handleCohostMuted);
    sock.on('cohost_invited', handleCohostInvite);
    sock.on('cohost_joined', handleCohostJoined);
    sock.on('cohost_left', handleCohostLeft);
    sock.on('cohost_removed', handleCohostLeft);

    if (mongooseUser?._id) {
      sock.on(`cohost_invited:${mongooseUser._id}`, handleCohostInvite);
      sock.on(`cohost_removed:${mongooseUser._id}`, handleCohostLeft);
    }
    if (mongooseUser?.username) {
      sock.on(`cohost_invited:${mongooseUser.username.toLowerCase()}`, handleCohostInvite);
    }

    return () => {
      sock.off('stream_ended', handleEnded);
      sock.off('stream_reconnecting', handleReconnecting);
      sock.off('stream_resumed', handleResumed);
      sock.off('live_tip', handleTipAlert);
      sock.off('cohost_muted', handleCohostMuted);
      sock.off('cohost_invited', handleCohostInvite);
      sock.off('cohost_joined', handleCohostJoined);
      sock.off('cohost_left', handleCohostLeft);
      sock.off('cohost_removed', handleCohostLeft);
      if (mongooseUser?._id) {
        sock.off(`cohost_invited:${mongooseUser._id}`, handleCohostInvite);
        sock.off(`cohost_removed:${mongooseUser._id}`, handleCohostLeft);
      }
      if (mongooseUser?.username) {
        sock.off(`cohost_invited:${mongooseUser.username.toLowerCase()}`, handleCohostInvite);
      }
    };
  }, [roomId, router, mongooseUser, currentRoom, setCurrentRoom, isHost]);

  // Grace period countdown ticker
  useEffect(() => {
    if (!reconnectingInfo) { setReconnectCountdown(0); return; }
    const tick = () => {
      const elapsed = Math.floor((Date.now() - new Date(reconnectingInfo.since).getTime()) / 1000);
      const remaining = Math.max(0, reconnectingInfo.graceSeconds - elapsed);
      setReconnectCountdown(remaining);
      if (remaining === 0) {
        // Grace expired — show stream ended card
        setReconnectingInfo(null);
        setStreamEndedData({
          hostUsername: currentRoom?.hostId?.username,
          hostAvatarUrl: currentRoom?.hostId?.avatarUrl,
          streamTitle: currentRoom?.title,
        });
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [reconnectingInfo, currentRoom]);

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

  const handleLeaveCohost = async () => {
    try {
      const token = await getIdToken();
      const res = await fetch(`${BACKEND_URL}/api/live/${roomId}/leave-cohost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.data?.token) {
        setLivekitConnection(data.data.token, data.data.livekitUrl);
      }
      if (data.data?.stream) {
        setCurrentRoom(data.data.stream);
      } else if (currentRoom && mongooseUser?._id) {
        setCurrentRoom({
          ...currentRoom,
          cohosts: (currentRoom.cohosts || []).filter(
            (c: any) => (c?._id || c)?.toString() !== mongooseUser._id.toString()
          ),
        });
      }
    } catch (err) {
      console.error('[StreamRoom] leave cohost error:', err);
    }
  };

  const handleEndStream = async () => {
    try {
      const token = await getIdToken();
      const res = await fetch(`${BACKEND_URL}/api/live/${roomId}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCurrentRoom(null);
      setLivekitConnection('', '');
      if (data?.data?.summary) {
        setStreamSummary(data.data.summary);
      } else {
        router.push('/');
      }
    } catch (err) {
      console.error('[StreamRoom] end error:', err);
      router.push('/');
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
    <>
      {/* ---- Main LiveKit Room ---- */}
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
                <span className={`flex items-center gap-1.5 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-lg ${reconnectingInfo ? 'bg-amber-600' : 'bg-red-600'}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  {reconnectingInfo ? `RECONNECTING ${reconnectCountdown}s` : 'LIVE'}
                </span>
                {isCohost && !isHost && (
                  <span className="flex items-center gap-1 bg-toka-flare text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-lg">
                    <span className="material-symbols-outlined text-[13px]">groups</span> CO-HOST
                  </span>
                )}
                {currentRoom?.startedAt && <LiveDurationTimer startedAt={currentRoom.startedAt} />}
              </div>
              <div className="flex items-center gap-2">
                <LiveViewerBadge
                  isHost={isHost}
                  hostUsername={currentRoom?.hostId?.username}
                  cohosts={currentRoom?.cohosts}
                  fallbackCount={currentRoom?.viewerCount || 0}
                />
                {isHost && (
                  <button
                    onClick={handleEndStream}
                    className="bg-red-700 hover:bg-red-600 text-white text-xs font-bold px-3.5 py-1.5 rounded-full transition-all active:scale-95 shadow-md cursor-pointer"
                  >
                    End Stream
                  </button>
                )}
                {!isHost && isCohost && (
                  <button
                    onClick={handleLeaveCohost}
                    className="bg-red-700/90 hover:bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full transition-all active:scale-95 shadow-md cursor-pointer flex items-center gap-1"
                    title="Leave Co-Host Stage"
                  >
                    <span className="material-symbols-outlined text-[14px]">logout</span>
                    <span>Leave Stage</span>
                  </button>
                )}
              </div>
            </div>

            {/* Dedicated Full-Screen Live Broadcast Stage with Unified Controls */}
            <div className="w-full h-full flex-1 relative overflow-hidden bg-black">
              <LiveBroadcastStage
                isHost={isHost}
                isCohost={isCohost}
                canPublish={canPublish}
                hostUsername={currentRoom?.hostId?.username}
                hostAvatarUrl={currentRoom?.hostId?.avatarUrl}
                showCohostPanel={showCohostPanel}
                onToggleCohostPanel={() => setShowCohostPanel((v) => !v)}
                onLeaveCohost={handleLeaveCohost}
                reconnectingInfo={reconnectingInfo}
                reconnectCountdown={reconnectCountdown}
                reactionsRef={reactionsRef}
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
            {!isHost && !isCohost && currentRoom && (
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

      {/* ---- Post-Stream Analytics Modal (Host) ---- */}
      {streamSummary && (
        <StreamSummaryModal
          summary={streamSummary}
          onClose={() => { setStreamSummary(null); router.push('/'); }}
        />
      )}

      {/* ---- Stream Ended Card (Viewers) ---- */}
      {streamEndedData && !isHost && (
        <StreamEndedCard
          hostUsername={streamEndedData.hostUsername}
          hostAvatarUrl={streamEndedData.hostAvatarUrl}
          streamTitle={streamEndedData.streamTitle}
        />
      )}

      {/* ---- Live Tip Alert Banner ---- */}
      {tipAlert && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[80] animate-scale-up pointer-events-none">
          <div className="flex items-center gap-2.5 bg-[#09090B]/95 backdrop-blur-xl border border-[#10B981]/40 rounded-2xl px-4 py-3 shadow-2xl shadow-black/50">
            <span className="material-symbols-outlined text-[#10B981] text-[20px]">payments</span>
            <div>
              <p className="text-cloud-white text-sm font-bold">
                @{tipAlert.username} <span className="text-[#10B981] font-mono">tipped R{tipAlert.amount}</span> 🎉
              </p>
            </div>
          </div>
        </div>
      )}
    </>
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
  isCohost,
  canPublish,
  hostUsername,
  hostAvatarUrl,
  showCohostPanel,
  onToggleCohostPanel,
  onLeaveCohost,
  onShare,
  reconnectingInfo,
  reconnectCountdown,
  reactionsRef,
}: {
  isHost: boolean;
  isCohost: boolean;
  canPublish: boolean;
  hostUsername?: string;
  hostAvatarUrl?: string;
  showCohostPanel?: boolean;
  onToggleCohostPanel?: () => void;
  onLeaveCohost?: () => void;
  onShare?: () => void;
  reconnectingInfo?: { since: string; graceSeconds: number } | null;
  reconnectCountdown?: number;
  reactionsRef?: React.MutableRefObject<(() => void) | null>;
}) {
  const room = useRoomContext();
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled, isScreenShareEnabled } = useLocalParticipant();
  const [audioPlaybackAllowed, setAudioPlaybackAllowed] = useState(true);

  const isPresenter = canPublish || isHost || isCohost || Boolean(localParticipant?.permissions?.canPublish) || localParticipant.isCameraEnabled || localParticipant.isMicrophoneEnabled;

  // Subscribe to all active camera and screen-share tracks in the room
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: false },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  // Auto-enable camera and mic for publishing presenters upon entering
  useEffect(() => {
    if (isPresenter && localParticipant) {
      if (!localParticipant.isCameraEnabled) {
        localParticipant.setCameraEnabled(true).catch(console.error);
      }
      if (!localParticipant.isMicrophoneEnabled) {
        localParticipant.setMicrophoneEnabled(true).catch(console.error);
      }
    }
  }, [isPresenter, localParticipant]);

  // Listen for host-triggered remote mic mute
  useEffect(() => {
    const handleForceMute = () => {
      if (localParticipant && localParticipant.isMicrophoneEnabled) {
        localParticipant.setMicrophoneEnabled(false).catch(console.error);
      }
    };
    window.addEventListener('toka:force_mute', handleForceMute);
    return () => window.removeEventListener('toka:force_mute', handleForceMute);
  }, [localParticipant]);


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
    <div
      className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden"
      onClick={() => { if (!isPresenter) reactionsRef?.current?.(); }}
    >
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
              {reconnectingInfo
                ? `Host reconnecting... ${reconnectCountdown}s`
                : isPresenter
                ? 'Starting your camera stream...'
                : `Waiting for @${hostUsername || 'creator'}...`}
            </h3>
            <p className="text-cloud-white/50 text-xs mt-1">
              {reconnectingInfo
                ? 'The stream will resume automatically'
                : isPresenter
                ? 'Ensure camera and mic permissions are enabled'
                : 'The broadcast will begin shortly'}
            </p>
          </div>
        </div>
      )}

      {/* Floating reactions overlay — audience taps video to react */}
      {!isPresenter && <FloatingReactions triggerRef={reactionsRef} />}

      {/* Reconnecting pill overlay (audience view) — when host tracks are still active but reconnecting */}
      {reconnectingInfo && validTracks.length > 0 && !isPresenter && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <div className="flex items-center gap-2 bg-black/80 backdrop-blur-md text-amber-400 text-xs font-bold px-4 py-2 rounded-full border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Host reconnecting — {reconnectCountdown}s
          </div>
        </div>
      )}

      {/* Tap to Unmute Overlay for Audience */}
      {!isPresenter && !audioPlaybackAllowed && (
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
      {isPresenter && (
        <div className="absolute bottom-16 md:bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 md:gap-2 bg-black/85 backdrop-blur-xl px-2.5 md:px-3 py-1.5 md:py-2 rounded-2xl border border-white/20 shadow-2xl max-w-[calc(100vw-1.5rem)] overflow-x-auto no-scrollbar">
          {/* Camera Toggle */}
          <button
            onClick={toggleCamera}
            className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer ${
              isCameraEnabled ? 'bg-white/10 text-cloud-white hover:bg-white/20' : 'bg-red-600 text-white shadow-lg shadow-red-600/30'
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
              isMicrophoneEnabled ? 'bg-white/10 text-cloud-white hover:bg-white/20' : 'bg-red-600 text-white shadow-lg shadow-red-600/30'
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
              isScreenShareEnabled ? 'bg-toka-flare text-white shadow-lg shadow-toka-flare/30' : 'bg-white/10 text-cloud-white hover:bg-white/20'
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
                  ? 'bg-toka-flare text-white shadow-toka-flare/30'
                  : 'bg-white/10 text-cloud-white hover:bg-white/20'
              }`}
            >
              <span className="material-symbols-outlined text-[16px] md:text-[18px]">group_add</span>
              <span>Invite Co-Host</span>
            </button>
          )}

          {/* Leave Stage (Co-Host only) */}
          {!isHost && isCohost && onLeaveCohost && (
            <button
              onClick={onLeaveCohost}
              className="flex items-center gap-1.5 px-3 md:px-3.5 h-9 md:h-10 rounded-xl font-bold text-[11px] md:text-xs shrink-0 whitespace-nowrap transition-all cursor-pointer shadow-md active:scale-95 bg-red-600/80 hover:bg-red-600 text-white shadow-red-600/20"
              title="Leave Co-Host Stage"
            >
              <span className="material-symbols-outlined text-[16px] md:text-[18px]">call_end</span>
              <span>Leave Stage</span>
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

function LiveViewerBadge({
  isHost,
  hostUsername,
  cohosts = [],
  fallbackCount = 0
}: {
  isHost: boolean;
  hostUsername?: string;
  cohosts?: string[];
  fallbackCount?: number;
}) {
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const [isOpen, setIsOpen] = useState(false);

  // All participants in room
  const allParticipants = [localParticipant, ...remoteParticipants].filter(Boolean);

  // Audience / Viewers = participants who are not the host
  const audienceList = allParticipants.filter((p) => {
    const name = p.name || p.identity;
    return name && hostUsername && name.toLowerCase() !== hostUsername.toLowerCase();
  });

  const audienceCount = Math.max(audienceList.length, fallbackCount);

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
        <div className="absolute top-10 right-0 w-72 bg-shaded-canopy/95 backdrop-blur-xl border border-white/15 rounded-2xl p-3 shadow-2xl z-50 animate-scale-up">
          <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <h4 className="text-cloud-white font-bold text-xs">
                Live Viewers ({audienceCount})
              </h4>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-cloud-white/40 hover:text-white text-xs cursor-pointer p-0.5"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-1 max-h-56 overflow-y-auto no-scrollbar">
            {/* Stream Host Section */}
            {hostUsername && (
              <div className="flex items-center justify-between py-1.5 px-2 rounded-xl bg-toka-flare/10 border border-toka-flare/20 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-toka-flare text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                    {hostUsername[0]?.toUpperCase()}
                  </div>
                  <span className="text-cloud-white text-xs font-bold truncate">
                    @{hostUsername} {isHost && <span className="text-cloud-white/50 text-[10px] font-normal">(You)</span>}
                  </span>
                </div>
                <span className="text-[10px] text-toka-flare bg-toka-flare/20 px-2 py-0.5 rounded-md font-bold">
                  Host
                </span>
              </div>
            )}

            {/* Audience Members List */}
            {audienceList.length === 0 ? (
              <p className="text-cloud-white/40 text-xs py-2 text-center italic">
                {isHost ? 'Waiting for viewers to join...' : 'No other viewers yet'}
              </p>
            ) : (
              audienceList.map((p) => {
                const name = p.name || p.identity || 'Viewer';
                const isLocal = p.identity === localParticipant?.identity;
                const isCohostUser = cohosts.some(
                  (c) => c?.toLowerCase() === name.toLowerCase()
                );

                return (
                  <div
                    key={p.sid || p.identity}
                    className="flex items-center justify-between py-1.5 px-2 rounded-xl hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[10px] font-bold text-cloud-white shrink-0">
                        {name[0]?.toUpperCase()}
                      </div>
                      <span className="text-cloud-white text-xs font-semibold truncate">
                        @{name} {isLocal && !isHost && <span className="text-cloud-white/50 text-[10px]">(You)</span>}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                        isCohostUser
                          ? 'bg-toka-flare/20 text-toka-flare font-bold'
                          : 'bg-white/5 text-cloud-white/50'
                      }`}
                    >
                      {isCohostUser ? 'Co-Host' : 'Watching'}
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
