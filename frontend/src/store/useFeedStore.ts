import { create } from 'zustand';

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
  audioName?: string;
  audioArt?: string;
  poster?: string;
}

interface FeedStore {
  videos: Video[];
  currentIndex: number;
  activeVideoId: string;
  isLoading: boolean;
  userWalletBalance: number;
  setCurrentIndex: (index: number) => void;
  optimisticTip: (videoId: string, amount: number) => void;
  updateVideoVetting: (videoId: string, status: Video['vettingStatus']) => void;
  fetchNextPage: () => void;
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

export const useFeedStore = create<FeedStore>((set) => ({
  videos: initialVideos,
  currentIndex: 0,
  activeVideoId: initialVideos[0]?.id || '',
  isLoading: false,
  userWalletBalance: 500, // Starting mockup balance in ZAR
  setCurrentIndex: (index) => set((state) => ({
    currentIndex: index,
    activeVideoId: state.videos[index]?.id || ''
  })),
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
  fetchNextPage: () => {
    // Add additional mock videos or prefetch logic
  }
}));
