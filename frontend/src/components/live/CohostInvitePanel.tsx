"use client";
import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

interface CohostInvitePanelProps {
  roomId: string;
}

export default function CohostInvitePanel({ roomId }: CohostInvitePanelProps) {
  const { getIdToken } = useAuth();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const token = await getIdToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/live/${roomId}/invite-cohost`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ username: username.trim() }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invite failed');
      setMessage(`✓ Invite sent to @${username}`);
      setUsername('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-toka-flare text-[18px]">group_add</span>
        <h3 className="text-cloud-white font-bold text-sm">Invite Co-Host</h3>
      </div>

      <form onSubmit={sendInvite} className="flex gap-2">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value.replace('@', ''))}
          placeholder="@username"
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-cloud-white placeholder-cloud-white/30 focus:outline-none focus:border-toka-flare/50"
        />
        <button
          type="submit"
          disabled={loading || !username.trim()}
          className="bg-toka-flare text-white rounded-xl px-3 text-sm font-bold hover:bg-toka-flare/80 transition-all active:scale-95 disabled:opacity-50"
        >
          {loading ? '...' : 'Invite'}
        </button>
      </form>

      {message && <p className="text-fintech-mint text-xs">{message}</p>}
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  );
}
