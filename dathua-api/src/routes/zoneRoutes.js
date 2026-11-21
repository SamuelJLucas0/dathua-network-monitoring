import { Router } from 'express';
import {
  getZonesBySite,
  getZoneById,
  createZone,
  updateZone,
  deleteZone
} from '../controllers/zoneController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = Router();

router.use(verifyToken);

router.get('/site/:siteId', getZonesBySite);
router.post('/site/:siteId', createZone);
router.get('/:zoneId', getZoneById);
router.put('/:zoneId', updateZone);
router.delete('/:zoneId', deleteZone);

export default router;