<template>
  <div v-if="dashboard.loading && !dashboard.loaded" class="flex items-center justify-center py-24">
    <span class="w-8 h-8 rounded-full border-2 border-dathua-border border-t-dathua-orange animate-spin"></span>
  </div>

  <div v-else-if="dashboard.error" class="text-sm text-red-400 bg-red-500/10 border border-red-400/30 rounded-xl px-5 py-4">
    {{ dashboard.error }}
  </div>

  <OnboardingEmptyState v-else-if="dashboard.sites.length === 0" @create="showCreateSite = true" />

  <div v-else class="space-y-6">
    <!-- Mientras la sucursal está en onboarding, "Equipos descubiertos" va
         DENTRO de la tarjeta de instalación (embedded, ver
         AgentSetupPanel.vue) — antes eran dos tarjetas apiladas para un
         solo flujo. Una vez que ya está monitoreada, el panel de
         instalación deja de mostrarse y lo que se siga descubriendo (el
         agente sigue buscando equipos nuevos con el tiempo) recupera su
         propia tarjeta. -->
    <AgentSetupPanel
      v-if="!activeSiteIsMonitored"
      :site="dashboard.activeSite"
      :candidates="dashboard.activeSiteCandidates"
    />
    <DiscoveryCandidatesList
      v-else-if="dashboard.activeSiteCandidates.length > 0"
      :site="dashboard.activeSite"
      :candidates="dashboard.activeSiteCandidates"
    />

    <!-- Encabezado -->
    <div class="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 class="font-heading text-2xl font-bold text-white">Hola, {{ firstName }}</h1>
        <p class="text-dathua-text-soft text-sm mt-1">
          Esto es lo que está pasando en <span class="text-white">{{ dashboard.usage?.organization }}</span> hoy.
        </p>
      </div>

      <!-- Filtro del Resumen: por default es una vista general de TODA la
           organización; se puede acotar a una sola sucursal, y al hacerlo
           TODOS los widgets de abajo (KPIs, salud de la red, incidentes,
           IA Sentinel, tendencia) cambian de alcance juntos — antes
           algunos widgets ya eran por sucursal y otros siempre de toda la
           organización, mezclados en la misma pantalla sin avisar. Es un
           filtro independiente del selector de sucursal de la barra
           superior (ese sigue controlando Métricas/Nodos/Incidentes/IA
           Sentinel/Reportes como antes). -->
      <div class="relative shrink-0">
        <button
          type="button"
          class="flex items-center gap-2 pl-3.5 pr-3 py-2.5 rounded-lg bg-dathua-card border border-dathua-border text-sm text-white hover:border-dathua-orange/40 transition-colors duration-200"
          @click="scopeMenuOpen = !scopeMenuOpen"
        >
          <span class="text-dathua-text-soft">Viendo:</span>
          <span class="font-medium">{{ homeScopeLabel }}</span>
          <svg class="w-3.5 h-3.5 text-dathua-text-soft shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <transition
          enter-active-class="transition-all duration-150 ease-out"
          enter-from-class="opacity-0 -translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-100 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-1"
        >
          <div v-if="scopeMenuOpen" class="absolute right-0 top-full mt-2 w-56 bg-dathua-card border border-dathua-border rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] overflow-hidden z-30">
            <button
              type="button"
              class="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-left hover:bg-white/5 transition-colors duration-150"
              :class="dashboard.homeScopeSiteId === null ? 'text-dathua-orange' : 'text-gray-300'"
              @click="selectHomeScope(null)"
            >
              Todas las sucursales
              <svg v-if="dashboard.homeScopeSiteId === null" class="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
            </button>
            <button
              v-for="site in dashboard.sites"
              :key="site.siteId"
              type="button"
              class="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-left hover:bg-white/5 transition-colors duration-150"
              :class="site.siteId === dashboard.homeScopeSiteId ? 'text-dathua-orange' : 'text-gray-300'"
              @click="selectHomeScope(site.siteId)"
            >
              <span class="truncate">{{ site.name }}</span>
              <svg v-if="site.siteId === dashboard.homeScopeSiteId" class="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </transition>
      </div>
    </div>

    <!-- KPIs -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatTile label="Sucursales" :value="`${dashboard.sites.length} / ${dashboard.usage?.limits.maxSites}`" tone="brand">
        <template #icon>
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2M5 21H3m16 0h-6M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 6v-3a1 1 0 011-1h1a1 1 0 011 1v3" />
          </svg>
        </template>
      </StatTile>

      <StatTile label="Nodos monitoreados" :value="homeScopeNodeCount" tone="brand">
        <template #icon>
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 3H4v5h5V3zM20 3h-5v5h5V3zM9 16H4v5h5v-5zM20 16h-5v5h5v-5zM6.5 8v5m11-5v5M9 18.5h6M9 5.5h6" />
          </svg>
        </template>
      </StatTile>

      <StatTile
        label="Incidentes activos"
        :value="dashboard.incidentStats?.active ?? 0"
        :hint="criticalHint"
        :tone="Number(dashboard.incidentStats?.criticalOrHighActive) > 0 ? 'critical' : 'good'"
      >
        <template #icon>
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </template>
      </StatTile>

      <StatTile
        label="Anomalías por revisar"
        :value="dashboard.aiStats?.pendingReview ?? 0"
        :tone="Number(dashboard.aiStats?.pendingReview) > 0 ? 'warning' : 'good'"
      >
        <template #icon>
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </template>
      </StatTile>
    </div>

    <!-- Salud de la red + uso del plan -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 bg-dathua-card border border-dathua-border rounded-2xl p-6">
        <div class="flex items-center justify-between mb-1">
          <h2 class="text-white font-semibold">Salud de la red</h2>
          <button
            type="button"
            class="text-xs font-semibold text-dathua-orange hover:text-white transition-colors duration-200 shrink-0 cursor-pointer"
            @click="showNodeModal = true"
          >
            + Agregar equipo
          </button>
        </div>
        <p class="text-dathua-text-soft text-xs mb-5">
          {{ homeScopeSite ? `Estado de todos los nodos en ${homeScopeSite.name}.` : 'Estado de todos los nodos, en todas tus sucursales.' }}
        </p>
        <StatusStackedBar :counts="homeScopeStatusCounts" />
      </div>

      <div class="bg-dathua-card border border-dathua-border rounded-2xl p-6">
        <h2 class="text-white font-semibold mb-1">Uso de tu plan</h2>
        <p class="text-dathua-text-soft text-xs mb-5">{{ dashboard.usage?.planLabel }} — {{ trialLabel }}</p>
        <div class="space-y-5">
          <MeterBar
            label="Sucursales"
            :used="dashboard.sites.length"
            :limit="dashboard.usage?.limits.maxSites || 0"
            :tone="dashboard.sites.length >= (dashboard.usage?.limits.maxSites || 0) ? 'warning' : 'brand'"
          />
          <MeterBar
            v-if="homeScopeSite"
            :label="`Nodos en ${homeScopeSite.name}`"
            :used="homeScopeNodeCount"
            :limit="dashboard.usage?.limits.maxNodesPerSite || 0"
            :tone="homeScopeExtraNodes > 0 ? 'warning' : 'brand'"
            :hint="homeScopeExtraNodes > 0
              ? `${homeScopeExtraNodes} nodo(s) extra — se facturan aparte, no se bloquean.`
              : ''"
          />
        </div>
      </div>
    </div>

    <!-- El banner de "agente sin reportar" vive en las vistas por
         sucursal (Métricas, Nodos, Incidentes, IA Sentinel, Sucursales),
         no aquí — el Resumen ahora es una vista general de la
         organización por default, y "esta sucursal no reporta" solo tiene
         sentido cuando ya se está mirando una sucursal en concreto. -->
    <AgentOfflineBanner v-if="homeScopeSite" :site="homeScopeSite" :is-monitored="homeScopeSiteIsMonitored" />

    <!-- Tendencia general: con una sucursal elegida en el filtro, muestra
         el promedio de esa sucursal; en "Todas las sucursales" muestra UNA
         sola tarjeta con el promedio agregado de TODA la organización
         (`GET /api/metrics/org`, ver metricsController.js) — no una
         tarjeta por sucursal, eso era ruido visual repetido. -->
    <OverallMetricsCard
      :site-id="homeScopeSite ? homeScopeSite.siteId : null"
      :site-name="homeScopeSite ? homeScopeSite.name : ''"
    />

    <!-- Incidentes + IA Sentinel -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 bg-dathua-card border border-dathua-border rounded-2xl p-6">
        <div class="flex items-center justify-between mb-5">
          <div>
            <h2 class="text-white font-semibold mb-1">Incidentes activos</h2>
            <p class="text-dathua-text-soft text-xs">Los más recientes que aún no se resuelven.</p>
          </div>
          <router-link to="/dashboard/incidents" class="text-xs font-semibold text-dathua-orange hover:text-white transition-colors duration-200 shrink-0">
            Ver todos →
          </router-link>
        </div>

        <EmptyState
          v-if="dashboard.incidents.length === 0"
          icon="incident"
          title="Sin incidentes activos"
          description="Todo tranquilo por ahora."
        />
        <ul v-else class="space-y-3">
          <li v-for="incident in dashboard.incidents" :key="incident.incidentId" class="flex items-start gap-3 py-2">
            <SeverityBadge :severity="incident.severity" />
            <div class="min-w-0 flex-1">
              <p class="text-sm text-white truncate">{{ incident.title }}</p>
              <p class="text-xs text-dathua-text-soft truncate">
                {{ incident.nodeName || 'Nodo eliminado' }} · {{ incident.siteName }}
              </p>
            </div>
            <span class="text-xs text-dathua-text-soft/70 shrink-0">{{ formatRelativeTime(incident.startedAt) }}</span>
          </li>
        </ul>
      </div>

      <div class="bg-dathua-card border border-dathua-border rounded-2xl p-6">
        <div class="flex items-center justify-between mb-1">
          <h2 class="text-white font-semibold">IA Sentinel</h2>
          <router-link to="/dashboard/ai-analytics" class="text-xs font-semibold text-dathua-orange hover:text-white transition-colors duration-200 shrink-0">
            Ver todo →
          </router-link>
        </div>
        <p class="text-dathua-text-soft text-xs mb-5">Anomalías detectadas automáticamente.</p>

        <EmptyState
          v-if="dashboard.anomalies.length === 0"
          icon="ai"
          title="Sin anomalías detectadas"
          description="La IA avisa aquí en cuanto note algo raro."
        />
        <ul v-else class="space-y-4">
          <li v-for="anomaly in dashboard.anomalies.slice(0, 4)" :key="anomaly._id" class="space-y-1">
            <div class="flex items-center justify-between gap-2">
              <SeverityBadge :severity="anomaly.classification" />
              <span class="text-xs text-dathua-text-soft/70 shrink-0">{{ formatRelativeTime(anomaly.timestamp) }}</span>
            </div>
            <p class="text-xs text-gray-300">
              {{ formatMetricName(anomaly.metricAnalyzed) }} en <span class="text-white">{{ anomaly.metadata.target }}</span>
            </p>
          </li>
        </ul>
      </div>
    </div>

  </div>

  <CreateSiteModal v-if="showCreateSite" @close="showCreateSite = false" @created="onSiteCreated" />

  <NodeFormModal
    v-if="showNodeModal && dashboard.activeSite"
    :site="dashboard.activeSite"
    :zones="dashboard.activeSiteZones"
    :nodes="dashboard.activeSiteNodes"
    @close="showNodeModal = false"
    @created="showNodeModal = false"
  />
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useDashboardStore } from '../../stores/dashboard'
import { formatRelativeTime } from '../../utils/time'
import { formatMetricName } from '../../utils/metrics'
import StatTile from '../../components/dashboard/StatTile.vue'
import MeterBar from '../../components/dashboard/MeterBar.vue'
import StatusStackedBar from '../../components/dashboard/StatusStackedBar.vue'
import SeverityBadge from '../../components/dashboard/SeverityBadge.vue'
import OnboardingEmptyState from '../../components/dashboard/OnboardingEmptyState.vue'
import CreateSiteModal from '../../components/dashboard/CreateSiteModal.vue'
import AgentSetupPanel from '../../components/dashboard/AgentSetupPanel.vue'
import DiscoveryCandidatesList from '../../components/dashboard/DiscoveryCandidatesList.vue'
import NodeFormModal from '../../components/dashboard/nodes/NodeFormModal.vue'
import OverallMetricsCard from '../../components/dashboard/OverallMetricsCard.vue'
import AgentOfflineBanner from '../../components/dashboard/AgentOfflineBanner.vue'
import EmptyState from '../../components/dashboard/EmptyState.vue'

