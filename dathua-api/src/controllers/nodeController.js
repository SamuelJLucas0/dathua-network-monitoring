import pool from '../config/mysql.js';

export const validDeviceTypes = ['router', 'switch', 'access_point', 'camera', 'server', 'endpoint'];

// Inserta la fila de `nodes` propiamente dicha. Extraído de createNode para
// que approveCandidate (discoveryController.js) reutilice exactamente el
// mismo camino de escritura — así el conteo de nodos para límites/cobro de
// excedentes (que lee directo de esta tabla) es correcto sin importar si el
// nodo se dio de alta a mano o se aprobó desde un candidato descubierto.
export async function insertNodeRow(connection, {
  siteId, zoneId, parentNodeId, name, deviceType, isRootGateway, ipAddress, macAddress,
  snmpEnabled, snmpVersion, snmpCommunity, snmpPort, snmpSecName, snmpSecLevel,
  snmpAuthProto, snmpAuthPass, snmpPrivProto, snmpPrivPass
}) {
  const isSnmp = Boolean(snmpEnabled);
  const version = isSnmp ? (snmpVersion || 'v2c') : 'v2c';
  const port = isSnmp ? (snmpPort || 161) : 161;
  const community = (isSnmp && version !== 'v3') ? (snmpCommunity || 'public') : null;

  const [result] = await connection.query(
    `INSERT INTO nodes (
      siteId, zoneId, parentNodeId, name, deviceType, isRootGateway,
      ipAddress, macAddress, snmpEnabled, snmpVersion, snmpCommunity,
      snmpPort, snmpSecName, snmpSecLevel, snmpAuthProto, snmpAuthPass,
      snmpPrivProto, snmpPrivPass, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Unknown')`,
    [
      siteId,
      zoneId || null,
      parentNodeId || null,
      name.trim(),
      deviceType,
      Boolean(isRootGateway),
      ipAddress.trim(),
      macAddress ? macAddress.trim() : null,
      isSnmp,
      version,
      community,
      port,
      (isSnmp && version === 'v3') ? snmpSecName : null,
      (isSnmp && version === 'v3') ? (snmpSecLevel || 'noAuthNoPriv') : 'noAuthNoPriv',
      (isSnmp && version === 'v3') ? snmpAuthProto : null,
      (isSnmp && version === 'v3') ? snmpAuthPass : null,
      (isSnmp && version === 'v3') ? snmpPrivProto : null,
      (isSnmp && version === 'v3') ? snmpPrivPass : null
    ]
  );

  return {
    nodeId: result.insertId,
    siteId,
    zoneId: zoneId || null,
    parentNodeId: parentNodeId || null,
    name: name.trim(),
    deviceType,
    isRootGateway: Boolean(isRootGateway),
    ipAddress: ipAddress.trim(),
    macAddress: macAddress ? macAddress.trim() : null,
    snmpEnabled: isSnmp,
    status: 'Unknown'
  };
}

// 1. Obtener nodos de una sucursal con filtros opcionales (por zoneId, status, deviceType)
export const getNodesBySite = async (req, res) => {
  const { orgId } = req.user;
  const { siteId } = req.params;
  const { zoneId, status, deviceType } = req.query;

  try {
    // Validar acceso a la sucursal
    const [siteCheck] = await pool.query(
      'SELECT siteId FROM sites WHERE siteId = ? AND orgId = ?',
      [siteId, orgId]
    );

    if (siteCheck.length === 0) {
      return res.status(404).json({ message: 'Sucursal no encontrada o sin acceso' });
    }

    let query = `
      SELECT n.nodeId, n.siteId, n.zoneId, z.name AS zoneName,
             n.parentNodeId, pn.name AS parentNodeName,
             n.name, n.deviceType, n.isRootGateway, n.ipAddress, n.macAddress,
             n.snmpEnabled, n.snmpVersion, n.snmpCommunity, n.snmpPort,
             n.snmpSecName, n.snmpSecLevel, n.snmpAuthProto, n.snmpPrivProto,
             n.status, n.lastPingMs, n.lastSeenAt, n.maintenanceMode, n.maintenanceUntil, n.createdAt, n.updatedAt
      FROM nodes n
      LEFT JOIN zones z ON n.zoneId = z.zoneId
      LEFT JOIN nodes pn ON n.parentNodeId = pn.nodeId
      WHERE n.siteId = ?
    `;

    const params = [siteId];

    if (zoneId) {
      if (zoneId === 'null') {
        query += ' AND n.zoneId IS NULL';
      } else {
        query += ' AND n.zoneId = ?';
        params.push(zoneId);
      }
    }

    if (status) {
      query += ' AND n.status = ?';
      params.push(status);
    }

    if (deviceType) {
      query += ' AND n.deviceType = ?';
      params.push(deviceType);
    }

    query += ' ORDER BY n.isRootGateway DESC, n.createdAt ASC';

    const [nodes] = await pool.query(query, params);

    res.json({ nodes });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener los nodos', error: error.message });
  }
};

