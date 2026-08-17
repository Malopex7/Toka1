"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import PageHeader from '@/components/PageHeader';

interface Transaction {
  _id: string;
  amount: number;
  currency: string;
  type: 'tip' | 'brand_sponsorship' | 'deposit';
  status: string;
  createdAt: string;
  senderId?: { username: string };
  receiverId?: { username: string };
  videoId?: { title: string };
  splitDetails?: {
    isSplit: boolean;
    role: 'primary_author' | 'co_author';
    splitRatio: string;
    partnerId?: { username: string };
  };
}

interface CoAuthorInvite {
  _id: string;
  title: string;
  videoUrl: string;
  tier: string;
  createdAt: string;
  creatorId: {
    _id: string;
    username: string;
    role: string;
    avatarUrl?: string;
    isBrandSafeVerified?: boolean;
  };
  coAuthors?: Array<{
    user: any;
    status: string;
    splitPercentage?: number;
  }>;
}

interface TagRequest {
  _id: string;
  title: string;
  videoUrl: string;
  tier: string;
  createdAt: string;
  creatorId: {
    _id: string;
    username: string;
    role: string;
    avatarUrl?: string;
    isBrandSafeVerified?: boolean;
  };
}

interface InboxData {
  received: Transaction[];
  sent: Transaction[];
  deposits: Transaction[];
  totalSent: number;
  totalReceived: number;
  totalDeposits: number;
  walletBalance: number;
}

type Tab = 'received' | 'sent' | 'deposits' | 'collabs';