const auth = useAuthStore()
const dashboard = useDashboardStore()

// La gestión de sucursales (crear/editar/eliminar/API key) vive solo en
// "Sucursales y zonas" — el Resumen ya no repite esa tarjeta por
// sucursal, era redundante con el filtro "Viendo:" de aquí arriba.
const showCreateSite = ref(false)
const showNodeModal = ref(false)
const scopeMenuOpen = ref(false)

// "Monitoreada" = al menos un nodo ya reportó telemetría real (status
// distinto de 'Unknown'). Antes de eso, aunque ya existan nodos dados de
// alta, seguimos mostrando el cuadro grande de instalación del agente.
// Ligado a `activeSiteId` (la sucursal global) a propósito — el
// onboarding es sobre "la sucursal que estás configurando ahora", no
// sobre el filtro de lectura del Resumen (ver homeScopeSiteIsMonitored).
const activeSiteIsMonitored = computed(() => {
  if (!dashboard.activeSite) return false
  const nodes = dashboard.nodesBySite[dashboard.activeSiteId] || []
  return nodes.length > 0 && nodes.some((n) => n.status !== 'Unknown')
})

// ---------- Filtro local del Resumen (null = todas las sucursales) ----------
// Independiente de `dashboard.activeSiteId` (la sucursal global que usan
// Métricas/Nodos/Incidentes/IA Sentinel/Reportes) — ver nota en el store.
const homeScopeSite = computed(
  () => dashboard.sites.find((s) => s.siteId === dashboard.homeScopeSiteId) || null,
)

