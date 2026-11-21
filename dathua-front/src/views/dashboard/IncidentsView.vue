<template>
  <div v-if="dashboard.loading && !dashboard.loaded" class="flex items-center justify-center py-24">
    <span class="w-8 h-8 rounded-full border-2 border-dathua-border border-t-dathua-orange animate-spin"></span>
  </div>

  <OnboardingEmptyState v-else-if="dashboard.sites.length === 0" @create="showCreateSite = true" />

  <div v-else class="space-y-6">
    <AgentOfflineBanner :site="dashboard.activeSite" :is-monitored="activeSiteIsMonitored" />
    <NotMonitoredNotice
      v-if="!activeSiteIsMonitored"
      :site="dashboard.activeSite"
      :has-nodes="dashboard.activeSiteNodes.length > 0"
    />

    <div class="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 class="font-heading text-2xl font-bold text-white">Centro de Incidentes</h1>
        <p class="text-dathua-text-soft text-sm mt-1">
          Historial de alertas de <span class="text-white">{{ dashboard.activeSite?.name }}</span>.
        </p>
      </div>
      <button
        type="button"
        class="px-4 py-2.5 rounded-lg text-sm font-semibold bg-dathua-orange text-white hover:bg-[#B45309] transition-colors duration-200 cursor-pointer shrink-0"
        @click="showCreateIncident = true"
      >
        + Nuevo incidente
      </button>
    </div>

    <!-- Resumen -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <StatTile label="Total" :value="stats?.total ?? '—'" tone="brand">
        <template #icon>
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        </template>
      </StatTile>
      <StatTile label="Activos" :value="stats?.active ?? '—'" :tone="Number(stats?.active) > 0 ? 'warning' : 'good'">
        <template #icon>
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </template>
      </StatTile>
      <StatTile label="Críticos/altos activos" :value="stats?.criticalOrHighActive ?? '—'" :tone="Number(stats?.criticalOrHighActive) > 0 ? 'critical' : 'good'">
        <template #icon>
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </template>
      </StatTile>
      <StatTile label="Resueltos" :value="stats?.resolved ?? '—'" tone="good">
        <template #icon>
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
        </template>
      </StatTile>
    </div>

    <!-- Filtros -->
    <div class="flex flex-col sm:flex-row gap-2">
      <select v-model="statusFilter" class="bg-dathua-bg border border-dathua-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-dathua-orange">
        <option value="">Todos los estados</option>
        <option value="active">Activos</option>
        <option value="resolved">Resueltos</option>
      </select>
      <select v-model="severityFilter" class="bg-dathua-bg border border-dathua-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-dathua-orange">
        <option value="">Todas las severidades</option>
        <option v-for="s in SEVERITIES" :key="s" :value="s">{{ SEVERITY[s].label }}</option>
      </select>
      <span v-if="loading" class="w-4 h-4 rounded-full border-2 border-dathua-border border-t-dathua-orange animate-spin self-center"></span>
    </div>

    <!-- Acciones en lote — actúan sobre exactamente lo que está filtrado
         y visible en la lista de abajo, no sobre todo el historial de la
         sucursal de un jalón. -->
    <div v-if="incidents.length > 0" class="flex items-center justify-end gap-4">
      <button
        v-if="hasActiveInList"
        type="button"
        class="text-xs font-semibold text-dathua-orange hover:text-white transition-colors duration-200 cursor-pointer"
        @click="confirmingBulkResolve = true"
      >
        Marcar todo como resuelto
      </button>
      <button
        type="button"
        class="text-xs font-semibold text-dathua-text-soft hover:text-red-400 transition-colors duration-200 cursor-pointer"
        @click="confirmingBulkDelete = true"
      >
        Eliminar todo
      </button>
    </div>

    <!-- Lista -->
    <div class="bg-dathua-card border border-dathua-border rounded-2xl p-6">
      <EmptyState
        v-if="incidents.length === 0 && hasActiveFilters"
        icon="filter"
        title="Sin incidentes con estos filtros"
      >
        <button
          type="button"
          class="text-xs font-semibold text-dathua-orange hover:text-white transition-colors duration-200 cursor-pointer"
          @click="statusFilter = ''; severityFilter = ''"
        >
          Limpiar filtros
        </button>
      </EmptyState>
      <EmptyState
        v-else-if="incidents.length === 0"
        icon="incident"
        title="Sin incidentes registrados"
        description="En cuanto ocurra algo en esta sucursal, aparecerá aquí."
      />
      <ul v-else class="divide-y divide-dathua-border">
        <li v-for="incident in incidents" :key="incident.incidentId" class="py-4 first:pt-0 last:pb-0">
          <!-- Escritorio/tablet (>=640px): fila completa, sin cambios. -->
          <div class="hidden sm:flex items-start gap-3">
            <SeverityBadge :severity="incident.severity" class="shrink-0 mt-0.5" />
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-3">
                <p class="text-sm text-white font-medium">{{ incident.title }}</p>
                <span class="text-xs text-dathua-text-soft/70 shrink-0">{{ formatRelativeTime(incident.startedAt) }}</span>
              </div>
              <p class="text-xs text-dathua-text-soft mt-1">{{ incident.message }}</p>
              <div class="flex items-center gap-2 mt-2 text-xs text-dathua-text-soft/80">
                <router-link
                  v-if="incident.nodeId"
                  :to="{ path: `/dashboard/nodes/${incident.nodeId}`, query: highlightQuery(incident) }"
                  class="hover:text-dathua-orange transition-colors duration-200"
                >
                  {{ incident.nodeName || 'Ver equipo' }}
                </router-link>
                <span v-else>Equipo eliminado</span>
                <span v-if="incident.ipAddress">· {{ incident.ipAddress }}</span>
                <span v-if="incident.type">· {{ formatIncidentType(incident.type) }}</span>
              </div>
              <!-- `incident.message` ya trae la explicación en español
                   simple (armada en incidentCopy.js al crearse el
                   incidente) — aquí solo se agregan causas probables y
                   qué hacer, sin repetir esa misma oración. -->
              <AnomalyExplanation :metric-analyzed="incident.metricAnalyzed" :severity="incident.severity" :show-summary="false" />
            </div>
            <div class="shrink-0 flex flex-col items-end gap-1.5">
              <span v-if="incident.isResolved" class="text-xs font-medium" :style="{ color: ROLE_COLOR.good }">
                Resuelto {{ formatRelativeTime(incident.resolvedAt) }}
              </span>
              <button
                v-else
                type="button"
                :disabled="busyId === incident.incidentId"
                class="text-xs font-semibold text-dathua-orange hover:text-white transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                @click="resolve(incident)"
              >
                {{ busyId === incident.incidentId ? 'Resolviendo…' : 'Marcar resuelto' }}
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

          <!-- Móvil (<640px): tarjeta compacta — solo lo esencial a simple
               vista. Antes se intentaba meter la misma fila de 3 columnas
               de escritorio en una pantalla angosta y el texto se encimaba
               (fecha/estado sobre los botones). Ahora todo lo demás
               (mensaje completo, equipo/IP/tipo, causas, sugerencia,
               acciones) vive junto en un solo panel que se abre con "›". -->
          <button
            type="button"
            class="sm:hidden w-full flex items-start gap-3 text-left cursor-pointer"
            @click="mobileIncident = incident"
          >
            <SeverityBadge :severity="incident.severity" class="shrink-0 mt-0.5" />
            <div class="min-w-0 flex-1">
              <p class="text-sm text-white font-medium leading-snug">{{ incident.title }}</p>
              <p class="text-xs text-dathua-text-soft/70 mt-0.5">{{ formatRelativeTime(incident.startedAt) }}</p>
              <span
                class="inline-block text-[11px] font-medium mt-1"
                :class="incident.isResolved ? '' : 'text-dathua-orange'"
                :style="incident.isResolved ? { color: ROLE_COLOR.good } : {}"
              >
                {{ incident.isResolved ? `Resuelto ${formatRelativeTime(incident.resolvedAt)}` : 'Activo' }}
              </span>
            </div>
            <svg class="w-4 h-4 text-dathua-text-soft/60 shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </li>
      </ul>
    </div>
  </div>

  <!-- Panel móvil de detalle: junta TODO lo de la tarjeta (mensaje
       completo, equipo/IP/tipo, causas/sugerencia, acciones) en un solo
       lugar, en vez de que el usuario tenga que abrir varias cosas sueltas. -->
  <Teleport to="body">
    <div
      v-if="mobileIncident"
      class="sm:hidden fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm"
      @click.self="mobileIncident = null"
    >
      <div class="w-full max-h-[85vh] overflow-y-auto bg-dathua-card border-t border-dathua-border rounded-t-2xl p-5 pb-6 shadow-2xl">
        <div class="w-10 h-1 rounded-full bg-dathua-border mx-auto mb-4"></div>

        <div class="flex items-start gap-3">
          <SeverityBadge :severity="mobileIncident.severity" class="shrink-0 mt-0.5" />
          <div class="min-w-0 flex-1">
            <p class="text-sm text-white font-semibold leading-snug">{{ mobileIncident.title }}</p>
            <p class="text-xs text-dathua-text-soft/70 mt-0.5">{{ formatRelativeTime(mobileIncident.startedAt) }}</p>
          </div>
        </div>

        <p class="text-xs text-gray-300 mt-3">{{ mobileIncident.message }}</p>

        <div class="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-xs text-dathua-text-soft/80">
          <router-link
            v-if="mobileIncident.nodeId"
            :to="{ path: `/dashboard/nodes/${mobileIncident.nodeId}`, query: highlightQuery(mobileIncident) }"
            class="hover:text-dathua-orange transition-colors duration-200"
            @click="mobileIncident = null"
          >
            {{ mobileIncident.nodeName || 'Ver equipo' }}
          </router-link>
          <span v-else>Equipo eliminado</span>
          <span v-if="mobileIncident.ipAddress">· {{ mobileIncident.ipAddress }}</span>
          <span v-if="mobileIncident.type">· {{ formatIncidentType(mobileIncident.type) }}</span>
        </div>

        <div v-if="mobileExplanation" class="mt-3 bg-white/5 border border-dathua-border rounded-lg px-3 py-2.5 space-y-2">
          <div>
            <p class="text-[11px] font-semibold text-dathua-text-soft uppercase tracking-wide">Causas probables</p>
            <ul class="text-xs text-gray-300 list-disc list-inside space-y-0.5 mt-1">
              <li v-for="(cause, i) in mobileExplanation.causes" :key="i">{{ cause }}</li>
            </ul>
          </div>
          <p class="text-xs text-gray-300">
            <span class="font-semibold text-white">Qué hacer: </span>{{ mobileExplanation.suggestion }}
          </p>
        </div>

        <div class="mt-4 pt-4 border-t border-dathua-border flex items-center justify-between gap-3">
          <span v-if="mobileIncident.isResolved" class="text-xs font-medium" :style="{ color: ROLE_COLOR.good }">
            Resuelto {{ formatRelativeTime(mobileIncident.resolvedAt) }}
          </span>
          <button
            v-else
            type="button"
            :disabled="busyId === mobileIncident.incidentId"
            class="text-xs font-semibold text-dathua-orange hover:text-white transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            @click="resolve(mobileIncident)"
          >
            {{ busyId === mobileIncident.incidentId ? 'Resolviendo…' : 'Marcar resuelto' }}
          </button>
          <button
            type="button"
            title="Eliminar"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-dathua-text-soft hover:text-red-400 hover:bg-red-500/10 transition-colors duration-200 cursor-pointer shrink-0"
            @click="confirmingIncident = mobileIncident; mobileIncident = null"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          class="w-full mt-4 py-2.5 rounded-lg text-sm font-semibold text-dathua-text-soft border border-dathua-border hover:text-white hover:border-white/30 transition-colors duration-200 cursor-pointer"
          @click="mobileIncident = null"
        >
          Cerrar
        </button>
      </div>
    </div>
  </Teleport>

  <CreateSiteModal v-if="showCreateSite" @close="showCreateSite = false" @created="showCreateSite = false" />
  <CreateIncidentModal
    v-if="showCreateIncident"
    :site-id="dashboard.activeSiteId"
    :nodes="dashboard.activeSiteNodes"
    @close="showCreateIncident = false"
    @created="onIncidentCreated"
  />
  <ConfirmDialog
    v-if="confirmingIncident"
    title="Eliminar incidente"
    :message="`Se eliminará «${confirmingIncident.title}». Esta acción no se puede deshacer.`"
    :loading="busyId === confirmingIncident.incidentId"
    @cancel="confirmingIncident = null"
    @confirm="remove(confirmingIncident)"
  />
  <ConfirmDialog
    v-if="confirmingBulkResolve"
    title="Marcar todo como resuelto"
    tone="warning"
    confirm-label="Marcar como resuelto"
    :message="`Se marcarán como resueltos los ${activeInListCount} incidente(s) activo(s) que coinciden con los filtros actuales.`"
    :loading="bulkBusy"
    @cancel="confirmingBulkResolve = false"
    @confirm="bulkResolveAll"
  />
  <ConfirmDialog
    v-if="confirmingBulkDelete"
    title="Eliminar todo"
    confirm-label="Eliminar todo"
    :message="`Se eliminarán los ${incidents.length} incidente(s) que coinciden con los filtros actuales. Esta acción no se puede deshacer.`"
    :loading="bulkBusy"
    @cancel="confirmingBulkDelete = false"
    @confirm="bulkDeleteAll"
  />
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useDashboardStore } from '../../stores/dashboard'
import * as api from '../../services/api'
import { SEVERITY, ROLE_COLOR } from '../../utils/status'
import { formatRelativeTime } from '../../utils/time'
import { formatIncidentType } from '../../utils/metrics'
import { getExplanation } from '../../utils/incidentExplanations'
import OnboardingEmptyState from '../../components/dashboard/OnboardingEmptyState.vue'
import CreateSiteModal from '../../components/dashboard/CreateSiteModal.vue'
import StatTile from '../../components/dashboard/StatTile.vue'
import SeverityBadge from '../../components/dashboard/SeverityBadge.vue'
import AnomalyExplanation from '../../components/dashboard/AnomalyExplanation.vue'
import CreateIncidentModal from '../../components/dashboard/incidents/CreateIncidentModal.vue'
import ConfirmDialog from '../../components/dashboard/ConfirmDialog.vue'
import AgentOfflineBanner from '../../components/dashboard/AgentOfflineBanner.vue'
import NotMonitoredNotice from '../../components/dashboard/NotMonitoredNotice.vue'
import EmptyState from '../../components/dashboard/EmptyState.vue'

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']

