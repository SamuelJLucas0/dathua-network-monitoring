<template>
  <div v-if="agentSeemsOffline" class="bg-dathua-card border rounded-2xl p-5 flex items-start gap-3.5" style="border-color: rgba(250,178,25,0.35);">
    <span class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style="background: rgba(250,178,25,0.12); color: #FAB219;">
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
        <path stroke-linecap="round" stroke-linejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12 20.25h.008v.008H12v-.008z" />
      </svg>
    </span>
    <div>
      <p class="text-sm font-semibold text-white">No hemos recibido datos de {{ site.name }}</p>
      <p class="text-xs text-dathua-text-soft mt-1">
        {{ site.lastTelemetryAt
          ? `Última telemetría recibida ${formatRelativeTime(site.lastTelemetryAt)}.`
          : 'Nunca hemos recibido telemetría de esta sucursal.' }}
        Esto suele significar que el agente dejó de correr (se cerró la ventana, se apagó el equipo), no que la red
        esté caída — si la red estuviera caída pero el agente siguiera activo, seguiríamos recibiendo reportes de
        "sin respuesta".
      </p>
    </div>
  </div>
</template>

<script setup>
// Componente compartido: antes este banner solo vivía en el Resumen, pero
// el Resumen pasó a ser una vista general de TODA la organización (ver
// HomeView.vue) donde "esta sucursal no reporta" ya no encaja como
// mensaje por default — un banner por sucursal pertenece a las pantallas
// que sí están mirando una sucursal en concreto. Se usa en Métricas,
// Nodos y topología, Incidentes, IA Sentinel y Sucursales y zonas (con la
// sucursal correspondiente de cada vista).
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { formatRelativeTime } from '../../utils/time'

const props = defineProps({
  site: { type: Object, default: null },
  // "Monitoreada" = al menos un nodo ya reportó telemetría real alguna
  // vez. Antes de eso (recién dada de alta, agente nunca instalado) no
  // tiene sentido avisar que "dejó de reportar" — nunca reportó.
  isMonitored: { type: Boolean, default: false },
})

const AGENT_SILENCE_THRESHOLD_MS = 3 * 60 * 1000

// Sin esto, el banner solo se recalcularía cuando cambie algo reactivo del
// store — pero si el agente de verdad dejó de reportar, ningún evento
// nuevo llega para disparar ese recálculo. Este "tick" fuerza que el
// tiempo transcurrido se re-evalúe cada 30s aunque no pase nada más.
const nowTick = ref(Date.now())
let nowTimer = null

const agentSeemsOffline = computed(() => {
  if (!props.site || !props.isMonitored) return false
  const last = props.site.lastTelemetryAt
  if (!last) return true
  return nowTick.value - new Date(last).getTime() > AGENT_SILENCE_THRESHOLD_MS
})

onMounted(() => {
  nowTimer = setInterval(() => (nowTick.value = Date.now()), 30000)
})
onUnmounted(() => {
  if (nowTimer) clearInterval(nowTimer)
})
</script>
