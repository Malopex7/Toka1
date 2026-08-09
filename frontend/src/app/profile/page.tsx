"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

interface ProfileVideo {
  _id: string;
  title: string;
  videoUrl: string;
  vettingStatus: string;
  aiConfidenceScore: number;
  tips: number;
  createdAt: string;
}

export default function ProfilePage() {
  const { mongooseUser, isAuthenticated, firebaseUser, isLoading, logout } = useAuth();
  const [videos, setVideos] = useState<ProfileVideo[]>([]);
  const [fetching, setFetching] = useState(true);
  const [stats, setStats] = useState({ totalTips: 0, totalEarned: 0, videoCount: 0 });

  useEffect(() => {
    if (!isAuthenticated || !firebaseUser || !mongooseUser) return;

    const fetchMyVideos = async () => {
      setFetching(true);
      try {
        const token = await firebaseUser.getIdToken();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/feed?limit=20`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.status === 'success') {
          const myVideos = data.data.videos.filter(
            (v: any) => (v.creatorId?._id || v.creatorId) === mongooseUser._id
          );
          setVideos(myVideos);
          setStats({
            totalTips: myVideos.reduce((acc: number, v: any) => acc + (v.tips || 0), 0),
            totalEarned: 0,
            videoCount: myVideos.length
          });
        }
      } catch (e) {
        console.error('Error fetching profile videos:', e);
      } finally {
        setFetching(false);
      }
    };

    fetchMyVideos();
  }, [isAuthenticated, firebaseUser, mongooseUser]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-midnight-boma text-cloud-white font-sans">
        <span className="w-10 h-10 border-4 border-toka-flare border-t-transparent rounded-full animate-spin"></span>
      </div>
    );
  }

  if (!isAuthenticated || !mongooseUser) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-midnight-boma text-cloud-white gap-4 font-sans px-6 text-center select-none">
        <span className="material-symbols-outlined text-[64px] text-red-500 animate-pulse">lock</span>
        <h1 className="text-2xl font-black tracking-tight">Access Restricted</h1>
        <p className="text-sm text-cloud-white/60 max-w-sm">Please sign in to view your profile.</p>
        <Link href="/" className="px-6 py-3 bg-toka-flare hover:bg-toka-flare/90 rounded-xl font-bold transition-all text-xs active:scale-95 shadow-lg">
          Return to Homepage
        </Link>
      </div>
    );
  }

  const roleColors: Record<string, string> = {
    creator: 'bg-toka-flare/20 text-toka-flare border-toka-flare/30',
    fan: 'bg-fintech-mint/10 text-fintech-mint border-fintech-mint/30',
    brand: 'bg-blue-500/10 text-blue-400 border-blue-400/30',
    moderator: 'bg-purple-500/10 text-purple-400 border-purple-400/30'
  };

  return (
    <div className="bg-midnight-boma text-cloud-white min-h-screen antialiased font-sans">

      {/* Header */}
      <header className="sticky top-0 w-full border-b border-white/10 bg-shaded-canopy flex justify-between items-center px-6 h-16 z-50 select-none">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-cloud-white/70 hover:text-cloud-white transition-colors flex items-center gap-1 text-sm font-semibold">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back
          </Link>
          <h1 className="text-base font-bold text-toka-flare tracking-tight border-l border-white/15 pl-4">My Profile</h1>
        </div>
        <button
          onClick={logout}
          className="text-xs font-bold text-red-500 hover:text-red-400 flex items-center gap-1.5 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">logout</span>
          Sign Out
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">

        {/* Profile Card */}
        <div className="bg-shaded-canopy border border-white/10 rounded-3xl p-6 flex flex-col items-center gap-4 text-center shadow-xl">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-toka-flare to-orange-700 flex items-center justify-center shadow-lg text-3xl font-black text-cloud-white select-none">
            {mongooseUser.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-cloud-white">@{mongooseUser.username}</h2>
            <p className="text-xs text-cloud-white/50 mt-0.5">{mongooseUser.email}</p>
          </div>
          <span className={`border rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${roleColors[mongooseUser.role] || roleColors.fan}`}>
            {mongooseUser.role}
          </span>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-shaded-canopy border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-1">
            <span className="material-symbols-outlined text-toka-flare text-[24px]">videocam</span>
            <span className="text-xl font-black font-mono">{stats.videoCount}</span>
            <span className="text-[9px] text-cloud-white/40 uppercase font-bold tracking-wider">Videos</span>
          </div>
          <div className="bg-shaded-canopy border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-1">
            <span className="material-symbols-outlined text-fintech-mint text-[24px]">account_balance_wallet</span>
            <span className="text-xl font-black font-mono">R{mongooseUser.walletBalance.toFixed(0)}</span>
            <span className="text-[9px] text-cloud-white/40 uppercase font-bold tracking-wider">Balance</span>
          </div>
          <div className="bg-shaded-canopy border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-1">
            <span className="material-symbols-outlined text-amber-400 text-[24px]">group</span>
            <span className="text-xl font-black font-mono">{mongooseUser.followers?.length ?? 0}</span>
            <span className="text-[9px] text-cloud-white/40 uppercase font-bold tracking-wider">Followers</span>
          </div>
        </div>

        {/* Quick Actions */}
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

        {/* My Videos Grid */}
        <div>
          <h3 className="text-sm font-bold text-cloud-white/60 uppercase tracking-wider mb-4">My Videos</h3>
          {fetching ? (
            <div className="grid grid-cols-2 gap-3 animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-[9/16] bg-shaded-canopy border border-white/10 rounded-2xl"></div>
              ))}
            </div>
          ) : videos.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12 bg-shaded-canopy border border-white/10 rounded-2xl gap-3">
              <span className="material-symbols-outlined text-cloud-white/20 text-[48px]">videocam_off</span>
              <p className="text-xs text-cloud-white/40">No videos uploaded yet. Start creating!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {videos.map((video) => (
                <div key={video._id} className="relative aspect-[9/16] bg-shaded-canopy border border-white/10 rounded-2xl overflow-hidden group cursor-pointer">
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
    </div>
  );
}
