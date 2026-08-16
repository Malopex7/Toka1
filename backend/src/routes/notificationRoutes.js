import express from 'express';
import Notification from '../models/Notification.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

// Get recent notifications for the logged-in user
router.get('/notifications', protect, async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.status(200).json({
      status: 'success',
      data: { notifications }
    });
  } catch (err) {
    next(err);
  }
});

// Mark all unread notifications as read
router.patch('/notifications/read', protect, async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { read: true }
    );

    res.status(200).json({
      status: 'success',
      message: 'All notifications marked as read.'
    });
  } catch (err) {
    next(err);
  }
});

export default router;
