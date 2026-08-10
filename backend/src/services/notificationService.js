import { messaging } from '../config/firebase.js';
import User from '../models/User.js';
import NotificationModel from '../models/Notification.js';

/**
 * sendFcmNotification
 * Finds user, loops through their registered FCM tokens, and dispatches push notifications.
 * Obsolete or unregistered tokens are automatically pulled from the user profile database.
 * 
 * @param {string} userId - Target Mongoose User _id
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Custom key-value pairs (must be string values)
 */
export const sendFcmNotification = async (userId, title, body, data = {}) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      console.log(`[Notification Service] User ${userId} not found.`);
      return;
    }

    // Persist to MongoDB for in-app notification center fallback
    await NotificationModel.create({
      userId,
      title,
      body,
      type: data.type || 'general',
      metadata: data
    });

    if (!user.fcmTokens || user.fcmTokens.length === 0) {
      console.log(`[Notification Service] Saved in DB. No FCM tokens registered for User ${user.username} (${userId}).`);
      return;
    }

    console.log(`[Notification Service] Dispatched push to User ${user.username} on ${user.fcmTokens.length} devices.`);

    // Convert all custom data values to string type as required by FCM specifications
    const stringifiedData = {};
    Object.keys(data).forEach(key => {
      stringifiedData[key] = String(data[key]);
    });

    const tokensToRemove = [];

    for (const token of user.fcmTokens) {
      const message = {
        notification: { title, body },
        data: stringifiedData,
        token
      };

      try {
        await messaging.send(message);
        console.log(`[Notification Service] FCM successfully delivered to token: ${token.substring(0, 15)}...`);
      } catch (err) {
        console.error(`[Notification Service] FCM delivery failed for token: ${token.substring(0, 15)}...`, err.code || err.message);
        
        // Remove stale/expired device tokens immediately
        if (
          err.code === 'messaging/registration-token-not-registered' ||
          err.code === 'messaging/invalid-registration-token' ||
          err.message?.includes('registration-token-not-registered') ||
          err.message?.includes('not registered')
        ) {
          tokensToRemove.push(token);
        }
      }
    }

    // Clean up stale tokens in the database
    if (tokensToRemove.length > 0) {
      console.log(`[Notification Service] Pruning ${tokensToRemove.length} inactive tokens for user ${user.username}.`);
      await User.findByIdAndUpdate(userId, {
        $pull: { fcmTokens: { $in: tokensToRemove } }
      });
    }

  } catch (error) {
    console.error('[Notification Service] Unexpected failure running sendFcmNotification:', error);
  }
};
