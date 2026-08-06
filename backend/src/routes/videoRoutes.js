import express from 'express';
import { getFeed } from '../controllers/videoController.js';
import { optionalProtect } from '../middlewares/auth.js';

const router = express.Router();

router.get('/feed', optionalProtect, getFeed);

export default router;
