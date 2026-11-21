<template>
  <div v-if="dashboard.loading && !dashboard.loaded" class="flex items-center justify-center py-24">
    <span class="w-8 h-8 rounded-full border-2 border-dathua-border border-t-dathua-orange animate-spin"></span>
  </div>

  <OnboardingEmptyState v-else-if="dashboard.sites.length === 0" @create="showCreateSite = true" />

  <div v-else class="space-y-6">
    <div class="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h1 class="font-heading text-2xl font-bold text-white">Sucursales y zonas</h1>
        <p class="text-dathua-text-soft text-sm mt-1">
          {{ dashboard.sites.length }} / {{ dashboard.usage?.limits.maxSites }} sucursales de tu plan {{ dashboard.usage?.planLabel }}.
        </p>
      </div>
      <button
        v-if="atSiteLimit && isMaxPlan"
        type="button"
        disabled
        title="Ya tienes el plan con más sucursales disponible"
        class="px-4 py-2.5 rounded-lg text-sm font-semibold text-dathua-text-soft border border-dathua-border opacity-60 cursor-not-allowed shrink-0"
      >
        Límite alcanzado
      </button>
      <button
        v-else
        type="button"
        class="px-4 py-2.5 rounded-lg text-sm font-semibold bg-dathua-orange text-white hover:bg-[#B45309] transition-colors duration-200 cursor-pointer shrink-0"
        @click="openCreateSite"
      >
        {{ atSiteLimit ? 'Mejorar plan' : '+ Nueva sucursal' }}
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div v-for="site in dashboard.sites" :key="site.siteId" class="bg-dathua-card border border-dathua-border rounded-2xl p-6">
        <div class="flex items-start justify-between gap-3 mb-1">
          <h2 class="text-white font-semibold truncate">{{ site.name }}</h2>
          <div class="flex items-center gap-2 shrink-0">
            <MaintenanceControl
              label="Silenciar alertas de esta sucursal"
              :maintenance-mode="site.maintenanceMode"
              :maintenance-until="site.maintenanceUntil"
              :busy="maintenanceBusyId === site.siteId"
              @silence="(minutes) => silenceSite(site, minutes)"
              @clear="() => clearSiteSilence(site)"
            />
            <SiteCardMenu
              @edit="editingSite = site"
              @apikey="apiKeySite = site"
              @delete="deletingSite = site"
            />
          </div>
        </div>
        <p class="text-dathua-text-soft text-xs mb-4">{{ site.address || 'Sin dirección registrada' }}</p>

        <div class="flex items-center gap-2 mb-4">
          <span class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: siteHealthColor(site.siteId) }"></span>
          <span class="text-xs font-medium text-white">{{ siteHealthLabel(site.siteId) }}</span>
          <span class="text-dathua-text-soft text-xs">·</span>
          <span class="text-xs text-dathua-text-soft">{{ (dashboard.nodesBySite[site.siteId] || []).length }} equipo(s)</span>
          <span class="text-dathua-text-soft text-xs">·</span>
          <span class="text-xs text-dathua-text-soft">{{ (dashboard.zonesBySite[site.siteId] || []).length }} zona(s)</span>
        </div>

        <AgentOfflineBanner :site="site" :is-monitored="siteIsMonitored(site.siteId)" class="mb-4" />

        <div class="border-t border-dathua-border pt-4 mb-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-dathua-text-soft">Zonas</h3>
            <button
              type="button"
              class="text-xs font-semibold text-dathua-orange hover:text-white transition-colors duration-200 cursor-pointer"
              @click="zoneModalSite = site"
            >
              + Nueva zona
            </button>
          </div>
          <ZoneChipList
            :zones="dashboard.zonesBySite[site.siteId] || []"
            :nodes-by-zone="nodesByZoneFor(site.siteId)"
            show-view
            @view="(z) => goToZoneMetrics(site, z)"
            @edit="(z) => (editingZone = { zone: z, site })"
            @delete="(z) => (deletingZone = { zone: z, site })"
          />
        </div>

        <button
          type="button"
          class="w-full py-2.5 rounded-lg text-sm font-semibold text-dathua-text-soft border border-dathua-border hover:text-white hover:border-dathua-orange/40 transition-colors duration-200 cursor-pointer"
          @click="goToNodes(site)"
        >
          Ver equipos →
        </button>
      </div>
    </div>
  </div>

  <CreateSiteModal v-if="showCreateSite" @close="showCreateSite = false" @created="showCreateSite = false" />
  <UpgradePlanModal v-if="showUpgradePlan" @close="showUpgradePlan = false" />
  <EditSiteModal v-if="editingSite" :site="editingSite" @close="editingSite = null" @saved="editingSite = null" />
  <ApiKeyModal v-if="apiKeySite" :site="apiKeySite" @close="apiKeySite = null" />
  <DeleteSiteDialog v-if="deletingSite" :site="deletingSite" @close="deletingSite = null" @deleted="deletingSite = null" />

  <ZoneFormModal v-if="zoneModalSite" :site="zoneModalSite" @close="zoneModalSite = null" @created="zoneModalSite = null" />
  <ZoneFormModal
    v-if="editingZone"
    :site="editingZone.site"
    :zone="editingZone.zone"
    @close="editingZone = null"
    @saved="editingZone = null"
  />
  <DeleteZoneDialog
    v-if="deletingZone"
    :zone="deletingZone.zone"
    :site-id="deletingZone.site.siteId"
    @close="deletingZone = null"
    @deleted="deletingZone = null"
  />
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { useDashboardStore } from '../../stores/dashboard'
import * as api from '../../services/api'
import { ROLE_COLOR } from '../../utils/status'
import OnboardingEmptyState from '../../components/dashboard/OnboardingEmptyState.vue'
import CreateSiteModal from '../../components/dashboard/CreateSiteModal.vue'
import EditSiteModal from '../../components/dashboard/EditSiteModal.vue'
import DeleteSiteDialog from '../../components/dashboard/DeleteSiteDialog.vue'
import ApiKeyModal from '../../components/dashboard/ApiKeyModal.vue'
import SiteCardMenu from '../../components/dashboard/SiteCardMenu.vue'
import UpgradePlanModal from '../../components/dashboard/UpgradePlanModal.vue'
import ZoneChipList from '../../components/dashboard/nodes/ZoneChipList.vue'
import ZoneFormModal from '../../components/dashboard/nodes/ZoneFormModal.vue'
import DeleteZoneDialog from '../../components/dashboard/nodes/DeleteZoneDialog.vue'
import MaintenanceControl from '../../components/dashboard/MaintenanceControl.vue'
import AgentOfflineBanner from '../../components/dashboard/AgentOfflineBanner.vue'

