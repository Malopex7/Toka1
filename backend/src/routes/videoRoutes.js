import express from 'express';
import { getFeed, processAiVetting, updateVettingStatus } from '../controllers/videoController.js';
import { optionalProtect, protect, requireModerator } from '../middlewares/auth.js';

const router = express.Router();

router.get('/feed', optionalProtect, getFeed);
router.post('/webhooks/ai-vetting', processAiVetting);
router.patch('/videos/:id/vetting-status', protect, requireModerator, updateVettingStatus);

export default router;
