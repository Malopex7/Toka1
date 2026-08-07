import crypto from 'crypto';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import mongoose from 'mongoose';
import { AppError } from '../middlewares/error.js';

/**
 * POST /api/transactions/deposit
 * Initializes a deposit payment with Paystack and returns checkout URL.
 */
export const initializeDeposit = async (req, res, next) => {
  const { amount } = req.body;

  if (!amount) {
    throw new AppError('Please provide deposit amount.', 400);
  }

  const depositAmount = parseFloat(amount);
  if (isNaN(depositAmount) || depositAmount <= 0) {
    throw new AppError('Deposit amount must be a positive number.', 400);
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    throw new AppError('Paystack configuration error. Secret key missing.', 500);
  }

  // Convert ZAR/NGN to cents (Paystack API expects amount in cents/kobo)
  const amountInCents = Math.round(depositAmount * 100);

  try {
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: req.user.email,
        amount: amountInCents,
        metadata: {
          userId: req.user._id.toString(),
          custom_fields: [
            {
              display_name: "Toka User ID",
              variable_name: "user_id",
              value: req.user._id.toString()
            }
          ]
        },
        callback_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/deposit?status=success`
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new AppError(errorData.message || 'Paystack initialization failed.', 400);
    }

    const result = await response.json();
    if (result && result.status) {
      res.status(200).json({
        status: 'success',
        data: {
          authorization_url: result.data.authorization_url,
          reference: result.data.reference,
          access_code: result.data.access_code
        }
      });
    } else {
      throw new AppError('Failed to parse Paystack initialization response.', 500);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/webhooks/paystack
 * Receives updates from Paystack. Webhook signature is validated using HMAC SHA512.
 */
export const handlePaystackWebhook = async (req, res, next) => {
  const signature = req.headers['x-paystack-signature'];
  if (!signature) {
    throw new AppError('Paystack webhook signature is missing.', 401);
  }

  // Verify HMAC signature
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== signature) {
    throw new AppError('Invalid Paystack webhook signature.', 401);
  }

  const { event, data } = req.body;

  if (event === 'charge.success') {
    const { reference, amount, metadata, currency } = data;
    const userId = metadata?.userId || metadata?.user_id;

    if (!userId) {
      console.warn('[Paystack Webhook] userId missing in metadata, skipping deposit crediting.');
      return res.status(200).json({ status: 'ignored', message: 'No userId in metadata' });
    }

    // Ensure idempotency: check if transaction with reference already processed
    const existingTx = await Transaction.findOne({ reference });
    if (existingTx) {
      console.log(`[Paystack Webhook] Reference ${reference} already processed, ignoring.`);
      return res.status(200).json({ status: 'success', message: 'Already processed' });
    }

    const depositAmount = amount / 100; // convert cents/kobo back to base units

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Credit sender wallet balance
      const user = await User.findByIdAndUpdate(
        userId,
        { $inc: { walletBalance: depositAmount } },
        { session, new: true }
      );

      if (!user) {
        throw new Error(`User with ID ${userId} not found.`);
      }

      // Create transaction log
      await Transaction.create([{
        senderId: userId,
        receiverId: userId,
        amount: depositAmount,
        currency: currency || 'ZAR',
        status: 'success',
        type: 'deposit',
        reference
      }], { session });

      await session.commitTransaction();
      console.log(`[Paystack Webhook] Successfully credited User ${userId} with ${depositAmount} ${currency || 'ZAR'}`);
    } catch (error) {
      await session.abortTransaction();
      console.error('[Paystack Webhook] Wallet credit failed:', error);
      throw new AppError('Webhook transaction processing failed.', 500);
    } finally {
      session.endSession();
    }
  }

  // Acknowledge receipt of event to Paystack
  res.status(200).json({ status: 'success' });
};
