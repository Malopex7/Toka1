import express from 'express';
import { 
  syncUser, 
  getMe, 
  saveFcmToken, 
  toggleFollow, 
  checkFollowStatus, 
  getProfileByUsername,
  requestVerification,
  getVerificationRequests,
  updateVerificationStatus,
  getVerifiedBrands,
  getUserDirectory,
  searchUsers
} from '../controllers/userController.js';
import { protect, requireModerator } from '../middlewares/auth.js';

const router = express.Router();

router.get('/users/search', protect, searchUsers);
router.post('/users/sync', syncUser);
router.get('/users/me', protect, getMe);
router.post('/users/fcm-token', protect, saveFcmToken);
router.post('/users/follow/:targetUserId', protect, toggleFollow);
router.get('/users/follow/:targetUserId/status', protect, checkFollowStatus);
router.get('/users/profile/:username', getProfileByUsername);

// Verification and Directory Routes
router.post('/users/request-verification', protect, requestVerification);
router.get('/users/verification-requests', protect, requireModerator, getVerificationRequests);
router.patch('/users/:id/verify-status', protect, requireModerator, updateVerificationStatus);
router.get('/users/verified-brands', protect, getVerifiedBrands);
router.get('/users/directory', protect, getUserDirectory);

export default router;
