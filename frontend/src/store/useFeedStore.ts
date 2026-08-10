"use client";
import { create } from 'zustand';
import { auth } from '@/lib/firebase';

export interface Video {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  videoUrl: string;
  title: string;
  description: string;
  likes: number;
  tips: number;
  shares: number;
  vettingStatus: 'processing' | 'ai_review' | 'human_review' | 'approved' | 'rejected';
  aiConfidenceScore: number;
  riskFlags: string[];
  isVerified: boolean;
  isLiked?: boolean;
  audioName?: string;
  audioArt?: string;
  poster?: string;
}

interface FeedStore {
  videos: Video[];
  currentIndex: number;
  activeVideoId: string;
  isLoading: boolean;
  currentPage: number;
  hasNextPage: boolean;
  userWalletBalance: number;
  feedType: 'foryou' | 'following';
  setFeedType: (type: 'foryou' | 'following') => void;
  setWalletBalance: (balance: number) => void;
  setCurrentIndex: (index: number) => void;
  optimisticTip: (videoId: string, amount: number) => void;
  updateVideoVetting: (videoId: string, status: Video['vettingStatus']) => void;
  toggleLikeVideo: (videoId: string) => Promise<void>;
  fetchNextPage: () => Promise<void>;
  resetFeed: () => void;
  incrementShareCount: (videoId: string) => void;
}

const initialVideos: Video[] = [
  {
    id: "video1",
    creatorId: "creator1",
    creatorName: "@johndoe_creator",
    creatorAvatar: "/images/creator-avatar.png",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-cooking-in-a-pot-close-up-4809-large.mp4",
    title: "Cooking traditional Jollof rice today!",
    description: "Cooking traditional Jollof rice today! Best recipe from West Africa. Let me know if you want the full ingredients list in the comments below! 👇🏾 #jollof #westafrica",
    likes: 1200,
    tips: 0,
    shares: 245,
    vettingStatus: "approved",
    aiConfidenceScore: 98,
    riskFlags: [],
    isVerified: true,
    audioName: "Original Sound - John Doe Afrobeat Mix",
    audioArt: "/images/audio-album.jpg",
    poster: "/images/jollof-cooking.png"
  },
  {
    id: "video2",
    creatorId: "creator2",
    creatorName: "@dance_king",
    creatorAvatar: "/images/moderator-avatar.png",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-woman-dancing-alone-in-a-room-with-neon-lights-40078-large.mp4",
    title: "Late Night Chill",
    description: "Just chilling here, mixing up some drinks for the weekend and dancing to this new track. Grab a drink and let's get into it! 🕺🏾 #neon #dance #chill",
    likes: 850,
    tips: 120,
    shares: 98,
    vettingStatus: "human_review",
    aiConfidenceScore: 82,
    riskFlags: ["Profanity (Medium)", "Alcohol (High)"],
    isVerified: false,
    audioName: "Original Sound - Dance King Mix",
    audioArt: "/images/audio-album.jpg",
    poster: "/images/dance-video.png"
  }
];

