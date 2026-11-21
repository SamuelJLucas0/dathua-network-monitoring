<template>
  <div class="bg-dathua-card border border-dathua-border rounded-2xl p-6">
    <div class="flex items-center justify-between mb-1">
      <h2 class="text-white font-semibold">Tendencia general</h2>
      <router-link
        to="/dashboard/metrics"
        class="text-xs font-semibold text-dathua-orange hover:text-white transition-colors duration-200 shrink-0"
      >
        Ver métricas completas →
      </router-link>
    </div>
    <p class="text-dathua-text-soft text-xs mb-5">
      {{ siteId ? `Promedio de todos los equipos de ${siteName} en la última hora.` : 'Promedio de todos los equipos de todas tus sucursales en la última hora.' }}
    </p>

    <div v-if="loading" class="py-10 flex items-center justify-center">
      <span class="w-6 h-6 rounded-full border-2 border-dathua-border border-t-dathua-orange animate-spin"></span>
    </div>

    <EmptyState
      v-else-if="!data || overall.nodeCount === 0"
      icon="chart"
      :title="!data ? 'No se pudo cargar la tendencia' : 'Todavía no hay equipos aquí'"
      :description="!data ? 'Intenta recargar la página en unos momentos.' : 'En cuanto agregues equipos, verás su promedio aquí.'"
    />

    <template v-else>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div class="border border-dathua-border rounded-xl p-3.5">
          <p class="text-dathua-text-soft text-xs mb-1">Equipos</p>
          <p class="text-white text-lg font-semibold">{{ overall.nodeCount }}</p>
        </div>
        <div class="border border-dathua-border rounded-xl p-3.5">
          <p class="text-dathua-text-soft text-xs mb-1">Latencia</p>
          <p class="text-lg font-semibold" :style="{ color: latencyColor(overall.avgLatencyMs) }">
            {{ overall.avgLatencyMs !== null ? `${overall.avgLatencyMs} ms` : '—' }}
          </p>
        </div>
        <div class="border border-dathua-border rounded-xl p-3.5">
          <p class="text-dathua-text-soft text-xs mb-1">Pérdida</p>
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

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <span class="text-xs font-medium text-dathua-text-soft">Latencia (ms)</span>
          <LineChart :series="latencySeries" :color="latencyColor(overall.avgLatencyMs)" :height="56" unit=" ms" />
        </div>
        <div>
          <span class="text-xs font-medium text-dathua-text-soft">Pérdida de paquetes (%)</span>
          <LineChart :series="lossSeries" :color="lossColor(overall.avgLossPercent)" :height="56" unit="%" />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useDashboardStore } from '../../stores/dashboard'
import * as api from '../../services/api'
import { ROLE_COLOR } from '../../utils/status'
import LineChart from './metrics/LineChart.vue'
import EmptyState from './EmptyState.vue'

// `siteId` es opcional: sin él, la tarjeta muestra el promedio de TODA la
// organización (usado por el Resumen en "Todas las sucursales") en vez del
// de una sola sucursal — mismo componente, dos alcances posibles.
const props = defineProps({
  siteId: { type: [Number, String], default: null },
  siteName: { type: String, default: '' },
})

const auth = useAuthStore()
const dashboard = useDashboardStore()
const loading = ref(false)
const data = ref(null)
const series = ref(null)

const overall = computed(() => data.value?.overall || { nodeCount: 0, avgLatencyMs: null, avgLossPercent: null, uptimePercent: null })
const latencySeries = computed(() => (series.value?.general || []).map((p) => ({ t: p.t, value: p.avgLatencyMs })))
const lossSeries = computed(() => (series.value?.general || []).map((p) => ({ t: p.t, value: p.avgLossPercent })))

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

async function load() {
  loading.value = true
  try {
    const [summary, ts] = props.siteId
      ? await Promise.all([
          api.getSiteMetrics(auth.token, props.siteId, { window: '1h' }),
          api.getSiteMetricsTimeseries(auth.token, props.siteId, { window: '1h' }),
        ])
      : await Promise.all([
          api.getOrgMetrics(auth.token, { window: '1h' }),
          api.getOrgMetricsTimeseries(auth.token, { window: '1h' }),
        ])
    data.value = summary
    series.value = ts
  } catch {
    data.value = null
    series.value = null
  } finally {
    loading.value = false
  }
}

watch([() => props.siteId, () => dashboard.telemetryTick], load)
onMounted(load)
</script>
