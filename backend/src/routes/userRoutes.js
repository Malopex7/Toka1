import express from 'express';
import { syncUser, getMe, saveFcmToken, toggleFollow, checkFollowStatus } from '../controllers/userController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.post('/users/sync', syncUser);
router.get('/users/me', protect, getMe);
router.post('/users/fcm-token', protect, saveFcmToken);
router.post('/users/follow/:targetUserId', protect, toggleFollow);
router.get('/users/follow/:targetUserId/status', protect, checkFollowStatus);

export default router;
