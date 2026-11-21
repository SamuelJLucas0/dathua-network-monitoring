<template>
  <div v-if="loading && !node" class="flex items-center justify-center py-24">
    <span class="w-8 h-8 rounded-full border-2 border-dathua-border border-t-dathua-orange animate-spin"></span>
  </div>

  <EmptyState
    v-else-if="!node"
    icon="search"
    size="lg"
    title="Este equipo no existe o no tienes acceso a él"
    description="Puede que lo hayan eliminado, o que pertenezca a otra sucursal."
  >
    <router-link to="/dashboard/nodes" class="text-sm font-semibold text-dathua-orange hover:text-white transition-colors duration-200">
      ← Volver a Dispositivos y Topología
    </router-link>
  </EmptyState>

  <div v-else class="space-y-6">
    <div>
      <router-link
        :to="`/dashboard/nodes${node.zoneId ? `?zone=${node.zoneId}` : ''}`"
        class="text-xs font-semibold text-dathua-text-soft hover:text-white transition-colors duration-200"
      >
        ← Volver a Dispositivos y Topología
      </router-link>

      <div class="flex items-start justify-between gap-4 flex-wrap mt-2">
        <div class="flex items-center gap-3 min-w-0">
          <span
            class="w-11 h-11 rounded-xl bg-white/5 border border-dathua-border flex items-center justify-center p-2.5 shrink-0 text-dathua-text-soft"
            v-html="DEVICE_ICONS[node.deviceType]"
          ></span>
          <div class="min-w-0">
            <h1 class="font-heading text-2xl font-bold text-white truncate">{{ node.name }}</h1>
            <p class="text-dathua-text-soft text-sm mt-0.5">
              {{ formatDeviceType(node.deviceType) }} · {{ node.siteName }}<span v-if="node.zoneName"> · {{ node.zoneName }}</span>
            </p>
          </div>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: ROLE_COLOR[NODE_STATUS[node.status].role] }"></span>
            <span class="text-sm text-white font-medium">{{ NODE_STATUS[node.status].label }}</span>
          </div>
          <MaintenanceControl
            label="Silenciar alertas de este equipo"
            :maintenance-mode="node.maintenanceMode"
            :maintenance-until="node.maintenanceUntil"
            :busy="maintenanceBusy"
            @silence="silenceNode"
            @clear="clearNodeSilence"
          />
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-dathua-text-soft">
        <span>IP: {{ node.ipAddress }}</span>
        <span v-if="node.macAddress">MAC: {{ node.macAddress }}</span>
        <span v-if="node.parentNodeName">Depende de: {{ node.parentNodeName }}</span>
        <span>{{ node.lastSeenAt ? `Visto ${formatRelativeTime(node.lastSeenAt)}` : 'Sin telemetría reportada aún' }}</span>
      </div>
    </div>

    <!-- Aviso de "llegaste aquí desde un incidente/anomalía" — el pico en
         la gráfica de abajo puede no dibujarse si el punto más cercano cae
         fuera de la ventana visible, así que este texto confirma el
         contexto aunque el pico no se vea. -->
    <div v-if="highlight" class="flex items-center gap-2 text-xs rounded-lg px-3 py-2 bg-white/5 border border-dathua-border text-dathua-text-soft">
      <span class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: highlight.color }"></span>
      Viendo el momento de: <span class="text-white font-medium">{{ highlight.label }}</span>
    </div>

    <!-- Selector de ventana -->
    <div class="flex items-center gap-2">
      <button
        v-for="opt in WINDOW_OPTIONS"
        :key="opt.value"
        type="button"
        class="px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors duration-200 cursor-pointer"
        :class="windowValue === opt.value
          ? 'bg-dathua-orange border-dathua-orange text-white'
          : 'border-dathua-border text-dathua-text-soft hover:text-white hover:border-white/30'"
        @click="windowValue = opt.value"
      >
        {{ opt.label }}
      </button>
      <span v-if="metricsLoading" class="w-3.5 h-3.5 rounded-full border-2 border-dathua-border border-t-dathua-orange animate-spin ml-1"></span>
    </div>

    <!-- Métricas -->
    <div class="bg-dathua-card border border-dathua-border rounded-2xl p-6">
      <h2 class="text-white font-semibold mb-4">Métricas</h2>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div class="border border-dathua-border rounded-xl p-3.5">
          <p class="text-dathua-text-soft text-xs mb-1">Latencia promedio</p>
          <p class="text-lg font-semibold" :style="{ color: latencyColor(overall.avgLatencyMs) }">
            {{ overall.avgLatencyMs !== null ? `${overall.avgLatencyMs} ms` : '—' }}
          </p>
        </div>
        <div class="border border-dathua-border rounded-xl p-3.5">
          <p class="text-dathua-text-soft text-xs mb-1">Pérdida de paquetes</p>
          <p class="text-lg font-semibold" :style="{ color: lossColor(overall.avgLossPercent) }">
            {{ overall.avgLossPercent !== null ? `${overall.avgLossPercent}%` : '—' }}
          </p>
        </div>
        <div class="border border-dathua-border rounded-xl p-3.5">
          <p class="text-dathua-text-soft text-xs mb-1">Jitter promedio</p>
          <p class="text-lg font-semibold text-white">
            {{ overall.avgJitterMs !== null ? `${overall.avgJitterMs} ms` : '—' }}
          </p>
        </div>
        <div class="border border-dathua-border rounded-xl p-3.5">
          <p class="text-dathua-text-soft text-xs mb-1">Disponibilidad</p>
          <p class="text-lg font-semibold text-white">
            {{ overall.uptimePercent !== null ? `${overall.uptimePercent}%` : '—' }}
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <span class="text-xs font-medium text-dathua-text-soft">Latencia (ms)</span>
          <LineChart :series="latencySeries" :color="latencyColor(overall.avgLatencyMs)" :height="80" unit=" ms" :markers="latencyMarkers" />
        </div>
        <div>
          <span class="text-xs font-medium text-dathua-text-soft">Pérdida de paquetes (%)</span>
          <LineChart :series="lossSeries" :color="lossColor(overall.avgLossPercent)" :height="80" unit="%" :markers="lossMarkers" />
        </div>
      </div>
    </div>

    <!-- Incidentes -->
    <div class="bg-dathua-card border border-dathua-border rounded-2xl p-6">
      <div class="flex items-center justify-between gap-4 flex-wrap mb-4">
        <h2 class="text-white font-semibold">Incidentes de este equipo</h2>
        <div v-if="incidents.length > 0" class="flex items-center gap-4">
          <button
            v-if="hasActiveIncidentsInList"
            type="button"
            class="text-xs font-semibold text-dathua-orange hover:text-white transition-colors duration-200 cursor-pointer"
            @click="confirmingBulkResolveIncidents = true"
          >
            Marcar todo como resuelto
          </button>
          <button
            type="button"
            class="text-xs font-semibold text-dathua-text-soft hover:text-red-400 transition-colors duration-200 cursor-pointer"
            @click="confirmingBulkDeleteIncidents = true"
          >
            Eliminar todo
          </button>
        </div>
      </div>
      <EmptyState v-if="incidents.length === 0" icon="incident" title="Sin incidentes registrados" />
      <ul v-else class="divide-y divide-dathua-border">
        <li v-for="incident in incidents" :key="incident.incidentId" class="py-3.5 first:pt-0 last:pb-0">
          <div class="flex items-start gap-3">
            <SeverityBadge :severity="incident.severity" class="shrink-0 mt-0.5" />
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-3">
                <p class="text-sm text-white font-medium">{{ incident.title }}</p>
                <span class="text-xs text-dathua-text-soft/70 shrink-0">{{ formatRelativeTime(incident.startedAt) }}</span>
              </div>
              <p class="text-xs text-dathua-text-soft mt-1">{{ incident.message }}</p>
            </div>
            <div class="shrink-0 flex items-center gap-2.5">
              <span v-if="incident.isResolved" class="text-xs font-medium" :style="{ color: ROLE_COLOR.good }">Resuelto</span>
              <button
                v-else
                type="button"
                :disabled="busyId === incident.incidentId"
                class="text-xs font-semibold text-dathua-orange hover:text-white transition-colors duration-200 cursor-pointer disabled:opacity-50"
                @click="resolveIncidentRow(incident)"
              >
                Resolver
              </button>
              <button
                type="button"
                :disabled="busyId === incident.incidentId"
                title="Eliminar"
                class="w-7 h-7 rounded-lg flex items-center justify-center text-dathua-text-soft hover:text-red-400 hover:bg-red-500/10 transition-colors duration-200 cursor-pointer disabled:opacity-50"
                @click="confirmingIncident = incident"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </li>
      </ul>
    </div>

    <!-- Anomalías de IA -->
    <div class="bg-dathua-card border border-dathua-border rounded-2xl p-6">
      <div class="flex items-center justify-between gap-4 flex-wrap mb-4">
        <h2 class="text-white font-semibold">Anomalías detectadas por IA</h2>
        <div v-if="visibleAnomalies.length > 0" class="flex items-center gap-4">
          <button
            v-if="hasPendingAnomaliesInList"
            type="button"
            class="text-xs font-semibold text-dathua-orange hover:text-white transition-colors duration-200 cursor-pointer"
            @click="confirmingBulkReviewAnomalies = true"
          >
            Marcar todo como revisado
          </button>
          <button
            type="button"
            class="text-xs font-semibold text-dathua-text-soft hover:text-red-400 transition-colors duration-200 cursor-pointer"
            @click="confirmingBulkDeleteAnomalies = true"
          >
            Eliminar todo
          </button>
        </div>
      </div>
      <EmptyState
        v-if="visibleAnomalies.length === 0"
        icon="ai"
        title="Sin anomalías relevantes"
        description="No hay anomalías con score mayor a 70% para este equipo."
      />
      <ul v-else class="divide-y divide-dathua-border">
        <li v-for="anomaly in visibleAnomalies" :key="anomaly._id" class="py-3.5 first:pt-0 last:pb-0">
          <div class="flex items-start gap-3">
            <SeverityBadge :severity="anomaly.classification" class="shrink-0 mt-0.5" />
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-3">
                <p class="text-sm text-white font-medium">{{ formatMetricName(anomaly.metricAnalyzed) }}</p>
                <span class="text-xs text-dathua-text-soft/70 shrink-0">{{ formatRelativeTime(anomaly.timestamp) }}</span>
              </div>
              <p class="text-xs text-dathua-text-soft mt-1">
                Observado: {{ anomaly.observed_value }}{{ anomaly.expected_Baseline !== null ? ` (línea base: ${anomaly.expected_Baseline})` : '' }}
                · Score: {{ (anomaly.anomalyScore * 100).toFixed(0) }}%
              </p>
            </div>
            <div class="shrink-0 flex items-center gap-2.5">
              <span v-if="anomaly.is_false_positive" class="text-xs text-dathua-text-soft">Falso positivo</span>
              <span v-else-if="anomaly.reviewed" class="text-xs" :style="{ color: ROLE_COLOR.good }">Es real</span>
              <template v-else>
                <button
                  type="button"
                  :disabled="busyId === anomaly._id"
                  class="text-xs font-semibold text-dathua-orange hover:text-white transition-colors duration-200 cursor-pointer disabled:opacity-50"
                  @click="reviewAnomalyRow(anomaly, false)"
                >
                  Es real
                </button>
                <button
                  type="button"
                  :disabled="busyId === anomaly._id"
                  class="text-xs font-semibold text-dathua-text-soft hover:text-white transition-colors duration-200 cursor-pointer disabled:opacity-50"
                  @click="reviewAnomalyRow(anomaly, true)"
                >
                  Falso positivo
                </button>
              </template>
              <button
                type="button"
                :disabled="busyId === anomaly._id"
                title="Eliminar"
                class="w-7 h-7 rounded-lg flex items-center justify-center text-dathua-text-soft hover:text-red-400 hover:bg-red-500/10 transition-colors duration-200 cursor-pointer disabled:opacity-50"
                @click="confirmingAnomaly = anomaly"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>

  <ConfirmDialog
    v-if="confirmingIncident"
    title="Eliminar incidente"
    :message="`Se eliminará «${confirmingIncident.title}». Esta acción no se puede deshacer.`"
    :loading="busyId === confirmingIncident.incidentId"
    @cancel="confirmingIncident = null"
    @confirm="deleteIncidentRow(confirmingIncident)"
  />
  <ConfirmDialog
    v-if="confirmingAnomaly"
    title="Eliminar anomalía"
    message="Esta anomalía se eliminará del historial de IA. Esta acción no se puede deshacer."
    :loading="busyId === confirmingAnomaly._id"
    @cancel="confirmingAnomaly = null"
    @confirm="deleteAnomalyRow(confirmingAnomaly)"
  />
  <ConfirmDialog
    v-if="confirmingBulkResolveIncidents"
    title="Marcar todo como resuelto"
    tone="warning"
    confirm-label="Marcar como resuelto"
    :message="`Se marcarán como resueltos los ${activeIncidentsInListCount} incidente(s) activo(s) de este equipo.`"
    :loading="bulkBusy"
    @cancel="confirmingBulkResolveIncidents = false"
    @confirm="bulkResolveIncidentsAll"
  />
  <ConfirmDialog
    v-if="confirmingBulkDeleteIncidents"
    title="Eliminar todo"
    confirm-label="Eliminar todo"
    :message="`Se eliminarán los ${incidents.length} incidente(s) de este equipo. Esta acción no se puede deshacer.`"
    :loading="bulkBusy"
    @cancel="confirmingBulkDeleteIncidents = false"
    @confirm="bulkDeleteIncidentsAll"
  />
  <ConfirmDialog
    v-if="confirmingBulkReviewAnomalies"
    title="Marcar todo como revisado"
    tone="warning"
    confirm-label="Marcar como revisado"
    :message="`Se marcarán como revisadas (Es real) las ${pendingAnomaliesInListCount} anomalía(s) por revisar de este equipo.`"
    :loading="bulkBusy"
    @cancel="confirmingBulkReviewAnomalies = false"
    @confirm="bulkReviewAnomaliesAll"
  />
  <ConfirmDialog
    v-if="confirmingBulkDeleteAnomalies"
    title="Eliminar todo"
    confirm-label="Eliminar todo"
    :message="`Se eliminarán las ${visibleAnomalies.length} anomalía(s) de este equipo. Esta acción no se puede deshacer.`"
    :loading="bulkBusy"
    @cancel="confirmingBulkDeleteAnomalies = false"
    @confirm="bulkDeleteAnomaliesAll"
  />
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useDashboardStore } from '../../stores/dashboard'
import * as api from '../../services/api'
import { ROLE_COLOR, NODE_STATUS } from '../../utils/status'
import { DEVICE_ICONS } from '../../utils/deviceIcons'
import { formatDeviceType, formatMetricName } from '../../utils/metrics'
import { formatRelativeTime } from '../../utils/time'
import { ANOMALY_MIN_SCORE } from '../../utils/anomalies'
import SeverityBadge from '../../components/dashboard/SeverityBadge.vue'
import LineChart from '../../components/dashboard/metrics/LineChart.vue'
import ConfirmDialog from '../../components/dashboard/ConfirmDialog.vue'
import MaintenanceControl from '../../components/dashboard/MaintenanceControl.vue'
import EmptyState from '../../components/dashboard/EmptyState.vue'

