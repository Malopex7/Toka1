"use client";
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useModalStore } from '@/store/useModalStore';
import FollowListModal from '@/components/FollowListModal';
import ProfileHighlightsReel from '@/components/status/ProfileHighlightsReel';
import StatusViewerModal from '@/components/status/StatusViewerModal';
import { useStatusStore, StatusItem } from '@/store/useStatusStore';

interface ProfileVideo {
  _id: string;
  creatorId?: any;
  title: string;
  videoUrl: string;
  vettingStatus: string;
  aiConfidenceScore: number;
  tips: number;
  createdAt: string;
  coAuthors?: Array<{
    user: any;
    status: 'pending' | 'accepted' | 'declined' | 'removed';
  }>;
}

// Sleek Nano-style Minimalist Vector Icons
function IconVideo({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="15" x="3" y="4.5" rx="2.5" />
      <polygon points="10 9 15 12 10 15 10 9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconFollowers({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconFollowing({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
      <path d="m16 11 2 2 4-4" />
    </svg>
  );
}

function IconWallet({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="14" x="2" y="5" rx="3" />
      <line x1="2" x2="22" y1="10" y2="10" />
      <circle cx="17" cy="14" r="1" fill="currentColor" />
    </svg>
  );
}

function IconTopUp({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="14" x="2" y="5" rx="2.5" />
      <line x1="2" x2="22" y1="10" y2="10" />
      <line x1="12" x2="12" y1="13" y2="17" />
      <line x1="10" x2="14" y1="15" y2="15" />
    </svg>
  );
}

