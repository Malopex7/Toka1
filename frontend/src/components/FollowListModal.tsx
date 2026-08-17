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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in font-sans select-none">
      <div className="relative w-full max-w-[420px] bg-[#09090B] border border-white/10 rounded-2xl p-5 shadow-2xl overflow-hidden flex flex-col gap-3.5 max-h-[85vh]">

        {/* Header with Title and Close */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-toka-flare text-[20px]">group</span>
            <h2 className="text-sm font-bold text-cloud-white tracking-tight">@{targetUsername}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-cloud-white/70 hover:text-cloud-white flex items-center justify-center transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        {/* Recessed Segmented Tab Switcher */}
        <div className="grid grid-cols-2 bg-[#09090B] p-1 rounded-[0.625rem] border border-white/10 text-xs font-medium gap-1">
          <button
            type="button"
            onClick={() => { setActiveTab('followers'); setSearchQuery(''); }}
            className={`py-2 px-3 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'followers'
                ? 'bg-toka-flare text-white shadow-sm font-semibold'
                : 'text-cloud-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>Followers</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              activeTab === 'followers' ? 'bg-black/20 text-white' : 'bg-white/10 text-cloud-white/60'
            }`}>
              {followersCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('following'); setSearchQuery(''); }}
            className={`py-2 px-3 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'following'
                ? 'bg-toka-flare text-white shadow-sm font-semibold'
                : 'text-cloud-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <span>Following</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              activeTab === 'following' ? 'bg-black/20 text-white' : 'bg-white/10 text-cloud-white/60'
            }`}>
              {followingCount}
            </span>
          </button>
        </div>

        {/* Search Bar */}
        {!isPrivate && (
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-3 text-cloud-white/40 text-[16px] pointer-events-none">
              search
            </span>
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-2 bg-[#18181B]/60 border border-white/10 rounded-[0.625rem] text-xs text-cloud-white placeholder-cloud-white/40 focus:outline-none focus:border-toka-flare transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-cloud-white/40 hover:text-cloud-white cursor-pointer flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[15px]">cancel</span>
              </button>
            )}
          </div>
        )}

        {/* User List Body */}
        <div className="flex-1 overflow-y-auto min-h-[220px] max-h-[360px] flex flex-col gap-2 no-scrollbar pr-0.5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-cloud-white/50">
              <span className="w-5 h-5 border-2 border-toka-flare border-t-transparent rounded-full animate-spin"></span>
              <p className="text-[11px] font-medium">Loading {activeTab}...</p>
            </div>
          ) : isPrivate ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2.5 bg-[#18181B] border border-white/10 rounded-[0.625rem] p-4">
              <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-cloud-white/40">
                <span className="material-symbols-outlined text-[20px]">lock</span>
              </div>
              <h4 className="text-xs font-bold text-cloud-white">Private List</h4>
              <p className="text-[10px] text-cloud-white/50 max-w-xs leading-relaxed">
                {privateMsg || `@${targetUsername} has set their ${activeTab} list to private.`}
              </p>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2 bg-[#18181B] border border-white/10 rounded-[0.625rem]">
              <span className="material-symbols-outlined text-cloud-white/20 text-[32px]">
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
                  className="flex items-center justify-between p-2.5 bg-[#18181B] hover:bg-[#18181B]/80 border border-white/10 rounded-[0.625rem] transition-all"
                >
                  <Link
                    href={`/profile?username=${user.username}`}
                    onClick={onClose}
                    className="flex items-center gap-2.5 flex-1 min-w-0 group cursor-pointer"
                  >
                    {/* User Avatar */}
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-toka-flare to-orange-700 flex items-center justify-center font-bold text-xs text-cloud-white overflow-hidden border border-white/10 shadow-sm">
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
                      className={`px-3 py-1.5 rounded-[0.625rem] text-[11px] font-bold transition-all active:scale-95 flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50 ${
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
