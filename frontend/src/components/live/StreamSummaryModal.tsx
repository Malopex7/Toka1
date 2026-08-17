"use client";
import React, { useEffect, useState } from 'react';

interface StreamSummary {
  durationSeconds: number;
  peakViewerCount: number;
  totalTipsZAR: number;
  totalParticipants: number;
  title: string;
}

interface Props {
  summary: StreamSummary;
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
  return `${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
}

export default function StreamSummaryModal({ summary, onClose }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div className={`fixed inset-0 z-[100] flex items-end md:items-center justify-center transition-all duration-300 ${visible ? "opacity-100" : "opacity-0"}`}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
      <div className={`relative w-full max-w-sm mx-4 mb-6 md:mb-0 bg-[#09090B] border border-white/10 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 ${visible ? "translate-y-0 scale-100" : "translate-y-8 scale-95"}`}>
        <div className="relative px-6 pt-8 pb-6 text-center bg-gradient-to-b from-[#FF4F00]/20 via-[#FF4F00]/5 to-transparent">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-[#FF4F00]/20 border border-[#FF4F00]/40 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#FF4F00] text-[32px]">check_circle</span>
          </div>
          <h2 className="text-cloud-white font-bold text-xl leading-tight">Stream Ended</h2>
          <p className="text-cloud-white/50 text-sm mt-1 truncate px-4">{summary.title}</p>
        </div>
        <div className="px-5 pb-5 grid grid-cols-2 gap-3">
          <div className="bg-[#18181B] rounded-[0.625rem] p-4 flex flex-col gap-1">
            <span className="material-symbols-outlined text-cloud-white/40 text-[18px]">timer</span>
            <p className="text-cloud-white/50 text-[11px] font-medium mt-1">Duration</p>
            <p className="text-cloud-white font-bold text-base font-mono">{formatDuration(summary.durationSeconds)}</p>
          </div>
          <div className="bg-[#18181B] rounded-[0.625rem] p-4 flex flex-col gap-1">
            <span className="material-symbols-outlined text-cloud-white/40 text-[18px]">group</span>
            <p className="text-cloud-white/50 text-[11px] font-medium mt-1">Peak Viewers</p>
            <p className="text-cloud-white font-bold text-base">{summary.peakViewerCount.toLocaleString()}</p>
          </div>
          <div className="bg-[#18181B] rounded-[0.625rem] p-4 flex flex-col gap-1 col-span-2">
            <span className="material-symbols-outlined text-[#10B981]/60 text-[18px]">payments</span>
            <p className="text-cloud-white/50 text-[11px] font-medium mt-1">Tips Earned</p>
            <p className="text-[#10B981] font-bold text-2xl font-mono">R{summary.totalTipsZAR.toFixed(2)}</p>
          </div>
          <div className="bg-[#18181B] rounded-[0.625rem] p-4 flex flex-col gap-1 col-span-2">
            <span className="material-symbols-outlined text-cloud-white/40 text-[18px]">people</span>
            <p className="text-cloud-white/50 text-[11px] font-medium mt-1">Total Joined</p>
            <p className="text-cloud-white font-bold text-base">{summary.totalParticipants.toLocaleString()} viewers</p>
          </div>
        </div>
        <div className="px-5 pb-6">
          <button onClick={handleClose} className="w-full bg-[#FF4F00] hover:bg-[#E63E00] active:scale-95 text-white font-bold py-3 rounded-[0.625rem] text-sm transition-all">
            Return to Feed
          </button>
        </div>
      </div>
    </div>
  );
}
