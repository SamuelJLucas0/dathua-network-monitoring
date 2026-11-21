<template>
  <div class="h-screen flex bg-dathua-bg overflow-hidden">
    <!-- ============================================
         SIDEBAR — desktop
    ============================================= -->
    <aside class="hidden lg:flex lg:w-64 h-full shrink-0 flex-col bg-dathua-card border-r border-dathua-border">
      <router-link to="/dashboard" class="flex items-center px-6 h-20 shrink-0">
        <img src="/logo.png" alt="DatHua" class="h-10 w-auto" />
      </router-link>

      <nav class="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        <template v-for="item in navItems" :key="item.label">
          <router-link
            v-if="!item.comingSoon"
            :to="item.to"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200"
            :class="isActive(item.to) ? 'bg-dathua-orange/10 text-dathua-orange' : 'text-dathua-text-soft hover:text-white hover:bg-white/5'"
          >
            <span class="relative w-5 h-5 shrink-0">
              <span v-html="item.icon"></span>
              <span v-if="hasNavBadge(item)" class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-dathua-orange"></span>
            </span>
            {{ item.label }}
          </router-link>
          <div v-else class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-dathua-text-soft/40 cursor-not-allowed">
            <span class="w-5 h-5 shrink-0" v-html="item.icon"></span>
            <span class="flex-1">{{ item.label }}</span>
            <span class="text-[10px] uppercase tracking-wide bg-white/5 border border-white/10 rounded-full px-2 py-0.5">Pronto</span>
          </div>
        </template>
      </nav>

      <div class="p-4 border-t border-dathua-border">
        <div class="bg-dathua-bg border border-dathua-border rounded-xl px-3.5 py-3">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-semibold text-white">{{ dashboard.usage?.planLabel || '—' }}</span>
            <span v-if="trialDays !== null" class="text-[10px] text-dathua-orange font-medium">{{ trialDays }} días</span>
          </div>
          <p class="text-xs text-dathua-text-soft">Prueba gratuita activa</p>
        </div>
      </div>
    </aside>

    <!-- ============================================
         SIDEBAR — mobile (slide-over)
    ============================================= -->
    <transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="mobileMenuOpen" class="lg:hidden fixed inset-0 z-40 bg-black/60" @click="mobileMenuOpen = false"></div>
    </transition>
    <transition
      enter-active-class="transition-transform duration-250 ease-out"
      enter-from-class="-translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform duration-200 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="-translate-x-full"
    >
      <aside v-if="mobileMenuOpen" class="lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-dathua-card border-r border-dathua-border flex flex-col">
        <div class="flex items-center justify-between px-6 h-20 shrink-0">
          <img src="/logo.png" alt="DatHua" class="h-10 w-auto" />
          <button type="button" class="text-dathua-text-soft" @click="mobileMenuOpen = false">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav class="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <template v-for="item in navItems" :key="item.label">
            <router-link
              v-if="!item.comingSoon"
              :to="item.to"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200"
              :class="isActive(item.to) ? 'bg-dathua-orange/10 text-dathua-orange' : 'text-dathua-text-soft hover:text-white hover:bg-white/5'"
              @click="mobileMenuOpen = false"
            >
              <span class="relative w-5 h-5 shrink-0">
                <span v-html="item.icon"></span>
                <span v-if="hasNavBadge(item)" class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-dathua-orange"></span>
              </span>
              {{ item.label }}
            </router-link>
            <div v-else class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-dathua-text-soft/40">
              <span class="w-5 h-5 shrink-0" v-html="item.icon"></span>
              <span class="flex-1">{{ item.label }}</span>
              <span class="text-[10px] uppercase tracking-wide bg-white/5 border border-white/10 rounded-full px-2 py-0.5">Pronto</span>
            </div>
          </template>
        </nav>
      </aside>
    </transition>

    <!-- ============================================
         COLUMNA PRINCIPAL
    ============================================= -->
    <div class="flex-1 h-full flex flex-col overflow-hidden">
      <!-- Topbar -->
      <header class="h-20 shrink-0 border-b border-dathua-border flex items-center justify-between gap-4 px-4 sm:px-6">
        <div class="flex items-center gap-3 min-w-0">
          <button type="button" class="lg:hidden w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-dathua-text-soft hover:bg-white/5" @click="mobileMenuOpen = true">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <!-- Selector de sucursal: solo en las pantallas que de verdad
               dependen de "la sucursal activa" (Métricas, Nodos,
               Incidentes, IA Sentinel, Reportes). En Resumen y Sucursales
               y zonas ese selector no pintaba nada — Resumen tiene su
               propio filtro "Viendo:" y Sucursales y zonas ya muestra
               todas a la vez — así que ahí se muestra el nombre de la
               organización en su lugar. -->
          <div v-if="showSiteSwitcher && dashboard.sites.length" class="relative">
            <button
              type="button"
              class="flex items-center gap-2 pl-3 pr-2.5 py-2 rounded-lg bg-dathua-card border border-dathua-border text-sm text-white hover:border-dathua-orange/40 transition-colors duration-200 max-w-[200px] sm:max-w-none"
              @click="siteMenuOpen = !siteMenuOpen"
            >
              <span class="w-1.5 h-1.5 rounded-full shrink-0" :style="{ backgroundColor: activeSiteColor }"></span>
              <span class="truncate">{{ dashboard.activeSite?.name || 'Sucursal' }}</span>
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
              <div v-if="siteMenuOpen" class="absolute left-0 top-full mt-2 w-56 bg-dathua-card border border-dathua-border rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] overflow-hidden z-30">
                <button
                  v-for="site in dashboard.sites"
                  :key="site.siteId"
                  type="button"
                  class="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-left hover:bg-white/5 transition-colors duration-150"
                  :class="site.siteId === dashboard.activeSiteId ? 'text-dathua-orange' : 'text-gray-300'"
                  @click="selectSite(site.siteId)"
                >
                  <span class="truncate">{{ site.name }}</span>
                  <svg v-if="site.siteId === dashboard.activeSiteId" class="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                  </svg>
                </button>
              </div>
            </transition>
          </div>
          <div v-else-if="dashboard.usage?.organization" class="flex items-center gap-2 px-1 text-sm font-medium text-white truncate">
            <svg class="w-4 h-4 text-dathua-text-soft shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2M5 21H3m16 0h-6M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 6v-3a1 1 0 011-1h1a1 1 0 011 1v3" />
            </svg>
            <span class="truncate">{{ dashboard.usage.organization }}</span>
          </div>
        </div>

        <div class="flex items-center gap-3 shrink-0">
          <span v-if="trialDays !== null" class="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-dathua-orange bg-dathua-orange/10 border border-dathua-orange/30 rounded-full px-3 py-1.5">
            {{ trialDays }} días de prueba
          </span>

          <NotificationBell />

          <div class="relative">
            <button
              type="button"
              class="w-10 h-10 rounded-full bg-dathua-orange/15 border border-dathua-orange/30 flex items-center justify-center text-sm font-semibold text-dathua-orange hover:border-dathua-orange/60 transition-colors duration-200"
              @click="userMenuOpen = !userMenuOpen"
            >
              {{ initials }}
            </button>
            <transition
              enter-active-class="transition-all duration-150 ease-out"
              enter-from-class="opacity-0 -translate-y-1"
              enter-to-class="opacity-100 translate-y-0"
              leave-active-class="transition-all duration-100 ease-in"
              leave-from-class="opacity-100 translate-y-0"
              leave-to-class="opacity-0 -translate-y-1"
            >
              <div v-if="userMenuOpen" class="absolute right-0 top-full mt-2 w-60 bg-dathua-card border border-dathua-border rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] overflow-hidden z-30">
                <div class="px-4 py-3 border-b border-dathua-border">
                  <p class="text-sm font-medium text-white truncate">{{ auth.user?.name }}</p>
                  <p class="text-xs text-dathua-text-soft truncate">{{ auth.user?.email }}</p>
                </div>
                <router-link
                  to="/dashboard/profile"
                  class="flex items-center gap-2.5 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 transition-colors duration-150"
                  @click="userMenuOpen = false"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Mi perfil
                </router-link>
                <button type="button" class="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 transition-colors duration-150" @click="handleLogout">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Cerrar sesión
                </button>
              </div>
            </transition>
          </div>
        </div>
      </header>

      <main class="flex-1 overflow-y-auto">
        <div class="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
          <router-view />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, watch, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useDashboardStore } from '../stores/dashboard'