// 2. Obtener un nodo por su ID
export const getNodeById = async (req, res) => {
  const { orgId } = req.user;
  const { nodeId } = req.params;

  try {
    const [nodes] = await pool.query(
      `SELECT n.nodeId, n.siteId, s.name AS siteName, n.zoneId, z.name AS zoneName,
              n.parentNodeId, pn.name AS parentNodeName,
              n.name, n.deviceType, n.isRootGateway, n.ipAddress, n.macAddress,
              n.snmpEnabled, n.snmpVersion, n.snmpCommunity, n.snmpPort,
              n.snmpSecName, n.snmpSecLevel, n.snmpAuthProto, n.snmpPrivProto,
              n.status, n.lastPingMs, n.lastSeenAt, n.maintenanceMode, n.maintenanceUntil, n.createdAt, n.updatedAt
       FROM nodes n
       JOIN sites s ON n.siteId = s.siteId
       LEFT JOIN zones z ON n.zoneId = z.zoneId
       LEFT JOIN nodes pn ON n.parentNodeId = pn.nodeId
       WHERE n.nodeId = ? AND s.orgId = ?`,
      [nodeId, orgId]
    );

    if (nodes.length === 0) {
      return res.status(404).json({ message: 'Nodo no encontrado o sin acceso' });
    }

    res.json({ node: nodes[0] });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener el nodo', error: error.message });
  }
};

// 3. Crear un nuevo nodo
export const createNode = async (req, res) => {
  const { orgId } = req.user;
  const {
    siteId,
    zoneId,
    parentNodeId,
    name,
    deviceType,
    isRootGateway,
    ipAddress,
    macAddress,
    snmpEnabled,
    snmpVersion,
    snmpCommunity,
    snmpPort,
    snmpSecName,
    snmpSecLevel,
    snmpAuthProto,
    snmpAuthPass,
    snmpPrivProto,
    snmpPrivPass
  } = req.body || {};

  // Validaciones básicas
  if (!siteId || !name || !deviceType || !ipAddress) {
    return res.status(400).json({ message: 'Campos requeridos: siteId, name, deviceType, ipAddress' });
  }

  if (!validDeviceTypes.includes(deviceType)) {
    return res.status(400).json({ message: `deviceType inválido. Valores aceptados: ${validDeviceTypes.join(', ')}` });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Validar que la sucursal pertenezca a la organización
    const [siteCheck] = await connection.query(
      'SELECT siteId FROM sites WHERE siteId = ? AND orgId = ?',
      [siteId, orgId]
    );

    if (siteCheck.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Sucursal no encontrada o sin acceso' });
    }

    // 2. Validar zoneId si fue provisto
    if (zoneId) {
      const [zoneCheck] = await connection.query(
        'SELECT zoneId FROM zones WHERE zoneId = ? AND siteId = ?',
        [zoneId, siteId]
      );
      if (zoneCheck.length === 0) {
        await connection.rollback();
        return res.status(400).json({ message: 'La zona especificada no existe en esta sucursal' });
      }
    }

    // 3. Validar parentNodeId si fue provisto
    if (parentNodeId) {
      const [parentCheck] = await connection.query(
        'SELECT nodeId FROM nodes WHERE nodeId = ? AND siteId = ?',
        [parentNodeId, siteId]
      );
      if (parentCheck.length === 0) {
        await connection.rollback();
        return res.status(400).json({ message: 'El nodo padre no existe en esta sucursal' });
      }
    }

    // 4. Insertar el nodo
    const node = await insertNodeRow(connection, {
      siteId, zoneId, parentNodeId, name, deviceType, isRootGateway, ipAddress, macAddress,
      snmpEnabled, snmpVersion, snmpCommunity, snmpPort, snmpSecName, snmpSecLevel,
      snmpAuthProto, snmpAuthPass, snmpPrivProto, snmpPrivPass
    });

    await connection.commit();

    res.status(201).json({ message: 'Nodo creado exitosamente', node });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: 'Error al crear el nodo', error: error.message });
  } finally {
    connection.release();
  }
};

