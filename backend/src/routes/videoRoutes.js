import express from 'express';
import { getFeed, processAiVetting } from '../controllers/videoController.js';
import { optionalProtect } from '../middlewares/auth.js';

const router = express.Router();

router.get('/feed', optionalProtect, getFeed);
router.post('/webhooks/ai-vetting', processAiVetting);

export default router;
