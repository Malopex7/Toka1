"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import VideoPlayer from '@/components/VideoPlayer';

export default function ModerationQueue() {
  const { mongooseUser, isAuthenticated, firebaseUser, isLoading: isAuthLoading } = useAuth();
  
  const [pendingVideos, setPendingVideos] = useState<any[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<any | null>(null);
  const [isFetchingQueue, setIsFetchingQueue] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch pending moderation queue from the backend
  const fetchQueue = async () => {
    if (!firebaseUser) return;
    setIsFetchingQueue(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/feed?vettingStatus=human_review`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.status === 'success') {
        setPendingVideos(data.data.videos);
        // Automatically select first item if none is selected
        if (data.data.videos.length > 0 && !selectedVideo) {
          setSelectedVideo(data.data.videos[0]);
        }
      }
    } catch (err) {
      console.error('Error loading moderation queue:', err);
    } finally {
      setIsFetchingQueue(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && mongooseUser?.role === 'moderator') {
      fetchQueue();
    }
  }, [isAuthenticated, mongooseUser]);

  const handleAction = async (status: 'approved' | 'rejected') => {
    if (!selectedVideo || !firebaseUser) return;
    setActionLoading(true);

    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/${selectedVideo._id}/vetting-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ vettingStatus: status })
      });

      const data = await res.json();
      if (data.status === 'success') {
        setSuccessMsg(`Video successfully ${status === 'approved' ? 'Approved' : 'Rejected'}.`);
        
        // Remove processed video from the queue list locally
        const updatedQueue = pendingVideos.filter(v => v._id !== selectedVideo._id);
        setPendingVideos(updatedQueue);
        
        // Auto-select the next item in the queue or null
        if (updatedQueue.length > 0) {
          setSelectedVideo(updatedQueue[0]);
        } else {
          setSelectedVideo(null);
        }

        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        alert(data.message || 'Action failed.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Failed to update video vetting status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Auth Loading state
  if (isAuthLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-midnight-boma text-cloud-white font-sans">
        <span className="w-10 h-10 border-4 border-toka-flare border-t-transparent rounded-full animate-spin"></span>
      </div>
    );
  }

  // Route security gate: check if authenticated and has moderator role
  if (!isAuthenticated || mongooseUser?.role !== 'moderator') {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-midnight-boma text-cloud-white gap-4 font-sans px-6 text-center select-none">
        <span className="material-symbols-outlined text-[64px] text-red-500 animate-pulse">lock</span>
        <h1 className="text-2xl font-black tracking-tight">Restricted Moderator Area</h1>
        <p className="text-sm text-cloud-white/60 max-w-sm">This route is restricted. Please sign in with an authorized Moderator profile to access the Human-in-the-Loop moderation queue.</p>
        <Link href="/" className="px-6 py-3 bg-toka-flare hover:bg-toka-flare/90 rounded-xl font-bold transition-all text-xs active:scale-95 shadow-lg">
          Return to Homepage
        </Link>
      </div>
    );
  }

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
            Toka Human-in-the-Loop Portal
          </h1>
          <span className="bg-white/5 text-on-surface-variant text-xs font-mono px-2.5 py-1 rounded-full border border-white/10">
            {pendingVideos.length} pending
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-cloud-white/60">@{mongooseUser.username}</span>
          <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20 flex items-center justify-center bg-white/10">
            <span className="material-symbols-outlined text-cloud-white text-[18px]">shield</span>
          </div>
        </div>
      </header>

      {/* Workspace */}
      <div className="flex-1 flex flex-col overflow-y-auto p-6 gap-6 max-w-7xl w-full mx-auto">
        
        {successMsg && (
          <div className="bg-fintech-mint/15 border border-fintech-mint/30 text-fintech-mint font-bold px-6 py-4 rounded-xl shadow-2xl flex items-center gap-2 animate-fade-in shrink-0">
            <span className="material-symbols-outlined text-fintech-mint">check_circle</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Top Section: Statistics & Queue Table */}
        <section className="bg-shaded-canopy border border-white/10 rounded-2xl p-6 flex flex-col gap-4 shadow-lg shrink-0">
          <div className="flex justify-between items-center border-b border-white/5 pb-3 select-none">
            <h2 className="text-base font-bold text-cloud-white flex items-center gap-2">
              <span className="material-symbols-outlined text-toka-flare">list_alt</span>
              Pending Moderation Queue Table
            </h2>
            <button 
              onClick={fetchQueue}
              className="text-xs text-cloud-white/60 hover:text-cloud-white flex items-center gap-1 bg-white/5 hover:bg-white/10 border border-white/10 py-1.5 px-3 rounded-lg transition-all"
            >
              <span className="material-symbols-outlined text-[14px]">refresh</span>
              Reload Queue
            </button>
          </div>

          {/* Queue List Table */}
          {isFetchingQueue ? (
            <div className="flex justify-center items-center py-12">
              <span className="w-8 h-8 border-4 border-toka-flare border-t-transparent rounded-full animate-spin"></span>
            </div>
          ) : pendingVideos.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-10 bg-black/20 rounded-xl border border-white/5">
              <span className="material-symbols-outlined text-fintech-mint text-[40px] mb-2">check_circle</span>
              <h3 className="text-base font-bold text-cloud-white">No Pending Reviews</h3>
              <p className="text-xs text-cloud-white/60">AI auto-vetting resolved all current uploads. Queue is clear!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-sans select-none">
                <thead>
                  <tr className="border-b border-white/10 text-cloud-white/40 font-bold uppercase tracking-wider">
                    <th className="pb-3 pl-2">Video Title</th>
                    <th className="pb-3">Creator Name</th>
                    <th className="pb-3">AI Confidence</th>
                    <th className="pb-3">Risk Flags</th>
                    <th className="pb-3 text-right pr-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingVideos.map((video) => {
                    const isSelected = selectedVideo && selectedVideo._id === video._id;
                    return (
                      <tr 
                        key={video._id} 
                        onClick={() => setSelectedVideo(video)}
                        className={`border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${
                          isSelected ? 'bg-white/5 text-toka-flare font-semibold' : 'text-cloud-white/80'
                        }`}
                      >
                        <td className="py-3 pl-2 max-w-[200px] truncate">{video.title}</td>
                        <td className="py-3">@{video.creatorId?.username || 'unknown'}</td>
                        <td className="py-3 font-mono font-bold">{video.aiConfidenceScore}%</td>
                        <td className="py-3">
                          <div className="flex gap-1.5 flex-wrap">
                            {video.riskFlags && video.riskFlags.length > 0 ? (
                              video.riskFlags.map((flag: string, idx: number) => (
                                <span key={idx} className="bg-red-500/10 border border-red-500/35 text-red-500 text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                                  {flag}
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-cloud-white/40 italic">None</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 text-right pr-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVideo(video);
                            }}
                            className={`py-1 px-3.5 rounded-lg text-[10px] font-bold border transition-all ${
                              isSelected 
                                ? 'bg-toka-flare border-toka-flare text-cloud-white shadow-[0_0_10px_rgba(255,79,0,0.3)]'
                                : 'bg-black/20 hover:bg-black/40 border-white/10 text-cloud-white'
                            }`}
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Bottom Section: Split Screen Review Audit Panel */}
        {selectedVideo && (
          <section className="flex flex-col lg:flex-row gap-6 shrink-0 min-h-[450px]">
            
            {/* Left Pane: HTML5 Video Stream Player */}
            <div className="w-full lg:w-7/12 flex flex-col gap-4">
              <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-lg relative">
                <VideoPlayer src={selectedVideo.videoUrl} isActive={true} />
              </div>
              
              <div className="bg-shaded-canopy border border-white/10 rounded-2xl p-5 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-base font-bold text-cloud-white">{selectedVideo.title}</h3>
                    <p className="text-xs text-cloud-white/60 mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">person</span>
                      Uploaded by @{selectedVideo.creatorId?.username || 'unknown'}
                    </p>
                  </div>
                  <span className="bg-yellow-500/10 border border-yellow-500/35 text-yellow-500 text-[10px] font-mono font-bold uppercase py-1 px-2.5 rounded-lg">
                    {selectedVideo.vettingStatus}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Pane: AI Analysis & Actions */}
            <div className="w-full lg:w-5/12 bg-shaded-canopy border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-lg">
              <div className="p-4 border-b border-white/10 bg-black/10 flex items-center gap-2 select-none">
                <span className="material-symbols-outlined text-toka-flare text-[20px]">analytics</span>
                <h4 className="text-xs font-bold text-cloud-white">Review Audit Dashboard</h4>
              </div>

              <div className="p-5 flex flex-col gap-5 flex-1 justify-between">
                
                {/* Confidence Meter */}
                <div className="flex items-center justify-between select-none">
                  <div>
                    <h5 className="text-xs font-bold text-cloud-white">AI Safety Confidence</h5>
                    <p className="text-[10px] text-cloud-white/50 mt-0.5">Automated transcription safety certainty</p>
                  </div>
                  <div className="relative w-12 h-12 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <circle className="text-white/5" cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3" />
                      <circle className="text-toka-flare" cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${selectedVideo.aiConfidenceScore || 0}, 100`} />
                    </svg>
                    <span className="absolute text-[10px] font-mono font-bold text-cloud-white">
                      {selectedVideo.aiConfidenceScore}%
                    </span>
                  </div>
                </div>

                <hr className="border-white/5" />

                {/* Flags */}
                <div className="flex flex-col gap-2">
                  <h5 className="text-xs font-bold text-cloud-white select-none">Identified Risk Violations</h5>
                  <div className="flex gap-2 flex-wrap">
                    {selectedVideo.riskFlags && selectedVideo.riskFlags.length > 0 ? (
                      selectedVideo.riskFlags.map((flag: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-1 bg-red-500/10 border border-red-500/35 px-2.5 py-1 rounded-xl text-red-500 text-[10px] font-bold uppercase tracking-wider font-mono">
                          <span className="material-symbols-outlined text-[12px]">warning</span>
                          {flag}
                        </div>
                      ))
                    ) : (
                      <div className="text-[11px] text-cloud-white/50 italic flex items-center gap-1.5 select-none">
                        <span className="material-symbols-outlined text-fintech-mint text-[16px]">check_circle</span>
                        No violations flagged by AI
                      </div>
                    )}
                  </div>
                </div>

                <hr className="border-white/5" />

                {/* Speech Transcript */}
                <div className="flex flex-col flex-1 min-h-[120px]">
                  <h5 className="text-xs font-bold text-cloud-white mb-2 flex justify-between select-none">
                    Speech Transcript
                    <span className="text-[9px] text-cloud-white/40 font-mono">Auto-transcribed</span>
                  </h5>
                  <div className="flex-1 bg-black/40 border border-white/10 p-3 rounded-xl font-mono text-[10px] leading-relaxed text-cloud-white/60 overflow-y-auto">
                    <p className="mb-1">{"00:00 - [Audio stream loaded successfully]"}</p>
                    <p className="mb-1">{"00:05 - [Transcribing speech & checking NLP thresholds...]"}</p>
                    {selectedVideo.riskFlags && selectedVideo.riskFlags.length > 0 ? (
                      <p className="text-red-400 mt-2 font-bold select-none">[Violation warnings detected: {selectedVideo.riskFlags.join(', ')}]</p>
                    ) : (
                      <p className="text-fintech-mint mt-2 font-bold select-none">[No violations detected in transcript]</p>
                    )}
                  </div>
                </div>

                {/* Action CTA Buttons */}
                <div className="flex gap-4 mt-2">
                  <button
                    disabled={actionLoading}
                    onClick={() => handleAction('rejected')}
                    className="flex-1 py-3 bg-transparent border-2 border-red-500 hover:bg-red-500/10 text-red-500 rounded-xl font-bold transition-all text-xs active:scale-[0.98] disabled:opacity-50 flex justify-center items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[18px]">block</span>
                    Reject Video
                  </button>
                  <button
                    disabled={actionLoading}
                    onClick={() => handleAction('approved')}
                    className="flex-1 py-3 bg-fintech-mint hover:bg-fintech-mint/90 text-midnight-boma rounded-xl font-bold transition-all text-xs active:scale-[0.98] disabled:opacity-50 shadow-md flex justify-center items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[18px]">check</span>
                    Approve Safe
                  </button>
                </div>

              </div>
            </div>
            
          </section>
        )}

      </div>

    </div>
  );
}
