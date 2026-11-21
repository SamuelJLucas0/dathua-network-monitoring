import crypto from 'crypto';
import pool from '../config/mysql.js';
import { getPlanLimits } from '../config/plans.js';

// 1. Obtener todas las sucursales de la organización del usuario
export const getSites = async (req, res) => {
  const { orgId } = req.user;

  try {
    const [sites] = await pool.query(
      `SELECT s.siteId, s.orgId, s.name, s.address, s.timezone, s.status, s.description,
              s.maintenanceMode, s.maintenanceUntil, s.createdAt, s.updatedAt,
              COUNT(DISTINCT z.zoneId) AS totalZones,
              COUNT(DISTINCT n.nodeId) AS totalNodes,
              MAX(n.lastSeenAt) AS lastTelemetryAt
       FROM sites s
       LEFT JOIN zones z ON s.siteId = z.siteId
       LEFT JOIN nodes n ON s.siteId = n.siteId
       WHERE s.orgId = ?
       GROUP BY s.siteId
       ORDER BY s.createdAt DESC`,
      [orgId]
    );

    res.json({ sites });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener las sucursales', error: error.message });
  }
};

// 2. Obtener una sucursal específica por ID
export const getSiteById = async (req, res) => {
  const { orgId } = req.user;
  const { siteId } = req.params;

  try {
    const [sites] = await pool.query(
      `SELECT siteId, orgId, name, address, timezone, status, description,
              maintenanceMode, maintenanceUntil, createdAt, updatedAt,
              (SELECT MAX(lastSeenAt) FROM nodes WHERE siteId = sites.siteId) AS lastTelemetryAt
       FROM sites
       WHERE siteId = ? AND orgId = ?`,
      [siteId, orgId]
    );

    if (sites.length === 0) {
      return res.status(404).json({ message: 'Sucursal no encontrada' });
    }

    res.json({ site: sites[0] });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener la sucursal', error: error.message });
  }
};

// 2.1 Obtener la Site API Key de una sucursal (endpoint aparte, no va en
// getSiteById/getSites, para que el frontend solo la pida al usuario dar
// clic explícito en el "ojito" — no se manda de encimada en cada listado).
export const getSiteApiKey = async (req, res) => {
  const { orgId } = req.user;
  const { siteId } = req.params;

  try {
    const [sites] = await pool.query(
      'SELECT apiKey FROM sites WHERE siteId = ? AND orgId = ?',
      [siteId, orgId]
    );

    if (sites.length === 0) {
      return res.status(404).json({ message: 'Sucursal no encontrada' });
    }

    res.json({ apiKey: sites[0].apiKey });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener la Site API Key', error: error.message });
  }
};

