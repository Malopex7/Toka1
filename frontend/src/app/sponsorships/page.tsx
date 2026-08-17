"use client";
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/PageHeader';

interface UserInfo {
  _id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  role?: string;
}

interface VideoInfo {
  _id: string;
  title: string;
  videoUrl: string;
  vettingStatus: string;
  aiPipelineStatus: string;
  visibility: string;
}

interface SponsorshipRequest {
  _id: string;
  videoId: VideoInfo;
  creatorId: UserInfo;
  brandId: UserInfo;
  amount: number;
  terms: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'disputed' | 'completed';
  escrowStatus: 'none' | 'held' | 'released' | 'refunded' | 'locked';
  escrowReleaseAt: string | null;
  createdAt: string;
}

type CreatorTab = 'sent' | 'directory';
type BrandTab = 'inbox' | 'history';

// Sleek Nano-style Minimalist Icons
function IconHandshake({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m11 17 2 2a1 1 0 0 0 1.4 0l4.3-4.3a1 1 0 0 0 0-1.4l-2-2" />
      <path d="m18 10 3.3-3.3a1 1 0 0 0 0-1.4l-2.6-2.6a1 1 0 0 0-1.4 0L14 6" />
      <path d="m2 14 6 6a2 2 0 0 0 2.8 0L15 16" />
      <path d="m7 9 5-5a2 2 0 0 1 2.8 0l1.4 1.4" />
    </svg>
  );
}

