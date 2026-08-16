"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { useLiveStore } from '@/store/useLiveStore';
import { useAuth } from '@/context/AuthContext';
import LiveStreamCard from './LiveStreamCard';
import AuthModal from '@/components/AuthModal';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const POLL_INTERVAL = 15000;

export default function LiveDiscoveryPage() {
  const { activeLiveStreams, setActiveLiveStreams, openGoLive } = useLiveStore();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(activeLiveStreams.length === 0);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const fetchStreams = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/live/active`);
      const data = await res.json();
      if (data.status === 'success') setActiveLiveStreams(data.data.streams);
    } catch (err) {
      console.error('[LiveDiscovery] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [setActiveLiveStreams]);

  useEffect(() => {
    fetchStreams();
    const interval = setInterval(fetchStreams, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStreams]);

  const handleGoLiveClick = () => {
    if (!isAuthenticated) {
      setIsAuthModalOpen(true);
    } else {
      openGoLive();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <p className="text-cloud-white/50 text-sm">Finding live streams...</p>
        </div>
      </div>
    );
  }

  if (activeLiveStreams.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-24 gap-5 px-6 text-center">
          <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center animate-pulse">
            <span className="material-symbols-outlined text-red-500 text-[40px]">live_tv</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-cloud-white font-bold text-lg">No Live Streams Right Now</h2>
            <p className="text-cloud-white/50 text-sm max-w-xs">
              No creators are live at the moment. Be the first to start a broadcast!
            </p>
          </div>
          <button
            onClick={handleGoLiveClick}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-xl shadow-red-600/30 active:scale-95 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">videocam</span>
            <span>Go Live Now</span>
          </button>
        </div>

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <div className="px-4 py-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <h2 className="text-cloud-white font-bold text-base md:text-lg">
              {activeLiveStreams.length} Live Now
            </h2>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleGoLiveClick}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/30 active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">videocam</span>
              <span>Go Live</span>
            </button>
            <button
              onClick={fetchStreams}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-cloud-white/60 hover:text-cloud-white transition-colors"
              title="Refresh"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {activeLiveStreams.map((stream) => (
            <LiveStreamCard key={stream._id} stream={stream} />
          ))}
        </div>
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </>
  );
}
