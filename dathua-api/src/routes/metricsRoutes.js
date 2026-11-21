import { Router } from 'express';
import {
  getSiteMetrics,
  getSiteMetricsTimeseries,
  getOrgMetrics,
  getOrgMetricsTimeseries,
} from '../controllers/metricsController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = Router();

router.use(verifyToken);

// Rutas org-wide antes que '/site/:siteId' para que 'org' no se intente
// interpretar como un siteId.
router.get('/org', getOrgMetrics);
router.get('/org/timeseries', getOrgMetricsTimeseries);
router.get('/site/:siteId', getSiteMetrics);
router.get('/site/:siteId/timeseries', getSiteMetricsTimeseries);

export default router;
