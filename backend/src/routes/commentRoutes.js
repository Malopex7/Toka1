import express from 'express';
import { getVideoComments, addComment, toggleLikeComment, reportComment, deleteComment, updateComment } from '../controllers/commentController.js';
import { protect, optionalProtect } from '../middlewares/auth.js';

const router = express.Router();

router.get('/videos/:videoId/comments', optionalProtect, getVideoComments);
router.post('/videos/:videoId/comments', protect, addComment);
router.post('/comments/:id/like', protect, toggleLikeComment);
router.post('/comments/:id/report', protect, reportComment);
router.delete('/comments/:id', protect, deleteComment);
router.patch('/comments/:id', protect, updateComment);

export default router;
