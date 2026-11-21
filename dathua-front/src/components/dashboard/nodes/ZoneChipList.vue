<template>
  <div v-if="zones.length === 0" class="text-sm text-dathua-text-soft py-6 text-center">
    Todavía no tienes zonas en esta sucursal — son opcionales.
  </div>
  <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div
      v-for="zone in zones"
      :key="zone.zoneId"
      class="border border-dathua-border rounded-xl p-4 hover:border-dathua-orange/30 transition-colors duration-200"
    >
      <div class="flex items-start justify-between gap-2 mb-1">
        <div class="flex items-center gap-2.5 min-w-0">
          <span
            class="w-9 h-9 rounded-lg bg-white/5 border border-dathua-border flex items-center justify-center p-2 shrink-0 text-dathua-text-soft"
            v-html="ZONE_ICONS[zone.icon] || ZONE_ICONS.building"
          ></span>
          <div class="min-w-0">
            <p class="text-white font-semibold text-sm truncate">{{ zone.name }}</p>
            <p class="text-dathua-text-soft text-xs">{{ zone.totalNodes || 0 }} equipo{{ zone.totalNodes === 1 ? '' : 's' }}</p>
          </div>
        </div>
        <div class="flex items-center gap-0.5 shrink-0">
          <span
            class="w-2.5 h-2.5 rounded-full shrink-0 mr-1"
            :style="{ backgroundColor: healthColor(zone.zoneId) }"
            :title="healthLabel(zone.zoneId)"
          ></span>
          <button
            type="button"
            class="w-7 h-7 rounded-full flex items-center justify-center text-dathua-text-soft hover:text-white hover:bg-white/5 cursor-pointer"
            title="Editar zona"
            @click="$emit('edit', zone)"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            type="button"
            class="w-7 h-7 rounded-full flex items-center justify-center text-dathua-text-soft hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
            title="Eliminar zona"
            @click="$emit('delete', zone)"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <p v-if="zone.description" class="text-dathua-text-soft text-xs mb-3 line-clamp-2">{{ zone.description }}</p>

      <div v-if="(nodesByZone[zone.zoneId] || []).length > 0" class="flex items-center flex-wrap gap-1.5 mb-3">
        <span
          v-for="n in (nodesByZone[zone.zoneId] || []).slice(0, 3)"
          :key="n.nodeId"
          class="flex items-center gap-1 bg-white/5 border border-dathua-border rounded-full pl-1.5 pr-2 py-1"
        >
          <span class="w-3.5 h-3.5 shrink-0 text-dathua-text-soft" v-html="DEVICE_ICONS[n.deviceType]"></span>
          <span class="text-[11px] text-dathua-text-soft truncate max-w-[90px]">{{ n.name }}</span>
        </span>
        <span v-if="(nodesByZone[zone.zoneId] || []).length > 3" class="text-[11px] text-dathua-text-soft px-1">
          +{{ (nodesByZone[zone.zoneId] || []).length - 3 }} más
        </span>
      </div>
      <p v-else class="text-dathua-text-soft/60 text-xs mb-3">Sin equipos todavía.</p>

      <button
        v-if="showView"
        type="button"
        class="w-full py-2 rounded-lg text-xs font-semibold text-dathua-orange border border-dathua-orange/30 hover:bg-dathua-orange/10 transition-colors duration-200 cursor-pointer"
        @click="$emit('view', zone)"
      >
        Ver zona →
      </button>
    </div>
  </div>
</template>

<script setup>
import { ZONE_ICONS } from '../../../utils/zoneIcons'
import { DEVICE_ICONS } from '../../../utils/deviceIcons'
import { ROLE_COLOR } from '../../../utils/status'

const props = defineProps({
  zones: { type: Array, default: () => [] },
  showView: { type: Boolean, default: false },
  // { [zoneId]: Node[] } — para pintar un punto de salud real y una vista
  // previa de equipos por zona sin pedirle otra llamada al backend a este
  // componente.
  nodesByZone: { type: Object, default: () => ({}) },
})
defineEmits(['edit', 'delete', 'view'])

const HEALTH_LABEL = {
  good: 'Todo en línea',
  warning: 'Advertencias activas',
  serious: 'Equipos fuera de línea',
  critical: 'Estado crítico',
  neutral: 'Sin datos aún',
}

function zoneHealthRole(zoneId) {
  const nodes = props.nodesByZone[zoneId] || []
  if (nodes.length === 0) return 'neutral'
  if (nodes.some((n) => n.status === 'Critical')) return 'critical'
  if (nodes.some((n) => n.status === 'Offline')) return 'serious'
  if (nodes.some((n) => n.status === 'Warning')) return 'warning'
  if (nodes.every((n) => n.status === 'Unknown')) return 'neutral'
  return 'good'
}

function healthColor(zoneId) {
  return ROLE_COLOR[zoneHealthRole(zoneId)]
}

function healthLabel(zoneId) {
  return HEALTH_LABEL[zoneHealthRole(zoneId)]
}
</script>
