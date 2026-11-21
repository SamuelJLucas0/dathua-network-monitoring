<template>
  <div v-if="site" class="bg-dathua-card border rounded-2xl overflow-hidden" style="border-color: rgba(217,107,20,0.35);">
    <button
      type="button"
      class="w-full flex items-start gap-3.5 p-5 text-left cursor-pointer"
      @click="expanded = !expanded"
    >
      <span class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-dathua-orange/10 text-dathua-orange">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12 20.25h.008v.008H12v-.008z" />
        </svg>
      </span>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-white">{{ site.name }} todavía no está monitoreada</p>
        <p class="text-xs text-dathua-text-soft mt-1">
          {{ hasNodes
            ? 'Ya tienes equipos dados de alta, pero ninguno ha reportado datos — falta instalar el agente en esta sucursal.'
            : 'Instala el agente para que empiece a descubrir equipos y a reportar datos aquí.' }}
        </p>
      </div>
      <span class="text-xs font-semibold text-dathua-orange shrink-0 mt-1">
        {{ expanded ? 'Ocultar' : 'Ver cómo instalar →' }}
      </span>
    </button>

    <div v-if="expanded" class="border-t border-dathua-border/70 p-5 pt-4">
      <AgentSetupPanel :site="site" class="!p-0 !border-0 !bg-transparent" />
    </div>
  </div>
</template>

<script setup>
// Aviso compacto y reutilizable para las vistas que SÍ dependen de una
// sucursal en concreto (Métricas, Nodos, Incidentes, IA Sentinel) cuando
// esa sucursal existe pero ningún nodo ha reportado telemetría real
// todavía (isMonitored === false) — antes ese caso solo se explicaba en
// el Resumen (AgentSetupPanel a pantalla completa); en el resto de
// vistas el usuario solo veía "—"/"sin datos" repetido sin saber por qué.
// Empieza colapsado (no repetir el panel completo en cada pantalla) y se
// expande para mostrar las mismas instrucciones/llave que en el Resumen.
import { ref } from 'vue'
import AgentSetupPanel from './AgentSetupPanel.vue'

defineProps({
  site: { type: Object, default: null },
  hasNodes: { type: Boolean, default: false },
})

const expanded = ref(false)
</script>
