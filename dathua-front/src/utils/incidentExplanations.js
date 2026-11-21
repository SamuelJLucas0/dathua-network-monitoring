// Traduce una anomalía/incidente técnico (métrica + severidad) a una
// explicación en español simple para IA Sentinel y Centro de Incidentes —
// el dueño de una PyME no tiene por qué saber qué es "jitter" o un
// "score" de anomalía. Copia hermana (más corta, solo título/mensaje) en
// el backend: dathua-api/src/services/incidentCopy.js — esa versión es
// la que ya queda guardada en la base de datos y alimenta la
// notificación de la campanita; esta de aquí agrega causas probables y
// una sugerencia concreta, para el bloque expandible de estas pantallas.

const METRIC_EXPLANATIONS = {
  avg_ms: {
    what: 'El equipo está tardando más de lo normal en responder cada señal que le mandamos.',
    causes: [
      'Demasiados dispositivos usando la misma red al mismo tiempo.',
      'El equipo está lejos del router o con señal WiFi débil.',
      'El proveedor de internet está lento en ese momento.',
    ],
    suggestion:
      'Revisa cuántos dispositivos están conectados a esa red ahora mismo; si es WiFi, acércalo al router o conéctalo por cable. Si sigue igual, puede ser tu proveedor de internet.',
  },
  loss_percent: {
    what: 'Parte de la información que se manda y recibe se está perdiendo en el camino — como si a veces "no llegara la llamada".',
    causes: [
      'Un cable de red flojo o dañado.',
      'Interferencia en la señal WiFi (microondas, otros routers cerca).',
      'El equipo se está apagando o reiniciando de forma intermitente.',
    ],
    suggestion:
      'Revisa que los cables estén bien conectados; si es WiFi, prueba acercar el equipo o cambiar de canal. Si persiste, puede ser un problema de tu proveedor de internet.',
  },
  jitter_ms: {
    what: 'El tiempo de respuesta de este equipo varía mucho de un momento a otro — a veces responde rápido, a veces lento.',
    causes: [
      'La red está saturada por muchos dispositivos a la vez.',
      'Señal WiFi débil o con interferencia.',
      'El internet del proveedor no es estable a esa hora.',
    ],
    suggestion:
      'Es la causa típica de videollamadas o transmisiones que se ven "entrecortadas". Revisa qué más está usando la red en ese momento.',
  },
  stddev_ms: {
    what: 'La latencia de este equipo no se mantiene constante — cambia de forma irregular, como una conexión que "a veces va bien y a veces mal".',
    causes: [
      'Red saturada por otros dispositivos.',
      'Señal WiFi débil o con interferencia.',
      'Fluctuaciones del servicio de tu proveedor de internet.',
    ],
    suggestion: 'Las recomendaciones son las mismas que para una conexión inestable: revisa el uso de la red y la señal WiFi del equipo.',
  },
}

const URGENCY = {
  CRITICAL: 'Es urgente: el equipo podría dejar de responder por completo si no se atiende pronto.',
  HIGH: 'Vale la pena revisarlo pronto, aunque el equipo sigue funcionando por ahora.',
  MEDIUM: 'No es urgente, pero conviene tenerlo en la mira si se repite.',
  LOW: 'Es un aviso menor — normalmente no requiere acción inmediata.',
}

// `metricAnalyzed` puede venir null (incidentes creados a mano, o
// incidentes de IA de antes de que existiera esta columna) — en ese caso
// no hay nada que explicar y el componente que lo consume simplemente no
// muestra el bloque.
export function getExplanation(metricAnalyzed, severity) {
  const info = METRIC_EXPLANATIONS[metricAnalyzed]
  if (!info) return null
  return {
    ...info,
    urgency: URGENCY[severity?.toUpperCase()] || null,
  }
}
