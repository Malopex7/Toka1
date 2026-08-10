import express from 'express';
import { getVideoComments, addComment, toggleLikeComment, deleteComment } from '../controllers/commentController.js';
import { protect, optionalProtect } from '../middlewares/auth.js';

const router = express.Router();

router.get('/videos/:videoId/comments', optionalProtect, getVideoComments);
router.post('/videos/:videoId/comments', protect, addComment);
router.post('/comments/:id/like', protect, toggleLikeComment);
router.delete('/comments/:id', protect, deleteComment);

export default router;
