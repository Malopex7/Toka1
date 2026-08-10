"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useFeedStore } from '@/store/useFeedStore';
import Link from 'next/link';

interface CommentUser {
  _id: string;
  username: string;
  role: string;
}

interface Comment {
  _id: string;
  videoId: string;
  userId: CommentUser;
  text: string;
  createdAt: string;
}

interface CommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
}

export default function CommentsModal({ isOpen, onClose, videoId }: CommentsModalProps) {
  const { mongooseUser, isAuthenticated, firebaseUser } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // 1) Fetch comments when modal is opened
  useEffect(() => {
    if (!isOpen || !videoId) return;

    const fetchComments = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/${videoId}/comments`);
        const data = await res.json();
        if (data.status === 'success') {
          setComments(data.data.comments);
        }
      } catch (err) {
        console.error('Error fetching comments:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [isOpen, videoId]);

  // Scroll to bottom when new comment is added
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  // 2) Handle posting a comment
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !firebaseUser) {
      alert('Please sign in to comment.');
      return;
    }

    if (!inputText.trim()) return;

    setSubmitting(true);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/${videoId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text: inputText.trim() })
      });

      const data = await res.json();
      if (data.status === 'success') {
        const newComment = data.data.comment;
        setComments(prev => [...prev, newComment]);
        setInputText('');
        // Update commentsCount locally in FeedStore
        useFeedStore.getState().updateCommentCount(videoId, 1);
      }
    } catch (err) {
      console.error('Error posting comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // 3) Handle deleting a comment
  const handleDeleteComment = async (commentId: string) => {
    if (!isAuthenticated || !firebaseUser) return;

    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.ok) {
        setComments(prev => prev.filter(c => c._id !== commentId));
        // Decrement commentsCount locally in FeedStore
        useFeedStore.getState().updateCommentCount(videoId, -1);
      }
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  // Calculate relative time
  const getRelativeTime = (dateString: string) => {
    const now = new Date();
    const created = new Date(dateString);
    const diffMs = now.getTime() - created.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHr > 0) return `${diffHr}h ago`;
    if (diffMin > 0) return `${diffMin}m ago`;
    return 'just now';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end md:items-center md:justify-center">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={onClose}></div>

      {/* Drawer Container (Sliding bottom sheet on mobile, centered modal on desktop) */}
      <div className="relative w-full md:w-[450px] h-[70vh] md:h-[600px] bg-midnight-boma border-t md:border border-white/10 rounded-t-3xl md:rounded-3xl flex flex-col mt-auto md:mt-0 shadow-2xl z-10 overflow-hidden font-sans">
        
        {/* Drag handle for mobile */}
        <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto my-3 md:hidden"></div>

        {/* Header */}
        <header className="px-6 pb-4 pt-2 md:pt-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-cloud-white">Comments</h2>
            <p className="text-[10px] text-cloud-white/40 font-semibold uppercase tracking-wider mt-0.5 font-mono">
              {comments.length} total
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-cloud-white transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </header>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4 no-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full py-12 gap-2 text-cloud-white/60">
              <span className="w-8 h-8 border-4 border-toka-flare border-t-transparent rounded-full animate-spin"></span>
              <p className="text-xs">Loading comments...</p>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center gap-3">
              <span className="material-symbols-outlined text-cloud-white/10 text-[48px]">forum</span>
              <p className="text-xs text-cloud-white/40">No comments yet. Be the first to join the conversation!</p>
            </div>
          ) : (
            comments.map((comment) => {
              const isOwner = mongooseUser && comment.userId?._id === mongooseUser._id;
              const isMod = mongooseUser?.role === 'moderator';

              return (
                <div key={comment._id} className="flex items-start gap-3 group">
                  {/* User Initial Avatar */}
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-toka-flare to-orange-700 flex items-center justify-center font-bold text-sm text-cloud-white shrink-0 select-none">
                    {comment.userId?.username?.charAt(0).toUpperCase()}
                  </div>

                  {/* Comment Details */}
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/profile?username=${comment.userId?.username}`}
                        onClick={onClose}
                        className="text-xs font-bold text-cloud-white hover:underline"
                      >
                        @{comment.userId?.username || 'user'}
                      </Link>
                      <span className="text-[10px] text-cloud-white/30 font-medium">
                        {getRelativeTime(comment.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-cloud-white/80 mt-1 leading-relaxed">
                      {comment.text}
                    </p>
                  </div>

                  {/* Delete Comment Button */}
                  {(isOwner || isMod) && (
                    <button
                      onClick={() => handleDeleteComment(comment._id)}
                      className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 p-1 rounded transition-all select-none"
                      title="Delete Comment"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* Footer Input Box */}
        <footer className="p-4 bg-shaded-canopy/60 border-t border-white/5">
          {isAuthenticated ? (
            <form onSubmit={handleSubmitComment} className="flex items-center gap-2 bg-black/20 border border-white/10 rounded-2xl p-1.5 focus-within:border-toka-flare transition-all">
              <input
                type="text"
                placeholder="Add a comment..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                maxLength={500}
                className="flex-1 bg-transparent px-3 py-2 text-xs text-cloud-white focus:outline-none placeholder-cloud-white/40"
              />
              <button
                type="submit"
                disabled={submitting || !inputText.trim()}
                className="px-4 py-2 bg-toka-flare hover:bg-toka-flare/90 disabled:bg-white/5 disabled:text-white/20 text-cloud-white rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0"
              >
                {submitting ? 'Posting...' : 'Post'}
              </button>
            </form>
          ) : (
            <div className="text-center py-2">
              <p className="text-xs text-cloud-white/50">
                Please sign in to comment.
              </p>
            </div>
          )}
        </footer>

      </div>
    </div>
  );
}
