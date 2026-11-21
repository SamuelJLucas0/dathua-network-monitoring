import axios from 'axios';
import pool from '../config/mysql.js';
import IcmpMetric from '../models/IcmpMetric.js';
import AiAnomaly from '../models/AiAnomaly.js';
import { emitNewIncident, emitNewAnomaly } from '../config/socket.js'; // <-- Importar
import NotificationService from './notificationService.js';
import { buildIncidentCopy } from './incidentCopy.js';
import 'dotenv/config';

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:5000';

class AIService {
  static async fetchMetricsForAnalysis(hoursBack = 24, filters = {}, limit = 2000) {
    const timeLimit = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    const query = {
      captured_at: { $gte: timeLimit },
      ...filters
    };

    // Se pide descendente (más reciente primero) para poder quedarnos con
    // las últimas `limit` si hay más métricas que eso en la ventana — pero
    // el motor de IA (EWMA/CUSUM en dathua-ia) asume que el arreglo que
    // recibe viene en orden cronológico normal, punto por punto hacia
    // adelante en el tiempo. Sin este reverse(), le llegaba invertido y los
    // detectores terminaban "viendo" el tiempo al revés — un salto real de
    // latencia sostenido dejaba de detectarse por completo.
    const metrics = await IcmpMetric.find(query)
      .sort({ captured_at: -1 })
      .limit(limit)
      .lean();

    return metrics.reverse();
  }

