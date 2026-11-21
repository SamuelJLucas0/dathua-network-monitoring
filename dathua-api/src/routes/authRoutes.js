import { Router } from 'express';
import { register, login } from '../controllers/authController.js';
import { loginLimiter, registerLimiter } from '../middleware/rateLimiters.js';

const router = Router();

router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);

export default router;