// Traduce una anomalía técnica (métrica + severidad + valores) a un
// título y mensaje en español simple, sin jerga de redes — el dueño de
// una PyME no sabe qué es "jitter" ni qué significa un "score" de
// anomalía. Esto se guarda tal cual en `incidents.title`/`message` (y de
// ahí alimenta también la notificación de la campanita), así que debe
// tener sentido completo por sí solo, sin depender de que el frontend lo
// complemente.
//
// Copia hermana en el frontend: dathua-front/src/utils/incidentExplanations.js
// — esa versión además agrega causas probables y sugerencias concretas,
// para el bloque expandible de Incidentes/IA Sentinel. Aquí solo se arma
// el título/mensaje corto que ya queda guardado en MySQL.

const round1 = (n) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 10) / 10 : n);

const METRIC_COPY = {
  avg_ms: {
    title: 'Latencia alta detectada',
    message: (obs, base) => {
      const o = round1(obs);
      if (base === null || base === undefined || !Number.isFinite(base) || base <= 0) {
        return `El equipo está tardando ${o} ms en responder — más de lo normal para él.`;
      }
      const b = round1(base);
      const factor = Math.round(o / b);
      const comparison = factor >= 2 ? ` (cerca de ${factor} veces más lento de lo normal)` : '';
      return `El equipo está tardando ${o} ms en responder, cuando lo normal para él es de unos ${b} ms${comparison}.`;
    }
  },
  loss_percent: {
    title: 'Pérdida de datos detectada',
    message: (obs) =>
      `El equipo está perdiendo ${round1(obs)}% de las señales que le mandamos — como si a veces "no llegara la llamada".`
  },
  jitter_ms: {
    title: 'Conexión inestable detectada',
    message: (obs) =>
      `El tiempo de respuesta de este equipo está variando mucho (${round1(obs)} ms de un momento a otro) — típico de videollamadas o transmisiones que se ven entrecortadas.`
  },
  stddev_ms: {
    title: 'Variabilidad inusual en la conexión',
    message: (obs) =>
      `La latencia de este equipo no se mantiene constante — cambia de forma irregular (${round1(obs)} ms de variación), como una conexión que "a veces va bien y a veces mal".`
  }
};

// Solo CRITICAL/HIGH llegan a generar un incidente (ver aiService.js), así
// que son las únicas dos que necesitan nota de urgencia aquí.
const URGENCY_NOTE = {
  CRITICAL: ' Esto es urgente: el equipo podría dejar de responder por completo si no se atiende.',
  HIGH: ' Vale la pena revisarlo pronto, aunque el equipo sigue respondiendo.'
};

/**
 * @param {string} metricAnalyzed - avg_ms | loss_percent | jitter_ms | stddev_ms
 * @param {string} severity - CRITICAL | HIGH (las únicas que crean incidente)
 * @param {number} observedValue
 * @param {number|null} expectedBaseline
 * @returns {{ title: string, message: string }}
 */
export function buildIncidentCopy(metricAnalyzed, severity, observedValue, expectedBaseline) {
  const copy = METRIC_COPY[metricAnalyzed];
  if (!copy) {
    // Métrica que el motor de IA todavía no documenta aquí (versión
    // nueva) — mejor un mensaje genérico honesto que uno técnico
    // incomprensible como antes.
    return {
      title: 'Anomalía detectada',
      message: `Se detectó un comportamiento fuera de lo normal en este equipo (métrica: ${metricAnalyzed}, valor: ${observedValue}).`
    };
  }
  const base = copy.message(observedValue, expectedBaseline);
  const urgency = URGENCY_NOTE[severity] || '';
  return { title: copy.title, message: `${base}${urgency}` };
}
