import express from 'express';
import multer from 'multer';
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
  searchUsers,
  getMutualFollowers,
  updateSettings,
  updateAvatar,
  uploadAvatarFile
} from '../controllers/userController.js';
import { protect, requireModerator } from '../middlewares/auth.js';

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WebP) are allowed!'), false);
    }
  }
});

const router = express.Router();

router.get('/users/search', protect, searchUsers);
router.get('/users/mutual-followers', protect, getMutualFollowers);
router.patch('/users/settings', protect, updateSettings);
router.post('/users/avatar/upload', protect, avatarUpload.single('avatar'), uploadAvatarFile);
router.patch('/users/avatar', protect, updateAvatar);
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
