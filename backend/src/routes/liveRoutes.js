// src/routes/liveRoutes.js
import express from 'express';
import { protect } from '../middlewares/auth.js';
import {
  startStream,
  getMyActiveStream,
  getActiveStreams,
  getStream,
  joinStream,
  tipHost,
  unlockPrivateRoom,
  inviteCohost,
  acceptCohost,
  endStream,
} from '../controllers/liveController.js';

const router = express.Router();

// Public routes
router.get('/live/active', getActiveStreams);
router.get('/live/:roomId', getStream);

// Protected routes
router.get('/live/user/my-active', protect, getMyActiveStream);
router.post('/live/start', protect, startStream);
router.post('/live/:roomId/join', protect, joinStream);
router.post('/live/:roomId/tip', protect, tipHost);
router.post('/live/:roomId/unlock-private', protect, unlockPrivateRoom);
router.post('/live/:roomId/invite-cohost', protect, inviteCohost);
router.post('/live/:roomId/cohost', protect, acceptCohost);
router.post('/live/:roomId/end', protect, endStream);

export default router;
