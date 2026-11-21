<template>
  <!-- `embedded`: sin tarjeta ni encabezado propios — se usa dentro de la
       tarjeta de "Instala el agente" (justo debajo del paso 3), mientras
       la sucursal está en onboarding. Sin `embedded`, es su propia
       tarjeta — así se ve una vez que la sucursal ya quedó monitoreada y
       el panel de instalación deja de mostrarse, pero el agente sigue
       descubriendo equipos nuevos con el tiempo. -->
  <div :class="embedded ? 'pt-4 mt-1 border-t border-dathua-border' : 'bg-dathua-card border border-dathua-border rounded-2xl p-6'">
    <div class="flex items-center justify-between mb-1 gap-3 flex-wrap">
      <h2 :class="embedded ? 'text-sm text-white font-semibold' : 'text-white font-semibold'">Equipos descubiertos</h2>
      <span
        v-if="candidates.length"
        class="text-[10px] font-semibold uppercase tracking-wide text-status-warning bg-status-warning/15 rounded-full px-2.5 py-1 shrink-0"
      >
        {{ candidates.length }} por revisar
      </span>
    </div>
    <p v-if="!embedded" class="text-dathua-text-soft text-xs mb-5">
      El agente los encontró en la red de {{ site.name }}. Aprueba los que quieras monitorear.
    </p>

    <div v-if="candidates.length === 0 && !embedded" class="text-sm text-dathua-text-soft py-8 text-center">
      Sin equipos nuevos por ahora — el agente sigue buscando en segundo plano.
    </div>

    <template v-else-if="candidates.length > 0">
      <!-- Mini buscador — solo vale la pena mostrarlo si hay más de una
           página, para no meter ruido cuando son 1-2 equipos. -->
      <div v-if="candidates.length > PAGE_SIZE" class="relative mb-3" :class="embedded ? 'mt-3' : ''">
        <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-dathua-text-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          v-model="search"
          type="text"
          placeholder="Buscar por nombre, IP, MAC o tipo…"
          class="w-full bg-dathua-bg border border-dathua-border rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-dathua-orange"
        />
      </div>

      <p v-if="filteredCandidates.length === 0" class="text-sm text-dathua-text-soft py-8 text-center">
        Ningún equipo descubierto coincide con "{{ search }}".
        <button type="button" class="text-dathua-orange hover:text-white font-semibold cursor-pointer" @click="search = ''">Limpiar búsqueda</button>
      </p>

      <ul v-else class="grid grid-cols-1 lg:grid-cols-2 gap-3" :class="embedded && candidates.length <= PAGE_SIZE ? 'mt-3' : ''">
        <li
          v-for="candidate in pagedCandidates"
          :key="candidate.candidateId"
          class="flex items-start gap-3 border border-dathua-border rounded-xl p-4"
        >
          <span
            class="w-9 h-9 rounded-lg bg-white/5 border border-dathua-border flex items-center justify-center p-2 shrink-0 text-dathua-text-soft"
            v-html="DEVICE_ICONS[candidate.suggestedDeviceType] || DEVICE_ICONS.endpoint"
          ></span>
          <div class="min-w-0 flex-1">
            <p class="text-sm text-white font-medium truncate">
              {{ candidate.hostname || 'Equipo desconocido' }}
            </p>
            <div class="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 mt-0.5 text-xs text-dathua-text-soft">
              <span>{{ formatDeviceType(candidate.suggestedDeviceType) }}</span>
              <span v-if="candidate.suggestedVendor">· {{ candidate.suggestedVendor }}</span>
              <span class="font-mono text-dathua-text-soft/70">· {{ candidate.ipAddress }}</span>
              <span v-if="candidate.macAddress" class="font-mono text-dathua-text-soft/60 hidden sm:inline">
                · {{ candidate.macAddress }}
              </span>
            </div>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <button
              type="button"
              title="Aprobar y monitorear"
              class="w-8 h-8 rounded-lg flex items-center justify-center text-status-good hover:bg-status-good/10 transition-colors duration-150 cursor-pointer disabled:opacity-50"
              :disabled="busyId === candidate.candidateId"
              @click="approvingCandidate = candidate"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <button
              type="button"
              title="Ignorar"
              class="w-8 h-8 rounded-lg flex items-center justify-center text-dathua-text-soft hover:text-red-400 hover:bg-red-500/10 transition-colors duration-150 cursor-pointer disabled:opacity-50"
              :disabled="busyId === candidate.candidateId"
              @click="reject(candidate)"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </li>
      </ul>

      <!-- Paginación — de PAGE_SIZE en PAGE_SIZE (6, cuadra bien en la
           rejilla de 2 columnas: 3 filas por página). Solo aparece si de
           verdad hay más de una página. -->
      <div v-if="totalPages > 1" class="flex items-center justify-between gap-3 mt-4">
        <button
          type="button"
          class="text-xs font-semibold text-dathua-text-soft hover:text-white transition-colors duration-150 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-dathua-text-soft"
          :disabled="page === 1"
          @click="page--"
        >
          ← Anterior
        </button>
        <span class="text-xs text-dathua-text-soft">Página {{ page }} de {{ totalPages }}</span>
        <button
          type="button"
          class="text-xs font-semibold text-dathua-text-soft hover:text-white transition-colors duration-150 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-dathua-text-soft"
          :disabled="page === totalPages"
          @click="page++"
        >
          Siguiente →
        </button>
      </div>
    </template>

    <p v-if="rowError" class="text-xs text-red-400 mt-3">{{ rowError }}</p>
  </div>

  <!-- Mismo panel que "+ Nuevo equipo" en Dispositivos y topología — solo
       que precargado con lo que el agente ya detectó (nombre sugerido,
       IP/MAC fijas) y aprobando el candidato en vez de crear uno libre. -->
  <NodeFormModal
    v-if="approvingCandidate"
    :site="site"
    :zones="dashboard.zonesBySite[site.siteId] || []"
    :nodes="dashboard.nodesBySite[site.siteId] || []"
    :candidate="approvingCandidate"
    @close="approvingCandidate = null"
    @created="approvingCandidate = null"
  />
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useDashboardStore } from '../../stores/dashboard'
import { formatDeviceType } from '../../utils/metrics'
import { DEVICE_ICONS } from '../../utils/deviceIcons'
import NodeFormModal from './nodes/NodeFormModal.vue'

