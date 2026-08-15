import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import Video from '../models/Video.js';
import Comment from '../models/Comment.js';
import User from '../models/User.js';
import SponsorshipRequest from '../models/SponsorshipRequest.js';
import { AppError } from '../middlewares/error.js';
import { runAiPipeline } from '../services/aiPipeline.js';
import { sendFcmNotification } from '../services/notificationService.js';

// Helper: Extract @usernames from text and find matching user IDs respecting tagging permissions
export const extractMentions = async (text, currentUserId) => {
  if (!text) return [];
  const mentionMatches = text.match(/@([a-zA-Z0-9_]+)/g);
  if (!mentionMatches || mentionMatches.length === 0) return [];

  const usernames = Array.from(new Set(mentionMatches.map(m => m.slice(1).toLowerCase())));
  const users = await User.find({
    username: { $in: usernames.map(u => new RegExp(`^${u}$`, 'i')) },
    _id: { $ne: currentUserId }
  }).select('_id username taggingPermission');

  // Filter out creators who have opted to disable tagging entirely
  return users.filter(u => u.taggingPermission !== 'disabled');
};

/**
 * POST /api/videos — Creator/Brand upload a new video.
 * Creates the Video document and immediately fires the AI pipeline in background.
 */
export const uploadVideo = async (req, res, next) => {
  const { videoUrl, title, tier, coAuthorId, coAuthorSplitPercentage } = req.body;

  if (!videoUrl || !title) {
    throw new AppError('Please provide videoUrl and title.', 400);
  }

  const validTiers = ['fan_funded', 'brand_safe'];
  const resolvedTier = validTiers.includes(tier) ? tier : 'fan_funded';

  let initialCoAuthors = [];
  let splitPct = 50;
  if (coAuthorId) {
    const isMutual = (req.user.following || []).some(id => id.toString() === coAuthorId.toString());
    const targetUser = await User.findById(coAuthorId);
    const targetFollowsMe = targetUser && (targetUser.following || []).some(id => id.toString() === req.user._id.toString());
    if (!isMutual || !targetFollowsMe) {
      throw new AppError('You can only invite mutual followers as co-authors.', 400);
    }
    splitPct = Math.min(Math.max(parseInt(coAuthorSplitPercentage || 50, 10), 1), 99);
    initialCoAuthors.push({
      user: coAuthorId,
      status: 'pending',
      splitPercentage: splitPct,
      invitedAt: new Date()
    });
  }

  const mentionedUsers = await extractMentions(title, req.user._id);
  const taggedUsersData = mentionedUsers.map(u => ({
    user: u._id,
    status: u.taggingPermission === 'require_approval' ? 'pending' : 'active',
    taggedAt: new Date()
  }));

  // Create the video document (starts as 'processing')
  const video = await Video.create({
    creatorId: req.user._id,
    videoUrl,
    title,
    tier: resolvedTier,
    mentions: mentionedUsers.map(u => u._id),
    taggedUsers: taggedUsersData,
    coAuthors: initialCoAuthors,
    aiPipelineStatus: 'queued',
    vettingStatus: 'processing',
    aiConfidenceScore: 0
  });

  // Fire AI pipeline asynchronously — do NOT await (non-blocking)
  runAiPipeline(video._id.toString(), videoUrl);

  // Send notification to invited co-author
  if (coAuthorId) {
    sendFcmNotification(
      coAuthorId,
      'Co-Author Invitation! 🤝',
      `@${req.user.username} invited you to be a co-author (${100 - splitPct}/${splitPct} split) on: "${title}"`,
      {
        type: 'coauthor_invite',
        videoId: video._id.toString(),
        creatorName: req.user.username,
        splitPercentage: String(splitPct)
      }
    ).catch(err => console.error('[FCM Coauthor Invite Failed]', err));
  }

  // Notify mentioned / tagged creators according to their approval preference
  mentionedUsers.forEach(user => {
    const isPending = user.taggingPermission === 'require_approval';
    if (isPending) {
      sendFcmNotification(
        user._id,
        'Tag Request! 🏷️',
        `@${req.user.username} tagged you in a video: "${title}". Tap to review and approve.`,
        {
          type: 'tag_approval_requested',
          videoId: video._id.toString(),
          creatorName: req.user.username
        }
      ).catch(err => console.error('[FCM Tag Request Failed]', err));
    } else {
      sendFcmNotification(
        user._id,
        'You were mentioned in a video! 👀',
        `@${req.user.username} mentioned you in: "${title}"`,
        {
          type: 'video_mention',
          videoId: video._id.toString(),
          creatorName: req.user.username
        }
      ).catch(err => console.error('[FCM Mention Notification Failed]', err));
    }
  });

  res.status(201).json({
    status: 'success',
    message: 'Video registered. AI vetting pipeline has been started.',
    data: { video }
  });
};

