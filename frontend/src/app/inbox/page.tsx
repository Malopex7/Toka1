"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

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

type Tab = 'received' | 'sent' | 'deposits';

export default function InboxPage() {
  const { isAuthenticated, firebaseUser, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('received');
  const [data, setData] = useState<InboxData | null>(null);
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
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/transactions/my`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.status === 'success') {
          setData(json.data);
        } else {
          setError('Failed to load inbox activity.');
        }
      } catch (e) {
        setError('Network error. Could not fetch transactions.');
      } finally {
        setFetching(false);
      }
    };

    fetchInbox();
  }, [isAuthenticated, firebaseUser]);

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
    { id: 'sent',     label: 'Sent',     emoji: '📤', count: data?.totalSent     ?? 0 },
    { id: 'deposits', label: 'Top-Ups',  emoji: '💳', count: data?.totalDeposits ?? 0 },
  ];

  const activeList: Transaction[] =
    activeTab === 'received'
      ? (data?.received ?? [])
      : activeTab === 'sent'
      ? (data?.sent ?? [])
      : (data?.deposits ?? []);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-ZA', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

  return (
    <div className="bg-midnight-boma text-cloud-white min-h-screen antialiased font-sans">

      {/* Header */}
      <header className="sticky top-0 w-full border-b border-white/10 bg-shaded-canopy flex justify-between items-center px-6 h-16 z-50 select-none">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-cloud-white/70 hover:text-cloud-white transition-colors flex items-center gap-1 text-sm font-semibold">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back
          </Link>
          <h1 className="text-base font-bold text-toka-flare tracking-tight border-l border-white/15 pl-4">
            Inbox & Activity
          </h1>
        </div>
        <span className="bg-fintech-mint/10 border border-fintech-mint/35 text-fintech-mint text-xs font-mono font-bold px-3 py-1 rounded-lg">
          Balance: R {data?.walletBalance?.toFixed(2) ?? '—'}
        </span>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-shaded-canopy border border-white/10 rounded-2xl p-4 flex flex-col gap-1">
            <span className="material-symbols-outlined text-fintech-mint text-[24px]">south_west</span>
            <span className="text-xl font-black font-mono text-cloud-white">{data?.totalReceived ?? '—'}</span>
            <span className="text-[9px] text-cloud-white/50 font-semibold uppercase tracking-wider">Tips In</span>
          </div>
          <div className="bg-shaded-canopy border border-white/10 rounded-2xl p-4 flex flex-col gap-1">
            <span className="material-symbols-outlined text-toka-flare text-[24px]">north_east</span>
            <span className="text-xl font-black font-mono text-cloud-white">{data?.totalSent ?? '—'}</span>
            <span className="text-[9px] text-cloud-white/50 font-semibold uppercase tracking-wider">Tips Out</span>
          </div>
          <div className="bg-shaded-canopy border border-white/10 rounded-2xl p-4 flex flex-col gap-1">
            <span className="material-symbols-outlined text-blue-400 text-[24px]">add_card</span>
            <span className="text-xl font-black font-mono text-cloud-white">{data?.totalDeposits ?? '—'}</span>
            <span className="text-[9px] text-cloud-white/50 font-semibold uppercase tracking-wider">Top-Ups</span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1.5 bg-black/20 rounded-xl p-1 border border-white/10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === tab.id ? 'bg-toka-flare text-cloud-white shadow-lg' : 'text-cloud-white/50 hover:text-cloud-white'
              }`}
            >
              {tab.emoji} {tab.label}
            </button>
          ))}
        </div>

        {/* List */}
        {fetching ? (
          <div className="flex flex-col gap-3 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-shaded-canopy border border-white/10 rounded-2xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white/10 shrink-0"></div>
                <div className="flex-1 flex flex-col gap-2">
                  <div className="h-3 bg-white/10 rounded w-36"></div>
                  <div className="h-2.5 bg-white/10 rounded w-24"></div>
                </div>
                <div className="h-4 bg-white/10 rounded w-14"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center text-center py-10 gap-3">
            <span className="material-symbols-outlined text-red-500 text-[40px]">error</span>
            <p className="text-sm text-cloud-white/60">{error}</p>
          </div>
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
                    <p className="text-sm font-bold text-cloud-white truncate">
                      {isReceived ? `@${counterparty} tipped you` : `Tip to @${counterparty}`}
                    </p>
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