import { useNotificationStore } from '../stores/notifications'
import { ROLE_COLOR, NODE_STATUS } from '../utils/status'
import { connectSocket, joinSite, disconnectSocket } from '../services/socket'
import NotificationBell from '../components/dashboard/NotificationBell.vue'

const ICONS = {
  home: '<svg class="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h4a1 1 0 001-1V10" /></svg>',
  chart: '<svg class="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3v18h18M8 17V10m5 7V6m5 11v-4" /></svg>',
  nodes: '<svg class="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 3H4v5h5V3zM20 3h-5v5h5V3zM9 16H4v5h5v-5zM20 16h-5v5h5v-5zM6.5 8v5m11-5v5M9 18.5h6M9 5.5h6" /></svg>',
  alert: '<svg class="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>',
  brain: '<svg class="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>',
  building: '<svg class="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2M5 21H3m16 0h-6M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 6v-3a1 1 0 011-1h1a1 1 0 011 1v3" /></svg>',
  doc: '<svg class="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>',
  download: '<svg class="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>',
}

const navItems = [
  { label: 'Resumen', to: '/dashboard', icon: ICONS.home },
  { label: 'Métricas en vivo', to: '/dashboard/metrics', icon: ICONS.chart },
  { label: 'Nodos y topología', to: '/dashboard/nodes', icon: ICONS.nodes },
  // `badge` marca qué contador de la organización (ver dashboard.js,
  // siempre de TODA la organización, sin importar filtros) enciende el
  // puntito de "hay algo nuevo" junto al nombre del ítem.
  { label: 'Incidentes', to: '/dashboard/incidents', icon: ICONS.alert, badge: 'incidents' },
  { label: 'IA Sentinel', to: '/dashboard/ai-analytics', icon: ICONS.brain, badge: 'ai' },
  { label: 'Sucursales y zonas', to: '/dashboard/sites', icon: ICONS.building },
  { label: 'Reportes', to: '/dashboard/reports', icon: ICONS.doc },
  { label: 'Instalar agente', to: '/dashboard/agent', icon: ICONS.download },
]