export const getFeed = async (req, res, next) => {
  // 1) Parse and sanitize query parameters for pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  // 2) Build dynamic query filter based on the user's role
  const query = {};

  // Visibility checks
  if (req.user) {
    if (req.user.role !== 'moderator') {
      // Normal users: can see public videos OR private videos where they are the creator or target brand
      query.$or = [
        { visibility: { $ne: 'private' } },
        { creatorId: req.user._id },
        { brandId: req.user._id }
      ];
    }
  } else {
    // Guest users: can only see public videos
    query.visibility = { $ne: 'private' };
  }

  if (req.user) {
    if (req.user.role === 'brand') {
      // Brands can ONLY see approved (brand-safe) videos
      query.vettingStatus = 'approved';
    } else if (req.user.role === 'moderator') {
      // Moderators can filter by specific vettingStatus (e.g., human_review)
      if (req.query.vettingStatus) {
        query.vettingStatus = req.query.vettingStatus;
      }
    }

    // Filter by followed creators if requested
    if (req.query.following === 'true') {
      query.creatorId = { $in: req.user.following || [] };
    }
  }

  // Filter by specific creator username if requested (for profile-scoped feeds)
  if (req.query.creator) {
    const creatorUser = await User.findOne({ username: new RegExp(`^${req.query.creator.trim()}$`, 'i') });
    if (creatorUser) {
      const creatorMatch = [
        { creatorId: creatorUser._id },
        { coAuthors: { $elemMatch: { user: creatorUser._id, status: 'accepted' } } }
      ];
      if (query.$or) {
        query.$and = [
          { $or: query.$or },
          { $or: creatorMatch }
        ];
        delete query.$or;
      } else {
        query.$or = creatorMatch;
      }
    }
  }

  // 3) Execute queries (getting documents and total counts for metadata)
  const [videos, totalVideos] = await Promise.all([
    Video.find(query)
      .populate('creatorId', 'username role isBrandSafeVerified')
      .populate('coAuthors.user', 'username role isBrandSafeVerified')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Video.countDocuments(query)
  ]);

  const totalPages = Math.ceil(totalVideos / limit);

  // 4) Map videos to include isLiked flag, commentsCount, and strip likedBy for safety
  const formattedVideos = await Promise.all(videos.map(async video => {
    const videoObj = video.toObject();
    const isLiked = req.user ? (video.likedBy && video.likedBy.some(id => id.toString() === req.user._id.toString())) : false;
    delete videoObj.likedBy;
    const commentsCount = await Comment.countDocuments({ videoId: video._id });
    return {
      ...videoObj,
      isLiked,
      commentsCount
    };
  }));

  // 5) Return paginated response
  res.status(200).json({
    status: 'success',
    results: formattedVideos.length,
    pagination: {
      page,
      limit,
      totalVideos,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    },
    data: {
      videos: formattedVideos
    }
  });
};

export const processAiVetting = async (req, res, next) => {
  const { videoId, aiConfidenceScore, riskFlags } = req.body;

  // 1) Validation checks
  if (!videoId || aiConfidenceScore === undefined) {
    throw new AppError('Please provide videoId and aiConfidenceScore.', 400);
  }

  const score = parseFloat(aiConfidenceScore);
  if (isNaN(score) || score < 0 || score > 100) {
    throw new AppError('aiConfidenceScore must be a number between 0 and 100.', 400);
  }

  const flags = Array.isArray(riskFlags) ? riskFlags : [];

  // 2) Find the video
  const video = await Video.findById(videoId);
  if (!video) {
    throw new AppError('Video not found.', 404);
  }

  // 3) Apply threshold rules for vettingStatus
  let vettingStatus = 'human_review';
  if (score < 70) {
    vettingStatus = 'rejected';
  } else if (score >= 95) {
    vettingStatus = 'approved';
  }

  // 4) Update video fields and save
  video.aiConfidenceScore = score;
  video.riskFlags = flags;
  video.vettingStatus = vettingStatus;
  await video.save();

  // Trigger FCM Notification asynchronously (non-blocking)
  sendFcmNotification(
    video.creatorId.toString(),
    'Video Vetting Update',
    `Your video "${video.title}" status is now: ${vettingStatus}.`,
    {
      type: 'vetting_update',
      videoId: video._id.toString(),
      status: vettingStatus,
      title: video.title
    }
  ).catch(err => console.error('[FCM Vetting Trigger Failed]', err));

  // 5) Return response
  res.status(200).json({
    status: 'success',
    message: `Video vetting processed. Status set to: ${vettingStatus}`,
    data: {
      video
    }
  });
};