// 4. Actualizar un nodo
export const updateNode = async (req, res) => {
  const { orgId } = req.user;
  const { nodeId } = req.params;
  const {
    zoneId,
    parentNodeId,
    name,
    deviceType,
    isRootGateway,
    ipAddress,
    macAddress,
    snmpEnabled,
    snmpVersion,
    snmpCommunity,
    snmpPort,
    snmpSecName,
    snmpSecLevel,
    snmpAuthProto,
    snmpAuthPass,
    snmpPrivProto,
    snmpPrivPass,
    status
  } = req.body || {};

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Obtener nodo actual y validar pertenencia
    const [currentNode] = await connection.query(
      `SELECT n.nodeId, n.siteId 
       FROM nodes n
       JOIN sites s ON n.siteId = s.siteId
       WHERE n.nodeId = ? AND s.orgId = ?`,
      [nodeId, orgId]
    );

    if (currentNode.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Nodo no encontrado o sin acceso' });
    }

    const { siteId } = currentNode[0];

    // 2. Prevenir ciclos en la jerarquía (A es padre de B, B es padre de A,
    // o cadenas más largas A->B->C->A). Se camina hacia arriba desde el
    // padre propuesto; si en algún punto se llega al propio nodo, es un ciclo.
    if (parentNodeId) {
      let ancestorId = Number(parentNodeId);
      const visited = new Set();
      while (ancestorId !== null && ancestorId !== undefined) {
        if (ancestorId === Number(nodeId)) {
          await connection.rollback();
          return res.status(400).json({ message: 'Esa jerarquía formaría un ciclo entre nodos' });
        }
        if (visited.has(ancestorId)) break;
        visited.add(ancestorId);
        const [[row]] = await connection.query(
          'SELECT parentNodeId FROM nodes WHERE nodeId = ?',
          [ancestorId]
        );
        ancestorId = row ? row.parentNodeId : null;
      }
    }

    // 3. Validar parentNodeId si cambia
    if (parentNodeId) {
      const [parentCheck] = await connection.query(
        'SELECT nodeId FROM nodes WHERE nodeId = ? AND siteId = ?',
        [parentNodeId, siteId]
      );
      if (parentCheck.length === 0) {
        await connection.rollback();
        return res.status(400).json({ message: 'El nodo padre especificado no existe en esta sucursal' });
      }
    }

    // 4. Validar zoneId si cambia
    if (zoneId) {
      const [zoneCheck] = await connection.query(
        'SELECT zoneId FROM zones WHERE zoneId = ? AND siteId = ?',
        [zoneId, siteId]
      );
      if (zoneCheck.length === 0) {
        await connection.rollback();
        return res.status(400).json({ message: 'La zona especificada no existe en esta sucursal' });
      }
    }

    // 5. Construcción dinámica del UPDATE
    await connection.query(
      `UPDATE nodes SET
        zoneId = ?,
        parentNodeId = ?,
        name = COALESCE(?, name),
        deviceType = COALESCE(?, deviceType),
        isRootGateway = COALESCE(?, isRootGateway),
        ipAddress = COALESCE(?, ipAddress),
        macAddress = COALESCE(?, macAddress),
        snmpEnabled = COALESCE(?, snmpEnabled),
        snmpVersion = COALESCE(?, snmpVersion),
        snmpCommunity = ?,
        snmpPort = COALESCE(?, snmpPort),
        snmpSecName = ?,
        snmpSecLevel = COALESCE(?, snmpSecLevel),
        snmpAuthProto = ?,
        snmpAuthPass = COALESCE(?, snmpAuthPass),
        snmpPrivProto = ?,
        snmpPrivPass = COALESCE(?, snmpPrivPass),
        status = COALESCE(?, status)
      WHERE nodeId = ?`,
      [
        zoneId !== undefined ? zoneId : null,
        parentNodeId !== undefined ? parentNodeId : null,
        name ? name.trim() : null,
        deviceType || null,
        isRootGateway !== undefined ? Boolean(isRootGateway) : null,
        ipAddress ? ipAddress.trim() : null,
        macAddress !== undefined ? macAddress : null,
        snmpEnabled !== undefined ? Boolean(snmpEnabled) : null,
        snmpVersion || null,
        snmpCommunity !== undefined ? snmpCommunity : null,
        snmpPort || null,
        snmpSecName !== undefined ? snmpSecName : null,
        snmpSecLevel || null,
        snmpAuthProto !== undefined ? snmpAuthProto : null,
        snmpAuthPass !== undefined ? snmpAuthPass : null,
        snmpPrivProto !== undefined ? snmpPrivProto : null,
        snmpPrivPass !== undefined ? snmpPrivPass : null,
        status || null,
        nodeId
      ]
    );

    await connection.commit();

    res.json({ message: 'Nodo actualizado exitosamente' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: 'Error al actualizar el nodo', error: error.message });
  } finally {
    connection.release();
  }
};

