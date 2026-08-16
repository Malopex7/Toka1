"use client";
import React, { useEffect, useRef } from 'react';
import { useLiveStore, LiveChatMessage } from '@/store/useLiveStore';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { io as socketIO, Socket } from 'socket.io-client';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = socketIO(BACKEND_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  }
  return socket;
}

interface LiveChatProps {
  roomName: string;
  currentUser: { username: string; avatarUrl?: string };
  isMobile?: boolean;
}

export default function LiveChat({ roomName, currentUser, isMobile = false }: LiveChatProps) {
  const room = useRoomContext();
  const messages = useLiveStore((s) => s.messages);
  const addMessage = useLiveStore((s) => s.addMessage);
  const [input, setInput] = React.useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // 1. LiveKit Ultra-Low Latency Data Channel listener
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const decoded = new TextDecoder().decode(payload);
        const data = JSON.parse(decoded);
        if (data.type === 'chat') {
          addMessage({
            id: data.id || `${Date.now()}-${Math.random()}`,
            user: data.user || { username: 'Anonymous' },
            message: data.message,
            timestamp: data.timestamp || Date.now(),
          });
        } else if (data.type === 'tip') {
          addMessage({
            id: `tip-${Date.now()}-${Math.random()}`,
            user: data.user,
            message: `tipped R${data.amount} 🎉`,
            timestamp: Date.now(),
            isTip: true,
            tipAmount: data.amount,
          });
        }
      } catch (err) {
        console.warn('LiveKit data packet parse warning:', err);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);

    const handleParticipantConnected = (participant: { identity?: string; name?: string }) => {
      const username = participant.identity || participant.name;
      if (username) {
        addMessage({
          id: `join-${username}-${Date.now()}`,
          user: { username },
          message: 'joined the live',
          isSystem: true,
          timestamp: Date.now(),
        });
      }
    };

    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
    };
  }, [room, addMessage]);

  // 2. Socket.io Relay listener (Secondary fallback + global notifications)
  useEffect(() => {
    const sock = getSocket();
    if (!sock.connected) {
      sock.connect();
    }
    sock.emit('join_live_room', roomName);

    const handleChat = (data: { id?: string; user: { username: string; avatarUrl?: string }; message: string; timestamp?: number }) => {
      addMessage({
        id: data.id || `sock-${data.user?.username || 'user'}-${data.timestamp || Date.now()}`,
        user: data.user || { username: 'Anonymous' },
        message: data.message,
        timestamp: data.timestamp || Date.now(),
      });
    };

    const handleTip = ({ tipper, amount }: { tipper: { username: string; avatarUrl?: string }, amount: number }) => {
      addMessage({
        id: `tip-${Date.now()}-${Math.random()}`,
        user: tipper,
        message: `tipped R${amount} 🎉`,
        timestamp: Date.now(),
        isTip: true,
        tipAmount: amount,
      });
    };

    const handleViewerCount = ({ count }: { count: number }) => {
      useLiveStore.getState().setViewerCount(count);
    };

    sock.on('live_chat', handleChat);
    sock.on('live_tip', handleTip);
    sock.on('viewer_count', handleViewerCount);

    return () => {
      sock.off('live_chat', handleChat);
      sock.off('live_tip', handleTip);
      sock.off('viewer_count', handleViewerCount);
      sock.emit('leave_live_room', roomName);
    };
  }, [roomName, addMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    const timestamp = Date.now();
    const msgId = `chat-${currentUser.username}-${timestamp}-${Math.floor(Math.random() * 1000)}`;

    const msg: LiveChatMessage = {
      id: msgId,
      user: currentUser,
      message: text,
      timestamp,
    };

    // Optimistically render locally
    addMessage(msg);
    setInput('');

    // Broadcast over LiveKit Data Channel (<10ms peer delivery)
    if (room && room.localParticipant) {
      try {
        const payload = new TextEncoder().encode(
          JSON.stringify({ type: 'chat', id: msgId, user: currentUser, message: text, timestamp })
        );
        await room.localParticipant.publishData(payload, { reliable: true });
      } catch (err) {
        console.warn('LiveKit data publish warning:', err);
      }
    }

    // Broadcast over Socket.io
    try {
      const sock = getSocket();
      sock.emit('live_chat', {
        roomName,
        id: msgId,
        user: currentUser,
        message: text,
        timestamp,
      });
    } catch (_) {}
  };

  return (
    <div className={`flex flex-col ${isMobile
      ? 'absolute bottom-16 left-0 right-0 max-h-64 bg-gradient-to-t from-black/80 to-transparent pointer-events-none px-3 pb-2'
      : 'h-full bg-shaded-canopy/80 backdrop-blur-md border-l border-white/10'
    }`}>
      {/* Header (desktop only) */}
      {!isMobile && (
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-cloud-white font-bold text-sm">Live Chat</span>
        </div>
      )}

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto py-2 px-3 flex flex-col gap-1.5 ${isMobile ? 'pointer-events-none' : ''}`}>
        {messages.map((msg) => {
          if (msg.isSystem) {
            return (
              <div
                key={msg.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/5 text-[11px] text-cloud-white/70 animate-fade-in self-start my-0.5"
              >
                <span className="material-symbols-outlined text-[13px] text-toka-flare">waving_hand</span>
                <span className="font-bold text-cloud-white/90">@{msg.user.username}</span>
                <span>{msg.message}</span>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2 animate-fade-in ${msg.isTip ? 'bg-amber-500/20 rounded-lg px-2 py-1' : ''}`}
            >
              <div className="w-6 h-6 rounded-full bg-toka-flare/50 flex items-center justify-center shrink-0 text-[10px] font-bold text-white overflow-hidden">
                {msg.user.avatarUrl ? (
                  <img src={msg.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  msg.user.username[0]?.toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className={`font-bold text-[11px] mr-1 ${msg.isTip ? 'text-amber-400' : 'text-toka-flare'}`}>
                  @{msg.user.username}
                </span>
                <span className={`text-[12px] break-words ${msg.isTip ? 'text-amber-200 font-semibold' : 'text-cloud-white/90'}`}>
                  {msg.isTip ? `💰 ${msg.message}` : msg.message}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input (desktop only — on mobile user scrolls to interact) */}
      {!isMobile && (
        <form onSubmit={sendMessage} className="p-3 border-t border-white/10 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Say something..."
            maxLength={200}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-cloud-white placeholder-cloud-white/40 focus:outline-none focus:border-toka-flare/50 transition-colors"
          />
          <button
            type="submit"
            className="bg-toka-flare text-white rounded-xl px-3 py-2 text-sm font-bold hover:bg-toka-flare/80 transition-colors active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
          </button>
        </form>
      )}
    </div>
  );
}
