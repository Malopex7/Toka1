import Video from '../models/Video.js';
import User from '../models/User.js';
import { AppError } from '../middlewares/error.js';
import { feedCache } from '../services/cacheService.js';
import {
  DISCOVER_FILTER_TABS,
  DISCOVER_CATEGORIES,
  DISCOVER_TRENDING_CHALLENGES,
  buildTitleMatchFilter,
  getCategoryById,
  formatCompactCount,
} from '../config/discoverCatalog.js';

const sanitizeUrl = (url) =>
  url && url.startsWith('http://') && !url.includes('localhost') && !url.includes('127.0.0.1')
    ? url.replace('http://', 'https://')
    : url;

function buildDiscoverVideoQuery(user) {
  const query = { visibility: { $ne: 'private' }, vettingStatus: 'approved' };
  if (user?.role === 'brand') {
    query.vettingStatus = 'approved';
  }
  return query;
}

function formatDiscoverVideo(video) {
  const obj = video.toObject ? video.toObject() : video;
  if (obj.videoUrl) obj.videoUrl = sanitizeUrl(obj.videoUrl);
  if (obj.thumbnailUrl) obj.thumbnailUrl = sanitizeUrl(obj.thumbnailUrl);
  if (obj.creatorId?.avatarUrl) obj.creatorId.avatarUrl = sanitizeUrl(obj.creatorId.avatarUrl);
  delete obj.likedBy;
  delete obj.repostedBy;
  return obj;
}

async function countVideosForEntry(baseQuery, entry) {
  if (entry.id === 'trending') {
    return Video.countDocuments({
      ...baseQuery,
      $or: [
        { likesCount: { $gte: 1 } },
        { repostsCount: { $gte: 1 } },
        { sharesCount: { $gte: 1 } },
      ],
    });
  }
  return Video.countDocuments({ ...baseQuery, ...buildTitleMatchFilter(entry) });
}

async function fetchPreviewVideos(baseQuery, entry, limit = 3) {
  const match = entry.id === 'trending'
    ? {
        ...baseQuery,
        $or: [
          { likesCount: { $gte: 1 } },
          { repostsCount: { $gte: 1 } },
          { sharesCount: { $gte: 1 } },
        ],
      }
    : { ...baseQuery, ...buildTitleMatchFilter(entry) };

  const videos = await Video.find(match)
    .populate('creatorId', 'username avatarUrl isBrandSafeVerified')
    .sort({ likesCount: -1, repostsCount: -1, createdAt: -1 })
    .limit(limit)
    .lean();

  return videos.map((video) => ({
    id: video._id.toString(),
    title: video.title,
    views: formatCompactCount((video.likesCount || 0) + (video.repostsCount || 0) * 2 + (video.sharesCount || 0) * 3),
    image: sanitizeUrl(video.thumbnailUrl) || null,
    videoUrl: sanitizeUrl(video.videoUrl),
    creator: video.creatorId?.username || 'creator',
  }));
}

async function fetchTopCreators(limit = 6) {
  const creators = await User.aggregate([
    { $match: { role: { $in: ['creator', 'brand'] } } },
    {
      $addFields: {
        followerCount: { $size: { $ifNull: ['$followers', []] } },
      },
    },
    { $sort: { followerCount: -1, isBrandSafeVerified: -1, createdAt: -1 } },
    { $limit: limit },
    {
      $project: {
        username: 1,
        avatarUrl: 1,
        isBrandSafeVerified: 1,
        role: 1,
        followerCount: 1,
      },
    },
  ]);

  const usernames = creators.map((c) => c.username);
  const videoCounts = await Video.aggregate([
    {
      $match: {
        vettingStatus: 'approved',
        visibility: { $ne: 'private' },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'creatorId',
        foreignField: '_id',
        as: 'creator',
      },
    },
    { $unwind: '$creator' },
    { $match: { 'creator.username': { $in: usernames } } },
    { $group: { _id: '$creator.username', videoCount: { $sum: 1 } } },
  ]);

  const videoCountMap = Object.fromEntries(
    videoCounts.map((row) => [row._id, row.videoCount])
  );

  const nicheByCreator = await Promise.all(
    creators.map(async (creator) => {
      const latestVideo = await Video.findOne({
        creatorId: creator._id,
        vettingStatus: 'approved',
        visibility: { $ne: 'private' },
      })
        .sort({ createdAt: -1 })
        .select('title tier')
        .lean();

      if (!latestVideo) {
        return creator.role === 'brand' ? 'Brand Partner' : 'Creator on Toka';
      }
      return latestVideo.tier === 'brand_safe' ? 'Brand-safe Creator' : 'Fan-funded Creator';
    })
  );

  return creators.map((creator, index) => ({
    id: creator._id.toString(),
    username: creator.username,
    name: creator.username.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    niche: nicheByCreator[index],
    followers: formatCompactCount(creator.followerCount),
    followerCount: creator.followerCount,
    videoCount: videoCountMap[creator.username] || 0,
    avatar: sanitizeUrl(creator.avatarUrl) || '',
    verified: !!creator.isBrandSafeVerified,
  }));
}

/**
 * GET /api/discover/hub
 * Returns filter tabs, categories, trending challenges, and top creators with live counts.
 */
