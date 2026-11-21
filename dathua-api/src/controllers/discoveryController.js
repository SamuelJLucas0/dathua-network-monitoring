import pool from '../config/mysql.js';
import { classifyDevice } from '../services/deviceClassifier.js';
import { insertNodeRow, validDeviceTypes } from './nodeController.js';
import { emitDiscoveryUpdate } from '../config/socket.js';

// POST /api/discovery/candidates — el AGENTE (Site API Key)
//
// Igual que se corrigió esta sesión en ingestTelemetry: se usa SOLO
// req.site.siteId (la sucursal dueña de la key que se autenticó), nunca
// un siteId que venga en el body — el agente no puede reportar candidatos
// de una sucursal que no es la suya.
export const submitCandidates = async (req, res) => {
  try {
    const { siteId } = req.site;
    const { candidates, sessionStart } = req.body;

    // Vacío es válido: un re-escaneo MANUAL (sessionStart:true) reporta
    // aunque no haya encontrado nada nuevo, para que el dashboard pueda
    // avisar "no se encontraron equipos" en vez de dejar la animación de
    // carga girando para siempre — ver discovery_loop en
    // monitor_service.py de ambos agentes.
    if (!Array.isArray(candidates)) {
      return res.status(400).json({ message: 'Se requiere un arreglo "candidates" (puede venir vacío)' });
    }

    let accepted = 0;
    let rejected = 0;

    for (const c of candidates) {
      if (!c || !c.ip) {
        rejected += 1;
        continue;
      }

      const snmp = c.snmp || null;
      const { suggestedDeviceType, suggestedVendor } = classifyDevice({
        mac: c.mac || null,
        hostname: c.hostname || null,
        openPorts: Array.isArray(c.openPorts) ? c.openPorts : [],
        snmp
      });

      // Un equipo ya revisado (aprobado o rechazado) que el agente sigue
      // viendo en la red no debe "resucitar" solo porque llegó de nuevo en
      // el siguiente ciclo de escaneo (rechazar dejaría de servir de nada
      // si reapareciera cada ~20s) — con dos excepciones, decididas con el
      // usuario:
      //  1) Si estaba 'approved' pero el nodo que se creó a partir de él ya
      //     no existe (se borró — `resolvedNodeId` cae a NULL por el
      //     ON DELETE SET NULL de la FK), no hay nada monitoreándolo, así
      //     que vuelve a 'pending' de inmediato para poder revisarlo otra
      //     vez, sin esperar a que el agente se reinicie.
      //  2) Si estaba 'rejected', solo vuelve a 'pending' cuando el agente
      //     arranca un proceso nuevo (`sessionStart: true`, el propio
      //     agente lo manda una sola vez en el primer envío de cada
      //     corrida) — así "rechazar" sí dura mientras el agente sigue
      //     corriendo sin interrupciones, pero no es permanente para
      //     siempre.
      await pool.query(
        `INSERT INTO discovery_candidates
          (siteId, ipAddress, macAddress, hostname, openPorts, suggestedDeviceType, suggestedVendor,
           snmpReachable, snmpSysDescr, snmpSysObjectId, snmpSysName, lldpNeighbors)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          macAddress = VALUES(macAddress),
          hostname = VALUES(hostname),
          openPorts = VALUES(openPorts),
          suggestedDeviceType = IF(status = 'pending', VALUES(suggestedDeviceType), suggestedDeviceType),
          suggestedVendor = IF(status = 'pending', VALUES(suggestedVendor), suggestedVendor),
          snmpReachable = VALUES(snmpReachable),
          snmpSysDescr = VALUES(snmpSysDescr),
          snmpSysObjectId = VALUES(snmpSysObjectId),
          snmpSysName = VALUES(snmpSysName),
          lldpNeighbors = VALUES(lldpNeighbors),
          status = CASE
            WHEN status = 'approved' AND resolvedNodeId IS NULL THEN 'pending'
            WHEN status = 'rejected' AND ? THEN 'pending'
            ELSE status
          END,
          lastSeenAt = NOW()`,
        [
          siteId,
          c.ip,
          c.mac || null,
          c.hostname || null,
          JSON.stringify(Array.isArray(c.openPorts) ? c.openPorts : []),
          suggestedDeviceType,
          suggestedVendor,
          Boolean(snmp),
          snmp?.sysDescr || null,
          snmp?.sysObjectId || null,
          snmp?.sysName || null,
          snmp ? JSON.stringify(Array.isArray(snmp.lldpNeighbors) ? snmp.lldpNeighbors : []) : null,
          sessionStart ? 1 : 0
        ]
      );
      accepted += 1;
    }

    // El dashboard escucha esto en vivo para refrescar "Equipos
    // descubiertos" sin que el usuario tenga que recargar la página cada
    // vez que el agente encuentra algo nuevo. `sessionStart` también
    // dispara el aviso aunque `accepted` sea 0 — es como el agente
    // confirma "ya escaneé" tras un re-escaneo manual (ver
    // requestSiteRescan en siteController.js), para que el botón sepa
    // cuándo terminó la animación de carga incluso si no encontró nada.
    if (accepted > 0 || sessionStart) {
      const [[{ pendingCount }]] = await pool.query(
        `SELECT COUNT(*) AS pendingCount FROM discovery_candidates WHERE siteId = ? AND status = 'pending'`,
        [siteId]
      );
      emitDiscoveryUpdate(siteId, pendingCount);
    }

    res.status(201).json({
      message: 'Candidatos de descubrimiento procesados',
      acceptedCount: accepted,
      rejectedCount: rejected
    });
  } catch (error) {
    res.status(500).json({ message: 'Error procesando candidatos de descubrimiento', error: error.message });
  }
};