// Mismo umbral que el Resumen e IA Sentinel (ver utils/anomalies.js).
const MIN_SCORE = ANOMALY_MIN_SCORE

const WINDOW_OPTIONS = [
  { value: '15m', label: '15 min' },
  { value: '1h', label: '1 hora' },
  { value: '24h', label: '24 horas' },
]

const route = useRoute()
const auth = useAuthStore()
const dashboard = useDashboardStore()

// Deep-link desde Incidentes/IA Sentinel: al hacer clic en el equipo desde
// una incidencia/anomalía, se manda aquí la hora exacta (`hlAt`), un texto
// (`hlLabel`), la métrica afectada (`hlMetric`) y un color (`hlColor`) —
// ver highlightQuery() en IncidentsView.vue/AiSentinelView.vue. Solo se lee
// una vez al entrar (no es reactivo a cambios de query en caliente).
const highlight = (() => {
  const { hlAt, hlLabel, hlMetric, hlColor } = route.query
  if (!hlAt) return null
  return {
    t: hlAt,
    label: hlLabel || 'Evento',
    metric: hlMetric || null,
    color: hlColor || ROLE_COLOR.critical,
  }
})()

// Si venimos de un deep-link, la ventana inicial debe ser la más angosta
// que todavía cubra ese momento — así el pico cae dentro de lo visible en
// vez de que el usuario tenga que adivinar y cambiar de ventana a mano.
function windowFor(iso) {
  const elapsedMs = Date.now() - new Date(iso).getTime()
  if (elapsedMs <= 15 * 60 * 1000) return '15m'
  if (elapsedMs <= 60 * 60 * 1000) return '1h'
  return '24h'
}

