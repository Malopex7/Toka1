"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useModalStore } from '@/store/useModalStore';
import Link from 'next/link';

interface ListedUser {
  _id: string;
  username: string;
  role: string;
  avatarUrl?: string;
  isBrandSafeVerified?: boolean;
}

interface FollowListModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUsername: string;
  initialTab?: 'followers' | 'following';
  followersCount: number;
  followingCount: number;
  onFollowCountChange?: () => void;
}

export default function FollowListModal({
  isOpen,
  onClose,
  targetUsername,
  initialTab = 'followers',
  followersCount,
  followingCount,
  onFollowCountChange
}: FollowListModalProps) {
  const { mongooseUser, firebaseUser, isAuthenticated, refreshProfile } = useAuth();
  const { showAlert } = useModalStore();

  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialTab);
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  if (initialTab !== prevInitialTab) {
    setPrevInitialTab(initialTab);
    setActiveTab(initialTab);
  }

  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<ListedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);
  const [privateMsg, setPrivateMsg] = useState('');
  const [followOverrides, setFollowOverrides] = useState<Record<string, boolean>>({});
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const isUserFollowed = (userId: string) => {
    if (followOverrides[userId] !== undefined) {
      return followOverrides[userId];
    }
    return mongooseUser?.following ? mongooseUser.following.some(id => String(id) === userId) : false;
  };

  const fetchList = useCallback(async () => {
    if (!targetUsername || !isOpen) return;

    setLoading(true);
    setIsPrivate(false);
    setPrivateMsg('');

    try {
      const headers: HeadersInit = {};
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
      }

      const queryParam = searchQuery.trim() ? `?q=${encodeURIComponent(searchQuery.trim())}` : '';
      const endpoint = `${process.env.NEXT_PUBLIC_API_URL}/api/users/profile/${targetUsername}/${activeTab}${queryParam}`;

      const res = await fetch(endpoint, { headers });
      const data = await res.json();

      if (data.status === 'success') {
        if (data.isPrivate) {
          setIsPrivate(true);
          setPrivateMsg(data.message || 'This list is private.');
          setUsers([]);
        } else {
          setIsPrivate(false);
          setUsers(data.data?.users || []);
        }
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error(`[FollowListModal] Error fetching ${activeTab}:`, err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [targetUsername, activeTab, searchQuery, isOpen, firebaseUser]);

  // Debounced fetch on search or tab change
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchList();
    }, 250);

    return () => clearTimeout(handler);
  }, [fetchList]);

  const handleFollowToggle = async (targetUserId: string, targetName: string) => {
    if (!isAuthenticated || !firebaseUser) {
      showAlert('Sign In Required', 'Please sign in to follow creators.');
      return;
    }

    if (mongooseUser?._id === targetUserId) return;

    const currentlyFollowing = isUserFollowed(targetUserId);

    // Optimistic UI update
    setFollowOverrides(prev => ({
      ...prev,
      [targetUserId]: !currentlyFollowing
    }));

    setActionLoadingId(targetUserId);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/follow/${targetUserId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error('Failed to update follow status.');
      }

      await refreshProfile();
      onFollowCountChange?.();
    } catch (err: any) {
      console.error('Follow toggle error:', err);
      // Revert optimistic update
      setFollowOverrides(prev => ({
        ...prev,
        [targetUserId]: currentlyFollowing
      }));
      showAlert('Error', err.message || 'Could not update follow status.');
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in font-sans select-none">
      <div className="relative w-full max-w-[420px] bg-shaded-canopy border border-white/10 rounded-3xl p-5 shadow-2xl overflow-hidden flex flex-col gap-4 max-h-[85vh]">
        
        {/* Header with Title and Close */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-toka-flare text-[22px]">group</span>
            <h2 className="text-base font-black text-cloud-white tracking-tight">@{targetUsername}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-cloud-white/70 hover:text-cloud-white flex items-center justify-center transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 bg-black/40 p-1 rounded-2xl border border-white/5">
          <button
            onClick={() => { setActiveTab('followers'); setSearchQuery(''); }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'followers'
                ? 'bg-toka-flare text-cloud-white shadow-md'
                : 'text-cloud-white/60 hover:text-cloud-white'
            }`}
          >
            <span>Followers</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              activeTab === 'followers' ? 'bg-black/20 text-cloud-white' : 'bg-white/10 text-cloud-white/60'
            }`}>
              {followersCount}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('following'); setSearchQuery(''); }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'following'
                ? 'bg-toka-flare text-cloud-white shadow-md'
                : 'text-cloud-white/60 hover:text-cloud-white'
            }`}
          >
            <span>Following</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              activeTab === 'following' ? 'bg-black/20 text-cloud-white' : 'bg-white/10 text-cloud-white/60'
            }`}>
              {followingCount}
            </span>
          </button>
        </div>

        {/* Search Bar */}
        {!isPrivate && (
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-3 text-cloud-white/40 text-[18px] pointer-events-none">
              search
            </span>
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2 bg-black/30 border border-white/10 rounded-xl text-xs text-cloud-white placeholder-cloud-white/40 focus:outline-none focus:border-toka-flare transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-cloud-white/40 hover:text-cloud-white cursor-pointer flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[16px]">cancel</span>
              </button>
            )}
          </div>
        )}

        {/* User List Body */}
        <div className="flex-1 overflow-y-auto min-h-[220px] max-h-[360px] flex flex-col gap-2 no-scrollbar pr-0.5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-cloud-white/50">
              <span className="w-6 h-6 border-2 border-toka-flare border-t-transparent rounded-full animate-spin"></span>
              <p className="text-[11px] font-medium">Loading {activeTab}...</p>
            </div>
          ) : isPrivate ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3 bg-black/20 border border-white/5 rounded-2xl p-4">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-cloud-white/40">
                <span className="material-symbols-outlined text-[24px]">lock</span>
              </div>
              <h4 className="text-xs font-bold text-cloud-white">Private List</h4>
              <p className="text-[11px] text-cloud-white/50 max-w-xs leading-relaxed">
                {privateMsg || `@${targetUsername} has set their ${activeTab} list to private.`}
              </p>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2 bg-black/10 border border-white/5 rounded-2xl">
              <span className="material-symbols-outlined text-cloud-white/20 text-[36px]">
                {searchQuery ? 'person_search' : 'group_off'}
              </span>
              <p className="text-xs font-bold text-cloud-white/60">
                {searchQuery ? 'No users found matching your search.' : `No ${activeTab} yet.`}
              </p>
            </div>
          ) : (
            users.map((user) => {
              const isSelf = mongooseUser && user._id === mongooseUser._id;
              const isFollowingThisUser = isUserFollowed(user._id);
              const isLoadingAction = actionLoadingId === user._id;

              return (
                <div
                  key={user._id}
                  className="flex items-center justify-between p-2.5 bg-black/20 hover:bg-black/35 border border-white/5 hover:border-white/10 rounded-2xl transition-all"
                >
                  <Link
                    href={`/profile?username=${user.username}`}
                    onClick={onClose}
                    className="flex items-center gap-3 flex-1 min-w-0 group cursor-pointer"
                  >
                    {/* User Avatar */}
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-toka-flare to-orange-700 flex items-center justify-center font-bold text-sm text-cloud-white overflow-hidden border border-white/10 shadow-sm">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                        ) : (
                          user.username.charAt(0).toUpperCase()
                        )}
                      </div>
                      {user.isBrandSafeVerified && (
                        <div className="absolute -bottom-0.5 -right-0.5 bg-midnight-boma rounded-full p-[1px] flex items-center justify-center z-10 shadow-sm">
                          <span className="material-symbols-outlined text-fintech-mint text-[11px]">verified</span>
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-xs font-bold text-cloud-white group-hover:text-toka-flare transition-colors truncate">
                          @{user.username}
                        </span>
                        {user.role && user.role !== 'fan' && (
                          <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.2 bg-white/10 rounded text-cloud-white/70">
                            {user.role}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>

                  {/* Follow Action Button */}
                  {isAuthenticated && !isSelf && (
                    <button
                      disabled={isLoadingAction}
                      onClick={() => handleFollowToggle(user._id, user.username)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all active:scale-95 flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50 ${
                        isFollowingThisUser
                          ? 'bg-white/10 hover:bg-red-500/20 text-cloud-white hover:text-red-400 border border-white/15'
                          : 'bg-toka-flare hover:bg-toka-flare/90 text-cloud-white shadow-sm'
                      }`}
                    >
                      {isLoadingAction ? (
                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[13px]">
                            {isFollowingThisUser ? 'check' : 'add'}
                          </span>
                          {isFollowingThisUser ? 'Following' : 'Follow'}
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
