// src/controllers/liveController.js
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import LiveStream from '../models/LiveStream.js';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import { AppError } from '../middlewares/error.js';

const getLivekitConfig = () => ({
  host: process.env.LIVEKIT_HOST || 'ws://localhost:7880',
  apiKey: process.env.LIVEKIT_API_KEY || 'devkey',
  apiSecret: process.env.LIVEKIT_API_SECRET || 'secret',
});

function mintToken(roomName, participantName, participantId, canPublish = false) {
  const { apiKey, apiSecret } = getLivekitConfig();
  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantId.toString(),
    name: participantName,
    ttl: '4h',
  });
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish,
    canSubscribe: true,
    canPublishData: true,
  });
  return at.toJwt();
}

// GET /api/live/my-active
export const getMyActiveStream = async (req, res, next) => {
  try {
    const stream = await LiveStream.findOne({ hostId: req.user._id, status: 'live' }).lean();
    res.json({ status: 'success', data: { stream: stream || null } });
  } catch (err) {
    next(err);
  }
};

// POST /api/live/start
export const startStream = async (req, res, next) => {
  try {
    const { title, privacy = 'public', privateMode, entryFeeZAR, subscriberPriceZAR, tipInviteMinZAR } = req.body;
    const hostUser = req.user;

    // Check if host already has an active stream
    const existingActiveStream = await LiveStream.findOne({
      hostId: hostUser._id,
      status: 'live',
    });

    if (existingActiveStream) {
      return res.status(400).json({
        status: 'fail',
        message: 'You already have an active live stream. You must end it before starting a new one.',
        data: {
          activeStreamId: existingActiveStream._id,
          activeStreamTitle: existingActiveStream.title,
        },
      });
    }

    const roomName = `toka-live-${hostUser._id}-${Date.now()}`;

    const stream = await LiveStream.create({
      hostId: hostUser._id,
      title,
      privacy,
      privateMode: privacy === 'private' ? privateMode : null,
      entryFeeZAR: entryFeeZAR || 0,
      subscriberPriceZAR: subscriberPriceZAR || 0,
      tipInviteMinZAR: tipInviteMinZAR || 0,
      livekitRoomName: roomName,
      status: 'live',
    });

    const token = await mintToken(roomName, hostUser.username, hostUser._id, true);

    res.status(201).json({
      status: 'success',
      data: { stream, token, livekitUrl: process.env.LIVEKIT_HOST || 'ws://localhost:7880' }
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/live/active
export const getActiveStreams = async (req, res, next) => {
  try {
    const streams = await LiveStream.find({ status: 'live' })
      .populate('hostId', 'username avatarUrl displayName')
      .sort({ startedAt: -1 })
      .limit(50)
      .lean();

    res.json({ status: 'success', data: { streams } });
  } catch (err) {
    next(err);
  }
};

// GET /api/live/:roomId
export const getStream = async (req, res, next) => {
  try {
    const stream = await LiveStream.findById(req.params.roomId)
      .populate('hostId', 'username avatarUrl displayName')
      .lean();
    if (!stream) return next(new AppError('Stream not found', 404));
    res.json({ status: 'success', data: { stream } });
  } catch (err) {
    next(err);
  }
};

// POST /api/live/:roomId/join
export const joinStream = async (req, res, next) => {
  try {
    const stream = await LiveStream.findById(req.params.roomId);
    if (!stream || stream.status !== 'live') return next(new AppError('Stream is not active', 404));

    const viewer = req.user;

    const isHost = stream.hostId.toString() === viewer._id.toString();
    const isCohost = stream.cohosts.some(id => id.toString() === viewer._id.toString());

    // Private stream access check
    if (stream.privacy === 'private') {
      const isUnlocked = stream.unlockedViewers.some(id => id.toString() === viewer._id.toString());
      if (!isHost && !isCohost && !isUnlocked) {
        return res.status(403).json({
          status: 'locked',
          privateMode: stream.privateMode,
          entryFeeZAR: stream.entryFeeZAR,
          subscriberPriceZAR: stream.subscriberPriceZAR,
          tipInviteMinZAR: stream.tipInviteMinZAR,
        });
      }
    }

    // Add to viewers participants if not host and not already present
    if (!isHost && !stream.participants.some(id => id.toString() === viewer._id.toString())) {
      stream.participants.push(viewer._id);
      stream.viewerCount = stream.participants.length;
      await stream.save();
    }

    const canPublish = isHost || isCohost;
    const token = await mintToken(stream.livekitRoomName, viewer.username, viewer._id, canPublish);

    // Broadcast updated viewer count
    const io = req.app.locals.io;
    if (io) {
      io.to(stream.livekitRoomName).emit('viewer_count', { count: stream.viewerCount });
    }

    res.json({
      status: 'success',
      data: { token, livekitUrl: process.env.LIVEKIT_HOST || 'ws://localhost:7880', stream }
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/live/:roomId/tip
export const tipHost = async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return next(new AppError('Invalid tip amount', 400));

    const stream = await LiveStream.findById(req.params.roomId);
    if (!stream || stream.status !== 'live') return next(new AppError('Stream is not active', 404));

    const tipper = req.user;
    if (tipper.walletBalance < amount) return next(new AppError('Insufficient wallet balance', 400));

    const host = await User.findById(stream.hostId);
    if (!host) return next(new AppError('Host not found', 404));

    // Debit tipper, credit host
    tipper.walletBalance -= amount;
    host.walletBalance += amount;
    await tipper.save();
    await host.save();

    // Record transaction
    await Transaction.create({
      senderId: tipper._id,
      receiverId: host._id,
      liveStreamId: stream._id,
      amount,
      type: 'live_tip',
      status: 'success',
      reference: `live-tip-${Date.now()}-${tipper._id}`,
    });

    // Broadcast tip event to room
    const io = req.app.locals.io;
    if (io) {
      io.to(stream.livekitRoomName).emit('live_tip', {
        tipper: { username: tipper.username, avatarUrl: tipper.avatarUrl },
        amount,
      });
    }

    res.json({ status: 'success', message: `Tipped R${amount} to ${host.username}` });
  } catch (err) {
    next(err);
  }
};

// POST /api/live/:roomId/unlock-private
export const unlockPrivateRoom = async (req, res, next) => {
  try {
    const stream = await LiveStream.findById(req.params.roomId);
    if (!stream || stream.status !== 'live') return next(new AppError('Stream not found', 404));
    if (stream.privacy !== 'private') return next(new AppError('Stream is not private', 400));

    const viewer = req.user;
    const host = await User.findById(stream.hostId);
    if (!host) return next(new AppError('Host not found', 404));

    let amount = 0;
    if (stream.privateMode === 'entry_fee') amount = stream.entryFeeZAR;
    if (stream.privateMode === 'subscription') amount = stream.subscriberPriceZAR;
    if (stream.privateMode === 'tip_invite') amount = stream.tipInviteMinZAR;

    if (viewer.walletBalance < amount) return next(new AppError('Insufficient wallet balance', 400));

    // Process payment
    viewer.walletBalance -= amount;
    host.walletBalance += amount;
    await viewer.save();
    await host.save();

    await Transaction.create({
      senderId: viewer._id,
      receiverId: host._id,
      liveStreamId: stream._id,
      amount,
      type: 'live_entry',
      status: 'success',
      reference: `live-entry-${Date.now()}-${viewer._id}`,
    });

    // Grant access
    if (!stream.unlockedViewers.some(id => id.toString() === viewer._id.toString())) {
      stream.unlockedViewers.push(viewer._id);
      await stream.save();
    }

    // Notify viewer
    const io = req.app.locals.io;
    if (io) {
      io.to(stream.livekitRoomName).emit('room_unlocked', { userId: viewer._id.toString() });
    }

    // Mint and return token
    const token = await mintToken(stream.livekitRoomName, viewer.username, viewer._id, false);
    res.json({ status: 'success', data: { token, livekitUrl: process.env.LIVEKIT_HOST || 'ws://localhost:7880' } });
  } catch (err) {
    next(err);
  }
};

// POST /api/live/:roomId/invite-cohost
export const inviteCohost = async (req, res, next) => {
  try {
    const rawUsername = (req.body.username || '').trim();
    if (!rawUsername) return next(new AppError('Username is required', 400));
    const cleanUsername = rawUsername.replace(/^@/, '').toLowerCase();

    const stream = await LiveStream.findById(req.params.roomId);
    if (!stream || stream.status !== 'live') return next(new AppError('Stream not found', 404));
    if (stream.hostId.toString() !== req.user._id.toString()) {
      return next(new AppError('Only the host can invite co-hosts', 403));
    }

    const invitee = await User.findOne({
      username: { $regex: new RegExp(`^${cleanUsername}$`, 'i') }
    }).select('_id username avatarUrl');

    if (!invitee) return next(new AppError(`User @${cleanUsername} not found`, 404));

    const io = req.app.locals.io;
    if (io) {
      io.emit(`cohost_invited:${invitee._id}`, {
        roomId: stream._id.toString(),
        roomName: stream.livekitRoomName,
        title: stream.title,
        host: { username: req.user.username, avatarUrl: req.user.avatarUrl },
      });
    }

    res.json({ status: 'success', message: `Co-host invite sent to @${cleanUsername}` });
  } catch (err) {
    next(err);
  }
};

// POST /api/live/:roomId/cohost (accept invite)
export const acceptCohost = async (req, res, next) => {
  try {
    const stream = await LiveStream.findById(req.params.roomId);
    if (!stream || stream.status !== 'live') return next(new AppError('Stream not found', 404));

    const cohost = req.user;
    if (!stream.cohosts.some(id => id.toString() === cohost._id.toString())) {
      stream.cohosts.push(cohost._id);
      await stream.save();
    }

    // Co-host gets publish permission
    const token = await mintToken(stream.livekitRoomName, cohost.username, cohost._id, true);
    res.json({ status: 'success', data: { token, livekitUrl: process.env.LIVEKIT_HOST || 'ws://localhost:7880' } });
  } catch (err) {
    next(err);
  }
};

// POST /api/live/:roomId/end
export const endStream = async (req, res, next) => {
  try {
    const stream = await LiveStream.findById(req.params.roomId);
    if (!stream) return next(new AppError('Stream not found', 404));
    if (stream.hostId.toString() !== req.user._id.toString()) {
      return next(new AppError('Only the host can end the stream', 403));
    }

    stream.status = 'ended';
    stream.endedAt = new Date();
    await stream.save();

    // Try to delete LiveKit room (non-fatal if fails)
    try {
      const { host, apiKey, apiSecret } = getLivekitConfig();
      const httpHost = host.replace('ws://', 'http://').replace('wss://', 'https://');
      const roomService = new RoomServiceClient(httpHost, apiKey, apiSecret);
      await roomService.deleteRoom(stream.livekitRoomName);
    } catch (_) { /* room may already be empty */ }

    const io = req.app.locals.io;
    if (io) {
      io.to(stream.livekitRoomName).emit('stream_ended', { roomId: stream._id.toString() });
    }

    res.json({ status: 'success', message: 'Stream ended' });
  } catch (err) {
    next(err);
  }
};
