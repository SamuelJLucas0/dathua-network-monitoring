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
        <h1 class="font-heading text-2xl font-bold text-white">Dispositivos y topología</h1>
        <p class="text-dathua-text-soft text-sm mt-1">
          Zonas y equipos de <span class="text-white">{{ dashboard.activeSite?.name }}</span>.
        </p>
      </div>
      <div class="flex items-center gap-4 shrink-0">
        <!-- Solo se muestra si ya se detectó un agente corriendo en esta
             sucursal (mismo criterio que el banner de "agente sin
             reportar") — pedir un re-escaneo no tiene caso si nunca ha
             habido un agente reportando nada. No le habla al agente
             directo (no hay canal push hacia su LAN): solo deja una marca
             que el agente recoge en su próxima consulta regular, y la
             animación de abajo sigue girando hasta que el agente confirma
             que terminó (encuentre algo o no). -->
        <button
          v-if="activeSiteIsMonitored"
          type="button"
          class="flex items-center gap-1.5 text-xs font-semibold text-dathua-orange hover:text-white transition-colors duration-200 shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="rescanState === 'scanning'"
          @click="rescanNow"
        >
          <svg class="w-3.5 h-3.5" :class="{ 'animate-spin': rescanState === 'scanning' }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m0 0a8.001 8.001 0 0115.357-2M4.582 9H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357 2M20 15h-4.418" />
          </svg>
          {{ rescanState === 'scanning' ? 'Escaneando red…' : 'Re-escanear red' }}
        </button>
        <router-link
          :to="zoneFilterId ? { path: '/dashboard/metrics', query: { zone: zoneFilterId } } : '/dashboard/metrics'"
          class="text-xs font-semibold text-dathua-orange hover:text-white transition-colors duration-200 shrink-0"
        >
          Ver métricas en vivo →
        </router-link>
      </div>
    </div>

    <!-- Animación de carga mientras el agente termina el re-escaneo, y
         aviso si no encontró nada nuevo — ver rescanNow() y el watch de
         discoveryTick más abajo. -->
    <div v-if="rescanState === 'scanning'" class="flex items-center gap-3 border border-dathua-border rounded-xl px-4 py-3.5">
      <span class="w-4 h-4 rounded-full border-2 border-dathua-border border-t-dathua-orange animate-spin shrink-0"></span>
      <p class="text-sm text-gray-300">Buscando equipos nuevos en la red de <span class="text-white">{{ dashboard.activeSite?.name }}</span>…</p>
    </div>
    <div v-else-if="rescanNotice" class="flex items-center gap-3 border border-dathua-border rounded-xl px-4 py-3.5">
      <svg class="w-4 h-4 shrink-0" :class="rescanNoticeTone === 'error' ? 'text-red-400' : 'text-dathua-text-soft'" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
        <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p class="text-sm text-gray-300">{{ rescanNotice }}</p>
    </div>

    <!-- Mismo componente que en Resumen — lo que el agente va
         descubriendo (al escanear solo, o al darle "Re-escanear" de
         arriba) se puede revisar/aprobar aquí mismo, sin tener que ir a
         otra pantalla. Antes solo vivía en Resumen: al re-escanear desde
         aquí, el resultado nunca se veía en esta misma página. -->
    <DiscoveryCandidatesList
      v-if="dashboard.activeSiteCandidates.length > 0"
      :site="dashboard.activeSite"
      :candidates="dashboard.activeSiteCandidates"
    />

    <!-- Zonas -->
    <div class="bg-dathua-card border border-dathua-border rounded-2xl p-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-white font-semibold">Zonas</h2>
          <p class="text-dathua-text-soft text-xs mt-0.5">Agrupa equipos por piso, área o cualquier criterio que te sirva.</p>
        </div>
        <button type="button" class="text-xs font-semibold text-dathua-orange hover:text-white transition-colors duration-200 cursor-pointer shrink-0" @click="showZoneModal = true">
          + Nueva zona
        </button>
      </div>

      <ZoneChipList
        :zones="dashboard.activeSiteZones"
        :nodes-by-zone="nodesByZone"
        show-view
        @view="(z) => goToZoneMetrics(z)"
        @edit="(z) => (editingZone = z)"
        @delete="(z) => (deletingZone = z)"
      />
    </div>

    <!-- Árbol de equipos -->
    <div class="bg-dathua-card border border-dathua-border rounded-2xl p-6">
      <div class="flex items-center justify-between mb-4 gap-4">
        <div>
          <h2 class="text-white font-semibold">Equipos</h2>
          <p class="text-dathua-text-soft text-xs mt-0.5">La sangría muestra qué depende de qué.</p>
        </div>
        <button type="button" class="text-xs font-semibold text-dathua-orange hover:text-white transition-colors duration-200 cursor-pointer shrink-0" @click="showNodeModal = true">
          + Nuevo equipo
        </button>
      </div>

      <template v-if="dashboard.activeSiteNodes.length > 0">
        <StatusStackedBar :counts="siteStatusCounts" class="mb-4" />

        <div class="flex flex-col sm:flex-row gap-2 mb-5">
          <div class="relative flex-1">
            <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-dathua-text-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              v-model="search"
              type="text"
              placeholder="Buscar por nombre o IP…"
              class="w-full bg-dathua-bg border border-dathua-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-dathua-orange"
            />
          </div>
          <select
            v-model="statusFilter"
            class="bg-dathua-bg border border-dathua-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-dathua-orange shrink-0"
          >
            <option value="">Todos los estados</option>
            <option v-for="s in STATUS_ORDER" :key="s" :value="s">{{ NODE_STATUS[s].label }}</option>
          </select>
          <select
            v-model="typeFilter"
            class="bg-dathua-bg border border-dathua-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-dathua-orange shrink-0"
          >
            <option value="">Todos los tipos</option>
            <option v-for="t in DEVICE_TYPES" :key="t" :value="t">{{ formatDeviceType(t) }}</option>
          </select>
          <button
            v-if="hasActiveFilters"
            type="button"
            class="text-xs font-medium text-dathua-text-soft hover:text-white transition-colors duration-200 cursor-pointer shrink-0 px-2"
            @click="clearFilters"
          >
            Limpiar filtros
          </button>
        </div>
      </template>

      <EmptyState
        v-if="dashboard.activeSiteNodes.length === 0"
        icon="nodes"
        size="lg"
        title="Todavía no tienes equipos en esta sucursal"
        description="Agrégalos a mano o aprueba los que el agente descubra en la red."
      >
        <button type="button" class="px-5 py-2.5 rounded-lg text-sm font-semibold bg-dathua-orange text-white hover:bg-[#B45309] transition-colors duration-200 cursor-pointer" @click="showNodeModal = true">
          + Nuevo equipo
        </button>
      </EmptyState>
      <EmptyState
        v-else-if="hasActiveFilters && searchResults.length === 0"
        icon="filter"
        title="Sin resultados con estos filtros"
        description="Prueba con otro nombre, estado o tipo de equipo."
      >
        <button type="button" class="text-xs font-semibold text-dathua-orange hover:text-white transition-colors duration-200 cursor-pointer" @click="clearFilters">
          Limpiar filtros
        </button>
      </EmptyState>

      <!-- Con filtros activos: lista plana de coincidencias, sin agrupar por zona/jerarquía -->
      <div v-else-if="hasActiveFilters" class="space-y-0.5">
        <NodeTreeItem
          v-for="n in searchResults"
          :key="n.nodeId"
          :node="n"
          @edit="(node) => (editingNode = node)"
          @delete="(node) => (deletingNode = node)"
        />
      </div>

      <div v-else class="space-y-6">
        <div v-if="zoneFilterId" class="flex items-center gap-2 -mt-1">
          <span class="text-xs text-dathua-text-soft">Filtrando por zona:</span>
          <button
            type="button"
            class="flex items-center gap-1.5 text-xs font-medium text-dathua-orange bg-dathua-orange/10 border border-dathua-orange/30 rounded-full pl-2.5 pr-1.5 py-1 cursor-pointer"
            @click="clearZoneFilter"
          >
            {{ zoneFilterName }}
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <EmptyState
          v-if="zoneFilterId && visibleZoneGroups.length === 0"
          icon="zone"
          :title="`Todavía no hay equipos en ${zoneFilterName}`"
        />

        <div v-for="group in visibleZoneGroups" :key="group.zoneId">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-dathua-text-soft mb-1.5">{{ group.name }}</h3>
          <div class="space-y-0.5">
            <NodeTreeItem
              v-for="root in group.tree"
              :key="root.nodeId"
              :node="root"
              @edit="(n) => (editingNode = n)"
              @delete="(n) => (deletingNode = n)"
            />
          </div>
        </div>

        <div v-if="!zoneFilterId && nodeGroups.unzonedTree.length">
          <h3 v-if="nodeGroups.zoneGroups.length" class="text-xs font-semibold uppercase tracking-wide text-dathua-text-soft mb-1.5">Sin zona</h3>
          <div class="space-y-0.5">
            <NodeTreeItem
              v-for="root in nodeGroups.unzonedTree"
              :key="root.nodeId"
              :node="root"
              @edit="(n) => (editingNode = n)"
              @delete="(n) => (deletingNode = n)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>

  <CreateSiteModal v-if="showCreateSite" @close="showCreateSite = false" @created="showCreateSite = false" />

  <ZoneFormModal v-if="showZoneModal" :site="dashboard.activeSite" @close="showZoneModal = false" @created="showZoneModal = false" />
  <ZoneFormModal v-if="editingZone" :site="dashboard.activeSite" :zone="editingZone" @close="editingZone = null" @saved="editingZone = null" />
  <DeleteZoneDialog v-if="deletingZone" :zone="deletingZone" :site-id="dashboard.activeSiteId" @close="deletingZone = null" @deleted="deletingZone = null" />

  <NodeFormModal
    v-if="showNodeModal"
    :site="dashboard.activeSite"
    :zones="dashboard.activeSiteZones"
    :nodes="dashboard.activeSiteNodes"
    :default-zone-id="zoneFilterId ?? ''"
    @close="showNodeModal = false"
    @created="showNodeModal = false"
  />
  <NodeFormModal
    v-if="editingNode"
    :site="dashboard.activeSite"
    :zones="dashboard.activeSiteZones"
    :nodes="dashboard.activeSiteNodes"
    :node="editingNode"
    @close="editingNode = null"
    @saved="editingNode = null"
  />
  <DeleteNodeDialog v-if="deletingNode" :node="deletingNode" :child-count="childCountFor(deletingNode)" @close="deletingNode = null" @deleted="deletingNode = null" />
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useDashboardStore } from '../../stores/dashboard'
import { groupNodesByZone } from '../../utils/nodeTree'
import { NODE_STATUS } from '../../utils/status'
import { DEVICE_TYPES } from '../../utils/deviceIcons'
import { formatDeviceType } from '../../utils/metrics'
import { requestSiteRescan } from '../../services/api'
import OnboardingEmptyState from '../../components/dashboard/OnboardingEmptyState.vue'
import CreateSiteModal from '../../components/dashboard/CreateSiteModal.vue'
import StatusStackedBar from '../../components/dashboard/StatusStackedBar.vue'
import NodeTreeItem from '../../components/dashboard/nodes/NodeTreeItem.vue'
import NodeFormModal from '../../components/dashboard/nodes/NodeFormModal.vue'
import DeleteNodeDialog from '../../components/dashboard/nodes/DeleteNodeDialog.vue'
import ZoneFormModal from '../../components/dashboard/nodes/ZoneFormModal.vue'
import DeleteZoneDialog from '../../components/dashboard/nodes/DeleteZoneDialog.vue'
import ZoneChipList from '../../components/dashboard/nodes/ZoneChipList.vue'
import AgentOfflineBanner from '../../components/dashboard/AgentOfflineBanner.vue'
import NotMonitoredNotice from '../../components/dashboard/NotMonitoredNotice.vue'
import EmptyState from '../../components/dashboard/EmptyState.vue'
import DiscoveryCandidatesList from '../../components/dashboard/DiscoveryCandidatesList.vue'

