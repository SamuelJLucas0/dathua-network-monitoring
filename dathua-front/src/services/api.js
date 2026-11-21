export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

async function request(path, options = {}) {
  let res
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    })
  } catch {
    throw new Error('No se pudo conectar con el servidor. Intenta de nuevo en unos momentos.')
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data.message || 'Ocurrió un error inesperado.')
  }

  return data
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` }
}

function toQueryString(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (entries.length === 0) return ''
  return `?${new URLSearchParams(entries).toString()}`
}

// ---------- Auth (público) ----------

export function login(email, password) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function register(orgName, userName, email, password) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ orgName, userName, email, password }),
  })
}

// ---------- Dashboard (requiere JWT) ----------

export function getUsage(token) {
  return request('/organizations/usage', { headers: authHeaders(token) })
}

export async function getSites(token) {
  const data = await request('/sites', { headers: authHeaders(token) })
  return data.sites
}

export async function createSite(token, payload) {
  const data = await request('/sites', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return data.site
}

export async function getSiteApiKey(token, siteId) {
  const data = await request(`/sites/${siteId}/apikey`, { headers: authHeaders(token) })
  return data.apiKey
}

export function updateSite(token, siteId, payload) {
  return request(`/sites/${siteId}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
}

export function deleteSite(token, siteId) {
  return request(`/sites/${siteId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
}

// minutes: número de minutos a silenciar, o null/omitido para "hasta que
// yo lo quite" (indefinido). Silencia las alertas de TODOS los equipos de
// la sucursal.
export function setSiteMaintenance(token, siteId, minutes) {
  return request(`/sites/${siteId}/maintenance`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ minutes: minutes || null }),
  })
}

export function clearSiteMaintenance(token, siteId) {
  return request(`/sites/${siteId}/maintenance`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
}

// Botón "Re-escanear" (Nodos y topología) — no le habla al agente
// directo, solo deja una marca que el agente recoge en su próxima
// consulta (máximo unos segundos, ver discoveryController y
// monitor_service.py de los agentes).
export function requestSiteRescan(token, siteId) {
  return request(`/sites/${siteId}/rescan`, {
    method: 'POST',
    headers: authHeaders(token),
  })
}

export async function createNode(token, payload) {
  const data = await request('/nodes', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return data.node
}

export async function getDiscoveryCandidates(token, siteId, status = 'pending') {
  const data = await request(`/discovery/sites/${siteId}/candidates${toQueryString({ status })}`, {
    headers: authHeaders(token),
  })
  return data.candidates
}

export async function approveCandidate(token, candidateId, payload = {}) {
  const data = await request(`/discovery/candidates/${candidateId}/approve`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return data.node
}

export function rejectCandidate(token, candidateId) {
  return request(`/discovery/candidates/${candidateId}/reject`, {
    method: 'POST',
    headers: authHeaders(token),
  })
}

export async function getNodesBySite(token, siteId) {
  const data = await request(`/nodes/site/${siteId}`, { headers: authHeaders(token) })
  return data.nodes
}

export function updateNode(token, nodeId, payload) {
  return request(`/nodes/${nodeId}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
}

export function deleteNode(token, nodeId) {
  return request(`/nodes/${nodeId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
}

// minutes: número de minutos a silenciar, o null/omitido para "hasta que
// yo lo quite" (indefinido).
export function setNodeMaintenance(token, nodeId, minutes) {
  return request(`/nodes/${nodeId}/maintenance`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ minutes: minutes || null }),
  })
}

export function clearNodeMaintenance(token, nodeId) {
  return request(`/nodes/${nodeId}/maintenance`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
}

export async function getZonesBySite(token, siteId) {
  const data = await request(`/zones/site/${siteId}`, { headers: authHeaders(token) })
  return data.zones
}

export async function createZone(token, siteId, payload) {
  const data = await request(`/zones/site/${siteId}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  return data.zone
}

export function updateZone(token, zoneId, payload) {
  return request(`/zones/${zoneId}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
}

export function deleteZone(token, zoneId, deleteNodes = false) {
  return request(`/zones/${zoneId}${toQueryString({ deleteNodes: deleteNodes ? 'true' : undefined })}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
}

export function getSiteMetrics(token, siteId, { window = '1h', zoneId, nodeId } = {}) {
  return request(`/metrics/site/${siteId}${toQueryString({ window, zoneId, nodeId })}`, {
    headers: authHeaders(token),
  })
}

export function getSiteMetricsTimeseries(token, siteId, { window = '1h', zoneId, nodeId } = {}) {
  return request(`/metrics/site/${siteId}/timeseries${toQueryString({ window, zoneId, nodeId })}`, {
    headers: authHeaders(token),
  })
}

// Versión org-wide: promedio de TODOS los equipos de TODAS las sucursales
// de la organización — usada por "Tendencia general" del Resumen cuando el
// filtro está en "Todas las sucursales".
export function getOrgMetrics(token, { window = '1h' } = {}) {
  return request(`/metrics/org${toQueryString({ window })}`, { headers: authHeaders(token) })
}

export function getOrgMetricsTimeseries(token, { window = '1h' } = {}) {
  return request(`/metrics/org/timeseries${toQueryString({ window })}`, { headers: authHeaders(token) })
}

export async function getNodeById(token, nodeId) {
  const data = await request(`/nodes/${nodeId}`, { headers: authHeaders(token) })
  return data.node
}

export function getIncidentStats(token, params) {
  return request(`/incidents/stats/summary${toQueryString(params)}`, { headers: authHeaders(token) })
}

export function getIncidents(token, params) {
  return request(`/incidents${toQueryString(params)}`, { headers: authHeaders(token) })
}

export function getIncidentById(token, incidentId) {
  return request(`/incidents/${incidentId}`, { headers: authHeaders(token) })
}

export function createIncident(token, payload) {
  return request('/incidents', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
}

export function resolveIncident(token, incidentId) {
  return request(`/incidents/${incidentId}/resolve`, {
    method: 'PATCH',
    headers: authHeaders(token),
  })
}

export function deleteIncident(token, incidentId) {
  return request(`/incidents/${incidentId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
}

// "Marcar todo como resuelto" / "Eliminar todo" — `filters` es el mismo
// objeto de filtros que ya usa getIncidents (siteId es obligatorio en el
// backend, el resto son opcionales: nodeId, severity, isResolved).
export function bulkResolveIncidents(token, filters) {
  return request('/incidents/bulk-resolve', {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(filters),
  })
}

export function bulkDeleteIncidents(token, filters) {
  return request('/incidents/bulk', {
    method: 'DELETE',
    headers: authHeaders(token),
    body: JSON.stringify(filters),
  })
}

export function getAnomalyStats(token, params) {
  return request(`/ai/stats${toQueryString(params)}`, { headers: authHeaders(token) })
}

export function getAnomalies(token, params) {
  return request(`/ai/anomalies${toQueryString(params)}`, { headers: authHeaders(token) })
}

export function reviewAnomaly(token, anomalyId, payload) {
  return request(`/ai/anomalies/${anomalyId}/review`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
}

export function deleteAnomaly(token, anomalyId) {
  return request(`/ai/anomalies/${anomalyId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
}

// "Marcar todo como revisado" / "Eliminar todo" — `filters` es el mismo
// objeto de filtros que ya usa getAnomalies (siteId es obligatorio en el
// backend, el resto son opcionales: nodeId, classification, minScore,
// reviewed solo aplica a bulkDeleteAnomalies).
export function bulkReviewAnomalies(token, filters) {
  return request('/ai/anomalies/bulk-review', {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(filters),
  })
}

export function bulkDeleteAnomalies(token, filters) {
  return request('/ai/anomalies/bulk', {
    method: 'DELETE',
    headers: authHeaders(token),
    body: JSON.stringify(filters),
  })
}

export function triggerAiAnalysis(token, payload) {
  return request('/ai/trigger-analysis', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
}

// ---------- Reportes ----------

export function getSiteAuditReport(token, siteId, params) {
  return request(`/reports/site/${siteId}/audit${toQueryString({ ...params, format: 'json' })}`, {
    headers: authHeaders(token),
  })
}

// PDF/CSV son descargas (Content-Disposition: attachment) — no pasan por el
// helper `request()` porque la respuesta no es JSON, sino un blob binario
// que se convierte en un enlace temporal para que el navegador lo baje.
export async function downloadSiteAuditReport(token, siteId, params) {
  const url = `${API_BASE_URL}/reports/site/${siteId}/audit${toQueryString(params)}`
  let res
  try {
    res = await fetch(url, { headers: authHeaders(token) })
  } catch {
    throw new Error('No se pudo conectar con el servidor. Intenta de nuevo en unos momentos.')
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.message || 'No se pudo generar el reporte.')
  }
  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="([^"]+)"/)
  const filename = match ? match[1] : `reporte.${params.format}`

  const blobUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(blobUrl)
}

// ---------- Notificaciones ----------

export function getNotifications(token, params) {
  return request(`/notifications${toQueryString(params)}`, { headers: authHeaders(token) })
}

export function getUnreadNotificationCount(token) {
  return request('/notifications/unread-count', { headers: authHeaders(token) })
}

export function markNotificationRead(token, notificationId) {
  return request(`/notifications/${notificationId}/read`, {
    method: 'PATCH',
    headers: authHeaders(token),
  })
}

export function markAllNotificationsRead(token) {
  return request('/notifications/read-all', {
    method: 'PATCH',
    headers: authHeaders(token),
  })
}

export function deleteNotification(token, notificationId) {
  return request(`/notifications/${notificationId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
}

export function deleteAllNotifications(token, params) {
  return request(`/notifications${toQueryString(params)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
}

export function getNotificationPreferences(token) {
  return request('/notifications/preferences', { headers: authHeaders(token) })
}

export function updateNotificationPreferences(token, payload) {
  return request('/notifications/preferences', {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
}

// ---------- Cuenta / perfil ----------

export function getMe(token) {
  return request('/users/me', { headers: authHeaders(token) })
}

export function updateMe(token, payload) {
  return request('/users/me', {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
}

export function changePassword(token, payload) {
  return request('/users/me/password', {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
}