export const useFeedStore = create<FeedStore>((set, get) => ({
  videos: initialVideos,
  currentIndex: 0,
  activeVideoId: initialVideos[0]?.id || '',
  isLoading: false,
  currentPage: 1,
  hasNextPage: true,
  userWalletBalance: 100, // Starting balance fallback
  feedType: 'foryou',

  setFeedType: (type) => {
    set({ feedType: type });
    get().resetFeed();
    get().fetchNextPage();
  },

  setWalletBalance: (balance) => set({ userWalletBalance: balance }),

  setCurrentIndex: (index) => {
    const { videos, hasNextPage, isLoading, fetchNextPage } = get();
    if (index < 0 || index >= videos.length) return;
    
    set({
      currentIndex: index,
      activeVideoId: videos[index]?.id || ''
    });

    // Background prefetching: if user is within 3 videos of the end of the feed, pre-fetch next page
    if (index >= videos.length - 3 && hasNextPage && !isLoading) {
      fetchNextPage();
    }
  },

  optimisticTip: (videoId, amount) => set((state) => {
    if (state.userWalletBalance < amount) return {};
    return {
      userWalletBalance: state.userWalletBalance - amount,
      videos: state.videos.map((vid) =>
        vid.id === videoId ? { ...vid, tips: vid.tips + amount } : vid
      )
    };
  }),

  updateVideoVetting: (videoId, status) => set((state) => ({
    videos: state.videos.map((vid) =>
      vid.id === videoId ? { ...vid, vettingStatus: status } : vid
    )
  })),

  toggleLikeVideo: async (videoId) => {
    const { videos } = get();
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;

    // 1) Optimistic updates
    set({
      videos: videos.map((vid) => {
        if (vid.id === videoId) {
          const isCurrentlyLiked = vid.isLiked || false;
          return {
            ...vid,
            isLiked: !isCurrentlyLiked,
            likes: isCurrentlyLiked ? Math.max(0, vid.likes - 1) : vid.likes + 1
          };
        }
        return vid;
      })
    });

    try {
      // 2) Backend API call
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/${videoId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error('Failed to toggle like on server');
      }
    } catch (err) {
      console.error('[Store] toggleLikeVideo failed, rolling back:', err);
      // Rollback optimistic updates
      set({
        videos: videos.map((vid) => {
          if (vid.id === videoId) {
            const originalLiked = vid.isLiked || false;
            return {
              ...vid,
              isLiked: originalLiked,
              likes: vid.likes
            };
          }
          return vid;
        })
      });
      throw err;
    }
  },

  fetchNextPage: async () => {
    const { currentPage, videos, isLoading, hasNextPage, feedType } = get();
    if (isLoading || !hasNextPage) return;

    set({ isLoading: true });

    try {
      let headers: HeadersInit = {};
      const firebaseUser = auth.currentUser;
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/feed?page=${currentPage}&limit=5${feedType === 'following' ? '&following=true' : ''}`,
        { headers }
      );
      
      if (!res.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await res.json();

      if (data.status === 'success') {
        const newMongooseVideos = data.data.videos;
        
        // Map backend response models to frontend expected schema
        const mappedVideos: Video[] = newMongooseVideos.map((video: any) => ({
          id: video._id,
          creatorId: video.creatorId?._id || video.creatorId,
          creatorName: video.creatorId?.username ? `@${video.creatorId.username}` : '@unknown',
          creatorAvatar: video.creatorId?.role === 'moderator' ? '/images/moderator-avatar.png' : '/images/creator-avatar.png',
          videoUrl: video.videoUrl,
          title: video.title,
          description: video.title + ' #toka #creator',
          likes: video.likesCount || 0,
          tips: 0,
          shares: Math.floor(Math.random() * 200) + 15,
          vettingStatus: video.vettingStatus,
          aiConfidenceScore: video.aiConfidenceScore || 0,
          riskFlags: video.riskFlags || [],
          isVerified: video.creatorId?.isBrandSafeVerified || false,
          isLiked: video.isLiked || false,
          audioName: `Original Sound - ${video.creatorId?.username || 'Creator'}`,
          audioArt: '/images/audio-album.jpg',
          poster: '/images/dance-video.png'
        }));

        if (mappedVideos.length === 0 && currentPage === 1) {
          // If no videos are present in the MongoDB database, fall back to initial mock videos for UI testing
          set({
            videos: initialVideos,
            currentPage: 2,
            hasNextPage: false,
            activeVideoId: initialVideos[0]?.id || ''
          });
        } else {
          set({
            videos: currentPage === 1 ? mappedVideos : [...videos, ...mappedVideos],
            currentPage: currentPage + 1,
            hasNextPage: data.pagination.hasNextPage,
            activeVideoId: currentPage === 1 ? (mappedVideos[0]?.id || '') : get().activeVideoId
          });
        }
      }
    } catch (err) {
      console.error('Error fetching video feed page:', err);
      // Fallback on total failure for first page load
      if (currentPage === 1 && videos.length === 0) {
        set({
          videos: initialVideos,
          currentPage: 2,
          hasNextPage: false,
          activeVideoId: initialVideos[0]?.id || ''
        });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  resetFeed: () => set({
    videos: [],
    currentIndex: 0,
    activeVideoId: '',
    currentPage: 1,
    hasNextPage: true,
    isLoading: false
  }),
  
  incrementShareCount: (videoId) => set((state) => ({
    videos: state.videos.map((vid) =>
      vid.id === videoId ? { ...vid, shares: vid.shares + 1 } : vid
    )
  }))
}));
