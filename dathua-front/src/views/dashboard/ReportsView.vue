<template>
  <div v-if="dashboard.loading && !dashboard.loaded" class="flex items-center justify-center py-24">
    <span class="w-8 h-8 rounded-full border-2 border-dathua-border border-t-dathua-orange animate-spin"></span>
  </div>

  <OnboardingEmptyState v-else-if="dashboard.sites.length === 0" @create="showCreateSite = true" />

  <div v-else class="space-y-6">
    <div>
      <h1 class="font-heading text-2xl font-bold text-white">Reportes de auditoría</h1>
      <p class="text-dathua-text-soft text-sm mt-1">
        Disponibilidad y desempeño de <span class="text-white">{{ dashboard.activeSite?.name }}</span> en un periodo.
      </p>
    </div>

    <div class="bg-dathua-card border border-dathua-border rounded-2xl p-6">
      <div class="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <TextField v-model="from" type="date" label="Desde" />
        <TextField v-model="to" type="date" label="Hasta" />
        <button
          type="button"
          :disabled="loading"
          class="px-5 py-3 rounded-lg text-sm font-semibold bg-dathua-orange text-white hover:bg-[#B45309] transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          @click="generate"
        >
          {{ loading ? 'Generando…' : 'Generar reporte' }}
        </button>
      </div>
      <p v-if="error" class="text-xs text-red-400 bg-red-500/10 border border-red-400/30 rounded-lg px-3 py-2 mt-3">{{ error }}</p>
    </div>

    <template v-if="report">
      <div class="bg-dathua-card border border-dathua-border rounded-2xl p-6">
        <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 class="text-white font-semibold">{{ report.site.name }}</h2>
            <p class="text-dathua-text-soft text-xs mt-0.5">
              {{ formatDate(report.period.from) }} — {{ formatDate(report.period.to) }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              :disabled="downloading"
              class="px-3.5 py-2 rounded-lg text-xs font-semibold text-dathua-text-soft border border-dathua-border hover:text-white hover:border-white/30 transition-colors duration-200 cursor-pointer disabled:opacity-50"
              @click="download('csv')"
            >
              Descargar CSV
            </button>
            <button
              type="button"
              :disabled="downloading"
              class="px-3.5 py-2 rounded-lg text-xs font-semibold text-dathua-text-soft border border-dathua-border hover:text-white hover:border-white/30 transition-colors duration-200 cursor-pointer disabled:opacity-50"
              @click="download('pdf')"
            >
              Descargar PDF
            </button>
          </div>
        </div>

        <EmptyState
          v-if="report.nodes.length === 0"
          icon="report"
          title="Sin equipos que reportar en este periodo"
          description="Prueba con un rango de fechas distinto, o agrega equipos en Dispositivos y topología."
        />
        <div v-else class="overflow-x-auto -mx-2">
          <table class="w-full text-sm min-w-[640px]">
            <thead>
              <tr class="text-left text-xs text-dathua-text-soft uppercase tracking-wide">
                <th class="px-2 py-2 font-medium">Equipo</th>
                <th class="px-2 py-2 font-medium">Disponibilidad</th>
                <th class="px-2 py-2 font-medium">Latencia</th>
                <th class="px-2 py-2 font-medium">Jitter</th>
                <th class="px-2 py-2 font-medium">Pérdida</th>
                <th class="px-2 py-2 font-medium">Incidentes</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-dathua-border">
              <tr v-for="n in report.nodes" :key="n.nodeId">
                <td class="px-2 py-2.5">
                  <p class="text-white">{{ n.name }}</p>
                  <p class="text-xs text-dathua-text-soft">{{ n.ipAddress }} · {{ n.deviceType }}</p>
                </td>
                <td class="px-2 py-2.5" :style="{ color: n.dataAvailable ? uptimeColor(n.uptimePercent) : 'var(--color-status-neutral)' }">
                  {{ n.dataAvailable ? `${n.uptimePercent}%` : 'Sin datos' }}
                </td>
                <td class="px-2 py-2.5 text-dathua-text-soft">{{ n.avgLatencyMs !== null ? `${n.avgLatencyMs} ms` : '—' }}</td>
                <td class="px-2 py-2.5 text-dathua-text-soft">{{ n.avgJitterMs !== null ? `${n.avgJitterMs} ms` : '—' }}</td>
                <td class="px-2 py-2.5 text-dathua-text-soft">{{ n.avgLossPercent !== null ? `${n.avgLossPercent}%` : '—' }}</td>
                <td class="px-2 py-2.5 text-dathua-text-soft">
                  {{ n.totalIncidents }}<span v-if="n.criticalIncidents > 0" class="text-red-400"> ({{ n.criticalIncidents }} crít.)</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="bg-dathua-card border border-dathua-border rounded-2xl p-6">
        <h2 class="text-white font-semibold mb-4">Historial de incidentes en el periodo</h2>
        <EmptyState v-if="report.incidents.length === 0" icon="incident" title="Sin incidentes en este periodo" />
        <ul v-else class="divide-y divide-dathua-border">
          <li v-for="i in report.incidents" :key="i.incidentId" class="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
            <SeverityBadge :severity="i.severity" class="shrink-0 mt-0.5" />
            <div class="min-w-0 flex-1">
              <p class="text-sm text-white">{{ i.title }}</p>
              <p class="text-xs text-dathua-text-soft">{{ i.nodeName }} · {{ formatDate(i.startedAt) }} · {{ i.isResolved ? 'Resuelto' : 'Activo' }}</p>
            </div>
          </li>
        </ul>
      </div>
    </template>
  </div>

  <CreateSiteModal v-if="showCreateSite" @close="showCreateSite = false" @created="showCreateSite = false" />
</template>

<script setup>
import { ref, watch } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useDashboardStore } from '../../stores/dashboard'
import * as api from '../../services/api'
import { ROLE_COLOR } from '../../utils/status'
import OnboardingEmptyState from '../../components/dashboard/OnboardingEmptyState.vue'
import CreateSiteModal from '../../components/dashboard/CreateSiteModal.vue'
import SeverityBadge from '../../components/dashboard/SeverityBadge.vue'
import TextField from '../../components/form/TextField.vue'
import EmptyState from '../../components/dashboard/EmptyState.vue'

