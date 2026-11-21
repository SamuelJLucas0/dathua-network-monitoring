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
        <h1 class="font-heading text-2xl font-bold text-white">Métricas en vivo</h1>
        <p class="text-dathua-text-soft text-sm mt-1">
          {{ zoneFilterId ? `Zona "${zoneFilterName}" en ` : '' }}<span class="text-white">{{ dashboard.activeSite?.name }}</span>
          — datos reales reportados por el agente.
        </p>
      </div>
      <router-link
        :to="zoneFilterId ? { path: '/dashboard/nodes', query: { zone: zoneFilterId } } : '/dashboard/nodes'"
        class="text-xs font-semibold text-dathua-orange hover:text-white transition-colors duration-200 shrink-0 self-center"
      >
        Editar equipos →
      </router-link>
    </div>

    <!-- Selector de ventana + zona: todo en un solo lugar, sin tener que -->
    <!-- salir de la página para cambiar el alcance. -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
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
        <span v-if="loading" class="w-3.5 h-3.5 rounded-full border-2 border-dathua-border border-t-dathua-orange animate-spin ml-1"></span>
      </div>

      <select
        v-model="zoneSelect"
        class="bg-dathua-bg border border-dathua-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-dathua-orange sm:ml-auto"
      >
        <option value="">Todas las zonas (general)</option>
        <option v-for="z in dashboard.activeSiteZones" :key="z.zoneId" :value="z.zoneId">{{ z.name }}</option>
      </select>
    </div>

    <p v-if="error" class="text-xs text-red-400 bg-red-500/10 border border-red-400/30 rounded-lg px-3 py-2">{{ error }}</p>

    <template v-if="data">
      <!-- Resumen general -->
      <div class="bg-dathua-card border border-dathua-border rounded-2xl p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-white font-semibold">
            {{ zoneFilterId ? 'Salud de la zona' : 'Salud de la sucursal' }}
          </h2>
          <span class="text-xs text-dathua-text-soft">Ventana: {{ windowLabel }}</span>
        </div>

        <StatusStackedBar :counts="overall.healthCounts" class="mb-5" />

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="border border-dathua-border rounded-xl p-3.5">
            <p class="text-dathua-text-soft text-xs mb-1">Equipos</p>
            <p class="text-white text-lg font-semibold">{{ overall.nodeCount }}</p>
          </div>
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
            <p class="text-dathua-text-soft text-xs mb-1">Disponibilidad</p>
            <p class="text-lg font-semibold text-white">
              {{ overall.uptimePercent !== null ? `${overall.uptimePercent}%` : '—' }}
            </p>
          </div>
        </div>
      </div>

      <!-- Tendencia general -->
      <div class="bg-dathua-card border border-dathua-border rounded-2xl p-6">
        <h2 class="text-white font-semibold mb-1">Tendencia general</h2>
        <p class="text-dathua-text-soft text-xs mb-4">
          Promedio de {{ zoneFilterId ? 'la zona' : 'todos los equipos de la sucursal' }} a lo largo de la ventana seleccionada.
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-medium text-dathua-text-soft">Latencia (ms)</span>
              <span class="text-xs font-semibold" :style="{ color: latencyColor(overall.avgLatencyMs) }">
                {{ overall.avgLatencyMs !== null ? `${overall.avgLatencyMs} ms prom.` : 'sin datos' }}
              </span>
            </div>
            <LineChart :series="generalLatencySeries" :color="latencyColor(overall.avgLatencyMs)" :height="72" unit=" ms" />
          </div>
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-medium text-dathua-text-soft">Pérdida de paquetes (%)</span>
              <span class="text-xs font-semibold" :style="{ color: lossColor(overall.avgLossPercent) }">
                {{ overall.avgLossPercent !== null ? `${overall.avgLossPercent}% prom.` : 'sin datos' }}
              </span>
            </div>
            <LineChart :series="generalLossSeries" :color="lossColor(overall.avgLossPercent)" :height="72" unit="%" />
          </div>
        </div>
      </div>

      <!-- Resumen por zona (solo vista general) -->
      <div v-if="!zoneFilterId && data.zones.length > 1" class="bg-dathua-card border border-dathua-border rounded-2xl p-6">
        <h2 class="text-white font-semibold mb-4">Por zona</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            v-for="zone in data.zones"
            :key="zone.zoneId ?? 'unzoned'"
            type="button"
            class="text-left border border-dathua-border rounded-xl p-4 hover:border-dathua-orange/30 transition-colors duration-200 cursor-pointer"
            @click="zone.zoneId && goToZone(zone.zoneId)"
          >
            <div class="flex items-center justify-between gap-2 mb-3">
              <div class="flex items-center gap-2.5 min-w-0">
                <span
                  v-if="zone.zoneIcon"
                  class="w-8 h-8 rounded-lg bg-white/5 border border-dathua-border flex items-center justify-center p-1.5 shrink-0 text-dathua-text-soft"
                  v-html="ZONE_ICONS[zone.zoneIcon] || ZONE_ICONS.building"
                ></span>
                <p class="text-white font-semibold text-sm truncate">{{ zone.zoneName }}</p>
              </div>
              <span
                class="w-2.5 h-2.5 rounded-full shrink-0"
                :style="{ backgroundColor: healthColor(zone.healthCounts) }"
              ></span>
            </div>
            <div class="flex items-center gap-4 text-xs text-dathua-text-soft">
              <span>{{ zone.nodeCount }} equipo{{ zone.nodeCount === 1 ? '' : 's' }}</span>
              <span :style="{ color: latencyColor(zone.avgLatencyMs) }">
                {{ zone.avgLatencyMs !== null ? `${zone.avgLatencyMs} ms` : 'sin datos' }}
              </span>
              <span :style="{ color: lossColor(zone.avgLossPercent) }">
                {{ zone.avgLossPercent !== null ? `${zone.avgLossPercent}% pérdida` : 'sin datos' }}
              </span>
            </div>
          </button>
        </div>
      </div>

      <!-- Desglose por equipo -->
      <div class="bg-dathua-card border border-dathua-border rounded-2xl p-6">
        <h2 class="text-white font-semibold mb-1">Desglose por equipo</h2>
        <p class="text-dathua-text-soft text-xs mb-4">
          Promedios y tendencia de latencia calculados sobre las métricas reportadas por el agente en la ventana seleccionada.
        </p>

        <EmptyState v-if="allNodes.length === 0" icon="nodes" title="Todavía no hay equipos aquí">
          <router-link
            :to="{ path: '/dashboard/nodes', query: { newNode: '1', ...(zoneFilterId ? { zone: zoneFilterId } : {}) } }"
            class="text-xs font-semibold text-dathua-orange hover:text-white transition-colors duration-200"
          >
            + Agregar equipo
          </router-link>
        </EmptyState>

        <div v-else class="space-y-5">
          <div v-for="group in data.zones" :key="group.zoneId ?? 'unzoned'">
            <h3 v-if="!zoneFilterId" class="text-xs font-semibold uppercase tracking-wide text-dathua-text-soft mb-2">
              {{ group.zoneName }}
            </h3>
            <div class="space-y-1.5">
              <div
                v-for="node in group.nodes"
                :key="node.nodeId"
                class="grid grid-cols-2 sm:grid-cols-[minmax(0,3fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,2fr)_minmax(0,1.4fr)] gap-y-1.5 gap-x-3 items-center bg-dathua-bg border border-dathua-border rounded-lg px-3.5 py-2.5"
              >
                <div class="col-span-2 sm:col-span-1 flex items-center gap-2.5 min-w-0">
                  <span
                    class="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center p-1 shrink-0 text-dathua-text-soft"
                    v-html="DEVICE_ICONS[node.deviceType]"
                  ></span>
                  <router-link
                    :to="`/dashboard/nodes/${node.nodeId}`"
                    class="text-white text-sm truncate hover:text-dathua-orange transition-colors duration-200"
                  >
                    {{ node.name }}
                  </router-link>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: ROLE_COLOR[NODE_STATUS[node.status].role] }"></span>
                  <span class="text-xs text-dathua-text-soft">{{ NODE_STATUS[node.status].label }}</span>
                </div>
                <div class="text-xs" :style="{ color: latencyColor(node.avgLatencyMs) }">
                  {{ node.avgLatencyMs !== null ? `${node.avgLatencyMs} ms` : 'sin datos' }}
                </div>
                <div class="text-xs" :style="{ color: lossColor(node.avgLossPercent) }">
                  {{ node.avgLossPercent !== null ? `${node.avgLossPercent}% pérdida` : 'sin datos' }}
                </div>
                <div class="col-span-2 sm:col-span-1 h-6">
                  <LineChart :series="latencySeriesFor(node.nodeId)" :color="latencyColor(node.avgLatencyMs)" :height="24" unit=" ms" :show-axis="false" />
                </div>
                <div class="text-xs text-dathua-text-soft sm:text-right">
                  {{ node.lastSeenAt ? formatRelativeTime(node.lastSeenAt) : 'nunca visto' }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>

  <CreateSiteModal v-if="showCreateSite" @close="showCreateSite = false" @created="showCreateSite = false" />
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useDashboardStore } from '../../stores/dashboard'
import * as api from '../../services/api'
import { ROLE_COLOR, NODE_STATUS } from '../../utils/status'
import { DEVICE_ICONS } from '../../utils/deviceIcons'
import { ZONE_ICONS } from '../../utils/zoneIcons'
import { formatRelativeTime } from '../../utils/time'
import OnboardingEmptyState from '../../components/dashboard/OnboardingEmptyState.vue'
import CreateSiteModal from '../../components/dashboard/CreateSiteModal.vue'
import StatusStackedBar from '../../components/dashboard/StatusStackedBar.vue'
import LineChart from '../../components/dashboard/metrics/LineChart.vue'
import AgentOfflineBanner from '../../components/dashboard/AgentOfflineBanner.vue'
import NotMonitoredNotice from '../../components/dashboard/NotMonitoredNotice.vue'
import EmptyState from '../../components/dashboard/EmptyState.vue'

