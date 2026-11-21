import AIService from '../services/aiService.js';
import AiAnomaly from '../models/AiAnomaly.js';

// POST /api/ai/trigger-analysis
export const triggerAnalysis = async (req, res) => {
  try {
    const { orgId } = req.user;
    const { hoursBack = 24, siteId, nodeId } = req.body;
    // Todo análisis queda acotado a la organización del usuario autenticado,
    // aunque le manden un siteId/nodeId ajeno (que simplemente no matchea nada).
    const filters = { 'metadata.org_id': Number(orgId) };

    if (siteId) filters['metadata.site_id'] = Number(siteId);
    if (nodeId) filters['metadata.node_id'] = Number(nodeId);

    const result = await AIService.runFullAnalysis(hoursBack, filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error ejecutando análisis de IA', error: error.message });
  }
};

// GET /api/ai/anomalies
export const getAnomalies = async (req, res) => {
  try {
    const { orgId } = req.user;
    const { siteId, nodeId, classification, reviewed, minScore, limit = 100 } = req.query;
    const query = { 'metadata.org_id': Number(orgId) };

    if (siteId) query['metadata.site_id'] = Number(siteId);
    if (nodeId) query['metadata.node_id'] = Number(nodeId);
    if (classification) query.classification = classification.toUpperCase();
    if (reviewed !== undefined) query.reviewed = reviewed === 'true';
    // IA Sentinel filtra las de score bajo (ruido normal del motor, no algo
    // que valga la pena revisar) — se manda el mismo umbral aquí y en
    // getAnomalyStats para que las tarjetas de arriba (Total/Por revisar)
    // siempre cuenten exactamente lo mismo que aparece en la lista.
    if (minScore !== undefined) query.anomalyScore = { $gt: Number(minScore) };

    const anomalies = await AiAnomaly.find(query)
      .sort({ timestamp: -1, anomalyScore: -1 })
      .limit(Number(limit));

    res.json(anomalies);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener anomalías', error: error.message });
  }
};

// GET /api/ai/stats
export const getAnomalyStats = async (req, res) => {
  try {
    const { orgId } = req.user;
    const { siteId, minScore } = req.query;
    const orgFilter = { 'metadata.org_id': Number(orgId) };
    // El Resumen ahora puede acotarse a una sola sucursal (ver dashboard.js
    // en el frontend, `homeScopeSiteId`) — sin este filtro, el widget de
    // IA Sentinel del Resumen mostraba el conteo de TODA la organización
    // sin importar qué sucursal estuviera seleccionada.
    if (siteId) orgFilter['metadata.site_id'] = Number(siteId);
    // Mismo umbral que getAnomalies — IA Sentinel lo manda para que
    // "Total"/"Por revisar" cuenten justo lo mismo que se ve en la lista de
    // abajo (antes contaban TODAS las anomalías, incluyendo las de score
    // bajo que la lista ya escondía como ruido — el número decía "5" pero
    // solo se veían 2).
    if (minScore !== undefined) orgFilter.anomalyScore = { $gt: Number(minScore) };

    const [total, reviewed, falsePositives, byClassification] = await Promise.all([
      AiAnomaly.countDocuments(orgFilter),
      AiAnomaly.countDocuments({ ...orgFilter, reviewed: true }),
      AiAnomaly.countDocuments({ ...orgFilter, is_false_positive: true }),
      AiAnomaly.aggregate([
        { $match: orgFilter },
        { $group: { _id: '$classification', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);

    res.json({
      total,
      reviewed,
      falsePositives,
      pendingReview: total - reviewed,
      byClassification
    });
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo estadísticas', error: error.message });
  }
};

// PATCH /api/ai/anomalies/:id/review
export const reviewAnomaly = async (req, res) => {
  try {
    const { orgId } = req.user;
    const { id } = req.params;
    const { is_false_positive = false } = req.body;

    const updated = await AiAnomaly.findOneAndUpdate(
      { _id: id, 'metadata.org_id': Number(orgId) },
      { reviewed: true, is_false_positive },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Anomalía no encontrada o sin acceso' });
    }

    res.json({ message: 'Anomalía actualizada', anomaly: updated });
  } catch (error) {
    res.status(500).json({ message: 'Error actualizando anomalía', error: error.message });
  }
};

// PATCH /api/ai/anomalies/bulk-review
//
// "Marcar todo como revisado" del dashboard — el equivalente a "resolver"
// para anomalías es marcarlas como revisadas. Por default las marca como
// "Es real" (is_false_positive: false), igual que resolver un incidente no
// dice por qué se resolvió — mismos filtros que ya usa el listado
// (nodeId/classification/minScore), acotado siempre a una sucursal.
export const bulkReviewAnomalies = async (req, res) => {
  try {
    const { orgId } = req.user;
    const { siteId, nodeId, classification, minScore, is_false_positive = false } = req.body || {};

    if (!siteId) {
      return res.status(400).json({ message: 'siteId es obligatorio' });
    }

    const query = { 'metadata.org_id': Number(orgId), 'metadata.site_id': Number(siteId), reviewed: false };
    if (nodeId) query['metadata.node_id'] = Number(nodeId);
    if (classification) query.classification = classification.toUpperCase();
    if (minScore !== undefined) query.anomalyScore = { $gt: Number(minScore) };

    const result = await AiAnomaly.updateMany(query, { reviewed: true, is_false_positive: Boolean(is_false_positive) });
    res.json({ message: `${result.modifiedCount} anomalía(s) marcada(s) como revisada(s)`, affected: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: 'Error revisando anomalías en lote', error: error.message });
  }
};

// DELETE /api/ai/anomalies/bulk
//
// "Eliminar todo" del dashboard — borra todas las anomalías que matcheen
// los mismos filtros que el listado (reviewed/classification/minScore),
// acotado siempre a una sucursal (siteId obligatorio).
export const bulkDeleteAnomalies = async (req, res) => {
  try {
    const { orgId } = req.user;
    const { siteId, nodeId, classification, reviewed, minScore } = req.body || {};

    if (!siteId) {
      return res.status(400).json({ message: 'siteId es obligatorio' });
    }

    const query = { 'metadata.org_id': Number(orgId), 'metadata.site_id': Number(siteId) };
    if (nodeId) query['metadata.node_id'] = Number(nodeId);
    if (classification) query.classification = classification.toUpperCase();
    if (reviewed !== undefined) query.reviewed = reviewed === true || reviewed === 'true';
    if (minScore !== undefined) query.anomalyScore = { $gt: Number(minScore) };

    const result = await AiAnomaly.deleteMany(query);
    res.json({ message: `${result.deletedCount} anomalía(s) eliminada(s)`, affected: result.deletedCount });
  } catch (error) {
    res.status(500).json({ message: 'Error eliminando anomalías en lote', error: error.message });
  }
};

// DELETE /api/ai/anomalies/:id
export const deleteAnomaly = async (req, res) => {
  try {
    const { orgId } = req.user;
    const { id } = req.params;

    const deleted = await AiAnomaly.findOneAndDelete({ _id: id, 'metadata.org_id': Number(orgId) });

    if (!deleted) {
      return res.status(404).json({ message: 'Anomalía no encontrada o sin acceso' });
    }

    res.json({ message: 'Anomalía eliminada' });
  } catch (error) {
    res.status(500).json({ message: 'Error eliminando anomalía', error: error.message });
  }
};