const auth = useAuthStore()
const dashboard = useDashboardStore()

// "Monitoreada" = al menos un nodo ya reportó telemetría real alguna vez
// — usado por AgentOfflineBanner para no avisar "dejó de reportar" en una
// sucursal que nunca reportó nada.
const activeSiteIsMonitored = computed(() => {
  if (!dashboard.activeSite) return false
  return dashboard.activeSiteNodes.length > 0 && dashboard.activeSiteNodes.some((n) => n.status !== 'Unknown')
})

const showCreateSite = ref(false)
const showCreateIncident = ref(false)
const statusFilter = ref('')
const severityFilter = ref('')
const loading = ref(false)
const busyId = ref(null)
const confirmingIncident = ref(null)
const confirmingBulkResolve = ref(false)
const confirmingBulkDelete = ref(false)
const bulkBusy = ref(false)
const stats = ref(null)
const incidents = ref([])

// Cuenta los incidentes activos que ya están cargados en pantalla (mismos
// filtros que el listado) — decide si mostrar "Marcar todo como resuelto"
// y cuántos afecta, sin tener que volver a preguntarle al backend.
const activeInListCount = computed(() => incidents.value.filter((i) => !i.isResolved).length)
const hasActiveInList = computed(() => activeInListCount.value > 0)

