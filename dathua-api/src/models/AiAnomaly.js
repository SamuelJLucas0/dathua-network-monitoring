import mongoose from 'mongoose';

const aiAnomalySchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      required: true,
      default: Date.now
    },
    metadata: {
      node_id: { type: Number, required: true },
      org_id: { type: Number, required: true },
      site_id: { type: Number, required: true },
      zone_id: { type: Number, default: null },
      protocol: { type: String, default: 'ICMP' },
      target: { type: String, required: true }
    },
    metricAnalyzed: {
      type: String,
      required: true // Ej: 'avg_ms', 'loss_percent', 'jitter_ms'
    },
    observed_value: {
      type: Number,
      required: true
    },
    expected_Baseline: {
      type: Number,
      default: null
    },
    anomalyScore: {
      type: Number,
      required: true // Score asignado por los detectores (0.0 a 1.0)
    },
    classification: {
      type: String,
      enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'],
      default: 'MEDIUM'
    },
    model_confidence: {
      type: Number,
      default: null
    },
    reviewed: {
      type: Boolean,
      default: false
    },
    is_false_positive: {
      type: Boolean,
      default: false
    },
    source: {
      type: String,
      default: 'dathua-ia'
    },
    version: {
      type: String,
      default: '2.0'
    }
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'ai_anomalies'
  }
);

// Índices para consultas rápidas por severidad, fecha y nodo
aiAnomalySchema.index({ 'metadata.node_id': 1, timestamp: -1 });
aiAnomalySchema.index({ classification: 1, reviewed: 1 });
aiAnomalySchema.index({ timestamp: -1 });

export default mongoose.model('AiAnomaly', aiAnomalySchema, 'ai_anomalies');