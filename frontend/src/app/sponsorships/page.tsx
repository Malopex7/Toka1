"use client";
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

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

export default function SponsorshipsPage() {
  const router = useRouter();
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

  const getStatusBadge = (status: string, escrow: string, releaseAt: string | null) => {
    if (status === 'approved' && escrow === 'held') {
      const days = releaseAt ? Math.max(1, Math.ceil((new Date(releaseAt).getTime() - nowTime) / (1000 * 60 * 60 * 24))) : 7;
      return (
        <span className="inline-flex items-center gap-1 text-purple-400 font-mono text-xs font-semibold">
          <span>🔒</span> Escrow ({days}d)
        </span>
      );
    }
    if (status === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 text-fintech-mint font-mono text-xs font-semibold">
          <span>✓</span> Completed
        </span>
      );
    }
    if (status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 text-amber-400 font-mono text-xs font-semibold">
          <span>⏳</span> Pending
        </span>
      );
    }
    if (status === 'disputed') {
      return (
        <span className="inline-flex items-center gap-1 text-red-400 font-mono text-xs font-semibold">
          <span>⚠️</span> Disputed
        </span>
      );
    }
    return (
      <span className="text-cloud-white/40 font-mono text-xs font-semibold uppercase">
        {status}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-midnight-boma text-cloud-white font-sans">
        <span className="w-8 h-8 border-3 border-toka-flare border-t-transparent rounded-full animate-spin"></span>
      </div>
    );
  }

  if (!isAuthenticated || !mongooseUser?.isBrandSafeVerified) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-midnight-boma text-cloud-white gap-4 font-sans px-6 text-center select-none">
        <span className="material-symbols-outlined text-[48px] text-toka-flare">lock</span>
        <h1 className="text-xl font-bold tracking-tight">Access Restricted</h1>
        <p className="text-xs text-cloud-white/60 max-w-sm">
          Sponsorship requests and escrow features are restricted to verified accounts.
        </p>
        <Link href="/" className="px-5 py-2.5 bg-toka-flare hover:bg-toka-flare/90 rounded-xl font-bold transition-all text-xs active:scale-95 shadow-md">
          Return to Feed
        </Link>
      </div>
    );
  }

  const isBrand = mongooseUser.role === 'brand';
  const totalEscrowHeld = sentRequests
    .filter(r => r.status === 'approved' && r.escrowStatus === 'held')
    .reduce((sum, r) => sum + r.amount, 0);

  const activeDealsCount = isBrand ? brandRequests.length : sentRequests.length;
  const availablePayout = mongooseUser.walletBalance;

  return (
    <div className="min-h-screen bg-midnight-boma text-cloud-white font-sans antialiased select-none pb-24">
      
      <main className="max-w-5xl mx-auto px-4 md:px-8 py-8 flex flex-col gap-6 w-full">
        
        {/* Back Link */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs text-cloud-white/50 hover:text-cloud-white transition-colors w-fit cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back</span>
        </button>

        {/* Clean Typography Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-cloud-white">
              Sponsorships
            </h1>
            <p className="text-xs text-cloud-white/50 mt-1">
              Manage brand deals and escrow
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-left sm:text-right">
              <span className="text-[10px] text-cloud-white/40 uppercase font-mono block">Available Payout</span>
              <span className="text-base font-bold font-mono text-cloud-white">
                ZAR {availablePayout.toFixed(2)}
              </span>
            </div>
            <Link
              href="/deposit"
              className="px-3.5 py-1.5 bg-white/10 hover:bg-white/15 text-cloud-white text-xs font-semibold rounded-xl border border-white/10 transition-all active:scale-95 cursor-pointer font-mono"
            >
              Withdraw
            </Link>
          </div>
        </div>

        {/* Seamless Linear Metric Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 border-y border-white/10 py-5 my-1 gap-4 md:gap-0">
          
          <div className="flex flex-col gap-1 md:pr-6 md:border-r border-white/10">
            <span className="text-xs text-cloud-white/50 font-medium">Active Deals</span>
            <span className="text-2xl font-black font-mono text-cloud-white">{activeDealsCount}</span>
          </div>

          <div className="flex flex-col gap-1 md:px-6 md:border-r border-white/10">
            <span className="text-xs text-cloud-white/50 font-medium">In Escrow</span>
            <span className="text-2xl font-black font-mono text-cloud-white">
              ZAR {totalEscrowHeld.toFixed(2)}
            </span>
          </div>

          <div className="flex flex-col gap-1 md:px-6 md:border-r border-white/10">
            <span className="text-xs text-cloud-white/50 font-medium">Available</span>
            <span className="text-2xl font-black font-mono text-fintech-mint">
              ZAR {availablePayout.toFixed(2)}
            </span>
          </div>

          <div className="flex flex-col gap-1 md:pl-6">
            <span className="text-xs text-cloud-white/50 font-medium">Trust</span>
            <span className="text-2xl font-black font-mono text-cloud-white flex items-center gap-1.5">
              100% <span className="text-base">🛡️</span>
            </span>
          </div>

        </div>

        {/* Global Feedback message */}
        {message && (
          <div className={`px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-fintech-mint/10 text-fintech-mint border border-fintech-mint/30'
              : 'bg-red-500/10 text-red-400 border border-red-500/30'
          }`}>
            <span>{message.type === 'success' ? '✓' : '⚠️'}</span>
            <span>{message.text}</span>
          </div>
        )}

        {/* Linear Minimalist Tab Switcher */}
        <div className="flex items-center gap-3 border-b border-white/10 pb-3 mt-1">
          {isBrand ? (
            <>
              <button
                onClick={() => setBrandTab('inbox')}
                className={`text-xs font-bold uppercase tracking-wider pb-1 transition-all cursor-pointer ${
                  brandTab === 'inbox'
                    ? 'text-cloud-white border-b-2 border-toka-flare'
                    : 'text-cloud-white/40 hover:text-cloud-white/70'
                }`}
              >
                Requests ({brandRequests.length})
              </button>
              <button
                onClick={() => setBrandTab('history')}
                className={`text-xs font-bold uppercase tracking-wider pb-1 transition-all cursor-pointer ${
                  brandTab === 'history'
                    ? 'text-cloud-white border-b-2 border-toka-flare'
                    : 'text-cloud-white/40 hover:text-cloud-white/70'
                }`}
              >
                History ({sentRequests.length})
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setCreatorTab('sent')}
                className={`text-xs font-bold uppercase tracking-wider pb-1 transition-all cursor-pointer ${
                  creatorTab === 'sent'
                    ? 'text-cloud-white border-b-2 border-toka-flare'
                    : 'text-cloud-white/40 hover:text-cloud-white/70'
                }`}
              >
                Requests ({sentRequests.length})
              </button>
              <button
                onClick={() => setCreatorTab('directory')}
                className={`text-xs font-bold uppercase tracking-wider pb-1 transition-all cursor-pointer ${
                  creatorTab === 'directory'
                    ? 'text-cloud-white border-b-2 border-toka-flare'
                    : 'text-cloud-white/40 hover:text-cloud-white/70'
                }`}
              >
                Verified Brands ({directoryUsers.length})
              </button>
            </>
          )}
        </div>

        {/* Content Section */}
        {fetching ? (
          <div className="flex justify-center py-16">
            <span className="w-8 h-8 border-3 border-toka-flare border-t-transparent rounded-full animate-spin"></span>
          </div>
        ) : isBrand ? (
          /* BRAND VIEW */
          brandTab === 'inbox' ? (
            brandRequests.length === 0 ? (
              <div className="py-16 text-center text-cloud-white/40 text-xs">
                No pending requests. Verified creators will pitch deals here.
              </div>
            ) : (
              <div className="flex flex-col">
                {/* Table Header */}
                <div className="grid grid-cols-12 text-[10px] font-mono uppercase font-bold text-cloud-white/40 border-b border-white/10 pb-2 px-3">
                  <div className="col-span-5">Creator &amp; Campaign</div>
                  <div className="col-span-3">Status</div>
                  <div className="col-span-2 text-right">Budget</div>
                  <div className="col-span-2 text-right">Action</div>
                </div>

                {/* Rows */}
                {brandRequests.map((req) => {
                  const balanceError = mongooseUser.walletBalance < req.amount;
                  return (
                    <div
                      key={req._id}
                      className="grid grid-cols-12 items-center border-b border-white/5 hover:bg-white/[0.02] py-4 px-3 transition-colors text-xs"
                    >
                      <div className="col-span-5 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xs text-toka-flare shrink-0 font-mono">
                          {req.creatorId.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col truncate pr-2">
                          <span className="font-bold text-cloud-white">@{req.creatorId.username}</span>
                          <span className="text-[11px] text-cloud-white/50 truncate">
                            Video: &quot;{req.videoId?.title || 'Creator Video'}&quot;
                          </span>
                        </div>
                      </div>

                      <div className="col-span-3">
                        {getStatusBadge(req.status, req.escrowStatus, req.escrowReleaseAt)}
                      </div>

                      <div className="col-span-2 text-right font-mono font-bold text-cloud-white">
                        ZAR {req.amount.toFixed(2)}
                      </div>

                      <div className="col-span-2 flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setPreviewVideoUrl(req.videoId.videoUrl);
                            setPreviewVideoTitle(req.videoId.title);
                          }}
                          className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-cloud-white rounded-lg text-xs font-medium transition-all cursor-pointer"
                        >
                          View
                        </button>
                        <button
                          disabled={actionLoadingId !== null || balanceError}
                          onClick={() => handleAction(req._id, 'approve')}
                          className="px-2.5 py-1 bg-toka-flare hover:bg-toka-flare/90 disabled:opacity-50 text-cloud-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                        >
                          Approve
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* History */
            sentRequests.length === 0 ? (
              <div className="py-16 text-center text-cloud-white/40 text-xs">
                No sponsorship history found.
              </div>
            ) : (
              <div className="flex flex-col">
                <div className="grid grid-cols-12 text-[10px] font-mono uppercase font-bold text-cloud-white/40 border-b border-white/10 pb-2 px-3">
                  <div className="col-span-5">Creator &amp; Campaign</div>
                  <div className="col-span-3">Status</div>
                  <div className="col-span-2 text-right">Amount</div>
                  <div className="col-span-2 text-right">Action</div>
                </div>

                {sentRequests.map((req) => (
                  <div
                    key={req._id}
                    className="grid grid-cols-12 items-center border-b border-white/5 hover:bg-white/[0.02] py-4 px-3 transition-colors text-xs"
                  >
                    <div className="col-span-5 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xs text-toka-flare shrink-0 font-mono">
                        {req.creatorId.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col truncate pr-2">
                        <span className="font-bold text-cloud-white">@{req.creatorId.username}</span>
                        <span className="text-[11px] text-cloud-white/50 truncate">
                          Video: &quot;{req.videoId?.title || 'Creator Video'}&quot;
                        </span>
                      </div>
                    </div>

                    <div className="col-span-3">
                      {getStatusBadge(req.status, req.escrowStatus, req.escrowReleaseAt)}
                    </div>

                    <div className="col-span-2 text-right font-mono font-bold text-cloud-white">
                      ZAR {req.amount.toFixed(2)}
                    </div>

                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setPreviewVideoUrl(req.videoId.videoUrl);
                          setPreviewVideoTitle(req.videoId.title);
                        }}
                        className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-cloud-white rounded-lg text-xs font-medium transition-all cursor-pointer"
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )
        ) : (
          /* CREATOR VIEW */
          creatorTab === 'sent' ? (
            sentRequests.length === 0 ? (
              <div className="py-16 text-center text-cloud-white/40 text-xs">
                No requests sent yet. Pitch a brand sponsorship when uploading a video.
              </div>
            ) : (
              <div className="flex flex-col">
                {/* Table Header */}
                <div className="grid grid-cols-12 text-[10px] font-mono uppercase font-bold text-cloud-white/40 border-b border-white/10 pb-2 px-3">
                  <div className="col-span-5">Brand &amp; Campaign</div>
                  <div className="col-span-3">Status</div>
                  <div className="col-span-2 text-right">Payout</div>
                  <div className="col-span-2 text-right">Action</div>
                </div>

                {/* Table Rows */}
                {sentRequests.map((req) => {
                  const isPending = req.status === 'pending';
                  return (
                    <div
                      key={req._id}
                      className="grid grid-cols-12 items-center border-b border-white/5 hover:bg-white/[0.02] py-4 px-3 transition-colors text-xs"
                    >
                      <div className="col-span-5 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xs text-toka-flare shrink-0 font-mono">
                          {req.brandId.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col truncate pr-2">
                          <span className="font-bold text-cloud-white">@{req.brandId.username}</span>
                          <span className="text-[11px] text-cloud-white/50 truncate">
                            Video: &quot;{req.videoId?.title || 'Creator Video'}&quot;
                          </span>
                        </div>
                      </div>

                      <div className="col-span-3">
                        {getStatusBadge(req.status, req.escrowStatus, req.escrowReleaseAt)}
                      </div>

                      <div className="col-span-2 text-right font-mono font-bold text-cloud-white">
                        ZAR {req.amount.toFixed(2)}
                      </div>

                      <div className="col-span-2 flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setPreviewVideoUrl(req.videoId.videoUrl);
                            setPreviewVideoTitle(req.videoId.title);
                          }}
                          className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-cloud-white rounded-lg text-xs font-medium transition-all cursor-pointer"
                        >
                          View
                        </button>
                        {isPending && (
                          <button
                            disabled={actionLoadingId !== null}
                            onClick={() => handleAction(req._id, 'withdraw')}
                            className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          >
                            Withdraw
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
              <div className="py-16 text-center text-cloud-white/40 text-xs">
                No verified brand accounts found in directory.
              </div>
            ) : (
              <div className="flex flex-col">
                <div className="grid grid-cols-12 text-[10px] font-mono uppercase font-bold text-cloud-white/40 border-b border-white/10 pb-2 px-3">
                  <div className="col-span-6">Brand Account</div>
                  <div className="col-span-3">Verification</div>
                  <div className="col-span-3 text-right">Profile</div>
                </div>

                {directoryUsers.map((user) => (
                  <div
                    key={user._id}
                    className="grid grid-cols-12 items-center border-b border-white/5 hover:bg-white/[0.02] py-4 px-3 transition-colors text-xs"
                  >
                    <div className="col-span-6 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xs text-toka-flare shrink-0 font-mono">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold text-cloud-white">@{user.username}</span>
                    </div>

                    <div className="col-span-3">
                      <span className="text-fintech-mint font-mono text-xs font-medium">🛡️ Verified Brand</span>
                    </div>

                    <div className="col-span-3 text-right">
                      <Link
                        href={`/profile?username=${encodeURIComponent(user.username)}`}
                        className="px-3 py-1 bg-white/5 hover:bg-white/10 text-cloud-white rounded-lg text-xs font-medium transition-all inline-block"
                      >
                        View Profile
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )
          )
        )}
      </main>

      {/* Video Preview Modal */}
      {previewVideoUrl && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-[#18181B] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col relative max-h-[85vh]">
            
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-xs font-bold text-cloud-white truncate pr-4">&quot;{previewVideoTitle}&quot;</h3>
              <button 
                onClick={() => setPreviewVideoUrl(null)} 
                className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-cloud-white/70 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <div className="flex-1 bg-black flex items-center justify-center min-h-[260px] overflow-hidden">
              <video 
                src={previewVideoUrl} 
                controls 
                autoPlay
                className="max-h-[55vh] w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
