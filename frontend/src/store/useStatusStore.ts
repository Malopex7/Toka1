"use client";
import { create } from 'zustand';
import { auth } from '@/lib/firebase';

export interface StatusSticker {
  type: 'slang' | 'cultural' | 'badge' | 'qa' | 'poll' | 'emoji';
  text: string;
  subtext?: string;
  variant?: 'flare' | 'mint' | 'sunset' | 'gold' | 'dark';
  posX: number;
  posY: number;
  scale: number;
  rotation: number;
}

export interface StatusAudio {
  title: string;
  artist: string;
  audioUrl: string;
  previewStart?: number;
  duration?: number;
}

export interface StatusItem {
  _id: string;
  id?: string;
  user: {
    _id: string;
    username: string;
    isBrandSafeVerified?: boolean;
    role?: string;
  };
  type: 'text' | 'image' | 'video';
  textContent?: string;
  textStyle?: {
    backgroundGradient: string;
    fontFamily: string;
    textColor: string;
    alignment: 'left' | 'center' | 'right';
  };
  mediaUrl?: string;
  mediaType?: string;
  duration: number;
  stickers: StatusSticker[];
  audio?: StatusAudio | null;
  caption?: string;
  viewers?: Array<{ user: { _id: string; username: string }; viewedAt: string }>;
  reactions?: Array<{ user: { _id: string; username: string }; emoji: string; reactedAt: string }>;
  replies?: Array<{ user: { _id: string; username: string }; message: string; sentAt: string }>;
  hasViewed?: boolean;
  viewsCount?: number;
  reactionsCount?: number;
  repliesCount?: number;
  createdAt: string;
  expiresAt: string;
}

export interface UserStoryGroup {
  user: {
    _id: string;
    username: string;
    isBrandSafeVerified?: boolean;
    role?: string;
  };
  isSelf: boolean;
  hasUnseen: boolean;
  latestStatusTime: string;
  statuses: StatusItem[];
}

export interface StatusHighlight {
  _id: string;
  title: string;
  coverUrl?: string;
  coverGradient?: string;
  coverType?: 'image' | 'gradient' | 'video';
  statuses: StatusItem[];
  createdAt: string;
}

interface StatusStoreState {
  stories: UserStoryGroup[];
  hasSelfStory: boolean;
  isLoading: boolean;
  isViewerOpen: boolean;
  isCreatorOpen: boolean;
  isAnalyticsOpen: boolean;
  activeGroupIndex: number;
  activeSlideIndex: number;
  isPaused: boolean;
  floatingReactions: Array<{ id: string; emoji: string; x: number }>;
  userHighlights: StatusHighlight[];

  // Actions
  fetchStatusFeed: () => Promise<void>;
  openViewer: (groupIndex: number, slideIndex?: number) => void;
  closeViewer: () => void;
  openCreator: () => void;
  closeCreator: () => void;
  openAnalytics: () => void;
  closeAnalytics: () => void;
  nextSlide: () => void;
  prevSlide: () => void;
  setPaused: (paused: boolean) => void;
  recordView: (statusId: string) => Promise<void>;
  sendReaction: (statusId: string, emoji: string) => Promise<void>;
  sendReply: (statusId: string, message: string) => Promise<void>;
  deleteCurrentStatus: (statusId: string) => Promise<void>;
  addFloatingReaction: (emoji: string) => void;
  removeFloatingReaction: (id: string) => void;
  fetchUserHighlights: (userId: string) => Promise<void>;
  createHighlight: (title: string, statusIds: string[], coverGradient?: string) => Promise<void>;
}

