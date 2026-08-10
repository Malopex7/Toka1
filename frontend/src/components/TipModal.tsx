"use client";
import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { useFeedStore } from '@/store/useFeedStore';
import { useAuth } from '@/context/AuthContext';
import { useModalStore } from '@/store/useModalStore';

interface TipModalProps {
  videoId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function TipModal({ videoId, isOpen, onClose }: TipModalProps) {
  const { videos, optimisticTip, userWalletBalance } = useFeedStore();
  const { firebaseUser, refreshProfile } = useAuth();
  const { showAlert } = useModalStore();
  
  const [selectedAmount, setSelectedAmount] = useState<number | null>(10);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [coins, setCoins] = useState<{ id: string; left: number; delay: number }[]>([]);

  if (!isOpen) return null;

  // Retrieve creator ID from the video object to act as the receiverId
  const video = videos.find((v) => v.id === videoId);
  const receiverId = video?.creatorId;

  const handleTip = async () => {
    const amount = selectedAmount !== null ? selectedAmount : parseFloat(customAmount);
    if (isNaN(amount) || amount <= 0) return;

    if (userWalletBalance < amount) {
      showAlert("Insufficient Balance", "Insufficient wallet balance!");
      return;
    }

    if (!firebaseUser) {
      showAlert("Sign In Required", "Please sign in to send a tip.");
      return;
    }

    if (!receiverId) {
      showAlert("Error", "Could not identify creator for this video.");
      return;
    }

    setLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/transactions/tip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          receiverId,
          videoId,
          amount
        })
      });

      const data = await res.json();
      if (data.status === 'success') {
        // optimistically update local UI states
        optimisticTip(videoId, amount);
        setSuccess(true);

        // Flag inbox as having new activity so the unread dot appears
        if (typeof window !== 'undefined') {
          localStorage.setItem('toka_inbox_unread', 'true');
        }
        
        // Generate coin particles for animation
        const coinParticles = Array.from({ length: 18 }).map((_, i) => ({
          id: `coin-${i}-${Date.now()}-${Math.random()}`,
          left: Math.random() * 80 + 10,
          delay: Math.random() * 0.5
        }));
        setCoins(coinParticles);

        // refresh real profile balance
        await refreshProfile();
        
        setTimeout(() => {
          setSuccess(false);
          setCoins([]);
          onClose();
        }, 2200); // Extended timeout to let coins fall
      } else {
        showAlert('Tip Failed', data.message || 'Tipping failed. Please try again.');
      }
    } catch (err: any) {
      console.error(err);
      showAlert('Error', err.message || 'An error occurred while sending the tip.');
    } finally {
      setLoading(false);
    }
  };

  const presetAmounts = [5, 10, 20, 50];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-sm bg-shaded-canopy border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-white/10 bg-black/20">
          <h3 className="text-title-md font-bold text-cloud-white">Support Creator</h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-cloud-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center p-8 text-center relative overflow-hidden min-h-[220px]">
            {/* Falling coins particles */}
            {coins.map((coin) => (
              <div
                key={coin.id}
                className="absolute top-0 text-amber-400 animate-coin-fall pointer-events-none z-10"
                style={{
                  left: `${coin.left}%`,
                  animationDelay: `${coin.delay}s`,
                }}
              >
                <span className="material-symbols-outlined text-[20px] fill-current select-none">
                  monetization_on
                </span>
              </div>
            ))}
            <div className="w-16 h-16 rounded-full bg-fintech-mint/20 border border-fintech-mint flex items-center justify-center mb-4 z-20">
              <Check className="w-8 h-8 text-fintech-mint" />
            </div>
            <h4 className="text-lg font-bold text-cloud-white mb-1 z-20">Tip Sent Successfully!</h4>
            <p className="text-sm text-cloud-white/60 z-20">Thank you for supporting creators.</p>
          </div>
        ) : (
          <div className="p-6 flex flex-col gap-6">
            
            {/* Wallet Info */}
            <div className="flex justify-between items-center bg-black/30 px-4 py-3 rounded-xl border border-white/5">
              <span className="text-sm text-on-surface-variant">Your Wallet Balance</span>
              <span className="font-mono font-bold text-fintech-mint">R {userWalletBalance.toFixed(2)} ZAR</span>
            </div>

            {/* Presets */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Select Amount</span>
              <div className="grid grid-cols-4 gap-2">
                {presetAmounts.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => {
                      setSelectedAmount(amt);
                      setCustomAmount('');
                    }}
                    className={`py-3 rounded-xl font-bold font-mono transition-all active:scale-95 text-sm ${
                      selectedAmount === amt
                        ? 'bg-toka-flare text-cloud-white border border-toka-flare shadow-[0_0_10px_rgba(255,79,0,0.3)]'
                        : 'bg-black/30 hover:bg-black/50 border border-white/10 text-on-surface'
                    }`}
                  >
                    R {amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Or Enter Custom Amount</span>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold font-mono text-on-surface-variant">R</span>
                <input
                  type="number"
                  placeholder="Custom ZAR"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setSelectedAmount(null);
                  }}
                  className="w-full bg-black/30 border border-white/10 focus:border-toka-flare focus:ring-1 focus:ring-toka-flare rounded-xl py-3 pl-8 pr-4 font-mono text-cloud-white placeholder-on-surface-variant/40 outline-none text-sm transition-colors"
                />
              </div>
            </div>

            {/* Send CTA */}
            <button
              onClick={handleTip}
              disabled={loading}
              className="w-full py-4 bg-toka-flare hover:bg-toka-flare/90 text-cloud-white rounded-xl font-bold transition-all shadow-lg active:scale-[0.98] mt-2 flex justify-center items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-cloud-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                'Send Tip via Mobile Money'
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
