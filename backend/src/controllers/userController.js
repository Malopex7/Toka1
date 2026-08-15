import User from '../models/User.js';
import { auth } from '../config/firebase.js';
import { AppError } from '../middlewares/error.js';

/**
 * Sync user profile from Firebase auth state.
 * If user profile does not exist in Mongoose:
 *   - If username and role are provided, creates the user.
 *   - Otherwise, returns profileRequired: true.
 * If user profile exists, returns it.
 */
export const syncUser = async (req, res, next) => {
  // 1) Extract and verify Firebase ID Token from Authorization header
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw new AppError('No token provided. Authentication required.', 401);
  }

  let decodedToken;
  try {
    decodedToken = await auth.verifyIdToken(token);
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    throw new AppError('Invalid or expired Firebase token.', 401);
  }

  const { uid, email } = decodedToken;

  // 2) Check if user profile already exists in MongoDB
  let user = await User.findOne({ firebaseUid: uid });

  if (user) {
    return res.status(200).json({
      status: 'success',
      profileRequired: false,
      isNewUser: false,
      data: { user }
    });
  }

  // 3) Profile does not exist - Handle registration/profile setup
  const { username, role } = req.body;

  if (!username || !role) {
    // Return flag indicating profile details are required to complete signup
    return res.status(200).json({
      status: 'success',
      profileRequired: true,
      data: {
        firebaseUid: uid,
        email: email || ''
      }
    });
  }

  // Sanitize username by trimming and removing any leading '@'
  const sanitizedUsername = username.trim().replace(/^@+/, '');

  if (!/^[a-zA-Z0-9_]+$/.test(sanitizedUsername)) {
    throw new AppError('Username can only contain letters, numbers, and underscores (_).', 400);
  }

  if (sanitizedUsername.length < 3) {
    throw new AppError('Username must be at least 3 characters.', 400);
  }

  // Ensure username is not already taken
  const existingUsername = await User.findOne({ username: sanitizedUsername });
  if (existingUsername) {
    throw new AppError('Username is already taken.', 400);
  }

  // Create new user profile in MongoDB
  user = await User.create({
    firebaseUid: uid,
    email: email || '',
    username: sanitizedUsername,
    role,
    walletBalance: 100 // Starting balance of ZAR 100 for onboarding
  });

  res.status(201).json({
    status: 'success',
    profileRequired: false,
    isNewUser: true,
    data: { user }
  });
};

/**
 * Fetch current user profile details
 */
export const getMe = async (req, res, next) => {
  res.status(200).json({
    status: 'success',
    data: {
      user: req.user
    }
  });
};

/**
 * Register FCM device token
 */
export const saveFcmToken = async (req, res, next) => {
  const { fcmToken } = req.body;

  if (!fcmToken) {
    throw new AppError('FCM token is required.', 400);
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $addToSet: { fcmTokens: fcmToken } },
    { new: true }
  );

  res.status(200).json({
    status: 'success',
    message: 'FCM token registered successfully.',
    data: {
      user
    }
  });
};

/**
 * Follow or unfollow a creator profile
 */
export const toggleFollow = async (req, res, next) => {
  const { targetUserId } = req.params;

  if (!targetUserId) {
    throw new AppError('Target user ID is required.', 400);
  }

  if (targetUserId === req.user._id.toString()) {
    throw new AppError('You cannot follow yourself.', 400);
  }

  const targetUser = await User.findById(targetUserId);
  if (!targetUser) {
    throw new AppError('Target user not found.', 404);
  }

  const isFollowing = req.user.following.includes(targetUserId);

  if (isFollowing) {
    await User.findByIdAndUpdate(req.user._id, { $pull: { following: targetUserId } });
    await User.findByIdAndUpdate(targetUserId, { $pull: { followers: req.user._id } });

    res.status(200).json({
      status: 'success',
      isFollowing: false,
      message: 'Unfollowed successfully.'
    });
  } else {
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { following: targetUserId } });
    await User.findByIdAndUpdate(targetUserId, { $addToSet: { followers: req.user._id } });

    res.status(200).json({
      status: 'success',
      isFollowing: true,
      message: 'Followed successfully.'
    });
  }
};

/**
 * Check if current user is following a creator
 */
export const checkFollowStatus = async (req, res, next) => {
  const { targetUserId } = req.params;

  if (!targetUserId) {
    throw new AppError('Target user ID is required.', 400);
  }

  const isFollowing = req.user.following.includes(targetUserId);

  res.status(200).json({
    status: 'success',
    isFollowing
  });
};

export const getProfileByUsername = async (req, res, next) => {
  const { username } = req.params;
  const user = await User.findOne({ username: username.toLowerCase().trim() })
    .select('username role followers following isBrandSafeVerified verificationRequestStatus');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: { user }
  });
};