export const updateVettingStatus = async (req, res, next) => {
  const { id } = req.params;
  const { vettingStatus } = req.body;

  // 1) Validate input
  const validStatuses = ['processing', 'ai_review', 'human_review', 'approved', 'rejected'];
  if (!vettingStatus || !validStatuses.includes(vettingStatus)) {
    throw new AppError(`Please provide a valid vettingStatus. Must be one of: ${validStatuses.join(', ')}`, 400);
  }

  // 2) Find video
  const video = await Video.findById(id);
  if (!video) {
    throw new AppError('Video not found', 404);
  }

  // 3) Update status
  video.vettingStatus = vettingStatus;
  await video.save();

  // Trigger FCM Notification asynchronously (non-blocking)
  sendFcmNotification(
    video.creatorId.toString(),
    'Video Vetting Update',
    `Your video "${video.title}" status is now: ${vettingStatus}.`,
    {
      type: 'vetting_update',
      videoId: video._id.toString(),
      status: vettingStatus,
      title: video.title
    }
  ).catch(err => console.error('[FCM Vetting Trigger Failed]', err));

  // 4) Return success response
  res.status(200).json({
    status: 'success',
    message: `Video vetting status updated to: ${vettingStatus}`,
    data: {
      video
    }
  });
};

/**
 * POST /api/videos/upload
 * creator/brand upload a new video directly to MongoDB GridFS.
 */
