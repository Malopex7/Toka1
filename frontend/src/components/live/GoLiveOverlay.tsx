"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useLiveStore } from '@/store/useLiveStore';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

type PrivateMode = 'entry_fee' | 'subscription' | 'tip_invite';

const PRIVATE_MODE_OPTIONS: { value: PrivateMode; label: string; icon: string; desc: string }[] = [
  { value: 'entry_fee', label: 'Entry Fee', icon: 'door_open', desc: 'Viewers pay a one-time ZAR fee to enter' },
  { value: 'subscription', label: 'Subscription', icon: 'stars', desc: 'Viewers pay a monthly subscription' },
  { value: 'tip_invite', label: 'Tip to Join', icon: 'volunteer_activism', desc: 'Viewers tip a minimum amount to get access' },
];

interface GoLiveOverlayProps {
  onClose: () => void;
}

export default function GoLiveOverlay({ onClose }: GoLiveOverlayProps) {
  const { getIdToken, mongooseUser } = useAuth();
  const router = useRouter();
  const setLivekitConnection = useLiveStore((s) => s.setLivekitConnection);
  const setCurrentRoom = useLiveStore((s) => s.setCurrentRoom);

  const [title, setTitle] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');
  const [privateMode, setPrivateMode] = useState<PrivateMode>('entry_fee');
  const [showPrivateModeModal, setShowPrivateModeModal] = useState(false);
  const [entryFeeZAR, setEntryFeeZAR] = useState<number>(10);
  const [subscriberPriceZAR, setSubscriberPriceZAR] = useState<number>(20);
  const [tipInviteMinZAR, setTipInviteMinZAR] = useState<number>(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePrivacyToggle = (value: 'public' | 'private') => {
    setPrivacy(value);
    if (value === 'private') {
      setShowPrivateModeModal(true);
    }
  };

  const handleGoLive = async () => {
    if (!title.trim()) { setError('Please enter a stream title'); return; }
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const body: Record<string, unknown> = { title: title.trim(), privacy };
      if (privacy === 'private') {
        body.privateMode = privateMode;
        if (privateMode === 'entry_fee') body.entryFeeZAR = entryFeeZAR;
        if (privateMode === 'subscription') body.subscriberPriceZAR = subscriberPriceZAR;
        if (privateMode === 'tip_invite') body.tipInviteMinZAR = tipInviteMinZAR;
      }
      const res = await fetch(`${BACKEND_URL}/api/live/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to start stream');
      setLivekitConnection(data.data.token, data.data.livekitUrl);
      setCurrentRoom(data.data.stream);
      onClose();
      router.push(`/live/${data.data.stream._id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start stream');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Slide-up panel */}
      <div className="fixed bottom-0 left-0 right-0 z-[90] bg-shaded-canopy border-t border-white/10 rounded-t-3xl p-6 flex flex-col gap-5 animate-slide-up max-w-2xl mx-auto shadow-2xl">
        {/* Handle */}
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto -mt-1" />

        <div className="flex items-center justify-between">
          <h2 className="text-cloud-white font-bold text-xl flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            Go Live
          </h2>
          <button onClick={onClose} className="text-cloud-white/50 hover:text-cloud-white transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <label className="text-cloud-white/70 text-xs font-semibold uppercase tracking-wider">Stream Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's your stream about?"
            maxLength={120}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-cloud-white placeholder-cloud-white/30 focus:outline-none focus:border-toka-flare/50 text-sm transition-colors"
          />
        </div>

        {/* Privacy toggle */}
        <div className="flex flex-col gap-2">
          <label className="text-cloud-white/70 text-xs font-semibold uppercase tracking-wider">Stream Access</label>
          <div className="flex gap-2">
            <button
              onClick={() => handlePrivacyToggle('public')}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                privacy === 'public'
                  ? 'bg-toka-flare/20 border-toka-flare text-toka-flare'
                  : 'border-white/10 text-cloud-white/60 hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">public</span> Public
            </button>
            <button
              onClick={() => handlePrivacyToggle('private')}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                privacy === 'private'
                  ? 'bg-toka-flare/20 border-toka-flare text-toka-flare'
                  : 'border-white/10 text-cloud-white/60 hover:bg-white/5'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">lock</span>
              Private {privacy === 'private' && <span className="text-xs opacity-70">({PRIVATE_MODE_OPTIONS.find(o => o.value === privateMode)?.label})</span>}
            </button>
          </div>
          {privacy === 'private' && (
            <button
              onClick={() => setShowPrivateModeModal(true)}
              className="text-xs text-toka-flare/80 hover:text-toka-flare text-left underline underline-offset-2 transition-colors"
            >
              Change private mode settings →
            </button>
          )}
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        {/* CTA */}
        <button
          onClick={handleGoLive}
          disabled={loading || !title.trim()}
          className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-red-600/20 transition-all active:scale-98 disabled:opacity-50 text-base"
        >
          {loading ? (
            <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
          ) : (
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
          )}
          {loading ? 'Starting...' : 'Start Live Stream'}
        </button>
      </div>

      {/* Private Mode Selection Modal */}
      {showPrivateModeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-shaded-canopy border border-white/10 rounded-3xl p-5 w-full max-w-sm shadow-2xl flex flex-col gap-4 animate-scale-up">
            <h3 className="text-cloud-white font-bold text-base text-center">Choose Private Access Mode</h3>

            {PRIVATE_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setPrivateMode(opt.value); }}
                className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all ${
                  privateMode === opt.value
                    ? 'border-toka-flare bg-toka-flare/10'
                    : 'border-white/10 hover:bg-white/5'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-toka-flare/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-toka-flare text-[20px]">{opt.icon}</span>
                </div>
                <div>
                  <p className="text-cloud-white font-bold text-sm">{opt.label}</p>
                  <p className="text-cloud-white/50 text-xs">{opt.desc}</p>
                </div>
                {privateMode === opt.value && (
                  <span className="material-symbols-outlined text-toka-flare text-[18px] ml-auto">check_circle</span>
                )}
              </button>
            ))}

            {/* Amount input for selected mode */}
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
              <span className="text-cloud-white/60 text-sm">ZAR</span>
              <input
                type="number"
                min={1}
                value={
                  privateMode === 'entry_fee' ? entryFeeZAR :
                  privateMode === 'subscription' ? subscriberPriceZAR : tipInviteMinZAR
                }
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (privateMode === 'entry_fee') setEntryFeeZAR(v);
                  if (privateMode === 'subscription') setSubscriberPriceZAR(v);
                  if (privateMode === 'tip_invite') setTipInviteMinZAR(v);
                }}
                className="flex-1 bg-transparent text-cloud-white font-mono font-bold text-sm focus:outline-none"
              />
            </div>

            <button
              onClick={() => setShowPrivateModeModal(false)}
              className="w-full py-3 bg-toka-flare text-white font-bold rounded-xl text-sm hover:bg-toka-flare/80 transition-all active:scale-95"
            >
              Confirm Settings
            </button>
          </div>
        </div>
      )}
    </>
  );
}
