"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { useLiveStore } from '@/store/useLiveStore';
import LiveStreamCard from './LiveStreamCard';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const POLL_INTERVAL = 15000;

export default function LiveDiscoveryPage() {
  const { activeLiveStreams, setActiveLiveStreams } = useLiveStore();
  const [loading, setLoading] = useState(true);

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
      <div className="flex flex-col items-center justify-center py-24 gap-4 px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-cloud-white/30 text-[40px]">live_tv</span>
        </div>
        <h2 className="text-cloud-white font-bold text-lg">No Live Streams Right Now</h2>
        <p className="text-cloud-white/50 text-sm max-w-xs">
          No creators are live at the moment. Check back soon or go live yourself!
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <h2 className="text-cloud-white font-bold text-sm">{activeLiveStreams.length} Live Now</h2>
        </div>
        <button
          onClick={fetchStreams}
          className="text-cloud-white/50 hover:text-cloud-white transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {activeLiveStreams.map((stream) => (
          <LiveStreamCard key={stream._id} stream={stream} />
        ))}
      </div>
    </div>
  );
}
