import { auth } from '../config/firebase.js';
import User from '../models/User.js';
import { AppError } from './error.js';

/**
 * Protect middleware: validates the Firebase ID token and hydates req.user
 */
export const protect = async (req, res, next) => {
  // 1) Extract token from Authorization header
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw new AppError('You are not logged in! Please log in to get access.', 401);
  }

  // 2) Verify the Firebase ID token
  let decodedToken;
  try {
    decodedToken = await auth.verifyIdToken(token);
  } catch (error) {
    throw new AppError('Invalid or expired token. Please log in again!', 401);
  }

  // 3) Find user in Mongoose using the firebaseUid
  const currentUser = await User.findOne({ firebaseUid: decodedToken.uid });
  if (!currentUser) {
    throw new AppError('The user belonging to this token no longer exists on our database.', 401);
  }

  // 4) Hydrate request user object
  req.user = currentUser;
  next();
};

/**
 * Optional Protect middleware: parses and verifies Firebase ID token if present,
 * but does not error if it's missing or invalid (guest mode).
 */
export const optionalProtect = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next();
  }

  try {
    const decodedToken = await auth.verifyIdToken(token);
    const currentUser = await User.findOne({ firebaseUid: decodedToken.uid });
    if (currentUser) {
      req.user = currentUser;
    }
  } catch (error) {
    // If the token is invalid/expired, we just ignore it and let the request proceed as guest
  }
  next();
};

/**
 * Restrict routes to specific roles or boolean flags (virtuals/fields) on req.user
 */
export const restrictTo = (...rolesOrFlags) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new AppError('User not authenticated.', 401);
    }

    const isAuthorized = rolesOrFlags.some(roleOrFlag => {
      // Check if it's a flag (e.g. starting with 'is')
      if (roleOrFlag.startsWith('is')) {
        return !!req.user[roleOrFlag];
      }
      // Otherwise match role directly
      return req.user.role === roleOrFlag;
    });

    if (!isAuthorized) {
      throw new AppError('You do not have permission to perform this action', 403);
    }

    next();
  };
};

/**
 * Specific convenience authorization middlewares
 */
export const requireBrand = restrictTo('isBrand');
export const requireModerator = restrictTo('isModerator');
export const requireCreator = restrictTo('isCreator');
