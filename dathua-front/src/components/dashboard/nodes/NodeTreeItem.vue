<template>
  <div>
    <div
      class="group flex items-center gap-2.5 py-2.5 pr-2 rounded-lg hover:bg-white/5 transition-colors duration-150"
      :style="{ paddingLeft: `${depth * 1.5}rem` }"
    >
      <button
        v-if="node.children.length"
        type="button"
        class="w-5 h-5 shrink-0 flex items-center justify-center text-dathua-text-soft hover:text-white cursor-pointer"
        @click="expanded = !expanded"
      >
        <svg class="w-3.5 h-3.5 transition-transform duration-150" :class="{ '-rotate-90': !expanded }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <span v-else class="w-5 shrink-0"></span>

      <span class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: statusColor }" :title="statusLabel"></span>

      <span class="w-6 h-6 rounded-md bg-white/5 text-dathua-text-soft flex items-center justify-center p-1 shrink-0" v-html="DEVICE_ICONS[node.deviceType]"></span>

      <button type="button" class="min-w-0 flex-1 text-left sm:cursor-default cursor-pointer" @click="showDetails = !showDetails">
        <div class="flex items-center flex-wrap gap-x-2.5 gap-y-0.5">
          <span class="text-sm font-medium text-white truncate">{{ node.name }}</span>
          <span class="text-xs text-dathua-text-soft shrink-0">{{ formatDeviceType(node.deviceType) }}</span>
          <span class="text-xs text-dathua-text-soft/70 font-mono shrink-0">{{ node.ipAddress }}</span>
          <span v-if="node.isRootGateway" class="text-[10px] uppercase tracking-wide bg-dathua-orange/10 text-dathua-orange border border-dathua-orange/30 rounded-full px-2 py-0.5 shrink-0">Gateway</span>
          <!-- En escritorio ya hay espacio de sobra: las métricas se ven de una, sin tener que hacer clic -->
          <span v-if="hasLatency" class="hidden sm:inline text-xs text-dathua-text-soft/70 shrink-0">· {{ node.lastPingMs }} ms</span>
          <span class="hidden sm:inline text-xs text-dathua-text-soft/70 shrink-0">· {{ lastSeenLabel }}</span>
        </div>
        <p v-if="node.externalParentName" class="text-[11px] text-dathua-text-soft/70 mt-0.5">
          ↳ depende de {{ node.externalParentName }} (otra zona)
        </p>
      </button>

      <div class="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
        <router-link :to="`/dashboard/nodes/${node.nodeId}`" class="w-7 h-7 rounded-lg flex items-center justify-center text-dathua-text-soft hover:text-white hover:bg-white/5" title="Ver detalle">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </router-link>
        <button type="button" class="w-7 h-7 rounded-lg flex items-center justify-center text-dathua-text-soft hover:text-white hover:bg-white/5 cursor-pointer" title="Editar" @click="$emit('edit', node)">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button type="button" class="w-7 h-7 rounded-lg flex items-center justify-center text-dathua-text-soft hover:text-red-400 hover:bg-red-500/10 cursor-pointer" title="Eliminar" @click="$emit('delete', node)">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>

    <div v-if="showDetails" class="sm:hidden flex flex-wrap gap-x-6 gap-y-1 text-xs text-dathua-text-soft bg-white/[0.03] rounded-lg py-2.5 px-3 mb-1" :style="{ marginLeft: `${depth * 1.5 + 3.25}rem` }">
      <span>Estado: <span class="text-gray-300">{{ statusLabel }}</span></span>
      <span v-if="node.macAddress">MAC: <span class="text-gray-300 font-mono">{{ node.macAddress }}</span></span>
      <span v-if="hasLatency">Latencia: <span class="text-gray-300">{{ node.lastPingMs }} ms</span></span>
      <span>Última vez visto: <span class="text-gray-300">{{ lastSeenLabel }}</span></span>
    </div>

    <div v-if="expanded">
      <NodeTreeItem
        v-for="child in node.children"
        :key="child.nodeId"
        :node="child"
        :depth="depth + 1"
        @edit="(n) => $emit('edit', n)"
        @delete="(n) => $emit('delete', n)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { NODE_STATUS, ROLE_COLOR } from '../../../utils/status'
import { formatDeviceType } from '../../../utils/metrics'
import { formatRelativeTime } from '../../../utils/time'
import { DEVICE_ICONS } from '../../../utils/deviceIcons'

const props = defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 0 },
})
defineEmits(['edit', 'delete'])

const expanded = ref(true)
const showDetails = ref(false)

const statusColor = computed(() => ROLE_COLOR[NODE_STATUS[props.node.status]?.role || 'neutral'])
const statusLabel = computed(() => NODE_STATUS[props.node.status]?.label || props.node.status)
const hasLatency = computed(() => props.node.lastPingMs !== null && props.node.lastPingMs !== undefined)
const lastSeenLabel = computed(() => (props.node.lastSeenAt ? formatRelativeTime(props.node.lastSeenAt) : 'nunca visto'))
</script>
