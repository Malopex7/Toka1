import Video from '../models/Video.js';
import { AppError } from '../middlewares/error.js';
import { runAiPipeline } from '../services/aiPipeline.js';

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
      // Brands can ONLY see approved videos
      query.vettingStatus = 'approved';
    } else if (req.user.role === 'creator') {
      // Creators can see approved videos OR their own videos (regardless of vetting status)
      query.$or = [
        { vettingStatus: 'approved' },
        { creatorId: req.user._id }
      ];
    } else if (req.user.role === 'moderator') {
      // Moderators can see all videos (no vetting status restriction)
      // Allow filtering by vettingStatus query parameter (e.g. human_review)
      if (req.query.vettingStatus) {
        query.vettingStatus = req.query.vettingStatus;
      }
    } else {
      // Other roles (fans/users) can only see approved videos
      query.vettingStatus = 'approved';
    }
  } else {
    // Guest (unauthenticated) users can only see approved videos
    query.vettingStatus = 'approved';
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

  // 4) Return paginated response
  res.status(200).json({
    status: 'success',
    results: videos.length,
    pagination: {
      page,
      limit,
      totalVideos,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    },
    data: {
      videos
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

  // 4) Return success response
  res.status(200).json({
    status: 'success',
    message: `Video vetting status updated to: ${vettingStatus}`,
    data: {
      video
    }
  });
};