const STATUS_ORDER = ['Online', 'Warning', 'Offline', 'Critical', 'Unknown']

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

// "Re-escanear red": deja una marca (`rescanRequestedAt`) que el agente
// recoge en su próxima consulta regular (máximo unos segundos) para
// adelantar su ciclo de descubrimiento sin que el usuario tenga que
// reiniciar el agente completo — ver requestSiteRescan en
// siteController.js. La animación de carga se queda encendida hasta que
// el agente CONFIRMA que terminó (evento `discovery:new`, ver el watch de
// abajo) — no solo mientras se manda la solicitud, que es casi instantáneo
// y no reflejaba el tiempo real que tarda el escaneo.
const rescanState = ref('idle') // idle | scanning
const rescanNotice = ref('')
const rescanNoticeTone = ref('info') // info | error
let rescanNoticeTimeout = null
let rescanSafetyTimeout = null
let awaitingRescanResult = false

function showRescanNotice(message, tone = 'info') {
  clearTimeout(rescanNoticeTimeout)
  rescanNotice.value = message
  rescanNoticeTone.value = tone
  rescanNoticeTimeout = setTimeout(() => {
    rescanNotice.value = ''
  }, 6000)
}

async function rescanNow() {
  if (!dashboard.activeSite) return
  rescanState.value = 'scanning'
  rescanNotice.value = ''
  awaitingRescanResult = true
  try {
    await requestSiteRescan(auth.token, dashboard.activeSite.siteId)
  } catch (e) {
    awaitingRescanResult = false
    rescanState.value = 'idle'
    showRescanNotice(e.message, 'error')
    return
  }
  // Salvavidas: si el agente no está corriendo (o la red no responde), no
  // dejamos la animación girando para siempre — se resuelve sola después
  // de un tiempo razonable, más largo que RESCAN_POLL_INTERVAL (10s) del
  // agente más lo que tarde el propio escaneo.
  clearTimeout(rescanSafetyTimeout)
  rescanSafetyTimeout = setTimeout(() => {
    if (!awaitingRescanResult) return
    awaitingRescanResult = false
    rescanState.value = 'idle'
    showRescanNotice('El agente no respondió a tiempo — revisa que siga corriendo en la sucursal.', 'error')
  }, 45000)
}

