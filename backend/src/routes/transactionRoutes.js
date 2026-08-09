import express from 'express';
import { tipCreator, getMyTransactions } from '../controllers/transactionController.js';
import { initializeDeposit, handlePaystackWebhook, verifyDeposit } from '../controllers/paystackController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.post('/transactions/tip', protect, tipCreator);
router.get('/transactions/my', protect, getMyTransactions);
router.post('/transactions/deposit', protect, initializeDeposit);
router.post('/transactions/verify-deposit', protect, verifyDeposit);
router.post('/webhooks/paystack', handlePaystackWebhook);

export default router;