// Incidente actualmente abierto en el panel de detalle móvil (ver Teleport
// al final del template) — null cuando está cerrado.
const mobileIncident = ref(null)
const mobileExplanation = computed(() =>
  mobileIncident.value ? getExplanation(mobileIncident.value.metricAnalyzed, mobileIncident.value.severity) : null
)

const hasActiveFilters = computed(() => Boolean(statusFilter.value || severityFilter.value))

// Va en el link "Ver equipo" — le manda al detalle del equipo la hora
// exacta del incidente para que dibuje un pico + etiqueta en su gráfica
// (ver `highlight`/`latencyMarkers`/`lossMarkers` en NodeDetailView.vue).
// Los incidentes manuales sin `metricAnalyzed` (creados a mano desde el
// dashboard, no por la IA) simplemente no traen pico, solo el aviso de
// texto "Viendo el momento de...".
function highlightQuery(incident) {
  const query = { hlAt: incident.startedAt, hlLabel: incident.title }
  if (incident.metricAnalyzed) query.hlMetric = incident.metricAnalyzed
  const role = SEVERITY[incident.severity]?.role
  if (role) query.hlColor = ROLE_COLOR[role]
  return query
}

async function load() {
  if (!dashboard.activeSiteId) return
  loading.value = true
  try {
    const params = { siteId: dashboard.activeSiteId, limit: 100 }
    if (statusFilter.value) params.isResolved = statusFilter.value === 'resolved'
    if (severityFilter.value) params.severity = severityFilter.value

    const [statsRes, incidentsRes] = await Promise.all([
      api.getIncidentStats(auth.token, { siteId: dashboard.activeSiteId }),
      api.getIncidents(auth.token, params),
    ])
    stats.value = statsRes
    incidents.value = incidentsRes
  } finally {
    loading.value = false
  }
}

