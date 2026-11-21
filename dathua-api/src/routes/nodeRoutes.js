import { Router } from 'express';
import pool from '../config/mysql.js';
import {
  getNodesBySite,
  getNodeById,
  createNode,
  updateNode,
  deleteNode,
  setNodeMaintenance,
  clearNodeMaintenance,
  getActiveMonitoredNodes
} from '../controllers/nodeController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = Router();

// Middleware híbrido: acepta JWT (web) o Header x-site-key (Agente)
const verifyAuthOrApiKey = async (req, res, next) => {
  const siteKey = req.headers['x-site-key'];

  if (siteKey) {
    try {
      const [sites] = await pool.query(
        'SELECT siteId, orgId, name FROM sites WHERE apiKey = ?',
        [siteKey]
      );

      if (sites.length === 0) {
        return res.status(403).json({ message: 'API Key de sucursal inválida o inexistente' });
      }

      req.site = sites[0];
      req.user = { orgId: sites[0].orgId }; // Para compatibilidad
      return next();
    } catch (error) {
      return res.status(500).json({ message: 'Error validando Site Key', error: error.message });
    }
  }

  // Si no viene siteKey, evalúa el JWT de usuario tradicional
  verifyToken(req, res, next);
};

// 1. Ruta del Worker / Agente (Colocada ANTES del router.use global)
router.get('/worker/active', verifyAuthOrApiKey, getActiveMonitoredNodes);

// 2. Proteger el resto de rutas CRUD exclusivamente con JWT
router.use(verifyToken);

router.get('/site/:siteId', getNodesBySite);
router.get('/:nodeId', getNodeById);
router.post('/', createNode);
router.put('/:nodeId', updateNode);
router.delete('/:nodeId', deleteNode);
router.patch('/:nodeId/maintenance', setNodeMaintenance);
router.delete('/:nodeId/maintenance', clearNodeMaintenance);

export default router;