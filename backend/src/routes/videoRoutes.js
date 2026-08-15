import express from 'express';
import multer from 'multer';
import { 
  getFeed, 
  processAiVetting, 
  updateVettingStatus, 
  uploadVideo, 
  uploadGridFSVideo, 
  streamGridFSVideo,
  toggleLikeVideo,
  recordShare,
  deleteVideo,
  updateVideo
} from '../controllers/videoController.js';
import { optionalProtect, protect, requireModerator, restrictTo } from '../middlewares/auth.js';

// Configure multer in-memory storage for handling file uploads before passing to GridFS
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed!'), false);
    }
  }
});

const router = express.Router();

router.get('/feed', optionalProtect, getFeed);
router.post('/videos', protect, restrictTo('creator', 'brand'), uploadVideo);
router.post('/videos/upload', protect, restrictTo('creator', 'brand'), upload.single('video'), uploadGridFSVideo);
router.get('/videos/stream/:filename', streamGridFSVideo);
router.post('/webhooks/ai-vetting', processAiVetting);
router.patch('/videos/:id/vetting-status', protect, requireModerator, updateVettingStatus);
router.post('/videos/:id/like', protect, toggleLikeVideo);
router.post('/videos/:id/share', recordShare);
router.delete('/videos/:id', protect, deleteVideo);
router.patch('/videos/:id', protect, updateVideo);

export default router;
