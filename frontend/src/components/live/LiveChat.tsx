"use client";
import React, { useEffect, useRef } from 'react';
import { useLiveStore, LiveChatMessage } from '@/store/useLiveStore';
import { io as socketIO, Socket } from 'socket.io-client';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = socketIO(BACKEND_URL, { withCredentials: true });
  }
  return socket;
}

interface LiveChatProps {
  roomName: string;
  currentUser: { username: string; avatarUrl?: string };
  isMobile?: boolean;
}

export default function LiveChat({ roomName, currentUser, isMobile = false }: LiveChatProps) {
  const messages = useLiveStore((s) => s.messages);
  const addMessage = useLiveStore((s) => s.addMessage);
  const [input, setInput] = React.useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sock = getSocket();
    sock.emit('join_live_room', roomName);

    sock.on('live_chat', (data: LiveChatMessage) => {
      addMessage({ ...data, id: `${Date.now()}-${Math.random()}` });
    });

    sock.on('live_tip', ({ tipper, amount }: { tipper: { username: string; avatarUrl?: string }, amount: number }) => {
      addMessage({
        id: `tip-${Date.now()}`,
        user: tipper,
        message: `tipped R${amount} 🎉`,
        timestamp: Date.now(),
        isTip: true,
        tipAmount: amount,
      });
    });

    sock.on('viewer_count', ({ count }: { count: number }) => {
      useLiveStore.getState().setViewerCount(count);
    });

    return () => {
      sock.off('live_chat');
      sock.off('live_tip');
      sock.off('viewer_count');
      sock.emit('leave_live_room', roomName);
    };
  }, [roomName, addMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const sock = getSocket();
    const msg: Omit<LiveChatMessage, 'id'> = {
      user: currentUser,
      message: input.trim(),
      timestamp: Date.now(),
    };
    sock.emit('live_chat', { roomName, ...msg });
    setInput('');
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
        {messages.map((msg) => (
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
        ))}
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
