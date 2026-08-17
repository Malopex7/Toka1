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
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-sm bg-[#09090B] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-3.5 border-b border-white/10 bg-[#18181B]/50">
          <h3 className="text-sm font-bold text-cloud-white tracking-tight">Support Creator</h3>
          <button onClick={onClose} className="text-cloud-white/40 hover:text-cloud-white transition-colors cursor-pointer">
            <X className="w-4 h-4" />
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
            <div className="w-14 h-14 rounded-full bg-fintech-mint/15 border border-fintech-mint/40 flex items-center justify-center mb-3 z-20 shadow-[0_0_16px_rgba(16,185,129,0.3)]">
              <Check className="w-7 h-7 text-fintech-mint" />
            </div>
            <h4 className="text-base font-bold text-cloud-white mb-1 z-20">Tip Sent Successfully!</h4>
            <p className="text-xs text-cloud-white/60 z-20">Thank you for supporting creators.</p>
          </div>
        ) : (
          <div className="p-5 flex flex-col gap-4">
            
            {/* Wallet Info */}
            <div className="flex justify-between items-center bg-[#18181B] px-3.5 py-2.5 rounded-[0.625rem] border border-white/10">
              <span className="text-xs text-cloud-white/60">Wallet Balance</span>
              <span className="font-mono font-bold text-fintech-mint text-xs">R {userWalletBalance.toFixed(2)} ZAR</span>
            </div>

            {/* Recessed Segmented Presets Track */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-cloud-white/50 uppercase tracking-wider">Select Amount</span>
              <div className="grid grid-cols-4 bg-[#09090B] p-1 rounded-[0.625rem] border border-white/10 text-xs font-medium gap-1">
                {presetAmounts.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setSelectedAmount(amt);
                      setCustomAmount('');
                    }}
                    className={`py-2 rounded-md font-bold font-mono transition-all text-xs cursor-pointer ${
                      selectedAmount === amt
                        ? 'bg-toka-flare text-white shadow-sm font-semibold'
                        : 'text-cloud-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    R {amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-cloud-white/50 uppercase tracking-wider">Or Custom Amount</span>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold font-mono text-xs text-cloud-white/40">R</span>
                <input
                  type="number"
                  placeholder="Custom ZAR"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setSelectedAmount(null);
                  }}
                  className="w-full bg-[#18181B]/60 border border-white/10 focus:border-toka-flare focus:ring-1 focus:ring-toka-flare rounded-[0.625rem] py-2.5 pl-8 pr-3 font-mono text-cloud-white placeholder-cloud-white/30 outline-none text-xs transition-colors"
                />
              </div>
            </div>

            {/* Send CTA */}
            <button
              onClick={handleTip}
              disabled={loading}
              className="w-full py-3 bg-toka-flare hover:bg-toka-flare/90 text-cloud-white rounded-[0.625rem] font-bold text-xs shadow-lg shadow-toka-flare/20 active:scale-[0.98] transition-all flex justify-center items-center gap-2 disabled:opacity-50 cursor-pointer mt-1"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-cloud-white border-t-transparent rounded-full animate-spin"></span>
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