const props = defineProps({
  site: { type: Object, required: true },
  candidates: { type: Array, required: true },
  embedded: { type: Boolean, default: false },
})

const auth = useAuthStore()
const dashboard = useDashboardStore()

const approvingCandidate = ref(null)
const busyId = ref(null)
const rowError = ref('')

// 6 por página: se ve bien tanto en la rejilla de 2 columnas (3 filas)
// como en 1 columna en pantallas angostas, sin quedar ni muy corta ni muy
// larga para hacer scroll.
const PAGE_SIZE = 6
const search = ref('')
const page = ref(1)

const filteredCandidates = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return props.candidates
  return props.candidates.filter((c) => {
    const haystack = [
      c.hostname,
      c.ipAddress,
      c.macAddress,
      c.suggestedVendor,
      formatDeviceType(c.suggestedDeviceType),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredCandidates.value.length / PAGE_SIZE)))

const pagedCandidates = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return filteredCandidates.value.slice(start, start + PAGE_SIZE)
})

// Si al buscar (o al aprobar/rechazar un equipo) la página actual deja de
// existir, no te quedes "varado" viendo una lista vacía — regresa a la
// última página real.
watch([filteredCandidates, totalPages], () => {
  if (page.value > totalPages.value) page.value = totalPages.value
})
watch(search, () => {
  page.value = 1
})

async function reject(candidate) {
  busyId.value = candidate.candidateId
  rowError.value = ''
  try {
    await dashboard.rejectCandidate(auth.token, candidate.candidateId, props.site.siteId)
  } catch (e) {
    rowError.value = e.message
  } finally {
    busyId.value = null
  }
}
</script>