const getApiBase = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const useStatusStore = create<StatusStoreState>((set, get) => ({
  stories: [],
  hasSelfStory: false,
  isLoading: false,
  isViewerOpen: false,
  isCreatorOpen: false,
  isAnalyticsOpen: false,
  activeGroupIndex: 0,
  activeSlideIndex: 0,
  isPaused: false,
  floatingReactions: [],
  userHighlights: [],

  fetchStatusFeed: async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;

    set({ isLoading: true });
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`${getApiBase()}/api/status/feed`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error('Failed to fetch status feed');
      }

      const json = await res.json();
      if (json.status === 'success') {
        set({
          stories: json.data.stories || [],
          hasSelfStory: Boolean(json.data.hasSelfStory)
        });
      }
    } catch (err) {
      console.error('[StatusStore] fetchStatusFeed failed:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  openViewer: (groupIndex: number, slideIndex = 0) => {
    const { stories } = get();
    if (!stories[groupIndex]) return;

    // If starting at an unviewed slide, start at first unviewed slide
    let resolvedSlideIndex = slideIndex;
    if (slideIndex === 0 && stories[groupIndex].hasUnseen) {
      const firstUnviewed = stories[groupIndex].statuses.findIndex(s => !s.hasViewed);
      if (firstUnviewed !== -1) {
        resolvedSlideIndex = firstUnviewed;
      }
    }

    set({
      isViewerOpen: true,
      activeGroupIndex: groupIndex,
      activeSlideIndex: resolvedSlideIndex,
      isPaused: false,
      isAnalyticsOpen: false
    });

    const currentStatus = stories[groupIndex].statuses[resolvedSlideIndex];
    if (currentStatus) {
      get().recordView(currentStatus._id);
    }
  },

  closeViewer: () => {
    set({
      isViewerOpen: false,
      isPaused: false,
      isAnalyticsOpen: false,
      floatingReactions: []
    });
  },

  openCreator: () => set({ isCreatorOpen: true }),
  closeCreator: () => set({ isCreatorOpen: false }),

  openAnalytics: () => set({ isAnalyticsOpen: true, isPaused: true }),
  closeAnalytics: () => set({ isAnalyticsOpen: false, isPaused: false }),

  setPaused: (paused: boolean) => set({ isPaused: paused }),

  nextSlide: () => {
    const { stories, activeGroupIndex, activeSlideIndex } = get();
    const currentGroup = stories[activeGroupIndex];
    if (!currentGroup) return;

    if (activeSlideIndex < currentGroup.statuses.length - 1) {
      const nextIdx = activeSlideIndex + 1;
      set({ activeSlideIndex: nextIdx, isPaused: false });
      const nextStatus = currentGroup.statuses[nextIdx];
      if (nextStatus) get().recordView(nextStatus._id);
    } else if (activeGroupIndex < stories.length - 1) {
      // Advance to next user's story group
      const nextGroupIdx = activeGroupIndex + 1;
      set({
        activeGroupIndex: nextGroupIdx,
        activeSlideIndex: 0,
        isPaused: false
      });
      const nextStatus = stories[nextGroupIdx].statuses[0];
      if (nextStatus) get().recordView(nextStatus._id);
    } else {
      // Reached the end of all stories
      get().closeViewer();
    }
  },

  prevSlide: () => {
    const { stories, activeGroupIndex, activeSlideIndex } = get();
    if (activeSlideIndex > 0) {
      set({ activeSlideIndex: activeSlideIndex - 1, isPaused: false });
    } else if (activeGroupIndex > 0) {
      const prevGroupIdx = activeGroupIndex - 1;
      const prevGroup = stories[prevGroupIdx];
      set({
        activeGroupIndex: prevGroupIdx,
        activeSlideIndex: Math.max(0, (prevGroup?.statuses.length || 1) - 1),
        isPaused: false
      });
    }
  },

  recordView: async (statusId: string) => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser || !statusId) return;

    // Optimistically mark as viewed in local state
    set((state) => {
      const updatedStories = state.stories.map((group) => {
        let groupHasUnseen = false;
        const updatedStatuses = group.statuses.map((s) => {
          if (s._id === statusId) {
            return { ...s, hasViewed: true, viewsCount: (s.viewsCount || 0) + (s.hasViewed ? 0 : 1) };
          }
          if (!s.hasViewed) groupHasUnseen = true;
          return s;
        });
        return {
          ...group,
          hasUnseen: group.isSelf ? false : groupHasUnseen,
          statuses: updatedStatuses
        };
      });
      return { stories: updatedStories };
    });

    try {
      const token = await firebaseUser.getIdToken();
      await fetch(`${getApiBase()}/api/status/${statusId}/view`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.warn('[StatusStore] recordView failed:', err);
    }
  },

  sendReaction: async (statusId: string, emoji: string) => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;

    // Trigger local floating reaction bubble
    get().addFloatingReaction(emoji);

    try {
      const token = await firebaseUser.getIdToken();
      await fetch(`${getApiBase()}/api/status/${statusId}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ emoji })
      });
    } catch (err) {
      console.error('[StatusStore] sendReaction failed:', err);
    }
  },

  sendReply: async (statusId: string, message: string) => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;

    const token = await firebaseUser.getIdToken();
    const res = await fetch(`${getApiBase()}/api/status/${statusId}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ message })
    });

    if (!res.ok) {
      throw new Error('Failed to send reply');
    }
  },

  deleteCurrentStatus: async (statusId: string) => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;

    const token = await firebaseUser.getIdToken();
    const res = await fetch(`${getApiBase()}/api/status/${statusId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      throw new Error('Failed to delete status');
    }

    // Refresh feed and close viewer
    get().closeViewer();
    get().fetchStatusFeed();
  },

  addFloatingReaction: (emoji: string) => {
    const newReaction = {
      id: `${Date.now()}-${Math.random()}`,
      emoji,
      x: 35 + Math.random() * 30 // Center-biased random X position (35% - 65%)
    };

    set((state) => ({
      floatingReactions: [...state.floatingReactions, newReaction]
    }));

    setTimeout(() => {
      get().removeFloatingReaction(newReaction.id);
    }, 2200);
  },

  removeFloatingReaction: (id: string) => {
    set((state) => ({
      floatingReactions: state.floatingReactions.filter((r) => r.id !== id)
    }));
  },

  fetchUserHighlights: async (userId: string) => {
    try {
      const res = await fetch(`${getApiBase()}/api/status/highlights/${userId}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.status === 'success') {
        set({ userHighlights: json.data.highlights || [] });
      }
    } catch (err) {
      console.error('[StatusStore] fetchUserHighlights failed:', err);
    }
  },

  createHighlight: async (title: string, statusIds: string[], coverGradient = 'from-toka-flare to-amber-600') => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;

    const token = await firebaseUser.getIdToken();
    const res = await fetch(`${getApiBase()}/api/status/highlights`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        title,
        statusIds,
        coverGradient,
        coverType: 'gradient'
      })
    });

    if (!res.ok) {
      throw new Error('Failed to create highlight');
    }
  }
}));