export const uploadGridFSVideo = async (req, res, next) => {
  const { title, tier, brandId, sponsorshipAmount, sponsorshipTerms, coAuthorId, coAuthorSplitPercentage } = req.body;

  if (!req.file) {
    throw new AppError('Please upload a video file.', 400);
  }
  if (!title) {
    throw new AppError('Please provide a title.', 400);
  }

  let initialCoAuthors = [];
  let splitPct = 50;
  if (coAuthorId) {
    const isMutual = (req.user.following || []).some(id => id.toString() === coAuthorId.toString());
    const targetUser = await User.findById(coAuthorId);
    const targetFollowsMe = targetUser && (targetUser.following || []).some(id => id.toString() === req.user._id.toString());
    if (!isMutual || !targetFollowsMe) {
      throw new AppError('You can only invite mutual followers as co-authors.', 400);
    }
    splitPct = Math.min(Math.max(parseInt(coAuthorSplitPercentage || 50, 10), 1), 99);
    initialCoAuthors.push({
      user: coAuthorId,
      status: 'pending',
      splitPercentage: splitPct,
      invitedAt: new Date()
    });
  }

  // If sponsorship parameters are provided, perform validation
  let hasSponsorship = false;
  let requestedAmount = 0;
  if (brandId && sponsorshipAmount) {
    hasSponsorship = true;
    requestedAmount = parseFloat(sponsorshipAmount);
    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      throw new AppError('Sponsorship amount must be a positive number.', 400);
    }
    if (!req.user.isBrandSafeVerified) {
      throw new AppError('Only verified creators can request brand sponsorships.', 403);
    }
    const brand = await User.findById(brandId);
    if (!brand || brand.role !== 'brand' || !brand.isBrandSafeVerified) {
      throw new AppError('Target brand user must be a verified brand.', 400);
    }
    if (brandId.toString() === req.user._id.toString()) {
      throw new AppError('You cannot request sponsorship from yourself.', 400);
    }
  }

  const validTiers = ['fan_funded', 'brand_safe'];
  const resolvedTier = validTiers.includes(tier) ? tier : 'fan_funded';

  if (!mongoose.connection.db) {
    throw new AppError('Database not ready. Please try again in a moment.', 503);
  }

  const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'media' });

  const fileExtension = req.file.originalname.split('.').pop() || 'mp4';
  const filename = `${Date.now()}_upload.${fileExtension}`;

  const uploadStream = bucket.openUploadStream(filename, {
    contentType: req.file.mimetype
  });

  uploadStream.end(req.file.buffer);

  await new Promise((resolve, reject) => {
    uploadStream.on('finish', resolve);
    uploadStream.on('error', reject);
  });

  const videoUrl = `${req.protocol}://${req.get('host')}/api/videos/stream/${filename}`;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const mentionedUsers = await extractMentions(title, req.user._id);
    const taggedUsersData = mentionedUsers.map(u => ({
      user: u._id,
      status: u.taggingPermission === 'require_approval' ? 'pending' : 'active',
      taggedAt: new Date()
    }));

    // Create the video record
    const videoData = {
      creatorId: req.user._id,
      videoUrl,
      title,
      tier: resolvedTier,
      mentions: mentionedUsers.map(u => u._id),
      taggedUsers: taggedUsersData,
      coAuthors: initialCoAuthors,
      visibility: hasSponsorship ? 'private' : 'public',
      aiPipelineStatus: 'queued',
      vettingStatus: 'processing',
      aiConfidenceScore: 0
    };

    if (hasSponsorship) {
      videoData.brandId = brandId;
    }

    const video = await Video.create([videoData], { session });

    let sponsorshipRequest = null;
    if (hasSponsorship) {
      const request = await SponsorshipRequest.create([{
        videoId: video[0]._id,
        creatorId: req.user._id,
        brandId,
        amount: requestedAmount,
        terms: sponsorshipTerms || '',
        status: 'pending',
        escrowStatus: 'none'
      }], { session });

      sponsorshipRequest = request[0];
      video[0].sponsorshipId = sponsorshipRequest._id;
      await video[0].save({ session });
    }

    await session.commitTransaction();

    runAiPipeline(video[0]._id.toString(), videoUrl);

    // Send notification to invited co-author
    if (coAuthorId) {
      sendFcmNotification(
        coAuthorId,
        'Co-Author Invitation! 🤝',
        `@${req.user.username} invited you to be a co-author (${100 - splitPct}/${splitPct} split) on: "${title}"`,
        {
          type: 'coauthor_invite',
          videoId: video[0]._id.toString(),
          creatorName: req.user.username,
          splitPercentage: String(splitPct)
        }
      ).catch(err => console.error('[FCM Coauthor Invite Failed]', err));
    }

    // Send notifications to mentioned / tagged users
    for (const mentionedUser of mentionedUsers) {
      const isPending = mentionedUser.taggingPermission === 'require_approval';
      if (isPending) {
        sendFcmNotification(
          mentionedUser._id,
          'Tag Request! 🏷️',
          `@${req.user.username} tagged you in a video: "${title}". Tap to review and approve.`,
          {
            type: 'tag_approval_requested',
            videoId: video[0]._id.toString(),
            creatorName: req.user.username
          }
        ).catch(err => console.error('[FCM Tag Request Failed]', err));
      } else {
        sendFcmNotification(
          mentionedUser._id,
          'You were tagged in a video!',
          `@${req.user.username} mentioned you: "${title}"`,
          {
            type: 'video_mention',
            videoId: video[0]._id.toString(),
            creatorName: req.user.username
          }
        ).catch(err => console.error('[FCM Video Mention Notification Failed]', err));
      }
    }

    if (hasSponsorship) {
      sendFcmNotification(
        brandId,
        'New Sponsorship Request Received!',
        `@${req.user.username} requested sponsorship of R ${requestedAmount.toFixed(2)} for video: "${title}"`,
        {
          type: 'sponsorship_requested',
          sponsorshipId: sponsorshipRequest._id.toString(),
          videoId: video[0]._id.toString(),
          amount: String(requestedAmount),
          creatorName: req.user.username
        }
      ).catch(err => console.error('[FCM Sponsor Request Failed]', err));
    }

    res.status(201).json({
      status: 'success',
      message: hasSponsorship
        ? 'Video uploaded, request created, and set to private. AI vetting pipeline started.'
        : 'Video uploaded and registered in GridFS. AI vetting pipeline started.',
      data: {
        video: video[0],
        sponsorshipRequest
      }
    });

  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

/**
 * GET /api/videos/stream/:filename
 * Streams video chunk from MongoDB GridFS with seeking (Range header) support.
 */
