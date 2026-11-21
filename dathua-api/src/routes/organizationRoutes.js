import { Router } from 'express';
import { getUsage } from '../controllers/organizationController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = Router();

router.use(verifyToken);

router.get('/usage', getUsage);

export default router;
