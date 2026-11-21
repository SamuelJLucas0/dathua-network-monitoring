import mongoose from 'mongoose';

const icmpMetricSchema = new mongoose.Schema(
  {
    captured_at: {
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
    status: {
      type: String,
      enum: ['UP', 'DOWN'],
      required: true
    },
    transmitted: { type: Number, required: true },
    received: { type: Number, required: true },
    loss_percent: { type: Number, required: true },
    min_ms: { type: Number, default: null },
    max_ms: { type: Number, default: null },
    avg_ms: { type: Number, default: null },
    stddev_ms: { type: Number, default: null },
    jitter_ms: { type: Number, default: null },
    rtts_ms: {
      type: [Number],
      default: []
    },
    error: { type: String, default: null }
  },
  {
    versionKey: false,
    collection: 'node_metrics' // <-- Forzar el nombre exacto de la colección
  }
);

icmpMetricSchema.index({ 'metadata.node_id': 1, captured_at: -1 });

// También puedes pasar el nombre de la colección como tercer argumento:
export default mongoose.model('IcmpMetric', icmpMetricSchema, 'node_metrics');