export const streamGridFSVideo = async (req, res, next) => {
  const { filename } = req.params;

  const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'media' });

  const files = await bucket.find({ filename }).toArray();
  if (!files || files.length === 0) {
    throw new AppError('Video file not found', 404);
  }

  const file = files[0];
  const fileSize = file.length;
  const contentType = file.contentType || 'video/mp4';
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      throw new AppError('Requested range not satisfiable', 416);
    }

    const chunksize = (end - start) + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    });

    const downloadStream = bucket.openDownloadStreamByName(filename, {
      start,
      end: end + 1
    });

    downloadStream.on('error', (err) => {
      console.error(`[GridFS Stream Error] Stream failed for ${filename}:`, err.message);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });

    downloadStream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes'
    });

    const downloadStream = bucket.openDownloadStreamByName(filename);
    
    downloadStream.on('error', (err) => {
      console.error(`[GridFS Stream Error] Stream failed for ${filename}:`, err.message);
      if (!res.headersSent) {
        res.status(500).end();
      }
    });

    downloadStream.pipe(res);
  }
};

export const toggleLikeVideo = async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  const video = await Video.findById(id);
  if (!video) {
    throw new AppError('Video not found', 404);
  }

  if (!video.likedBy) {
    video.likedBy = [];
  }

  const isLiked = video.likedBy.includes(userId);
  if (isLiked) {
    video.likedBy = video.likedBy.filter(uid => uid.toString() !== userId.toString());
    video.likesCount = Math.max(0, (video.likesCount || 0) - 1);
  } else {
    video.likedBy.push(userId);
    video.likesCount = (video.likesCount || 0) + 1;
  }

  await video.save();

  if (!isLiked && video.creatorId.toString() !== userId.toString()) {
    sendFcmNotification(
      video.creatorId,
      'New Video Like!',
      `@${req.user.username} liked your video "${video.title || ''}"`,
      {
        type: 'video_like',
        videoId: video._id.toString()
      }
    ).catch(err => console.error('[FCM Video Like Notification Failed]', err));
  }

  res.status(200).json({
    status: 'success',
    data: {
      likesCount: video.likesCount,
      isLiked: !isLiked
    }
  });
};

export const recordShare = async (req, res, next) => {
  const { id } = req.params;
  const video = await Video.findByIdAndUpdate(
    id,
    { $inc: { sharesCount: 1 } },
    { new: true }
  );

  if (!video) {
    throw new AppError('Video not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      sharesCount: video.sharesCount
    }
  });
};

