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

  // Ensure username is not already taken
  const existingUsername = await User.findOne({ username });
  if (existingUsername) {
    throw new AppError('Username is already taken.', 400);
  }

  // Create new user profile in MongoDB
  user = await User.create({
    firebaseUid: uid,
    email: email || '',
    username,
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
