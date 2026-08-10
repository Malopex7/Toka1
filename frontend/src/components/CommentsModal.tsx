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
  parentId: string | null;
  likesCount: number;
  isLiked?: boolean;
  createdAt: string;
  replies?: Comment[];
}

interface CommentNode extends Comment {
  depth: number;
  children: CommentNode[];
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

  // Thread reply state
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; username: string } | null>(null);
  // Track expanded reply sections (parent comment IDs)
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  const commentsEndRef = useRef<HTMLDivElement>(null);

  // 1) Fetch comments
  useEffect(() => {
    if (!isOpen || !videoId) return;

    const fetchComments = async () => {
      setLoading(true);
      try {
        const headers: HeadersInit = {};
        if (firebaseUser) {
          const token = await firebaseUser.getIdToken();
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/${videoId}/comments`, { headers });
        const data = await res.json();
        if (data.status === 'success') {
          setComments(data.data.comments || []);
        }
      } catch (err) {
        console.error('Error fetching comments:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [isOpen, videoId, firebaseUser]);

  // Scroll to bottom when root comment list length increases
  useEffect(() => {
    if (!replyingTo) {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments.length, replyingTo]);

  // 2) Handle posting comments or replies
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !firebaseUser) {
      alert('Please sign in to comment.');
      return;
    }

    if (!inputText.trim()) return;

    setSubmitting(true);
    const parentId = replyingTo?.commentId || null;

    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/${videoId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          text: inputText.trim(),
          parentId
        })
      });

      const data = await res.json();
      if (data.status === 'success') {
        const newComment: Comment = data.data.comment;
        newComment.replies = [];
        newComment.isLiked = false;
        newComment.likesCount = 0;

        if (parentId) {
          // Add comment to parent replies
          setComments(prev => prev.map(c => {
            if (c._id === parentId) {
              return {
                ...c,
                replies: [...(c.replies || []), newComment]
              };
            }
            return c;
          }));

          // Automatically expand parent reply thread
          setExpandedParents(prev => {
            const next = new Set(prev);
            next.add(parentId);
            return next;
          });
        } else {
          // Add to top-level comment list
          setComments(prev => [...prev, newComment]);
        }

        setInputText('');
        setReplyingTo(null);
        // Increment commentsCount locally in FeedStore
        useFeedStore.getState().updateCommentCount(videoId, 1);
      }
    } catch (err) {
      console.error('Error posting comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // 3) Handle comment/reply likes (optimistic updates)
  const handleLikeToggle = async (commentId: string, parentId: string | null = null) => {
    if (!isAuthenticated || !firebaseUser) {
      alert('Please sign in to like comments.');
      return;
    }

    // Capture original state for rollback
    const originalComments = [...comments];

    // Apply optimistic updates
    setComments(prev => prev.map(c => {
      // If updating a reply
      if (parentId && c._id === parentId) {
        const updatedReplies = (c.replies || []).map(r => {
          if (r._id === commentId) {
            const wasLiked = r.isLiked || false;
            return {
              ...r,
              isLiked: !wasLiked,
              likesCount: wasLiked ? Math.max(0, r.likesCount - 1) : r.likesCount + 1
            };
          }
          return r;
        });
        return { ...c, replies: updatedReplies };
      }

      // If updating a parent
      if (!parentId && c._id === commentId) {
        const wasLiked = c.isLiked || false;
        return {
          ...c,
          isLiked: !wasLiked,
          likesCount: wasLiked ? Math.max(0, c.likesCount - 1) : c.likesCount + 1
        };
      }

      return c;
    }));

    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/comments/${commentId}/like`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error('Failed to toggle like on backend');
      }
    } catch (err) {
      console.error('Error liking comment, rolling back:', err);
      setComments(originalComments);
    }
  };

  // 4) Handle comment deletion
  const handleDeleteComment = async (commentId: string, parentId: string | null = null) => {
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
        if (parentId) {
          // Remove from parent replies list
          setComments(prev => prev.map(c => {
            if (c._id === parentId) {
              return {
                ...c,
                replies: (c.replies || []).filter(r => r._id !== commentId)
              };
            }
            return c;
          }));
        } else {
          // Remove from parent comments list
          setComments(prev => prev.filter(c => c._id !== commentId));
        }

        // Decrement commentsCount locally in FeedStore
        useFeedStore.getState().updateCommentCount(videoId, -1);
      }
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  const toggleRepliesVisibility = (parentId: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  };

  const renderCommentText = (text: string) => {
    const parts = text.split(/(\s+)/);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const username = part.replace(/^@/, '').replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
        return (
          <Link
            key={index}
            href={`/profile?username=${username}`}
            onClick={onClose}
            className="text-toka-flare font-bold hover:underline"
          >
            {part}
          </Link>
        );
      }
      return part;
    });
  };

  const handleCancelReply = () => {
    if (replyingTo && inputText.trim() === `@${replyingTo.username}`) {
      setInputText('');
    }
    setReplyingTo(null);
  };

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

  const buildReplyTree = (repliesList: Comment[], parentId: string): CommentNode[] => {
    const build = (currParentId: string, currentDepth: number): CommentNode[] => {
      return repliesList
        .filter(r => r.parentId === currParentId)
        .map(r => ({
          ...r,
          depth: currentDepth,
          children: build(r._id, currentDepth + 1)
        }));
    };
    return build(parentId, 1);
  };

  const ReplyNode = ({ node, parentCommentId }: { node: CommentNode; parentCommentId: string }) => {
    const isReplyOwner = mongooseUser && node.userId?._id === mongooseUser._id;
    const isReplyMod = mongooseUser?.role === 'moderator';

    // Indentation dynamic styling
    const indentClass = node.depth === 1 ? 'pl-4' : node.depth === 2 ? 'pl-8' : 'pl-10';

    return (
      <div className={`flex flex-col gap-2 ${indentClass} border-l border-white/5 mt-2`}>
        <div className="flex items-start gap-2.5 group/reply">
          {/* User Initial Avatar */}
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-toka-flare to-orange-700 flex items-center justify-center font-bold text-[9px] text-cloud-white shrink-0 select-none shadow-sm">
            {node.userId?.username?.charAt(0).toUpperCase()}
          </div>

          {/* Reply Details */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center gap-1.5">
              <Link
                href={`/profile?username=${node.userId?.username}`}
                onClick={onClose}
                className="text-[10px] font-bold text-cloud-white hover:underline"
              >
                @{node.userId?.username || 'user'}
              </Link>
              <span className="text-[8px] text-cloud-white/30 font-medium font-mono">
                {getRelativeTime(node.createdAt)}
              </span>
            </div>
            <p className="text-xs text-cloud-white/80 mt-0.5 leading-relaxed">
              {renderCommentText(node.text)}
            </p>

            <div className="flex items-center gap-3.5 mt-1">
              <button
                onClick={() => {
                  setReplyingTo({ commentId: parentCommentId, username: node.userId.username });
                  setInputText(`@${node.userId.username} `);
                }}
                className="text-[8px] font-bold text-cloud-white/45 hover:text-cloud-white transition-colors"
              >
                Reply
              </button>
              {(isReplyOwner || isReplyMod) && (
                <button
                  onClick={() => handleDeleteComment(node._id, parentCommentId)}
                  className="text-[8px] font-bold text-red-500/60 hover:text-red-400 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          {/* Like Reply Toggle */}
          <button
            onClick={() => handleLikeToggle(node._id, parentCommentId)}
            className="flex flex-col items-center gap-0.5 text-cloud-white/40 hover:text-red-500 transition-colors pt-0.5"
          >
            <span className={`material-symbols-outlined text-[14px] ${node.isLiked ? 'text-red-500' : ''}`} style={node.isLiked ? { fontVariationSettings: "'FILL' 1" } : undefined}>
              favorite
            </span>
            <span className="text-[8px] font-mono font-medium">{node.likesCount}</span>
          </button>
        </div>

        {/* Recursive Children rendering */}
        {node.children && node.children.length > 0 && (
          <div className="flex flex-col gap-2 mt-1">
            {node.children.map(child => (
              <ReplyNode key={child._id} node={child} parentCommentId={parentCommentId} />
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end md:items-center md:justify-center">
      {/* Click outside overlay to close */}
      <div className="absolute inset-0" onClick={onClose}></div>

      {/* Sheet panel container */}
      <div className="relative w-full md:w-[460px] h-[75vh] md:h-[600px] bg-midnight-boma border-t md:border border-white/10 rounded-t-3xl md:rounded-3xl flex flex-col mt-auto md:mt-0 shadow-2xl z-10 overflow-hidden font-sans">
        
        {/* Drag handle for mobile */}
        <div className="w-12 h-1 bg-white/15 rounded-full mx-auto my-3 md:hidden"></div>

        {/* Header */}
        <header className="px-6 pb-4 pt-2 md:pt-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-cloud-white">Comments</h2>
            <p className="text-[10px] text-cloud-white/40 font-semibold uppercase tracking-wider mt-0.5 font-mono">
              {comments.length + comments.reduce((acc, c) => acc + (c.replies?.length || 0), 0)} total
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-cloud-white transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </header>

        {/* Scrollable Comments/Thread list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-5 no-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full py-12 gap-2 text-cloud-white/60">
              <span className="w-8 h-8 border-4 border-toka-flare border-t-transparent rounded-full animate-spin"></span>
              <p className="text-xs">Loading conversation...</p>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center gap-3">
              <span className="material-symbols-outlined text-cloud-white/10 text-[48px]">forum</span>
              <p className="text-xs text-cloud-white/40">No comments yet. Start the thread!</p>
            </div>
          ) : (
            comments.map((comment) => {
              const isOwner = mongooseUser && comment.userId?._id === mongooseUser._id;
              const isMod = mongooseUser?.role === 'moderator';
              const showReplies = expandedParents.has(comment._id);

              return (
                <div key={comment._id} className="flex flex-col gap-3">
                  {/* Top-Level Parent Comment */}
                  <div className="flex items-start gap-3 group">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-toka-flare to-orange-700 flex items-center justify-center font-bold text-sm text-cloud-white shrink-0 select-none shadow-sm">
                      {comment.userId?.username?.charAt(0).toUpperCase()}
                    </div>

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
                        {renderCommentText(comment.text)}
                      </p>

                      {/* Comment Action Links */}
                      <div className="flex items-center gap-4 mt-2">
                        <button
                          onClick={() => {
                            setReplyingTo({ commentId: comment._id, username: comment.userId.username });
                            setInputText(`@${comment.userId.username} `);
                          }}
                          className="text-[10px] font-bold text-cloud-white/45 hover:text-cloud-white transition-colors"
                        >
                          Reply
                        </button>
                        {(isOwner || isMod) && (
                          <button
                            onClick={() => handleDeleteComment(comment._id, null)}
                            className="text-[10px] font-bold text-red-500/60 hover:text-red-400 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Like Comment Toggle */}
                    <button
                      onClick={() => handleLikeToggle(comment._id, null)}
                      className="flex flex-col items-center gap-0.5 text-cloud-white/40 hover:text-red-500 transition-colors pt-1"
                    >
                      <span className={`material-symbols-outlined text-[16px] ${comment.isLiked ? 'text-red-500' : ''}`} style={comment.isLiked ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                        favorite
                      </span>
                      <span className="text-[9px] font-mono font-medium">{comment.likesCount}</span>
                    </button>
                  </div>

                  {/* Nested Replies Section */}
                  <div className="flex flex-col gap-1">
                    {/* Expand/Collapse Trigger */}
                    {comment.replies && comment.replies.length > 0 && (
                      <button
                        onClick={() => toggleRepliesVisibility(comment._id)}
                        className="text-[10px] font-bold text-toka-flare hover:underline flex items-center gap-1 w-fit select-none pl-6"
                      >
                        <span className="w-6 h-[1px] bg-toka-flare/20 inline-block mr-1"></span>
                        {showReplies ? 'Hide replies' : `View replies (${comment.replies.length})`}
                      </button>
                    )}

                    {/* Nested Reply Tree rendering */}
                    {showReplies && buildReplyTree(comment.replies || [], comment._id).map(node => (
                      <ReplyNode key={node._id} node={node} parentCommentId={comment._id} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* Input Form Footer */}
        <footer className="p-4 bg-shaded-canopy/60 border-t border-white/5 flex flex-col gap-2">
          {/* Thread replying indicator banner */}
          {replyingTo && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl select-none">
              <span className="text-[10px] text-cloud-white/60 font-semibold">
                Replying to <span className="text-toka-flare font-bold">@{replyingTo.username}</span>
              </span>
              <button
                onClick={handleCancelReply}
                className="text-[10px] font-bold text-red-500 hover:text-red-400"
              >
                Cancel
              </button>
            </div>
          )}

          {isAuthenticated ? (
            <form onSubmit={handleSubmitComment} className="flex items-center gap-2 bg-black/20 border border-white/10 rounded-2xl p-1.5 focus-within:border-toka-flare transition-all">
              <input
                type="text"
                placeholder={replyingTo ? `Reply to @${replyingTo.username}...` : "Add a comment..."}
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
                Please sign in to comment or reply.
              </p>
            </div>
          )}
        </footer>

      </div>
    </div>
  );
}