async function resolve(incident) {
  busyId.value = incident.incidentId
  try {
    await api.resolveIncident(auth.token, incident.incidentId)
    incident.isResolved = true
    incident.resolvedAt = new Date().toISOString()
    await Promise.all([load(), dashboard.refreshIncidentSummary(auth.token)])
  } finally {
    busyId.value = null
  }
}

async function remove(incident) {
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

// Mismos filtros que ya usa `load()` (sin limit/offset) — así "todo" quiere
// decir exactamente lo que el usuario ya está viendo filtrado en pantalla.
function currentFilterParams() {
  const params = { siteId: dashboard.activeSiteId }
  if (statusFilter.value) params.isResolved = statusFilter.value === 'resolved'
  if (severityFilter.value) params.severity = severityFilter.value
  return params
}

async function bulkResolveAll() {
  bulkBusy.value = true
  try {
    await api.bulkResolveIncidents(auth.token, currentFilterParams())
    confirmingBulkResolve.value = false
    await Promise.all([load(), dashboard.refreshIncidentSummary(auth.token)])
  } finally {
    bulkBusy.value = false
  }
}

async function bulkDeleteAll() {
  bulkBusy.value = true
  try {
    await api.bulkDeleteIncidents(auth.token, currentFilterParams())
    confirmingBulkDelete.value = false
    await Promise.all([load(), dashboard.refreshIncidentSummary(auth.token)])
  } finally {
    bulkBusy.value = false
  }
}

async function onIncidentCreated() {
  showCreateIncident.value = false
  await Promise.all([load(), dashboard.refreshIncidentSummary(auth.token)])
}

watch([statusFilter, severityFilter, () => dashboard.activeSiteId, () => dashboard.incidentTick], load)
onMounted(load)
</script>
