import Comment from '../models/Comment.js';
import Video from '../models/Video.js';
import { AppError } from '../middlewares/error.js';
import { sendFcmNotification } from '../services/notificationService.js';

/**
 * Fetch all comments for a specific video (structured as parent comments with populated replies)
 */
export const getVideoComments = async (req, res, next) => {
  const { videoId } = req.params;
  const userId = req.user?._id; // Populate isLiked if optionalProtect is run

  try {
    const allComments = await Comment.find({ videoId })
      .populate('userId', 'username role')
      .sort({ createdAt: 1 });

    const formattedComments = allComments.map(c => {
      const obj = c.toObject();
      const isLiked = userId ? (c.likedBy && c.likedBy.some(id => id.toString() === userId.toString())) : false;
      delete obj.likedBy;
      return {
        ...obj,
        isLiked
      };
    });

    // Filter parents and replies
    const parents = formattedComments.filter(c => !c.parentId);
    const replies = formattedComments.filter(c => c.parentId);

    // Map nested replies into parents
    const commentsWithReplies = parents.map(parent => {
      const parentReplies = replies.filter(r => r.parentId.toString() === parent._id.toString());
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

    const comment = await Comment.create({
      videoId,
      userId,
      text: text.trim(),
      parentId: parentId || null
    });

    // Populate user info for immediate rendering
    await comment.populate('userId', 'username role');

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
