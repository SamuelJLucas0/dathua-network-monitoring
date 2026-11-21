<template>
  <div class="bg-dathua-card border border-dathua-border rounded-2xl p-6">
    <div class="flex items-start justify-between gap-4 mb-1">
      <h2 class="text-white font-semibold">Instala el agente en {{ site.name }}</h2>
      <span class="text-[10px] font-semibold uppercase tracking-wide text-dathua-orange bg-dathua-orange/10 border border-dathua-orange/30 rounded-full px-2.5 py-1 shrink-0">
        Paso 2
      </span>
    </div>
    <p class="text-dathua-text-soft text-xs mb-5">
      El agente corre dentro de la red de esta sucursal y le avisa a DatHua qué tan bien está conectada.
    </p>

    <ol class="space-y-4 mb-5">
      <li class="flex gap-3">
        <span class="w-5 h-5 rounded-full bg-dathua-bg border border-dathua-border text-[11px] flex items-center justify-center text-dathua-text-soft shrink-0 mt-0.5">1</span>
        <div class="flex-1 min-w-0">
          <p class="text-sm text-gray-300 mb-2">Instala DatHua Agent en una computadora de la sucursal que quede siempre encendida.</p>
          <router-link
            to="/dashboard/agent"
            class="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-dathua-orange text-white hover:bg-[#B45309] transition-colors duration-200"
            @click="dashboard.setActiveSite(site.siteId)"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
            Descargar para Windows o Linux
          </router-link>
        </div>
      </li>
      <li class="flex gap-3">
        <span class="w-5 h-5 rounded-full bg-dathua-bg border border-dathua-border text-[11px] flex items-center justify-center text-dathua-text-soft shrink-0 mt-0.5">2</span>
        <div class="flex-1 min-w-0">
          <p class="text-sm text-gray-300 mb-2">Cuando te pida una llave de sucursal, pega esta:</p>
          <div class="flex items-center gap-2">
            <code
              class="flex-1 min-w-0 truncate bg-dathua-bg border border-dathua-border rounded-lg px-3 py-2 text-xs text-dathua-orange font-mono"
            >{{ visibleKey || '••••••••••••••••••••••••••••••••••••••••' }}</code>
            <button
              type="button"
              class="shrink-0 text-xs font-semibold text-dathua-text-soft border border-dathua-border rounded-lg px-3 py-2 hover:text-white hover:border-white/30 transition-colors duration-200 cursor-pointer"
              @click="toggleKey"
            >
              {{ keyLoading ? '…' : visibleKey ? 'Ocultar' : 'Mostrar' }}
            </button>
            <button
              v-if="visibleKey"
              type="button"
              class="shrink-0 text-xs font-semibold text-dathua-text-soft border border-dathua-border rounded-lg px-3 py-2 hover:text-white hover:border-white/30 transition-colors duration-200 cursor-pointer"
              @click="copyKey"
            >
              {{ copied ? 'Copiada' : 'Copiar' }}
            </button>
          </div>
          <p v-if="keyError" class="text-xs text-red-400 mt-1.5">{{ keyError }}</p>
        </div>
      </li>
      <li class="flex gap-3">
        <span class="w-5 h-5 rounded-full bg-dathua-bg border border-dathua-border text-[11px] flex items-center justify-center text-dathua-text-soft shrink-0 mt-0.5">3</span>
        <p class="text-sm text-gray-300">El agente empieza a descubrir routers, switches y equipos en la red — aparecerán aquí abajo para que los apruebes.</p>
      </li>
    </ol>

    <!-- Lo que va encontrando el agente se muestra dentro de esta misma
         tarjeta, justo debajo del paso 3 — antes era una segunda tarjeta
         aparte, apilada debajo, que se sentía como dos pantallas distintas
         para un solo flujo. Una vez que la sucursal ya está monitoreada
         (este panel de instalación deja de mostrarse), lo que se siga
         descubriendo vuelve a su propia tarjeta — ver HomeView.vue. -->
    <DiscoveryCandidatesList
      v-if="candidates.length > 0"
      :site="site"
      :candidates="candidates"
      embedded
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../../stores/auth'
import { useDashboardStore } from '../../stores/dashboard'
import { getSiteApiKey } from '../../services/api'
import { copyText } from '../../utils/clipboard'
import DiscoveryCandidatesList from './DiscoveryCandidatesList.vue'

const props = defineProps({
  site: { type: Object, required: true },
  initialApiKey: { type: String, default: '' },
  candidates: { type: Array, default: () => [] },
})

const auth = useAuthStore()
const dashboard = useDashboardStore()

const visibleKey = ref(props.initialApiKey || '')
const keyLoading = ref(false)
const keyError = ref('')
const copied = ref(false)

async function toggleKey() {
  if (visibleKey.value) {
    visibleKey.value = ''
    return
  }
  keyLoading.value = true
  keyError.value = ''
  try {
    visibleKey.value = await getSiteApiKey(auth.token, props.site.siteId)
  } catch (e) {
    keyError.value = e.message
  } finally {
    keyLoading.value = false
  }
}

async function copyKey() {
  try {
    await copyText(visibleKey.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    keyError.value = 'No se pudo copiar automáticamente — selecciónala a mano.'
  }
}
</script>
