"use client";
import { create } from 'zustand';

export interface LiveStreamMeta {
  _id: string;
  title: string;
  privacy: 'public' | 'private';
  privateMode?: 'entry_fee' | 'subscription' | 'tip_invite' | null;
  entryFeeZAR?: number;
  subscriberPriceZAR?: number;
  tipInviteMinZAR?: number;
  viewerCount: number;
  startedAt: string;
  status: 'live' | 'ended';
  livekitRoomName: string;
  hostId: {
    _id: string;
    username: string;
    avatarUrl: string;
    displayName?: string;
  };
  cohosts: string[];
}

export interface LiveChatMessage {
  id: string;
  user: { username: string; avatarUrl?: string };
  message: string;
  timestamp: number;
  isTip?: boolean;
  tipAmount?: number;
  isSystem?: boolean;
}

interface LiveState {
  // Discovery
  activeLiveStreams: LiveStreamMeta[];
  isLoadingStreams: boolean;
  setActiveLiveStreams: (streams: LiveStreamMeta[]) => void;
  fetchActiveStreams: () => Promise<void>;

  // Current room
  currentRoom: LiveStreamMeta | null;
  setCurrentRoom: (room: LiveStreamMeta | null) => void;

  // LiveKit connection
  livekitToken: string | null;
  livekitUrl: string;
  setLivekitConnection: (token: string, url: string) => void;

  // Chat
  messages: LiveChatMessage[];
  addMessage: (msg: LiveChatMessage) => void;
  clearMessages: () => void;

  // Live state
  viewerCount: number;
  setViewerCount: (count: number) => void;
  isStreaming: boolean;
  setIsStreaming: (val: boolean) => void;

  // Go-live overlay
  isGoLiveOpen: boolean;
  openGoLive: () => void;
  closeGoLive: () => void;

  // Co-host invite
  cohostInvite: { roomId: string; roomName: string; title: string; host: { username: string; avatarUrl?: string } } | null;
  setCohostInvite: (invite: LiveState['cohostInvite']) => void;
}

export const useLiveStore = create<LiveState>((set) => ({
  activeLiveStreams: [],
  isLoadingStreams: false,
  setActiveLiveStreams: (streams) => set({ activeLiveStreams: streams }),
  fetchActiveStreams: async () => {
    set({ isLoadingStreams: true });
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const res = await fetch(`${baseUrl}/api/live/active`);
      const data = await res.json();
      if (data.status === 'success') {
        set({ activeLiveStreams: data.data.streams });
      }
    } catch (err) {
      console.error('[LiveStore] Failed to fetch active streams', err);
    } finally {
      set({ isLoadingStreams: false });
    }
  },

  currentRoom: null,
  setCurrentRoom: (room) => set({ currentRoom: room }),

  livekitToken: null,
  livekitUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://toka-qbo14kfo.livekit.cloud',
  setLivekitConnection: (token, url) => {
    let resolvedUrl = url;
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && (!resolvedUrl || resolvedUrl.includes('localhost'))) {
      resolvedUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://toka-qbo14kfo.livekit.cloud';
    }
    set({ livekitToken: token, livekitUrl: resolvedUrl || url });
  },

  messages: [],
  addMessage: (msg) =>
    set((s) => {
      // 1. Deduplicate by unique id
      if (s.messages.some((m) => m.id === msg.id)) {
        return s;
      }
      // 2. Deduplicate if same user + same message within 3 seconds
      const isDuplicate = s.messages.some(
        (m) =>
          m.user.username === msg.user.username &&
          m.message === msg.message &&
          Math.abs((m.timestamp || 0) - (msg.timestamp || 0)) < 3000
      );
      if (isDuplicate) {
        return s;
      }
      return { messages: [...s.messages.slice(-200), msg] };
    }),
  clearMessages: () => set({ messages: [] }),

  viewerCount: 0,
  setViewerCount: (count) => set({ viewerCount: count }),
  isStreaming: false,
  setIsStreaming: (val) => set({ isStreaming: val }),

  isGoLiveOpen: false,
  openGoLive: () => set({ isGoLiveOpen: true }),
  closeGoLive: () => set({ isGoLiveOpen: false }),

  cohostInvite: null,
  setCohostInvite: (invite) => set({ cohostInvite: invite }),
}));