const homeScopeLabel = computed(() => homeScopeSite.value?.name || 'Todas las sucursales')

function selectHomeScope(siteId) {
  dashboard.setHomeScope(auth.token, siteId)
  scopeMenuOpen.value = false
}

// "Monitoreada" = al menos un nodo ya reportó telemetría real (status
// distinto de 'Unknown'). Se usa para el banner de agente caído del
// filtro del Resumen, igual que para la sucursal activa global de abajo.
const homeScopeSiteIsMonitored = computed(() => {
  if (!homeScopeSite.value) return false
  const nodes = dashboard.nodesBySite[homeScopeSite.value.siteId] || []
  return nodes.length > 0 && nodes.some((n) => n.status !== 'Unknown')
})

// Nodos y salud de la red del Resumen: todos los de la organización si el
// filtro está en "Todas las sucursales", o solo los de la sucursal
// elegida — antes esto SIEMPRE era de toda la organización, sin importar
// qué pareciera estar seleccionado en la pantalla.
const homeScopeNodes = computed(() => {
  if (homeScopeSite.value) return dashboard.nodesBySite[homeScopeSite.value.siteId] || []
  return dashboard.allNodes
})
const homeScopeNodeCount = computed(() => homeScopeNodes.value.length)
const homeScopeExtraNodes = computed(() => {
  const limit = dashboard.usage?.limits.maxNodesPerSite || 0
  return Math.max(0, homeScopeNodeCount.value - limit)
})
const STATUS_ORDER = ['Online', 'Warning', 'Offline', 'Critical', 'Unknown']
const homeScopeStatusCounts = computed(() => {
  if (!homeScopeSite.value) return dashboard.statusCounts
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]))
  for (const node of homeScopeNodes.value) {
    counts[node.status] = (counts[node.status] || 0) + 1
  }
  return counts
})

function onSiteCreated() {
  showCreateSite.value = false
}

const firstName = computed(() => auth.user?.name?.split(' ')[0] || '')

const trialLabel = computed(() => {
  const days = dashboard.usage?.daysLeftInTrial
  if (days === null || days === undefined) return dashboard.usage?.subscriptionStatus
  return `${days} días de prueba restantes`
})

const criticalHint = computed(() => {
  const n = Number(dashboard.incidentStats?.criticalOrHighActive || 0)
  return n > 0 ? `${n} de severidad alta o crítica` : 'Ninguno urgente'
})

onMounted(() => {
  if (!dashboard.loaded) dashboard.fetchAll(auth.token)
})

// El agente terminó un ciclo de descubrimiento (evento `discovery:new` de
// Socket.IO, ver DashboardLayout.vue) — se refresca sola la lista de
// "Equipos descubiertos" de la sucursal activa, sin recargar la página
// completa ni esperar a que el usuario lo haga a mano.
watch(
  () => dashboard.discoveryTick,
  () => {
    if (dashboard.activeSiteId) dashboard.fetchCandidates(auth.token, dashboard.activeSiteId)
  },
)
</script>
