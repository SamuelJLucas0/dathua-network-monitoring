import { Router } from 'express';
import { getMe, updateMe, changePassword } from '../controllers/userController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = Router();

router.use(verifyToken);

router.get('/me', getMe);
router.put('/me', updateMe);
router.patch('/me/password', changePassword);

export default router;
