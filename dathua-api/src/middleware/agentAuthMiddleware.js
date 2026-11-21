// src/middleware/agentAuthMiddleware.js
import pool from '../config/mysql.js';

export const verifySiteApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-site-key'];

  if (!apiKey) {
    return res.status(401).json({ message: 'Header x-site-key requerido' });
  }

  try {
    const [sites] = await pool.query(
      `SELECT siteId, orgId, name, status FROM sites WHERE apiKey = ?`,
      [apiKey]
    );

    if (sites.length === 0) {
      return res.status(403).json({ message: 'API Key inválida o sitio no encontrado' });
    }

    // Inyectamos los datos del sitio directamente en la request
    req.site = sites[0];
    next();
  } catch (error) {
    res.status(500).json({ message: 'Error al validar API Key', error: error.message });
  }
};