function IconInbox({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function IconRepeat({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function IconCamera({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function IconTrash({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function IconVerifiedCheck({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="var(--fintech-mint)" />
    </svg>
  );
}

interface TargetUser {
  _id: string;
  username: string;
  role: string;
  avatarUrl?: string;
  followers?: string[];
  following?: string[];
  isBrandSafeVerified?: boolean;
  verificationRequestStatus?: string;
  taggingPermission?: string;
  followListPrivacy?: string;
}

function ProfileContent() {
  const { mongooseUser, isAuthenticated, firebaseUser, isLoading, logout, refreshProfile } = useAuth();
  const { showAlert, showConfirm, showPrompt } = useModalStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetUsername = searchParams?.get('username') || '';

  const [targetUser, setTargetUser] = useState<TargetUser | null>(null);
  const [videos, setVideos] = useState<ProfileVideo[]>([]);
  const [fetchingProfile, setFetchingProfile] = useState(true);
  const [fetchingVideos, setFetchingVideos] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  // Avatar upload state
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Verification request state
  const [verificationLoading, setVerificationLoading] = useState(false);

  // Follow list modal state
  const [isFollowModalOpen, setIsFollowModalOpen] = useState(false);
  const [followModalTab, setFollowModalTab] = useState<'followers' | 'following'>('followers');

  // Video tab & reposts state
  const [repostVideos, setRepostVideos] = useState<ProfileVideo[]>([]);
  const [isFollowingPending, setIsFollowingPending] = useState(false);
  const [fetchingReposts, setFetchingReposts] = useState(true);
  const [activeVideoTab, setActiveVideoTab] = useState<'uploads' | 'reposts'>('uploads');
  const [userStories, setUserStories] = useState<StatusItem[]>([]);
  const [hasActiveStatus, setHasActiveStatus] = useState<boolean>(false);

  // Settings Sheet state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Privacy setting states
  const [taggingPermission, setTaggingPermission] = useState<string>('allow_all');
  const [followListPrivacy, setFollowListPrivacy] = useState<string>('everyone');
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const isOwnProfile = !targetUsername || (mongooseUser && targetUsername.toLowerCase() === mongooseUser.username.toLowerCase());

  // Role style mapping
  const roleColors: Record<string, string> = {
    creator: 'bg-toka-flare/20 text-toka-flare border-toka-flare/30',
    fan: 'bg-fintech-mint/10 text-fintech-mint border-fintech-mint/30',
    brand: 'bg-blue-500/10 text-blue-400 border-blue-400/30',
    moderator: 'bg-purple-500/10 text-purple-400 border-purple-400/30'
  };

  // 1) Fetch Profile details
  useEffect(() => {
    const fetchProfile = async () => {
      const queryUsername = isOwnProfile ? mongooseUser?.username : targetUsername;
      if (!queryUsername) {
        setFetchingProfile(false);
        setTargetUser(null);
        return;
      }

      setFetchingProfile(true);
      setErrorMsg(null);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/profile/${queryUsername}`);
        const data = await res.json();
        if (res.ok && data.status === 'success' && data.data?.user) {
          setTargetUser(data.data.user);
          setFollowerCount(data.data.user.followers?.length || 0);
          if (data.data.user.taggingPermission) {
            setTaggingPermission(data.data.user.taggingPermission);
          }
          if (data.data.user.followListPrivacy) {
            setFollowListPrivacy(data.data.user.followListPrivacy);
          }
          
          // Check if currently following
          if (mongooseUser) {
            setIsFollowing(mongooseUser.following?.includes(data.data.user._id) || false);
          }
        } else {
          setErrorMsg(data.message || `User "@${queryUsername}" not found.`);
        }
      } catch (err) {
        console.error('Error fetching target profile:', err);
        setErrorMsg('Could not fetch user profile.');
      } finally {
        setFetchingProfile(false);
      }
    };

    fetchProfile();
  }, [targetUsername, isOwnProfile, mongooseUser, refreshTrigger]);

  // 2) Fetch Videos
  useEffect(() => {
    if (!targetUser) return;

    const fetchVideos = async () => {
      setFetchingVideos(true);
      try {
        const headers: HeadersInit = {};
        if (firebaseUser) {
          const token = await firebaseUser.getIdToken();
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/feed?limit=40`, { headers });
        const data = await res.json();
        
        if (data.status === 'success') {
          const ensureHttps = (url?: string) => (url && url.startsWith('http://') && !url.includes('localhost') && !url.includes('127.0.0.1')) ? url.replace('http://', 'https://') : (url || '');
          const userVideos = data.data.videos
            .filter(
              (v: any) =>
                (v.creatorId?._id || v.creatorId) === targetUser._id ||
                (v.coAuthors && v.coAuthors.some((ca: any) => 
                  (ca.user?._id || ca.user) === targetUser._id && ca.status === 'accepted'
                ))
            )
            .map((v: any) => ({ ...v, videoUrl: ensureHttps(v.videoUrl) }));
          setVideos(userVideos);
        }
      } catch (err) {
        console.error('Error fetching videos:', err);
      } finally {
        setFetchingVideos(false);
      }
    };

    fetchVideos();
  }, [targetUser, firebaseUser]);

  // 3) Fetch Reposted Videos
  useEffect(() => {
    const queryUsername = isOwnProfile ? mongooseUser?.username : targetUsername;

    const fetchReposts = async () => {
      if (!queryUsername) {
        setFetchingReposts(false);
        return;
      }

      try {
        const ensureHttps = (url?: string) => (url && url.startsWith('http://') && !url.includes('localhost') && !url.includes('127.0.0.1')) ? url.replace('http://', 'https://') : (url || '');
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/user/${queryUsername}/reposts`);
        const data = await res.json();
        if (res.ok && data.status === 'success') {
          const mapped = (data.data?.videos || []).map((v: any) => ({
            ...v,
            videoUrl: ensureHttps(v.videoUrl)
          }));
          setRepostVideos(mapped);
        }
      } catch (err) {
        console.error('Error fetching reposts:', err);
      } finally {
        setFetchingReposts(false);
      }
    };

    fetchReposts();
  }, [targetUsername, isOwnProfile, mongooseUser, refreshTrigger]);

  // 4) Follow/Unfollow Handler
  const handleFollowToggle = async () => {
    if (!isAuthenticated || !firebaseUser || !targetUser || !mongooseUser) {
      showAlert('Sign In Required', 'Please sign in to follow creators.');
      return;
    }

    // Optimistic toggle
    const newFollowingState = !isFollowing;
    setIsFollowing(newFollowingState);
    setFollowerCount(prev => newFollowingState ? prev + 1 : Math.max(0, prev - 1));

    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/follow/${targetUser._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error('Failed to follow/unfollow on server');
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
      // Revert optimistic changes on failure
      setIsFollowing(!newFollowingState);
      setFollowerCount(prev => !newFollowingState ? prev + 1 : Math.max(0, prev - 1));
    }
  };

  const handleRequestVerification = async () => {
    if (!firebaseUser) return;
    setVerificationLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/request-verification`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.status === 'success') {
        showAlert('Verification Requested', 'Your verification request was submitted successfully and is pending moderator approval.');
        if (targetUser) {
          setTargetUser({
            ...targetUser,
            verificationRequestStatus: 'pending'
          });
        }
        await refreshProfile();
      } else {
        showAlert('Verification Request Failed', data.message || 'Verification request failed.');
      }
    } catch (err) {
      console.error(err);
      showAlert('Error', 'An error occurred while submitting your verification request.');
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleDeleteVideo = (videoId: string) => {
    if (!firebaseUser) return;

    showConfirm(
      'Delete Video',
      'Are you sure you want to permanently delete this video? This action cannot be undone.',
      async () => {
        try {
          const token = await firebaseUser.getIdToken();
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/${videoId}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`
            }
          });

          const data = await res.json();
          if (res.ok && data.status === 'success') {
            setVideos(prev => prev.filter(v => v._id !== videoId));
            showAlert('Success', 'Video deleted successfully.');
          } else {
            showAlert('Error', data.message || 'Failed to delete video.');
          }
        } catch (err: any) {
          console.error('[Delete Video] Request failed:', err);
          showAlert('Error', err.message || 'An error occurred while deleting the video.');
        }
      }
    );
  };

  const handleEditCaption = (video: ProfileVideo) => {
    if (!firebaseUser) return;

    showPrompt(
      'Edit Caption',
      'Enter the new caption/title for your video:',
      async (newTitle) => {
        if (!newTitle || !newTitle.trim()) {
          showAlert('Error', 'Caption cannot be empty.');
          return;
        }

        try {
          const token = await firebaseUser.getIdToken();
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/${video._id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ title: newTitle.trim() })
          });

          const data = await res.json();
          if (res.ok && data.status === 'success') {
            setVideos(prev => prev.map(v => v._id === video._id ? { ...v, title: data.data.video.title } : v));
            showAlert('Success', 'Caption updated successfully.');
          } else {
            showAlert('Error', data.message || 'Failed to update caption.');
          }
        } catch (err: any) {
          console.error('[Edit Caption] Request failed:', err);
          showAlert('Error', err.message || 'An error occurred while updating the caption.');
        }
      },
      'Video caption...',
      video.title
    );
  };

  // 6) Leave Collaboration Handler
  const handleLeaveCollab = async (videoId: string) => {
    if (!firebaseUser) return;
    if (!confirm('Are you sure you want to leave this collaboration? The video will no longer appear on your profile.')) return;

    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/${videoId}/coauthor`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.status === 'success') {
        setVideos(prev => prev.filter(v => v._id !== videoId));
        showAlert('Left Collaboration', 'You have been removed as a co-author on this video.');
      }
    } catch (err) {
      console.error('Error leaving collaboration:', err);
    }
  };

  // 7) Update Tagging Permission Handler
  const handleUpdateTaggingPermission = async (newPermission: string) => {
    if (!targetUser || targetUser.taggingPermission === newPermission || isUpdatingSettings) return;

    setIsUpdatingSettings(true);
    setTargetUser(prev => prev ? { ...prev, taggingPermission: newPermission } : null);
    setTaggingPermission(newPermission);

    try {
      const token = await firebaseUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ taggingPermission: newPermission })
      });

      const data = await res.json();
      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Failed to update tagging privacy setting.');
      }
    } catch (err: any) {
      console.error('[Tagging Setting Error]:', err);
      showAlert('Update Failed', err.message || 'Could not save tagging privacy settings.');
      if (mongooseUser) {
        setTargetUser(prev => prev ? { ...prev, taggingPermission: (mongooseUser as any).taggingPermission || 'allow_all' } : null);
      }
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  // 8) Update Followers/Following List Privacy Handler
  const handleUpdateFollowListPrivacy = async (newPrivacy: string) => {
    if (!targetUser || targetUser.followListPrivacy === newPrivacy || isUpdatingSettings) return;

    setIsUpdatingSettings(true);
    setTargetUser(prev => prev ? { ...prev, followListPrivacy: newPrivacy } : null);
    setFollowListPrivacy(newPrivacy);

    try {
      const token = await firebaseUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ followListPrivacy: newPrivacy })
      });

      const data = await res.json();
      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Failed to update follow list privacy setting.');
      }
    } catch (err: any) {
      console.error('[Follow List Privacy Error]:', err);
      showAlert('Update Failed', err.message || 'Could not save follow list privacy settings.');
      if (mongooseUser) {
        setTargetUser(prev => prev ? { ...prev, followListPrivacy: (mongooseUser as any).followListPrivacy || 'everyone' } : null);
      }
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const compressAvatar = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 150;
          const MAX_HEIGHT = 150;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            0.7
          );
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showAlert('Invalid File', 'Please select an image file (JPEG, PNG, or WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showAlert('File Too Large', 'Please select an image smaller than 5MB.');
      return;
    }

    if (!firebaseUser) {
      showAlert('Sign In Required', 'Please sign in to update your avatar.');
      return;
    }

    setUploadingAvatar(true);
    try {
      // Compress the avatar on the client side before uploading
      let uploadBlob: Blob = file;
      try {
        uploadBlob = await compressAvatar(file);
      } catch (compressErr) {
        console.error('[Avatar Compression Failed, using original]:', compressErr);
      }

      const formData = new FormData();
      formData.append('avatar', uploadBlob, 'avatar.jpg');

      const token = await firebaseUser.getIdToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/avatar/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        const newAvatarUrl = data.data?.avatarUrl || data.data?.user?.avatarUrl;
        setTargetUser(prev => prev ? { ...prev, avatarUrl: newAvatarUrl } : null);
        await refreshProfile();
        showAlert('Avatar Updated', 'Your profile picture has been updated successfully!');
      } else {
        throw new Error(data.message || 'Failed to update avatar.');
      }
    } catch (err: any) {
      console.error('[Avatar Upload Error]:', err);
      showAlert('Upload Failed', err.message || 'Failed to upload profile picture.');
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = () => {
    if (!firebaseUser) return;

    showConfirm(
      'Remove Photo',
      'Are you sure you want to remove your profile picture and revert to your initial icon?',
      async () => {
        setUploadingAvatar(true);
        try {
          const token = await firebaseUser.getIdToken();
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/avatar`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ avatarUrl: '' })
          });

          const data = await res.json();
          if (res.ok && data.status === 'success') {
            setTargetUser(prev => prev ? { ...prev, avatarUrl: '' } : null);
            await refreshProfile();
            showAlert('Avatar Removed', 'Profile picture removed successfully.');
          } else {
            throw new Error(data.message || 'Failed to remove avatar.');
          }
        } catch (err: any) {
          console.error('[Avatar Remove Error]:', err);
          showAlert('Remove Failed', err.message || 'Failed to remove profile picture.');
        } finally {
          setUploadingAvatar(false);
        }
      }
    );
  };

  if (isLoading || fetchingProfile) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-midnight-boma text-cloud-white font-sans">
        <span className="w-10 h-10 border-4 border-toka-flare border-t-transparent rounded-full animate-spin"></span>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-midnight-boma text-cloud-white gap-4 font-sans px-6 text-center select-none">
        <span className="material-symbols-outlined text-[64px] text-red-500">error</span>
        <h1 className="text-2xl font-black tracking-tight">Profile Not Found</h1>
        <p className="text-sm text-cloud-white/60 max-w-sm">{errorMsg}</p>
        <Link href="/" className="px-6 py-3 bg-toka-flare hover:bg-toka-flare/90 rounded-xl font-bold transition-all text-xs active:scale-95 shadow-lg">
          Return to Homepage
        </Link>
      </div>
    );
  }

  if (!isAuthenticated && isOwnProfile) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-midnight-boma text-cloud-white gap-4 font-sans px-6 text-center select-none">
        <span className="material-symbols-outlined text-[64px] text-red-500 animate-pulse">lock</span>
        <h1 className="text-2xl font-black tracking-tight">Access Restricted</h1>
        <p className="text-sm text-cloud-white/60 max-w-sm">Please sign in to view your profile details.</p>
        <Link href="/" className="px-6 py-3 bg-toka-flare hover:bg-toka-flare/90 rounded-xl font-bold transition-all text-xs active:scale-95 shadow-lg">
          Return to Homepage
        </Link>
      </div>
    );
  }

  if (!targetUser) return null;

  return (
    <div className="bg-midnight-boma text-cloud-white min-h-screen antialiased font-sans pb-12">
      {/* Header */}
      <header className="sticky top-0 w-full border-b border-white/10 bg-shaded-canopy flex justify-between items-center px-6 h-16 z-40 select-none">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-cloud-white/70 hover:text-cloud-white transition-colors flex items-center gap-1 text-sm font-semibold">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back
          </Link>
          <h1 className="text-base font-bold text-toka-flare tracking-tight border-l border-white/15 pl-4">
            {isOwnProfile ? 'My Profile' : `@${targetUser.username}'s Profile`}
          </h1>
        </div>
        {isOwnProfile && (
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-cloud-white text-xs font-bold transition-all active:scale-95 border border-white/10 shadow-sm cursor-pointer"
            title="Profile & Privacy Settings"
          >
            <span className="material-symbols-outlined text-[18px] text-toka-flare">settings</span>
            <span>Settings</span>
          </button>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Profile Card */}
        <div className="bg-shaded-canopy border border-white/10 rounded-3xl p-6 flex flex-col items-center gap-4 text-center shadow-xl">
          <div className="relative group">
            <div 
              onClick={() => {
                if (hasActiveStatus && userStories.length > 0) {
                  useStatusStore.setState({
                    stories: [{
                      user: {
                        _id: targetUser._id,
                        username: targetUser.username,
                        isBrandSafeVerified: Boolean(targetUser.isBrandSafeVerified),
                        role: targetUser.role
                      },
                      isSelf: Boolean(isOwnProfile),
                      hasUnseen: userStories.some(s => !s.hasViewed),
                      latestStatusTime: userStories[userStories.length - 1].createdAt,
                      statuses: userStories
                    }],
                    activeGroupIndex: 0,
                    activeSlideIndex: 0,
                    isViewerOpen: true
                  });
                }
              }}
              className={`w-20 h-20 rounded-full flex items-center justify-center select-none overflow-hidden ${
                hasActiveStatus 
                  ? 'p-[3px] bg-gradient-to-tr from-toka-flare via-amber-500 to-fintech-mint cursor-pointer shadow-[0_0_16px_rgba(255,79,0,0.55)] hover:scale-105 active:scale-95 transition-all'
                  : 'bg-gradient-to-br from-toka-flare to-orange-700 shadow-lg border-2 border-white/10'
              }`}
              title={hasActiveStatus ? 'Tap to view 24h Story' : undefined}
            >
              <div className="w-full h-full rounded-full bg-midnight-boma overflow-hidden flex items-center justify-center text-3xl font-black text-cloud-white">
                {(targetUser.avatarUrl || (isOwnProfile && mongooseUser?.avatarUrl)) ? (
                  <img 
                    src={targetUser.avatarUrl || (isOwnProfile ? mongooseUser?.avatarUrl : '')} 
                    alt={targetUser.username} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  targetUser.username.charAt(0).toUpperCase()
                )}
              </div>
            </div>

            {/* In-place Avatar Upload Button (Own Profile) */}
            {isOwnProfile && (
              <>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-black/70 hover:bg-toka-flare text-cloud-white flex items-center justify-center shadow-lg border border-white/20 transition-all hover:scale-110 active:scale-95 disabled:opacity-50 cursor-pointer z-10 backdrop-blur-md"
                  title="Change Profile Photo"
                >
                  {uploadingAvatar ? (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <IconCamera className="w-3.5 h-3.5" />
                  )}
                </button>
                <input
                  type="file"
                  ref={avatarInputRef}
                  onChange={handleAvatarUpload}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                />
              </>
            )}
          </div>

          {isOwnProfile && (targetUser.avatarUrl || mongooseUser?.avatarUrl) && (
            <button
              onClick={handleRemoveAvatar}
              disabled={uploadingAvatar}
              className="text-[11px] font-medium text-white/40 hover:text-red-400 -mt-2 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <IconTrash className="w-3 h-3" />
              Remove Photo
            </button>
          )}

          <div>
            <div className="flex items-center justify-center gap-1.5">
              <h2 className="text-xl font-black tracking-tight text-cloud-white">@{targetUser.username}</h2>
              {targetUser.isBrandSafeVerified && (
                <span title="Brand-Safe Verified Profile">
                  <IconVerifiedCheck className="w-4 h-4 inline-block" />
                </span>
              )}
            </div>
            {isOwnProfile && mongooseUser && (
              <p className="text-xs text-cloud-white/50 mt-0.5">{mongooseUser.email}</p>
            )}
          </div>
          <span className={`border rounded-full px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider ${roleColors[targetUser.role] || roleColors.fan}`}>
            {targetUser.role}
          </span>

          {/* Follow/Unfollow Button for other profiles */}
          {!isOwnProfile && (
            <button
              onClick={handleFollowToggle}
              className={`w-36 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-md flex items-center justify-center gap-1.5 ${
                isFollowing
                  ? 'bg-white/10 border border-white/20 text-cloud-white hover:bg-white/15'
                  : 'bg-toka-flare hover:bg-toka-flare/90 text-cloud-white'
              }`}
            >
              <IconFollowing className="w-4 h-4" />
              {isFollowing ? 'Unfollow' : 'Follow'}
            </button>
          )}
        </div>

        {/* Modern Sleek Stats Row aligned with Toka Design System */}
        <div className={`grid ${isOwnProfile ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'} gap-3`}>
          <div className="bg-shaded-canopy border border-white/10 hover:border-white/20 rounded-2xl p-4 flex flex-col items-center gap-1.5 transition-all shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-toka-flare">
              <IconVideo className="w-4 h-4" />
            </div>
            <span className="text-xl font-black font-mono text-cloud-white">{videos.length}</span>
            <span className="text-[10px] font-bold text-cloud-white/40 uppercase tracking-wider font-mono">Videos</span>
          </div>

          <button 
            type="button"
            onClick={() => { setFollowModalTab('followers'); setIsFollowModalOpen(true); }}
            className="bg-shaded-canopy border border-white/10 hover:border-amber-400/40 rounded-2xl p-4 flex flex-col items-center gap-1.5 transition-all active:scale-95 cursor-pointer group shadow-sm"
          >
            <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-cloud-white/70 group-hover:text-amber-400 group-hover:border-amber-400/30 transition-all">
              <IconFollowers className="w-4 h-4" />
            </div>
            <span className="text-xl font-black font-mono text-cloud-white">{followerCount}</span>
            <span className="text-[10px] font-bold text-cloud-white/40 group-hover:text-amber-400 uppercase tracking-wider font-mono transition-colors">Followers</span>
          </button>

          <button 
            type="button"
            onClick={() => { setFollowModalTab('following'); setIsFollowModalOpen(true); }}
            className="bg-shaded-canopy border border-white/10 hover:border-blue-400/40 rounded-2xl p-4 flex flex-col items-center gap-1.5 transition-all active:scale-95 cursor-pointer group shadow-sm"
          >
            <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-cloud-white/70 group-hover:text-blue-400 group-hover:border-blue-400/30 transition-all">
              <IconFollowing className="w-4 h-4" />
            </div>
            <span className="text-xl font-black font-mono text-cloud-white">{targetUser.following?.length || 0}</span>
            <span className="text-[10px] font-bold text-cloud-white/40 group-hover:text-blue-400 uppercase tracking-wider font-mono transition-colors">Following</span>
          </button>

          {isOwnProfile && mongooseUser && (
            <Link 
              href="/deposit"
              className="bg-fintech-mint/5 hover:bg-fintech-mint/10 border border-fintech-mint/30 hover:border-fintech-mint/50 rounded-2xl p-4 flex flex-col items-center gap-1.5 transition-all active:scale-95 cursor-pointer group shadow-sm"
            >
              <div className="w-8 h-8 rounded-xl bg-fintech-mint/10 border border-fintech-mint/30 flex items-center justify-center text-fintech-mint">
                <IconWallet className="w-4 h-4" />
              </div>
              <span className="text-xl font-black font-mono text-fintech-mint">R {mongooseUser.walletBalance.toFixed(2)}</span>
              <span className="text-[10px] font-bold text-fintech-mint/70 uppercase tracking-wider font-mono">Balance</span>
            </Link>
          )}
        </div>

        {/* Own Profile Quick Actions */}
        {isOwnProfile && (
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/deposit"
              className="flex items-center justify-center gap-2 bg-toka-flare hover:bg-toka-flare/90 text-cloud-white rounded-2xl py-3.5 text-xs font-bold transition-all active:scale-95 shadow-lg shadow-toka-flare/20"
            >
              <IconTopUp className="w-4 h-4" />
              Top Up Wallet
            </Link>
            <Link
              href="/inbox"
              className="flex items-center justify-center gap-2 bg-shaded-canopy hover:bg-white/10 border border-white/15 text-cloud-white rounded-2xl py-3.5 text-xs font-bold transition-all active:scale-95"
            >
              <IconInbox className="w-4 h-4" />
              View Inbox
            </Link>
          </div>
        )}

        {/* Profile Story Highlights Reel */}
        <ProfileHighlightsReel userId={targetUser._id} isSelf={Boolean(isOwnProfile)} />

        {/* Videos and Reposts Grid Section */}
        <div>
          {/* Tab Switcher */}
          <div className="flex items-center gap-4 border-b border-white/10 mb-4 pb-2">
            <button
              onClick={() => setActiveVideoTab('uploads')}
              className={`text-xs font-bold uppercase tracking-wider pb-1.5 transition-all flex items-center gap-2 cursor-pointer ${
                activeVideoTab === 'uploads'
                  ? 'text-cloud-white border-b-2 border-toka-flare font-black'
                  : 'text-cloud-white/40 hover:text-cloud-white/70'
              }`}
            >
              <IconVideo className="w-4 h-4" />
              <span>{isOwnProfile ? 'My Videos' : 'Videos'}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeVideoTab === 'uploads' ? 'bg-toka-flare/20 text-toka-flare' : 'bg-white/10 text-cloud-white/50'
              }`}>
                {videos.length}
              </span>
            </button>

            <button
              onClick={() => setActiveVideoTab('reposts')}
              className={`text-xs font-bold uppercase tracking-wider pb-1.5 transition-all flex items-center gap-2 cursor-pointer ${
                activeVideoTab === 'reposts'
                  ? 'text-cloud-white border-b-2 border-amber-400 font-black'
                  : 'text-cloud-white/40 hover:text-cloud-white/70'
              }`}
            >
              <IconRepeat className="w-4 h-4 text-amber-400" />
              <span>Reposts</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeVideoTab === 'reposts' ? 'bg-amber-400/20 text-amber-400' : 'bg-white/10 text-cloud-white/50'
              }`}>
                {repostVideos.length}
              </span>
            </button>
          </div>

          {activeVideoTab === 'uploads' ? (
            fetchingVideos ? (
              <div className="grid grid-cols-2 gap-3 animate-pulse">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="aspect-[9/16] bg-shaded-canopy border border-white/10 rounded-2xl"></div>
                ))}
              </div>
            ) : videos.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 bg-shaded-canopy border border-white/10 rounded-2xl gap-3">
                <span className="material-symbols-outlined text-cloud-white/20 text-[48px]">videocam_off</span>
                <p className="text-xs text-cloud-white/40">No videos uploaded yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {videos.map((video) => {
                  const isPrimaryCreator = (video.creatorId?._id || video.creatorId) === mongooseUser?._id;
                  const isCollab = video.coAuthors?.some((ca: any) => ca.status === 'accepted');
                  const creatorHandle = targetUser?.username || mongooseUser?.username || 'creator';

                  return (
                    <div 
                      key={video._id} 
                      onClick={() => router.push(`/?creator=${encodeURIComponent(creatorHandle)}&videoId=${video._id}`)}
                      className="relative aspect-[9/16] bg-shaded-canopy border border-white/10 rounded-2xl overflow-hidden group cursor-pointer active:scale-98 transition-transform"
                    >
                      {/* Collab Indicator */}
                      {isCollab && (
                        <div className="absolute top-2.5 left-2.5 z-10 bg-black/60 backdrop-blur-md border border-white/20 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                          <span className="text-[10px]">🤝</span>
                          <span className="text-[9px] font-black tracking-wider uppercase text-cloud-white">Collab</span>
                        </div>
                      )}

                      {isOwnProfile && (
                        <div className="absolute top-2.5 right-2.5 z-10 flex gap-1.5">
                          {isPrimaryCreator ? (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditCaption(video);
                                }}
                                className="w-8 h-8 rounded-full bg-black/40 hover:bg-toka-flare/80 hover:text-white flex items-center justify-center text-cloud-white/70 backdrop-blur-md active:scale-90 transition-all border border-white/10 cursor-pointer"
                                title="Edit Caption"
                              >
                                <span className="material-symbols-outlined text-[16px]">edit</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteVideo(video._id);
                                }}
                                className="w-8 h-8 rounded-full bg-black/40 hover:bg-red-500/80 hover:text-white flex items-center justify-center text-cloud-white/70 backdrop-blur-md active:scale-90 transition-all border border-white/10 cursor-pointer"
                                title="Delete Video"
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLeaveCollab(video._id);
                              }}
                              className="w-8 h-8 rounded-full bg-black/40 hover:bg-amber-500/80 hover:text-white flex items-center justify-center text-cloud-white/70 backdrop-blur-md active:scale-90 transition-all border border-white/10 cursor-pointer"
                              title="Leave Collaboration"
                            >
                              <span className="material-symbols-outlined text-[16px]">logout</span>
                            </button>
                          )}
                        </div>
                      )}
                      <video
                        src={video.videoUrl}
                        className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
                        muted
                        playsInline
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent p-3 flex flex-col justify-end">
                        <p className="text-xs font-bold text-cloud-white line-clamp-2">{video.title}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className={`text-[8px] uppercase font-bold px-1.5 py-0.5 rounded-full border ${
                            video.vettingStatus === 'approved'
                              ? 'bg-fintech-mint/20 text-fintech-mint border-fintech-mint/30'
                              : video.vettingStatus === 'rejected'
                              ? 'bg-red-500/20 text-red-400 border-red-500/30'
                              : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          }`}>
                            {video.vettingStatus.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            fetchingReposts ? (
              <div className="grid grid-cols-2 gap-3 animate-pulse">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="aspect-[9/16] bg-shaded-canopy border border-white/10 rounded-2xl"></div>
                ))}
              </div>
            ) : repostVideos.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 bg-shaded-canopy border border-white/10 rounded-2xl gap-3">
                <span className="material-symbols-outlined text-cloud-white/20 text-[48px]">repeat</span>
                <p className="text-xs text-cloud-white/40">No reposted videos yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {repostVideos.map((video) => {
                  const originalCreator = (video.creatorId as any)?.username || 'creator';

                  return (
                    <div 
                      key={video._id} 
                      onClick={() => router.push(`/?creator=${encodeURIComponent(originalCreator)}&videoId=${video._id}`)}
                      className="relative aspect-[9/16] bg-shaded-canopy border border-white/10 rounded-2xl overflow-hidden group cursor-pointer active:scale-98 transition-transform"
                    >
                      {/* Repost Indicator */}
                      <div className="absolute top-2.5 left-2.5 z-10 bg-amber-500/30 backdrop-blur-md border border-amber-400/40 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                        <span className="material-symbols-outlined text-amber-400 text-[12px]">repeat</span>
                        <span className="text-[9px] font-black tracking-wider uppercase text-amber-300">Repost</span>
                      </div>

                      <video
                        src={video.videoUrl}
                        className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
                        muted
                        playsInline
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent p-3 flex flex-col justify-end">
                        <p className="text-xs font-bold text-cloud-white line-clamp-2">{video.title}</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[9px] font-bold text-cloud-white/60">
                            @{originalCreator}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>

        {/* Followers & Following List Modal */}
        {targetUser && (
          <FollowListModal
            isOpen={isFollowModalOpen}
            onClose={() => setIsFollowModalOpen(false)}
            targetUsername={targetUser.username}
            initialTab={followModalTab}
            followersCount={followerCount}
            followingCount={targetUser.following?.length || 0}
            onFollowCountChange={() => setRefreshTrigger((prev) => prev + 1)}
          />
        )}

        {/* Profile Settings & Privacy Modal Drawer */}
        {isOwnProfile && targetUser && isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in font-sans">
            <div className="relative w-full max-w-lg max-h-[90vh] bg-shaded-canopy/95 backdrop-blur-2xl border border-white/15 rounded-3xl p-6 shadow-2xl overflow-y-auto flex flex-col gap-6 animate-scale-up select-none">
              
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-toka-flare/20 flex items-center justify-center text-toka-flare border border-toka-flare/30">
                    <span className="material-symbols-outlined text-[20px]">settings</span>
                  </div>
                  <div>
                    <h3 className="text-base font-black text-cloud-white tracking-tight">Settings &amp; Privacy</h3>
                    <p className="text-[11px] text-cloud-white/50">Manage your permissions, verification &amp; account</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-cloud-white/60 hover:text-cloud-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              {/* Section 1: Privacy & Permissions */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-toka-flare text-[18px]">lock</span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cloud-white/70">Privacy &amp; Permissions</h4>
                </div>

                {/* Tagging Permissions */}
                <div className="bg-black/30 border border-white/10 rounded-2xl p-4 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-bold text-cloud-white">Tagging &amp; Mentions</h5>
                      <p className="text-[10px] text-cloud-white/50">Control how other creators can tag you in videos</p>
                    </div>
                    {isUpdatingSettings && (
                      <span className="text-[9px] font-mono text-cloud-white/40 animate-pulse">Saving...</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 mt-1">
                    {[
                      { id: 'allow_all', label: 'Allow All' },
                      { id: 'require_approval', label: 'Review' },
                      { id: 'disabled', label: 'Off' }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleUpdateTaggingPermission(opt.id)}
                        className={`py-2 px-2 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                          taggingPermission === opt.id
                            ? 'bg-toka-flare/20 border-toka-flare text-cloud-white shadow-sm'
                            : 'bg-white/5 border-white/5 text-cloud-white/60 hover:bg-white/10'
                        }`}
                      >
                        {opt.label}
                        {taggingPermission === opt.id && (
                          <span className="material-symbols-outlined text-toka-flare text-[13px]">check</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Follow List Privacy */}
                <div className="bg-black/30 border border-white/10 rounded-2xl p-4 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-bold text-cloud-white">Followers &amp; Following List</h5>
                      <p className="text-[10px] text-cloud-white/50">Who can see your followers and following lists</p>
                    </div>
                    {isUpdatingSettings && (
                      <span className="text-[9px] font-mono text-cloud-white/40 animate-pulse">Saving...</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 mt-1">
                    {[
                      { id: 'everyone', label: 'Everyone' },
                      { id: 'followers_only', label: 'Followers' },
                      { id: 'only_me', label: 'Only Me' }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleUpdateFollowListPrivacy(opt.id)}
                        className={`py-2 px-2 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                          (targetUser.followListPrivacy || 'everyone') === opt.id
                            ? 'bg-toka-flare/20 border-toka-flare text-cloud-white shadow-sm'
                            : 'bg-white/5 border-white/5 text-cloud-white/60 hover:bg-white/10'
                        }`}
                      >
                        {opt.label}
                        {(targetUser.followListPrivacy || 'everyone') === opt.id && (
                          <span className="material-symbols-outlined text-toka-flare text-[13px]">check</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Section 2: Creator Tools & Verification */}
              {(mongooseUser?.role === 'creator' || mongooseUser?.role === 'brand') && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-fintech-mint text-[18px]">verified_user</span>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-cloud-white/70">Creator Verification &amp; Brand Safety</h4>
                  </div>

                  <div className="bg-black/30 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`material-symbols-outlined text-[24px] ${
                          targetUser.isBrandSafeVerified 
                            ? 'text-fintech-mint' 
                            : targetUser.verificationRequestStatus === 'pending'
                              ? 'text-yellow-400 animate-pulse'
                              : 'text-cloud-white/40'
                        }`}>
                          {targetUser.isBrandSafeVerified ? 'verified' : 'shield'}
                        </span>
                        <div>
                          <h5 className="text-xs font-bold text-cloud-white">
                            {targetUser.isBrandSafeVerified ? 'Brand Safe Verified' : 'Verification Status'}
                          </h5>
                          <p className="text-[10px] text-cloud-white/50 leading-relaxed">
                            {targetUser.isBrandSafeVerified 
                              ? 'Your account is verified for direct brand sponsorships.'
                              : targetUser.verificationRequestStatus === 'pending'
                                ? 'Your verification request is currently under review.'
                                : 'Apply for brand-safe verification to unlock sponsorships.'}
                          </p>
                        </div>
                      </div>

                      {!targetUser.isBrandSafeVerified && targetUser.verificationRequestStatus !== 'pending' && (
                        <button
                          disabled={verificationLoading}
                          onClick={handleRequestVerification}
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/15 border border-white/15 text-cloud-white text-[11px] font-bold rounded-xl transition-all disabled:opacity-50 shrink-0"
                        >
                          {verificationLoading ? '...' : 'Request'}
                        </button>
                      )}
                    </div>

                    {targetUser.isBrandSafeVerified && (
                      <Link
                        href="/sponsorships"
                        onClick={() => setIsSettingsOpen(false)}
                        className="w-full py-2.5 bg-fintech-mint/15 hover:bg-fintech-mint/25 border border-fintech-mint/30 text-fintech-mint text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[16px]">handshake</span>
                        Open Sponsorships Hub
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* Section 3: Account & Session */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-cloud-white/60 text-[18px]">manage_accounts</span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cloud-white/70">Account &amp; Session</h4>
                </div>

                <div className="bg-black/30 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-cloud-white">Logged in as</span>
                    <span className="text-[11px] text-cloud-white/50">{firebaseUser?.email || mongooseUser?.email}</span>
                  </div>
                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      logout();
                    }}
                    className="py-2 px-3 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">logout</span>
                    Sign Out
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}
      </main>

      {/* 24-Hour Story Viewer Modal */}
      <StatusViewerModal />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-screen items-center justify-center bg-midnight-boma text-cloud-white font-sans">
        <span className="w-10 h-10 border-4 border-toka-flare border-t-transparent rounded-full animate-spin"></span>
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
}
