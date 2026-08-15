"use client";
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

interface UserInfo {
  _id: string;
  username: string;
  email: string;
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
  const { isAuthenticated, mongooseUser, firebaseUser, isLoading, refreshProfile } = useAuth();
  
  // Impure function Date.now() isolation
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
        // Fetch Brand inbox and history
        const [inboxRes, historyRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sponsorships/brand/pending`, { headers }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sponsorships/brand/pending?all=true`, { headers })
        ]);

        const inboxJson = await inboxRes.json();
        const historyJson = await historyRes.json();

        if (inboxJson.status === 'success') setBrandRequests(inboxJson.data.requests);
        if (historyJson.status === 'success') {
          // Filter out pending in the history tab to keep it clean
          const historyFiltered = historyJson.data.requests.filter(
            (r: SponsorshipRequest) => r.status !== 'pending'
          );
          setSentRequests(historyFiltered); // We store brand history in the same list state
        }
      } else {
        // Fetch Creator sent requests and directory
        const [sentRes, dirRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sponsorships/creator/sent`, { headers }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/directory`, { headers })
        ]);

        const sentJson = await sentRes.json();
        const dirJson = await dirRes.json();

        if (sentJson.status === 'success') setSentRequests(sentJson.data.requests);
        if (dirJson.status === 'success') setDirectoryUsers(dirJson.data.users);
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
        refreshProfile(); // Hydrates wallet balances
        loadData(); // Reloads lists
      } else {
        setMessage({ text: json.message || 'Action failed.', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'Network connection failed.', type: 'error' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusStyle = (status: string, escrow: string) => {
    switch (status) {
      case 'completed':
        return 'bg-fintech-mint/10 text-fintech-mint border-fintech-mint/30';
      case 'disputed':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'approved':
        return escrow === 'held'
          ? 'bg-purple-500/10 text-purple-400 border-purple-400/30 shadow-[0_0_8px_rgba(168,85,247,0.1)]'
          : 'bg-green-500/10 text-green-400 border-green-500/30';
      case 'rejected':
        return 'bg-cloud-white/10 text-cloud-white/40 border-white/5';
      case 'withdrawn':
        return 'bg-cloud-white/10 text-cloud-white/40 border-white/5';
      default:
        return 'bg-toka-flare/10 text-toka-flare border-toka-flare/30';
    }
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
          Sponsorship requests and escrow features are restricted to verified accounts. Please request verification from the Moderator Panel.
        </p>
        <Link href="/" className="px-6 py-3 bg-toka-flare hover:bg-toka-flare/90 rounded-xl font-bold transition-all text-xs active:scale-95 shadow-lg">
          Return to Feed
        </Link>
      </div>
    );
  }

  const isBrand = mongooseUser.role === 'brand';

  return (
    <div className="min-h-screen bg-midnight-boma text-cloud-white font-sans p-6 md:p-10 select-none pb-24">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-shaded-canopy border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 w-64 h-64 bg-toka-flare/5 blur-[80px] rounded-full pointer-events-none"></div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-toka-flare text-[28px]">handshake</span>
              <h1 className="text-2xl font-black tracking-tight">Sponsorship Dashboard</h1>
            </div>
            <p className="text-xs text-cloud-white/50 mt-1">
              Secure payments via escrow, review tagged videos, and manage platform sponsorships.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-black/35 border border-white/10 px-5 py-3 rounded-2xl">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-cloud-white/40 uppercase font-mono">Wallet Balance</span>
              <span className="text-base font-black text-fintech-mint font-mono">
                ZAR {mongooseUser.walletBalance.toFixed(2)}
              </span>
            </div>
            <Link 
              href="/deposit" 
              className="bg-toka-flare hover:bg-toka-flare/90 text-cloud-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-[0_2px_10px_rgba(255,79,0,0.2)] active:scale-95 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">add_card</span>
              Top Up
            </Link>
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

        {/* Brand View */}
        {isBrand ? (
          <div className="flex flex-col gap-6">
            
            {/* Tabs */}
            <div className="flex gap-2.5 border-b border-white/5 pb-2">
              <button
                onClick={() => setBrandTab('inbox')}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  brandTab === 'inbox'
                    ? 'bg-white/10 text-cloud-white border border-white/10'
                    : 'text-cloud-white/50 hover:text-cloud-white hover:bg-white/5'
                }`}
              >
                Pending Requests ({brandRequests.length})
              </button>
              <button
                onClick={() => setBrandTab('history')}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  brandTab === 'history'
                    ? 'bg-white/10 text-cloud-white border border-white/10'
                    : 'text-cloud-white/50 hover:text-cloud-white hover:bg-white/5'
                }`}
              >
                Sponsorship History
              </button>
            </div>

            {fetching ? (
              <div className="flex justify-center py-12">
                <span className="w-8 h-8 border-3 border-toka-flare border-t-transparent rounded-full animate-spin"></span>
              </div>
            ) : brandTab === 'inbox' ? (
              /* Brand Pending Inbox */
              brandRequests.length === 0 ? (
                <div className="bg-shaded-canopy/40 border border-white/5 rounded-3xl p-12 text-center flex flex-col items-center gap-3">
                  <span className="material-symbols-outlined text-[48px] text-cloud-white/20">mail_outline</span>
                  <h3 className="font-bold text-cloud-white/70">Inbox is empty</h3>
                  <p className="text-xs text-cloud-white/40 max-w-xs">Verified creators will tag you in sponsorship requests here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {brandRequests.map((req) => {
                    const balanceError = mongooseUser.walletBalance < req.amount;
                    return (
                      <div key={req._id} className="bg-shaded-canopy border border-white/5 rounded-3xl p-6 flex flex-col gap-4 shadow-lg backdrop-blur-md relative overflow-hidden">
                        <div className="absolute top-0 right-0 bg-toka-flare/10 text-toka-flare text-[9px] font-black px-3 py-1 rounded-bl-2xl uppercase border-l border-b border-white/5">
                          Pending Approval
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center font-black text-sm text-toka-flare font-mono">
                            {req.creatorId.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-cloud-white">@{req.creatorId.username}</h4>
                            <p className="text-[10px] text-cloud-white/40">Requested: {new Date(req.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>

                        <div className="bg-black/20 rounded-2xl p-4 flex flex-col gap-2.5 border border-white/5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-cloud-white/50">Video post:</span>
                            <span className="font-bold text-cloud-white truncate max-w-[200px]">&quot;{req.videoId?.title}&quot;</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-cloud-white/50">Budget request:</span>
                            <span className="font-black text-fintech-mint font-mono">ZAR {req.amount.toFixed(2)}</span>
                          </div>
                          {req.terms && (
                            <div className="text-[11px] text-cloud-white/60 bg-black/40 border border-white/5 p-2.5 rounded-xl mt-1.5 leading-normal">
                              <strong>Terms:</strong> {req.terms}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-3 mt-2">
                          <button
                            onClick={() => {
                              setPreviewVideoUrl(req.videoId.videoUrl);
                              setPreviewVideoTitle(req.videoId.title);
                            }}
                            className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-cloud-white py-2.5 rounded-xl text-xs font-bold transition-all flex justify-center items-center gap-1.5"
                          >
                            <span className="material-symbols-outlined text-[18px]">play_circle</span>
                            Review Video
                          </button>
                          
                          <button
                            disabled={actionLoadingId !== null || balanceError}
                            onClick={() => handleAction(req._id, 'approve')}
                            className="flex-1 bg-toka-flare hover:bg-toka-flare/90 disabled:opacity-50 text-cloud-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-[0_2px_10px_rgba(255,79,0,0.2)] active:scale-95 flex justify-center items-center gap-1"
                          >
                            {actionLoadingId === req._id ? (
                              <span className="w-4 h-4 border-2 border-cloud-white border-t-transparent rounded-full animate-spin"></span>
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-[16px]">check</span>
                                Approve & Pay
                              </>
                            )}
                          </button>
                          
                          <button
                            disabled={actionLoadingId !== null}
                            onClick={() => handleAction(req._id, 'reject')}
                            className="bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/35 text-cloud-white hover:text-red-400 p-2.5 rounded-xl transition-all flex items-center justify-center"
                            title="Decline Request"
                          >
                            <span className="material-symbols-outlined text-[18px]">close</span>
                          </button>
                        </div>

                        {balanceError && (
                          <div className="bg-red-500/10 border border-red-500/35 text-red-500 text-[10px] font-bold p-2.5 rounded-xl flex items-center gap-1.5 mt-1 select-none">
                            <span className="material-symbols-outlined text-[14px]">warning</span>
                            <span>Warning: Wallet balance too low. Please top up to approve.</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* Brand History List */
              sentRequests.length === 0 ? (
                <div className="bg-shaded-canopy/40 border border-white/5 rounded-3xl p-12 text-center flex flex-col items-center gap-3">
                  <span className="material-symbols-outlined text-[48px] text-cloud-white/20">history</span>
                  <h3 className="font-bold text-cloud-white/70">No sponsorship history</h3>
                  <p className="text-xs text-cloud-white/40 max-w-xs">Your completed, active, and rejected requests will show up here.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {sentRequests.map((req) => {
                    const isDisputable = req.status === 'approved' && req.escrowStatus === 'held';
                    return (
                      <div key={req._id} className="bg-shaded-canopy border border-white/5 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center font-black text-sm text-toka-flare font-mono">
                            {req.creatorId.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-cloud-white">@{req.creatorId.username}</h4>
                              <span className={`text-[9px] font-black tracking-wider uppercase border px-2.5 py-0.5 rounded-full ${getStatusStyle(req.status, req.escrowStatus)}`}>
                                {req.status === 'approved' && req.escrowStatus === 'held' ? 'Escrow Held' : req.status}
                              </span>
                            </div>
                            <p className="text-xs text-cloud-white/50 mt-1 truncate max-w-[280px]">
                              Video: &quot;{req.videoId?.title || 'Unknown Video'}&quot;
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col md:items-end gap-1.5">
                          <span className="text-sm font-black text-fintech-mint font-mono">ZAR {req.amount.toFixed(2)}</span>
                          {req.escrowStatus === 'held' && req.escrowReleaseAt && (
                            <span className="text-[10px] text-purple-400 font-bold bg-purple-500/5 border border-purple-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px]">schedule</span>
                              {getRemainingDays(req.escrowReleaseAt)}
                            </span>
                          )}
                        </div>

                        {/* Dispute/Actions */}
                        <div className="flex gap-2 w-full md:w-auto">
                          <button
                            onClick={() => {
                              setPreviewVideoUrl(req.videoId.videoUrl);
                              setPreviewVideoTitle(req.videoId.title);
                            }}
                            className="bg-white/5 hover:bg-white/10 border border-white/10 text-cloud-white px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 justify-center flex-1 md:flex-none"
                          >
                            <span className="material-symbols-outlined text-[16px]">play_circle</span>
                            View Video
                          </button>
                          
                          {isDisputable && (
                            <button
                              disabled={actionLoadingId !== null}
                              onClick={() => handleAction(req._id, 'dispute')}
                              className="bg-red-500/10 border border-red-500/35 hover:bg-red-500 hover:text-cloud-white text-red-400 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 justify-center flex-1 md:flex-none active:scale-95"
                            >
                              {actionLoadingId === req._id ? (
                                <span className="w-4 h-4 border-2 border-cloud-white border-t-transparent rounded-full animate-spin"></span>
                              ) : (
                                <>
                                  <span className="material-symbols-outlined text-[16px]">gavel</span>
                                  Dispute Payout
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
          /* Creator View */
          <div className="flex flex-col gap-6">
            
            {/* Tabs */}
            <div className="flex gap-2.5 border-b border-white/5 pb-2">
              <button
                onClick={() => setCreatorTab('sent')}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  creatorTab === 'sent'
                    ? 'bg-white/10 text-cloud-white border border-white/10'
                    : 'text-cloud-white/50 hover:text-cloud-white hover:bg-white/5'
                }`}
              >
                My Requests ({sentRequests.length})
              </button>
              <button
                onClick={() => setCreatorTab('directory')}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  creatorTab === 'directory'
                    ? 'bg-white/10 text-cloud-white border border-white/10'
                    : 'text-cloud-white/50 hover:text-cloud-white hover:bg-white/5'
                }`}
              >
                Verified Brands ({directoryUsers.length})
              </button>
            </div>

            {fetching ? (
              <div className="flex justify-center py-12">
                <span className="w-8 h-8 border-3 border-toka-flare border-t-transparent rounded-full animate-spin"></span>
              </div>
            ) : creatorTab === 'sent' ? (
              /* Creator Sent Requests list */
              sentRequests.length === 0 ? (
                <div className="bg-shaded-canopy/40 border border-white/5 rounded-3xl p-12 text-center flex flex-col items-center gap-3">
                  <span className="material-symbols-outlined text-[48px] text-cloud-white/20">outbox</span>
                  <h3 className="font-bold text-cloud-white/70">No requests sent yet</h3>
                  <p className="text-xs text-cloud-white/40 max-w-xs">Upload a video and select the &quot;Request Brand Sponsorship&quot; checkbox to start pitching.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {sentRequests.map((req) => {
                    const isPending = req.status === 'pending';
                    return (
                      <div key={req._id} className="bg-shaded-canopy border border-white/5 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden">
                        
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-full flex items-center justify-center font-black text-sm text-toka-flare font-mono">
                            {req.brandId.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-cloud-white">@{req.brandId.username}</h4>
                              <span className={`text-[9px] font-black tracking-wider uppercase border px-2.5 py-0.5 rounded-full ${getStatusStyle(req.status, req.escrowStatus)}`}>
                                {req.status === 'approved' && req.escrowStatus === 'held' ? 'Escrow Held' : req.status}
                              </span>
                            </div>
                            <p className="text-xs text-cloud-white/50 mt-1 truncate max-w-[280px]">
                              Video: &quot;{req.videoId?.title || 'Unknown Video'}&quot;
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col md:items-end gap-1.5">
                          <span className="text-sm font-black text-fintech-mint font-mono">ZAR {req.amount.toFixed(2)}</span>
                          {req.escrowStatus === 'held' && req.escrowReleaseAt && (
                            <span className="text-[10px] text-purple-400 font-bold bg-purple-500/5 border border-purple-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px]">schedule</span>
                              {getRemainingDays(req.escrowReleaseAt)}
                            </span>
                          )}
                        </div>

                        {/* Withdraw button for pending */}
                        {isPending && (
                          <button
                            disabled={actionLoadingId !== null}
                            onClick={() => handleAction(req._id, 'withdraw')}
                            className="w-full md:w-auto bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/35 hover:text-red-400 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 justify-center active:scale-95"
                          >
                            {actionLoadingId === req._id ? (
                              <span className="w-4 h-4 border-2 border-cloud-white border-t-transparent rounded-full animate-spin"></span>
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-[16px]">cancel</span>
                                Withdraw
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              /* Creator Directory for Brands list */
              directoryUsers.length === 0 ? (
                <div className="bg-shaded-canopy/40 border border-white/5 rounded-3xl p-12 text-center flex flex-col items-center gap-3">
                  <span className="material-symbols-outlined text-[48px] text-cloud-white/20">search</span>
                  <h3 className="font-bold text-cloud-white/70">No brands found</h3>
                  <p className="text-xs text-cloud-white/40 max-w-xs">There are currently no verified brands registered on the platform.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {directoryUsers.map((user) => (
                    <div key={user._id} className="bg-shaded-canopy border border-white/5 rounded-3xl p-6 flex flex-col gap-4 relative overflow-hidden items-center text-center">
                      <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-full flex items-center justify-center font-black text-lg text-toka-flare font-mono">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-cloud-white">@{user.username}</h4>
                        <span className="text-[10px] font-black tracking-wide text-fintech-mint/70 uppercase">Verified Brand</span>
                      </div>
                      <Link 
                        href={`/profile/${user.username}`}
                        className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-cloud-white py-2 rounded-xl text-xs font-bold transition-all text-center"
                      >
                        View Profile
                      </Link>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Video Preview Modal */}
      {previewVideoUrl && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-shaded-canopy border border-white/10 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col relative max-h-[90vh]">
            
            <button 
              onClick={() => setPreviewVideoUrl(null)} 
              className="absolute top-4 right-4 bg-black/40 hover:bg-black/60 text-cloud-white p-2 rounded-full transition-all z-10"
            >
              <span className="material-symbols-outlined text-[20px] block">close</span>
            </button>

            <div className="p-5 border-b border-white/5 bg-black/20">
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
            
            <div className="p-4 border-t border-white/5 bg-black/20 text-center text-[10px] text-cloud-white/40 font-mono select-none">
              Streamed securely from media buckets. Video will be visible to public upon approval.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