const loading = ref(false)
const metricsLoading = ref(false)
const busyId = ref(null)
const maintenanceBusy = ref(false)
const windowValue = ref(highlight ? windowFor(highlight.t) : '1h')
const confirmingIncident = ref(null)
const confirmingAnomaly = ref(null)
const confirmingBulkResolveIncidents = ref(false)
const confirmingBulkDeleteIncidents = ref(false)
const confirmingBulkReviewAnomalies = ref(false)
const confirmingBulkDeleteAnomalies = ref(false)
const bulkBusy = ref(false)

const node = ref(null)
const metricsSummary = ref(null)
const metricsSeries = ref(null)
const incidents = ref([])
const anomalies = ref([])

const visibleAnomalies = computed(() => anomalies.value.filter((a) => a.anomalyScore > MIN_SCORE))

// Cuentan lo que ya está cargado en pantalla para este equipo — deciden si
// mostrar los botones "Marcar todo como..." y cuánto afectan.
const activeIncidentsInListCount = computed(() => incidents.value.filter((i) => !i.isResolved).length)
const hasActiveIncidentsInList = computed(() => activeIncidentsInListCount.value > 0)
const pendingAnomaliesInListCount = computed(() => visibleAnomalies.value.filter((a) => !a.reviewed).length)
const hasPendingAnomaliesInList = computed(() => pendingAnomaliesInListCount.value > 0)

