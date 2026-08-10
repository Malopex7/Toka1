import express from 'express';
import { getVideoComments, addComment, deleteComment } from '../controllers/commentController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.get('/videos/:videoId/comments', getVideoComments);
router.post('/videos/:videoId/comments', protect, addComment);
router.delete('/comments/:id', protect, deleteComment);

export default router;
