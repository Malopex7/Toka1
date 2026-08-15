import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import Video from '../models/Video.js';
import Comment from '../models/Comment.js';
import { AppError } from '../middlewares/error.js';
import { runAiPipeline } from '../services/aiPipeline.js';
import { sendFcmNotification } from '../services/notificationService.js';

/**
 * POST /api/videos — Creator/Brand upload a new video.
 * Creates the Video document and immediately fires the AI pipeline in background.
 */
export const uploadVideo = async (req, res, next) => {
  const { videoUrl, title, tier } = req.body;

  if (!videoUrl || !title) {
    throw new AppError('Please provide videoUrl and title.', 400);
  }

  const validTiers = ['fan_funded', 'brand_safe'];
  const resolvedTier = validTiers.includes(tier) ? tier : 'fan_funded';

  // Create the video document (starts as 'processing')
  const video = await Video.create({
    creatorId: req.user._id,
    videoUrl,
    title,
    tier: resolvedTier,
    vettingStatus: 'processing',
    aiPipelineStatus: 'pending'
  });

  // Fire AI pipeline asynchronously — do NOT await (non-blocking)
  runAiPipeline(video._id.toString(), videoUrl);

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

  // 3) Execute queries (getting documents and total counts for metadata)
  const [videos, totalVideos] = await Promise.all([
    Video.find(query)
      .populate('creatorId', 'username role isBrandSafeVerified')
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
  const { title, tier } = req.body;

  if (!req.file) {
    throw new AppError('Please upload a video file.', 400);
  }
  if (!title) {
    throw new AppError('Please provide a title.', 400);
  }

  const validTiers = ['fan_funded', 'brand_safe'];
  const resolvedTier = validTiers.includes(tier) ? tier : 'fan_funded';

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

  const video = await Video.create({
    creatorId: req.user._id,
    videoUrl,
    title,
    tier: resolvedTier,
    vettingStatus: 'processing',
    aiPipelineStatus: 'pending'
  });

  runAiPipeline(video._id.toString(), videoUrl);

  res.status(201).json({
    status: 'success',
    message: 'Video uploaded and registered in GridFS. AI vetting pipeline started.',
    data: { video }
  });
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
