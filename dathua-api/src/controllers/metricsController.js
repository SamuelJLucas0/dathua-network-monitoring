import pool from '../config/mysql.js';
import IcmpMetric from '../models/IcmpMetric.js';

const WINDOW_MS = { '15m': 15 * 60 * 1000, '1h': 60 * 60 * 1000, '24h': 24 * 60 * 60 * 1000 };
const BUCKET_MINUTES = { '15m': 1, '1h': 5, '24h': 60 };
const STATUS_ORDER = ['Online', 'Warning', 'Offline', 'Critical', 'Unknown'];

function truncateToBucket(date, bucketMinutes) {
  const ms = bucketMinutes * 60 * 1000;
  return new Date(Math.floor(date.getTime() / ms) * ms);
}

function round1(v) {
  return v === null || v === undefined ? null : Math.round(v * 10) / 10;
}

// Agrega el estado (MySQL, ya en vivo por el agente) y las métricas de
// ventana (Mongo: latencia/pérdida/jitter/uptime) de un grupo de nodos en
// un solo resumen — se reutiliza tanto para una zona como para la
// sucursal completa.
function summarizeGroup(zoneId, zoneName, zoneIcon, nodes) {
  const healthCounts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]));
  let latencySum = 0, latencyCount = 0;
  let lossSum = 0, lossCount = 0;
  let jitterSum = 0, jitterCount = 0;
  let uptimeSum = 0, uptimeCount = 0;

  for (const n of nodes) {
    healthCounts[n.status] = (healthCounts[n.status] || 0) + 1;
    if (n.avgLatencyMs !== null) { latencySum += n.avgLatencyMs; latencyCount += 1; }
    if (n.avgLossPercent !== null) { lossSum += n.avgLossPercent; lossCount += 1; }
    if (n.avgJitterMs !== null) { jitterSum += n.avgJitterMs; jitterCount += 1; }
    if (n.uptimePercent !== null) { uptimeSum += n.uptimePercent; uptimeCount += 1; }
  }

  return {
    zoneId,
    zoneName,
    zoneIcon,
    nodeCount: nodes.length,
    healthCounts,
    avgLatencyMs: latencyCount ? round1(latencySum / latencyCount) : null,
    avgLossPercent: lossCount ? round1(lossSum / lossCount) : null,
    avgJitterMs: jitterCount ? round1(jitterSum / jitterCount) : null,
    uptimePercent: uptimeCount ? round1(uptimeSum / uptimeCount) : null,
    nodes,
  };
}