const auth = useAuthStore()
const dashboard = useDashboardStore()

const showCreateSite = ref(false)
const loading = ref(false)
const downloading = ref(false)
const error = ref('')
const report = ref(null)

// Fecha local (no UTC) — con toISOString() la fecha por defecto se corre
// un día para cualquiera al oeste de UTC en la tarde/noche.
function toDateInput(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const today = new Date()
const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
const from = ref(toDateInput(thirtyDaysAgo))
const to = ref(toDateInput(today))

// "2026-09-04" sin hora lo interpreta el motor de JS como medianoche UTC,
// no medianoche local — en cualquier huso horario detrás de UTC, "hoy"
// local todavía no había empezado en UTC (o ya lo cruzó), y el reporte
// perdía justo las métricas del día que el usuario sí quería ver. Al
// forzar "Thoo:mm:ss" se ancla a la hora LOCAL del navegador en vez de UTC.
function dayBoundsToIso(dateStr) {
  return {
    from: new Date(`${dateStr}T00:00:00`).toISOString(),
    to: new Date(`${dateStr}T23:59:59.999`).toISOString(),
  }
}

function rangeParams() {
  return {
    from: dayBoundsToIso(from.value).from,
    to: dayBoundsToIso(to.value).to,
  }
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

function uptimeColor(pct) {
  if (pct === null || pct === undefined) return 'var(--color-status-neutral)'
  if (pct >= 99) return ROLE_COLOR.good
  if (pct >= 95) return ROLE_COLOR.warning
  if (pct >= 85) return ROLE_COLOR.serious
  return ROLE_COLOR.critical
}

async function generate() {
  if (!dashboard.activeSiteId) return
  loading.value = true
  error.value = ''
  try {
    report.value = await api.getSiteAuditReport(auth.token, dashboard.activeSiteId, rangeParams())
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function download(format) {
  if (!dashboard.activeSiteId) return
  downloading.value = true
  error.value = ''
  try {
    await api.downloadSiteAuditReport(auth.token, dashboard.activeSiteId, { ...rangeParams(), format })
  } catch (e) {
    error.value = e.message
  } finally {
    downloading.value = false
  }
}

// dashboard.activeSiteId todavía puede ser null en este punto — el fetch
// inicial de DashboardLayout es asíncrono y esta vista puede montar antes
// de que resuelva. El watch (con `immediate`) genera en cuanto haya un
// sitio activo, y también regenera si el usuario cambia de sucursal.
watch(
  () => dashboard.activeSiteId,
  (id) => {
    if (id) generate()
  },
  { immediate: true },
)
</script>
