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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/live/active`);
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
  livekitUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880',
  setLivekitConnection: (token, url) => set({ livekitToken: token, livekitUrl: url }),

  messages: [],
  addMessage: (msg) => set((s) => ({ messages: [...s.messages.slice(-200), msg] })),
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