const router = useRouter()
const auth = useAuthStore()
const dashboard = useDashboardStore()

const showCreateSite = ref(false)
const showUpgradePlan = ref(false)
const editingSite = ref(null)
const apiKeySite = ref(null)
const deletingSite = ref(null)
const zoneModalSite = ref(null)
const editingZone = ref(null)
const deletingZone = ref(null)
const maintenanceBusyId = ref(null)

async function silenceSite(site, minutes) {
  maintenanceBusyId.value = site.siteId
  try {
    const res = await api.setSiteMaintenance(auth.token, site.siteId, minutes)
    site.maintenanceMode = res.maintenanceMode
    site.maintenanceUntil = res.maintenanceUntil
  } finally {
    maintenanceBusyId.value = null
  }
}

async function clearSiteSilence(site) {
  maintenanceBusyId.value = site.siteId
  try {
    await api.clearSiteMaintenance(auth.token, site.siteId)
    site.maintenanceMode = false
    site.maintenanceUntil = null
  } finally {
    maintenanceBusyId.value = null
  }
}

const atSiteLimit = computed(
  () => dashboard.sites.length >= (dashboard.usage?.limits.maxSites ?? Infinity),
)
const isMaxPlan = computed(() => dashboard.usage?.plan === 'PRO')

function openCreateSite() {
  if (atSiteLimit.value) {
    showUpgradePlan.value = true
  } else {
    showCreateSite.value = true
  }
}

function siteHealthRole(siteId) {
  const nodes = dashboard.nodesBySite[siteId] || []
  if (nodes.length === 0) return 'neutral'
  if (nodes.some((n) => n.status === 'Critical')) return 'critical'
  if (nodes.some((n) => n.status === 'Offline')) return 'serious'
  if (nodes.some((n) => n.status === 'Warning')) return 'warning'
  // Distinto de "sin equipos": aquí sí hay equipos dados de alta, pero
  // ninguno ha reportado telemetría real todavía — antes ambos casos
  // mostraban el mismo texto ("Sin equipos aún"), lo cual era engañoso
  // para alguien que ya dio de alta equipos y solo le falta el agente.
  if (nodes.every((n) => n.status === 'Unknown')) return 'pending'
  return 'good'
}

const HEALTH_LABEL = {
  good: 'Todo en línea',
  warning: 'Con advertencias',
  serious: 'Equipos fuera de línea',
  critical: 'Estado crítico',
  pending: 'Falta instalar el agente',
  neutral: 'Sin equipos aún',
}

const HEALTH_COLOR = { ...ROLE_COLOR, pending: ROLE_COLOR.warning }

// "Monitoreada" = al menos un nodo ya reportó telemetría real alguna vez
// — usado por AgentOfflineBanner para no avisar "dejó de reportar" en una
// sucursal que nunca reportó nada.
function siteIsMonitored(siteId) {
  const nodes = dashboard.nodesBySite[siteId] || []
  return nodes.length > 0 && nodes.some((n) => n.status !== 'Unknown')
}

function siteHealthColor(siteId) {
  return HEALTH_COLOR[siteHealthRole(siteId)]
}

function siteHealthLabel(siteId) {
  return HEALTH_LABEL[siteHealthRole(siteId)]
}

function nodesByZoneFor(siteId) {
  const nodes = dashboard.nodesBySite[siteId] || []
  const map = {}
  for (const n of nodes) {
    if (!n.zoneId) continue
    if (!map[n.zoneId]) map[n.zoneId] = []
    map[n.zoneId].push(n)
  }
  return map
}

function goToNodes(site, zone) {
  dashboard.setActiveSite(site.siteId)
  router.push(zone ? { path: '/dashboard/nodes', query: { zone: zone.zoneId } } : '/dashboard/nodes')
}

function goToZoneMetrics(site, zone) {
  dashboard.setActiveSite(site.siteId)
  router.push({ path: '/dashboard/metrics', query: { zone: zone.zoneId } })
}
</script>
