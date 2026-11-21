// Mapeos centralizados de estado -> color/etiqueta. Vive aparte de los
// componentes para que StatusStackedBar, SeverityBadge y cualquier tabla
// futura de nodos/incidentes lean siempre de la misma fuente.

export const NODE_STATUS = {
  Online: { role: 'good', label: 'En línea' },
  Warning: { role: 'warning', label: 'Advertencia' },
  Offline: { role: 'serious', label: 'Fuera de línea' },
  Critical: { role: 'critical', label: 'Crítico' },
  Unknown: { role: 'neutral', label: 'Sin datos' },
}

// Cubre tanto la severidad manual de incidentes (CRITICAL/HIGH/MEDIUM/LOW/INFO)
// como la clasificación de anomalías de IA (CRITICAL/HIGH/MEDIUM/LOW/UNKNOWN).
export const SEVERITY = {
  CRITICAL: { role: 'critical', label: 'Crítica' },
  HIGH: { role: 'serious', label: 'Alta' },
  MEDIUM: { role: 'warning', label: 'Media' },
  LOW: { role: 'neutral', label: 'Baja' },
  INFO: { role: 'neutral', label: 'Info' },
  UNKNOWN: { role: 'neutral', label: 'Sin clasificar' },
}

export const ROLE_COLOR = {
  good: 'var(--color-status-good)',
  warning: 'var(--color-status-warning)',
  serious: 'var(--color-status-serious)',
  critical: 'var(--color-status-critical)',
  neutral: 'var(--color-status-neutral)',
}