// GET /api/metrics/site/:siteId?window=15m|1h|24h&zoneId=<opcional>
// Trae, por cada nodo de la sucursal (o de una sola zona si se pasa
// zoneId), el estado en vivo desde MySQL y el agregado de sus métricas
// reales de node_metrics (Mongo) dentro de la ventana pedida. Es el
// primer endpoint que expone datos de Mongo al dashboard — hasta ahora
// esa colección solo se escribía (ingestión del agente), nunca se leía
// de vuelta para la interfaz.
export const getSiteMetrics = async (req, res) => {
  const { orgId } = req.user;
  const { siteId } = req.params;
  const { zoneId, nodeId } = req.query;
  const window = WINDOW_MS[req.query.window] ? req.query.window : '1h';
  const from = new Date(Date.now() - WINDOW_MS[window]);

  try {
    const [siteRows] = await pool.query('SELECT siteId, name FROM sites WHERE siteId = ? AND orgId = ?', [
      siteId,
      orgId,
    ]);
    if (siteRows.length === 0) {
      return res.status(404).json({ message: 'Sucursal no encontrada o sin acceso' });
    }

    let nodeQuery = `
      SELECT n.nodeId, n.name, n.deviceType, n.status, n.lastPingMs, n.lastSeenAt,
             n.zoneId, z.name AS zoneName, z.icon AS zoneIcon
      FROM nodes n
      LEFT JOIN zones z ON n.zoneId = z.zoneId
      WHERE n.siteId = ?`;
    const params = [siteId];
    if (nodeId) {
      nodeQuery += ' AND n.nodeId = ?';
      params.push(nodeId);
    } else if (zoneId) {
      nodeQuery += ' AND n.zoneId = ?';
      params.push(zoneId);
    }
    const [nodeRows] = await pool.query(nodeQuery, params);

    const nodeIds = nodeRows.map((n) => n.nodeId);
    let aggByNode = new Map();
    if (nodeIds.length > 0) {
      const agg = await IcmpMetric.aggregate([
        { $match: { 'metadata.node_id': { $in: nodeIds }, captured_at: { $gte: from } } },
        {
          $group: {
            _id: '$metadata.node_id',
            avgLatencyMs: { $avg: '$avg_ms' },
            minLatencyMs: { $min: '$min_ms' },
            maxLatencyMs: { $max: '$max_ms' },
            avgLossPercent: { $avg: '$loss_percent' },
            avgJitterMs: { $avg: '$jitter_ms' },
            samples: { $sum: 1 },
            upSamples: { $sum: { $cond: [{ $eq: ['$status', 'UP'] }, 1, 0] } },
          },
        },
      ]);
      aggByNode = new Map(agg.map((a) => [a._id, a]));
    }

    const nodesWithMetrics = nodeRows.map((n) => {
      const a = aggByNode.get(n.nodeId);
      return {
        nodeId: n.nodeId,
        name: n.name,
        deviceType: n.deviceType,
        status: n.status,
        lastPingMs: n.lastPingMs,
        lastSeenAt: n.lastSeenAt,
        zoneId: n.zoneId,
        zoneName: n.zoneId ? n.zoneName : null,
        avgLatencyMs: a ? round1(a.avgLatencyMs) : null,
        minLatencyMs: a ? round1(a.minLatencyMs) : null,
        maxLatencyMs: a ? round1(a.maxLatencyMs) : null,
        avgLossPercent: a ? round1(a.avgLossPercent) : null,
        avgJitterMs: a ? round1(a.avgJitterMs) : null,
        samples: a ? a.samples : 0,
        uptimePercent: a && a.samples > 0 ? round1((a.upSamples / a.samples) * 100) : null,
      };
    });

    const groups = new Map();
    for (const n of nodesWithMetrics) {
      const key = n.zoneId ?? 'unzoned';
      if (!groups.has(key)) {
        groups.set(key, { zoneId: n.zoneId, zoneName: n.zoneId ? n.zoneName : 'Sin zona', zoneIcon: null, nodes: [] });
        const src = nodeRows.find((r) => (r.zoneId ?? 'unzoned') === key);
        if (src) groups.get(key).zoneIcon = src.zoneIcon;
      }
      groups.get(key).nodes.push(n);
    }

    const zones = Array.from(groups.values())
      .map((g) => summarizeGroup(g.zoneId, g.zoneName, g.zoneIcon, g.nodes))
      .sort((a, b) => (a.zoneId === null ? 1 : b.zoneId === null ? -1 : a.zoneName.localeCompare(b.zoneName)));

    const overall = summarizeGroup(null, siteRows[0].name, null, nodesWithMetrics);

    res.json({
      window,
      siteId: Number(siteId),
      siteName: siteRows[0].name,
      zoneFilterId: zoneId ? Number(zoneId) : null,
      zones,
      overall,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener métricas', error: error.message });
  }
};

// GET /api/metrics/org?window=15m|1h|24h
// Igual que getSiteMetrics pero agregando TODOS los nodos de TODAS las
// sucursales de la organización en un solo "overall" — usado por el
// Resumen cuando el filtro está en "Todas las sucursales", para no perder
// la tarjeta de "Tendencia general" al ver la organización completa (antes
// solo existía la versión por sucursal, pensada para Métricas en vivo).
export const getOrgMetrics = async (req, res) => {
  const { orgId } = req.user;
  const window = WINDOW_MS[req.query.window] ? req.query.window : '1h';
  const from = new Date(Date.now() - WINDOW_MS[window]);

  try {
    const [orgRows] = await pool.query('SELECT name FROM organizations WHERE orgId = ?', [orgId]);
    if (orgRows.length === 0) {
      return res.status(404).json({ message: 'Organización no encontrada' });
    }

    const [nodeRows] = await pool.query(
      `SELECT n.nodeId, n.status
       FROM nodes n
       INNER JOIN sites s ON n.siteId = s.siteId
       WHERE s.orgId = ?`,
      [orgId],
    );

    const nodeIds = nodeRows.map((n) => n.nodeId);
    let aggByNode = new Map();
    if (nodeIds.length > 0) {
      const agg = await IcmpMetric.aggregate([
        { $match: { 'metadata.node_id': { $in: nodeIds }, captured_at: { $gte: from } } },
        {
          $group: {
            _id: '$metadata.node_id',
            avgLatencyMs: { $avg: '$avg_ms' },
            avgLossPercent: { $avg: '$loss_percent' },
            avgJitterMs: { $avg: '$jitter_ms' },
            samples: { $sum: 1 },
            upSamples: { $sum: { $cond: [{ $eq: ['$status', 'UP'] }, 1, 0] } },
          },
        },
      ]);
      aggByNode = new Map(agg.map((a) => [a._id, a]));
    }

    const nodesWithMetrics = nodeRows.map((n) => {
      const a = aggByNode.get(n.nodeId);
      return {
        status: n.status,
        avgLatencyMs: a ? round1(a.avgLatencyMs) : null,
        avgLossPercent: a ? round1(a.avgLossPercent) : null,
        avgJitterMs: a ? round1(a.avgJitterMs) : null,
        uptimePercent: a && a.samples > 0 ? round1((a.upSamples / a.samples) * 100) : null,
      };
    });

    const overall = summarizeGroup(null, orgRows[0].name, null, nodesWithMetrics);

    res.json({ window, orgId: Number(orgId), organizationName: orgRows[0].name, overall });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener métricas de la organización', error: error.message });
  }
};

// GET /api/metrics/org/timeseries?window=15m|1h|24h
// Serie de tiempo "general" (promedio de TODOS los equipos de TODAS las
// sucursales por bucket) — versión org-wide de getSiteMetricsTimeseries.
// No incluye desglose por nodo (no hace falta para la tarjeta de
// "Tendencia general" del Resumen, que solo grafica el promedio general).
export const getOrgMetricsTimeseries = async (req, res) => {
  const { orgId } = req.user;
  const window = WINDOW_MS[req.query.window] ? req.query.window : '1h';
  const from = new Date(Date.now() - WINDOW_MS[window]);
  const bucketMinutes = BUCKET_MINUTES[window];

  try {
    const [nodeRows] = await pool.query(
      `SELECT n.nodeId
       FROM nodes n
       INNER JOIN sites s ON n.siteId = s.siteId
       WHERE s.orgId = ?`,
      [orgId],
    );
    const nodeIds = nodeRows.map((n) => n.nodeId);

    const bucketTimestamps = [];
    for (
      let t = truncateToBucket(from, bucketMinutes);
      t <= new Date();
      t = new Date(t.getTime() + bucketMinutes * 60 * 1000)
    ) {
      bucketTimestamps.push(t);
    }

    if (nodeIds.length === 0) {
      return res.json({
        window,
        bucketMinutes,
        buckets: bucketTimestamps.map((t) => t.toISOString()),
        general: bucketTimestamps.map((t) => ({ t: t.toISOString(), avgLatencyMs: null, avgLossPercent: null })),
      });
    }

    const generalAgg = await IcmpMetric.aggregate([
      { $match: { 'metadata.node_id': { $in: nodeIds }, captured_at: { $gte: from } } },
      {
        $group: {
          _id: { $dateTrunc: { date: '$captured_at', unit: 'minute', binSize: bucketMinutes } },
          avgLatencyMs: { $avg: '$avg_ms' },
          avgLossPercent: { $avg: '$loss_percent' },
        },
      },
    ]);

    const generalByBucket = new Map(generalAgg.map((g) => [g._id.getTime(), g]));
    const general = bucketTimestamps.map((t) => {
      const g = generalByBucket.get(t.getTime());
      return { t: t.toISOString(), avgLatencyMs: g ? round1(g.avgLatencyMs) : null, avgLossPercent: g ? round1(g.avgLossPercent) : null };
    });

    res.json({ window, bucketMinutes, buckets: bucketTimestamps.map((t) => t.toISOString()), general });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener series de tiempo de la organización', error: error.message });
  }
};

// GET /api/metrics/site/:siteId/timeseries?window=15m|1h|24h&zoneId=<opcional>
// Serie de tiempo en "buckets" (1/5/60 min según la ventana) para graficar:
// una serie "general" (promedio de todos los equipos del alcance en cada
// bucket) y una por equipo. El eje de tiempo se genera completo de
// antemano (from -> ahora) para que un hueco sin telemetría se vea como un
// hueco real y no comprima el eje.
export const getSiteMetricsTimeseries = async (req, res) => {
  const { orgId } = req.user;
  const { siteId } = req.params;
  const { zoneId, nodeId } = req.query;
  const window = WINDOW_MS[req.query.window] ? req.query.window : '1h';
  const from = new Date(Date.now() - WINDOW_MS[window]);
  const bucketMinutes = BUCKET_MINUTES[window];

  try {
    const [siteRows] = await pool.query('SELECT siteId FROM sites WHERE siteId = ? AND orgId = ?', [siteId, orgId]);
    if (siteRows.length === 0) {
      return res.status(404).json({ message: 'Sucursal no encontrada o sin acceso' });
    }

    let nodeQuery = 'SELECT nodeId, name, deviceType FROM nodes WHERE siteId = ?';
    const params = [siteId];
    if (nodeId) {
      nodeQuery += ' AND nodeId = ?';
      params.push(nodeId);
    } else if (zoneId) {
      nodeQuery += ' AND zoneId = ?';
      params.push(zoneId);
    }
    const [nodeRows] = await pool.query(nodeQuery, params);
    const nodeIds = nodeRows.map((n) => n.nodeId);

    const bucketTimestamps = [];
    for (
      let t = truncateToBucket(from, bucketMinutes);
      t <= new Date();
      t = new Date(t.getTime() + bucketMinutes * 60 * 1000)
    ) {
      bucketTimestamps.push(t);
    }

    if (nodeIds.length === 0) {
      return res.json({
        window,
        bucketMinutes,
        buckets: bucketTimestamps.map((t) => t.toISOString()),
        general: bucketTimestamps.map((t) => ({ t: t.toISOString(), avgLatencyMs: null, avgLossPercent: null })),
        nodes: [],
      });
    }

    const match = { 'metadata.node_id': { $in: nodeIds }, captured_at: { $gte: from } };

    const [generalAgg, perNodeAgg] = await Promise.all([
      IcmpMetric.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateTrunc: { date: '$captured_at', unit: 'minute', binSize: bucketMinutes } },
            avgLatencyMs: { $avg: '$avg_ms' },
            avgLossPercent: { $avg: '$loss_percent' },
          },
        },
      ]),
      IcmpMetric.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              bucket: { $dateTrunc: { date: '$captured_at', unit: 'minute', binSize: bucketMinutes } },
              nodeId: '$metadata.node_id',
            },
            avgLatencyMs: { $avg: '$avg_ms' },
            avgLossPercent: { $avg: '$loss_percent' },
          },
        },
      ]),
    ]);

    const generalByBucket = new Map(generalAgg.map((g) => [g._id.getTime(), g]));
    const general = bucketTimestamps.map((t) => {
      const g = generalByBucket.get(t.getTime());
      return { t: t.toISOString(), avgLatencyMs: g ? round1(g.avgLatencyMs) : null, avgLossPercent: g ? round1(g.avgLossPercent) : null };
    });

    const byNode = new Map(nodeRows.map((n) => [n.nodeId, new Map()]));
    for (const row of perNodeAgg) {
      byNode.get(row._id.nodeId)?.set(row._id.bucket.getTime(), row);
    }

    const nodes = nodeRows.map((n) => ({
      nodeId: n.nodeId,
      name: n.name,
      deviceType: n.deviceType,
      series: bucketTimestamps.map((t) => {
        const row = byNode.get(n.nodeId)?.get(t.getTime());
        return { t: t.toISOString(), avgLatencyMs: row ? round1(row.avgLatencyMs) : null, avgLossPercent: row ? round1(row.avgLossPercent) : null };
      }),
    }));

    res.json({ window, bucketMinutes, buckets: bucketTimestamps.map((t) => t.toISOString()), general, nodes });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener series de tiempo', error: error.message });
  }
};