const overall = computed(
  () => metricsSummary.value?.overall || { avgLatencyMs: null, avgLossPercent: null, avgJitterMs: null, uptimePercent: null },
)
const latencySeries = computed(() =>
  (metricsSeries.value?.nodes?.[0]?.series || []).map((p) => ({ t: p.t, value: p.avgLatencyMs })),
)
const lossSeries = computed(() =>
  (metricsSeries.value?.nodes?.[0]?.series || []).map((p) => ({ t: p.t, value: p.avgLossPercent })),
)

// El deep-link solo trae UNA métrica afectada — se pinta en la gráfica de
// latencia si es avg_ms/jitter_ms/stddev_ms (no hay gráfica propia para
// jitter/variabilidad, comparten la de latencia) o en la de pérdida de
// paquetes si es loss_percent.
const LATENCY_METRICS = ['avg_ms', 'jitter_ms', 'stddev_ms']
const latencyMarkers = computed(() => {
  if (!highlight || !LATENCY_METRICS.includes(highlight.metric)) return []
  return [{ t: highlight.t, label: highlight.label, color: highlight.color }]
})
const lossMarkers = computed(() => {
  if (!highlight || highlight.metric !== 'loss_percent') return []
  return [{ t: highlight.t, label: highlight.label, color: highlight.color }]
})