// El agente terminó un ciclo de descubrimiento (evento `discovery:new` de
// Socket.IO, ya sea por su ciclo normal o por el botón "Re-escanear" de
// arriba) — se refresca sola la lista de "Equipos descubiertos" de esta
// misma página, igual que ya pasaba en Resumen (ver HomeView.vue). Antes
// solo Resumen escuchaba este contador, así que re-escanear desde aquí
// nunca mostraba el resultado en esta pantalla. Si además estábamos
// esperando el resultado de un re-escaneo manual, esto es lo que apaga la
// animación de carga: si el conteo de pendientes no subió, se avisa que no
// se encontró nada; si subió, la lista ya se refrescó sola y no hace falta
// decir nada más.
watch(
  () => dashboard.discoveryTick,
  async () => {
    const countBefore = dashboard.activeSiteCandidates.length
    if (dashboard.activeSiteId) await dashboard.fetchCandidates(auth.token, dashboard.activeSiteId)

    if (!awaitingRescanResult) return
    awaitingRescanResult = false
    clearTimeout(rescanSafetyTimeout)
    rescanState.value = 'idle'

    const pendingNow = dashboard.lastDiscoveryPendingCount ?? dashboard.activeSiteCandidates.length
    if (pendingNow <= countBefore) {
      showRescanNotice('No se encontraron equipos nuevos en la red.')
    }
  },
)

