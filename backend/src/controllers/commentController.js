import Comment from '../models/Comment.js';
import Video from '../models/Video.js';
import { AppError } from '../middlewares/error.js';
import { sendFcmNotification } from '../services/notificationService.js';

/**
 * Fetch all comments for a specific video (ordered by oldest first)
 */
export const getVideoComments = async (req, res, next) => {
  const { videoId } = req.params;

  try {
    const comments = await Comment.find({ videoId })
      .populate('userId', 'username role')
      .sort({ createdAt: 1 });

    res.status(200).json({
      status: 'success',
      results: comments.length,
      data: { comments }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Add a comment to a video
 */
export const addComment = async (req, res, next) => {
  const { videoId } = req.params;
  const { text } = req.body;
  const userId = req.user._id;

  try {
    if (!text || text.trim() === '') {
      throw new AppError('Comment text cannot be empty.', 400);
    }

    const video = await Video.findById(videoId);
    if (!video) {
      throw new AppError('Video not found', 404);
    }

    const comment = await Comment.create({
      videoId,
      userId,
      text: text.trim()
    });

    // Populate user info for frontend immediate render response
    await comment.populate('userId', 'username role');

    // Notify the video creator (if it's not the creator themselves commenting)
    if (video.creatorId.toString() !== userId.toString()) {
      sendFcmNotification(
        video.creatorId,
        'New Comment on Your Video!',
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

    await comment.deleteOne();

    res.status(200).json({
      status: 'success',
      message: 'Comment deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
};
