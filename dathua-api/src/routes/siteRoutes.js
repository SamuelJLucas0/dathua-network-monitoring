import { Router } from 'express';
import {
  getSites,
  getSiteById,
  getSiteApiKey,
  createSite,
  updateSite,
  deleteSite,
  setSiteMaintenance,
  clearSiteMaintenance,
  requestSiteRescan
} from '../controllers/siteController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = Router();

// Todas las rutas requieren token válido
router.use(verifyToken);

router.get('/', getSites);
router.get('/:siteId', getSiteById);
router.get('/:siteId/apikey', getSiteApiKey);
router.post('/', createSite);
router.put('/:siteId', updateSite);
router.delete('/:siteId', deleteSite);
router.patch('/:siteId/maintenance', setSiteMaintenance);
router.delete('/:siteId/maintenance', clearSiteMaintenance);
router.post('/:siteId/rescan', requestSiteRescan);

export default router;