// true = hay al menos un incidente activo (Incidentes) o una anomalía
// pendiente de revisar (IA Sentinel) en CUALQUIER sucursal de la
// organización — independiente del filtro del Resumen y de la sucursal
// activa, para que el aviso no se pierda solo porque el usuario está
// viendo otra cosa.
function hasNavBadge(item) {
  if (item.badge === 'incidents') return dashboard.orgIncidentActiveCount > 0
  if (item.badge === 'ai') return dashboard.orgAnomalyPendingCount > 0
  return false
}

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const dashboard = useDashboardStore()
const notifications = useNotificationStore()

const mobileMenuOpen = ref(false)
const siteMenuOpen = ref(false)
const userMenuOpen = ref(false)

function isActive(to) {
  return route.path === to
}

const initials = computed(() => {
  const name = auth.user?.name || ''
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || 'U'
})

const trialDays = computed(() => dashboard.usage?.daysLeftInTrial ?? null)

// Rutas que NO dependen de "la sucursal activa" del selector de arriba —
// Resumen tiene su propio filtro local ("Viendo:") y Sucursales y zonas
// ya muestra todas las sucursales a la vez, así que el selector global no
// aportaba nada ahí (y confundía, porque parecía otro filtro más).
const NO_SITE_SWITCHER_PATHS = ['/dashboard', '/dashboard/sites', '/dashboard/profile', '/dashboard/notifications']
const showSiteSwitcher = computed(() => !NO_SITE_SWITCHER_PATHS.includes(route.path))

const activeSiteColor = computed(() => {
  const nodes = dashboard.nodesBySite[dashboard.activeSiteId] || []
  if (nodes.some((n) => n.status === 'Critical')) return ROLE_COLOR.critical
  if (nodes.some((n) => n.status === 'Offline')) return ROLE_COLOR.serious
  if (nodes.some((n) => n.status === 'Warning')) return ROLE_COLOR.warning
  return ROLE_COLOR[NODE_STATUS.Online.role]
})

function selectSite(siteId) {
  dashboard.setActiveSite(siteId)
  siteMenuOpen.value = false
}

function handleLogout() {
  disconnectSocket()
  auth.logout()
  dashboard.reset()
  notifications.reset()
  router.push('/login')
}

// Conecta una sola vez por sesión, se une a la sala de la sucursal activa
// (y se cambia de sala si el usuario cambia de sucursal desde el selector),
// y reacciona a los eventos en vivo que emite el backend: telemetría
// nueva, incidente nuevo, anomalía de IA nueva, y notificación personal
// (esta última llega sin importar qué sucursal esté viendo el usuario —
// vive en su propia sala `user_${userId}`, no en la de una sucursal). Sin
// esto, el dashboard solo se actualizaba al recargar o cambiar de filtro.
function setupLiveUpdates() {
  const socket = connectSocket(auth.token)

  socket.on('telemetry:new', (docs) => dashboard.applyTelemetryUpdate(docs))
  socket.on('incident:new', () => {
    dashboard.refreshIncidentSummary(auth.token)
    dashboard.bumpIncidentTick()
  })
  socket.on('anomaly:new', () => {
    dashboard.refreshAiSummary(auth.token)
    dashboard.bumpAnomalyTick()
  })
  socket.on('notification:new', (notification) => notifications.receiveLive(notification))
  // El agente terminó un ciclo de descubrimiento y reportó candidatos —
  // el Resumen observa este contador para refrescar "Equipos
  // descubiertos" solo, sin que el usuario tenga que recargar la página.
  socket.on('discovery:new', (payload) => dashboard.bumpDiscoveryTick(payload?.pendingCount ?? null))

  if (dashboard.activeSiteId) joinSite(dashboard.activeSiteId)
}

watch(
  () => dashboard.activeSiteId,
  (siteId) => joinSite(siteId),
)

onMounted(async () => {
  if (!dashboard.loaded) await dashboard.fetchAll(auth.token)
  if (!notifications.loaded) notifications.fetchRecent(auth.token)
  setupLiveUpdates()
})

onUnmounted(() => {
  disconnectSocket()
})
</script>
