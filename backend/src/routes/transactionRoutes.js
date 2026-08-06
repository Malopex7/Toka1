import express from 'express';
import { tipCreator } from '../controllers/transactionController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.post('/transactions/tip', protect, tipCreator);

export default router;
