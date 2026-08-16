"use client";
import React, { useState, useEffect } from 'react';
import { useStatusStore, StatusHighlight, StatusItem } from '@/store/useStatusStore';
import { useAuth } from '@/context/AuthContext';
import { Plus, Sparkles, X, Check } from 'lucide-react';

interface ProfileHighlightsReelProps {
  userId: string;
  isSelf: boolean;
}

export default function ProfileHighlightsReel({ userId, isSelf }: ProfileHighlightsReelProps) {
  const { userHighlights, fetchUserHighlights, createHighlight } = useStatusStore();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [selectedGradient, setSelectedGradient] = useState<string>('from-toka-flare to-amber-600');
  const [isCreating, setIsCreating] = useState<boolean>(false);

  useEffect(() => {
    if (userId) {
      fetchUserHighlights(userId);
    }
  }, [userId, fetchUserHighlights]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setIsCreating(true);
    try {
      await createHighlight(title.trim(), [], selectedGradient);
      setTitle('');
      setIsModalOpen(false);
      await fetchUserHighlights(userId);
    } catch (e) {
      console.error('Failed to create highlight:', e);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="w-full my-3 px-4">
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-2">
        
        {/* Add Highlight Button for Creator */}
        {isSelf && (
          <div className="flex flex-col items-center gap-1 cursor-pointer flex-shrink-0">
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-14 h-14 rounded-full border-2 border-dashed border-white/20 hover:border-toka-flare flex items-center justify-center text-cloud-white/70 hover:text-white transition-all bg-shaded-canopy/40"
              title="Create new Highlight reel"
            >
              <Plus className="w-5 h-5" />
            </button>
            <span className="text-[11px] text-cloud-white/60 font-medium truncate max-w-[64px]">
              New
            </span>
          </div>
        )}

        {/* Existing Highlights */}
        {userHighlights.map((highlight) => (
          <div
            key={highlight._id}
            className="flex flex-col items-center gap-1 cursor-pointer flex-shrink-0 group"
          >
            <div className={`w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr ${highlight.coverGradient || 'from-toka-flare to-amber-500'} group-hover:scale-105 transition-transform`}>
              <div className="w-full h-full rounded-full bg-midnight-boma flex items-center justify-center text-cloud-white font-bold text-xs">
                {highlight.title.substring(0, 2).toUpperCase()}
              </div>
            </div>
            <span className="text-[11px] text-cloud-white/80 font-medium truncate max-w-[64px]">
              {highlight.title}
            </span>
          </div>
        ))}
      </div>

      {/* Create Highlight Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-midnight-boma rounded-2xl border border-white/10 p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-toka-flare" />
                <h3 className="font-bold text-sm text-cloud-white">Create Story Highlight</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-cloud-white/60 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Highlight title (e.g. Studio, BTS, Travel)"
              maxLength={25}
              className="w-full bg-shaded-canopy px-3.5 py-2.5 rounded-xl text-xs text-cloud-white placeholder-cloud-white/40 border border-white/10 outline-none focus:border-toka-flare"
            />

            <div className="flex items-center gap-2">
              {[
                'from-toka-flare to-amber-600',
                'from-emerald-600 to-teal-700',
                'from-purple-600 to-indigo-700',
                'from-zinc-800 to-zinc-950'
              ].map((grad, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedGradient(grad)}
                  className={`w-7 h-7 rounded-full bg-gradient-to-tr ${grad} flex items-center justify-center transition-all ${
                    selectedGradient === grad ? 'ring-2 ring-cloud-white scale-110' : 'opacity-60'
                  }`}
                >
                  {selectedGradient === grad && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1.5 rounded-xl text-xs text-cloud-white/70 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!title.trim() || isCreating}
                className="px-4 py-1.5 rounded-xl bg-toka-flare text-white text-xs font-bold disabled:opacity-50"
              >
                {isCreating ? 'Saving...' : 'Save Highlight'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
