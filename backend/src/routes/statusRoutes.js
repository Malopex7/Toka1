import express from 'express';
import multer from 'multer';
import {
  getFollowedStatusFeed,
  getUserActiveStatuses,
  createStatus,
  recordStatusView,
  reactToStatus,
  replyToStatus,
  getStatusAnalytics,
  deleteStatus,
  createOrUpdateHighlight,
  getUserHighlights,
  deleteHighlight
} from '../controllers/statusController.js';
import { protect, optionalProtect } from '../middlewares/auth.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 30 * 1024 * 1024 // 30MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed!'), false);
    }
  }
});

const multerErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ status: 'fail', message: 'File too large. Maximum status upload size is 30MB.' });
    }
    return res.status(400).json({ status: 'fail', message: `Upload error: ${err.message}` });
  }
  if (err && err.message?.includes('Only image and video')) {
    return res.status(400).json({ status: 'fail', message: err.message });
  }
  next(err);
};

const router = express.Router();

// Status feed and creator stories
router.get('/status/feed', protect, getFollowedStatusFeed);
router.get('/status/user/:userId', protect, getUserActiveStatuses);
router.post('/status/create', protect, upload.single('media'), multerErrorHandler, createStatus);

// Status engagement & viewing
router.post('/status/:id/view', protect, recordStatusView);
router.post('/status/:id/react', protect, reactToStatus);
router.post('/status/:id/reply', protect, replyToStatus);
router.get('/status/:id/analytics', protect, getStatusAnalytics);
router.delete('/status/:id', protect, deleteStatus);

// Profile Highlights
router.get('/status/highlights/:userId', optionalProtect, getUserHighlights);
router.post('/status/highlights', protect, createOrUpdateHighlight);
router.delete('/status/highlights/:id', protect, deleteHighlight);

export default router;