export const deleteVideo = async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user._id;

  try {
    const video = await Video.findById(id);
    if (!video) {
      throw new AppError('Video not found', 404);
    }

    // Auth check: Must be the creator of the video OR a moderator/admin
    if (video.creatorId.toString() !== userId.toString() && req.user.role !== 'moderator') {
      throw new AppError('You do not have permission to delete this video.', 403);
    }

    // Cleanup GridFS if it's stored there
    if (video.videoUrl && video.videoUrl.includes('/api/videos/stream/')) {
      try {
        const parts = video.videoUrl.split('/api/videos/stream/');
        const filename = parts[parts.length - 1];
        if (filename) {
          const bucket = new GridFSBucket(mongoose.connection.db, { bucketName: 'media' });
          const files = await bucket.find({ filename }).toArray();
          if (files && files.length > 0) {
            await bucket.delete(files[0]._id);
          }
        }
      } catch (err) {
        console.error('[Delete Video] GridFS cleanup failed:', err);
      }
    }

    // Delete comments on this video
    await Comment.deleteMany({ videoId: id });

    // Delete the video document
    await Video.findByIdAndDelete(id);

    res.status(200).json({
      status: 'success',
      message: 'Video and associated comments deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
};

export const updateVideo = async (req, res, next) => {
  const { id } = req.params;
  const { title } = req.body;
  const userId = req.user._id;

  try {
    if (!title || !title.trim()) {
      throw new AppError('Please provide a video title/caption.', 400);
    }

    const video = await Video.findById(id);
    if (!video) {
      throw new AppError('Video not found', 404);
    }

    // Auth check: Must be the creator of the video
    if (video.creatorId.toString() !== userId.toString()) {
      throw new AppError('You do not have permission to edit this video.', 403);
    }

    video.title = title.trim();
    await video.save();

    res.status(200).json({
      status: 'success',
      message: 'Video caption updated successfully.',
      data: { video }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/videos/coauthor/invites
 * List pending co-author invitations for the authenticated user.
 */
export const getCoAuthorInvites = async (req, res, next) => {
  try {
    const invites = await Video.find({
      'coAuthors': {
        $elemMatch: {
          user: req.user._id,
          status: 'pending'
        }
      }
    })
      .populate('creatorId', 'username role isBrandSafeVerified')
      .populate('coAuthors.user', 'username role isBrandSafeVerified')
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: invites.length,
      data: { invites }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/videos/:id/coauthor/respond
 * Accept or decline a co-author invitation.
 */
export const respondToCoAuthorInvite = async (req, res, next) => {
  const { id } = req.params;
  const { action } = req.body; // 'accept' | 'decline'

  try {
    if (!['accept', 'decline'].includes(action)) {
      throw new AppError('Invalid response action. Choose accept or decline.', 400);
    }

    const video = await Video.findById(id).populate('creatorId', 'username');
    if (!video) {
      throw new AppError('Video not found', 404);
    }

    const coAuthorEntry = video.coAuthors.find(
      ca => ca.user.toString() === req.user._id.toString() && ca.status === 'pending'
    );

    if (!coAuthorEntry) {
      throw new AppError('No pending co-author invitation found for this video.', 404);
    }

    const newStatus = action === 'accept' ? 'accepted' : 'declined';
    coAuthorEntry.status = newStatus;
    coAuthorEntry.respondedAt = new Date();
    await video.save();

    // Notify the primary video author
    sendFcmNotification(
      video.creatorId._id || video.creatorId,
      action === 'accept' ? 'Co-Author Accepted! 🎉' : 'Co-Author Invitation Declined',
      `@${req.user.username} has ${newStatus} your co-author invitation for "${video.title}"`,
      {
        type: action === 'accept' ? 'coauthor_accepted' : 'coauthor_declined',
        videoId: video._id.toString(),
        creatorName: req.user.username
      }
    ).catch(err => console.error('[FCM Coauthor Response Failed]', err));

    res.status(200).json({
      status: 'success',
      message: `Co-author invitation successfully ${newStatus}.`,
      data: { video }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/videos/:id/coauthor
 * Remove oneself from an accepted co-authorship.
 */
export const removeCoAuthor = async (req, res, next) => {
  const { id } = req.params;

  try {
    const video = await Video.findById(id);
    if (!video) {
      throw new AppError('Video not found', 404);
    }

    const coAuthorEntry = video.coAuthors.find(
      ca => ca.user.toString() === req.user._id.toString() && ca.status === 'accepted'
    );

    if (!coAuthorEntry) {
      throw new AppError('You are not an active co-author on this video.', 400);
    }

    coAuthorEntry.status = 'removed';
    await video.save();

    res.status(200).json({
      status: 'success',
      message: 'You have removed yourself from this collaboration.',
      data: { video }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/videos/tags/pending
 * Lists videos where the authenticated user has a pending tag request.
 */
export const getTagRequests = async (req, res, next) => {
  try {
    const requests = await Video.find({
      'taggedUsers': {
        $elemMatch: {
          user: req.user._id,
          status: 'pending'
        }
      }
    })
      .populate('creatorId', 'username role isBrandSafeVerified')
      .select('title videoUrl createdAt creatorId taggedUsers tier')
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      results: requests.length,
      data: { requests }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/videos/:id/tags/respond
 * Approve or decline a pending tag on a video.
 */
export const respondToTagRequest = async (req, res, next) => {
  const { id } = req.params;
  const { action } = req.body; // 'approve' | 'decline'

  try {
    if (!['approve', 'decline'].includes(action)) {
      throw new AppError('Invalid response action. Choose approve or decline.', 400);
    }

    const video = await Video.findById(id).populate('creatorId', 'username');
    if (!video) {
      throw new AppError('Video not found', 404);
    }

    const tagEntry = video.taggedUsers?.find(
      t => t.user.toString() === req.user._id.toString() && t.status === 'pending'
    );

    if (!tagEntry) {
      throw new AppError('No pending tag request found for this video.', 404);
    }

    tagEntry.status = action === 'approve' ? 'active' : 'declined';
    
    // If declined, also remove from raw mentions array
    if (action === 'decline') {
      video.mentions = (video.mentions || []).filter(
        uid => uid.toString() !== req.user._id.toString()
      );
    }

    await video.save();

    // Notify video creator
    sendFcmNotification(
      video.creatorId._id || video.creatorId,
      action === 'approve' ? 'Tag Approved! 🏷️' : 'Tag Declined',
      `@${req.user.username} has ${action === 'approve' ? 'approved' : 'declined'} their tag on "${video.title}"`,
      {
        type: action === 'approve' ? 'tag_approved' : 'tag_declined',
        videoId: video._id.toString(),
        creatorName: req.user.username
      }
    ).catch(err => console.error('[FCM Tag Response Failed]', err));

    res.status(200).json({
      status: 'success',
      message: `Tag request successfully ${action === 'approve' ? 'approved' : 'declined'}.`,
      data: { video }
    });
  } catch (err) {
    next(err);
  }
};
