import express from 'express';
import { tipCreator } from '../controllers/transactionController.js';
import { initializeDeposit, handlePaystackWebhook } from '../controllers/paystackController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.post('/transactions/tip', protect, tipCreator);
router.post('/transactions/deposit', protect, initializeDeposit);
router.post('/webhooks/paystack', handlePaystackWebhook);

export default router;