function latencyColor(ms) {
  if (ms === null || ms === undefined) return 'var(--color-status-neutral)'
  if (ms <= 50) return ROLE_COLOR.good
  if (ms <= 150) return ROLE_COLOR.warning
  if (ms <= 300) return ROLE_COLOR.serious
  return ROLE_COLOR.critical
}

function lossColor(pct) {
  if (pct === null || pct === undefined) return 'var(--color-status-neutral)'
  if (pct === 0) return ROLE_COLOR.good
  if (pct < 2) return ROLE_COLOR.warning
  if (pct < 10) return ROLE_COLOR.serious
  return ROLE_COLOR.critical
}

async function loadNode() {
  loading.value = true
  try {
    node.value = await api.getNodeById(auth.token, route.params.nodeId)
  } catch {
    node.value = null
  } finally {
    loading.value = false
  }
}

async function loadMetrics() {
  if (!node.value) return
  metricsLoading.value = true
  try {
    const params = { window: windowValue.value, nodeId: node.value.nodeId }
    const [summary, series] = await Promise.all([
      api.getSiteMetrics(auth.token, node.value.siteId, params),
      api.getSiteMetricsTimeseries(auth.token, node.value.siteId, params),
    ])
    metricsSummary.value = summary
    metricsSeries.value = series
  } finally {
    metricsLoading.value = false
  }
}

async function loadRelated() {
  if (!node.value) return
  const [incidentsRes, anomaliesRes] = await Promise.all([
    api.getIncidents(auth.token, { nodeId: node.value.nodeId, limit: 50 }),
    api.getAnomalies(auth.token, { nodeId: node.value.nodeId, limit: 50 }),
  ])
  incidents.value = incidentsRes
  anomalies.value = anomaliesRes
}

