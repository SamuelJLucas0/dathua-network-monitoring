import { Router } from 'express';
import {
  getIncidents,
  getIncidentById,
  createIncident,
  resolveIncident,
  bulkResolveIncidents,
  deleteIncident,
  bulkDeleteIncidents,
  getIncidentStats
} from '../controllers/incidentController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = Router();

// Protegemos las rutas
router.use(verifyToken);

router.get('/stats/summary', getIncidentStats);
router.get('/', getIncidents);
// Las rutas de lote ('/bulk-resolve', '/bulk') van ANTES de '/:id' — de lo
// contrario Express las matchea como si "bulk-resolve"/"bulk" fueran un id.
router.patch('/bulk-resolve', bulkResolveIncidents);
router.delete('/bulk', bulkDeleteIncidents);
router.get('/:id', getIncidentById);
router.post('/', createIncident);
router.patch('/:id/resolve', resolveIncident);
router.delete('/:id', deleteIncident);

export default router;