const WINDOW_OPTIONS = [
  { value: '15m', label: '15 min' },
  { value: '1h', label: '1 hora' },
  { value: '24h', label: '24 horas' },
]

const route = useRoute()
const router = useRouter()
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
const windowValue = ref('1h')
const zoneFilterId = ref(route.query.zone ? Number(route.query.zone) : null)
const loading = ref(false)
const error = ref('')
const data = ref(null)
const seriesData = ref(null)

const windowLabel = computed(() => WINDOW_OPTIONS.find((o) => o.value === windowValue.value)?.label || windowValue.value)

const zoneFilterName = computed(
  () => dashboard.activeSiteZones.find((z) => z.zoneId === zoneFilterId.value)?.name || '',
)

const overall = computed(() => data.value?.overall || { healthCounts: {}, nodeCount: 0, avgLatencyMs: null, avgLossPercent: null, uptimePercent: null })

const allNodes = computed(() => (data.value ? data.value.zones.flatMap((z) => z.nodes) : []))

const generalLatencySeries = computed(() =>
  (seriesData.value?.general || []).map((p) => ({ t: p.t, value: p.avgLatencyMs })),
)
const generalLossSeries = computed(() =>
  (seriesData.value?.general || []).map((p) => ({ t: p.t, value: p.avgLossPercent })),
)

