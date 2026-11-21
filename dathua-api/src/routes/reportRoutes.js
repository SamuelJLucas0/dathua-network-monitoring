import { Router } from 'express';
import { getSiteAuditReport } from '../controllers/reportController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = Router();

router.use(verifyToken);

// GET /api/reports/site/:siteId/audit?from=YYYY-MM-DD&to=YYYY-MM-DD&format=json|csv|pdf
router.get('/site/:siteId/audit', getSiteAuditReport);

export default router;