// Cruza los vecinos LLDP de cada candidato (evidencia cruda del agente)
// contra los nodos YA aprobados en la misma sucursal, por MAC — si el
// switch/router que un candidato reporta como vecino ya es un nodo real,
// ese nodo es un padre casi seguro en el árbol de topología. Es una
// SUGERENCIA editable (igual que suggestedDeviceType/suggestedVendor),
// nunca se asigna sola: el dueño la confirma o la cambia al aprobar (ver
// approveCandidate). Un candidato sin LLDP (switch no administrado, la
// mayoría de los casos) simplemente no trae sugerencia — no es un error.
async function attachSuggestedParents(candidates, siteId) {
  const allMacs = new Set();
  for (const c of candidates) {
    for (const n of c.lldpNeighbors || []) {
      if (n?.remoteMac) allMacs.add(n.remoteMac);
    }
  }
  if (allMacs.size === 0) return;

  const [nodes] = await pool.query(
    `SELECT nodeId, name, macAddress FROM nodes WHERE siteId = ? AND macAddress IN (?)`,
    [siteId, [...allMacs]]
  );
  const nodeByMac = new Map(nodes.map((n) => [n.macAddress, n]));

  for (const c of candidates) {
    for (const n of c.lldpNeighbors || []) {
      const match = n?.remoteMac && nodeByMac.get(n.remoteMac);
      if (match) {
        c.suggestedParentNodeId = match.nodeId;
        c.suggestedParentNodeName = match.name;
        break;
      }
    }
  }
}

// GET /api/discovery/sites/:siteId/candidates — el DUEÑO (JWT)
export const listCandidates = async (req, res) => {
  try {
    const { orgId } = req.user;
    const { siteId } = req.params;
    const { status = 'pending' } = req.query;

    const [siteCheck] = await pool.query(
      'SELECT siteId FROM sites WHERE siteId = ? AND orgId = ?',
      [siteId, orgId]
    );
    if (siteCheck.length === 0) {
      return res.status(404).json({ message: 'Sucursal no encontrada o sin acceso' });
    }

    const [rows] = await pool.query(
      `SELECT candidateId, siteId, ipAddress, macAddress, hostname, openPorts,
              suggestedDeviceType, suggestedVendor, status, resolvedNodeId,
              snmpReachable, snmpSysDescr, snmpSysName, lldpNeighbors,
              firstSeenAt, lastSeenAt
       FROM discovery_candidates
       WHERE siteId = ? AND status = ?
       ORDER BY lastSeenAt DESC`,
      [siteId, status]
    );

    const candidates = rows.map((r) => ({ ...r, lldpNeighbors: r.lldpNeighbors || [] }));
    await attachSuggestedParents(candidates, siteId);

    res.json({ candidates });
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo candidatos de descubrimiento', error: error.message });
  }
};