// 5. Eliminar un nodo
export const deleteNode = async (req, res) => {
  const { orgId } = req.user;
  const { nodeId } = req.params;

  try {
    const [result] = await pool.query(
      `DELETE n FROM nodes n
       JOIN sites s ON n.siteId = s.siteId
       WHERE n.nodeId = ? AND s.orgId = ?`,
      [nodeId, orgId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Nodo no encontrado o sin acceso' });
    }

    res.json({ message: 'Nodo eliminado exitosamente. Los nodos hijos actualizaron su parentNodeId a NULL.' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar el nodo', error: error.message });
  }
};

// 6. Silenciar alertas de IA de este equipo (modo mantenimiento)
//
// Solo afecta a `aiService.saveAnomalies` (deja de crear incidentes/
// notificaciones automáticos para este nodo mientras esté activo) — no
// oculta el estado real del equipo en el dashboard ni bloquea que el
// usuario cree un incidente a mano si de verdad lo necesita.
export const setNodeMaintenance = async (req, res) => {
  const { orgId } = req.user;
  const { nodeId } = req.params;
  const { minutes } = req.body || {};

  try {
    const [current] = await pool.query(
      `SELECT n.nodeId FROM nodes n JOIN sites s ON n.siteId = s.siteId WHERE n.nodeId = ? AND s.orgId = ?`,
      [nodeId, orgId]
    );
    if (current.length === 0) {
      return res.status(404).json({ message: 'Nodo no encontrado o sin acceso' });
    }

    if (minutes !== undefined && minutes !== null) {
      const mins = Number(minutes);
      if (!Number.isFinite(mins) || mins <= 0) {
        return res.status(400).json({ message: 'minutes debe ser un número positivo' });
      }
      await pool.query(
        `UPDATE nodes SET maintenanceMode = FALSE, maintenanceUntil = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE nodeId = ?`,
        [mins, nodeId]
      );
    } else {
      // Sin `minutes`: silencio indefinido, "hasta que yo diga".
      await pool.query(
        `UPDATE nodes SET maintenanceMode = TRUE, maintenanceUntil = NULL WHERE nodeId = ?`,
        [nodeId]
      );
    }

    const [[row]] = await pool.query(
      'SELECT maintenanceMode, maintenanceUntil FROM nodes WHERE nodeId = ?',
      [nodeId]
    );
    res.json({
      message: 'Alertas de este equipo silenciadas',
      maintenanceMode: Boolean(row.maintenanceMode),
      maintenanceUntil: row.maintenanceUntil
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al silenciar alertas', error: error.message });
  }
};

// 6.1 Quitar el silencio (vuelve a alertar normalmente)
export const clearNodeMaintenance = async (req, res) => {
  const { orgId } = req.user;
  const { nodeId } = req.params;

  try {
    const [result] = await pool.query(
      `UPDATE nodes n JOIN sites s ON n.siteId = s.siteId
       SET n.maintenanceMode = FALSE, n.maintenanceUntil = NULL
       WHERE n.nodeId = ? AND s.orgId = ?`,
      [nodeId, orgId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Nodo no encontrado o sin acceso' });
    }

    res.json({ message: 'Silencio de alertas desactivado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al quitar el silencio', error: error.message });
  }
};

// 7. Endpoint optimizado para el Worker de Monitoreo
//
// IMPORTANTE: cuando el agente se autentica con la API Key de UNA sucursal
// (req.site viene del middleware verifyAuthOrApiKey), este endpoint DEBE
// regresar únicamente los nodos de ESA sucursal — nunca de toda la
// organización. La versión anterior filtraba solo por orgId, lo que hacía
// que el agente de la Sucursal A recibiera también nodos de la Sucursal B
// y les hiciera ping a IPs de una LAN a la que no pertenece.
//
// Cuando el acceso es vía JWT de usuario (dashboard web, sin req.site), sí
// tiene sentido ver los nodos de toda la organización.
export const getActiveMonitoredNodes = async (req, res) => {
  try {
    let nodes;
    let site = null;

    if (req.site) {
      // --- Autenticado con Site API Key (el Agente) ---
      // rescanRequestedAt: lo llena el botón "Re-escanear" del dashboard
      // (POST /api/sites/:siteId/rescan) — el agente lo compara contra la
      // última marca que ya procesó para adelantar su ciclo de
      // descubrimiento sin esperar a DISCOVERY_INTERVAL.
      const [siteRows] = await pool.query(
        'SELECT siteId, orgId, name, status, rescanRequestedAt FROM sites WHERE siteId = ?',
        [req.site.siteId]
      );

      if (siteRows.length === 0) {
        return res.status(404).json({ message: 'Sucursal no encontrada' });
      }
      site = siteRows[0];

      [nodes] = await pool.query(
        `SELECT n.nodeId, n.siteId, n.zoneId, s.name AS siteName, n.name, n.deviceType,
                n.isRootGateway, n.ipAddress, n.snmpEnabled, n.snmpVersion,
                n.snmpCommunity, n.snmpPort, n.snmpSecName, n.snmpSecLevel,
                n.snmpAuthProto, n.snmpAuthPass, n.snmpPrivProto, n.snmpPrivPass,
                n.status, n.lastPingMs, n.lastSeenAt
         FROM nodes n
         JOIN sites s ON n.siteId = s.siteId
         WHERE n.siteId = ?`,
        [site.siteId]
      );
    } else {
      // --- Autenticado con JWT de usuario (dashboard web) ---
      const { orgId } = req.user;

      [nodes] = await pool.query(
        `SELECT n.nodeId, n.siteId, n.zoneId, s.name AS siteName, n.name, n.deviceType,
                n.isRootGateway, n.ipAddress, n.snmpEnabled, n.snmpVersion,
                n.snmpCommunity, n.snmpPort, n.snmpSecName, n.snmpSecLevel,
                n.snmpAuthProto, n.snmpAuthPass, n.snmpPrivProto, n.snmpPrivPass,
                n.status, n.lastPingMs, n.lastSeenAt
         FROM nodes n
         JOIN sites s ON n.siteId = s.siteId
         WHERE s.orgId = ?`,
        [orgId]
      );
    }

    res.json({ nodes, site });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener nodos para monitoreo', error: error.message });
  }
};