export const getDiscoverHub = async (req, res, next) => {
  const cacheKey = `discover:hub:${req.user?.role || 'guest'}`;
  const cached = feedCache.get(cacheKey);
  if (cached) {
    return res.status(200).json(cached);
  }

  const baseQuery = buildDiscoverVideoQuery(req.user);

  const [categoryCounts, trendingData, topCreators] = await Promise.all([
    Promise.all(
      DISCOVER_CATEGORIES.map(async (category) => {
        const count = await countVideosForEntry(baseQuery, category);
        return {
          ...category,
          count,
          countLabel: `${formatCompactCount(count)} videos`,
        };
      })
    ),
    Promise.all(
      DISCOVER_TRENDING_CHALLENGES.map(async (challenge) => {
        const [videoCount, previews, aggregateViews] = await Promise.all([
          countVideosForEntry(baseQuery, challenge),
          fetchPreviewVideos(baseQuery, challenge, 3),
          Video.aggregate([
            { $match: { ...baseQuery, ...buildTitleMatchFilter(challenge) } },
            {
              $group: {
                _id: null,
                totalEngagement: {
                  $sum: {
                    $add: [
                      { $ifNull: ['$likesCount', 0] },
                      { $multiply: [{ $ifNull: ['$repostsCount', 0] }, 2] },
                      { $multiply: [{ $ifNull: ['$sharesCount', 0] }, 3] },
                    ],
                  },
                },
              },
            },
          ]),
        ]);

        const viewsRaw = aggregateViews[0]?.totalEngagement || videoCount * 10;
        return {
          id: challenge.id,
          hashtag: challenge.hashtag,
          views: formatCompactCount(Math.max(viewsRaw, videoCount)),
          videoCount: formatCompactCount(videoCount),
          videoCountRaw: videoCount,
          description: challenge.description,
          previews,
        };
      })
    ),
    fetchTopCreators(6),
  ]);

  const response = {
    status: 'success',
    data: {
      filterTabs: DISCOVER_FILTER_TABS,
      categories: categoryCounts,
      trending: trendingData,
      topCreators,
    },
  };

  feedCache.set(cacheKey, response, 60);
  res.status(200).json(response);
};

/**
 * GET /api/discover/videos?category=afrobeats&q=search&limit=18&page=1
 */
export const getDiscoverVideos = async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = Math.min(parseInt(req.query.limit, 10) || 18, 50);
  const skip = (page - 1) * limit;
  const categoryId = (req.query.category || '').trim();
  const searchQuery = (req.query.q || req.query.search || '').trim();

  const baseQuery = buildDiscoverVideoQuery(req.user);
  const query = { ...baseQuery };

  if (categoryId && categoryId !== 'all') {
    const category = getCategoryById(categoryId);
    if (!category) {
      throw new AppError(`Unknown discover category: ${categoryId}`, 400);
    }
    if (categoryId === 'trending') {
      query.$or = [
        { likesCount: { $gte: 1 } },
        { repostsCount: { $gte: 1 } },
        { sharesCount: { $gte: 1 } },
      ];
    } else {
      Object.assign(query, buildTitleMatchFilter(category));
    }
  }

  if (searchQuery) {
    const clean = searchQuery.replace(/^#/, '');
    const creatorUsers = await User.find({
      username: { $regex: clean, $options: 'i' },
    })
      .select('_id')
      .limit(20)
      .lean();

    const creatorIds = creatorUsers.map((u) => u._id);
    const searchConditions = [
      { title: { $regex: clean, $options: 'i' } },
    ];
    if (creatorIds.length > 0) {
      searchConditions.push({ creatorId: { $in: creatorIds } });
    }

    if (query.$or) {
      query.$and = [{ $or: query.$or }, { $or: searchConditions }];
      delete query.$or;
    } else {
      query.$or = searchConditions;
    }
  }

  const [videos, totalVideos] = await Promise.all([
    Video.find(query)
      .populate('creatorId', 'username role isBrandSafeVerified avatarUrl')
      .sort({ likesCount: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Video.countDocuments(query),
  ]);

  const totalPages = Math.ceil(totalVideos / limit);

  res.status(200).json({
    status: 'success',
    results: videos.length,
    pagination: {
      page,
      limit,
      totalVideos,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    data: {
      videos: videos.map(formatDiscoverVideo),
    },
  });
};

/**
 * GET /api/discover/creators?q=optional&limit=10
 */
export const getDiscoverCreators = async (req, res, next) => {
  const q = (req.query.q || '').trim().replace(/^@/, '');
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 20);

  const matchStage = { role: { $in: ['creator', 'brand'] } };
  if (q) {
    matchStage.username = { $regex: q, $options: 'i' };
  }

  const creators = await User.aggregate([
    { $match: matchStage },
    {
      $addFields: {
        followerCount: { $size: { $ifNull: ['$followers', []] } },
      },
    },
    { $sort: { followerCount: -1, isBrandSafeVerified: -1 } },
    { $limit: limit },
    {
      $project: {
        username: 1,
        avatarUrl: 1,
        isBrandSafeVerified: 1,
        role: 1,
        followerCount: 1,
      },
    },
  ]);

  res.status(200).json({
    status: 'success',
    results: creators.length,
    data: {
      creators: creators.map((creator) => ({
        id: creator._id.toString(),
        username: creator.username,
        avatarUrl: sanitizeUrl(creator.avatarUrl) || '',
        verified: !!creator.isBrandSafeVerified,
        role: creator.role,
        followers: formatCompactCount(creator.followerCount),
        followerCount: creator.followerCount,
      })),
    },
  });
};