// 3. Crear una nueva sucursal
export const createSite = async (req, res) => {
  const { orgId } = req.user;
  const { name, address, timezone, description } = req.body || {};

  if (!name) {
    return res.status(400).json({ message: 'El nombre del sitio es obligatorio' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Validar el límite de sucursales del plan contratado antes de crear.
    // A diferencia de los nodos (que sí se pueden pasar del límite con un
    // cargo extra), las sucursales son un tope estructural del plan.
    //
    // FOR UPDATE bloquea la fila de la organización hasta el commit, para
    // que dos altas de sucursal concurrentes no lean el mismo conteo y
    // ambas pasen la validación, excediendo el tope del plan.
    const [orgRows] = await connection.query(
      'SELECT plan FROM organizations WHERE orgId = ? FOR UPDATE',
      [orgId]
    );
    if (orgRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Organización no encontrada' });
    }
    const limits = getPlanLimits(orgRows[0].plan);

    const [[{ totalSites }]] = await connection.query(
      'SELECT COUNT(*) AS totalSites FROM sites WHERE orgId = ?',
      [orgId]
    );

    if (totalSites >= limits.maxSites) {
      await connection.rollback();
      return res.status(403).json({
        message: `Tu plan ${limits.label} permite hasta ${limits.maxSites} sucursal(es). Actualiza tu plan para agregar más.`,
        code: 'SITE_LIMIT_REACHED'
      });
    }

    // Genera un token aleatorio seguro: dth_site_a1b2c3d4...
    const apiKey = `dth_site_${crypto.randomBytes(24).toString('hex')}`;

    const [result] = await connection.query(
      `INSERT INTO sites (orgId, name, address, timezone, description, apiKey)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [orgId, name, address || null, timezone || 'America/Mexico_City', description || null, apiKey]
    );

    await connection.commit();

    res.status(201).json({
      message: 'Sitio creado exitosamente',
      site: {
        siteId: result.insertId,
        orgId,
        name,
        address,
        timezone: timezone || 'America/Mexico_City',
        description,
        apiKey
      }
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: 'Error al crear el sitio', error: error.message });
  } finally {
    connection.release();
  }
};

// 4. Actualizar una sucursal existente
export const updateSite = async (req, res) => {
  const { orgId } = req.user;
  const { siteId } = req.params;
  const { name, address, timezone, status, description } = req.body || {};

  if (!name || name.trim() === '') {
    return res.status(400).json({ message: 'El nombre de la sucursal es obligatorio' });
  }

  // Validar ENUM de status si viene en la petición
  const validStatuses = ['Normal', 'Warning', 'Critical', 'Offline'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ message: `Estado no válido. Opciones: ${validStatuses.join(', ')}` });
  }

  try {
    const [result] = await pool.query(
      `UPDATE sites
       SET name = ?,
           address = ?,
           timezone = COALESCE(?, timezone),
           status = COALESCE(?, status),
           description = ?
       WHERE siteId = ? AND orgId = ?`,
      [
        name.trim(),
        address !== undefined ? address : null,
        timezone || null,
        status || null,
        description !== undefined ? description : null,
        siteId,
        orgId
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Sucursal no encontrada o sin cambios' });
    }

    res.json({ message: 'Sucursal actualizada exitosamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar la sucursal', error: error.message });
  }
};

// 4.1 Silenciar alertas de IA de TODOS los equipos de esta sucursal
export const setSiteMaintenance = async (req, res) => {
  const { orgId } = req.user;
  const { siteId } = req.params;
  const { minutes } = req.body || {};

  try {
    const [site] = await pool.query('SELECT siteId FROM sites WHERE siteId = ? AND orgId = ?', [siteId, orgId]);
    if (site.length === 0) {
      return res.status(404).json({ message: 'Sucursal no encontrada' });
    }

    if (minutes !== undefined && minutes !== null) {
      const mins = Number(minutes);
      if (!Number.isFinite(mins) || mins <= 0) {
        return res.status(400).json({ message: 'minutes debe ser un número positivo' });
      }
      await pool.query(
        'UPDATE sites SET maintenanceMode = FALSE, maintenanceUntil = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE siteId = ?',
        [mins, siteId]
      );
    } else {
      await pool.query('UPDATE sites SET maintenanceMode = TRUE, maintenanceUntil = NULL WHERE siteId = ?', [siteId]);
    }

    const [[row]] = await pool.query('SELECT maintenanceMode, maintenanceUntil FROM sites WHERE siteId = ?', [siteId]);
    res.json({
      message: 'Alertas de la sucursal silenciadas',
      maintenanceMode: Boolean(row.maintenanceMode),
      maintenanceUntil: row.maintenanceUntil
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al silenciar alertas', error: error.message });
  }
};

// 4.2 Quitar el silencio de la sucursal
export const clearSiteMaintenance = async (req, res) => {
  const { orgId } = req.user;
  const { siteId } = req.params;

  try {
    const [result] = await pool.query(
      'UPDATE sites SET maintenanceMode = FALSE, maintenanceUntil = NULL WHERE siteId = ? AND orgId = ?',
      [siteId, orgId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Sucursal no encontrada' });
    }

    res.json({ message: 'Silencio de alertas desactivado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al quitar el silencio', error: error.message });
  }
};

// 4.3 "Re-escanear" — botón de Nodos y topología. No le habla al agente
// directo (no hay ningún canal push hacia la LAN del cliente); solo deja
// una marca de tiempo que el agente recoge la próxima vez que consulta
// GET /nodes/worker/active (cada POLL_INTERVAL, 20s) y usa para adelantar
// su ciclo de descubrimiento — ver discovery_loop en monitor_service.py
// de ambos agentes.
export const requestSiteRescan = async (req, res) => {
  const { orgId } = req.user;
  const { siteId } = req.params;

  try {
    const [result] = await pool.query(
      'UPDATE sites SET rescanRequestedAt = NOW() WHERE siteId = ? AND orgId = ?',
      [siteId, orgId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Sucursal no encontrada' });
    }

    res.json({ message: 'Re-escaneo solicitado; el agente lo recogerá en unos segundos.' });
  } catch (error) {
    res.status(500).json({ message: 'Error solicitando el re-escaneo', error: error.message });
  }
};

// 5. Eliminar una sucursal (por ON DELETE CASCADE borrará zones y nodes asociados)
export const deleteSite = async (req, res) => {
  const { orgId } = req.user;
  const { siteId } = req.params;

  try {
    const [result] = await pool.query(
      'DELETE FROM sites WHERE siteId = ? AND orgId = ?',
      [siteId, orgId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Sucursal no encontrada' });
    }

    res.json({ message: 'Sucursal y sus dependencias eliminadas exitosamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar la sucursal', error: error.message });
  }
};