import pool from '../config/mysql.js';
import { emitNewIncident } from '../config/socket.js';
import NotificationService from '../services/notificationService.js';

// GET /api/incidents
export const getIncidents = async (req, res) => {
  try {
    const { orgId } = req.user;
    const { siteId, nodeId, isResolved, severity, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        i.incidentId,
        i.nodeId,
        i.siteId,
        i.severity,
        i.type,
        i.metricAnalyzed,
        i.title,
        i.message,
        i.mongoAnomalyId,
        i.isResolved,
        i.startedAt,
        i.resolvedAt,
        n.name AS nodeName,
        n.ipAddress,
        n.deviceType,
        s.name AS siteName
      FROM incidents i
      LEFT JOIN nodes n ON i.nodeId = n.nodeId
      INNER JOIN sites s ON i.siteId = s.siteId
      WHERE s.orgId = ?
    `;
    const params = [orgId];

    if (siteId) {
      query += ' AND i.siteId = ?';
      params.push(Number(siteId));
    }
    if (nodeId) {
      query += ' AND i.nodeId = ?';
      params.push(Number(nodeId));
    }
    if (isResolved !== undefined) {
      query += ' AND i.isResolved = ?';
      params.push(isResolved === 'true' || isResolved === true ? 1 : 0);
    }
    if (severity) {
      query += ' AND i.severity = ?';
      params.push(severity);
    }

    query += ' ORDER BY i.isResolved ASC, i.startedAt DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo incidentes', error: error.message });
  }
};

// GET /api/incidents/:id
export const getIncidentById = async (req, res) => {
  try {
    const { orgId } = req.user;
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT i.*, n.name AS nodeName, n.ipAddress, s.name AS siteName 
       FROM incidents i
       LEFT JOIN nodes n ON i.nodeId = n.nodeId
       INNER JOIN sites s ON i.siteId = s.siteId
       WHERE i.incidentId = ? AND s.orgId = ?`,
      [id, orgId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Incidente no encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo incidente', error: error.message });
  }
};

const VALID_MANUAL_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

// POST /api/incidents (Creación manual desde el dashboard)
//
// El pipeline de IA (aiService.saveAnomalies) inserta incidentes directo en
// MySQL sin pasar por aquí, así que esta validación no le afecta a él ni a
// las etiquetas libres que use ICMP/IA — solo aplica a la creación manual.
export const createIncident = async (req, res) => {
  try {
    const { orgId } = req.user;
    const { nodeId, siteId, severity, type, title, message, mongoAnomalyId } = req.body || {};

    if (!nodeId || !siteId || !title || !message) {
      return res.status(400).json({ message: 'nodeId, siteId, title y message son obligatorios' });
    }

    if (severity && !VALID_MANUAL_SEVERITIES.includes(severity.toUpperCase())) {
      return res.status(400).json({
        message: `Severidad inválida. Valores aceptados: ${VALID_MANUAL_SEVERITIES.join(', ')}`
      });
    }

    // Validar que la sucursal pertenezca a la organización del usuario
    const [siteCheck] = await pool.query(
      'SELECT siteId FROM sites WHERE siteId = ? AND orgId = ?',
      [siteId, orgId]
    );
    if (siteCheck.length === 0) {
      return res.status(404).json({ message: 'Sucursal no encontrada o sin acceso' });
    }

    // Validar que el equipo pertenezca a esa misma sucursal (antes no se
    // verificaba: un nodeId de otra organización/sucursal se insertaba tal
    // cual, filtrando datos de ese equipo ajeno en cuanto el incidente se
    // listara con su JOIN a nodes).
    const [nodeCheck] = await pool.query(
      'SELECT nodeId FROM nodes WHERE nodeId = ? AND siteId = ?',
      [nodeId, siteId]
    );
    if (nodeCheck.length === 0) {
      return res.status(404).json({ message: 'Equipo no encontrado en esta sucursal' });
    }

    const finalSeverity = severity ? severity.toUpperCase() : 'MEDIUM';
    const finalType = type || 'GENERAL_ALERT';

    const [result] = await pool.query(
      `INSERT INTO incidents (nodeId, siteId, severity, type, title, message, mongoAnomalyId)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        nodeId,
        siteId,
        finalSeverity,
        finalType,
        title,
        message,
        mongoAnomalyId || null
      ]
    );

    // Antes solo los incidentes generados por la IA se emitían en vivo —
    // uno creado a mano desde el dashboard no le llegaba a nadie más que
    // lo tuviera abierto hasta que recargaran.
    emitNewIncident(siteId, {
      incidentId: result.insertId,
      nodeId,
      siteId,
      severity: finalSeverity,
      type: finalType,
      title,
      message,
      mongoAnomalyId: mongoAnomalyId || null,
      isResolved: false,
      startedAt: new Date()
    });

    await NotificationService.notifyIncident({
      incidentId: result.insertId,
      orgId,
      siteId,
      nodeId,
      severity: finalSeverity,
      title,
      message
    });

    res.status(201).json({
      message: 'Incidente registrado con éxito',
      incidentId: result.insertId
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creando incidente', error: error.message });
  }
};

// PATCH /api/incidents/:id/resolve
export const resolveIncident = async (req, res) => {
  try {
    const { orgId } = req.user;
    const { id } = req.params;
    const [result] = await pool.query(
      `UPDATE incidents i
       INNER JOIN sites s ON i.siteId = s.siteId
       SET i.isResolved = TRUE, i.resolvedAt = NOW()
       WHERE i.incidentId = ? AND i.isResolved = FALSE AND s.orgId = ?`,
      [id, orgId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Incidente no encontrado, sin acceso, o ya estaba resuelto' });
    }

    res.json({ message: 'Incidente marcado como resuelto' });
  } catch (error) {
    res.status(500).json({ message: 'Error resolviendo incidente', error: error.message });
  }
};

// PATCH /api/incidents/bulk-resolve
//
// "Marcar todo como resuelto" del dashboard — resuelve de golpe todos los
// incidentes ACTIVOS que matcheen los mismos filtros que ya usa el listado
// (severity/nodeId), acotado siempre a una sucursal (siteId obligatorio,
// nunca a nivel de toda la organización de un jalón). Un incidente ya
// resuelto simplemente no se toca (no hay nada que "re-resolver").
export const bulkResolveIncidents = async (req, res) => {
  try {
    const { orgId } = req.user;
    const { siteId, nodeId, severity } = req.body || {};

    if (!siteId) {
      return res.status(400).json({ message: 'siteId es obligatorio' });
    }

    let query = `
      UPDATE incidents i
      INNER JOIN sites s ON i.siteId = s.siteId
      SET i.isResolved = TRUE, i.resolvedAt = NOW()
      WHERE i.isResolved = FALSE AND s.orgId = ? AND i.siteId = ?
    `;
    const params = [orgId, Number(siteId)];

    if (nodeId) {
      query += ' AND i.nodeId = ?';
      params.push(Number(nodeId));
    }
    if (severity) {
      query += ' AND i.severity = ?';
      params.push(severity);
    }

    const [result] = await pool.query(query, params);
    res.json({ message: `${result.affectedRows} incidente(s) marcado(s) como resuelto(s)`, affected: result.affectedRows });
  } catch (error) {
    res.status(500).json({ message: 'Error resolviendo incidentes en lote', error: error.message });
  }
};

// DELETE /api/incidents/bulk
//
// "Eliminar todo" del dashboard — borra todos los incidentes que matcheen
// los mismos filtros que el listado (isResolved/severity/nodeId), acotado
// siempre a una sucursal (siteId obligatorio). Pensado para operar sobre
// exactamente lo que el usuario ya está viendo filtrado en pantalla, no
// sobre TODO el historial de la organización sin que se dé cuenta.
export const bulkDeleteIncidents = async (req, res) => {
  try {
    const { orgId } = req.user;
    const { siteId, nodeId, isResolved, severity } = req.body || {};

    if (!siteId) {
      return res.status(400).json({ message: 'siteId es obligatorio' });
    }

    let query = `
      DELETE i FROM incidents i
      INNER JOIN sites s ON i.siteId = s.siteId
      WHERE s.orgId = ? AND i.siteId = ?
    `;
    const params = [orgId, Number(siteId)];

    if (nodeId) {
      query += ' AND i.nodeId = ?';
      params.push(Number(nodeId));
    }
    if (isResolved !== undefined) {
      query += ' AND i.isResolved = ?';
      params.push(isResolved === true || isResolved === 'true' ? 1 : 0);
    }
    if (severity) {
      query += ' AND i.severity = ?';
      params.push(severity);
    }

    const [result] = await pool.query(query, params);
    res.json({ message: `${result.affectedRows} incidente(s) eliminado(s)`, affected: result.affectedRows });
  } catch (error) {
    res.status(500).json({ message: 'Error eliminando incidentes en lote', error: error.message });
  }
};

// DELETE /api/incidents/:id
export const deleteIncident = async (req, res) => {
  try {
    const { orgId } = req.user;
    const { id } = req.params;
    const [result] = await pool.query(
      `DELETE i FROM incidents i
       INNER JOIN sites s ON i.siteId = s.siteId
       WHERE i.incidentId = ? AND s.orgId = ?`,
      [id, orgId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Incidente no encontrado o sin acceso' });
    }

    res.json({ message: 'Incidente eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error eliminando incidente', error: error.message });
  }
};

// GET /api/incidents/stats/summary
export const getIncidentStats = async (req, res) => {
  try {
    const { orgId } = req.user;
    const { siteId } = req.query;
    let filter = 'WHERE s.orgId = ?';
    const params = [orgId];

    if (siteId) {
      filter += ' AND i.siteId = ?';
      params.push(Number(siteId));
    }

    const [counts] = await pool.query(
      // COALESCE(SUM(...), 0): SUM() sobre cero filas da NULL en SQL, no 0
      // — sin esto, una sucursal con 0 incidentes mostraba "total: 0" pero
      // "active/resolved/criticalOrHighActive: null" en la misma respuesta,
      // y el frontend renderizaba "—" en vez de "0" para esos tres campos.
      `SELECT
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN i.isResolved = 0 THEN 1 ELSE 0 END), 0) AS active,
        COALESCE(SUM(CASE WHEN i.isResolved = 1 THEN 1 ELSE 0 END), 0) AS resolved,
        COALESCE(SUM(CASE WHEN i.isResolved = 0 AND i.severity IN ('CRITICAL', 'HIGH') THEN 1 ELSE 0 END), 0) AS criticalOrHighActive
       FROM incidents i
       INNER JOIN sites s ON i.siteId = s.siteId
       ${filter}`,
      params
    );

    res.json(counts[0]);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo estadísticas', error: error.message });
  }
};