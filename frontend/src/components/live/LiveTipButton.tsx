"use client";
import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

interface LiveTipButtonProps {
  roomId: string;
  hostUsername: string;
  onTipSent?: (amount: number) => void;
}

const PRESET_AMOUNTS = [5, 10, 25, 50];

export default function LiveTipButton({ roomId, hostUsername, onTipSent }: LiveTipButtonProps) {
  const { getIdToken, mongooseUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const sendTip = async (amount: number) => {
    if (amount <= 0) return;
    if (!mongooseUser || mongooseUser.walletBalance < amount) {
      setError('Insufficient wallet balance');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/live/${roomId}/tip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Tip failed');
      }
      setSuccess(true);
      onTipSent?.(amount);
      setTimeout(() => { setSuccess(false); setOpen(false); setCustom(''); }, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Tip failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      {/* Tip button — matches VideoFeed TokaTipIcon style */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex flex-col items-center gap-1 group active:scale-90 transition-transform select-none cursor-pointer"
      >
        <div className="sidebar-tip-btn w-12 h-12 rounded-full bg-toka-flare flex items-center justify-center shadow-[0_0_15px_rgba(255,79,0,0.5)] hover:scale-105 transition-all">
          <span className="material-symbols-outlined text-cloud-white text-[24px]">volunteer_activism</span>
        </div>
        <span className="font-mono text-[10px] font-bold text-toka-flare uppercase tracking-wider">Tip ZAR</span>
      </button>

      {open && (
        <div className="absolute bottom-16 right-0 z-50 w-52 bg-shaded-canopy/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-3 flex flex-col gap-2 animate-scale-up">
          <p className="text-xs text-cloud-white/70 font-medium text-center">
            Tip <span className="text-toka-flare font-bold">@{hostUsername}</span>
          </p>

          {/* Preset amounts */}
          <div className="grid grid-cols-2 gap-2">
            {PRESET_AMOUNTS.map((amt) => (
              <button
                key={amt}
                onClick={() => sendTip(amt)}
                disabled={loading}
                className="py-2 rounded-xl bg-white/5 border border-white/10 text-cloud-white text-xs font-bold hover:bg-toka-flare/20 hover:border-toka-flare/40 transition-all active:scale-95 disabled:opacity-50"
              >
                R{amt}
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <div className="flex gap-2">
            <input
              type="number"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Custom"
              min={1}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-xs text-cloud-white placeholder-cloud-white/30 focus:outline-none focus:border-toka-flare/50"
            />
            <button
              onClick={() => sendTip(Number(custom))}
              disabled={loading || !custom}
              className="bg-toka-flare text-white rounded-xl px-3 text-xs font-bold hover:bg-toka-flare/80 transition-all active:scale-95 disabled:opacity-50"
            >
              Send
            </button>
          </div>

          {error && <p className="text-red-400 text-[11px] text-center">{error}</p>}
          {success && <p className="text-fintech-mint text-[11px] text-center font-bold">🎉 Tip sent!</p>}
        </div>
      )}
    </div>
  );
}
