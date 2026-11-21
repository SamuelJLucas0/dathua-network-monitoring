import { defineStore } from 'pinia'
import * as api from '../services/api'
import { ANOMALY_MIN_SCORE } from '../utils/anomalies'

const STATUS_ORDER = ['Online', 'Warning', 'Offline', 'Critical', 'Unknown']

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    loading: false,
    loaded: false,
    error: '',
    usage: null,
    sites: [],
    nodesBySite: {},
    // Incidentes/anomalías del Resumen — acotados por `homeScopeSiteId`
    // (null = toda la organización). Antes SIEMPRE se pedían sin filtro de
    // sucursal, así que el widget de "Incidentes activos" del Resumen
    // mostraba los de TODA la organización aunque la sucursal activa fuera
    // otra — quedaba desincronizado con el resto de la página y con
    // cualquier filtro que el usuario pensara que ya había aplicado.
    incidentStats: null,
    incidents: [],
    aiStats: null,
    anomalies: [],
    // null = "Todas las sucursales" (vista general del Resumen). Es un
    // filtro LOCAL del Resumen, independiente de `activeSiteId` (que sigue
    // siendo la sucursal que usan Métricas/Nodos/Incidentes/IA
    // Sentinel/Reportes) — cambiar uno no cambia el otro a propósito.
    homeScopeSiteId: null,
    // Conteos SIEMPRE de toda la organización, sin importar el filtro del
    // Resumen ni la sucursal activa — alimentan el puntito de "hay algo
    // nuevo" en Incidentes/IA Sentinel del menú lateral.
    orgIncidentActiveCount: 0,
    orgAnomalyPendingCount: 0,
    activeSiteId: null,
    candidatesBySite: {},
    candidatesLoading: false,
    zonesBySite: {},
    zonesLoading: false,
    // Contadores que las vistas observan (`watch`) para volver a pedir sus
    // datos cuando llega un evento en vivo por Socket.IO — más simple y
    // robusto que tratar de insertar el dato nuevo a mano en cada gráfica.
    telemetryTick: 0,
    incidentTick: 0,
    anomalyTick: 0,
    discoveryTick: 0,
    // Cuántos candidatos quedaron 'pending' justo después del último
    // evento `discovery:new` — lo manda el backend en el mismo evento (ver
    // emitDiscoveryUpdate en socket.js). El botón "Re-escanear" de Nodos y
    // topología lo usa para saber si el escaneo encontró algo nuevo o no,
    // sin tener que adivinar comparando longitudes de arreglo a mano.
    lastDiscoveryPendingCount: null,
  }),

  getters: {
    activeSite: (state) => state.sites.find((s) => s.siteId === state.activeSiteId) || null,

    allNodes: (state) => Object.values(state.nodesBySite).flat(),

    totalNodes() {
      return this.allNodes.length
    },

    activeSiteCandidates(state) {
      return state.candidatesBySite[state.activeSiteId] || []
    },

    activeSiteZones(state) {
      return state.zonesBySite[state.activeSiteId] || []
    },

    activeSiteNodes(state) {
      return state.nodesBySite[state.activeSiteId] || []
    },

    // Siempre las 5 llaves en el mismo orden, incluso en 0 — así el
    // componente de la barra apilada no tiene que preocuparse por huecos.
    statusCounts() {
      const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]))
      for (const node of this.allNodes) {
        counts[node.status] = (counts[node.status] || 0) + 1
      }
      return counts
    },
  },

  actions: {
    async fetchAll(token) {
      this.loading = true
      this.error = ''
      try {
        const [usage, sites, incidentStats, incidents, aiStats, anomalies] = await Promise.all([
          api.getUsage(token),
          api.getSites(token),
          api.getIncidentStats(token),
          api.getIncidents(token, { isResolved: false, limit: 5 }),
          api.getAnomalyStats(token, { minScore: ANOMALY_MIN_SCORE }),
          api.getAnomalies(token, { limit: 5, minScore: ANOMALY_MIN_SCORE }),
        ])

        this.usage = usage
        this.sites = sites
        this.incidentStats = incidentStats
        this.incidents = incidents
        this.aiStats = aiStats
        this.anomalies = anomalies
        // homeScopeSiteId todavía es null aquí (recién se crea el store),
        // así que esta primera carga ya es org-wide — sirve también como
        // conteo inicial del puntito del menú lateral.
        this.orgIncidentActiveCount = Number(incidentStats?.active || 0)
        this.orgAnomalyPendingCount = Number(aiStats?.pendingReview || 0)
        this.activeSiteId = sites[0]?.siteId ?? null

        const [nodeLists, candidateLists, zoneLists] = await Promise.all([
          Promise.all(sites.map((s) => api.getNodesBySite(token, s.siteId).catch(() => []))),
          Promise.all(sites.map((s) => api.getDiscoveryCandidates(token, s.siteId).catch(() => []))),
          Promise.all(sites.map((s) => api.getZonesBySite(token, s.siteId).catch(() => []))),
        ])
        this.nodesBySite = Object.fromEntries(sites.map((s, i) => [s.siteId, nodeLists[i]]))
        this.candidatesBySite = Object.fromEntries(sites.map((s, i) => [s.siteId, candidateLists[i]]))
        this.zonesBySite = Object.fromEntries(sites.map((s, i) => [s.siteId, zoneLists[i]]))

        this.loaded = true
      } catch (e) {
        this.error = e.message
      } finally {
        this.loading = false
      }
    },

    setActiveSite(siteId) {
      this.activeSiteId = siteId
    },

    // Cambia el filtro LOCAL del Resumen (null = todas las sucursales) y
    // vuelve a pedir los widgets que dependen de él. A propósito no toca
    // `activeSiteId` — el selector de sucursal del Resumen es independiente
    // del que usan Métricas/Nodos/Incidentes/IA Sentinel.
    async setHomeScope(token, siteId) {
      this.homeScopeSiteId = siteId
      await Promise.all([this.refreshIncidentSummary(token), this.refreshAiSummary(token)])
    },

    // Refresca el widget de "Incidentes activos" del Resumen (acotado al
    // filtro local `homeScopeSiteId`) — se llama tras crear/resolver un
    // incidente desde la página dedicada, al cambiar el filtro del
    // Resumen, y cuando llega un incidente nuevo por Socket.IO. De paso
    // refresca el conteo ORG-WIDE que usa el puntito del menú lateral,
    // sin importar qué filtro tenga el Resumen en ese momento.
    async refreshIncidentSummary(token) {
      const siteId = this.homeScopeSiteId || undefined
      const [stats, incidents, orgStats] = await Promise.all([
        api.getIncidentStats(token, siteId ? { siteId } : undefined),
        api.getIncidents(token, { isResolved: false, limit: 5, ...(siteId ? { siteId } : {}) }),
        siteId ? api.getIncidentStats(token) : Promise.resolve(null),
      ])
      this.incidentStats = stats
      this.incidents = incidents
      this.orgIncidentActiveCount = Number((orgStats || stats)?.active || 0)
    },

    // Mismo propósito que refreshIncidentSummary pero para el widget de IA
    // Sentinel del Resumen — se llama cuando llega una anomalía nueva por
    // Socket.IO.
    async refreshAiSummary(token) {
      const siteId = this.homeScopeSiteId || undefined
      const [stats, anomalies, orgStats] = await Promise.all([
        api.getAnomalyStats(token, { minScore: ANOMALY_MIN_SCORE, ...(siteId ? { siteId } : {}) }),
        api.getAnomalies(token, { limit: 5, minScore: ANOMALY_MIN_SCORE, ...(siteId ? { siteId } : {}) }),
        siteId ? api.getAnomalyStats(token, { minScore: ANOMALY_MIN_SCORE }) : Promise.resolve(null),
      ])
      this.aiStats = stats
      this.anomalies = anomalies
      this.orgAnomalyPendingCount = Number((orgStats || stats)?.pendingReview || 0)
    },

    // Aplica en vivo lo que el agente ya actualizó en MySQL cuando reportó
    // esta telemetría (ver telemetryController.ingestTelemetry) — así el
    // árbol de equipos y el punto de color de la sucursal en la barra
    // lateral no esperan a un refresh manual para reflejar el estado real.
    applyTelemetryUpdate(docs) {
      if (!Array.isArray(docs) || docs.length === 0) return
      const siteId = docs[0]?.metadata?.site_id
      const list = siteId != null ? this.nodesBySite[siteId] : null
      if (list) {
        for (const doc of docs) {
          const node = list.find((n) => n.nodeId === doc.metadata?.node_id)
          if (node) {
            node.status = doc.status === 'UP' ? 'Online' : 'Offline'
            node.lastPingMs = doc.avg_ms
            node.lastSeenAt = doc.captured_at
          }
        }
      }
      // El agente sigue vivo — refleja el "visto por última vez" de la
      // sucursal al instante, para que el banner de "agente sin reportar"
      // desaparezca sin esperar un refetch completo.
      const site = siteId != null ? this.sites.find((s) => s.siteId === siteId) : null
      if (site) site.lastTelemetryAt = new Date().toISOString()

      this.telemetryTick++
    },

    bumpIncidentTick() {
      this.incidentTick++
    },

    bumpAnomalyTick() {
      this.anomalyTick++
    },

    bumpDiscoveryTick(pendingCount = null) {
      this.discoveryTick++
      this.lastDiscoveryPendingCount = pendingCount
    },

    async createSite(token, payload) {
      const site = await api.createSite(token, payload)
      this.sites = [{ ...site, totalNodes: 0, totalZones: 0 }, ...this.sites]
      this.nodesBySite[site.siteId] = []
      this.candidatesBySite[site.siteId] = []
      this.activeSiteId = site.siteId
      return site
    },

    async updateSite(token, siteId, payload) {
      await api.updateSite(token, siteId, payload)
      const site = this.sites.find((s) => s.siteId === siteId)
      if (site) Object.assign(site, payload)
    },

    async deleteSite(token, siteId) {
      await api.deleteSite(token, siteId)
      this.sites = this.sites.filter((s) => s.siteId !== siteId)
      delete this.nodesBySite[siteId]
      delete this.candidatesBySite[siteId]
      if (this.activeSiteId === siteId) {
        this.activeSiteId = this.sites[0]?.siteId ?? null
      }
      // El filtro local del Resumen apunta a un siteId que ya no existe —
      // sin esto, `homeScopeSite` (ver HomeView.vue) quedaría "colgado" y
      // los widgets del Resumen se congelarían con el último dato de una
      // sucursal borrada.
      if (this.homeScopeSiteId === siteId) {
        this.homeScopeSiteId = null
        this.refreshIncidentSummary(token)
        this.refreshAiSummary(token)
      }
    },

    async fetchCandidates(token, siteId) {
      this.candidatesLoading = true
      try {
        this.candidatesBySite[siteId] = await api.getDiscoveryCandidates(token, siteId)
      } finally {
        this.candidatesLoading = false
      }
    },

    async approveCandidate(token, candidateId, siteId, payload) {
      const node = await api.approveCandidate(token, candidateId, payload)
      this.candidatesBySite[siteId] = (this.candidatesBySite[siteId] || []).filter(
        (c) => c.candidateId !== candidateId,
      )
      this.nodesBySite[siteId] = [...(this.nodesBySite[siteId] || []), node]
      const site = this.sites.find((s) => s.siteId === siteId)
      if (site) site.totalNodes = (site.totalNodes || 0) + 1
      return node
    },

    async rejectCandidate(token, candidateId, siteId) {
      await api.rejectCandidate(token, candidateId)
      this.candidatesBySite[siteId] = (this.candidatesBySite[siteId] || []).filter(
        (c) => c.candidateId !== candidateId,
      )
    },

    // El contador de nodos por zona (zone.totalNodes) es un valor
    // derivado que solo llega del servidor en el fetch inicial — cada
    // mutación que mueve un nodo de/hacia una zona debe ajustarlo a mano
    // o la tarjeta de la zona se queda mostrando un conteo viejo.
    bumpZoneCount(siteId, zoneId, delta) {
      if (!zoneId) return
      const zone = (this.zonesBySite[siteId] || []).find((z) => z.zoneId === zoneId)
      if (zone) zone.totalNodes = Math.max(0, (zone.totalNodes || 0) + delta)
    },

    async addNode(token, payload) {
      const node = await api.createNode(token, payload)
      this.nodesBySite[node.siteId] = [...(this.nodesBySite[node.siteId] || []), node]
      const site = this.sites.find((s) => s.siteId === node.siteId)
      if (site) site.totalNodes = (site.totalNodes || 0) + 1
      this.bumpZoneCount(node.siteId, node.zoneId, 1)
      return node
    },

    async editNode(token, nodeId, siteId, payload) {
      await api.updateNode(token, nodeId, payload)
      const list = this.nodesBySite[siteId] || []
      const node = list.find((n) => n.nodeId === nodeId)
      if (node) {
        const previousZoneId = node.zoneId
        Object.assign(node, payload)
        if (previousZoneId !== node.zoneId) {
          this.bumpZoneCount(siteId, previousZoneId, -1)
          this.bumpZoneCount(siteId, node.zoneId, 1)
        }
      }
    },

    async removeNode(token, nodeId, siteId) {
      await api.deleteNode(token, nodeId)
      const node = (this.nodesBySite[siteId] || []).find((n) => n.nodeId === nodeId)
      this.nodesBySite[siteId] = (this.nodesBySite[siteId] || []).filter((n) => n.nodeId !== nodeId)
      // Los hijos de este nodo pasan a la raíz (ON DELETE SET NULL en la BD).
      for (const n of this.nodesBySite[siteId] || []) {
        if (n.parentNodeId === nodeId) n.parentNodeId = null
      }
      const site = this.sites.find((s) => s.siteId === siteId)
      if (site) site.totalNodes = Math.max(0, (site.totalNodes || 0) - 1)
      if (node) this.bumpZoneCount(siteId, node.zoneId, -1)
    },

    async createZone(token, siteId, payload) {
      const zone = await api.createZone(token, siteId, payload)
      this.zonesBySite[siteId] = [...(this.zonesBySite[siteId] || []), { ...zone, totalNodes: 0 }]
      const site = this.sites.find((s) => s.siteId === siteId)
      if (site) site.totalZones = (site.totalZones || 0) + 1
      return zone
    },

    async editZone(token, zoneId, siteId, payload) {
      await api.updateZone(token, zoneId, payload)
      const zone = (this.zonesBySite[siteId] || []).find((z) => z.zoneId === zoneId)
      if (zone) Object.assign(zone, payload)
    },

    async removeZone(token, zoneId, siteId, deleteNodes) {
      await api.deleteZone(token, zoneId, deleteNodes)
      this.zonesBySite[siteId] = (this.zonesBySite[siteId] || []).filter((z) => z.zoneId !== zoneId)
      const site = this.sites.find((s) => s.siteId === siteId)
      if (site) site.totalZones = Math.max(0, (site.totalZones || 0) - 1)

      if (deleteNodes) {
        const removedCount = (this.nodesBySite[siteId] || []).filter((n) => n.zoneId === zoneId).length
        this.nodesBySite[siteId] = (this.nodesBySite[siteId] || []).filter((n) => n.zoneId !== zoneId)
        if (site) site.totalNodes = Math.max(0, (site.totalNodes || 0) - removedCount)
      } else {
        for (const n of this.nodesBySite[siteId] || []) {
          if (n.zoneId === zoneId) n.zoneId = null
        }
      }
    },

    reset() {
      this.$reset()
    },
  },
})
