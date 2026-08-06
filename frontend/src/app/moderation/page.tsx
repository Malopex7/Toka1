"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useFeedStore } from '@/store/useFeedStore';
import VideoPlayer from '@/components/VideoPlayer';

export default function ModerationQueue() {
  const { videos, updateVideoVetting } = useFeedStore();
  
  // Find the video in queue (vettingStatus === 'human_review')
  const reviewVideo = videos.find(v => v.vettingStatus === 'human_review');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAction = (status: 'approved' | 'rejected') => {
    if (!reviewVideo) return;
    updateVideoVetting(reviewVideo.id, status);
    setSuccessMsg(`Video successfully ${status === 'approved' ? 'Approved' : 'Rejected'}.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const pendingCount = videos.filter(v => v.vettingStatus === 'human_review').length;

  return (
    <div className="bg-midnight-boma text-cloud-white min-h-screen flex flex-col antialiased font-sans">
      
      {/* Top Navbar */}
      <header className="sticky top-0 w-full border-b border-white/10 bg-shaded-canopy flex justify-between items-center px-6 h-16 z-50 select-none">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-cloud-white/70 hover:text-cloud-white transition-colors flex items-center gap-1 text-sm font-semibold">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to Feed
          </Link>
          <h1 className="text-base font-bold text-toka-flare tracking-tight border-l border-white/15 pl-4">
            Toka Moderator Queue
          </h1>
          <span className="bg-white/5 text-on-surface-variant text-xs font-mono px-2 py-1 rounded-full border border-white/10">
            {pendingCount} pending
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-cloud-white/60 hover:text-cloud-white p-2 rounded-full hover:bg-white/5 transition-all flex items-center justify-center">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className="text-cloud-white/60 hover:text-cloud-white p-2 rounded-full hover:bg-white/5 transition-all flex items-center justify-center">
            <span className="material-symbols-outlined">history</span>
          </button>
          <div className="w-8 h-8 rounded-full overflow-hidden border border-white/10">
            <img 
              alt="Moderator Profile" 
              src="/images/moderator-avatar.png"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left SideNav (Desktop) */}
        <nav className="hidden md:flex flex-col h-full py-6 px-4 gap-4 w-64 bg-midnight-boma border-r border-white/10 shrink-0 select-none">
          <div className="mb-4 px-2">
            <h2 className="text-xl font-black text-toka-flare mb-0.5">Moderator Pro</h2>
            <p className="text-[10px] font-mono font-bold tracking-wider text-cloud-white/40 uppercase">Brand Safety Tier 1</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <button className="flex items-center gap-3 px-3 py-2 text-toka-flare bg-white/5 rounded-xl font-bold text-sm text-left">
              <span className="material-symbols-outlined text-[18px]">assignment</span>
              Queue
            </button>
            <button className="flex items-center gap-3 px-3 py-2 text-cloud-white/60 hover:text-cloud-white hover:bg-white/5 rounded-xl text-sm text-left transition-all">
              <span className="material-symbols-outlined text-[18px]">monitoring</span>
              Analytics
            </button>
            <button className="flex items-center gap-3 px-3 py-2 text-cloud-white/60 hover:text-cloud-white hover:bg-white/5 rounded-xl text-sm text-left transition-all">
              <span className="material-symbols-outlined text-[18px]">policy</span>
              Policy Guidelines
            </button>
            <button className="flex items-center gap-3 px-3 py-2 text-cloud-white/60 hover:text-cloud-white hover:bg-white/5 rounded-xl text-sm text-left transition-all">
              <span className="material-symbols-outlined text-[18px]">settings</span>
              Settings
            </button>
          </div>
          <button className="mt-auto w-full border border-red-500/20 text-red-500 bg-red-500/10 hover:bg-red-500/20 py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[18px]">lock</span>
            Emergency Lock
          </button>
        </nav>

        {/* Dashboard Content split panel */}
        <main className="flex-1 flex flex-col md:flex-row overflow-hidden p-6 gap-6 relative">
          {successMsg && (
            <div className="absolute top-6 right-6 bg-fintech-mint text-midnight-boma font-bold px-6 py-4 rounded-xl shadow-2xl z-50">
              {successMsg}
            </div>
          )}

          {reviewVideo ? (
            <>
              {/* Left Pane: Video Stream & details */}
              <section className="w-full md:w-7/12 flex flex-col gap-6 overflow-y-auto pr-2">
                <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-lg shrink-0">
                  <VideoPlayer src={reviewVideo.videoUrl} isActive={true} poster={reviewVideo.poster} />
                </div>
                
                {/* Details Container */}
                <div className="bg-shaded-canopy rounded-2xl p-6 border border-white/10 flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-xl font-bold text-cloud-white mb-1">{reviewVideo.title}</h2>
                      <p className="text-sm text-cloud-white/60 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">person</span>
                        {reviewVideo.creatorName}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl font-mono text-xs text-toka-flare font-bold uppercase">
                      <span className="material-symbols-outlined text-[14px] text-toka-flare animate-pulse">visibility</span>
                      {reviewVideo.vettingStatus}
                    </div>
                  </div>
                  <div className="flex gap-6 border-t border-white/10 pt-4 text-xs font-mono text-cloud-white/50">
                    <div className="flex flex-col">
                      <span className="mb-0.5 text-[10px] uppercase text-cloud-white/40 font-bold">Upload Time</span>
                      <span className="text-cloud-white font-medium">2 mins ago</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="mb-0.5 text-[10px] uppercase text-cloud-white/40 font-bold">Confidence Score</span>
                      <span className="text-cloud-white font-medium">{reviewVideo.aiConfidenceScore}%</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="mb-0.5 text-[10px] uppercase text-cloud-white/40 font-bold">Tier Class</span>
                      <span className="text-cloud-white font-medium">brand_safe (flagged)</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Right Pane: Review Audit */}
              <section className="w-full md:w-5/12 flex flex-col h-full bg-shaded-canopy rounded-2xl border border-white/10 overflow-hidden">
                <div className="p-5 border-b border-white/10 bg-black/10 flex items-center gap-2">
                  <span className="material-symbols-outlined text-toka-flare">analytics</span>
                  <h3 className="text-sm font-bold text-cloud-white">Review Audit Dashboard</h3>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 scrollbar-thin">
                  
                  {/* AI Confidence gauge */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-cloud-white mb-0.5">AI Confidence Score</h4>
                      <p className="text-xs text-cloud-white/50">System certainty of violation flags</p>
                    </div>
                    <div className="relative w-16 h-16 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <circle className="text-white/5" cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3" />
                        <circle className="text-toka-flare" cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="82, 100" />
                      </svg>
                      <span className="absolute text-xs font-mono font-bold text-cloud-white">82%</span>
                    </div>
                  </div>
                  
                  <hr className="border-white/5" />

                  {/* AI Risk Flags */}
                  <div>
                    <h4 className="text-sm font-bold text-cloud-white mb-3">AI Risk Flags</h4>
                    <div className="flex flex-wrap gap-2.5">
                      <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/30 px-3 py-1.5 rounded-xl">
                        <span className="material-symbols-outlined text-yellow-500 text-[14px]">warning</span>
                        <span className="text-[10px] font-mono font-bold text-yellow-500 uppercase">Profanity (Medium)</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded-xl">
                        <span className="material-symbols-outlined text-red-500 text-[14px]">dangerous</span>
                        <span className="text-[10px] font-mono font-bold text-red-500 uppercase">Alcohol (High)</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl opacity-40">
                        <span className="material-symbols-outlined text-cloud-white/60 text-[14px]">check_circle</span>
                        <span className="text-[10px] font-mono font-bold text-cloud-white/60 uppercase">Violence (None)</span>
                      </div>
                    </div>
                  </div>

                  <hr className="border-white/5" />

                  {/* Speech transcript */}
                  <div className="flex flex-col min-h-[160px] flex-1">
                    <h4 className="text-sm font-bold text-cloud-white mb-2 flex justify-between">
                      Speech Transcript
                      <span className="text-[10px] font-mono text-cloud-white/40">Auto-transcribed</span>
                    </h4>
                    <div className="flex-1 bg-black/40 border border-white/10 p-4 rounded-xl font-mono text-[11px] leading-relaxed text-cloud-white/70 overflow-y-auto">
                      <p className="mb-2">{"00:00 - \"Hey guys, welcome back to another late night stream.\""}</p>
                      <p className="mb-2">{"00:08 - \"Just chilling here, mixing up some drinks for the weekend.\""}</p>
                      <p className="mb-2">{"00:15 - \"This new track is absolute "}<span className="bg-yellow-500/20 text-yellow-500 px-1 rounded font-bold border-b border-yellow-500/50">bullshit</span>{", I can't even lie.\""}</p>
                      <p className="mb-2">{"00:22 - \"Anyway, grab a "}<span className="bg-red-500/20 text-red-500 px-1 rounded font-bold border-b border-red-500/50">beer</span>{" and let's get into it.\""}</p>
                      <p className="mb-2 text-cloud-white/30">00:30 - [Music playing, unintelligible chatter]</p>
                    </div>
                  </div>

                </div>

                {/* Footer Controls */}
                <div className="p-6 border-t border-white/10 bg-black/10 flex gap-4">
                  <button 
                    onClick={() => handleAction('rejected')}
                    className="flex-1 bg-transparent border-2 border-red-500 text-red-500 hover:bg-red-500/10 py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 active:scale-95 duration-100"
                  >
                    <span className="material-symbols-outlined text-[20px]">block</span>
                    Reject Video
                  </button>
                  <button 
                    onClick={() => handleAction('approved')}
                    className="flex-1 bg-fintech-mint text-midnight-boma hover:bg-fintech-mint/90 py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.2)] active:scale-95 duration-100"
                  >
                    <span className="material-symbols-outlined text-[20px]">check</span>
                    Approve Safe
                  </button>
                </div>
              </section>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-shaded-canopy border border-white/10 rounded-2xl">
              <span className="material-symbols-outlined text-fintech-mint text-[48px] mb-4">check_circle</span>
              <h3 className="text-xl font-bold text-cloud-white mb-2">Queue is Empty!</h3>
              <p className="text-sm text-cloud-white/60">No pending videos are currently waiting for human safety review.</p>
            </div>
          )}
        </main>

      </div>

    </div>
  );
}