/**
 * Request moderator verification for brand safety/sponsorships.
 */
export const requestVerification = async (req, res, next) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { verificationRequestStatus: 'pending' },
    { new: true }
  );

  res.status(200).json({
    status: 'success',
    message: 'Verification request submitted successfully.',
    data: { user }
  });
};

/**
 * List pending verification requests (Moderator restricted).
 */
export const getVerificationRequests = async (req, res, next) => {
  const users = await User.find({ verificationRequestStatus: 'pending' })
    .select('username email role isBrandSafeVerified verificationRequestStatus createdAt');

  res.status(200).json({
    status: 'success',
    results: users.length,
    data: { users }
  });
};

/**
 * Update verification status of a user (Moderator restricted).
 */
export const updateVerificationStatus = async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body; // 'approved' | 'rejected'

  if (!['approved', 'rejected'].includes(status)) {
    throw new AppError('Invalid verification status choice.', 400);
  }

  const isApproved = status === 'approved';
  
  const user = await User.findByIdAndUpdate(
    id,
    {
      verificationRequestStatus: status,
      isBrandSafeVerified: isApproved
    },
    { new: true }
  );

  if (!user) {
    throw new AppError('User not found.', 404);
  }

  res.status(200).json({
    status: 'success',
    message: `User verification successfully ${status}.`,
    data: { user }
  });
};

/**
 * Fetch verified brand accounts.
 */
export const getVerifiedBrands = async (req, res, next) => {
  const brands = await User.find({
    role: 'brand',
    isBrandSafeVerified: true
  }).select('username email');

  res.status(200).json({
    status: 'success',
    results: brands.length,
    data: { brands }
  });
};

/**
 * Directory lookup for verified users (e.g. Creators list for Brands, Brands list for Creators).
 */
export const getUserDirectory = async (req, res, next) => {
  const { role } = req.user;
  
  // If user is brand, return verified creators. If user is creator/fan/other, return verified brands.
  const targetRole = role === 'brand' ? 'creator' : 'brand';

  const users = await User.find({
    role: targetRole,
    isBrandSafeVerified: true
  }).select('username role email followers following');

  res.status(200).json({
    status: 'success',
    results: users.length,
    data: { users }
  });
};

/**
 * Search users for mentions autocomplete with smart ranking:
 * 1. Followed creators first
 * 2. Brand-safe verified creators & brands next
 * 3. Other matching users
 */
export const searchUsers = async (req, res, next) => {
  const q = (req.query.q || '').trim();

  // Exclude requester from results
  const baseFilter = req.user ? { _id: { $ne: req.user._id } } : {};
  if (q) {
    baseFilter.username = { $regex: q.replace(/^@/, ''), $options: 'i' };
  }

  const matchingUsers = await User.find(baseFilter)
    .select('username role isBrandSafeVerified')
    .limit(20)
    .lean();

  const followingSet = new Set((req.user?.following || []).map(id => id.toString()));
  const cleanQ = q.replace(/^@/, '').toLowerCase();

  // Smart ranking score:
  // - Following: +100
  // - Verified: +50
  // - Username starts with query: +25
  const rankedUsers = matchingUsers.sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;

    if (followingSet.has(a._id.toString())) scoreA += 100;
    if (followingSet.has(b._id.toString())) scoreB += 100;

    if (a.isBrandSafeVerified) scoreA += 50;
    if (b.isBrandSafeVerified) scoreB += 50;

    if (cleanQ && a.username.toLowerCase().startsWith(cleanQ)) scoreA += 25;
    if (cleanQ && b.username.toLowerCase().startsWith(cleanQ)) scoreB += 25;

    return scoreB - scoreA;
  }).slice(0, 10);

  res.status(200).json({
    status: 'success',
    results: rankedUsers.length,
    data: { users: rankedUsers }
  });
};

/**
 * Fetch mutual followers (users who follow each other) for co-author eligibility.
 */
export const getMutualFollowers = async (req, res, next) => {
  const q = (req.query.q || '').trim();
  const currentUserId = req.user._id;
  const followingIds = req.user.following || [];

  if (followingIds.length === 0) {
    return res.status(200).json({ status: 'success', results: 0, data: { users: [] } });
  }

  const filter = {
    _id: { $in: followingIds },
    following: currentUserId
  };

  if (q) {
    filter.username = { $regex: q.replace(/^@/, ''), $options: 'i' };
  }

  const mutualUsers = await User.find(filter)
    .select('username role isBrandSafeVerified')
    .limit(15)
    .lean();

  res.status(200).json({
    status: 'success',
    results: mutualUsers.length,
    data: { users: mutualUsers }
  });
};