const showCreateSite = ref(false)
const showZoneModal = ref(false)
const editingZone = ref(null)
const deletingZone = ref(null)
// Abre el modal de "+ Nuevo equipo" solo, sin que el usuario tenga que
// volver a darle clic — llega así desde el botón "+ Agregar equipo" del
// estado vacío de Métricas (antes solo navegaba aquí sin hacer nada más,
// lo que se sentía como un botón roto). Se limpia el query param al
// abrir para que un refresh no reabra el modal solo.
const showNodeModal = ref(false)
if (route.query.newNode) {
  showNodeModal.value = true
  router.replace({ path: '/dashboard/nodes', query: route.query.zone ? { zone: route.query.zone } : {} })
}
const editingNode = ref(null)
const deletingNode = ref(null)
const search = ref('')
const statusFilter = ref('')
const typeFilter = ref('')
// Llega por query string cuando entras desde "Ver equipos" de una zona en
// Sucursales y zonas — filtra el árbol a solo esa zona hasta que se quite.
const zoneFilterId = ref(route.query.zone ? Number(route.query.zone) : null)

const nodeGroups = computed(() => groupNodesByZone(dashboard.activeSiteNodes, dashboard.activeSiteZones))

const nodesByZone = computed(() => {
  const map = {}
  for (const n of dashboard.activeSiteNodes) {
    if (!n.zoneId) continue
    if (!map[n.zoneId]) map[n.zoneId] = []
    map[n.zoneId].push(n)
  }
  return map
})

function goToZoneMetrics(zone) {
  router.push({ path: '/dashboard/metrics', query: { zone: zone.zoneId } })
}

const visibleZoneGroups = computed(() => {
  if (!zoneFilterId.value) return nodeGroups.value.zoneGroups
  return nodeGroups.value.zoneGroups.filter((g) => g.zoneId === zoneFilterId.value)
})

const zoneFilterName = computed(
  () => dashboard.activeSiteZones.find((z) => z.zoneId === zoneFilterId.value)?.name || '',
)

function clearZoneFilter() {
  zoneFilterId.value = null
  router.replace({ path: '/dashboard/nodes' })
}

const siteStatusCounts = computed(() => {
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]))
  for (const node of dashboard.activeSiteNodes) {
    counts[node.status] = (counts[node.status] || 0) + 1
  }
  return counts
})

const hasActiveFilters = computed(() => Boolean(search.value.trim() || statusFilter.value || typeFilter.value))

const searchResults = computed(() => {
  const q = search.value.trim().toLowerCase()
  return dashboard.activeSiteNodes
    .filter((n) => !q || n.name.toLowerCase().includes(q) || n.ipAddress.includes(q))
    .filter((n) => !statusFilter.value || n.status === statusFilter.value)
    .filter((n) => !typeFilter.value || n.deviceType === typeFilter.value)
    .map((n) => ({ ...n, children: [] }))
})

function clearFilters() {
  search.value = ''
  statusFilter.value = ''
  typeFilter.value = ''
}

function childCountFor(node) {
  return dashboard.activeSiteNodes.filter((n) => n.parentNodeId === node.nodeId).length
}
</script>
