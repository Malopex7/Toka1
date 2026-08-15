"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useFeedStore } from '@/store/useFeedStore';
import { useModalStore } from '@/store/useModalStore';
import Link from 'next/link';
import MentionInput from './MentionInput';

interface CommentUser {
  _id: string;
  username: string;
  role: string;
  isBrandSafeVerified?: boolean;
}

interface Comment {
  _id: string;
  videoId: string;
  userId: CommentUser;
  text: string;
  parentId: string | null;
  likesCount: number;
  isLiked?: boolean;
  isLikedByCreator?: boolean;
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
  creatorId: string;
  highlightCommentId?: string;
}

export default function CommentsModal({ isOpen, onClose, videoId, creatorId, highlightCommentId }: CommentsModalProps) {
  const { mongooseUser, isAuthenticated, firebaseUser } = useAuth();
  const { showAlert, showConfirm, showPrompt } = useModalStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Thread reply state — tracks which specific comment/reply has the inline reply box open
  const [activeReplyBoxId, setActiveReplyBoxId] = useState<string | null>(null);
  const [inlineInputText, setInlineInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; targetCommentId: string; username: string } | null>(null);
  // Track expanded reply sections (parent comment IDs)
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

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

  // 1.5) Handle auto-expanding and scrolling to the highlighted comment/reply
  useEffect(() => {
    if (!isOpen || !highlightCommentId || comments.length === 0) return;

    // Find the parent comment of the highlighted comment (if it is a reply)
    let parentId: string | null = null;
    for (const c of comments) {
      if (String(c._id) === String(highlightCommentId)) {
        parentId = String(c._id);
        break;
      }
      if (c.replies?.some(r => String(r._id) === String(highlightCommentId))) {
        parentId = String(c._id);
        break;
      }
    }

    if (parentId) {
      // Expand the parent thread so the reply is rendered in the DOM
      setExpandedParents(prev => {
        const next = new Set(prev);
        next.add(parentId!);
        return next;
      });
    }

    setHighlightedId(highlightCommentId);

    // Wait for the DOM to render the expanded thread, then scroll to it
    const scrollTimer = setTimeout(() => {
      const element = document.querySelector(`[data-comment-id="${highlightCommentId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 450);

    // Fade out the highlight after 3 seconds
    const fadeTimer = setTimeout(() => {
      setHighlightedId(null);
    }, 3000);

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(fadeTimer);
    };
  }, [isOpen, highlightCommentId, comments]);

  // Scroll to bottom when root comment list length increases
  useEffect(() => {
    if (!replyingTo && !highlightCommentId) {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments.length, replyingTo, highlightCommentId]);

  // 2) Handle posting comments or replies
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !firebaseUser) {
      showAlert('Sign In Required', 'Please sign in to comment.');
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
          // Add comment to the correct parent (either direct or nested reply)
          setComments(prev => prev.map(c => {
            const isDirectParent = String(c._id) === String(parentId);
            const hasTargetReply = c.replies?.some(r => String(r._id) === String(parentId));

            if (isDirectParent || hasTargetReply) {
              return {
                ...c,
                replies: [...(c.replies || []), newComment]
              };
            }
            return c;
          }));

          // Automatically expand the top-level parent's reply thread
          const parentComment = comments.find(c =>
            String(c._id) === String(parentId) ||
            c.replies?.some(r => String(r._id) === String(parentId))
          );
          if (parentComment) {
            setExpandedParents(prev => {
              const next = new Set(prev);
              next.add(String(parentComment._id));
              return next;
            });
          }
        } else {
          // Add to top-level comment list
          setComments(prev => [...prev, newComment]);
        }

        setInlineInputText('');
        setActiveReplyBoxId(null);
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

  // Wrapper to handle inline reply submission from a specific comment
  // - immediateParentId: the specific comment/reply being replied to (stored as parentId in DB)
  // - rootCommentId: the top-level comment this thread belongs to (used for state updates)
  const handleInlineReply = async (e: React.FormEvent, immediateParentId: string, rootCommentId: string, targetUsername: string) => {
    e.preventDefault();
    if (!isAuthenticated || !firebaseUser) {
      showAlert('Sign In Required', 'Please sign in to reply.');
      return;
    }
    if (!inlineInputText.trim()) return;

    setSubmitting(true);

    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/${videoId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          text: inlineInputText.trim(),
          parentId: immediateParentId  // correct: the specific reply being replied to
        })
      });

      const data = await res.json();
      if (data.status === 'success') {
        const newComment: Comment = data.data.comment;
        newComment.replies = [];
        newComment.isLiked = false;
        newComment.likesCount = 0;
        // Ensure parentId is set correctly for buildReplyTree to work
        newComment.parentId = immediateParentId;

        // Append to the flat replies array of the root comment
        setComments(prev => prev.map(c => {
          if (String(c._id) === String(rootCommentId)) {
            return { ...c, replies: [...(c.replies || []), newComment] };
          }
          return c;
        }));

        // Ensure the root comment thread is expanded
        setExpandedParents(prev => {
          const next = new Set(prev);
          next.add(String(rootCommentId));
          return next;
        });

        setInlineInputText('');
        setActiveReplyBoxId(null);
        setReplyingTo(null);
        useFeedStore.getState().updateCommentCount(videoId, 1);
      }
    } catch (err) {
      console.error('Error posting reply:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // 3) Handle comment/reply likes (optimistic updates)
  const handleLikeToggle = async (commentId: string, parentId: string | null = null) => {
    if (!isAuthenticated || !firebaseUser) {
      showAlert('Sign In Required', 'Please sign in to like comments.');
      return;
    }

    // Capture original state for rollback
    const originalComments = [...comments];

    const isCreator = mongooseUser && String(mongooseUser._id) === String(creatorId);

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
              isLikedByCreator: isCreator ? !wasLiked : r.isLikedByCreator,
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
          isLikedByCreator: isCreator ? !wasLiked : c.isLikedByCreator,
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
  const handleDeleteComment = (commentId: string, parentId: string | null = null) => {
    if (!isAuthenticated || !firebaseUser) return;

    showConfirm(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      async () => {
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
      }
    );
  };

  const handleEditComment = (commentId: string, currentText: string, parentId: string | null = null) => {
    if (!isAuthenticated || !firebaseUser) return;

    showPrompt(
      'Edit Comment',
      'Update your comment:',
      async (newText) => {
        if (!newText || !newText.trim()) {
          showAlert('Validation Error', 'Comment content cannot be empty.');
          return;
        }

        try {
          const token = await firebaseUser.getIdToken();
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/comments/${commentId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ text: newText.trim() })
          });

          const data = await res.json();
          if (res.ok && data.status === 'success') {
            const updatedComment = data.data.comment;

            if (parentId) {
              setComments(prev => prev.map(c => {
                if (String(c._id) === String(parentId)) {
                  return {
                    ...c,
                    replies: (c.replies || []).map(r => String(r._id) === String(commentId) ? { ...r, text: updatedComment.text } : r)
                  };
                }
                return c;
              }));
            } else {
              setComments(prev => prev.map(c => String(c._id) === String(commentId) ? { ...c, text: updatedComment.text } : c));
            }
            showAlert('Success', 'Comment updated successfully.');
          } else {
            showAlert('Error', data.message || 'Failed to update comment.');
          }
        } catch (err: any) {
          console.error('[Edit Comment] Request failed:', err);
          showAlert('Error', err.message || 'An error occurred while updating the comment.');
        }
      },
      'Edit your comment...',
      currentText
    );
  };

  // 5) Handle comment reporting
  const handleReportComment = (commentId: string) => {
    if (!isAuthenticated || !firebaseUser) {
      showAlert('Sign In Required', 'Please sign in to report comments.');
      return;
    }

    showPrompt(
      'Report Comment',
      'Please specify a reason for reporting this comment (e.g. spam, harassment, inappropriate content):',
      async (reason) => {
        if (!reason || reason.trim() === '') {
          showAlert('Validation Error', 'A report reason is required.');
          return;
        }

        try {
          const token = await firebaseUser.getIdToken();
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/comments/${commentId}/report`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ reason: reason.trim() })
          });

          const data = await res.json();
          if (res.ok) {
            showAlert('Report Submitted', 'Thank you! This comment has been flagged and queued for moderation review.');
          } else {
            showAlert('Report Failed', data.message || 'Failed to report comment.');
          }
        } catch (err) {
          console.error('Error reporting comment:', err);
          showAlert('Error', 'Error submitting report.');
        }
      },
      'Reason (e.g. spam, harassment)'
    );
  };

  const toggleRepliesVisibility = (parentId: string) => {
    const strId = String(parentId);
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(strId)) {
        next.delete(strId);
      } else {
        next.add(strId);
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
    if (replyingTo && inlineInputText.trim().startsWith(`@${replyingTo.username}`)) {
      setInlineInputText('');
    }
    setReplyingTo(null);
    setActiveReplyBoxId(null);
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
        .filter(r => r.parentId && String(r.parentId) === String(currParentId))
        .map(r => ({
          ...r,
          depth: currentDepth,
          children: build(String(r._id), currentDepth + 1)
        }));
    };
    return build(String(parentId), 1);
  };

  // Inline reply box rendered directly beneath a comment or reply
  // - targetCommentId: the specific comment/reply being replied to (parentId for POST)
  // - rootCommentId: the top-level parent comment (for state update)
  const InlineReplyBox = ({ targetCommentId, rootCommentId, targetUsername }: { targetCommentId: string; rootCommentId: string; targetUsername: string }) => {
    if (!isAuthenticated) return null;
    return (
      <form
        onSubmit={(e) => handleInlineReply(e, targetCommentId, rootCommentId, targetUsername)}
        className="flex items-center gap-2 bg-black/25 border border-toka-flare/30 rounded-xl p-1.5 mt-1.5 focus-within:border-toka-flare transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1">
          <MentionInput
            as="input"
            autoFocus
            placeholder={`Reply to @${targetUsername}...`}
            value={inlineInputText}
            onChange={(val) => setInlineInputText(val)}
            maxLength={500}
            className="w-full bg-transparent px-2 py-1.5 text-xs text-cloud-white focus:outline-none placeholder-cloud-white/30"
            popoverPlacement="top"
          />
        </div>
        <button
          type="button"
          onClick={handleCancelReply}
          className="text-[9px] font-bold text-cloud-white/40 hover:text-red-400 px-1 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting || !inlineInputText.trim()}
          className="px-3 py-1.5 bg-toka-flare hover:bg-toka-flare/90 disabled:bg-white/5 disabled:text-white/20 text-cloud-white rounded-lg text-[10px] font-bold transition-all active:scale-95 shrink-0"
        >
          {submitting ? '...' : 'Post'}
        </button>
      </form>
    );
  };

  const ReplyNode = ({ node, parentCommentId }: { node: CommentNode; parentCommentId: string }) => {
    const isReplyOwner = mongooseUser && node.userId?._id === mongooseUser._id;
    const isReplyMod = mongooseUser?.role === 'moderator';

    // Indentation dynamic styling
    const indentClass = node.depth === 1 ? 'pl-4' : node.depth === 2 ? 'pl-8' : 'pl-10';
    const isHighlighted = highlightedId === String(node._id);

    return (
      <div className={`flex flex-col gap-2 ${indentClass} border-l border-white/5 mt-2`}>
        <div 
          data-comment-id={node._id}
          className={`flex items-start gap-2.5 group/reply p-2 rounded-xl transition-all duration-500 ${
            isHighlighted 
              ? 'bg-toka-flare/10 ring-2 ring-toka-flare shadow-[0_0_12px_rgba(255,79,0,0.2)] animate-pulse' 
              : ''
          }`}
        >
          {/* User Initial Avatar with Verified Badge */}
          <div className="relative shrink-0">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-toka-flare to-orange-700 flex items-center justify-center font-bold text-[9px] text-cloud-white select-none shadow-sm">
              {node.userId?.username?.charAt(0).toUpperCase()}
            </div>
            {node.userId?.isBrandSafeVerified && (
              <div className="absolute -bottom-0.5 -right-0.5 bg-midnight-boma rounded-full p-0.2 shadow-sm flex items-center justify-center">
                <span className="material-symbols-outlined text-toka-flare text-[9px] block leading-none" style={{ fontSize: '9px', width: '9px', height: '9px' }}>
                  verified
                </span>
              </div>
            )}
          </div>

          {/* Reply Details */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link
                href={`/profile?username=${node.userId?.username}`}
                onClick={onClose}
                className="text-[10px] font-bold text-cloud-white hover:underline flex items-center gap-1"
              >
                @{node.userId?.username || 'user'}
                {node.userId?.isBrandSafeVerified && (
                  <span className="material-symbols-outlined text-toka-flare text-[12px] shrink-0" title="Verified">
                    verified
                  </span>
                )}
              </Link>
              {String(node.userId?._id) === String(creatorId) && (
                <span className="text-[8px] font-black text-cloud-white bg-toka-flare px-1 py-0.5 rounded uppercase tracking-wider select-none leading-none scale-[0.9]">
                  Creator
                </span>
              )}
              <span className="text-[8px] text-cloud-white/30 font-medium font-mono">
                {getRelativeTime(node.createdAt)}
              </span>
            </div>
            <p className="text-xs text-cloud-white/80 mt-0.5 leading-relaxed">
              {renderCommentText(node.text)}
            </p>
            {node.isLikedByCreator && (
              <div className="flex items-center gap-1 mt-1 text-[9px] text-toka-flare font-semibold">
                <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                <span>Liked by creator</span>
              </div>
            )}

            <div className="flex items-center gap-3.5 mt-1">
              <button
                onClick={() => {
                  const isOpen = activeReplyBoxId === String(node._id);
                  setActiveReplyBoxId(isOpen ? null : String(node._id));
                  setInlineInputText(isOpen ? '' : `@${node.userId.username} `);
                  setReplyingTo(isOpen ? null : { commentId: parentCommentId, targetCommentId: String(node._id), username: node.userId.username });
                }}
                className={`text-[8px] font-bold transition-colors ${
                  activeReplyBoxId === String(node._id) ? 'text-toka-flare' : 'text-cloud-white/45 hover:text-cloud-white'
                }`}
              >
                {activeReplyBoxId === String(node._id) ? 'Cancel' : 'Reply'}
              </button>
              <button
                onClick={() => handleReportComment(node._id)}
                className="text-[8px] font-bold text-cloud-white/45 hover:text-red-400 transition-colors"
              >
                Report
              </button>
              {isReplyOwner && (
                <button
                  onClick={() => handleEditComment(node._id, node.text, parentCommentId)}
                  className="text-[8px] font-bold text-cloud-white/45 hover:text-cloud-white transition-colors"
                >
                  Edit
                </button>
              )}
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

        {/* Inline reply box beneath this specific reply */}
        {activeReplyBoxId === String(node._id) && (
          <InlineReplyBox
            targetCommentId={String(node._id)}
            rootCommentId={parentCommentId}
            targetUsername={node.userId.username}
          />
        )}

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
              const showReplies = expandedParents.has(String(comment._id));
              const isHighlighted = highlightedId === String(comment._id);

              return (
                <div key={comment._id} className="flex flex-col gap-3">
                  {/* Top-Level Parent Comment */}
                  <div 
                    data-comment-id={comment._id}
                    className={`flex items-start gap-3 group/comment p-2 rounded-2xl transition-all duration-500 ${
                      isHighlighted 
                        ? 'bg-toka-flare/10 ring-2 ring-toka-flare shadow-[0_0_12px_rgba(255,79,0,0.2)] animate-pulse' 
                        : ''
                    }`}
                  >
                    {/* User Initial Avatar with Verified Badge */}
                    <div className="relative shrink-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-toka-flare to-orange-700 flex items-center justify-center font-bold text-xs text-cloud-white select-none shadow-md">
                        {comment.userId?.username?.charAt(0).toUpperCase()}
                      </div>
                      {comment.userId?.isBrandSafeVerified && (
                        <div className="absolute -bottom-0.5 -right-0.5 bg-midnight-boma rounded-full p-0.5 shadow-sm flex items-center justify-center">
                          <span className="material-symbols-outlined text-toka-flare text-[10px] block leading-none" style={{ fontSize: '10px', width: '10px', height: '10px' }}>
                            verified
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 flex flex-col">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link
                          href={`/profile?username=${comment.userId?.username}`}
                          onClick={onClose}
                          className="text-xs font-bold text-cloud-white hover:underline flex items-center gap-1"
                        >
                          @{comment.userId?.username || 'user'}
                          {comment.userId?.isBrandSafeVerified && (
                            <span className="material-symbols-outlined text-toka-flare text-[14px] shrink-0" title="Verified">
                              verified
                            </span>
                          )}
                        </Link>
                        {String(comment.userId?._id) === String(creatorId) && (
                          <span className="text-[8px] font-black text-cloud-white bg-toka-flare px-1.5 py-0.5 rounded uppercase tracking-wider select-none leading-none scale-[0.9]">
                            Creator
                          </span>
                        )}
                        <span className="text-[10px] text-cloud-white/30 font-medium">
                          {getRelativeTime(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-cloud-white/80 mt-1 leading-relaxed">
                        {renderCommentText(comment.text)}
                      </p>
                      {comment.isLikedByCreator && (
                        <div className="flex items-center gap-1 mt-1 text-[9px] text-toka-flare font-semibold">
                          <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                          <span>Liked by creator</span>
                        </div>
                      )}

                      {/* Comment Action Links */}
                    <div className="flex items-center gap-4 mt-2">
                      <button
                        onClick={() => {
                          const isOpen = activeReplyBoxId === String(comment._id);
                          setActiveReplyBoxId(isOpen ? null : String(comment._id));
                          setInlineInputText(isOpen ? '' : `@${comment.userId.username} `);
                          setReplyingTo(isOpen ? null : { commentId: String(comment._id), targetCommentId: String(comment._id), username: comment.userId.username });
                        }}
                        className={`text-[10px] font-bold transition-colors ${
                          activeReplyBoxId === String(comment._id) ? 'text-toka-flare' : 'text-cloud-white/45 hover:text-cloud-white'
                        }`}
                      >
                        {activeReplyBoxId === String(comment._id) ? 'Cancel' : 'Reply'}
                      </button>
                      <button
                        onClick={() => handleReportComment(comment._id)}
                        className="text-[10px] font-bold text-cloud-white/45 hover:text-red-400 transition-colors"
                      >
                        Report
                      </button>
                      {isOwner && (
                        <button
                          onClick={() => handleEditComment(comment._id, comment.text, null)}
                          className="text-[10px] font-bold text-cloud-white/45 hover:text-cloud-white transition-colors"
                        >
                          Edit
                        </button>
                      )}
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

                  {/* Inline reply box beneath this specific parent comment */}
                  {activeReplyBoxId === String(comment._id) && (
                    <InlineReplyBox
                      targetCommentId={String(comment._id)}
                      rootCommentId={String(comment._id)}
                      targetUsername={comment.userId.username}
                    />
                  )}

                  {/* Nested Replies Section */}
                  <div className="flex flex-col gap-1">
                    {/* Expand/Collapse Trigger */}
                    {comment.replies && comment.replies.length > 0 && (
                      <button
                        onClick={() => toggleRepliesVisibility(String(comment._id))}
                        className="text-[10px] font-bold text-toka-flare hover:underline flex items-center gap-1 w-fit select-none pl-6"
                      >
                        <span className="w-6 h-[1px] bg-toka-flare/20 inline-block mr-1"></span>
                        {showReplies ? 'Hide replies' : `View replies (${comment.replies.length})`}
                      </button>
                    )}

                    {/* Nested Reply Tree rendering */}
                    {showReplies && buildReplyTree(comment.replies || [], String(comment._id)).map(node => (
                      <ReplyNode key={node._id} node={node} parentCommentId={comment._id} />
                    ))}
                  </div>
                </div>
              );
            })
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* Footer: only for new top-level comments */}
        <footer className="p-4 bg-shaded-canopy/60 border-t border-white/5">
          {isAuthenticated ? (
            <form onSubmit={handleSubmitComment} className="flex items-center gap-2 bg-black/20 border border-white/10 rounded-2xl p-1.5 focus-within:border-toka-flare transition-all">
              <div className="flex-1">
                <MentionInput
                  as="input"
                  placeholder="Add a comment... (type @ to tag users)"
                  value={inputText}
                  onChange={(val) => setInputText(val)}
                  maxLength={500}
                  className="w-full bg-transparent px-3 py-2 text-xs text-cloud-white focus:outline-none placeholder-cloud-white/40"
                  popoverPlacement="top"
                />
              </div>
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
              <p className="text-xs text-cloud-white/50">Please sign in to comment.</p>
            </div>
          )}
        </footer>

      </div>
    </div>
  );
}