  static async sendToPythonEngine(metrics) {
    if (!metrics || metrics.length === 0) {
      return {
        anomalies: [],
        summary: { total_anomalies: 0 },
        filtered_metrics: { total_ignored: 0, details: [] }
      };
    }

    try {
      const response = await axios.post(
        `${PYTHON_API_URL}/api/analyze`,
        { metrics },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000
        }
      );
      return response.data;
    } catch (error) {
      console.error('❌ Error comunicando con la API de IA en Python:', error.message);
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`No se pudo conectar al servicio de IA en ${PYTHON_API_URL}.`);
      }
      throw error;
    }
  }

  // ¿Este equipo (o toda su sucursal) está en modo mantenimiento ahora
  // mismo? `maintenanceMode` = silencio indefinido; `maintenanceUntil` =
  // silencio por tiempo limitado, se apaga solo en cuanto pasa esa fecha.
  static async isNodeInMaintenance(nodeId) {
    const [[row]] = await pool.query(
      `SELECT n.maintenanceMode AS nodeMode, n.maintenanceUntil AS nodeUntil,
              s.maintenanceMode AS siteMode, s.maintenanceUntil AS siteUntil
       FROM nodes n
       JOIN sites s ON n.siteId = s.siteId
       WHERE n.nodeId = ?`,
      [nodeId]
    );
    if (!row) return false;

    const now = Date.now();
    const nodeSilenced = Boolean(row.nodeMode) || (row.nodeUntil && new Date(row.nodeUntil).getTime() > now);
    const siteSilenced = Boolean(row.siteMode) || (row.siteUntil && new Date(row.siteUntil).getTime() > now);
    return Boolean(nodeSilenced || siteSilenced);
  }

  static async saveAnomalies(anomalies) {
    if (!anomalies || anomalies.length === 0) return { inserted: 0 };

    const docs = anomalies.map(a => ({
      timestamp: a.timestamp ? new Date(a.timestamp) : new Date(),
      metadata: {
        node_id: Number(a.metadata?.node_id),
        org_id: Number(a.metadata?.org_id || 1),
        site_id: Number(a.metadata?.site_id || 1),
        zone_id: a.metadata?.zone_id ? Number(a.metadata?.zone_id) : null,
        protocol: a.metadata?.protocol || 'ICMP',
        target: a.metadata?.target || ''
      },
      metricAnalyzed: a.metricAnalyzed || 'avg_ms',
      observed_value: Number(a.observed_value),
      // Number(null) da 0, no null — sin este chequeo extra, una alerta de
      // percentiles (que no trae 'ewma') guardaba un baseline de "0" en vez
      // de "sin dato", engañoso en la UI (parece que lo normal era 0ms).
      expected_Baseline: (a.expected_Baseline !== undefined && a.expected_Baseline !== null)
        ? Number(a.expected_Baseline)
        : null,
      anomalyScore: Number(a.anomalyScore),
      classification: (a.classification || 'MEDIUM').toUpperCase(),
      model_confidence: a.model_confidence ? Number(a.model_confidence) : null,
      reviewed: false,
      is_false_positive: false,
      source: 'dathua-ia',
      version: '2.0'
    }));

    const result = await AiAnomaly.insertMany(docs, { ordered: false });

    for (const anom of result) {
      emitNewAnomaly(anom.metadata.site_id, anom);

      if (['CRITICAL', 'HIGH'].includes(anom.classification)) {
        try {
          // Modo mantenimiento: el equipo (o toda su sucursal) está
          // silenciado a propósito — la anomalía se queda en el historial
          // de Mongo para consultarla después, pero no genera incidente ni
          // notificación mientras dure el silencio.
          if (await AIService.isNodeInMaintenance(anom.metadata.node_id)) {
            continue;
          }

          const incidentType = `AI_${anom.classification}`;
          const [existing] = await pool.query(
            `SELECT incidentId FROM incidents
             WHERE nodeId = ? AND type = ? AND isResolved = FALSE`,
            [anom.metadata.node_id, incidentType]
          );

          if (existing.length === 0) {
            // Título/mensaje en español simple, sin jerga de redes ni
            // "score" — el dueño de una PyME no sabe qué es un jitter ni
            // un score de anomalía. Ver incidentCopy.js (misma lógica
            // duplicada en el frontend para agregar causas/sugerencia).
            const { title, message } = buildIncidentCopy(
              anom.metricAnalyzed,
              anom.classification,
              anom.observed_value,
              anom.expected_Baseline
            );

            const incidentPayload = {
              nodeId: anom.metadata.node_id,
              siteId: anom.metadata.site_id,
              severity: anom.classification,
              type: incidentType,
              metricAnalyzed: anom.metricAnalyzed,
              title,
              message,
              mongoAnomalyId: anom._id.toString()
            };

            const [dbRes] = await pool.query(
              `INSERT INTO incidents (nodeId, siteId, severity, type, metricAnalyzed, title, message, mongoAnomalyId)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                incidentPayload.nodeId,
                incidentPayload.siteId,
                incidentPayload.severity,
                incidentPayload.type,
                incidentPayload.metricAnalyzed,
                incidentPayload.title,
                incidentPayload.message,
                incidentPayload.mongoAnomalyId
              ]
            );

            // 📡 EMISIÓN WEBSOCKET DE NUEVO INCIDENTE
            emitNewIncident(anom.metadata.site_id, {
              incidentId: dbRes.insertId,
              ...incidentPayload,
              startedAt: new Date()
            });

            await NotificationService.notifyIncident({
              incidentId: dbRes.insertId,
              orgId: anom.metadata.org_id,
              siteId: anom.metadata.site_id,
              nodeId: anom.metadata.node_id,
              severity: incidentPayload.severity,
              title: incidentPayload.title,
              message: incidentPayload.message
            });
          }
        } catch (dbErr) {
          console.error('⚠️ No se pudo registrar incidente en MySQL:', dbErr.message);
        }
      }
    }

    return { inserted: result.length };
  }

  static async runFullAnalysis(hoursBack = 24, filters = {}) {
    console.log(`\n🤖 [AI Engine] Iniciando escaneo de métricas (últimas ${hoursBack}h)...`);
    
    const metrics = await this.fetchMetricsForAnalysis(hoursBack, filters);
    console.log(`   📊 ${metrics.length} métricas recopiladas.`);

    if (metrics.length === 0) {
      return {
        message: 'No hay métricas suficientes en la ventana de tiempo para analizar',
        total_metrics: 0,
        anomalies_detected: 0
      };
    }

    const analysisResult = await this.sendToPythonEngine(metrics);
    const anomalies = analysisResult.anomalies || [];
    console.log(`   ⚡ Anomalías detectadas por IA: ${anomalies.length}`);

    let savedResult = { inserted: 0 };
    if (anomalies.length > 0) {
      savedResult = await this.saveAnomalies(anomalies);
      console.log(`   💾 ${savedResult.inserted} anomalías guardadas en 'ai_anomalies'`);
    }

    return {
      total_metrics_evaluated: metrics.length,
      summary: analysisResult.summary || {},
      anomalies,
      saved: savedResult,
      filtered_metrics: analysisResult.filtered_metrics || {}
    };
  }
}

export default AIService;