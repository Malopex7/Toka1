import Comment from '../models/Comment.js';
import Video from '../models/Video.js';
import { AppError } from '../middlewares/error.js';
import { sendFcmNotification } from '../services/notificationService.js';
import { extractMentions } from './videoController.js';

/**
 * Fetch all comments for a specific video (structured as parent comments with populated replies)
 */
export const getVideoComments = async (req, res, next) => {
  const { videoId } = req.params;
  const userId = req.user?._id; // Populate isLiked if optionalProtect is run

  try {
    const video = await Video.findById(videoId);
    const creatorIdStr = video ? video.creatorId.toString() : null;

    const allComments = await Comment.find({ videoId })
      .populate('userId', 'username role')
      .sort({ createdAt: 1 });

    const formattedComments = allComments.map(c => {
      const obj = c.toObject();
      const isLiked = userId ? (c.likedBy && c.likedBy.some(id => id.toString() === userId.toString())) : false;
      const isLikedByCreator = creatorIdStr ? (c.likedBy && c.likedBy.some(id => id.toString() === creatorIdStr)) : false;
      delete obj.likedBy;
      return {
        ...obj,
        isLiked,
        isLikedByCreator
      };
    });

    // Create a map of all comments for quick hierarchy lookup
    const commentsMap = new Map();
    formattedComments.forEach(c => {
      commentsMap.set(c._id.toString(), c);
    });

    const findRootParentId = (commentId) => {
      let curr = commentsMap.get(commentId.toString());
      if (!curr) return null;
      while (curr.parentId) {
        const parent = commentsMap.get(curr.parentId.toString());
        if (!parent) break;
        curr = parent;
      }
      return curr._id.toString();
    };

    // Filter parents and replies
    const parents = formattedComments.filter(c => !c.parentId);
    const replies = formattedComments.filter(c => c.parentId);

    // Map replies (at any depth) under their root top-level parent comment
    const commentsWithReplies = parents.map(parent => {
      const parentIdStr = parent._id.toString();
      const parentReplies = replies.filter(r => {
        const rootParentId = findRootParentId(r._id);
        return rootParentId === parentIdStr;
      });

      return {
        ...parent,
        replies: parentReplies
      };
    });

    res.status(200).json({
      status: 'success',
      results: commentsWithReplies.length,
      data: { comments: commentsWithReplies }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Add a comment or nested reply to a video
 */
export const addComment = async (req, res, next) => {
  const { videoId } = req.params;
  const { text, parentId } = req.body;
  const userId = req.user._id;

  try {
    if (!text || text.trim() === '') {
      throw new AppError('Comment text cannot be empty.', 400);
    }

    const video = await Video.findById(videoId);
    if (!video) {
      throw new AppError('Video not found', 404);
    }

    // Verify parent comment exists if parentId is supplied
    if (parentId) {
      const parentComment = await Comment.findById(parentId);
      if (!parentComment) {
        throw new AppError('Parent comment not found', 404);
      }
    }

    const mentionedUsers = await extractMentions(text, userId);

    const comment = await Comment.create({
      videoId,
      userId,
      text: text.trim(),
      parentId: parentId || null,
      mentions: mentionedUsers.map(u => u._id)
    });

    // Populate user info for immediate rendering
    await comment.populate('userId', 'username role');

    // Notify mentioned users (excluding creator/parent if already notified)
    for (const mentionedUser of mentionedUsers) {
      if (mentionedUser._id.toString() !== video.creatorId.toString()) {
        sendFcmNotification(
          mentionedUser._id,
          'You were mentioned in a comment!',
          `@${req.user.username} mentioned you: "${text.substring(0, 40)}${text.length > 40 ? '...' : ''}"`,
          {
            type: 'comment_mention',
            videoId: videoId.toString(),
            commentId: comment._id.toString(),
            creatorName: req.user.username
          }
        ).catch(err => console.error('[FCM Comment Mention Failed]', err));
      }
    }

    // Notify the video creator (if it's not the creator themselves commenting)
    if (video.creatorId.toString() !== userId.toString()) {
      sendFcmNotification(
        video.creatorId,
        parentId ? 'New Reply on Your Video!' : 'New Comment on Your Video!',
        `@${req.user.username} commented: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`,
        {
          type: 'new_comment',
          videoId: videoId.toString()
        }
      ).catch(err => console.error('[FCM Comment Notification Failed]', err));
    }

    // Notify the parent comment author if this is a reply (and not replying to oneself)
    if (parentId) {
      const parentComment = await Comment.findById(parentId);
      if (parentComment && parentComment.userId.toString() !== userId.toString()) {
        sendFcmNotification(
          parentComment.userId,
          'New Reply on Your Comment!',
          `@${req.user.username} replied: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`,
          {
            type: 'comment_reply',
            videoId: videoId.toString(),
            commentId: comment._id.toString()
          }
        ).catch(err => console.error('[FCM Reply Notification Failed]', err));
      }
    }

    res.status(201).json({
      status: 'success',
      data: { comment }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Toggle liking a comment
 */
export const toggleLikeComment = async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  try {
    const comment = await Comment.findById(id);
    if (!comment) {
      throw new AppError('Comment not found', 404);
    }

    if (!comment.likedBy) {
      comment.likedBy = [];
    }

    const isLiked = comment.likedBy.some(uid => uid.toString() === userId.toString());

    if (isLiked) {
      comment.likedBy = comment.likedBy.filter(uid => uid.toString() !== userId.toString());
      comment.likesCount = Math.max(0, (comment.likesCount || 0) - 1);
    } else {
      comment.likedBy.push(userId);
      comment.likesCount = (comment.likesCount || 0) + 1;
    }

    await comment.save();

    if (!isLiked && comment.userId.toString() !== userId.toString()) {
      sendFcmNotification(
        comment.userId,
        'Comment Liked!',
        `@${req.user.username} liked your comment: "${comment.text.substring(0, 30)}${comment.text.length > 30 ? '...' : ''}"`,
        {
          type: 'comment_like',
          videoId: comment.videoId.toString(),
          commentId: comment._id.toString()
        }
      ).catch(err => console.error('[FCM Comment Like Notification Failed]', err));
    }

    res.status(200).json({
      status: 'success',
      data: {
        likesCount: comment.likesCount,
        isLiked: !isLiked
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a comment (only by comment author or a moderator)
 */
export const deleteComment = async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;
  const userRole = req.user.role;

  try {
    const comment = await Comment.findById(id);
    if (!comment) {
      throw new AppError('Comment not found', 404);
    }

    // Auth check: Owner of comment or a moderator
    if (comment.userId.toString() !== userId.toString() && userRole !== 'moderator') {
      throw new AppError('You do not have permission to delete this comment.', 403);
    }

    // Delete comment and any of its nested replies recursively
    await Comment.deleteMany({ $or: [{ _id: id }, { parentId: id }] });

    res.status(200).json({
      status: 'success',
      message: 'Comment and its replies deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Report a comment or reply for moderation review
 */
export const reportComment = async (req, res, next) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = req.user._id;

  try {
    const comment = await Comment.findById(id);
    if (!comment) {
      throw new AppError('Comment not found', 404);
    }

    if (!comment.reportedBy) {
      comment.reportedBy = [];
    }

    const alreadyReported = comment.reportedBy.some(uid => uid.toString() === userId.toString());
    if (alreadyReported) {
      throw new AppError('You have already reported this comment.', 400);
    }

    comment.reportedBy.push(userId);
    comment.reportsCount = (comment.reportsCount || 0) + 1;
    
    if (reason && reason.trim() !== '') {
      if (!comment.reportReasons) {
        comment.reportReasons = [];
      }
      comment.reportReasons.push(reason.trim());
    }

    await comment.save();

    res.status(200).json({
      status: 'success',
      message: 'Comment reported successfully for moderation review.',
      data: {
        reportsCount: comment.reportsCount
      }
    });
  } catch (err) {
    next(err);
  }
};

export const updateComment = async (req, res, next) => {
  const { id } = req.params;
  const { text } = req.body;
  const userId = req.user._id;

  try {
    if (!text || !text.trim()) {
      throw new AppError('Comment content cannot be empty.', 400);
    }

    const comment = await Comment.findById(id);
    if (!comment) {
      throw new AppError('Comment not found', 404);
    }

    // Auth check: Only the owner/author can update the comment
    if (comment.userId.toString() !== userId.toString()) {
      throw new AppError('You do not have permission to edit this comment.', 403);
    }

    comment.text = text.trim();
    await comment.save();

    // Populate user details for returning
    const populated = await Comment.findById(comment._id).populate('userId', 'username role');

    res.status(200).json({
      status: 'success',
      message: 'Comment updated successfully.',
      data: {
        comment: populated
      }
    });
  } catch (err) {
    next(err);
  }
};
