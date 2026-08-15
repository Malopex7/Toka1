import mongoose from 'mongoose';
import User from '../models/User.js';
import Video from '../models/Video.js';
import SponsorshipRequest from '../models/SponsorshipRequest.js';
import Transaction from '../models/Transaction.js';
import { AppError } from '../middlewares/error.js';
import { sendFcmNotification } from '../services/notificationService.js';

/**
 * POST /api/sponsorships/create
 * Creates a brand sponsorship request for a video. Sets video to private.
 */
export const createSponsorship = async (req, res, next) => {
  const { videoId, brandId, amount, terms } = req.body;

  if (!videoId || !brandId || !amount) {
    throw new AppError('Please provide videoId, brandId, and amount.', 400);
  }

  const requestedAmount = parseFloat(amount);
  if (isNaN(requestedAmount) || requestedAmount <= 0) {
    throw new AppError('Sponsorship amount must be a positive number.', 400);
  }

  // 1) Verify creator is brand safety verified
  if (!req.user.isBrandSafeVerified) {
    throw new AppError('Only verified creators can request brand sponsorships.', 403);
  }

  // 2) Verify video exists and belongs to the creator
  const video = await Video.findById(videoId);
  if (!video) {
    throw new AppError('Video not found.', 404);
  }
  if (video.creatorId.toString() !== req.user._id.toString()) {
    throw new AppError('You do not own this video.', 403);
  }

  // 3) Verify target brand exists and is a verified brand
  const brand = await User.findById(brandId);
  if (!brand) {
    throw new AppError('Target brand user not found.', 404);
  }
  if (brand.role !== 'brand' || !brand.isBrandSafeVerified) {
    throw new AppError('Target user must be a verified brand.', 400);
  }

  // Ensure creator doesn't sponsor themselves
  if (brandId.toString() === req.user._id.toString()) {
    throw new AppError('You cannot request sponsorship from yourself.', 400);
  }

  // 4) Check if a pending or approved request already exists for this video
  const existingRequest = await SponsorshipRequest.findOne({
    videoId,
    status: { $in: ['pending', 'approved'] }
  });
  if (existingRequest) {
    throw new AppError('A pending or approved sponsorship request already exists for this video.', 400);
  }

  // 5) Start session to perform updates atomically
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Create the sponsorship request
    const request = await SponsorshipRequest.create([{
      videoId,
      creatorId: req.user._id,
      brandId,
      amount: requestedAmount,
      terms: terms || '',
      status: 'pending',
      escrowStatus: 'none'
    }], { session });

    // Link request to the video and hide it (visibility private)
    video.visibility = 'private';
    video.sponsorshipId = request[0]._id;
    video.brandId = brandId;
    await video.save({ session });

    await session.commitTransaction();

    // Notify brand
    sendFcmNotification(
      brandId,
      'New Sponsorship Request Received!',
      `@${req.user.username} requested sponsorship of R ${requestedAmount.toFixed(2)} for video: "${video.title}"`,
      {
        type: 'sponsorship_requested',
        sponsorshipId: request[0]._id.toString(),
        videoId: videoId.toString(),
        amount: String(requestedAmount),
        creatorName: req.user.username
      }
    ).catch(err => console.error('[FCM Sponsor Request Failed]', err));

    res.status(201).json({
      status: 'success',
      message: 'Sponsorship request created. Video set to private until brand review.',
      data: {
        sponsorshipRequest: request[0]
      }
    });

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * GET /api/sponsorships/brand/pending
 * Lists incoming pending sponsorship requests for a brand user.
 */
export const getBrandPendingSponsorships = async (req, res, next) => {
  if (req.user.role !== 'brand') {
    throw new AppError('Only brand users can check pending inbox.', 403);
  }

  const filter = { brandId: req.user._id };
  if (req.query.status) {
    filter.status = req.query.status;
  } else if (req.query.all !== 'true') {
    filter.status = 'pending';
  }

  const requests = await SponsorshipRequest.find(filter)
    .populate('creatorId', 'username email')
    .populate('videoId', 'title videoUrl vettingStatus aiPipelineStatus visibility')
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    results: requests.length,
    data: { requests }
  });
};

/**
 * GET /api/sponsorships/creator/sent
 * Lists sent sponsorship requests for a creator.
 */
export const getCreatorSentSponsorships = async (req, res, next) => {
  const requests = await SponsorshipRequest.find({
    creatorId: req.user._id
  })
    .populate('brandId', 'username email')
    .populate('videoId', 'title videoUrl visibility vettingStatus')
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    results: requests.length,
    data: { requests }
  });
};

