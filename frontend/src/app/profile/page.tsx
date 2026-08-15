"use client";
import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useModalStore } from '@/store/useModalStore';

interface ProfileVideo {
  _id: string;
  title: string;
  videoUrl: string;
  vettingStatus: string;
  aiConfidenceScore: number;
  tips: number;
  createdAt: string;
}

interface TargetUser {
  _id: string;
  username: string;
  role: string;
  followers?: string[];
  following?: string[];
  isBrandSafeVerified?: boolean;
  verificationRequestStatus?: string;
}

function ProfileContent() {
  const { mongooseUser, isAuthenticated, firebaseUser, isLoading, logout, refreshProfile } = useAuth();
  const { showAlert, showConfirm, showPrompt } = useModalStore();
  const searchParams = useSearchParams();
  const targetUsername = searchParams?.get('username') || '';

  const [targetUser, setTargetUser] = useState<TargetUser | null>(null);
  const [videos, setVideos] = useState<ProfileVideo[]>([]);
  const [fetchingProfile, setFetchingProfile] = useState(true);
  const [fetchingVideos, setFetchingVideos] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  // Video playback overlay modal
  const [selectedVideo, setSelectedVideo] = useState<ProfileVideo | null>(null);

  // Verification request state
  const [verificationLoading, setVerificationLoading] = useState(false);

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
        if (data.status === 'success' && data.data.user) {
          const user = data.data.user;
          setTargetUser(user);
          setFollowerCount(user.followers?.length || 0);
          
          // Check if currently following
          if (mongooseUser) {
            setIsFollowing(mongooseUser.following?.includes(user._id) || false);
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
  }, [targetUsername, isOwnProfile, mongooseUser]);

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
          const userVideos = data.data.videos.filter(
            (v: any) => (v.creatorId?._id || v.creatorId) === targetUser._id
          );
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

  // 3) Follow/Unfollow Handler
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
            onClick={logout}
            className="text-xs font-bold text-red-500 hover:text-red-400 flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            Sign Out
          </button>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Profile Card */}
        <div className="bg-shaded-canopy border border-white/10 rounded-3xl p-6 flex flex-col items-center gap-4 text-center shadow-xl">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-toka-flare to-orange-700 flex items-center justify-center shadow-lg text-3xl font-black text-cloud-white select-none">
            {targetUser.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center justify-center gap-1.5">
              <h2 className="text-xl font-black tracking-tight text-cloud-white">@{targetUser.username}</h2>
              {targetUser.isBrandSafeVerified && (
                <span className="material-symbols-outlined text-fintech-mint text-[20px] select-none" title="Brand-Safe Verified Profile">verified</span>
              )}
            </div>
            {isOwnProfile && mongooseUser && (
              <p className="text-xs text-cloud-white/50 mt-0.5">{mongooseUser.email}</p>
            )}
          </div>
          <span className={`border rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${roleColors[targetUser.role] || roleColors.fan}`}>
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
              <span className="material-symbols-outlined text-[16px]">{isFollowing ? 'person_remove' : 'person_add'}</span>
              {isFollowing ? 'Unfollow' : 'Follow'}
            </button>
          )}
        </div>

        {/* Brand Safety Verification Banner */}
        {isOwnProfile && targetUser && (mongooseUser?.role === 'creator' || mongooseUser?.role === 'brand') && (
          <div className="w-full bg-shaded-canopy border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3 shadow-lg select-none">
            <div className="flex items-center gap-3">
              <span className={`material-symbols-outlined text-[28px] ${
                targetUser.isBrandSafeVerified 
                  ? 'text-fintech-mint' 
                  : targetUser.verificationRequestStatus === 'pending'
                    ? 'text-yellow-400 animate-pulse'
                    : targetUser.verificationRequestStatus === 'rejected'
                      ? 'text-red-400'
                      : 'text-cloud-white/40'
              }`}>
                {targetUser.isBrandSafeVerified 
                  ? 'verified' 
                  : targetUser.verificationRequestStatus === 'pending'
                    ? 'schedule'
                    : targetUser.verificationRequestStatus === 'rejected'
                      ? 'error'
                      : 'shield'
              }
              </span>
              <div className="text-left">
                <h4 className="text-xs font-bold text-cloud-white">Brand Safety Status</h4>
                <p className="text-[10px] text-cloud-white/50 mt-0.5 leading-relaxed">
                  {targetUser.isBrandSafeVerified 
                    ? 'Your profile is brand-safe verified. You can now request & fund sponsorships.'
                    : targetUser.verificationRequestStatus === 'pending'
                      ? 'Safety review request is pending moderator approval.'
                      : targetUser.verificationRequestStatus === 'rejected'
                        ? 'Your request was declined. You can resubmit for review.'
                        : 'Request verification to unlock direct sponsorships.'
                  }
                </p>
              </div>
            </div>
            
            {!targetUser.isBrandSafeVerified && targetUser.verificationRequestStatus !== 'pending' && (
              <button
                disabled={verificationLoading}
                onClick={handleRequestVerification}
                className="w-full sm:w-auto px-4 py-2.5 bg-white/10 hover:bg-white/15 border border-white/15 text-cloud-white text-[11px] font-bold rounded-xl active:scale-95 transition-all disabled:opacity-50 shrink-0"
              >
                {verificationLoading ? 'Submitting...' : 'Request Verify'}
              </button>
            )}

            {targetUser.isBrandSafeVerified && isOwnProfile && (
              <Link
                href="/sponsorships"
                className="w-full sm:w-auto px-4 py-2.5 bg-fintech-mint/20 hover:bg-fintech-mint/30 border border-fintech-mint/40 text-fintech-mint text-[11px] font-bold rounded-xl active:scale-95 transition-all shrink-0 flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-[15px]">handshake</span>
                Manage Sponsorships
              </Link>
            )}
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-shaded-canopy border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-1">
            <span className="material-symbols-outlined text-toka-flare text-[24px]">videocam</span>
            <span className="text-xl font-black font-mono">{videos.length}</span>
            <span className="text-[9px] text-cloud-white/40 uppercase font-bold tracking-wider">Videos</span>
          </div>
          <div className="bg-shaded-canopy border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-1">
            <span className="material-symbols-outlined text-amber-400 text-[24px]">group</span>
            <span className="text-xl font-black font-mono">{followerCount}</span>
            <span className="text-[9px] text-cloud-white/40 uppercase font-bold tracking-wider">Followers</span>
          </div>
          {isOwnProfile && mongooseUser ? (
            <div className="bg-shaded-canopy border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-1">
              <span className="material-symbols-outlined text-fintech-mint text-[24px]">account_balance_wallet</span>
              <span className="text-xl font-black font-mono">R {mongooseUser.walletBalance.toFixed(2)}</span>
              <span className="text-[9px] text-cloud-white/40 uppercase font-bold tracking-wider">Balance</span>
            </div>
          ) : (
            <div className="bg-shaded-canopy border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-1">
              <span className="material-symbols-outlined text-blue-400 text-[24px]">person_check</span>
              <span className="text-xl font-black font-mono">{targetUser.following?.length || 0}</span>
              <span className="text-[9px] text-cloud-white/40 uppercase font-bold tracking-wider">Following</span>
            </div>
          )}
        </div>

        {/* Own Profile Quick Actions */}
        {isOwnProfile && (
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/deposit"
              className="flex items-center justify-center gap-2 bg-toka-flare hover:bg-toka-flare/90 text-cloud-white rounded-2xl py-3.5 text-xs font-bold transition-all active:scale-95 shadow-lg"
            >
              <span className="material-symbols-outlined text-[18px]">add_card</span>
              Top Up Wallet
            </Link>
            <Link
              href="/inbox"
              className="flex items-center justify-center gap-2 bg-shaded-canopy hover:bg-white/10 border border-white/15 text-cloud-white rounded-2xl py-3.5 text-xs font-bold transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">inbox</span>
              View Inbox
            </Link>
          </div>
        )}

        {/* Videos Grid */}
        <div>
          <h3 className="text-sm font-bold text-cloud-white/60 uppercase tracking-wider mb-4">
            {isOwnProfile ? 'My Videos' : 'Uploaded Videos'}
          </h3>
          {fetchingVideos ? (
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
              {videos.map((video) => (
                <div 
                  key={video._id} 
                  onClick={() => setSelectedVideo(video)}
                  className="relative aspect-[9/16] bg-shaded-canopy border border-white/10 rounded-2xl overflow-hidden group cursor-pointer active:scale-98 transition-transform"
                >
                  {isOwnProfile && (
                    <div className="absolute top-2.5 right-2.5 z-10 flex gap-1.5">
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
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Video Streaming Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="relative w-full max-w-sm aspect-[9/16] bg-black rounded-3xl overflow-hidden shadow-2xl border border-white/10">
             {/* Edit/Delete Buttons for own video */}
            {isOwnProfile && (
              <div className="absolute top-4 left-4 z-50 flex gap-2">
                <button
                  onClick={() => {
                    handleEditCaption(selectedVideo);
                    setSelectedVideo(null);
                  }}
                  className="w-8 h-8 rounded-full bg-black/50 hover:bg-toka-flare/80 flex items-center justify-center border border-white/15 text-cloud-white active:scale-90 transition-all cursor-pointer"
                  title="Edit Caption"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
                <button
                  onClick={() => {
                    handleDeleteVideo(selectedVideo._id);
                    setSelectedVideo(null);
                  }}
                  className="w-8 h-8 rounded-full bg-black/50 hover:bg-red-500/80 flex items-center justify-center border border-white/15 text-cloud-white active:scale-90 transition-all cursor-pointer"
                  title="Delete Video"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            )}
            {/* Close Button */}
            <button
              onClick={() => setSelectedVideo(null)}
              className="absolute top-4 right-4 z-50 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 flex items-center justify-center border border-white/15 text-cloud-white active:scale-90 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
            <video
              src={selectedVideo.videoUrl}
              className="w-full h-full object-cover"
              controls
              autoPlay
              playsInline
            />
            {/* Title Overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent pt-12 text-cloud-white pointer-events-none select-none">
              <h4 className="text-sm font-bold">{selectedVideo.title}</h4>
              <p className="text-[10px] text-cloud-white/60 mt-1">
                Uploaded: {new Date(selectedVideo.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      )}
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
