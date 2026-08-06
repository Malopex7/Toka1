"use client";
import React, { useRef, useState } from 'react';
import { useFeedStore } from '@/store/useFeedStore';
import VideoPlayer from './VideoPlayer';
import TipModal from './TipModal';

export default function VideoFeed() {
  const { videos, currentIndex, setCurrentIndex } = useFeedStore();
  const [activeTipVideoId, setActiveTipVideoId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    const index = Math.round(container.scrollTop / container.clientHeight);
    if (index !== currentIndex && index >= 0 && index < videos.length) {
      setCurrentIndex(index);
    }
  };

  return (
    <div className="relative w-full h-screen bg-midnight-boma text-cloud-white overflow-hidden flex font-sans">
      
      {/* Desktop Navigation Left Sidebar (Hidden on Mobile) */}
      <aside className="hidden md:flex flex-col h-full w-64 bg-shaded-canopy border-r border-white/10 py-6 px-4 shrink-0 select-none">
        <div className="text-3xl font-black text-toka-flare tracking-tighter mb-12 px-4">Toka</div>
        <div className="flex flex-col gap-2">
          <button className="flex items-center gap-4 px-4 py-3 bg-white/10 rounded-xl text-cloud-white font-bold transition-all text-left">
            <span className="material-symbols-outlined text-toka-flare">home</span>
            Home
          </button>
          <button className="flex items-center gap-4 px-4 py-3 rounded-xl text-cloud-white/70 hover:bg-white/5 hover:text-cloud-white transition-all text-left">
            <span className="material-symbols-outlined">explore</span>
            Discover
          </button>
          <button className="flex items-center gap-4 px-4 py-3 rounded-xl text-cloud-white/70 hover:bg-white/5 hover:text-cloud-white transition-all text-left relative">
            <span className="material-symbols-outlined">mail</span>
            Inbox
            <span className="absolute top-4 right-4 w-2 h-2 bg-toka-flare rounded-full"></span>
          </button>
          <button className="flex items-center gap-4 px-4 py-3 rounded-xl text-cloud-white/70 hover:bg-white/5 hover:text-cloud-white transition-all text-left">
            <span className="material-symbols-outlined">person</span>
            Profile
          </button>
        </div>
        
        <div className="mt-auto">
          <a 
            href="/moderation" 
            className="w-full py-3 bg-shaded-canopy border border-white/10 text-cloud-white/70 rounded-xl font-bold hover:bg-white/5 transition-all flex justify-center items-center gap-2 mb-4 text-sm"
          >
            <span className="material-symbols-outlined text-toka-flare text-[20px]">shield</span>
            Moderator Panel
          </a>
          <button className="w-full py-3 bg-toka-flare text-cloud-white rounded-xl font-bold hover:bg-toka-flare/90 transition-all shadow-lg flex justify-center items-center gap-2 text-sm">
            <span className="material-symbols-outlined text-[20px]">add</span>
            Create
          </button>
        </div>
      </aside>

      {/* Main Feed Container */}
      <div className="flex-1 flex justify-center items-center h-full relative">
        
        {/* Mobile Viewport Wrapper */}
        <div className="relative w-full max-w-[450px] md:max-w-[400px] h-full md:h-[92vh] md:rounded-[36px] md:border-8 md:border-neutral-800 overflow-hidden shadow-2xl bg-black">
          
          {/* Top Translucent Navigation Bar Overlay */}
          <header className="absolute top-0 left-0 w-full z-40 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-center px-6 h-16 pointer-events-none">
            <button className="pointer-events-auto flex items-center justify-center p-2 rounded-full hover:bg-white/10 transition-colors">
              <span className="material-symbols-outlined text-cloud-white">search</span>
            </button>
            <div className="pointer-events-auto flex gap-6 items-center">
              <button className="text-cloud-white/60 font-semibold hover:text-cloud-white transition-colors text-sm">Following</button>
              <button className="text-cloud-white font-bold border-b-2 border-toka-flare pb-1 text-sm">For You</button>
            </div>
            <div className="pointer-events-auto flex items-center gap-3">
              <button className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 active:scale-95 transition-all">
                <span className="material-symbols-outlined text-cloud-white text-[20px]">person</span>
              </button>
              <button className="px-3 py-1.5 rounded-full border border-white/20 bg-white/5 flex items-center gap-1.5 hover:bg-white/10 active:scale-95 transition-all text-xs font-semibold text-cloud-white">
                <span className="material-symbols-outlined text-cloud-white text-[16px]">notifications</span>
                <span>Follow</span>
              </button>
            </div>
          </header>

          {/* Snapping Scroll Container */}
          <div 
            ref={containerRef}
            onScroll={handleScroll}
            className="w-full h-full overflow-y-scroll snap-y snap-mandatory no-scrollbar bg-black"
            style={{ scrollBehavior: 'smooth' }}
          >
            {videos.map((video, index) => {
              const isActive = index === currentIndex;
              return (
                <div 
                  key={video.id}
                  className="relative w-full h-full snap-start shrink-0 z-0 bg-black flex flex-col justify-end"
                >
                  <VideoPlayer src={video.videoUrl} isActive={isActive} poster={video.poster} />

                  {/* Right Action Sidebar Overlay */}
                  <aside className="absolute right-4 bottom-24 z-30 flex flex-col gap-5 items-center pointer-events-auto">
                    
                    {/* Creator Avatar & Follow Button */}
                    <div className="relative mb-3 group cursor-pointer select-none">
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-cloud-white p-[1px] shadow-lg">
                        <img 
                          src={video.creatorAvatar} 
                          alt={video.creatorName}
                          className="w-full h-full object-cover rounded-full bg-shaded-canopy"
                        />
                      </div>
                      <button className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-toka-flare text-cloud-white rounded-full w-5 h-5 flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all border border-black">
                        <span className="material-symbols-outlined text-[14px] font-bold">add</span>
                      </button>
                    </div>

                    {/* Like Action */}
                    <button className="flex flex-col items-center gap-1 group active:scale-90 transition-transform select-none">
                      <div className="w-11 h-11 rounded-full bg-shaded-canopy/40 backdrop-blur-md flex items-center justify-center border border-white/10 group-hover:bg-white/20 transition-all">
                        <span className="material-symbols-outlined text-cloud-white text-[24px]">favorite</span>
                      </div>
                      <span className="font-mono text-xs font-medium text-cloud-white drop-shadow-md">{video.likes}</span>
                    </button>

                    {/* Tip Action (Prominent Toka Flare) */}
                    <button 
                      onClick={() => setActiveTipVideoId(video.id)}
                      className="flex flex-col items-center gap-1 group active:scale-90 transition-transform select-none"
                    >
                      <div className="w-12 h-12 rounded-full bg-toka-flare flex items-center justify-center shadow-[0_0_15px_rgba(255,79,0,0.5)] hover:scale-105 transition-all">
                        <span className="material-symbols-outlined text-cloud-white text-[28px]">payments</span>
                      </div>
                      <span className="font-mono text-[10px] font-bold text-toka-flare drop-shadow-md uppercase tracking-wider">Tip ZAR</span>
                    </button>

                    {/* Share Action */}
                    <button className="flex flex-col items-center gap-1 group active:scale-90 transition-transform select-none">
                      <div className="w-11 h-11 rounded-full bg-shaded-canopy/40 backdrop-blur-md flex items-center justify-center border border-white/10 group-hover:bg-white/20 transition-all">
                        <span className="material-symbols-outlined text-cloud-white text-[24px]">share</span>
                      </div>
                      <span className="font-mono text-xs font-medium text-cloud-white drop-shadow-md">{video.shares}</span>
                    </button>

                    {/* More Action */}
                    <button className="flex flex-col items-center gap-1 mt-1 group active:scale-90 transition-transform select-none">
                      <div className="w-9 h-9 rounded-full bg-shaded-canopy/60 backdrop-blur-md flex items-center justify-center border border-white/10 group-hover:bg-white/20 transition-all">
                        <span className="material-symbols-outlined text-cloud-white text-[20px]">more_horiz</span>
                      </div>
                    </button>

                    {/* Vinyl Audio Disk */}
                    {video.audioArt && (
                      <div className="w-10 h-10 rounded-full border border-white/20 p-1 mt-2 animate-[spin_6s_linear_infinite] overflow-hidden bg-black shadow-lg">
                        <img 
                          src={video.audioArt} 
                          alt="Audio art" 
                          className="w-full h-full rounded-full object-cover"
                        />
                      </div>
                    )}
                  </aside>

                  {/* Bottom Left Info Overlay */}
                  <div className="absolute bottom-24 left-4 right-16 z-30 flex flex-col gap-2 pointer-events-auto select-none">
                    
                    {/* Brand Safe Badge */}
                    {video.vettingStatus === 'approved' && (
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-fintech-mint/10 border border-fintech-mint/30 w-fit backdrop-blur-sm shadow-sm">
                        <span className="material-symbols-outlined text-fintech-mint text-[14px]">verified_user</span>
                        <span className="font-mono text-[9px] uppercase font-bold tracking-wider text-fintech-mint">Brand Safe</span>
                      </div>
                    )}

                    {/* Username & Verification */}
                    <div className="flex items-center gap-1.5">
                      <h2 className="font-bold text-base text-cloud-white drop-shadow-md">{video.creatorName}</h2>
                      {video.isVerified && (
                        <span className="material-symbols-outlined text-toka-flare text-[18px]">verified</span>
                      )}
                    </div>

                    {/* Description Caption */}
                    <p className="text-sm text-cloud-white/90 drop-shadow-md leading-snug line-clamp-2">
                      {video.description}
                    </p>

                    {/* Audio track info with marquee effect */}
                    {video.audioName && (
                      <div className="flex items-center gap-1.5 mt-1 text-cloud-white/80 w-[200px] overflow-hidden select-none shrink-0">
                        <span className="material-symbols-outlined text-toka-flare text-[16px] animate-pulse shrink-0">music_note</span>
                        <div className="overflow-hidden w-full relative h-4 flex items-center">
                          <div className="animate-marquee gap-8">
                            <span>{video.audioName}</span>
                            <span>{video.audioName}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile Bottom Navigation Bar */}
          <nav className="absolute bottom-0 left-0 w-full z-40 bg-midnight-boma/95 backdrop-blur-xl border-t border-white/10 flex justify-around items-center pt-2 pb-6 px-4">
            <button className="flex flex-col items-center justify-center text-toka-flare scale-105 transition-all w-14 select-none">
              <span className="material-symbols-outlined">home</span>
              <span className="text-[10px] font-medium font-mono">Home</span>
            </button>
            <button className="flex flex-col items-center justify-center text-cloud-white/60 hover:text-cloud-white transition-all w-14 select-none">
              <span className="material-symbols-outlined">explore</span>
              <span className="text-[10px] font-mono">Discover</span>
            </button>
            <button className="flex flex-col items-center justify-center -mt-6 relative z-10 w-12 h-12 bg-cloud-white rounded-xl shadow-lg border-2 border-midnight-boma flex items-center justify-center active:scale-95 transition-all select-none">
              <span className="material-symbols-outlined text-midnight-boma font-bold text-[24px]">add</span>
            </button>
            <button className="flex flex-col items-center justify-center text-cloud-white/60 hover:text-cloud-white transition-all w-14 relative select-none">
              <span className="material-symbols-outlined">mail</span>
              <span className="text-[10px] font-mono">Inbox</span>
              <span className="absolute top-0 right-3.5 w-2 h-2 bg-toka-flare rounded-full"></span>
            </button>
            <a href="/moderation" className="flex flex-col items-center justify-center text-cloud-white/60 hover:text-cloud-white transition-all w-14 select-none">
              <span className="material-symbols-outlined">person</span>
              <span className="text-[10px] font-mono">Profile</span>
            </a>
          </nav>

        </div>
      </div>

      {/* Tip Popover Modal */}
      {activeTipVideoId && (
        <TipModal 
          videoId={activeTipVideoId}
          isOpen={true}
          onClose={() => setActiveTipVideoId(null)}
        />
      )}

    </div>
  );
}
