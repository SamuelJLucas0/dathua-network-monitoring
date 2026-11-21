import { Router } from 'express';
import {
  submitCandidates,
  listCandidates,
  approveCandidate,
  rejectCandidate
} from '../controllers/discoveryController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { verifySiteApiKey } from '../middleware/agentAuthMiddleware.js';
import { discoveryLimiter } from '../middleware/rateLimiters.js';

const router = Router();

// El agente reporta candidatos con su Site API Key
router.post('/candidates', discoveryLimiter, verifySiteApiKey, submitCandidates);

// El dueño de la sucursal revisa/aprueba/rechaza con su JWT
router.get('/sites/:siteId/candidates', verifyToken, listCandidates);
router.post('/candidates/:candidateId/approve', verifyToken, approveCandidate);
router.post('/candidates/:candidateId/reject', verifyToken, rejectCandidate);

export default router;
