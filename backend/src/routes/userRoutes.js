import express from 'express';
import { syncUser, getMe } from '../controllers/userController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.post('/users/sync', syncUser);
router.get('/users/me', protect, getMe);

export default router;
