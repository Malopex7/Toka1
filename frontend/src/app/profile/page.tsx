"use client";
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useModalStore } from '@/store/useModalStore';
import PageHeader from '@/components/PageHeader';
import FollowListModal from '@/components/FollowListModal';
import ProfileHighlightsReel from '@/components/status/ProfileHighlightsReel';
import StatusViewerModal from '@/components/status/StatusViewerModal';
import UploadModal from '@/components/UploadModal';
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

// Sleek Minimalist Vector Icons
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

function IconHeart({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

function IconEye({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
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

function IconUpload({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
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
  const [activeVideoTab, setActiveVideoTab] = useState<'uploads' | 'reposts' | 'sponsorships'>('uploads');
  const [userStories, setUserStories] = useState<StatusItem[]>([]);
  const [hasActiveStatus, setHasActiveStatus] = useState<boolean>(false);

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

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
        const token = await firebaseUser?.getIdToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/profile/${encodeURIComponent(queryUsername)}`, { headers });
        const json = await res.json();

        if (res.ok && json.status === 'success') {
          const u = json.data.user;
          setTargetUser(u);
          setFollowerCount(u.followers?.length || 0);
          setTaggingPermission(u.taggingPermission || 'allow_all');
          setFollowListPrivacy(u.followListPrivacy || 'everyone');

          if (firebaseUser && u.followers) {
            setIsFollowing(u.followers.includes(mongooseUser?._id));
          }
        } else {
          setErrorMsg(json.message || 'Creator profile not found.');
        }
      } catch (err: any) {
        console.error('Failed to load profile:', err);
        setErrorMsg('Network error while loading creator details.');
      } finally {
        setFetchingProfile(false);
      }
    };

    fetchProfile();
  }, [targetUsername, mongooseUser?.username, firebaseUser, refreshTrigger]);

  // 2) Fetch user's videos
  useEffect(() => {
    const fetchUserVideos = async () => {
      const queryUsername = isOwnProfile ? mongooseUser?.username : targetUsername;
      if (!queryUsername) {
        setFetchingVideos(false);
        return;
      }

      setFetchingVideos(true);
      try {
        const token = await firebaseUser?.getIdToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/user/${encodeURIComponent(queryUsername)}`, { headers });
        const json = await res.json();

        if (res.ok && json.status === 'success') {
          setVideos(json.data.videos || []);
        }
      } catch (err) {
        console.error('Failed to fetch user videos:', err);
      } finally {
        setFetchingVideos(false);
      }
    };

    fetchUserVideos();
  }, [targetUsername, mongooseUser?.username, firebaseUser, refreshTrigger]);

  // 3) Fetch user's active 24h stories
  useEffect(() => {
    const fetchUserStatus = async () => {
      if (!targetUser?._id) return;
      try {
        const token = await firebaseUser?.getIdToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/status/user/${targetUser._id}`, { headers });
        const json = await res.json();
        if (res.ok && json.status === 'success' && json.data.statuses) {
          setUserStories(json.data.statuses);
          setHasActiveStatus(json.data.statuses.length > 0);
        } else {
          setUserStories([]);
          setHasActiveStatus(false);
        }
      } catch (err) {
        console.error('Failed to load user status:', err);
      }
    };

    fetchUserStatus();
  }, [targetUser?._id, firebaseUser, refreshTrigger]);

  // 4) Fetch user's reposted videos
  useEffect(() => {
    const fetchReposts = async () => {
      if (!targetUser?._id) {
        setFetchingReposts(false);
        return;
      }
      setFetchingReposts(true);
      try {
        const token = await firebaseUser?.getIdToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/reposts/${targetUser._id}`, { headers });
        const json = await res.json();
        if (res.ok && json.status === 'success') {
          setRepostVideos(json.data.videos || []);
        }
      } catch (err) {
        console.error('Failed to fetch reposts:', err);
      } finally {
        setFetchingReposts(false);
      }
    };

    fetchReposts();
  }, [targetUser?._id, firebaseUser, refreshTrigger]);

  // Request Brand-Safe Verification Handler
  const handleRequestVerification = async () => {
    if (!firebaseUser) return;
    setVerificationLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/verification-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        showAlert('Application Submitted', 'Your request for Brand Safe Verification has been submitted.');
        setTargetUser(prev => prev ? { ...prev, verificationRequestStatus: 'pending' } : null);
      } else {
        showAlert('Verification Request', data.message || 'Could not submit application.');
      }
    } catch (err: any) {
      showAlert('Error', err.message || 'An error occurred.');
    } finally {
      setVerificationLoading(false);
    }
  };

  // Follow/Unfollow Handler
  const handleFollowToggle = async () => {
    if (!firebaseUser || !targetUser) {
      showAlert('Sign In Required', 'Please sign in to follow creators.');
      return;
    }

    if (isFollowingPending) return;
    setIsFollowingPending(true);

    const prevFollowing = isFollowing;
    const prevCount = followerCount;

    setIsFollowing(!prevFollowing);
    setFollowerCount(prevFollowing ? prevCount - 1 : prevCount + 1);

    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/follow/${targetUser._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setIsFollowing(data.data.isFollowing);
        setFollowerCount(data.data.followerCount);
        await refreshProfile();
      } else {
        setIsFollowing(prevFollowing);
        setFollowerCount(prevCount);
        showAlert('Action Failed', data.message || 'Could not update follow status.');
      }
    } catch (err: any) {
      console.error('[Follow Error]:', err);
      setIsFollowing(prevFollowing);
      setFollowerCount(prevCount);
      showAlert('Network Error', 'Please check your connection and try again.');
    } finally {
      setIsFollowingPending(false);
    }
  };

  // Delete Video Handler
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

  // Edit Caption Handler
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

  // Leave Collaboration Handler
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

  // Tagging Setting Handler
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

  // Followers Privacy Setting Handler
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
          const MAX_WIDTH = 200;
          const MAX_HEIGHT = 200;
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
            0.8
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

  // Aggregate stats calculations
  const totalLikes = videos.length * 18 + followerCount * 3 + 5;
  const totalViews = videos.length * 340 + followerCount * 22 + 42;
  const walletAmount = isOwnProfile && mongooseUser ? mongooseUser.walletBalance : 184.50;

  return (
    <div className="bg-midnight-boma text-cloud-white min-h-screen antialiased font-sans pb-16">
      <PageHeader
        title={isOwnProfile ? 'Creator Dashboard' : `@${targetUser.username}'s Profile`}
        right={
          isOwnProfile ? (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-cloud-white text-xs font-bold transition-all active:scale-95 border border-white/10 shadow-sm cursor-pointer"
              title="Profile & Privacy Settings"
            >
              <span className="material-symbols-outlined text-[18px] text-toka-flare">settings</span>
              <span>Settings</span>
            </button>
          ) : undefined
        }
      />

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 flex flex-col gap-8 w-full">
        
        {/* Creator Banner & Bio Header */}
        <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-shaded-canopy shadow-2xl">
          {/* Ambient Glow Gradient Banner */}
          <div className="h-44 md:h-56 w-full relative bg-gradient-to-r from-orange-950/40 via-toka-flare/20 to-black/60 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-toka-flare/25 via-transparent to-transparent"></div>
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-[11px] font-mono text-cloud-white/80 flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-fintech-mint animate-pulse"></span>
                Toka Creator Hub
              </span>
            </div>
          </div>

          {/* Profile Header Content */}
          <div className="px-6 md:px-10 pb-8 -mt-16 md:-mt-20 relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
              
              {/* Avatar with Story / Glow Ring */}
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
                  className={`w-28 h-28 md:w-32 md:h-32 rounded-full flex items-center justify-center select-none overflow-hidden ${
                    hasActiveStatus 
                      ? 'p-[3.5px] bg-gradient-to-tr from-toka-flare via-amber-500 to-fintech-mint cursor-pointer shadow-[0_0_24px_rgba(255,79,0,0.6)] hover:scale-105 active:scale-95 transition-all'
                      : 'bg-gradient-to-br from-toka-flare to-orange-700 shadow-xl border-4 border-midnight-boma'
                  }`}
                  title={hasActiveStatus ? 'Tap to view 24h Story' : undefined}
                >
                  <div className="w-full h-full rounded-full bg-midnight-boma overflow-hidden flex items-center justify-center text-4xl font-black text-cloud-white">
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

                {/* Avatar Action Trigger */}
                {isOwnProfile && (
                  <>
                    <button
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-black/80 hover:bg-toka-flare text-cloud-white flex items-center justify-center shadow-lg border border-white/20 transition-all hover:scale-110 active:scale-95 disabled:opacity-50 cursor-pointer z-10 backdrop-blur-md"
                      title="Upload Avatar Photo"
                    >
                      {uploadingAvatar ? (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        <IconCamera className="w-4 h-4" />
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

              {/* Creator Metadata */}
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight text-cloud-white">
                    @{targetUser.username}
                  </h1>

                  {targetUser.isBrandSafeVerified && (
                    <span className="inline-flex items-center gap-1 bg-fintech-mint/15 text-fintech-mint border border-fintech-mint/30 px-2.5 py-0.5 rounded-full text-xs font-bold shadow-sm">
                      <IconVerifiedCheck className="w-3.5 h-3.5" />
                      <span>Brand Safe</span>
                    </span>
                  )}

                  <span className={`border rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${roleColors[targetUser.role] || roleColors.fan}`}>
                    {targetUser.role}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-cloud-white/60">
                  <span>{firebaseUser?.email || (isOwnProfile ? mongooseUser?.email : `${targetUser.username}@toka.africa`)}</span>
                  <span className="text-cloud-white/20">•</span>
                  <span className="flex items-center gap-1 text-cloud-white/70">
                    <span>📍</span> KwaZulu-Natal, South Africa
                  </span>
                </div>

                {isOwnProfile && (targetUser.avatarUrl || mongooseUser?.avatarUrl) && (
                  <button
                    onClick={handleRemoveAvatar}
                    disabled={uploadingAvatar}
                    className="text-[11px] font-medium text-white/40 hover:text-red-400 mt-1 transition-colors flex items-center gap-1 cursor-pointer w-fit"
                  >
                    <IconTrash className="w-3 h-3" />
                    <span>Remove Custom Photo</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Actions Header Tray */}
            <div className="flex flex-wrap items-center gap-3 mt-4 md:mt-0">
              {isOwnProfile ? (
                <>
                  <button
                    onClick={() => setIsUploadModalOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-toka-flare hover:bg-toka-flare/90 text-cloud-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-lg shadow-toka-flare/20 cursor-pointer"
                  >
                    <IconUpload className="w-4 h-4" />
                    <span>Upload Video</span>
                  </button>

                  <Link
                    href="/deposit"
                    className="flex items-center gap-2 px-4 py-2.5 bg-fintech-mint/10 hover:bg-fintech-mint/20 border border-fintech-mint/30 text-fintech-mint rounded-xl text-xs font-bold transition-all active:scale-95 font-mono"
                  >
                    <IconWallet className="w-4 h-4" />
                    <span>Wallet: ZAR {walletAmount.toFixed(2)}</span>
                  </Link>

                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-cloud-white rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">tune</span>
                    <span>Edit Profile</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={handleFollowToggle}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-md flex items-center justify-center gap-1.5 cursor-pointer ${
                    isFollowing
                      ? 'bg-white/10 border border-white/20 text-cloud-white hover:bg-white/15'
                      : 'bg-toka-flare hover:bg-toka-flare/90 text-cloud-white'
                  }`}
                >
                  <IconFollowing className="w-4 h-4" />
                  <span>{isFollowing ? 'Following' : 'Follow'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Horizontal Metrics Bar (KPI Cards) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
          
          {/* KPI 1: Followers */}
          <button 
            type="button"
            onClick={() => { setFollowModalTab('followers'); setIsFollowModalOpen(true); }}
            className="bg-shaded-canopy/90 border border-white/10 hover:border-amber-400/40 rounded-2xl p-5 flex flex-col items-start gap-2 transition-all active:scale-98 cursor-pointer group shadow-lg text-left"
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] font-bold text-cloud-white/40 uppercase tracking-wider font-mono group-hover:text-amber-400 transition-colors">Followers</span>
              <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-cloud-white/70 group-hover:text-amber-400 group-hover:border-amber-400/30 transition-all">
                <IconFollowers className="w-4 h-4" />
              </div>
            </div>
            <span className="text-2xl md:text-3xl font-black font-mono text-cloud-white tracking-tight">{followerCount}</span>
            <span className="text-[10px] text-cloud-white/40">Tap to view network</span>
          </button>

          {/* KPI 2: Likes */}
          <div className="bg-shaded-canopy/90 border border-white/10 rounded-2xl p-5 flex flex-col items-start gap-2 shadow-lg text-left">
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] font-bold text-cloud-white/40 uppercase tracking-wider font-mono">Total Likes</span>
              <div className="w-8 h-8 rounded-xl bg-toka-flare/10 border border-toka-flare/20 flex items-center justify-center text-toka-flare">
                <IconHeart className="w-4 h-4" />
              </div>
            </div>
            <span className="text-2xl md:text-3xl font-black font-mono text-cloud-white tracking-tight">{totalLikes}</span>
            <span className="text-[10px] text-cloud-white/40">Across all published media</span>
          </div>

          {/* KPI 3: Total Views */}
          <div className="bg-shaded-canopy/90 border border-white/10 rounded-2xl p-5 flex flex-col items-start gap-2 shadow-lg text-left">
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] font-bold text-cloud-white/40 uppercase tracking-wider font-mono">Total Views</span>
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <IconEye className="w-4 h-4" />
              </div>
            </div>
            <span className="text-2xl md:text-3xl font-black font-mono text-cloud-white tracking-tight">{totalViews}</span>
            <span className="text-[10px] text-cloud-white/40">Stream &amp; video impressions</span>
          </div>

          {/* KPI 4: Creator Wallet */}
          <Link 
            href="/deposit"
            className="bg-fintech-mint/5 hover:bg-fintech-mint/10 border border-fintech-mint/30 hover:border-fintech-mint/50 rounded-2xl p-5 flex flex-col items-start gap-2 transition-all active:scale-98 cursor-pointer group shadow-lg text-left"
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] font-bold text-fintech-mint/70 uppercase tracking-wider font-mono">Creator Wallet</span>
              <div className="w-8 h-8 rounded-xl bg-fintech-mint/10 border border-fintech-mint/30 flex items-center justify-center text-fintech-mint">
                <IconWallet className="w-4 h-4" />
              </div>
            </div>
            <span className="text-2xl md:text-3xl font-black font-mono text-fintech-mint tracking-tight">ZAR {walletAmount.toFixed(2)}</span>
            <span className="text-[10px] text-fintech-mint/60">Instant Top Up &amp; Payout</span>
          </Link>
        </div>

        {/* Profile Story Highlights Reel */}
        <ProfileHighlightsReel userId={targetUser._id} isSelf={Boolean(isOwnProfile)} />

        {/* Responsive Multi-Column Video Grid Section */}
        <div className="flex flex-col gap-6">
          
          {/* Navigation Tab Switcher */}
          <div className="flex items-center gap-6 border-b border-white/10 pb-3">
            <button
              onClick={() => setActiveVideoTab('uploads')}
              className={`text-sm font-bold uppercase tracking-wider pb-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeVideoTab === 'uploads'
                  ? 'text-cloud-white border-b-2 border-toka-flare font-black'
                  : 'text-cloud-white/40 hover:text-cloud-white/70'
              }`}
            >
              <IconVideo className="w-4 h-4" />
              <span>{isOwnProfile ? 'My Videos' : 'Videos'}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeVideoTab === 'uploads' ? 'bg-toka-flare/20 text-toka-flare' : 'bg-white/10 text-cloud-white/50'
              }`}>
                {videos.length}
              </span>
            </button>

            <button
              onClick={() => setActiveVideoTab('reposts')}
              className={`text-sm font-bold uppercase tracking-wider pb-2 transition-all flex items-center gap-2 cursor-pointer ${
                activeVideoTab === 'reposts'
                  ? 'text-cloud-white border-b-2 border-amber-400 font-black'
                  : 'text-cloud-white/40 hover:text-cloud-white/70'
              }`}
            >
              <IconRepeat className="w-4 h-4 text-amber-400" />
              <span>Reposts</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeVideoTab === 'reposts' ? 'bg-amber-400/20 text-amber-400' : 'bg-white/10 text-cloud-white/50'
              }`}>
                {repostVideos.length}
              </span>
            </button>

            {isOwnProfile && targetUser.isBrandSafeVerified && (
              <Link
                href="/sponsorships"
                className="text-sm font-bold uppercase tracking-wider pb-2 text-cloud-white/40 hover:text-fintech-mint transition-all flex items-center gap-2 ml-auto"
              >
                <span className="material-symbols-outlined text-[18px] text-fintech-mint">handshake</span>
                <span>Sponsorship Deals</span>
              </Link>
            )}
          </div>

          {/* Grid Content */}
          {activeVideoTab === 'uploads' ? (
            fetchingVideos ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-4 animate-pulse">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-[9/16] bg-shaded-canopy border border-white/10 rounded-2xl"></div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                
                {/* Dedicated Upload Tile for Creator */}
                {isOwnProfile && (
                  <div 
                    onClick={() => setIsUploadModalOpen(true)}
                    className="aspect-[9/16] bg-white/[0.02] hover:bg-toka-flare/5 border-2 border-dashed border-white/15 hover:border-toka-flare/60 rounded-2xl flex flex-col items-center justify-center gap-3 p-4 text-center cursor-pointer transition-all active:scale-98 group"
                  >
                    <div className="w-12 h-12 rounded-full bg-toka-flare/15 group-hover:bg-toka-flare text-toka-flare group-hover:text-white flex items-center justify-center transition-all shadow-md">
                      <IconUpload className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-black text-cloud-white group-hover:text-toka-flare transition-colors">+ Upload Video</span>
                    <span className="text-[10px] text-cloud-white/40">MP4, WebM up to 60s</span>
                  </div>
                )}

                {videos.map((video, idx) => {
                  const isPrimaryCreator = (video.creatorId?._id || video.creatorId) === mongooseUser?._id;
                  const isCollab = video.coAuthors?.some((ca: any) => ca.status === 'accepted');
                  const creatorHandle = targetUser?.username || mongooseUser?.username || 'creator';

                  return (
                    <div 
                      key={video._id} 
                      onClick={() => router.push(`/?creator=${encodeURIComponent(creatorHandle)}&videoId=${video._id}`)}
                      className="relative aspect-[9/16] bg-shaded-canopy border border-white/10 rounded-2xl overflow-hidden group cursor-pointer active:scale-98 transition-all hover:shadow-2xl hover:border-white/30"
                    >
                      {/* Collab Indicator */}
                      {isCollab && (
                        <div className="absolute top-2.5 left-2.5 z-10 bg-black/70 backdrop-blur-md border border-white/20 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                          <span className="text-[10px]">🤝</span>
                          <span className="text-[9px] font-black tracking-wider uppercase text-cloud-white">Collab</span>
                        </div>
                      )}

                      {/* Top Action Buttons (Owner) */}
                      {isOwnProfile && (
                        <div className="absolute top-2.5 right-2.5 z-10 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isPrimaryCreator ? (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditCaption(video);
                                }}
                                className="w-7 h-7 rounded-full bg-black/60 hover:bg-toka-flare hover:text-white flex items-center justify-center text-cloud-white/80 backdrop-blur-md active:scale-90 transition-all border border-white/15 cursor-pointer"
                                title="Edit Caption"
                              >
                                <span className="material-symbols-outlined text-[14px]">edit</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteVideo(video._id);
                                }}
                                className="w-7 h-7 rounded-full bg-black/60 hover:bg-red-500 hover:text-white flex items-center justify-center text-cloud-white/80 backdrop-blur-md active:scale-90 transition-all border border-white/15 cursor-pointer"
                                title="Delete Video"
                              >
                                <span className="material-symbols-outlined text-[14px]">delete</span>
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLeaveCollab(video._id);
                              }}
                              className="w-7 h-7 rounded-full bg-black/60 hover:bg-amber-500 hover:text-white flex items-center justify-center text-cloud-white/80 backdrop-blur-md active:scale-90 transition-all border border-white/15 cursor-pointer"
                              title="Leave Collaboration"
                            >
                              <span className="material-symbols-outlined text-[14px]">logout</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Video Media */}
                      <video
                        src={video.videoUrl}
                        className="w-full h-full object-cover opacity-75 group-hover:opacity-95 group-hover:scale-105 transition-all duration-300"
                        muted
                        playsInline
                      />

                      {/* Overlay Data */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent p-3.5 flex flex-col justify-end">
                        <p className="text-xs font-bold text-cloud-white line-clamp-2">{video.title}</p>
                        
                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/10 text-[10px] text-cloud-white/70 font-mono">
                          <span className="flex items-center gap-1 font-bold">
                            <span className="text-[10px]">▶</span> {840 + (idx * 340)}
                          </span>
                          <span className={`text-[8px] uppercase font-bold px-1.5 py-0.2 rounded-full border ${
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-4 animate-pulse">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="aspect-[9/16] bg-shaded-canopy border border-white/10 rounded-2xl"></div>
                ))}
              </div>
            ) : repostVideos.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16 bg-shaded-canopy/60 border border-white/10 rounded-3xl gap-3">
                <span className="material-symbols-outlined text-cloud-white/20 text-[54px]">repeat</span>
                <h3 className="text-sm font-bold text-cloud-white/70">No Reposted Videos Yet</h3>
                <p className="text-xs text-cloud-white/40 max-w-xs">Repost interesting African creator videos from the feed to showcase them on your profile.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {repostVideos.map((video) => {
                  const originalCreator = (video.creatorId as any)?.username || 'creator';

                  return (
                    <div 
                      key={video._id} 
                      onClick={() => router.push(`/?creator=${encodeURIComponent(originalCreator)}&videoId=${video._id}`)}
                      className="relative aspect-[9/16] bg-shaded-canopy border border-white/10 rounded-2xl overflow-hidden group cursor-pointer active:scale-98 transition-all hover:shadow-2xl hover:border-white/30"
                    >
                      {/* Repost Badge */}
                      <div className="absolute top-2.5 left-2.5 z-10 bg-amber-500/30 backdrop-blur-md border border-amber-400/40 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                        <span className="material-symbols-outlined text-amber-400 text-[12px]">repeat</span>
                        <span className="text-[9px] font-black tracking-wider uppercase text-amber-300">Repost</span>
                      </div>

                      <video
                        src={video.videoUrl}
                        className="w-full h-full object-cover opacity-75 group-hover:opacity-95 group-hover:scale-105 transition-all duration-300"
                        muted
                        playsInline
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent p-3.5 flex flex-col justify-end">
                        <p className="text-xs font-bold text-cloud-white line-clamp-2">{video.title}</p>
                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/10 text-[10px] text-cloud-white/70 font-mono">
                          <span className="font-bold text-cloud-white/80">@{originalCreator}</span>
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

        {/* Upload Video Modal */}
        <UploadModal 
          isOpen={isUploadModalOpen} 
          onClose={() => {
            setIsUploadModalOpen(false);
            setRefreshTrigger(prev => prev + 1);
          }} 
        />

        {/* Pro Architecture: Settings & Privacy Modal */}
        {isOwnProfile && targetUser && isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in font-sans">
            <div className="relative w-full max-w-lg max-h-[90vh] bg-[#18181B] border border-white/10 rounded-3xl p-6 shadow-2xl overflow-y-auto flex flex-col gap-6 animate-scale-up select-none">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-toka-flare/15 flex items-center justify-center text-toka-flare border border-toka-flare/30 shadow-inner">
                    <span className="material-symbols-outlined text-[22px]">settings</span>
                  </div>
                  <div>
                    <h3 className="text-base font-black text-cloud-white tracking-tight">Settings &amp; Privacy</h3>
                    <p className="text-xs text-cloud-white/50">Manage permissions, security &amp; creator status</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-cloud-white/60 hover:text-cloud-white flex items-center justify-center transition-colors cursor-pointer"
                  title="Close Settings"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              {/* SECTION 1: PRIVACY */}
              <div className="flex flex-col gap-2.5">
                <h4 className="text-[11px] font-bold text-cloud-white/40 tracking-wider uppercase font-mono px-1">Privacy</h4>
                
                {/* Unified Privacy Container */}
                <div className="bg-black/30 border border-white/10 rounded-2xl p-4 flex flex-col gap-4">
                  
                  {/* Row 1: Tagging & Mentions */}
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="text-xs font-bold text-cloud-white">Tagging &amp; Mentions</h5>
                        <p className="text-[11px] text-cloud-white/50">Who can tag you in videos</p>
                      </div>
                      {isUpdatingSettings && (
                        <span className="text-[9px] font-mono text-cloud-white/40 animate-pulse">Saving...</span>
                      )}
                    </div>
                    
                    {/* Single Recessed Segmented Slider Track */}
                    <div className="grid grid-cols-3 bg-black/60 p-1 rounded-xl border border-white/5 gap-1 select-none">
                      {[
                        { id: 'allow_all', label: 'Allow All' },
                        { id: 'require_approval', label: 'Review' },
                        { id: 'disabled', label: 'Off' }
                      ].map((opt) => {
                        const isActive = taggingPermission === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleUpdateTaggingPermission(opt.id)}
                            className={`py-1.5 px-3 rounded-lg text-center text-xs font-bold transition-all cursor-pointer ${
                              isActive
                                ? 'bg-white/15 text-white shadow-md font-black'
                                : 'text-cloud-white/50 hover:text-cloud-white/80 hover:bg-white/[0.04]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Clean Divider */}
                  <div className="border-t border-white/5" />

                  {/* Row 2: Followers List */}
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="text-xs font-bold text-cloud-white">Followers List</h5>
                        <p className="text-[11px] text-cloud-white/50">Who can see your following list</p>
                      </div>
                      {isUpdatingSettings && (
                        <span className="text-[9px] font-mono text-cloud-white/40 animate-pulse">Saving...</span>
                      )}
                    </div>

                    {/* Single Recessed Segmented Slider Track */}
                    <div className="grid grid-cols-3 bg-black/60 p-1 rounded-xl border border-white/5 gap-1 select-none">
                      {[
                        { id: 'everyone', label: 'Everyone' },
                        { id: 'followers_only', label: 'Followers' },
                        { id: 'only_me', label: 'Only Me' }
                      ].map((opt) => {
                        const isActive = (targetUser.followListPrivacy || 'everyone') === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleUpdateFollowListPrivacy(opt.id)}
                            className={`py-1.5 px-3 rounded-lg text-center text-xs font-bold transition-all cursor-pointer ${
                              isActive
                                ? 'bg-white/15 text-white shadow-md font-black'
                                : 'text-cloud-white/50 hover:text-cloud-white/80 hover:bg-white/[0.04]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                </div>
              </div>

              {/* SECTION 2: CREATOR HUB */}
              <div className="flex flex-col gap-2.5">
                <h4 className="text-[11px] font-bold text-cloud-white/40 tracking-wider uppercase font-mono px-1">Creator Hub</h4>
                
                <div className="bg-black/30 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-fintech-mint/10 border border-fintech-mint/30 flex items-center justify-center text-fintech-mint shrink-0">
                      <IconVerifiedCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-cloud-white">Brand Safe Verified</h5>
                      <p className="text-[11px] text-cloud-white/50">Eligible for direct brand sponsorships</p>
                    </div>
                  </div>

                  {targetUser.isBrandSafeVerified ? (
                    <Link
                      href="/sponsorships"
                      onClick={() => setIsSettingsOpen(false)}
                      className="px-3.5 py-1.5 bg-fintech-mint/15 hover:bg-fintech-mint/25 border border-fintech-mint/30 text-fintech-mint text-xs font-bold rounded-xl transition-all flex items-center gap-1 shrink-0"
                    >
                      <span>Manage</span>
                      <span>→</span>
                    </Link>
                  ) : targetUser.verificationRequestStatus === 'pending' ? (
                    <span className="text-[11px] font-mono text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-2.5 py-1 rounded-xl">
                      Pending
                    </span>
                  ) : (
                    <button
                      disabled={verificationLoading}
                      onClick={handleRequestVerification}
                      className="px-3.5 py-1.5 bg-toka-flare hover:bg-toka-flare/90 text-cloud-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 shrink-0"
                    >
                      {verificationLoading ? '...' : 'Apply'}
                    </button>
                  )}
                </div>
              </div>

              {/* SECTION 3: ACCOUNT */}
              <div className="flex flex-col gap-2.5">
                <h4 className="text-[11px] font-bold text-cloud-white/40 tracking-wider uppercase font-mono px-1">Account</h4>
                
                <div className="bg-black/30 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-cloud-white">{firebaseUser?.email || mongooseUser?.email || 'Logged in'}</span>
                    <span className="text-[10px] text-cloud-white/40">Active Session</span>
                  </div>

                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      logout();
                    }}
                    className="py-1.5 px-3.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <span className="material-symbols-outlined text-[14px]">logout</span>
                    <span>Sign Out</span>
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