function IconShieldCheck({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function IconWallet({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="14" x="2" y="5" rx="3" />
      <line x1="2" x2="22" y1="10" y2="10" />
      <circle cx="17" cy="14" r="1" fill="currentColor" />
    </svg>
  );
}

function IconLockEscrow({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export default function SponsorshipsPage() {
  const { isAuthenticated, mongooseUser, firebaseUser, isLoading, refreshProfile } = useAuth();
  
  const [nowTime] = useState(() => Date.now());

  // Tabs
  const [creatorTab, setCreatorTab] = useState<CreatorTab>('sent');
  const [brandTab, setBrandTab] = useState<BrandTab>('inbox');
  
  // Data lists
  const [sentRequests, setSentRequests] = useState<SponsorshipRequest[]>([]);
  const [brandRequests, setBrandRequests] = useState<SponsorshipRequest[]>([]);
  const [directoryUsers, setDirectoryUsers] = useState<any[]>([]);
  
  // State loaders & alerts
  const [fetching, setFetching] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  // Video player modal
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [previewVideoTitle, setPreviewVideoTitle] = useState<string>('');

  const loadData = useCallback(async () => {
    if (!firebaseUser || !mongooseUser?.isBrandSafeVerified) return;
    setFetching(true);
    setMessage(null);

    try {
      const token = await firebaseUser.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };

      if (mongooseUser.role === 'brand') {
        const [inboxRes, historyRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sponsorships/brand/pending`, { headers }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sponsorships/brand/pending?all=true`, { headers })
        ]);

        const inboxJson = await inboxRes.json();
        const historyJson = await historyRes.json();

        if (inboxJson.status === 'success') setBrandRequests(inboxJson.data.requests || []);
        if (historyJson.status === 'success') {
          const historyFiltered = (historyJson.data.requests || []).filter(
            (r: SponsorshipRequest) => r.status !== 'pending'
          );
          setSentRequests(historyFiltered);
        }
      } else {
        const [sentRes, dirRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sponsorships/creator/sent`, { headers }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/directory`, { headers })
        ]);

        const sentJson = await sentRes.json();
        const dirJson = await dirRes.json();

        if (sentJson.status === 'success') setSentRequests(sentJson.data.requests || []);
        if (dirJson.status === 'success') setDirectoryUsers(dirJson.data.users || []);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setMessage({ text: 'Error connecting to the server.', type: 'error' });
    } finally {
      setFetching(false);
    }
  }, [firebaseUser, mongooseUser]);

  useEffect(() => {
    if (isAuthenticated && mongooseUser) {
      const timer = setTimeout(() => {
        loadData();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, mongooseUser, loadData]);

  const handleAction = async (id: string, endpoint: string, bodyObj?: any) => {
    if (!firebaseUser) return;
    setActionLoadingId(id);
    setMessage(null);

    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sponsorships/${id}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: bodyObj ? JSON.stringify(bodyObj) : undefined
      });

      const json = await res.json();
      if (json.status === 'success') {
        setMessage({ text: json.message || 'Action completed successfully.', type: 'success' });
        refreshProfile();
        loadData();
      } else {
        setMessage({ text: json.message || 'Action failed.', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'Network connection failed.', type: 'error' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusBadge = (status: string, escrow: string) => {
    if (status === 'approved' && escrow === 'held') {
      return (
        <span className="inline-flex items-center gap-1 bg-purple-500/15 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-[0_0_10px_rgba(168,85,247,0.15)] font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
          Escrow Held
        </span>
      );
    }
    if (status === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 bg-fintech-mint/15 text-fintech-mint border border-fintech-mint/30 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider font-mono">
          ✓ Completed
        </span>
      );
    }
    if (status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider font-mono">
          ⏳ Pending
        </span>
      );
    }
    if (status === 'disputed') {
      return (
        <span className="inline-flex items-center gap-1 bg-red-500/15 text-red-400 border border-red-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider font-mono">
          ⚠️ Disputed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 bg-white/10 text-cloud-white/60 border border-white/10 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider font-mono">
        {status}
      </span>
    );
  };

  const getRemainingDays = (dateStr: string | null) => {
    if (!dateStr) return '';
    const diff = new Date(dateStr).getTime() - nowTime;
    if (diff <= 0) return 'Payout processing...';
    const days = Math.ceil(diff / (1024 * 60 * 60 * 24));
    return `${days} ${days === 1 ? 'day' : 'days'} left in escrow`;
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-midnight-boma text-cloud-white font-sans">
        <span className="w-10 h-10 border-4 border-toka-flare border-t-transparent rounded-full animate-spin"></span>
      </div>
    );
  }

  if (!isAuthenticated || !mongooseUser?.isBrandSafeVerified) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-midnight-boma text-cloud-white gap-4 font-sans px-6 text-center select-none">
        <span className="material-symbols-outlined text-[64px] text-toka-flare animate-pulse">lock</span>
        <h1 className="text-2xl font-black tracking-tight">Access Restricted</h1>
        <p className="text-sm text-cloud-white/60 max-w-sm">
          Sponsorship requests and escrow features are restricted to verified accounts. Please request verification from your profile settings.
        </p>
        <Link href="/" className="px-6 py-3 bg-toka-flare hover:bg-toka-flare/90 rounded-xl font-bold transition-all text-xs active:scale-95 shadow-lg">
          Return to Feed
        </Link>
      </div>
    );
  }

  const isBrand = mongooseUser.role === 'brand';
  const totalEscrowHeld = sentRequests
    .filter(r => r.status === 'approved' && r.escrowStatus === 'held')
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="min-h-screen bg-midnight-boma text-cloud-white font-sans select-none pb-24">
      <PageHeader title="Sponsorships" />
      
      <main className="max-w-7xl mx-auto flex flex-col gap-8 p-4 md:p-8 w-full">
        
        {/* Pro Hero Dashboard Banner */}
        <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-shaded-canopy shadow-2xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="absolute top-0 right-0 w-96 h-96 bg-toka-flare/10 blur-[100px] rounded-full pointer-events-none"></div>
          
          <div className="flex items-center gap-4 z-10">
            <div className="w-14 h-14 rounded-2xl bg-toka-flare/15 border border-toka-flare/30 flex items-center justify-center text-toka-flare shadow-inner shrink-0">
              <IconHandshake className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-cloud-white">
                  Sponsorship Dashboard
                </h1>
                <span className="bg-fintech-mint/15 text-fintech-mint border border-fintech-mint/30 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono">
                  Brand Safe
                </span>
              </div>
              <p className="text-xs text-cloud-white/50 mt-1 max-w-xl">
                Secure direct brand deals with automated smart escrow, automated media verification, and instant ZAR payouts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-black/40 border border-white/10 px-5 py-3 rounded-2xl z-10 shrink-0 shadow-lg">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-cloud-white/40 uppercase font-mono tracking-wider">Wallet Balance</span>
              <span className="text-lg font-black text-fintech-mint font-mono">
                ZAR {mongooseUser.walletBalance.toFixed(2)}
              </span>
            </div>
            <Link 
              href="/deposit" 
              className="bg-toka-flare hover:bg-toka-flare/90 text-cloud-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-[0_2px_12px_rgba(255,79,0,0.25)] active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <IconWallet className="w-4 h-4" />
              <span>Top Up</span>
            </Link>
          </div>
        </div>

        {/* 4 Elevated KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
          
          <div className="bg-shaded-canopy/90 border border-white/10 rounded-2xl p-5 flex flex-col items-start gap-2 shadow-lg">
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] font-bold text-cloud-white/40 uppercase tracking-wider font-mono">Active Deals</span>
              <div className="w-8 h-8 rounded-xl bg-toka-flare/10 border border-toka-flare/20 flex items-center justify-center text-toka-flare">
                <IconHandshake className="w-4 h-4" />
              </div>
            </div>
            <span className="text-2xl md:text-3xl font-black font-mono text-cloud-white tracking-tight">
              {isBrand ? brandRequests.length : sentRequests.length}
            </span>
            <span className="text-[10px] text-cloud-white/40">Registered sponsorships</span>
          </div>

          <div className="bg-shaded-canopy/90 border border-white/10 rounded-2xl p-5 flex flex-col items-start gap-2 shadow-lg">
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider font-mono">Escrow Held</span>
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <IconLockEscrow className="w-4 h-4" />
              </div>
            </div>
            <span className="text-2xl md:text-3xl font-black font-mono text-purple-300 tracking-tight">
              ZAR {totalEscrowHeld.toFixed(2)}
            </span>
            <span className="text-[10px] text-purple-400/60">Protected in 7-day escrow</span>
          </div>

          <Link
            href="/deposit"
            className="bg-shaded-canopy/90 hover:bg-fintech-mint/5 border border-white/10 hover:border-fintech-mint/30 rounded-2xl p-5 flex flex-col items-start gap-2 shadow-lg transition-all active:scale-98 cursor-pointer group"
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] font-bold text-fintech-mint/70 uppercase tracking-wider font-mono">Available Payout</span>
              <div className="w-8 h-8 rounded-xl bg-fintech-mint/10 border border-fintech-mint/30 flex items-center justify-center text-fintech-mint">
                <IconWallet className="w-4 h-4" />
              </div>
            </div>
            <span className="text-2xl md:text-3xl font-black font-mono text-fintech-mint tracking-tight">
              ZAR {mongooseUser.walletBalance.toFixed(2)}
            </span>
            <span className="text-[10px] text-fintech-mint/60">Instant Top Up &amp; Withdraw</span>
          </Link>

          <div className="bg-shaded-canopy/90 border border-white/10 rounded-2xl p-5 flex flex-col items-start gap-2 shadow-lg">
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] font-bold text-cloud-white/40 uppercase tracking-wider font-mono">Platform Trust</span>
              <div className="w-8 h-8 rounded-xl bg-fintech-mint/10 border border-fintech-mint/20 flex items-center justify-center text-fintech-mint">
                <IconShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <span className="text-2xl md:text-3xl font-black font-mono text-cloud-white tracking-tight">100%</span>
            <span className="text-[10px] text-fintech-mint font-bold">Brand Safe Guaranteed</span>
          </div>

        </div>

        {/* Global Feedback message */}
        {message && (
          <div className={`border px-5 py-4 rounded-2xl flex items-center gap-3 animate-fade-in ${
            message.type === 'success'
              ? 'bg-fintech-mint/10 border-fintech-mint/35 text-fintech-mint'
              : 'bg-red-500/10 border-red-500/35 text-red-400'
          }`}>
            <span className="material-symbols-outlined text-[20px]">
              {message.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span className="text-xs font-bold">{message.text}</span>
          </div>
        )}

        {/* Dashboard Content */}
        {isBrand ? (
          /* BRAND VIEW */
          <div className="flex flex-col gap-6">
            
            {/* Unified Segmented Slider Track for Tabs */}
            <div className="w-fit bg-black/50 p-1.5 rounded-2xl border border-white/10 flex items-center gap-1 select-none">
              <button
                onClick={() => setBrandTab('inbox')}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  brandTab === 'inbox'
                    ? 'bg-white/15 text-white shadow-md font-black'
                    : 'text-cloud-white/50 hover:text-cloud-white/80 hover:bg-white/[0.03]'
                }`}
              >
                Pending Requests ({brandRequests.length})
              </button>
              <button
                onClick={() => setBrandTab('history')}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  brandTab === 'history'
                    ? 'bg-white/15 text-white shadow-md font-black'
                    : 'text-cloud-white/50 hover:text-cloud-white/80 hover:bg-white/[0.03]'
                }`}
              >
                Sponsorship History
              </button>
            </div>

            {fetching ? (
              <div className="flex justify-center py-16">
                <span className="w-10 h-10 border-4 border-toka-flare border-t-transparent rounded-full animate-spin"></span>
              </div>
            ) : brandTab === 'inbox' ? (
              brandRequests.length === 0 ? (
                <div className="bg-shaded-canopy/60 border border-white/10 rounded-3xl p-16 text-center flex flex-col items-center gap-3 shadow-xl">
                  <span className="material-symbols-outlined text-[54px] text-cloud-white/20">mail_outline</span>
                  <h3 className="font-bold text-cloud-white/80 text-base">Inbox is empty</h3>
                  <p className="text-xs text-cloud-white/40 max-w-xs leading-relaxed">
                    Verified creators will tag your brand in sponsorship pitches and video deals here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {brandRequests.map((req) => {
                    const balanceError = mongooseUser.walletBalance < req.amount;
                    return (
                      <div key={req._id} className="bg-shaded-canopy border border-white/10 hover:border-white/20 rounded-3xl p-6 flex flex-col justify-between gap-5 shadow-xl transition-all relative overflow-hidden">
                        
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3.5">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-toka-flare to-amber-500 p-0.5 shadow-md shrink-0">
                              <div className="w-full h-full rounded-full bg-midnight-boma flex items-center justify-center font-black text-sm text-cloud-white uppercase">
                                {req.creatorId.username.charAt(0)}
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-base font-black text-cloud-white">@{req.creatorId.username}</h4>
                                <span className="bg-fintech-mint/15 text-fintech-mint border border-fintech-mint/30 px-2 py-0.2 rounded-full text-[9px] font-bold">
                                  Verified
                                </span>
                              </div>
                              <p className="text-[11px] text-cloud-white/40 mt-0.5">
                                Requested on {new Date(req.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-lg font-black font-mono text-fintech-mint">
                              ZAR {req.amount.toFixed(2)}
                            </span>
                            <div className="mt-1">{getStatusBadge(req.status, req.escrowStatus)}</div>
                          </div>
                        </div>

                        {/* Video Info Container */}
                        <div className="bg-black/30 rounded-2xl p-4 border border-white/5 flex flex-col gap-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-cloud-white/40 font-mono text-[11px]">Video Post:</span>
                            <span className="font-bold text-cloud-white truncate max-w-[280px]">
                              &quot;{req.videoId?.title || 'Creator Video'}&quot;
                            </span>
                          </div>

                          {req.terms && (
                            <div className="text-xs text-cloud-white/70 bg-black/40 border border-white/5 p-3 rounded-xl mt-1 leading-relaxed">
                              <span className="text-cloud-white/40 font-mono text-[10px] block uppercase">Deal Terms</span>
                              {req.terms}
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/5">
                          <button
                            onClick={() => {
                              setPreviewVideoUrl(req.videoId.videoUrl);
                              setPreviewVideoTitle(req.videoId.title);
                            }}
                            className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-cloud-white py-2.5 rounded-xl text-xs font-bold transition-all flex justify-center items-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            <span className="material-symbols-outlined text-[16px] text-toka-flare">play_circle</span>
                            <span>Review Video</span>
                          </button>
                          
                          <button
                            disabled={actionLoadingId !== null || balanceError}
                            onClick={() => handleAction(req._id, 'approve')}
                            className="flex-1 bg-toka-flare hover:bg-toka-flare/90 disabled:opacity-50 text-cloud-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-[0_2px_12px_rgba(255,79,0,0.25)] active:scale-95 flex justify-center items-center gap-1 cursor-pointer"
                          >
                            {actionLoadingId === req._id ? (
                              <span className="w-4 h-4 border-2 border-cloud-white border-t-transparent rounded-full animate-spin"></span>
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-[16px]">check</span>
                                <span>Approve &amp; Pay</span>
                              </>
                            )}
                          </button>
                          
                          <button
                            disabled={actionLoadingId !== null}
                            onClick={() => handleAction(req._id, 'reject')}
                            className="bg-white/5 border border-white/10 hover:bg-red-500/15 hover:border-red-500/30 text-cloud-white/60 hover:text-red-400 p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer active:scale-95"
                            title="Decline Request"
                          >
                            <span className="material-symbols-outlined text-[18px]">close</span>
                          </button>
                        </div>

                        {balanceError && (
                          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold p-3 rounded-xl flex items-center gap-2 select-none">
                            <span className="material-symbols-outlined text-[16px]">warning</span>
                            <span>Insufficient wallet balance. Top up to approve.</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* Brand History */
              sentRequests.length === 0 ? (
                <div className="bg-shaded-canopy/60 border border-white/10 rounded-3xl p-16 text-center flex flex-col items-center gap-3 shadow-xl">
                  <span className="material-symbols-outlined text-[54px] text-cloud-white/20">history</span>
                  <h3 className="font-bold text-cloud-white/80 text-base">No sponsorship history</h3>
                  <p className="text-xs text-cloud-white/40 max-w-xs leading-relaxed">
                    Completed, ongoing, and archived brand deals will appear here.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {sentRequests.map((req) => {
                    const isDisputable = req.status === 'approved' && req.escrowStatus === 'held';
                    return (
                      <div key={req._id} className="bg-shaded-canopy border border-white/10 hover:border-white/20 rounded-3xl p-5 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl transition-all">
                        
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-black text-base text-toka-flare font-mono shrink-0">
                            {req.creatorId.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2.5">
                              <h4 className="text-base font-black text-cloud-white">@{req.creatorId.username}</h4>
                              {getStatusBadge(req.status, req.escrowStatus)}
                            </div>
                            <p className="text-xs text-cloud-white/50 mt-1 truncate max-w-md">
                              Video: &quot;{req.videoId?.title || 'Creator Video'}&quot;
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col md:items-end gap-1.5">
                          <span className="text-lg font-black text-fintech-mint font-mono">
                            ZAR {req.amount.toFixed(2)}
                          </span>
                          {req.escrowStatus === 'held' && req.escrowReleaseAt && (
                            <span className="text-[11px] text-purple-300 font-bold bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">schedule</span>
                              {getRemainingDays(req.escrowReleaseAt)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto">
                          <button
                            onClick={() => {
                              setPreviewVideoUrl(req.videoId.videoUrl);
                              setPreviewVideoTitle(req.videoId.title);
                            }}
                            className="bg-white/5 hover:bg-white/10 border border-white/10 text-cloud-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 justify-center flex-1 md:flex-none cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px] text-toka-flare">play_circle</span>
                            <span>View Video</span>
                          </button>
                          
                          {isDisputable && (
                            <button
                              disabled={actionLoadingId !== null}
                              onClick={() => handleAction(req._id, 'dispute')}
                              className="bg-red-500/15 border border-red-500/30 hover:bg-red-500 hover:text-cloud-white text-red-400 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 justify-center flex-1 md:flex-none active:scale-95 cursor-pointer"
                            >
                              {actionLoadingId === req._id ? (
                                <span className="w-4 h-4 border-2 border-cloud-white border-t-transparent rounded-full animate-spin"></span>
                              ) : (
                                <>
                                  <span className="material-symbols-outlined text-[16px]">gavel</span>
                                  <span>Dispute Payout</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        ) : (
          /* CREATOR VIEW */
          <div className="flex flex-col gap-6">
            
            {/* Unified Segmented Slider Track for Tabs */}
            <div className="w-fit bg-black/50 p-1.5 rounded-2xl border border-white/10 flex items-center gap-1 select-none">
              <button
                onClick={() => setCreatorTab('sent')}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  creatorTab === 'sent'
                    ? 'bg-white/15 text-white shadow-md font-black'
                    : 'text-cloud-white/50 hover:text-cloud-white/80 hover:bg-white/[0.03]'
                }`}
              >
                My Requests ({sentRequests.length})
              </button>
              <button
                onClick={() => setCreatorTab('directory')}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  creatorTab === 'directory'
                    ? 'bg-white/15 text-white shadow-md font-black'
                    : 'text-cloud-white/50 hover:text-cloud-white/80 hover:bg-white/[0.03]'
                }`}
              >
                Verified Brands ({directoryUsers.length})
              </button>
            </div>

            {fetching ? (
              <div className="flex justify-center py-16">
                <span className="w-10 h-10 border-4 border-toka-flare border-t-transparent rounded-full animate-spin"></span>
              </div>
            ) : creatorTab === 'sent' ? (
              sentRequests.length === 0 ? (
                <div className="bg-shaded-canopy/60 border border-white/10 rounded-3xl p-16 text-center flex flex-col items-center gap-3 shadow-xl">
                  <span className="material-symbols-outlined text-[54px] text-cloud-white/20">outbox</span>
                  <h3 className="font-bold text-cloud-white/80 text-base">No requests sent yet</h3>
                  <p className="text-xs text-cloud-white/40 max-w-sm leading-relaxed">
                    Upload a video and toggle &quot;Request Brand Sponsorship&quot; to pitch your content to verified brands.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {sentRequests.map((req) => {
                    const isPending = req.status === 'pending';
                    return (
                      <div key={req._id} className="bg-shaded-canopy border border-white/10 hover:border-white/20 rounded-3xl p-5 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-5 shadow-xl transition-all">
                        
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-toka-flare to-orange-700 p-0.5 shadow-md shrink-0">
                            <div className="w-full h-full rounded-full bg-midnight-boma flex items-center justify-center font-black text-sm text-cloud-white uppercase">
                              {req.brandId.username.charAt(0)}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2.5">
                              <h4 className="text-base font-black text-cloud-white">@{req.brandId.username}</h4>
                              {getStatusBadge(req.status, req.escrowStatus)}
                            </div>
                            <p className="text-xs text-cloud-white/50 mt-1 truncate max-w-md">
                              Video: &quot;{req.videoId?.title || 'Creator Video'}&quot;
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col md:items-end gap-1.5">
                          <span className="text-lg font-black text-fintech-mint font-mono">
                            ZAR {req.amount.toFixed(2)}
                          </span>
                          {req.escrowStatus === 'held' && req.escrowReleaseAt && (
                            <span className="text-[11px] text-purple-300 font-bold bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <span className="material-symbols-outlined text-[13px]">schedule</span>
                              {getRemainingDays(req.escrowReleaseAt)}
                            </span>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-3 w-full md:w-auto">
                          <button
                            onClick={() => {
                              setPreviewVideoUrl(req.videoId.videoUrl);
                              setPreviewVideoTitle(req.videoId.title);
                            }}
                            className="bg-white/5 hover:bg-white/10 border border-white/10 text-cloud-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 justify-center flex-1 md:flex-none cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px] text-toka-flare">play_circle</span>
                            <span>View Video</span>
                          </button>

                          {isPending && (
                            <button
                              disabled={actionLoadingId !== null}
                              onClick={() => handleAction(req._id, 'withdraw')}
                              className="w-full md:w-auto bg-white/5 border border-white/10 hover:bg-red-500/15 hover:border-red-500/30 hover:text-red-400 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 justify-center active:scale-95 cursor-pointer"
                            >
                              {actionLoadingId === req._id ? (
                                <span className="w-4 h-4 border-2 border-cloud-white border-t-transparent rounded-full animate-spin"></span>
                              ) : (
                                <>
                                  <span className="material-symbols-outlined text-[16px]">cancel</span>
                                  <span>Withdraw</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* Verified Brands Directory */
              directoryUsers.length === 0 ? (
                <div className="bg-shaded-canopy/60 border border-white/10 rounded-3xl p-16 text-center flex flex-col items-center gap-3 shadow-xl">
                  <span className="material-symbols-outlined text-[54px] text-cloud-white/20">search</span>
                  <h3 className="font-bold text-cloud-white/80 text-base">No brands found</h3>
                  <p className="text-xs text-cloud-white/40 max-w-xs leading-relaxed">
                    There are currently no verified brand accounts in the platform directory.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                  {directoryUsers.map((user) => (
                    <div key={user._id} className="bg-shaded-canopy border border-white/10 hover:border-white/20 rounded-3xl p-6 flex flex-col gap-4 items-center text-center shadow-xl transition-all group">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-toka-flare to-amber-500 p-0.5 shadow-md">
                        <div className="w-full h-full rounded-full bg-midnight-boma flex items-center justify-center font-black text-xl text-cloud-white uppercase">
                          {user.username.charAt(0)}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-base font-black text-cloud-white">@{user.username}</h4>
                        <span className="inline-flex items-center gap-1 bg-fintech-mint/15 text-fintech-mint border border-fintech-mint/30 px-2 py-0.2 rounded-full text-[10px] font-bold font-mono mt-1">
                          <IconShieldCheck className="w-3 h-3" />
                          Verified Brand
                        </span>
                      </div>
                      <Link 
                        href={`/profile?username=${encodeURIComponent(user.username)}`}
                        className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-cloud-white py-2.5 rounded-xl text-xs font-bold transition-all text-center mt-2 group-hover:border-white/25 active:scale-95"
                      >
                        View Brand Profile
                      </Link>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </main>

      {/* Video Preview Modal */}
      {previewVideoUrl && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-shaded-canopy border border-white/10 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col relative max-h-[90vh]">
            
            <button 
              onClick={() => setPreviewVideoUrl(null)} 
              className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-cloud-white p-2 rounded-full transition-all z-10 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px] block">close</span>
            </button>

            <div className="p-5 border-b border-white/10 bg-black/20">
              <h3 className="text-sm font-bold text-cloud-white truncate pr-10">Reviewing Post: &quot;{previewVideoTitle}&quot;</h3>
            </div>

            <div className="flex-1 bg-black flex items-center justify-center min-h-[300px] overflow-hidden">
              <video 
                src={previewVideoUrl} 
                controls 
                autoPlay
                className="max-h-[60vh] w-full object-contain"
              />
            </div>
            
            <div className="p-4 border-t border-white/10 bg-black/20 text-center text-[10px] text-cloud-white/40 font-mono select-none">
              Streamed securely from media buckets. Video will be visible to public upon approval.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
