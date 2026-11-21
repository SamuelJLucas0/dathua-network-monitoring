<template>
  <div v-if="explanation" class="mt-1">
    <!-- `showSummary`: en IA Sentinel no hay ningún otro texto en español
         simple sobre la anomalía, así que la frase "qué está pasando" va
         siempre visible. En Incidentes ya viene igual de clara dentro de
         `incident.message` (armado por incidentCopy.js en el backend), así
         que aquí solo se agrega el detalle de causas/sugerencia para no
         repetir la misma oración dos veces.

         Este componente es de USO EXCLUSIVO EN ESCRITORIO (>=640px) — quien
         lo usa ya lo envuelve en un `hidden sm:flex`/`sm:block`. En móvil,
         cada vista arma su propia tarjeta compacta + panel de detalle con
         TODA la información junta (no solo esta explicación) — ver
         `mobileAnomaly`/`mobileIncident` en AiSentinelView.vue e
         IncidentsView.vue. -->
    <p v-if="showSummary" class="text-xs text-gray-300">{{ explanation.what }}</p>
    <p v-if="showSummary && explanation.urgency" class="text-xs text-dathua-text-soft mt-0.5">{{ explanation.urgency }}</p>

    <button
      type="button"
      class="text-xs font-semibold text-dathua-orange hover:text-white transition-colors duration-150 cursor-pointer mt-1.5 flex items-center gap-1"
      @click="open = !open"
    >
      <svg class="w-3 h-3 transition-transform duration-150 shrink-0" :class="{ 'rotate-90': open }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
      </svg>
      {{ open ? 'Ocultar' : '¿Qué puedo hacer?' }}
    </button>

    <div v-if="open" class="mt-2 bg-white/5 border border-dathua-border rounded-lg px-3 py-2.5 space-y-2">
      <div>
        <p class="text-[11px] font-semibold text-dathua-text-soft uppercase tracking-wide">Causas probables</p>
        <ul class="text-xs text-gray-300 list-disc list-inside space-y-0.5 mt-1">
          <li v-for="(cause, i) in explanation.causes" :key="i">{{ cause }}</li>
        </ul>
      </div>
      <p class="text-xs text-gray-300">
        <span class="font-semibold text-white">Qué hacer: </span>{{ explanation.suggestion }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { getExplanation } from '../../utils/incidentExplanations'

const props = defineProps({
  metricAnalyzed: { type: String, default: null },
  severity: { type: String, default: null },
  showSummary: { type: Boolean, default: true },
})

const open = ref(false)
const explanation = computed(() => (props.metricAnalyzed ? getExplanation(props.metricAnalyzed, props.severity) : null))
</script>
