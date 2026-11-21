import pool from '../config/mysql.js';

const VALID_ZONE_ICONS = ['building', 'floor', 'warehouse', 'office', 'outdoor', 'server_room'];

// 1. Obtener todas las zonas de una sucursal específica
export const getZonesBySite = async (req, res) => {
  const { orgId } = req.user;
  const { siteId } = req.params;

  try {
    const [siteCheck] = await pool.query(
      'SELECT siteId FROM sites WHERE siteId = ? AND orgId = ?',
      [siteId, orgId]
    );

    if (siteCheck.length === 0) {
      return res.status(404).json({ message: 'Sucursal no encontrada o sin acceso' });
    }

    const [zones] = await pool.query(
      `SELECT z.zoneId, z.siteId, z.name, z.description, z.icon, z.createdAt, z.updatedAt,
              COUNT(n.nodeId) AS totalNodes
       FROM zones z
       LEFT JOIN nodes n ON z.zoneId = n.zoneId
       WHERE z.siteId = ?
       GROUP BY z.zoneId
       ORDER BY z.createdAt ASC`,
      [siteId]
    );

    res.json({ zones });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener las zonas', error: error.message });
  }
};

// 2. Obtener una zona específica por su ID
export const getZoneById = async (req, res) => {
  const { orgId } = req.user;
  const { zoneId } = req.params;

  try {
    const [zones] = await pool.query(
      `SELECT z.zoneId, z.siteId, z.name, z.description, z.icon, z.createdAt, z.updatedAt
       FROM zones z
       JOIN sites s ON z.siteId = s.siteId
       WHERE z.zoneId = ? AND s.orgId = ?`,
      [zoneId, orgId]
    );

    if (zones.length === 0) {
      return res.status(404).json({ message: 'Zona no encontrada o sin acceso' });
    }

    res.json({ zone: zones[0] });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener la zona', error: error.message });
  }
};

// 3. Crear una nueva zona con validación de límite (maxFreeZones)
export const createZone = async (req, res) => {
  const { orgId } = req.user;
  const { siteId } = req.params;
  const { name, description, icon } = req.body || {};

  if (!name || name.trim() === '') {
    return res.status(400).json({ message: 'El nombre de la zona es obligatorio' });
  }

  if (icon && !VALID_ZONE_ICONS.includes(icon)) {
    return res.status(400).json({ message: `icon inválido. Valores aceptados: ${VALID_ZONE_ICONS.join(', ')}` });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // FOR UPDATE bloquea la fila de la organización hasta el commit, para
    // que dos altas de zona concurrentes no lean el mismo conteo y ambas
    // pasen la validación, excediendo maxFreeZones.
    const [orgData] = await connection.query(
      `SELECT o.maxFreeZones, s.siteId
       FROM sites s
       JOIN organizations o ON s.orgId = o.orgId
       WHERE s.siteId = ? AND s.orgId = ?
       FOR UPDATE`,
      [siteId, orgId]
    );

    if (orgData.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Sucursal no encontrada o sin acceso' });
    }

    const { maxFreeZones } = orgData[0];

    const [zoneCount] = await connection.query(
      `SELECT COUNT(z.zoneId) AS totalZones
       FROM zones z
       JOIN sites s ON z.siteId = s.siteId
       WHERE s.orgId = ?`,
      [orgId]
    );

    if (zoneCount[0].totalZones >= maxFreeZones) {
      await connection.rollback();
      return res.status(403).json({
        message: `Has alcanzado el límite máximo de ${maxFreeZones} zonas permitidas en tu plan.`
      });
    }

    const [result] = await connection.query(
      'INSERT INTO zones (siteId, name, description, icon) VALUES (?, ?, ?, ?)',
      [siteId, name.trim(), description || null, icon || 'building']
    );

    await connection.commit();

    res.status(201).json({
      message: 'Zona creada exitosamente',
      zone: {
        zoneId: result.insertId,
        siteId: Number(siteId),
        name: name.trim(),
        description: description || null,
        icon: icon || 'building'
      }
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: 'Error al crear la zona', error: error.message });
  } finally {
    connection.release();
  }
};

// 4. Actualizar una zona
export const updateZone = async (req, res) => {
  const { orgId } = req.user;
  const { zoneId } = req.params;
  const { name, description, icon } = req.body || {};

  if (!name || name.trim() === '') {
    return res.status(400).json({ message: 'El nombre de la zona es obligatorio' });
  }

  if (icon && !VALID_ZONE_ICONS.includes(icon)) {
    return res.status(400).json({ message: `icon inválido. Valores aceptados: ${VALID_ZONE_ICONS.join(', ')}` });
  }

  try {
    const [result] = await pool.query(
      `UPDATE zones z
       JOIN sites s ON z.siteId = s.siteId
       SET z.name = ?, z.description = ?, z.icon = COALESCE(?, z.icon)
       WHERE z.zoneId = ? AND s.orgId = ?`,
      [name.trim(), description !== undefined ? description : null, icon || null, zoneId, orgId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Zona no encontrada o sin cambios' });
    }

    res.json({ message: 'Zona actualizada exitosamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar la zona', error: error.message });
  }
};

// 5. Eliminar una zona (con opción de eliminar o conservar nodos asociados)
export const deleteZone = async (req, res) => {
  const { orgId } = req.user;
  const { zoneId } = req.params;
  const { deleteNodes } = req.query; // 'true' o 'false'

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [zoneCheck] = await connection.query(
      `SELECT z.zoneId 
       FROM zones z
       JOIN sites s ON z.siteId = s.siteId
       WHERE z.zoneId = ? AND s.orgId = ?`,
      [zoneId, orgId]
    );

    if (zoneCheck.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Zona no encontrada o sin acceso' });
    }

    // Si el usuario solicitó eliminar los nodos de la zona explícitamente
    if (deleteNodes === 'true') {
      await connection.query('DELETE FROM nodes WHERE zoneId = ?', [zoneId]);
    }

    // Borrado de la zona (si deleteNodes !== 'true', MySQL ejecuta ON DELETE SET NULL en los nodos)
    await connection.query('DELETE FROM zones WHERE zoneId = ?', [zoneId]);

    await connection.commit();

    res.json({
      message: deleteNodes === 'true'
        ? 'Zona y todos sus nodos asociados eliminados exitosamente'
        : 'Zona eliminada exitosamente. Los nodos se conservaron en la sucursal (zoneId = NULL).'
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: 'Error al eliminar la zona', error: error.message });
  } finally {
    connection.release();
  }
};