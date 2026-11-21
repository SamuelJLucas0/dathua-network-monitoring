import { Router } from 'express';
import { ingestTelemetry } from '../controllers/telemetryController.js';
import { verifySiteApiKey } from '../middleware/agentAuthMiddleware.js';
import { telemetryLimiter } from '../middleware/rateLimiters.js';

const router = Router();

// Endpoint que consumirá el agente en Python
router.post('/report', telemetryLimiter, verifySiteApiKey, ingestTelemetry);

export default router;