/**
 * POST /api/sponsorships/:id/approve
 * Brand approves the request and pays the budget into escrow.
 */
export const approveSponsorship = async (req, res, next) => {
  const { id } = req.params;

  const request = await SponsorshipRequest.findById(id);
  if (!request) {
    throw new AppError('Sponsorship request not found.', 404);
  }

  if (request.brandId.toString() !== req.user._id.toString()) {
    throw new AppError('Only the targeted brand can approve this request.', 403);
  }

  if (request.status !== 'pending') {
    throw new AppError(`Sponsorship is already ${request.status}.`, 400);
  }

  const video = await Video.findById(request.videoId);
  if (!video) {
    throw new AppError('Associated video not found.', 404);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1) Verify brand has sufficient wallet balance and deduct
    const brand = await User.findOneAndUpdate(
      { _id: req.user._id, walletBalance: { $gte: request.amount } },
      { $inc: { walletBalance: -request.amount } },
      { session, new: true }
    );

    if (!brand) {
      throw new AppError('Insufficient wallet balance to sponsor this video.', 400);
    }

    // 2) Log transaction in pending status (escrow)
    const transaction = await Transaction.create([{
      senderId: req.user._id,
      receiverId: request.creatorId,
      amount: request.amount,
      currency: 'ZAR',
      status: 'pending', // Pending escrow release
      type: 'brand_sponsorship',
      reference: `sponsorship:${request._id}`
    }], { session });

    // 3) Update sponsorship request: status approved, escrow held, release date in 7 days
    const escrowReleaseAt = new Date();
    escrowReleaseAt.setDate(escrowReleaseAt.getDate() + 7);

    request.status = 'approved';
    request.escrowStatus = 'held';
    request.escrowReleaseAt = escrowReleaseAt;
    await request.save({ session });

    // 4) Make the video public
    video.visibility = 'public';
    await video.save({ session });

    await session.commitTransaction();

    // Notify creator
    sendFcmNotification(
      request.creatorId,
      'Sponsorship Request Approved!',
      `@${req.user.username} approved your sponsorship request of R ${request.amount.toFixed(2)}! Funds are held in escrow for 7 days.`,
      {
        type: 'sponsorship_approved',
        sponsorshipId: request._id.toString(),
        videoId: request.videoId.toString(),
        amount: String(request.amount),
        brandName: req.user.username
      }
    ).catch(err => console.error('[FCM Sponsor Approve Notification Failed]', err));

    res.status(200).json({
      status: 'success',
      message: 'Sponsorship approved. Video published, funds are in escrow.',
      data: {
        sponsorshipRequest: request,
        transaction: transaction[0]
      }
    });

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * POST /api/sponsorships/:id/reject
 * Brand rejects the request. Video remains private.
 */
export const rejectSponsorship = async (req, res, next) => {
  const { id } = req.params;

  const request = await SponsorshipRequest.findById(id);
  if (!request) {
    throw new AppError('Sponsorship request not found.', 404);
  }

  if (request.brandId.toString() !== req.user._id.toString()) {
    throw new AppError('Only the targeted brand can reject this request.', 403);
  }

  if (request.status !== 'pending') {
    throw new AppError(`Sponsorship is already ${request.status}.`, 400);
  }

  request.status = 'rejected';
  await request.save();

  // Notify creator
  sendFcmNotification(
    request.creatorId,
    'Sponsorship Request Declined',
    `@${req.user.username} declined your sponsorship request for "${request.videoId.title || 'your video'}"`,
    {
      type: 'sponsorship_rejected',
      sponsorshipId: request._id.toString(),
      brandName: req.user.username
    }
  ).catch(err => console.error('[FCM Sponsor Reject Notification Failed]', err));

  res.status(200).json({
    status: 'success',
    message: 'Sponsorship request rejected.',
    data: { sponsorshipRequest: request }
  });
};

/**
 * POST /api/sponsorships/:id/withdraw
 * Creator withdraws their pending request. Creator can keep video private or delete.
 */
export const withdrawSponsorship = async (req, res, next) => {
  const { id } = req.params;

  const request = await SponsorshipRequest.findById(id);
  if (!request) {
    throw new AppError('Sponsorship request not found.', 404);
  }

  if (request.creatorId.toString() !== req.user._id.toString()) {
    throw new AppError('Only the requesting creator can withdraw this request.', 403);
  }

  if (request.status !== 'pending') {
    throw new AppError(`Sponsorship is already ${request.status}.`, 400);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    request.status = 'withdrawn';
    await request.save({ session });

    // Remove link from video so it can be re-sponsored or published manually
    const video = await Video.findById(request.videoId);
    if (video) {
      video.sponsorshipId = undefined;
      video.brandId = undefined;
      await video.save({ session });
    }

    await session.commitTransaction();

    res.status(200).json({
      status: 'success',
      message: 'Sponsorship request withdrawn.',
      data: { sponsorshipRequest: request }
    });

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * POST /api/sponsorships/:id/dispute
 * Brand disputes an active sponsorship under the 7-day escrow window.
 */
export const disputeSponsorship = async (req, res, next) => {
  const { id } = req.params;

  const request = await SponsorshipRequest.findById(id);
  if (!request) {
    throw new AppError('Sponsorship request not found.', 404);
  }

  if (request.brandId.toString() !== req.user._id.toString()) {
    throw new AppError('Only the sponsor brand can dispute this.', 403);
  }

  if (request.status !== 'approved' || request.escrowStatus !== 'held') {
    throw new AppError('Sponsorship is not in a active escrow state.', 400);
  }

  // Verify within 7 days
  const now = new Date();
  if (request.escrowReleaseAt < now) {
    throw new AppError('Escrow period has expired. Payout was already queued.', 400);
  }

  request.status = 'disputed';
  request.escrowStatus = 'locked';
  await request.save();

  // Trigger alert notification to moderators
  const moderators = await User.find({ role: 'moderator' }).select('_id');
  moderators.forEach(mod => {
    sendFcmNotification(
      mod._id,
      'Sponsorship Dispute Logged',
      `Brand @${req.user.username} disputed request ${request._id} with Creator. Payout locked.`,
      {
        type: 'sponsorship_dispute',
        sponsorshipId: request._id.toString(),
        brandName: req.user.username
      }
    ).catch(err => console.error('[FCM Sponsor Dispute Alert Failed]', err));
  });

  res.status(200).json({
    status: 'success',
    message: 'Sponsorship disputed. Escrow funds locked pending moderator resolution.',
    data: { sponsorshipRequest: request }
  });
};

/**
 * POST /api/sponsorships/:id/resolve
 * Moderator resolves a disputed sponsorship request.
 */
export const resolveSponsorship = async (req, res, next) => {
  const { id } = req.params;
  const { action } = req.body; // 'release' | 'refund'

  if (req.user.role !== 'moderator') {
    throw new AppError('Only moderators can resolve disputes.', 403);
  }

  const request = await SponsorshipRequest.findById(id);
  if (!request) {
    throw new AppError('Sponsorship request not found.', 404);
  }

  if (request.status !== 'disputed' || request.escrowStatus !== 'locked') {
    throw new AppError('Sponsorship request is not disputed/locked.', 400);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (action === 'release') {
      const payoutAmount = request.amount * 0.9; // 10% fee

      const video = await Video.findById(request.videoId);
      const acceptedCoAuthor = video?.coAuthors?.find(ca => ca.status === 'accepted');
      const isSplit = Boolean(acceptedCoAuthor && acceptedCoAuthor.user);
      const coAuthorPct = isSplit ? (acceptedCoAuthor.splitPercentage || 50) : 0;
      const authorPct = 100 - coAuthorPct;

      if (isSplit) {
        const coAuthorUserId = acceptedCoAuthor.user;
        const coAuthorShare = Math.round(payoutAmount * (coAuthorPct / 100) * 100) / 100;
        const primaryShare = Math.round((payoutAmount - coAuthorShare) * 100) / 100;
        const splitRatioStr = `${authorPct}/${coAuthorPct}`;

        // Credit primary author
        await User.findByIdAndUpdate(
          request.creatorId,
          { $inc: { walletBalance: primaryShare } },
          { session }
        );

        // Credit co-author
        await User.findByIdAndUpdate(
          coAuthorUserId,
          { $inc: { walletBalance: coAuthorShare } },
          { session }
        );

        // Update primary author transaction
        await Transaction.findOneAndUpdate(
          { reference: `sponsorship:${request._id}` },
          {
            status: 'success',
            amount: primaryShare,
            splitDetails: {
              isSplit: true,
              role: 'primary_author',
              splitRatio: splitRatioStr,
              partnerId: coAuthorUserId
            }
          },
          { session }
        );

        // Create co-author transaction
        await Transaction.create([{
          senderId: request.brandId,
          receiverId: coAuthorUserId,
          videoId: request.videoId,
          amount: coAuthorShare,
          currency: 'ZAR',
          status: 'success',
          type: 'brand_sponsorship',
          reference: `sponsorship:${request._id}:coauthor`,
          splitDetails: {
            isSplit: true,
            role: 'co_author',
            splitRatio: splitRatioStr,
            partnerId: request.creatorId
          }
        }], { session });

        sendFcmNotification(
          request.creatorId,
          'Dispute Resolved: Payout Released 🤝',
          `Dispute resolved in your favor. R ${primaryShare.toFixed(2)} (${authorPct}% collab share) credited to your wallet.`,
          { type: 'dispute_resolved_release', sponsorshipId: request._id.toString() }
        ).catch(err => console.error('[FCM Release Alert Failed]', err));

        sendFcmNotification(
          coAuthorUserId,
          'Dispute Resolved: Collab Payout Released 🤝',
          `Dispute resolved. R ${coAuthorShare.toFixed(2)} (${coAuthorPct}% collab share) credited to your wallet.`,
          { type: 'dispute_resolved_release', sponsorshipId: request._id.toString() }
        ).catch(err => console.error('[FCM Release CoAuthor Alert Failed]', err));
      } else {
        // Credit Creator wallet
        await User.findByIdAndUpdate(
          request.creatorId,
          { $inc: { walletBalance: payoutAmount } },
          { session }
        );

        // Update Transaction log to success
        await Transaction.findOneAndUpdate(
          { reference: `sponsorship:${request._id}` },
          { status: 'success' },
          { session }
        );

        sendFcmNotification(
          request.creatorId,
          'Dispute Resolved: Payout Released',
          `Moderators resolved the dispute in your favor. R ${payoutAmount.toFixed(2)} credited to wallet.`,
          { type: 'dispute_resolved_release', sponsorshipId: request._id.toString() }
        ).catch(err => console.error('[FCM Release Alert Failed]', err));
      }

      request.status = 'completed';
      request.escrowStatus = 'released';
      await request.save({ session });

    } else if (action === 'refund') {
      // Refund Brand wallet
      await User.findByIdAndUpdate(
        request.brandId,
        { $inc: { walletBalance: request.amount } },
        { session }
      );

      // Update Transaction log to failed
      await Transaction.findOneAndUpdate(
        { reference: `sponsorship:${request._id}` },
        { status: 'failed' },
        { session }
      );

      request.status = 'rejected';
      request.escrowStatus = 'refunded';
      await request.save({ session });

      // Make the video private again since sponsorship was cancelled
      const video = await Video.findById(request.videoId);
      if (video) {
        video.visibility = 'private';
        await video.save({ session });
      }

      sendFcmNotification(
        request.brandId,
        'Dispute Resolved: Refunded',
        `Moderators resolved the dispute. Sponsorship fee of R ${request.amount.toFixed(2)} refunded to your wallet.`,
        { type: 'dispute_resolved_refund', sponsorshipId: request._id.toString() }
      ).catch(err => console.error('[FCM Refund Alert Failed]', err));

      sendFcmNotification(
        request.creatorId,
        'Dispute Resolved: Refunded to Brand',
        `Moderators resolved the dispute. Sponsorship was refunded to the brand and video hidden.`,
        { type: 'dispute_resolved_refund_creator', sponsorshipId: request._id.toString() }
      ).catch(err => console.error('[FCM Refund Creator Alert Failed]', err));

    } else {
      throw new AppError('Invalid resolution action. Use "release" or "refund".', 400);
    }

    await session.commitTransaction();

    res.status(200).json({
      status: 'success',
      message: `Dispute successfully resolved with action: ${action}.`,
      data: { sponsorshipRequest: request }
    });

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * POST /api/sponsorships/process-escrows
 * Triggered to release held escrows that are older than 7 days.
 */
export const processEscrows = async (req, res, next) => {
  const now = new Date();

  // Find all sponsorship requests that are approved (status: approved), held (escrowStatus: held), and older than 7 days
  const pendingRequests = await SponsorshipRequest.find({
    status: 'approved',
    escrowStatus: 'held',
    escrowReleaseAt: { $lte: now }
  });

  let processedCount = 0;

  for (const request of pendingRequests) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const payoutAmount = request.amount * 0.9; // 10% fee

      const video = await Video.findById(request.videoId);
      const acceptedCoAuthor = video?.coAuthors?.find(ca => ca.status === 'accepted');
      const isSplit = Boolean(acceptedCoAuthor && acceptedCoAuthor.user);
      const coAuthorPct = isSplit ? (acceptedCoAuthor.splitPercentage || 50) : 0;
      const authorPct = 100 - coAuthorPct;

      if (isSplit) {
        const coAuthorUserId = acceptedCoAuthor.user;
        const coAuthorShare = Math.round(payoutAmount * (coAuthorPct / 100) * 100) / 100;
        const primaryShare = Math.round((payoutAmount - coAuthorShare) * 100) / 100;
        const splitRatioStr = `${authorPct}/${coAuthorPct}`;

        // Credit primary author
        await User.findByIdAndUpdate(
          request.creatorId,
          { $inc: { walletBalance: primaryShare } },
          { session }
        );

        // Credit co-author
        await User.findByIdAndUpdate(
          coAuthorUserId,
          { $inc: { walletBalance: coAuthorShare } },
          { session }
        );

        // Update primary author transaction
        await Transaction.findOneAndUpdate(
          { reference: `sponsorship:${request._id}` },
          {
            status: 'success',
            amount: primaryShare,
            splitDetails: {
              isSplit: true,
              role: 'primary_author',
              splitRatio: splitRatioStr,
              partnerId: coAuthorUserId
            }
          },
          { session }
        );

        // Create co-author transaction
        await Transaction.create([{
          senderId: request.brandId,
          receiverId: coAuthorUserId,
          videoId: request.videoId,
          amount: coAuthorShare,
          currency: 'ZAR',
          status: 'success',
          type: 'brand_sponsorship',
          reference: `sponsorship:${request._id}:coauthor`,
          splitDetails: {
            isSplit: true,
            role: 'co_author',
            splitRatio: splitRatioStr,
            partnerId: request.creatorId
          }
        }], { session });

        sendFcmNotification(
          request.creatorId,
          'Sponsorship Escrow Released! 🤝',
          `Sponsorship funds of R ${primaryShare.toFixed(2)} (${authorPct}% collab share) released to your wallet!`,
          {
            type: 'escrow_released',
            sponsorshipId: request._id.toString(),
            amount: String(primaryShare)
          }
        ).catch(err => console.error('[FCM Escrow Release Alert Failed]', err));

        sendFcmNotification(
          coAuthorUserId,
          'Collab Sponsorship Escrow Released! 🤝',
          `Co-Author sponsorship funds of R ${coAuthorShare.toFixed(2)} (${coAuthorPct}% collab share) released to your wallet!`,
          {
            type: 'escrow_released',
            sponsorshipId: request._id.toString(),
            amount: String(coAuthorShare)
          }
        ).catch(err => console.error('[FCM Escrow Release CoAuthor Failed]', err));
      } else {
        // 1) Credit Creator wallet
        await User.findByIdAndUpdate(
          request.creatorId,
          { $inc: { walletBalance: payoutAmount } },
          { session }
        );

        // 2) Update Transaction log to success
        await Transaction.findOneAndUpdate(
          { reference: `sponsorship:${request._id}` },
          { status: 'success' },
          { session }
        );

        sendFcmNotification(
          request.creatorId,
          'Sponsorship Escrow Released!',
          `Sponsorship funds of R ${payoutAmount.toFixed(2)} (minus platform fee) have been released to your wallet!`,
          {
            type: 'escrow_released',
            sponsorshipId: request._id.toString(),
            amount: String(payoutAmount)
          }
        ).catch(err => console.error('[FCM Escrow Release Alert Failed]', err));
      }

      // 3) Update request statuses
      request.status = 'completed';
      request.escrowStatus = 'released';
      await request.save({ session });

      processedCount++;
    } catch (err) {
      await session.abortTransaction();
      console.error(`[Escrow Cron] Failed processing request ${request._id}:`, err);
    } finally {
      session.endSession();
    }
  }

  res.status(200).json({
    status: 'success',
    message: `Processed ${processedCount} due escrows.`,
    data: { processedCount }
  });
};

/**
 * GET /api/sponsorships/moderator/disputed
 * Lists disputed/locked sponsorship requests for moderator resolution.
 */
export const getDisputedSponsorships = async (req, res, next) => {
  if (req.user.role !== 'moderator') {
    throw new AppError('Only moderators can access this data.', 403);
  }

  const requests = await SponsorshipRequest.find({
    status: 'disputed'
  })
    .populate('creatorId', 'username email')
    .populate('brandId', 'username email')
    .populate('videoId', 'title videoUrl')
    .sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    results: requests.length,
    data: { requests }
  });
};