function latencySeriesFor(nodeId) {
  const node = seriesData.value?.nodes.find((n) => n.nodeId === nodeId)
  if (!node) return []
  return node.series.map((p) => ({ t: p.t, value: p.avgLatencyMs }))
}

// El <select> de zona es la forma directa de cambiar de alcance sin salir
// de la página — actualiza el filtro y la URL (compartible/recargable) en
// un solo paso.
const zoneSelect = computed({
  get: () => zoneFilterId.value ?? '',
  set: (val) => {
    const zid = val ? Number(val) : null
    zoneFilterId.value = zid
    router.replace(zid ? { path: '/dashboard/metrics', query: { zone: zid } } : { path: '/dashboard/metrics' })
  },
})

function goToZone(zoneId) {
  zoneSelect.value = zoneId
}

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

function healthColor(counts) {
  if (!counts) return ROLE_COLOR.neutral
  if (counts.Critical > 0) return ROLE_COLOR.critical
  if (counts.Offline > 0) return ROLE_COLOR.serious
  if (counts.Warning > 0) return ROLE_COLOR.warning
  if (counts.Online > 0) return ROLE_COLOR.good
  return ROLE_COLOR.neutral
}

async function load() {
  if (!dashboard.activeSiteId) return
  loading.value = true
  error.value = ''
  try {
    const params = { window: windowValue.value, zoneId: zoneFilterId.value }
    const [summary, series] = await Promise.all([
      api.getSiteMetrics(auth.token, dashboard.activeSiteId, params),
      api.getSiteMetricsTimeseries(auth.token, dashboard.activeSiteId, params),
    ])
    data.value = summary
    seriesData.value = series
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

watch(() => route.query.zone, (z) => {
  zoneFilterId.value = z ? Number(z) : null
})
watch([windowValue, zoneFilterId, () => dashboard.activeSiteId, () => dashboard.telemetryTick], load)
onMounted(load)
</script>
