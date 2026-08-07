import express from 'express';
import { syncUser, getMe, saveFcmToken } from '../controllers/userController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.post('/users/sync', syncUser);
router.get('/users/me', protect, getMe);
router.post('/users/fcm-token', protect, saveFcmToken);

export default router;