async function resolveIncidentRow(incident) {
  busyId.value = incident.incidentId
  try {
    await api.resolveIncident(auth.token, incident.incidentId)
    incident.isResolved = true
    await dashboard.refreshIncidentSummary(auth.token)
  } finally {
    busyId.value = null
  }
}

async function deleteIncidentRow(incident) {
  busyId.value = incident.incidentId
  try {
    await api.deleteIncident(auth.token, incident.incidentId)
    incidents.value = incidents.value.filter((i) => i.incidentId !== incident.incidentId)
    confirmingIncident.value = null
    await dashboard.refreshIncidentSummary(auth.token)
  } finally {
    busyId.value = null
  }
}

async function reviewAnomalyRow(anomaly, isFalsePositive) {
  busyId.value = anomaly._id
  try {
    await api.reviewAnomaly(auth.token, anomaly._id, { is_false_positive: isFalsePositive })
    anomaly.reviewed = true
    anomaly.is_false_positive = isFalsePositive
  } finally {
    busyId.value = null
  }
}

async function deleteAnomalyRow(anomaly) {
  busyId.value = anomaly._id
  try {
    await api.deleteAnomaly(auth.token, anomaly._id)
    anomalies.value = anomalies.value.filter((a) => a._id !== anomaly._id)
    confirmingAnomaly.value = null
  } finally {
    busyId.value = null
  }
}

// Acciones en lote — acotadas a este equipo (nodeId + su propia sucursal).
async function bulkResolveIncidentsAll() {
  bulkBusy.value = true
  try {
    await api.bulkResolveIncidents(auth.token, { siteId: node.value.siteId, nodeId: node.value.nodeId })
    confirmingBulkResolveIncidents.value = false
    await Promise.all([loadRelated(), dashboard.refreshIncidentSummary(auth.token)])
  } finally {
    bulkBusy.value = false
  }
}

async function bulkDeleteIncidentsAll() {
  bulkBusy.value = true
  try {
    await api.bulkDeleteIncidents(auth.token, { siteId: node.value.siteId, nodeId: node.value.nodeId })
    confirmingBulkDeleteIncidents.value = false
    await Promise.all([loadRelated(), dashboard.refreshIncidentSummary(auth.token)])
  } finally {
    bulkBusy.value = false
  }
}

async function bulkReviewAnomaliesAll() {
  bulkBusy.value = true
  try {
    await api.bulkReviewAnomalies(auth.token, { siteId: node.value.siteId, nodeId: node.value.nodeId, minScore: MIN_SCORE })
    confirmingBulkReviewAnomalies.value = false
    await loadRelated()
  } finally {
    bulkBusy.value = false
  }
}

async function bulkDeleteAnomaliesAll() {
  bulkBusy.value = true
  try {
    await api.bulkDeleteAnomalies(auth.token, { siteId: node.value.siteId, nodeId: node.value.nodeId, minScore: MIN_SCORE })
    confirmingBulkDeleteAnomalies.value = false
    await loadRelated()
  } finally {
    bulkBusy.value = false
  }
}

async function silenceNode(minutes) {
  maintenanceBusy.value = true
  try {
    const res = await api.setNodeMaintenance(auth.token, node.value.nodeId, minutes)
    node.value.maintenanceMode = res.maintenanceMode
    node.value.maintenanceUntil = res.maintenanceUntil
  } finally {
    maintenanceBusy.value = false
  }
}

async function clearNodeSilence() {
  maintenanceBusy.value = true
  try {
    await api.clearNodeMaintenance(auth.token, node.value.nodeId)
    node.value.maintenanceMode = false
    node.value.maintenanceUntil = null
  } finally {
    maintenanceBusy.value = false
  }
}

watch(windowValue, loadMetrics)
watch(
  () => route.params.nodeId,
  async () => {
    await loadNode()
    await Promise.all([loadMetrics(), loadRelated()])
  },
)
// Telemetría/incidentes/anomalías en vivo por Socket.IO (ver DashboardLayout)
watch(() => dashboard.telemetryTick, loadMetrics)
watch([() => dashboard.incidentTick, () => dashboard.anomalyTick], loadRelated)

onMounted(async () => {
  await loadNode()
  await Promise.all([loadMetrics(), loadRelated()])
})
</script>
