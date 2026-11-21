const METRIC_LABELS = {
  avg_ms: 'Latencia promedio',
  min_ms: 'Latencia mínima',
  max_ms: 'Latencia máxima',
  loss_percent: 'Pérdida de paquetes',
  jitter_ms: 'Estabilidad de la conexión',
  stddev_ms: 'Variabilidad de latencia',
}

export function formatMetricName(key) {
  return METRIC_LABELS[key] || key
}

// `incidents.type`: "AI_CRITICAL"/"AI_HIGH" (generado por el motor de IA)
// o cualquier texto libre que el usuario haya puesto al crear uno manual
// (default "GENERAL_ALERT" si no puso nada) — mostrar el valor crudo se
// veía como jerga interna en la lista de incidentes.
const INCIDENT_TYPE_LABELS = {
  AI_CRITICAL: 'Detectado por IA',
  AI_HIGH: 'Detectado por IA',
  GENERAL_ALERT: 'Registrado manualmente',
}

export function formatIncidentType(type) {
  return INCIDENT_TYPE_LABELS[type] || type
}

const DEVICE_LABELS = {
  router: 'Router',
  switch: 'Switch',
  access_point: 'Punto de acceso',
  camera: 'Cámara',
  server: 'Servidor',
  endpoint: 'Equipo final',
}

export function formatDeviceType(key) {
  return DEVICE_LABELS[key] || key
}
