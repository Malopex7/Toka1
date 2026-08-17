"use client";
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRoomContext } from '@livekit/components-react';

interface UserSearchResult {
  _id: string;
  username: string;
  avatarUrl?: string;
  isBrandSafeVerified?: boolean;
  role?: string;
}

interface CohostInvitePanelProps {
  roomId: string;
}

export default function CohostInvitePanel({ roomId }: CohostInvitePanelProps) {
  const room = useRoomContext();
  const { getIdToken } = useAuth();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitingUsername, setInvitingUsername] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const handleQueryChange = (val: string) => {
    setQuery(val);
    const clean = val.trim().replace(/^@/, '');
    if (!clean) {
      setSearchResults([]);
      setSearching(false);
    }
  };

  // Live debounced search
  useEffect(() => {
    const cleanQuery = query.trim().replace(/^@/, '');
    if (!cleanQuery) {
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const token = await getIdToken();
        const res = await fetch(
          `${BACKEND_URL}/api/users/search?q=${encodeURIComponent(cleanQuery)}`,
          {
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );
        const data = await res.json();
        if (res.ok && data.data?.users) {
          setSearchResults(data.data.users);
        } else {
          setSearchResults([]);
        }
      } catch (err) {
        console.error('Co-host search error:', err);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, getIdToken, BACKEND_URL]);

  const sendInvite = async (targetUsername: string) => {
    const cleanUsername = targetUsername.trim().replace(/^@/, '');
    if (!cleanUsername) return;

    setInvitingUsername(cleanUsername);
    setMessage('');
    setError('');
    try {
      const token = await getIdToken();
      const res = await fetch(
        `${BACKEND_URL}/api/live/${roomId}/invite-cohost`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ username: cleanUsername }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invite failed');

      // Publish over LiveKit Data Channel for instant in-room delivery
      if (room && room.localParticipant) {
        try {
          const payload = new TextEncoder().encode(
            JSON.stringify({
              type: 'cohost_invite',
              targetUsername: cleanUsername,
              roomId,
            })
          );
          await room.localParticipant.publishData(payload, { reliable: true });
        } catch (_) {}
      }

      setMessage(`✓ Invite sent to @${cleanUsername}`);
      setQuery('');
      setSearchResults([]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setInvitingUsername(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchResults.length > 0) {
      sendInvite(searchResults[0].username);
    } else if (query.trim()) {
      sendInvite(query);
    }
  };

  return (
    <div className="bg-[#09090B] backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col gap-3 shadow-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-toka-flare text-[18px]">group_add</span>
          <h3 className="text-cloud-white font-bold text-xs">Invite Co-Host</h3>
        </div>
        {searching && (
          <span className="text-[10px] text-cloud-white/50 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-toka-flare animate-ping" /> Searching...
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 relative">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search by @username..."
            className="w-full bg-[#18181B]/60 border border-white/10 rounded-[0.625rem] px-3 py-2 text-xs text-cloud-white placeholder-cloud-white/40 focus:outline-none focus:border-toka-flare transition-colors"
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={!query.trim() || !!invitingUsername}
          className="bg-toka-flare hover:bg-toka-flare/90 text-white rounded-[0.625rem] px-3.5 text-xs font-bold transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center justify-center min-w-[64px]"
        >
          {invitingUsername ? (
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Invite'
          )}
        </button>
      </form>

      {/* Real-time search results dropdown */}
      {searchResults.length > 0 && (
        <div className="bg-[#18181B] border border-white/10 rounded-[0.625rem] overflow-hidden divide-y divide-white/5 max-h-48 overflow-y-auto">
          {searchResults.map((user) => (
            <div
              key={user._id}
              className="flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 toka-rainbow-halo p-[1px] shrink-0">
                  <div className="toka-rainbow-halo-inner text-[10px] font-bold text-cloud-white">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      user.username[0]?.toUpperCase()
                    )}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-cloud-white font-bold text-xs truncate">
                      @{user.username}
                    </span>
                    {user.isBrandSafeVerified && (
                      <span className="material-symbols-outlined text-fintech-mint text-[13px]">verified</span>
                    )}
                  </div>
                  {user.role && (
                    <span className="text-[9px] text-cloud-white/40 capitalize">{user.role}</span>
                  )}
                </div>
              </div>

              <button
                onClick={() => sendInvite(user.username)}
                disabled={invitingUsername === user.username}
                className="bg-white/10 hover:bg-toka-flare text-cloud-white hover:text-white text-[11px] font-bold px-2.5 py-1 rounded-md transition-all active:scale-95 cursor-pointer ml-2 shrink-0"
              >
                {invitingUsername === user.username ? 'Sending...' : 'Invite'}
              </button>
            </div>
          ))}
        </div>
      )}

      {query.trim().length >= 2 && !searching && searchResults.length === 0 && (
        <p className="text-cloud-white/40 text-xs italic px-1">
          No users found matching &ldquo;{query}&rdquo;
        </p>
      )}

      {message && (
        <div className="flex items-center gap-1.5 text-fintech-mint text-xs font-semibold bg-fintech-mint/10 border border-fintech-mint/20 rounded-[0.625rem] px-3 py-2">
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-red-400 text-xs font-semibold bg-red-500/10 border border-red-500/20 rounded-[0.625rem] px-3 py-2">
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
