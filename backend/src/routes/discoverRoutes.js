import express from 'express';
import {
  getDiscoverHub,
  getDiscoverVideos,
  getDiscoverCreators,
} from '../controllers/discoverController.js';
import { optionalProtect } from '../middlewares/auth.js';

const router = express.Router();

router.get('/discover/hub', optionalProtect, getDiscoverHub);
router.get('/discover/videos', optionalProtect, getDiscoverVideos);
router.get('/discover/creators', optionalProtect, getDiscoverCreators);

export default router;