export default function InboxPage() {
  const { isAuthenticated, firebaseUser, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('received');
  const [data, setData] = useState<InboxData | null>(null);
  const [collabInvites, setCollabInvites] = useState<CoAuthorInvite[]>([]);
  const [tagRequests, setTagRequests] = useState<TagRequest[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !firebaseUser) return;

    // Mark inbox as read when page is visited
    if (typeof window !== 'undefined') {
      localStorage.setItem('toka_inbox_unread', 'false');
    }

    const fetchInbox = async () => {
      setFetching(true);
      setError(null);
      try {
        const token = await firebaseUser.getIdToken();
        const headers = { Authorization: `Bearer ${token}` };

        const [txRes, invitesRes, tagReqRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/transactions/my`, { headers }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/coauthor/invites`, { headers }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/tags/pending`, { headers })
        ]);

        const txJson = await txRes.json();
        const invitesJson = await invitesRes.json();
        const tagReqJson = await tagReqRes.json();

        if (txJson.status === 'success') {
          setData(txJson.data);
        } else {
          setError('Failed to load inbox activity.');
        }

        if (invitesJson.status === 'success') {
          setCollabInvites(invitesJson.data.invites || []);
        }

        if (tagReqJson.status === 'success') {
          setTagRequests(tagReqJson.data.requests || []);
        }
      } catch (e) {
        setError('Network error. Could not fetch transactions.');
      } finally {
        setFetching(false);
      }
    };

    fetchInbox();
  }, [isAuthenticated, firebaseUser]);

  const handleRespondCollab = async (videoId: string, action: 'accept' | 'decline') => {
    if (!firebaseUser) return;
    setRespondingId(videoId);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/${videoId}/coauthor/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });
      const json = await res.json();
      if (json.status === 'success') {
        setCollabInvites(prev => prev.filter(inv => inv._id !== videoId));
      }
    } catch (err) {
      console.error('Failed to respond to collab:', err);
    } finally {
      setRespondingId(null);
    }
  };

  const handleRespondTag = async (videoId: string, action: 'approve' | 'decline') => {
    if (!firebaseUser) return;
    setRespondingId(videoId);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/${videoId}/tags/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });
      const json = await res.json();
      if (json.status === 'success') {
        setTagRequests(prev => prev.filter(req => req._id !== videoId));
      }
    } catch (err) {
      console.error('Failed to respond to tag request:', err);
    } finally {
      setRespondingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-midnight-boma text-cloud-white font-sans">
        <span className="w-10 h-10 border-4 border-toka-flare border-t-transparent rounded-full animate-spin"></span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-midnight-boma text-cloud-white gap-4 font-sans px-6 text-center select-none">
        <span className="material-symbols-outlined text-[64px] text-red-500 animate-pulse">lock</span>
        <h1 className="text-2xl font-black tracking-tight">Access Restricted</h1>
        <p className="text-sm text-cloud-white/60 max-w-sm">Please sign in to view your inbox activity.</p>
        <Link href="/" className="px-6 py-3 bg-toka-flare hover:bg-toka-flare/90 rounded-xl font-bold transition-all text-xs active:scale-95 shadow-lg">
          Return to Homepage
        </Link>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; emoji: string; count: number }[] = [
    { id: 'received', label: 'Received', emoji: '📥', count: data?.totalReceived ?? 0 },
    { id: 'sent', label: 'Sent', emoji: '📤', count: data?.totalSent ?? 0 },
    { id: 'deposits', label: 'Deposits', emoji: '💳', count: data?.totalDeposits ?? 0 },
    { id: 'collabs', label: 'Collabs & Tags', emoji: '🤝', count: collabInvites.length + tagRequests.length },
  ];

  const activeList: Transaction[] =
    activeTab === 'received'
      ? (data?.received ?? [])
      : activeTab === 'sent'
      ? (data?.sent ?? [])
      : (data?.deposits ?? []);

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="min-h-screen bg-midnight-boma text-cloud-white font-sans flex flex-col pb-24">
      <PageHeader
        title="Activity Inbox"
        right={
          <div className="text-right">
            <span className="text-[10px] text-cloud-white/40 uppercase tracking-widest block font-bold">Balance</span>
            <span className="text-sm font-black font-mono text-fintech-mint">
              R {data?.walletBalance?.toFixed(2) ?? '—'}
            </span>
          </div>
        }
      />

      <main className="flex-1 max-w-xl w-full mx-auto px-4 pt-6 flex flex-col gap-6">
        {/* Tab Switcher */}
        <div className="grid grid-cols-4 bg-shaded-canopy border border-white/10 rounded-2xl p-1 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-0.5 relative ${
                activeTab === tab.id
                  ? 'bg-toka-flare text-cloud-white shadow-[0_0_12px_rgba(255,79,0,0.3)]'
                  : 'text-cloud-white/50 hover:text-cloud-white'
              }`}
            >
              <div className="flex items-center gap-1">
                <span className="text-xs">{tab.emoji}</span>
                <span className="truncate">{tab.label}</span>
              </div>
              {tab.count > 0 && (
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-black ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-toka-flare/20 text-toka-flare'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content Section */}
        {fetching ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-cloud-white/50">
            <span className="w-8 h-8 border-3 border-toka-flare border-t-transparent rounded-full animate-spin"></span>
            <p className="text-xs font-medium">Loading activity...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center text-center py-12 bg-shaded-canopy border border-red-500/20 rounded-2xl gap-3">
            <span className="material-symbols-outlined text-red-500 text-[40px]">error</span>
            <p className="text-sm text-cloud-white/60">{error}</p>
          </div>
        ) : activeTab === 'collabs' ? (
          /* ---- Collab & Tag Requests Tab ---- */
          collabInvites.length === 0 && tagRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12 bg-shaded-canopy border border-white/10 rounded-2xl gap-3">
              <span className="material-symbols-outlined text-cloud-white/20 text-[56px]">handshake</span>
              <h3 className="text-base font-bold text-cloud-white">No Pending Requests</h3>
              <p className="text-xs text-cloud-white/40 max-w-xs">
                When creators invite you to co-author videos or request tag approvals, they will appear here for review.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Co-Author Invites */}
              {collabInvites.length > 0 && (
                <div className="flex flex-col gap-3">
                  <span className="text-[11px] font-bold text-cloud-white/60 uppercase tracking-wider">
                    🤝 Co-Author Invitations ({collabInvites.length})
                  </span>
                  {collabInvites.map((invite) => {
                    const splitPct = invite.coAuthors?.[0]?.splitPercentage || 50;
                    return (
                      <div key={invite._id} className="bg-shaded-canopy border border-white/10 rounded-2xl p-4 flex flex-col gap-3 hover:border-white/20 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 toka-rainbow-halo p-[2px] shrink-0 relative">
                              <div className="toka-rainbow-halo-inner font-bold text-xs text-cloud-white">
                                {invite.creatorId?.avatarUrl ? (
                                  <img src={invite.creatorId.avatarUrl} alt={invite.creatorId.username} className="w-full h-full object-cover" />
                                ) : (
                                  invite.creatorId?.username?.charAt(0).toUpperCase()
                                )}
                              </div>
                              {invite.creatorId?.isBrandSafeVerified && (
                                <div className="absolute -bottom-0.5 -right-0.5 bg-midnight-boma rounded-full p-[1px] flex items-center justify-center z-10">
                                  <span className="material-symbols-outlined text-fintech-mint text-[11px]">verified</span>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Link href={`/profile?username=${invite.creatorId?.username}`} className="text-sm font-bold text-cloud-white hover:underline">
                                  @{invite.creatorId?.username}
                                </Link>
                                <span className="text-[9px] bg-toka-flare/20 text-toka-flare px-1.5 py-0.2 rounded font-bold uppercase">
                                  Co-Author Invite
                                </span>
                                <span className="text-[9px] bg-fintech-mint/15 text-fintech-mint border border-fintech-mint/30 px-1.5 py-0.2 rounded font-mono font-bold">
                                  💰 {100 - splitPct}/{splitPct} Split
                                </span>
                              </div>
                              <p className="text-xs text-cloud-white/80 mt-0.5 font-medium line-clamp-1">
                                &quot;{invite.title}&quot;
                              </p>
                              <span className="text-[10px] text-cloud-white/30 font-mono mt-0.5">
                                {formatDate(invite.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                          <button
                            disabled={respondingId === invite._id}
                            onClick={() => handleRespondCollab(invite._id, 'accept')}
                            className="flex-1 py-2 bg-fintech-mint/20 hover:bg-fintech-mint/30 border border-fintech-mint/40 text-fintech-mint rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                          >
                            {respondingId === invite._id ? 'Processing...' : 'Accept Collaboration'}
                          </button>
                          <button
                            disabled={respondingId === invite._id}
                            onClick={() => handleRespondCollab(invite._id, 'decline')}
                            className="px-4 py-2 bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-cloud-white/60 hover:text-red-400 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tag Approval Requests */}
              {tagRequests.length > 0 && (
                <div className="flex flex-col gap-3">
                  <span className="text-[11px] font-bold text-cloud-white/60 uppercase tracking-wider">
                    🏷️ Tag Requests ({tagRequests.length})
                  </span>
                  {tagRequests.map((request) => (
                    <div key={request._id} className="bg-shaded-canopy border border-white/10 rounded-2xl p-4 flex flex-col gap-3 hover:border-white/20 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 toka-rainbow-halo p-[2px] shrink-0 relative">
                            <div className="toka-rainbow-halo-inner font-bold text-xs text-cloud-white">
                              {request.creatorId?.avatarUrl ? (
                                <img src={request.creatorId.avatarUrl} alt={request.creatorId.username} className="w-full h-full object-cover" />
                              ) : (
                                request.creatorId?.username?.charAt(0).toUpperCase()
                              )}
                            </div>
                            {request.creatorId?.isBrandSafeVerified && (
                              <div className="absolute -bottom-0.5 -right-0.5 bg-midnight-boma rounded-full p-[1px] flex items-center justify-center z-10">
                                <span className="material-symbols-outlined text-fintech-mint text-[11px]">verified</span>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Link href={`/profile?username=${request.creatorId?.username}`} className="text-sm font-bold text-cloud-white hover:underline">
                                @{request.creatorId?.username}
                              </Link>
                              <span className="text-[9px] bg-blue-500/20 text-blue-400 border border-blue-400/30 px-1.5 py-0.2 rounded font-bold uppercase">
                                Tagged You
                              </span>
                            </div>
                            <p className="text-xs text-cloud-white/80 mt-0.5 font-medium line-clamp-1">
                              &quot;{request.title}&quot;
                            </p>
                            <span className="text-[10px] text-cloud-white/30 font-mono mt-0.5">
                              {formatDate(request.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                        <button
                          disabled={respondingId === request._id}
                          onClick={() => handleRespondTag(request._id, 'approve')}
                          className="flex-1 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/40 text-blue-400 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                        >
                          {respondingId === request._id ? 'Processing...' : 'Approve Tag'}
                        </button>
                        <button
                          disabled={respondingId === request._id}
                          onClick={() => handleRespondTag(request._id, 'decline')}
                          className="px-4 py-2 bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-cloud-white/60 hover:text-red-400 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        ) : activeList.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12 bg-shaded-canopy border border-white/10 rounded-2xl gap-3">
            <span className="material-symbols-outlined text-cloud-white/20 text-[56px]">
              {activeTab === 'deposits' ? 'add_card' : 'inbox'}
            </span>
            <h3 className="text-base font-bold text-cloud-white">No activity yet</h3>
            <p className="text-xs text-cloud-white/40">
              {activeTab === 'received' && 'Tips from your fans will appear here.'}
              {activeTab === 'sent' && 'Tips you send to creators will appear here.'}
              {activeTab === 'deposits' && 'Your wallet top-ups will appear here.'}
            </p>
            {activeTab === 'deposits' && (
              <Link href="/deposit" className="mt-2 px-5 py-2.5 bg-toka-flare hover:bg-toka-flare/90 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-md">
                Top Up Wallet
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {activeList.map((tx) => {
              /* ---- Deposit Row ---- */
              if (tx.type === 'deposit') {
                return (
                  <div key={tx._id} className="bg-shaded-canopy border border-white/10 rounded-2xl p-4 flex items-center gap-4 hover:border-white/20 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-400/20 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[20px] text-blue-400">add_card</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-cloud-white">Wallet Top-Up</p>
                      <p className="text-[10px] text-cloud-white/30 mt-0.5 font-mono">{formatDate(tx.createdAt)}</p>
                    </div>
                    <span className="font-mono font-bold text-sm text-blue-400 shrink-0">
                      +R{tx.amount.toFixed(2)}
                    </span>
                  </div>
                );
              }

              /* ---- Tip Rows (received / sent) ---- */
              const isReceived = activeTab === 'received';
              const counterparty = isReceived ? tx.senderId?.username : tx.receiverId?.username;
              const icon = isReceived ? 'south_west' : 'north_east';
              const iconColor = isReceived ? 'text-fintech-mint' : 'text-toka-flare';
              const amountColor = isReceived ? 'text-fintech-mint' : 'text-toka-flare';
              const sign = isReceived ? '+' : '-';

              return (
                <div key={tx._id} className="bg-shaded-canopy border border-white/10 rounded-2xl p-4 flex items-center gap-4 hover:border-white/20 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-black/30 border border-white/10 flex items-center justify-center shrink-0">
                    <span className={`material-symbols-outlined text-[20px] ${iconColor}`}>{icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-cloud-white truncate">
                        {isReceived ? `@${counterparty} tipped you` : `Tip to @${counterparty}`}
                      </p>
                      {tx.splitDetails?.isSplit && (
                        <span className="text-[9px] font-mono bg-toka-flare/15 text-toka-flare border border-toka-flare/30 px-1.5 py-0.2 rounded font-bold">
                          🤝 Collab ({tx.splitDetails.splitRatio})
                        </span>
                      )}
                    </div>
                    {tx.videoId?.title && (
                      <p className="text-xs text-cloud-white/50 truncate mt-0.5">on &quot;{tx.videoId.title}&quot;</p>
                    )}
                    <p className="text-[10px] text-cloud-white/30 mt-0.5 font-mono">{formatDate(tx.createdAt)}</p>
                  </div>
                  <span className={`font-mono font-bold text-sm shrink-0 ${amountColor}`}>
                    {sign}R{tx.amount.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