// POST /api/discovery/candidates/:candidateId/approve — el DUEÑO (JWT)
//
// Convierte un candidato en un nodo real. Deliberadamente NO bloquea por
// maxNodesPerSite — igual que createNode, un nodo que excede el límite del
// plan se permite y se cobra aparte (ver plans.js), no se rechaza aquí.
export const approveCandidate = async (req, res) => {
  const { orgId } = req.user;
  const { candidateId } = req.params;
  const { name, deviceType, zoneId, parentNodeId, isRootGateway } = req.body || {};

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT dc.*, s.orgId
       FROM discovery_candidates dc
       JOIN sites s ON dc.siteId = s.siteId
       WHERE dc.candidateId = ? AND s.orgId = ? AND dc.status = 'pending'`,
      [candidateId, orgId]
    );

    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: 'Candidato no encontrado, sin acceso, o ya resuelto' });
    }
    const candidate = rows[0];

    const finalDeviceType = deviceType || candidate.suggestedDeviceType;
    if (!validDeviceTypes.includes(finalDeviceType)) {
      await connection.rollback();
      return res.status(400).json({ message: `deviceType inválido. Valores aceptados: ${validDeviceTypes.join(', ')}` });
    }

    if (zoneId) {
      const [zoneCheck] = await connection.query(
        'SELECT zoneId FROM zones WHERE zoneId = ? AND siteId = ?',
        [zoneId, candidate.siteId]
      );
      if (zoneCheck.length === 0) {
        await connection.rollback();
        return res.status(400).json({ message: 'La zona especificada no existe en esta sucursal' });
      }
    }

    // Un candidato nuevo no puede formar un ciclo (todavía no tiene
    // descendientes) — solo hace falta confirmar que el padre elegido sea
    // de la misma sucursal, igual que createNode.
    if (parentNodeId) {
      const [parentCheck] = await connection.query(
        'SELECT nodeId FROM nodes WHERE nodeId = ? AND siteId = ?',
        [parentNodeId, candidate.siteId]
      );
      if (parentCheck.length === 0) {
        await connection.rollback();
        return res.status(400).json({ message: 'El nodo padre no existe en esta sucursal' });
      }
    }

    const node = await insertNodeRow(connection, {
      siteId: candidate.siteId,
      zoneId: zoneId || null,
      parentNodeId: parentNodeId || null,
      name: name || candidate.hostname || candidate.ipAddress,
      deviceType: finalDeviceType,
      isRootGateway: Boolean(isRootGateway),
      ipAddress: candidate.ipAddress,
      macAddress: candidate.macAddress,
      snmpEnabled: false
    });

    await connection.query(
      `UPDATE discovery_candidates SET status = 'approved', resolvedNodeId = ? WHERE candidateId = ?`,
      [node.nodeId, candidateId]
    );

    await connection.commit();

    res.status(201).json({ message: 'Candidato aprobado; nodo creado', node });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: 'Error aprobando el candidato', error: error.message });
  } finally {
    connection.release();
  }
};

// POST /api/discovery/candidates/:candidateId/reject — el DUEÑO (JWT)
export const rejectCandidate = async (req, res) => {
  try {
    const { orgId } = req.user;
    const { candidateId } = req.params;

    const [result] = await pool.query(
      `UPDATE discovery_candidates dc
       JOIN sites s ON dc.siteId = s.siteId
       SET dc.status = 'rejected'
       WHERE dc.candidateId = ? AND s.orgId = ? AND dc.status = 'pending'`,
      [candidateId, orgId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Candidato no encontrado, sin acceso, o ya resuelto' });
    }

    res.json({ message: 'Candidato rechazado' });
  } catch (error) {
    res.status(500).json({ message: 'Error rechazando el candidato', error: error.message });
  }
};
