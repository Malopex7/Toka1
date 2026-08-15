import express from 'express';
import {
  createSponsorship,
  getBrandPendingSponsorships,
  getCreatorSentSponsorships,
  approveSponsorship,
  rejectSponsorship,
  withdrawSponsorship,
  disputeSponsorship,
  resolveSponsorship,
  processEscrows,
  getDisputedSponsorships
} from '../controllers/sponsorshipController.js';
import { protect, requireBrand, requireModerator } from '../middlewares/auth.js';

const router = express.Router();

// Creator endpoints
router.post('/sponsorships/create', protect, createSponsorship);
router.get('/sponsorships/creator/sent', protect, getCreatorSentSponsorships);
router.post('/sponsorships/:id/withdraw', protect, withdrawSponsorship);

// Brand endpoints
router.get('/sponsorships/brand/pending', protect, requireBrand, getBrandPendingSponsorships);
router.post('/sponsorships/:id/approve', protect, requireBrand, approveSponsorship);
router.post('/sponsorships/:id/reject', protect, requireBrand, rejectSponsorship);
router.post('/sponsorships/:id/dispute', protect, requireBrand, disputeSponsorship);

// Moderator endpoints
router.get('/sponsorships/moderator/disputed', protect, requireModerator, getDisputedSponsorships);
router.post('/sponsorships/:id/resolve', protect, requireModerator, resolveSponsorship);

// Cron trigger (or manual run)
router.post('/sponsorships/process-escrows', protect, processEscrows);

export default router;
