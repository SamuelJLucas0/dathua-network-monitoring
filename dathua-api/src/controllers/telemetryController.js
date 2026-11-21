import IcmpMetric from '../models/IcmpMetric.js';
import pool from '../config/mysql.js';
import { emitTelemetryUpdate } from '../config/socket.js'; // <-- Importar

export const ingestTelemetry = async (req, res) => {
  const { metrics } = req.body;

  if (!metrics) {
    return res.status(400).json({ message: 'No se recibieron métricas' });
  }

  const payloadArray = Array.isArray(metrics) ? metrics : [metrics];

  if (payloadArray.length === 0) {
    return res.status(200).json({ message: 'Lote vacío, nada que procesar' });
  }

  try {
    const { siteId, orgId } = req.site;

    // El agente solo puede reportar métricas de nodos que pertenecen a SU
    // propia sucursal. Sin esta validación, una Site API Key válida podía
    // reportar (y así sobrescribir el estado de) un nodeId de otra
    // sucursal u organización con solo mandarlo en el payload.
    const [ownedNodes] = await pool.query(
      'SELECT nodeId FROM nodes WHERE siteId = ?',
      [siteId]
    );
    const validNodeIds = new Set(ownedNodes.map((n) => n.nodeId));

    const acceptedPayload = payloadArray.filter((m) =>
      validNodeIds.has(Number(m.metadata?.node_id))
    );
    const rejectedCount = payloadArray.length - acceptedPayload.length;

    if (acceptedPayload.length === 0) {
      return res.status(403).json({
        message: 'Ninguno de los nodeId reportados pertenece a esta sucursal'
      });
    }

    const docsToInsert = acceptedPayload.map((m) => ({
      captured_at: m.captured_at ? new Date(m.captured_at) : new Date(),
      metadata: {
        node_id: Number(m.metadata.node_id),
        org_id: Number(orgId),
        site_id: Number(siteId),
        zone_id: m.metadata.zone_id ? Number(m.metadata.zone_id) : null,
        protocol: m.metadata.protocol || 'ICMP',
        target: m.metadata.target
      },
      status: m.status,
      transmitted: Number(m.transmitted),
      received: Number(m.received),
      loss_percent: Number(m.loss_percent),
      min_ms: m.min_ms !== null ? Number(m.min_ms) : null,
      max_ms: m.max_ms !== null ? Number(m.max_ms) : null,
      avg_ms: m.avg_ms !== null ? Number(m.avg_ms) : null,
      stddev_ms: m.stddev_ms !== null ? Number(m.stddev_ms) : null,
      jitter_ms: m.jitter_ms !== null ? Number(m.jitter_ms) : null,
      rtts_ms: Array.isArray(m.rtts_ms) ? m.rtts_ms.map(Number) : [],
      error: m.error || null
    }));

    // Inserción en MongoDB
    await IcmpMetric.insertMany(docsToInsert, { ordered: false });

    // Sincronización en MySQL
    const updatePromises = acceptedPayload.map((m) => {
      const nodeStatus = m.status === 'UP' ? 'Online' : 'Offline';
      return pool.query(
        `UPDATE nodes 
         SET status = ?, lastPingMs = ?, lastSeenAt = NOW() 
         WHERE nodeId = ?`,
        [nodeStatus, m.avg_ms, m.metadata.node_id]
      );
    });

    await Promise.all(updatePromises);

    // 📡 EMISIÓN WEBSOCKET EN TIEMPO REAL
    emitTelemetryUpdate(siteId, docsToInsert);

    res.status(201).json({
      message: 'Telemetría guardada y transmitida en tiempo real',
      insertedCount: docsToInsert.length,
      rejectedCount
    });
  } catch (error) {
    console.error('❌ Error guardando telemetría:', error);
    res.status(500).json({ message: 'Error procesando telemetría', error: error.message });
  }
};