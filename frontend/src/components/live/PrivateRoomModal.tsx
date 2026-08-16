"use client";
import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

interface PrivateRoomModalProps {
  roomId: string;
  privateMode: 'entry_fee' | 'subscription' | 'tip_invite';
  entryFeeZAR?: number;
  subscriberPriceZAR?: number;
  tipInviteMinZAR?: number;
  hostUsername: string;
  onUnlocked: (token: string, livekitUrl: string) => void;
  onClose: () => void;
}

const MODE_LABEL = {
  entry_fee: 'Entry Fee',
  subscription: 'Monthly Subscription',
  tip_invite: 'Tip to Join',
};

const MODE_ICON = {
  entry_fee: 'door_open',
  subscription: 'stars',
  tip_invite: 'volunteer_activism',
};

export default function PrivateRoomModal({
  roomId, privateMode, entryFeeZAR = 0, subscriberPriceZAR = 0, tipInviteMinZAR = 0,
  hostUsername, onUnlocked, onClose,
}: PrivateRoomModalProps) {
  const { getIdToken, mongooseUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const amount =
    privateMode === 'entry_fee' ? entryFeeZAR :
    privateMode === 'subscription' ? subscriberPriceZAR :
    tipInviteMinZAR;

  const handleUnlock = async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getIdToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/live/${roomId}/unlock-private`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unlock failed');
      onUnlocked(data.data.token, data.data.livekitUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-shaded-canopy border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-4 animate-scale-up">
        {/* Lock icon */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-full bg-toka-flare/20 border border-toka-flare/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-toka-flare text-[32px]">lock</span>
          </div>
          <h2 className="text-cloud-white font-bold text-lg text-center">Private Stream</h2>
          <p className="text-cloud-white/60 text-sm text-center">
            <span className="text-toka-flare font-bold">@{hostUsername}</span> has made this stream private
          </p>
        </div>

        {/* Access mode info */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-toka-flare/20 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-toka-flare text-[20px]">{MODE_ICON[privateMode]}</span>
          </div>
          <div>
            <p className="text-cloud-white font-bold text-sm">{MODE_LABEL[privateMode]}</p>
            <p className="text-cloud-white/60 text-xs">
              {privateMode === 'entry_fee' && `Pay R${amount} once to enter this session`}
              {privateMode === 'subscription' && `Subscribe for R${amount}/month to join`}
              {privateMode === 'tip_invite' && `Tip at least R${amount} to get access`}
            </p>
          </div>
        </div>

        {/* Wallet info */}
        <div className="flex justify-between items-center text-xs text-cloud-white/50">
          <span>Your wallet:</span>
          <span className="text-fintech-mint font-bold font-mono">
            ZAR {mongooseUser?.walletBalance?.toFixed(2) || '0.00'}
          </span>
        </div>

        {error && <p className="text-red-400 text-xs text-center">{error}</p>}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-white/10 text-cloud-white/70 text-sm font-bold hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleUnlock}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-toka-flare text-white font-bold text-sm hover:bg-toka-flare/80 transition-all active:scale-95 disabled:opacity-60 shadow-lg shadow-toka-flare/20"
          >
            {loading ? 'Processing...' : `Pay R${amount}`}
          </button>
        </div>
      </div>
    </div>
  );
}
