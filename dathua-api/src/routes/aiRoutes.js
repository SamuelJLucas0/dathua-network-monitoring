import { Router } from 'express';
import {
  triggerAnalysis,
  getAnomalies,
  getAnomalyStats,
  reviewAnomaly,
  bulkReviewAnomalies,
  deleteAnomaly,
  bulkDeleteAnomalies
} from '../controllers/aiController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = Router();

// Protegemos las rutas con el token JWT de usuario
router.use(verifyToken);

router.post('/trigger-analysis', triggerAnalysis);
router.get('/anomalies', getAnomalies);
router.get('/stats', getAnomalyStats);
// Las rutas de lote ('/anomalies/bulk-review', '/anomalies/bulk') van
// ANTES de '/anomalies/:id/...' — de lo contrario Express matchea
// DELETE /anomalies/bulk como si "bulk" fuera un _id de Mongo.
router.patch('/anomalies/bulk-review', bulkReviewAnomalies);
router.delete('/anomalies/bulk', bulkDeleteAnomalies);
router.patch('/anomalies/:id/review', reviewAnomaly);
router.delete('/anomalies/:id', deleteAnomaly);

export default router;