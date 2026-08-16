import Status from '../models/Status.js';
import StatusHighlight from '../models/StatusHighlight.js';
import User from '../models/User.js';
import { AppError } from '../middlewares/error.js';
import { sendFcmNotification } from '../services/notificationService.js';
import { supabase } from '../config/supabase.js';

/**
 * Upload buffer to Supabase Storage with fallbacks
 */
const uploadStatusMedia = async (file) => {
  const fileExtension = file.originalname.split('.').pop() || (file.mimetype.startsWith('video') ? 'mp4' : 'jpg');
  const filename = `status_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExtension}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('videos')
    .upload(filename, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (uploadError) {
    console.error('[Supabase Status Media Upload Error]:', uploadError);
    throw new AppError(`Supabase Storage upload failed: ${uploadError.message}`, 500);
  }

  const { data: { publicUrl } } = supabase.storage
    .from('videos')
    .getPublicUrl(filename);

  return publicUrl;
};

/**
 * @desc Get status tray feed (Followers-only + Current User)
 * @route GET /api/status/feed
 * @access Protected
 */
export const getFollowedStatusFeed = async (req, res, next) => {
  const currentUser = await User.findById(req.user._id).select('following username');
  if (!currentUser) {
    throw new AppError('User not found', 404);
  }

  const followedUserIds = currentUser.following || [];
  const allowedUserIds = [currentUser._id, ...followedUserIds];

  const now = new Date();

  // Find all active, non-deleted statuses for followed users and self
  const activeStatuses = await Status.find({
    user: { $in: allowedUserIds },
    expiresAt: { $gt: now },
    isDeleted: false
  })
    .populate('user', '_id username role isBrandSafeVerified avatarUrl')
    .populate('viewers.user', '_id username avatarUrl')
    .populate('reactions.user', '_id username avatarUrl')
    .populate('replies.user', '_id username avatarUrl')
    .sort({ createdAt: 1 })
    .lean();

  // Group statuses by user
  const groupedByUser = {};

  activeStatuses.forEach((status) => {
    if (!status.user) return;
    const userIdStr = status.user._id.toString();
    if (!groupedByUser[userIdStr]) {
      groupedByUser[userIdStr] = {
        user: status.user,
        isSelf: userIdStr === currentUser._id.toString(),
        latestStatusTime: status.createdAt,
        hasUnseen: false,
        statuses: []
      };
    }

    // Check if current user has viewed this status
    const hasViewed = status.viewers?.some(
      (v) => v.user?._id?.toString() === currentUser._id.toString() || v.user?.toString() === currentUser._id.toString()
    );

    if (!hasViewed && userIdStr !== currentUser._id.toString()) {
      groupedByUser[userIdStr].hasUnseen = true;
    }

    if (new Date(status.createdAt) > new Date(groupedByUser[userIdStr].latestStatusTime)) {
      groupedByUser[userIdStr].latestStatusTime = status.createdAt;
    }

    groupedByUser[userIdStr].statuses.push({
      ...status,
      hasViewed: Boolean(hasViewed)
    });
  });

  // Convert to array
  const feedArray = Object.values(groupedByUser);

  // Sorting: Current User always first, then creators with unseen stories, then seen stories (ordered by latest status time)
  feedArray.sort((a, b) => {
    if (a.isSelf) return -1;
    if (b.isSelf) return 1;
    if (a.hasUnseen && !b.hasUnseen) return -1;
    if (!a.hasUnseen && b.hasUnseen) return 1;
    return new Date(b.latestStatusTime).getTime() - new Date(a.latestStatusTime).getTime();
  });

  res.status(200).json({
    status: 'success',
    results: feedArray.length,
    data: {
      stories: feedArray,
      hasSelfStory: Boolean(groupedByUser[currentUser._id.toString()])
    }
  });
};

/**
 * @desc Get a specific creator's active status updates (Followers-only check)
 * @route GET /api/status/user/:userId
 * @access Protected
 */
export const getUserActiveStatuses = async (req, res, next) => {
  const targetUserId = req.params.userId;
  const currentUserId = req.user._id.toString();

  const isSelf = targetUserId === currentUserId;

  if (!isSelf) {
    const currentUser = await User.findById(req.user._id).select('following');
    const isFollowing = currentUser?.following?.some((id) => id.toString() === targetUserId);

    if (!isFollowing) {
      return res.status(403).json({
        status: 'fail',
        isFollowersOnly: true,
        message: "This creator's status updates are followers-only. Follow to view."
      });
    }
  }

  const now = new Date();
  const statuses = await Status.find({
    user: targetUserId,
    expiresAt: { $gt: now },
    isDeleted: false
  })
    .populate('user', '_id username role isBrandSafeVerified avatarUrl')
    .populate('viewers.user', '_id username avatarUrl')
    .populate('reactions.user', '_id username avatarUrl')
    .populate('replies.user', '_id username avatarUrl')
    .sort({ createdAt: 1 })
    .lean();

  const formattedStatuses = statuses.map((status) => {
    const hasViewed = status.viewers?.some(
      (v) => v.user?._id?.toString() === currentUserId || v.user?.toString() === currentUserId
    );
    return {
      ...status,
      hasViewed: Boolean(hasViewed)
    };
  });

  res.status(200).json({
    status: 'success',
    results: formattedStatuses.length,
    data: {
      statuses: formattedStatuses
    }
  });
};

/**
 * @desc Create a new 24-hour status update
 * @route POST /api/status/create
 * @access Protected
 */
export const createStatus = async (req, res, next) => {
  const {
    type = 'text',
    textContent,
    textStyle,
    caption,
    duration,
    stickers,
    audio,
    mediaUrl: providedMediaUrl
  } = req.body;

  let mediaUrl = providedMediaUrl || '';
  let mediaType = '';

  // Handle uploaded file if present
  if (req.file) {
    mediaUrl = await uploadStatusMedia(req.file);
    mediaType = req.file.mimetype;
  }

  // Parse textStyle if provided as string
  let parsedTextStyle = {
    backgroundGradient: 'from-orange-600 via-amber-600 to-rose-700',
    fontFamily: 'sans',
    textColor: '#FAFAFA',
    alignment: 'center'
  };

  if (textStyle) {
    try {
      parsedTextStyle = typeof textStyle === 'string' ? JSON.parse(textStyle) : textStyle;
    } catch (e) {
      console.warn('Failed to parse textStyle:', e);
    }
  }

  // Parse stickers if provided as string
  let parsedStickers = [];
  if (stickers) {
    try {
      parsedStickers = typeof stickers === 'string' ? JSON.parse(stickers) : stickers;
    } catch (e) {
      console.warn('Failed to parse stickers:', e);
    }
  }

  // Parse audio if provided as string
  let parsedAudio = null;
  if (audio) {
    try {
      parsedAudio = typeof audio === 'string' ? JSON.parse(audio) : audio;
    } catch (e) {
      console.warn('Failed to parse audio:', e);
    }
  }

  // Validate type constraints
  if (type === 'text' && (!textContent || textContent.trim().length === 0)) {
    throw new AppError('Text status cannot be empty', 400);
  }

  if ((type === 'image' || type === 'video') && !mediaUrl) {
    throw new AppError('Media status requires a photo or video file/URL', 400);
  }

  // Calculate duration
  const resolvedDuration = type === 'video'
    ? Math.min(Math.max(parseInt(duration, 10) || 15, 3), 30)
    : Math.min(Math.max(parseInt(duration, 10) || 5, 3), 15);

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const status = await Status.create({
    user: req.user._id,
    type,
    textContent,
    textStyle: parsedTextStyle,
    mediaUrl,
    mediaType,
    duration: resolvedDuration,
    stickers: parsedStickers,
    audio: parsedAudio,
    caption,
    expiresAt
  });

  const populatedStatus = await Status.findById(status._id)
    .populate('user', '_id username role isBrandSafeVerified avatarUrl');

  res.status(201).json({
    status: 'success',
    message: 'Status published successfully! Visible to your followers for 24 hours.',
    data: {
      status: populatedStatus
    }
  });
};

/**
 * @desc Record a view on a status update
 * @route POST /api/status/:id/view
 * @access Protected
 */
export const recordStatusView = async (req, res, next) => {
  const statusId = req.params.id;
  const userId = req.user._id;

  const status = await Status.findById(statusId);
  if (!status || status.isDeleted) {
    throw new AppError('Status not found', 404);
  }

  // Check if user already viewed
  const alreadyViewed = status.viewers.some(
    (v) => v.user.toString() === userId.toString()
  );

  if (!alreadyViewed) {
    status.viewers.push({
      user: userId,
      viewedAt: new Date()
    });
    await status.save();
  }

  res.status(200).json({
    status: 'success',
    message: 'View recorded',
    data: {
      viewsCount: status.viewers.length
    }
  });
};

/**
 * @desc Add a floating emoji reaction to a status
 * @route POST /api/status/:id/react
 * @access Protected
 */
export const reactToStatus = async (req, res, next) => {
  const statusId = req.params.id;
  const { emoji } = req.body;

  if (!emoji) {
    throw new AppError('Emoji reaction is required', 400);
  }

  const status = await Status.findById(statusId).populate('user', '_id username');
  if (!status || status.isDeleted) {
    throw new AppError('Status not found', 404);
  }

  status.reactions.push({
    user: req.user._id,
    emoji: emoji.trim(),
    reactedAt: new Date()
  });

  await status.save();

  // Send notification to status creator if reactor is someone else
  if (status.user._id.toString() !== req.user._id.toString()) {
    sendFcmNotification(
      status.user._id,
      `${emoji} New Status Reaction!`,
      `@${req.user.username} reacted with ${emoji} to your 24h status update.`,
      {
        type: 'status_reaction',
        statusId: status._id.toString(),
        reactorUsername: req.user.username,
        emoji
      }
    ).catch(err => console.error('[Status Reaction Notification Failed]', err));
  }

  res.status(200).json({
    status: 'success',
    message: 'Reaction sent',
    data: {
      reactionsCount: status.reactions.length,
      emoji
    }
  });
};

/**
 * @desc Send a direct reply to a status (stores on status + sends inbox notification)
 * @route POST /api/status/:id/reply
 * @access Protected
 */
export const replyToStatus = async (req, res, next) => {
  const statusId = req.params.id;
  const { message } = req.body;

  if (!message || message.trim().length === 0) {
    throw new AppError('Reply message cannot be empty', 400);
  }

  const status = await Status.findById(statusId).populate('user', '_id username');
  if (!status || status.isDeleted) {
    throw new AppError('Status not found', 404);
  }

  status.replies.push({
    user: req.user._id,
    message: message.trim(),
    sentAt: new Date()
  });

  await status.save();

  // Send notification/inbox message to creator
  if (status.user._id.toString() !== req.user._id.toString()) {
    sendFcmNotification(
      status.user._id,
      `💬 Status Reply from @${req.user.username}`,
      `"${message.trim().substring(0, 80)}"`,
      {
        type: 'status_reply',
        statusId: status._id.toString(),
        senderUsername: req.user.username,
        message: message.trim()
      }
    ).catch(err => console.error('[Status Reply Notification Failed]', err));
  }

  res.status(200).json({
    status: 'success',
    message: 'Reply sent directly to creator',
    data: {
      repliesCount: status.replies.length
    }
  });
};

/**
 * @desc Get status analytics (creator-only)
 * @route GET /api/status/:id/analytics
 * @access Protected
 */
export const getStatusAnalytics = async (req, res, next) => {
  const statusId = req.params.id;

  const status = await Status.findById(statusId)
    .populate('viewers.user', '_id username isBrandSafeVerified avatarUrl')
    .populate('reactions.user', '_id username avatarUrl')
    .populate('replies.user', '_id username avatarUrl');

  if (!status || status.isDeleted) {
    throw new AppError('Status not found', 404);
  }

  if (status.user.toString() !== req.user._id.toString()) {
    throw new AppError('You can only view analytics for your own status updates', 403);
  }

  res.status(200).json({
    status: 'success',
    data: {
      viewsCount: status.viewers.length,
      viewers: status.viewers,
      reactionsCount: status.reactions.length,
      reactions: status.reactions,
      repliesCount: status.replies.length,
      replies: status.replies,
      expiresAt: status.expiresAt,
      createdAt: status.createdAt
    }
  });
};

/**
 * @desc Soft delete a status update
 * @route DELETE /api/status/:id
 * @access Protected
 */
export const deleteStatus = async (req, res, next) => {
  const statusId = req.params.id;

  const status = await Status.findById(statusId);
  if (!status) {
    throw new AppError('Status not found', 404);
  }

  if (status.user.toString() !== req.user._id.toString() && req.user.role !== 'moderator') {
    throw new AppError('You are not authorized to delete this status', 403);
  }

  status.isDeleted = true;
  await status.save();

  res.status(200).json({
    status: 'success',
    message: 'Status deleted successfully'
  });
};

/**
 * @desc Create or add to a Profile Highlight reel
 * @route POST /api/status/highlights
 * @access Protected
 */
export const createOrUpdateHighlight = async (req, res, next) => {
  const { title, coverUrl, coverGradient, coverType, statusIds, highlightId } = req.body;

  if (!title && !highlightId) {
    throw new AppError('Please provide a highlight title', 400);
  }

  if (highlightId) {
    const highlight = await StatusHighlight.findById(highlightId);
    if (!highlight || highlight.user.toString() !== req.user._id.toString()) {
      throw new AppError('Highlight not found or unauthorized', 404);
    }

    if (title) highlight.title = title.trim();
    if (coverUrl !== undefined) highlight.coverUrl = coverUrl;
    if (coverGradient !== undefined) highlight.coverGradient = coverGradient;
    if (coverType !== undefined) highlight.coverType = coverType;
    if (statusIds && Array.isArray(statusIds)) highlight.statuses = statusIds;

    await highlight.save();
    return res.status(200).json({
      status: 'success',
      message: 'Highlight updated',
      data: { highlight }
    });
  }

  const highlight = await StatusHighlight.create({
    user: req.user._id,
    title: title.trim(),
    coverUrl: coverUrl || '',
    coverGradient: coverGradient || 'from-orange-600 to-amber-600',
    coverType: coverType || 'gradient',
    statuses: statusIds || []
  });

  res.status(201).json({
    status: 'success',
    message: 'Highlight created successfully on your profile!',
    data: { highlight }
  });
};

/**
 * @desc Get a creator's profile highlights
 * @route GET /api/status/highlights/:userId
 * @access Protected / Public
 */
export const getUserHighlights = async (req, res, next) => {
  const userId = req.params.userId;

  const highlights = await StatusHighlight.find({
    user: userId,
    isDeleted: false
  })
    .populate({
      path: 'statuses',
      match: { isDeleted: false },
      populate: {
        path: 'user',
        select: '_id username email isBrandSafeVerified avatarUrl'
      }
    })
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    results: highlights.length,
    data: { highlights }
  });
};

/**
 * @desc Delete a profile highlight
 * @route DELETE /api/status/highlights/:id
 * @access Protected
 */
export const deleteHighlight = async (req, res, next) => {
  const highlight = await StatusHighlight.findById(req.params.id);
  if (!highlight) {
    throw new AppError('Highlight not found', 404);
  }

  if (highlight.user.toString() !== req.user._id.toString()) {
    throw new AppError('Unauthorized', 403);
  }

  highlight.isDeleted = true;
  await highlight.save();

  res.status(200).json({
    status: 'success',
    message: 'Highlight removed from profile'
  });
};
